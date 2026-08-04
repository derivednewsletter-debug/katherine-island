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

const st = useGameStore.getState();
useGameStore.setState({ currency: 100, inventory: { ...st.inventory, shell: 20, herb: 5 } });
pass('soap is buyable', (() => {
  useGameStore.getState().buyItem('petcare:soap');
  return useGameStore.getState().inventory.soap >= 1;
})());
pass('medkit is buyable', (() => {
  useGameStore.getState().buyItem('petcare:medkit');
  return useGameStore.getState().inventory.medkit >= 1;
})());
pass('cant afford soap returns state', (() => {
  useGameStore.setState({ currency: 0, inventory: { ...useGameStore.getState().inventory, shell: 0 } });
  const beforeSoap = useGameStore.getState().inventory.soap;
  useGameStore.getState().buyItem('petcare:soap');
  return useGameStore.getState().inventory.soap === beforeSoap;
})());
console.log(process.exitCode ? 'FAILED' : 'PASS');