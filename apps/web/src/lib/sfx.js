/**
 * The app's sound effects, synthesised rather than shipped.
 *
 * Everything here is oscillators, a little noise and a filter, so there are no
 * files to download, nothing to cache, and no silence on a cold start.
 *
 * The first version was a bare triangle wave per note, straight to the
 * speakers at a fifth of full scale. On a laptop that read as "simple"; on a
 * phone, which is where this is used, it read as a thin, quiet beep, and six
 * effects covered five events — logging a meal, spending a freeze and hearing
 * back from the coach made no sound at all. Three things change that:
 *
 *   - Every sound goes through one bus: a compressor, so the whole set is
 *     louder and evenly loud without a six-note chord clipping, and a short
 *     filtered echo that gives it a room to sit in instead of a void.
 *   - Each note is a voice rather than a wave: a filtered body, a quieter
 *     partial an octave up that decays faster (which is what makes a tone read
 *     as struck rather than hummed), and for the tactile ones a few
 *     milliseconds of noise as the attack.
 *   - Completions climb. Ticking several quests off in a row walks up a
 *     pentatonic scale, so a run of them sounds like a run — the single most
 *     noticeable thing a habit app's sound can do.
 *
 * The palette stays related on purpose — the same voice throughout, with
 * interval and length doing the work — so that finishing a quest and levelling
 * up sound like the same app.
 *
 * One shared context, created on the first sound and reused: the old code
 * built a new AudioContext for every completion and never closed one, and each
 * holds an audio thread and a hardware handle for the life of the page.
 */

const MUTE_KEY = 'dailyQuestsMuted';

let ctx = null;
let bus = null;
let noise = null;
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
  // Two switches show this value — the menu and the profile — and either can
  // be on screen while the other changes it.
  try {
    window.dispatchEvent(new Event('dailyq-sound-changed'));
  } catch {
    // No window (a test, a worker): nothing to keep in step.
  }
}

/**
 * The shared context, or null if audio is unavailable.
 *
 * A context created before the user has interacted with the page starts
 * suspended, and on iOS stays that way until a gesture resumes it. Every sound
 * here is triggered by a tap, so resuming on each call is enough.
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
 * The bus every voice plays into: dry and a short room, both into a
 * compressor. Built once per context and cached against it, so an offline
 * render gets its own and the live one is not rebuilt per sound.
 */
function busFor(context, destination) {
  if (bus && bus.context === context && bus.destination === destination) return bus.input;

  const input = context.createGain();
  input.gain.value = 1;

  const compressor = context.createDynamicsCompressor();
  compressor.threshold.value = -20;
  compressor.knee.value = 12;
  compressor.ratio.value = 4;
  compressor.attack.value = 0.003;
  compressor.release.value = 0.18;

  // Makeup gain after the compressor, which is where the loudness comes from.
  const makeup = context.createGain();
  makeup.gain.value = 1.6;

  // The room: a short echo, darkened so it adds body rather than a slapback.
  const delay = context.createDelay(0.5);
  delay.delayTime.value = 0.085;
  const feedback = context.createGain();
  feedback.gain.value = 0.28;
  const damp = context.createBiquadFilter();
  damp.type = 'lowpass';
  damp.frequency.value = 2400;
  const wet = context.createGain();
  wet.gain.value = 0.22;

  input.connect(compressor);
  input.connect(delay);
  delay.connect(damp);
  damp.connect(feedback);
  feedback.connect(delay);
  damp.connect(wet);
  wet.connect(compressor);
  compressor.connect(makeup);
  makeup.connect(destination);

  bus = { context, destination, input };
  return input;
}

