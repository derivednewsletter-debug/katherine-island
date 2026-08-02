# 🌴 Katherine's Island

A cozy 3D island-builder & virtual-pet game built with **React**, **React Three Fiber**, and **Three.js** — part Taonga-style island, part Tamagotchi.

## Features

- **Isometric 3D island** — a **massive low-poly, toon-shaded archipelago**: a hand-authored 14×14 grid became a **160×160 (~25K tile) island generated from seeded noise** — ragged coastline, beach rings, dense jungle, hill country, and mountain peaks, with the shop kiosk, pet bed, and spawn placed programmatically. It's built for weeks of exploration: pan across biomes, zoom out to see the whole world. Rendering uses **InstancedMeshes** (every terrain and prop part is one shared draw call) and heap-based A\* keeps pathfinding fast on the big grid.
- **A wandering pet** — a cute critter that strolls the island using A\* pathfinding over walkable tiles, with idle/walk/sit animations, blinking, and click-to-pet hearts.
- **Feeding** — hold a gathered 🍓 (or hit the Feed button) and click the pet to watch it munch, hearts and all, restoring hunger and happiness.
- **Needs & moods** — hunger/energy/happiness drain over the shared game clock, mood (happy/content/hungry/tired/sad) changes walk speed and animations, and a HUD shows live bars. Needs are **day-aware**: active days burn hunger faster, restless nights burn energy faster, and the calm night slows the happiness drain so the pet's mood reads one tier happier after dark.
- **Sleep cycle** — when night falls the pet walks to its cushioned mat, curls up, and recharges energy while the day-night cycle rolls on; the mood emoji swaps to a floating 💤 and dawn wakes it with a stretch. (The 🌙 Night button is a great way to watch it tuck in.)
- **Gathering economy** — click tiles to harvest resources by terrain (🍓 berries from grass, 🐚 shells from sand, 🪨 stones from hills) with animated 3D pickups and a live inventory HUD. Gatherable tiles show a tiny resource node (bush / shells / rocks) that disappears while the tile regrows.
- **Living world** — animated bobbing water, seeded palm trees/rocks/flowers, a slow day-night lighting cycle, and procedural ocean ambience (WebAudio, no audio files).
- **Sound design** — fully procedural WebAudio (no audio files): harvest pops, pickup chimes, an evolution fanfare, and a soft ambient music bed that shifts between a warm daytime chord progression and a lower, darker nighttime one by reading the game clock. One 🔊 master toggle (bottom-right) controls ocean, music, and effects together.
- **Quest board** — the 📋 button (top-left) lists simple goals that give the loop purpose (gather 10 berries, pet the creature 5 times, buy a decoration, feed a berry). Live progress bars fill as you play; finishing a quest lights up a Claim button that pays a berry/stone reward with a little chime. Progress persists across reloads.
- **Shared game clock** — a Zustand-backed time system with pause and 1×/2×/4× speed controls that every future system (needs, crops) can tick off.
- **Creature growth** — petting and steady care earn evolution points; once enough are banked the pet grows from baby to adult with a bigger body, a new color palette, and a celebratory spark burst.
- **Beach shop** — spend gathered goods at a 3D market stall (or the HUD button) on upgrades (gather bonuses, slower need drain) and on unlocking exotic decorations (fountain, lantern) for the build palette.
- **Pet eggs & new friends** — the shop also sells eggs for other critters (🐰 bunny, 🐱 kitty, 🦆 duckling). Buy an egg, click its chip under the inventory, and place it on the island: it wobbles with a live **m:ss countdown** and hatches after **10 real minutes** into a brand-new pet that wanders alongside your starter. Name it at the hatch moment (its name tag floats above its head), then select any pet in the needs HUD to check up on and feed it. Each hatched pet has its own needs and sleep cycle.
- **Crop farming** — the 🌱 Plant row under the build palette lets you grow crops **only in the biome they belong to**: berry bushes and flower patches on grass/jungle, 🍇 jungle fruit deep in the jungle, and 🌿 mountain herbs on the peaks. Crops sprout through seed → sprout → grown → ready stages on the game clock (pause freezes them, fast-forward accelerates, the day-night cycle is the backdrop), then you click the ripe crop to harvest its reward. Harvests feed the economy: berries fill hunger, fruit is a heartier meal, herbs restore energy, and flowers lift happiness.
- **Fog of war** — unseen regions of the island (and the minimap) sit under a dark mist until the camera visits them; the minimap header tracks your **% explored** and celebrates at ✨ 100%, giving the huge map a discovery-driven reason to roam. Explored progress survives reloads.
- **Pet territories** — every hatched pet is born at a **home anchor** in its species' habitat (bunnies in meadows, kitties in jungle, ducklings on the beach), far from spawn, and roams a big radius around its home — so the herd scatters across the island.
- **Minimap** — a pixel-per-tile overview of the whole island in the bottom-left corner with a live white rectangle showing exactly what the camera sees, clickable waypoints (🐾 home, 🛒 shop, 🛏️ bed) that smoothly fly the camera there, and a pulsing dot for your pet. Hatched pets are **species-colored dots ringed by their territory** — click a dot or ring to fly to that critter or its home. Click anywhere on the map to travel.
- **Saving** — progress (inventory, needs, growth, shop unlocks, decorations, pets & eggs) auto-saves to localStorage and syncs to a **Neon (serverless Postgres) cloud save** when the API is deployed, so the island follows you across devices; the 🔄 Reset button (bottom-left, two clicks) wipes both local and cloud saves. Incubating eggs keep their countdown across reloads.

