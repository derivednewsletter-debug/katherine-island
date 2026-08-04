/**
 * Gathering economy config.
 * Maps each terrain type to the resource it yields when clicked, plus the
 * display metadata the HUD uses.
 */

export const RESOURCES = {
  berry: { label: 'Berries', color: '#ff5d7e' },
  shell: { label: 'Shells', color: '#ffd9b0' },
  stone: { label: 'Stones', color: '#aab4bf' },
  // Crop harvests — the biome payoffs (also feedable treats)
  flower: { label: 'Flowers', color: '#ff9eb0' },
  fruit: { label: 'Fruit', color: '#b06ad4' },
  herb: { label: 'Herbs', color: '#8fd694' },
  // Wood is gathered from trees with an axe — sellable for coins
  wood: { label: 'Wood', color: '#8d6b4b' },
  // Pet care items — held and used on a pet
  soap: { label: 'Soap', color: '#c9a9ff' },
  medkit: { label: 'Medkit', color: '#ff7b7b' },
  toy: { label: 'Toy', color: '#ff9e6b' },
  stew: { label: 'Stew', color: '#f0b27a' },
  grilled: { label: 'Grilled', color: '#c98a4b' },
  porridge: { label: 'Porridge', color: '#f3d49b' },
  herbalTea: { label: 'Herbal Tea', color: '#b9e39b' },
  fruitSkewers: { label: 'Fruit Skewers', color: '#ff9e6b' },
  roastedHerbs: { label: 'Roasted Herbs', color: '#9acb7c' },
  // Coins — the shop currency (sell resources, buy seeds/tools)
  coin: { label: 'Coins', color: '#ffd700' },
};

/** Tool types the player can equip and use. */
export const TOOLS = {
  axe: { label: 'Axe', durability: 50, description: 'Chop down trees for wood' },
  hoe: { label: 'Hoe', durability: 50, description: 'Till soil for planting' },
  wateringCan: { label: 'Watering Can', durability: 30, description: 'Water crops to speed growth' },
};

/** Which terrain types can be gathered with a specific tool. */
export const TOOL_GATHER = {
  axe: ['grass', 'jungle'], // trees are scattered props on grass/jungle
};

/** Starting inventory when the player begins a new game. */
export const STARTING_INVENTORY = {
  berry: 3,
  coin: 10,
  hoe: 1,
  axe: 1,
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
