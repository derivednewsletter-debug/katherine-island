# Tamagotchi Pets — Plan 2: Lifecycle & Death Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand pet growth from `baby → adult` to a full 4-stage lifecycle `baby → child → adult → elder`, then a natural elder death that leaves a memorial prop and grants a fresh egg so the care loop can restart.

**Architecture:** Extend the existing `GROWTH` chain in `gameStore.js` and the per-stage visuals (`STAGE_STYLE` in `Creature.jsx`, per-species stages for hatched pets in `Pet.jsx`/`petParts.js`). Track `ageDays` (days since hatching) and an `elderSince` timestamp; after `elder` + `ELDER_LIFESPAN_DAYS`, mark `deceased` and spawn a memorial decoration at the pet's home anchor + a fresh egg into `ownedEggs`. Hatch-time `home` anchors feed the memorial placement. Backfill `ageDays`/`elderSince` in rehydrate; clear in reset.

**Tech Stack:** Zustand 5 store, three.js low-poly meshes, esbuild smoke tests, no new deps.

## Global Constraints

- No new npm dependencies (verify with `npm run build`).
- No code comments unless asked (project convention).
- `GROWTH` stages keep the existing shape `{ label, emoji, next: { id, required } }` — `growthInfo` must keep working unchanged.
- Elder lifespan is measured in **game-days** (from `timeOfDay(s.time).day`), so it respects pause/time-scale and persists.
- Death is final for that pet: it moves from `pets[]` to a `memorials[]` list; `ownedEggs` gains a fresh egg of the same species.
- New persisted fields: per-pet `stage`, `carePoints`, `ageDays`, `elderSince`, `deceased`; top-level `memorials`.

---

### Task 1: Extend `GROWTH` to four stages

**Files:**
- Modify: `src/game/state/gameStore.js` (`GROWTH`, `growthInfo` already generic).
- Test: `scripts/assert/pet2-growth.mjs`

**Interfaces:**
- Consumes: `GROWTH` export, `growthInfo(stage, carePoints)`, `addCare`.
- Produces: `GROWTH` with `baby → child → adult → elder`; `child.required = 5`, `adult.required = 15`, `elder.required = 40`; `elder.next = null`.

- [ ] **Step 1: Write the failing smoke test**

```js
// scripts/assert/pet2-growth.mjs
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node scripts/assert/pet2-growth.mjs`
Expected: FAIL (only 2 stages today).

- [ ] **Step 3: Implement 4-stage `GROWTH`**

Replace the `GROWTH` block (line ~1135) in `gameStore.js`:

```js
export const GROWTH = {
  baby: {
    label: 'Baby',
    emoji: '🐣',
    next: { id: 'child', required: 5 },
  },
  child: {
    label: 'Child',
    emoji: '🌱',
    next: { id: 'adult', required: 15 },
  },
  adult: {
    label: 'Adult',
    emoji: '🦋',
    next: { id: 'elder', required: 40 },
  },
  elder: {
    label: 'Elder',
    emoji: '🕊️',
    next: null,
  },
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node scripts/assert/pet2-growth.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/game/state/gameStore.js scripts/assert/pet2-growth.mjs
git commit -m "feat: four-stage pet growth chain"
```

---

### Task 2: Per-stage visuals — starter (`STAGE_STYLE`) and hatched pets

**Files:**
- Modify: `src/game/components/Creature.jsx` (`STAGE_STYLE`), `src/game/components/petParts.js` (per-species stage styles), `src/game/components/Pet.jsx` (use per-species stage style).
- Test: `npm run build` + dev-server smoke (visual).

**Interfaces:**
- Consumes: `stage` from the store (starter) / per-pet `stage`.
- Produces: `STAGE_STYLE` gains `child` + `elder` (scale/colors); a `speciesStageStyle(species, stage)` helper in `petParts.js` returning `{ scale, colors }`; `Pet.jsx` applies it.

- [ ] **Step 1: Extend starter `STAGE_STYLE`**

In `Creature.jsx`, add `child` (scale ~0.95, brighter mid palette) and `elder` (scale ~1.25, muted/greyed palette, slightly darker eyes) to `STAGE_STYLE`, mirroring the existing `baby`/`adult` shape.

- [ ] **Step 2: Add `speciesStageStyle` to `petParts.js`**

