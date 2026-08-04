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
import { throttledStorage } from './throttledStorage';
import {
  generateInitialDecorations,
  mergeDecorations,
  canPlaceDecoration,
} from '../data/decorations';
import { getTile, gridToWorld, isWalkable, BED_SPOT, SPAWN_POINT, GRID_SIZE } from '../data/mapData';
import { resetExplored } from './exploration';
import { TILE_THICKNESS } from '../components/Tile';
import { shopItem, canAfford, deductPrice, SELL_PRICES, KIOSK_TILE } from '../data/shop';
import { PET_SPECIES, EGG_HATCH_MS, pickPetHome } from '../data/species';
import { questById, freshQuests, questIndexByMetric } from '../data/quests';
import { cropById, cropStageIndex, DAY_CYCLE_SECONDS as CYCLE_SECONDS } from '../data/crops';
import { RESOURCES } from '../data/resources';
import { isSick, trackRunaway, SICK_DRAIN_MULT } from './petStates';

/** Seconds of game time per full day-night cycle. The value lives in
 *  data/crops.js (night-only crop growth counts phases against it) and is
 *  re-exported here so every existing `DAY_CYCLE_SECONDS` import keeps
 *  working with a single source of truth. */
export const DAY_CYCLE_SECONDS = CYCLE_SECONDS;

/**
 * Save schema version — bump whenever a saved island becomes invalid
 * (e.g. the 14x14 hand-authored map → the 160x160 procedural archipelago
 * reshaped everything). Persisted to localStorage by zustand AND stamped
 * into cloud saves by saveSync, so both the local cache and the Neon
 * backup reject pre-bump saves.
 */
