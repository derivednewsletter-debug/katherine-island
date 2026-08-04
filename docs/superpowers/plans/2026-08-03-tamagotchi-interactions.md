# Tamagotchi Pets — Plan 4: Interactions & UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the fun Tamagotchi interactions — **play fetch/chase**, **walk together / follow**, **rename anytime** — plus final HUD polish (per-pet rename entry, mood/state surfacing, action buttons).

**Architecture:** Extend the store with per-pet transient interaction flags (`fetchTarget`, `followTarget`) and a `renamePet` action; the pet movement state machines (`Pet.jsx`/`Creature.jsx`) get new `fetch`/`follow` modes that steer toward a thrown toy or the player, and the HUD gains a small action row (Play, Follow, Rename). Interactions are local, timeboxed behaviors — no new subsystems.

**Tech Stack:** Zustand 5 store, three.js, existing A* pathfinding + frame-loop movement, esbuild smoke tests, no new deps.

## Global Constraints

- No new npm dependencies (verify with `npm run build`).
- No code comments unless asked (project convention).
- Interactions are transient (not persisted); `renamePet` mutates the persisted `name` and the HUD chips/minimap must reflect it (they already key on `p.name`).
- All movement reuses the existing `findPath` + `stepAlongPath` logic and the existing `useFrame` loops — no physics engine.
- `renamePet` reuses the existing `NamingModal` overlay (new `renamingPetId` state).
- New resources/items (toy) need `RESOURCES` + icons like soap/medkit.

---

### Task 1: `renamePet` action + rename entry point

**Files:**
- Modify: `src/game/state/gameStore.js` (`renamePet`, `renamingPetId`), `src/game/ui/NeedsHud.jsx` (rename button), `src/game/ui/NamingModal.jsx` (support editing an existing pet).
- Test: `scripts/assert/pet4-rename.mjs`

**Interfaces:**
- Consumes: existing `namePet` (hatch-time), `NamingModal` (`namingPetId`).
- Produces:
  - `renamingPetId: null` state + `openRename(id)` / `renamePet(name)` actions.
  - `renamePet(name)` writes `p.name` for `renamingPetId` (accepts any pet id, including starter via a petId-aware variant) and clears the flag.
  - `NamingModal` renders for either `namingPetId` (hatch) or `renamingPetId` (edit), with an "Rename" title in the edit case.

- [ ] **Step 1: Write the failing smoke test**

```js
// scripts/assert/pet4-rename.mjs
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

useGameStore.setState({ pets: [{ id: 'p1', species: 'bunny', name: 'Nibbles' }] });
pass('openRename sets flag', (() => {
  useGameStore.getState().openRename('p1');
  return useGameStore.getState().renamingPetId === 'p1';
})());
pass('renamePet updates name and clears flag', (() => {
  useGameStore.getState().renamePet('Mochi');
  const s = useGameStore.getState();
  return s.renamingPetId === null && s.pets.find((p) => p.id === 'p1').name === 'Mochi';
})());
console.log(process.exitCode ? 'FAILED' : 'PASS');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node scripts/assert/pet4-rename.mjs`
Expected: FAIL (`openRename` missing).

- [ ] **Step 3: Implement**

In `gameStore.js`:

```js
renamingPetId: null,

openRename: (id) => set({ renamingPetId: id }),

renamePet: (name) =>
  set((s) => {
    if (!s.renamingPetId) return s;
    const clean = (name || '').trim();
    if (s.renamingPetId === 'starter') {
      return { petName: clean || 'My pet', renamingPetId: null };
    }
    return {
      pets: s.pets.map((p) =>
        p.id === s.renamingPetId
          ? { ...p, name: clean || PET_SPECIES[p.species]?.label || 'Pet' }
          : p
      ),
      renamingPetId: null,
    };
  }),
```

Add `starterName`/`petName` support: the starter currently shows a hardcoded "My pet" in the HUD. Add `petName: 'My pet'` state (persisted), used by `NeedsHud` when `isStarter`; `renamePet` updates it for the starter case. Partialize `petName`; reset to `'My pet'`.

- [ ] **Step 4: HUD rename button + modal support**

In `NeedsHud.jsx`, next to the selected pet's name, add a small ✏️ button that calls `openRename(selectedPetId)`. In `NamingModal.jsx`, drive it from either `namingPetId` (title "Name the new pet") or `renamingPetId` (title "Rename") and submit to `renamePet` in the rename case (default value = current name).

- [ ] **Step 5: Run test to verify it passes**

