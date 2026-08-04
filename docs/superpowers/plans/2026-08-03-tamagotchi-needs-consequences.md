# Tamagotchi Pets — Plan 1: Needs & Consequences Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give pets a `hygiene` need, faster need decay, sickness (hunger/hygiene) that requires a cure, bathing (soap), and runaway on sustained happiness neglect — recoverable through a find-my-pet quest.

**Architecture:** Extend the existing Zustand store in place. Add `hygiene` to the `needs` object (starter + hatched pets), a `petStates.js` module that derives `healthy | sick | runaway` from needs and tracks a runaway grace window, and store actions (`addHygiene`, `curePet`, `rescuePet`) plus quest/metric plumbing for the rescue. `needs.js` drains hygiene; the state machine hooks into `drainNeeds` and the needs ticker.

**Tech Stack:** Zustand 5 store, existing `gameStore.js` / `needs.js` / `quests.js`, esbuild for the smoke-test harness, no new dependencies.

## Global Constraints

- No new npm dependencies (verify with `npm run build`).
- No code comments unless asked (project convention).
- Persist new fields; backfill defaults in `onRehydrateStorage`; clear in `resetGame`.
- `moodFromNeeds` remains the single mood authority; the new `sick` state is tracked on the pet, not conflated with mood.
- All quest progress goes through the existing `recordQuestProgress`/`advanceQuests` path.
- Runway grace uses **game-seconds** (off the shared `s.time` clock) so pause/time-scale and persistence stay consistent.

---

### Task 1: Add `hygiene` need + faster drain to the store

**Files:**
- Modify: `src/game/state/gameStore.js` — needs state, `drainNeeds`, `NEED_DRAIN`, reset, partialize, rehydrate backfill.
- Test: `scripts/assert/pet1-hygiene.mjs`

**Interfaces:**
- Consumes: existing `NEED_DRAIN` (line ~1167), `drainNeeds` (line ~288), `timeOfDay`.
- Produces: `needs.hygiene` (0–100) on starter + every hatched pet; `NEED_DRAIN.hygiene`; rebalanced `NEED_DRAIN.hunger/energy/happiness` (~1.5× today).

- [ ] **Step 1: Write the failing smoke test**

```js
// scripts/assert/pet1-hygiene.mjs
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const esbuild = require('esbuild');
const { build } = await esbuild.build({
  entryPoints: ['src/game/state/gameStore.js'],
  bundle: true,
  format: 'esm',
  platform: 'node',
  write: false,
});
const out = build.outputFiles[0].text;
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node scripts/assert/pet1-hygiene.mjs`
Expected: FAIL (`hygiene` undefined / `NEED_DRAIN.hygiene` undefined).

- [ ] **Step 3: Implement hygiene + faster drain**

In `src/game/state/gameStore.js`:

1. Add `hygiene: 100` to the initial `needs` (line ~82).
2. In `NEED_DRAIN` (line ~1167) raise baselines ~1.5× and add hygiene:

```js
export const NEED_DRAIN = {
  hunger: 0.68,
  energy: 0.45,
  happiness: 0.33,
  hygiene: 0.26,
};
```

