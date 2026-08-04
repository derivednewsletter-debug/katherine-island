# Tamagotchi Pets — Plan 3: Cooking & Appliances Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the player place a **Stove** and a **Grill** (new build kinds unlocked at the shop), craft cooked meals at them, and feed those meals to pets. Cooked meals extend the feeding economy with stronger, targeted need effects (stew = hunger + hygiene, grilled = hunger + energy).

**Architecture:** Add `stove` and `grill` as new decoration kinds (reuse the existing build/place/erase pipeline via `DECORATION_TYPES`, `KIND_COMPONENT`, `PARTS`). Add a small `recipes.js` data module mapping each appliance to its recipes and inputs; add store actions `craftMeal(appliance, recipeId)` and `useAppliance(id)` (click an appliance to cook with it), new inventory resources `stew`/`grilled`, and extend `FEED_BY_RESOURCE`. A DOM panel (like the Farm HUD) lists recipes for the active appliance.

**Tech Stack:** Zustand 5 store, three.js low-poly meshes, existing decoration placement + shop unlock machinery, esbuild smoke tests, no new deps.

## Global Constraints

- No new npm dependencies (verify with `npm run build`).
- No code comments unless asked (project convention).
- Appliances are placed like decorations (same `decorations` array), persist automatically, and are erased like any prop.
- Recipes consume inventory resources and produce `stew`/`grilled` inventory resources; new resources need `RESOURCES` labels + icons.
- `FEED_BY_RESOURCE` gains `stew` and `grilled` entries so the existing feed pipeline just works.
- Shop unlocks: `unlock:stove` / `unlock:grill` (kind `decoration`, adds to build palette like fountain/lantern).

---

### Task 1: Add `stove` + `grill` decoration kinds

**Files:**
- Modify: `src/game/data/decorations.js` (`DECORATION_TYPES`), `src/game/components/Decorations.jsx` (`Stove`/`Grill` components + `PARTS` + `KIND_COMPONENT`), `src/game/ui/PlacementHud.jsx` (icons).
- Test: `npm run build` + dev-server smoke (place + erase stove/grill).

**Interfaces:**
- Consumes: existing `DECORATION_TYPES`, `KIND_COMPONENT`, `PARTS`, placement tool plumbing (`togglePlacement`, `placeDecoration`), `BASE_KINDS`/unlock list.
- Produces: `DECORATION_TYPES.stove`/`.grill`; `Stove`/`Grill` React components; instanced `PARTS` entries; palette icons (`stove`/`grill` in `icons.js` + `ICON_FOR_TOOL`).

- [ ] **Step 1: Add the decoration types**

In `decorations.js`, add to `DECORATION_TYPES`:

```js
stove: { label: 'Stove', color: '#f0b27a' },
grill: { label: 'Grill', color: '#5d6d7e' },
```

- [ ] **Step 2: Add the components**

In `Decorations.jsx`, add `Stove` (a box body + stovetop + a small pot) and `Grill` (a short drum + grate + embers) following the `mat(tint, color)` toon pattern, then register both in `KIND_COMPONENT` and add matching `PARTS` instanced entries (so placed stoves/grills render efficiently). Keep geometry low-poly and colors in the existing palette.

- [ ] **Step 3: Palette icons**

In `icons.js`, add `stove` and `grill` SVGs. In `PlacementHud.jsx`, add `stove: 'stove'` and `grill: 'grill'` to `ICON_FOR_TOOL`.

- [ ] **Step 4: Shop unlocks**

In `shop.js`, add two decoration items:

```js
{
  id: 'stove',
  kind: 'decoration',
  name: 'Stove',
  emoji: '🍲',
  desc: 'Unlocks the stove in your build palette — cook stews!',
  price: { wood: 6, stone: 4 },
},
{
  id: 'grill',
  kind: 'decoration',
  name: 'Grill',
  emoji: '🍖',
  desc: 'Unlocks the grill in your build palette — cook grilled meals!',
  price: { wood: 8, stone: 6 },
},
```

(`buyItem` already handles `kind: 'decoration'` → `unlockedDecorations`.)

- [ ] **Step 5: Build + manual smoke**

Run: `npm run build`; dev-server: buy both, place them, erase them.
Expected: props render, ghost green on valid tiles, eraser removes them.

- [ ] **Step 6: Commit**

