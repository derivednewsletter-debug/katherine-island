/**
 * Pathfinding utilities for creature movement.
 *
 * The island is a small 12x12 grid, so a straightforward A* with a
 * Manhattan heuristic is more than fast enough and keeps the code readable.
 */
import { GRID_SIZE, getTile, isWalkable } from '../data/mapData';

const DIRS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

const key = (row, col) => `${row},${col}`;

/**
 * A* search for a path between two grid cells.
 * Returns an array of { row, col } waypoints (NOT including the start cell),
 * or an empty array if no path exists.
 */
export function findPath(startRow, startCol, endRow, endCol) {
  // Same cell or unreachable target -> no path needed
  if (startRow === endRow && startCol === endCol) return [];
  const targetTile = getTile(endRow, endCol);
  if (!isWalkable(targetTile)) return [];

  const openSet = new Map(); // key -> node
  const closedSet = new Set();

  const start = {
    row: startRow,
    col: startCol,
    g: 0,
    h: manhattan(startRow, startCol, endRow, endCol),
    f: 0,
    parent: null,
  };
  start.f = start.g + start.h;
  openSet.set(key(startRow, startCol), start);

  while (openSet.size > 0) {
    // Pick the open node with the lowest f score
    let current = null;
    let currentKey = null;
    for (const [k, node] of openSet) {
      if (!current || node.f < current.f) {
        current = node;
        currentKey = k;
      }
    }

    if (current.row === endRow && current.col === endCol) {
      // Reconstruct path
      const path = [];
      let node = current;
      while (node.parent) {
        path.unshift({ row: node.row, col: node.col });
        node = node.parent;
      }
      return path;
    }

    openSet.delete(currentKey);
    closedSet.add(currentKey);

    for (const [dr, dc] of DIRS) {
      const row = current.row + dr;
      const col = current.col + dc;

      if (row < 0 || row >= GRID_SIZE || col < 0 || col >= GRID_SIZE) continue;
      if (closedSet.has(key(row, col))) continue;

      const tile = getTile(row, col);
      if (!isWalkable(tile)) continue;

      const g = current.g + 1;
      const existing = openSet.get(key(row, col));

      if (!existing || g < existing.g) {
        const h = manhattan(row, col, endRow, endCol);
        openSet.set(key(row, col), {
          row,
          col,
          g,
          h,
          f: g + h,
          parent: current,
        });
      }
    }
  }

  return [];
}

/**
 * Pick a random walkable tile at least `minDistance` (Manhattan) cells away
 * from the given position. Returns { row, col } or null if none exists.
 */
export function getRandomWalkableTarget(startRow, startCol, minDistance = 3) {
  const candidates = [];
  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      const tile = getTile(row, col);
      if (!isWalkable(tile)) continue;
      if (manhattan(row, col, startRow, startCol) < minDistance) continue;
      candidates.push({ row, col });
    }
  }
  if (candidates.length === 0) return null;
  return candidates[Math.floor(Math.random() * candidates.length)];
}

function manhattan(aRow, aCol, bRow, bCol) {
  return Math.abs(aRow - bRow) + Math.abs(aCol - bCol);
}