3. In `drainNeeds`, add `hygiene` to **both** the sleeping starter branch (drains at 0.2× like hunger) and the awake starter branch (`NEED_DRAIN.hygiene * rate * gameDt`), and the same for every hatched pet (sleeping + awake). Mirror the existing `hunger` lines exactly, using `hygiene`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node scripts/assert/pet1-hygiene.mjs`
Expected: PASS (all `ok:` lines, exit 0).

- [ ] **Step 5: Reset + persistence**

In `resetGame`, set `needs: { hunger: 100, energy: 100, happiness: 100, hygiene: 100 }` (line ~867). In `onRehydrateStorage`, backfill missing `hygiene` for the starter and every pet after the pets map block:

```js
const starterNeeds = state.needs ?? { hunger: 100, energy: 100, happiness: 100, hygiene: 100 };
if (starterNeeds.hygiene === undefined) starterNeeds.hygiene = 100;
const pets = (state.pets ?? []).map((p) => {
  const needs = { ...(p.needs ?? {}), hygiene: p.needs?.hygiene ?? 100 };
  return p.home && p.home.row !== undefined ? { ...p, needs } : { ...p, needs, home: pickPetHome(p.species) };
});
```

(Adjust the existing map so both home backfill and hygiene backfill coexist.)

- [ ] **Step 6: Commit**

```bash
git add src/game/state/gameStore.js scripts/assert/pet1-hygiene.mjs
git commit -m "feat: add hygiene need with faster overall need drain"
```

---

### Task 2: Create `petStates.js` — sickness + runaway state machine

**Files:**
- Create: `src/game/state/petStates.js`
- Test: `scripts/assert/pet1-states.mjs`

**Interfaces:**
- Consumes: nothing from the store (pure module).
- Produces:
  - `SICK_HUNGER = 25`, `SICK_HYGIENE = 25`
  - `RUN_AWAY_HAPPINESS = 15`
  - `RUN_AWAY_GRACE_SECONDS = 900` (15 game-minutes)
  - `SICK_DRAIN_MULT = 1.6`
  - `isSick(needs)` → boolean (`needs.hunger < 25 || needs.hygiene < 25`)
  - `moodFromState(sick, runaway, isNight)` → `'sick' | 'fleeing' | null` (null = normal mood path)
  - `trackRunaway(pet, time)` → new pet object (or same ref) updating `lowHappySince`/`ranAway`

- [ ] **Step 1: Write the failing smoke test**

```js
// scripts/assert/pet1-states.mjs
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const esbuild = require('esbuild');
const { build } = await esbuild.build({
  entryPoints: ['src/game/state/petStates.js'],
  bundle: true,
  format: 'esm',
  platform: 'node',
  write: false,
});
const out = build.outputFiles[0].text;
const mod = await import('data:text/javascript,' + encodeURIComponent(out));
const pass = (name, cond) => { if (!cond) { console.error('FAIL: ' + name); process.exitCode = 1; } else console.log('ok: ' + name); };

const { isSick, trackRunaway, moodFromState, RUN_AWAY_GRACE_SECONDS, SICK_DRAIN_MULT } = mod;
pass('healthy not sick', !isSick({ hunger: 50, hygiene: 50 }));
pass('low hunger sick', isSick({ hunger: 10, hygiene: 50 }));
pass('low hygiene sick', isSick({ hunger: 50, hygiene: 10 }));
pass('sick drains faster mult', SICK_DRAIN_MULT >= 1.5);
pass('starts grace timer on low happiness', (() => {
  const out = trackRunaway({ lowHappySince: null }, 1000);
  return out.lowHappySince === 1000;
})());
pass('clears grace on happy pet', (() => {
  const out = trackRunaway({ lowHappySince: 500 }, 900);
  return out.lowHappySince === null;
})());
pass('runs away after grace', (() => {
  const out = trackRunaway({ lowHappySince: 100 }, 100 + RUN_AWAY_GRACE_SECONDS + 1);
  return out.ranAway === true;
})());
pass('mood sick flag', moodFromState(true, false) === 'sick');
pass('mood runaway flag', moodFromState(false, true) === 'fleeing');
console.log(process.exitCode ? 'FAILED' : 'PASS');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node scripts/assert/pet1-states.mjs`
Expected: FAIL (module/export not found).

- [ ] **Step 3: Implement the module**

```js
// src/game/state/petStates.js
export const SICK_HUNGER = 25;
export const SICK_HYGIENE = 25;
export const RUN_AWAY_HAPPINESS = 15;
export const RUN_AWAY_GRACE_SECONDS = 900;
export const SICK_DRAIN_MULT = 1.6;

export function isSick(needs) {
  const h = needs?.hunger ?? 100;
  const g = needs?.hygiene ?? 100;
  return h < SICK_HUNGER || g < SICK_HYGIENE;
}

export function moodFromState(sick, runaway, isNight = false) {
  if (runaway) return 'fleeing';
  if (sick) return 'sick';
  return null;
}

