import React, { useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useCursor } from '@react-three/drei';
import { worldToGrid, gridToWorld, getTile } from '../data/mapData';
import { canPlaceDecoration } from '../data/decorations';
import { KIOSK_TILE } from '../data/shop';
import { useGameStore } from '../state/gameStore';
import { TILE_THICKNESS } from './Tile';
import { KIND_COMPONENT } from './Decorations';

const GHOST_COLORS = {
  valid: '#4ade80', // green: the click will plant (or erase)
  blocked: '#f87171', // red: water, occupied, or the pet's tile
};

const GHOST_SCALE = 0.9;

/**
 * Build-mode interaction layer.
 *
 * While a palette tool is active this renders an invisible ground plane
 * that catches the cursor: it raycasts to find the tile under the mouse,
 * shows a tinted ghost of the selected prop (green = valid, red = blocked),
 * and plants on click. The eraser tool uses the same plane to remove.
 * The plane sits below the tiles, so gathering clicks still reach MapGrid —
 * which gates them off while build mode is on.
 */
export default function PlacementSystem() {
  const active = useGameStore((s) => s.placement.active);
  const tool = useGameStore((s) => s.placement.tool);
  const ghostRef = useRef();

  const [hover, setHover] = useState(null); // { row, col, x, z, y, valid }

  // Crosshair while in build mode
  useCursor(active, 'crosshair');

  // The ghost prop slowly rotates so the preview feels alive
  useFrame((_, delta) => {
    if (ghostRef.current) ghostRef.current.rotation.y += delta * 0.6;
  });

  /** Is a click on this cell going to do something useful with `tool`? */
  const isActionable = (toolId, s, row, col) => {
    if (toolId === 'erase') {
      return s.decorations.some((d) => d.row === row && d.col === col);
    }
    return canPlaceDecoration(s.decorations, row, col, s.creaturePos, KIOSK_TILE);
  };

  const updateHover = (point) => {
    if (!active) {
      setHover(null);
      return;
    }
    const { row, col } = worldToGrid(point.x, point.z);
    const tile = getTile(row, col);
    const s = useGameStore.getState();
    const valid = isActionable(tool, s, row, col);
    const { x, z } = gridToWorld(row, col);
    setHover({
      row,
      col,
      x,
      z,
      y: tile ? tile.height + TILE_THICKNESS : 0,
      valid,
    });
  };

  const handleClick = (e) => {
    if (!active) return;
    e.stopPropagation();
    // Recompute from the live intersection so the click can't act on a
    // stale hover cell.
    const { row, col } = worldToGrid(e.point.x, e.point.z);
    const s = useGameStore.getState();
    if (!isActionable(tool, s, row, col)) return;
    if (tool === 'erase') s.removeDecoration(row, col);
    else s.placeDecoration(tool, row, col);
  };

  // Erase mode is derived from the live tool (not stale hover state), so
  // switching tools mid-hover can't resolve KIND_COMPONENT to undefined.
  const isErase = tool === 'erase';
  const Ghost = !isErase ? KIND_COMPONENT[tool] : null;

  return (
    <group>
      {/* Invisible interaction plane — raycast target for hover + clicks */}
      <mesh
        position={[0, -0.4, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        visible={false}
        onPointerMove={(e) => updateHover(e.point)}
        onPointerOut={() => setHover(null)}
        onClick={handleClick}
      >
        <planeGeometry args={[200, 200]} />
      </mesh>

      {/* Ghost preview under the cursor */}
      {active && hover && (
        <group position={[hover.x, hover.y, hover.z]} raycast={() => null}>
          {/* Ground marker on the tile face */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
            <ringGeometry args={[0.32, 0.52, 4]} />
            <meshBasicMaterial
              color={hover.valid ? GHOST_COLORS.valid : GHOST_COLORS.blocked}
              transparent
              opacity={0.9}
              side={THREE.DoubleSide}
            />
          </mesh>

          {isErase ? (
            /* Eraser indicator — a hovering orb over the tile to remove */
            <mesh position={[0, 0.38, 0]} raycast={() => null}>
              <sphereGeometry args={[0.18, 12, 12]} />
              <meshBasicMaterial
                color={hover.valid ? '#f87171' : '#94a3b8'}
                transparent
                opacity={hover.valid ? 0.85 : 0.35}
              />
            </mesh>
          ) : (
            /* Tinted ghost of the selected prop, gently spinning */
            Ghost && (
              <group ref={ghostRef} scale={GHOST_SCALE}>
                <Ghost tint={hover.valid ? GHOST_COLORS.valid : GHOST_COLORS.blocked} />
              </group>
            )
          )}
        </group>
      )}
    </group>
  );
}
