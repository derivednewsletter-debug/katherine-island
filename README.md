# 🌴 Katherine's Island

A cozy 3D island-builder & virtual-pet game built with **React**, **React Three Fiber**, and **Three.js** — part Taonga-style island, part Tamagotchi.

## Features

- **Isometric 3D island** — a 12×12 low-poly, toon-shaded tile grid (water, shallow, sand, grass, hills) viewed from a locked isometric camera with pan/zoom controls.
- **A wandering pet** — a cute critter that strolls the island using A\* pathfinding over walkable tiles, with idle/walk/sit animations, blinking, and click-to-pet hearts.
- **Gathering economy** — click tiles to harvest resources by terrain (🍓 berries from grass, 🐚 shells from sand, 🪨 stones from hills) with animated 3D pickups and a live inventory HUD.
- **Living world** — animated bobbing water, seeded palm trees/rocks/flowers, a slow day-night lighting cycle, and procedural ocean ambience (WebAudio, no audio files).
- **Shared game clock** — a Zustand-backed time system with pause and 1×/2×/4× speed controls that every future system (needs, crops) can tick off.

## Tech Stack

| Layer      | Tool                             |
| ---------- | -------------------------------- |
| UI         | React 18 + Vite 6                |
| 3D         | React Three Fiber + drei + three |
| State      | Zustand                          |
| Audio      | Web Audio API (procedural)       |
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
- **Pause / speed** controls live in the bottom-left HUD.

## Deploying to Vercel

This repo ships with `vercel.json` (framework: `vite`, output: `dist`). Push to GitHub, then import the repo in Vercel — the build command and output directory are auto-detected.

## Project Structure

```
src/
├── App.jsx                  # Root: canvas + HUD overlays
├── game/
│   ├── ai/pathfinding.js    # A* pathfinding over the island grid
│   ├── audio/ocean.js       # Procedural ocean ambience
│   ├── components/          # GameScene, MapGrid, Tile, Creature, Decorations, DayNightCycle, Pickup
│   ├── data/                # mapData (island grid), resources config
│   ├── state/               # Zustand game store + shared game clock
│   └── ui/                  # InventoryHud, TimeControl
```
