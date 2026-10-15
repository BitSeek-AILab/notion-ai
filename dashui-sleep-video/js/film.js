// 大睡理论 · 睡眠科普 — 45.5 s vertical (1080×1920 @30fps) frame-by-frame hand-drawn (cel-boil) film.
// Every frame is a pure function of t. Cue grid is locked to the music (112.9 BPM, first beat 0.082 s).
// Shape is the story: phone → pillow → cloud → “?” → clock → brain (+mug → moon) → bath → progress bar → sleep-cycle line
// → shield → shards → battery → pillow → gauge → week bars → phone.
import { PAL, hs, clamp, lerp, E, K, spline, resample, xf, boil, inkStroke, inkLoop, fillShape, fillPoly,
  circlePts, ellPts, rrectPts, prefix, arclen, toN, pathPts, onN, outline, signedArea, centroid } from './engine.js';
import { loadGlyphs, letters, measure, popIn, flyOut } from './text.js';
import { REG, T, sub, memo, seedOf, inked, dot, drawFace, mixHex, mixHue, drawCrown, drawCheckbox, drawApprox, drawArrow,
  phoneDense, drawPhone, pillowDense, drawPillow, cloudDense, moonDense, drawMoon, mugDense, drawMug, tubDense, drawTub, drawTubBack, drawDuck,
  drawJunk, shieldDense, drawShield, SHARDS, drawVirus, BATT, batteryDense, drawBattery, drawSun, drawNightcap, brainDense, drawBrain,
  drawClock, gaugeDense, gaugeAng, drawGauge } from './shapes.js';
import { twinkle, starBurst, speedLines, splash, ripple, puff, bubble, flood } from './fx.js';

export const W = 1080, H = 1920, FPS = 30, DUR = 45.5;
export const BPM = 112.9, PH = 0.082, BEAT = 60 / BPM;
export const bt = (n) => PH + n * BEAT;
export const bar = (k) => bt(4 * k);
const B = Array.from({ length: 24 }, (_, k) => bar(k));
const E8 = BEAT / 2;

let c = null;
const IMG = {};
const loadImg = (src) => new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = src; });
export async function init(canvas) {
  canvas.width = W; canvas.height = H;
  c = canvas.getContext('2d');
  await loadGlyphs('./assets/glyphs.json');
  IMG.paper = await loadImg('./assets/paper_base.jpg');
  IMG.night = await loadImg('./assets/paper_night.jpg');
  IMG.tooth = await loadImg('./assets/paper_tooth.png');
}

// ------------------------------------------------------------------ helpers
const pulse = (t, t0, k = 9) => (t < t0 ? 0 : Math.exp(-(t - t0) * k));
function beatPulse(t, beats, k = 9) { let p = 0; for (const b of beats) p = Math.max(p, pulse(t, b, k)); return p; }
function shakeAt(t, hits) {
  let x = 0, y = 0;
  for (const [t0, a] of hits) {
    const u = t - t0;
    if (u < 0 || u > 0.35) continue;
    const e = a * Math.exp(-u * 14), f = Math.floor(t * FPS);
    x += e * (hs(f, 1) - 0.5) * 2; y += e * (hs(f, 2) - 0.5) * 2;
  }
  return { x, y };
}
const appear = (t, t0, d = 0.25, s = 2.2) => (t < t0 ? 0 : E.outBack(clamp((t - t0) / d), s));
const vanish = (t, t0, d = 0.16) => 1 - E.in2(clamp((t - t0) / d));
// text in/out: pop in at tIn (stagger), shrink out at tOut
function say(str, t, tIn, tOut, o = {}) {
  if (t < tIn || t >= tOut + 0.2) return null;
  const inA = popIn(t, tIn, o.st ?? 0.05, o.dur ?? 0.26, { rot: o.rot ?? 0.25, drop: o.drop ?? 0, seed: o.seed ?? 3 });
  const anim = (i, n) => {
    const a = inA(i, n);
    if (t >= tOut) { const u = clamp((t - tOut - (n - 1 - i) * 0.015) / 0.12); a.s = (a.s ?? 1) * (1 - E.in2(u)); a.dy = (a.dy ?? 0) - 30 * u; }
    if (o.color && o.color[i]) a.fill = o.color[i];
    return a;
  };
  return letters(c, str, { ...o, anim, D: o.D });
}
// marker swash under a word (drawn on), drawn BEHIND the letters
function swash(x0, x1, y, u, D, k, color = PAL.yel, w = 34) {
  if (u <= 0) return;
  const pts = [];
  for (let i = 0; i <= 12; i++) { const v = i / 12; pts.push([lerp(x0, x1, v), y + 6 * Math.sin(v * 3.1 + k)]); }
  const pr = prefix(spline(pts, false, 6), E.out2(clamp(u)));
  if (pr.length < 2) return;
  inkStroke(c, pr, { seed: D * 13 + k, w, amp: 1.2, color, t0: 8, t1: 14, dense: true, heavy: 0, jit: 0.2 });
}
// world-space closed contour morph A -> B (alignment cached by key)
const MC = new Map();
function morphW(A, Bc, u, key, n = 240) {
  const a = toN(A, n), b0 = toN(Bc, n);
  let m = MC.get(key);
  if (!m) {
    const rev = Math.sign(signedArea(a)) !== Math.sign(signedArea(b0));
    const b = rev ? [...b0].reverse() : b0;
    const ca = centroid(a), cb = centroid(b);
    let best = 0, bd = Infinity;
    for (let k = 0; k < n; k += 2) {
      let d = 0;
      for (let i = 0; i < n; i += 3) { const p = a[i], q = b[(i + k) % n]; const dx = (p[0] - ca[0]) - (q[0] - cb[0]), dy = (p[1] - ca[1]) - (q[1] - cb[1]); d += dx * dx + dy * dy; }
      if (d < bd) { bd = d; best = k; }
    }
    m = { rev, best }; MC.set(key, m);
  }
  const b = m.rev ? [...b0].reverse() : b0;
  return a.map((p, i) => { const q = b[(i + m.best) % n]; return [p[0] + (q[0] - p[0]) * u, p[1] + (q[1] - p[1]) * u]; });
}
function drawMorph(P, fill, D, k, o = {}) {
  if (fill) fillShape(c, P, fill, { seed: D * 13 + k, amp: o.amp ?? 1.6, dx: REG.dx, dy: REG.dy });
  inkLoop(c, P, { seed: D * 13 + k, w: o.w ?? 7.5, amp: o.amp ?? 1.6, heavy: 0.3 });
}
function sliceOpen(P, a, b) {
  const L = arclen(P), tot = L[L.length - 1], out = [];
  const at = (s) => { let j = 1; while (j < L.length - 1 && L[j] < s) j++; const u = (s - L[j - 1]) / Math.max(1e-9, L[j] - L[j - 1]); return [lerp(P[j - 1][0], P[j][0], u), lerp(P[j - 1][1], P[j][1], u)]; };
  out.push(at(a * tot));
  for (let i = 0; i < P.length; i++) if (L[i] > a * tot && L[i] < b * tot) out.push(P[i]);
  out.push(at(b * tot));
  return out;
}
// round sticker badge with text
function drawBadge(x, y, R, s, fill, str, D, k, o = {}) {
  if (s <= 0.01) return;
  c.save(); c.translate(x, y); c.rotate(o.r ?? 0); c.scale(s, s);
  const P = boil(circlePts(0, 0, R, 48), D * 13 + k, 1.2, 50);
  fillShape(c, P, fill, { seed: D * 13 + k, amp: 1, dx: REG.dx * 0.7, dy: REG.dy * 0.7 });
  inkLoop(c, P, { seed: D * 13 + k, w: 6, amp: 1.2, heavy: 0.3 });
  letters(c, str, { font: o.font ?? 'KL', size: o.size ?? R * 0.62, x: 0, y: 2, fill: o.color ?? PAL.ink, ink: o.ink === undefined ? null : o.ink, inkW: 3, D, seed: k, amp: 0.6 });
  c.restore();
}
function stamp(str, x, y, r, s, fill, D, k, size = 70) {
  if (s <= 0.01) return;
  const tw = measure(str, 'KL', size).w;
  c.save(); c.translate(x, y); c.rotate(r); c.scale(s, s);
  const box = rrectPts(-tw / 2 - 34, -size * 0.74, tw + 68, size * 1.48, 18);
  fillShape(c, box, fill, { seed: D * 13 + k, amp: 1, dx: REG.dx, dy: REG.dy });
  inkLoop(c, box, { seed: D * 13 + k, w: 5, amp: 1 });
  letters(c, str, { font: 'KL', size, x: 0, y: 0, fill: PAL.hi, ink: PAL.ink, inkW: 3.4, D, seed: k + 1, tracking: 4 });
  c.restore();
}

// ------------------------------------------------------------------ day / night
const NIGHT0 = B[6], DAWN = B[16];
let NIGHT = false;
const isNight = (t) => (t >= NIGHT0 && t < DAWN) || t >= B[21];
const INKC = () => (NIGHT ? PAL.hi : PAL.ink);          // free-standing strokes (nothing filled behind them)
const SHAD = () => (NIGHT ? '#0b1030' : PAL.ink);
const HL = (str, t, tIn, tOut, y, o = {}) => say(str, t, tIn, tOut, { font: 'KL', size: o.size ?? 120, x: o.x ?? 540, y, fill: o.fill ?? PAL.hi, ink: PAL.ink, inkW: o.inkW ?? 6.5, shadow: SHAD(), D: o.D, seed: o.seed ?? 50, st: o.st ?? 0.045, rot: 0.3, color: o.color, align: o.align });
const SUB = (str, t, tIn, tOut, y, o = {}) => say(str, t, tIn, tOut, { font: 'MK', size: o.size ?? 58, x: o.x ?? 540, y, fill: o.fill ?? (NIGHT ? PAL.hi : PAL.ink), ink: null, D: o.D, seed: o.seed ?? 60, st: 0.022, rot: 0.1, alpha: o.alpha });