```js
const STAGE_SCALE = { baby: 0.7, child: 0.85, adult: 1.0, elder: 1.12 };

export function speciesStageStyle(stage, colors) {
  if (stage === 'elder') {
    const grey = (hex) => {
      const c = new THREE.Color(hex);
      const avg = (c.r + c.g + c.b) / 3;
      return new THREE.Color(avg, avg, avg).getStyle();
    };
    return { scale: 1.12, colors: { ...colors, body: grey(colors.body), belly: grey(colors.belly), ears: grey(colors.ears) } };
  }
  return { scale: STAGE_SCALE[stage] ?? 1, colors };
}
```

- [ ] **Step 3: Apply in `Pet.jsx`**

Replace the fixed `scale={0.78}` on the pet group with `speciesStageStyle(stage, colors).scale`, reading `stage` live from the pet slice in the frame loop and subscribing to `p.stage` for a re-render on change. Use `speciesStageStyle(stage, colors).colors` as the color set for `SpeciesParts` + body/head/belly/ears materials instead of the raw species `colors`.

- [ ] **Step 4: Build + manual smoke**

Run: `npm run build`; dev-server: evolve a pet baby→child→adult→elder and confirm each stage changes size/colors.
Expected: visible growth at each stage; elder looks aged (muted).

- [ ] **Step 5: Commit**

```bash
git add src/game/components/Creature.jsx src/game/components/petParts.js src/game/components/Pet.jsx
git commit -m "feat: per-stage pet visuals for four growth stages"
```

---

### Task 3: Per-pet stage + care points for hatched pets

**Files:**
- Modify: `src/game/state/gameStore.js` (`hatchEgg` default stage, `addCare` per-pet variant), `src/game/ui/NeedsHud.jsx` (show growth bar for pets too).
- Test: `scripts/assert/pet2-petcare.mjs`

**Interfaces:**
- Consumes: `hatchEgg` (line ~703), `addCare`, `GROWTH`.
- Produces:
  - New pet objects get `stage: 'baby'`, `carePoints: 0`, `ageDays: 0`, `elderSince: null`, `deceased: false`.
  - `addPetCare(id, amount)` — same crossing logic as `addCare` but per-pet, advancing `p.stage`.
  - Starter's `addCare` stays as-is.

- [ ] **Step 1: Write the failing smoke test**

```js
// scripts/assert/pet2-petcare.mjs
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

useGameStore.setState({ pets: [{ id: 'p1', species: 'bunny', name: 'Nibbles', stage: 'baby', carePoints: 0, ageDays: 0, elderSince: null, deceased: false }] });
pass('addPetCare evolves baby to child', (() => {
  useGameStore.getState().addPetCare('p1', 10);
  const p = useGameStore.getState().pets.find((x) => x.id === 'p1');
  return p.stage === 'child';
})());
pass('new hatched pet defaults to baby', (() => {
  const before = useGameStore.getState().pets.length;
  useGameStore.setState({ placedEggs: [{ id: 'egg1', species: 'bunny', row: 5, col: 5 }] });
  useGameStore.getState().hatchEgg('egg1');
  const p = useGameStore.getState().pets[useGameStore.getState().pets.length - 1];
  return p.stage === 'baby' && p.ageDays === 0 && p.deceased === false;
})());
console.log(process.exitCode ? 'FAILED' : 'PASS');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node scripts/assert/pet2-petcare.mjs`
Expected: FAIL (`addPetCare` missing; pet lacks `stage`).

- [ ] **Step 3: Implement**

1. In `hatchEgg`'s pet object, add `stage: 'baby', carePoints: 0, ageDays: 0, elderSince: null, deceased: false`.
2. Add `addPetCare`:

```js
addPetCare: (id, amount) =>
  set((s) => ({
    pets: s.pets.map((p) => {
      if (p.id !== id) return p;
      const current = GROWTH[p.stage];
      if (!current || !current.next) return p;
      const carePoints = p.carePoints + amount;
      if (carePoints >= current.next.required) {
        return { ...p, carePoints: 0, stage: current.next.id };
      }
      return { ...p, carePoints };
    }),
  })),
```

3. In `needs.js` ticker, grant care to the starter via `addCare` as today, and to any hatched pet that's well-cared-for via `addPetCare(p.id, CARE_PER_GAME_SECOND * flush)` (skip sleeping/sick/runaway/deceased). Extend the existing gate loop.

- [ ] **Step 4: Run test to verify it passes**

Run: `node scripts/assert/pet2-petcare.mjs`
Expected: PASS.

- [ ] **Step 5: HUD growth bar for pets**

