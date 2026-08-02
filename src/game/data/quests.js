/**
 * Quest board catalog — simple goals that give the gather/care loop a sense
 * of purpose. Each quest watches ONE metric (a string emitted by game
 * events) and pays out a resource reward once the target is reached.
 *
 * Metrics emitted by the game:
 *  - `gather:<resource>`  e.g. 'gather:berry' (MapGrid, per harvested unit)
 *  - 'pet'                  (Creature/Pet click-to-pet, +1 per pet)
 *  - 'feed'                 (Creature/Pet fed a berry, +1)
 *  - 'buy:decoration'       (ShopHud bought a decoration unlock, +1)
 */

export const QUESTS = [
  {
    id: 'gather-berry-10',
    emoji: '🍓',
    title: 'Berry Picker',
    desc: 'Gather 10 berries from grass',
    metric: 'gather:berry',
    target: 10,
    reward: { stone: 3 },
  },
  {
    id: 'pet-5',
    emoji: '💛',
    title: 'Pet Pal',
    desc: 'Pet the creature 5 times',
    metric: 'pet',
    target: 5,
    reward: { berry: 4 },
  },
  {
    id: 'buy-decoration-1',
    emoji: '🏪',
    title: 'Island Upgrader',
    desc: 'Buy a decoration from the shop',
    metric: 'buy:decoration',
    target: 1,
    reward: { berry: 6, shell: 4 },
  },
  {
    id: 'feed-1',
    emoji: '🍽️',
    title: 'Head Chef',
    desc: 'Feed the creature a berry',
    metric: 'feed',
    target: 1,
    reward: { stone: 2 },
  },
];

/** Find a quest definition by id. */
export function questById(id) {
  return QUESTS.find((q) => q.id === id) ?? null;
}

/** Create the fresh (all-zero, unclaimed) quest progress array. */
export function freshQuests() {
  return QUESTS.map((q) => ({ id: q.id, progress: 0, claimed: false }));
}

/** Build a metric → [quest ids] index so advancement is a single lookup. */
export function questIndexByMetric() {
  const index = {};
  for (const q of QUESTS) {
    (index[q.metric] ??= []).push(q.id);
  }
  return index;
}
