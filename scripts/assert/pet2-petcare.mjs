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
const { useGameStore } = await import('data:text/javascript,' + encodeURIComponent(out));
const pass = (name, cond) => { if (!cond) { console.error('FAIL: ' + name); process.exitCode = 1; } else console.log('ok: ' + name); };

useGameStore.setState({ pets: [{ id: 'p1', species: 'bunny', name: 'Nibbles', stage: 'baby', carePoints: 0, ageDays: 0, elderSince: null, deceased: false }] });
pass('addPetCare evolves baby to child', (() => {
  useGameStore.getState().addPetCare('p1', 10);
  const p = useGameStore.getState().pets.find((x) => x.id === 'p1');
  return p.stage === 'child';
})());
pass('new hatched pet defaults to baby', (() => {
  const before = useGameStore.getState().pets.length;
  useGameStore.setState({ placedEggs: [{ id: 'egg1', species: 'bunny', row: 5, col: 5 }] });
  useGameStore.getState().hatchEgg('egg1');
  const p = useGameStore.getState().pets[useGameStore.getState().pets.length - 1];
  return p.stage === 'baby' && p.ageDays === 0 && p.deceased === false;
})());
console.log(process.exitCode ? 'FAILED' : 'PASS');