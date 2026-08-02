import React, { useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useGameStore } from '../state/gameStore';

/**
 * Lighting keyframes for the day-night cycle.
 * `t` is the normalized phase (0..1). Values between keyframes are
 * smoothly interpolated, so the sun arcing across the sky drags colors
 * and intensities from warm noon through golden hour to moonlit night.
 */
// Sun positions are scaled for the big island (directional light direction
// is what matters, but keeping it far away keeps the shadow camera sane).
const KEYFRAMES = [
  { t: 0.0, bg: '#0a1428', ambient: 0.3, ambientColor: '#223354', sun: 0.35, sunColor: '#b9ccff', fill: 0.18, sunPos: [-24, 12, 16] },
  { t: 0.15, bg: '#33507e', ambient: 0.4, ambientColor: '#4a5c86', sun: 0.7, sunColor: '#ffd9a0', fill: 0.24, sunPos: [-32, 24, 16] },
  { t: 0.3, bg: '#87ceeb', ambient: 0.5, ambientColor: '#ffe4cc', sun: 1.2, sunColor: '#fff8e7', fill: 0.3, sunPos: [-12, 44, 16] },
  { t: 0.5, bg: '#8fd3f0', ambient: 0.6, ambientColor: '#fff3dd', sun: 1.35, sunColor: '#fffdf4', fill: 0.32, sunPos: [20, 64, 16] },
  { t: 0.68, bg: '#f4a261', ambient: 0.5, ambientColor: '#ffd9b0', sun: 1.05, sunColor: '#ffb36b', fill: 0.28, sunPos: [44, 36, 16] },
  { t: 0.82, bg: '#1c2547', ambient: 0.35, ambientColor: '#3a4a72', sun: 0.5, sunColor: '#c9b8ff', fill: 0.18, sunPos: [32, 16, 16] },
  { t: 1.0, bg: '#0a1428', ambient: 0.3, ambientColor: '#223354', sun: 0.35, sunColor: '#b9ccff', fill: 0.18, sunPos: [-24, 12, 16] },
];

// Precompute THREE.Color instances once (module scope)
const KF = KEYFRAMES.map((k) => ({
  ...k,
  bgColor: new THREE.Color(k.bg),
  ambientColor: new THREE.Color(k.ambientColor),
  sunColor: new THREE.Color(k.sunColor),
}));

/**
 * Owns the sky + lighting and animates them through a slow day-night cycle.
 * Renders the background color, ambient light, shadow-casting sun, and a
 * cool fill light so the whole scene responds to time of day.
 */
export default function DayNightCycle() {
  const bgRef = useRef(); // THREE.Color (scene background)
  const ambientRef = useRef();
  const sunRef = useRef();
  const fillRef = useRef();

  useFrame(() => {
    // Tick off the shared game clock: pause/fast-forward affect the sky too.
    // `time` already carries the boot offset, so the phase matches the HUD.
    const { time, dayCycleSeconds } = useGameStore.getState();
    const phase = (time % dayCycleSeconds) / dayCycleSeconds;

    // Find the surrounding keyframe pair
    let a = KF[0];
    let b = KF[KF.length - 1];
    let local = 0;
    for (let i = 0; i < KF.length - 1; i++) {
      if (phase >= KF[i].t && phase <= KF[i + 1].t) {
        a = KF[i];
        b = KF[i + 1];
        const span = b.t - a.t;
        local = span === 0 ? 0 : (phase - a.t) / span;
        break;
      }
    }

    const lerp = THREE.MathUtils.lerp;

    if (bgRef.current) {
      bgRef.current.copy(a.bgColor).lerp(b.bgColor, local);
    }
    if (ambientRef.current) {
      ambientRef.current.color.copy(a.ambientColor).lerp(b.ambientColor, local);
      ambientRef.current.intensity = lerp(a.ambient, b.ambient, local);
    }
    if (sunRef.current) {
      sunRef.current.color.copy(a.sunColor).lerp(b.sunColor, local);
      sunRef.current.intensity = lerp(a.sun, b.sun, local);
      sunRef.current.position.set(
        lerp(a.sunPos[0], b.sunPos[0], local),
        lerp(a.sunPos[1], b.sunPos[1], local),
        lerp(a.sunPos[2], b.sunPos[2], local)
      );
    }
    if (fillRef.current) {
      fillRef.current.intensity = lerp(a.fill, b.fill, local);
    }
  });

  return (
    <>
      {/* Sky background */}
      <color ref={bgRef} attach="background" args={['#87ceeb']} />

      {/* Ambient light */}
      <ambientLight ref={ambientRef} intensity={0.55} color="#ffe4cc" />

      {/* Sun — casts soft stylized shadows across the whole massive island
          (shadow frustum covers the 160-tile map). */}
      <directionalLight
        ref={sunRef}
        position={[32, 64, 16]}
        intensity={1.2}
        color="#fff8e7"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-far={400}
        shadow-camera-left={-110}
        shadow-camera-right={110}
        shadow-camera-top={110}
        shadow-camera-bottom={-110}
      />

      {/* Cool fill light from the opposite side */}
      <directionalLight ref={fillRef} position={[-5, 4, -6]} intensity={0.3} color="#c8e6ff" />
    </>
  );
}
