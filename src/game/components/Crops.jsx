import React, { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useGameStore, weatherOpts } from '../state/gameStore';
import { CROPS, CROP_PARTS, cropStageIndex } from '../data/crops';
import InstancedField from './InstancedField';

/**
 * Tinted low-poly sapling used as the placement ghost for every crop — a
 * little stem with two leaves in the valid/blocked tint color.
 */
export function CropPreview({ cropId, tint }) {
  const def = CROPS[cropId];
  const color = tint ?? def?.color ?? '#4ade80';
  return (
    <group scale={0.9}>
      <mesh position={[0, 0.08, 0]} castShadow>
        <cylinderGeometry args={[0.015, 0.025, 0.2, 5]} />
        <meshToonMaterial color={color} transparent={!!tint} opacity={tint ? 0.55 : 1} />
      </mesh>
      <mesh position={[-0.04, 0.2, 0]} rotation={[0.3, 0, 0.6]} castShadow>
        <coneGeometry args={[0.045, 0.12, 4]} />
        <meshToonMaterial color={color} transparent={!!tint} opacity={tint ? 0.55 : 1} />
      </mesh>
      <mesh position={[0.05, 0.2, 0]} rotation={[0.3, 0, -0.6]} castShadow>
        <coneGeometry args={[0.045, 0.12, 4]} />
        <meshToonMaterial color={color} transparent={!!tint} opacity={tint ? 0.55 : 1} />
      </mesh>
      {/* Tiny dirt mound */}
      <mesh position={[0, 0.02, 0]}>
        <sphereGeometry args={[0.06, 8, 6]} />
        <meshToonMaterial color="#8a6a4a" transparent={!!tint} opacity={tint ? 0.55 : 1} />
      </mesh>
    </group>
  );
}

const STAGES = [0, 1, 2, 3];

/**
 * Renders every planted crop on the island.
 *
 * Growth is derived from the shared game clock, so each crop's stage is
 * recomputed whenever a stage threshold is crossed (the selector returns a
 * STABLE string of stage indices — no per-frame re-renders, like Pets).
 * Crops of the same kind at the same stage share one InstancedField of
 * that stage's parts, so any number of crops stays a handful of draw calls.
 *
 * A single invisible instanced "hotspot" box per crop (raycast ENABLED —
 * the only instanced mesh on the island that is) catches clicks: ready
 * crops harvest, growing ones toast "not ready", and in build mode the
 * eraser removes them.
 */
export default function Crops() {
  // Stable stage-key string: re-renders only when a crop's stage changes
  // (or crops are planted/harvested), never on every needs/time tick.
  // Weather-aware: rain grows crops 2x, so stages cross faster mid-shower.
  const stageKey = useGameStore((s) =>
    s.crops.map((c) => `${cropStageIndex(c, s.time, weatherOpts(s))}`).join(',')
  );

  // Group crops by kind × stage → entries for each stage's InstancedField
  const groups = useMemo(() => {
    const s = useGameStore.getState();
    const out = {};
    for (const cropId of Object.keys(CROPS)) {
      out[cropId] = { 0: [], 1: [], 2: [], 3: [] };
    }
    for (const c of s.crops) {
      const def = CROPS[c.cropId];
      if (!def) continue;
      const stage = cropStageIndex(c, s.time, weatherOpts(s));
      out[c.cropId][stage].push({ x: c.x, y: c.y, z: c.z, rot: c.rot, scale: c.scale });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stageKey]);

  // Hotspot instances = ALL crops (order matches s.crops → e.instanceId)
  const hotspotEntries = useMemo(
    () =>
      useGameStore
        .getState()
        .crops.map((c) => ({ x: c.x, y: c.y + 0.04, z: c.z, rot: 0, scale: 1 })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stageKey]
  );
  const hotspotRef = useRef();

  // Bake hotspot matrices whenever the crop roster changes
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
      dummy.scale.set(0.85, 1, 0.85);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }, [hotspotEntries]);

  /** Click a crop hotspot (e.instanceId → s.crops[instanceId]). */
  const handleCropClick = (e) => {
    e.stopPropagation();
    const s = useGameStore.getState();
    const crop = s.crops[e.instanceId];
    if (!crop) return;
    const placement = s.placement;
    if (placement.active && placement.tool === 'erase') {
      s.removeCrop(crop.row, crop.col);
      return;
    }
    if (placement.active) return; // build mode owns the click
    const def = CROPS[crop.cropId];
    const ready = cropStageIndex(crop, s.time, weatherOpts(s)) >= def.durations.length;
    if (ready) {
      s.harvestCrop(crop.row, crop.col);
    } else {
      s.showToast(`${def.emoji} ${def.label} isn't ready yet…`);
    }
  };

  return (
    <group>
      {/* Visual fields — one per kind × stage */}
      {Object.keys(CROPS).map((cropId) =>
        STAGES.map((stage) => (
          <InstancedField
            key={`${cropId}-${stage}`}
            entries={groups[cropId][stage]}
            parts={CROP_PARTS[cropId][stage]}
          />
        ))
      )}

      {/* Click hotspot — invisible, raycast-enabled, one per planted crop */}
      <instancedMesh
        ref={hotspotRef}
        args={[undefined, undefined, Math.max(hotspotEntries.length, 1)]}
        onClick={handleCropClick}
      >
        <boxGeometry args={[0.85, 0.1, 0.85]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </instancedMesh>
    </group>
  );
}
