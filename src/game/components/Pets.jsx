import React from 'react';
import { useGameStore } from '../state/gameStore';
import Pet from './Pet';

/**
 * Renders every hatched pet on the island (beyond the starter creature).
 * Reads the pet roster from the store; each pet is its own Pet instance
 * that spawns where its egg hatched.
 *
 * The selector subscribes to a STABLE string of pet ids (not the pets
 * array — drainNeeds recreates that array every tick, which would re-render
 * this whole mesh tree at 60fps). Re-renders only when a pet is added/removed.
 */
export default function Pets() {
  const petIds = useGameStore((s) => s.pets.map((p) => p.id).join(','));
  const ids = petIds ? petIds.split(',') : [];
  return (
    <group>
      {ids.map((id) => (
        <Pet key={id} petId={id} />
      ))}
    </group>
  );
}
