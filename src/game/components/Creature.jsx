import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { gridToWorld, worldToGrid, getTile } from '../data/mapData';
import { findPath, getRandomWalkableTarget } from '../ai/pathfinding';
import { useGameStore, moodFromNeeds, MOODS } from '../state/gameStore';
import { TILE_THICKNESS } from './Tile';

const WALK_SPEED = 1.6; // tiles per second
const HEART_COUNT = 6;

// Mood → movement speed multiplier (a tired pet shuffles, a happy one bounds)
const MOOD_SPEED = {
  happy: 1.25,
  content: 1,
  hungry: 0.85,
  tired: 0.6,
  sad: 0.75,
};

const COLORS = {
  body: '#f5dc9a',
  belly: '#fdf3d3',
  ears: '#e8bf7e',
  eyes: '#2b2b33',
  cheeks: '#f79ab0',
  leaf: '#7fb069',
  accent: '#d9a05b',
};

/** World-space Y of the top surface of a tile (feet rest here). */
function surfaceHeightAt(row, col) {
  const tile = getTile(row, col);
  return tile ? tile.height + TILE_THICKNESS : 0;
}

/** Smoothly interpolate an angle, taking the shortest arc. */
function lerpAngle(a, b, t) {
  let diff = b - a;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return a + diff * t;
}

/**
 * Katherine's pet: a cute low-poly critter that wanders the island.
 *
 * Behavior state machine:
 *   idle -> (pause) -> walk (A* path) -> sit (rest) -> idle -> ...
 *
 * Interactions:
 *   - Click to pet: hearts burst, happy bounce, speech bubble.
 *   - Hover: cursor changes to pointer.
 */
