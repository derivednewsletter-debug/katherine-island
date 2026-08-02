import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { MapControls, OrthographicCamera } from '@react-three/drei';
import MapGrid from './MapGrid';
import Creature from './Creature';
import Bed from './Bed';
import Decorations from './Decorations';
import PlacementSystem from './PlacementSystem';
import ShopKiosk from './ShopKiosk';
import DayNightCycle from './DayNightCycle';

/**
 * Scene content rendered inside the R3F Canvas.
 * Camera, controls, and lighting are set up here because
 * they must be children of the Canvas.
 */
function SceneContent() {
  return (
    <>
      {/* ── Camera ──
          zoom 38 frames the 14x14 island nicely — the island grew from
          12x12, and 38 keeps it filling more of the frame than before
          while staying under the ~40 clip point that shorter windows hit
          with the bigger footprint. */}
      <OrthographicCamera
        makeDefault
        position={[14, 16, 14]}
        zoom={38}
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
        minZoom={20}
        maxZoom={90}
        screenSpacePanning={false}
        target={[0, 0, 0]}
      />

      {/* ── Day/Night lighting + sky (replaces static lights) ── */}
      <DayNightCycle />

      {/* ── Map Grid ── */}
      <Suspense fallback={null}>
        <MapGrid />
        <Creature />
        <Bed />
        <Decorations />
        <PlacementSystem />
        <ShopKiosk />
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
