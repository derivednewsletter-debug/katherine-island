import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useGameStore } from '../state/gameStore';
import { getTile, isWalkable, gridToWorld, GRID_SIZE, SPAWN_POINT } from '../data/mapData';
import { TILE_THICKNESS } from '../components/Tile';
import { playStep, playGatherPop } from '../audio/sfx';

const PLAYER_WALK_SPEED = 5.0; // tiles per second

const DIRECTION_VECTORS = {
  ArrowUp: { row: -1, col: 0, angle: 0 },
  ArrowDown: { row: 1, col: 0, angle: Math.PI },
  ArrowLeft: { row: 0, col: -1, angle: -Math.PI / 2 },
  ArrowRight: { row: 0, col: 1, angle: Math.PI / 2 },
  w: { row: -1, col: 0, angle: 0 },
  s: { row: 1, col: 0, angle: Math.PI },
  a: { row: 0, col: -1, angle: -Math.PI / 2 },
  d: { row: 0, col: 1, angle: Math.PI / 2 },
};

/**
 * Find an adjacent tree (palm or big tree decoration) next to the player.
 * Returns { row, col, decoration } or null.
 */
function findAdjacentTree(playerRow, playerCol, decorations) {
  const dirs = [
    { dr: -1, dc: 0 }, { dr: 1, dc: 0 }, { dr: 0, dc: -1 }, { dr: 0, dc: 1 },
  ];
  for (const { dr, dc } of dirs) {
    const tr = playerRow + dr;
    const tc = playerCol + dc;
    const tree = decorations.find(
      (d) => d.row === tr && d.col === tc && (d.kind === 'palm' || d.kind === 'tree')
    );
    if (tree) return { row: tr, col: tc, tree };
  }
  return null;
}

function surfaceHeightAt(row, col) {
  const tile = getTile(row, col);
  return tile ? tile.height + TILE_THICKNESS : 0;
}

/** Tools the player can switch between */
const TOOLS = ['axe', 'hoe', null];

