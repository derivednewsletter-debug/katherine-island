import React, { useState, useCallback, useRef, useEffect } from 'react';
import Tile, { TILE_SIZE_CONST, TILE_THICKNESS } from './Tile';
import Pickup from './Pickup';
import ResourceNode from './ResourceNode';
import { mapData, GRID_SIZE, worldToGrid } from '../data/mapData';
import { resourceForTerrain, GATHER_COOLDOWN_MS } from '../data/resources';
import { KIOSK_TILE } from '../data/shop';
import { useGameStore } from '../state/gameStore';

/**
 * Renders the full 14x14 tile grid from mapData.
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

  // Tiles currently harvested & regrowing (their resource node is hidden).
  // Mirrors the lastGathered ref so the visuals match the cooldown logic.
  const [depleted, setDepleted] = useState(() => new Set());
  const regrowTimers = useRef(new Map()); // key -> timeout id

  // Clear pending regrow timers on unmount (StrictMode-safe)
  useEffect(() => {
    const timers = regrowTimers.current;
    return () => {
      timers.forEach((t) => clearTimeout(t));
      timers.clear();
    };
  }, []);

  const handleHover = useCallback((position) => {
    setHoveredTile(position);
  }, []);

  const handleClick = useCallback((terrain, position) => {
    // In build mode clicks plant decorations instead of gathering
    if (useGameStore.getState().placement.active) return;

    setSelectedTile({ terrain, position });

    const resource = resourceForTerrain(terrain.type);
    if (!resource) return; // water/shallow: nothing to gather

    // The shop kiosk owns its tile — clicking the stall shouldn't also
    // harvest the sand beneath it (the kiosk's stopPropagation can't stop
    // its sibling Tile from receiving the same click).
    const g = worldToGrid(position[0], position[2]);
    if (g.row === KIOSK_TILE.row && g.col === KIOSK_TILE.col) return;

    // position = [worldX, rowIndex, worldZ] — the pair is unique per tile
    const key = `${position[0]},${position[1]}`;
    const now = performance.now();
    const last = lastGathered.current.get(key) ?? 0;
    if (now - last < GATHER_COOLDOWN_MS) return; // still regrowing

    lastGathered.current.set(key, now);

    // Hide the tile's resource node for the cooldown window, then pop it
    // back in when the tile regrows.
    setDepleted((prev) => new Set(prev).add(key));
    regrowTimers.current.set(
      key,
      setTimeout(() => {
        regrowTimers.current.delete(key);
        setDepleted((prev) => {
          if (!prev.has(key)) return prev;
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      }, GATHER_COOLDOWN_MS)
    );

    // Shop upgrades grant +1 per gather for their resource
    const s = useGameStore.getState();
    const bonus = {
      berry: s.upgrades.berryBasket ? 1 : 0,
      shell: s.upgrades.shellBucket ? 1 : 0,
      stone: s.upgrades.stonePick ? 1 : 0,
    }[resource] ?? 0;
    const amount = 1 + bonus;

    // Credit inventory in the global store (notifies the HUD)
    s.addResource(resource, amount);

    // Spawn a pickup per unit so doubled harvests visibly pop twice
    const base = pickupId.current;
    pickupId.current += amount;
    const fresh = Array.from({ length: amount }, (_, i) => ({
      id: base + i,
      resource,
      position: [
        position[0] + (i === 0 ? 0 : 0.06),
        terrain.height + TILE_THICKNESS,
        position[2] + (i === 1 ? 0.06 : 0),
      ],
    }));
    setPickups((prev) => [...prev, ...fresh]);
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

          const isKiosk =
            rowIndex === KIOSK_TILE.row && colIndex === KIOSK_TILE.col;
          const key = `${pos[0]},${rowIndex}`;

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

              {/* Resource node (bush / shells / rocks) — hidden while the
                  tile is depleted & regrowing. The kiosk tile is exempt: the
                  stall sits on sand but owns its tile. */}
              {!isKiosk && !depleted.has(key) && resourceForTerrain(tile.type) && (
                <ResourceNode terrain={tile} position={pos} />
              )}

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

      {/* Base ocean plane — a tight rim around the island so the ocean
          doesn't dominate the frame (was 2x grid size = a giant blue slab) */}
      <mesh
        position={[0, -0.2, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[GRID_SIZE * 1.5, GRID_SIZE * 1.5]} />
        <meshBasicMaterial color="#1e4a7a" />
      </mesh>

      {/* Distant horizon plane far behind the island — blends the ocean
          rim into the sky so zooming out doesn't reveal a hard edge */}
      <mesh position={[0, -0.3, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[GRID_SIZE * 10, GRID_SIZE * 10]} />
        <meshBasicMaterial color="#5a8fc9" />
      </mesh>
    </group>
  );
}
