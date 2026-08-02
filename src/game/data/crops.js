/**
 * Crop catalog — the farming layer that gives the biomes a reason to exist.
 *
 * Each crop can only be planted on its `biomes` (walkable terrain types):
 *  - Berry Bush    → grass + jungle
 *  - Flower Patch  → grass + jungle
 *  - Jungle Fruit  → jungle only (deep-forest fruit)
 *  - Mountain Herb → peak only (mountain herbs)
 *
 * Growth runs on GAME time (the shared day-night clock): each planted crop
 * stores `plantedAt` in game-seconds, and its stage is DERIVED from
 * `time - plantedAt` whenever it's read. That means pausing freezes growth,
 * the 1×/2×/4× speed controls accelerate it, and the day-night cycle is the
 * literal backdrop for "stages over the day". A full cycle is a few days of
 * game time for a slow, cozy crop; fast-forward makes it quick to test.
 *
 * Every crop yields a resource when harvested (ready stage):
 *  - Berry Bush → +2 🍓 berries (the familiar snack)
 *  - Flower Patch → +2 🌸 flowers (a happiness treat)
 *  - Jungle Fruit → +3 🍇 fruit (a hearty jungle meal)
 *  - Mountain Herb → +2 🌿 herbs (an energy tonic from the peaks)
 *  - Night Flower → +3 🌸 flowers, EXOTIC — only grows on peaks and only
 *    during NIGHT phases (see nightSecondsBetween). Unlocked at the shop's
 *    exotic section; its seeds are sold separately afterwards.
 *
 * Every crop now needs SEEDS to plant (bought at the shop — a seed pack
 * adds a few seeds to the pile; each planting consumes one).
 *
 * Growth is also WEATHER-AWARE (see rainBonus + wilt below):
 *  - While a rain shower is falling, every growth second counts DOUBLE
 *    (rainSpans + the active rainStartAt are passed in via the opts).
 *  - Jungle fruit (wiltable) droops when the island goes too long without
 *    rain: after `wiltAfter` dry game-seconds its growth starts draining
 *    at `wiltRate` per dry second, and a new shower revives it. The whole
 *    model stays DERIVED from (plantedAt, time, rain history) — zero
 *    per-crop mutation, so pause/fast-forward/reload all stay consistent.
 */

/** Growth durations (game-seconds) per stage: seed → sprout → grown → ready. */
const GROW = {
  berryBush: [20, 30, 30], // 80s ≈ a bit under half a day
  flowerPatch: [18, 28, 24], // 70s
  fruitTree: [30, 40, 45], // 115s — the slow, valuable one
  mountainHerb: [22, 32, 30], // 84s
  // Grows only at night: durations are NIGHT-seconds (see nightOnly below),
  // so in real terms a full cycle takes ~2.5 day-night rounds.
  nightFlower: [30, 45, 45], // 120 night-seconds ≈ 267 real game-seconds
};

/** Which walkable terrain types each crop may be planted on. */
const BIOMES = {
  berryBush: ['grass', 'jungle'],
  flowerPatch: ['grass', 'jungle'],
  fruitTree: ['jungle'],
  mountainHerb: ['peak'],
  nightFlower: ['peak'], // the rare late-game crop — peaks only
};

/** Harvest reward per crop (resource id → amount). */
const REWARDS = {
  berryBush: { berry: 2 },
  flowerPatch: { flower: 2 },
  fruitTree: { fruit: 3 },
  mountainHerb: { herb: 2 },
  nightFlower: { flower: 3 },
};

const LABELS = {
  berryBush: { label: 'Berry Bush', emoji: '🍓', color: '#ff5d7e', hint: 'Grass & jungle' },
  flowerPatch: { label: 'Flower Patch', emoji: '🌸', color: '#ff9eb0', hint: 'Grass & jungle' },
  fruitTree: { label: 'Jungle Fruit', emoji: '🍇', color: '#b06ad4', hint: 'Jungle only' },
  mountainHerb: { label: 'Mountain Herb', emoji: '🌿', color: '#8fd694', hint: 'Peaks only' },
  nightFlower: {
    label: 'Night Flower',
    emoji: '🌙',
    color: '#c3b3ff',
    hint: 'Peaks only · grows at night',
  },
};

