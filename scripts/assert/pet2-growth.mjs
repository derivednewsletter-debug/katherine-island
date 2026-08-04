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
const { useGameStore, GROWTH, growthInfo } = await import('data:text/javascript,' + encodeURIComponent(out));
const pass = (name, cond) => { if (!cond) { console.error('FAIL: ' + name); process.exitCode = 1; } else console.log('ok: ' + name); };

pass('four stages', Object.keys(GROWTH).length === 4);
pass('baby next child', GROWTH.baby.next?.id === 'child');
pass('child next adult', GROWTH.child.next?.id === 'adult');
pass('adult next elder', GROWTH.adult.next?.id === 'elder');
pass('elder is terminal', GROWTH.elder.next === null);
pass('growthInfo child label', growthInfo('child', 0)?.label === 'Child');
pass('addCare crosses baby->child', (() => {
  useGameStore.setState({ stage: 'baby', carePoints: 0 });
  useGameStore.getState().addCare(10);
  return useGameStore.getState().stage === 'child';
})());
console.log(process.exitCode ? 'FAILED' : 'PASS');