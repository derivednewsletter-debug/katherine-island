# Till → Plant Farming Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the hoe meaningful by introducing tilled soil plots — seeds can only be planted on tilled plots, creating a "hoe first, then plant" farming loop.

**Architecture:** A new persisted `plots` store slice records tilled cells. Tilling is a click with the hoe equipped (a `tillTile` store action that duplicates the existing chop-tree durability pattern). `canPlantCrop`/`plantCrop` now require a plot at the cell, so the placement ghost turns red on untilled ground and planting toasts "till the soil first". A new `Plots` scene component renders instanced brown soil patches plus a raycast hotspot so the eraser can remove plots.

**Tech Stack:** React 18, Zustand 5 (persist), @react-three/fiber, three.js (instanced rendering), Vite 6.

**Spec:** `docs/superpowers/specs/2026-08-02-till-plant-farming-loop-design.md`

## Global Constraints

- No test framework exists in this repo (`package.json` has only `dev`/`build`/`preview`). Verification uses `npm run build` (must pass), `npm run dev` + curl (modules serve HTTP 200), and standalone esbuild smoke tests for pure logic.
- Follow the existing per-frame store discipline: components subscribe via selective selectors; the shared clock (`gameClock.js`) is the only 60fps writer.
- Persist new state via `partialize`, backfill it in `onRehydrateStorage`, and clear it in `resetGame`.
- Do not add new gameplay beyond the spec (no new crops, no new tools).
- No code comments unless they explain a non-obvious decision (match file conventions).
- Commit after each task with a message matching repo style (imperative, feature-prefixed).

---

### Task 1: `plots` state, `canTill`, `tillTile`, `removePlot`, and the plant gate

**Files:**
- Modify: `src/game/state/gameStore.js` (initial state ~line 152, `plantCrop` ~408-444, `canPlantCrop` ~1048-1063, store actions near `removeCrop` ~475, `resetGame` ~812-857, `partialize` ~874-899, `onRehydrateStorage` ~904-938)
- Test: esbuild smoke test (below)

**Interfaces:**
- Produces: store action `tillTile(row, col)` — creates a plot `{ id, row, col, x, z, y, rot, scale }` when the hoe is equipped and `canTill` passes; returns the new state.
- Produces: store action `removePlot(row, col)`.
- Produces: exported function `canTill(s, row, col)` → boolean.
- Produces: `plots` array in state, partialize, reset, and rehydrate backfill.
- Modifies: `canPlantCrop(s, cropId, row, col)` now also returns `false` when the cell has no plot. `plantCrop(cropId, row, col)` toasts "till the soil first" when the only blocker is the missing plot.

- [ ] **Step 1: Add `plots` to the initial state**

After the `crops` line (~line 152) add:

```js
  plots: [], // [{ id, row, col, x, z, y, rot, scale }] tilled soil plots
```

- [ ] **Step 2: Add `canTill` export + `tillTile` / `removePlot` actions**

Import `SPAWN_POINT` from `./mapData` alongside the existing imports (`KIOSK_TILE`, `BED_SPOT` are already imported there).

Add the exported helper just above `export function canPlantCrop(...)` (~line 1048):

```js
/**
 * Can this cell be tilled? Same occupancy rules as planting (walkable land,
 * not kiosk/bed/spawn/pet/egg/decoration/crop/plot) — the hoe's soil check.
 */
export function canTill(s, row, col) {
  const tile = getTile(row, col);
  if (!tile || !isWalkable(tile)) return false;
  if (row === SPAWN_POINT.row && col === SPAWN_POINT.col) return false;
  if (row === KIOSK_TILE.row && col === KIOSK_TILE.col) return false;
  if (row === BED_SPOT.row && col === BED_SPOT.col) return false;
  if (s.creaturePos && s.creaturePos.row === row && s.creaturePos.col === col) return false;
  if (s.pets.some((p) => p.pos && p.pos.row === row && p.pos.col === col)) return false;
  if (s.decorations.some((d) => d.row === row && d.col === col)) return false;
  if (s.placedEggs.some((e) => e.row === row && e.col === col)) return false;
  if (s.crops.some((c) => c.row === row && c.col === col)) return false;
  if (s.plots.some((p) => p.row === row && p.col === col)) return false;
  return true;
}
```

Add these store actions immediately after the `removeCrop` action (which ends ~line 481):

