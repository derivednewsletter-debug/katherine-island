import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const esbuild = require('esbuild');
const result = await esbuild.build({
  entryPoints: ['src/game/data/recipes.js'],
  bundle: true,
  format: 'esm',
  platform: 'node',
  write: false,
});
const out = result.outputFiles[0].text;
const mod = await import('data:text/javascript,' + encodeURIComponent(out));
const pass = (name, cond) => {
  if (!cond) {
    console.error('FAIL: ' + name);
    process.exitCode = 1;
  } else console.log('ok: ' + name);
};

pass('stove has a stew recipe', mod.RECIPES.stove.some((r) => r.id === 'stew'));
pass('grill has a grilled recipe', mod.RECIPES.grill.some((r) => r.id === 'grilled'));
pass('stew output resource', mod.recipeById('stew').output.stew === 1);
pass('can craft with enough inputs', mod.canCraft({ berry: 2, herb: 1, wood: 1 }, 'stew'));
pass('cannot craft without inputs', !mod.canCraft({ berry: 1, herb: 1, wood: 1 }, 'stew'));
pass('cannot craft without fuel', !mod.canCraft({ berry: 2, herb: 1, wood: 0 }, 'stew'));
console.log(process.exitCode ? 'FAILED' : 'PASS');
