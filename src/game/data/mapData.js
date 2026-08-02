/**
 * Island map data: 14x14 grid with terrain types.
 *
 * Terrain types:
 *  - 'water': deep ocean (dark blue)
 *  - 'shallow': shallow water near shore (light blue/cyan)
 *  - 'sand': beach shoreline (tan)
 *  - 'grass': lush tropical grassland (green)
 *  - 'hill': elevated grassy terrain (lighter green, taller)
 */

export const TERRAIN_TYPES = {
  water:   { color: '#2d5ba6', height: 0.0, label: 'Deep Water' },
  shallow: { color: '#4a90d9', height: 0.05, label: 'Shallow Water' },
  sand:    { color: '#e8d5a3', height: 0.2, label: 'Sand' },
  grass:   { color: '#7bc67e', height: 0.5, label: 'Grass' },
  hill:    { color: '#5da851', height: 0.85, label: 'Hill' },
};

export const GRID_SIZE = 14;

/**
 * World-space size of one tile (mirrors TILE_SIZE in Tile.jsx).
 * Kept in sync here so pathfinding/creature code can translate
 * between grid coordinates and world coordinates.
 */
export const TILE_SIZE = 1;

/**
 * The pet's sleeping spot (grid row/col). Must stay a walkable grass
 * tile; the decoration scatter keeps it clear and planting is forbidden
 * there so the pet can always reach its mat when night falls.
 */
export const BED_SPOT = { row: 7, col: 6 };

/**
 * 14x14 island map.
 * Row-major: mapData[row][col], where row 0 = top, row 13 = bottom.
 *
 * Shape: a natural island with an irregular coastline in the center,
 * surrounded by water. Sand forms a beach ring, grass fills the interior
 * with a raised hill cluster near the middle — more land to roam than
 * the old 12x12.
 */
const W = 'water';
const L = 'shallow';
const S = 'sand';
const G = 'grass';
const H = 'hill';

// prettier-ignore
const rawMap = [
  [W, W, W, W, W, W, W, W, W, W, W, W, W, W],
  [W, W, W, W, L, L, L, L, L, L, W, W, W, W],
  [W, W, W, L, S, S, S, S, S, S, L, W, W, W],
  [W, W, L, S, G, G, G, G, G, S, S, L, W, W],
  [W, W, L, S, G, H, H, G, G, S, S, L, W, W],
  [W, L, S, G, H, H, H, G, G, S, S, L, W, W],
  [W, L, S, G, G, G, G, G, G, S, S, L, W, W],
  [W, L, S, G, G, G, G, G, S, S, S, L, W, W],
  [W, W, L, S, S, G, G, S, S, S, L, W, W, W],
  [W, W, L, L, S, S, S, S, S, L, L, W, W, W],
  [W, W, W, L, L, L, L, L, L, L, W, W, W, W],
  [W, W, W, W, W, W, W, W, W, W, W, W, W, W],
  [W, W, W, W, W, W, W, W, W, W, W, W, W, W],
  [W, W, W, W, W, W, W, W, W, W, W, W, W, W],
];

/**
 * The parsed 2D array used by the game. Each cell is { type, color, height, label }.
 * rawMap cells already hold the full terrain names ('water', 'grass', ...),
 * so we look up TERRAIN_TYPES directly — the cells need the NAME as `type`
 * for resourceForTerrain/isWalkable, not a single-letter key.
 */
export const mapData = rawMap.map((row) =>
  row.map((code) => {
    const terrain = TERRAIN_TYPES[code];
    return { type: code, ...terrain };
  })
);

/**
 * Helper: get the terrain config for a given grid coordinate.
 */
export function getTile(row, col) {
  if (row < 0 || row >= GRID_SIZE || col < 0 || col >= GRID_SIZE) return null;
  return mapData[row][col];
}

/**
 * Helper: is a tile walkable? (sand, grass, hill)
 */
export function isWalkable(tile) {
  if (!tile) return false;
  return ['sand', 'grass', 'hill'].includes(tile.type);
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
