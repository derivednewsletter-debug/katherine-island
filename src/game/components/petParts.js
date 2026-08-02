/**
 * Shared visual helpers for the pets (starter creature + hatched pets):
 * the heart geometry pool and the mood→speed table. Kept here so the
 * starter (Creature.jsx) and every hatched pet (Pet.jsx) animate alike.
 */
import * as THREE from 'three';

/** How many hearts a petting/feeding burst spawns. */
export const HEART_COUNT = 6;

/** Mood → movement speed multiplier (a tired pet shuffles, a happy one bounds). */
export const MOOD_SPEED = {
  happy: 1.25,
  content: 1,
  hungry: 0.85,
  tired: 0.6,
  sad: 0.75,
};

/** Build the shared 2D heart shape used by every pet's heart burst. */
export function makeHeartGeometry() {
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
}

/** Create a fresh heart-particle pool (same layout for every pet). */
export function makeHearts() {
  return Array.from({ length: HEART_COUNT }, () => ({
    active: false,
    life: 0,
    maxLife: 1,
    vy: 0,
    scale: 1,
    offset: new THREE.Vector3(),
  }));
}