function drawPaper(t) {
  const dawn = t >= DAWN - 0.05 && t < DAWN + 0.5;
  if (NIGHT || dawn) {
    c.drawImage(IMG.night, 0, 0, W, H);
    const g = c.createRadialGradient(540, 900, 380, 540, 960, 1250);
    g.addColorStop(0, 'rgba(8,10,30,0)'); g.addColorStop(1, 'rgba(8,10,30,0.5)');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
  } else c.drawImage(IMG.paper, 0, 0, W, H);
  if (dawn) { // sunrise: a radial wipe of daylight from the bottom
    const R = 2300 * E.out3(clamp((t - (DAWN - 0.05)) / 0.5));
    if (R > 2) {
      c.save(); c.beginPath(); c.arc(540, 1500, R, 0, Math.PI * 2); c.clip(); c.drawImage(IMG.paper, 0, 0, W, H); c.restore();
      const f = Math.round(t * FPS);
      inkLoop(c, circlePts(540, 1500, R, 160), { seed: f * 7, w: 22, amp: 3, heavy: 0, color: PAL.yel });
    }
  }
}
function drawTooth(D) {
  const v = D % 4;
  const ox = Math.floor(hs(v, 51) * 300), oy = Math.floor(hs(v, 52) * 460);
  c.save(); c.setTransform(1, 0, 0, 1, 0, 0);
  c.globalCompositeOperation = 'multiply'; c.globalAlpha = NIGHT ? 0.3 : 0.42;
  c.drawImage(IMG.tooth, ox, oy, W, H, 0, 0, W, H);
  c.restore();
}
const TAG = '睡眠小科普';
function drawTag(t, D) {
  const a = clamp((t - 0.25) / 0.2);
  if (a <= 0) return;
  const s = E.outBack(a, 2);
  c.save(); c.translate(78, 236); c.scale(s, s); c.rotate(-0.025);
  const tw = measure(TAG, 'MK', 36).w;
  const box = rrectPts(0, -34, 60 + tw + 24, 68, 16);
  fillShape(c, box, PAL.hi, { seed: D * 13 + 7, amp: 0.8, dx: -3, dy: 3 });
  inkLoop(c, box, { seed: D * 13 + 7, w: 3.6, amp: 0.8, heavy: 0.2 });
  const mp = xf(moonDense(100), { x: 32, y: 1, sx: 0.21, sy: 0.21, r: -0.5 });
  fillShape(c, mp, PAL.moon, { seed: D * 13 + 8, amp: 0.5, dx: -1.5, dy: 1.5 }); inkLoop(c, mp, { seed: D * 13 + 8, w: 2.6, amp: 0.5 });
  letters(c, TAG, { font: 'MK', size: 36, x: 60, y: 1, align: 'left', fill: PAL.ink, ink: null, D, seed: 5, amp: 0.5 });
  c.restore();
}
// rising "Z"
function zz(t, tb, x, y, size, D, k, col) {
  const u = (t - tb) / 1.0;
  if (u <= 0 || u >= 1) return;
  letters(c, 'Z', { font: 'KL', size: size * (0.55 + 0.45 * E.outBack(clamp(u * 4), 2)), x: x + 34 * Math.sin(u * 5), y: y - 170 * u, fill: col ?? (NIGHT ? PAL.hi : PAL.indigo), ink: PAL.ink, inkW: 4, D, seed: k, alpha: 1 - Math.pow(u, 3), anim: () => ({ r: -0.25 + 0.15 * Math.sin(u * 6) }) });
}
function rays(x, y, rx, ry, n, len, D, k, color, a0 = 0, w = 7) {
  for (let i = 0; i < n; i++) {
    const a = a0 + i / n * Math.PI * 2;
    inkStroke(c, [[x + Math.cos(a) * rx, y + Math.sin(a) * ry], [x + Math.cos(a) * (rx + len), y + Math.sin(a) * (ry + len)]], { seed: seedOf(D, k + i), w, amp: 0.8, t0: 3, t1: 3, color });
  }
}
function blanket(x0, x1, yTop, yBot, D, k, ph = 0, fill = '#7e8ff2') {
  const top = [];
  for (let i = 0; i <= 18; i++) { const u = i / 18; top.push([lerp(x0, x1, u), yTop + 10 * Math.sin(u * 9 + ph) - 22 * Math.sin(u * Math.PI)]); }
  const P = resample([...top, [x1 + 14, yBot], [x0 - 14, yBot]], 5, true);
  fillShape(c, P, fill, { seed: D * 13 + k, amp: 1.4, dx: REG.dx, dy: REG.dy });
  c.save(); c.beginPath(); pathPts(c, boil(P, D * 13 + k + 0.5, 1.4, 70)); c.clip();
  for (let i = 0; i < 14; i++) { const x = lerp(x0 + 30, x1 - 30, hs(k, i)), y = lerp(yTop + 50, yBot - 20, hs(k, i, 2)); dot(c, x, y, 9, PAL.hi, D, k + 10 + i); }
  c.restore();
  inkStroke(c, top.map((p) => [p[0], p[1] + 34]), { seed: D * 13 + k + 3, w: 4, amp: 1, t0: 20, t1: 20, color: 'rgba(28,22,19,0.5)' });
  inkLoop(c, P, { seed: D * 13 + k, w: 7, amp: 1.6, heavy: 0.3 });
}

// ------------------------------------------------------------------ S1 + S2: 弱者熬夜 / 强者大睡 (0 – B2)
const SLAM = 66 / FPS; // impact frame (2.200 s), on the bar-1 downbeat (2.208)
const GROUND = 1362;
const PIL = { x: 540, s: 1.15 };
const pilTf = (sx = 1, sy = 1, r = 0) => T(PIL.x, GROUND - 172 * PIL.s * sy, PIL.s, r, sx, sy);
const FEATHER = () => memo('feather', () => resample(spline([[0, -44, 1], [14, -24], [17, 6], [8, 32], [0, 44, 1], [-8, 32], [-17, 6], [-14, -24]], true, 3), 3, true));
function feather(x, y, s, r, D, k) {
  const tf = { x, y, r, sx: s, sy: s };
  const P = xf(FEATHER(), tf);
  fillShape(c, P, PAL.hi, { seed: seedOf(D, k), amp: 0.7, dx: -2, dy: 2 });
  inkLoop(c, P, { seed: seedOf(D, k), w: 3.5, amp: 0.7, heavy: 0.1 });
  inkStroke(c, xf([[0, -36], [2, 0], [0, 52]], tf), { seed: seedOf(D, k + 1), w: 3, amp: 0.6, t0: 2, t1: 6 });
}
function notif(x, y, s, kind, D, k) {
  if (s <= 0.01) return;
  c.save(); c.translate(x, y); c.scale(s, s); c.rotate(kind === 1 ? 0.06 : -0.06);
  const box = rrectPts(-100, -46, 200, 92, 28);
  fillShape(c, box, PAL.hi, { seed: seedOf(D, k), amp: 1, dx: REG.dx * 0.6, dy: REG.dy * 0.6 });
  inkLoop(c, box, { seed: seedOf(D, k), w: 5, amp: 1.1, heavy: 0.3 });
  const ic = circlePts(-52, 0, 28, 24);
  fillShape(c, ic, [PAL.red, PAL.blue, PAL.green][kind], { seed: seedOf(D, k + 1), amp: 0.8, dx: -2, dy: 2 });
  inkLoop(c, ic, { seed: seedOf(D, k + 1), w: 3.5, amp: 0.8 });
  if (kind === 0) fillPoly(c, boil(resample(spline([[-52, 14, 1], [-66, 0], [-66, -9], [-59, -15], [-52, -9, 1], [-45, -15], [-38, -9], [-38, 0]], true, 2), 2, true), seedOf(D, k + 2), 0.5, 30), '#fff');
  else if (kind === 1) fillPoly(c, boil([[-60, -13], [-40, 0], [-60, 13]], seedOf(D, k + 2), 0.5, 30), '#fff');
  else for (let i = -1; i <= 1; i++) dot(c, -52 + i * 12, 0, 4.5, '#fff', D, k + 3 + i);
  inkStroke(c, [[-12, -14], [70, -14]], { seed: seedOf(D, k + 5), w: 9, amp: 0.8, t0: 3, t1: 3, color: 'rgba(28,22,19,0.35)' });
  inkStroke(c, [[-12, 14], [44, 14]], { seed: seedOf(D, k + 6), w: 9, amp: 0.8, t0: 3, t1: 3, color: 'rgba(28,22,19,0.25)' });
  const bd = circlePts(92, -42, 25, 20);
  fillShape(c, bd, PAL.red, { seed: seedOf(D, k + 7), amp: 0.6, dx: -1.5, dy: 1.5 }); inkLoop(c, bd, { seed: seedOf(D, k + 7), w: 3.5, amp: 0.6 });
  letters(c, ['99+', '12', '8'][kind], { font: 'KL', size: kind === 0 ? 25 : 32, x: 92, y: -41, fill: '#fff', ink: null, D, seed: k + 8, amp: 0.4 });
  c.restore();
}
function sceneHook(t, tq, D) {
  if (t >= B[2] + 0.05) return;
  const pre = t < B[2] - 0.2; // the pillow is handed to the morph at B2 − 0.2
  // ---- the phone (熬夜)
  if (t < SLAM + 0.35) {
    const pop = K(t, [[0, 0.6], [0.16, 1.1, 'out2'], [0.3, 0.95, 'io2'], [0.42, 1, 'io2']]);
    const bp = beatPulse(tq, [bt(1), bt(2), bt(3)], 10);
    let sx = pop * (1 + 0.05 * bp), sy = pop * (1 - 0.05 * bp), face = 'smug', look = [0, 0], rr = 0.05 * Math.sin(tq * 6);
    if (t > 1.82) { face = 'shock'; look = [0, -12]; rr = 0; }
    if (t >= SLAM) { const u = clamp((t - SLAM) / 0.08); sx = lerp(1, 1.7, E.out3(u)); sy = lerp(1, 0.14, E.out3(u)); face = 'dizzy'; rr = 0; }
    if (t < SLAM) rays(540, 1060, 215 * pop, 330 * pop, 14, 34 + 34 * bp, D, 100, '#4aa6e8', 0.1);
    drawPhone(c, T(540, 1345 - 285 * sy, 1, rr, sx, sy), { D, face, look, time: '02:00' });
  }
  if (t < SLAM + 0.15) {
    [[248, 850, bt(1), 0], [836, 950, bt(2), 1], [252, 1190, bt(3), 2]].forEach(([x, y, tb, kind], i) => {
      const s = appear(tq, tb, 0.2, 2.6) * (t >= SLAM ? vanish(t, SLAM, 0.12) : 1);
      notif(x + (t >= SLAM ? (x < 540 ? -1 : 1) * 300 * clamp((t - SLAM) / 0.15) : 0), y - 10 * Math.sin(tq * 4 + i), s, kind, D, 120 + i * 10);
    });
  }
  if (t > 1.82 && t < SLAM) letters(c, '!', { font: 'KL', size: 130, x: 740, y: 700, fill: PAL.red, ink: PAL.ink, inkW: 5, D, seed: 31, anim: () => ({ s: E.outBack(clamp((t - 1.82) / 0.12), 3) }) });
  if (t > 1.6 && t < SLAM + 0.05) { // falling pillow shadow
    const u = clamp((t - 1.6) / (SLAM - 1.6));
    c.save(); c.globalAlpha = 0.16 + 0.22 * u;
    fillPoly(c, boil(ellPts(540, GROUND + 4, 80 + 210 * E.in2(u), 14 + 16 * E.in2(u), 30), D * 13 + 1, 1.2, 50), PAL.ink);
    c.restore();
  }
  if (t >= SLAM && t < SLAM + 0.35) {
    speedLines(c, 540, 1200, 420, 800, 10, D, 300, { w: 9, a0: Math.PI * 1.0, a1: Math.PI * 1.36 });
    speedLines(c, 540, 1200, 420, 800, 10, D, 310, { w: 9, a0: Math.PI * 1.64, a1: Math.PI * 2.0 });
  }
  // ---- the pillow slams down (大睡)
  if (t >= SLAM - 0.14 && pre) {
    let sx = 1, sy = 1, yOff = 0;
    if (t < SLAM) {
      const u = clamp((t - (SLAM - 0.14)) / 0.14);
      yOff = lerp(-1500, 0, E.in2(u)); sy = 1 + 0.7 * u; sx = 1 - 0.18 * u;
      const top = GROUND - 344 * PIL.s * sy + yOff;
      for (let i = 0; i < 7; i++) { const x = 330 + i * 70; inkStroke(c, [[x, top - 40], [x, top - 560]], { seed: D * 13 + 200 + i, w: 6, amp: 1, t0: 40, t1: 4 }); }
    } else { const u = t - SLAM; sy = 1 - 0.2 * Math.exp(-u * 9) * Math.cos(u * 26); sx = 1 + 0.14 * Math.exp(-u * 9) * Math.cos(u * 26); }
    const tf = pilTf(sx, sy); tf.y += yOff;
    drawPillow(c, tf, { D, face: 'sleep' });
    const cu = clamp((tq - bt(6)) / 0.18);
    if (cu > 0) drawCrown(c, { x: PIL.x + 40, y: GROUND - 344 * PIL.s * sy - 28, sx: 0.95 * E.outBack(cu, 2.5), sy: 0.95 * E.outBack(cu, 2.5), r: 0.14 }, D);
  }
  // impact FX: dust puffs + bursting feathers
  if (t >= SLAM && t < SLAM + 0.7) { const u = t - SLAM; if (u > 0.03 && u < 0.6) { puff(c, 230 - 140 * u, GROUND - 10, 46 + 44 * u, D, 350); puff(c, 850 + 140 * u, GROUND - 10, 46 + 44 * u, D, 351); } }
  if (t >= SLAM) {
    const u = t - SLAM;
    for (let i = 0; i < 9; i++) {
      const side = i % 2 ? 1 : -1;
      const x0 = 540 + side * (110 + 150 * hs(i, 1)), y0 = 1080 + 80 * hs(i, 2);
      const vx = side * (450 + 650 * hs(i, 3)), vy = -(650 + 650 * hs(i, 4));
      const dr = (1 - Math.exp(-3.2 * u)) / 3.2;
      feather(x0 + vx * dr + 40 * Math.sin(u * 4 + i), y0 + vy * dr + 110 * u * u + 60 * u, 0.9 + 0.5 * hs(i, 5), 0.8 * Math.sin(u * 3.5 + i) + side * 0.6, D, 140 + i);
    }
  }
  if (pre) {
    [bt(5), bt(6), bt(7)].forEach((tb, i) => zz(tq, tb, 760 + 30 * i, 930, 70 - 10 * i, D, 160 + i));
    [[200, 800, bt(5)], [880, 760, bt(6)], [190, 1180, bt(7)], [900, 1150, bt(7) + E8]].forEach(([x, y, tb], i) => { const u = clamp((tq - tb) / 0.18); if (u > 0) twinkle(c, x, y, 38 * E.outBack(u, 2.5), D, 170 + i, PAL.yel, 0.3 * i); });
  }
  // ---- headlines
  if (t < SLAM + 0.5) {
    const anim = t < SLAM ? popIn(t, 0.0, 0.06, 0.24, { rot: 0.3, seed: 2 }) : flyOut(t, SLAM, 0.5, { seed: 4 });
    letters(c, '弱者熬夜', { font: 'KL', size: 165, x: 540, y: 440, fill: PAL.red, ink: PAL.ink, inkW: 7, shadow: PAL.ink, D, seed: 11, anim });
  }
  if (t >= SLAM + 0.1) {
    if (pre) { const L = measure('强者', 'KL', 175), M = measure('强者大睡', 'KL', 175); swash(540 - M.w / 2 + L.adv - 14, 540 + M.w / 2 + 10, 520, (tq - bt(5)) / 0.25, D, 70, PAL.yel, 46); }
    say('强者大睡', t, SLAM + 0.1, B[2] - 0.2, { font: 'KL', size: 175, x: 540, y: 440, fill: PAL.indigo, ink: PAL.ink, inkW: 7.5, shadow: PAL.ink, D, seed: 12, st: 0.05, rot: 0.35 });
  }
}