export const SAVE_VERSION = 3;

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
  currency: 10, // coins for buying/selling in the shop
  inventory: {
    berry: 3,
    shell: 0,
    stone: 0,
    wood: 0,
    flower: 0,
    fruit: 0,
    herb: 0,
    soap: 0,
    medkit: 0,
  },

  // ── Player (avatar controlled by the player with WASD) ──
  playerPos: { row: SPAWN_POINT.row, col: SPAWN_POINT.col + 3 }, // start a few tiles from the pet
  playerDir: 0, // facing direction (radians): 0 = +Z (north), Math.PI = -Z (south)
  playerTool: 'hoe', // 'axe' | 'hoe' | null
  playerMoving: false,
  // Tools the player owns and their remaining durability
  tools: { axe: 50, hoe: 50 },

  // ── Creature needs (0–100) ──
  needs: {
    hunger: 100,
    energy: 100,
    happiness: 100,
    hygiene: 100,
  },
  sick: false,

  // ── Decorations ──
  // Every prop on the island (seeded scatter + player-planted) lives here,
  // so the map, the build ghost, and pathfinding all agree on occupancy.
  // The scatter is deterministic (regenerated on boot); only player-planted
  // props and erased scatter cells are persisted — see partialize.
  decorations: generateInitialDecorations(),
  plantedDecorations: [], // player-planted props (persisted)
  removedScatterCells: [], // "row,col" cells whose seed prop was erased (persisted)

  // ── Build mode ──
  placement: {
    active: false,
    tool: null, // 'palm' | 'rock' | 'flower'
  },

  // ── Creature's current cell (kept in sync by Creature.jsx) ──
  // Used so the build ghost goes red over the pet and you can't seal it in.
  // Defaults to the procedural spawn clearing.
  creaturePos: { row: SPAWN_POINT.row, col: SPAWN_POINT.col },

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

  // ── Pet eggs & hatched pets ──
  // Eggs are bought at the shop (repeatable), then placed on the island;
  // after EGG_HATCH_MS of REAL time they hatch into a new wandering pet.
  ownedEggs: [], // [{ id, species }] bought but not yet placed
  placedEggs: [], // [{ id, species, row, col, x, z, y, plantedAt }] incubating
  pets: [], // [{ id, species, name, pos, needs, sleeping }] hatched pets
  namingPetId: null, // pet awaiting a name at the hatch moment
  selectedPetId: 'starter', // 'starter' | a pets[].id — whose needs the HUD shows

  // ── Quest board ──
  // Simple goals that reward the gather/care loop. Progress is advanced by
  // recordQuestProgress (called from MapGrid, Creature, Pet, buyItem).
  quests: freshQuests(), // [{ id, progress, claimed }]
  questBoardOpen: false,

  // ── Farm HUD ──
  // Transient panel (like the shop/quest board) listing every planted crop
  // with its stage + progress; NOT persisted.
  farmOpen: false,

  // ── Crops ──
  // Player-planted crops growing on the island. Growth is derived from the
  // shared game clock (crop.plantedAt is in game-seconds), so pause/speed
  // and the day-night cycle drive the stages. `toast` is a transient HUD
  // message (harvest feedback, etc.) — never persisted.
  crops: [], // [{ id, cropId, row, col, x, z, y, rot, scale, plantedAt }]
  plots: [], // [{ id, row, col, x, z, y, rot, scale }] tilled soil plots
  toast: null, // { id, text } | null

  // ── Seed economy ──
  // Seeds are bought at the shop (seed packs); planting a crop consumes one
  // seed from the matching pile. `unlockedCrops` holds rare crops revealed
  // by the shop's exotic section (currently the night flower) — the plant
  // palette gates on it. Both persist.
  seeds: {}, // { berryBush: 3, nightFlower: 2, ... }
  unlockedCrops: [], // ['nightFlower', ...]

  // ── Weather ──
  // Rare passing rain showers, scheduled off the shared game clock by
  // weather.js. While raining, crop growth runs 2x and the scene dims +
  // plays rain audio. `rainSpans` (closed showers, game-seconds) drive the
  // derived growth math, so it all stays consistent across pause/speed/
  // reload. The whole slice persists (game-time based like the clock).
  weather: {
    raining: false,
    rainStartAt: 0, // game-time the active shower began (0 = none)
    rainUntil: 0, // game-time the active shower ends
    nextRainAt: 0, // game-time to roll the next shower (0 = unscheduled)
    rainSpans: [], // [{ start, end }] — pruned by weather.js
    wiltToastShown: false, // one-time warning to prevent spam
  },

  // ── Actions ──
  /** Advance the clock by `gameDt` game-seconds (called by gameClock loop). */
  advanceTime: (gameDt) => set((s) => ({ time: s.time + gameDt })),

  /** Merge a partial weather update (used by the weather system). */
  setWeather: (partial) => set((s) => ({ weather: { ...s.weather, ...partial } })),

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

   /** Pop a transient HUD toast (harvest feedback, hints). Auto-fades in the UI. */
  showToast: (text) =>
    set((s) => ({ toast: { id: (s.toast?.id ?? 0) + 1, text } })),

  // ── Player movement ──
  /** Move the player to a new grid cell (called by keyboard/controller). */
  movePlayer: (row, col) =>
    set((s) => {
      // Bounds check
      if (row < 0 || row >= GRID_SIZE || col < 0 || col >= GRID_SIZE) return s;
      // Must be walkable land (not water)
      const tile = getTile(row, col);
      if (!tile || !isWalkable(tile)) return s;
      // Can't move onto a decoration (except certain ones, not handled yet)
      if (s.decorations.some((d) => d.row === row && d.col === col)) return s;
      if (s.placedEggs.some((e) => e.row === row && e.col === col)) return s;
      return { playerPos: { row, col } };
    }),

  /** Set the player's facing direction (for animation). */
  setPlayerDir: (dir) => set({ playerDir: dir }),

  /** Set the player's currently equipped tool. */
  setPlayerTool: (tool) => set({ playerTool: tool }),

  /** Gather a tree on the player's current tile (axe only) — adds wood.
   *  Both scatter kinds (palm + big tree) are choppable. */
  chopTree: (row, col) =>
    set((s) => {
      if (s.playerTool !== 'axe') return s;
      const isTree = (d) => d.row === row && d.col === col && (d.kind === 'palm' || d.kind === 'tree');
      const hasTree = s.decorations.some(isTree);
      if (!hasTree) return s;
      const treeIdx = s.decorations.findIndex(isTree);
      if (treeIdx < 0) return s;
      return {
        decorations: s.decorations.filter((_, i) => i !== treeIdx),
        inventory: { ...s.inventory, wood: (s.inventory.wood ?? 0) + 1 },
      };
    }),

   /** Sell a resource for coins. */
  sellResource: (resource, amount = 1) =>
    set((s) => {
      const have = s.inventory[resource] ?? 0;
      if (have < amount) return s;
      // Uses fixed SELL_PRICES from shop.js — import at top
      return {
        inventory: { ...s.inventory, [resource]: have - amount },
        currency: s.currency + (SELL_PRICES[resource] ?? 1) * amount,
      };
    }),

  /** Add coins to the player's currency. */
  addCurrency: (amount) =>
    set((s) => ({ currency: s.currency + amount })),

  /** Buy an item from the shop for coins. */
  buyWithCoins: (itemId, price) =>
    set((s) => {
      if (s.currency < price) return s;
      return { currency: s.currency - price };
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
   *
   * Every hatched pet in `pets` drains by the same rules (each with its
   * own sleeping flag), so all the island's critters share one economy.
   */
  drainNeeds: (gameDt) =>
    set((s) => {
      // Comfy Nest slows all need drain by 25%
      const rate = s.upgrades.comfyNest ? 0.75 : 1;
      // Reuse timeOfDay (same module) so the day/night split can never
      // drift from the HUD and the sky — 0.2–0.75 counts as daylight.
      const { isDay } = timeOfDay(s.time, s.dayCycleSeconds);

      // Sickness drains every relevant need faster; it never forces sleep,
      // so energy behaves normally (recharges while sleeping, drains awake).
      const sick = isSick(s.needs);
      const mult = sick ? SICK_DRAIN_MULT : 1;

      const starterNeeds = s.sleeping
        ? {
            hunger: Math.max(0, s.needs.hunger - NEED_DRAIN.hunger * 0.2 * mult * rate * gameDt),
            energy: Math.min(100, s.needs.energy + SLEEP_RECHARGE * gameDt),
            happiness: Math.max(0, s.needs.happiness - NEED_DRAIN.happiness * 0.2 * mult * rate * gameDt),
            hygiene: Math.max(0, s.needs.hygiene - NEED_DRAIN.hygiene * 0.2 * mult * rate * gameDt),
          }
        : {
            hunger: Math.max(
              0,
              s.needs.hunger - NEED_DRAIN.hunger * (isDay ? DAY_HUNGER_MULT : 1) * mult * rate * gameDt
            ),
            energy: Math.max(
              0,
              s.needs.energy - NEED_DRAIN.energy * (isDay ? 1 : NIGHT_ENERGY_MULT) * rate * gameDt
            ),
            happiness: Math.max(
              0,
              s.needs.happiness - NEED_DRAIN.happiness * (isDay ? 1 : NIGHT_HAPPINESS_MULT) * mult * rate * gameDt
            ),
            hygiene: Math.max(0, s.needs.hygiene - NEED_DRAIN.hygiene * mult * rate * gameDt),
          };

      // Drain every hatched pet by the same day-aware rules, flag sickness
      // and track the runaway grace window here each tick.
      const pets = s.pets.map((p) => {
        const pSick = isSick(p.needs);
        const pMult = pSick ? SICK_DRAIN_MULT : 1;
        const needs = p.sleeping
          ? {
              hunger: Math.max(0, p.needs.hunger - NEED_DRAIN.hunger * 0.2 * pMult * rate * gameDt),
              energy: Math.min(100, p.needs.energy + SLEEP_RECHARGE * gameDt),
              happiness: Math.max(0, p.needs.happiness - NEED_DRAIN.happiness * 0.2 * pMult * rate * gameDt),
              hygiene: Math.max(0, p.needs.hygiene - NEED_DRAIN.hygiene * 0.2 * pMult * rate * gameDt),
            }
          : {
              hunger: Math.max(
                0,
                p.needs.hunger - NEED_DRAIN.hunger * (isDay ? DAY_HUNGER_MULT : 1) * pMult * rate * gameDt
              ),
              energy: Math.max(
                0,
                p.needs.energy - NEED_DRAIN.energy * (isDay ? 1 : NIGHT_ENERGY_MULT) * rate * gameDt
              ),
              happiness: Math.max(
                0,
                p.needs.happiness - NEED_DRAIN.happiness * (isDay ? 1 : NIGHT_HAPPINESS_MULT) * pMult * rate * gameDt
              ),
              hygiene: Math.max(0, p.needs.hygiene - NEED_DRAIN.hygiene * pMult * rate * gameDt),
            };
        const next = { ...p, needs, sick: pSick };
        return trackRunaway(next, s.time);
      });

      return { needs: starterNeeds, sick, pets };
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

  /** Raise hygiene (bath house / soap). Target defaults to 'starter' or a pet id. */
  addHygiene: (target, amount) =>
    set((s) => {
      const apply = (needs) => ({ ...needs, hygiene: Math.min(100, (needs.hygiene ?? 100) + amount) });
      if (target === 'starter') return { needs: apply(s.needs) };
      return { pets: s.pets.map((p) => (p.id === target ? { ...p, needs: apply(p.needs) } : p)) };
    }),

  /** Cure sickness with a medkit: restores hunger+hygiene to ≥50 and clears sick. */
  curePet: (target) => {
    const s = get();
    if ((s.inventory.medkit ?? 0) < 1) return false;
    const heal = (needs) => ({
      ...needs,
      hunger: Math.max(50, needs.hunger ?? 100),
      hygiene: Math.max(50, needs.hygiene ?? 100),
    });
    if (target === 'starter') {
      set({ inventory: { ...s.inventory, medkit: s.inventory.medkit - 1 }, needs: heal(s.needs), sick: false });
      return true;
    }
    set({
      inventory: { ...s.inventory, medkit: s.inventory.medkit - 1 },
      pets: s.pets.map((p) => (p.id === target ? { ...p, needs: heal(p.needs), sick: false } : p)),
    });
    return true;
  },

  /** Bathe with soap: restores +40 hygiene. Clears sick since hygiene climbs back. */
  bathePet: (target) => {
    const s = get();
    if ((s.inventory.soap ?? 0) < 1) return false;
    const wash = (needs) => ({ ...needs, hygiene: Math.min(100, (needs.hygiene ?? 100) + 40) });
    if (target === 'starter') {
      set({ inventory: { ...s.inventory, soap: s.inventory.soap - 1 }, needs: wash(s.needs), sick: false });
      return true;
    }
    set({
      inventory: { ...s.inventory, soap: s.inventory.soap - 1 },
      pets: s.pets.map((p) => (p.id === target ? { ...p, needs: wash(p.needs), sick: false } : p)),
    });
    return true;
  },

  /**
   * Toggle whether the player is "holding" a resource (used to feed the
   * pet). Select the same resource again to put it down.
   */
  toggleHolding: (resource) =>
    set((s) => ({ holding: s.holding === resource ? null : resource })),

  /**
   * Feed a pet the currently held resource (defaults to a berry when
   * nothing is held). `target` defaults to the HUD's selected pet
   * ('starter' or a hatched pet id) so the HUD feed button and in-world
   * pet clicks both work. Each feedable resource has its own effects —
   * see FEED_BY_RESOURCE (berries fill hunger, jungle fruit is a heartier
   * meal, herbs restore energy, flowers lift happiness). Returns true
   * when a treat was consumed, false when the inventory is empty.
   */
  feedPet: (target) => {
    const s = get();
    const petId = target ?? s.selectedPetId;
    const resource = s.holding && FEED_BY_RESOURCE[s.holding] ? s.holding : 'berry';
    const fx = FEED_BY_RESOURCE[resource];
    if (!fx || (s.inventory[resource] ?? 0) < 1) return false;
    const apply = (needs) => ({
      hunger: Math.min(100, (needs.hunger ?? 100) + (fx.hunger ?? 0)),
      energy: Math.min(100, (needs.energy ?? 100) + (fx.energy ?? 0)),
      happiness: Math.min(100, (needs.happiness ?? 100) + (fx.happiness ?? 0)),
      hygiene: Math.min(100, (needs.hygiene ?? 100) + (fx.hygiene ?? 0)),
    });
    if (petId === 'starter') {
      set((st) => ({
        inventory: { ...st.inventory, [resource]: st.inventory[resource] - 1 },
        needs: apply(st.needs),
        holding: null, // treat was eaten
      }));
      return true;
    }
    set((st) => ({
      inventory: { ...st.inventory, [resource]: st.inventory[resource] - 1 },
      pets: st.pets.map((p) => (p.id === petId ? { ...p, needs: apply(p.needs) } : p)),
      holding: null, // treat was eaten
    }));
    return true;
  },

  // ── Crops ──
  /** Plant a crop (the placement tool is `crop:<id>`). Validates biome +
   *  occupancy; on success the crop's real-time growth clock starts. */
  plantCrop: (cropId, row, col) =>
    set((s) => {
      if (!s.placement.active || s.placement.tool !== `crop:${cropId}`) return s;
      const def = cropById(cropId);
      if (!def) return s;
      // Seed economy: planting consumes one seed. A toast explains when the
      // pile is empty so the failed click isn't silent.
      if ((s.seeds[cropId] ?? 0) < 1) {
        return {
          toast: {
            id: (s.toast?.id ?? 0) + 1,
            text: `${def.emoji} No ${def.label} seeds — buy some at the shop!`,
          },
        };
      }
      // Seeds only take root in tilled soil
      if (!s.plots.some((p) => p.row === row && p.col === col)) {
        return {
          toast: {
            id: (s.toast?.id ?? 0) + 1,
            text: `${def.emoji} Till the soil first — equip the hoe (2) and click the ground`,
          },
        };
      }
      // Biome + occupancy gate (silent; the ghost is red before you click).
      if (!canPlantCrop(s, cropId, row, col)) return s;
      const tile = getTile(row, col);
      const { x, z } = gridToWorld(row, col);
      return {
        crops: [
          ...s.crops,
          {
            id: uid(),
            cropId,
            row,
            col,
            x,
            z,
            y: tile.height + TILE_THICKNESS,
            rot: Math.random() * Math.PI * 2,
            scale: 0.9 + Math.random() * 0.3,
            plantedAt: s.time, // game-seconds — growth runs on the shared clock
          },
        ],
        seeds: { ...s.seeds, [cropId]: s.seeds[cropId] - 1 },
        placement: { active: false, tool: null, eggId: null },
      };
    }),

  /** Harvest a fully-grown crop at a cell. Credits the reward, advances
   *  gather quests, and pops a toast. Returns true when harvested. */
  harvestCrop: (row, col) => {
    const s = get();
    const crop = s.crops.find((c) => c.row === row && c.col === col);
    if (!crop) return false;
    const def = cropById(crop.cropId);
    // Weather-aware readiness: rain growth counts double, and a wilted
    // jungle fruit may have regressed below ready.
    if (!def || cropStageIndex(crop, s.time, weatherOpts(s)) < def.durations.length) {
      return false;
    }
    const inventory = { ...s.inventory };
    const texts = [];
    for (const [resource, amount] of Object.entries(def.reward)) {
      inventory[resource] = (inventory[resource] ?? 0) + amount;
      texts.push(`${amount} ${RESOURCES[resource]?.emoji ?? resource}`);
      // Crop harvests count toward gather:<resource> quests too
      s.recordQuestProgress(`gather:${resource}`, amount);
    }
    set({
      inventory,
      crops: s.crops.filter((c) => c.id !== crop.id),
      toast: { id: (s.toast?.id ?? 0) + 1, text: `${def.emoji} +${texts.join(' + ')}` },
    });
    return true;
  },

  /** Remove a crop (eraser tool). No-op if the cell is empty. */
  removeCrop: (row, col) =>
    set((s) => {
      if (!s.crops.some((c) => c.row === row && c.col === col)) return s;
      return { crops: s.crops.filter((c) => !(c.row === row && c.col === col)) };
    }),

  /** Till the soil under a walkable land tile (hoe equipped only). */
  tillTile: (row, col) =>
    set((s) => {
      if (s.playerTool !== 'hoe') return s;
      if (!canTill(s, row, col)) return s;
      const tile = getTile(row, col);
      const { x, z } = gridToWorld(row, col);
      return {
        plots: [
          ...s.plots,
          {
            id: uid(),
            row,
            col,
            x,
            z,
            y: tile.height + TILE_THICKNESS,
            rot: Math.random() * Math.PI * 2,
            scale: 1,
          },
        ],
      };
    }),

  /** Remove a tilled plot (eraser). */
  removePlot: (row, col) =>
    set((s) => ({
      plots: s.plots.filter((p) => !(p.row === row && p.col === col)),
    })),

  // ── Quest board ──
  toggleQuestBoard: () => set((s) => ({ questBoardOpen: !s.questBoardOpen })),

  // ── Farm HUD ──
  toggleFarm: () => set((s) => ({ farmOpen: !s.farmOpen })),

  /**
   * Advance every quest watching `metric` by `amount` (clamped to target).
   * Called by game events (gather, pet, feed, buy). No-op when nothing
   * matches or a quest is already claimed.
   */
  recordQuestProgress: (metric, amount = 1) =>
    set((s) => {
      const quests = advanceQuests(s.quests, metric, amount);
      // No-op (return {}) when nothing advanced — avoids churning the store
      // root for clicks that don't match any active quest.
      return quests === s.quests ? {} : { quests };
    }),

  /**
   * Claim a finished quest's reward into the inventory and mark it claimed.
   * Returns true when the reward was actually paid, false when the quest is
   * missing, unfinished, or already claimed (so the UI only chimes on a real
   * payout and can't double-claim on a fast double-click).
   */
  claimQuestReward: (questId) => {
    const s = get();
    const quest = s.quests.find((q) => q.id === questId);
    const def = questById(questId);
    if (!quest || !def || quest.claimed || quest.progress < def.target) return false;
    const inventory = { ...s.inventory };
    for (const [resource, amount] of Object.entries(def.reward)) {
      inventory[resource] = (inventory[resource] ?? 0) + amount;
    }
    set({
      inventory,
      quests: s.quests.map((q) => (q.id === questId ? { ...q, claimed: true } : q)),
    });
    return true;
  },

  // ── Shop ──
  toggleShop: () => set((s) => ({ shopOpen: !s.shopOpen })),

  /**
   * Buy a shop item. Validates the item exists, isn't already owned, and is
   * affordable, then deducts the price and applies the effect (upgrade flag,
   * palette unlock, or a repeatable pet egg). No-op (returns same state)
   * when the purchase is invalid — safe to call from UI with any state.
   */
  buyItem: (itemId) =>
    set((s) => {
      const item = shopItem(itemId);
      if (!item) return s;
      if (item.kind === 'upgrade' && s.upgrades[itemId]) return s; // owned
      if (item.kind === 'decoration' && s.unlockedDecorations.includes(itemId)) return s; // owned
      if (item.kind === 'exotic' && s.unlockedCrops.includes(item.crop)) return s; // owned
      // Defense-in-depth: rare seeds can't be hoarded before their exotic
      // unlock is bought (the UI hides them, but the store should refuse too).
      if (item.kind === 'seed' && item.crop === 'nightFlower' && !s.unlockedCrops.includes(item.crop)) return s;
      if (!canAfford(item.price, s.inventory, s.currency)) return s;

      const { inventory: newInv, currency: newCurrency } = deductPrice(item.price, s.inventory, s.currency);

      if (item.kind === 'decoration') {
        return {
          inventory: newInv,
          currency: newCurrency,
          unlockedDecorations: [...s.unlockedDecorations, itemId],
          quests: advanceQuests(s.quests, 'buy:decoration', 1),
        };
      }
      if (item.kind === 'egg') {
        return {
          inventory: newInv,
          currency: newCurrency,
          ownedEggs: [...s.ownedEggs, { id: uid(), species: item.species }],
        };
      }
      if (item.kind === 'exotic') {
        return {
          inventory: newInv,
          currency: newCurrency,
          unlockedCrops: [...s.unlockedCrops, item.crop],
        };
      }
      if (item.kind === 'seed') {
        return {
          inventory: newInv,
          currency: newCurrency,
          seeds: { ...s.seeds, [item.crop]: (s.seeds[item.crop] ?? 0) + item.count },
        };
      }
      if (item.kind === 'tool') {
        const toolKey = item.tool;
        return {
          inventory: newInv,
          currency: newCurrency,
          tools: { ...s.tools, [toolKey]: (s.tools[toolKey] ?? 0) + 1 },
        };
      }
      if (item.kind === 'item') {
        return {
          inventory: { ...newInv, [item.resource]: (newInv[item.resource] ?? 0) + (item.count ?? 1) },
          currency: newCurrency,
        };
      }
      return { inventory: newInv, currency: newCurrency, upgrades: { ...s.upgrades, [itemId]: true } };
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
        ? { placement: { active: false, tool: null, eggId: null } }
        : { placement: { active: true, tool, eggId: null } }
    ),

  stopPlacement: () => set({ placement: { active: false, tool: null, eggId: null } }),

  /** Enter placement mode with a specific owned egg (or exit if it's the
   *  active tool). The egg ghost shows under the cursor like a decoration. */
  startEggPlacement: (eggId) =>
    set((s) => ({
      placement:
        s.placement.active && s.placement.tool === 'egg' && s.placement.eggId === eggId
          ? { active: false, tool: null, eggId: null }
          : { active: true, tool: 'egg', eggId },
    })),

  /**
   * Place an owned egg at a grid cell. Validates terrain + occupancy;
   * on success the egg leaves ownedEggs and starts incubating (its real
   * -time hatch clock begins). No-op when the ghost shows red.
   */
  placeEgg: (row, col) =>
    set((s) => {
      if (!s.placement.active || s.placement.tool !== 'egg') return s;
      const egg = s.ownedEggs.find((e) => e.id === s.placement.eggId);
      if (!egg) return s;
      if (!canPlaceEggTile(s, row, col)) return s;
      const tile = getTile(row, col);
      const { x, z } = gridToWorld(row, col);
      return {
        ownedEggs: s.ownedEggs.filter((e) => e.id !== egg.id),
        placedEggs: [
          ...s.placedEggs,
          {
            id: egg.id,
            species: egg.species,
            row,
            col,
            x,
            z,
            y: tile.height + TILE_THICKNESS,
            plantedAt: Date.now(),
          },
        ],
        placement: { active: false, tool: null, eggId: null },
      };
    }),

  /**
   * An egg finished incubating (10 real minutes) — remove it and add a
   * new pet at its tile. The naming prompt opens for the fresh critter.
   *
   * The pet is born at its HOME anchor — a far-flung spot in its species'
   * habitat biome — so the herd spreads across the island and the minimap
   * herd markers scatter, rather than every critter clustering at spawn.
   */
  hatchEgg: (eggId) =>
    set((s) => {
      const egg = s.placedEggs.find((e) => e.id === eggId);
      if (!egg) return s;
      const petId = uid();
      // Pick a home in the species' habitat that isn't already occupied by
      // a decoration, an egg, or the kiosk (so the pet can't hatch inside
      // a palm tree or the shop counter).
      const home = pickUnblockedHome(s, egg.species);
      return {
        placedEggs: s.placedEggs.filter((e) => e.id !== eggId),
        pets: [
          ...s.pets,
          {
            id: petId,
            species: egg.species,
            name: PET_SPECIES[egg.species]?.label ?? 'Pet',
            pos: { ...home },
            home,
            needs: { hunger: 85, energy: 90, happiness: 80 },
            sleeping: false,
          },
        ],
        namingPetId: petId,
        selectedPetId: petId,
      };
    }),

  /** Name the newly hatched pet (clears the naming prompt). */
  namePet: (name) =>
    set((s) => {
      if (!s.namingPetId) return s;
      const clean = (name || '').trim();
      return {
        pets: s.pets.map((p) =>
          p.id === s.namingPetId
            ? { ...p, name: clean || PET_SPECIES[p.species]?.label || 'Pet' }
            : p
        ),
        namingPetId: null,
      };
    }),

  /** Which pet the needs HUD shows (and the feed button feeds). */
  selectPet: (id) => set({ selectedPetId: id }),

  /** Click-to-pet an extra pet: happiness bump + hearts (no growth). */
  petPet: (id) =>
    set((s) => ({
      pets: s.pets.map((p) =>
        p.id === id
          ? { ...p, needs: { ...p.needs, happiness: Math.min(100, p.needs.happiness + 8) } }
          : p
      ),
    })),

  /** Rescue a runaway pet: brings it home and advances the rescue quest. */
  rescuePet: (id) =>
    set((s) => {
      const pet = s.pets.find((p) => p.id === id);
      if (!pet || !pet.ranAway) return s;
      return {
        pets: s.pets.map((p) =>
          p.id === id
            ? { ...p, ranAway: false, lowHappySince: null, needs: { ...p.needs, happiness: 80 } }
            : p
        ),
        quests: advanceQuests(s.quests, 'pet:rescue', 1),
        toast: { id: (s.toast?.id ?? 0) + 1, text: `🐾 You found ${pet.name}! They're home safe.` },
      };
    }),

  /** Track an extra pet's cell (fires only on change — like setCreaturePos).
   *  Guarded so a same-cell update returns the same state instead of a new
   *  pets array every frame. */
  setPetPos: (id, row, col) =>
    set((s) => {
      const pet = s.pets.find((p) => p.id === id);
      if (!pet || (pet.pos && pet.pos.row === row && pet.pos.col === col)) return s;
      return {
        pets: s.pets.map((p) => (p.id === id ? { ...p, pos: { row, col } } : p)),
      };
    }),

  /** Mark an extra pet asleep/awake (set by Pet.jsx on night/day). */
  setPetSleeping: (id, sleeping) =>
    set((s) => ({
      pets: s.pets.map((p) => (p.id === id ? { ...p, sleeping } : p)),
    })),

  /**
   * Plant a decoration at a grid cell. Validates terrain, occupancy, and
   * the creature's cell; no-op when the ghost shows red. Also refuses
   * tiles holding an incubating egg or a hatched pet.
   */
  placeDecoration: (kind, row, col) =>
    set((s) => {
      if (!canPlaceDecoration(s.decorations, row, col, s.creaturePos, KIOSK_TILE)) return s;
      if (s.placedEggs.some((e) => e.row === row && e.col === col)) return s;
      if (s.pets.some((p) => p.pos && p.pos.row === row && p.pos.col === col)) return s;
      if (s.crops.some((c) => c.row === row && c.col === col)) return s;
      const tile = getTile(row, col);
      const { x, z } = gridToWorld(row, col);
      const deco = {
        id: `${row},${col}`,
        kind,
        row,
        col,
        x,
        z,
        y: tile.height + TILE_THICKNESS,
        rot: Math.random() * Math.PI * 2,
        scale: 0.75 + Math.random() * 0.55,
      };
      return {
        decorations: [...s.decorations, deco],
        plantedDecorations: [...s.plantedDecorations, deco],
      };
    }),

  /** Remove a decoration from a grid cell (eraser tool). No-op if empty.
   *  Erasing a seed prop records its cell so it stays gone after a reload. */
  removeDecoration: (row, col) =>
    set((s) => {
      if (!s.decorations.some((d) => d.row === row && d.col === col)) return s;
      const cell = `${row},${col}`;
      const wasPlanted = s.plantedDecorations.some((d) => d.row === row && d.col === col);
      return {
        decorations: s.decorations.filter((d) => !(d.row === row && d.col === col)),
        plantedDecorations: s.plantedDecorations.filter((d) => !(d.row === row && d.col === col)),
        removedScatterCells: wasPlanted
          ? s.removedScatterCells
          : [...s.removedScatterCells, cell],
      };
    }),

  /** Is a grid cell impassable? (Pathfinding queries this — hot path on the
   *  big island, so it resolves through a cached O(1) Set that's rebuilt
   *  only when decorations/eggs actually change, not per query.) Decorations
   *  and incubating eggs block, and the shop kiosk owns its tile. */
  isTileBlocked: (row, col) => {
    const s = get();
    return blockedSetFor(s).has(`${row},${col}`);
  },

  /** Track the creature's current cell (called only when it changes). */
  setCreaturePos: (row, col) =>
    set((s) => {
      if (s.creaturePos.row === row && s.creaturePos.col === col) return s;
      return { creaturePos: { row, col } };
    }),

  /**
   * Can a crop be planted on this cell? Biome must match the crop, the
   * tile must be walkable land, and it can't collide with the kiosk, the
   * bed, the creature, a pet, an egg, a decoration, or another crop.
   */
  canPlantCrop: (row, col, cropId) => {
    const s = get();
    return canPlantCrop(s, cropId, row, col);
  },

  /**
   * Wipe the save: clear localStorage and restore every persisted slice to
   * its fresh-game default. The clock, pause state, and build mode also
   * reset so testing starts from a clean island.
   */
   resetGame: () => {
    useGameStore.persist.clearStorage();
    resetExplored(); // wipe the fog-of-war discovery map too
    set({
      time: START_TIME, // back to a fresh late-morning start
      timeScale: 1,
      paused: false,
      currency: 10,
      inventory: { berry: 3, shell: 0, stone: 0, wood: 0, flower: 0, fruit: 0, herb: 0, soap: 0, medkit: 0 },
      needs: { hunger: 100, energy: 100, happiness: 100, hygiene: 100 },
      sick: false,
      playerPos: { row: SPAWN_POINT.row, col: SPAWN_POINT.col + 3 },
      playerDir: 0,
      playerTool: 'hoe',
      tools: { axe: 50, hoe: 50 },
      decorations: generateInitialDecorations(),
      plantedDecorations: [],
      removedScatterCells: [],
      sleeping: false,
      stage: 'baby',
      carePoints: 0,
      upgrades: {},
      unlockedDecorations: [],
      ownedEggs: [],
      placedEggs: [],
      pets: [],
      namingPetId: null,
      selectedPetId: 'starter',
      shopOpen: false,
      holding: null,
      placement: { active: false, tool: null, eggId: null },
      quests: freshQuests(),
      questBoardOpen: false,
      farmOpen: false,
      crops: [],
      plots: [],
      seeds: {},
      unlockedCrops: [],
      weather: {
        raining: false,
        rainStartAt: 0,
        rainUntil: 0,
        nextRainAt: 0,
        rainSpans: [],
      },
      toast: null,
    });
  },
    }),
    {
    name: 'katherine-island-save', // localStorage key
    version: SAVE_VERSION,
    // The clock set()s the store every frame; write the save to disk at
    // most once per ~0.5s (flushing on pagehide) instead of ~60x/sec.
    storage: throttledStorage,
    // The island became a 200x200 procedural archipelago — every old
    // save's decorations/positions reference a vanished hand-authored
    // grid, so discard pre-v3 saves and hand everyone the fresh island.
    migrate: () => ({}),
    // Progress worth surviving a reload is persisted. Pause, build mode,
    // the held treat, the deterministic decoration SCATTER, and toasts
    // are transient and boot fresh. `time` IS persisted now: crops grow
    // on the game clock, so the clock (and its plantedAt anchors) must
    // survive reloads for growth to mean anything.
    partialize: (s) => ({
        time: s.time,
        currency: s.currency,
        inventory: s.inventory,
        tools: s.tools,
        playerPos: s.playerPos,
        playerDir: s.playerDir,
        playerTool: s.playerTool,
        needs: s.needs,
        stage: s.stage,
        carePoints: s.carePoints,
        upgrades: s.upgrades,
        unlockedDecorations: s.unlockedDecorations,
        plantedDecorations: s.plantedDecorations,
        removedScatterCells: s.removedScatterCells,
        ownedEggs: s.ownedEggs,
        placedEggs: s.placedEggs,
        pets: s.pets,
        namingPetId: s.namingPetId,
        selectedPetId: s.selectedPetId,
        quests: s.quests,
        crops: s.crops,
        plots: s.plots,
        seeds: s.seeds,
        unlockedCrops: s.unlockedCrops,
        weather: s.weather,
      }),
      // After a save loads, re-merge the regenerated scatter with the
      // player's planted props / erased cells into `decorations`, and
      // backfill a home anchor for any pet from before the territory
      // feature (their save predates `home`).
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        const planted = state.plantedDecorations ?? [];
        const removed = state.removedScatterCells ?? [];
        // Backfill new player economy / position fields for older saves
        const currency = state.currency ?? 10;
        const tools = state.tools ?? { axe: 50, hoe: 50 };
        const playerPos = state.playerPos ?? { row: SPAWN_POINT.row, col: SPAWN_POINT.col + 3 };
        const playerDir = state.playerDir ?? 0;
        const playerTool = state.playerTool ?? 'hoe';
        let backfilled = false;
        let petBackfilled = false;
        const pets = (state.pets ?? []).map((p) => {
          let next = p;
          // Backfill the hygiene need for pets from before the hygiene feature
          if (next.needs?.hygiene === undefined) {
            next = { ...next, needs: { ...(next.needs ?? {}), hygiene: 100 } };
            petBackfilled = true;
          }
          if (next.home && next.home.row !== undefined) return next;
          petBackfilled = true;
          return { ...next, home: pickPetHome(next.species) };
        });
        // Saves from before the weather feature lack the slice — backfill a
        // fresh one so growth math never reads undefined spans.
        const weather = state.weather ?? {
          raining: false,
          rainStartAt: 0,
          rainUntil: 0,
          nextRainAt: 0,
          rainSpans: [],
        };
        // Backfill the starter's hygiene need for older saves.
        const needs = state.needs ?? { hunger: 100, energy: 100, happiness: 100, hygiene: 100 };
        if (needs.hygiene === undefined) needs.hygiene = 100;
        useGameStore.setState({
          decorations: mergeDecorations(generateInitialDecorations(), planted, removed),
          weather,
          plots: state.plots ?? [],
          needs,
          sick: state.sick === undefined ? isSick(needs) : state.sick,
          // Only touch pets when a pre-territory pet actually needed a home
          // (avoids churning pet subscribers on saves that are already fine).
          ...(petBackfilled ? { pets } : {}),
          // Backfill player state for saves from before the player avatar feature
          ...(state.currency === undefined ? { currency, tools, playerPos, playerDir, playerTool } : {}),
        });
      },
    }
  )
);