```bash
git add src/game/data/decorations.js src/game/components/Decorations.jsx src/game/ui/PlacementHud.jsx src/game/data/icons.js src/game/data/shop.js
git commit -m "feat: stove and grill build kinds unlocked at the shop"
```

---

### Task 2: Recipe data module

**Files:**
- Create: `src/game/data/recipes.js`
- Test: `scripts/assert/pet3-recipes.mjs`

**Interfaces:**
- Consumes: nothing (pure data).
- Produces:
  - `RECIPES = { stove: [ {id, name, emoji, inputs: {berry: 2, herb: 1}, output: {stew: 1} }], grill: [ {id, name, emoji, inputs: {fruit: 1, wood: 1}, output: {grilled: 1}} ] }`
  - `recipeById(id)` → recipe or null.
  - `RECIPE_COST` (fuel per craft): `{ stove: 1, grill: 1 }` of `wood` (stove) / `wood` (grill) — one fuel per cook.
  - `canCraft(inventory, recipeId)` → boolean (has all inputs + fuel).

- [ ] **Step 1: Write the failing smoke test**

```js
// scripts/assert/pet3-recipes.mjs
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
const pass = (name, cond) => { if (!cond) { console.error('FAIL: ' + name); process.exitCode = 1; } else console.log('ok: ' + name); };

const { RECIPES, recipeById, canCraft } = mod;
pass('stove has a stew recipe', RECIPES.stove.some((r) => r.id === 'stew'));
pass('grill has a grilled recipe', RECIPES.grill.some((r) => r.id === 'grilled'));
pass('stew output resource', recipeById('stew').output.stew === 1);
pass('can craft with enough inputs', canCraft({ berry: 2, herb: 1, wood: 2 }, 'stew') === true);
pass('cannot craft without inputs', canCraft({ berry: 1, herb: 1, wood: 2 }, 'stew') === false);
pass('cannot craft without fuel', canCraft({ berry: 2, herb: 1, wood: 0 }, 'stew') === false);
console.log(process.exitCode ? 'FAILED' : 'PASS');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node scripts/assert/pet3-recipes.mjs`
Expected: FAIL (`RECIPES` undefined).

- [ ] **Step 3: Implement `recipes.js`**

```js
export const RECIPE_COST = { stove: { wood: 1 }, grill: { wood: 1 } };

export const RECIPES = {
  stove: [
    {
      id: 'stew',
      name: 'Hearty Stew',
      emoji: '🍲',
      appliance: 'stove',
      inputs: { berry: 2, herb: 1 },
      output: { stew: 1 },
    },
  ],
  grill: [
    {
      id: 'grilled',
      name: 'Grilled Fruit',
      emoji: '🍖',
      appliance: 'grill',
      inputs: { fruit: 1, berry: 1 },
      output: { grilled: 1 },
    },
  ],
};

export function recipeById(id) {
  for (const list of Object.values(RECIPES)) {
    const r = list.find((x) => x.id === id);
    if (r) return r;
  }
  return null;
}

export function canCraft(inventory, recipeId) {
  const recipe = recipeById(recipeId);
  if (!recipe) return false;
  const fuel = RECIPE_COST[recipe.appliance] ?? {};
  for (const [res, amount] of Object.entries(fuel)) {
    if ((inventory[res] ?? 0) < amount) return false;
  }
  for (const [res, amount] of Object.entries(recipe.inputs)) {
    if ((inventory[res] ?? 0) < amount) return false;
  }
  return true;
}
```

Note: each recipe carries an explicit `appliance` field so a single appliance can host multiple recipes without ambiguous id-derivation.

- [ ] **Step 4: Run test to verify it passes**

Run: `node scripts/assert/pet3-recipes.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/game/data/recipes.js scripts/assert/pet3-recipes.mjs
git commit -m "feat: cooking recipe catalog"
```

---

### Task 3: Store — new resources + `craftMeal` + `useAppliance`

**Files:**
- Modify: `src/game/state/gameStore.js`, `src/game/data/resources.js`, `src/game/data/icons.js`.
- Test: `scripts/assert/pet3-craft.mjs`

