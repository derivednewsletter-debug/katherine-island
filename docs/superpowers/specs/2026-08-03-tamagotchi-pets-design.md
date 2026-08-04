# Tamagotchi Pets — Design

Date: 2026-08-03

## Problem

Pets are decorative today: needs drain slowly, the only consequence of neglect is a
sad emoji, growth caps at two stages with no end, and the only real interaction is
click-to-feed raw berries. The player asked for the pets to feel Tamagotchi-like:
needs that matter and have consequences, a real lifecycle, and a set of meaningful
interactions (cooking, bathing, walking together, fetch).

## Goal

Make pets feel alive and consequential:
- A new **hygiene** need plus **sickness** (hunger/hygiene neglect) that requires a
  **cure** item.
- **Runaway** on sustained happiness neglect — recoverable through a **find-my-pet
  quest**.
- A full **4-stage lifecycle** (`baby → child → adult → elder`) ending in a final
  **elder death** that leaves a **memorial** and a fresh egg.
- **Rename anytime** after hatching.
- New interactions: **cooked food** (stove + grill appliances), **bathing**,
  **walk/follow**, and **fetch/chase**.
- Needs decay faster and matter more.

## Approach

**Extend in place** (keep the current store shape): add per-pet fields
(`hygiene`, `sick`, `sickSinceGame`, `ranAway`, `memorial`, `ageDays`) and a small
state-machine module (`petStates.js`) that derives `healthy | sick | runaway |
elder` from needs and emits events (cure needed, find quest, memorial) through the
existing toast/quest paths. Extend `GROWTH` to four stages. Cooked meals become new
resources that extend `FEED_BY_RESOURCE`; stove/grill are new placeable build kinds.

## Design

### 1. Needs & hygiene

- Add `hygiene` (0–100) to `needs` for the starter creature and every hatched pet,
  drained by the existing needs system.
- Raise `NEED_DRAIN` baselines so needs decay noticeably faster (~1.5× today).
- **Bathing**: hold a **soap** item and click the pet → hygiene restored, hearts.
  Soap is bought at the shop.

### 2. Sickness (hunger + hygiene) — needs a cure

- A pet whose `hunger < 25` **or** `hygiene < 25` becomes **Sick** (new mood `sick`,
  "🤒", green/dull visuals).
- While sick: needs drain faster and the pet earns **no** care points.
- **Cure**: hold a **medkit** and click the pet → hunger + hygiene restored, pet
  healed. Medkit bought at the shop (or crafted later).

### 3. Runaway (happiness) — recoverable via quest

- A pet whose `happiness` stays below a low threshold (`< 15`) for a grace window
  (e.g. a few game-hours) **runs away**.
- Running away triggers a **find-my-pet quest** (new quest type `pet:rescue`). The
  pet is marked `ranAway` and no longer roams; the quest directs the player to
  retrieve it (walk to a marker / pick it up).
- Recovery restores the pet (renamed/cared-for) with a reunion moment.

### 4. Lifecycle — 4 stages + elder death

- Extend `GROWTH`: `baby → child → adult → elder`, each with a `required` care
  count (child ~5, adult ~15, elder ~40) and per-stage visual scale/colors.
- Elder: after reaching `elder`, the pet lives a long elder phase, then **passes
  away** after N game-days.
- On death: a **memorial prop** appears at the pet's home anchor and a **fresh egg**
  is granted so the loop can restart.

### 5. Rename anytime

- New `renamePet(id, name)` action (extends the existing `namePet` hatch flow) plus
  a rename affordance in the pet HUD, reusing the naming modal.

### 6. Cooked food + appliances

- New placeable build kinds: **Stove** and **Grill**, unlocked at the shop.
- New resources / craftables: raw ingredients combine at stove/grill into
  **stew** (hunger + hygiene) and **grilled** (hunger + energy). Extend
  `FEED_BY_RESOURCE`; crafting buttons appear on the appliance.

### 7. Walk/follow & fetch/chase

- **Follow**: call a pet (HUD control) → it walks alongside the player for a while,
  lifting happiness with hearts.
- **Fetch/chase**: throw a toy (HUD/ball item) → pet runs to it and brings it back →
  happiness bump + a care point.

### 8. UI

- `NeedsHud`: add a hygiene bar, a sick indicator, and a per-pet rename entry;
  surface runaway/find-my-pet state and the memorial chip.
- `QuestBoard` / minimap: surface the rescue quest marker and memorials.

## Files touched

- `src/game/state/gameStore.js` — `hygiene` in needs; per-pet `sick`/`ranAway`/
  `memorial`/`ageDays`; 4-stage `GROWTH`; `addHygiene`/`curePet`/`runawayPet`/
  `renamePet`/`rescuePet`/`recordDeath`; `NEED_DRAIN` tuning; new resources in
  `FEED_BY_RESOURCE`; migration/partialize/reset.
- `src/game/state/needs.js` — hygiene drain + sick/runaway state machine hooks.
- `src/game/state/petStates.js` — new: state machine `healthy | sick | runaway |
  elder` derivation + event emission.
- `src/game/components/Creature.jsx` — starter pet sick/runaway/elder visuals,
  bath/cure/fetch/follow interactions.
- `src/game/components/Pet.jsx` — hatched pets same visuals/interactions.
- `src/game/components/petParts.js` — sick/elder part styling, memorial prop.
- `src/game/components/PlacementSystem.jsx` / `MapGrid.jsx` — stove/grill build
  kinds; appliance craft buttons.
- `src/game/ui/NeedsHud.jsx` — hygiene bar, sick indicator, rename entry, fetch/
  follow/bathe/cook controls.
- `src/game/data/quests.js` — `pet:rescue` quest type.
- `src/game/data/icons.js` / `ShopHud.jsx` — soap/medkit/toy/stove/grill art + shop.

## Save compatibility

- `hygiene` backfilled to 100 in rehydrate for existing pets/creature.
- New fields (`sick`, `ranAway`, `memorial`, `ageDays`, new resources) backfilled
  with safe defaults.
- Added to `partialize`; cleared in `resetGame`.
