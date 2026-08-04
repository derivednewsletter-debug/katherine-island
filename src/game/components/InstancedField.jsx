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
    // Reuse pre-allocated objects across layout effects to avoid GC pressure.
    // The geometry cache (GEO_CACHE) already handles part reuse; this extends
    // that principle to the per-frame scratch objects.
    if (!InstancedField._dummy) {
      InstancedField._dummy = new THREE.Object3D();
      InstancedField._pos = new THREE.Vector3();
      InstancedField._quat = new THREE.Quaternion();
      InstancedField._scale = new THREE.Vector3();
      InstancedField._euler = new THREE.Euler();
    }
    const dummy = InstancedField._dummy;
    const tmpPos = InstancedField._pos;
    const tmpQuat = InstancedField._quat;
    const tmpScale = InstancedField._scale;
    const tmpEuler = InstancedField._euler;

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
      // Resize instance buffer if entries grew past mount-time capacity.
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
        tmpEuler.set(0, e.rot, 0);
        tmpQuat.setFromEuler(tmpEuler);
        tmpScale.setScalar(e.scale);
        dummy.matrix.compose(tmpPos, tmpQuat, tmpScale);
        dummy.matrix.multiply(partMats[pi]);
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
