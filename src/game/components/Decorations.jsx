import React, { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import InstancedField from './InstancedField';
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
      <mesh position={[0, 0.35, 0]} rotation={[0, 0, -0.12]} castShadow>
        <cylinderGeometry args={[0.05, 0.08, 0.75, 6]} />
        <meshToonMaterial {...mat(tint, '#b0885a')} />
      </mesh>
      {/* Fronds fanning out from the top */}
      {[0, 1, 2, 3, 4, 5].map((i) => {
        const angle = (i / 6) * Math.PI * 2;
        return (
          <mesh
            key={i}
            position={[Math.cos(angle) * 0.07, 0.72, Math.sin(angle) * 0.07]}
            rotation={[Math.sin(angle) * -0.7, 0, Math.cos(angle) * -0.7]}
            castShadow
          >
            <coneGeometry args={[0.05, 0.3, 5]} />
            <meshToonMaterial {...mat(tint, i % 2 === 0 ? '#3f9e4d' : '#57b95f')} />
          </mesh>
        );
      })}
      {/* Coconut */}
      <mesh position={[0, 0.68, 0]} castShadow>
        <sphereGeometry args={[0.06, 8, 8]} />
        <meshToonMaterial {...mat(tint, '#8a5a2b')} />
      </mesh>
    </group>
  );
}

/** Big jungle canopy tree — the substantial "real tree" the island lacks.
 *  Thick trunk topped with a layered low-poly canopy. Scatter-only
 *  (not in the build palette) and choppable like a palm. */
