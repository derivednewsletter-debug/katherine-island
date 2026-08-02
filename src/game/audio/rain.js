/**
 * Procedural rain ambience — no audio files.
 *
 * Two layers, both synthesized at runtime and routed through the shared
 * game-wide master gain (sfx.js) so the sound toggle mutes them together:
 *  - a looping filtered-noise hiss (the steady "patter" of a shower)
 *  - occasional distant thunder — a low decaying rumble with a soft
 *    sub-bass thump, spaced several seconds apart while it rains
 *
 * The weather system (state/weather.js) calls setRainAudio(true/false) when
 * a shower starts/ends. Like the ocean, it's a no-op until the user has
 * enabled sound (the master toggle in App.jsx provides the gesture).
 */
import { getAudioContext, getMasterGain, resumeAudio, isSoundEnabled } from './sfx';

let source = null;
let filter = null;
let gain = null;
let thunderTimer = null;
let playing = false;

/** 4 seconds of white noise for the patter hiss. */
function makeHissBuffer(ac) {
  const seconds = 4;
  const buffer = ac.createBuffer(1, ac.sampleRate * seconds, ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

/** One distant thunderclap: sub-bass thump + noise crackle, slow decay. */
function playThunder() {
  const ac = getAudioContext();
  if (!ac || !playing) return;
  const t = ac.currentTime;

  // Sub-bass thump (the "boom")
  const osc = ac.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(72, t);
  osc.frequency.exponentialRampToValueAtTime(34, t + 1.6);
  const og = ac.createGain();
  og.gain.setValueAtTime(0.0001, t);
  og.gain.linearRampToValueAtTime(0.16, t + 0.09);
  og.gain.exponentialRampToValueAtTime(0.0001, t + 2.6);
  osc.connect(og);
  og.connect(getMasterGain() ?? ac.destination);
  osc.start(t);
  osc.stop(t + 2.7);

  // Noise crackle riding on top (the "rumble detail")
  const ns = ac.createBufferSource();
  ns.buffer = makeHissBuffer(ac);
  ns.loop = true;
  const nf = ac.createBiquadFilter();
  nf.type = 'lowpass';
  nf.frequency.value = 220;
  const ng = ac.createGain();
  ng.gain.setValueAtTime(0.0001, t);
  ng.gain.linearRampToValueAtTime(0.05, t + 0.12);
  ng.gain.exponentialRampToValueAtTime(0.0001, t + 2.2);
  ns.connect(nf);
  nf.connect(ng);
  ng.connect(getMasterGain() ?? ac.destination);
  ns.start(t);
  ns.stop(t + 2.4);

  // Space the next rumble 6–16s out
  thunderTimer = setTimeout(playThunder, 6000 + Math.random() * 10000);
}

/** Fade in the hiss loop and start scheduling thunder. */
export function setRainAudio(on) {
  if (on) startRainAudio();
  else stopRainAudio();
}

/** Start the rain layer (idempotent; requires sound to be enabled). */
export function startRainAudio() {
  if (playing) return;
  if (!isSoundEnabled()) return; // no user gesture yet — stay silent
  const ac = getAudioContext();
  if (!ac) return;
  resumeAudio();

  source = ac.createBufferSource();
  source.buffer = makeHissBuffer(ac);
  source.loop = true;

  // Band-pass the noise into a soft "patter" (high hiss, not beach surf)
  filter = ac.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 3200;
  filter.Q.value = 0.5;

  gain = ac.createGain();
  gain.gain.value = 0;

  source.connect(filter);
  filter.connect(gain);
  gain.connect(getMasterGain() ?? ac.destination);

  source.start();
  const now = ac.currentTime;
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.05, now + 1.2);
  playing = true;

  // First rumble after a short beat, then self-reschedules
  thunderTimer = setTimeout(playThunder, 2500 + Math.random() * 3000);
}

/** Fade out and tear down the rain layer. */
export function stopRainAudio() {
  if (!playing || !gain) return;
  if (thunderTimer) {
    clearTimeout(thunderTimer);
    thunderTimer = null;
  }
  const ac = getAudioContext();
  if (ac) {
    const now = ac.currentTime;
    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(gain.gain.value, now);
    gain.gain.linearRampToValueAtTime(0, now + 0.8);
  }
  const toStop = source;
  const toDisconnect = gain;
  setTimeout(() => {
    try {
      toStop.stop();
    } catch {
      /* already stopped */
    }
    try {
      toDisconnect.disconnect();
    } catch {
      /* already disconnected */
    }
  }, 1000);
  playing = false;
}

/** Is the rain layer currently running? */
export function isRainPlaying() {
  return playing;
}