export default function Player() {
  const groupRef = useRef();
  const bodyRef = useRef();
  const targetVecRef = useRef(new THREE.Vector3());
  const leftArmRef = useRef();
  const rightArmRef = useRef();

  // Movement animation state lives in refs, not React state: it changes
  // every frame while walking, and driving React re-renders at 60fps for
  // a purely visual interpolation would be wasted work.
  const keysRef = useRef({});
  const targetPosRef = useRef(null);
  const moveProgressRef = useRef(1);

  const playerPos = useGameStore((s) => s.playerPos);
  const playerDir = useGameStore((s) => s.playerDir);
  const playerTool = useGameStore((s) => s.playerTool);
  const decorations = useGameStore((s) => s.decorations);
  const placedEggs = useGameStore((s) => s.placedEggs);

  const movePlayer = useGameStore((s) => s.movePlayer);
  const setPlayerDir = useGameStore((s) => s.setPlayerDir);
  const chopTree = useGameStore((s) => s.chopTree);
  const showToast = useGameStore((s) => s.showToast);
  const tools = useGameStore((s) => s.tools);
  const inventory = useGameStore((s) => s.inventory);

  // Keyboard event handlers
  useEffect(() => {
    const down = (e) => {
      if (e.repeat) return;
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      keysRef.current[e.key] = true;

      if (DIRECTION_VECTORS[e.key]) {
        const dir = DIRECTION_VECTORS[e.key];
        const newRow = playerPos.row + dir.row;
        const newCol = playerPos.col + dir.col;

        // Bounds check
        if (newRow < 0 || newRow >= GRID_SIZE || newCol < 0 || newCol >= GRID_SIZE) return;

        // Check tile is walkable
        const tile = getTile(newRow, newCol);
        if (!tile || !isWalkable(tile)) return;

        // Check no obstacles
        if (decorations.some((d) => d.row === newRow && d.col === newCol)) return;
        if (placedEggs.some((e) => e.row === newRow && e.col === newCol)) return;
        if (newRow === SPAWN_POINT.row && newCol === SPAWN_POINT.col) return; // don't walk on pet (rough)

        setPlayerDir(dir.angle);
        movePlayer(newRow, newCol);
        targetPosRef.current = { row: newRow, col: newCol };
        moveProgressRef.current = 0;
        playStep();
      }

       // Tool interaction: E key
      if (e.key === 'e' || e.key === 'E') {
        if (playerTool === 'axe') {
          const tree = findAdjacentTree(playerPos.row, playerPos.col, decorations);
          if (tree && (tools.axe > 0)) {
            chopTree(tree.row, tree.col);
            playGatherPop();
            const newDurability = Math.max(0, tools.axe - 1);
            useGameStore.setState({ tools: { ...tools, axe: newDurability } });
            showToast('Chopped a tree! +1 Wood');
          } else if (!tree) {
            showToast('No tree adjacent');
          } else if (tools.axe <= 0) {
            showToast('Your axe is broken!');
          }
        } else if (playerTool === 'hoe') {
          // Hoe: harvest adjacent ready crops
          const crops = useGameStore.getState().crops;
          const dirs = [
            { dr: -1, dc: 0 }, { dr: 1, dc: 0 }, { dr: 0, dc: -1 }, { dr: 0, dc: 1 },
          ];
          let found = false;
          for (const { dr, dc } of dirs) {
            const cr = playerPos.row + dr;
            const tc = playerPos.col + dc;
            const crop = crops.find((c) => c.row === cr && c.col === tc);
            if (crop) {
              const harvested = useGameStore.getState().harvestCrop(cr, tc);
              if (harvested) {
                playGatherPop();
                found = true;
                break;
              }
            }
          }
          if (found) {
            showToast('Harvested crops!');
          } else {
            showToast('No crops adjacent — plant some seeds first!');
          }
        } else {
          showToast('Select a tool (1: Axe, 2: Hoe)');
        }
      }

      // Tool switch: 1 = axe, 2 = hoe, 3 = none
      if (e.key === '1') setPlayerTool('axe');
      if (e.key === '2') setPlayerTool('hoe');
      if (e.key === '3') setPlayerTool(null);
    };

    const up = (e) => {
      delete keysRef.current[e.key];
    };

    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [playerPos, playerTool, decorations, placedEggs, movePlayer, setPlayerDir, chopTree, showToast, tools, playStep, playGatherPop]);

  // Animation: interpolate toward target
  const worldPos = useMemo(() => {
    const { x, z } = gridToWorld(playerPos.row, playerPos.col);
    return [x, surfaceHeightAt(playerPos.row, playerPos.col) + 0.4, z];
  }, [playerPos.row, playerPos.col]);

  useFrame((_, dt) => {
    if (targetPosRef.current && moveProgressRef.current < 1) {
      const newProgress = Math.min(1, moveProgressRef.current + dt * PLAYER_WALK_SPEED);
      moveProgressRef.current = newProgress;

      if (newProgress >= 1) {
        targetPosRef.current = null;
      }
    }

    const moveProgress = moveProgressRef.current;

    // Bobbing animation when moving
    if (bodyRef.current) {
      if (moveProgress > 0 && moveProgress < 1) {
        bodyRef.current.position.y = Math.sin(moveProgress * Math.PI) * 0.05;
        bodyRef.current.rotation.z = Math.sin(moveProgress * Math.PI) * 0.05;
      } else {
        bodyRef.current.position.y = 0;
        bodyRef.current.rotation.z = 0;
      }
    }

    // Arm swing when moving
    if (leftArmRef.current && rightArmRef.current) {
      if (moveProgress > 0 && moveProgress < 1) {
        const swing = Math.sin(moveProgress * Math.PI) * 0.2;
        leftArmRef.current.rotation.x = swing;
        rightArmRef.current.rotation.x = -swing;
      } else {
        leftArmRef.current.rotation.x = 0;
        rightArmRef.current.rotation.x = 0;
      }
    }

    // Update group position
    if (groupRef.current) {
      groupRef.current.position.lerp(
        targetVecRef.current.set(worldPos[0], worldPos[1], worldPos[2]),
        1 - Math.exp(-dt * 8)
      );
      // Face direction
      groupRef.current.rotation.y = playerDir;
    }
  });

  // Tool color indicator
  const TOOL_COLOR = { axe: '#8d6b4b', hoe: '#6b4423', wateringCan: '#3b82f6' };
  const toolColor = playerTool ? (TOOL_COLOR[playerTool] || '#ffffff') : '#ffffff';

  return (
    <group ref={groupRef} position={[worldPos[0], worldPos[1], worldPos[2]]}>
      {/* Body */}
      <mesh position={[0, 0.3, 0]} ref={bodyRef}>
        <capsuleGeometry args={[0.2, 0.4, 4, 8]} />
        <meshLambertMaterial color="#4f8cff" />
      </mesh>

      {/* Left arm (holds tool) */}
      <group ref={leftArmRef} position={[-0.25, 0.15, 0]}>
        <mesh position={[0, -0.2, 0]}>
          <boxGeometry args={[0.1, 0.45, 0.1]} />
          <meshLambertMaterial color="#6b4423" />
        </mesh>
        {playerTool && (
          <mesh position={[0, -0.5, 0]}>
            <boxGeometry args={[0.15, 0.6, 0.1]} />
            <meshLambertMaterial color={toolColor} />
          </mesh>
        )}
      </group>

      {/* Right arm */}
      <mesh ref={rightArmRef} position={[0.25, 0.15, 0]}>
        <boxGeometry args={[0.1, 0.45, 0.1]} />
        <meshLambertMaterial color="#4f8cff" />
      </mesh>

      {/* Hat */}
      <mesh position={[0, 0.7, 0]}>
        <cylinderGeometry args={[0.28, 0.28, 0.15, 8]} />
        <meshLambertMaterial color="#8d6b4b" />
      </mesh>
      <mesh position={[0, 0.78, 0]}>
        <cylinderGeometry args={[0.08, 0.28, 0.25, 8]} />
        <meshLambertMaterial color="#8d6b4b" />
      </mesh>
    </group>
  );
}