/**
 * Global game store (Zustand).
 *
 * Holds the authoritative game clock (time, timeScale, paused) plus the
 * inventory. The shared game-clock loop (gameClock.js) advances `time`;
 * future systems — creature needs, crops, the day-night cycle — read and
 * tick off this same clock instead of running their own timers.
 *
 * Components may subscribe to slices via useGameStore(selector), so the
 * R3F canvas and the DOM HUD stay in sync without prop drilling.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { generateInitialDecorations, canPlaceDecoration } from '../data/decorations';
import { getTile, gridToWorld } from '../data/mapData';
import { TILE_THICKNESS } from '../components/Tile';
import { shopItem, canAfford, deductPrice, KIOSK_TILE } from '../data/shop';

/** Seconds of game time per full day-night cycle. */
export const DAY_CYCLE_SECONDS = 180;

/**
 * Save schema version — bump whenever a saved island becomes invalid
 * (e.g. the 12x12 → 14x14 expansion reshaped the map). Persisted to
 * localStorage by zustand AND stamped into cloud saves by saveSync, so
 * both the local cache and the Neon backup reject pre-bump saves.
 */
export const SAVE_VERSION = 2;

/**
 * Boot offset (~42% through the day cycle) so the game starts near late
 * morning — a bright first impression — instead of at midnight. Baked into
 * `time` so the HUD, the sky, and every future system agree on the phase.
 */
const START_TIME = DAY_CYCLE_SECONDS * 0.42;

