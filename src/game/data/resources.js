/**
 * Gathering economy config.
 * Maps each terrain type to the resource it yields when clicked, plus the
 * display metadata the HUD uses.
 */

export const RESOURCES = {
  berry: { label: 'Berries', emoji: '🍓', color: '#ff5d7e' },
  shell: { label: 'Shells', emoji: '🐚', color: '#ffd9b0' },
  stone: { label: 'Stones', emoji: '🪨', color: '#aab4bf' },
  // Crop harvests — the biome payoffs (also feedable treats)
  flower: { label: 'Flowers', emoji: '🌸', color: '#ff9eb0' },
  fruit: { label: 'Fruit', emoji: '🍇', color: '#b06ad4' },
  herb: { label: 'Herbs', emoji: '🌿', color: '#8fd694' },
};

/**
 * Terrain type -> resource id. Terrains not listed (water, shallow) yield
 * nothing when gathered. Jungle bushes yield berries; peaks are rocky.
 */
const TERRAIN_RESOURCE = {
  grass: 'berry',
  jungle: 'berry',
  sand: 'shell',
  hill: 'stone',
  peak: 'stone',
};

/** Resource id for a terrain type, or null if the terrain isn't gatherable. */
export function resourceForTerrain(type) {
  return TERRAIN_RESOURCE[type] ?? null;
}

/** How long (ms) a tile must rest after being harvested before it regrows. */
export const GATHER_COOLDOWN_MS = 1500;