// ------------------------------------------------------------------ S3: 大睡理论 (B2 – B3)
const CLOUD = { x: 540, y: 850 };
const cloudW = () => memo('cloudW', () => xf(cloudDense(400, 250, 10, 0.42, 3), { x: CLOUD.x, y: CLOUD.y }));
const pillowW = () => memo('pillowW', () => xf(pillowDense(), pilTf()));
function sceneTitle(t, tq, D) {
  if (t < B[2] - 0.2 || t >= B[3] - 0.05) return;
  const mu = E.io3(clamp((t - (B[2] - 0.2)) / 0.34));
  const bp = beatPulse(tq, [bt(9), bt(10), bt(11)], 9);
  const sc = 1 + 0.035 * bp;
  c.save(); c.translate(CLOUD.x, CLOUD.y); c.scale(sc, sc); c.translate(-CLOUD.x, -CLOUD.y);
  if (mu < 1) drawMorph(morphW(pillowW(), cloudW(), mu, 'pillow-cloud', 260), mixHue(PAL.pillow, PAL.indigo, mu), D, 410);
  else {
    const P = cloudW();
    fillShape(c, P, PAL.indigo, { seed: D * 13 + 410, amp: 2, dx: REG.dx, dy: REG.dy });
    fillShape(c, xf(cloudDense(300, 165, 8, 0.36, 5), { x: CLOUD.x - 10, y: CLOUD.y - 30 }), '#6d80f2', { seed: D * 13 + 411, amp: 1.6, dx: 0, dy: 0 });
    inkLoop(c, P, { seed: D * 13 + 410, w: 8, amp: 2, heavy: 0.3 });
    inkStroke(c, [[236, 770], [282, 690], [370, 640]], { seed: D * 13 + 430, w: 16, color: PAL.hi, amp: 1.2, t0: 20, t1: 30 });
    [[300, 1010, 0], [790, 690, 1], [835, 985, 2]].forEach(([x, y, i]) => twinkle(c, x, y, 20 + 6 * Math.sin(tq * 5 + i), D, 432 + i, PAL.yel, i));
  }
  const tl = (i) => B[2] + i * E8;
  const outT = clamp((t - (B[3] - 0.2)) / 0.15);
  letters(c, '大睡理论', { font: 'KL', size: 200, x: 540, y: CLOUD.y - 6, fill: PAL.hi, ink: PAL.ink, inkW: 8.5, shadow: PAL.nightD, D, seed: 21, tracking: 4,
    anim: (i) => { const v = clamp((tq - tl(i)) / 0.2); return { s: v <= 0 ? 0 : E.outBack(v, 2.4) * (1 - outT), r: (1 - v) * (i % 2 ? 0.3 : -0.3), dy: -(1 - E.out3(v)) * 60 }; } });
  c.restore();
  // little moon sitting on the cloud
  const ms = appear(tq, tl(3) + E8, 0.25, 2.4) * (1 - outT);
  if (ms > 0.01) drawMoon(c, T(860, 625, 0.62 * ms, -0.4 + 0.06 * Math.sin(tq * 3)), { D, face: 'sleep' });
  stamp('热搜同款', 265, 600, -0.16, (1 + 1.2 * (1 - E.out3(clamp((tq - bt(11)) / 0.14)))) * (tq >= bt(11) ? 1 : 0) * (1 - outT), PAL.red, D, 450);
  SUB('晚上十点睡，睡够 8 小时', t, bt(10) + E8, B[3] - 0.12, 1245, { D, seed: 24, size: 60 });
  SUB('拒绝报复性熬夜', t, bt(11) + E8, B[3] - 0.12, 1335, { D, seed: 25, size: 60 });
}

// ------------------------------------------------------------------ S4: 是玩梗？还是真科学？ (B3 – B4)
const QM = [[352, 835], [376, 737], [452, 675], [556, 663], [660, 693], [718, 775], [702, 865], [640, 929], [575, 979], [545, 1045], [540, 1121], [540, 1170]];
const qLine = () => memo('qLine', () => resample(spline(QM, false, 4), 4));
const qW = () => memo('qW', () => resample(outline(qLine(), () => 56, true), 4, true));
const DOT = { x: 540, y: 1318, R: 62 };
function drawHead(x, y, R, sx, sy, face, look, D, k, cap = 1) {
  const tf = { x, y, r: 0, sx: sx * R / 100, sy: sy * R / 100 };
  inked(c, circlePts(0, 0, 100, 60), tf, D, k, { fill: '#ffd3a1', w: 7, amp: 1.2 });
  drawFace(c, tf, { D, kind: face, y: 14, gap: 36, size: 1.0, look, k: k + 10 });
  if (cap > 0) drawNightcap(c, sub(tf, 4, -82, 0.6 * cap, 0.14), D, k + 30);
}
function sceneQuestion(t, tq, D) {
  if (t < B[3] - 0.05 || t >= B[4] - 0.05) return;
  const mu = E.io3(clamp((t - (B[3] - 0.05)) / 0.32));
  const bp = beatPulse(tq, [bt(13), bt(14), bt(15)], 10);
  if (mu < 1) drawMorph(morphW(cloudW(), qW(), mu, 'cloud-q', 260), mixHue(PAL.indigo, PAL.yel, mu), D, 700);
  else {
    c.save(); c.translate(540, 920); c.scale(1 + 0.04 * bp, 1 + 0.04 * bp); c.translate(-540, -920);
    drawMorph(qW(), PAL.yel, D, 700, { w: 8 });
    inkStroke(c, sliceOpen(qLine(), 0.04, 0.3).map((p) => [p[0] - 8, p[1] - 6]), { seed: D * 13 + 701, w: 11, color: PAL.hi, amp: 1, t0: 8, t1: 10, dense: true });
    c.restore();
  }
  const tl = bt(13);
  if (t >= tl - 0.28) {
    let y = DOT.y, sx = 1, sy = 1, face = 'sleep', look = [0, 0];
    if (t < tl) { const u = clamp((t - (tl - 0.28)) / 0.28); y = lerp(-200, DOT.y, E.in2(u)); sy = 1 + 0.4 * u; sx = 1 - 0.15 * u; }
    else { const u = t - tl; sy = 1 - 0.3 * Math.exp(-u * 8) * Math.cos(u * 22); sx = 1 + 0.22 * Math.exp(-u * 8) * Math.cos(u * 22); face = 'shock'; look = [0, -8]; }
    if (t > bt(14) + E8) { face = 'happy'; look = [10, -10]; }
    drawHead(DOT.x, y + DOT.R * (1 - sy), DOT.R, sx, sy, face, look, D, 720);
    if (t >= tl && t < tl + 0.45) { const u = t - tl; puff(c, DOT.x - 90 - 80 * u, DOT.y + 52, 24 + 20 * u, D, 760); puff(c, DOT.x + 90 + 80 * u, DOT.y + 52, 24 + 20 * u, D, 761); }
  }
  [[200, 760, bt(13)], [880, 900, bt(14)], [860, 650, bt(15)]].forEach(([x, y, tb], i) => { const u = clamp((tq - tb) / 0.18); if (u > 0) twinkle(c, x, y, 36 * E.outBack(u, 2.5), D, 730 + i, PAL.yel, 0.3 * i); });
  HL('是玩梗？', t, bt(12) + E8, B[4] - 0.12, 400, { D, fill: PAL.yel, seed: 41 });
  HL('还是真科学？', t, bt(14), B[4] - 0.12, 535, { D, fill: PAL.blueL, seed: 42 });
}

