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

useGameStore.setState({ needs: { hunger: 100, energy: 100, happiness: 100, hygiene: 100 } });
useGameStore.getState().drainNeeds(10);
const s = useGameStore.getState();
pass('hygiene drains from 100', s.needs.hygiene < 100 && s.needs.hygiene > 90);
pass('hygiene is a number', typeof s.needs.hygiene === 'number');
pass('NEED_DRAIN has hygiene', typeof NEED_DRAIN.hygiene === 'number');
pass('hunger baseline raised ~1.5x', NEED_DRAIN.hunger >= 0.6);
console.log(process.exitCode ? 'FAILED' : 'PASS');
