/**
 * Pet state machine — derives sickness and runaway from a pet's needs.
 *
 * Sickness comes from hunger OR hygiene bottoming out; while sick a pet
 * drains needs faster and can't earn care points. Runaway comes from
 * sustained low happiness: after a grace window of game-time the pet runs
 * away (recoverable via a find-my-pet quest).
 */
export const SICK_HUNGER = 25;
export const SICK_HYGIENE = 25;
export const RUN_AWAY_HAPPINESS = 15;
export const RUN_AWAY_GRACE_SECONDS = 900;
export const SICK_DRAIN_MULT = 1.6;

export function isSick(needs) {
  const h = needs?.hunger ?? 100;
  const g = needs?.hygiene ?? 100;
  return h < SICK_HUNGER || g < SICK_HYGIENE;
}

export function moodFromState(sick, runaway, isNight = false) {
  if (runaway) return 'fleeing';
  if (sick) return 'sick';
  return null;
}

export function trackRunaway(pet, time) {
  const happiness = pet.needs?.happiness ?? 100;
  const low = happiness < RUN_AWAY_HAPPINESS;
  if (low && pet.lowHappySince == null) return { ...pet, lowHappySince: time };
  if (low && time - pet.lowHappySince >= RUN_AWAY_GRACE_SECONDS && !pet.ranAway) {
    return { ...pet, lowHappySince: pet.lowHappySince, ranAway: true };
  }
  if (!low && pet.lowHappySince != null) return { ...pet, lowHappySince: null };
  return pet;
}
