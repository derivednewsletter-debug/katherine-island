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
const { useGameStore, NEED_DRAIN } = await import('data:text/javascript,' + encodeURIComponent(out));
const pass = (name, cond) => { if (!cond) { console.error('FAIL: ' + name); process.exitCode = 1; } else console.log('ok: ' + name); };

pass('NEED_DRAIN tuned', NEED_DRAIN.hunger >= 0.6 && NEED_DRAIN.hygiene >= 0.2);
useGameStore.setState({ needs: { hunger: 100, energy: 100, happiness: 100, hygiene: 100 }, sick: false, inventory: { ...useGameStore.getState().inventory, soap: 1, medkit: 1 } });
useGameStore.getState().drainNeeds(100);
let s = useGameStore.getState();
pass('hygiene drained', s.needs.hygiene < 100);
s.bathePet('starter');
pass('bathe restores hygiene', useGameStore.getState().needs.hygiene > 90);
useGameStore.setState({ needs: { hunger: 5, energy: 100, happiness: 100, hygiene: 5 }, sick: false });
useGameStore.getState().drainNeeds(1);
pass('sick flagged', useGameStore.getState().sick === true);
useGameStore.getState().curePet('starter');
pass('cure heals', useGameStore.getState().sick === false);
console.log(process.exitCode ? 'FAILED' : 'PASS');