export const CROPS = {
  berryBush: {
    id: 'berryBush',
    ...LABELS.berryBush,
    biomes: BIOMES.berryBush,
    durations: GROW.berryBush,
    reward: REWARDS.berryBush,
  },
  flowerPatch: {
    id: 'flowerPatch',
    ...LABELS.flowerPatch,
    biomes: BIOMES.flowerPatch,
    durations: GROW.flowerPatch,
    reward: REWARDS.flowerPatch,
  },
  fruitTree: {
    id: 'fruitTree',
    ...LABELS.fruitTree,
    biomes: BIOMES.fruitTree,
    durations: GROW.fruitTree,
    reward: REWARDS.fruitTree,
    // Jungle fruit is the wiltable crop: after ~1.5 day-cycles without rain
    // it starts drooping (growth drains at 0.15/s of dryness). A shower
    // revives it instantly.
    wiltable: true,
    wiltAfter: 270, // dry game-seconds before wilting begins
    wiltRate: 0.15, // growth-seconds lost per dry second past the grace
  },
  mountainHerb: {
    id: 'mountainHerb',
    ...LABELS.mountainHerb,
    biomes: BIOMES.mountainHerb,
    durations: GROW.mountainHerb,
    reward: REWARDS.mountainHerb,
  },
  nightFlower: {
    id: 'nightFlower',
    ...LABELS.nightFlower,
    biomes: BIOMES.nightFlower,
    durations: GROW.nightFlower,
    reward: REWARDS.nightFlower,
    nightOnly: true, // stage advances only during night phases
    exotic: true, // must be unlocked via the shop's exotic section
  },
};

export function cropById(id) {
  return CROPS[id] ?? null;
}

/**
 * One full day-night cycle in game-seconds — the SAME constant the store's
 * clock uses. The night-only growth math below (nightSecondsBetween) counts
 * night phases against this cycle, so a crop's clock can never drift from
 * the sky. gameStore re-exports this so every existing `DAY_CYCLE_SECONDS`
 * import keeps working with a single source of truth.
 */
export const DAY_CYCLE_SECONDS = 180;

/**
 * How many game-seconds in [from, to] fall inside NIGHT windows. Night runs
 * from phase 0.75 → 1.0 and 0.0 → 0.2 of each cycle (matching timeOfDay's
 * `isDay = phase >= 0.2 && phase < 0.75`), so night occupies 45% of a
 * cycle. Iterates only over the cycles the interval touches — cheap for a
 * few game-days of growth.
 */
export function nightSecondsBetween(from, to, dayCycleSeconds = DAY_CYCLE_SECONDS) {
  if (to <= from) return 0;
  const C = dayCycleSeconds;
  const NIGHT_END = 0.2; // phase where night ends (dawn)
  const NIGHT_START = 0.75; // phase where night begins (dusk)
  let total = 0;
  for (let k = Math.floor(from / C); k <= Math.floor(to / C); k++) {
    const base = k * C;
    // Window 1: [base, base + 0.2C) — the pre-dawn stretch of this cycle
    const s1 = Math.max(from, base);
    const e1 = Math.min(to, base + NIGHT_END * C);
    if (e1 > s1) total += e1 - s1;
    // Window 2: [base + 0.75C, base + C) — this cycle's evening
    const s2 = Math.max(from, base + NIGHT_START * C);
    const e2 = Math.min(to, base + C);
    if (e2 > s2) total += e2 - s2;
  }
  return total;
}

/**
 * Effective growth elapsed (weighted game-seconds) for a crop at `time`.
 *
 *   base   = normal growth (night-only crops only count night seconds)
 *   rain   = +1 bonus second for every second the crop spent in rain
 *            (a shower doubles growth while it lasts). Night-only crops
 *            only gain from rain that falls during night phases.
 *   wilt   = jungle fruit that's been dry too long loses growth
 *
 * opts: { dayCycleSeconds, rainSpans, rainStartAt, rainUntil }
 *  - rainSpans: closed showers [{ start, end }] in game-seconds
 *  - rainStartAt/rainUntil: the ACTIVE shower (start now, end in future)
 *  - dayCycleSeconds: defaults to the shared 180s cycle
 */
