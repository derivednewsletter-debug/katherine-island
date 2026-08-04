import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { gridToWorld, worldToGrid, getTile, BED_SPOT, SPAWN_POINT } from '../data/mapData';
import { findPath, getRandomWalkableTarget } from '../ai/pathfinding';
import { useGameStore, moodFromNeeds, MOODS, timeOfDay, FEED_BY_RESOURCE } from '../state/gameStore';
import { TILE_THICKNESS } from './Tile';
import { HEART_COUNT, MOOD_SPEED, makeHeartGeometry, makeHearts } from './petParts';
import { playEvolutionFanfare } from '../audio/sfx';

const WALK_SPEED = 1.6; // tiles per second
const SPARK_COUNT = 26;
const SPARK_COLORS = ['#ffd166', '#ff9fb6', '#a3e4ff', '#ffe9a8'];

/**
 * Per-stage look: babies are small + pastel; adults are bigger with the
 * vivid tropical palette. `scale` multiplies the whole pet, `colors` swaps
 * every mesh palette on evolution.
 */
const STAGE_STYLE = {
  baby: {
    scale: 0.8,
    colors: {
      body: '#fdf0d0',
      belly: '#fffaf2',
      ears: '#f6dcaa',
      eyes: '#4a4a55',
      cheeks: '#ffc2d4',
      leaf: '#a8d69a',
      accent: '#e9cf9d',
    },
  },
  adult: {
    scale: 1.15,
    colors: {
      body: '#f5dc9a',
      belly: '#fdf3d3',
      ears: '#e8bf7e',
      eyes: '#2b2b33',
      cheeks: '#f79ab0',
      leaf: '#7fb069',
      accent: '#d9a05b',
    },
  },
  child: {
    scale: 0.95,
    colors: {
      body: '#fbe9bb',
      belly: '#fdf8e8',
      ears: '#efc886',
      eyes: '#3a3a44',
      cheeks: '#faa9b9',
      leaf: '#92c47e',
      accent: '#e3b46b',
    },
  },
  elder: {
    scale: 1.25,
    colors: {
      body: '#cfcfcf',
      belly: '#e8e8e8',
      ears: '#b8b8b8',
      eyes: '#4d4d52',
      cheeks: '#cbb0b8',
      leaf: '#9aa89a',
      accent: '#a8a8a8',
    },
  },
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
  const sparkGroupRef = useRef();
  const sparkMeshesRef = useRef([]);
  const ringRef = useRef();

  const [bubble, setBubble] = useState(null);

  // Subscribe to the pet's mood (string selector → re-renders only on mood
  // change, not on every needs tick). Used for the mood indicator above its
  // head. Passes isNight so the night-calm mood bonus reads here too.
  const mood = useGameStore((s) =>
    moodFromNeeds(s.needs, !timeOfDay(s.time, s.dayCycleSeconds).isDay)
  );

  // Sleep flag drives the sleeping mood emoji above the head.
  const sleeping = useGameStore((s) => s.sleeping);

  // Growth stage: swaps size + colors, and fires the celebration on evolve.
  const stage = useGameStore((s) => s.stage);
  const stageStyle = STAGE_STYLE[stage] ?? STAGE_STYLE.baby;
  const colors = stageStyle.colors;
  const sick = useGameStore((s) => s.sick || s.needs.hunger < 25 || s.needs.hygiene < 25);
  const visualColors = sick ? { ...colors, body: '#8fb89b', belly: '#b7d0b5', ears: '#739a7d', cheeks: '#9bb7a0' } : colors;
  const prevStageRef = useRef(stage);
  const evolvePulse = useRef(0); // 1 → 0 celebration scale pop

  // Start in the procedural spawn clearing (roomy grass near the center)
  const start = gridToWorld(SPAWN_POINT.row, SPAWN_POINT.col);
  const startY = surfaceHeightAt(SPAWN_POINT.row, SPAWN_POINT.col);

  // Internal animation state (refs so per-frame updates don't re-render React)
  const state = useRef({
    mode: 'idle', // 'idle' | 'walk' | 'sit' | 'fetchOut' | 'fetchBack' | 'follow'
    path: [],
    actionTarget: null,
    followHeartTimer: 0, // world waypoints [{x, z}]
    pathIndex: 0,
    pos: { x: start.x, z: start.z }, // current world position
    yaw: 0, // facing direction
    timer: 1.2, // idle/sit pause timer
    blinkTimer: 2,
    blinkHold: 0,
    animTime: 0, // accumulated game-time (drives bob/wag/blink so pause & speed apply)
  });

  // Hearts particle pool (avoid mount/unmount churn)
  const hearts = useRef(makeHearts()).current;

  // Evolution spark particle pool
  const sparks = useRef(
    Array.from({ length: SPARK_COUNT }, () => ({
      active: false,
      life: 0,
      maxLife: 1,
      vx: 0,
      vy: 0,
      vz: 0,
      scale: 1,
      offset: new THREE.Vector3(),
    }))
  ).current;

  const heartGeometry = useMemo(() => makeHeartGeometry(), []);

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

  // Spark geometry + per-particle colored materials (gold/pink/ice/warm)
  const sparkGeometry = useMemo(() => new THREE.OctahedronGeometry(0.05), []);
  const sparkMaterials = useMemo(
    () =>
      Array.from(
        { length: SPARK_COUNT },
        (_, i) =>
          new THREE.MeshBasicMaterial({
            color: SPARK_COLORS[i % SPARK_COLORS.length],
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
  const munchPulse = useRef(0); // 1 → 0 feeding chew; drives a quick head-bob wiggle

  /** Evolution celebration: scale pop, spark burst, ring flash, bubble. */
  const triggerEvolution = () => {
    playEvolutionFanfare(); // rising sparkle arpeggio
    evolvePulse.current = 1;
    setBubble('I grew up! 🎉');
    bubbleTimer.current = 2;
    sparks.forEach((sp) => {
      sp.active = true;
      sp.life = 0;
      sp.maxLife = 0.9 + Math.random() * 0.8;
      const ang = Math.random() * Math.PI * 2;
      const speed = 0.9 + Math.random() * 1.1;
      sp.vx = Math.cos(ang) * speed;
      sp.vz = Math.sin(ang) * speed;
      sp.vy = 1.2 + Math.random() * 0.9;
      sp.scale = 0.6 + Math.random() * 0.7;
      sp.offset.set(0, 0.5, 0);
    });
  };

  // Fire the celebration the moment the stage changes (baby → adult).
  useEffect(() => {
    if (prevStageRef.current !== stage) {
      prevStageRef.current = stage;
      triggerEvolution();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  // Dispose the pooled particle resources if the pet ever unmounts
  useEffect(() => {
    return () => {
      heartGeometry.dispose();
      heartMaterials.forEach((m) => m.dispose());
      sparkGeometry.dispose();
      sparkMaterials.forEach((m) => m.dispose());
    };
  }, [heartGeometry, heartMaterials, sparkGeometry, sparkMaterials]);

  /** Night fell — walk to the mat (A* around plants) and curl up there. */
  const startWalkingToBed = () => {
    const s = state.current;
    const gridPos = worldToGrid(s.pos.x, s.pos.z);
    const blocked = (row, col) => useGameStore.getState().isTileBlocked(row, col);
    const path = findPath(gridPos.row, gridPos.col, BED_SPOT.row, BED_SPOT.col, blocked);
    if (path.length === 0) {
      // Already on the mat (or it's walled off) — just curl up here
      s.mode = 'sleep';
      useGameStore.getState().setSleeping(true);
      return;
    }
    s.path = path.map((p) => gridToWorld(p.row, p.col));
    s.pathIndex = 0;
    s.mode = 'gotoBed';
  };

  /** Pick a random unblocked destination and compute an A* path to it. */
  const tryStartWalking = () => {
    const s = state.current;
    const gridPos = worldToGrid(s.pos.x, s.pos.z);
    // Tiles holding decorations are impassable — route around them
    const blocked = (row, col) => useGameStore.getState().isTileBlocked(row, col);
    const target = getRandomWalkableTarget(gridPos.row, gridPos.col, 2, blocked, 24);
    if (!target) {
      s.timer = 2;
      return;
    }
    const path = findPath(gridPos.row, gridPos.col, target.row, target.col, blocked);
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

  const startActionPath = (target, mode) => {
    const current = state.current;
    const from = worldToGrid(current.pos.x, current.pos.z);
    const blocked = (row, col) => useGameStore.getState().isTileBlocked(row, col);
    const path = findPath(from.row, from.col, target.row, target.col, blocked);
    if (!path.length) return false;
    current.path = path.map((point) => gridToWorld(point.row, point.col));
    current.pathIndex = 0;
    current.mode = mode;
    current.actionTarget = target;
    return true;
  };

  /** Pop a heart burst (used by petting AND feeding). */
  const burstHearts = () => {
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

  /**
   * Click-to-pet (or feed, when holding a berry): hearts burst, bounce, a
   * happy bubble, +happiness and a care point toward evolution.
   */
  const handlePet = (e) => {
    e.stopPropagation();

    // Clicking the starter selects it for the needs HUD (pet selector).
    useGameStore.getState().selectPet('starter');

    // A sleeping pet can't be petted — just a gentle hush.
    if (useGameStore.getState().sleeping) {
      setBubble('shh… 💤');
      bubbleTimer.current = 1.4;
      return;
    }

    // Feeding beats petting while a feedable treat is held: munch, hearts,
    // bubble. Feed THIS pet (the starter) — not whatever the HUD selected.
    const held = useGameStore.getState().holding;
    if (held && FEED_BY_RESOURCE[held]) {
      const fed = useGameStore.getState().feedPet('starter');
      if (fed) {
        munchPulse.current = 1;
        petPause.current = 0.9; // stop and enjoy the treat
        setBubble('yum yum! 🍓');
        bubbleTimer.current = 1.6;
        burstHearts();
        useGameStore.getState().recordQuestProgress('feed', 1);
      } else {
        setBubble('no treats left…');
        bubbleTimer.current = 1.4;
      }
      return;
    }

    // Soap/medkit are used on THIS pet (the starter) via click.
    if (held === 'soap') {
      const ok = useGameStore.getState().bathePet('starter');
      setBubble(ok ? 'fresh + clean! ✨' : 'need soap…');
      if (ok) burstHearts();
      bubbleTimer.current = 1.5;
      return;
    }
    if (held === 'medkit') {
      const ok = useGameStore.getState().curePet('starter');
      setBubble(ok ? 'all better! 💗' : 'need a medkit…');
      if (ok) burstHearts();
      bubbleTimer.current = 1.5;
      return;
    }

    petPause.current = 0.8;
    setBubble('hehe! ♥');
    bubbleTimer.current = 1.5;
    useGameStore.getState().boostNeed('happiness', 8);
    useGameStore.getState().addCare(1);
    useGameStore.getState().recordQuestProgress('pet', 1);
    burstHearts();
  };

  useFrame(({ camera }, delta) => {
    const s = state.current;
    const group = groupRef.current;
    if (!group) return;

    // Tick off the shared game clock: pause freezes the pet mid-pose and
    // timeScale (1x/2x/4x) scales movement AND animation speed. Clamp raw
    // delta so a backgrounded tab can't teleport the pet across the island.
    const { paused, timeScale, time, dayCycleSeconds, sleeping } = useGameStore.getState();
    const dt = paused ? 0 : Math.min(delta, 0.05) * timeScale;
    s.animTime += dt;
    const t = s.animTime;

    // Night = any phase outside daylight (0.2–0.75). When it falls the pet
    // heads to its mat; when dawn breaks it wakes up.
    const isNight = !timeOfDay(time, dayCycleSeconds).isDay;

    // Mood read live (no re-render): drives speed + animation feel.
    // isNight (computed above) feeds the night-calm mood bonus.
    const moodNow = moodFromNeeds(useGameStore.getState().needs, isNight);
    const speedMult = MOOD_SPEED[moodNow] ?? 1;
    const followTarget = useGameStore.getState().playerPos
      ? { row: useGameStore.getState().playerPos.row - Math.round(Math.sin(useGameStore.getState().playerDir) * 2), col: useGameStore.getState().playerPos.col - Math.round(Math.cos(useGameStore.getState().playerDir) * 2) }
      : null;
    const live = useGameStore.getState();
    if (!live.sleeping && !live.sick && live.fetchTarget && !['fetchOut', 'fetchBack'].includes(s.mode)) startActionPath(live.fetchTarget, 'fetchOut');
    else if (!live.sleeping && !live.sick && live.followingPetId === 'starter' && s.mode === 'idle' && followTarget) startActionPath(followTarget, 'follow');
    const isTired = moodNow === 'tired';
    const isHappy = moodNow === 'happy';
    const isSad = moodNow === 'sad';

    // ---- State machine ----
    if (petPause.current > 0) {
      petPause.current -= dt; // petting freezes movement briefly
    } else if (!isNight && (sleeping || s.mode === 'sleep' || s.mode === 'gotoBed')) {
      // Dawn broke — wake up and greet the day
      useGameStore.getState().setSleeping(false);
      s.mode = 'idle';
      s.timer = 1;
      setBubble('Good morning! ☀️');
      bubbleTimer.current = 1.6;
    } else if (isNight && s.mode !== 'sleep' && s.mode !== 'gotoBed') {
      // Night fell — head to the mat (interrupts whatever it was doing)
      startWalkingToBed();
    } else if (s.mode === 'gotoBed') {
      stepAlongPath(dt, speedMult, isTired ? 1.6 : 1);
      if (s.mode === 'sit') {
        // Reached the mat — curl up for the night
        s.mode = 'sleep';
        useGameStore.getState().setSleeping(true);
      }
    } else if (s.mode === 'sleep') {
      // Asleep — pose handled below; energy recharges via the store
    } else if (s.mode === 'idle') {
      s.timer -= dt;
      if (s.timer <= 0) tryStartWalking();
    } else if (s.mode === 'walk') {
      stepAlongPath(dt, speedMult, isTired ? 1.6 : 1);
    } else if (s.mode === 'fetchOut' || s.mode === 'fetchBack' || s.mode === 'follow') {
      const actionMode = s.mode;
      stepAlongPath(dt, actionMode === 'fetchOut' ? 1.8 : 1.2, 1);
      if (s.mode === 'sit') {
        if (actionMode === 'fetchOut') {
          const player = live.playerPos;
          if (player && startActionPath(player, 'fetchBack')) s.actionTarget = player;
          else { live.fetchReturned('starter'); burstHearts(); }
        } else if (actionMode === 'fetchBack') {
          live.fetchReturned('starter');
          burstHearts();
        } else if (live.followingPetId === 'starter') {
          s.mode = 'idle';
          s.timer = 0.2;
          s.followHeartTimer -= dt;
          if (s.followHeartTimer <= 0) { live.followHeart('starter'); s.followHeartTimer = 1; burstHearts(); }
        }
      }
    } else if (s.mode === 'sit') {
      s.timer -= dt;
      if (s.timer <= 0) {
        s.mode = 'idle';
        s.timer = 1 + Math.random() * 1.5;
      }
    }

    // ---- Position + facing ----
    const grid = worldToGrid(s.pos.x, s.pos.z);
    // Tell the store which cell the pet occupies (only fires on change) so
    // build mode can forbid planting on the pet's tile.
    useGameStore.getState().setCreaturePos(grid.row, grid.col);
    const targetY = surfaceHeightAt(grid.row, grid.col);
    group.position.set(
      s.pos.x,
      THREE.MathUtils.lerp(group.position.y, targetY, Math.min(1, dt * 6)),
      s.pos.z
    );
    group.rotation.y = s.yaw;
    // Body size by growth stage + a brief oversize pop during the celebration
    evolvePulse.current = Math.max(0, evolvePulse.current - dt * 1.6);
    group.scale.setScalar(stageStyle.scale * (1 + evolvePulse.current * 0.4));

    // ---- Breathing / walking bob (mood-adjusted) ----
    const isSleeping = s.mode === 'sleep';
    const isWalking = s.mode === 'walk' || s.mode === 'gotoBed';
    // Sleepers breathe slow; otherwise normal tempo
    const breathe = Math.sin(t * (isSleeping ? 1.5 : 2.5)) * 0.02;
    // Happy pets bounce higher & faster; tired ones plod along
    const bobFreq = isHappy ? 11 : isTired ? 5 : 9;
    const bobAmp = isHappy ? 0.06 : isTired ? 0.03 : 0.05;
    const bob = isWalking ? Math.abs(Math.sin(t * bobFreq)) * bobAmp : 0;
    if (bodyRef.current) {
      if (isSleeping) {
        // Curled up: squashed + lowered, like a cozy ball
        bodyRef.current.position.y = 0.13;
        bodyRef.current.scale.set(1.18, 0.72, 1.24);
      } else {
        bodyRef.current.position.y = 0.22 + bob + (s.mode === 'sit' ? -0.06 : 0);
        bodyRef.current.scale.set(1 + breathe, 1 - breathe * 0.6, 1 + breathe);
      }
    }
    if (headRef.current) {
      if (isSleeping) {
        // Head resting forward on the body
        headRef.current.position.y = 0.3;
        headRef.current.rotation.x = 0.35;
      } else {
        // Tired/sad pets hang their head slightly
        headRef.current.position.y = 0.42 + bob * 0.6 - (isTired ? 0.03 : isSad ? 0.02 : 0);
        headRef.current.rotation.x = 0;
      }
    }

    // ---- Munching (feeding): quick chew bob on the head + body wiggle ----
    if (munchPulse.current > 0) {
      munchPulse.current = Math.max(0, munchPulse.current - dt * 3);
      const chew = Math.sin(t * 22);
      if (headRef.current) headRef.current.position.y += Math.abs(chew) * 0.03 * munchPulse.current;
      if (bodyRef.current) bodyRef.current.rotation.z = chew * 0.06 * munchPulse.current;
    }

    // ---- Feet march / tuck (sleepers tuck their feet in) ----
    const footSwing = isWalking
      ? Math.sin(t * bobFreq) * 0.5
      : isSleeping
        ? 0.5
        : s.mode === 'sit'
          ? 0.3
          : 0;
    if (leftFootRef.current) leftFootRef.current.rotation.x = footSwing;
    if (rightFootRef.current) rightFootRef.current.rotation.x = -footSwing;

    // ---- Tail wag (happy = fast, sad = limp, asleep = barely there) ----
    if (tailRef.current) {
      const wag = isSad ? 0.6 : isHappy ? 1.4 : 1;
      tailRef.current.rotation.z =
        Math.sin(t * (isWalking ? 14 : isSleeping ? 2.2 : 5)) *
        (s.mode === 'sit' ? 0.3 : isSleeping ? 0.12 : 0.22) *
        wag;
    }

    // ---- Blinking (tired pets blink more; sleepers keep eyes closed) ----
    s.blinkTimer -= dt;
    if (s.blinkTimer <= 0 && s.blinkHold <= 0) {
      s.blinkHold = 0.12;
      s.blinkTimer = (isTired ? 0.8 : 2) + Math.random() * (isTired ? 1 : 3);
    }
    if (s.blinkHold > 0) s.blinkHold -= dt;
    if (eyeGroupRef.current) {
      eyeGroupRef.current.scale.y = s.blinkHold > 0 || isSleeping ? 0.1 : 1;
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
      h.offset.y += h.vy * dt;
      mesh.visible = true;
      mesh.position.copy(h.offset);
      const scale = h.scale * (1 - k * 0.5);
      mesh.scale.set(scale, scale, scale);
      mesh.material.opacity = 1 - k;
    });
    if (heartGroupRef.current) {
      heartGroupRef.current.quaternion.copy(camera.quaternion); // billboard hearts
    }

    // ---- Evolution sparks (radial burst that falls with gravity) ----
    sparks.forEach((sp, i) => {
      const mesh = sparkMeshesRef.current[i];
      if (!mesh) return;
      if (!sp.active) {
        mesh.visible = false;
        return;
      }
      sp.life += dt;
      if (sp.life >= sp.maxLife) {
        sp.active = false;
        mesh.visible = false;
        return;
      }
      const k = sp.life / sp.maxLife;
      sp.offset.x += sp.vx * dt;
      sp.offset.y += sp.vy * dt;
      sp.offset.z += sp.vz * dt;
      sp.vy -= 2.4 * dt; // sparks arc up, then fall
      mesh.visible = true;
      mesh.position.copy(sp.offset);
      mesh.scale.setScalar(sp.scale * (1 - k * 0.6));
      mesh.material.opacity = 1 - k;
    });
    if (sparkGroupRef.current) {
      sparkGroupRef.current.quaternion.copy(camera.quaternion); // billboard sparks
    }

    // ---- Celebration ring flash at the pet's feet ----
    if (ringRef.current) {
      const p = evolvePulse.current;
      ringRef.current.visible = p > 0.01;
      if (p > 0.01) {
        ringRef.current.scale.setScalar(0.6 + (1 - p) * 2.6);
        ringRef.current.material.opacity = p * 0.9;
      }
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
      {/* Celebration ring flash (evolution) */}
      <mesh
        ref={ringRef}
        position={[0, 0.06, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        visible={false}
      >
        <ringGeometry args={[0.2, 0.32, 28]} />
        <meshBasicMaterial
          color="#ffd166"
          transparent
          opacity={0}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      {/* Tail */}
      <mesh ref={tailRef} position={[0, 0.2, -0.24]} castShadow>
        <sphereGeometry args={[0.07, 12, 10]} />
        <meshToonMaterial color={visualColors.accent} />
      </mesh>

      {/* Feet */}
      <mesh ref={leftFootRef} position={[-0.11, 0.07, 0.08]} castShadow>
        <sphereGeometry args={[0.06, 12, 10]} />
        <meshToonMaterial color={visualColors.ears} />
      </mesh>
      <mesh ref={rightFootRef} position={[0.11, 0.07, 0.08]} castShadow>
        <sphereGeometry args={[0.06, 12, 10]} />
        <meshToonMaterial color={visualColors.ears} />
      </mesh>

      {/* Body + belly */}
      <mesh ref={bodyRef} position={[0, 0.22, 0]} castShadow>
        <sphereGeometry args={[0.2, 18, 14]} />
        <meshToonMaterial color={visualColors.body} />
      </mesh>
      <mesh position={[0, 0.18, 0.1]} scale={[1, 0.8, 0.6]}>
        <sphereGeometry args={[0.13, 14, 10]} />
        <meshToonMaterial color={visualColors.belly} />
      </mesh>

      {/* Head */}
      <mesh ref={headRef} position={[0, 0.42, 0.02]} castShadow>
        <sphereGeometry args={[0.14, 16, 12]} />
        <meshToonMaterial color={visualColors.body} />
      </mesh>
      {/* Ears */}
      <mesh position={[-0.1, 0.52, 0]} castShadow>
        <sphereGeometry args={[0.045, 10, 8]} />
        <meshToonMaterial color={visualColors.ears} />
      </mesh>
      <mesh position={[0.1, 0.52, 0]} castShadow>
        <sphereGeometry args={[0.045, 10, 8]} />
        <meshToonMaterial color={visualColors.ears} />
      </mesh>

      {/* Eyes (group scales Y for blinking) */}
      <group ref={eyeGroupRef}>
        <mesh position={[-0.055, 0.44, 0.14]}>
          <sphereGeometry args={[0.022, 8, 8]} />
          <meshToonMaterial color={colors.eyes} />
        </mesh>
        <mesh position={[0.055, 0.44, 0.14]}>
          <sphereGeometry args={[0.022, 8, 8]} />
          <meshToonMaterial color={colors.eyes} />
        </mesh>
      </group>
      {/* Cheeks */}
      <mesh position={[-0.09, 0.38, 0.11]}>
        <sphereGeometry args={[0.02, 8, 8]} />
        <meshToonMaterial color={colors.cheeks} />
      </mesh>
      <mesh position={[0.09, 0.38, 0.11]}>
        <sphereGeometry args={[0.02, 8, 8]} />
        <meshToonMaterial color={colors.cheeks} />
      </mesh>

      {/* Leaf tuft */}
      <mesh position={[0, 0.57, 0.02]} rotation={[0.2, 0, 0.3]} castShadow>
        <coneGeometry args={[0.035, 0.09, 6]} />
        <meshToonMaterial color={colors.leaf} />
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

      {/* Evolution spark particles */}
      <group ref={sparkGroupRef} position={[0, 0.5, 0]}>
        {sparks.map((sp, i) => (
          <mesh
            key={i}
            ref={(el) => (sparkMeshesRef.current[i] = el)}
            geometry={sparkGeometry}
            material={sparkMaterials[i]}
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
            opacity: mood === 'content' && !sleeping ? 0.45 : 1,
          }}
        >
          <span className={sleeping ? 'sleep-emoji' : undefined}>
            {sleeping ? '💤' : sick ? '🤒' : MOODS[mood].emoji}
          </span>
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
