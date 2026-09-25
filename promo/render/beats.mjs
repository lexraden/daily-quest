#!/usr/bin/env node
// Contact sheet: one frame per beat (t = 0.5·k, k = 0…27), no motion blur,
// tiled 7×4 with the beat number, time and the SPEC state name.
//
//   node beats.mjs [page.html] [out.png] [--tile 360]
// Defaults: ../motion.html -> ./beats.png
import fs from 'node:fs';
import path from 'node:path';
import { HERE, PROMO, SIZE, serve, launch, openPage } from './lib.mjs';

const argv = process.argv.slice(2);
const pos = argv.filter((a, i) => !a.startsWith('--') && !(argv[i - 1] || '').startsWith('--'));
const tileArg = argv.indexOf('--tile');
const TILE = tileArg >= 0 ? parseInt(argv[tileArg + 1], 10) : 360;
const pageFile = path.resolve(pos[0] || path.join(PROMO, 'motion.html'));
const outFile = path.resolve(pos[1] || path.join(HERE, 'beats.png'));

const BEAT = 0.5, COLS = 7, ROWS = 4, N = COLS * ROWS;
// State names from SPEC.md, for the labels.
const STATES = [
  'Start button', 'Click → loader', 'Loader → check', '+3 XP', 'Island · streak', 'Quest card',
  'Checkbox click', 'XP bar', 'Mic button', 'Recording', 'Still recording', 'Transcript chip',
  'Meal card', 'Macro bars', 'Portion drag', 'Release · snap', 'Toggle on', 'Tab indicator',
  'Click Week', 'Chart', 'Tooltip', 'Push banner', 'Telegram', 'Email row', '⌘K palette',
  'Type "log"', 'Toast', '→ Button',
];

const server = await serve(pageFile);
const browser = await launch();
try {
  const p = await openPage(browser, server.url);
  const shots = [];
  for (let k = 0; k < N; k++) {
    await p.seek(k * BEAT);
    shots.push((await p.shot('png')).toString('base64'));
    if (p.errors.length) throw new Error(`page errors at t=${k * BEAT}:\n  ${p.errors.join('\n  ')}`);
  }

  // Compose in a blank page with a canvas.
  const LABEL = Math.round(TILE * 0.11), GAP = 6;
  const W = COLS * TILE + (COLS + 1) * GAP, H = ROWS * (TILE + LABEL) + (ROWS + 1) * GAP;
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  const sheet = await ctx.newPage();
  await sheet.setContent(`<body style="margin:0"><canvas id="c" width="${W}" height="${H}"></canvas></body>`);
  const png = await sheet.evaluate(async ({ shots, STATES, TILE, LABEL, GAP, COLS, W, H, BEAT }) => {
    const c = document.getElementById('c'), g = c.getContext('2d');
    g.fillStyle = '#1b1b1d'; g.fillRect(0, 0, W, H);
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    for (let k = 0; k < shots.length; k++) {
      const img = new Image();
      img.src = 'data:image/png;base64,' + shots[k];
      await img.decode();
      const x = GAP + (k % COLS) * (TILE + GAP), y = GAP + Math.floor(k / COLS) * (TILE + LABEL + GAP);
      g.drawImage(img, x, y, TILE, TILE);
      const down = k % 4 === 0;
      g.fillStyle = down ? '#7C5CFA' : '#2c2c30';
      g.fillRect(x, y + TILE, TILE, LABEL);
      g.fillStyle = '#fff';
      g.textBaseline = 'middle';
      g.font = `bold ${Math.round(LABEL * 0.5)}px sans-serif`;
      const head = `${String(k).padStart(2, '0')}  ${(k * BEAT).toFixed(1)}s`;
      g.fillText(head, x + 8, y + TILE + LABEL / 2);
      const hw = g.measureText(head + '   ').width;
      g.font = `${Math.round(LABEL * 0.42)}px sans-serif`;
      g.fillText(STATES[k] || '', x + 8 + hw, y + TILE + LABEL / 2, TILE - hw - 14);
    }
    return c.toDataURL('image/png').split(',')[1];
  }, { shots, STATES, TILE, LABEL, GAP, COLS, W, H, BEAT });
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, Buffer.from(png, 'base64'));
  console.log(`wrote ${outFile} (${W}×${H}, ${N} beats, tiles ${TILE}px from ${SIZE}px frames)`);
} catch (e) {
  console.error(e.stack || e);
  process.exitCode = 1;
} finally {
  await browser.close();
  await server.close();
}
