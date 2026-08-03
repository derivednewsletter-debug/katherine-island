# Till → Plant Farming Loop — Design

Date: 2026-08-02

## Problem

The hoe is nearly useless: it only harvests adjacent crops with `E`, and seeds can be
planted directly on bare ground from the palette — the hoe never participates in
planting. There is no real "use the hoe, then plant seeds" farming loop.

## Goal

Make tilling essential: the hoe tills a tile into soil, and seeds can ONLY be planted
on tilled plots.

## Design

### 1. New state — `plots`

- Persisted array `plots: []`: `{ id, row, col, x, z, y }`, one per tilled tile.
- A plot persists after its crop is harvested (tilled soil stays tilled for replanting).
- The eraser tool can remove a plot (cleans up stray soil).

### 2. Tilling (the hoe's job)

- Equip the hoe (key `2`); clicking any walkable land tile calls
  `tillTile(row, col)` → creates a plot.
- Consumes 1 hoe durability per till. Toasts: "Tilled the soil!", "Your hoe is
  broken!", or "Can't till here" on invalid tiles (water/shallow, spawn tile, kiosk,
  bed, creature/pet tile, egg, decoration, crop, existing plot).
- Clicking with the hoe equipped no longer gathers resources (the hoe owns the click).
- The existing `E`-with-hoe harvest-adjacent-crop behavior is unchanged.

### 3. Planting (seed palette)

- `canPlantCrop` additionally requires a tilled plot at the cell:
  - Crop ghost renders **red** over untilled ground, **green** only on tilled soil
    in the crop's biome.
- `plantCrop` shows a toast "Till the soil first — equip the hoe (2) and click the
  ground" when a seed click lands on untilled ground.

### 4. Visuals

- New `Plots` component (instanced): a low-poly tilled-soil patch (flattened brown
  cylinder + slightly darker inset) per plot, plus an instanced raycast hotspot so
  the eraser can remove plots. Mounted alongside crops in the scene.

### 5. Save compatibility

- `plots: []` backfilled in the rehydrate migration.
- Added to `partialize` so it persists.
- Cleared in `resetGame`.

## Files touched

- `src/game/state/gameStore.js` — `plots` state; `tillTile` / `removePlot` actions;
  `canPlantCrop` + `plantCrop` plot requirement; migration/partialize/reset.
- `src/game/components/Plots.jsx` — new: instanced soil patches + erase hotspots.
- `src/game/components/MapGrid.jsx` — hoe-equipped click tills instead of gathering.
- `src/game/components/PlacementSystem.jsx` — eraser recognizes plots; ghost logic.