Run: `node scripts/assert/pet4-rename.mjs`
Expected: PASS.

- [ ] **Step 6: Build + commit**

Run: `npm run build`
Expected: clean build.

```bash
git add src/game/state/gameStore.js src/game/ui/NeedsHud.jsx src/game/ui/NamingModal.jsx scripts/assert/pet4-rename.mjs
git commit -m "feat: rename pets anytime"
```

---

### Task 2: Play fetch / chase

**Files:**
- Modify: `src/game/data/shop.js` (toy item), `src/game/data/resources.js` (toy label), `src/game/data/icons.js`, `src/game/state/gameStore.js` (`throwToy`, `fetchTarget`, pet movement state), `src/game/components/Pet.jsx` / `Creature.jsx` (fetch mode), `src/game/ui/NeedsHud.jsx` (Play button).
- Test: `scripts/assert/pet4-fetch.mjs`

**Interfaces:**
- Consumes: `selectedPetId`, `addCare`/`petPet`, `uid`, pet positions.
- Produces:
  - `toy` inventory resource (start 0; shop item `toy` kind `item`, price `{ shell: 5 }`).
  - `throwToy(petId, targetRow, targetCol)` — consumes 1 toy, sets `p.fetchTarget = { row, col }`; Pet.jsx walks to the target, then back to the player, then grants happiness + 1 care point via a new `fetchReturned(petId)` action.
  - `fetchReturned(petId)` — clears `fetchTarget`, `+12` happiness, `addPetCare(petId, 1)` (starter: `addCare(1)`), hearts + toast.

- [ ] **Step 1: Write the failing smoke test**

```js
// scripts/assert/pet4-fetch.mjs
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

useGameStore.setState({ inventory: { ...useGameStore.getState().inventory, toy: 1 }, pets: [{ id: 'p1', species: 'bunny', name: 'Nibbles', needs: { hunger: 80, energy: 80, happiness: 50, hygiene: 80 }, stage: 'baby', carePoints: 0, fetchTarget: null }] });
pass('throwToy consumes toy and sets target', (() => {
  const ok = useGameStore.getState().throwToy('p1', 20, 20);
  const s = useGameStore.getState();
  return ok && s.inventory.toy === 0 && s.pets[0].fetchTarget?.row === 20;
})());
pass('fetchReturned clears target, boosts happiness + care', (() => {
  useGameStore.getState().fetchReturned('p1');
  const p = useGameStore.getState().pets[0];
  return p.fetchTarget === null && p.needs.happiness === 62 && p.carePoints === 1;
})());
pass('throwToy fails without toy', (() => {
  useGameStore.setState({ inventory: { ...useGameStore.getState().inventory, toy: 0 } });
  return useGameStore.getState().throwToy('p1', 5, 5) === false;
})());
console.log(process.exitCode ? 'FAILED' : 'PASS');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node scripts/assert/pet4-fetch.mjs`
Expected: FAIL (`throwToy` missing).

- [ ] **Step 3: Implement store actions**

```js
throwToy: (petId, row, col) => {
  const s = get();
  if ((s.inventory.toy ?? 0) < 1) return false;
  const apply = (p) => (p.id === petId ? { ...p, fetchTarget: { row, col } } : p);
  if (petId === 'starter') {
    set({ inventory: { ...s.inventory, toy: s.inventory.toy - 1 }, fetchTarget: { row, col } });
  } else {
    set({ inventory: { ...s.inventory, toy: s.inventory.toy - 1 }, pets: s.pets.map(apply) });
  }
  return true;
},

fetchReturned: (petId) =>
  set((s) => {
    if (petId === 'starter') {
      return {
        fetchTarget: null,
        needs: { ...s.needs, happiness: Math.min(100, s.needs.happiness + 12) },
        carePoints: s.carePoints + 1,
      };
    }
    return {
      pets: s.pets.map((p) =>
        p.id === petId
          ? {
              ...p,
              fetchTarget: null,
              needs: { ...p.needs, happiness: Math.min(100, p.needs.happiness + 12) },
              carePoints: p.carePoints + 1,
            }
          : p
      ),
    };
  }),
```

Note: `fetchReturned` uses `carePoints + 1` (like petting); the growth cross-check lives in `addCare`/`addPetCare` — route through those instead to respect the threshold (call `addPetCare(petId, 1)`/`addCare(1)` then clear the flag). Implement it that way in the component, keeping the store action as the flag-clearing + happiness bump.

- [ ] **Step 4: Add toy item**

