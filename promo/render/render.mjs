#!/usr/bin/env node
// Render promo/motion.html (or any page with the same interface) to MP4 with
// 4-subframe motion blur. Frames are streamed straight into ffmpeg; nothing
// is written to disk except the final MP4.
//
//   node render.mjs [page.html] [out.mp4] [--workers N] [--format png|jpeg]
//                   [--quality Q] [--crf N] [--preset P] [--frames N]
//                   [--audio file.wav | --no-audio]
//
// Defaults: ../motion.html -> ../out/dailyq-promo.mp4, 4 pages in parallel,
// PNG (lossless, and measured faster than JPEG q95 via CDP), crf 16, preset
// slow, audio ../audio/mix.wav if it exists. --frames renders only the first
// N output frames (for benchmarking).
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { HERE, PROMO, FFMPEG, serve, launch, openPage, fmtTime } from './lib.mjs';

const SUB = 4; // subframes per output frame

const argv = process.argv.slice(2);
const pos = [], opt = {};
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a.startsWith('--')) {
    const [k, v] = a.slice(2).split('=');
    if (v !== undefined) opt[k] = v;
    else if (k === 'no-audio') opt[k] = true;
    else opt[k] = argv[++i];
  } else pos.push(a);
}
const pageFile = path.resolve(pos[0] || path.join(PROMO, 'motion.html'));
const outFile = path.resolve(pos[1] || path.join(PROMO, 'out', 'dailyq-promo.mp4'));
const workers = Math.max(1, parseInt(opt.workers ?? '4', 10));
const format = opt.format ?? 'png';
const quality = parseInt(opt.quality ?? '95', 10);
const crf = parseInt(opt.crf ?? '16', 10);
const preset = opt.preset ?? 'slow';
const audioFile = path.resolve(opt.audio ?? path.join(PROMO, 'audio', 'mix.wav'));
if (!['jpeg', 'png'].includes(format)) throw new Error('--format must be jpeg or png');
if (crf > 18) console.warn(`warning: CRF ${crf} > 18 is outside the spec`);

fs.mkdirSync(path.dirname(outFile), { recursive: true });

