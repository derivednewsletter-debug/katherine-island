/**
 * Shop catalog.
 *
 * Three kinds of items:
 *  - 'decoration': unlocks a NEW build-palette tool (a one-time purchase
 *    that adds the exotic prop to the placement bar).
 *  - 'upgrade': a permanent passive perk stored in `upgrades`.
 *  - 'egg': a pet egg (repeatable purchase) — place it on the island and
 *    it hatches into a new pet after EGG_HATCH_MS of real time.
 *
 * Prices are keyed by resource id ({ berry, shell, stone }) so items can
 * cost a mix of gathered goods.
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
];

/** Find an item by id. */
export function shopItem(id) {
  return SHOP_ITEMS.find((item) => item.id === id) ?? null;
}

/** Can the player afford `price` with the given inventory? */
export function canAfford(price, inventory) {
  return Object.entries(price).every(([resource, amount]) => (inventory[resource] ?? 0) >= amount);
}

/** Subtract a price from the inventory (assumes affordability was checked). */
export function deductPrice(price, inventory) {
  const next = { ...inventory };
  for (const [resource, amount] of Object.entries(price)) {
    next[resource] = (next[resource] ?? 0) - amount;
  }
  return next;
}