**Interfaces:**
- Consumes: `RECIPES`, `canCraft`, `recipeById`, `deductPrice`-style inventory math (inline), `uid`.
- Produces:
  - New resources `stew`/`grilled` in inventory (start 0; add to `resetGame`).
  - `activeAppliance` state: `{ id, row, col, kind } | null` + `setActiveAppliance(a)`.
  - `craftMeal(recipeId)` — validates `activeAppliance`, `canCraft`; subtracts fuel + inputs; adds output; toasts; returns bool.
  - `FEED_BY_RESOURCE` gains `stew: { hunger: 34, hygiene: 20, happiness: 10 }` and `grilled: { hunger: 30, energy: 22, happiness: 8 }`.
  - `feedPet` already reads `FEED_BY_RESOURCE` + `holding`; the `apply` helper in `feedPet` must also carry `hygiene` through (it currently maps only hunger/energy/happiness).

- [ ] **Step 1: Write the failing smoke test**

```js
// scripts/assert/pet3-craft.mjs
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

useGameStore.setState({ inventory: { ...useGameStore.getState().inventory, berry: 2, herb: 1, wood: 2 }, activeAppliance: { id: 's1', row: 5, col: 5, kind: 'stove' } });
pass('craftMeal stew succeeds', (() => {
  const ok = useGameStore.getState().craftMeal('stew');
  const s = useGameStore.getState();
  return ok && s.inventory.stew === 1 && s.inventory.berry === 0;
})());
pass('craftMeal fails without fuel', (() => {
  useGameStore.setState({ inventory: { ...useGameStore.getState().inventory, berry: 2, herb: 1, wood: 0 } });
  return useGameStore.getState().craftMeal('stew') === false;
})());
pass('grilled meal feedable with hygiene carry-through', (() => {
  useGameStore.setState({ inventory: { ...useGameStore.getState().inventory, grilled: 1, herb: 0 }, needs: { hunger: 50, energy: 50, happiness: 50, hygiene: 40 }, holding: 'grilled' });
  useGameStore.getState().feedPet('starter');
  const s = useGameStore.getState();
  return s.needs.hunger > 50 && s.needs.energy > 50 && s.needs.hygiene === 40;
})());
console.log(process.exitCode ? 'FAILED' : 'PASS');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node scripts/assert/pet3-craft.mjs`
Expected: FAIL (`craftMeal` missing / `stew` unknown).

- [ ] **Step 3: Implement**

1. In `resources.js`, add:

```js
stew: { label: 'Stew', color: '#f0b27a' },
grilled: { label: 'Grilled', color: '#c98a4b' },
```

2. In `gameStore.js`:
   - Initial inventory: `stew: 0, grilled: 0`; same in `resetGame`.
   - State: `activeAppliance: null`.
   - Actions:

```js
setActiveAppliance: (a) => set({ activeAppliance: a }),

craftMeal: (recipeId) => {
  const s = get();
  const app = s.activeAppliance;
  if (!app) return false;
  const recipe = recipeById(recipeId);
  if (!recipe || !canCraft(s.inventory, recipeId)) return false;
  const applianceKind = recipe.appliance;
  if (app.kind !== applianceKind) return false;
  const fuel = RECIPE_COST[applianceKind] ?? {};
  const next = { ...s.inventory };
  for (const [res, amount] of Object.entries(fuel)) next[res] = (next[res] ?? 0) - amount;
  for (const [res, amount] of Object.entries(recipe.inputs)) next[res] = (next[res] ?? 0) - amount;
  for (const [res, amount] of Object.entries(recipe.output)) next[res] = (next[res] ?? 0) + amount;
  set({ inventory: next });
  s.showToast(`${recipe.emoji} Cooked ${recipe.name}!`);
  return true;
},
```

   - `FEED_BY_RESOURCE` gains the stew/grilled entries; update `feedPet`'s `apply` helper to preserve hygiene:

```js
const apply = (needs) => ({
  hunger: Math.min(100, (needs.hunger ?? 100) + (fx.hunger ?? 0)),
  energy: Math.min(100, (needs.energy ?? 100) + (fx.energy ?? 0)),
  happiness: Math.min(100, (needs.happiness ?? 100) + (fx.happiness ?? 0)),
  hygiene: Math.min(100, (needs.hygiene ?? 100) + (fx.hygiene ?? 0)),
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node scripts/assert/pet3-craft.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/game/state/gameStore.js src/game/data/resources.js src/game/data/icons.js scripts/assert/pet3-craft.mjs
git commit -m "feat: craft cooked meals and feed them to pets"
```

