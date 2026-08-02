/**
 * Procedural ocean ambience — no audio files needed.
 *
 * Builds a soft "wave" loop from filtered noise:
 *  - pink-ish noise through a lowpass filter gives the constant surf hiss
 *  - a slow LFO modulating the master gain creates gentle swells/ebbs
 *
 * Browsers block audio until a user gesture, so call startOcean() from a
 * click handler (the HUD button in App.jsx does this).
 */

let ctx = null;
let noiseSource = null;
let filter = null;
let masterGain = null;
let lfoOsc = null;
let lfoGain = null;
let playing = false;

/** Generate 4 seconds of smooth, ocean-like noise (filtered random walk). */
function createNoiseBuffer(ac) {
  const seconds = 4;
  const buffer = ac.createBuffer(1, ac.sampleRate * seconds, ac.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < data.length; i++) {
    const white = Math.random() * 2 - 1;
    last = (last + 0.02 * white) / 1.02; // pinkish
    data[i] = last * 3.5;
  }
  return buffer;
}

/** Create (or resume) the AudioContext and start the wave loop. */
export function startOcean() {
  if (playing) return;

  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume();

  // ── Graph: noise → lowpass → master → destination ──
  noiseSource = ctx.createBufferSource();
  noiseSource.buffer = createNoiseBuffer(ctx);
  noiseSource.loop = true;

  filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 420; // muffle the noise into surf hiss
  filter.Q.value = 0.6;

  masterGain = ctx.createGain();
  masterGain.gain.value = 0;

  noiseSource.connect(filter);
  filter.connect(masterGain);
  masterGain.connect(ctx.destination);

  // Slow LFO sculpts gentle waves on top of the hiss
  lfoOsc = ctx.createOscillator();
  lfoOsc.frequency.value = 0.09; // ~11s per wave cycle
  lfoGain = ctx.createGain();
  lfoGain.gain.value = 0.06; // swell depth

  lfoOsc.connect(lfoGain);
  lfoGain.connect(masterGain.gain);

  noiseSource.start();
  lfoOsc.start();

  // Fade in to avoid a click
  masterGain.gain.setValueAtTime(0, ctx.currentTime);
  masterGain.gain.linearRampToValueAtTime(0.18, ctx.currentTime + 2);
  playing = true;
}

/** Fade out and stop the wave loop. */
export function stopOcean() {
  if (!playing || !ctx || !masterGain) return;

  const now = ctx.currentTime;
  masterGain.gain.cancelScheduledValues(now);
  masterGain.gain.setValueAtTime(masterGain.gain.value, now);
  masterGain.gain.linearRampToValueAtTime(0, now + 1.2);

  const toStop = noiseSource;
  const toStopLfo = lfoOsc;
  const toDisconnect = masterGain;
  setTimeout(() => {
    try {
      toStop.stop();
      toStopLfo.stop();
    } catch {
      /* already stopped */
    }
    try {
      toDisconnect.disconnect();
    } catch {
      /* already disconnected */
    }
  }, 1400);

  playing = false;
}

/** Is the ocean currently playing? */
export function isOceanPlaying() {
  return playing;
}