In `NeedsHud.jsx`, the growth section currently renders only for `isStarter`. Change it to also render for selected hatched pets: compute `growthInfo(p.stage, p.carePoints)` from the selected pet, and show the same progress UI.

- [ ] **Step 6: Build + commit**

Run: `npm run build`
Expected: clean build.

```bash
git add src/game/state/gameStore.js src/game/state/needs.js src/game/ui/NeedsHud.jsx scripts/assert/pet2-petcare.mjs
git commit -m "feat: per-pet growth stages and care points"
```

---

### Task 4: Age tracking + elder lifespan

**Files:**
- Modify: `src/game/state/petStates.js` (age/elder helpers), `src/game/state/gameStore.js` (`advancePets` lifecycle hook, called from the ticker).
- Test: `scripts/assert/pet2-elder.mjs`

**Interfaces:**
- Consumes: `timeOfDay` (day number), `trackRunaway`.
- Produces:
  - `ELDER_LIFESPAN_DAYS = 14` (export from petStates).
  - `trackAging(pet, day)` → pet with updated `ageDays` and, once `day - elderSinceDay >= ELDER_LIFESPAN_DAYS`, `deceased: true`.
  - `advancePets(pets, day)` in the store combines `trackRunaway` + `trackAging` and marks `deceased` pets (kept in the array with `deceased: true` so the death handler can fire once).

- [ ] **Step 1: Write the failing smoke test**

```js
// scripts/assert/pet2-elder.mjs
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node scripts/assert/pet2-elder.mjs`
Expected: FAIL (`trackAging` undefined).

- [ ] **Step 3: Implement in `petStates.js`**

```js
export const ELDER_LIFESPAN_DAYS = 14;

export function trackAging(pet, day) {
  const ageDays = pet.ageDays ?? 0;
  const nextDay = Math.max(ageDays, day);
  if (pet.deceased) return { ...pet, ageDays: nextDay };
  if (pet.stage === 'elder') {
    const elderSince = pet.elderSince ?? day;
    if (day - elderSince >= ELDER_LIFESPAN_DAYS) {
      return { ...pet, ageDays: nextDay, elderSince, deceased: true };
    }
    return { ...pet, ageDays: nextDay, elderSince };
  }
  return { ...pet, ageDays: nextDay };
}
```

- [ ] **Step 4: Wire into the store ticker**

Add a store action `advancePets` that maps every pet through `trackRunaway` then `trackAging` using the current day (`timeOfDay(s.time, s.dayCycleSeconds).day`), and detects any pet newly `deceased` → calls a `recordDeath(id)` hook (implemented in Task 5). Call `advancePets` from `needs.js` on the same flush cadence as `drainNeeds` (so it ticks off game time, respects pause/time-scale).

- [ ] **Step 5: Run test to verify it passes**

Run: `node scripts/assert/pet2-elder.mjs`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/game/state/petStates.js src/game/state/gameStore.js src/game/state/needs.js scripts/assert/pet2-elder.mjs
git commit -m "feat: pet aging with elder lifespan and death trigger"
```

---

### Task 5: Death handler — memorial + fresh egg

**Files:**
- Modify: `src/game/state/gameStore.js` (`recordDeath`), `src/game/state/petStates.js` (export `memorialFor(pet)`), `src/game/components/Decorations.jsx` / `decorations.js` (memorial prop), `src/game/ui/NeedsHud.jsx` (deceased chip).
- Test: `scripts/assert/pet2-death.mjs`

**Interfaces:**
- Consumes: pet's `home` anchor, `ownedEggs`, species.
- Produces:
  - `memorials: []` persisted list — `{ id, petId, species, name, row, col, x, z, y }`.
  - `recordDeath(id)` — once per pet: moves it out of `pets[]` into `memorials`, grants a fresh egg `{ id: uid(), species }` into `ownedEggs`, shows a toast.
  - `memorialFor(pet)` helper (species/name/pos) for rendering.

- [ ] **Step 1: Write the failing smoke test**

```js
// scripts/assert/pet2-death.mjs
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

