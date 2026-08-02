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