/** The most recent moment this crop was watered: when it was planted, when
 *  the last closed shower ended, or the active shower's end (rainUntil — in
 *  the future while raining, so drought is 0 mid-shower). Shared by the
 *  growth math and the wilt HUD badge so they can never disagree. */
function lastWateredAt(crop, opts = {}) {
  let lastWatered = crop.plantedAt;
  for (const sp of opts.rainSpans ?? []) if (sp.end > lastWatered) lastWatered = sp.end;
  if ((opts.rainUntil ?? 0) > lastWatered) lastWatered = opts.rainUntil;
  return lastWatered;
}

function growthElapsed(crop, def, time, opts = {}) {
  const C = opts.dayCycleSeconds ?? DAY_CYCLE_SECONDS;
  const base = def.nightOnly
    ? nightSecondsBetween(crop.plantedAt, time, C)
    : Math.max(0, time - crop.plantedAt);

  // Rain bonus — every rain second counts double
  let rain = 0;
  const addRain = (s, e) => {
    const ss = Math.max(crop.plantedAt, s);
    const ee = Math.min(time, e);
    if (ee <= ss) return;
    rain += def.nightOnly ? nightSecondsBetween(ss, ee, C) : ee - ss;
  };
  for (const sp of opts.rainSpans ?? []) addRain(sp.start, sp.end);
  if (opts.rainStartAt && opts.rainStartAt < time) {
    addRain(opts.rainStartAt, opts.rainUntil || time);
  }

  // Wilt — jungle fruit drains during long dry spells. During rain the
  // "dry since" clock is in the future → dry = 0.
  let wilt = 0;
  if (def.wiltable) {
    const dry = Math.max(0, time - lastWateredAt(crop, opts));
    if (dry > def.wiltAfter) wilt = (dry - def.wiltAfter) * def.wiltRate;
  }

  return Math.max(0, base + rain - wilt);
}

/** Wilt loss in weighted seconds (0 for non-wiltable crops) — the Farm HUD
 *  uses this to badge crops that are drooping. */
export function cropWilt(crop, time, opts = {}) {
  const def = CROPS[crop.cropId];
  if (!def) return 0;
  if (!def.wiltable) return 0;
  const dry = Math.max(0, time - lastWateredAt(crop, opts));
  if (dry <= def.wiltAfter) return 0;
  return (dry - def.wiltAfter) * def.wiltRate;
}

/**
 * Stage index: 0 seed, 1 sprout, 2 grown, 3 ready (harvestable). Weather
 * aware: rain doubles growth while falling, and wiltable crops regress
 * during long dry spells. See growthElapsed for the opts shape.
 */
export function cropStageIndex(crop, time, opts = {}) {
  const def = CROPS[crop.cropId];
  if (!def) return 0;
  const elapsed = growthElapsed(crop, def, time, opts);
  let acc = 0;
  for (let i = 0; i < def.durations.length; i++) {
    acc += def.durations[i];
    if (elapsed < acc) return i;
  }
  return def.durations.length; // 3 = ready
}

/** 0..1 growth progress (for the ghost / Farm HUD). Weather aware — rain
 *  accelerates, long dry spells drain wiltable crops. */
export function cropProgress(crop, time, opts = {}) {
  const def = CROPS[crop.cropId];
  if (!def) return 0;
  const elapsed = growthElapsed(crop, def, time, opts);
  const total = def.durations.reduce((a, b) => a + b, 0);
  return Math.min(1, Math.max(0, elapsed) / total);
}

/**
 * Per-stage instanced parts for the crop visuals (rendered by Crops.jsx via
 * InstancedField). Stage 3 ("ready") adds the glowing fruit/flowers.
 * Each part: { geom, args, pos, rot, color, pscale? }.
 */
const green = (i) => (i % 2 === 0 ? '#3f9e4d' : '#57b95f');