useGameStore.setState({ pets: [{ id: 'old', species: 'bunny', name: 'Grandpa', home: { row: 10, col: 10 }, stage: 'elder', deceased: true, pos: { row: 10, col: 10 } }], ownedEggs: [] });
pass('recordDeath creates memorial + fresh egg', (() => {
  useGameStore.getState().recordDeath('old');
  const s = useGameStore.getState();
  return s.memorials.length === 1 && s.ownedEggs.length === 1 && s.pets.length === 0;
})());
pass('memorial uses pet home', useGameStore.getState().memorials[0].row === 10 && useGameStore.getState().memorials[0].col === 10);
pass('recordDeath is idempotent', (() => {
  const before = useGameStore.getState().memorials.length;
  useGameStore.getState().recordDeath('old');
  return useGameStore.getState().memorials.length === before;
})());
console.log(process.exitCode ? 'FAILED' : 'PASS');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node scripts/assert/pet2-death.mjs`
Expected: FAIL (`memorials` undefined / `recordDeath` missing).

- [ ] **Step 3: Implement `memorials` + `recordDeath`**

1. Add `memorials: []` to state (near `pets`), `partialize`, and `resetGame`.
2. Add the action:

```js
recordDeath: (id) =>
  set((s) => {
    const pet = s.pets.find((p) => p.id === id);
    if (!pet || !pet.deceased) return s;
    if (s.memorials.some((m) => m.petId === id)) return s;
    const { x, z } = gridToWorld(pet.home.row, pet.home.col);
    const tile = getTile(pet.home.row, pet.home.col);
    const memorial = {
      id: `mem-${id}`,
      petId: id,
      species: pet.species,
      name: pet.name ?? PET_SPECIES[pet.species]?.label ?? 'Pet',
      row: pet.home.row,
      col: pet.home.col,
      x,
      z,
      y: tile.height + TILE_THICKNESS,
    };
    return {
      pets: s.pets.filter((p) => p.id !== id),
      memorials: [...s.memorials, memorial],
      ownedEggs: [...s.ownedEggs, { id: uid(), species: pet.species }],
      toast: { id: (s.toast?.id ?? 0) + 1, text: `🕊️ ${memorial.name} passed on. A fresh egg waits.` },
    };
  }),
```

3. In `advancePets` (Task 4), after aging, find any pet newly `deceased: true` and invoke `recordDeath` for it (via `get().recordDeath`).

- [ ] **Step 4: Render memorials**

In `decorations.js`, add a `memorial` kind to `DECORATION_TYPES` (label 'Memorial', color '#d4d4d4') and to the instanced `PARTS` (a small stone with a tiny flower / heart). Add `memorial` to the `KIND_COMPONENT` registry in `Decorations.jsx` with a `Memorial` component (low-poly gravestone + heart). Render `s.memorials` as planted decorations at their coordinates (feed them through the same `InstancedField` path by merging into the decorations list, or a dedicated `Memorials` component that reads `s.memorials`).

- [ ] **Step 5: Run test to verify it passes**

Run: `node scripts/assert/pet2-death.mjs`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/game/state/gameStore.js src/game/state/petStates.js src/game/components/Decorations.jsx src/game/data/decorations.js scripts/assert/pet2-death.mjs
git commit -m "feat: elder death leaves a memorial and a fresh egg"
```

---

### Task 6: Rehydrate backfill + reset for lifecycle fields

**Files:**
- Modify: `src/game/state/gameStore.js`.
- Test: `npm run build` + existing smoke tests still pass.

**Interfaces:**
- Consumes: `onRehydrateStorage`, `resetGame`.
- Produces: older saves gain `stage`/`carePoints`/`ageDays`/`elderSince`/`deceased` on pets and an empty `memorials` array; `resetGame` returns clean defaults.

- [ ] **Step 1: Backfill in rehydrate**

In `onRehydrateStorage`, when mapping `pets`, add defaults for missing lifecycle fields:

```js
const pets = (state.pets ?? []).map((p) => ({
  ...p,
  stage: p.stage ?? 'adult',
  carePoints: p.carePoints ?? 0,
  ageDays: p.ageDays ?? 0,
  elderSince: p.elderSince ?? null,
  deceased: p.deceased ?? false,
  needs: { ...(p.needs ?? {}), hygiene: p.needs?.hygiene ?? 100 },
  ...(!p.home || p.home.row === undefined ? { home: pickPetHome(p.species) } : {}),
}));
```

Also set `memorials: state.memorials ?? []` via `useGameStore.setState`.

- [ ] **Step 2: Reset**

Add `memorials: []` and per-pet lifecycle defaults are handled by `pets: []` in `resetGame`. Set `stage: 'baby'`, `carePoints: 0` (already present).

- [ ] **Step 3: Build + regression**

Run: `npm run build` and `node scripts/assert/pet2-*.mjs`
Expected: clean build, all plan-2 tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/game/state/gameStore.js
git commit -m "fix: backfill lifecycle fields for older saves"
```
