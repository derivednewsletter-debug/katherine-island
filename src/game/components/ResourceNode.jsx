import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { resourceForTerrain } from '../data/resources';
import { TILE_THICKNESS } from './Tile';

/**
 * Tiny low-poly resource node that sits on gatherable tiles so the economy
 * reads visually: a berry bush on grass, shells on sand, rocks on hills.
 *
 * MapGrid unmounts it while the tile is on gather cooldown (the node
 * "disappears" as it's harvested) and remounts it when the tile regrows —
 * the pop-in scale animation marks the regrowth.
 *
 * Each node gets a deterministic per-tile pose (seeded from world coords)
 * so the island doesn't look like a stamp, plus a gentle idle sway.
 */
export default function ResourceNode({ terrain, position }) {
  const resource = resourceForTerrain(terrain.type);
  const groupRef = useRef();
  const popIn = useRef(0); // 0 → 1 scale-in on mount

  // Deterministic seed from world coords: same tile always looks the same,
  // but neighboring tiles differ.
  const seed = ((position[0] * 7.31 + position[2] * 13.7) % 1 + 1) % 1;
  const spin = seed * Math.PI * 2;

  useFrame(({ clock }, delta) => {
    const g = groupRef.current;
    if (!g) return;
    // Pop in with a springy ease-out when the node (re)appears
    if (popIn.current < 1) {
      popIn.current = Math.min(1, popIn.current + delta * 5);
      const k = 1 - Math.pow(1 - popIn.current, 3);
      g.scale.setScalar(0.6 + k * 0.4);
    }
    // Gentle idle sway (tiny rotation, offset phase per tile)
    g.rotation.y = Math.sin(clock.getElapsedTime() * 1.4 + spin) * 0.1;
  });

  if (!resource) return null;

  const y = terrain.height + TILE_THICKNESS + 0.02;

  return (
    <group ref={groupRef} position={[position[0], y, position[2]]} scale={0.6}>
      {resource === 'berry' && (
        <group rotation={[0, spin, 0]}>
          {/* Bush body: three overlapping low-poly blobs */}
          <mesh position={[-0.06, 0.08, 0]} castShadow>
            <icosahedronGeometry args={[0.055, 0]} />
            <meshToonMaterial color="#5caf5c" />
          </mesh>
          <mesh position={[0.05, 0.07, 0.02]} castShadow>
            <icosahedronGeometry args={[0.05, 0]} />
            <meshToonMaterial color="#6cc46c" />
          </mesh>
          <mesh position={[0, 0.11, -0.01]} castShadow>
            <icosahedronGeometry args={[0.045, 0]} />
            <meshToonMaterial color="#4d9a4d" />
          </mesh>
          {/* A couple of ripe berries peeking out */}
          <mesh position={[-0.04, 0.05, 0.05]}>
            <sphereGeometry args={[0.016, 6, 5]} />
            <meshToonMaterial color="#ff5d7e" />
          </mesh>
          <mesh position={[0.05, 0.09, 0.02]}>
            <sphereGeometry args={[0.014, 6, 5]} />
            <meshToonMaterial color="#ff7d9a" />
          </mesh>
        </group>
      )}

      {resource === 'shell' && (
        <group rotation={[0, spin, 0]}>
          {/* Three small fan shells lying flat on the sand */}
          <mesh
            position={[-0.06, 0.03, 0.01]}
            rotation={[0.4, 0.3, 0.2]}
            scale={[1, 0.45, 0.75]}
            castShadow
          >
            <sphereGeometry args={[0.075, 8, 6]} />
            <meshToonMaterial color="#fff3e2" />
          </mesh>
          <mesh
            position={[0.04, 0.025, 0.03]}
            rotation={[0.5, -0.4, 0.3]}
            scale={[1, 0.45, 0.7]}
            castShadow
          >
            <sphereGeometry args={[0.065, 8, 6]} />
            <meshToonMaterial color="#ffd9b0" />
          </mesh>
          <mesh
            position={[-0.01, 0.022, -0.05]}
            rotation={[0.35, 0.9, 0.15]}
            scale={[1, 0.45, 0.65]}
            castShadow
          >
            <sphereGeometry args={[0.055, 8, 6]} />
            <meshToonMaterial color="#ffc2d4" />
          </mesh>
        </group>
      )}

      {resource === 'stone' && (
        <group rotation={[0, spin, 0]}>
          {/* Three chunky low-poly rocks */}
          <mesh position={[-0.05, 0.06, 0.01]} rotation={[0.2, 0.3, 0.1]} castShadow>
            <dodecahedronGeometry args={[0.062, 0]} />
            <meshToonMaterial color="#aab4bf" />
          </mesh>
          <mesh position={[0.05, 0.045, 0.02]} rotation={[0.1, -0.4, 0.2]} castShadow>
            <dodecahedronGeometry args={[0.048, 0]} />
            <meshToonMaterial color="#8f9aa6" />
          </mesh>
          <mesh position={[-0.01, 0.035, -0.06]} rotation={[0.4, 0.8, 0.1]} castShadow>
            <dodecahedronGeometry args={[0.04, 0]} />
            <meshToonMaterial color="#bcc6d0" />
          </mesh>
        </group>
      )}
    </group>
  );
}
