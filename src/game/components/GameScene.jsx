import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { MapControls, OrthographicCamera } from '@react-three/drei';
import MapGrid from './MapGrid';
import CameraTracker from './CameraTracker';
import Creature from './Creature';
import Bed from './Bed';
import Decorations from './Decorations';
import PlacementSystem from './PlacementSystem';
import ShopKiosk from './ShopKiosk';
import DayNightCycle from './DayNightCycle';
import Eggs from './Egg';
import Pets from './Pets';
import Crops from './Crops';
import FogOfWar from './FogOfWar';

/**
 * Scene content rendered inside the R3F Canvas.
 * Camera, controls, and lighting are set up here because
 * they must be children of the Canvas.
 */
function SceneContent() {
  return (
    <>
      {/* ── Camera ──
          The island is now 160 tiles wide, so the default zoom frames the
          spawn region with the island sprawling into the distance. Scroll
          way out (minZoom 3) to see the whole archipelago. */}
      <OrthographicCamera
        makeDefault
        position={[50, 55, 50]}
        zoom={9}
        near={0.1}
        far={900}
      />

      {/* ── Controls ──
          MapControls (from Drei) wraps THREE.MapControls:
          pan + dolly/zoom. Rotation is disabled to lock the
          isometric viewing angle. */}
      {/* makeDefault registers these controls in the R3F state so the
          CameraTracker (and the minimap pan-to) can reach them. */}
      <MapControls
        makeDefault
        enableRotate={false}
        enableDamping
        dampingFactor={0.12}
        panSpeed={1.6}
        zoomSpeed={0.9}
        minZoom={3}
        maxZoom={70}
        screenSpacePanning={false}
        target={[0, 0, 0]}
      />

      {/* ── Day/Night lighting + sky (replaces static lights) ── */}
      <DayNightCycle />

      {/* ── Camera tracker — feeds the DOM minimap + flies on panTo ── */}
      <CameraTracker />

      {/* ── Fog of war — dims unexplored terrain until the camera sees it ── */}
      <FogOfWar />

      {/* ── Map Grid ── */}
      <Suspense fallback={null}>
        <MapGrid />
        <Creature />
        <Pets />
        <Bed />
        <Decorations />
        <Eggs />
        <Crops />
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
