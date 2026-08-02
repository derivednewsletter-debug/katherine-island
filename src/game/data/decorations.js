/**
 * Decoration data: the build palette, the deterministic scatter that seeds
 * the island on first load, and the rules for where a player can plant.
 *
 * The scatter is derived purely from the fixed map seed, so it is NOT
 * persisted — on boot it regenerates identically, then player-planted props
 * (and any erased scatter cells) are merged back in. See mergeDecorations.
 */
import {
  GRID_SIZE,
  getTile,
  isWalkable,
  gridToWorld,
  BED_SPOT,
  SPAWN_POINT,
  KIOSK_TILE,
} from './mapData';
import { TILE_THICKNESS } from '../components/Tile';

/** Build palette — what the player can place and what the HUD shows. */
export const DECORATION_TYPES = {
  palm: { label: 'Palm', color: '#4ade80' },
  rock: { label: 'Rock', color: '#9aa3ab' },
  flower: { label: 'Flower', color: '#ff9eb0' },
  fountain: { label: 'Fountain', color: '#5fc3e8' },
  lantern: { label: 'Lantern', color: '#ffcf6e' },
  erase: { label: 'Eraser', color: '#f87171' },
  // Scatter-only (not in build palette): jungle undergrowth
  bush: { label: 'Bush', color: '#3a8c5a' },
};

/** Decoration kinds available in the palette for free (not shop unlocks). */
export const BASE_KINDS = ['palm', 'rock', 'flower'];

/** Deterministic PRNG (mulberry32) so the island's decorations are identical
 *  on every load — no layout flicker between re-renders. */
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

/**
 * Scatter decorative props (palms, rocks, flowers) on walkable tiles of the
 * generated island. Per-tile probabilities are tuned down for the big map so
 * ~25K tiles yield a few thousand props (instanced, so still cheap). Keeps
 * clear rings around spawn, the sleeping mat, and the shop kiosk.
 */
export function generateInitialDecorations() {
  const rng = mulberry32(20260801);
  const list = [];
  const SPAWN = SPAWN_POINT;

  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      const tile = getTile(row, col);
      if (!tile || !isWalkable(tile)) continue;
      // Leave the spawn tile + its immediate ring empty
      if (Math.abs(row - SPAWN.row) <= 1 && Math.abs(col - SPAWN.col) <= 1) continue;
      // Keep the shop kiosk's tile clear — it owns that spot
      if (row === KIOSK_TILE.row && col === KIOSK_TILE.col) continue;
      // Keep the pet's sleeping mat clear so it can always reach bed
      if (row === BED_SPOT.row && col === BED_SPOT.col) continue;

      const r = rng();
      let kind = null;

      if (tile.type === 'grass' || tile.type === 'jungle') {
        if (r < 0.05) kind = 'palm';
        else if (r < 0.09) kind = 'rock';
        else if (r < 0.15) kind = 'flower';
        else if (r < 0.22 && tile.type === 'jungle') kind = 'bush'; // jungle undergrowth
      } else if (tile.type === 'sand') {
        if (r < 0.1) kind = 'palm';
        else if (r < 0.16) kind = 'rock';
      } else if (tile.type === 'hill') {
        if (r < 0.14) kind = 'palm';
        else if (r < 0.22) kind = 'rock';
      } else if (tile.type === 'peak') {
        if (r < 0.28) kind = 'rock';
      }

      if (!kind) continue;

      const { x, z } = gridToWorld(row, col);
      // Small random offset so props don't look machine-aligned
      const jitter = 0.18;
      list.push({
        id: `${row},${col}`,
        kind,
        row,
        col,
        x: x + (rng() - 0.5) * jitter,
        z: z + (rng() - 0.5) * jitter,
        y: tile.height + TILE_THICKNESS, // top surface of the tile
        rot: rng() * Math.PI * 2,
        scale: 0.75 + rng() * 0.55,
      });
    }
  }

  return list;
}

/**
 * Rebuild the full decoration list after a save loads: the deterministic
 * scatter, minus cells the player erased, plus the player's planted props.
 * `removedCells` is a list of "${row},${col}" strings (erased scatter cells);
 * `planted` is the list of player-planted decorations (full records).
 */
export function mergeDecorations(scatter, planted, removedCells) {
  const removed = new Set(removedCells ?? []);
  const plantedCells = new Set(planted.map((d) => `${d.row},${d.col}`));
  const kept = scatter.filter((d) => !removed.has(d.id) && !plantedCells.has(d.id));
  return [...kept, ...planted];
}

/**
 * Can a decoration be planted on this cell?
 *  - the tile must exist and be walkable (land, not water)
 *  - the creature's current tile stays off-limits (don't plant on the pet)
 *  - the shop kiosk owns its tile
 *  - the cell must not already hold a decoration
 */
export function canPlaceDecoration(decorations, row, col, creaturePos, kioskTile) {
  const tile = getTile(row, col);
  if (!tile || !isWalkable(tile)) return false;
  if (creaturePos && creaturePos.row === row && creaturePos.col === col) return false;
  if (kioskTile && kioskTile.row === row && kioskTile.col === col) return false;
  if (row === BED_SPOT.row && col === BED_SPOT.col) return false; // the mat owns its tile
  return !decorations.some((d) => d.row === row && d.col === col);
}
