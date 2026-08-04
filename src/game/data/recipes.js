/** Cooking recipes for the placeable stove and grill. */
export const RECIPE_COST = {
  stove: { wood: 1 },
  grill: { wood: 1 },
};

export const RECIPES = {
  stove: [
    {
      id: 'stew',
      name: 'Hearty Stew',
      emoji: '🍲',
      appliance: 'stove',
      inputs: { berry: 2, herb: 1 },
      output: { stew: 1 },
    },
    {
      id: 'porridge',
      name: 'Berry Porridge',
      emoji: '🥣',
      appliance: 'stove',
      inputs: { berry: 3, fruit: 1 },
      output: { porridge: 1 },
    },
    {
      id: 'herbalTea',
      name: 'Herbal Tea',
      emoji: '🍵',
      appliance: 'stove',
      inputs: { herb: 2, flower: 1 },
      output: { herbalTea: 1 },
    },
  ],
  grill: [
    {
      id: 'grilled',
      name: 'Grilled Fruit',
      emoji: '🍖',
      appliance: 'grill',
      inputs: { fruit: 1, berry: 1 },
      output: { grilled: 1 },
    },
    {
      id: 'fruitSkewers',
      name: 'Fruit Skewers',
      emoji: '🍡',
      appliance: 'grill',
      inputs: { fruit: 2, flower: 1 },
      output: { fruitSkewers: 1 },
    },
    {
      id: 'roastedHerbs',
      name: 'Roasted Herb Bites',
      emoji: '🥬',
      appliance: 'grill',
      inputs: { herb: 2, berry: 1 },
      output: { roastedHerbs: 1 },
    },
  ],
};

export function recipeById(id) {
  for (const recipes of Object.values(RECIPES)) {
    const recipe = recipes.find((item) => item.id === id);
    if (recipe) return recipe;
  }
  return null;
}

export function canCraft(inventory, recipeId) {
  const recipe = recipeById(recipeId);
  if (!recipe) return false;
  const costs = { ...(RECIPE_COST[recipe.appliance] ?? {}), ...recipe.inputs };
  return Object.entries(costs).every(([resource, amount]) => (inventory?.[resource] ?? 0) >= amount);
}
