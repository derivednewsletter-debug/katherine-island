/**
 * Creature needs system.
 *
 * Subscribes to the shared game clock (gameClock.js) and drains the pet's
 * needs over game time. Because it ticks off the same clock as the day-night
 * cycle, pause and time-scale affect needs too.
 */
import { useGameStore } from './gameStore';
import { onGameTick } from './gameClock';

let started = false;

/** Start draining needs on every game tick. Idempotent (StrictMode-safe). */
export function startNeedsSystem() {
  if (started) return;
  started = true;
  onGameTick((gameDt) => {
    useGameStore.getState().drainNeeds(gameDt);
  });
}
