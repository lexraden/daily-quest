#!/usr/bin/env node
// Loop and purity checks for a seekable page.
//
//   node loopcheck.mjs [page.html]          (default ../motion.html)
//
// 1. loop:   seek(0) vs seek(DURATION) on one page -> must be identical.
// 2. purity: seek(9.3) then seek(2.1) on page A vs seek(2.1) on a fresh page B.
// 3. repeat: seek(0) on page A (after other seeks) vs seek(0) on fresh page B.
// 4. sanity: seek(0) vs seek(DURATION/2) must differ (seek actually renders).
// Reports differing pixel count and max channel delta (0–255). On a failing
// check it writes an amplified diff image to ../out/loopcheck-<name>.png.
// Exit code 1 if any of checks 1–3 differ or 4 doesn't.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { PROMO, SIZE, FFMPEG, serve, launch, openPage, decodeRGB, diffRGB } from './lib.mjs';

const pageFile = path.resolve(process.argv[2] || path.join(PROMO, 'motion.html'));
const outDir = path.join(PROMO, 'out');

function writeDiff(name, a, b) {
  const d = Buffer.alloc(a.length);
  for (let i = 0; i < a.length; i++) d[i] = Math.min(255, Math.abs(a[i] - b[i]) * 16);
  fs.mkdirSync(outDir, { recursive: true });
  const file = path.join(outDir, `loopcheck-${name}.png`);
  return new Promise((resolve) => {
    const ff = spawn(FFMPEG, ['-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', `${SIZE}x${SIZE}`,
      '-i', 'pipe:0', file]);
    ff.on('close', () => resolve(file));
    ff.stdin.end(d);
  });
}

const server = await serve(pageFile);
const browser = await launch();
let bad = 0;
try {
  const A = await openPage(browser, server.url);
  const B = await openPage(browser, server.url);
  const { DURATION } = A.info;
  const at = async (P, ...ts) => { for (const t of ts) await P.seek(t); return decodeRGB(await P.shot('png')); };

  const checks = [
    ['loop', `seek(0) vs seek(${DURATION})`, () => at(A, 0), () => at(A, DURATION), true],
    ['purity', 'seek(9.3)→seek(2.1) vs fresh seek(2.1)', () => at(A, 9.3, 2.1), () => at(B, 2.1), true],
    ['repeat', 'seek(0) after others vs fresh page seek(0)', () => at(A, 0), async () => {
      const C = await openPage(browser, server.url); return at(C, 0);
    }, true],
    ['sanity', `seek(0) vs seek(${DURATION / 2}) (must differ)`, () => at(A, 0), () => at(A, DURATION / 2), false],
  ];
  console.log(`page ${pageFile}  (DURATION=${DURATION}, FPS=${A.info.FPS})`);
  for (const [name, label, fa, fb, mustMatch] of checks) {
    const a = await fa(), b = await fb();
    const { count, max } = diffRGB(a, b);
    const ok = mustMatch ? count === 0 : count > 0;
    if (!ok) bad++;
    let extra = '';
    if (mustMatch && count) extra = `  diff image: ${await writeDiff(name, a, b)}`;
    else fs.rmSync(path.join(outDir, `loopcheck-${name}.png`), { force: true });
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name.padEnd(7)} ${label.padEnd(46)} ` +
      `${String(count).padStart(8)} px differ (${(100 * count / (SIZE * SIZE)).toFixed(3)}%), max Δ ${max}${extra}`);
  }
  const errs = [...A.errors, ...B.errors];
  if (errs.length) { bad++; console.log(`FAIL  page errors:\n  ${errs.join('\n  ')}`); }
} catch (e) {
  console.error(e.stack || e);
  bad++;
} finally {
  await browser.close();
  await server.close();
}
process.exitCode = bad ? 1 : 0;
