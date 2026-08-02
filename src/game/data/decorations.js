/**
 * Decoration data: the build palette, the deterministic scatter that seeds
 * the island on first load, and the rules for where a player can plant.
 */
import { GRID_SIZE, getTile, isWalkable, gridToWorld, BED_SPOT } from './mapData';
import { TILE_THICKNESS } from '../components/Tile';
import { KIOSK_TILE } from './shop';

/** Build palette — what the player can place and what the HUD shows. */
export const DECORATION_TYPES = {
  palm: { label: 'Palm', emoji: '🌴', color: '#4ade80' },
  rock: { label: 'Rock', emoji: '🪨', color: '#9aa3ab' },
  flower: { label: 'Flower', emoji: '🌸', color: '#ff9eb0' },
  fountain: { label: 'Fountain', emoji: '⛲', color: '#5fc3e8' },
  lantern: { label: 'Lantern', emoji: '🏮', color: '#ffcf6e' },
  erase: { label: 'Eraser', emoji: '🧹', color: '#f87171' },
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
 * Scatter decorative props (palms, rocks, flowers) on walkable tiles.
 * Same rules + seed as the original static version, so the island looks
 * identical to before — but each item now records its grid cell so the
 * store can enforce occupancy and the pet can path around it.
 */
export function generateInitialDecorations() {
  const rng = mulberry32(20260801);
  const list = [];

  // Creature spawns at grid (6,6) — keep a small clearing around it so
  // the pet never loads inside a palm tree.
  const SPAWN = { row: 6, col: 6 };

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

      if (tile.type === 'grass') {
        if (r < 0.14) kind = 'palm';
        else if (r < 0.2) kind = 'rock';
        else if (r < 0.3) kind = 'flower';
      } else if (tile.type === 'sand') {
        if (r < 0.18) kind = 'palm';
        else if (r < 0.24) kind = 'rock';
      } else if (tile.type === 'hill') {
        if (r < 0.3) kind = 'palm';
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
