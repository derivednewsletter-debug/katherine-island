/**
 * Shop catalog.
 *
 * Five kinds of items:
 *  - 'decoration': unlocks a NEW build-palette tool (a one-time purchase
 *    that adds the exotic prop to the placement bar).
 *  - 'upgrade': a permanent passive perk stored in `upgrades`.
 *  - 'egg': a pet egg (repeatable purchase) — place it on the island and
 *    it hatches into a new pet after EGG_HATCH_MS of real time.
 *  - 'seed': a pack of crop seeds (repeatable) — each purchase adds seeds
 *    to the matching pile; planting a crop consumes one.
 *  - 'exotic': a one-time unlock that reveals a RARE crop (the night
 *    flower) in the plant palette; its seeds are sold afterwards.
 *  - 'tool': a farming tool (axe, hoe) — buy replacements for coins.
 *  - 'plant': a tree/bush decoration that can be placed on the island.
 *
 * Prices are keyed by resource id ({ berry, shell, stone, wood, coin })
 * so items can cost a mix of gathered goods or coins.
 */
import { PET_SPECIES } from './species';

// The shop kiosk's tile is chosen programmatically by the procedural map
// generator (nearest roomy sand tile to spawn). Re-exported so every
// existing `import { KIOSK_TILE } from './shop'` keeps working.
export { KIOSK_TILE } from './mapData';