export const useGameStore = create(
  persist(
    (set, get) => ({
  // ── Authoritative game clock ──
  time: START_TIME, // accumulated game-seconds (boots near midday)
  timeScale: 1, // 1 = real-time, 2 = double speed, 4 = fast-forward
  paused: false,
  dayCycleSeconds: DAY_CYCLE_SECONDS, // seconds per day-night cycle

  // ── Economy ──
  inventory: {
    berry: 0,
    shell: 0,
    stone: 0,
  },

  // ── Creature needs (0–100) ──
  needs: {
    hunger: 100,
    energy: 100,
    happiness: 100,
  },

  // ── Decorations ──
  // Every prop on the island (seeded scatter + player-planted) lives here,
  // so the map, the build ghost, and pathfinding all agree on occupancy.
  decorations: generateInitialDecorations(),

  // ── Build mode ──
  placement: {
    active: false,
    tool: null, // 'palm' | 'rock' | 'flower'
  },

  // ── Creature's current cell (kept in sync by Creature.jsx) ──
  // Used so the build ghost goes red over the pet and you can't seal it in.
  creaturePos: { row: 6, col: 6 },

  // ── Sleep (set by Creature.jsx when night falls / dawn breaks) ──
  // While true, drainNeeds recharges energy instead of draining it.
  sleeping: false,

  // ── Creature growth ──
  // Care points come from petting and from keeping the pet well-cared-for;
  // crossing a stage's threshold evolves the pet (bigger body, new colors).
  stage: 'baby', // 'baby' | 'adult'
  carePoints: 0,

  // ── Held item (feeding) ──
  // When the player "holds" a berry (via the inventory chip), clicking the
  // pet feeds it instead of petting it.
  holding: null, // 'berry' | null

  // ── Shop ──
  shopOpen: false,
  upgrades: {}, // owned upgrade ids (berryBasket, shellBucket, stonePick, comfyNest)
  unlockedDecorations: [], // shop-bought decoration kinds added to the palette

  // ── Actions ──
  /** Advance the clock by `gameDt` game-seconds (called by gameClock loop). */
  advanceTime: (gameDt) => set((s) => ({ time: s.time + gameDt })),

  setTimeScale: (scale) => set({ timeScale: scale }),

  togglePause: () => set((s) => ({ paused: !s.paused })),

  /**
   * Fast-forward the clock to the next dusk (~phase 0.82) — a dramatic
   * "night falls" moment without waiting out a whole day.
   */
  skipToNight: () =>
    set((s) => {
      const phase = (s.time % s.dayCycleSeconds) / s.dayCycleSeconds;
      const TARGET = 0.82; // sunset keyframe
      const forward = (TARGET - phase + 1) % 1;
      return { time: s.time + forward * s.dayCycleSeconds };
    }),

  /** Credit `amount` of a resource (default 1). No-op for unknown ids. */
  addResource: (resource, amount = 1) =>
    set((s) => {
      if (!(resource in s.inventory)) return s;
      return { inventory: { ...s.inventory, [resource]: s.inventory[resource] + amount } };
    }),

  /**
   * Drain the creature's needs by `gameDt` game-seconds (called by the
   * needs system, which ticks off the shared game clock). Clamped to 0.
   * While the pet sleeps, energy recharges instead of draining and hunger
   * falls slower (a sleeping pet barely gets hungrier) — sleep is the
   * natural recovery loop.
   *
   * The needs are **day-aware**: the clock shapes how fast they change —
   * active daylight burns hunger faster, restless nights burn energy
   * faster, and the calm night slows the happiness drain (the "night
   * bonus" the mood reads in moodFromNeeds).
   */
  drainNeeds: (gameDt) =>
    set((s) => {
      // Comfy Nest slows all need drain by 25%
      const rate = s.upgrades.comfyNest ? 0.75 : 1;
      // Reuse timeOfDay (same module) so the day/night split can never
      // drift from the HUD and the sky — 0.2–0.75 counts as daylight.
      const { isDay } = timeOfDay(s.time, s.dayCycleSeconds);

      if (s.sleeping) {
        return {
          needs: {
            hunger: Math.max(0, s.needs.hunger - NEED_DRAIN.hunger * 0.2 * rate * gameDt),
            energy: Math.min(100, s.needs.energy + SLEEP_RECHARGE * gameDt),
            happiness: Math.max(0, s.needs.happiness - NEED_DRAIN.happiness * 0.2 * rate * gameDt),
          },
        };
      }
      return {
        needs: {
          hunger: Math.max(
            0,
            s.needs.hunger - NEED_DRAIN.hunger * (isDay ? DAY_HUNGER_MULT : 1) * rate * gameDt
          ),
          energy: Math.max(
            0,
            s.needs.energy - NEED_DRAIN.energy * (isDay ? 1 : NIGHT_ENERGY_MULT) * rate * gameDt
          ),
          happiness: Math.max(
            0,
            s.needs.happiness - NEED_DRAIN.happiness * (isDay ? 1 : NIGHT_HAPPINESS_MULT) * rate * gameDt
          ),
        },
      };
    }),

  /** Mark the pet asleep/awake (set by Creature.jsx on night/day). */
  setSleeping: (sleeping) => set({ sleeping }),

  /** Boost a single need (e.g. petting raises happiness). Clamped to 100. */
  boostNeed: (need, amount) =>
    set((s) => {
      if (!(need in s.needs)) return s;
      return {
        needs: { ...s.needs, [need]: Math.min(100, s.needs[need] + amount) },
      };
    }),

  /**
   * Toggle whether the player is "holding" a resource (used to feed the
   * pet). Select the same resource again to put it down.
   */
  toggleHolding: (resource) =>
    set((s) => ({ holding: s.holding === resource ? null : resource })),

  /**
   * Feed the pet one berry: consumes a berry, restores hunger and gives a
   * happiness bump (a treat!), and puts the berry down. Returns true when a
   * berry was consumed, false when the inventory is empty.
   */
  feedPet: () => {
    const s = get();
    if ((s.inventory.berry ?? 0) < 1) return false;
    set((st) => ({
      inventory: { ...st.inventory, berry: st.inventory.berry - 1 },
      needs: {
        ...st.needs,
        hunger: Math.min(100, st.needs.hunger + FEED.hunger),
        happiness: Math.min(100, st.needs.happiness + FEED.happiness),
      },
      holding: null, // berry was eaten
    }));
    return true;
  },

  // ── Shop ──
  toggleShop: () => set((s) => ({ shopOpen: !s.shopOpen })),

  /**
   * Buy a shop item. Validates the item exists, isn't already owned, and is
   * affordable, then deducts the price and applies the effect (upgrade flag
   * or palette unlock). No-op (returns same state) when the purchase is
   * invalid — safe to call from UI with any state.
   */
  buyItem: (itemId) =>
    set((s) => {
      const item = shopItem(itemId);
      if (!item) return s;
      if (item.kind === 'upgrade' && s.upgrades[itemId]) return s; // owned
      if (item.kind === 'decoration' && s.unlockedDecorations.includes(itemId)) return s; // owned
      if (!canAfford(item.price, s.inventory)) return s;

      const inventory = deductPrice(item.price, s.inventory);
      if (item.kind === 'decoration') {
        return { inventory, unlockedDecorations: [...s.unlockedDecorations, itemId] };
      }
      return { inventory, upgrades: { ...s.upgrades, [itemId]: true } };
    }),

  /**
   * Credit care points toward evolution (petting +1, passive trickle from
   * the needs system). Crosses a stage threshold → evolve; care resets.
   */
  addCare: (amount) =>
    set((s) => {
      const current = GROWTH[s.stage];
      if (!current || !current.next) return s; // fully grown
      const carePoints = s.carePoints + amount;
      if (carePoints >= current.next.required) {
        return { carePoints: 0, stage: current.next.id };
      }
      return { carePoints };
    }),

  // ── Build mode ──
  /** Enter build mode with a tool, or exit if it's already active. */
  togglePlacement: (tool) =>
    set((s) =>
      s.placement.active && s.placement.tool === tool
        ? { placement: { active: false, tool: null } }
        : { placement: { active: true, tool } }
    ),

  stopPlacement: () => set({ placement: { active: false, tool: null } }),

  /**
   * Plant a decoration at a grid cell. Validates terrain, occupancy, and
   * the creature's cell; no-op when the ghost shows red.
   */
  placeDecoration: (kind, row, col) =>
    set((s) => {
      if (!canPlaceDecoration(s.decorations, row, col, s.creaturePos, KIOSK_TILE)) return s;
      const tile = getTile(row, col);
      const { x, z } = gridToWorld(row, col);
      return {
        decorations: [
          ...s.decorations,
          {
            id: `${row},${col}`,
            kind,
            row,
            col,
            x,
            z,
            y: tile.height + TILE_THICKNESS,
            rot: Math.random() * Math.PI * 2,
            scale: 0.75 + Math.random() * 0.55,
          },
        ],
      };
    }),

  /** Remove a decoration from a grid cell (eraser tool). No-op if empty. */
  removeDecoration: (row, col) =>
    set((s) => {
      if (!s.decorations.some((d) => d.row === row && d.col === col)) return s;
      return {
        decorations: s.decorations.filter((d) => !(d.row === row && d.col === col)),
      };
    }),

  /** Is a grid cell impassable? (Pathfinding queries this.) Decorations
   *  block, and the shop kiosk owns its tile. */
  isTileBlocked: (row, col) => {
    const s = get();
    if (row === KIOSK_TILE.row && col === KIOSK_TILE.col) return true;
    return s.decorations.some((d) => d.row === row && d.col === col);
  },

  /** Track the creature's current cell (called only when it changes). */
  setCreaturePos: (row, col) =>
    set((s) => {
      if (s.creaturePos.row === row && s.creaturePos.col === col) return s;
      return { creaturePos: { row, col } };
    }),

  /**
   * Wipe the save: clear localStorage and restore every persisted slice to
   * its fresh-game default. The clock, pause state, and build mode also
   * reset so testing starts from a clean island.
   */
  resetGame: () => {
    useGameStore.persist.clearStorage();
    set({
      time: START_TIME, // back to a fresh late-morning start
      timeScale: 1,
      paused: false,
      inventory: { berry: 0, shell: 0, stone: 0 },
      needs: { hunger: 100, energy: 100, happiness: 100 },
      decorations: generateInitialDecorations(),
      sleeping: false,
      stage: 'baby',
      carePoints: 0,
      upgrades: {},
      unlockedDecorations: [],
      shopOpen: false,
      holding: null,
      placement: { active: false, tool: null },
    });
  },
    }),
    {
      name: 'katherine-island-save', // localStorage key
      version: SAVE_VERSION,
      // The island was expanded 12x12 → 14x14, which reshapes every
      // decoration's grid position; discard pre-v2 saves so players get
      // the fresh larger island instead of mis-positioned props.
      migrate: () => ({}),
      // Only progress worth surviving a reload is persisted — the clock,
      // pause, build mode, and held berry are transient and boot fresh.
      partialize: (s) => ({
        inventory: s.inventory,
        needs: s.needs,
        stage: s.stage,
        carePoints: s.carePoints,
        upgrades: s.upgrades,
        unlockedDecorations: s.unlockedDecorations,
        decorations: s.decorations,
      }),
    }
  )
);