export function BigTree({ scale = 1, rot = 0, tint }) {
  return (
    <group scale={scale} rotation={[0, rot, 0]}>
      {/* Trunk */}
      <mesh position={[0, 0.65, 0]} castShadow>
        <cylinderGeometry args={[0.14, 0.22, 1.3, 7]} />
        <meshToonMaterial {...mat(tint, '#7a5a34')} />
      </mesh>
      {/* Layered canopy blobs */}
      <mesh position={[0, 1.75, 0]} castShadow>
        <icosahedronGeometry args={[0.55, 0]} />
        <meshToonMaterial {...mat(tint, '#2f7d3f')} flatShading />
      </mesh>
      <mesh position={[0.45, 1.55, 0.25]} castShadow>
        <icosahedronGeometry args={[0.42, 0]} />
        <meshToonMaterial {...mat(tint, '#3a8c4a')} flatShading />
      </mesh>
      <mesh position={[-0.42, 1.62, -0.2]} castShadow>
        <icosahedronGeometry args={[0.42, 0]} />
        <meshToonMaterial {...mat(tint, '#3a8c4a')} flatShading />
      </mesh>
      <mesh position={[0, 2.05, 0.05]} castShadow>
        <icosahedronGeometry args={[0.34, 0]} />
        <meshToonMaterial {...mat(tint, '#4c9c58')} flatShading />
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

/** Low-poly jungle bush: dense cluster of leaves. */
export function Bush({ scale = 1, rot = 0, tint }) {
  return (
    <group scale={scale} rotation={[0, rot, 0]}>
      {[0, 1, 2, 3].map((i) => {
        const angle = (i / 4) * Math.PI * 2;
        const sx = Math.cos(angle) * 0.08;
        const sz = Math.sin(angle) * 0.08;
        return (
          <mesh key={i} position={[sx, 0.12, sz]} castShadow>
            <sphereGeometry args={[0.1, 6, 6]} />
            <meshToonMaterial {...mat(tint, '#3a8c5a')} />
          </mesh>
        );
      })}
      <mesh position={[0, 0.05, 0]} castShadow>
        <cylinderGeometry args={[0.03, 0.03, 0.16, 5]} />
        <meshToonMaterial {...mat(tint, '#8d6b4b')} />
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

/** Compact stove appliance. */
export function Stove({ scale = 1, rot = 0, tint }) {
  return (
    <group scale={scale} rotation={[0, rot, 0]}>
      <mesh position={[0, 0.18, 0]} castShadow><boxGeometry args={[0.28, 0.36, 0.24]} /><meshToonMaterial {...mat(tint, '#f0b27a')} /></mesh>
      <mesh position={[0, 0.38, 0]} castShadow><boxGeometry args={[0.32, 0.05, 0.28]} /><meshToonMaterial {...mat(tint, '#5d6d7e')} /></mesh>
      <mesh position={[0, 0.48, 0]} castShadow><cylinderGeometry args={[0.08, 0.08, 0.06, 10]} /><meshToonMaterial {...mat(tint, '#c98a4b')} /></mesh>
    </group>
  );
}

/** Compact grill appliance. */
export function Grill({ scale = 1, rot = 0, tint }) {
  return (
    <group scale={scale} rotation={[0, rot, 0]}>
      <mesh position={[0, 0.22, 0]} castShadow><cylinderGeometry args={[0.2, 0.22, 0.28, 10]} rotation={[Math.PI / 2, 0, 0]} /><meshToonMaterial {...mat(tint, '#5d6d7e')} /></mesh>
      <mesh position={[0, 0.37, 0]} castShadow><boxGeometry args={[0.3, 0.03, 0.22]} /><meshToonMaterial {...mat(tint, '#f0b27a')} /></mesh>
      <mesh position={[-0.12, 0.08, 0]}><boxGeometry args={[0.04, 0.16, 0.04]} /><meshToonMaterial {...mat(tint, '#293747')} /></mesh>
      <mesh position={[0.12, 0.08, 0]}><boxGeometry args={[0.04, 0.16, 0.04]} /><meshToonMaterial {...mat(tint, '#293747')} /></mesh>
    </group>
  );
}

/** Memorial stone: low-poly gravestone with a small heart/flower. */
export function Memorial({ scale = 1, rot = 0, tint }) {
  return (
    <group scale={scale} rotation={[0, rot, 0]}>
      {/* Base */}
      <mesh position={[0, 0.06, 0]} castShadow>
        <boxGeometry args={[0.18, 0.12, 0.07]} />
        <meshToonMaterial {...mat(tint, '#c4c4c4')} />
      </mesh>
      {/* Headstone */}
      <mesh position={[0, 0.22, 0]} castShadow>
        <boxGeometry args={[0.14, 0.25, 0.05]} />
        <meshToonMaterial {...mat(tint, '#d4d4d4')} />
      </mesh>
      {/* Heart on headstone — two offset spheres form a simple heart silhouette */}
      <mesh position={[-0.012, 0.285, 0.035]} castShadow>
        <sphereGeometry args={[0.016, 8, 8]} />
        <meshToonMaterial {...mat(tint, '#e06b6b')} />
      </mesh>
      <mesh position={[0.012, 0.285, 0.035]} castShadow>
        <sphereGeometry args={[0.016, 8, 8]} />
        <meshToonMaterial {...mat(tint, '#e06b6b')} />
      </mesh>
      <mesh position={[0, 0.272, 0.035]} castShadow>
        <coneGeometry args={[0.026, 0.022, 6]} />
        <meshToonMaterial {...mat(tint, '#e06b6b')} />
      </mesh>
    </group>
  );
}

export const KIND_COMPONENT = {
  palm: PalmTree,
  tree: BigTree,
  rock: Rock,
  flower: Flower,
  bush: Bush,
  fountain: Fountain,
  lantern: Lantern,
  stove: Stove,
  grill: Grill,
  memorial: Memorial,
};

/**
 * Part descriptors for INSTANCED rendering — the React components above are
 * kept for the one-at-a-time placement ghost; the full scatter/planted
 * population renders as shared InstancedMeshes (one per part) so thousands
 * of props cost only ~25 draw calls.
 */
const PARTS = {
  palm: [
    { geom: 'cylinder', args: [0.05, 0.08, 0.75, 6], pos: [0, 0.35, 0], rot: [0, 0, -0.12], color: '#b0885a' },
    ...[0, 1, 2, 3, 4, 5].map((i) => {
      const angle = (i / 6) * Math.PI * 2;
      return {
        geom: 'cone',
        args: [0.05, 0.3, 5],
        pos: [Math.cos(angle) * 0.07, 0.72, Math.sin(angle) * 0.07],
        rot: [Math.sin(angle) * -0.7, 0, Math.cos(angle) * -0.7],
        color: i % 2 === 0 ? '#3f9e4d' : '#57b95f',
      };
    }),
    { geom: 'sphere', args: [0.06, 8, 8], pos: [0, 0.68, 0], rot: [0, 0, 0], color: '#8a5a2b' },
  ],
  tree: [
    { geom: 'cylinder', args: [0.14, 0.22, 1.3, 7], pos: [0, 0.65, 0], rot: [0, 0, 0], color: '#7a5a34' },
    { geom: 'icosa', args: [0.55, 0], pos: [0, 1.75, 0], rot: [0, 0, 0], color: '#2f7d3f' },
    { geom: 'icosa', args: [0.42, 0], pos: [0.45, 1.55, 0.25], rot: [0, 0, 0], color: '#3a8c4a' },
    { geom: 'icosa', args: [0.42, 0], pos: [-0.42, 1.62, -0.2], rot: [0, 0, 0], color: '#3a8c4a' },
    { geom: 'icosa', args: [0.34, 0], pos: [0, 2.05, 0.05], rot: [0, 0, 0], color: '#4c9c58' },
  ],
  rock: [
    { geom: 'icosa', args: [0.16, 0], pos: [0, 0.09, 0], rot: [0, 0, 0], color: '#9aa3ab' },
    { geom: 'icosa', args: [0.098, 0], pos: [0.13, 0.05, 0.08], rot: [0, 0, 0], color: '#aeb7bf' },
    { geom: 'icosa', args: [0.065, 0], pos: [-0.12, 0.03, -0.06], rot: [0, 0, 0], color: '#88939c' },
  ],
  flower: [
    { geom: 'cylinder', args: [0.012, 0.02, 0.2, 5], pos: [0, 0.1, 0], rot: [0, 0, 0], color: '#4c9e4f' },
    ...[0, 1, 2, 3, 4].map((i) => {
      const angle = (i / 5) * Math.PI * 2;
      return {
        geom: 'sphere',
        args: [0.028, 8, 8],
        pos: [Math.cos(angle) * 0.045, 0.21, Math.sin(angle) * 0.045],
        rot: [0, 0, 0],
        color: '#ff9eb0',
      };
    }),
    { geom: 'sphere', args: [0.03, 8, 8], pos: [0, 0.22, 0], rot: [0, 0, 0], color: '#ffd166' },
  ],
  fountain: [
    { geom: 'cylinder', args: [0.2, 0.24, 0.14, 10], pos: [0, 0.08, 0], rot: [0, 0, 0], color: '#b9c2cc' },
    { geom: 'sphere', args: [0.15, 10, 8], pos: [0, 0.16, 0], rot: [0, 0, 0], color: '#5fc3e8' },
    { geom: 'cylinder', args: [0.03, 0.05, 0.28, 8], pos: [0, 0.32, 0], rot: [0, 0, 0], color: '#8fd9f0' },
    { geom: 'sphere', args: [0.045, 8, 6], pos: [0, 0.47, 0], rot: [0, 0, 0], color: '#bfeefc' },
  ],
  lantern: [
    { geom: 'cylinder', args: [0.02, 0.03, 0.34, 6], pos: [0, 0.16, 0], rot: [0, 0, 0], color: '#8a6a4a' },
    { geom: 'sphere', args: [0.07, 10, 8], pos: [0, 0.38, 0], rot: [0, 0, 0], color: '#ffcf6e' },
    { geom: 'cone', args: [0.06, 0.08, 6], pos: [0, 0.47, 0], rot: [0, 0, 0], color: '#6b4a2a' },
  ],
  bush: [
    { geom: 'sphere', args: [0.1, 6, 6], pos: [0.08, 0.12, 0], rot: [0, 0, 0], color: '#3a8c5a' },
    { geom: 'sphere', args: [0.1, 6, 6], pos: [-0.08, 0.12, 0.05], rot: [0, 0, 0], color: '#3a8c5a' },
    { geom: 'sphere', args: [0.1, 6, 6], pos: [0, 0.12, -0.08], rot: [0, 0, 0], color: '#3a8c5a' },
    { geom: 'cylinder', args: [0.03, 0.03, 0.16, 5], pos: [0, 0.05, 0], rot: [0, 0, 0], color: '#8d6b4b' },
  ],
  stove: [
    { geom: 'box', args: [0.28, 0.36, 0.24], pos: [0, 0.18, 0], rot: [0, 0, 0], color: '#f0b27a' },
    { geom: 'box', args: [0.32, 0.05, 0.28], pos: [0, 0.38, 0], rot: [0, 0, 0], color: '#5d6d7e' },
    { geom: 'cylinder', args: [0.08, 0.08, 0.06, 10], pos: [0, 0.48, 0], rot: [0, 0, 0], color: '#c98a4b' },
  ],
  grill: [
    { geom: 'cylinder', args: [0.2, 0.22, 0.28, 10], pos: [0, 0.22, 0], rot: [Math.PI / 2, 0, 0], color: '#5d6d7e' },
    { geom: 'box', args: [0.3, 0.03, 0.22], pos: [0, 0.37, 0], rot: [0, 0, 0], color: '#f0b27a' },
    { geom: 'box', args: [0.04, 0.16, 0.04], pos: [-0.12, 0.08, 0], rot: [0, 0, 0], color: '#293747' },
    { geom: 'box', args: [0.04, 0.16, 0.04], pos: [0.12, 0.08, 0], rot: [0, 0, 0], color: '#293747' },
  ],
  memorial: [
    { geom: 'box', args: [0.18, 0.12, 0.07], pos: [0, 0.06, 0], rot: [0, 0, 0], color: '#c4c4c4' },
    { geom: 'box', args: [0.14, 0.25, 0.05], pos: [0, 0.22, 0], rot: [0, 0, 0], color: '#d4d4d4' },
    { geom: 'sphere', args: [0.016, 8, 8], pos: [-0.012, 0.285, 0.035], rot: [0, 0, 0], color: '#e06b6b' },
    { geom: 'sphere', args: [0.016, 8, 8], pos: [0.012, 0.285, 0.035], rot: [0, 0, 0], color: '#e06b6b' },
    { geom: 'cone', args: [0.026, 0.022, 6], pos: [0, 0.272, 0.035], rot: [0, 0, 0], color: '#e06b6b' },
  ],
};

/**
 * Renders every decoration on the island — the seeded scatter plus anything
 * the player plants — as shared instanced meshes (see InstancedField).
 * Also renders pet memorials from the memorials array.
 */
export default function Decorations() {
  const decorations = useGameStore((s) => s.decorations);
  const memorials = useGameStore((s) => s.memorials);
  const applianceEntries = useMemo(() => decorations.filter((d) => d.kind === 'stove' || d.kind === 'grill'), [decorations]);
  const hotspotRef = useRef();

  useLayoutEffect(() => {
    const mesh = hotspotRef.current;
    if (!mesh) return;
    if (applianceEntries.length > mesh.count) {
      mesh.instanceMatrix = new THREE.InstancedBufferAttribute(new Float32Array(applianceEntries.length * 16), 16);
    }
    mesh.count = applianceEntries.length;
    const dummy = new THREE.Object3D();
    applianceEntries.forEach((entry, index) => {
      dummy.position.set(entry.x, entry.y + 0.25, entry.z);
      dummy.scale.set(0.8, 0.8, 0.8);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }, [applianceEntries]);

  const grouped = useMemo(() => {
    const g = { palm: [], tree: [], rock: [], flower: [], fountain: [], lantern: [], stove: [], grill: [], bush: [], memorial: [] };
    for (const d of decorations) {
      if (g[d.kind]) g[d.kind].push(d);
    }
    // Add memorials as a separate kind
    for (const m of memorials) {
      if (g.memorial) g.memorial.push({ kind: 'memorial', ...m });
    }
    return g;
  }, [decorations, memorials]);

  return (
    <group>
      {Object.entries(PARTS).map(([kind, parts]) => (
        <InstancedField key={kind} entries={grouped[kind] ?? []} parts={parts} />
      ))}
      <instancedMesh
        ref={hotspotRef}
        args={[undefined, undefined, Math.max(applianceEntries.length, 1)]}
        onClick={(event) => {
          event.stopPropagation();
          const entry = applianceEntries[event.instanceId];
          if (entry) useGameStore.getState().setActiveAppliance({ id: entry.id, row: entry.row, col: entry.col, kind: entry.kind });
        }}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </instancedMesh>
    </group>
  );
}