/**
 * Advance matching quests by `amount`, clamped to each quest's target and
 * skipping claimed ones. Returns the SAME array reference when nothing
 * changed (so recordQuestProgress can no-op cheaply), else a new array.
 */
function advanceQuests(quests, metric, amount) {
  const index = questIndexByMetric();
  const ids = index[metric];
  if (!ids) return quests;
  let changed = false;
  const next = quests.map((q) => {
    if (!ids.includes(q.id) || q.claimed) return q;
    const def = questById(q.id);
    if (!def || q.progress >= def.target) return q;
    changed = true;
    return { ...q, progress: Math.min(def.target, q.progress + amount) };
  });
  return changed ? next : quests;
}

/** Small unique id for eggs / pets (crypto UUID when available). */
function uid() {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * The weather opts every crop-growth call needs — derived straight from the
 * persisted weather slice so growth math (rain 2x, wilt) can never drift
 * from what the sky is doing.
 */
export function weatherOpts(s) {
  return {
    dayCycleSeconds: s.dayCycleSeconds,
    rainSpans: s.weather?.rainSpans ?? [],
    rainStartAt: s.weather?.rainStartAt ?? 0,
    rainUntil: s.weather?.rainUntil ?? 0,
  };
}

/**
 * O(1) blocked-cell lookup for pathfinding. Decorations and incubating
 * eggs rarely change, so a Set is built only when their REFERENCE changes
 * (plant/erase/place/hatch) and cached — never rebuilt per A* expansion
 * on a grid with thousands of decorations.
 */
let blockedCache = { decorations: null, eggs: null, set: null };

function blockedSetFor(s) {
  const cache = blockedCache;
  if (cache.decorations === s.decorations && cache.eggs === s.placedEggs && cache.set) {
    return cache.set;
  }
  const set = new Set();
  for (const d of s.decorations) set.add(`${d.row},${d.col}`);
  for (const e of s.placedEggs) set.add(`${e.row},${e.col}`);
  set.add(`${KIOSK_TILE.row},${KIOSK_TILE.col}`);
  blockedCache = { decorations: s.decorations, eggs: s.placedEggs, set };
  return set;
}

/**
 * Pick a species home anchor that isn't already occupied by a seeded
 * decoration, an incubating egg, or the kiosk — so a hatched pet never
 * pops into existence inside a palm tree or the shop counter. Retries a
 * few times (pickPetHome is a random sample), then accepts the last pick.
 */
function pickUnblockedHome(s, species) {
  for (let attempt = 0; attempt < 10; attempt++) {
    const home = pickPetHome(species);
    const occupied =
      s.decorations.some((d) => d.row === home.row && d.col === home.col) ||
      s.placedEggs.some((e) => e.row === home.row && e.col === home.col) ||
      (home.row === KIOSK_TILE.row && home.col === KIOSK_TILE.col);
    if (!occupied) return home;
  }
  return pickPetHome(species);
}

/**
 * Can an egg be placed on this cell? Same rules as decorations plus: not
 * on another egg, and not on a tile a hatched pet currently occupies.
 * Used by the egg ghost (PlacementSystem) and by placeEgg itself.
 */
export function canPlaceEggTile(s, row, col) {
  const tile = getTile(row, col);
  if (!tile || !isWalkable(tile)) return false;
  if (row === KIOSK_TILE.row && col === KIOSK_TILE.col) return false;
  if (row === BED_SPOT.row && col === BED_SPOT.col) return false;
  if (s.creaturePos && s.creaturePos.row === row && s.creaturePos.col === col) return false;
  if (s.pets.some((p) => p.pos && p.pos.row === row && p.pos.col === col)) return false;
  if (s.decorations.some((d) => d.row === row && d.col === col)) return false;
  if (s.placedEggs.some((e) => e.row === row && e.col === col)) return false;
  if (s.crops.some((c) => c.row === row && c.col === col)) return false;
  return true;
}

/**
 * Can this cell be tilled? Same occupancy rules as planting (walkable land,
 * not kiosk/bed/spawn/pet/egg/decoration/crop/plot) — the hoe's soil check.
 */
export function canTill(s, row, col) {
  const tile = getTile(row, col);
  if (!tile || !isWalkable(tile)) return false;
  if (row === SPAWN_POINT.row && col === SPAWN_POINT.col) return false;
  if (row === KIOSK_TILE.row && col === KIOSK_TILE.col) return false;
  if (row === BED_SPOT.row && col === BED_SPOT.col) return false;
  if (s.creaturePos && s.creaturePos.row === row && s.creaturePos.col === col) return false;
  if (s.pets.some((p) => p.pos && p.pos.row === row && p.pos.col === col)) return false;
  if (s.decorations.some((d) => d.row === row && d.col === col)) return false;
  if (s.placedEggs.some((e) => e.row === row && e.col === col)) return false;
  if (s.crops.some((c) => c.row === row && c.col === col)) return false;
  if (s.plots.some((p) => p.row === row && p.col === col)) return false;
  return true;
}

/**
 * Can a crop be planted on this cell? The tile must be walkable land whose
 * terrain is in the crop's biome list AND already tilled (a plot must exist),
 * and it can't collide with the kiosk, the bed, the creature, a pet, an egg,
 * a decoration, or another crop.
 * Used by the crop ghost (PlacementSystem), plantCrop, and the store action.
 */
export function canPlantCrop(s, cropId, row, col) {
  const def = cropById(cropId);
  const tile = getTile(row, col);
  if (!def || !tile || !isWalkable(tile)) return false;
  if (!def.biomes.includes(tile.type)) return false; // biome-gated!
  if ((s.seeds[cropId] ?? 0) < 1) return false; // seed economy — nothing to plant
  if (def.exotic && !s.unlockedCrops.includes(cropId)) return false; // still locked
  if (!s.plots.some((p) => p.row === row && p.col === col)) return false; // needs tilled soil!
  if (row === KIOSK_TILE.row && col === KIOSK_TILE.col) return false;
  if (row === BED_SPOT.row && col === BED_SPOT.col) return false;
  if (s.creaturePos && s.creaturePos.row === row && s.creaturePos.col === col) return false;
  if (s.pets.some((p) => p.pos && p.pos.row === row && p.pos.col === col)) return false;
  if (s.decorations.some((d) => d.row === row && d.col === col)) return false;
  if (s.placedEggs.some((e) => e.row === row && e.col === col)) return false;
  if (s.crops.some((c) => c.row === row && c.col === col)) return false;
  return true;
}

/**
 * Evolution chain: each stage lists the next stage + care required to reach
 * it. Care comes from petting (+1) and from staying well-cared-for.
 */
export const GROWTH = {
  baby: {
    label: 'Baby',
    emoji: '🐣',
    next: { id: 'child', required: 5 },
  },
  child: {
    label: 'Child',
    emoji: '🌱',
    next: { id: 'adult', required: 15 },
  },
  adult: {
    label: 'Adult',
    emoji: '🦋',
    next: { id: 'elder', required: 40 },
  },
  elder: {
    label: 'Elder',
    emoji: '🕊️',
    next: null,
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
  hunger: 0.68,
  energy: 0.45,
  happiness: 0.33,
  hygiene: 0.26,
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

/**
 * Feeding effects per feedable resource — the crop harvests are treats:
 * berries fill hunger, jungle fruit is a heartier meal, mountain herbs are
 * an energy tonic, and flowers are pure happiness. Keys mirror the
 * resources the inventory can hold.
 */
export const FEED_BY_RESOURCE = {
  berry: { hunger: 18, happiness: 12 },
  fruit: { hunger: 26, happiness: 18 }, // hearty jungle meal
  herb: { energy: 30 }, // mountain tonic
  flower: { happiness: 30 }, // a sweet bouquet
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