/**
 * Evolution chain: each stage lists the next stage + care required to reach
 * it. Care comes from petting (+1) and from staying well-cared-for.
 */
export const GROWTH = {
  baby: {
    label: 'Baby',
    emoji: '🐣',
    next: { id: 'adult', required: 5 },
  },
  adult: {
    label: 'Adult',
    emoji: '🦋',
    next: null, // fully grown
  },
};

/**
 * What the HUD should show for the current stage: progress toward the next
 * evolution, or `isMax` when fully grown. Returns null for unknown stages.
 */
export function growthInfo(stage, carePoints) {
  const config = GROWTH[stage];
  if (!config) return null;
  const next = config.next ? GROWTH[config.next.id] : null;
  return {
    emoji: config.emoji,
    label: config.label,
    isMax: !config.next,
    current: config.next ? Math.floor(carePoints) : null,
    required: config.next ? config.next.required : null,
    nextLabel: next ? next.label : null,
  };
}

/** How fast each need drains per game-second (baseline, at 1x). */
export const NEED_DRAIN = {
  hunger: 0.45,
  energy: 0.3,
  happiness: 0.22,
};

/** Day/night need multipliers — the shared clock shapes the creature sim. */
export const DAY_HUNGER_MULT = 1.4; // active days burn hunger 40% faster
/** Restless nights burn energy 50% faster (good reason to head to bed). */
export const NIGHT_ENERGY_MULT = 1.5;
/** Calm nights drain happiness 30% slower — the nighttime mood bonus. */
export const NIGHT_HAPPINESS_MULT = 0.7;

