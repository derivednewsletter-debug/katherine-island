/**
 * Procedural sound design — no audio files.
 *
 * One shared AudioContext + master gain for the whole game (the ocean
 * ambience in ocean.js routes through the same master). Everything here is
 * synthesized at runtime:
 *
 *  - playGatherPop()      — a soft pluck when a tile is harvested
 *  - playPickupChime()    — a little bell when a pickup lands in the HUD
 *  - playEvolutionFanfare() — a rising sparkle arpeggio on evolution
 *  - startMusic()/stopMusic() — a gentle chord bed that shifts between a
 *    warm daytime progression and a lower, darker nighttime one by reading
 *    the shared game clock (timeOfDay) on every chord.
 *
 * Browsers block audio until a user gesture, so call setSoundEnabled(true)
 * from a click handler (the sound toggle in App.jsx does this). Every play
 * function is a safe no-op when audio is disabled or unavailable.
 */
import { useGameStore, timeOfDay } from '../state/gameStore';

let ctx = null;
let master = null;
let enabled = false;

/** Create (once) and return the shared AudioContext, or null if unsupported. */
export function getAudioContext() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  return ctx;
}

/** The shared master gain every sound routes through (muted by the toggle). */
export function getMasterGain() {
  const ac = getAudioContext();
  if (!ac) return null;
  if (!master) {
    master = ac.createGain();
    master.gain.value = enabled ? 0.9 : 0;
    master.connect(ac.destination);
  }
  return master;
}

/** Is sound currently enabled (the user has turned it on at least once)? */
export function isSoundEnabled() {
  return enabled;
}

/**
 * Master sound switch (call from a click handler so the browser allows it).
 * Ramps the shared master gain and keeps the context resumed while on.
 */
export function setSoundEnabled(on) {
  enabled = on;
  const ac = getAudioContext();
  if (!ac) return;
  const m = getMasterGain();
  if (ac.state === 'suspended' && on) {
    try {
      ac.resume();
    } catch {
      /* ignore */
    }
  }
  if (!m) return;
  const now = ac.currentTime;
  m.gain.cancelScheduledValues(now);
  m.gain.setValueAtTime(m.gain.value, now);
  m.gain.linearRampToValueAtTime(on ? 0.9 : 0, now + 0.25);
}

/** Resume the shared context if suspended (safe call from user gestures). */
export function resumeAudio() {
  const ac = getAudioContext();
  if (ac && ac.state === 'suspended') {
    try {
      ac.resume();
    } catch {
      /* ignore */
    }
  }
}