// ------------------------------------------------------------------ S5: 通宵不睡 24 小时 (B4 – B5)
const CK = { x: 540, y: 1010, s: 2.5 };
const clockW = () => memo('clockW', () => resample(circlePts(CK.x, CK.y, 96 * CK.s, 90), 4, true));
function sceneClock(t, tq, D) {
  if (t < B[4] - 0.05 || t >= B[5] - 0.05) return;
  const mu = E.io3(clamp((t - (B[4] - 0.05)) / 0.3));
  const hours = 24 * clamp((t - B[4] - 0.05) / (7 * E8 - 0.05));
  const done = t >= B[4] + 7 * E8;
  if (mu < 1) drawMorph(morphW(qW(), clockW(), mu, 'q-clock', 240), mixHue(PAL.yel, PAL.hi, mu), D, 900);
  else {
    // the sun / moon orbits the clock: a whole day and night goes by
    const a = hours / 24 * Math.PI * 2 + Math.PI / 2, ox = CK.x + Math.cos(a) * 335, oy = CK.y + Math.sin(a) * 335;
    const day = hours % 24 >= 6 && hours % 24 < 18;
    if (day) drawSun(c, T(ox, oy, 0.38), { D, rot: tq }); else drawMoon(c, T(ox, oy, 0.5, -0.4), { D });
    const shx = done ? 8 * Math.sin(t * 83) : 0;
    drawClock(c, T(CK.x + shx, CK.y, CK.s), { D, h: hours / 12 * Math.PI * 2, m: hours / 4 * Math.PI * 2, bells: true, ring: done ? 0.25 * Math.sin(t * 70) : 0, blur: done ? 0 : 2.4 });
    if (done) speedLines(c, CK.x, CK.y - 300, 60, 130, 7, D, 910, { w: 6, a0: -Math.PI * 0.95, a1: -Math.PI * 0.05, color: PAL.red });
  }
  HL('通宵不睡', t, B[4] + 0.05, B[5] - 0.12, 425, { D, seed: 905, size: 135 });
  if (t >= B[4]) {
    const k8 = Math.min(8, Math.floor((t - B[4]) / E8) + 1), N = 3 * k8;
    const s = (1 + 0.2 * pulse(t, B[4] + (k8 - 1) * E8, 12)) * (t >= B[5] - 0.12 ? vanish(t, B[5] - 0.12, 0.1) : 1);
    letters(c, `${N} 小时`, { font: 'KL', size: 150, x: 540, y: 585, fill: N >= 24 ? PAL.red : PAL.orange, ink: PAL.ink, inkW: 7, shadow: SHAD(), D, seed: 902, anim: () => ({ s }) });
  }
}

// ------------------------------------------------------------------ S6: 通宵后的大脑 ≈ 喝醉了 (B5 – B6)
const BR6 = { x: 360, y: 1000, s: 1.0 };
const brain6W = () => memo('brain6W', () => xf(brainDense(), T(BR6.x, BR6.y, BR6.s)));
const MUG = { x: 800, y: 1020, s: 1.05 };
function sceneDrunk(t, tq, D) {
  if (t < B[5] - 0.05 || t >= B[6]) return;
  const mu = E.io3(clamp((t - (B[5] - 0.05)) / 0.3));
  if (mu < 1) drawMorph(morphW(clockW(), brain6W(), mu, 'clock-brain', 240), mixHue(PAL.hi, PAL.brain, mu), D, 1000);
  else {
    drawBrain(c, T(BR6.x + 10 * Math.sin(tq * 3), BR6.y, BR6.s, 0.07 * Math.sin(tq * 3.2)), { D, face: 'drunk' });
    for (let i = 0; i < 3; i++) { const a = tq * 3 + i * 2.1; twinkle(c, BR6.x + Math.cos(a) * 150, BR6.y - 215 + Math.sin(a) * 28, 22, D, 1020 + i, PAL.yel, a); }
  }
  const ms = appear(t, bt(21), 0.24, 2.4);
  if (ms > 0.01) drawMug(c, T(MUG.x, MUG.y, MUG.s * ms, 0.1 * Math.sin(tq * 3 + 1)), { D, t: tq });
  [bt(21) + E8, bt(22) + E8].forEach((tb, i) => { const u = (t - tb) / 0.6; if (u > 0 && u < 1) letters(c, '嗝', { font: 'KL', size: 72, x: 575 + 40 * i, y: 790 - 80 * u, fill: PAL.hi, ink: PAL.ink, inkW: 3.5, D, seed: 1010 + i, alpha: 1 - u * u, anim: () => ({ s: E.outBack(clamp(u * 4), 2.5), r: 0.2 }) }); });
  HL('通宵后的大脑', t, B[5] + 0.05, B[6] - 0.02, 425, { D, seed: 1030, size: 125 });
  if (t >= bt(21) + E8) {
    const M = measure('喝醉了！', 'KL', 150).w, aw = 120, x0 = 540 - (aw + 24 + M) / 2;
    const s = appear(t, bt(21) + E8, 0.2, 2.6);
    c.save(); c.translate(x0 + aw / 2, 578); c.scale(s, s); drawApprox(c, 0, 0, 1.7, D, PAL.ink); c.restore();
    HL('喝醉了！', t, bt(21) + E8 + 0.06, B[6] - 0.02, 575, { D, seed: 1031, size: 150, fill: PAL.red, x: x0 + aw + 24 + M / 2 });
  }
  SUB('反应力相当于血液酒精 0.1%', t, bt(22), B[6] - 0.02, 1290, { D, seed: 1040, size: 58 });
  SUB('（已超过醉驾标准）', t, bt(22) + E8, B[6] - 0.02, 1370, { D, seed: 1041, size: 50 });
  SUB('Dawson & Reid, Nature 1997', t, bt(22) + E8, B[6] - 0.02, 1440, { D, seed: 1042, size: 32, alpha: 0.75 });
}

// ------------------------------------------------------------------ pull cord (lights off)
function cordY(t, tDrop, tPull) {
  if (t < tDrop) return null;
  let y = lerp(-90, 640, E.outBack(clamp((t - tDrop) / 0.3), 1.6));
  if (t >= tPull - 0.12 && t < tPull) y += 90 * E.in2(clamp((t - (tPull - 0.12)) / 0.12));
  else if (t >= tPull) { const u = t - tPull; y += 90 * Math.exp(-u * 8) * Math.cos(u * 18); if (u > 0.5) y -= 900 * E.in2(clamp((u - 0.5) / 0.35)); }
  return y;
}
function drawCord(x, y, D) {
  if (y === null || y < -80) return;
  inkStroke(c, [[x, -40], [x + 3, y * 0.5], [x, y]], { seed: D * 13 + 3000, w: 5, amp: 0.8, t0: 2, t1: 2, color: NIGHT ? '#d9d0bb' : PAL.ink });
  const bead = rrectPts(x - 19, y, 38, 74, 19);
  fillShape(c, bead, PAL.yel, { seed: D * 13 + 3001, amp: 0.8, dx: -2, dy: 2 });
  inkLoop(c, bead, { seed: D * 13 + 3001, w: 4.5, amp: 0.8 });
}

