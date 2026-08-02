import React, { useEffect, useRef } from 'react';

import {
  mapData,
  GRID_SIZE,
  gridToWorld,
  SPAWN_POINT,
  BED_SPOT,
  KIOSK_TILE,
} from '../data/mapData';
import { useGameStore } from '../state/gameStore';
import { getCameraState, panTo } from '../state/cameraBus';
import { PET_SPECIES, PET_HOME_ROAM_RADIUS } from '../data/species';
import { exploredVersion, isExplored, exploredPercent, isFullyExplored } from '../state/exploration';
import SvgIcon from './SvgIcon';

// One canvas pixel per tile — a crisp pixelated overview of the whole island.
const SIZE = GRID_SIZE;
const OFF = (GRID_SIZE - 1) / 2;

/** World coordinate → minimap percent (centered grid → 0..100). */
const worldToMini = (v) => ((v + OFF) / (GRID_SIZE - 1)) * 100;

/** Places worth flying to — the three anchors every new islander needs. */
const WAYPOINTS = [
  { id: 'spawn', icon: 'egg', label: 'Home', tile: SPAWN_POINT, color: '#7ee8fa' },
  { id: 'shop', icon: 'shop', label: 'Shop', tile: KIOSK_TILE, color: '#ffd166' },
  { id: 'bed', icon: 'bed', label: 'Bed', tile: BED_SPOT, color: '#f2b8d0' },
];

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// Precompute one RGB triple per tile (module scope — runs once)
const TILE_RGB = mapData.map((row) => row.map((t) => hexToRgb(t.color)));

/**
 * Minimap HUD — a full-island overview in the bottom-left corner:
 *
 *  - Terrain painted once onto a small canvas (one pixel per tile).
 *  - FOG OF WAR: a second canvas sits on top and darkens tiles the camera
 *    hasn't visited yet — it repaints only when the exploration version
 *    bumps, and the header shows the explored % (fully explored!).
 *  - A live white rectangle shows exactly what the camera is looking at
 *    (published every frame by CameraTracker via the camera bus).
 *  - Clickable waypoints (Home, Shop, Bed) fly the camera there.
 *  - Clicking anywhere else on the map flies there too.
 *  - A pulsing dot marks your pet; hatched pets are SPECIES-colored dots
 *    ringed by their HOME territory — click a dot or ring to fly there.
 *
 * The viewport rect + pet dots + fog are moved directly via DOM refs on
 * an rAF loop — no React re-render churn at 60fps. Rings are static (they
 * only change when a pet hatches), so they render as normal React elements
 * and participate in the single delegated click handler.
 */
