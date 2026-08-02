/**
 * Shared game-clock loop.
 *
 * A single requestAnimationFrame loop (started once from App) that advances
 * the authoritative `time` in the Zustand store — honoring pause and
 * timeScale — and notifies any system that subscribed via onGameTick().
 *
 * Future systems (creature needs, crop growth, day-night) subscribe here
 * instead of running their own timers, so the whole game shares one clock.
 */
import { useGameStore } from './gameStore';

const listeners = new Set();
let rafId = null;
let lastTimestamp = null;

/** Clamp big frame gaps (e.g. after a backgrounded tab) so the clock can't jump. */
const MAX_DT = 0.25;

/**
 * Subscribe to every game tick. The listener receives
 * `(gameDt, totalGameTime)` where gameDt already accounts for pause/timeScale.
 * Returns an unsubscribe function.
 */
export function onGameTick(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function frame(now) {
  rafId = requestAnimationFrame(frame);

  const state = useGameStore.getState();
  if (state.paused) {
    lastTimestamp = now; // don't accumulate wall time while paused
    return;
  }

  const rawDt = lastTimestamp === null ? 0 : (now - lastTimestamp) / 1000;
  lastTimestamp = now;

  const gameDt = Math.min(rawDt, MAX_DT) * state.timeScale;
  if (gameDt <= 0) return;

  state.advanceTime(gameDt);
  const totalTime = useGameStore.getState().time;

  listeners.forEach((listener) => listener(gameDt, totalTime));
}

/** Start the clock loop. Idempotent — safe to call from StrictMode/remounts. */
export function startGameClock() {
  if (rafId !== null) return;
  lastTimestamp = null;
  rafId = requestAnimationFrame(frame);
}
