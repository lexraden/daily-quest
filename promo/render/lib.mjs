// Shared helpers for render.mjs, beats.mjs and loopcheck.mjs.
import { createRequire } from 'node:module';
import { execSync, spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const HERE = path.dirname(fileURLToPath(import.meta.url));
export const PROMO = path.resolve(HERE, '..');
export const FFMPEG = process.env.FFMPEG || '/usr/local/bin/ffmpeg';
export const CHROMIUM = process.env.CHROMIUM || '/opt/pw-browsers/chromium';
export const SIZE = 1440;

// Playwright is installed globally here, not in the repo, so a bare
// `import 'playwright'` may fail. Try local resolution first, then global.
export async function loadPlaywright() {
  try {
    return await import('playwright');
  } catch {
    const roots = ['/opt/node22/lib/node_modules'];
    try { roots.unshift(execSync('npm root -g', { encoding: 'utf8' }).trim()); } catch {}
    for (const root of roots) {
      try {
        return createRequire(path.join(root, 'noop.js'))('playwright');
      } catch {}
    }
    throw new Error('playwright not found (tried local and global node_modules)');
  }
}

// Serve files over http://127.0.0.1 so @font-face and other relative loads
// behave like a normal site (file:// fonts can be blocked as cross-origin).
// Root is the nearest ancestor of the page with .git or package.json, so
// relative paths like ../node_modules/... also resolve.
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.otf': 'font/otf',
  '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.mp4': 'video/mp4',
};

function findRoot(dir) {
  for (let d = dir; ; d = path.dirname(d)) {
    if (fs.existsSync(path.join(d, '.git')) || fs.existsSync(path.join(d, 'package.json'))) return d;
    if (path.dirname(d) === d) return dir;
  }
}

export async function serve(pageFile) {
  const abs = path.resolve(pageFile);
  if (!fs.existsSync(abs)) throw new Error(`page not found: ${abs}`);
  const root = findRoot(path.dirname(abs));
  const server = http.createServer((req, res) => {
    if (req.url === '/favicon.ico') { res.writeHead(204).end(); return; }
    const p = path.normalize(path.join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname)));
    if (!p.startsWith(root)) { res.writeHead(403).end(); return; }
    fs.readFile(p, (err, data) => {
      if (err) { res.writeHead(404).end(); return; }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(p).toLowerCase()] || 'application/octet-stream',
                           'Cache-Control': 'no-store' });
      res.end(data);
    });
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${server.address().port}/${path.relative(root, abs).split(path.sep).map(encodeURIComponent).join('/')}`;
  return { url, close: () => new Promise((r) => server.close(r)) };
}

export async function launch() {
  const { chromium } = await loadPlaywright();
  return chromium.launch({
    executablePath: CHROMIUM,
    args: [
      '--force-color-profile=srgb',   // no display-profile colour conversion
      '--font-render-hinting=none',
      '--disable-lcd-text',
      '--hide-scrollbars',
      '--mute-audio',
    ],
  });
}

// Opens the page in its own context, waits for window.ready, and returns
// { page, seek(t), shot(fmt, quality) -> Buffer, info }.
export async function openPage(browser, url, { onError } = {}) {
  const context = await browser.newContext({
    viewport: { width: SIZE, height: SIZE }, deviceScaleFactor: 1,
    reducedMotion: 'no-preference', colorScheme: 'light',
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => { errors.push(String(e)); onError?.(e); });
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('requestfailed', (r) => errors.push(`request failed: ${r.url()}`));
  page.on('response', (r) => { if (r.status() >= 400) errors.push(`HTTP ${r.status()}: ${r.url()}`); });
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForFunction(() => window.ready && typeof window.seek === 'function', null, { timeout: 30000 });
  await page.evaluate(() => window.ready);
  const info = await page.evaluate(() => ({ DURATION: window.DURATION, FPS: window.FPS,
    w: window.innerWidth, h: window.innerHeight, dpr: window.devicePixelRatio }));
  if (info.w !== SIZE || info.h !== SIZE || info.dpr !== 1) throw new Error(`bad viewport ${JSON.stringify(info)}`);
  const cdp = await context.newCDPSession(page);

  async function seek(t) {
    const r = await cdp.send('Runtime.evaluate', { expression: `window.seek(${t}); 0`, returnByValue: true });
    if (r.exceptionDetails) {
      throw new Error(`seek(${t}) threw: ${r.exceptionDetails.exception?.description || r.exceptionDetails.text}`);
    }
  }
  // CDP screenshot of the viewport: a fresh composited frame, so DOM changes
  // made by the preceding seek() are always included.
  async function shot(format = 'png', quality = 95) {
    const opts = { format, fromSurface: true, captureBeyondViewport: false, optimizeForSpeed: true };
    if (format === 'jpeg') opts.quality = quality;
    const { data } = await cdp.send('Page.captureScreenshot', opts);
    return Buffer.from(data, 'base64');
  }
  return { page, context, seek, shot, info, errors };
}

// Decode an image (PNG/JPEG buffer) to raw rgb24 via ffmpeg.
export function decodeRGB(buf) {
  return new Promise((resolve, reject) => {
    const ff = spawn(FFMPEG, ['-v', 'error', '-i', 'pipe:0', '-f', 'rawvideo', '-pix_fmt', 'rgb24', 'pipe:1']);
    const out = [];
    let err = '';
    ff.stdout.on('data', (d) => out.push(d));
    ff.stderr.on('data', (d) => (err += d));
    ff.on('close', (code) => (code === 0 ? resolve(Buffer.concat(out)) : reject(new Error(err))));
    ff.stdin.end(buf);
  });
}

export function diffRGB(a, b) {
  if (a.length !== b.length) throw new Error('size mismatch');
  let count = 0, max = 0;
  for (let i = 0; i < a.length; i += 3) {
    const d = Math.max(Math.abs(a[i] - b[i]), Math.abs(a[i + 1] - b[i + 1]), Math.abs(a[i + 2] - b[i + 2]));
    if (d) { count++; if (d > max) max = d; }
  }
  return { count, max };
}

export const fmtTime = (s) => {
  s = Math.max(0, Math.round(s));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