export default function Minimap() {
  const canvasRef = useRef();
  const fogRef = useRef();
  const rectRef = useRef();
  const petsRef = useRef();
  const pctRef = useRef();

  // Re-render the territory-ring layer only when the herd roster changes
  // (hatch/rename), not on every position tick. `name` is in the key so a
  // rename refreshes the ring tooltip.
  const rosterKey = useGameStore((s) =>
    s.pets
      .map((p) => `${p.id}:${p.species}:${p.name}:${p.home?.row ?? ''},${p.home?.col ?? ''}`)
      .join('|')
  );

  // Paint the terrain once (mount only)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const img = ctx.createImageData(SIZE, SIZE);
    const d = img.data;
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const [R, G, B] = TILE_RGB[r][c];
        const i = (r * SIZE + c) * 4;
        d[i] = R;
        d[i + 1] = G;
        d[i + 2] = B;
        d[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }, []);

  // rAF loop: move the viewport rect + pet dots to match the live camera,
  // and repaint the fog layer + explored stat when exploration changes
  useEffect(() => {
    let raf;
    let lastPetsKey = '';
    let lastFogVersion = -1;
    let lastPct = -1;
    const loop = () => {
      const st = getCameraState();
      const rect = rectRef.current;
      if (rect) {
        rect.style.left = `${worldToMini(st.x - st.w / 2)}%`;
        rect.style.top = `${worldToMini(st.z - st.h / 2)}%`;
        rect.style.width = `${(st.w / (GRID_SIZE - 1)) * 100}%`;
        rect.style.height = `${(st.h / (GRID_SIZE - 1)) * 100}%`;
      }
      // Fog of war — repaint the dim overlay only when new tiles are
      // explored (cheap: one pixel per tile, a couple times a second max).
      const fog = fogRef.current;
      const fogVersion = exploredVersion();
      if (fog && fogVersion !== lastFogVersion) {
        lastFogVersion = fogVersion;
        const ctx = fog.getContext('2d');
        const img = ctx.createImageData(SIZE, SIZE);
        const d = img.data;
        for (let r = 0; r < SIZE; r++) {
          for (let c = 0; c < SIZE; c++) {
            const i = (r * SIZE + c) * 4;
            if (isExplored(r, c)) {
              d[i + 3] = 0; // seen — fully transparent
            } else {
              d[i] = 11;
              d[i + 1] = 28;
              d[i + 2] = 51; // dark blue mist
              d[i + 3] = 205;
            }
          }
        }
        ctx.putImageData(img, 0, 0);
      }

      // Explored stat — the header pill, updated only on percent change.
      const pct = isFullyExplored() ? 100 : exploredPercent();
      if (pctRef.current && pct !== lastPct) {
        lastPct = pct;
          pctRef.current.textContent = pct >= 100 ? 'Fully explored!' : `${pct}% explored`;
        pctRef.current.classList.toggle('done', pct >= 100);
      }

      // Pet dots — rebuild only when the roster/positions actually change.
      // Each hatched dot is colored by its species (and carries data-pet-id
      // so the delegated click handler can fly to that critter).
      const s = useGameStore.getState();
      const roster = [
        { id: 'starter', row: s.creaturePos.row, col: s.creaturePos.col, starter: true },
        ...s.pets.map((p) => ({
          id: p.id,
          row: p.pos.row,
          col: p.pos.col,
          starter: false,
          color: PET_SPECIES[p.species]?.dot ?? '#ffffff',
        })),
      ];
      const key = roster.map((p) => `${p.row},${p.col}${p.starter ? 's' : p.id}`).join('|');
      const pets = petsRef.current;
      if (pets && key !== lastPetsKey) {
        lastPetsKey = key;
        pets.innerHTML = roster
          .map((p) => {
            const { x, z } = gridToWorld(p.row, p.col);
            const bg = p.starter ? '' : `background:${p.color};box-shadow:0 0 3px ${p.color};`;
            return `<span class="minimap-pet${p.starter ? ' starter' : ''}" data-pet-id="${p.id}" style="left:${worldToMini(x)}%;top:${worldToMini(z)}%;${bg}"></span>`;
          })
          .join('');
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const flyToTile = (row, col, zoom) => {
    const { x, z } = gridToWorld(row, col);
    panTo(x, z, zoom);
  };

  // Delegated click: pet dot / home ring / waypoint / plain map.
  const handleMapClick = (e) => {
    // A hatched pet dot → fly to the critter itself (closer zoom)
    const petId = e.target?.dataset?.petId;
    if (petId) {
      const s = useGameStore.getState();
      const p = petId === 'starter' ? { pos: s.creaturePos } : s.pets.find((x) => x.id === petId);
      if (p && p.pos) flyToTile(p.pos.row, p.pos.col, 30);
      return;
    }
    // A home territory ring → fly to that pet's home anchor
    const homeId = e.target?.dataset?.homeId;
    if (homeId) {
      const s = useGameStore.getState();
      const p = s.pets.find((x) => x.id === homeId);
      if (p?.home) flyToTile(p.home.row, p.home.col, 24);
      return;
    }
    // Plain map click → fly there at the current zoom
    const box = e.currentTarget.getBoundingClientRect();
    const fx = (e.clientX - box.left) / box.width;
    const fy = (e.clientY - box.top) / box.height;
    panTo(fx * (GRID_SIZE - 1) - OFF, fy * (GRID_SIZE - 1) - OFF);
  };

  // Territory rings (static layer) — one per hatched pet, centered on its
  // home, sized to its roam radius, colored by species.
  const rings = useGameStore
    .getState()
    .pets.filter((p) => p.home && p.home.row !== undefined)
    .map((p) => {
      const { x, z } = gridToWorld(p.home.row, p.home.col);
      const color = PET_SPECIES[p.species]?.dot ?? '#ffffff';
      const size = ((PET_HOME_ROAM_RADIUS * 2) / (GRID_SIZE - 1)) * 100;
      return { id: p.id, name: p.name, x, z, color, size };
    });

  return (
    <div className="minimap">
      <div className="minimap-head">
        <SvgIcon name="map" size={11} /> Island <span ref={pctRef} className="minimap-pct">…</span>
      </div>
      <div className="minimap-body" onClick={handleMapClick}>
        <canvas ref={canvasRef} width={SIZE} height={SIZE} className="minimap-canvas" />
        {/* Fog of war — dims unseen tiles, reveals as the camera visits */}
        <canvas ref={fogRef} width={SIZE} height={SIZE} className="minimap-fog" />
        {/* Live camera viewport rectangle */}
        <div ref={rectRef} className="minimap-viewport" />
        {/* Pet dots (starter + hatched) */}
        <div ref={petsRef} className="minimap-pets" />
        {/* Home territory rings — click to fly to that pet's home */}
        {rings.map((r) => (
          <button
            key={r.id}
            className="minimap-territory"
            data-home-id={r.id}
            title={`${r.name || 'Pet'}'s territory`}
            style={{
              left: `${worldToMini(r.x)}%`,
              top: `${worldToMini(r.z)}%`,
              width: `${r.size}%`,
              height: `${r.size}%`,
              borderColor: r.color,
            }}
          >
            <span className="minimap-home-dot" style={{ background: r.color }} />
          </button>
        ))}
        {/* Waypoint buttons — click to fly */}
        {WAYPOINTS.map((w) => {
          const { x, z } = gridToWorld(w.tile.row, w.tile.col);
          return (
            <button
              key={w.id}
              className="minimap-waypoint"
              title={`Fly to ${w.label}`}
              style={{ left: `${worldToMini(x)}%`, top: `${worldToMini(z)}%`, borderColor: w.color }}
               onClick={(e) => {
                e.stopPropagation();
                flyToTile(w.tile.row, w.tile.col, 22);
              }}
            >
              <SvgIcon name={w.icon} size={12} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
