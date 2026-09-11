/**
 * The app's sound effects, synthesised rather than shipped.
 *
 * Everything here is a few oscillators and an envelope, so there are no files
 * to download, nothing to cache, and no silence on a cold start. The palette is
 * deliberately small and related — the same bright triangle tone throughout,
 * with length and interval doing the work — so that finishing a quest and
 * levelling up sound like the same app rather than two different ones.
 *
 * The old code built a new AudioContext for every completion and never closed
 * one. Each holds an audio thread and a hardware handle for the life of the
 * page, so a long session accumulated hundreds of them — Chromium tolerated 400
 * in a row when measured, but Safari's limit is small and documented, and
 * leaking them is not something to rely on a browser being generous about.
 * One shared context, created on the first sound and reused, also gives the
 * mute switch a single thing to turn off.
 */

const MUTE_KEY = 'dailyQuestsMuted';

let ctx = null;
let muted = null;

export function isMuted() {
  if (muted === null) {
    try {
      muted = localStorage.getItem(MUTE_KEY) === '1';
    } catch {
      muted = false; // storage disabled — sound on is the friendlier default
    }
  }
  return muted;
}

export function setMuted(next) {
  muted = Boolean(next);
  try {
    localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
  } catch {
    // Not remembering the preference is not worth failing over.
  }
}

/**
 * The shared context, or null if audio is unavailable.
 *
 * A context created before the user has interacted with the page starts
 * suspended, and on iOS stays that way until a gesture resumes it. Every sound
 * here is triggered by a tap, so resuming on each call is enough and costs
 * nothing when it is already running.
 */
function audio() {
  try {
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    if (!ctx) ctx = new Ctor();
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  } catch {
    return null;
  }
}

/**
 * One note. `at` and `duration` are seconds, `gain` is the peak before the
 * decay. The ramp never reaches zero because exponentialRampToValueAtTime
 * cannot take it, and stopping on an audible value is what clicks.
 */
function note(context, { freq, at, duration, gain = 0.22, type = 'triangle' }) {
  const osc = context.createOscillator();
  const amp = context.createGain();
  const start = context.currentTime + at;

  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);

  amp.gain.setValueAtTime(0.0001, start);
  amp.gain.exponentialRampToValueAtTime(gain, start + 0.015);
  amp.gain.exponentialRampToValueAtTime(0.0001, start + duration);

  osc.connect(amp);
  amp.connect(context.destination);
  osc.start(start);
  osc.stop(start + duration + 0.02);
}

// Equal temperament, A4 = 440. Named so the patterns below read as music.
const C5 = 523.25;
const D5 = 587.33;
const E5 = 659.25;
const G5 = 783.99;
const A5 = 880.0;
const B5 = 987.77;
const C6 = 1046.5;
const E6 = 1318.51;
const G6 = 1567.98;

/**
 * Each effect is a list of notes. Longer and higher means rarer and bigger:
 * a completion is two quick notes, a category level is a short rise, and the
 * overall level-up is the only one that goes to the octave above and lingers.
 */
const EFFECTS = {
  /** Ticking a quest off. Heard many times a day, so it stays short and quiet. */
  complete: [
    { freq: C5, at: 0, duration: 0.1, gain: 0.18 },
    { freq: G5, at: 0.07, duration: 0.14, gain: 0.16 },
  ],

  /** Unticking one. The same two notes falling instead of rising. */
  uncomplete: [
    { freq: G5, at: 0, duration: 0.09, gain: 0.12 },
    { freq: C5, at: 0.06, duration: 0.12, gain: 0.1 },
  ],

  /** A category reaching a milestone level. */
  categoryLevelUp: [
    { freq: C5, at: 0, duration: 0.13, gain: 0.2 },
    { freq: E5, at: 0.09, duration: 0.13, gain: 0.2 },
    { freq: G5, at: 0.18, duration: 0.26, gain: 0.22 },
  ],

  /**
   * A new overall level — ten times in the life of an account. A full arpeggio
   * to the octave, with the top note doubled a fifth up to make it ring.
   */
  levelUp: [
    { freq: C5, at: 0, duration: 0.15, gain: 0.2 },
    { freq: E5, at: 0.1, duration: 0.15, gain: 0.2 },
    { freq: G5, at: 0.2, duration: 0.15, gain: 0.21 },
    { freq: C6, at: 0.3, duration: 0.5, gain: 0.24 },
    { freq: E6, at: 0.34, duration: 0.46, gain: 0.12 },
    { freq: G6, at: 0.42, duration: 0.42, gain: 0.08 },
  ],

  /** A streak milestone. Warmer and rounder than the level-up, and shorter. */
  streak: [
    { freq: A5, at: 0, duration: 0.14, gain: 0.18, type: 'sine' },
    { freq: B5, at: 0.1, duration: 0.14, gain: 0.18, type: 'sine' },
    { freq: C6, at: 0.2, duration: 0.34, gain: 0.2, type: 'sine' },
  ],

  /** Something went wrong. Two low notes, no sweetness. */
  error: [
    { freq: D5, at: 0, duration: 0.11, gain: 0.14, type: 'sawtooth' },
    { freq: C5 * 0.75, at: 0.09, duration: 0.18, gain: 0.12, type: 'sawtooth' },
  ],
};

/**
 * Play one of the effects above. Never throws and never awaits: a missing or
 * blocked audio device must not take a celebration down with it.
 */
export function playSfx(name) {
  if (isMuted()) return;
  const effect = EFFECTS[name];
  if (!effect) return;

  const context = audio();
  if (!context) return;

  try {
    for (const spec of effect) note(context, spec);
  } catch {
    // An exhausted or closed context is not worth surfacing to the user.
  }
}

/** Vibration to match, where the device has it. Silent when muted, like sound. */
export function buzz(pattern = 40) {
  if (isMuted()) return;
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // Not supported, or blocked by the page not being visible.
  }
}
