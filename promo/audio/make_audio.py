#!/usr/bin/env python3
"""DailyQ promo audio: an original, fully synthesised 14 s loop plus UI sounds.

Everything here is generated from numpy/scipy from a fixed seed, so the output is
reproducible and royalty-free by construction.

    python3 promo/audio/make_audio.py

Writes (next to this file), per promo/SPEC.md:
    music.wav  sfx.wav  mix.wav   48 kHz, stereo, 16-bit PCM, exactly 672000 samples
    cues.json  beats.json
and prints a measurement report (beat grid, loop seam, levels, cue placement).

Loop strategy: the whole music bed is built on a *circular* 14 s timeline. Notes
are added modulo the loop length, and every linear effect (EQ, reverb, ping-pong
delay) is applied in the frequency domain over exactly one period, i.e. as the
periodic steady-state response. Tails that run past 14.0 s therefore land at the
start of the loop, exactly where the previous cycle would have left them, and the
end sample flows into the first one with nothing cut.
"""

import json
import os
import wave

import numpy as np
from scipy import signal

HERE = os.path.dirname(os.path.abspath(__file__))
SEED = 20260925
SR = 48000
BPM = 120
BEAT = SR * 60 // BPM            # 24000 samples = 0.5 s
BEATS = 28                       # 7 bars x 4
L = BEAT * BEATS                 # 672000 samples = 14.000 s
EIGHTH = BEAT // 2
NYQ = SR / 2

rng = np.random.default_rng(SEED)


# --------------------------------------------------------------------------
# helpers
# --------------------------------------------------------------------------
def db(x):
    return 20 * np.log10(np.maximum(x, 1e-12))


def undb(d):
    return 10 ** (d / 20)