// ------------------------------------------------------------------ S7 + S8: 关灯 · 那睡着以后呢？ · 你的大脑会偷偷…… (B6 – B8)
const PN = { x: 560, y: 1150, s: 1.0 };
const BRN = { x: 470, y: 1000, s: 0.8, r: -0.22 };
const MOON = { x: 850, y: 760, s: 0.9, r: -0.35 };
const mugW = () => memo('mugW', () => xf(mugDense(), T(MUG.x, MUG.y, MUG.s)));
const moonW = () => memo('moonW', () => xf(moonDense(100), T(MOON.x, MOON.y, MOON.s, MOON.r)));
const STARS = [[120, 720], [300, 845], [610, 700], [985, 905], [110, 1010], [80, 1520], [1000, 1560], [520, 1585]];
function sceneNight(t, tq, D) {
  if (t < B[6] || t >= B[8]) return;
  const u0 = clamp((t - B[6]) / 0.35), e0 = E.out3(u0);
  const tremble = t >= B[7] ? 7 * Math.pow(clamp((t - B[7]) / (B[8] - B[7])), 2) : 0;
  const mm = E.io3(clamp((t - B[6]) / 0.36)); // the beer mug floats up and becomes the moon
  if (mm < 1) drawMorph(morphW(mugW(), moonW(), mm, 'mug-moon', 220).map((p) => [p[0], p[1] - 120 * Math.sin(Math.PI * mm)]), mixHue(PAL.beer, PAL.moon, mm), D, 1100);
  else drawMoon(c, T(MOON.x, MOON.y + 6 * Math.sin(tq * 2), MOON.s, MOON.r + 0.04 * Math.sin(tq * 1.6)), { D, face: 'sleep' });
  const beats = [bt(25), bt(26), bt(27), bt(28), bt(29), bt(30), bt(31)];
  STARS.forEach(([x, y], i) => { const s = appear(tq, bt(24 + (i % 4)) + (i > 3 ? E8 : 0), 0.2, 2.6); if (s > 0) twinkle(c, x, y, (20 + 10 * hs(i, 3)) * s * (1 + 0.25 * beatPulse(tq, beats, 8)), D, 1110 + i, PAL.gold, 0.3 * i); });
  const ps = appear(t, B[6], 0.25, 2.2);
  if (ps > 0.01) drawPillow(c, T(PN.x, PN.y, PN.s * ps), { D, fill: '#f3ead6' });
  const bx = lerp(BR6.x, BRN.x, e0) + tremble * Math.sin(t * 70), by = lerp(BR6.y, BRN.y, e0) - 60 * Math.sin(Math.PI * u0);
  drawBrain(c, T(bx, by, lerp(BR6.s, BRN.s, e0), lerp(0, BRN.r, e0)), { D, face: 'sleep', cap: appear(t, bt(25), 0.22, 2.4) });
  const bu = E.out3(clamp((t - (B[6] + E8)) / 0.3));
  if (bu > 0) blanket(140, 960, 1120 + 500 * (1 - bu), 1480 + 500 * (1 - bu), D, 1130, tq * 0.5);
  [bt(25), bt(26), bt(27), bt(29), bt(30), bt(31)].forEach((tb, i) => zz(tq, tb, 660 + 24 * (i % 2), 900, 62 - 8 * (i % 3), D, 1140 + i, PAL.hi));
  HL('那睡着以后呢？', t, B[6] + E8, B[7] - 0.12, 455, { D, seed: 1150, size: 118 });
  HL('你的大脑', t, B[7] + 0.05, B[8] - 0.1, 420, { D, seed: 1151, size: 125 });
  HL('会偷偷……', t, bt(29), B[8] - 0.1, 565, { D, seed: 1152, size: 125, fill: PAL.blueL });
}
// rising water (riser) → crash (drop) → drains to reveal the bath
function floodFront(t) {
  if (t < B[7] + 0.2 || t >= B[8] + 0.34) return null;
  if (t < B[8] - 0.3) return lerp(1990, 1330, E.in2(clamp((t - B[7] - 0.2) / (B[8] - 0.3 - B[7] - 0.2))));
  if (t < B[8]) return lerp(1330, -260, E.in3(clamp((t - (B[8] - 0.3)) / 0.3)));
  return lerp(-260, 2100, E.in2(clamp((t - B[8]) / 0.34)));
}
function sceneFlood(t, tq, D) {
  const y = floodFront(t);
  if (y === null) return;
  flood(c, y, tq, D, 1300, { amp: 26, color: PAL.blue, light: PAL.blueL });
  for (let i = 0; i < 8; i++) { const ph = (tq * 0.6 + hs(i, 31)) % 1; const by = lerp(H + 40, y + 60, ph); if (by > y + 50) bubble(c, 80 + 920 * hs(i, 32), by, 10 + 10 * hs(i, 33), D, 1320 + i, { color: PAL.hi }); }
}

// ------------------------------------------------------------------ S9 + S10: 大脑在“洗澡” · 冲走大脑垃圾 (B8 – B10)
const TB = { x: 540, y: 1170, s: 1.05 };
const BRB = { x: 540, y: 930, s: 0.7 };
const JUNK = [[-120, -90], [-30, -138], [70, -118], [140, -46], [-160, 0], [30, -50]];
function sceneBath(t, tq, D) {
  if (t < B[8] || t >= B[10] - 0.05) return;
  const outS = t >= B[10] - 0.2 ? vanish(t, B[10] - 0.2, 0.14) : 1;
  const bp = beatPulse(tq, [bt(33), bt(34), bt(35)], 9);
  drawTubBack(c, T(TB.x, TB.y, TB.s), { D });
  const btf = T(BRB.x + 4 * Math.sin(tq * 2), BRB.y - 10 * bp, BRB.s, 0.05 * Math.sin(tq * 2.4));
  drawBrain(c, btf, { D, face: t < B[9] ? 'sleep' : 'happy', cap: 1 });
  // junk on the brain, flushed out by the waves on the beats
  JUNK.forEach((p, i) => {
    const ta = bt(36) + i * 0.04, tf0 = bt(37 + (i % 3));
    if (t < ta) return;
    const q = xf([p], T(BRB.x, BRB.y, BRB.s))[0];
    let x = q[0], y = q[1], r = 0, sc = appear(t, ta, 0.2, 2.4);
    if (t >= tf0) { const u = clamp((t - tf0) / 0.55); if (u >= 1) return; x = lerp(q[0], 1180, E.in2(u)); y = q[1] - 170 * Math.sin(Math.PI * u * 0.8) + 320 * u * u; r = 6 * u; sc *= 1 - 0.3 * u; }
    drawJunk(c, x, y, 27 * sc, r, D, 1270 + i * 7);
  });
  if (t >= bt(36) + E8 && t < bt(38)) {
    const s = appear(t, bt(36) + E8, 0.2, 2.4) * vanish(t, bt(38) - 0.16, 0.16);
    letters(c, '代谢废物', { font: 'KL', size: 64, x: 205, y: 745, fill: PAL.yel, ink: PAL.ink, inkW: 3.2, shadow: SHAD(), D, seed: 1265, anim: () => ({ s }) });
    if (s > 0.5) drawArrow(c, [[250, 790], [300, 840], [372, 862]], D, 1266, { draw: clamp((t - bt(36) - E8 - 0.1) / 0.2), w: 6, color: PAL.hi, head: 22 });
  }
  // CSF waves sweep through on the beats
  [bt(37), bt(38), bt(39)].forEach((tb, j) => {
    const u = (t - tb + 0.2) / 0.6;
    if (u <= 0 || u >= 1) return;
    const xc = lerp(60, 1060, u);
    for (const dy of [-80, -10, 60]) {
      const pts = [];
      for (let i = 0; i <= 10; i++) { const x = xc - 170 + i * 34; pts.push([x, BRB.y + dy - 30 + 18 * Math.sin(x * 0.03 - t * 8)]); }
      inkStroke(c, pts, { seed: D * 13 + 1290 + j * 3 + dy, w: 12, amp: 1, color: PAL.blueL, t0: 40, t1: 10 });
    }
  });
  drawTub(c, T(TB.x, TB.y, TB.s), { D });
  for (let i = 0; i < 10; i++) {
    const x = 228 + i * 70, y = 1060 - 14 * hs(i, 1) + 4 * Math.sin(tq * 3 + i);
    const r = (30 + 16 * hs(i, 2)) * (1 + 0.1 * bp) * outS;
    if (r > 1) puff(c, x, y, r, D, 1200 + i, { fill: PAL.hi, w: 4.5 });
  }
  if (outS > 0.01) drawDuck(c, T(800, 1012 + 8 * Math.sin(tq * 3), 0.8 * outS, 0.08 * Math.sin(tq * 3)), D);
  for (let i = 0; i < 5; i++) { const ph = (tq * 0.5 + hs(i, 41)) % 1; if (outS > 0.5) bubble(c, 260 + 560 * hs(i, 42) + 20 * Math.sin(tq * 2 + i), lerp(1030, 760, ph), 9 + 9 * hs(i, 43), D, 1240 + i, { color: PAL.hi }); }
  [bt(33), bt(34), bt(35)].forEach((tb, i) => splash(c, 300 + 240 * i, 1040, t - tb, D, 1230 + 10 * i, { n: 5, v: 700, size: 18, life: 0.5, fill: PAL.blueL }));
  HL('大脑在', t, B[8] + 0.06, B[9] - 0.12, 410, { D, seed: 1250, size: 120 });
  HL('‘洗澡’！', t, bt(33), B[9] - 0.12, 575, { D, seed: 1251, size: 175, fill: PAL.blueL });
  HL('冲走大脑垃圾', t, B[9] + 0.05, B[10] - 0.12, 430, { D, seed: 1260, size: 125 });
  SUB('脑脊液一波波冲刷，带走代谢废物', t, bt(37), B[10] - 0.12, 1440, { D, seed: 1261, size: 54 });
  SUB('Xie 等, Science 2013', t, bt(37) + E8, B[10] - 0.12, 1505, { D, seed: 1262, size: 32, alpha: 0.75 });
}

