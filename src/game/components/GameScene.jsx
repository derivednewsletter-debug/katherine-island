import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { MapControls, OrthographicCamera } from '@react-three/drei';
import MapGrid from './MapGrid';
import CameraTracker from './CameraTracker';
import Creature from './Creature';
import Player from './Player';
import Bed from './Bed';
import Decorations from './Decorations';
import PlacementSystem from './PlacementSystem';
import ShopKiosk from './ShopKiosk';
import DayNightCycle from './DayNightCycle';
import Eggs from './Egg';
import Pets from './Pets';
import Crops from './Crops';
import FogOfWar from './FogOfWar';
import Rain from './Rain';
import { CAMERA_MIN_ZOOM, CAMERA_MAX_ZOOM, CAMERA_DEFAULT_ZOOM } from '../data/mapData';

/**
 * Scene content rendered inside the R3F Canvas.
 * Camera, controls, and lighting are set up here because
 * they must be children of the Canvas.
 */
function SceneContent() {
  return (
    <>
      {/* ── Camera ──
          The island is now 200 tiles wide, so the default zoom frames the
          spawn region with the island sprawling into the distance. Scroll
          way out (minZoom 2) to see the whole 200×200 archipelago. */}
      <OrthographicCamera
        makeDefault
        position={[60, 60, 60]}
        zoom={CAMERA_DEFAULT_ZOOM}
        near={0.1}
        far={1000}
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
        minZoom={CAMERA_MIN_ZOOM}
        maxZoom={CAMERA_MAX_ZOOM}
        screenSpacePanning={false}
        target={[0, 0, 0]}
      />

      {/* ── Day/Night lighting + sky (replaces static lights) ── */}
      <DayNightCycle />

      {/* ── Camera tracker — feeds the DOM minimap + flies on panTo ── */}
      <CameraTracker />

      {/* ── Fog of war — dims unexplored terrain until the camera sees it ── */}
      <FogOfWar />

      {/* ── Rain — full-island shower streaks, faded in by the weather ── */}
      <Rain />

      {/* ── Map Grid ── */}
      <Suspense fallback={null}>
        <MapGrid />
        <Creature />
        <Player />
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
        toneMappingExposure: 1.2,
        outputColorSpace: 'srgb',
        powerPreference: 'high-performance',
      }}
      style={{ background: '#87ceeb' }}
    >
      <SceneContent />
      {/* Toggle with Ctrl+Shift+H during development */}
      {/* <Stats /> */}
    </Canvas>
  );
}
