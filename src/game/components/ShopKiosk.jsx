import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { gridToWorld, getTile } from '../data/mapData';
import { KIOSK_TILE } from '../data/shop';
import { useGameStore } from '../state/gameStore';
import { TILE_THICKNESS } from './Tile';

/**
 * A cute low-poly market stall parked on the beach. Click it to open (or
 * close) the shop panel — it's the "floating 3D store" the HUD button is
 * the shortcut for. Hovers show a pointer + a little label.
 */
export default function ShopKiosk() {
  const awningRef = useRef();
  const signRef = useRef();

  // Sit on the kiosk tile's surface
  const { x, z } = gridToWorld(KIOSK_TILE.row, KIOSK_TILE.col);
  const tile = getTile(KIOSK_TILE.row, KIOSK_TILE.col);
  const y = (tile ? tile.height : 0) + TILE_THICKNESS;

  const toggle = (e) => {
    e.stopPropagation();
    useGameStore.getState().toggleShop();
  };

  // Gentle idle sway so the stall feels alive
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (awningRef.current) awningRef.current.rotation.z = Math.sin(t * 1.2) * 0.04;
    if (signRef.current) signRef.current.position.y = Math.sin(t * 1.8) * 0.03;
  });

  return (
    <group
      position={[x, y, z]}
      onClick={toggle}
      onPointerOver={(e) => {
        e.stopPropagation();
        // Don't override the build-mode crosshair
        if (!useGameStore.getState().placement.active) {
          document.body.style.cursor = 'pointer';
        }
      }}
      onPointerOut={(e) => {
        e.stopPropagation();
        // Restore the build-mode crosshair if placement is active
        document.body.style.cursor = useGameStore.getState().placement.active
          ? 'crosshair'
          : 'auto';
      }}
    >
      {/* Stall base / counter */}
      <mesh position={[0, 0.18, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.9, 0.36, 0.5]} />
        <meshToonMaterial color="#b98a5e" />
      </mesh>
      <mesh position={[0, 0.34, 0.02]} castShadow>
        <boxGeometry args={[0.86, 0.06, 0.44]} />
        <meshToonMaterial color="#e8c39a" />
      </mesh>

      {/* Goods on the counter */}
      <mesh position={[-0.18, 0.42, 0.05]}>
        <sphereGeometry args={[0.07, 10, 8]} />
        <meshToonMaterial color="#ff9eb0" />
      </mesh>
      <mesh position={[0.16, 0.42, 0.05]}>
        <sphereGeometry args={[0.06, 10, 8]} />
        <meshToonMaterial color="#ffcf6e" />
      </mesh>
      <mesh position={[0, 0.44, 0.06]}>
        <coneGeometry args={[0.05, 0.1, 6]} />
        <meshToonMaterial color="#5fc3e8" />
      </mesh>

      {/* Two posts holding the awning */}
      <mesh position={[-0.38, 0.62, 0]} castShadow>
        <cylinderGeometry args={[0.025, 0.025, 0.6, 6]} />
        <meshToonMaterial color="#8a6a4a" />
      </mesh>
      <mesh position={[0.38, 0.62, 0]} castShadow>
        <cylinderGeometry args={[0.025, 0.025, 0.6, 6]} />
        <meshToonMaterial color="#8a6a4a" />
      </mesh>

      {/* Striped awning */}
      <group ref={awningRef} position={[0, 0.98, 0]}>
        {[-0.45, -0.25, -0.05, 0.15, 0.35].map((px, i) => (
          <mesh key={i} position={[px, 0, 0]} castShadow>
            <boxGeometry args={[0.18, 0.05, 0.56]} />
            <meshToonMaterial color={i % 2 === 0 ? '#ff6b9d' : '#ffffff'} />
          </mesh>
        ))}
      </group>

      {/* Floating "🛒 Shop" sign — hovers above the awning (which sits ~1.0) */}
      <group ref={signRef}>
        <Html position={[0, 1.35, 0]} center style={{ pointerEvents: 'none' }} zIndexRange={[10, 0]}>
          <div
            style={{
              background: 'rgba(0,0,0,0.6)',
              color: '#fff',
              padding: '3px 10px',
              borderRadius: 12,
              fontFamily: '"Segoe UI", system-ui, sans-serif',
              fontSize: 12,
              fontWeight: 700,
              whiteSpace: 'nowrap',
              boxShadow: '0 2px 6px rgba(0,0,0,0.25)',
            }}
          >
            🛒 Shop
          </div>
        </Html>
      </group>
    </group>
  );
}
