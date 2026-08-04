import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const esbuild = require('esbuild');
const result = await esbuild.build({
  entryPoints: ['src/game/state/petStates.js'],
  bundle: true,
  format: 'esm',
  platform: 'node',
  write: false,
});
const out = result.outputFiles[0].text;
const mod = await import('data:text/javascript,' + encodeURIComponent(out));
const pass = (name, cond) => { if (!cond) { console.error('FAIL: ' + name); process.exitCode = 1; } else console.log('ok: ' + name); };

const { trackAging, ELDER_LIFESPAN_DAYS } = mod;
pass('age increments per day', trackAging({ ageDays: 0 }, 5)?.ageDays === 5);
pass('adult not deceased', trackAging({ stage: 'adult', ageDays: 0 }, 30)?.deceased === false);
pass('elder lives until lifespan', trackAging({ stage: 'elder', elderSince: 1, ageDays: 0 }, 1 + ELDER_LIFESPAN_DAYS)?.deceased === true);
pass('young elder not yet deceased', trackAging({ stage: 'elder', elderSince: 1, ageDays: 0 }, 5)?.deceased === false);
console.log(process.exitCode ? 'FAILED' : 'PASS');