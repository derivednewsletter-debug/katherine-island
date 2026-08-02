import React, { useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { useGameStore } from '../state/gameStore';
import { PET_SPECIES, EGG_HATCH_MS, formatCountdown } from '../data/species';

/** How long the crack-burst plays before the egg is actually hatched. */
const HATCH_BURST_S = 1.1;
const CRACK_COUNT = 16;
const CRACK_COLORS = ['#fff6e0', '#ffe9c9', '#f6e3f5', '#eaf6e0', '#ffd166'];

/**
 * Low-poly egg shell. `species` drives the shell + spot colors; `tint`
 * (placement ghost) renders a single translucent color instead.
 */
export function EggModel({ species = 'bunny', tint, scale = 1 }) {
  const sp = PET_SPECIES[species] ?? PET_SPECIES.bunny;
  const shell = tint ?? sp.eggColor;
  return (
    <group scale={scale}>
      {/* Shell */}
      <mesh position={[0, 0.18, 0]} castShadow>
        <sphereGeometry args={[0.17, 16, 14]} />
        <meshToonMaterial color={shell} />
      </mesh>
      {/* Slightly bigger inner egg to fatten the base */}
      <mesh position={[0, 0.15, 0]} scale={[1, 0.92, 1]}>
        <sphereGeometry args={[0.15, 14, 12]} />
        <meshToonMaterial color={tint ? shell : '#ffffff'} />
      </mesh>
      {/* Spots (skipped in ghost tint mode) */}
      {!tint &&
        [0, 1, 2, 3].map((i) => {
          const angle = (i / 4) * Math.PI * 2 + 0.6;
          return (
            <mesh
              key={i}
              position={[
                Math.cos(angle) * 0.09,
                0.22 + Math.sin(i * 2.1) * 0.03,
                Math.sin(angle) * 0.09,
              ]}
              scale={0.6 + (i % 2) * 0.35}
            >
              <sphereGeometry args={[0.045, 8, 8]} />
              <meshToonMaterial color={sp.eggSpot} />
            </mesh>
          );
        })}
    </group>
  );
}

/**
 * One incubating egg on the island. Wobbles gently, floats a live m:ss
 * countdown above itself, and after EGG_HATCH_MS of REAL wall-clock time
 * plays a crack burst and hatches into a new pet (via the store).
 */
function PlacedEgg({ egg }) {
  const groupRef = useRef();
  const timerRef = useRef();
  const crackMeshes = useRef([]);
  const hatchTimer = useRef(null);
  const burstParticles = useRef(
    Array.from({ length: CRACK_COUNT }, () => ({
      active: false,
      life: 0,
      maxLife: 1,
      vx: 0,
      vy: 0,
      vz: 0,
      scale: 1,
    }))
  ).current;

  const sp = PET_SPECIES[egg.species] ?? PET_SPECIES.bunny;

  // Real-time countdown: uses Date.now() against the plantedAt stamp so a
  // reload mid-incubation keeps the same remaining time.
  useFrame((_, delta) => {
    const g = groupRef.current;
    if (!g) return;

    const elapsed = Date.now() - egg.plantedAt;
    const remaining = EGG_HATCH_MS - elapsed;

    // Live countdown text (updated via ref — no React re-render per frame)
    if (timerRef.current) {
      timerRef.current.textContent = remaining > 0 ? formatCountdown(remaining) : '…';
    }

    // Gentle wobble + bob while incubating
    if (!hatchTimer.current) {
      const t = elapsed / 1000;
      g.rotation.y = Math.sin(t * 1.6) * 0.18;
      g.rotation.z = Math.sin(t * 2.2) * 0.06;
      g.position.y = egg.y + Math.abs(Math.sin(t * 1.4)) * 0.04;
    }

    // Hatch when the timer hits zero — fire once.
    if (remaining <= 0 && !hatchTimer.current) {
      hatchTimer.current = 0;
      // Launch the crack burst
      burstParticles.forEach((p) => {
        p.active = true;
        p.life = 0;
        p.maxLife = 0.8 + Math.random() * 0.6;
        const ang = Math.random() * Math.PI * 2;
        const speed = 0.7 + Math.random() * 1.2;
        p.vx = Math.cos(ang) * speed;
        p.vz = Math.sin(ang) * speed;
        p.vy = 0.9 + Math.random() * 1.4;
        p.scale = 0.5 + Math.random() * 0.7;
      });
      // Little pop before the egg disappears
      g.scale.set(1.25, 1.25, 1.25);
    }

    if (hatchTimer.current !== null) {
      hatchTimer.current += delta;
      // Animate crack shards
      burstParticles.forEach((p, i) => {
        const mesh = crackMeshes.current[i];
        if (!mesh) return;
        if (!p.active) {
          mesh.visible = false;
          return;
        }
        p.life += delta;
        if (p.life >= p.maxLife) {
          p.active = false;
          mesh.visible = false;
          return;
        }
        const k = p.life / p.maxLife;
        p.vy -= 3.2 * delta; // gravity on shards
        mesh.visible = true;
        mesh.position.set(p.vx * p.life, p.vy * p.life + 0.15, p.vz * p.life);
        mesh.scale.setScalar(p.scale * (1 - k * 0.6));
        mesh.material.opacity = 1 - k;
      });
      // After the burst, actually hatch into a pet.
      if (hatchTimer.current >= HATCH_BURST_S) {
        useGameStore.getState().hatchEgg(egg.id);
      }
    }
  });

  return (
    <group ref={groupRef} position={[egg.x, egg.y, egg.z]}>
      <EggModel species={egg.species} />

      {/* Crack shards (spawned at the shell) */}
      <group position={[0, 0.15, 0]}>
        {burstParticles.map((_, i) => (
          <mesh key={i} ref={(el) => (crackMeshes.current[i] = el)} visible={false}>
            <icosahedronGeometry args={[0.05, 0]} />
            <meshBasicMaterial
              color={CRACK_COLORS[i % CRACK_COLORS.length]}
              transparent
              opacity={0}
              toneMapped={false}
            />
          </mesh>
        ))}
      </group>

      {/* Floating countdown */}
      <Html position={[0, 0.62, 0]} center style={{ pointerEvents: 'none' }} zIndexRange={[10, 0]}>
        <div
          ref={timerRef}
          style={{
            fontSize: 12,
            fontWeight: 800,
            fontFamily: '"Segoe UI", system-ui, sans-serif',
            color: '#fff',
            textShadow: '0 1px 3px rgba(0,0,0,0.4)',
            letterSpacing: 0.5,
            whiteSpace: 'nowrap',
          }}
        >
          ⏳ 10:00
        </div>
      </Html>

      {/* Faint species-colored glow ring under the egg */}
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.2, 0.3, 20]} />
        <meshBasicMaterial
          color={sp.eggColor}
          transparent
          opacity={0.35}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

/** Renders every incubating egg on the island from the store. */
export default function Eggs() {
  const placedEggs = useGameStore((s) => s.placedEggs);
  return (
    <group>
      {placedEggs.map((egg) => (
        <PlacedEgg key={egg.id} egg={egg} />
      ))}
    </group>
  );
}