export default function Creature() {
  const groupRef = useRef();
  const bodyRef = useRef();
  const headRef = useRef();
  const leftFootRef = useRef();
  const rightFootRef = useRef();
  const tailRef = useRef();
  const eyeGroupRef = useRef();
  const heartGroupRef = useRef();
  const heartMeshesRef = useRef([]);

  const [bubble, setBubble] = useState(null);

  // Subscribe to the pet's mood (string selector → re-renders only on mood
  // change, not on every needs tick). Used for the mood indicator above its head.
  const mood = useGameStore((s) => moodFromNeeds(s.needs));

  // Start on a grass tile near the island center
  const start = gridToWorld(4, 4);
  const startY = surfaceHeightAt(4, 4);

  // Internal animation state (refs so per-frame updates don't re-render React)
  const state = useRef({
    mode: 'idle', // 'idle' | 'walk' | 'sit'
    path: [], // world waypoints [{x, z}]
    pathIndex: 0,
    pos: { x: start.x, z: start.z }, // current world position
    yaw: 0, // facing direction
    timer: 1.2, // idle/sit pause timer
    blinkTimer: 2,
    blinkHold: 0,
  });

  // Hearts particle pool (avoid mount/unmount churn)
  const hearts = useRef(
    Array.from({ length: HEART_COUNT }, () => ({
      active: false,
      life: 0,
      maxLife: 1,
      vy: 0,
      scale: 1,
      offset: new THREE.Vector3(),
    }))
  ).current;

  const heartGeometry = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(0.5, 0.5);
    shape.bezierCurveTo(0.5, 0.5, 0.4, 0, 0, 0);
    shape.bezierCurveTo(-0.6, 0, -0.6, 0.7, -0.6, 0.7);
    shape.bezierCurveTo(-0.6, 1.1, -0.3, 1.54, 0.5, 1.9);
    shape.bezierCurveTo(1.2, 1.54, 1.6, 1.1, 1.6, 0.7);
    shape.bezierCurveTo(1.6, 0.7, 1.6, 0, 1, 0);
    shape.bezierCurveTo(0.7, 0, 0.5, 0.5, 0.5, 0.5);
    const geometry = new THREE.ShapeGeometry(shape);
    geometry.scale(0.07, 0.07, 0.07);
    return geometry;
  }, []);

  const heartMaterials = useMemo(
    () =>
      Array.from(
        { length: HEART_COUNT },
        () =>
          new THREE.MeshBasicMaterial({
            color: '#ff6b9d',
            transparent: true,
            opacity: 0,
            side: THREE.DoubleSide,
            toneMapped: false,
          })
      ),
    []
  );

  const bubbleTimer = useRef(0);
  const petPause = useRef(0);

  // Dispose the pooled heart resources if the pet ever unmounts
  useEffect(() => {
    return () => {
      heartGeometry.dispose();
      heartMaterials.forEach((m) => m.dispose());
    };
  }, [heartGeometry, heartMaterials]);

  /** Pick a random walkable destination and compute an A* path to it. */
  const tryStartWalking = () => {
    const s = state.current;
    const gridPos = worldToGrid(s.pos.x, s.pos.z);
    const target = getRandomWalkableTarget(gridPos.row, gridPos.col, 2);
    if (!target) {
      s.timer = 2;
      return;
    }
    const path = findPath(start.row, start.col, target.row, target.col);
    if (path.length === 0) {
      s.timer = 2;
      return;
    }
    s.path = path.map((p) => gridToWorld(p.row, p.col));
    s.pathIndex = 0;
    s.mode = 'walk';
  };

  /** Advance along the path; consume as many waypoints as the frame allows. */
  const stepAlongPath = (delta, speedMult = 1, restMult = 1) => {
    const s = state.current;
    let remaining = WALK_SPEED * speedMult * delta;

    while (s.pathIndex < s.path.length && remaining > 0) {
      const waypoint = s.path[s.pathIndex];
      const dx = waypoint.x - s.pos.x;
      const dz = waypoint.z - s.pos.z;
      const dist = Math.hypot(dx, dz);

      if (dist <= remaining) {
        s.pos.x = waypoint.x;
        s.pos.z = waypoint.z;
        remaining -= dist;
        s.pathIndex++;
      } else {
        s.pos.x += (dx / dist) * remaining;
        s.pos.z += (dz / dist) * remaining;
        s.yaw = lerpAngle(s.yaw, Math.atan2(dx, dz), Math.min(1, delta * 12));
        remaining = 0;
      }
    }

    if (s.pathIndex >= s.path.length) {
      s.mode = 'sit';
      // A tired pet rests longer
      s.timer = (2.5 + Math.random() * 3) * restMult;
    }
  };

  /** Click-to-pet: hearts burst, bounce, a happy bubble, +happiness. */
  const handlePet = (e) => {
    e.stopPropagation();
    petPause.current = 0.8;
    setBubble('hehe! ♥');
    bubbleTimer.current = 1.5;
    useGameStore.getState().boostNeed('happiness', 8);

    hearts.forEach((h) => {
      h.active = true;
      h.life = 0;
      h.maxLife = 1.0 + Math.random() * 0.7;
      h.vy = 0.4 + Math.random() * 0.35;
      h.scale = 0.5 + Math.random() * 0.5;
      h.offset.set(
        (Math.random() - 0.5) * 0.4,
        0.5 + Math.random() * 0.15,
        (Math.random() - 0.5) * 0.3
      );
    });
  };

  useFrame(({ camera, clock }, delta) => {
    const t = clock.getElapsedTime();
    const s = state.current;
    const group = groupRef.current;
    if (!group) return;

    // Clamp delta: after the tab regains focus, rAF can deliver a multi-second
    // gap, which would make the pet teleport across the island in one frame.
    const dt = Math.min(delta, 0.05);

    // Mood read live (no re-render): drives speed + animation feel
    const moodNow = moodFromNeeds(useGameStore.getState().needs);
    const speedMult = MOOD_SPEED[moodNow];
    const isTired = moodNow === 'tired';
    const isHappy = moodNow === 'happy';
    const isSad = moodNow === 'sad';

    // ---- State machine ----
    if (petPause.current > 0) {
      petPause.current -= dt; // petting freezes movement briefly
    } else if (s.mode === 'idle') {
      s.timer -= dt;
      if (s.timer <= 0) tryStartWalking();
    } else if (s.mode === 'walk') {
      stepAlongPath(dt, speedMult, isTired ? 1.6 : 1);
    } else if (s.mode === 'sit') {
      s.timer -= dt;
      if (s.timer <= 0) {
        s.mode = 'idle';
        s.timer = 1 + Math.random() * 1.5;
      }
    }

    // ---- Position + facing ----
    const grid = worldToGrid(s.pos.x, s.pos.z);
    const targetY = surfaceHeightAt(grid.row, grid.col);
    group.position.set(
      s.pos.x,
      THREE.MathUtils.lerp(group.position.y, targetY, Math.min(1, dt * 6)),
      s.pos.z
    );
    group.rotation.y = s.yaw;

    // ---- Breathing / walking bob (mood-adjusted) ----
    const isWalking = s.mode === 'walk';
    const breathe = Math.sin(t * 2.5) * 0.02;
    // Happy pets bounce higher & faster; tired ones plod along
    const bobFreq = isHappy ? 11 : isTired ? 5 : 9;
    const bobAmp = isHappy ? 0.06 : isTired ? 0.03 : 0.05;
    const bob = isWalking ? Math.abs(Math.sin(t * bobFreq)) * bobAmp : 0;
    if (bodyRef.current) {
      bodyRef.current.position.y = 0.22 + bob + (s.mode === 'sit' ? -0.06 : 0);
      bodyRef.current.scale.set(1 + breathe, 1 - breathe * 0.6, 1 + breathe);
    }
    if (headRef.current) {
      // Tired/sad pets hang their head slightly
      headRef.current.position.y = 0.42 + bob * 0.6 - (isTired ? 0.03 : isSad ? 0.02 : 0);
    }

    // ---- Feet march / tuck ----
    const footSwing = isWalking ? Math.sin(t * bobFreq) * 0.5 : s.mode === 'sit' ? 0.3 : 0;
    if (leftFootRef.current) leftFootRef.current.rotation.x = footSwing;
    if (rightFootRef.current) rightFootRef.current.rotation.x = -footSwing;

    // ---- Tail wag (happy = fast, sad = limp) ----
    if (tailRef.current) {
      const wag = isSad ? 0.6 : isHappy ? 1.4 : 1;
      tailRef.current.rotation.z =
        Math.sin(t * (isWalking ? 14 : 5)) * (s.mode === 'sit' ? 0.3 : 0.22) * wag;
    }

    // ---- Blinking (tired pets blink more) ----
    s.blinkTimer -= dt;
    if (s.blinkTimer <= 0 && s.blinkHold <= 0) {
      s.blinkHold = 0.12;
      s.blinkTimer = (isTired ? 0.8 : 2) + Math.random() * (isTired ? 1 : 3);
    }
    if (s.blinkHold > 0) s.blinkHold -= dt;
    if (eyeGroupRef.current) {
      eyeGroupRef.current.scale.y = s.blinkHold > 0 ? 0.1 : 1;
    }

    // ---- Hearts ----
    hearts.forEach((h, i) => {
      const mesh = heartMeshesRef.current[i];
      if (!mesh) return;
      if (!h.active) {
        mesh.visible = false;
        return;
      }
      h.life += dt;
      if (h.life >= h.maxLife) {
        h.active = false;
        mesh.visible = false;
        return;
      }
      const k = h.life / h.maxLife;
      h.offset.y += h.vy * delta;
      mesh.visible = true;
      mesh.position.copy(h.offset);
      const scale = h.scale * (1 - k * 0.5);
      mesh.scale.set(scale, scale, scale);
      mesh.material.opacity = 1 - k;
    });
    if (heartGroupRef.current) {
      heartGroupRef.current.quaternion.copy(camera.quaternion); // billboard hearts
    }

    // ---- Speech bubble timer ----
    if (bubbleTimer.current > 0) {
      bubbleTimer.current -= dt;
      if (bubbleTimer.current <= 0) setBubble(null);
    }
  });

  return (
    <group
      ref={groupRef}
      position={[start.x, startY, start.z]}
      onClick={handlePet}
      onPointerOver={(e) => {
        e.stopPropagation();
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={(e) => {
        e.stopPropagation();
        document.body.style.cursor = 'auto';
      }}
    >
      {/* Tail */}
      <mesh ref={tailRef} position={[0, 0.2, -0.24]} castShadow>
        <sphereGeometry args={[0.07, 12, 10]} />
        <meshToonMaterial color={COLORS.accent} />
      </mesh>

      {/* Feet */}
      <mesh ref={leftFootRef} position={[-0.11, 0.07, 0.08]} castShadow>
        <sphereGeometry args={[0.06, 12, 10]} />
        <meshToonMaterial color={COLORS.ears} />
      </mesh>
      <mesh ref={rightFootRef} position={[0.11, 0.07, 0.08]} castShadow>
        <sphereGeometry args={[0.06, 12, 10]} />
        <meshToonMaterial color={COLORS.ears} />
      </mesh>

      {/* Body + belly */}
      <mesh ref={bodyRef} position={[0, 0.22, 0]} castShadow>
        <sphereGeometry args={[0.2, 18, 14]} />
        <meshToonMaterial color={COLORS.body} />
      </mesh>
      <mesh position={[0, 0.18, 0.1]} scale={[1, 0.8, 0.6]}>
        <sphereGeometry args={[0.13, 14, 10]} />
        <meshToonMaterial color={COLORS.belly} />
      </mesh>

      {/* Head */}
      <mesh ref={headRef} position={[0, 0.42, 0.02]} castShadow>
        <sphereGeometry args={[0.14, 16, 12]} />
        <meshToonMaterial color={COLORS.body} />
      </mesh>
      {/* Ears */}
      <mesh position={[-0.1, 0.52, 0]} castShadow>
        <sphereGeometry args={[0.045, 10, 8]} />
        <meshToonMaterial color={COLORS.ears} />
      </mesh>
      <mesh position={[0.1, 0.52, 0]} castShadow>
        <sphereGeometry args={[0.045, 10, 8]} />
        <meshToonMaterial color={COLORS.ears} />
      </mesh>

      {/* Eyes (group scales Y for blinking) */}
      <group ref={eyeGroupRef}>
        <mesh position={[-0.055, 0.44, 0.14]}>
          <sphereGeometry args={[0.022, 8, 8]} />
          <meshToonMaterial color={COLORS.eyes} />
        </mesh>
        <mesh position={[0.055, 0.44, 0.14]}>
          <sphereGeometry args={[0.022, 8, 8]} />
          <meshToonMaterial color={COLORS.eyes} />
        </mesh>
      </group>
      {/* Cheeks */}
      <mesh position={[-0.09, 0.38, 0.11]}>
        <sphereGeometry args={[0.02, 8, 8]} />
        <meshToonMaterial color={COLORS.cheeks} />
      </mesh>
      <mesh position={[0.09, 0.38, 0.11]}>
        <sphereGeometry args={[0.02, 8, 8]} />
        <meshToonMaterial color={COLORS.cheeks} />
      </mesh>

      {/* Leaf tuft */}
      <mesh position={[0, 0.57, 0.02]} rotation={[0.2, 0, 0.3]} castShadow>
        <coneGeometry args={[0.035, 0.09, 6]} />
        <meshToonMaterial color={COLORS.leaf} />
      </mesh>

      {/* Heart particles */}
      <group ref={heartGroupRef} position={[0, 0.5, 0]}>
        {hearts.map((h, i) => (
          <mesh
            key={i}
            ref={(el) => (heartMeshesRef.current[i] = el)}
            geometry={heartGeometry}
            material={heartMaterials[i]}
            visible={false}
          />
        ))}
      </group>

      {/* Persistent mood indicator (subtle emoji above the head) */}
      <Html position={[0, 0.95, 0]} center style={{ pointerEvents: 'none' }} zIndexRange={[10, 0]}>
        <div
          style={{
            fontSize: 13,
            lineHeight: 1,
            textShadow: '0 1px 3px rgba(0,0,0,0.35)',
            transition: 'opacity 0.3s',
            opacity: mood === 'content' ? 0.45 : 1,
          }}
        >
          {MOODS[mood].emoji}
        </div>
      </Html>

      {/* Speech bubble */}
      {bubble && (
        <Html
          position={[0, 0.8, 0]}
          center
          style={{ pointerEvents: 'none' }}
        >
          <div
            style={{
              background: 'rgba(255,255,255,0.95)',
              color: '#c26a8b',
              padding: '4px 10px',
              borderRadius: 14,
              fontFamily: '"Segoe UI", system-ui, sans-serif',
              fontSize: 13,
              fontWeight: 700,
              boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
              whiteSpace: 'nowrap',
            }}
          >
            {bubble}
          </div>
        </Html>
      )}
    </group>
  );
}