def mtof(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def tt(n):
    return np.arange(n) / SR


def pan(x, p):
    """Equal-power pan of a mono signal; p in [-1, 1]."""
    a = (p + 1) * np.pi / 4
    return np.stack([x * np.cos(a), x * np.sin(a)], axis=1) * np.sqrt(2)


def place(buf, x, start):
    """Add x into the circular buffer buf starting at sample `start` (wraps)."""
    idx = (int(start) + np.arange(len(x))) % L
    buf[idx] += x


def circ_response(sos=None, ba=None):
    """Frequency response of a filter on the rfft bins of an L-sample period."""
    w = np.linspace(0, np.pi, L // 2 + 1)
    if sos is not None:
        _, h = signal.sosfreqz(sos, worN=w)
    else:
        _, h = signal.freqz(ba[0], ba[1], worN=w)
    return h


def circ_apply(x, h):
    """Apply a frequency response circularly (periodic steady state)."""
    X = np.fft.rfft(x, axis=0)
    if x.ndim == 2:
        h = h[:, None]
    return np.fft.irfft(X * h, n=L, axis=0)


def peaking(f0, gain_db, q):
    """RBJ peaking EQ biquad."""
    A = 10 ** (gain_db / 40)
    w0 = 2 * np.pi * f0 / SR
    al = np.sin(w0) / (2 * q)
    b = np.array([1 + al * A, -2 * np.cos(w0), 1 - al * A])
    a = np.array([1 + al / A, -2 * np.cos(w0), 1 - al / A])
    return b / a[0], a / a[0]


def fade_tail(x, ms=8):
    n = min(len(x), int(ms * SR / 1000))
    x = x.copy()
    x[-n:] *= np.cos(np.linspace(0, np.pi / 2, n)) ** 2
    return x


def attack_ramp(n, ms):
    """Raised-cosine attack of length ms, then 1."""
    a = np.ones(n)
    k = max(1, int(ms * SR / 1000))
    k = min(k, n)
    a[:k] = 0.5 - 0.5 * np.cos(np.linspace(0, np.pi, k))
    return a


def sine(freq, n, phase0=0.0):
    """Sine with a (possibly time-varying) frequency array or scalar."""
    f = np.broadcast_to(np.asarray(freq, dtype=float), (n,))
    ph = 2 * np.pi * np.concatenate([[0.0], np.cumsum(f[:-1])]) / SR
    return np.sin(ph + phase0)


def ring(fc, q, n):
    """Impulse response of a resonant band-pass: a 'filtered click'."""
    b, a = signal.iirpeak(fc, q, fs=SR)
    imp = np.zeros(n)
    imp[0] = 1.0
    y = signal.lfilter(b, a, imp)
    return y / np.max(np.abs(y))


def noise_band(n, lo, hi, order=2):
    sos = signal.butter(order, [lo, hi], btype="bandpass", fs=SR, output="sos")
    return signal.sosfilt(sos, rng.standard_normal(n))


# --------------------------------------------------------------------------
# music: arrangement
# --------------------------------------------------------------------------
# 7 bars in C major, I - vi - ii - V -> back to I at the loop point.
#   bars 1-2  Cmaj9      bars 3-4  Am9      bars 5-6  Dm9
#   bar  7    G9sus (beats 1-2) -> G13 (beats 3-4), resolving to Cmaj9 at t=0.
CHORDS = [  # (start beat, length in beats, bass midi, pad voicing midi)
    (0, 8, 36, [52, 55, 59, 62]),     # Cmaj9: E3 G3 B3 D4 over C2
    (8, 8, 33, [52, 55, 59, 60]),     # Am9:   E3 G3 B3 C4 over A1
    (16, 8, 38, [53, 57, 60, 64]),    # Dm9:   F3 A3 C4 E4 over D2
    (24, 2, 31, [53, 57, 60, 62]),    # G9sus: F3 A3 C4 D4 over G1
    (26, 2, 31, [53, 59, 62, 64]),    # G13:   F3 B3 D4 E4 over G1
]


def chord_at_bar(bar):
    beat = bar * 4
    for c in CHORDS:
        if c[0] <= beat < c[0] + c[1]:
            return c
    return CHORDS[0]


def kick(vel):
    n = int(0.40 * SR)
    t = tt(n)
    f = 47 + 105 * np.exp(-t / 0.030) + 60 * np.exp(-t / 0.004)
    body = sine(f, n) * np.exp(-t / 0.15) * attack_ramp(n, 0.6)
    body = np.tanh(1.8 * body) / np.tanh(1.8)
    click = noise_band(n, 900, 2200) * np.exp(-t / 0.0015)
    click /= np.max(np.abs(click)) + 1e-9
    return fade_tail(vel * (body + 0.06 * click), 40)


def hat(vel, decay):
    n = int(0.12 * SR)
    t = tt(n)
    x = signal.sosfilt(signal.butter(4, 7800, "highpass", fs=SR, output="sos"),
                       rng.standard_normal(n))
    x = signal.sosfilt(signal.butter(2, 15000, "lowpass", fs=SR, output="sos"), x)
    x *= np.exp(-t / decay) * attack_ramp(n, 0.4)
    return fade_tail(vel * x / np.max(np.abs(x)), 10)


def clap():
    n = int(0.35 * SR)
    t = tt(n)
    src = noise_band(n, 850, 2100)
    env = np.zeros(n)
    for i, off in enumerate([0.0, 0.008, 0.017]):
        m = t >= off
        env[m] += (0.55 + 0.2 * i) * np.exp(-(t[m] - off) / 0.0035)
    m = t >= 0.017
    env[m] += 0.5 * np.exp(-(t[m] - 0.017) / 0.075)
    x = src * env * attack_ramp(n, 0.3)
    return fade_tail(x / np.max(np.abs(x)), 30)


def bass_note(midi, dur_s):
    rel = 0.05
    n = int((dur_s + rel) * SR)
    t = tt(n)
    f = mtof(midi)
    ph = 2 * np.pi * f * t
    x = np.sin(ph) + 0.16 * np.sin(2 * ph + 0.3) + 0.04 * np.sin(3 * ph + 0.9)
    env = attack_ramp(n, 6)
    k = int(dur_s * SR)
    env[k:] *= np.cos(np.linspace(0, np.pi / 2, n - k)) ** 2
    env *= 1 - 0.18 * (1 - np.exp(-t / 0.25))  # gentle settle, stays round
    return np.tanh(1.3 * x * env) / np.tanh(1.3)


def pad_note(midi, dur_s):
    """Soft, band-limited detuned saws (additive), three voices spread L/C/R."""
    att, rel = 0.30, 0.70
    n = int((dur_s + rel) * SR)
    t = tt(n)
    out = np.zeros((n, 2))
    f0 = mtof(midi)
    for cents, p in [(-7, -0.7), (0, 0.0), (7, 0.7)]:
        f = f0 * 2 ** (cents / 1200)
        v = np.zeros(n)
        nh = int(4500 // f)
        for h in range(1, nh + 1):
            amp = (1 / h) * np.exp(-(h * f) / 1100)  # warm rolloff
            v += amp * np.sin(2 * np.pi * h * f * t + rng.uniform(0, 2 * np.pi))
        out += pan(v, p)
    env = attack_ramp(n, att * 1000)
    k = int(dur_s * SR)
    env[k:] *= np.cos(np.linspace(0, np.pi / 2, n - k)) ** 2
    return out * env[:, None]


def pluck(midi, vel):
    """Two-operator FM, e-piano-ish, darkened; short and round."""
    n = int(0.9 * SR)
    t = tt(n)
    f = mtof(midi)
    idx = 1.6 * np.exp(-t / 0.07) + 0.25
    x = np.sin(2 * np.pi * f * t + idx * np.sin(2 * np.pi * f * t))
    x *= np.exp(-t / 0.28) * attack_ramp(n, 1.5)
    return fade_tail(vel * x, 60)


def reverb_ir(rt_lo, rt_hi, length_s, predelay_s):
    n = int(length_s * SR)
    t = tt(n)
    ir = np.zeros((n, 2))
    lo_sos = signal.butter(2, 2500, "lowpass", fs=SR, output="sos")
    hi_sos = signal.butter(2, 2500, "highpass", fs=SR, output="sos")
    for ch in range(2):
        nz = rng.standard_normal(n)
        lo = signal.sosfilt(lo_sos, nz) * np.exp(-6.9 * t / rt_lo)
        hi = signal.sosfilt(hi_sos, nz) * np.exp(-6.9 * t / rt_hi)
        ir[:, ch] = (lo + 0.5 * hi) * attack_ramp(n, 12)
    pd = int(predelay_s * SR)
    ir = np.concatenate([np.zeros((pd, 2)), ir])[:n]
    return ir / np.sqrt(np.sum(ir ** 2) / 2)


def circ_convolve(x, ir):
    """Circular (periodic) convolution of an L-sample stereo buffer with a stereo IR."""
    irp = np.zeros((L, 2))
    irp[: len(ir)] = ir
    return np.fft.irfft(np.fft.rfft(x, axis=0) * np.fft.rfft(irp, axis=0), n=L, axis=0)


def pingpong(x_mono, delay_s, fb, lp_hz):
    """Circular ping-pong delay (wet only), each repeat darker than the last."""
    D = int(round(delay_s * SR))
    w = np.linspace(0, np.pi, L // 2 + 1)
    _, lp = signal.sosfreqz(signal.butter(1, lp_hz, "lowpass", fs=SR, output="sos"), worN=w)
    z = np.exp(-1j * w * D) * lp
    X = np.fft.rfft(x_mono)
    den = 1 - (fb * z) ** 2
    yl = np.fft.irfft(X * z / den, n=L)
    yr = np.fft.irfft(X * fb * z * z / den, n=L)
    return np.stack([yl, yr], axis=1)


def sidechain(depth, t_att, t_rel):
    """Per-beat periodic duck gain, continuous across every beat and the loop."""
    u = np.arange(BEAT) / SR
    s = (1 - np.exp(-u / t_att)) * np.exp(-u / t_rel)
    s -= s[-1] * u / u[-1]                 # exactly 0 at both ends of the beat
    s /= s.max()
    g = 1 - depth * s
    return np.tile(g, BEATS)


def build_music():
    drums = np.zeros((L, 2))
    bass = np.zeros(L)
    pad = np.zeros((L, 2))
    plk = np.zeros(L)
    plk_st = np.zeros((L, 2))
    rev_send = np.zeros((L, 2))

    # kick: four on the floor, downbeats a touch stronger
    for k in range(BEATS):
        v = 1.0 if k % 4 == 0 else 0.84
        place(drums, pan(kick(v), 0.0), k * BEAT)

    # closed hats on 8ths; off-beats lead, on-beats sit back
    for e in range(BEATS * 2):
        off = e % 2 == 1
        v = (0.34 if off else 0.20) * rng.uniform(0.92, 1.0)
        place(drums, pan(hat(v, 0.030 if off else 0.018), 0.18), e * EIGHTH)

    # soft clap on 2 and 4
    for k in range(BEATS):
        if k % 4 in (1, 3):
            c = pan(clap() * 0.30, 0.0)
            place(drums, c, k * BEAT)
            place(rev_send, c * 0.9, k * BEAT)

    # sub bass (in eighths within each bar)
    for bar in range(7):
        start, _, root, _ = chord_at_bar(bar)
        if bar == 6:
            pattern = [(0, 3, root), (3, 2, root), (7, 1, root + 4)]   # G .. B -> C
        elif bar % 2 == 0:
            pattern = [(0, 3, root), (3, 2, root), (7, 1, root)]
        else:
            pattern = [(0, 3, root), (3, 1, root), (5, 1, root + 12), (7, 1, root + 7)]
        for pos, dur, m in pattern:
            place(bass, bass_note(m, dur * 0.25 - 0.02), bar * 4 * BEAT + pos * EIGHTH)

    # pad: one sustained chord per CHORDS entry, overlapping crossfades
    for start, length, _, voicing in CHORDS:
        for m in voicing:
            place(pad, pad_note(m, length * 0.5 + 0.05), start * BEAT)

    # pluck: 3-3-2 syncopation on the upper structure of each chord
    for bar in range(7):
        c = chord_at_bar(bar)
        v = [m + 12 for m in c[3]]
        if bar == 6:
            v2 = [m + 12 for m in CHORDS[4][3]]
            hits = [(0, [v[2], v[3]], 0.85), (3, [v[1]], 0.55), (5, [v2[3]], 0.6), (7, [v2[1]], 0.5)]
        elif bar % 2 == 0:
            hits = [(0, [v[2], v[3]], 0.85), (3, [v[1]], 0.55), (5, [v[3]], 0.6)]
        else:
            hits = [(0, [v[1], v[3]], 0.80), (3, [v[2]], 0.55), (5, [v[0] + 12], 0.5), (7, [v[3]], 0.45)]
        for pos, notes, vel in hits:
            for m in notes:
                place(plk, pluck(m, vel), bar * 4 * BEAT + pos * EIGHTH)

    # --- processing (all circular) ---
    bass = circ_apply(bass, circ_response(sos=signal.butter(2, 260, "lowpass", fs=SR, output="sos")))
    bass *= sidechain(0.55, 0.004, 0.10)
    pad *= sidechain(0.30, 0.006, 0.14)[:, None]
    pad = circ_apply(pad, circ_response(sos=signal.butter(2, [180, 2200], "bandpass", fs=SR, output="sos")))

    plk = circ_apply(plk, circ_response(sos=signal.butter(2, 2400, "lowpass", fs=SR, output="sos")))
    plk_st = pan(plk, -0.22)
    echo = pingpong(plk, 0.375, 0.38, 2600) * 0.28
    rev_send += plk_st * 0.5 + pad * 0.35

    ir = reverb_ir(rt_lo=2.0, rt_hi=0.8, length_s=3.2, predelay_s=0.018)
    wet = circ_convolve(rev_send, ir)
    wet = circ_apply(wet, circ_response(sos=signal.butter(2, 220, "highpass", fs=SR, output="sos")))

    stems = {
        "drums": drums * 0.9,
        "bass": pan(bass, 0.0) * 0.50,
        "pad": pad * 0.055,
        "pluck": plk_st * 0.30,
        "echo": echo * 0.30,
        "reverb": wet * 0.075,
    }
    mix = sum(stems.values())

    # bus EQ: carve a pocket for the UI sounds, keep the top silky
    mix = circ_apply(mix, circ_response(ba=peaking(3300, -5.0, 0.7)))
    mix = circ_apply(mix, circ_response(ba=peaking(1800, -1.5, 1.0)))
    mix = circ_apply(mix, circ_response(sos=signal.butter(1, 18, "highpass", fs=SR, output="sos")))
    return mix


# --------------------------------------------------------------------------
# UI sounds: one family. Sine pops tuned to C major, resonant filtered clicks
# in the 2-5 kHz pocket, a shared tiny room. Each returns a stereo array.
# --------------------------------------------------------------------------
def pop(freq, n, tau, att_ms=1.5, partials=((1.0, 1.0),)):
    t = tt(n)
    x = np.zeros(n)
    for ratio, amp in partials:
        x += amp * sine(np.asarray(freq) * ratio, n)
    return x * np.exp(-t / tau) * attack_ramp(n, att_ms)


BELL = ((1.0, 1.0), (2.0, 0.16), (3.0, 0.035))


def tclick(fc, q, n, level=1.0):
    return level * ring(fc, q, n)


def sfx_click():
    n = int(0.12 * SR)
    t = tt(n)
    x = tclick(3000, 2.2, n) * 0.55
    x += noise_band(n, 1800, 5200) * np.exp(-t / 0.0011) * 0.10
    x += pop(1760, n, 0.020, 0.8) * 0.45             # A6 sine
    x += pop(440, n, 0.010, 0.8) * 0.30              # soft body
    return pan(x, 0.0)


def sfx_success():
    n = int(0.75 * SR)
    a = pop(mtof(79), n, 0.17, 2.0, BELL)            # G5
    b = np.zeros(n)
    d = int(0.085 * SR)
    b[d:] = pop(mtof(84), n - d, 0.20, 2.0, BELL) * 0.62   # C6
    return pan(a, -0.08) + pan(b, 0.08)


def sfx_tick():
    n = int(0.06 * SR)
    t = tt(n)
    x = pop(mtof(96), n, 0.006, 0.5) * 0.7           # C7
    x += tclick(4200, 3.0, n) * 0.35
    x += noise_band(n, 3000, 7000) * np.exp(-t / 0.0006) * 0.05
    return pan(x, 0.05)


def svf_sweep(src, fc):
    """Chamberlin state-variable band-pass with a per-sample cutoff."""
    y = np.zeros_like(src)
    lp = bp = 0.0
    q = 1.3
    for i in range(len(src)):
        f = 2 * np.sin(np.pi * fc[i] / SR)
        hp = src[i] - lp - q * bp
        bp += f * hp
        lp += f * bp
        y[i] = bp
    return y


def sfx_morph(variant):
    n = int(0.38 * SR)
    t = tt(n)
    tp = 0.055                                        # peak ~55 ms in
    shape = 1.0 + 0.06 * (variant % 4 - 1.5)          # tiny per-cue variation
    fc = shape * (520 + 2300 * (1 - np.exp(-t / 0.07)))
    x = svf_sweep(rng.standard_normal(n), fc)
    env = np.where(t < tp, np.sin(np.pi / 2 * t / tp) ** 2, np.exp(-(t - tp) / 0.075))
    x = x * env
    x /= np.max(np.abs(x))
    glide = sine(shape * (392 + 130 * (1 - np.exp(-t / 0.05))), n) * env * 0.18
    xl = x * 0.9 + glide
    # widen: a slightly different noise take on the right, same envelope
    xr = svf_sweep(rng.standard_normal(n), fc) * env
    xr = xr / np.max(np.abs(xr)) * 0.9 + glide
    return np.stack([xl, xr], axis=1)


def sfx_rise():
    n = int(0.45 * SR)
    t = tt(n)
    f = 660 * 2 ** (np.minimum(t, 0.30) / 0.30)       # E5 -> E6 over 300 ms
    x = sine(f, n) + 0.14 * sine(2 * f, n)
    x *= np.exp(-t / 0.13) * attack_ramp(n, 6)
    sh = noise_band(n, 4000, 9000) * np.exp(-t / 0.05) * attack_ramp(n, 6) * 0.04
    return pan(x + sh, 0.0)


def sfx_grab():
    n = int(0.12 * SR)
    t = tt(n)
    f = mtof(74) * (1 + 0.18 * np.exp(-t / 0.006))   # D5 with a small drop into it
    x = sine(f, n) * np.exp(-t / 0.035) * attack_ramp(n, 1.2)
    x += tclick(2200, 2.0, n) * 0.25
    return pan(x, -0.05)


def sfx_snap():
    n = int(0.14 * SR)
    t = tt(n)
    x = tclick(3600, 2.0, n) * 0.6
    f = mtof(88) * (1 - 0.07 * np.exp(-t / 0.004))   # E6, settles up into pitch
    x += sine(f, n) * np.exp(-t / 0.030) * attack_ramp(n, 0.6) * 0.6
    x += pop(mtof(76), n, 0.012, 0.6) * 0.2
    return pan(x, 0.05)


def sfx_toggle():
    n = int(0.16 * SR)
    t = tt(n)
    x = tclick(2600, 2.0, n) * 0.30                  # knob leaves
    d = int(0.030 * SR)
    m = np.zeros(n)
    m[d:] = tclick(3200, 2.2, n - d) * 0.55          # knob lands (the peak)
    m[d:] += pop(mtof(91) * (1 + 0.0 * t[: n - d]), n - d, 0.028, 0.6) * 0.55   # G6
    m[d:] += pop(mtof(79), n - d, 0.015, 0.6) * 0.2
    return pan(x + m, 0.0)


def sfx_hover():
    n = int(0.12 * SR)
    x = pop(mtof(91), n, 0.030, 3.0, ((1.0, 1.0), (1.5, 0.12)))   # G6 + a whisper of D7
    return pan(x, 0.1)


def sfx_notify(variant):
    n = int(0.55 * SR)
    out = np.zeros((n, 2))
    if variant == "push":          # soft dyad strike, C6 + E6
        x = pop(mtof(84), n, 0.19, 2.0, BELL) + 0.7 * pop(mtof(88), n, 0.17, 2.0, BELL)
        out += pan(x, 0.0)
    elif variant == "telegram":    # quick upward pair, A5 -> E6
        a = pop(mtof(81), n, 0.14, 2.0, BELL)
        b = np.zeros(n)
        d = int(0.065 * SR)
        b[d:] = pop(mtof(88), n - d, 0.17, 2.0, BELL) * 0.6
        out += pan(a, 0.12) + pan(b, 0.18)
    elif variant == "email":       # gentle downward pair, G6 -> D6
        a = pop(mtof(91), n, 0.13, 2.0, BELL)
        b = np.zeros(n)
        d = int(0.09 * SR)
        b[d:] = pop(mtof(86), n - d, 0.18, 2.0, BELL) * 0.62
        out += pan(a, -0.15) + pan(b, -0.1)
    return out


def sfx_key(i):
    n = int(0.07 * SR)
    t = tt(n)
    fc = 2400 * (1.0, 1.07, 0.95)[i]
    x = noise_band(n, fc * 0.7, fc * 1.4) * np.exp(-t / 0.0014) * 0.5
    x += tclick(fc, 2.5, n) * 0.5
    x += pop(330 * (1.0, 1.04, 0.97)[i], n, 0.006, 0.5) * 0.35
    return pan(x, (-0.06, 0.0, 0.06)[i])


def sfx_enter():
    n = int(0.35 * SR)
    t = tt(n)
    x = tclick(2300, 2.2, n) * 0.55
    x += noise_band(n, 1500, 3800) * np.exp(-t / 0.002) * 0.25
    x += pop(220, n, 0.014, 0.5) * 0.45
    d = int(0.012 * SR)
    c = np.zeros(n)
    c[d:] = pop(mtof(84), n - d, 0.09, 2.0, BELL) * 0.42     # C6 confirm
    return pan(x + c, 0.0)


# peak level (dBFS) of each sound in sfx.wav, before the global safety trim
SFX_LEVEL = {
    "click": -7.5, "success": -8.5, "tick": -11.0, "morph": -12.5, "rise": -11.0,
    "grab": -10.5, "snap": -9.0, "toggle": -9.0, "hover": -12.0, "notify": -9.0,
    "key": -12.5, "enter": -9.0,
}

ROOM = None
SFX_GAIN = 1.5   # overall sfx bus gain, dB


def room(x):
    """Shared tiny room so the family sits in one space (8 % wet)."""
    global ROOM
    if ROOM is None:
        n = int(0.30 * SR)
        t = tt(n)
        ir = np.stack([rng.standard_normal(n), rng.standard_normal(n)], axis=1)
        ir = signal.sosfilt(signal.butter(2, [400, 6000], "bandpass", fs=SR, output="sos"), ir, axis=0)
        ir *= (np.exp(-6.9 * t / 0.25) * attack_ramp(n, 4))[:, None]
        pd = int(0.006 * SR)
        ir = np.concatenate([np.zeros((pd, 2)), ir])
        ROOM = ir / np.sqrt(np.sum(ir ** 2) / 2)
    wet = np.stack([signal.fftconvolve(x[:, c], ROOM[:, c]) for c in range(2)], axis=1)
    y = np.zeros_like(wet)
    y[: len(x)] = x
    return y + 0.08 * wet


def cue_list():
    """(t, k, sound, variant) straight from the SPEC state table."""
    table = {1: "click", 2: "success", 3: "tick", 4: "morph", 5: "morph", 6: "click",
             7: "rise", 8: "morph", 9: "click", 10: "tick", 11: "click", 12: "morph",
             13: "tick", 14: "grab", 15: "snap", 16: "toggle", 17: "morph", 18: "click",
             19: "rise", 20: "hover", 21: "notify", 22: "notify", 23: "notify", 24: "morph",
             25: "key", 26: "enter", 27: "morph"}
    cues = []
    for k in range(1, BEATS):
        s = table[k]
        if s == "key":
            for i, t in enumerate([12.50, 12.62, 12.74]):
                cues.append((t, k, s, i))
        elif s == "notify":
            cues.append((0.5 * k, k, s, {21: "push", 22: "telegram", 23: "email"}[k]))
        elif s == "morph":
            cues.append((0.5 * k, k, s, k))
        else:
            cues.append((0.5 * k, k, s, None))
    return cues


# Every sound is "transient-led": a small filtered click is laid on its own
# loudest crest so that one sample is clearly the peak. That makes the measured
# peak unambiguous (tonal sounds otherwise have many near-equal crests, and a
# neighbour's tail could tip which one wins), and it ties the family together.
ACCENT = {"click": 0.25, "tick": 0.3, "hover": 0.28, "key": 0.25, "morph": 0.45}


def accent(x, level):
    amp = np.max(np.abs(x), axis=1)
    p = int(np.argmax(amp))
    ch = int(np.argmax(np.abs(x[p])))
    sgn = np.sign(x[p, ch])
    n = min(len(x) - p, int(0.01 * SR))
    r = ring(3100, 1.6, n) * level * amp[p] * sgn
    y = x.copy()
    y[p:p + n] += r[:, None]
    return y


def peak_margin(x):
    """Peak over the loudest sample more than 0.3 ms away, in dB."""
    amp = np.max(np.abs(x), axis=1)
    p = int(np.argmax(amp))
    g = int(0.0003 * SR)
    other = np.concatenate([amp[:max(0, p - g)], amp[p + g + 1:]])
    return db(amp[p] / other.max())


def render_sound(sound, variant):
    fn = {
        "click": sfx_click, "success": sfx_success, "tick": sfx_tick, "rise": sfx_rise,
        "grab": sfx_grab, "snap": sfx_snap, "toggle": sfx_toggle, "hover": sfx_hover,
        "enter": sfx_enter,
    }
    if sound == "morph":
        x = sfx_morph(variant)
    elif sound == "notify":
        x = sfx_notify(variant)
    elif sound == "key":
        x = sfx_key(variant)
    else:
        x = fn[sound]()
    x = accent(x, ACCENT.get(sound, 0.3))
    x = room(x)
    x = signal.sosfilt(signal.butter(1, 120, "highpass", fs=SR, output="sos"), x, axis=0)
    x = np.stack([fade_tail(x[:, c], 15) for c in range(2)], axis=1)
    return x / np.max(np.abs(x)) * undb(SFX_LEVEL[sound] + SFX_GAIN)


def cue_window(sound):
    return int(0.05 * SR) if sound == "key" else int(0.12 * SR)


def measured_peak(buf, target, sound):
    amp = np.max(np.abs(buf), axis=1)
    hw = cue_window(sound)
    idx = (target + np.arange(-hw, hw + 1)) % L
    j = int(idx[np.argmax(amp[idx])])
    return (j - target + L // 2) % L - L // 2          # signed error in samples


def build_sfx():
    placed = []
    for t, k, sound, variant in cue_list():
        x = render_sound(sound, variant)
        p = int(np.argmax(np.max(np.abs(x), axis=1)))    # measured peak offset (isolated)
        target = int(round(t * SR))
        placed.append(dict(t=t, k=k, sound=sound, variant=variant, x=x, peak_offset=p,
                           target=target, shift=0))

    def assemble():
        buf = np.zeros((L, 2))
        for c in placed:
            place(buf, c["x"], c["target"] - c["peak_offset"] + c["shift"])
        return buf

    for c in placed:
        c["margin"] = peak_margin(c["x"])
    return assemble(), placed


# --------------------------------------------------------------------------
# analysis
# --------------------------------------------------------------------------
def k_weight(x):
    b1 = [1.53512485958697, -2.69169618940638, 1.19839281085285]
    a1 = [1.0, -1.69065929318241, 0.73248077421585]
    b2 = [1.0, -2.0, 1.0]
    a2 = [1.0, -1.99004745483398, 0.99007225036621]
    return signal.lfilter(b2, a2, signal.lfilter(b1, a1, x, axis=0), axis=0)


def lufs(x):
    """BS.1770-4 integrated loudness, measured on the loop played twice (steady state)."""
    y = k_weight(np.concatenate([x, x]))[L:]
    blk, hop = int(0.4 * SR), int(0.1 * SR)
    ms = np.array([np.mean(np.sum(y[i:i + blk] ** 2, axis=1))
                   for i in range(0, len(y) - blk + 1, hop)])
    ld = -0.691 + 10 * np.log10(ms + 1e-20)
    g = ms[ld > -70]
    rel = -0.691 + 10 * np.log10(np.mean(g)) - 10
    g = ms[(ld > -70) & (ld > rel)]
    return -0.691 + 10 * np.log10(np.mean(g))


def detect_beats(x):
    """Spectral-flux onset detection on the music, then tempo/phase from the
    onset function, and the *detected* onset nearest each beat."""
    mono = x.mean(axis=1)
    pre = int(0.5 * SR)
    y = np.concatenate([mono[-pre:], mono, mono[:pre]])     # circular context
    nfft, hop = 1024, 48                                      # 1 ms hop
    win = np.hanning(nfft)
    nfr = (len(y) - nfft) // hop + 1
    frames = np.lib.stride_tricks.as_strided(
        y, shape=(nfr, nfft), strides=(y.strides[0] * hop, y.strides[0]))
    S = np.abs(np.fft.rfft(frames * win, axis=1))
    logS = np.log1p(1000 * S)
    flux = np.maximum(0, np.diff(logS, axis=0)).sum(axis=1)
    # time of each flux value: midpoint of the two frame centres, in loop time
    tf = (np.arange(1, nfr) * hop + nfft / 2 - hop / 2 - pre) / SR

    # onset peaks: local maxima over +-60 ms above an adaptive threshold
    w = 60
    peaks = []
    thr = np.median(flux) + 1.5 * np.std(flux)
    for i in range(w, len(flux) - w):
        if flux[i] >= thr and flux[i] == flux[i - w:i + w + 1].max():
            # parabolic sub-hop refinement
            a, b, c = flux[i - 1], flux[i], flux[i + 1]
            d = 0.5 * (a - c) / (a - 2 * b + c) if (a - 2 * b + c) != 0 else 0.0
            peaks.append((tf[i] + d * hop / SR, flux[i], i))
    # The log-flux peak fires as an onset enters the window's leading edge, so it
    # runs ~10 ms early. Localise each onset in the time domain instead: the first
    # point where a 0.5 ms RMS envelope climbs a quarter of the way from the
    # pre-onset floor to the local maximum.
    # (Envelope taken above 3 kHz so the sub bass's own waveform doesn't ripple it.)
    k_ = int(0.0005 * SR)
    yh = signal.sosfiltfilt(signal.butter(4, 3000, "highpass", fs=SR, output="sos"), y)
    env = np.sqrt(np.convolve(yh ** 2, np.ones(k_) / k_, mode="same"))

    def localise(t0):
        c = int(round(t0 * SR)) + pre
        a, b = c - int(0.005 * SR), c + int(0.030 * SR)
        seg = env[a:b]
        floor = np.percentile(env[c - int(0.040 * SR):c - int(0.010 * SR)], 20)
        top = seg.max()
        j = np.argmax(seg >= floor + 0.25 * (top - floor))
        return (a + j - pre) / SR

    onsets = np.array([localise(p[0]) for p in peaks if -0.05 <= p[0] < 14.0 - 0.05])

    # tempo from the autocorrelation of the onset function, 80-160 BPM
    f0 = flux - flux.mean()
    ac = np.correlate(f0, f0, mode="full")[len(f0) - 1:]
    lags = np.arange(len(ac)) * hop / SR
    band = (lags >= 60 / 160) & (lags <= 60 / 80)
    period = lags[band][np.argmax(ac[band])]
    # refine the period by least squares over the onsets it explains
    phase_t = onsets[np.argmin(np.abs(onsets))]
    kk = np.round((onsets - phase_t) / period)
    good = np.abs(onsets - phase_t - kk * period) < 0.03
    A = np.stack([kk[good], np.ones(good.sum())], axis=1)
    period, phase_t = np.linalg.lstsq(A, onsets[good], rcond=None)[0]
    nb = int(round(14.0 / period))
    beats = []
    for k in range(nb):
        exp_t = phase_t + k * period
        j = np.argmin(np.abs(onsets - exp_t))
        beats.append(float(onsets[j]) if abs(onsets[j] - exp_t) < 0.04 else None)
    # downbeat: the beat phase (mod 4) carrying the most 200-1200 Hz energy in the
    # 80 ms after its onset (accented kick, bass root and chord pluck land there)
    ym = signal.sosfiltfilt(signal.butter(4, [200, 1200], "bandpass", fs=SR, output="sos"), y)
    strength = np.zeros(4)
    for k, bt in enumerate(beats):
        if bt is None:
            continue
        i = int(round(bt * SR)) + pre
        strength[k % 4] += np.sum(ym[i:i + int(0.08 * SR)] ** 2)
    strength = 10 * np.log10(strength / strength.max())
    downbeat = int(np.argmax(strength))
    return dict(beats=beats, bpm=60 / period, period=period, downbeat_index=downbeat,
                phase_strength=strength.tolist(), n_onsets=len(onsets))


def write_wav(path, x):
    q = np.clip(np.round(x * 32767), -32768, 32767).astype("<i2")
    assert q.shape == (L, 2)
    with wave.open(path, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(q.tobytes())
    return q


def read_wav(path):
    with wave.open(path, "rb") as w:
        info = (w.getframerate(), w.getnchannels(), w.getsampwidth() * 8, w.getnframes())
        q = np.frombuffer(w.readframes(w.getnframes()), dtype="<i2").reshape(-1, w.getnchannels())
    return info, q


def main():
    music = build_music()
    music *= undb(-5.5) / np.max(np.abs(music))            # music peak at -5.5 dBFS
    sfx, placed = build_sfx()

    ceiling = undb(-1.05)
    trim = min(1.0, ceiling / np.max(np.abs(music + sfx)))
    music *= trim
    sfx *= trim
    mix = music + sfx

    qm = write_wav(os.path.join(HERE, "music.wav"), music)
    qs = write_wav(os.path.join(HERE, "sfx.wav"), sfx)
    # mix written from the summed floats; equals music+sfx within 1 LSB
    qx = write_wav(os.path.join(HERE, "mix.wav"), mix)

    cues = []
    for p in placed:
        c = {"t": round(p["t"], 3), "k": p["k"], "sound": p["sound"]}
        if p["sound"] in ("notify",):
            c["variant"] = p["variant"]
        cues.append(c)
    with open(os.path.join(HERE, "cues.json"), "w") as f:
        json.dump(cues, f, indent=2)

    # ---- measurements, all from the written files ----
    print("== format")
    for name in ("music", "sfx", "mix"):
        info, _ = read_wav(os.path.join(HERE, f"{name}.wav"))
        print(f"  {name}.wav: {info[0]} Hz, {info[1]} ch, {info[2]}-bit, {info[3]} samples = {info[3] / SR:.6f} s")
    _, qm = read_wav(os.path.join(HERE, "music.wav"))
    _, qs = read_wav(os.path.join(HERE, "sfx.wav"))
    _, qx = read_wav(os.path.join(HERE, "mix.wav"))
    fm, fs_, fx = (q.astype(float) / 32768 for q in (qm, qs, qx))

    print("== beat grid (spectral-flux onsets of music.wav)")
    bd = detect_beats(fm)
    dev = [abs(b - 0.5 * k) for k, b in enumerate(bd["beats"]) if b is not None]
    missing = sum(b is None for b in bd["beats"])
    print(f"  onsets found {bd['n_onsets']}, tempo {bd['bpm']:.3f} BPM, beats {len(bd['beats'])}, missing {missing}")
    print(f"  max |beat_k - 0.5k| = {1000 * max(dev):.2f} ms, mean {1000 * np.mean(dev):.2f} ms")
    print(f"  downbeat phase {bd['downbeat_index']} (phase energy dB {np.round(bd['phase_strength'], 2).tolist()})")
    with open(os.path.join(HERE, "beats.json"), "w") as f:
        json.dump({
            "method": "spectral flux (1024-pt Hann, 1 ms hop, log magnitude), peak-picked; "
                      "tempo from onset autocorrelation (80-160 BPM) refined by least squares; "
                      "each beat is the detected onset nearest the fitted grid, localised on a >3 kHz 0.5 ms RMS envelope; "
                      "downbeat = beat phase with most 200-1200 Hz energy in the 80 ms after onset",
            "bpm": round(bd["bpm"], 4),
            "downbeat_index": bd["downbeat_index"],
            "beats": [None if b is None else round(b, 4) for b in bd["beats"]],
            "downbeats": [round(b, 4) for k, b in enumerate(bd["beats"])
                          if b is not None and k % 4 == bd["downbeat_index"] % 4],
            "max_deviation_ms": round(1000 * max(dev), 2),
        }, f, indent=2)

    print("== loop seam (music.wav, int16 counts)")
    d = np.abs(np.diff(qm.astype(int), axis=0))
    seam = np.abs(qm[0].astype(int) - qm[-1].astype(int))
    print(f"  seam jump L/R = {seam.tolist()}  | elsewhere: median {np.median(d):.0f}, "
          f"p99 {np.percentile(d, 99):.0f}, max {d.max()}")
    for name, q in (("sfx", qs), ("mix", qx)):
        dd = np.abs(np.diff(q.astype(int), axis=0))
        s = np.abs(q[0].astype(int) - q[-1].astype(int))
        print(f"  {name}: seam {s.tolist()} | median {np.median(dd):.0f}, max {dd.max()}")
    edge = lambda q, a, b: 20 * np.log10(np.sqrt(np.mean((q[a:b].astype(float) / 32768) ** 2)) + 1e-12)
    print(f"  music RMS last 50 ms {edge(qm, L - 2400, L):.1f} dBFS, first 50 ms {edge(qm, 0, 2400):.1f} dBFS")

    print("== levels")
    for name, x in (("music", fm), ("sfx", fs_), ("mix", fx)):
        pk = db(np.max(np.abs(x)))
        rms = db(np.sqrt(np.mean(x ** 2)))
        print(f"  {name:5s}: peak {pk:6.2f} dBFS, RMS {rms:6.2f} dBFS, loudness {lufs(x):6.2f} LUFS")

    print("== cues: measured peak in sfx.wav vs target, and level over the local music")
    hp = signal.butter(4, 1000, "highpass", fs=SR, output="sos")
    music_hi = signal.sosfiltfilt(hp, np.concatenate([fm, fm, fm]), axis=0)[L:2 * L]
    amp = np.max(np.abs(fs_), axis=1)
    errs, over, over_hi = [], [], []
    for c, p in zip(cues, placed):
        tgt = p["target"]
        hw = int(0.05 * SR) if c["sound"] == "key" else int(0.12 * SR)
        idx = (tgt + np.arange(-hw, hw + 1)) % L
        j = idx[np.argmax(amp[idx])]
        err = (j - tgt) / SR * 1000
        errs.append(abs(err))
        pk = db(amp[j])
        widx = (tgt + np.arange(-int(0.1 * SR), int(0.1 * SR))) % L
        m_rms = db(np.sqrt(np.mean(fm[widx] ** 2)))
        m_pk = db(np.max(np.abs(fm[widx])))
        mh_rms = db(np.sqrt(np.mean(music_hi[widx] ** 2)))
        over.append(pk - m_rms)
        over_hi.append(pk - mh_rms)
        c["_report"] = (err, pk, pk - m_rms, pk - m_pk, pk - mh_rms)
        tag = c["sound"] + (f"/{c['variant']}" if "variant" in c else "")
        tag += f" m{p['margin']:.1f}"
        print(f"  k={c['k']:2d} t={c['t']:6.3f} {tag:15s} peak at {j / SR:8.4f} s  err {err:+6.3f} ms  "
              f"peak {pk:6.1f} dBFS | vs music(+-100ms) RMS {pk - m_rms:+5.1f} dB, "
              f"peak {pk - m_pk:+5.1f} dB, >1kHz RMS {pk - mh_rms:+5.1f} dB")
    print(f"  max |cue error| = {max(errs):.3f} ms; sfx over local music RMS: min {min(over):+.1f} dB, "
          f"median {np.median(over):+.1f} dB; over music >1 kHz RMS: min {min(over_hi):+.1f} dB")
    print(f"  mix peak {db(np.max(np.abs(fx))):.2f} dBFS (limit -1.00), trim applied {db(trim):.2f} dB, "
          f"mix - (music+sfx) max {np.max(np.abs(qx.astype(int) - qm.astype(int) - qs.astype(int)))} LSB")


if __name__ == "__main__":
    main()