```js
  /** Till the soil under a walkable land tile (hoe equipped only). */
  tillTile: (row, col) =>
    set((s) => {
      if (s.playerTool !== 'hoe') return s;
      if (!canTill(s, row, col)) return s;
      const tile = getTile(row, col);
      const { x, z } = gridToWorld(row, col);
      return {
        plots: [
          ...s.plots,
          {
            id: uid(),
            row,
            col,
            x,
            z,
            y: tile.height + TILE_THICKNESS,
            rot: Math.random() * Math.PI * 2,
            scale: 1,
          },
        ],
      };
    }),

  /** Remove a tilled plot (eraser). */
  removePlot: (row, col) =>
    set((s) => ({
      plots: s.plots.filter((p) => !(p.row === row && p.col === col)),
    })),
```

- [ ] **Step 3: Require a plot to plant**

In `canPlantCrop` (exported function ~line 1051-1052), after the walkable/biome checks add:

```js
  if (!s.plots.some((p) => p.row === row && p.col === col)) return false; // needs tilled soil!
```

In `plantCrop`, REPLACE the head of the action (lines 408-422 — the placement guard, `def` lookup, the `canPlantCrop` gate, and the seed toast) with the following, so the seed and plot toasts fire BEFORE the generic `canPlantCrop` gate (which currently swallows both):

```js
  plantCrop: (cropId, row, col) =>
    set((s) => {
      if (!s.placement.active || s.placement.tool !== `crop:${cropId}`) return s;
      const def = cropById(cropId);
      if (!def) return s;
      // Seed economy: planting consumes one seed. A toast explains when the
      // pile is empty so the failed click isn't silent.
      if ((s.seeds[cropId] ?? 0) < 1) {
        return {
          toast: {
            id: (s.toast?.id ?? 0) + 1,
            text: `${def.emoji} No ${def.label} seeds — buy some at the shop!`,
          },
        };
      }
      // NEW: seeds only take root in tilled soil
      if (!s.plots.some((p) => p.row === row && p.col === col)) {
        return {
          toast: {
            id: (s.toast?.id ?? 0) + 1,
            text: `${def.emoji} Till the soil first — equip the hoe (2) and click the ground`,
          },
        };
      }
      // Biome + occupancy gate (silent; the ghost is red before you click).
      if (!canPlantCrop(s, cropId, row, col)) return s;
```

The rest of the action (tile lookup, `crops` push, seed decrement, placement reset) stays unchanged.

- [ ] **Step 4: Persist + reset + backfill `plots`**

In `resetGame` (the `set({...})` call), after `crops: [],` add `plots: [],`.

In `partialize`, after `crops: s.crops,` add `plots: s.plots,`.

In `onRehydrateStorage`, in the `useGameStore.setState({...})` backfill object, add a defaulted `plots`:

```js
          plots: state.plots ?? [],
```

- [ ] **Step 5: Build + smoke test**

Run: `npm run build`
Expected: PASS (665 modules transformed, no errors).

Write a standalone esbuild smoke test verifying `canTill` + the plot gate. Create `_tillcheck.mjs` in the project root:

```js
import { generateInitialDecorations } from './src/game/data/decorations.js';
import { canTill, canPlantCrop } from './src/game/state/gameStore.js';
import { getTile, SPAWN_POINT, BED_SPOT } from './src/game/data/mapData.js';
import { KIOSK_TILE } from './src/game/data/shop.js';

const s = {
  plots: [],
  crops: [],
  decorations: generateInitialDecorations(),
  placedEggs: [],
  pets: [],
  creaturePos: { row: SPAWN_POINT.row + 10, col: SPAWN_POINT.col + 10 },
  unlockedCrops: [],
  seeds: { berryBush: 3 },
};

// find a grass tile away from spawn/bed/kiosk
let target = null;
outer: for (let r = 0; r < 200; r++) {
  for (let c = 0; c < 200; c++) {
    const t = getTile(r, c);
    if (!t || t.type !== 'grass') continue;
    if (r === BED_SPOT.row && c === BED_SPOT.col) continue;
    if (r === KIOSK_TILE.row && c === KIOSK_TILE.col) continue;
    if (Math.abs(r - SPAWN_POINT.row) < 3 && Math.abs(c - SPAWN_POINT.col) < 3) continue;
    if (s.decorations.some((d) => d.row === r && d.col === c)) continue;
    target = { row: r, col: c };
    break outer;
  }
}
if (!target) throw new Error('no target tile');
console.log('till ok:', canTill(s, target.row, target.col) === true);
console.log('plant before till:', canPlantCrop(s, 'berryBush', target.row, target.col) === false);
s.plots = [{ row: target.row, col: target.col }];
console.log('plant after till:', canPlantCrop(s, 'berryBush', target.row, target.col) === true);
console.log('till again (blocked):', canTill(s, target.row, target.col) === false);
```