export const SHOP_ITEMS = [
  {
    id: 'fountain',
    kind: 'decoration',
    name: 'Fountain',
    emoji: '⛲',
    desc: 'Unlocks a bubbling fountain in your build palette.',
    price: { stone: 10 },
  },
  {
    id: 'lantern',
    kind: 'decoration',
    name: 'Lantern',
    emoji: '🏮',
    desc: 'Unlocks a glowing lantern in your build palette.',
    price: { shell: 8 },
  },
  {
    id: 'stove',
    kind: 'decoration',
    name: 'Stove',
    emoji: '🍲',
    desc: 'Unlocks a stove for cooking hearty stews.',
    price: { wood: 6, stone: 4 },
  },
  {
    id: 'grill',
    kind: 'decoration',
    name: 'Grill',
    emoji: '🍖',
    desc: 'Unlocks a grill for cooking grilled meals.',
    price: { wood: 8, stone: 6 },
  },
  {
    id: 'berryBasket',
    kind: 'upgrade',
    name: 'Berry Basket',
    emoji: '🧺',
    desc: 'Gather +1 berry per click from grass.',
    price: { berry: 8 },
  },
  {
    id: 'shellBucket',
    kind: 'upgrade',
    name: 'Shell Bucket',
    emoji: '🪣',
    desc: 'Gather +1 shell per click from sand.',
    price: { shell: 8 },
  },
  {
    id: 'stonePick',
    kind: 'upgrade',
    name: 'Stone Pick',
    emoji: '⛏️',
    desc: 'Gather +1 stone per click from hills.',
    price: { stone: 8 },
  },
  {
    id: 'comfyNest',
    kind: 'upgrade',
    name: 'Comfy Nest',
    emoji: '🛏️',
    desc: 'All needs drain 25% slower — a comfier life.',
    price: { berry: 6, shell: 6, stone: 6 },
  },

  // ── Pet eggs (repeatable purchase; place on the island to hatch) ──
  ...Object.entries(PET_SPECIES).map(([id, sp]) => ({
    id: `egg:${id}`,
    kind: 'egg',
    species: id,
    name: `${sp.label} Egg`,
    emoji: sp.emoji,
    desc: 'Place it on the island — it hatches into a new pet after 10 real minutes.',
    price: sp.price,
  })),

  // ── Crop seeds (repeatable packs — planting consumes one seed each) ──
  {
    id: 'seed:berryBush',
    kind: 'seed',
    crop: 'berryBush',
    name: 'Berry Bush Seeds',
    emoji: '🌱',
    desc: 'A 3-pack of berry bush seeds — plant on grass or jungle.',
    price: { berry: 3 },
    count: 3,
  },
  {
    id: 'seed:flowerPatch',
    kind: 'seed',
    crop: 'flowerPatch',
    name: 'Flower Patch Seeds',
    emoji: '🌸',
    desc: 'A 3-pack of flower seeds — plant on grass or jungle.',
    price: { berry: 3 },
    count: 3,
  },
  {
    id: 'seed:fruitTree',
    kind: 'seed',
    crop: 'fruitTree',
    name: 'Jungle Fruit Seeds',
    emoji: '🍇',
    desc: 'A 2-pack of jungle fruit seeds — jungle only.',
    price: { stone: 4, berry: 2 },
    count: 2,
  },
  {
    id: 'seed:mountainHerb',
    kind: 'seed',
    crop: 'mountainHerb',
    name: 'Mountain Herb Seeds',
    emoji: '🌿',
    desc: 'A 3-pack of mountain herb seeds — peaks only.',
    price: { stone: 4 },
    count: 3,
  },

  // ── Exotic section (one-time unlock, then its seeds become buyable) ──
  {
    id: 'unlock:nightFlower',
    kind: 'exotic',
    crop: 'nightFlower',
    name: 'Night Flower',
    emoji: '🌙',
    desc: 'Unlocks the rare night flower — it only grows on peaks, and only at night. Its seeds unlock in the shop after this.',
    price: { stone: 15, flower: 8 },
  },
  {
    id: 'seed:nightFlower',
    kind: 'seed',
    crop: 'nightFlower',
    name: 'Night Flower Seeds',
    emoji: '🌙',
    desc: 'A 2-pack of night flower seeds — peaks only, grows at night.',
    price: { flower: 5 },
    count: 2,
  },

  // ── Farming tools (buy extra tools / replacements) ──
  {
    id: 'tool:axe',
    kind: 'tool',
    tool: 'axe',
    name: 'Axe',
    emoji: '🪓',
    desc: 'Chop down trees for wood. (You start with one!)',
    price: { coin: 8 },
  },
{
    id: 'tool:hoe',
    kind: 'tool',
    tool: 'hoe',
    name: 'Hoe',
    emoji: '🌾',
    desc: 'Till soil for planting crops. (You start with one!)',
    price: { coin: 6 },
  },

  // ── Pet care items (hold to use on a pet) ──
  {
    id: 'petcare:soap',
    kind: 'item',
    resource: 'soap',
    name: 'Soap',
    emoji: '🧼',
    desc: 'Bathe a pet to restore its hygiene.',
    price: { shell: 4 },
    count: 1,
  },
  {
    id: 'petcare:medkit',
    kind: 'item',
    resource: 'medkit',
    name: 'Medkit',
    emoji: '💊',
    desc: 'Heals a sick pet — restores hunger and hygiene.',
    price: { shell: 6, herb: 2 },
    count: 1,
  },
  {
    id: 'petcare:toy',
    kind: 'item',
    resource: 'toy',
    name: 'Fetch Toy',
    emoji: '🎾',
    desc: 'Play fetch with a pet.',
    price: { shell: 5 },
    count: 1,
  },

  // ── Sell-back prices (player can sell gathered resources for coins) ──
  // These appear in the shop as "sell" options.
];

/** Buyback prices: how many coins a resource sells for. */
export const SELL_PRICES = {
  berry: 2,
  shell: 3,
  stone: 3,
  wood: 5,
  flower: 4,
  fruit: 6,
  herb: 5,
};

/** Find an item by id. */
export function shopItem(id) {
  return SHOP_ITEMS.find((item) => item.id === id) ?? null;
}

/** Can the player afford `price` given inventory + currency? */
export function canAfford(price, inventory, currency = 0) {
  const invTotal = { ...inventory, coin: currency };
  return Object.entries(price).every(([resource, amount]) => (invTotal[resource] ?? 0) >= amount);
}

/** Subtract a price from inventory + currency (assumes affordability checked). */
export function deductPrice(price, inventory, currency = 0) {
  const next = { ...inventory };
  let nextCurrency = currency;
  for (const [resource, amount] of Object.entries(price)) {
    if (resource === 'coin') {
      nextCurrency -= amount;
    } else {
      next[resource] = (next[resource] ?? 0) - amount;
    }
  }
  return { inventory: next, currency: nextCurrency };
}