In `shop.js`: `{ id: 'petcare:toy', kind: 'item', resource: 'toy', name: 'Toy', emoji: '🧶', desc: 'Play fetch — throw a toy and your pet brings it back!', price: { shell: 5 }, count: 1 }`. In `resources.js`: `toy: { label: 'Toy', color: '#ff9e6b' }`. Add a `toy` icon.

- [ ] **Step 5: Pet movement — fetch mode**

In `Pet.jsx` (and `Creature.jsx`), add a `fetch` state to the movement machine:
- When `p.fetchTarget` is set and the pet isn't already chasing, compute an A* path to the fetch target and `s.mode = 'fetch'`, walking there at 1.6× speed.
- On arrival, compute a path back to the player's cell (`playerPos`); on return, call `fetchReturned(petId)` (via `addPetCare` for the growth cross), burst hearts, toast.
- Guard: sleeping / sick / runaway / deceased pets refuse fetch.

- [ ] **Step 6: Play button in HUD**

In `NeedsHud.jsx`, add a "🎾 Play" button (disabled when no toy). Clicking throws a toy a few tiles in front of the player's facing direction (`throwToy(selectedPetId, row, col)` where `row`/`col` derive from `playerPos` + `playerDir`).

- [ ] **Step 7: Run test to verify it passes**

Run: `node scripts/assert/pet4-fetch.mjs`
Expected: PASS.

- [ ] **Step 8: Build + commit**

Run: `npm run build`
Expected: clean build.

```bash
git add src/game/state/gameStore.js src/game/data/shop.js src/game/data/resources.js src/game/data/icons.js src/game/components/Pet.jsx src/game/components/Creature.jsx src/game/ui/NeedsHud.jsx scripts/assert/pet4-fetch.mjs
git commit -m "feat: play fetch with pets"
```

---

### Task 3: Walk together / follow

**Files:**
- Modify: `src/game/state/gameStore.js` (`followPet`/`stopFollow`), `src/game/components/Pet.jsx` / `Creature.jsx` (follow mode), `src/game/ui/NeedsHud.jsx` (Follow button).
- Test: `scripts/assert/pet4-follow.mjs`

**Interfaces:**
- Consumes: `playerPos`, pet positions, `petPet`.
- Produces:
  - `followingPetId: null` (transient) + `toggleFollow(id)`.
  - While following, the pet steers toward a cell a few tiles behind/adjacent to the player each frame (no A* — straight-line walk at walk speed), and periodically bumps happiness (+2 per game-second) with small hearts.
  - `stopFollow` on toggle-off, sleep, or distance > ~20 tiles.

- [ ] **Step 1: Write the failing smoke test**

```js
// scripts/assert/pet4-follow.mjs
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

useGameStore.setState({ pets: [{ id: 'p1', species: 'bunny', name: 'Nibbles' }], followingPetId: null });
pass('toggleFollow sets follower', (() => {
  useGameStore.getState().toggleFollow('p1');
  return useGameStore.getState().followingPetId === 'p1';
})());
pass('toggleFollow again clears', (() => {
  useGameStore.getState().toggleFollow('p1');
  return useGameStore.getState().followingPetId === null;
})());
pass('stopFollow clears', (() => {
  useGameStore.setState({ followingPetId: 'p1' });
  useGameStore.getState().stopFollow();
  return useGameStore.getState().followingPetId === null;
})());
console.log(process.exitCode ? 'FAILED' : 'PASS');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node scripts/assert/pet4-follow.mjs`
Expected: FAIL (`toggleFollow` missing).

- [ ] **Step 3: Implement**

```js
followingPetId: null,

toggleFollow: (id) =>
  set((s) => ({ followingPetId: s.followingPetId === id ? null : id })),
stopFollow: () => set({ followingPetId: null }),
```

- [ ] **Step 4: Pet follow movement**

In `Pet.jsx`/`Creature.jsx` `useFrame`, when `followingPetId === petId` (or `'starter'` for the starter creature) and not sleeping/sick/runaway/deceased:
- Compute the offset cell behind the player: `{ row: playerPos.row + round(sin(dir)*-1), col: playerPos.col + round(cos(dir)*-1) }` (a couple tiles behind the facing), clamp walkable.
- Steer straight-line toward it at `WALK_SPEED`, updating pos/yaw; skip A*.
- Every second, `+2` happiness (clamped) via a `followHeart(petId)` store action and small heart burst.
- If distance > 20 tiles, `stopFollow()`.

- [ ] **Step 5: Follow button in HUD**

