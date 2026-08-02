import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { MapControls, OrthographicCamera } from '@react-three/drei';
import MapGrid from './MapGrid';
import Creature from './Creature';
import Decorations from './Decorations';
import DayNightCycle from './DayNightCycle';

/**
 * Scene content rendered inside the R3F Canvas.
 * Camera, controls, and lighting are set up here because
 * they must be children of the Canvas.
 */
function SceneContent() {
  return (
    <>
      {/* ── Camera ── */}
      <OrthographicCamera
        makeDefault
        position={[14, 16, 14]}
        zoom={28}
        near={0.1}
        far={200}
      />

      {/* ── Controls ──
          MapControls (from Drei) wraps THREE.MapControls:
          pan + dolly/zoom. Rotation is disabled to lock the
          isometric viewing angle. */}
      <MapControls
        enableRotate={false}
        enableDamping
        dampingFactor={0.12}
        panSpeed={0.8}
        zoomSpeed={0.8}
        minZoom={12}
        maxZoom={60}
        screenSpacePanning={false}
        target={[0, 0, 0]}
      />

      {/* ── Day/Night lighting + sky (replaces static lights) ── */}
      <DayNightCycle />

      {/* ── Map Grid ── */}
      <Suspense fallback={null}>
        <MapGrid />
        <Creature />
        <Decorations />
      </Suspense>
    </>
  );
}

/**
 * Top-level game scene: provides the R3F Canvas and
 * configures the WebGL renderer.
 */
export default function GameScene() {
  return (
    <Canvas
      shadows
      gl={{
        antialias: true,
        toneMapping: 3, // ACESFilmic
        toneMappingExposure: 1.1,
        outputColorSpace: 'srgb',
      }}
      style={{ background: '#87ceeb' }}
    >
      <SceneContent />
      {/* Toggle with Ctrl+Shift+H during development */}
      {/* <Stats /> */}
    </Canvas>
  );
}