// ------------------------------------------------------------------ S11: 白天学的，夜里“存盘” (B10 – B11)
const PILLR = { x: 120, y: 1190, w: 840, h: 150 };
const pillW = () => memo('pillW', () => rrectPts(PILLR.x, PILLR.y, PILLR.w, PILLR.h, PILLR.h / 2, 4));
const tubW = () => memo('tubW', () => xf(tubDense(), T(TB.x, TB.y, TB.s)));
const BRS = { x: 540, y: 860, s: 0.82 };
const ARR = [bt(41), bt(42), bt(43)];
function drawBar(p, tq, D, label) {
  const P = pillW();
  fillShape(c, P, '#2b2f45', { seed: D * 13 + 1600, amp: 1.2, dx: REG.dx, dy: REG.dy });
  if (p > 0.002) {
    const cy = PILLR.y + PILLR.h / 2;
    c.save(); c.beginPath(); pathPts(c, boil(P.map((q) => [540 + (q[0] - 540) * 0.965, cy + (q[1] - cy) * 0.84]), D * 13 + 1601, 1, 60)); c.clip();
    const xe = PILLR.x + PILLR.w * clamp(p, 0, 1.04), edge = [];
    for (let i = 0; i <= 14; i++) { const v = i / 14; edge.push([xe + 12 * Math.sin(v * 7 + tq * 9), lerp(PILLR.y - 20, PILLR.y + PILLR.h + 20, v)]); }
    fillPoly(c, [[PILLR.x - 40, PILLR.y - 20], ...edge, [PILLR.x - 40, PILLR.y + PILLR.h + 20]], PAL.green);
    fillPoly(c, [[PILLR.x - 40, PILLR.y + PILLR.h * 0.64], ...edge.filter((q) => q[1] > PILLR.y + PILLR.h * 0.64), [PILLR.x - 40, PILLR.y + PILLR.h + 20]], PAL.greenD);
    c.restore();
  }
  inkStroke(c, [[PILLR.x + 60, PILLR.y + 32], [PILLR.x + 240, PILLR.y + 28]], { seed: D * 13 + 1620, w: 10, color: 'rgba(255,255,255,0.6)', t0: 10, t1: 10 });
  inkLoop(c, P, { seed: D * 13 + 1600, w: 8, amp: 1.4, heavy: 0.3 });
  if (label) letters(c, label, { font: 'KL', size: 78, x: 540, y: PILLR.y + PILLR.h / 2, fill: PAL.hi, ink: PAL.ink, inkW: 4, D, seed: 1630, amp: 0.8 });
}
function drawCard(x, y, s, r, str, col, D, k) {
  if (s <= 0.01) return;
  c.save(); c.translate(x, y); c.rotate(r); c.scale(s, s);
  const box = rrectPts(-112, -64, 224, 128, 22);
  fillShape(c, box, col, { seed: D * 13 + k, amp: 1, dx: REG.dx, dy: REG.dy });
  inkLoop(c, box, { seed: D * 13 + k, w: 6, amp: 1.1 });
  letters(c, str, { font: 'KL', size: 66, x: 0, y: 2, fill: PAL.ink, ink: null, D, seed: k + 1, amp: 0.6 });
  c.restore();
}
function sceneSave(t, tq, D) {
  if (t < B[10] - 0.05 || t >= B[11] - 0.05) return;
  const mu = E.io3(clamp((t - (B[10] - 0.05)) / 0.3));
  const p = ARR.reduce((a, ta) => a + E.outBack(clamp((t - ta) / 0.18), 1.3) / 3, 0);
  if (mu < 1) drawMorph(morphW(tubW(), pillW(), mu, 'tub-pill', 240), mixHue('#f7f3ea', '#2b2f45', mu), D, 1400);
  else drawBar(p, tq, D, t >= ARR[2] + E8 ? '存盘完成！' : `${Math.round(clamp(p) * 100)}%`);
  const hu = clamp((t - (B[10] - 0.05)) / 0.4);
  const gulp = beatPulse(tq, ARR, 10);
  drawBrain(c, T(BRS.x, lerp(BRB.y, BRS.y, E.out3(hu)) - 170 * Math.sin(Math.PI * hu), lerp(BRB.s, BRS.s, E.out3(hu)) * (1 + 0.08 * gulp), 0.04 * Math.sin(tq * 2.2)), { D, face: gulp > 0.35 ? 'happy' : 'sleep', cap: 1 });
  [['单词', PAL.yel, -180, 700], ['公式', PAL.blueL, 1260, 860], ['技能', PAL.green, -180, 1060]].forEach(([str, col, x0, y0], i) => {
    const ta = ARR[i], u = clamp((t - (ta - 0.34)) / 0.34);
    if (u <= 0 || t > ta + 0.02) return;
    const e = E.in2(u);
    drawCard(lerp(x0, BRS.x, e), lerp(y0, BRS.y - 20, e) - 110 * Math.sin(Math.PI * u), 1 - 0.75 * e, (1 - e) * (i % 2 ? 0.3 : -0.3), str, col, D, 1420 + i * 5);
  });
  ARR.forEach((ta, i) => { const v = t - ta; if (v >= 0 && v < 0.35) { const k = E.outBack(clamp(v / 0.12), 2.5) * (1 - v / 0.35); twinkle(c, BRS.x + 200, BRS.y - 150 + 40 * i, 44 * k, D, 1440 + i, PAL.yel); twinkle(c, BRS.x - 210, BRS.y - 120 + 30 * i, 30 * k, D, 1445 + i, PAL.yel); } });
  HL('白天学的', t, B[10] + 0.05, B[11] - 0.12, 420, { D, seed: 1450, size: 130 });
  HL('夜里‘存盘’', t, bt(41), B[11] - 0.12, 570, { D, seed: 1451, size: 140, color: { 3: PAL.yel, 4: PAL.yel } });
}

// ------------------------------------------------------------------ S12: 一夜约 5 个睡眠周期 (B11 – B12)
const HY = { x0: 170, x1: 950, yW: 790, yR: 845 };
const DEEP = [1090, 1060, 985, 950, 925];
const HW = (HY.x1 - HY.x0) / 5;
const hypLine = () => memo('hyp', () => {
  const pts = [[HY.x0, HY.yW, 1]];
  for (let k = 0; k < 5; k++) {
    const x0 = HY.x0 + k * HW, yd = DEEP[k];
    pts.push([x0 + 0.17 * HW, lerp(HY.yR, yd, 0.45)], [x0 + 0.3 * HW, yd, 1], [x0 + 0.6 * HW, yd, 1], [x0 + 0.78 * HW, HY.yR, 1], [x0 + (k === 4 ? 1.0 : 0.94) * HW, k === 4 ? HY.yW : HY.yR, 1]);
  }
  return resample(spline(pts, false, 4), 4);
});
const hypW = () => memo('hypW', () => resample(outline(hypLine(), () => 16, true), 4, true));
const flatW = () => memo('flatW', () => rrectPts(HY.x0, HY.yW - 7, HY.x1 - HY.x0, 14, 7, 4));
function sceneCycles(t, tq, D) {
  if (t < B[11] - 0.05 || t >= B[12] - 0.05) return;
  const mu = E.io3(clamp((t - (B[11] - 0.05)) / 0.18));
  if (mu < 1) drawMorph(morphW(pillW(), flatW(), mu, 'pill-flat', 240), mixHue('#2b2f45', PAL.gold, mu), D, 1500);
  else {
    const L = hypLine(), u = clamp((t - B[11] - 0.12) / (5 * E8 - 0.12)), penX = lerp(HY.x0, HY.x1, u);
    let idx = L.findIndex((q) => q[0] > penX + 0.01);
    if (idx < 0) idx = L.length;
    const drawn = L.slice(0, Math.max(2, idx));
    if (penX < HY.x1 - 4) inkStroke(c, [[penX, HY.yW], [HY.x1, HY.yW]], { seed: D * 13 + 1501, w: 7, amp: 1, color: 'rgba(255,210,94,0.45)', t0: 2, t1: 2 });
    inkStroke(c, drawn, { seed: D * 13 + 1502, w: 26, amp: 1.2, color: PAL.ink, t0: 6, t1: 4, dense: true });
    inkStroke(c, drawn, { seed: D * 13 + 1503, w: 13, amp: 1.2, color: PAL.gold, t0: 6, t1: 4, dense: true });
    const pen = drawn[drawn.length - 1];
    drawBrain(c, T(pen[0], pen[1] - 50, 0.26, 0.1 * Math.sin(tq * 4)), { D, face: 'sleep', cap: 1 });
    for (let k = 0; k < 5; k++) {
      const s = appear(t, B[11] + (k + 1) * E8, 0.2, 2.6);
      if (s > 0) letters(c, String(k + 1), { font: 'KL', size: 66, x: HY.x0 + (k + 0.45) * HW, y: DEEP[k] + 64, fill: PAL.yel, ink: PAL.ink, inkW: 3.5, shadow: SHAD(), D, seed: 1510 + k, anim: () => ({ s }) });
    }
  }
  const la = appear(t, B[11] + 0.1, 0.2, 2);
  if (la > 0) { letters(c, '浅', { font: 'MK', size: 44, x: 112, y: HY.yW + 10, fill: PAL.hi, ink: null, D, seed: 1520, alpha: 0.8 * clamp(la) }); letters(c, '深', { font: 'MK', size: 44, x: 112, y: 1080, fill: PAL.hi, ink: null, D, seed: 1521, alpha: 0.8 * clamp(la) }); }
  HL('一夜约 5 个', t, B[11] + 0.05, B[12] - 0.12, 420, { D, seed: 1530, size: 130 });
  HL('睡眠周期', t, bt(45), B[12] - 0.12, 565, { D, seed: 1531, size: 140, fill: PAL.gold });
  SUB('每个约 90 分钟', t, bt(46) + E8, B[12] - 0.12, 1320, { D, seed: 1532, size: 62 });
}

// ------------------------------------------------------------------ S13: 每晚睡不到 6 小时 (B12 – B13)
const SH = { x: 540, y: 1000, s: 1.2 };
const shieldW = () => memo('shieldW', () => xf(shieldDense(), T(SH.x, SH.y, SH.s)));
function sceneShield(t, tq, D) {
  if (t < B[12] - 0.05 || t >= B[13]) return;
  const mu = E.io3(clamp((t - (B[12] - 0.05)) / 0.32));
  if (mu < 1) drawMorph(morphW(hypW(), shieldW(), mu, 'hyp-shield', 260), mixHue(PAL.gold, '#6fb3ff', mu), D, 1600);
  else {
    const cracks = [0, 1, 2].map((i) => clamp((t - bt(49 + i)) / 0.1));
    const hit = beatPulse(t, [bt(49), bt(50), bt(51)], 12);
    const face = t < bt(49) ? 'happy' : t < bt(51) ? 'shock' : 'wilt';
    drawShield(c, T(SH.x + 14 * hit * Math.sin(t * 90), SH.y, SH.s * (1 - 0.03 * hit)), { D, cracks, face });
  }
  HL('每晚睡不到', t, B[12] + 0.05, B[13] - 0.1, 420, { D, seed: 1650, size: 130 });
  HL('6 小时', t, bt(49), B[13] - 0.1, 580, { D, seed: 1651, size: 165, fill: PAL.red });
  SUB('免疫防线会变脆', t, bt(50) + E8, B[13] - 0.1, 1400, { D, seed: 1652, size: 60 });
}

