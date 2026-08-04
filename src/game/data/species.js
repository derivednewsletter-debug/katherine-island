/**
 * Pet species catalog — the "other animals" the player can hatch from eggs
 * bought at the shop. Each species defines its shop price, its egg look,
 * its palette for the hatched critter, and — new — its territory: every
 * pet gets a HOME anchor somewhere in its `habitat` biome, so the herd
 * spreads across the island instead of clustering at spawn. `dot` is the
 * minimap herd-marker color for the species.
 */
import { mapData, GRID_SIZE, SPAWN_POINT, isWalkable } from './mapData';

/** How far (Manhattan tiles) a hatched pet roams around its home anchor. */
export const PET_HOME_ROAM_RADIUS = 34;

/** Min distance (Manhattan tiles) from spawn a home anchor must be, so
 *  different critters are found in far-flung corners, not the clearing. */
const MIN_HOME_DIST_FROM_SPAWN = 24;

export const PET_SPECIES = {
  bunny: {
    label: 'Bunny',
    emoji: '🐰',
    habitat: 'grass', // meadows
    dot: '#f6a5c0', // minimap herd marker
    price: { berry: 12 },
    eggColor: '#f6e3f5',
    eggSpot: '#d9a8d9',
    // Long floppy ears
    ear: 'long',
    growth: {
      baby: { label: 'Bunny Kit', emoji: '🐇', next: { id: 'child', required: 5 }, visual: { scale: 0.9, colors: { body: '#fff7fa', ears: '#f9d8e3' } } },
      child: { label: 'Young Bunny', emoji: '🐰', next: { id: 'adult', required: 15 }, visual: { scale: 0.96, colors: { body: '#fff1f4' } } },
      adult: { label: 'Bunny', emoji: '🐰', next: { id: 'elder', required: 40 }, visual: { scale: 1.04, colors: { body: '#ffe8ef', ears: '#efafc3' } } },
      elder: { label: 'Elder Bunny', emoji: '🕊️', next: null },
    },
    colors: {
      body: '#fff1f4',
      belly: '#ffffff',
      ears: '#f6c3d2',
      eyes: '#4a4a55',
      cheeks: '#ffc2d4',
      leaf: '#a8d69a',
      accent: '#f2d0e2',
    },
  },
  kitty: {
    label: 'Kitty',
    emoji: '🐱',
    habitat: 'jungle', // jungle cats
    dot: '#ff9d5c',
    price: { shell: 10 },
    eggColor: '#ffe8cc',
    eggSpot: '#e0a56a',
    // Pointy triangle ears
    ear: 'point',
    growth: {
      baby: { label: 'Kitten', emoji: '🐾', next: { id: 'child', required: 7 }, visual: { scale: 0.86, colors: { body: '#ffe8c7', ears: '#f5a96f' } } },
      child: { label: 'Young Kitty', emoji: '🐱', next: { id: 'adult', required: 18 }, visual: { scale: 0.98, colors: { body: '#ffd9a8' } } },
      adult: { label: 'Kitty', emoji: '🐱', next: { id: 'elder', required: 45 }, visual: { scale: 1.08, colors: { body: '#ffc27f', ears: '#f28e4b' } } },
      elder: { label: 'Elder Kitty', emoji: '🕊️', next: null },
    },
    colors: {
      body: '#ffd9a8',
      belly: '#fff3e0',
      ears: '#ffb27a',
      eyes: '#4a4a55',
      cheeks: '#ffb3c6',
      leaf: '#a8d69a',
      accent: '#ffc98f',
    },
  },
  duckling: {
    label: 'Duckling',
    emoji: '🦆',
    habitat: 'sand', // beach bums
    dot: '#ffd93d',
    price: { berry: 8, shell: 6 },
    eggColor: '#eaf6e0',
    eggSpot: '#bfe0a8',
    // No ears — instead a tiny orange beak
    ear: 'none',
    beak: true,
    growth: {
      baby: { label: 'Duckling', emoji: '🐥', next: { id: 'child', required: 4 }, visual: { scale: 0.82, colors: { body: '#fff0a0', belly: '#fffde0' } } },
      child: { label: 'Fledgling', emoji: '🪶', next: { id: 'adult', required: 12 }, visual: { scale: 0.94, colors: { body: '#ffe066' } } },
      adult: { label: 'Duck', emoji: '🦆', next: { id: 'elder', required: 30 }, visual: { scale: 1.02, colors: { body: '#f8cf3d', accent: '#f08b2c' } } },
      elder: { label: 'Elder Duck', emoji: '🕊️', next: null },
    },
    colors: {
      body: '#ffe066',
      belly: '#fff9c9',
      ears: '#ffcf4d',
      eyes: '#4a4a55',
      cheeks: '#ffb3c6',
      leaf: '#7fb069',
      accent: '#ff9f43',
    },
  },
  fox: {
    label: 'Fox',
    emoji: '🦊',
    habitat: 'hill', // clever foxes of the uplands
    dot: '#ff8c5c',
    price: { berry: 10, shell: 8 },
    eggColor: '#ffe3d6',
    eggSpot: '#e8a58c',
    // Pointy ears + a bushy tail marker
    ear: 'point',
    tail: 'bushy',
    growth: {
      baby: { label: 'Fox Kit', emoji: '🦊', next: { id: 'child', required: 8 }, visual: { scale: 0.84, colors: { body: '#ffad6d', belly: '#fff7ea' } } },
      child: { label: 'Young Fox', emoji: '🦊', next: { id: 'adult', required: 20 }, visual: { scale: 0.97, colors: { body: '#ff9c50' } } },
      adult: { label: 'Fox', emoji: '🦊', next: { id: 'elder', required: 50 }, visual: { scale: 1.1, colors: { body: '#e96e2f', ears: '#b8472f' } } },
      elder: { label: 'Elder Fox', emoji: '🕊️', next: null },
    },
    colors: {
      body: '#ff8c42',
      belly: '#fff3e0',
      ears: '#d95d39',
      eyes: '#3a3a46',
      cheeks: '#ffc2b0',
      leaf: '#a8d69a',
      accent: '#ffd9a8',
    },
  },
  penguin: {
    label: 'Penguin',
    emoji: '🐧',
    habitat: 'sand', // rocky shore dwellers
    dot: '#7fd4ff',
    price: { shell: 8, stone: 4 },
    eggColor: '#e0f0ff',
    eggSpot: '#8fb8d9',
    // No ears — a beak and flippers instead
    ear: 'none',
    beak: true,
    flippers: true,
    growth: {
      baby: { label: 'Penguin Chick', emoji: '🐧', next: { id: 'child', required: 6 }, visual: { scale: 0.84, colors: { body: '#8ca8bf', belly: '#f5fbff' } } },
      child: { label: 'Juvenile Penguin', emoji: '🐧', next: { id: 'adult', required: 16 }, visual: { scale: 0.97, colors: { body: '#60788d' } } },
      adult: { label: 'Penguin', emoji: '🐧', next: { id: 'elder', required: 42 }, visual: { scale: 1.08, colors: { body: '#263b4e', ears: '#203241' } } },
      elder: { label: 'Elder Penguin', emoji: '🕊️', next: null },
    },
    colors: {
      body: '#4a5a6a',
      belly: '#ffffff',
      ears: '#3a4a5a',
      eyes: '#2a2a35',
      cheeks: '#ffb3c6',
      leaf: '#7fb069',
      accent: '#ff9f43',
    },
  },
  turtle: {
    label: 'Turtle',
    emoji: '🐢',
    habitat: 'sand', // slow & steady beach pals
    dot: '#9fd97a',
    price: { shell: 10, berry: 6 },
    eggColor: '#eef5e0',
    eggSpot: '#b8d98a',
    // No ears — a shell on its back
    ear: 'none',
    shell: true,
    growth: {
      baby: { label: 'Hatchling', emoji: '🐢', next: { id: 'child', required: 3 }, visual: { scale: 0.78, colors: { body: '#b6d98e', accent: '#cce5a1' } } },
      child: { label: 'Young Turtle', emoji: '🐢', next: { id: 'adult', required: 10 }, visual: { scale: 0.94, colors: { body: '#9fc779' } } },
      adult: { label: 'Turtle', emoji: '🐢', next: { id: 'elder', required: 36 }, visual: { scale: 1.12, colors: { body: '#719e52', accent: '#8cab5d' } } },
      elder: { label: 'Elder Turtle', emoji: '🕊️', next: null },
    },
    colors: {
      body: '#8fb96a',
      belly: '#f5f0c9',
      ears: '#6b9a4f',
      eyes: '#2a2a35',
      cheeks: '#c9e8a8',
      leaf: '#7fb069',
      accent: '#a8c97a',
    },
  },
};

