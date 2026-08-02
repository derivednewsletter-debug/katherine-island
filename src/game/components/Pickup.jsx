import React, { useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useGameStore } from '../state/gameStore';

const DURATION = 1.15; // total pop + flight time (seconds)
const POP_END = 0.32; // fraction of the animation spent on the spawn pop
const FLIGHT_FADE = 0.72; // flight progress at which the pickup starts fading

// Small NDC x-offset so each collectible lands near its own counter chip
// (the inventory bar is centered; berries sit left of center, stones right).
const HUD_X = { berry: -0.07, shell: 0, stone: 0.07 };

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
 * A single animated resource pickup.
 *
 * Two-part animation: a quick elastic "pop" out of the tile (with a white
 * ring flash at the harvest spot), then a flight that accelerates toward the
 * top-center of the screen — where the inventory HUD lives — shrinking,
 * spinning, and fading as it arrives. The HUD anchor is recomputed every
 * frame from the camera, so collectibles always land on the counter even if
 * the player pans or zooms mid-flight. Reports back via onDone when finished.
 */
export default function Pickup({ resource, position, onDone }) {
  const groupRef = useRef();
  const ringRef = useRef();
  const elapsedRef = useRef(0); // accumulated game time (pause/timeScale aware)
  const doneRef = useRef(false);

  // Scratch vectors (avoid per-frame allocation)
  const anchor = useRef(new THREE.Vector3());
  const from = useRef(new THREE.Vector3());

  useFrame(({ camera }, delta) => {
    const group = groupRef.current;
    if (!group || doneRef.current) return;

    // Accumulate shared game time so pause freezes the pickup mid-flight and
    // fast-forward (2x/4x) makes it zip to the HUD that much quicker.
    const { paused, timeScale } = useGameStore.getState();
    elapsedRef.current += paused ? 0 : Math.min(delta, 0.05) * timeScale;
    const t = elapsedRef.current / DURATION;

    if (t >= 1) {
      doneRef.current = true;
      onDone();
      return;
    }

    // World-space point under the inventory HUD (top-center of the screen),
    // computed from the live camera so it tracks pan/zoom/resize.
    anchor.current
      .set(HUD_X[resource] ?? 0, 0.92, 0.5)
      .unproject(camera);

    // Fades the collectible shapes only — the ring is excluded (it has its
    // own lifecycle) so its opacity can never be clobbered by the traverse.
    const setOpacity = (opacity) => {
      group.traverse((obj) => {
        if (obj.isMesh && obj.material && obj !== ringRef.current) {
          obj.material.opacity = opacity;
        }
      });
    };

    if (t < POP_END) {
      // ── Spawn pop: leap off the tile with an elastic overshoot ──
      const k = t / POP_END;
      // Ease-out rise to the launch apex
      const rise = 0.3 * (1 - (1 - k) * (1 - k));
      group.position.set(position[0], position[1] + rise, position[2]);
      const s = 1 + 0.55 * Math.sin(k * Math.PI) * (1 - k);
      group.scale.setScalar(s);
      group.rotation.y = Math.sin(k * Math.PI) * 0.8;

      setOpacity(1);
      // Expanding white ring flash at the harvest spot
      if (ringRef.current) {
        ringRef.current.scale.setScalar(1 + k * 1.6);
        ringRef.current.material.opacity = 0.8 * (1 - k);
      }
    } else {
      // ── Flight: accelerate toward the HUD, shrinking & fading out ──
      const k = (t - POP_END) / (1 - POP_END);
      const ease = k * k; // ease-in — starts slow, then snaps home
      from.current.set(position[0], position[1] + 0.3, position[2]);
      group.position.lerpVectors(from.current, anchor.current, ease);
      group.scale.setScalar(1 - ease * 0.85);
      group.rotation.y = ease * Math.PI * 3;
      group.rotation.x = ease * Math.PI * 0.6;

      const fade = k < FLIGHT_FADE ? 1 : 1 - (k - FLIGHT_FADE) / (1 - FLIGHT_FADE);
      setOpacity(fade);
      if (ringRef.current) ringRef.current.material.opacity = 0; // ring spent
    }
  });

  return (
    <group ref={groupRef} position={position}>
      {/* Expanding ring flash at the harvest spot */}
      <mesh ref={ringRef} position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.08, 0.16, 24]} />
        <meshBasicMaterial
          color="#ffffff"
          transparent
          opacity={0}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      <ResourceShape resource={resource} />
    </group>
  );
}
