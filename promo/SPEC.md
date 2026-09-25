# DailyQ promo — the shared contract

One continuous shape morphing through DailyQ's own UI, driven by a cursor, cut
to a 120 BPM track, 1440×1440, 60 fps, 14.0 s, seamless loop.

Three pieces are built in parallel and meet at the interfaces below. **Change
none of these without saying so in your report** — the others are building
against them right now.

| Piece | Owner | Files |
|---|---|---|
| Motion | motion agent | `promo/motion.html`, `promo/fonts/*` |
| Audio | audio agent | `promo/audio/*` |
| Render | render agent | `promo/render/*`, `promo/out/*` |

## Timing

- 120 BPM → one beat = **0.500 s**. 7 bars × 4 beats = **28 beats = 14.000 s**.
- Beat `k` is at `t = 0.5·k`, `k = 0…27`. Downbeats are `k % 4 == 0`.
- **Something happens on every beat.** A click's press lands exactly on its beat;
  the morph it triggers starts on that beat.
- **Loop:** `seek(14.0)` must render identically to `seek(0)` — shape, content,
  camera, and the cursor's position *and velocity*.

## Look

- Canvas: warm light gray `#ECEAE6`. Components: ink `#0B0B0C` and white
  `#FFFFFF`. Secondary text `#8A8782`. **One accent:** DailyQ violet `#7C5CFA`.
- Font: **Geist** only (`npm i geist`, use its woff2). Tabular figures only
  where digits change in place (timers, counters).
- Icons: one stroke width everywhere (1.75 px at 1× zoom), round caps.
- Banned: bouncy easing, particle bursts, glows, gradients on UI chrome,
  mismatched icon strokes, dead time, anything that looks like a template.

## The states, on the beat grid

Each row is one beat. "→" is a morph of the single shape.

| k | t | State / event | Cue (sound) |
|---|---|---|---|
| 0 | 0.0 | Black pill button **"Start today's quests"**; cursor resting near it | — |
| 1 | 0.5 | Click → pill contracts to a circle → **loader** (arc spinner) | `click` |
| 2 | 1.0 | Loader → **check** (accent circle, check stroke draws) | `success` |
| 3 | 1.5 | Check → **"+3 XP"** pill, digits roll 0→3 | `tick` |
| 4 | 2.0 | → **dynamic island** (black capsule) "🔥 7-day streak" | `morph` |
| 5 | 2.5 | Island expands → white **quest card**: empty checkbox, "Bike 30 min", Health tag | `morph` |
| 6 | 3.0 | Cursor clicks the checkbox → fills accent, title strikes through | `click` |
| 7 | 3.5 | Card → **XP bar** "Level 4 → 5", fill runs to the end | `rise` |
| 8 | 4.0 | Bar → round black **mic button** | `morph` |
| 9 | 4.5 | Click → **recording pill**: live waveform + `0:03` timer | `click` |
| 10 | 5.0 | Still recording (waveform keeps moving — this beat is the listening) | `tick` |
| 11 | 5.5 | Click stop → **transcript chip** "Ran 5 km → Health ✓" | `click` |
| 12 | 6.0 | → **meal card** "Shawarma · 650 kcal" | `morph` |
| 13 | 6.5 | Macro bars grow: P / F / C | `tick` |
| 14 | 7.0 | Cursor grabs the **portion slider**, drags 1× → 2×, kcal counts 650→1300; drag past max stretches the track | `grab` |
| 15 | 7.5 | Release → springs back to 2× from wherever it was | `snap` |
| 16 | 8.0 | → **toggle** "Reminders" flips on, on the beat; knob stretches in travel | `toggle` |
| 17 | 8.5 | Knob becomes the **liquid tab indicator**: Day · Week · Month | `morph` |
| 18 | 9.0 | Click **Week** → indicator travels, leading edge ahead of trailing | `click` |
| 19 | 9.5 | Tabs open into a **chart**: 7 bars draw themselves | `rise` |
| 20 | 10.0 | Cursor hovers a bar → **tooltip** "Wed · 6 quests" | `hover` |
| 21 | 10.5 | Chart collapses → **push banner** "DailyQ — your 7-day streak burns tonight" | `notify` |
| 22 | 11.0 | → **Telegram bubble** "@dailyqappbot · One quest keeps it 🔥" | `notify` |
| 23 | 11.5 | → **email row** "Inbox · DailyQ · Your evening reminder" | `notify` |
| 24 | 12.0 | → **⌘K palette**, empty field, 4 commands | `morph` |
| 25 | 12.5 | Type **"log"** (keys at 12.50, 12.62, 12.74) → list filters to "Log a meal" | `key` ×3 |
| 26 | 13.0 | Enter → **toast** "Meal logged" | `enter` |
| 27 | 13.5 | Toast → back to the **button** of beat 0; cursor returns to its beat-0 spot | `morph` |

Beats 21–23 show the three reminder channels the app actually has.

## Interface: `promo/motion.html`

- A single self-contained HTML page (fonts from `promo/fonts/`), viewport
  **1440×1440**, `body { margin: 0 }`.
- `window.DURATION = 14` and `window.FPS = 60`.
- `window.ready`: a Promise that resolves once fonts are loaded and the first
  frame can be drawn.
- `window.seek(t)`: synchronously renders the frame at time `t` seconds,
  `0 ≤ t ≤ 14`. **A pure function of `t`** — no CSS transitions or animations,
  no timers, no requestAnimationFrame, no state carried between calls. Calling
  `seek(9.3)` then `seek(2.1)` must give the same frame as calling `seek(2.1)`
  alone.
- Nothing may depend on real time or on the order of `seek` calls.

## Interface: `promo/audio/`

- `music.wav` — 48 kHz stereo 16-bit, exactly 14.000 s, 120 BPM, a downbeat at
  t = 0, loops seamlessly (reverb and delay tails wrapped, not cut).
- `sfx.wav` — the UI sounds from the Cue column, each placed so its **measured
  peak** lands on its event time. Same format and length.
- `mix.wav` — music + sfx, no sample above −1 dBFS.
- `cues.json` — `[{ "t": 0.5, "k": 1, "sound": "click" }, …]`, the times used.
- `beats.json` — beat times as *measured* by onset analysis of `music.wav`,
  plus the downbeat index, so the grid is checked rather than assumed.

## Interface: `promo/render/`

- `render.mjs` — Playwright Chromium at 1440×1440, `deviceScaleFactor: 1`.
  Await `window.ready`; for each output frame `f`, capture **4 subframes** at
  `t = (f + s/4) / 60`, `s = 0…3`, and **pipe** them to ffmpeg (no PNG
  sequence on disk — it would be ~1.3 GB). ffmpeg blends each group of 4 with
  `tmix=frames=4` and outputs 60 fps H.264 (`yuv420p`, CRF ≤ 18), muxing
  `promo/audio/mix.wav` when present.
- `beats.mjs` — renders **one frame per beat** (28) into a single contact sheet
  PNG for review, labelled with the beat number.
- A loop check: the pixel difference between `seek(0)` and `seek(14)` must be
  zero (or report the largest).
- Output: `promo/out/dailyq-promo.mp4`.
- ffmpeg is at `/usr/local/bin/ffmpeg` (7.0.2, has tmix, amix, libx264, aac).