/**
 * How long a placed egg takes to hatch — REAL time (wall clock), not game
 * time, so the wait is "ten real life minutes" no matter the time-scale.
 */
export const EGG_HATCH_MS = 10 * 60 * 1000;

/** Format a millisecond duration as m:ss for the egg's floating timer. */
export function formatCountdown(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * Pick a HOME anchor for a newly hatched pet: a random walkable tile of
 * the species' habitat biome, reasonably far from spawn, with enough
 * walkable neighbors that the pet can actually roam its territory.
 *
 * Sampling is done from a PRECOMPUTED per-biome candidate list rather than
 * uniform random points: thin biomes like the sand beach ring occupy a
 * tiny fraction of the 160×160 grid, and uniform sampling would almost
 * always miss them (forcing the fallback and clustering ducklings at
 * spawn). Sampling uniformly from all tiles of the right biome fixes that
 * for every biome, thick or thin.
 */

/** Every tile per biome — built once at module load from the generated map. */
const BIOME_TILES = new Map();
for (let row = 0; row < GRID_SIZE; row++) {
  for (let col = 0; col < GRID_SIZE; col++) {
    const type = mapData[row][col].type;
    if (!BIOME_TILES.has(type)) BIOME_TILES.set(type, []);
    BIOME_TILES.get(type).push({ row, col });
  }
}

/** True when the tile has at least `min` walkable neighbors (8-neighborhood). */
function hasRoom(row, col, min) {
  let neighbors = 0;
  for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) {
    const nr = row + dr;
    const nc = col + dc;
    if (nr >= 0 && nr < GRID_SIZE && nc >= 0 && nc < GRID_SIZE && isWalkable(mapData[nr][nc])) {
      if (++neighbors >= min) return true;
    }
  }
  return false;
}