const t0 = Date.now();
const server = await serve(pageFile);
const browser = await launch();
let ff;
try {
  const pages = await Promise.all(Array.from({ length: workers }, () => openPage(browser, server.url)));
  const { DURATION, FPS } = pages[0].info;
  for (const p of pages) {
    if (p.info.DURATION !== DURATION || p.info.FPS !== FPS) throw new Error('pages disagree on DURATION/FPS');
  }
  if (!(DURATION > 0) || !(FPS > 0)) throw new Error(`page must set window.DURATION and window.FPS (got ${DURATION}, ${FPS})`);
  if (DURATION !== 14 || FPS !== 60) console.warn(`warning: page says DURATION=${DURATION} FPS=${FPS} (spec: 14, 60)`);
  const totalFrames = Math.round(DURATION * FPS);
  const nFrames = opt.frames ? Math.min(totalFrames, parseInt(opt.frames, 10)) : totalFrames;
  const nSub = nFrames * SUB;
  const useAudio = !opt['no-audio'] && fs.existsSync(audioFile);
  if (opt.audio && !useAudio) throw new Error(`audio file not found: ${audioFile}`);
  const outDuration = nFrames / FPS;

  // ffmpeg: 4·FPS subframes in -> tmix averages each frame with the 3 before
  // it -> keep every 4th (n = 3, 7, 11, ...), i.e. exactly the mean of
  // subframes 4f..4f+3 -> retime to FPS. Blending is done in planar RGB, then
  // converted once to BT.709 limited-range yuv420p.
  const vf = [
    'format=gbrp',
    `tmix=frames=${SUB}:weights=${Array(SUB).fill(1).join(' ')}:scale=0`,
    `select='eq(mod(n\\,${SUB})\\,${SUB - 1})'`,
    `setpts=N/(${FPS}*TB)`,
    'scale=out_color_matrix=bt709:out_range=tv:flags=accurate_rnd+full_chroma_int',
    'format=yuv420p',
  ].join(',');
  const args = [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-f', 'image2pipe', '-framerate', String(FPS * SUB), '-c:v', format === 'png' ? 'png' : 'mjpeg', '-i', 'pipe:0',
    ...(useAudio ? ['-i', audioFile] : []),
    '-vf', vf,
    '-map', '0:v:0', ...(useAudio ? ['-map', '1:a:0'] : []),
    '-c:v', 'libx264', '-preset', preset, '-crf', String(crf), '-pix_fmt', 'yuv420p',
    '-profile:v', 'high', '-r', String(FPS), '-fps_mode', 'cfr',
    '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
    ...(useAudio ? ['-c:a', 'aac', '-b:a', '256k', '-ar', '48000'] : []),
    '-t', outDuration.toFixed(6),
    '-movflags', '+faststart',
    outFile,
  ];
  ff = spawn(FFMPEG, args, { stdio: ['pipe', 'inherit', 'pipe'] });
  let ffErr = '';
  ff.stderr.on('data', (d) => { ffErr += d; process.stderr.write(d); });
  const ffDone = new Promise((resolve, reject) => {
    ff.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}\n${ffErr}`))));
  });
  ffDone.catch(() => {}); // awaited below; avoid unhandled rejection on early abort
  ff.stdin.on('error', () => {}); // surfaced through ffDone

  console.log(`page   ${path.relative(process.cwd(), pageFile) || pageFile}`);
  console.log(`out    ${outFile}`);
  console.log(`frames ${nFrames} × ${SUB} subframes = ${nSub} captures, ${workers} page(s), ${format}${format === 'jpeg' ? ' q' + quality : ''}, crf ${crf}/${preset}, audio: ${useAudio ? path.basename(audioFile) : 'none'}`);

  // Subframes are handed out in order to the workers; results are buffered
  // and written to ffmpeg strictly in order. Workers may run at most WINDOW
  // captures ahead of the writer. Order of seek() calls per page doesn't
  // matter since seek(t) is a pure function of t.
  const WINDOW = workers * 4;
  const done = new Map();
  let next = 0, written = 0, failed = null;
  const waiters = new Set();
  const waitWriter = () => new Promise((r) => waiters.add(r));
  const wakeAll = () => { for (const r of waiters) r(); waiters.clear(); };
  let captureMs = 0, lastLog = 0;
  const tStart = Date.now();

  function progress(force) {
    const now = Date.now();
    if (!force && now - lastLog < 1000) return;
    lastLog = now;
    const el = (now - tStart) / 1000;
    const rate = written / el;
    const eta = rate > 0 ? (nSub - written) / rate : 0;
    process.stdout.write(`\r  frame ${String(Math.floor(written / SUB)).padStart(4)}/${nFrames}  ` +
      `${(100 * written / nSub).toFixed(1).padStart(5)}%  ${rate.toFixed(1)} sub/s  ` +
      `elapsed ${fmtTime(el)}  ETA ${fmtTime(eta)}   `);
  }

  // Single writer chain: drains finished subframes in index order.
  let writing = Promise.resolve();
  function flush() {
    writing = writing.then(async () => {
      while (done.has(written)) {
        const buf = done.get(written);
        done.delete(written);
        if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
        written++;
        progress(false);
      }
      wakeAll();
    });
    return writing;
  }

  async function worker(p) {
    for (;;) {
      if (failed) return;
      if (next >= nSub) return;
      if (next - written >= WINDOW) { await waitWriter(); continue; }
      const i = next++;
      const f = Math.floor(i / SUB), s = i % SUB;
      const t = (f + s / SUB) / FPS;
      const c0 = performance.now();
      await p.seek(t);
      const buf = await p.shot(format, quality);
      captureMs += performance.now() - c0;
      if (p.errors.length) throw new Error(`page errors at t=${t}:\n  ${p.errors.join('\n  ')}`);
      done.set(i, buf);
      flush();
    }
  }
  await Promise.all(pages.map((p) => worker(p).catch((e) => { failed = e; wakeAll(); throw e; })));
  await flush();
  progress(true);
  process.stdout.write('\n');
  ff.stdin.end();
  await ffDone;

  const wall = (Date.now() - t0) / 1000;
  const capWall = (Date.now() - tStart) / 1000;
  const size = fs.statSync(outFile).size;
  console.log(`done   ${outFile} (${(size / 1e6).toFixed(1)} MB)`);
  console.log(`time   total ${wall.toFixed(1)} s (capture+encode ${capWall.toFixed(1)} s); ` +
    `${(1000 * capWall / nSub).toFixed(1)} ms/subframe wall, ${(captureMs / nSub).toFixed(1)} ms/subframe per page (seek+screenshot)`);
} catch (e) {
  ff?.stdin.destroy();
  ff?.kill('SIGKILL');
  console.error('\n' + (e.stack || e));
  process.exitCode = 1;
} finally {
  await browser.close();
  await server.close();
}
