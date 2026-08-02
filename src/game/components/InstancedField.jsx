import React, { useLayoutEffect, useRef } from 'react';
import * as THREE from 'three';

/**
 * Shared instanced renderer — the heart of the massive-island rewrite.
 *
 * `entries` is a list of { x, y, z, rot, scale } placement slots; `parts`
 * is a list of low-poly part descriptors { geom, args, pos, rot, color,
 * pscale? }. Each part becomes ONE InstancedMesh holding every entry's
 * copy of that part, so thousands of props render in a handful of draw
 * calls (the island's scatter + resource nodes would otherwise be tens of
 * thousands of individual meshes — unplayable).
 *
 * Every instanced mesh disables raycasting (raycast={() => null}): props
 * don't need pointer events — clicks resolve through the invisible ground
 * plane via worldToGrid instead. This keeps the pointer pipeline O(1)
 * instead of raycasting 25K+ instances on every mouse move.
 */
export default function InstancedField({ entries, parts }) {
  const refs = useRef([]);
  const count = entries.length;

  useLayoutEffect(() => {
    const dummy = new THREE.Object3D();
    const tmpPos = new THREE.Vector3();
    const tmpQuat = new THREE.Quaternion();
    const tmpScale = new THREE.Vector3();
    const partMats = parts.map((p) =>
      new THREE.Matrix4().compose(
        new THREE.Vector3(...p.pos),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(...p.rot)),
        new THREE.Vector3(...(p.pscale ?? [1, 1, 1]))
      )
    );

    parts.forEach((p, pi) => {
      const mesh = refs.current[pi];
      if (!mesh) return;
      // The GPU instance buffer is sized at mount (args count). If the
      // entry list ever GROWS past it — e.g. the player plants more
      // decorations than existed at boot — out-of-bounds setMatrixAt
      // writes are silently dropped by typed arrays, so we must RESIZE
      // the buffer (fresh InstancedBufferAttribute) and only then bump
      // count. Shrink is safe: extra capacity is simply unused.
      if (entries.length > mesh.count) {
        mesh.instanceMatrix = new THREE.InstancedBufferAttribute(
          new Float32Array(entries.length * 16),
          16
        );
      }
      mesh.count = entries.length;
      for (let i = 0; i < entries.length; i++) {
        const e = entries[i];
        tmpPos.set(e.x, e.y, e.z);
        tmpQuat.setFromEuler(new THREE.Euler(0, e.rot, 0));
        tmpScale.setScalar(e.scale);
        dummy.matrix.compose(tmpPos, tmpQuat, tmpScale);
        dummy.matrix.multiply(partMats[pi]); // part-local transform
        mesh.setMatrixAt(i, dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
    });
  }, [entries, parts]);

  return (
    <group>
      {parts.map((p, pi) => (
        <instancedMesh
          key={pi}
          ref={(el) => (refs.current[pi] = el)}
          args={[geometryFor(p), undefined, Math.max(count, 1)]}
          castShadow
          receiveShadow
          raycast={() => null}
        >
          <meshToonMaterial color={p.color} />
        </instancedMesh>
      ))}
    </group>
  );
}

/** Shared low-poly geometry cache — one geometry per (shape, args) pair. */
const GEO_CACHE = new Map();

function geometryFor(p) {
  const k = `${p.geom}:${p.args.join(',')}`;
  if (!GEO_CACHE.has(k)) {
    GEO_CACHE.set(k, buildGeometry(p.geom, p.args));
  }
  return GEO_CACHE.get(k);
}

function buildGeometry(geom, args) {
  switch (geom) {
    case 'box':
      return new THREE.BoxGeometry(...args);
    case 'cylinder':
      return new THREE.CylinderGeometry(...args);
    case 'sphere':
      return new THREE.SphereGeometry(...args);
    case 'cone':
      return new THREE.ConeGeometry(...args);
    case 'icosa':
      return new THREE.IcosahedronGeometry(...args);
    case 'dodeca':
      return new THREE.DodecahedronGeometry(...args);
    default:
      return new THREE.SphereGeometry(0.05, 6, 6);
  }
}
