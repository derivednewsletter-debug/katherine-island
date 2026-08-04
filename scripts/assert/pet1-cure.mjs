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

useGameStore.setState({ inventory: { ...useGameStore.getState().inventory, medkit: 1, soap: 1 }, needs: { hunger: 10, energy: 50, happiness: 50, hygiene: 10 }, sick: true });
pass('curePet consumes medkit and heals', (() => {
  const ok = useGameStore.getState().curePet('starter');
  const s = useGameStore.getState();
  return ok && s.inventory.medkit === 0 && s.sick === false && s.needs.hunger >= 50 && s.needs.hygiene >= 50;
})());
useGameStore.setState({ inventory: { ...useGameStore.getState().inventory, soap: 1 }, needs: { hunger: 100, energy: 100, happiness: 100, hygiene: 10 }, sick: true });
pass('bathePet with soap restores hygiene', (() => {
  const ok = useGameStore.getState().bathePet('starter');
  const s = useGameStore.getState();
  return ok && s.inventory.soap === 0 && s.needs.hygiene >= 40 && s.sick === false;
})());
useGameStore.setState({ inventory: { ...useGameStore.getState().inventory, medkit: 0 }, needs: { hunger: 5, energy: 50, happiness: 50, hygiene: 50 }, sick: true });
pass('curePet fails with no medkit', useGameStore.getState().curePet('starter') === false);
console.log(process.exitCode ? 'FAILED' : 'PASS');