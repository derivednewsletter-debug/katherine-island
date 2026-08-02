/**
 * Island map data — a MASSIVE procedurally generated archipelago.
 *
 * A hand-authored 14×14 grid can't be "explored for weeks", so the island
 * is now generated at 160×160 tiles (~25,600) from seeded value-noise:
 * a noisy circular falloff carves the coastline, elevation noise raises
 * hills and peaks, and a fine vegetation octave seeds dense jungle.
 * Because every random decision flows from a fixed seed, the map is
 * identical on every load — no layout flicker, and saves stay valid.
 *
 * Terrain types:
 *  - 'water':   deep ocean (dark blue)
 *  - 'shallow': shallow water near shore (light blue/cyan)
 *  - 'sand':    beach shoreline (tan)
 *  - 'grass':   lush tropical grassland (green)
 *  - 'jungle':  dense dark-green vegetation (darker, slightly raised)
 *  - 'hill':    elevated grassy terrain (lighter green, taller)
 *  - 'peak':    mountain tops (gray-green, tall — the lookouts)
 *
 * Rendering never maps 25K tiles 1:1 to React components: MapGrid renders
 * each terrain as an InstancedMesh, so the whole island is a handful of
 * draw calls. Pathfinding uses a heap-based A* so routing stays fast on
 * the big grid.
 */

export const TERRAIN_TYPES = {
  water:   { color: '#2d5ba6', height: 0.0,  label: 'Deep Water' },
  shallow: { color: '#4a90d9', height: 0.05, label: 'Shallow Water' },
  sand:    { color: '#e8d5a3', height: 0.2,  label: 'Sand' },
  grass:   { color: '#7bc67e', height: 0.5,  label: 'Grass' },
  jungle:  { color: '#2f8f4e', height: 0.55, label: 'Jungle' },
  hill:    { color: '#5da851', height: 0.85, label: 'Hill' },
  peak:    { color: '#7f9b8a', height: 1.4,  label: 'Peak' },
};

export const GRID_SIZE = 160;

/**
 * World-space size of one tile. Kept in sync so pathfinding/creature code
 * can translate between grid coordinates and world coordinates.
 */
export const TILE_SIZE = 1;

/** Deterministic PRNG (mulberry32) — every island decision flows from it. */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function smoothstep(a, b, x) {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/** Bilinear value noise with a fixed lattice of random values. */
function makeValueNoise(seed, cellSize) {
  const rng = mulberry32(seed);
  const vals = new Map();
  const valAt = (ix, iy) => {
    const k = `${ix},${iy}`;
    if (!vals.has(k)) vals.set(k, rng());
    return vals.get(k);
  };
  return (x, y) => {
    const gx = x / cellSize;
    const gy = y / cellSize;
    const x0 = Math.floor(gx);
    const y0 = Math.floor(gy);
    const fx = gx - x0;
    const fy = gy - y0;
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);
    const v00 = valAt(x0, y0);
    const v10 = valAt(x0 + 1, y0);
    const v01 = valAt(x0, y0 + 1);
    const v11 = valAt(x0 + 1, y0 + 1);
    return v00 * (1 - sx) * (1 - sy) + v10 * sx * (1 - sy) + v01 * (1 - sx) * sy + v11 * sx * sy;
  };
}

const WALKABLE = ['sand', 'grass', 'jungle', 'hill', 'peak'];
const isWalkableType = (t) => WALKABLE.includes(t);

const N = GRID_SIZE;
const half = (N - 1) / 2;
const nCoast = makeValueNoise(20260801, 24); // coastline wobble
const nElev = makeValueNoise(873011, 36); // elevation (hills / peaks)
const nVeg = makeValueNoise(44117, 13); // fine vegetation (jungle)

// ── Pass 1: land vs water from a noisy circular falloff ──
const isLand = [];
for (let r = 0; r < N; r++) {
  const row = [];
  for (let c = 0; c < N; c++) {
    const d = Math.max(Math.abs(r - half), Math.abs(c - half)) / half; // 0..1
    const jitter = nCoast(r, c) * 0.42 - 0.21; // ragged coastline
    const shape = 1 - smoothstep(0.5, 0.9, d + jitter);
    row.push(d > 0.96 ? false : shape > 0.46);
  }
  isLand.push(row);
}

// ── Pass 2: shore distances (multi-source BFS, one per side) ──
// distWater: how far a LAND cell is from water (sand = within 2).
// distLand: how far a WATER cell is from land (shallow = within 1).
const distWater = Array.from({ length: N }, () => new Array(N).fill(Infinity));
const distLand = Array.from({ length: N }, () => new Array(N).fill(Infinity));
function bfs(seedIsWater, dist) {
  const q = [];
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      if (isLand[r][c] !== seedIsWater) {
        dist[r][c] = 0;
        q.push([r, c]);
      }
    }
  }
  let head = 0;
  while (head < q.length) {
    const [r, c] = q[head++];
    const next = dist[r][c] + 1;
    for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nr = r + dr;
      const nc = c + dc;
      if (nr < 0 || nr >= N || nc < 0 || nc >= N) continue;
      if (dist[nr][nc] <= next) continue;
      dist[nr][nc] = next;
      q.push([nr, nc]);
    }
  }
}
bfs(true, distWater); // seed water, measure land -> shore distance
bfs(false, distLand); // seed land, measure water -> shore distance

