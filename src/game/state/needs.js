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
    const store = useGameStore.getState();
    store.drainNeeds(gameDt);

    // Well-cared-for pets (all needs comfortably full) slowly earn care
    // points toward their next evolution — petting is the fast way, but
    // steady care works too. Re-read state AFTER draining so the gate sees
    // the current (post-drain) needs, not a stale snapshot.
    // While asleep the gate is skipped: sleep already recharges energy, and
    // letting it also farm care points would make evolution a passive
    // overnight grind instead of an earned (petted) moment.
    if (store.sleeping) return;
    const { hunger, energy, happiness } = useGameStore.getState().needs;
    if (hunger > 70 && energy > 70 && happiness > 70) {
      useGameStore.getState().addCare(CARE_PER_GAME_SECOND * gameDt);
    }
  });
}

/** Care points earned per game-second while all needs stay above 70.
 *  Kept low so petting (the fun, fast path) stays the main way to evolve;
 *  steady care alone can't quite reach the threshold before needs dip. */
export const CARE_PER_GAME_SECOND = 0.04;
