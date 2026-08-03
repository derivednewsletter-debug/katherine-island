import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useGameStore } from '../state/gameStore';

/**
 * Rain shower visual — a single LineSegments field of falling streaks
 * covering the whole island, rendered whenever the store's weather says
 * it's raining. One draw call; streaks recycle to the top as they fall.
 *
 * The material fades in/out over ~a second so a shower doesn't pop on/off.
 * Falls on REAL time (dt), not game time — the weather state decides
 * whether it rains, but the streaks themselves always animate smoothly
 * even if the player pauses the clock mid-shower.
 */
const STREAK_COUNT = 900;
// World bounds: the 160-tile island spans ±79.5 in x/z; pad generously so
// rain is visible at any camera zoom. Terrain peaks sit ~2 units high, so
// streaks fall from well above the tallest peak down to the ground plane.
const EXTENT = 110;
const TOP = 34;
const BOTTOM = 1.5;
const STREAK_LEN = 2.4;
const FALL_SPEED = 46;

/** Random streak positions: each streak is a line from (x,y,z) to
 *  (x + slant, y - STREAK_LEN, z) with a subtle wind slant. */
function buildStreaks() {
  const pos = new Float32Array(STREAK_COUNT * 6);
  for (let i = 0; i < STREAK_COUNT; i++) {
    const x = (Math.random() * 2 - 1) * EXTENT;
    const y = BOTTOM + Math.random() * (TOP - BOTTOM);
    const z = (Math.random() * 2 - 1) * EXTENT;
    const slant = 0.35 + Math.random() * 0.3;
    pos[i * 6 + 0] = x;
    pos[i * 6 + 1] = y;
    pos[i * 6 + 2] = z;
    pos[i * 6 + 3] = x + slant;
    pos[i * 6 + 4] = y - STREAK_LEN;
    pos[i * 6 + 5] = z + slant * 0.4;
  }
  return pos;
}

export default function Rain() {
  const lineRef = useRef();
  const matRef = useRef();
  const opacity = useRef(0);

  // Build once (never rebuilds — the field is static geometry animated in
  // place by mutating the position attribute each frame).
  const positions = useMemo(buildStreaks, []);

  useFrame((_, dt) => {
    const raining = useGameStore.getState().weather?.raining ?? false;

    // Fade toward the target opacity (~1s in/out)
    const target = raining ? 0.3 : 0;
    opacity.current += (target - opacity.current) * Math.min(1, dt * 3);
    if (matRef.current) matRef.current.opacity = opacity.current;
    if (lineRef.current) lineRef.current.visible = opacity.current > 0.02;

    // Fully faded out → skip the fall simulation entirely (the streaks are
    // invisible, so recycling them buys nothing). Saves ~900 iterations/frame
    // whenever the sky is dry.
    if (!raining && opacity.current < 0.02) return;

    // Fall: move every streak down, recycling to the top once below ground
    const pos = positions;
    const step = FALL_SPEED * dt;
    const wrap = TOP - BOTTOM + STREAK_LEN;
    for (let i = 0; i < STREAK_COUNT; i++) {
      let y = pos[i * 6 + 1] - step;
      if (y < BOTTOM) {
        y += wrap;
        // Re-randomize the horizontal position so recycled streaks don't
        // fall in the same column forever.
        pos[i * 6 + 0] = (Math.random() * 2 - 1) * EXTENT;
        pos[i * 6 + 2] = (Math.random() * 2 - 1) * EXTENT;
      }
      pos[i * 6 + 1] = y;
      pos[i * 6 + 4] = y - STREAK_LEN;
    }
    if (lineRef.current) {
      lineRef.current.geometry.attributes.position.needsUpdate = true;
    }
  });

  return (
    <lineSegments ref={lineRef} frustumCulled={false} renderOrder={6}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <lineBasicMaterial
        ref={matRef}
        color="#b8d4ff"
        transparent
        opacity={0}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </lineSegments>
  );
}
