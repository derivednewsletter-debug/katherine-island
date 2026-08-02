/**
 * Cloud save sync — bridges the zustand store to the Neon-backed API
 * (`/api/save`) with localStorage as an offline cache.
 *
 * Design:
 *  - A stable per-browser player id lets the same island come back on any
 *    device, while still working offline (localStorage is the fallback).
 *  - Saves are pushed to the cloud with a **max-wait debounce**: the needs
 *    system changes the store every frame, so a plain debounce would never
 *    fire; the max-wait guarantee pushes at least every few seconds.
 *  - Freshness comes from the database's `updated_at` column (returned by
 *    GET), compared against the time we last synced (`localSyncedAt`).
 *    On boot the newer of local vs remote wins, so another device's
 *    progress is picked up.
 *  - Every network call is best-effort: when the API is absent (local dev
 *    without DATABASE_URL) or the network is down, the game silently keeps
 *    using localStorage, exactly as before.
 */
import { useGameStore, SAVE_VERSION } from './gameStore';
import { mergeDecorations, generateInitialDecorations } from '../data/decorations';

const PLAYER_KEY = 'katherine-player-id';
const SAVE_KEY = 'katherine-island-save'; // must match persist name in gameStore
const SYNCED_AT_KEY = 'katherine-save-synced-at'; // last time this browser synced
const PUSH_DEBOUNCE_MS = 1000; // settle after the last change
const PUSH_MAX_WAIT_MS = 3000; // but never wait longer than this
const API_TIMEOUT_MS = 8000; // abort a hung request so boot sync can't stall

