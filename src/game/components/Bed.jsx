import React from 'react';
import { BED_SPOT, getTile, gridToWorld } from '../data/mapData';
import { TILE_THICKNESS } from './Tile';

/**
 * The pet's sleeping mat — a soft low-poly cushion + pillow that sits at
 * BED_SPOT. The creature curls up here when night falls (see Creature.jsx).
 * Placement is forbidden on this tile so the pet can always reach bed.
 */
export default function Bed() {
  const tile = getTile(BED_SPOT.row, BED_SPOT.col);
  if (!tile) return null;
  const { x, z } = gridToWorld(BED_SPOT.row, BED_SPOT.col);
  const y = tile.height + TILE_THICKNESS;

  return (
    <group position={[x, y, z]} rotation={[0, 0.7, 0]}>
      {/* Cushion base */}
      <mesh position={[0, 0.025, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[0.34, 20]} />
        <meshToonMaterial color="#f2b8d0" />
      </mesh>
      {/* Raised rim so it reads as a mat */}
      <mesh position={[0, 0.045, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.26, 0.34, 20]} />
        <meshToonMaterial color="#e89ab8" />
      </mesh>
      {/* Pillow */}
      <mesh position={[0, 0.075, -0.18]} castShadow>
        <boxGeometry args={[0.24, 0.07, 0.14]} />
        <meshToonMaterial color="#fff3e0" />
      </mesh>
      {/* Tiny heart embroidery */}
      <mesh position={[0.14, 0.07, 0.14]} rotation={[0.4, 0.3, 0]}>
        <sphereGeometry args={[0.035, 8, 8]} />
        <meshToonMaterial color="#ff6b9d" />
      </mesh>
      <mesh position={[0.16, 0.09, 0.12]} rotation={[0.4, 0.3, 0]}>
        <sphereGeometry args={[0.035, 8, 8]} />
        <meshToonMaterial color="#ff6b9d" />
      </mesh>
    </group>
  );
}
