import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { TILE_SIZE } from '../data/mapData';

/** Thickness of the box that makes up each tile. */
export const TILE_THICKNESS = 0.15;

/**
 * Animated translucent shimmer layer for water tiles.
 * Gently bobs up and down and pulses its opacity/scale so the
 * ocean feels alive instead of static.
 */
function WaterShimmer({ opacity, x, z }) {
  const ref = useRef();

  // Per-tile phase so adjacent tiles shimmer out of sync (organic waves)
  const phase = useMemo(() => (x * 1.7 + z * 2.3) % (Math.PI * 2), [x, z]);

  useFrame(({ clock }) => {
    const mesh = ref.current;
    if (!mesh) return;
    const t = clock.getElapsedTime();

    mesh.position.y = TILE_THICKNESS + 0.06 + Math.sin(t * 1.8 + phase) * 0.025;
    mesh.material.opacity = opacity * (0.65 + 0.35 * Math.sin(t * 2.4 + phase));
    const s = 1 + Math.sin(t * 1.1 + phase) * 0.05;
    mesh.scale.set(s, s, 1);
  });

  return (
    <mesh ref={ref} position={[0, TILE_THICKNESS + 0.06, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[TILE_SIZE * 0.85, TILE_SIZE * 0.85]} />
      <meshBasicMaterial
        color="#ffffff"
        transparent
        opacity={opacity}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

/**
 * Renders a single terrain tile as a low-poly box.
 * Different terrain types have distinct colors and heights.
 */
export default function Tile({ terrain, position, isHovered, onHover, onClick }) {
  const meshRef = useRef();

  const tileColor = useMemo(() => {
    return new THREE.Color(terrain.color);
  }, [terrain.color]);

  // Top face color (slightly lighter for stylized toon look)
  const topColor = useMemo(() => {
    return new THREE.Color(terrain.color).multiplyScalar(1.15);
  }, [terrain.color]);

  // Side face color (slightly darker)
  const sideColor = useMemo(() => {
    return new THREE.Color(terrain.color).multiplyScalar(0.7);
  }, [terrain.color]);

  // Hover highlight
  const emissiveIntensity = isHovered ? 0.25 : 0;

  const yOffset = terrain.height;

  return (
    <group
      position={[position[0], yOffset, position[2]]}
      onPointerEnter={(e) => {
        e.stopPropagation();
        onHover(position);
      }}
      onPointerLeave={(e) => {
        e.stopPropagation();
        onHover(null);
      }}
      onClick={(e) => {
        e.stopPropagation();
        onClick(terrain, position);
      }}
    >
      {/* Top face */}
      <mesh
        ref={meshRef}
        position={[0, TILE_THICKNESS / 2, 0]}
        receiveShadow
        castShadow
      >
        <boxGeometry args={[TILE_SIZE * 0.95, TILE_THICKNESS, TILE_SIZE * 0.95]} />
        <meshToonMaterial
          color={topColor}
          emissive={new THREE.Color(tileColor).multiplyScalar(emissiveIntensity)}
        />
      </mesh>

      {/* Base / ground below elevated tiles */}
      {terrain.height > 0.1 && (
        <mesh position={[0, -terrain.height + TILE_THICKNESS / 2, 0]} receiveShadow>
          <boxGeometry args={[TILE_SIZE * 0.95, terrain.height * 2, TILE_SIZE * 0.95]} />
          <meshToonMaterial color={sideColor} />
        </mesh>
      )}

      {/* Water tiles get an animated translucent shimmer layer on top */}
      {(terrain.type === 'water' || terrain.type === 'shallow') && (
        <WaterShimmer
          opacity={terrain.type === 'water' ? 0.08 : 0.15}
          x={position[0]}
          z={position[2]}
        />
      )}
    </group>
  );
}

// Tile size constant for grid layout (shared with mapData.js)
export const TILE_SIZE_CONST = TILE_SIZE;