/** Stable per-browser player id (created once, reused forever). */
export function getPlayerId() {
  let id = localStorage.getItem(PLAYER_KEY);
  if (!id) {
    id = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `player-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(PLAYER_KEY, id);
  }
  return id;
}

/** The persisted slice currently in localStorage ({state, version} wrapper). */
function readLocalSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/** The last time this browser wrote to (or read from) the cloud save. */
function getLocalSyncedAt() {
  return Number(localStorage.getItem(SYNCED_AT_KEY) || 0);
}

function setLocalSyncedAt(t) {
  try {
    localStorage.setItem(SYNCED_AT_KEY, String(t));
  } catch {
    /* ignore */
  }
}

async function apiRequest(path, options) {
  // Abort after a timeout so a hung server can't stall the boot sync or a
  // push — the game must keep working offline no matter what.
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), API_TIMEOUT_MS) : null;
  try {
    return await fetch(path, {
      ...options,
      signal: controller ? controller.signal : undefined,
    });
  } catch {
    return null; // offline / API absent / timeout
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Read the remote save. Returns { state, updatedAt } (ms epoch) or null
 * when absent / unreachable.
 */
async function fetchRemote() {
  const res = await apiRequest(`/api/save?player=${encodeURIComponent(getPlayerId())}`);
  if (!res || !res.ok) return null;
  const data = await res.json().catch(() => null);
  if (!data || !data.save) return null;
  return { state: data.save.state, updatedAt: data.updatedAt ?? 0 };
}

/** Best-effort push of the current persisted slice. Returns true on success. */
async function pushRemote() {
  const local = readLocalSave();
  if (!local || !local.state) return false;
  // Stamp the save-schema version into the payload (the persisted wrapper
  // holds it as `local.version`; the cloud stores state as-is). Old-version
  // cloud saves are skipped on load — see syncSaveFromCloud.
  const state = { ...local.state, __saveVersion: local.version ?? SAVE_VERSION };
  const res = await apiRequest('/api/save', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ player: getPlayerId(), state }),
  });
  if (res && res.ok) {
    setLocalSyncedAt(Date.now());
    return true;
  }
  return false;
}

/** Delete the remote save (used by Reset). */
export async function clearRemoteSave() {
  await apiRequest(`/api/save?player=${encodeURIComponent(getPlayerId())}`, {
    method: 'DELETE',
  });
}

let pushTimer = null;
let lastPushAt = 0;

/**
 * Subscribe to the store and push the persisted slice to the cloud when it
 * changes. Uses a max-wait debounce so continuous need-drain (every frame)
 * can't starve the push.
 */
export function startSaveSync() {
  const unsub = useGameStore.subscribe((state, prev) => {
    const sliceChanged =
      state.inventory !== prev.inventory ||
      state.needs !== prev.needs ||
      state.stage !== prev.stage ||
      state.carePoints !== prev.carePoints ||
      state.upgrades !== prev.upgrades ||
      state.unlockedDecorations !== prev.unlockedDecorations ||
      state.decorations !== prev.decorations ||
      state.ownedEggs !== prev.ownedEggs ||
      state.placedEggs !== prev.placedEggs ||
      state.pets !== prev.pets ||
      state.namingPetId !== prev.namingPetId ||
      state.selectedPetId !== prev.selectedPetId ||
      state.quests !== prev.quests ||
      state.crops !== prev.crops ||
      state.seeds !== prev.seeds ||
      state.unlockedCrops !== prev.unlockedCrops ||
      state.weather !== prev.weather ||
      state.time !== prev.time ||
      state.farmOpen !== prev.farmOpen;
    if (!sliceChanged) return;

    clearTimeout(pushTimer);
    const now = Date.now();
    const elapsed = now - lastPushAt;
    // Fire soon after the last change, but at least once per PUSH_MAX_WAIT_MS.
    const wait =
      elapsed >= PUSH_MAX_WAIT_MS
        ? 0
        : Math.min(PUSH_DEBOUNCE_MS, PUSH_MAX_WAIT_MS - elapsed);

    pushTimer = setTimeout(() => {
      lastPushAt = Date.now();
      pushRemote();
    }, wait);
  });
  return () => {
    clearTimeout(pushTimer);
    unsub();
  };
}

/**
 * On boot: pull the cloud save and apply it when it is newer than the last
 * sync this browser performed. Returns true when a remote save was applied.
 * Best-effort — never blocks or throws.
 */
export async function syncSaveFromCloud() {
  const remote = await fetchRemote();
  if (!remote) return false;

  // Remote is newer than our last sync → another device (or this one on a
  // different browser) made progress; adopt it.
  if (remote.updatedAt <= getLocalSyncedAt()) return false;

  // Reject cloud saves from an older map/schema version (e.g. the 12x12
  // island) — their decorations reference a reshaped grid. Only adopt
  // saves stamped with the current SAVE_VERSION.
  if ((remote.state.__saveVersion ?? 0) < SAVE_VERSION) return false;

  const { __saveVersion: _stamp, ...state } = remote.state;
  const current = useGameStore.getState();
  useGameStore.setState({
    time: state.time ?? current.time,
    inventory: state.inventory ?? current.inventory,
    needs: state.needs ?? current.needs,
    stage: state.stage ?? current.stage,
    carePoints: state.carePoints ?? current.carePoints,
    upgrades: state.upgrades ?? current.upgrades,
    unlockedDecorations: state.unlockedDecorations ?? current.unlockedDecorations,
    // The deterministic scatter is NOT stored in saves; re-merge the
    // regenerated scatter with the remote player's planted props/erases.
    plantedDecorations: state.plantedDecorations ?? current.plantedDecorations,
    removedScatterCells: state.removedScatterCells ?? current.removedScatterCells,
    decorations: mergeDecorations(
      generateInitialDecorations(),
      state.plantedDecorations ?? current.plantedDecorations,
      state.removedScatterCells ?? current.removedScatterCells
    ),
    ownedEggs: state.ownedEggs ?? current.ownedEggs,
    placedEggs: state.placedEggs ?? current.placedEggs,
    pets: state.pets ?? current.pets,
    namingPetId: state.namingPetId ?? current.namingPetId,
    selectedPetId: state.selectedPetId ?? current.selectedPetId,
    quests: state.quests ?? current.quests,
    crops: state.crops ?? current.crops,
    seeds: state.seeds ?? current.seeds,
    unlockedCrops: state.unlockedCrops ?? current.unlockedCrops,
    weather: state.weather ?? current.weather,
  });
  // The persist middleware re-saves the applied state locally; mark the
  // cloud as in-sync so a reload doesn't re-apply it.
  setLocalSyncedAt(remote.updatedAt);
  return true;
}