/** A second of white noise, made once and reused for every attack. */
function noiseBuffer(context) {
  if (noise && noise.context === context) return noise.buffer;
  const buffer = context.createBuffer(1, context.sampleRate, context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  noise = { context, buffer };
  return buffer;
}

/**
 * One struck note.
 *
 * `at` and `duration` are seconds from `t0`; `gain` is the peak. The ramps
 * never reach zero because exponentialRampToValueAtTime cannot, and stopping
 * on an audible value is what clicks.
 */
function voice(context, out, t0, {
  freq,
  at = 0,
  duration = 0.2,
  gain = 0.2,
  type = 'triangle',
  bright = 1,
  partial = 0.35,
  click = 0,
}) {
  const start = t0 + at;
  const end = start + duration;

  // The body, through a filter that closes as the note decays — bright at the
  // strike, warm as it fades, like most real struck things.
  const osc = context.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);

  const filter = context.createBiquadFilter();
  filter.type = 'lowpass';
  filter.Q.value = 0.7;
  filter.frequency.setValueAtTime(Math.min(freq * 8 * bright, 16000), start);
  filter.frequency.exponentialRampToValueAtTime(Math.max(freq * 1.5, 400), end);

  const amp = context.createGain();
  amp.gain.setValueAtTime(0.0001, start);
  amp.gain.exponentialRampToValueAtTime(gain, start + 0.008);
  amp.gain.exponentialRampToValueAtTime(0.0001, end);

  osc.connect(filter);
  filter.connect(amp);
  amp.connect(out);
  osc.start(start);
  osc.stop(end + 0.03);

  // The partial: an octave up, quieter, gone in a third of the time.
  if (partial > 0) {
    const shimmer = context.createOscillator();
    shimmer.type = 'sine';
    shimmer.frequency.setValueAtTime(freq * 2, start);
    const shimmerAmp = context.createGain();
    const shimmerEnd = start + duration * 0.35;
    shimmerAmp.gain.setValueAtTime(0.0001, start);
    shimmerAmp.gain.exponentialRampToValueAtTime(gain * partial, start + 0.005);
    shimmerAmp.gain.exponentialRampToValueAtTime(0.0001, shimmerEnd);
    shimmer.connect(shimmerAmp);
    shimmerAmp.connect(out);
    shimmer.start(start);
    shimmer.stop(shimmerEnd + 0.03);
  }

  // A few milliseconds of filtered noise: the tap you feel as much as hear.
  if (click > 0) {
    const src = context.createBufferSource();
    src.buffer = noiseBuffer(context);
    const band = context.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = Math.min(freq * 3, 9000);
    band.Q.value = 1.2;
    const clickAmp = context.createGain();
    clickAmp.gain.setValueAtTime(click, start);
    clickAmp.gain.exponentialRampToValueAtTime(0.0001, start + 0.012);
    src.connect(band);
    band.connect(clickAmp);
    clickAmp.connect(out);
    src.start(start);
    src.stop(start + 0.02);
  }
}

/** A pitch glide, for the few effects that should move rather than step. */
function glide(context, out, t0, { from, to, at = 0, duration = 0.2, gain = 0.15, type = 'sine' }) {
  const start = t0 + at;
  const end = start + duration;
  const osc = context.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(from, start);
  osc.frequency.exponentialRampToValueAtTime(to, end);
  const amp = context.createGain();
  amp.gain.setValueAtTime(0.0001, start);
  amp.gain.exponentialRampToValueAtTime(gain, start + 0.01);
  amp.gain.exponentialRampToValueAtTime(0.0001, end);
  osc.connect(amp);
  amp.connect(out);
  osc.start(start);
  osc.stop(end + 0.03);
}

// Equal temperament, A4 = 440. Named so the patterns below read as music.
const C5 = 523.25;
const D5 = 587.33;
const E5 = 659.25;
const G5 = 783.99;
const A5 = 880.0;
const B5 = 987.77;
const C6 = 1046.5;
const D6 = 1174.66;
const E6 = 1318.51;
const G6 = 1567.98;

/**
 * The pentatonic run a streak of completions climbs. Pentatonic because any two
 * of its notes sound fine together, so a completion landing while the previous
 * one still rings never clashes.
 */
const COMBO_SCALE = [C5, D5, E5, G5, A5, C6];
const COMBO_WINDOW_MS = 4000;
let combo = { step: -1, at: 0 };

/** Where the next completion lands on the scale: up one if it follows closely. */
function nextComboNote(now = Date.now()) {
  const step = now - combo.at <= COMBO_WINDOW_MS ? Math.min(combo.step + 1, COMBO_SCALE.length - 1) : 0;
  combo = { step, at: now };
  return COMBO_SCALE[step];
}

/**
 * Every effect, as a function of the context, the bus and a start time.
 * Longer and higher means rarer and bigger.
 */
