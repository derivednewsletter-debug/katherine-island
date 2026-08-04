import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const esbuild = require('esbuild');

async function bundle(entry) {
  const result = await esbuild.build({
    entryPoints: [entry],
    bundle: true,
    format: 'esm',
    platform: 'node',
    write: false,
  });
  return import('data:text/javascript,' + encodeURIComponent(result.outputFiles[0].text));
}

const species = await bundle('src/game/data/species.js');
const recipes = await bundle('src/game/data/recipes.js');
const store = await bundle('src/game/state/gameStore.js');
const petParts = await bundle('src/game/components/petParts.js');
const pass = (name, cond) => {
  if (!cond) {
    console.error('FAIL: ' + name);
    process.exitCode = 1;
  } else console.log('ok: ' + name);
};

for (const id of ['fox', 'penguin', 'turtle']) {
  const sp = species.PET_SPECIES[id];
  pass(`${id} species registered`, Boolean(sp));
  pass(`${id} has unique palette`, new Set(Object.values(sp.colors)).size >= 5);
  pass(`${id} has all growth stages`, ['baby', 'child', 'adult', 'elder'].every((stage) => sp.growth?.[stage]));
}

pass('fox habitat is hill', species.PET_SPECIES.fox.habitat === 'hill');
pass('penguin has flippers', species.PET_SPECIES.penguin.flippers === true);
pass('turtle has shell marker', species.PET_SPECIES.turtle.shell === true);
pass('stove has expanded recipes', recipes.RECIPES.stove.length >= 3);
pass('grill has expanded recipes', recipes.RECIPES.grill.length >= 3);
pass('porridge output resource', recipes.recipeById('porridge').output.porridge === 1);
pass('tea output resource', recipes.recipeById('herbalTea').output.herbalTea === 1);
pass('skewers craft with inputs', recipes.canCraft({ wood: 1, fruit: 2, flower: 1 }, 'fruitSkewers'));
pass('tea requires two herbs', !recipes.canCraft({ wood: 1, herb: 1, flower: 1 }, 'herbalTea'));
pass('new foods feed pets', ['porridge', 'herbalTea', 'fruitSkewers', 'roastedHerbs'].every((id) => store.FEED_BY_RESOURCE[id]));
for (const [id, required] of [['fox', 8], ['penguin', 6], ['turtle', 3]]) {
  store.useGameStore.setState({ pets: [{ id, species: id, stage: 'baby', carePoints: 0, needs: { hunger: 100, energy: 100, happiness: 100, hygiene: 100 } }] });
  store.useGameStore.getState().addPetCare(id, required);
  pass(`${id} uses its own growth threshold`, store.useGameStore.getState().pets[0].stage === 'child');
}
const foxVisual = petParts.speciesStageStyle('adult', species.PET_SPECIES.fox.colors, species.PET_SPECIES.fox.growth.adult);
pass('fox adult visual override applies', foxVisual.scale > 1 && foxVisual.colors.body === '#e96e2f');
store.useGameStore.setState({
  activeAppliance: { kind: 'stove' },
  inventory: { wood: 1, berry: 3, fruit: 1, herb: 0, flower: 0, porridge: 0 },
});
pass('craftMeal credits porridge', store.useGameStore.getState().craftMeal('porridge') && store.useGameStore.getState().inventory.porridge === 1);
console.log(process.exitCode ? 'FAILED' : 'PASS');
