# promo/render

Renders `promo/motion.html` (interface in `../SPEC.md`) to video. The scripts use Playwright Chromium
(`/opt/pw-browsers/chromium`, override with `CHROMIUM=`) and ffmpeg (`/usr/local/bin/ffmpeg`, override
with `FFMPEG=`). Playwright is resolved locally first, then from the global `npm root -g`. Pages are
served over a throwaway `http://127.0.0.1` server so that fonts load the way they would on a site.

Run every script from this directory. Each takes an optional page path, which defaults to `../motion.html`.

```sh
node render.mjs    [page.html] [out.mp4]   # default ../motion.html -> ../out/dailyq-promo.mp4
node beats.mjs     [page.html] [out.png]   # default -> ./beats.png  (28 beats, 7×4, labelled)
node loopcheck.mjs [page.html]             # exit 1 on failure; diff images go to ../out/loopcheck-*.png

# pipeline test page
node render.mjs stub.html ../out/stub.mp4
node beats.mjs stub.html
node loopcheck.mjs stub.html
```

## render.mjs

Each output frame `f` gets 4 subframes, captured at `t = (f + s/4)/FPS` for `s = 0…3`, using CDP
`Page.captureScreenshot`. The PNGs are piped to ffmpeg, so nothing is written to disk.

- **Blend:** ffmpeg runs `tmix=frames=4` in planar RGB, then keeps every 4th frame with
  `select`. Each output frame is exactly `round(mean)` of its own 4 subframes; this was checked
  byte for byte.
- **Encode:** H.264 High, yuv420p (BT.709, tv range), CRF 16, preset slow, `+faststart`.
- **Audio:** `../audio/mix.wav` is muxed as AAC 256k and trimmed to the video length, if the file exists.

Options:

- `--workers N` (4): pages rendering in parallel. Output is byte-identical for any N.
- `--format png|jpeg` (png)
- `--quality Q` (95, JPEG only)
- `--crf N` (16)
- `--preset P` (slow)
- `--frames N`: render only the first N frames, for timing.
- `--audio file.wav` or `--no-audio`

Measured on the stub, on 4 cores:

| Setting | Result |
|---|---|
| CDP PNG capture | 43 ms per shot (lossless, about 124 KB) |
| CDP JPEG q95 capture | 51 ms per shot (lossy) |
| Playwright `page.screenshot` | 72 ms per shot |
| 1 → 2 → 4 pages | 57 → 41 → 34 ms per subframe, wall time |
| Full stub, 3360 subframes | 105 s, about 31 ms per subframe |

PNG is the default because it is both faster and lossless.

## stub.html

A test page with the same interface as motion.html. It has:

- a bar that sweeps the full width every beat. At 12 px per subframe, it shows up as 4 ghosts
  when blur works.
- an orbiting disc.
- a frame counter, quantised per output frame so it stays readable after blending.
- a flash on every beat, violet on downbeats.

Everything in the page is a function of `t mod 14`, so `seek(0)` and `seek(14)` are identical.
