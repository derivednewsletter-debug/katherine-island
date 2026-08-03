import React, { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useGameStore } from '../state/gameStore';
import InstancedField from './InstancedField';

// Tilled soil patch: a low outer mound + a darker inner ridge. Parts are
// placed relative to the plot's (x, y, z), where y is the tile's top surface.
const SOIL_PARTS = [
  { geom: 'cylinder', args: [0.36, 0.38, 0.06, 8], pos: [0, 0.07, 0], rot: [0, 0, 0], color: '#7a5a34' },
  { geom: 'cylinder', args: [0.28, 0.3, 0.02, 8], pos: [0, 0.1, 0], rot: [0, 0, 0], color: '#5d4426' },
];

/**
 * Renders every tilled soil plot. Soil patches are instanced (cheap); a
 * single invisible raycast hotspot per plot lets the eraser remove plots.
 * The hotspot only stops clicks in erase mode — otherwise clicks fall
 * through to the ground plane so gathering/tilling still work on that tile.
 */
export default function Plots() {
  const plots = useGameStore((s) => s.plots);

  const entries = useMemo(
    () => plots.map((p) => ({ x: p.x, y: p.y, z: p.z, rot: p.rot ?? 0, scale: p.scale ?? 1 })),
    [plots]
  );

  // Hotspot instances = ALL plots (order matches s.plots → e.instanceId)
  const hotspotEntries = useMemo(
    () => plots.map((p) => ({ x: p.x, y: p.y + 0.06, z: p.z, rot: 0, scale: 1 })),
    [plots]
  );
  const hotspotRef = useRef();

  // Bake hotspot matrices whenever the plot roster changes
  useLayoutEffect(() => {
    const mesh = hotspotRef.current;
    if (!mesh) return;
    if (hotspotEntries.length > mesh.count) {
      mesh.instanceMatrix = new THREE.InstancedBufferAttribute(
        new Float32Array(hotspotEntries.length * 16),
        16
      );
    }
    mesh.count = hotspotEntries.length;
    const dummy = new THREE.Object3D();
    for (let i = 0; i < hotspotEntries.length; i++) {
      const e = hotspotEntries[i];
      dummy.position.set(e.x, e.y, e.z);
      dummy.scale.set(0.8, 1, 0.8);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }, [hotspotEntries]);

  /** Click a plot hotspot (e.instanceId → s.plots[instanceId]). */
  const handlePlotClick = (e) => {
    const s = useGameStore.getState();
    const plot = s.plots[e.instanceId];
    if (!plot) return;
    if (s.placement.active && s.placement.tool === 'erase') {
      e.stopPropagation();
      s.removePlot(plot.row, plot.col);
    }
    // Otherwise let the click fall through to the ground plane.
  };

  return (
    <group>
      <InstancedField entries={entries} parts={SOIL_PARTS} />
      <instancedMesh
        ref={hotspotRef}
        args={[undefined, undefined, Math.max(hotspotEntries.length, 1)]}
        onClick={handlePlotClick}
      >
        <boxGeometry args={[0.8, 0.12, 0.8]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </instancedMesh>
    </group>
  );
}