In `NeedsHud.jsx`, add a "🚶 Walk" button that toggles `followPet(selectedPetId)`, showing active state when `followingPetId === selectedPetId`.

- [ ] **Step 6: Run test to verify it passes**

Run: `node scripts/assert/pet4-follow.mjs`
Expected: PASS.

- [ ] **Step 7: Build + commit**

Run: `npm run build`
Expected: clean build.

```bash
git add src/game/state/gameStore.js src/game/components/Pet.jsx src/game/components/Creature.jsx src/game/ui/NeedsHud.jsx scripts/assert/pet4-follow.mjs
git commit -m "feat: walk together with your pet"
```

---

### Task 4: HUD polish — action row, sick/fleeing surfacing, memorial chip

**Files:**
- Modify: `src/game/ui/NeedsHud.jsx`, `src/game/ui/Minimap.jsx` (memorial + runaway markers), `src/game/components/Pet.jsx` (fleeing render from Plan 1 is assumed; ensure elder/aged render), `src/game/data/icons.js` (sick already added in Plan 1; add `memorial`/`paw` if needed).
- Test: `npm run build` + dev-server smoke.

**Interfaces:**
- Consumes: all prior store fields/actions.
- Produces: a compact action row (Feed · Play · Walk · Bathe · Rename) in the pet HUD; a memorial chip when `memorials.length > 0`; minimap markers for memorials and runaway pets.

- [ ] **Step 1: Action row**

In `NeedsHud.jsx`, consolidate the existing Feed button plus Play/Walk/Bathe/Rename into one button row under the bars. Disable actions whose preconditions fail (no toy → Play disabled; no soap → Bathe disabled; sleeping/sick → most disabled).

- [ ] **Step 2: Memorial + runaway surfacing**

- `NeedsHud`: when `memorials.length > 0`, show a small grey chip: "🕊️ {memorial.name} — in loving memory".
- `Minimap.jsx`: add markers for `memorials` (a tiny grey heart) and for pets with `ranAway` (a blinking "?" dot), reusing the existing ring/marker primitives.

- [ ] **Step 3: Build + manual smoke**

Run: `npm run build`; dev-server: verify every HUD action works, memorial chip shows after an elder passes, minimap markers appear.
Expected: all interactions usable; no console errors.

- [ ] **Step 4: Commit**

```bash
git add src/game/ui/NeedsHud.jsx src/game/ui/Minimap.jsx src/game/components/Pet.jsx src/game/data/icons.js
git commit -m "feat: pet HUD action row and memorial/runaway markers"
```

---

### Task 5: Full-harness verification + regression

**Files:**
- Modify: `scripts/assert/pet4-full.mjs`.

**Interfaces:**
- Consumes: everything above.

- [ ] **Step 1: Write the full smoke test**

```js
// scripts/assert/pet4-full.mjs
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

useGameStore.setState({ pets: [{ id: 'p1', species: 'bunny', name: 'Nibbles', needs: { hunger: 80, energy: 80, happiness: 50, hygiene: 80 }, stage: 'baby', carePoints: 0 }] });
useGameStore.getState().openRename('p1');
useGameStore.getState().renamePet('Mochi');
pass('rename persists', useGameStore.getState().pets[0].name === 'Mochi');
useGameStore.setState({ inventory: { ...useGameStore.getState().inventory, toy: 1 } });
useGameStore.getState().throwToy('p1', 3, 3);
pass('fetch target set', useGameStore.getState().pets[0].fetchTarget?.row === 3);
useGameStore.getState().toggleFollow('p1');
pass('following set', useGameStore.getState().followingPetId === 'p1');
useGameStore.getState().stopFollow();
pass('following cleared', useGameStore.getState().followingPetId === null);
console.log(process.exitCode ? 'FAILED' : 'PASS');
```

- [ ] **Step 2: Run the full harness**

Run: `node scripts/assert/pet4-full.mjs && npm run build`
Expected: PASS + clean build.

- [ ] **Step 3: Regression — run all pet plans' tests**

Run: `node scripts/assert/pet1-full.mjs && node scripts/assert/pet2-growth.mjs && node scripts/assert/pet2-petcare.mjs && node scripts/assert/pet2-elder.mjs && node scripts/assert/pet2-death.mjs && node scripts/assert/pet3-full.mjs && node scripts/assert/pet4-full.mjs`
Expected: all PASS.

- [ ] **Step 4: Commit**

```bash
git add scripts/assert/pet4-full.mjs
git commit -m "test: verify interactions and UI end-to-end"
```
