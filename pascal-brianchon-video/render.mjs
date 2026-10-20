#!/usr/bin/env node
// Deterministic frame renderer: serves this folder, opens index.html in headless Chromium (Playwright),
// calls window.renderAt(t) for every frame and pipes the canvas pixels into ffmpeg (stills: PNG screenshots). Then muxes the mastered audio.
// Usage:
//   node render.mjs stills 0.5,2.3,4.4 [--scale 0.5]       -> out/stills/t_XX.XXX.png
//   node render.mjs video [--from 0 --to 47.6] [--workers 3] -> out/video_silent.mp4 (+ out/video.mp4 when out/audio_master.wav exists)
//   node render.mjs video --from 30 --to 34.1 --prefix patchA_ --segonly -> lossless out/patchA_*.mkv only (see tools/splice.sh)
//   … --lossless utvideo   segments as UT Video RGB (5x faster to encode / decode than FFV1, ~1.8x bigger; see tools/chunks.sh)
//   … --shot               old capture path (PNG screenshots, ~3x slower; pixel-identical)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const mode = args[0] || 'stills';
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.ttf': 'font/ttf', '.css': 'text/css' };

function serve() {
  return new Promise((res) => {
    const srv = http.createServer((req, rsp) => {
      const u = new URL(req.url, 'http://x');
      const p = path.join(ROOT, decodeURIComponent(u.pathname));
      if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { rsp.writeHead(404); return rsp.end(); }
      rsp.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      fs.createReadStream(p).pipe(rsp);
    });
    srv.listen(0, '127.0.0.1', () => res(srv));
  });
}

async function openPage(browser, port, scale) {
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: scale });
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('[page]', m.text()); });
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  await page.goto(`http://127.0.0.1:${port}/${opt('page', 'index.html')}`);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 60000 });
  return page;
}
const shot = (page) => page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: 1080, height: 1920 }, optimizeForSpeed: true });
// video: read the canvas itself — it is opaque and 1:1 with the viewport, so getImageData() gives exactly the screenshot's
// pixels (checked frame by frame) without the compositor readback + PNG encode that make page.screenshot() ~3x slower
async function armGrab(page) {
  await page.evaluate(() => {
    const cv = document.querySelector('canvas'), x = cv.getContext('2d'), rgb = new Uint8Array(cv.width * cv.height * 3);
    const b64 = rgb.toBase64 ? (u) => u.toBase64()
      : (u) => { let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); };
    window.__grab = async (t) => {
      await window.renderAt(t);
      const d = x.getImageData(0, 0, cv.width, cv.height).data;
      for (let i = 0, j = 0; i < d.length; i += 4, j += 3) { rgb[j] = d[i]; rgb[j + 1] = d[i + 1]; rgb[j + 2] = d[i + 2]; }
      return b64(rgb);
    };
  });
}
const grab = async (page, t) => Buffer.from(await page.evaluate((t) => window.__grab(t), t), 'base64');

function ffmpeg(a) {
  const p = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...a], { stdio: ['pipe', 'inherit', 'inherit'] });
  return { p, done: new Promise((r, j) => p.on('close', (c) => (c === 0 ? r() : j(new Error('ffmpeg ' + c))))) };
}

(async () => {
  const srv = await serve();
  const port = srv.address().port;
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/usr/local/bin/chromium', headless: true, args: ['--disable-gpu', '--force-color-profile=srgb', '--font-render-hinting=none', '--no-sandbox'] });
  const scale = parseFloat(opt('scale', '1'));
  try {
    if (mode === 'stills') {
      const ts = (args[1] || '0').split(',').map(Number);
      const dir = path.join(ROOT, 'out', opt('dir', 'stills')); fs.mkdirSync(dir, { recursive: true });
      const page = await openPage(browser, port, scale);
      if (opt('cam', null)) await page.evaluate((c) => { window.__CAMO = JSON.parse(c); }, opt('cam', null));
      for (const t of ts) {
        const t0 = Date.now();
        await page.evaluate((t) => window.renderAt(t), t);
        fs.writeFileSync(path.join(dir, `t_${t.toFixed(3)}.png`), await shot(page));
        console.log('still', t, (Date.now() - t0) + 'ms');
      }
      await page.close();
    } else {
      const FPS = 30, DUR = parseFloat(opt('dur', String((await import('./js/scene.js')).DUR)));   // default: the film length from js/scene.js
      const from = parseFloat(opt('from', '0')), to = parseFloat(opt('to', String(DUR)));
      const f0 = Math.round(from * FPS), f1 = Math.round(to * FPS);
      const workers = parseInt(opt('workers', '2'));
      const outDir = path.join(ROOT, 'out'); fs.mkdirSync(outDir, { recursive: true });
      const segs = [];
      const per = Math.ceil((f1 - f0) / workers);
      const t0 = Date.now();
      await Promise.all(Array.from({ length: workers }, async (_, w) => {
        const a = f0 + w * per, b = Math.min(f1, a + per);
        if (a >= b) return;
        const seg = path.join(outDir, `${opt('prefix', 'seg_')}${w}.mkv`); segs[w] = seg;
        const useShot = args.includes('--shot');
        const codec = opt('lossless', 'ffv1') === 'utvideo' ? ['-c:v', 'utvideo', '-pix_fmt', 'gbrp', '-pred', 'median'] : ['-c:v', 'ffv1', '-level', '3', '-pix_fmt', 'yuv444p'];
        const ff = ffmpeg([...(useShot ? ['-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png'] : ['-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', '1080x1920', '-framerate', String(FPS)]),
          '-i', '-', ...codec, seg]);
        const page = await openPage(browser, port, 1);
        if (!useShot) await armGrab(page);
        for (let f = a; f < b; f++) {
          let buf;
          if (useShot) { await page.evaluate((t) => window.renderAt(t), f / FPS); buf = await shot(page); }
          else { buf = await grab(page, f / FPS); if (buf.length !== 1080 * 1920 * 3) throw new Error(`frame ${f}: ${buf.length} bytes`); }
          if (!ff.p.stdin.write(buf)) await new Promise((r) => ff.p.stdin.once('drain', r));
          if ((f - a) % 60 === 0) console.log(`w${w} frame ${f} / ${b}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
        }
        ff.p.stdin.end(); await ff.done; await page.close();
      }));
      if (args.includes('--segonly')) { console.log('segments', segs.filter(Boolean).join(' ')); return; }
      const list = path.join(outDir, 'segs.txt');
      fs.writeFileSync(list, segs.filter(Boolean).map((s) => `file '${s}'`).join('\n'));
      const silent = path.join(outDir, 'video_silent.mp4');
      await ffmpeg(['-f', 'concat', '-safe', '0', '-i', list, '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-movflags', '+faststart', '-r', String(FPS), silent]).done;
      const audio = path.join(outDir, 'audio_master.wav');
      if (fs.existsSync(audio)) {
        await ffmpeg(['-i', silent, '-i', audio, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '256k', '-ar', '48000', '-shortest', '-movflags', '+faststart', path.join(outDir, 'video.mp4')]).done;
      }
      console.log('done', ((Date.now() - t0) / 1000).toFixed(1) + 's');
    }
  } finally { await browser.close(); srv.close(); }
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
