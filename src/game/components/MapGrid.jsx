import React, { useState, useCallback, useRef } from 'react';
import Tile, { TILE_SIZE_CONST, TILE_THICKNESS } from './Tile';
import Pickup from './Pickup';
import { mapData, GRID_SIZE } from '../data/mapData';
import { resourceForTerrain, GATHER_COOLDOWN_MS } from '../data/resources';
import { useGameStore } from '../state/gameStore';

/**
 * Renders the full 12x12 tile grid from mapData.
 * Handles hover/selection state for tiles, plus click-to-gather:
 * gatherable terrains spawn an animated pickup and credit the inventory.
 */
export default function MapGrid() {
  const [hoveredTile, setHoveredTile] = useState(null);
  const [selectedTile, setSelectedTile] = useState(null);
  const [pickups, setPickups] = useState([]);

  // Per-tile last-gathered timestamp (keyed by "col,row") for regrowth pacing
  const lastGathered = useRef(new Map());
  const pickupId = useRef(0);

  const handleHover = useCallback((position) => {
    setHoveredTile(position);
  }, []);

  const handleClick = useCallback((terrain, position) => {
    setSelectedTile({ terrain, position });

    const resource = resourceForTerrain(terrain.type);
    if (!resource) return; // water/shallow: nothing to gather

    // position = [worldX, rowIndex, worldZ] — the pair is unique per tile
    const key = `${position[0]},${position[1]}`;
    const now = performance.now();
    const last = lastGathered.current.get(key) ?? 0;
    if (now - last < GATHER_COOLDOWN_MS) return; // still regrowing

    lastGathered.current.set(key, now);

    // Credit inventory in the global store (notifies the HUD)
    useGameStore.getState().addResource(resource, 1);

    // Spawn a pickup floating up from the tile's surface
    const id = pickupId.current++;
    setPickups((prev) => [
      ...prev,
      {
        id,
        resource,
        position: [position[0], terrain.height + TILE_THICKNESS, position[2]],
      },
    ]);
  }, []);

  const removePickup = useCallback((id) => {
    setPickups((prev) => prev.filter((p) => p.id !== id));
  }, []);

  // Center the grid in world space
  const offset = (GRID_SIZE - 1) / 2;

  return (
    <group>
      {mapData.map((row, rowIndex) =>
        row.map((tile, colIndex) => {
          const worldX = (colIndex - offset) * TILE_SIZE_CONST;
          const worldZ = (rowIndex - offset) * TILE_SIZE_CONST;
          const pos = [worldX, rowIndex, worldZ]; // col, originalRow, z

          const isSelected =
            selectedTile &&
            selectedTile.position[0] === pos[0] &&
            selectedTile.position[2] === pos[2];

          return (
            <group key={`${rowIndex}-${colIndex}`}>
              <Tile
                terrain={tile}
                position={pos}
                isHovered={
                  hoveredTile &&
                  hoveredTile[0] === pos[0] &&
                  hoveredTile[2] === pos[2]
                }
                onHover={handleHover}
                onClick={handleClick}
              />

              {/* Selection ring */}
              {isSelected && (
                <mesh
                  position={[pos[0], tile.height + 0.22, pos[2]]}
                  rotation={[-Math.PI / 2, 0, 0]}
                >
                  <ringGeometry args={[0.35, 0.45, 4]} />
                  <meshBasicMaterial color="#ffd700" side={2} />
                </mesh>
              )}
            </group>
          );
        })
      )}

      {/* Animated resource pickups */}
      {pickups.map((p) => (
        <Pickup
          key={p.id}
          resource={p.resource}
          position={p.position}
          onDone={() => removePickup(p.id)}
        />
      ))}

      {/* Base ocean plane — stretches beyond the island */}
      <mesh
        position={[0, -0.2, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[GRID_SIZE * 2, GRID_SIZE * 2]} />
        <meshBasicMaterial color="#1e4a7a" />
      </mesh>
    </group>
  );
}
