import React, { useMemo } from 'react';
import { gridToWorld, getTile, GRID_SIZE, isWalkable } from '../data/mapData';
import { TILE_THICKNESS } from './Tile';

/**
 * Deterministic PRNG (mulberry32) so the island's decorations are identical
 * on every load — no layout flicker between re-renders.
 */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Low-poly palm tree: leaning trunk + fan of fronds. */
function PalmTree({ scale = 1, rot = 0 }) {
  return (
    <group scale={scale} rotation={[0, rot, 0]}>
      {/* Trunk (slight lean) */}
      <mesh position={[0, 0.28, 0]} rotation={[0, 0, -0.12]} castShadow>
        <cylinderGeometry args={[0.045, 0.07, 0.6, 6]} />
        <meshToonMaterial color="#b0885a" />
      </mesh>
      {/* Fronds fanning out from the top */}
      {[0, 1, 2, 3, 4, 5].map((i) => {
        const angle = (i / 6) * Math.PI * 2;
        return (
          <mesh
            key={i}
            position={[Math.cos(angle) * 0.06, 0.6, Math.sin(angle) * 0.06]}
            rotation={[Math.sin(angle) * -0.7, 0, Math.cos(angle) * -0.7]}
            castShadow
          >
            <coneGeometry args={[0.045, 0.26, 5]} />
            <meshToonMaterial color={i % 2 === 0 ? '#3f9e4d' : '#57b95f'} />
          </mesh>
        );
      })}
      {/* Coconut */}
      <mesh position={[0, 0.56, 0]} castShadow>
        <sphereGeometry args={[0.055, 8, 8]} />
        <meshToonMaterial color="#8a5a2b" />
      </mesh>
    </group>
  );
}

/** Low-poly rock cluster. */
function Rock({ scale = 1, rot = 0 }) {
  return (
    <group scale={scale} rotation={[0, rot, 0]}>
      <mesh position={[0, 0.09, 0]} castShadow>
        <icosahedronGeometry args={[0.16, 0]} />
        <meshToonMaterial color="#9aa3ab" flatShading />
      </mesh>
      <mesh position={[0.13, 0.05, 0.08]} scale={0.7} castShadow>
        <icosahedronGeometry args={[0.14, 0]} />
        <meshToonMaterial color="#aeb7bf" flatShading />
      </mesh>
      <mesh position={[-0.12, 0.03, -0.06]} scale={0.5} castShadow>
        <icosahedronGeometry args={[0.13, 0]} />
        <meshToonMaterial color="#88939c" flatShading />
      </mesh>
    </group>
  );
}

/** Simple flower: stem + pastel petals. */
function Flower({ scale = 1, rot = 0 }) {
  return (
    <group scale={scale} rotation={[0, rot, 0]}>
      <mesh position={[0, 0.1, 0]} castShadow>
        <cylinderGeometry args={[0.012, 0.02, 0.2, 5]} />
        <meshToonMaterial color="#4c9e4f" />
      </mesh>
      {/* Petals */}
      {[0, 1, 2, 3, 4].map((i) => {
        const angle = (i / 5) * Math.PI * 2;
        return (
          <mesh
            key={i}
            position={[Math.cos(angle) * 0.045, 0.21, Math.sin(angle) * 0.045]}
            castShadow
          >
            <sphereGeometry args={[0.028, 8, 8]} />
            <meshToonMaterial color="#ff9eb0" />
          </mesh>
        );
      })}
      {/* Center */}
      <mesh position={[0, 0.22, 0]} castShadow>
        <sphereGeometry args={[0.03, 8, 8]} />
        <meshToonMaterial color="#ffd166" />
      </mesh>
    </group>
  );
}

/**
 * Scatters decorative props (palms, rocks, flowers) on walkable tiles.
 * Placement is deterministic via a fixed seed, and every prop sits on the
 * tile's surface so it looks planted rather than floating.
 */
export default function Decorations() {
  const items = useMemo(() => {
    const rng = mulberry32(20260801);
    const list = [];

    // Creature spawns at grid (4,4) — keep a small clearing around it so
    // the pet never loads inside a palm tree.
    const SPAWN = { row: 4, col: 4 };

    for (let row = 0; row < GRID_SIZE; row++) {
      for (let col = 0; col < GRID_SIZE; col++) {
        const tile = getTile(row, col);
        if (!tile || !isWalkable(tile)) continue;
        // Leave the spawn tile + its immediate ring empty
        if (Math.abs(row - SPAWN.row) <= 1 && Math.abs(col - SPAWN.col) <= 1) continue;

        const r = rng();
        let kind = null;

        if (tile.type === 'grass') {
          if (r < 0.14) kind = 'palm';
          else if (r < 0.2) kind = 'rock';
          else if (r < 0.3) kind = 'flower';
        } else if (tile.type === 'sand') {
          if (r < 0.18) kind = 'palm';
          else if (r < 0.24) kind = 'rock';
        } else if (tile.type === 'hill') {
          if (r < 0.3) kind = 'palm';
        }

        if (!kind) continue;

        const { x, z } = gridToWorld(row, col);
        // Small random offset so props don't look machine-aligned
        const jitter = 0.18;
        list.push({
          kind,
          x: x + (rng() - 0.5) * jitter,
          z: z + (rng() - 0.5) * jitter,
          y: tile.height + TILE_THICKNESS, // top surface of the tile
          rot: rng() * Math.PI * 2,
          scale: 0.75 + rng() * 0.55,
        });
      }
    }

    return list;
  }, []);

  return (
    <group>
      {items.map((item, i) => {
        const props = {
          position: [item.x, item.y, item.z],
          rotation: [0, item.rot, 0],
          scale: item.scale,
        };
        if (item.kind === 'palm') return <PalmTree key={i} {...props} />;
        if (item.kind === 'rock') return <Rock key={i} {...props} />;
        return <Flower key={i} {...props} />;
      })}
    </group>
  );
}
