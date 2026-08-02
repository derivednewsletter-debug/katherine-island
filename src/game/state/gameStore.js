/**
 * Global game store (Zustand).
 *
 * Holds the authoritative game clock (time, timeScale, paused) plus the
 * inventory. The shared game-clock loop (gameClock.js) advances `time`;
 * future systems — creature needs, crops, the day-night cycle — read and
 * tick off this same clock instead of running their own timers.
 *
 * Components may subscribe to slices via useGameStore(selector), so the
 * R3F canvas and the DOM HUD stay in sync without prop drilling.
 */
import { create } from 'zustand';

/** Seconds of game time per full day-night cycle. */
export const DAY_CYCLE_SECONDS = 180;

/**
 * Boot offset (~42% through the day cycle) so the game starts near late
 * morning — a bright first impression — instead of at midnight. Baked into
 * `time` so the HUD, the sky, and every future system agree on the phase.
 */
const START_TIME = DAY_CYCLE_SECONDS * 0.42;

export const useGameStore = create((set) => ({
  // ── Authoritative game clock ──
  time: START_TIME, // accumulated game-seconds (boots near midday)
  timeScale: 1, // 1 = real-time, 2 = double speed, 4 = fast-forward
  paused: false,
  dayCycleSeconds: DAY_CYCLE_SECONDS, // seconds per day-night cycle

  // ── Economy ──
  inventory: {
    berry: 0,
    shell: 0,
    stone: 0,
  },

  // ── Actions ──
  /** Advance the clock by `gameDt` game-seconds (called by gameClock loop). */
  advanceTime: (gameDt) => set((s) => ({ time: s.time + gameDt })),

  setTimeScale: (scale) => set({ timeScale: scale }),

  togglePause: () => set((s) => ({ paused: !s.paused })),

  /** Credit `amount` of a resource (default 1). No-op for unknown ids. */
  addResource: (resource, amount = 1) =>
    set((s) => {
      if (!(resource in s.inventory)) return s;
      return { inventory: { ...s.inventory, [resource]: s.inventory[resource] + amount } };
    }),
}));

/**
 * Derive human-friendly day / phase from game-seconds.
 * phase 0..1 across one day; 0.2–0.75 roughly counts as daylight.
 */
export function timeOfDay(time, dayCycleSeconds = DAY_CYCLE_SECONDS) {
  const day = Math.floor(time / dayCycleSeconds) + 1;
  const phase = (time % dayCycleSeconds) / dayCycleSeconds;
  return { day, phase, isDay: phase >= 0.2 && phase < 0.75 };
}