export function trackRunaway(pet, time) {
  const happiness = pet.needs?.happiness ?? 100;
  const low = happiness < RUN_AWAY_HAPPINESS;
  if (low && pet.lowHappySince == null) return { ...pet, lowHappySince: time };
  if (low && time - pet.lowHappySince >= RUN_AWAY_GRACE_SECONDS && !pet.ranAway) {
    return { ...pet, lowHappySince: pet.lowHappySince, ranAway: true };
  }
  if (!low && pet.lowHappySince != null) return { ...pet, lowHappySince: null };
  return pet;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node scripts/assert/pet1-states.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/game/state/petStates.js scripts/assert/pet1-states.mjs
git commit -m "feat: add pet state machine for sickness and runaway"
```

---

### Task 3: Wire the state machine into drainNeeds + needs ticker

**Files:**
- Modify: `src/game/state/gameStore.js` (drainNeeds), `src/game/state/needs.js` (care gate), `src/game/state/petStates.js` (no change).
- Test: `scripts/assert/pet1-hygiene.mjs` (extend) + new `scripts/assert/pet1-starter-sick.mjs`

**Interfaces:**
- Consumes: `isSick`, `trackRunaway`, `SICK_DRAIN_MULT` from petStates.
- Produces: `drainNeeds` sets `sick` flag on starter + pets; `needs.js` care gate refuses sick/runaway pets; runaway pets stop earning care.

- [ ] **Step 1: Extend drainNeeds**

In `gameStore.js`, import the petStates helpers at the top. In `drainNeeds`, compute `sick` for the starter via `isSick`, multiply its drain by `SICK_DRAIN_MULT` when sick, and set `needs` plus a `sick` field on the starter slice. Mirror for each hatched pet, and run `trackRunaway(pet, s.time)` on each pet (append to the pet update). Example shape for the starter return block:

```js
const sick = isSick(s.needs);
const starterNeeds = s.sleeping ? { ... } : { ... };
// ...multiply hunger/happiness/hygiene drains by (sick ? SICK_DRAIN_MULT : 1)
return { ...existingState, needs: starterNeeds, sick };
```

For pets: build `needs` exactly as today, then `const next = { ...p, needs, sick: isSick(p.needs) }; return trackRunaway(next, s.time);`.

- [ ] **Step 2: Care gate refuses sick/runaway pets**

In `needs.js`, import `isSick` from petStates and check before granting care points:

```js
if (store.sleeping) return;
const state = useGameStore.getState();
const { hunger, energy, happiness } = state.needs;
if (isSick(state.needs) || state.ranAway) return;
if (hunger > 70 && energy > 70 && happiness > 70) {
  useGameStore.getState().addCare(CARE_PER_GAME_SECOND * flush);
}
```

- [ ] **Step 3: Extend the hygiene smoke test to cover the sick flag**

Add to `pet1-hygiene.mjs`:

```js
useGameStore.setState({ needs: { hunger: 5, energy: 100, happiness: 100, hygiene: 5 }, sick: false });
useGameStore.getState().drainNeeds(10);
pass('starter marked sick on low hunger/hygiene', useGameStore.getState().sick === true);
```

- [ ] **Step 4: Run tests to verify**

Run: `node scripts/assert/pet1-hygiene.mjs && node scripts/assert/pet1-states.mjs`
Expected: PASS both.

- [ ] **Step 5: Commit**

```bash
git add src/game/state/gameStore.js src/game/state/needs.js scripts/assert/pet1-hygiene.mjs
git commit -m "feat: wire sickness and runaway tracking into need drain"
```

---

### Task 4: Store actions — addHygiene, bathe (soap), curePet (medkit)

**Files:**
- Modify: `src/game/state/gameStore.js`
- Test: `scripts/assert/pet1-cure.mjs`

**Interfaces:**
- Consumes: existing `boostNeed`, `feedPet` pattern, `FEED_BY_RESOURCE`.
- Produces:
  - `addHygiene(target, amount)` — boost hygiene for starter ('starter') or a pet id.
  - `curePet(target)` — consumes a `medkit` inventory item; sets hunger+hygiene to ≥50 and clears `sick`.
  - `bathePet(target)` — consumes a `soap` item; restores hygiene (+40) and clears hygiene-caused sickness.
  - `medkit`, `soap` added to the initial `inventory` (start with 0 each) + `resetGame`.

- [ ] **Step 1: Write the failing smoke test**

```js
// scripts/assert/pet1-cure.mjs
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const esbuild = require('esbuild');
const { build } = await esbuild.build({
  entryPoints: ['src/game/state/gameStore.js'],
  bundle: true,
  format: 'esm',
  platform: 'node',
  write: false,
});
const out = build.outputFiles[0].text;
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node scripts/assert/pet1-cure.mjs`
Expected: FAIL (`curePet`/`bathePet` not a function).

- [ ] **Step 3: Implement the actions**

In `gameStore.js`, add `medkit: 0, soap: 0` to the initial inventory object and to `resetGame`. Then add actions (place near `feedPet`):

```js
addHygiene: (target, amount) =>
  set((s) => {
    const apply = (needs) => ({ ...needs, hygiene: Math.min(100, (needs.hygiene ?? 100) + amount) });
    if (target === 'starter') return { needs: apply(s.needs) };
    return { pets: s.pets.map((p) => (p.id === target ? { ...p, needs: apply(p.needs) } : p)) };
  }),

curePet: (target) => {
  const s = get();
  if ((s.inventory.medkit ?? 0) < 1) return false;
  const heal = (needs) => ({
    ...needs,
    hunger: Math.max(50, needs.hunger ?? 100),
    hygiene: Math.max(50, needs.hygiene ?? 100),
  });
  if (target === 'starter') {
    set({ inventory: { ...s.inventory, medkit: s.inventory.medkit - 1 }, needs: heal(s.needs), sick: false });
    return true;
  }
  set({
    inventory: { ...s.inventory, medkit: s.inventory.medkit - 1 },
    pets: s.pets.map((p) => (p.id === target ? { ...p, needs: heal(p.needs), sick: false } : p)),
  });
  return true;
},

bathePet: (target) => {
  const s = get();
  if ((s.inventory.soap ?? 0) < 1) return false;
  const wash = (needs) => ({ ...needs, hygiene: Math.min(100, (needs.hygiene ?? 100) + 40) });
  if (target === 'starter') {
    set({ inventory: { ...s.inventory, soap: s.inventory.soap - 1 }, needs: wash(s.needs) });
    return true;
  }
  set({
    inventory: { ...s.inventory, soap: s.inventory.soap - 1 },
    pets: s.pets.map((p) => (p.id === target ? { ...p, needs: wash(p.needs) } : p)),
  });
  return true;
},
```

Note: `bathePet`/`curePet` only clear `sick` when the healed needs are back above the `isSick` thresholds — `drainNeeds` recomputes `sick` on the next tick anyway, so clearing it eagerly here is safe.

- [ ] **Step 4: Run test to verify it passes**

Run: `node scripts/assert/pet1-cure.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/game/state/gameStore.js scripts/assert/pet1-cure.mjs
git commit -m "feat: add bathing (soap) and medkit cure actions"
```

---

### Task 5: Shop items + inventory UI for soap & medkit

**Files:**
- Modify: `src/game/data/shop.js`, `src/game/data/resources.js`, `src/game/data/icons.js`, `src/game/ui/InventoryHud.jsx`, `src/game/state/gameStore.js` (partialize already covers `inventory`).
- Test: `scripts/assert/pet1-shop.mjs` (buyItem + affordability).

**Interfaces:**
- Consumes: existing `buyItem` with `kind: 'item'` path — **new kind**.
- Produces: `SHOP_ITEMS` entries `petcare:soap` (kind `item`, resource `soap`) and `petcare:medkit` (kind `item`, resource `medkit`); `RESOURCES.soap`/`RESOURCES.medkit` labels; icons `soap`, `medkit`; inventory HUD shows them.

- [ ] **Step 1: Write the failing smoke test**

```js
// scripts/assert/pet1-shop.mjs
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const esbuild = require('esbuild');
const { build } = await esbuild.build({
  entryPoints: ['src/game/state/gameStore.js'],
  bundle: true,
  format: 'esm',
  platform: 'node',
  write: false,
});
const out = build.outputFiles[0].text;
const { useGameStore } = await import('data:text/javascript,' + encodeURIComponent(out));
const pass = (name, cond) => { if (!cond) { console.error('FAIL: ' + name); process.exitCode = 1; } else console.log('ok: ' + name); };

const st = useGameStore.getState();
st.setState({ currency: 100, inventory: { ...st.inventory, shell: 20 } });
pass('soap is buyable', (() => {
  st.buyItem('petcare:soap');
  return useGameStore.getState().inventory.soap >= 1;
})());
pass('medkit is buyable', (() => {
  st.buyItem('petcare:medkit');
  return useGameStore.getState().inventory.medkit >= 1;
})());
pass('cant afford soap returns false', (() => {
  useGameStore.setState({ currency: 0, inventory: { ...useGameStore.getState().inventory, shell: 0 } });
  return useGameStore.getState().buyItem('petcare:soap') === useGameStore.getState();
})());
console.log(process.exitCode ? 'FAILED' : 'PASS');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node scripts/assert/pet1-shop.mjs`
Expected: FAIL (soap stays 0).

- [ ] **Step 3: Implement shop items + buyItem kind**

In `shop.js`, after the tools block:

```js
{
  id: 'petcare:soap',
  kind: 'item',
  resource: 'soap',
  name: 'Soap',
  emoji: '🧼',
  desc: 'Bathe a pet to restore its hygiene.',
  price: { shell: 4 },
  count: 1,
},
{
  id: 'petcare:medkit',
  kind: 'item',
  resource: 'medkit',
  name: 'Medkit',
  emoji: '💊',
  desc: 'Heals a sick pet — restores hunger and hygiene.',
  price: { shell: 6, herb: 2 },
  count: 1,
},
```

In `buyItem`, add an `item` kind handler before the default upgrade fallback:

```js
if (item.kind === 'item') {
  return {
    inventory: { ...newInv, [item.resource]: (newInv[item.resource] ?? 0) + (item.count ?? 1) },
    currency: newCurrency,
  };
}
```

In `resources.js`, add `soap` and `medkit` entries (so the inventory HUD can render them):

```js
soap: { label: 'Soap', color: '#c9a9ff' },
medkit: { label: 'Medkit', color: '#ff7b7b' },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node scripts/assert/pet1-shop.mjs`
Expected: PASS.

- [ ] **Step 5: Add icons + inventory chip**

In `icons.js`, add `soap` and `medkit` SVGs (simple shapes in the existing style). In `InventoryHud.jsx`, ensure the `ICON_MAP`/`RESOURCE_ICON_MAP` covers `soap`/`medkit` (they render via `RESOURCES` label + icon; add entries if that file has an explicit map). Keep it minimal — the inventory panel already lists all `inventory` keys.

- [ ] **Step 6: Commit**

```bash
git add src/game/data/shop.js src/game/data/resources.js src/game/data/icons.js src/game/ui/InventoryHud.jsx scripts/assert/pet1-shop.mjs
git commit -m "feat: sell soap and medkit at the shop"
```

---

### Task 6: In-world pet care — soap/medkit click actions

**Files:**
- Modify: `src/game/components/Creature.jsx`, `src/game/components/Pet.jsx`
- Test: `npm run build` + manual dev-server smoke (no logic test needed — click plumbing).

**Interfaces:**
- Consumes: `bathePet`, `curePet`, `selectedPetId`, `holding` (`'soap'` | `'medkit'`).
- Produces: clicking a pet while holding soap → bubble "fresh + clean! ✨"; holding medkit → bubble "all better! 💗"; both burst hearts.

- [ ] **Step 1: Extend `handlePet` in both components**

In `Creature.jsx` `handlePet` and `Pet.jsx` `handlePet`, after the existing feeding branch, add:

```js
if (st.holding === 'soap') {
  const ok = st.bathePet(targetId);
  setBubble(ok ? 'fresh + clean! ✨' : 'need soap…');
  if (ok) burstHearts();
  bubbleTimer.current = 1.5;
  return;
}
if (st.holding === 'medkit') {
  const ok = st.curePet(targetId);
  setBubble(ok ? 'all better! 💗' : 'need a medkit…');
  if (ok) burstHearts();
  bubbleTimer.current = 1.5;
  return;
}
```

(`targetId` is `'starter'` in Creature, `petId` in Pet.)

- [ ] **Step 2: Build to verify**

Run: `npm run build`
Expected: build succeeds (no import errors).

- [ ] **Step 3: Manual dev-server smoke**

Run: `npm run dev`, open the game, buy soap, select a pet, click it with soap held → hygiene rises + hearts. Repeat with medkit on a sick pet.
Expected: bars update, hearts burst, no console errors.

- [ ] **Step 4: Commit**

```bash
git add src/game/components/Creature.jsx src/game/components/Pet.jsx
git commit -m "feat: click pets with soap/medkit to bathe or cure"
```

---

### Task 7: Runaway → rescue quest + HUD surfacing

**Files:**
- Modify: `src/game/data/quests.js` (new `pet:rescue` quest family), `src/game/state/gameStore.js` (`rescuePet`, runaway lifecycle hooks), `src/game/ui/NeedsHud.jsx`, `src/game/ui/QuestBoard.jsx`, `src/game/components/Pet.jsx` (fleeing mood + rescue click).
- Test: `scripts/assert/pet1-rescue.mjs`

**Interfaces:**
- Consumes: `trackRunaway` (sets `ranAway`), `recordQuestProgress`, `advanceQuests`, `questById`.
- Produces:
  - Quest id `pet:rescue` — progress advances by rescuing any runaway pet (metric `pet:rescue`, target = number of pets that ran away… simplified: target 1, reward `{ coin: 8 }`, repeatable).
  - `rescuePet(id)` — clears `ranAway`, restores happiness to 80, grants the rescue quest progress, shows a toast.
  - `NeedsHud` shows a "Find" banner when any pet is runaway; `Pet.jsx` renders a fleeing (💨) emoji and clicking rescues.

- [ ] **Step 1: Write the failing smoke test**

```js
// scripts/assert/pet1-rescue.mjs
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const esbuild = require('esbuild');
const { build } = await esbuild.build({
  entryPoints: ['src/game/state/gameStore.js'],
  bundle: true,
  format: 'esm',
  platform: 'node',
  write: false,
});
const out = build.outputFiles[0].text;
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node scripts/assert/pet1-rescue.mjs`
Expected: FAIL (`rescuePet` not a function / quest missing).

- [ ] **Step 3: Add the quest definition**

In `quests.js`, add to `QUESTS`:

```js
{
  id: 'pet:rescue',
  emoji: '🐾',
  title: 'Find My Pet',
  desc: 'Rescue a runaway pet',
  metric: 'pet:rescue',
  target: 1,
  reward: { coin: 8 },
},
```

- [ ] **Step 4: Add `rescuePet` action**

In `gameStore.js`, near `petPet`:

```js
rescuePet: (id) =>
  set((s) => {
    const pet = s.pets.find((p) => p.id === id);
    if (!pet || !pet.ranAway) return s;
    return {
      pets: s.pets.map((p) =>
        p.id === id
          ? { ...p, ranAway: false, lowHappySince: null, needs: { ...p.needs, happiness: 80 } }
          : p
      ),
      quests: advanceQuests(s.quests, 'pet:rescue', 1),
      toast: { id: (s.toast?.id ?? 0) + 1, text: `🐾 You found ${pet.name}! They're home safe.` },
    };
  }),
```

- [ ] **Step 5: NeedsHud banner + Pet fleeing render + rescue click**

In `NeedsHud.jsx`, compute `runawayCount` (pets with `ranAway`) and render a banner button near the top when > 0: "🐾 Find {count} runaway pet(s)" — clicking selects the first runaway pet. In `Pet.jsx`, when the pet's `ranAway` is true, show a "💨" emoji over the name and, in `handlePet`, if `ranAway`, call `rescuePet(petId)` and show "home! 💗". Also render the fleeing mood via `moodFromState` (import from petStates) instead of the normal mood when fleeing.

- [ ] **Step 6: Run test to verify it passes**

Run: `node scripts/assert/pet1-rescue.mjs`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/game/data/quests.js src/game/state/gameStore.js src/game/ui/NeedsHud.jsx src/game/ui/QuestBoard.jsx src/game/components/Pet.jsx scripts/assert/pet1-rescue.mjs
git commit -m "feat: runaway pets trigger a find-my-pet rescue quest"
```

---

### Task 8: NeedsHud hygiene bar + sick indicator

**Files:**
- Modify: `src/game/ui/NeedsHud.jsx`, `src/game/state/gameStore.js` (export nothing new — reads exist), `src/game/data/icons.js` (sick icon).
- Test: `npm run build` + dev-server smoke.

**Interfaces:**
- Consumes: `needs.hygiene`, `sick` (starter) / `p.sick` (pets), `moodFromState`.
- Produces: 4 bars in the HUD (hunger/energy/happiness/hygiene); a "🤒 Sick" pill replacing the mood when sick.

- [ ] **Step 1: Add the hygiene bar + sick pill**

In `NeedsHud.jsx`:
1. Add `hygiene` to `BARS` (`{ key: 'hygiene', label: 'Hygiene', color: '#a3c4ff' }`) and `NEED_ICONS.hygiene` → a droplet icon.
2. Add selectors for `sick` (starter) and the selected pet's `sick`.
3. When `sick`, show `🤒 Sick` instead of the mood label, and add a red pulsing border on the panel.

- [ ] **Step 2: Add a `sick` icon**

In `icons.js`, add a `sick` icon (e.g. a face with a thermometer) and map `MOOD_ICONS.sick = 'sick'` in `NeedsHud.jsx`.

- [ ] **Step 3: Build + manual smoke**

Run: `npm run build`; then dev-server: starve a pet → HUD shows red hygiene/hunger bars, mood flips to Sick.
Expected: 4 bars render; sick state visible.

- [ ] **Step 4: Commit**

```bash
git add src/game/ui/NeedsHud.jsx src/game/data/icons.js
git commit -m "feat: show hygiene bar and sick indicator in pet HUD"
```

---

### Task 9: Full-harness verification + fix stray persistence gaps

**Files:**
- Modify: `src/game/state/gameStore.js` (partialize/reset if anything new leaked), `scripts/assert/pet1-full.mjs`.

**Interfaces:**
- Consumes: everything above.
- Produces: a final smoke test covering hygiene drain, sickness, cure, runaway, rescue, persistence backfill round-trip.

- [ ] **Step 1: Write the full smoke test**

```js
// scripts/assert/pet1-full.mjs
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const esbuild = require('esbuild');
const { build } = await esbuild.build({
  entryPoints: ['src/game/state/gameStore.js'],
  bundle: true,
  format: 'esm',
  platform: 'node',
  write: false,
});
const out = build.outputFiles[0].text;
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
```

- [ ] **Step 2: Run the full harness**

Run: `node scripts/assert/pet1-full.mjs && npm run build`
Expected: PASS + clean build.

- [ ] **Step 3: Fix persistence gaps**

Verify `hygiene` and `sick` (and any `lowHappySince`/`ranAway` on pets) survive a save round-trip: add to `partialize` anything in `s.needs` (already whole-object persisted) and ensure pets objects persist wholesale (they already do). Ensure `resetGame` returns `hygiene: 100`, `sick: false`, pets cleared, and new inventory keys zeroed.

- [ ] **Step 4: Commit**

```bash
git add src/game/state/gameStore.js scripts/assert/pet1-full.mjs
git commit -m "test: verify tamagotchi needs/consequences end-to-end"
```