/** Energy restored per game-second while the pet sleeps. */
export const SLEEP_RECHARGE = 2.2;

/** What feeding the pet one berry restores. */
export const FEED = {
  hunger: 18, // berries are food
  happiness: 12, // and a treat
};

/** Mood display config keyed by mood id. */
export const MOODS = {
  happy: { label: 'Happy', emoji: '😄' },
  content: { label: 'Content', emoji: '🙂' },
  hungry: { label: 'Hungry', emoji: '😋' },
  tired: { label: 'Tired', emoji: '😴' },
  sad: { label: 'Sad', emoji: '😢' },
};

/**
 * Derive the pet's mood from its needs. Most-critical need wins; a fully
 * cared-for pet is happy, anything else is content.
 *
 * Pass `isNight` for the nighttime bonus: after dark the pet is calm, so
 * a blue pet reads as content and a content one drifts into a happy night
 * mood. Hunger/exhaustion still win — a starving or worn-out pet can't be
 * soothed by the dark.
 */
export function moodFromNeeds(needs, isNight = false) {
  if (needs.energy < 25) return 'tired';
  if (needs.hunger < 25) return 'hungry';
  if (needs.happiness < 25) return isNight ? 'content' : 'sad';
  if (needs.hunger > 70 && needs.energy > 70 && needs.happiness > 70) return 'happy';
  // Night-calm: content pets read as happy after dark
  return isNight ? 'happy' : 'content';
}

/**
 * Derive human-friendly day / phase from game-seconds.
 * phase 0..1 across one day; 0.2–0.75 roughly counts as daylight.
 */
export function timeOfDay(time, dayCycleSeconds = DAY_CYCLE_SECONDS) {
  const day = Math.floor(time / dayCycleSeconds) + 1;
  const phase = (time % dayCycleSeconds) / dayCycleSeconds;
  return { day, phase, isDay: phase >= 0.2 && phase < 0.75 };
}