// ── Pass 3: terrain by elevation / vegetation ──
const terrainGrid = [];
for (let r = 0; r < N; r++) {
  const row = [];
  for (let c = 0; c < N; c++) {
    let type;
    if (!isLand[r][c]) {
      type = distLand[r][c] <= 1 ? 'shallow' : 'water';
    } else if (distWater[r][c] <= 2) {
      type = 'sand'; // beach ring
    } else {
      const elev = nElev(r, c);
      if (elev > 0.82) type = 'peak';
      else if (elev > 0.63) type = 'hill';
      else if (nVeg(r, c) > 0.62) type = 'jungle';
      else type = 'grass';
    }
    row.push(type);
  }
  terrainGrid.push(row);
}

// ── Programmatic key positions (guaranteed valid on the generated map) ──

/** Find the roomiest grass clearing closest to the island center. */
function findSpawn() {
  let best = null;
  let bestScore = -1;
  for (let r = 4; r < N - 4; r++) {
    for (let c = 4; c < N - 4; c++) {
      const t = terrainGrid[r][c];
      if (t !== 'grass' && t !== 'jungle') continue;
      let clear = 0;
      for (let rr = r - 3; rr <= r + 3; rr++) {
        for (let cc = c - 3; cc <= c + 3; cc++) {
          if (isWalkableType(terrainGrid[rr][cc])) clear++;
        }
      }
      const distCenter = Math.abs(r - half) + Math.abs(c - half);
      const score = clear * 100 - distCenter;
      if (score > bestScore) {
        bestScore = score;
        best = { row: r, col: c };
      }
    }
  }
  return best ?? { row: Math.round(half), col: Math.round(half) };
}

/** The pet's sleeping spot: a flat grass tile near spawn with a clear 3×3. */
function findBed(spawn) {
  for (let rad = 1; rad <= 6; rad++) {
    for (let dr = -rad; dr <= rad; dr++) {
      for (let dc = -rad; dc <= rad; dc++) {
        if (Math.abs(dr) !== rad && Math.abs(dc) !== rad) continue; // ring only
        const r = spawn.row + dr;
        const c = spawn.col + dc;
        if (r < 1 || r >= N - 1 || c < 1 || c >= N - 1) continue;
        if (terrainGrid[r][c] !== 'grass') continue;
        let clear = true;
        for (let rr = r - 1; rr <= r + 1 && clear; rr++) {
          for (let cc = c - 1; cc <= c + 1; cc++) {
            if (terrainGrid[rr][cc] === 'water' || terrainGrid[rr][cc] === 'shallow') {
              clear = false;
              break;
            }
          }
        }
        if (clear) return { row: r, col: c };
      }
    }
  }
  return { row: spawn.row + 1, col: spawn.col };
}

/** The shop kiosk: the nearest roomy sand tile a short walk from spawn. */
function findKiosk(spawn) {
  let best = null;
  let bestD = Infinity;
  for (let r = 1; r < N - 1; r++) {
    for (let c = 1; c < N - 1; c++) {
      if (terrainGrid[r][c] !== 'sand') continue;
      const d = Math.abs(r - spawn.row) + Math.abs(c - spawn.col);
      if (d < 4) continue;
      let nb = 0;
      for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) {
        const nr = r + dr;
        const nc = c + dc;
        if (nr >= 0 && nr < N && nc >= 0 && nc < N && isWalkableType(terrainGrid[nr][nc])) nb++;
      }
      if (nb < 4) continue;
      if (d < bestD) {
        bestD = d;
        best = { row: r, col: c };
      }
    }
  }
  return best ?? { row: spawn.row + 2, col: spawn.col };
}

/** Where the starter pet (and the player) begin their adventure. */
export const SPAWN_POINT = findSpawn();

/** The pet's sleeping spot (grid row/col). Walkable grass near spawn; the
 *  decoration scatter keeps it clear and planting is forbidden there. */
export const BED_SPOT = findBed(SPAWN_POINT);

/** Where the 3D shop kiosk sits (grid row/col) — re-exported by shop.js. */
export const KIOSK_TILE = findKiosk(SPAWN_POINT);

/**
 * The parsed 2D array used by the game. Each cell is { type, color, height,
 * label }. terrainGrid holds the terrain NAMES ('water', 'grass', ...) so we
 * look up TERRAIN_TYPES directly — cells need the NAME as `type` for
 * resourceForTerrain/isWalkable, not a single-letter key.
 */
export const mapData = terrainGrid.map((row) =>
  row.map((type) => ({ type, ...TERRAIN_TYPES[type] }))
);

/**
 * Helper: get the terrain config for a given grid coordinate.
 */
export function getTile(row, col) {
  if (row < 0 || row >= GRID_SIZE || col < 0 || col >= GRID_SIZE) return null;
  return mapData[row][col];
}

/**
 * Helper: is a tile walkable? (sand, grass, jungle, hill, peak)
 */
export function isWalkable(tile) {
  if (!tile) return false;
  return WALKABLE.includes(tile.type);
}

/**
 * Convert grid coordinates (row, col) to the world-space position of
 * that tile's center. Mirrors the layout used by MapGrid.
 */
export function gridToWorld(row, col) {
  const offset = (GRID_SIZE - 1) / 2;
  return {
    x: (col - offset) * TILE_SIZE,
    z: (row - offset) * TILE_SIZE,
  };
}

/**
 * Convert a world-space position back to grid coordinates.
 * Uses rounding, so it works for positions near tile centers.
 */
export function worldToGrid(x, z) {
  const offset = (GRID_SIZE - 1) / 2;
  return {
    row: Math.round(z + offset),
    col: Math.round(x + offset),
  };
}
