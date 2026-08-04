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

const pid = 'pet-test-1';
useGameStore.setState({ pets: [{ id: pid, species: 'bunny', name: 'Nibbles', needs: { hunger: 80, energy: 80, happiness: 80, hygiene: 80 }, ranAway: true }] });
pass('rescuePet clears runaway + restores happiness', (() => {
  useGameStore.getState().rescuePet(pid);
  const p = useGameStore.getState().pets.find((x) => x.id === pid);
  return p && p.ranAway === false && p.needs.happiness === 80;
})());
pass('rescue advances pet:rescue quest', (() => {
  const q = useGameStore.getState().quests.find((x) => x.id === 'pet:rescue');
  return q && q.progress >= 1;
})());
console.log(process.exitCode ? 'FAILED' : 'PASS');