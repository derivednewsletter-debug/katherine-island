/**
 * Fog-of-war exploration state — the set of map tiles the camera has seen.
 *
 * This deliberately lives OUTSIDE the zustand store (like cameraBus): the
 * camera marks tiles explored every frame while panning, so putting it in
 * the store would re-render every subscribed component at 60fps. Instead
 * it's a plain module with a monotonically increasing `version` counter —
 * consumers (the minimap fog layer, the 3D fog plane, the explored stat)
 * poll the version cheaply and repaint only when it changes.
 *
 * Persistence: a throttled localStorage snapshot (explored cells are pure
 * per-device viewing progress, so it's NOT part of the Neon cloud save).
 */
import { GRID_SIZE } from '../data/mapData';

const STORAGE_KEY = 'katherine-explored-v1';

/** Explored cells as "row,col" strings. */
const explored = new Set();
let version = 0;
const TOTAL = GRID_SIZE * GRID_SIZE;

/** Monotonic bump counter — repaint consumers compare against it. */
export function exploredVersion() {
  return version;
}

/** Has this tile been seen by the camera? */
export function isExplored(row, col) {
  return explored.has(`${row},${col}`);
}

/** Number of explored tiles (for the map stat). */
export function exploredCount() {
  return explored.size;
}

/** Percent of the whole map explored, 0–100. */
export function exploredPercent() {
  return Math.round((explored.size / TOTAL) * 100);
}

/** True once every tile has been seen — the "map fully explored" moment. */
export function isFullyExplored() {
  return explored.size >= TOTAL;
}

/**
 * Mark every tile in an inclusive rectangle (clamped to the grid) as
 * explored. Only bumps `version` when something NEW was added, so idle
 * frames never trigger repaints.
 */
export function markExploredRect(row0, col0, row1, col1) {
  if (explored.size >= TOTAL) return;
  const r0 = Math.max(0, Math.min(row0, row1));
  const r1 = Math.min(GRID_SIZE - 1, Math.max(row0, row1));
  const c0 = Math.max(0, Math.min(col0, col1));
  const c1 = Math.min(GRID_SIZE - 1, Math.max(col0, col1));
  let added = false;
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      const key = `${r},${c}`;
      if (!explored.has(key)) {
        explored.add(key);
        added = true;
      }
    }
  }
  if (added) version++;
}

/**
 * Fill a Uint8Array (length GRID_SIZE*GRID_SIZE) with 255 for explored
 * tiles and 0 for unexplored — the raw data backing the 3D fog DataTexture.
 * Row-major, matching the map grid.
 */
export function fillExploredData(data) {
  let i = 0;
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      data[i++] = explored.has(`${r},${c}`) ? 255 : 0;
    }
  }
}

/** Persist the explored set to localStorage (throttled by callers). */
export function saveExplored() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...explored]));
  } catch {
    /* storage full / private mode — fog just won't persist */
  }
}

/** Load a previously saved explored set. Safe to call at boot. */
export function loadExplored() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return;
    for (const key of arr) {
      if (typeof key === 'string' && key.includes(',')) explored.add(key);
    }
  } catch {
    /* corrupt save — start fresh */
  }
  version++;
}

/** Wipe explored state (Reset button). */
export function resetExplored() {
  explored.clear();
  version++;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