export const CROP_PARTS = {
  berryBush: [
    // 0 seed — a little dirt mound with the seed poking out
    [
      { geom: 'sphere', args: [0.07, 8, 6], pos: [0, 0.03, 0], rot: [0, 0, 0], pscale: [1, 0.5, 1], color: '#8a6a4a' },
      { geom: 'sphere', args: [0.025, 6, 5], pos: [0, 0.05, 0], rot: [0, 0, 0], color: '#5caf5c' },
    ],
    // 1 sprout — a stem + two little leaves
    [
      { geom: 'cylinder', args: [0.012, 0.016, 0.18, 5], pos: [0, 0.1, 0], rot: [0, 0, 0], color: '#4c9e4f' },
      { geom: 'cone', args: [0.035, 0.1, 4], pos: [-0.03, 0.16, 0], rot: [0.3, 0, 0.5], color: green(0) },
      { geom: 'cone', args: [0.035, 0.1, 4], pos: [0.03, 0.16, 0], rot: [0.3, 0, -0.5], color: green(1) },
    ],
    // 2 grown — a small round bush
    [
      { geom: 'icosa', args: [0.085, 0], pos: [0, 0.1, 0], rot: [0, 0, 0], color: '#57b95f' },
      { geom: 'icosa', args: [0.07, 0], pos: [0.06, 0.09, 0.02], rot: [0, 0, 0], color: '#5caf5c' },
      { geom: 'icosa', args: [0.065, 0], pos: [-0.05, 0.09, -0.02], rot: [0, 0, 0], color: '#4d9a4d' },
    ],
    // 3 ready — the bush plus ripe red berries
    [
      { geom: 'icosa', args: [0.085, 0], pos: [0, 0.1, 0], rot: [0, 0, 0], color: '#57b95f' },
      { geom: 'icosa', args: [0.07, 0], pos: [0.06, 0.09, 0.02], rot: [0, 0, 0], color: '#5caf5c' },
      { geom: 'sphere', args: [0.02, 6, 5], pos: [-0.04, 0.09, 0.05], rot: [0, 0, 0], color: '#ff5d7e' },
      { geom: 'sphere', args: [0.018, 6, 5], pos: [0.05, 0.12, 0.03], rot: [0, 0, 0], color: '#ff7d9a' },
      { geom: 'sphere', args: [0.016, 6, 5], pos: [0.02, 0.08, -0.06], rot: [0, 0, 0], color: '#ff5d7e' },
    ],
  ],
  flowerPatch: [
    // 0 seed
    [
      { geom: 'sphere', args: [0.07, 8, 6], pos: [0, 0.03, 0], rot: [0, 0, 0], pscale: [1, 0.5, 1], color: '#8a6a4a' },
      { geom: 'sphere', args: [0.024, 6, 5], pos: [0, 0.05, 0], rot: [0, 0, 0], color: '#ff9eb0' },
    ],
    // 1 sprout — two stems with buds
    [
      { geom: 'cylinder', args: [0.012, 0.016, 0.18, 5], pos: [-0.02, 0.1, 0], rot: [0.2, 0, 0.2], color: '#4c9e4f' },
      { geom: 'cylinder', args: [0.012, 0.016, 0.18, 5], pos: [0.03, 0.1, 0.01], rot: [-0.2, 0, -0.2], color: '#5caf5c' },
      { geom: 'sphere', args: [0.022, 6, 5], pos: [-0.02, 0.2, 0], rot: [0, 0, 0], color: '#ff9eb0' },
      { geom: 'sphere', args: [0.02, 6, 5], pos: [0.03, 0.2, 0.01], rot: [0, 0, 0], color: '#ffd166' },
    ],
    // 2 grown — a few stems with petals
    [
      { geom: 'cylinder', args: [0.014, 0.018, 0.22, 5], pos: [-0.03, 0.11, 0], rot: [0.15, 0, 0.15], color: '#4c9e4f' },
      { geom: 'cylinder', args: [0.014, 0.018, 0.22, 5], pos: [0.03, 0.11, 0.02], rot: [-0.15, 0, -0.15], color: '#5caf5c' },
      { geom: 'sphere', args: [0.045, 8, 6], pos: [-0.03, 0.23, 0], rot: [0, 0, 0], pscale: [1, 0.45, 1], color: '#ff9eb0' },
      { geom: 'sphere', args: [0.04, 8, 6], pos: [0.03, 0.23, 0.02], rot: [0, 0, 0], pscale: [1, 0.45, 1], color: '#ffd166' },
    ],
    // 3 ready — petals + sunny centers
    [
      { geom: 'cylinder', args: [0.014, 0.018, 0.22, 5], pos: [-0.03, 0.11, 0], rot: [0.15, 0, 0.15], color: '#4c9e4f' },
      { geom: 'cylinder', args: [0.014, 0.018, 0.22, 5], pos: [0.03, 0.11, 0.02], rot: [-0.15, 0, -0.15], color: '#5caf5c' },
      { geom: 'sphere', args: [0.055, 8, 6], pos: [-0.03, 0.24, 0], rot: [0, 0, 0], pscale: [1, 0.4, 1], color: '#ff9eb0' },
      { geom: 'sphere', args: [0.03, 6, 5], pos: [-0.03, 0.25, 0.01], rot: [0, 0, 0], color: '#ffd166' },
      { geom: 'sphere', args: [0.05, 8, 6], pos: [0.03, 0.24, 0.02], rot: [0, 0, 0], pscale: [1, 0.4, 1], color: '#ffc2d4' },
      { geom: 'sphere', args: [0.028, 6, 5], pos: [0.03, 0.25, 0.03], rot: [0, 0, 0], color: '#ffd166' },
    ],
  ],
  fruitTree: [
    // 0 seed
    [
      { geom: 'sphere', args: [0.08, 8, 6], pos: [0, 0.04, 0], rot: [0, 0, 0], pscale: [1, 0.5, 1], color: '#8a6a4a' },
      { geom: 'sphere', args: [0.03, 6, 5], pos: [0, 0.06, 0], rot: [0, 0, 0], color: '#5caf5c' },
    ],
    // 1 sprout — a taller trunk + first canopy blob
    [
      { geom: 'cylinder', args: [0.02, 0.03, 0.28, 6], pos: [0, 0.15, 0], rot: [0, 0, -0.08], color: '#8a6a4a' },
      { geom: 'icosa', args: [0.07, 0], pos: [0, 0.32, 0], rot: [0, 0, 0], color: green(0) },
    ],
    // 2 grown — trunk + leafy canopy
    [
      { geom: 'cylinder', args: [0.03, 0.05, 0.42, 6], pos: [0, 0.22, 0], rot: [0, 0, -0.06], color: '#8a6a4a' },
      { geom: 'icosa', args: [0.16, 0], pos: [0, 0.46, 0], rot: [0, 0, 0], color: '#2f8f4e' },
      { geom: 'icosa', args: [0.1, 0], pos: [0.07, 0.4, 0.05], rot: [0, 0, 0], color: '#3f9e4d' },
    ],
    // 3 ready — canopy heavy with grape clusters
    [
      { geom: 'cylinder', args: [0.03, 0.05, 0.42, 6], pos: [0, 0.22, 0], rot: [0, 0, -0.06], color: '#8a6a4a' },
      { geom: 'icosa', args: [0.16, 0], pos: [0, 0.46, 0], rot: [0, 0, 0], color: '#2f8f4e' },
      { geom: 'sphere', args: [0.035, 6, 5], pos: [-0.06, 0.4, 0.06], rot: [0, 0, 0], color: '#b06ad4' },
      { geom: 'sphere', args: [0.03, 6, 5], pos: [0.08, 0.46, -0.04], rot: [0, 0, 0], color: '#c58ae0' },
      { geom: 'sphere', args: [0.028, 6, 5], pos: [-0.01, 0.52, 0.09], rot: [0, 0, 0], color: '#b06ad4' },
      { geom: 'sphere', args: [0.026, 6, 5], pos: [0.05, 0.38, -0.1], rot: [0, 0, 0], color: '#c58ae0' },
    ],
  ],
  mountainHerb: [
    // 0 seed
    [
      { geom: 'sphere', args: [0.07, 8, 6], pos: [0, 0.03, 0], rot: [0, 0, 0], pscale: [1, 0.5, 1], color: '#8a6a4a' },
      { geom: 'sphere', args: [0.024, 6, 5], pos: [0, 0.05, 0], rot: [0, 0, 0], color: '#7fb069' },
    ],
    // 1 sprout — a thin herb stem
    [
      { geom: 'cylinder', args: [0.01, 0.014, 0.22, 5], pos: [0, 0.12, 0], rot: [0.1, 0, 0.1], color: '#5caf5c' },
      { geom: 'cone', args: [0.05, 0.12, 4], pos: [0.02, 0.24, 0], rot: [0.4, 0, -0.4], color: '#7fb069' },
    ],
    // 2 grown — a cluster of herb fronds
    [
      { geom: 'cylinder', args: [0.012, 0.016, 0.28, 5], pos: [-0.02, 0.15, 0], rot: [0.12, 0, 0.12], color: '#5caf5c' },
      { geom: 'cylinder', args: [0.012, 0.016, 0.28, 5], pos: [0.03, 0.15, 0.01], rot: [-0.12, 0, -0.12], color: '#4d9a4d' },
      { geom: 'cone', args: [0.06, 0.16, 4], pos: [0, 0.3, 0], rot: [0.35, 0, 0], color: '#7fb069' },
    ],
    // 3 ready — fronds with pale glowing blooms
    [
      { geom: 'cylinder', args: [0.012, 0.016, 0.28, 5], pos: [-0.02, 0.15, 0], rot: [0.12, 0, 0.12], color: '#5caf5c' },
      { geom: 'cylinder', args: [0.012, 0.016, 0.28, 5], pos: [0.03, 0.15, 0.01], rot: [-0.12, 0, -0.12], color: '#4d9a4d' },
      { geom: 'cone', args: [0.06, 0.16, 4], pos: [0, 0.3, 0], rot: [0.35, 0, 0], color: '#7fb069' },
      { geom: 'sphere', args: [0.026, 6, 5], pos: [-0.05, 0.36, 0.03], rot: [0, 0, 0], color: '#e0e8ff' },
      { geom: 'sphere', args: [0.024, 6, 5], pos: [0.06, 0.34, -0.03], rot: [0, 0, 0], color: '#f2f6ff' },
    ],
  ],
  nightFlower: [
    // 0 seed — a dirt mound with a faintly glowing seed
    [
      { geom: 'sphere', args: [0.07, 8, 6], pos: [0, 0.03, 0], rot: [0, 0, 0], pscale: [1, 0.5, 1], color: '#8a6a4a' },
      { geom: 'sphere', args: [0.024, 6, 5], pos: [0, 0.05, 0], rot: [0, 0, 0], color: '#c3b3ff' },
    ],
    // 1 sprout — a pale stem with a bud
    [
      { geom: 'cylinder', args: [0.012, 0.016, 0.2, 5], pos: [0, 0.11, 0], rot: [0.1, 0, 0.1], color: '#4c9e4f' },
      { geom: 'sphere', args: [0.03, 8, 6], pos: [0, 0.22, 0], rot: [0, 0, 0], pscale: [1, 0.7, 1], color: '#b9a8ff' },
    ],
    // 2 grown — a taller stem with a half-open pale bloom
    [
      { geom: 'cylinder', args: [0.014, 0.018, 0.26, 5], pos: [0, 0.14, 0], rot: [0, 0, 0], color: '#4c9e4f' },
      { geom: 'sphere', args: [0.045, 8, 6], pos: [0, 0.27, 0], rot: [0, 0, 0], pscale: [1, 0.65, 1], color: '#c3b3ff' },
      { geom: 'sphere', args: [0.02, 6, 5], pos: [0.02, 0.29, 0.02], rot: [0, 0, 0], color: '#e0e8ff' },
    ],
    // 3 ready — the full glowing night bloom
    [
      { geom: 'cylinder', args: [0.014, 0.018, 0.28, 5], pos: [0, 0.15, 0], rot: [0, 0, 0], color: '#4c9e4f' },
      { geom: 'sphere', args: [0.06, 8, 6], pos: [-0.04, 0.29, 0], rot: [0, 0, 0], pscale: [1, 0.5, 1], color: '#c3b3ff' },
      { geom: 'sphere', args: [0.06, 8, 6], pos: [0.04, 0.29, 0], rot: [0, 0, 0], pscale: [1, 0.5, 1], color: '#b9a8ff' },
      { geom: 'sphere', args: [0.055, 8, 6], pos: [0, 0.32, 0.03], rot: [0, 0, 0], pscale: [1, 0.5, 1], color: '#d8ccff' },
      { geom: 'sphere', args: [0.028, 8, 6], pos: [0, 0.32, 0], rot: [0, 0, 0], color: '#fff6d6' }, // glowing heart
      { geom: 'sphere', args: [0.018, 6, 5], pos: [0.03, 0.3, 0.05], rot: [0, 0, 0], color: '#ffe9a8' },
    ],
  ],
};
