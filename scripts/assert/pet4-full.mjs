import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const esbuild = require('esbuild');
const result = await esbuild.build({
  entryPoints: ['src/game/state/gameStore.js'],
  bundle: true,
  format: 'esm',
  platform: 'node',
  write: false,
});
const out = result.outputFiles[0].text;
const { useGameStore, FEED_BY_RESOURCE } = await import('data:text/javascript,' + encodeURIComponent(out));
const pass = (name, cond) => {
  if (!cond) {
    console.error('FAIL: ' + name);
    process.exitCode = 1;
  } else console.log('ok: ' + name);
};

const base = useGameStore.getState();
useGameStore.setState({
  pets: [{ id: 'p1', species: 'bunny', name: 'Nibbles', needs: { hunger: 80, energy: 80, happiness: 50, hygiene: 80 }, stage: 'baby', carePoints: 0, ranAway: false, deceased: false }],
  inventory: { ...base.inventory, berry: 4, herb: 1, wood: 1, toy: 1 },
  activeAppliance: { id: 's1', row: 5, col: 5, kind: 'stove' },
});
useGameStore.getState().openRename('p1');
useGameStore.getState().renamePet('Mochi');
pass('rename persists', useGameStore.getState().pets[0].name === 'Mochi');
pass('stew in feed table', FEED_BY_RESOURCE.stew?.hunger >= 30 && FEED_BY_RESOURCE.stew?.hygiene >= 15);
pass('grilled in feed table', FEED_BY_RESOURCE.grilled?.energy >= 20);
pass('cook flow', useGameStore.getState().craftMeal('stew') && useGameStore.getState().inventory.stew === 1);
const fetchRow = useGameStore.getState().playerPos.row;
const fetchCol = useGameStore.getState().playerPos.col;
pass('fetch target set', useGameStore.getState().throwToy('p1', fetchRow, fetchCol) && useGameStore.getState().pets[0].fetchTarget?.row === fetchRow);
useGameStore.getState().fetchReturned('p1');
pass('fetch reward', useGameStore.getState().pets[0].fetchTarget === null && useGameStore.getState().pets[0].needs.happiness === 62);
useGameStore.getState().toggleFollow('p1');
pass('following set', useGameStore.getState().followingPetId === 'p1');
useGameStore.getState().stopFollow();
pass('following cleared', useGameStore.getState().followingPetId === null);
console.log(process.exitCode ? 'FAILED' : 'PASS');