// ------------------------------------------------------------------ S14: 感冒风险 ×4.2 (B13 – B14)
const VC = { x: 540, y: 1000 };
const VIN = [bt(52) + E8, bt(52) + E8 + 0.09, bt(53) + E8, bt(54), bt(54) + E8];
function shardPos(i, t) {
  const S = SHARDS[i];
  const L = Math.hypot(S.m[0], S.m[1]) || 1, dir = [S.m[0] / L, S.m[1] / L];
  const e = E.out3(clamp((t - B[13]) / 0.5)), dist = 300 + 160 * hs(i, 7), ft = Math.max(0, t - B[13] - 0.12);
  const y = SH.y + S.m[1] * SH.s + dir[1] * dist * 0.8 * e + 1500 * ft * ft;
  return { x: SH.x + S.m[0] * SH.s + dir[0] * (dist * e + 140 * ft), y: Math.min(y, 2150 + 30 * hs(i, 9)), r: (hs(i, 8) - 0.5) * (3 * e + 5 * ft) };
}
function sceneVirus(t, tq, D) {
  if (t < B[13] || t >= B[14] + 0.12) return;
  const gone = t >= B[14] - 0.05 ? vanish(t, B[14] - 0.05, 0.16) : 1;
  if (t < B[14] - 0.05) SHARDS.forEach((S, i) => { const p = shardPos(i, t); inked(c, S.poly, { x: p.x, y: p.y, r: p.r, sx: SH.s, sy: SH.s }, D, 1700 + i, { fill: '#6fb3ff', w: 5, amp: 1 }); });
  if (t < B[13] + 0.3) speedLines(c, SH.x, SH.y, 280, 620, 16, D, 1690, { w: 8, color: PAL.hi });
  const ts = bt(53);
  if (t >= ts) {
    const s = lerp(2.6, 1, E.out3(clamp((t - ts) / 0.14))) * gone;
    starBurst(c, VC.x, VC.y, 250 * s, 14, D, 1765, PAL.yel, tq * 0.5);
    letters(c, '×4.2', { font: 'KL', size: 230, x: VC.x, y: VC.y, fill: PAL.red, ink: PAL.ink, inkW: 9, shadow: SHAD(), D, seed: 1760, anim: () => ({ s }) });
  }
  VIN.forEach((tin, i) => {
    if (t < tin - 0.25) return;
    const u = clamp((t - (tin - 0.25)) / 0.25), a = -Math.PI / 2 + 0.35 + i * (Math.PI * 2 / 5) + 0.25 * (t - B[13]);
    const ox = VC.x + Math.cos(a) * 370, oy = VC.y + Math.sin(a) * 225;
    const x = lerp(VC.x + Math.cos(a) * 1150, ox, E.out3(u)), y = lerp(VC.y + Math.sin(a) * 950, oy, E.out3(u)) - 16 * beatPulse(tq, [bt(54), bt(55)], 9);
    if (gone > 0.01) drawVirus(c, x, y, 50 * gone * (1 + 0.15 * pulse(t, tin, 12)), t * 0.8 + i, D, 1780 + i * 30);
  });
  HL('感冒风险', t, B[13] + 0.05, B[14] - 0.1, 430, { D, seed: 1800, size: 140 });
  SUB('（对比每晚睡 7 小时以上）', t, bt(54), B[14] - 0.1, 1350, { D, seed: 1801, size: 54 });
  SUB('Prather 等, Sleep 2015', t, bt(54) + E8, B[14] - 0.1, 1420, { D, seed: 1802, size: 32, alpha: 0.75 });
}

// ------------------------------------------------------------------ S15: 好好睡一觉，全身都在充电 (B14 – B16)
const BT = { x: 540, y: 990, s: 1.15 };
const battW = () => memo('battW', () => xf(batteryDense(), T(BT.x, BT.y, BT.s)));
const CW = (BATT.w - 60 - 3 * 14) / 4;
function sceneBattery(t, tq, D) {
  if (t < B[14] - 0.05 || t >= B[16] - 0.04) return;
  if (t < B[14] + 0.3) { // shards fly back together into the battery
    const P = battW();
    SHARDS.forEach((S, i) => {
      const u = E.in2(clamp((t - (B[14] - 0.05)) / 0.28));
      if (u >= 1) return;
      const p = shardPos(i, B[14] - 0.05), q = P[Math.floor(i / SHARDS.length * P.length)];
      inked(c, S.poly, { x: lerp(p.x, q[0], u), y: lerp(p.y, q[1], u), r: p.r * (1 - u), sx: SH.s * (1 - 0.6 * u), sy: SH.s * (1 - 0.6 * u) }, D, 1700 + i, { fill: '#6fb3ff', w: 5, amp: 1 });
    });
  }
  const bs = appear(t, B[14] + 0.18, 0.26, 2.2);
  if (bs > 0.01) {
    const pump = beatPulse(tq, [bt(60), bt(61), bt(62), bt(63)], 10) + 0.6 * beatPulse(tq, [bt(63) + E8 / 2, bt(63) + E8, bt(63) + 1.5 * E8], 14);
    const cells = [0, 1, 2, 3].map((i) => E.outBack(clamp((t - bt(60 + i)) / 0.2), 2.2));
    const low = t < bt(60) ? 0.3 + 0.7 * beatPulse(tq, [B[14] + 0.2, bt(57), bt(58), bt(59)], 6) : 0;
    drawBattery(c, T(BT.x, BT.y, BT.s * bs * (1 + 0.03 * pump)), { D, cells, low, bolt: appear(t, bt(59) + E8, 0.2, 2.6) });
    if (t >= bt(59) + E8 && t < bt(60)) rays(BT.x, BT.y, 120, 120, 8, 40, D, 1860, PAL.yel, tq * 2, 6);
  }
  ['修复', '记忆', '免疫', '情绪'].forEach((str, i) => {
    const s = appear(t, bt(60 + i), 0.2, 2.6);
    if (s > 0) letters(c, str, { font: 'KL', size: 62, x: BT.x + BT.s * (-BATT.w / 2 + 30 + i * (CW + 14) + CW / 2), y: BT.y + BT.s * BATT.h / 2 + 74, fill: PAL.hi, ink: PAL.ink, inkW: 3.5, shadow: SHAD(), D, seed: 1850 + i, anim: () => ({ s }) });
  });
  stamp('满电！', 815, 805, 0.13, (1 + 1.2 * (1 - E.out3(clamp((tq - (bt(63) + E8)) / 0.14)))) * (tq >= bt(63) + E8 ? 1 : 0), PAL.green, D, 1870, 64);
  HL('好好睡一觉', t, B[14] + E8, B[16] - 0.06, 425, { D, seed: 1880, size: 130 });
  HL('全身都在充电', t, bt(60), B[16] - 0.06, 575, { D, seed: 1881, size: 130, color: { 4: PAL.green, 5: PAL.green } });
}

// ------------------------------------------------------------------ S16: 强者大睡！ — sunrise (B16 – B17)
const PIL16 = { x: 520, y: 1215, s: 1.12 };
const SUN16 = { x: 742, y: 885, s: 1.15 };
const pil16W = () => memo('pil16W', () => xf(pillowDense(), T(PIL16.x, PIL16.y, PIL16.s)));
function sceneSunrise(t, tq, D) {
  if (t < B[16] - 0.04 || t >= B[17] - 0.05) return;
  const su = E.out3(clamp((t - B[16]) / 0.5));
  if (t >= B[16] && t < B[16] + 0.45) speedLines(c, SUN16.x - 80, SUN16.y + 60, 330, 1000, 22, D, 1900, { w: 8, color: PAL.orange });
  drawSun(c, T(SUN16.x, lerp(1320, SUN16.y, su), SUN16.s * (0.6 + 0.4 * su)), { D, rot: tq * 0.5, face: 'happy' });
  const mu = E.io3(clamp((t - (B[16] - 0.04)) / 0.3));
  if (mu < 1) drawMorph(morphW(battW(), pil16W(), mu, 'batt-pillow', 260), mixHue(PAL.green, PAL.pillow, mu), D, 1910);
  else {
    const bp = beatPulse(tq, [bt(65), bt(66), bt(67)], 9), u = t - (B[16] + 0.26);
    const sq = (1 - 0.12 * Math.exp(-u * 8) * Math.cos(u * 24)) * (1 - 0.03 * bp);
    drawPillow(c, T(PIL16.x, PIL16.y + 172 * PIL16.s * (1 - sq), PIL16.s, 0, 2 - sq, sq), { D, face: 'strong' });
    const cu = clamp((tq - bt(65)) / 0.18);
    if (cu > 0) drawCrown(c, { x: PIL16.x - 95, y: PIL16.y + 172 * PIL16.s * (1 - sq) - 172 * PIL16.s * sq - 34, sx: 1.05 * E.outBack(cu, 2.5), sy: 1.05 * E.outBack(cu, 2.5), r: -0.16 }, D);
  }
  [[190, 820, bt(65)], [890, 860, bt(66)], [180, 1300, bt(67)], [900, 1320, bt(67) + E8]].forEach(([x, y, tb], i) => { const u = clamp((tq - tb) / 0.18); if (u > 0) twinkle(c, x, y, 44 * E.outBack(u, 2.5), D, 1920 + i, PAL.yel, 0.3 * i); });
  HL('强者', t, B[16] + 0.03, B[17] - 0.12, 420, { D, seed: 1950, size: 150, fill: PAL.yel });
  HL('大睡！', t, bt(65), B[17] - 0.12, 590, { D, seed: 1951, size: 200, fill: PAL.indigo });
}