Run it:

```bash
npx esbuild ./_tillcheck.mjs --bundle --format=esm --external:react --external:react-dom --external:three --outfile=./_tillcheck.bundle.mjs && node ./_tillcheck.bundle.mjs && rm -f ./_tillcheck.mjs ./_tillcheck.bundle.mjs
```

Expected output: `till ok: true`, `plant before till: false`, `plant after till: true`, `till again (blocked): false`

- [ ] **Step 6: Commit**

```bash
git add src/game/state/gameStore.js
git commit -m "feat: add tilled soil plots, canTill/tillTile, and plot-gated planting"
```

---

### Task 2: `Plots.jsx` scene component

**Files:**
- Create: `src/game/components/Plots.jsx`
- Modify: `src/game/components/GameScene.jsx` (mount `<Plots />` after `<Crops />` ~line 80)

**Interfaces:**
- Consumes: `useGameStore` (selector `s.plots`), store action `removePlot(row, col)`, `InstancedField`.
- Produces: JSX `<Plots />` rendering one brown soil patch per plot (instanced) + an instanced raycast hotspot that removes the plot in erase mode and lets other clicks fall through to the ground plane.

- [ ] **Step 1: Create `Plots.jsx`**

```jsx
import React, { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useGameStore } from '../state/gameStore';
import InstancedField from './InstancedField';

// Tilled soil patch: a low outer mound + a darker inner ridge. Parts are
// placed relative to the plot's (x, y, z), where y is the tile's top surface.
const SOIL_PARTS = [
  { geom: 'cylinder', args: [0.36, 0.38, 0.06, 8], pos: [0, 0.07, 0], rot: [0, 0, 0], color: '#7a5a34' },
  { geom: 'cylinder', args: [0.28, 0.3, 0.02, 8], pos: [0, 0.1, 0], rot: [0, 0, 0], color: '#5d4426' },
];

/**
 * Renders every tilled soil plot. Soil patches are instanced (cheap); a
 * single invisible raycast hotspot per plot lets the eraser remove plots.
 * The hotspot only stops clicks in erase mode — otherwise clicks fall
 * through to the ground plane so gathering/tilling still work on that tile.
 */
export default function Plots() {
  const plots = useGameStore((s) => s.plots);

  const entries = useMemo(
    () => plots.map((p) => ({ x: p.x, y: p.y, z: p.z, rot: p.rot ?? 0, scale: p.scale ?? 1 })),
    [plots]
  );

  // Hotspot instances = ALL plots (order matches s.plots → e.instanceId)
  const hotspotEntries = useMemo(
    () => plots.map((p) => ({ x: p.x, y: p.y + 0.06, z: p.z, rot: 0, scale: 1 })),
    [plots]
  );
  const hotspotRef = useRef();

  // Bake hotspot matrices whenever the plot roster changes
  useLayoutEffect(() => {
    const mesh = hotspotRef.current;
    if (!mesh) return;
    if (hotspotEntries.length > mesh.count) {
      mesh.instanceMatrix = new THREE.InstancedBufferAttribute(
        new Float32Array(hotspotEntries.length * 16),
        16
      );
    }
    mesh.count = hotspotEntries.length;
    const dummy = new THREE.Object3D();
    for (let i = 0; i < hotspotEntries.length; i++) {
      const e = hotspotEntries[i];
      dummy.position.set(e.x, e.y, e.z);
      dummy.scale.set(0.8, 1, 0.8);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }, [hotspotEntries]);

  /** Click a plot hotspot (e.instanceId → s.plots[instanceId]). */
  const handlePlotClick = (e) => {
    const s = useGameStore.getState();
    const plot = s.plots[e.instanceId];
    if (!plot) return;
    if (s.placement.active && s.placement.tool === 'erase') {
      e.stopPropagation();
      s.removePlot(plot.row, plot.col);
    }
    // Otherwise let the click fall through to the ground plane.
  };

  return (
    <group>
      <InstancedField entries={entries} parts={SOIL_PARTS} />
      <instancedMesh
        ref={hotspotRef}
        args={[undefined, undefined, Math.max(hotspotEntries.length, 1)]}
        onClick={handlePlotClick}
      >
        <boxGeometry args={[0.8, 0.12, 0.8]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </instancedMesh>
    </group>
  );
}
```

- [ ] **Step 2: Mount it in GameScene**

In `src/game/components/GameScene.jsx`, add the import after `import Crops from './Crops';`:

```js
import Plots from './Plots';
```

And render it after `<Crops />` (~line 80):

```jsx
        <Crops />
        <Plots />
```

