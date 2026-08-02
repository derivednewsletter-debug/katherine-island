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
 */

/** Growth durations (game-seconds) per stage: seed → sprout → grown → ready. */
const GROW = {
  berryBush: [20, 30, 30], // 80s ≈ a bit under half a day
  flowerPatch: [18, 28, 24], // 70s
  fruitTree: [30, 40, 45], // 115s — the slow, valuable one
  mountainHerb: [22, 32, 30], // 84s
};

/** Which walkable terrain types each crop may be planted on. */
const BIOMES = {
  berryBush: ['grass', 'jungle'],
  flowerPatch: ['grass', 'jungle'],
  fruitTree: ['jungle'],
  mountainHerb: ['peak'],
};

/** Harvest reward per crop (resource id → amount). */
const REWARDS = {
  berryBush: { berry: 2 },
  flowerPatch: { flower: 2 },
  fruitTree: { fruit: 3 },
  mountainHerb: { herb: 2 },
};

const LABELS = {
  berryBush: { label: 'Berry Bush', emoji: '🍓', color: '#ff5d7e', hint: 'Grass & jungle' },
  flowerPatch: { label: 'Flower Patch', emoji: '🌸', color: '#ff9eb0', hint: 'Grass & jungle' },
  fruitTree: { label: 'Jungle Fruit', emoji: '🍇', color: '#b06ad4', hint: 'Jungle only' },
  mountainHerb: { label: 'Mountain Herb', emoji: '🌿', color: '#8fd694', hint: 'Peaks only' },
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
  },
  mountainHerb: {
    id: 'mountainHerb',
    ...LABELS.mountainHerb,
    biomes: BIOMES.mountainHerb,
    durations: GROW.mountainHerb,
    reward: REWARDS.mountainHerb,
  },
};

export function cropById(id) {
  return CROPS[id] ?? null;
}

/** Stage index: 0 seed, 1 sprout, 2 grown, 3 ready (harvestable). */
export function cropStageIndex(crop, time) {
  const def = CROPS[crop.cropId];
  if (!def) return 0;
  const elapsed = Math.max(0, time - crop.plantedAt);
  let acc = 0;
  for (let i = 0; i < def.durations.length; i++) {
    acc += def.durations[i];
    if (elapsed < acc) return i;
  }
  return def.durations.length; // 3 = ready
}

/** 0..1 growth progress (for the ghost / future HUD). */
export function cropProgress(crop, time) {
  const def = CROPS[crop.cropId];
  if (!def) return 0;
  const total = def.durations.reduce((a, b) => a + b, 0);
  return Math.min(1, Math.max(0, time - crop.plantedAt) / total);
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
};
