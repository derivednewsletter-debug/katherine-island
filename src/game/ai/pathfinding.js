/**
 * Pathfinding utilities for creature movement.
 *
 * The island is a MASSIVE 160×160 grid, so the old linear-min-scan A*
 * (fine at 14×14, quadratic-ish at 25K tiles) is replaced with a binary
 * heap priority queue and a node-expansion cap. Roaming targets are picked
 * from a bounded local window so pets wander near home instead of across
 * the map, and never scan the whole grid per stroll.
 */
import { GRID_SIZE, getTile, isWalkable } from '../data/mapData';

const DIRS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

const key = (row, col) => `${row},${col}`;

/** Hard cap on A* node expansions so a pathological route can't stall a
 *  frame loop. ~25K tiles → even a worst-case 200-tile trek expands well
 *  under this; hitting it just means "no path" for that attempt. */
const MAX_EXPANSIONS = 30000;

/** Min binary heap keyed on node.f (A* priority). */
class MinHeap {
  constructor() {
    this.data = [];
  }
  get size() {
    return this.data.length;
  }
  isEmpty() {
    return this.data.length === 0;
  }
  push(node) {
    const d = this.data;
    d.push(node);
    let i = d.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (d[parent].f <= d[i].f) break;
      [d[parent], d[i]] = [d[i], d[parent]];
      i = parent;
    }
  }
  pop() {
    const d = this.data;
    const top = d[0];
    const last = d.pop();
    if (d.length > 0) {
      d[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let smallest = i;
        if (l < d.length && d[l].f < d[smallest].f) smallest = l;
        if (r < d.length && d[r].f < d[smallest].f) smallest = r;
        if (smallest === i) break;
        [d[smallest], d[i]] = [d[i], d[smallest]];
        i = smallest;
      }
    }
    return top;
  }
}

/**
 * A* search for a path between two grid cells.
 * Returns an array of { row, col } waypoints (NOT including the start cell),
 * or an empty array if no path exists.
 *
 * Optional `isBlocked(row, col)` lets callers mark extra cells (e.g. tiles
 * holding decorations) as impassable so the pet routes around plants.
 */
export function findPath(startRow, startCol, endRow, endCol, isBlocked) {
  // Same cell or unreachable target -> no path needed
  if (startRow === endRow && startCol === endCol) return [];
  const targetTile = getTile(endRow, endCol);
  if (!isWalkable(targetTile)) return [];
  if (isBlocked && isBlocked(endRow, endCol)) return [];

  const startKey = key(startRow, startCol);
  const goalKey = key(endRow, endCol);
  const heap = new MinHeap();
  const gScore = new Map([[startKey, 0]]);
  const parent = new Map();
  let expansions = 0;

  heap.push({
    f: manhattan(startRow, startCol, endRow, endCol),
    g: 0,
    row: startRow,
    col: startCol,
    k: startKey,
  });

  while (!heap.isEmpty()) {
    const node = heap.pop();
    // Skip stale heap entries (a better route already reached this cell)
    if (gScore.get(node.k) !== node.g) continue;

    if (node.k === goalKey) {
      const path = [];
      let k = node.k;
      while (k !== startKey) {
        const [r, c] = k.split(',').map(Number);
        path.unshift({ row: r, col: c });
        k = parent.get(k);
      }
      return path;
    }

    if (++expansions > MAX_EXPANSIONS) return [];

    for (const [dr, dc] of DIRS) {
      const row = node.row + dr;
      const col = node.col + dc;
      if (row < 0 || row >= GRID_SIZE || col < 0 || col >= GRID_SIZE) continue;
      const tile = getTile(row, col);
      if (!isWalkable(tile)) continue;
      if (isBlocked && isBlocked(row, col)) continue;

      const nk = key(row, col);
      const g = node.g + 1;
      if (g >= (gScore.get(nk) ?? Infinity)) continue;
      gScore.set(nk, g);
      parent.set(nk, node.k);
      heap.push({
        f: g + manhattan(row, col, endRow, endCol),
        g,
        row,
        col,
        k: nk,
      });
    }
  }

  return [];
}

/**
 * Pick a random walkable, unblocked tile between `minDistance` and
 * `maxDistance` (Manhattan) cells away — a LOCAL wander so pets roam the
 * neighborhood instead of teleporting across a 160-wide island. Only the
 * bounded window around the start is scanned (never the whole grid).
 * Returns { row, col } or null if none.
 */
export function getRandomWalkableTarget(
  startRow,
  startCol,
  minDistance = 3,
  isBlocked,
  maxDistance = 24
) {
  const r0 = Math.max(0, startRow - maxDistance);
  const r1 = Math.min(GRID_SIZE - 1, startRow + maxDistance);
  const c0 = Math.max(0, startCol - maxDistance);
  const c1 = Math.min(GRID_SIZE - 1, startCol + maxDistance);

  const candidates = [];
  for (let row = r0; row <= r1; row++) {
    for (let col = c0; col <= c1; col++) {
      const tile = getTile(row, col);
      if (!isWalkable(tile)) continue;
      if (isBlocked && isBlocked(row, col)) continue;
      const dist = manhattan(row, col, startRow, startCol);
      if (dist < minDistance) continue;
      candidates.push({ row, col });
    }
  }
  if (candidates.length === 0) return null;
  return candidates[Math.floor(Math.random() * candidates.length)];
}

function manhattan(aRow, aCol, bRow, bCol) {
  return Math.abs(aRow - bRow) + Math.abs(aCol - bCol);
}
