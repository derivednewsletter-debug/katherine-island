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

const { isSick, trackRunaway, moodFromState, RUN_AWAY_GRACE_SECONDS, SICK_DRAIN_MULT } = mod;
pass('healthy not sick', !isSick({ hunger: 50, hygiene: 50 }));
pass('low hunger sick', isSick({ hunger: 10, hygiene: 50 }));
pass('low hygiene sick', isSick({ hunger: 50, hygiene: 10 }));
pass('sick drains faster mult', SICK_DRAIN_MULT >= 1.5);
pass('starts grace timer on low happiness', (() => {
  const out = trackRunaway({ lowHappySince: null, needs: { happiness: 5 } }, 1000);
  return out.lowHappySince === 1000;
})());
pass('clears grace on happy pet', (() => {
  const out = trackRunaway({ lowHappySince: 500, needs: { happiness: 90 } }, 900);
  return out.lowHappySince === null;
})());
pass('runs away after grace', (() => {
  const out = trackRunaway({ lowHappySince: 100, needs: { happiness: 5 } }, 100 + RUN_AWAY_GRACE_SECONDS + 1);
  return out.ranAway === true;
})());
pass('mood sick flag', moodFromState(true, false) === 'sick');
pass('mood runaway flag', moodFromState(false, true) === 'fleeing');
console.log(process.exitCode ? 'FAILED' : 'PASS');