## Tech Stack

| Layer      | Tool                             |
| ---------- | -------------------------------- |
| UI         | React 18 + Vite 6                |
| 3D         | React Three Fiber + drei + three |
| State      | Zustand                          |
| Audio      | Web Audio API (procedural)       |
| Database   | Neon (serverless Postgres)       |
| Deploy     | Vercel                           |

## Getting Started

```bash
npm install
npm run dev      # start the dev server at http://localhost:5173
npm run build    # production build into dist/
npm run preview  # preview the production build locally
```

## Controls

- **Left-click** a tile to gather its resource; click the pet to pet it.
- **Right-click drag** to pan, **scroll** to zoom.
- **Minimap** (bottom-left): click a waypoint or anywhere on the map to fly there.
- **Pause / speed** controls live in the bottom-left HUD.

## Deploying to Vercel

This repo ships with `vercel.json` (framework: `vite`, output: `dist`). Push to GitHub, then import the repo in Vercel — the build command and output directory are auto-detected. The `api/` folder becomes serverless functions automatically.

### Cloud saves with Neon

The game saves locally by default and works offline. To enable cross-device cloud saves:

1. **Create a Neon project** (free tier is fine): [console.neon.tech](https://console.neon.tech) → New Project, or via CLI:
   ```bash
   npm i -g neonctl
   neonctl auth login
   neonctl projects create --name katherine-island
   ```
2. **Grab the pooled connection string** (Neon dashboard → Connection Details → *Pooled* connection string).
3. **Create the table** (one-time):
   ```bash
   psql "$DATABASE_URL" -f db/init.sql
   ```
4. **Set the env var in Vercel** (Project → Settings → Environment Variables):
   ```
   DATABASE_URL = postgresql://…-pooler…
   ```
   The handler lives in `api/save.js` (`GET` read / `PUT` upsert / `DELETE` wipe). It's server-only — the connection string is never shipped to the client.
5. **Redeploy** — saves now sync to Neon; a reload on another device pulls the newer of local vs cloud.

> The game never breaks without the DB: every sync call is best-effort and falls back to localStorage when the API is absent or offline.

## Project Structure

```
src/
├── App.jsx                  # Root: canvas + HUD overlays
├── game/
│   ├── ai/pathfinding.js    # Heap-based A* over the big island grid
│   ├── audio/ocean.js       # Procedural ocean ambience
│   ├── components/          # GameScene, MapGrid (instanced tiles), InstancedField, Creature, Pet, Eggs, Decorations, DayNightCycle, Pickup
│   ├── data/                # mapData (procedural island generator), resources, species catalog
│   ├── state/               # Zustand game store + shared game clock
│   └── ui/                  # InventoryHud, NeedsHud, ShopHud, NamingModal, TimeControl
```