// ------------------------------------------------------------------ tips (B17 – B20)
function tipTitle(num, str, t, tIn, tOut, D, k) {
  const R = 62, gap = 28, M0 = measure(str, 'KL', 140).w, size = Math.min(140, 140 * (930 - 2 * R - gap) / M0), M = M0 * size / 140;
  const x0 = 540 - (2 * R + gap + M) / 2;
  drawBadge(x0 + R, 432, R, appear(t, tIn, 0.24, 2.6) * (t >= tOut ? vanish(t, tOut, 0.12) : 1), PAL.yel, num, D, k, { size: 84, r: -0.1 });
  HL(str, t, tIn + 0.06, tOut, 430, { D, seed: k + 1, size, x: x0 + 2 * R + gap + M / 2 });
}
const GA = { x: 540, y: 1150, s: 1.0 };
const gaugeW = () => memo('gaugeW', () => xf(gaugeDense(300), T(GA.x, GA.y, GA.s)));
function sceneTip1(t, tq, D) {
  if (t < B[17] - 0.05 || t >= B[18] - 0.05) return;
  const mu = E.io3(clamp((t - (B[17] - 0.05)) / 0.28));
  if (mu < 1) drawMorph(morphW(pil16W(), gaugeW(), mu, 'pillow-gauge', 240), mixHue(PAL.pillow, PAL.hi, mu), D, 2000);
  else {
    const h = K(t, [[B[17] + 0.2, 4], [bt(69), 11.4, 'out3'], [bt(69) + E8, 6.3, 'io2'], [bt(70), 8.9, 'io2'], [bt(70) + E8, 7.6, 'io2'], [bt(71), 8.15, 'io2'], [bt(71) + E8, 8, 'io2']]);
    drawGauge(c, T(GA.x, GA.y, GA.s), { D, h });
    [[7, '7'], [9, '9']].forEach(([hh, s], i) => { const a = gaugeAng(hh); letters(c, s, { font: 'KL', size: 66, x: GA.x + Math.cos(a) * 352, y: GA.y + Math.sin(a) * 352, fill: PAL.green, ink: PAL.ink, inkW: 3.5, shadow: SHAD(), D, seed: 2010 + i }); });
    letters(c, '小时', { font: 'MK', size: 46, x: GA.x, y: GA.y + 78, fill: PAL.ink, ink: null, D, seed: 2013 });
    if (t >= bt(71)) { const s = appear(t, bt(71), 0.2, 2.6); twinkle(c, GA.x + 250, GA.y - 330, 40 * s, D, 2015, PAL.yel); }
  }
  tipTitle('1', '睡 7～9 小时', t, B[17], B[18] - 0.12, D, 2020);
  SUB('睡太久，也不好', t, bt(70), B[18] - 0.12, 1330, { D, seed: 2030, size: 62 });
}
const WB = { base: 1200, x0: 205, dx: 111.7, w: 76, ph: 50 };
const barRect = (i, h) => rrectPts(WB.x0 + i * WB.dx - WB.w / 2, WB.base - h * WB.ph, WB.w, h * WB.ph, 18, 4);
const weekH = (i, t) => lerp(i >= 5 ? 10 : 5, 8, E.outBack(clamp((t - (i >= 5 ? bt(73) : bt(74) + i * 0.03)) / 0.24), 1.6));
const barCol = (i, t) => (t >= bt(75) ? PAL.green : i >= 5 ? PAL.indigo : PAL.orange);
function sceneTip2(t, tq, D) {
  if (t < B[18] - 0.05 || t >= B[19] - 0.05) return;
  const mu = E.io3(clamp((t - (B[18] - 0.05)) / 0.3));
  inkStroke(c, [[140, WB.base + 4], [940, WB.base + 4]], { seed: D * 13 + 2099, w: 6, amp: 1, t0: 6, t1: 6 });
  for (let i = 0; i < 7; i++) {
    const x = WB.x0 + i * WB.dx;
    if (mu < 1 && i === 3) drawMorph(morphW(gaugeW(), barRect(3, 5), mu, 'gauge-bar', 200), mixHue(PAL.hi, barCol(3, t), mu), D, 2109);
    else {
      // the gauge becomes Thursday's bar; the other days pop up from the baseline, centre-out, on 16ths
      const g = i === 3 ? 1 : E.outBack(clamp((t - (B[18] + 0.1 + 0.066 * Math.abs(i - 3))) / 0.2), 2.2);
      if (g > 0.03) {
        const h = Math.max(0.6, weekH(i, t) * g), top = WB.base - h * WB.ph;
        drawMorph(barRect(i, h), barCol(i, t), D, 2100 + i * 3, { w: 6 });
        if (g > 0.7) drawFace(c, T(x, top + 40, 1), { D, kind: t >= bt(75) ? 'happy' : i >= 5 ? 'sleep' : 'tired', gap: 17, size: 0.5, k: 2120 + i * 7 });
      }
    }
    letters(c, '一二三四五六日'[i], { font: 'MK', size: 46, x, y: WB.base + 48, fill: PAL.ink, ink: null, D, seed: 2130 + i });
  }
  if (t >= bt(75)) {
    const u = clamp((t - bt(75)) / 0.25), y = WB.base - 8 * WB.ph - 20;
    for (let k = 0; k < 11; k++) { const xa = 150 + k * 74; if ((k + 0.5) / 11 > u) break; inkStroke(c, [[xa, y], [xa + 40, y]], { seed: D * 13 + 2140 + k, w: 5, amp: 0.8, t0: 2, t1: 2, color: PAL.greenD }); }
    letters(c, '8 小时', { font: 'KL', size: 50, x: 880, y: y - 44, fill: PAL.green, ink: PAL.ink, inkW: 3, D, seed: 2145, anim: () => ({ s: appear(t, bt(75) + 0.1, 0.2, 2.6) }) });
  }
  tipTitle('2', '别靠周末补觉', t, B[18], B[19] - 0.12, D, 2150);
  SUB('规律作息，才是关键', t, bt(74) + E8, B[19] - 0.12, 1335, { D, seed: 2160, size: 62 });
}
const PH19 = { x: 540, y: 1000, s: 0.82 };
const phone19W = () => memo('phone19W', () => xf(phoneDense(), T(PH19.x, PH19.y, PH19.s)));
function scenePhoneBed(t, tq, D) {
  if (t < B[19] - 0.05) return;
  const mu = E.io3(clamp((t - (B[19] - 0.05)) / 0.3));
  if (mu < 1) {
    const g = E.in2(clamp(mu / 0.55));
    for (let i = 0; i < 7; i++) {
      if (i === 3 || g >= 1) continue;
      const P = barRect(i, 8).map((p) => [lerp(p[0], p[0] + (3 - i) * WB.dx, g), p[1]]);
      drawMorph(P, PAL.green, D, 2200 + i * 3, { w: 6 });
    }
    drawMorph(morphW(barRect(3, 8), phone19W(), mu, 'bar-phone', 200), mixHue(PAL.green, PAL.phone, E.in2(mu)), D, 2209);
    return;
  }
  const fu = E.outBack(clamp((t - bt(77)) / 0.3), 1.4);
  const r = lerp(0, -Math.PI / 2, fu), x = lerp(PH19.x, 590, fu), y = lerp(PH19.y, 1110, fu);
  const on = 1 - clamp((t - (bt(77) + E8)) / 0.15);
  const ps = appear(t, bt(77) - 0.05, 0.22, 2.4);
  if (ps > 0.01) drawPillow(c, T(335, 1175, 0.5 * ps), { D });
  if (on > 0.3) rays(x, y, 200, 300, 12, 30 + 20 * beatPulse(tq, [bt(76), bt(77)], 8), D, 2230, '#4aa6e8', 0.2);
  const tf = T(x, y, PH19.s, r);
  drawPhone(c, tf, { D, on, time: '23:30', face: on > 0.5 ? 'tired' : 'sleep' });
  const cs = appear(t, bt(78) + E8, 0.22, 2.4);
  if (cs > 0.01) drawNightcap(c, sub(tf, 0, -300, 0.75 * cs, 0), D, 2250);
  const bu = E.out3(clamp((t - bt(78)) / 0.28));
  if (bu > 0) blanket(lerp(1150, 715, bu), lerp(1450, 905, bu), 1000, 1265, D, 2240, tq * 0.5, PAL.indigo);
  [bt(79), bt(79) + E8, bt(80), bt(81), bt(82), bt(83)].forEach((tb, i) => zz(tq, tb, 660 + 26 * (i % 2), 940, 60 - 8 * (i % 3), D, 2260 + i));
  if (t < B[20] + 0.1) {
    tipTitle('3', '睡前放下手机', t, B[19], B[20] - 0.12, D, 2270);
    SUB('屏幕光会让你更难入睡', t, bt(77) + E8, B[20] - 0.12, 1335, { D, seed: 2280, size: 60 });
  }
}

// ------------------------------------------------------------------ S20: 今晚，你大睡了吗？ (B20 – end)
function sceneEnd(t, tq, D) {
  if (t < B[20] - 0.05) return;
  HL('今晚，你', t, B[20] + 0.05, 99, 430, { D, seed: 2300, size: 125 });
  HL('大睡了吗？', t, bt(81), 99, 580, { D, seed: 2301, size: 150, color: NIGHT ? { 0: PAL.yel, 1: PAL.yel } : { 0: PAL.indigo, 1: PAL.indigo } });
  const M = measure('评论区打卡', 'KL', 82).w, x0 = 500 - (84 + 24 + M) / 2, y = 1392;
  const cs = appear(t, bt(82), 0.24, 2.6);
  if (cs > 0) drawCheckbox(c, T(x0 + 42, y, 0.95 * cs * (1 + 0.1 * pulse(t, bt(83), 8))), { D, check: (t - bt(83)) / 0.22 });
  HL('评论区打卡', t, bt(82) + 0.06, 99, y, { D, seed: 2302, size: 82, fill: NIGHT ? PAL.hi : PAL.red, x: x0 + 84 + 24 + M / 2 });
  const au = clamp((t - (bt(83) + E8)) / 0.3);
  if (au > 0) drawArrow(c, [[x0 + 84 + 24 + M + 22, y + 4], [x0 + 84 + 24 + M + 110, y + 12], [990, y - 50]], D, 2310, { draw: au, w: 8, color: INKC(), head: 30 });
  if (t >= B[21]) { // lights off — the moon winks good night
    const ms = appear(t, B[21] + 0.05, 0.3, 2.2);
    if (ms > 0.01) drawMoon(c, T(850, 790, 0.85 * ms, -0.35), { D, face: t > B[21] + 0.42 ? 'wink' : 'sleep' });
    STARS.slice(0, 5).forEach(([x, yy], i) => { const s = appear(tq, B[21] + 0.05 + i * 0.06, 0.2, 2.6); if (s > 0) twinkle(c, x, yy, (20 + 10 * hs(i, 3)) * s, D, 2320 + i, PAL.gold, 0.3 * i); });
    SUB('晚安～', t, B[21] + 0.2, 99, 905, { D, seed: 2330, size: 60, x: 850, fill: PAL.hi });
  }
}

// ------------------------------------------------------------------ render
export function render(t) {
  const f = Math.round(t * FPS), D = Math.floor(f / 2), tq = onN(t, FPS, 2);
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
  NIGHT = isNight(t);
  drawPaper(t);
  const sh = shakeAt(t, [[SLAM, 22], [B[8], 16], [bt(49), 8], [bt(50), 9], [bt(51), 11], [B[13], 18], [bt(53), 16], [B[16], 20], [bt(77) + 0.22, 6], [B[21], 5]]);
  c.save(); c.translate(sh.x, sh.y);
  sceneHook(t, tq, D);
  sceneTitle(t, tq, D);
  sceneQuestion(t, tq, D);
  sceneClock(t, tq, D);
  sceneDrunk(t, tq, D);
  sceneNight(t, tq, D);
  sceneBath(t, tq, D);
  sceneFlood(t, tq, D);
  sceneSave(t, tq, D);
  sceneCycles(t, tq, D);
  sceneShield(t, tq, D);
  sceneVirus(t, tq, D);
  sceneBattery(t, tq, D);
  sceneSunrise(t, tq, D);
  sceneTip1(t, tq, D);
  sceneTip2(t, tq, D);
  scenePhoneBed(t, tq, D);
  sceneEnd(t, tq, D);
  drawCord(975, t < B[6] + 1 ? cordY(t, bt(22), B[6]) : cordY(t, bt(83) - 0.1, B[21]), D);
  c.restore();
  drawTag(t, D);
  drawTooth(D);
  // impact flash / lights-off blink (1–2 frames)
  const flash = (fr, col, a) => { if (f === fr) { c.save(); c.globalAlpha = a; c.fillStyle = col; c.fillRect(0, 0, W, H); c.restore(); } };
  flash(Math.round(SLAM * FPS), PAL.hi, 0.55);
  flash(Math.round(B[6] * FPS), PAL.nightD, 0.85); flash(Math.round(B[6] * FPS) + 1, PAL.nightD, 0.4);
  flash(Math.round(B[16] * FPS), '#fff3c4', 0.5);
  flash(Math.round(B[21] * FPS), PAL.nightD, 0.85); flash(Math.round(B[21] * FPS) + 1, PAL.nightD, 0.4);
}