const EFFECTS = {
  /**
   * Ticking a quest off — heard many times a day, so it is short. A tap, then
   * the note and its fifth, starting wherever the current run has reached.
   */
  complete: (c, out, t0) => {
    const root = nextComboNote();
    voice(c, out, t0, { freq: root, duration: 0.16, gain: 0.2, click: 0.35 });
    voice(c, out, t0, { freq: root * 1.5, at: 0.06, duration: 0.26, gain: 0.18 });
  },

  /**
   * A tap on a quest that is already done. Nothing changes, so it must not
   * sound like anything did: one muted tap, lower and softer than a completion.
   * The falling "uncomplete" pair used to play here, which announced an undo
   * that never happened.
   */
  alreadyDone: (c, out, t0) => {
    voice(c, out, t0, { freq: G5 * 0.5, duration: 0.09, gain: 0.1, partial: 0, bright: 0.4, click: 0.18 });
  },

  /** Unticking one: the completion's two notes, falling. */
  uncomplete: (c, out, t0) => {
    voice(c, out, t0, { freq: G5, duration: 0.12, gain: 0.13, bright: 0.6 });
    voice(c, out, t0, { freq: C5, at: 0.07, duration: 0.18, gain: 0.11, bright: 0.5 });
  },

  /** A meal logged — rounder than a quest, a soft pop and a bubble up. */
  meal: (c, out, t0) => {
    glide(c, out, t0, { from: 320, to: 760, duration: 0.12, gain: 0.16 });
    voice(c, out, t0, { freq: E5, at: 0.08, duration: 0.22, gain: 0.15, type: 'sine', partial: 0.5 });
  },

  /** The coach replied. Two soft bells, out of the way of whatever is on screen. */
  message: (c, out, t0) => {
    voice(c, out, t0, { freq: A5, duration: 0.22, gain: 0.11, type: 'sine', partial: 0.6 });
    voice(c, out, t0, { freq: E6, at: 0.09, duration: 0.3, gain: 0.08, type: 'sine', partial: 0.6 });
  },

  /** A category reaching a milestone level: a short, bright rise. */
  categoryLevelUp: (c, out, t0) => {
    [C5, E5, G5].forEach((freq, k) =>
      voice(c, out, t0, { freq, at: k * 0.085, duration: 0.2, gain: 0.19, click: k === 0 ? 0.25 : 0 }));
    voice(c, out, t0, { freq: C6, at: 0.26, duration: 0.42, gain: 0.2, partial: 0.5 });
  },

  /**
   * A new overall level — a handful of times in the life of an account, so it
   * is the only one allowed to be grand. The arpeggio to the octave, a chord
   * that rings under it, and a shimmer on top.
   */
  levelUp: (c, out, t0) => {
    [C5, E5, G5, C6].forEach((freq, k) =>
      voice(c, out, t0, { freq, at: k * 0.1, duration: 0.24, gain: 0.19, click: k === 0 ? 0.3 : 0 }));
    // The chord lands with the top note and lingers.
    [C6, E6, G6].forEach((freq, k) =>
      voice(c, out, t0, { freq, at: 0.4, duration: 0.9, gain: [0.18, 0.11, 0.08][k], partial: 0.4 }));
    glide(c, out, t0, { from: C6 * 2, to: G6 * 2, at: 0.42, duration: 0.5, gain: 0.04 });
  },

  /** A streak milestone. Warmer and rounder than the level-up, and shorter. */
  streak: (c, out, t0) => {
    [A5, B5, C6].forEach((freq, k) =>
      voice(c, out, t0, { freq, at: k * 0.1, duration: k === 2 ? 0.45 : 0.18, gain: 0.18, type: 'sine', partial: 0.5 }));
    voice(c, out, t0, { freq: E6, at: 0.22, duration: 0.4, gain: 0.07, type: 'sine' });
  },

  /** A streak freeze spent: something saved, but cold — a glassy fall. */
  freeze: (c, out, t0) => {
    [E6, D6, B5, G5].forEach((freq, k) =>
      voice(c, out, t0, { freq, at: k * 0.07, duration: 0.3, gain: 0.1, type: 'sine', partial: 0.8 }));
  },

  /** Something went wrong. Two low notes, no sweetness — but not harsh either. */
  error: (c, out, t0) => {
    voice(c, out, t0, { freq: D5 * 0.5, duration: 0.14, gain: 0.16, type: 'square', bright: 0.25, partial: 0 });
    voice(c, out, t0, { freq: C5 * 0.375, at: 0.11, duration: 0.24, gain: 0.15, type: 'square', bright: 0.2, partial: 0 });
  },
};

/** The names playSfx accepts. */
export const SFX_NAMES = Object.keys(EFFECTS);

/**
 * Schedule an effect into any context — the live one, or an OfflineAudioContext
 * for measuring. Kept separate from playSfx so a render can be checked for
 * level and clipping without anything reaching the speakers.
 */
export function scheduleEffect(context, destination, name, when = context.currentTime) {
  const effect = EFFECTS[name];
  if (!effect) return false;
  effect(context, busFor(context, destination), when);
  return true;
}

/**
 * Play one of the effects above. Never throws and never awaits: a missing or
 * blocked audio device must not take a celebration down with it.
 */
export function playSfx(name) {
  if (isMuted()) return;
  if (!EFFECTS[name]) return;

  const context = audio();
  if (!context) return;

  try {
    scheduleEffect(context, context.destination, name);
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
