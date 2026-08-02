import React, { useCallback, useEffect, useMemo, useRef, useLayoutEffect, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import Pickup from './Pickup';
import InstancedField from './InstancedField';
import {
  mapData,
  GRID_SIZE,
  worldToGrid,
  gridToWorld,
  getTile,
  TERRAIN_TYPES,
} from '../data/mapData';
import { resourceForTerrain, GATHER_COOLDOWN_MS } from '../data/resources';
import { KIOSK_TILE } from '../data/shop';
import { useGameStore } from '../state/gameStore';
import { playGatherPop } from '../audio/sfx';
import { TILE_THICKNESS } from './Tile';

const TILE_W = 0.95; // tile top-face width (mirrors Tile.jsx)
const CAP_H = 0.05; // toon top-cap thickness

// ── Static per-terrain cell lists (computed once at module scope) ──
const OFF = (GRID_SIZE - 1) / 2;
const TERRAIN_LISTS = {};
for (let row = 0; row < GRID_SIZE; row++) {
  for (let col = 0; col < GRID_SIZE; col++) {
    const tile = mapData[row][col];
    (TERRAIN_LISTS[tile.type] ??= []).push({ row, col, x: col - OFF, z: row - OFF, tile });
  }
}

/**
 * One terrain type rendered as TWO InstancedMeshes: a darker body box
 * (stretched to the tile's height) and a lighter top cap — the same
 * two-tone toon look as the old per-tile boxes, but the whole terrain
 * renders in two draw calls no matter how many tiles it spans.
 */
const TerrainTiles = React.memo(function TerrainTiles({ type }) {
  const list = TERRAIN_LISTS[type] ?? [];
  const bodyRef = useRef();
  const capRef = useRef();

  const colors = useMemo(() => {
    const base = new THREE.Color(TERRAIN_TYPES[type].color);
    return {
      side: base.clone().multiplyScalar(0.72),
      top: base.clone().multiplyScalar(1.18),
    };
  }, [type]);

  useLayoutEffect(() => {
    const body = bodyRef.current;
    const cap = capRef.current;
    if (!body || !cap) return;
    const dummy = new THREE.Object3D();
    for (let i = 0; i < list.length; i++) {
      const { x, z, tile } = list[i];
      const h = tile.height + TILE_THICKNESS;
      const bodyH = h - CAP_H;
      dummy.position.set(x, bodyH / 2, z);
      dummy.scale.set(1, bodyH, 1);
      dummy.updateMatrix();
      body.setMatrixAt(i, dummy.matrix);
      dummy.position.set(x, h - CAP_H / 2, z);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      cap.setMatrixAt(i, dummy.matrix);
    }
    body.instanceMatrix.needsUpdate = true;
    cap.instanceMatrix.needsUpdate = true;
  }, [list]);

  if (list.length === 0) return null;
  return (
    <>
      <instancedMesh ref={bodyRef} args={[null, null, list.length]} castShadow receiveShadow raycast={() => null}>
        <boxGeometry args={[TILE_W, 1, TILE_W]} />
        <meshToonMaterial color={colors.side} />
      </instancedMesh>
      <instancedMesh ref={capRef} args={[null, null, list.length]} receiveShadow raycast={() => null}>
        <boxGeometry args={[TILE_W, CAP_H, TILE_W]} />
        <meshToonMaterial color={colors.top} />
      </instancedMesh>
    </>
  );
});

// ── Animated ocean: an instanced shader field so ALL water tiles wave in
//    a single draw call (per-tile shimmer planes would be 10K+ meshes). ──
// NOTE: three.js auto-injects `attribute mat4 instanceMatrix;` into the
// vertex prefix for any material on an InstancedMesh — declaring it again
// here would be a duplicate-symbol link error ("useProgram: program not
// valid"), so we rely on the injected declaration.
const WATER_VERT = /* glsl */ `
  uniform float uTime;
  varying float vWave;
  void main() {
    vec4 w = instanceMatrix * vec4(position, 1.0);
    float wv = sin(w.x * 1.5 + uTime * 1.7) * 0.5 + sin(w.z * 2.1 + uTime * 2.2 + 1.3) * 0.5;
    w.y += wv * 0.035;
    vWave = wv;
    gl_Position = projectionMatrix * modelViewMatrix * w;
  }
`;

const WATER_FRAG = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  varying float vWave;
  void main() {
    vec3 c = mix(uColor, vec3(1.0), smoothstep(-0.4, 1.0, vWave) * 0.5);
    gl_FragColor = vec4(c, uOpacity);
  }
`;

const WaterField = React.memo(function WaterField({ type }) {
  const list = TERRAIN_LISTS[type] ?? [];
  const ref = useRef();
  const uniforms = useRef({
    uTime: { value: 0 },
    uColor: { value: new THREE.Color(type === 'water' ? '#2a5fbf' : '#5cb0ea') },
    uOpacity: { value: type === 'water' ? 0.55 : 0.7 },
  });

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const dummy = new THREE.Object3D();
    for (let i = 0; i < list.length; i++) {
      const { x, z, tile } = list[i];
      dummy.position.set(x, tile.height + TILE_THICKNESS + 0.05, z);
      dummy.rotation.set(-Math.PI / 2, 0, 0);
      dummy.scale.set(0.85, 0.85, 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }, [list]);

  useFrame(({ clock }) => {
    uniforms.current.uTime.value = clock.getElapsedTime();
  });

  if (list.length === 0) return null;
  return (
    <instancedMesh ref={ref} args={[null, null, list.length]} raycast={() => null}>
      <planeGeometry args={[1, 1]} />
      <shaderMaterial
        uniforms={uniforms.current}
        vertexShader={WATER_VERT}
        fragmentShader={WATER_FRAG}
        transparent
        depthWrite={false}
      />
    </instancedMesh>
  );
});

// ── Instanced resource nodes (bushes / shells / rocks) ──
// One InstancedField per gatherable terrain; harvested tiles are excluded
// from the instance list while on cooldown (they "disappear" then pop back).
const NODE_PARTS = {
  berry: [
    { geom: 'icosa', args: [0.055, 0], pos: [0, 0.09, 0], rot: [0, 0, 0], color: '#5caf5c' },
    { geom: 'icosa', args: [0.045, 0], pos: [0.06, 0.085, 0.02], rot: [0, 0, 0], color: '#6cc46c' },
    { geom: 'sphere', args: [0.016, 6, 5], pos: [-0.05, 0.05, 0.05], rot: [0, 0, 0], color: '#ff5d7e' },
    { geom: 'sphere', args: [0.014, 6, 5], pos: [0.055, 0.09, 0.02], rot: [0, 0, 0], color: '#ff7d9a' },
  ],
  shell: [
    { geom: 'sphere', args: [0.07, 8, 6], pos: [-0.06, 0.035, 0.01], rot: [0.4, 0.3, 0.2], pscale: [1, 0.45, 0.75], color: '#fff3e2' },
    { geom: 'sphere', args: [0.06, 8, 6], pos: [0.04, 0.03, 0.03], rot: [0.5, -0.4, 0.3], pscale: [1, 0.45, 0.7], color: '#ffd9b0' },
    { geom: 'sphere', args: [0.05, 8, 6], pos: [-0.01, 0.028, -0.05], rot: [0.35, 0.9, 0.15], pscale: [1, 0.45, 0.65], color: '#ffc2d4' },
  ],
  stone: [
    { geom: 'dodeca', args: [0.062, 0], pos: [-0.05, 0.07, 0.01], rot: [0.2, 0.3, 0.1], color: '#aab4bf' },
    { geom: 'dodeca', args: [0.048, 0], pos: [0.05, 0.055, 0.02], rot: [0.1, -0.4, 0.2], color: '#8f9aa6' },
    { geom: 'dodeca', args: [0.04, 0], pos: [-0.01, 0.045, -0.06], rot: [0.4, 0.8, 0.1], color: '#bcc6d0' },
  ],
};

const TERRAIN_NODE = { grass: 'berry', jungle: 'berry', sand: 'shell', hill: 'stone', peak: 'stone' };

/** Deterministic per-tile pseudo-random (same tile always looks the same). */
function hash(r, c) {
  let h = (r * 374761393 + c * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h = (h ^ (h >>> 16)) >>> 0;
  return (h % 10000) / 10000;
}

const ResourceNodeField = React.memo(function ResourceNodeField({ type, depleted }) {
  const list = TERRAIN_LISTS[type] ?? [];
  const swayRef = useRef();

  const entries = useMemo(() => {
    const out = [];
    for (const cell of list) {
      if (depleted.has(`${cell.row},${cell.col}`)) continue;
      const seed = hash(cell.row, cell.col);
      out.push({
        x: cell.x,
        z: cell.z,
        y: cell.tile.height + TILE_THICKNESS + 0.02,
        rot: seed * Math.PI * 2,
        scale: 0.6 + seed * 0.3,
      });
    }
    return out;
  }, [list, depleted]);

  // Gentle whole-field sway so the island feels alive (one cheap rotation)
  useFrame(({ clock }) => {
    if (swayRef.current) swayRef.current.rotation.y = Math.sin(clock.getElapsedTime() * 0.4) * 0.02;
  });

  if (!TERRAIN_NODE[type] || list.length === 0) return null;
  return (
    <group ref={swayRef}>
      <InstancedField entries={entries} parts={NODE_PARTS[TERRAIN_NODE[type]]} />
    </group>
  );
});

/** Small ring marker on a tile (hover hint / gather confirmation). */
function RingMarker({ row, col, color, opacity = 0.7 }) {
  const tile = getTile(row, col);
  if (!tile) return null;
  const { x, z } = gridToWorld(row, col);
  return (
    <mesh
      position={[x, tile.height + TILE_THICKNESS + 0.06, z]}
      rotation={[-Math.PI / 2, 0, 0]}
      raycast={() => null}
    >
      <ringGeometry args={[0.32, 0.42, 4]} />
      <meshBasicMaterial color={color} transparent opacity={opacity} side={THREE.DoubleSide} depthWrite={false} />
    </mesh>
  );
}

/**
 * Renders the full massive tile grid as instanced meshes. One invisible
 * interaction plane resolves hover + click-to-gather via worldToGrid (no
 * per-tile raycasting), while pickups bounce in from harvested tiles.
 */
export default function MapGrid() {
  const [hovered, setHovered] = useState(null); // { row, col }
  const [selected, setSelected] = useState(null);
  const [pickups, setPickups] = useState([]);

  // Per-tile last-gathered timestamp for regrowth pacing
  const lastGathered = useRef(new Map());
  const pickupId = useRef(0);

  // Tiles currently harvested & regrowing (their resource node is hidden)
  const [depleted, setDepleted] = useState(() => new Set());
  const regrowTimers = useRef(new Map());

  // Clear pending regrow timers on unmount (StrictMode-safe)
  useEffect(() => {
    const timers = regrowTimers.current;
    return () => {
      timers.forEach((t) => clearTimeout(t));
      timers.clear();
    };
  }, []);

  const handleMove = useCallback((e) => {
    const { row, col } = worldToGrid(e.point.x, e.point.z);
    setHovered((prev) =>
      prev && prev.row === row && prev.col === col ? prev : { row, col }
    );
  }, []);

  const handleClick = useCallback((e) => {
    // In build mode clicks plant decorations instead of gathering
    if (useGameStore.getState().placement.active) return;

    const { row, col } = worldToGrid(e.point.x, e.point.z);
    const tile = getTile(row, col);
    if (!tile) return;
    setSelected({ row, col });

    const resource = resourceForTerrain(tile.type);
    if (!resource) return; // water/shallow: nothing to gather

    // The shop kiosk owns its tile — clicking the stall shouldn't also
    // harvest the sand beneath it.
    if (row === KIOSK_TILE.row && col === KIOSK_TILE.col) return;

    const key = `${row},${col}`;
    const now = performance.now();
    const last = lastGathered.current.get(key) ?? 0;
    if (now - last < GATHER_COOLDOWN_MS) return; // still regrowing

    lastGathered.current.set(key, now);

    // Hide the tile's resource node for the cooldown window, then pop it
    // back in when the tile regrows.
    setDepleted((prev) => new Set(prev).add(key));
    regrowTimers.current.set(
      key,
      setTimeout(() => {
        regrowTimers.current.delete(key);
        setDepleted((prev) => {
          if (!prev.has(key)) return prev;
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      }, GATHER_COOLDOWN_MS)
    );

    // Shop upgrades grant +1 per gather for their resource
    const s = useGameStore.getState();
    const bonus =
      {
        berry: s.upgrades.berryBasket ? 1 : 0,
        shell: s.upgrades.shellBucket ? 1 : 0,
        stone: s.upgrades.stonePick ? 1 : 0,
      }[resource] ?? 0;
    const amount = 1 + bonus;

    // Credit inventory in the global store (notifies the HUD)
    s.addResource(resource, amount);

    // Quest board: gathering counts toward gather:<resource> quests
    s.recordQuestProgress(`gather:${resource}`, amount);

    // Harvest pop — one per click (not per bonus unit, keeps it tidy)
    playGatherPop();

    // Spawn a pickup per unit so doubled harvests visibly pop twice
    const { x, z } = gridToWorld(row, col);
    const base = pickupId.current;
    pickupId.current += amount;
    const fresh = Array.from({ length: amount }, (_, i) => ({
      id: base + i,
      resource,
      position: [
        x + (i === 0 ? 0 : 0.06),
        tile.height + TILE_THICKNESS,
        z + (i === 1 ? 0.06 : 0),
      ],
    }));
    setPickups((prev) => [...prev, ...fresh]);
  }, []);

  const removePickup = useCallback((id) => {
    setPickups((prev) => prev.filter((p) => p.id !== id));
  }, []);

  return (
    <group>
      {/* Tiles — every terrain type as instanced body + cap */}
      {Object.keys(TERRAIN_TYPES).map((type) => (
        <TerrainTiles key={type} type={type} />
      ))}

      {/* Animated ocean shimmer on top of the water tiles */}
      <WaterField type="water" />
      <WaterField type="shallow" />

      {/* Resource nodes (bush / shells / rocks) — hidden while depleted */}
      {Object.keys(TERRAIN_NODE).map((type) => (
        <ResourceNodeField key={type} type={type} depleted={depleted} />
      ))}

      {/* Hover hint + gather-confirmation rings */}
      {hovered && <RingMarker row={hovered.row} col={hovered.col} color="#ffffff" opacity={0.4} />}
      {selected && <RingMarker row={selected.row} col={selected.col} color="#ffd700" />}

      {/* Animated resource pickups */}
      {pickups.map((p) => (
        <Pickup
          key={p.id}
          resource={p.resource}
          position={p.position}
          onDone={() => removePickup(p.id)}
        />
      ))}

      {/* Invisible interaction plane — the single raycast target for hover
          and gathering (props/tiles disable raycasting). Sits below the
          tiles; entity clicks (pet/kiosk/eggs) stop propagation first. */}
      <mesh
        position={[0, -0.5, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        visible={false}
        onPointerMove={handleMove}
        onPointerOut={() => setHovered(null)}
        onClick={handleClick}
      >
        <planeGeometry args={[GRID_SIZE * 3, GRID_SIZE * 3]} />
      </mesh>

      {/* Base ocean plane — a wide rim around the island */}
      <mesh position={[0, -0.2, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow raycast={() => null}>
        <planeGeometry args={[GRID_SIZE * 1.8, GRID_SIZE * 1.8]} />
        <meshBasicMaterial color="#1e4a7a" />
      </mesh>

      {/* Distant horizon plane far behind the island */}
      <mesh position={[0, -0.3, 0]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
        <planeGeometry args={[GRID_SIZE * 14, GRID_SIZE * 14]} />
        <meshBasicMaterial color="#5a8fc9" />
      </mesh>
    </group>
  );
}