- [ ] **Step 3: Build + verify**

Run: `npm run build`
Expected: PASS.

Start the dev server, then confirm the module serves:

```bash
npm run dev > /tmp/vite-plan.log 2>&1 &
sleep 4
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:5173/src/game/components/Plots.jsx
pkill -f vite
```

Expected: `200`

- [ ] **Step 4: Commit**

```bash
git add src/game/components/Plots.jsx src/game/components/GameScene.jsx
git commit -m "feat: render tilled soil plots as instanced patches with erase hotspot"
```

---

### Task 3: Hoe click tills soil

**Files:**
- Modify: `src/game/components/MapGrid.jsx` (imports ~line 16, `handleClick` ~276-348)

**Interfaces:**
- Consumes: `useGameStore`, store actions `tillTile(row, col)`, `showToast(text)`, `useGameStore.setState`, exported `canTill(s, row, col)`, `playGatherPop()`.
- Produces: hoe-equipped ground clicks till instead of gathering.

- [ ] **Step 1: Import `canTill`**

Change the `gameStore` import to:

```js
import { useGameStore, canTill } from '../state/gameStore';
```

- [ ] **Step 2: Branch `handleClick` on the equipped tool**

In `handleClick`, immediately after `setSelected({ row, col });` (line ~283) and before `const resource = resourceForTerrain(tile.type);` add:

```js
    // Hoe owns the click: till the soil instead of gathering resources.
    const s0 = useGameStore.getState();
    if (s0.playerTool === 'hoe') {
      if (canTill(s0, row, col)) {
        s0.tillTile(row, col);
        const tools = s0.tools ?? { axe: 50, hoe: 50 };
        const newDurability = Math.max(0, (tools.hoe ?? 0) - 1);
        useGameStore.setState({ tools: { ...tools, hoe: newDurability } });
        playGatherPop();
        s0.showToast(newDurability <= 0 ? 'Your hoe is broken!' : 'Tilled the soil!');
      } else {
        s0.showToast('Can\'t till here');
      }
      return;
    }
```

- [ ] **Step 3: Build + verify**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/game/components/MapGrid.jsx
git commit -m "feat: hoe click tills soil with durability instead of gathering"
```

---

### Task 4: Eraser removes plots + ghost recognizes them

**Files:**
- Modify: `src/game/components/PlacementSystem.jsx` (`isActionable` ~48-71, `handleClick` ~93-111)

**Interfaces:**
- Consumes: store action `removePlot(row, col)`; existing `s.decorations`/`s.crops` erase handling.
- Produces: eraser highlights tilled plots and removes them on click.

- [ ] **Step 1: Eraser is actionable on plots**

In `isActionable`, change the `'erase'` branch to also match plots:

```js
    if (toolId === 'erase') {
      // Eraser removes decorations, crops, OR tilled soil
      return (
        s.decorations.some((d) => d.row === row && d.col === col) ||
        s.crops.some((c) => c.row === row && c.col === col) ||
        s.plots.some((p) => p.row === row && p.col === col)
      );
    }
```

- [ ] **Step 2: Eraser click removes plots**

In `handleClick`, change the erase branch to:

```js
    if (tool === 'erase') {
      s.removeDecoration(row, col);
      s.removeCrop(row, col);
      s.removePlot(row, col);
    }
```

- [ ] **Step 3: Build + verify**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/game/components/PlacementSystem.jsx
git commit -m "feat: eraser removes tilled soil plots"
```

---

### Task 5: End-to-end verification + push

**Files:** none (verification only)

- [ ] **Step 1: Full build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 2: Dev-server smoke**

```bash
npm run dev > /tmp/vite-plan-e2e.log 2>&1 &
sleep 4
curl -s -o /dev/null -w "root: %{http_code}\n" http://localhost:5173/
for f in src/game/state/gameStore.js src/game/components/Plots.jsx src/game/components/MapGrid.jsx src/game/components/PlacementSystem.jsx; do
  curl -s -o /dev/null -w "%{http_code} $f\n" "http://localhost:5173/$f"
done
pkill -f vite
```

Expected: `root: 200` and all four `200`.

- [ ] **Step 3: Manual sanity of the loop (human, optional)**

With the game running: equip the hoe (press `2`), click grass → a brown soil patch appears and durability drops. Select a seed from the plant palette → ghost is red on untilled ground, green on the tilled plot. Plant on the plot. Switch to eraser → hover shows red over the plot; clicking removes it.

- [ ] **Step 4: Push**

```bash
git push origin main
```

Expected: working tree clean, `origin/main` updated.
