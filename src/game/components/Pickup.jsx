import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';

const DURATION = 0.9; // seconds of the pop-fade animation

/**
 * The 3D shape for a given resource. Each is a tiny cluster of primitives
 * using unlit materials so the pickup pops regardless of the day/night cycle.
 */
function ResourceShape({ resource }) {
  switch (resource) {
    case 'berry':
      return (
        <>
          <mesh position={[0, 0, 0]}>
            <sphereGeometry args={[0.045, 10, 8]} />
            <meshBasicMaterial color="#ff5d7e" transparent />
          </mesh>
          <mesh position={[0.045, 0.01, 0.02]}>
            <sphereGeometry args={[0.032, 8, 8]} />
            <meshBasicMaterial color="#ff8aa0" transparent />
          </mesh>
          <mesh position={[-0.02, 0.05, -0.01]} rotation={[0, 0, -0.6]}>
            <coneGeometry args={[0.012, 0.05, 6]} />
            <meshBasicMaterial color="#4caf50" transparent />
          </mesh>
        </>
      );
    case 'shell':
      return (
        <>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <coneGeometry args={[0.055, 0.06, 12]} />
            <meshBasicMaterial color="#ffd9b0" transparent />
          </mesh>
          <mesh position={[0, 0.015, 0]} rotation={[0.6, 0, 0]}>
            <coneGeometry args={[0.035, 0.04, 10]} />
            <meshBasicMaterial color="#ffc9a0" transparent />
          </mesh>
        </>
      );
    case 'stone':
      return (
        <mesh>
          <icosahedronGeometry args={[0.05, 0]} />
          <meshBasicMaterial color="#aab4bf" flatShading transparent />
        </mesh>
      );
    default:
      return null;
  }
}

/**
 * A single animated resource pickup. Spawns at the tile, pops upward in a
 * small arc, and fades out — then reports back via onDone so the parent
 * can remove it from the scene.
 */
export default function Pickup({ resource, position, onDone }) {
  const groupRef = useRef();
  const bornRef = useRef(null); // clock time when the animation started
  const doneRef = useRef(false);

  useFrame(({ clock }) => {
    const group = groupRef.current;
    if (!group || doneRef.current) return;

    if (bornRef.current === null) bornRef.current = clock.getElapsedTime();
    const t = (clock.getElapsedTime() - bornRef.current) / DURATION;

    if (t >= 1) {
      doneRef.current = true;
      onDone();
      return;
    }

    // Arc up then settle back down
    group.position.y = position[1] + Math.sin(t * Math.PI) * 0.35;
    // Pop in, then gently shrink while fading
    const scale = 0.7 + Math.sin(Math.min(1, t * 2.5) * Math.PI) * 0.45;
    group.scale.setScalar(scale);

    // Fade out during the last 30% of the animation
    const fade = t > 0.7 ? 1 - (t - 0.7) / 0.3 : 1;
    group.traverse((obj) => {
      if (obj.isMesh && obj.material) {
        obj.material.opacity = fade;
      }
    });

    // Gentle spin for liveliness
    group.rotation.y = t * Math.PI;
  });

  return (
    <group ref={groupRef} position={position}>
      <ResourceShape resource={resource} />
    </group>
  );
}