/** A short buffer of white noise, cached per length. */
const noiseCache = new Map();
function noiseBuffer(ac, seconds) {
  const key = seconds;
  let buffer = noiseCache.get(key);
  if (buffer) return buffer;
  buffer = ac.createBuffer(1, Math.max(1, Math.floor(ac.sampleRate * seconds)), ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  noiseCache.set(key, buffer);
  return buffer;
}

/** If audio is off or unavailable, return null (callers bail silently). */
function ready() {
  if (!enabled) return null;
  const ac = getAudioContext();
  if (!ac || ac.state !== 'running') return null;
  if (!getMasterGain()) return null;
  return ac;
}

/* ── Gathering pop ───────────────────────────────────────────────────────
   A short band-passed noise burst (the "pluck") with a quick rising sine
   blip underneath — reads as a satisfying little harvest pop. */
export function playGatherPop() {
  const ac = ready();
  if (!ac) return;
  const t = ac.currentTime;

  const src = ac.createBufferSource();
  src.buffer = noiseBuffer(ac, 0.14);
  const bp = ac.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 1100 + Math.random() * 500;
  bp.Q.value = 1.4;
  const ng = ac.createGain();
  ng.gain.setValueAtTime(0.3, t);
  ng.gain.exponentialRampToValueAtTime(0.001, t + 0.13);
  src.connect(bp);
  bp.connect(ng);
  ng.connect(master);
  src.start(t);
  src.stop(t + 0.15);

  const osc = ac.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(360, t);
  osc.frequency.exponentialRampToValueAtTime(540, t + 0.09);
  const og = ac.createGain();
  og.gain.setValueAtTime(0.1, t);
  og.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
  osc.connect(og);
  og.connect(master);
  osc.start(t);
  osc.stop(t + 0.11);
}

/* ── Pickup chime ────────────────────────────────────────────────────────
   A two-note bell (E6 → A6) with a soft exponential decay — the "cha-ching"
   of a collectible landing on the counter. */
export function playPickupChime() {
  const ac = ready();
  if (!ac) return;
  const t = ac.currentTime;
  const notes = [
    { freq: 1318.5, at: 0, vol: 0.14 },
    { freq: 1760, at: 0.09, vol: 0.11 },
  ];
  notes.forEach(({ freq, at, vol }) => {
    const osc = ac.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const g = ac.createGain();
    g.gain.setValueAtTime(0, t + at);
    g.gain.linearRampToValueAtTime(vol, t + at + 0.012);
    g.gain.exponentialRampToValueAtTime(0.001, t + at + 0.5);
    osc.connect(g);
    g.connect(master);
    osc.start(t + at);
    osc.stop(t + at + 0.55);
    // A faint octave shimmer on the first note
    if (at === 0) {
      const sh = ac.createOscillator();
      sh.type = 'sine';
      sh.frequency.value = freq * 2;
      const sg = ac.createGain();
      sg.gain.setValueAtTime(0, t);
      sg.gain.linearRampToValueAtTime(0.035, t + 0.012);
      sg.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
      sh.connect(sg);
      sg.connect(master);
      sh.start(t);
      sh.stop(t + 0.4);
    }
  });
}

/* ── Quest claim jingle ──────────────────────────────────────────────────
   A quick, friendly two-note "task done" (E5 → B5) for collecting a quest
   reward — satisfying but small enough not to steal the scene. */
export function playQuestClaim() {
  const ac = ready();
  if (!ac) return;
  const t = ac.currentTime;
  const notes = [
    { freq: 659.25, at: 0, vol: 0.13 },
    { freq: 987.77, at: 0.1, vol: 0.11 },
  ];
  notes.forEach(({ freq, at, vol }) => {
    const osc = ac.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    const g = ac.createGain();
    g.gain.setValueAtTime(0, t + at);
    g.gain.linearRampToValueAtTime(vol, t + at + 0.015);
    g.gain.exponentialRampToValueAtTime(0.001, t + at + 0.35);
    osc.connect(g);
    g.connect(master);
    osc.start(t + at);
    osc.stop(t + at + 0.4);
  });
}

/* ── Evolution fanfare ───────────────────────────────────────────────────
   A bright rising arpeggio (C5-E5-G5-C6) with a high sparkle on top — the
   celebratory payoff for growing up. */
export function playEvolutionFanfare() {
  const ac = ready();
  if (!ac) return;
  const t = ac.currentTime;
  const steps = [523.25, 659.25, 783.99, 1046.5];
  steps.forEach((freq, i) => {
    const at = t + i * 0.09;
    const osc = ac.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    const g = ac.createGain();
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(0.16, at + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, at + 0.5);
    osc.connect(g);
    g.connect(master);
    osc.start(at);
    osc.stop(at + 0.55);
  });
  // Sparkle on the last note
  const sp = ac.createOscillator();
  sp.type = 'sine';
  sp.frequency.value = 2093;
  const spg = ac.createGain();
  spg.gain.setValueAtTime(0, t + 0.27);
  spg.gain.linearRampToValueAtTime(0.05, t + 0.3);
  spg.gain.exponentialRampToValueAtTime(0.001, t + 1.1);
  sp.connect(spg);
  spg.connect(master);
  sp.start(t + 0.27);
  sp.stop(t + 1.15);
}

/* ── Footstep ───────────────────────────────────────────────────────────────
   A tiny muted "thud" for the player walking on grass/tiles. */
export function playStep() {
  const ac = ready();
  if (!ac) return;
  const t = ac.currentTime;
  const osc = ac.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(180, t);
  osc.frequency.exponentialRampToValueAtTime(60, t + 0.04);
  const g = ac.createGain();
  g.gain.setValueAtTime(0.05, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
  osc.connect(g);
  g.connect(master);
  osc.start(t);
  osc.stop(t + 0.07);
}

/* ── Music bed ─────────────────────────────────────────────────────────────
    A gentle, self-scheduling chord loop. Every CHORD_SECONDS it reads the
   game clock's day/night phase and plays the next chord of the matching
   progression as soft sine pads through a slowly-moving lowpass filter.
   A sparse pentatonic bell occasionally floats over the top.
   Stops gracefully on stopMusic() (fades the music bus). */
const CHORD_SECONDS = 4.2;

// Chord roots as C-major scale degrees; every degree's triad offsets.
// 0:C 1:Dm 2:Em 3:F 4:G 5:Am
const TRIADS = {
  0: [0, 4, 7], // C major
  1: [0, 3, 7], // D minor
  2: [0, 3, 7], // E minor
  3: [0, 4, 7], // F major
  4: [0, 4, 7], // G major
  5: [0, 3, 7], // A minor
};
// Warm daylight: C → F → Am → G
const DAY_PROGRESSION = [0, 3, 5, 4];
// Softer darkness: Am → F → C → G, played lower
const NIGHT_PROGRESSION = [5, 3, 0, 4];
const SCALE_POS = [0, 2, 4, 5, 7, 9, 11]; // C major scale semitone offsets

const midiToFreq = (m) => 440 * Math.pow(2, (m - 69) / 12);

let musicTimer = null;
let musicBus = null;
let musicFilter = null;
let musicStep = 0;
let musicPlaying = false;

function scheduleChord() {
  const ac = getAudioContext();
  if (!ac || !musicBus || !musicFilter) return;
  const t = ac.currentTime;

  // Read the shared clock's phase so the bed shifts with the sky.
  const s = useGameStore.getState();
  const { isDay } = timeOfDay(s.time, s.dayCycleSeconds);
  const progression = isDay ? DAY_PROGRESSION : NIGHT_PROGRESSION;
  const degree = progression[musicStep % progression.length];
  const intervals = TRIADS[degree];
  const rootMidi = isDay ? 60 : 55; // C4 by day, G3 by night (lower/darker)

  // Slide the lowpass toward the day/night brightness target.
  musicFilter.frequency.setTargetAtTime(isDay ? 1500 : 720, t, 0.9);

  const chordTime = t + 0.15;
  const vol = isDay ? 0.05 : 0.04; // pads sit well under everything
  intervals.forEach((offset) => {
    const freq = midiToFreq(rootMidi + SCALE_POS[degree] + offset);
    [1, 2].forEach((octave) => {
      // Octave root (sub) at half volume for warmth
      const osc = ac.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = octave === 1 ? freq / 2 : freq;
      const g = ac.createGain();
      const v = octave === 1 ? vol * 0.8 : vol;
      g.gain.setValueAtTime(0, chordTime);
      g.gain.linearRampToValueAtTime(v, chordTime + 1.4); // slow bloom
      g.gain.setValueAtTime(v, chordTime + CHORD_SECONDS - 1.2);
      g.gain.linearRampToValueAtTime(0, chordTime + CHORD_SECONDS + 0.4);
      osc.connect(g);
      g.connect(musicFilter);
      osc.start(chordTime);
      osc.stop(chordTime + CHORD_SECONDS + 0.6);
    });
  });

  // Sparse pentatonic bell over the top (day a bit brighter/frequent)
  const bellChance = isDay ? 0.34 : 0.2;
  if (Math.random() < bellChance) {
    const penta = [0, 2, 4, 7, 9];
    const note = penta[Math.floor(Math.random() * penta.length)];
    const bellFreq = midiToFreq((isDay ? 72 : 67) + note); // C5 / G4 registers
    const bosc = ac.createOscillator();
    bosc.type = 'triangle';
    bosc.frequency.value = bellFreq;
    const bg = ac.createGain();
    bg.gain.setValueAtTime(0, chordTime + 0.5);
    bg.gain.linearRampToValueAtTime(isDay ? 0.045 : 0.03, chordTime + 0.53);
    bg.gain.exponentialRampToValueAtTime(0.001, chordTime + 2.4);
    bosc.connect(bg);
    bg.connect(musicBus);
    bosc.start(chordTime + 0.5);
    bosc.stop(chordTime + 2.5);
  }

  musicStep++;
  musicTimer = setTimeout(scheduleChord, CHORD_SECONDS * 1000);
}

/** Start the music bed (idempotent). Requires a user gesture to be audible.
 *  Always builds FRESH nodes: a previously-stopped bus may still be in its
 *  fade-out/teardown window, and reusing it would play into a dead chain. */
export function startMusic() {
  if (musicPlaying) return;
  const ac = getAudioContext();
  if (!ac) return;
  musicBus = ac.createGain();
  musicBus.gain.value = 0.55; // bus level; pads' own gains keep it soft
  musicFilter = ac.createBiquadFilter();
  musicFilter.type = 'lowpass';
  musicFilter.frequency.value = 1000;
  musicBus.connect(musicFilter);
  musicFilter.connect(getMasterGain() ?? ac.destination);
  musicPlaying = true;
  musicStep = 0;
  musicTimer = setTimeout(scheduleChord, 600); // short intro gap
}

/** Stop the music bed (fades the bus, cancels the pending chord). */
export function stopMusic() {
  if (!musicPlaying) return;
  musicPlaying = false;
  if (musicTimer) {
    clearTimeout(musicTimer);
    musicTimer = null;
  }
  const ac = getAudioContext();
  if (ac && musicBus) {
    const now = ac.currentTime;
    musicBus.gain.cancelScheduledValues(now);
    musicBus.gain.setValueAtTime(musicBus.gain.value, now);
    musicBus.gain.linearRampToValueAtTime(0, now + 0.8);
    // Capture the SPECIFIC bus being torn down. If the player toggles sound
    // back on before this fires, startMusic() builds a fresh bus — so only
    // disconnect the old one, and never null the new module-level bus.
    const toDisconnect = musicBus;
    setTimeout(() => {
      try {
        toDisconnect.disconnect();
      } catch {
        /* already disconnected */
      }
      if (musicBus === toDisconnect) {
        musicBus = null;
        musicFilter = null;
      }
    }, 900);
  }
}

/** Is the music bed currently running? */
export function isMusicPlaying() {
  return musicPlaying;
}