export function pickPetHome(species) {
  const def = PET_SPECIES[species];
  const biome = def?.habitat ?? 'grass';
  const tiles = BIOME_TILES.get(biome);
  if (!tiles || tiles.length === 0) {
    return { row: SPAWN_POINT.row + 2, col: SPAWN_POINT.col + 2 };
  }

  // Rejection-sample: pull random biome tiles until one is far enough from
  // spawn AND has a roomy neighborhood. Rarely needs more than a few draws.
  const farTiles = tiles.filter(
    (t) => Math.abs(t.row - SPAWN_POINT.row) + Math.abs(t.col - SPAWN_POINT.col) >= MIN_HOME_DIST_FROM_SPAWN
  );
  const pool = farTiles.length > 0 ? farTiles : tiles;
  for (let pass = 0; pass < 40; pass++) {
    const t = pool[Math.floor(Math.random() * pool.length)];
    if (hasRoom(t.row, t.col, 3)) return { row: t.row, col: t.col };
  }
  // All candidates are cramped (tiny biome islets) — accept any far tile.
  if (pool.length > 0) {
    const t = pool[Math.floor(Math.random() * pool.length)];
    return { row: t.row, col: t.col };
  }
  // Very defensive fallback: a couple of tiles from spawn.
  return { row: SPAWN_POINT.row + 2, col: SPAWN_POINT.col + 2 };
}
