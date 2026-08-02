/**
 * Weather system.
 *
 * Subscribes to the shared game clock (gameClock.js) and schedules rare
 * passing rain showers in GAME time, so pause freezes the weather and the
 * 1×/2×/4× speed controls make showers sweep by faster. While it rains:
 *  - crop growth runs at 2× (the growth math reads `rainSpans` + the active
 *    rainStartAt/rainUntil — see data/crops.js growthElapsed)
 *  - the scene dims and rain audio plays (Rain.jsx / audio/rain.js)
 *
 * Closed showers are appended to `weather.rainSpans` (game-seconds) and
 * pruned once they can't affect any planted crop's growth, so the array
 * stays tiny. All scheduling state lives in the store's `weather` slice
 * (which persists), so a reload mid-shower just continues.
 */
import { useGameStore, DAY_CYCLE_SECONDS, weatherOpts } from './gameStore';
import { onGameTick } from './gameClock';
import { cropById, cropWilt } from '../data/crops';
import { setRainAudio } from '../audio/rain';

let started = false;

// Rare passing showers, tuned in game-seconds:
//  - gap between showers: ~1–2.5 day-cycles (showers are a treat)
//  - shower length: ~10–20% of a day-cycle
const GAP_MIN = DAY_CYCLE_SECONDS * 1.0;
const GAP_MAX = DAY_CYCLE_SECONDS * 2.5;
const SHOWER_MIN = DAY_CYCLE_SECONDS * 0.1;
const SHOWER_MAX = DAY_CYCLE_SECONDS * 0.2;

/**
 * Start the weather loop. Idempotent (StrictMode-safe), like the needs
 * system. Each game tick: roll showers, then check for newly-wilted jungle
 * fruit to warn about.
 */
export function startWeatherSystem() {
  if (started) return;
  started = true;
  onGameTick((gameDt) => {
    const store = useGameStore.getState();
    const w = store.weather;

    if (w.raining) {
      // Shower over — close its span, schedule the next one.
      if (store.time >= w.rainUntil) {
        const spans = [...w.rainSpans, { start: w.rainStartAt, end: w.rainUntil }];
        store.setWeather({
          raining: false,
          rainStartAt: 0,
          rainUntil: 0,
          nextRainAt: store.time + rand(GAP_MIN, GAP_MAX),
          rainSpans: pruneSpans(spans, store),
        });
        setRainAudio(false);
        store.setWeather({ wiltToastShown: false }); // new drought starts fresh
      }
    } else {
      // Roll the first shower shortly after boot so the weather layer is
      // felt, then keep to the rare gap afterwards.
      if (!w.nextRainAt) {
        store.setWeather({
          nextRainAt: store.time + rand(DAY_CYCLE_SECONDS * 0.4, DAY_CYCLE_SECONDS * 0.9),
        });
      } else if (store.time >= w.nextRainAt) {
        store.setWeather({
          raining: true,
          rainStartAt: store.time,
          rainUntil: store.time + rand(SHOWER_MIN, SHOWER_MAX),
        });
        setRainAudio(true);
      }
    }

    // Wilt warning: any planted jungle fruit currently drooping. Pass the
    // real weather (active rain + closed spans) so the toast can't fire
    // mid-shower — rain resets the drought clock.
    const s = useGameStore.getState();
    const wilting = s.crops.some(
      (c) => cropById(c.cropId)?.wiltable && cropWilt(c, s.time, weatherOpts(s)) > 0
    );
    if (wilting && !s.weather?.wiltToastShown) {
      s.setWeather({ wiltToastShown: true });
      s.showToast('🥀 The jungle fruit is wilting — it hasn\'t rained in days!');
    }
  });
}

/** Drop spans that ended before every planted crop was seeded (they can no
 *  longer affect any crop's growth math). Keeps the array at ~0 entries. */
function pruneSpans(spans, s) {
  if (s.crops.length === 0) return [];
  let oldest = Infinity;
  for (const c of s.crops) if (c.plantedAt < oldest) oldest = c.plantedAt;
  return spans.filter((sp) => sp.end > oldest);
}

function rand(min, max) {
  return min + Math.random() * (max - min);
}