---

### Task 4: Appliance interaction + cooking panel UI

**Files:**
- Modify: `src/game/components/Decorations.jsx` (`Stove`/`Grill` onClick), `src/game/ui/KitchenHud.jsx` (new), `src/game/components/GameScene.jsx` (mount), `src/game/ui/InventoryHud.jsx` (icons).
- Test: `npm run build` + dev-server smoke (click stove → panel → craft).

**Interfaces:**
- Consumes: `setActiveAppliance`, `activeAppliance`, `craftMeal`, `canCraft`, `RECIPES`.
- Produces: clicking a stove/grill sets `activeAppliance`; `KitchenHud` renders the active appliance's recipes with enabled/disabled craft buttons; Esc closes.

- [ ] **Step 1: Appliance click**

In `Decorations.jsx`, give `Stove`/`Grill` a click handler that stops propagation and calls `setActiveAppliance({ id: deco.id, row: deco.row, col: deco.col, kind: 'stove' | 'grill' })`. The `Decorations` component renders instanced props (no per-item events), so instead attach a small non-instanced interaction: keep the `InstancedField` for visuals, but render one invisible clickable hotspot per placed stove/grill (read from `decorations` filtered by kind) that handles `onClick`.

- [ ] **Step 2: KitchenHud**

Create `src/game/ui/KitchenHud.jsx` mirroring `FarmHud.jsx`'s style: when `activeAppliance` is set, show a glass panel listing `RECIPES[appliance.kind]` with each recipe's emoji, name, inputs, and a Craft button (disabled via `canCraft`). Clicking Craft calls `craftMeal(recipe.id)`. Include a close (×) button that calls `setActiveAppliance(null)`; Esc also closes. Mount it in `GameScene.jsx` alongside the other HUD panels.

- [ ] **Step 3: Build + manual smoke**

Run: `npm run build`; dev-server: place stove, click it, cook stew, feed it to a pet.
Expected: panel opens, craft button toggles with inventory, stew appears in inventory, feeding a pet restores hunger+hygiene.

- [ ] **Step 4: Commit**

```bash
git add src/game/components/Decorations.jsx src/game/ui/KitchenHud.jsx src/game/components/GameScene.jsx src/game/ui/InventoryHud.jsx
git commit -m "feat: cooking panel for stove and grill"
```

---

### Task 5: Full-harness verification

**Files:**
- Modify: `scripts/assert/pet3-full.mjs`.

**Interfaces:**
- Consumes: everything above.

- [ ] **Step 1: Write the full smoke test**

```js
// scripts/assert/pet3-full.mjs
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
const { useGameStore, FEED_BY_RESOURCE } = await import('data:text/javascript,' + encodeURIComponent(out));
const pass = (name, cond) => { if (!cond) { console.error('FAIL: ' + name); process.exitCode = 1; } else console.log('ok: ' + name); };

pass('stew in feed table', FEED_BY_RESOURCE.stew?.hunger >= 30 && FEED_BY_RESOURCE.stew?.hygiene >= 15);
pass('grilled in feed table', FEED_BY_RESOURCE.grilled?.energy >= 20);
useGameStore.setState({ inventory: { ...useGameStore.getState().inventory, berry: 2, herb: 1, wood: 1 }, activeAppliance: { id: 's1', row: 5, col: 5, kind: 'stove' } });
pass('full cook flow', (() => {
  const ok = useGameStore.getState().craftMeal('stew');
  return ok && useGameStore.getState().inventory.stew === 1;
})());
console.log(process.exitCode ? 'FAILED' : 'PASS');
```

- [ ] **Step 2: Run the full harness**

Run: `node scripts/assert/pet3-full.mjs && npm run build`
Expected: PASS + clean build.

- [ ] **Step 3: Persistence**

Confirm `stew`/`grilled`/`activeAppliance` round-trip: `inventory` is whole-object persisted (already in partialize); `activeAppliance` should be transient (like `shopOpen`) and NOT persisted — add nothing to partialize, and clear it on `resetGame`.

- [ ] **Step 4: Commit**

```bash
git add scripts/assert/pet3-full.mjs src/game/state/gameStore.js
git commit -m "test: verify cooking and appliance flow end-to-end"
```
