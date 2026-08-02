import React from 'react';
import { useGameStore } from '../state/gameStore';

/**
 * Shared toon-material props for a ghost preview: a single tint color,
 * slightly transparent, so the prop reads as a "ghost" under the cursor.
 */
function mat(tint, color) {
  return tint ? { color: tint, transparent: true, opacity: 0.55 } : { color };
}

/** Low-poly palm tree: leaning trunk + fan of fronds. */
export function PalmTree({ scale = 1, rot = 0, tint }) {
  return (
    <group scale={scale} rotation={[0, rot, 0]}>
      {/* Trunk (slight lean) */}
      <mesh position={[0, 0.28, 0]} rotation={[0, 0, -0.12]} castShadow>
        <cylinderGeometry args={[0.045, 0.07, 0.6, 6]} />
        <meshToonMaterial {...mat(tint, '#b0885a')} />
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
            <meshToonMaterial {...mat(tint, i % 2 === 0 ? '#3f9e4d' : '#57b95f')} />
          </mesh>
        );
      })}
      {/* Coconut */}
      <mesh position={[0, 0.56, 0]} castShadow>
        <sphereGeometry args={[0.055, 8, 8]} />
        <meshToonMaterial {...mat(tint, '#8a5a2b')} />
      </mesh>
    </group>
  );
}

/** Low-poly rock cluster. */
export function Rock({ scale = 1, rot = 0, tint }) {
  return (
    <group scale={scale} rotation={[0, rot, 0]}>
      <mesh position={[0, 0.09, 0]} castShadow>
        <icosahedronGeometry args={[0.16, 0]} />
        <meshToonMaterial {...mat(tint, '#9aa3ab')} flatShading />
      </mesh>
      <mesh position={[0.13, 0.05, 0.08]} scale={0.7} castShadow>
        <icosahedronGeometry args={[0.14, 0]} />
        <meshToonMaterial {...mat(tint, '#aeb7bf')} flatShading />
      </mesh>
      <mesh position={[-0.12, 0.03, -0.06]} scale={0.5} castShadow>
        <icosahedronGeometry args={[0.13, 0]} />
        <meshToonMaterial {...mat(tint, '#88939c')} flatShading />
      </mesh>
    </group>
  );
}

/** Simple flower: stem + pastel petals. */
export function Flower({ scale = 1, rot = 0, tint }) {
  return (
    <group scale={scale} rotation={[0, rot, 0]}>
      <mesh position={[0, 0.1, 0]} castShadow>
        <cylinderGeometry args={[0.012, 0.02, 0.2, 5]} />
        <meshToonMaterial {...mat(tint, '#4c9e4f')} />
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
            <meshToonMaterial {...mat(tint, '#ff9eb0')} />
          </mesh>
        );
      })}
      {/* Center */}
      <mesh position={[0, 0.22, 0]} castShadow>
        <sphereGeometry args={[0.03, 8, 8]} />
        <meshToonMaterial {...mat(tint, '#ffd166')} />
      </mesh>
    </group>
  );
}

/** Low-poly fountain: stone basin + a shimmering water jet. */
export function Fountain({ scale = 1, rot = 0, tint }) {
  return (
    <group scale={scale} rotation={[0, rot, 0]}>
      {/* Basin */}
      <mesh position={[0, 0.08, 0]} castShadow>
        <cylinderGeometry args={[0.2, 0.24, 0.14, 10]} />
        <meshToonMaterial {...mat(tint, '#b9c2cc')} flatShading />
      </mesh>
      {/* Inner water */}
      <mesh position={[0, 0.16, 0]}>
        <cylinderGeometry args={[0.15, 0.15, 0.03, 10]} />
        <meshBasicMaterial
          color={tint || '#5fc3e8'}
          transparent
          opacity={tint ? 0.55 : 0.85}
        />
      </mesh>
      {/* Jet */}
      <mesh position={[0, 0.32, 0]} castShadow>
        <cylinderGeometry args={[0.03, 0.05, 0.28, 8]} />
        <meshBasicMaterial color={tint || '#8fd9f0'} transparent opacity={tint ? 0.55 : 0.9} />
      </mesh>
      {/* Top splash */}
      <mesh position={[0, 0.47, 0]}>
        <sphereGeometry args={[0.045, 8, 6]} />
        <meshBasicMaterial color={tint || '#bfeefc'} transparent opacity={tint ? 0.55 : 0.95} />
      </mesh>
    </group>
  );
}

/** Low-poly glowing lantern: post + warm orb. */
export function Lantern({ scale = 1, rot = 0, tint }) {
  return (
    <group scale={scale} rotation={[0, rot, 0]}>
      {/* Post */}
      <mesh position={[0, 0.16, 0]} castShadow>
        <cylinderGeometry args={[0.02, 0.03, 0.34, 6]} />
        <meshToonMaterial {...mat(tint, '#8a6a4a')} />
      </mesh>
      {/* Glowing orb */}
      <mesh position={[0, 0.38, 0]} castShadow>
        <sphereGeometry args={[0.07, 10, 8]} />
        <meshToonMaterial
          {...mat(tint, '#ffcf6e')}
          emissive={tint || '#ff9d3d'}
          emissiveIntensity={tint ? 0 : 1.2}
        />
      </mesh>
      {/* Canopy */}
      <mesh position={[0, 0.47, 0]} rotation={[0, 0, 0]} castShadow>
        <coneGeometry args={[0.06, 0.08, 6]} />
        <meshToonMaterial {...mat(tint, '#6b4a2a')} />
      </mesh>
    </group>
  );
}

export const KIND_COMPONENT = {
  palm: PalmTree,
  rock: Rock,
  flower: Flower,
  fountain: Fountain,
  lantern: Lantern,
};

/**
 * Renders every decoration on the island — the seeded scatter plus anything
 * the player plants — from the global store. Plants are solid (they block
 * the pet's path), so no separate "scatter" pass is needed.
 */
export default function Decorations() {
  const decorations = useGameStore((s) => s.decorations);

  return (
    <group>
      {decorations.map((item) => {
        const Comp = KIND_COMPONENT[item.kind];
        if (!Comp) return null;
        return (
          <Comp
            key={item.id}
            position={[item.x, item.y, item.z]}
            rotation={[0, item.rot, 0]}
            scale={item.scale}
          />
        );
      })}
    </group>
  );
}
