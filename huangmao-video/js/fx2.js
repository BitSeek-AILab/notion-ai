// 大走理论 v2 · visual layer: colour backdrops (morphing blobs + halftone drop shadow), sunburst,
// confetti, night overlay helpers, vignette. Everything is a pure function of (t, seed, D) → deterministic frames.
import { PAL, hs, clamp, lerp, E, boil, fillPoly, fillShape, inkLoop, resample } from './engine.js';
import { mixHex } from './shapes.js';

const TAU = Math.PI * 2;

// ---------------------------------------------------------------- parametric blob
// superellipse (n: 2 = ellipse, 4 = squircle, 8+ = rounded rect) × star spikes (sp, k) × organic wobble (wb, ph)
export const BLOB_N = 168; // multiple of k = 14 so the spike tips land on samples
export function blobPts(p, N = BLOB_N) {
  const { x, y, rx, ry, rot = 0, n = 2, sp = 0, k = 14, wb = 0, ph = 0 } = p;
  const out = [], cr = Math.cos(rot), sr = Math.sin(rot);
  for (let i = 0; i < N; i++) {
    const a = (i / N) * TAU, ca = Math.cos(a), sa = Math.sin(a);
    let px = rx * Math.sign(ca) * Math.pow(Math.abs(ca), 2 / n);
    let py = ry * Math.sign(sa) * Math.pow(Math.abs(sa), 2 / n);
    let m = 1;
    if (sp) { const f = ((a * k) / TAU) % 1; const tri = 1 - 2 * Math.abs(f - 0.5); m *= 1 + sp * (tri - 0.4); }
    if (wb) m *= 1 + wb * (0.5 * Math.sin(3 * a + ph) + 0.3 * Math.sin(5 * a - 1.3 * ph + 1) + 0.2 * Math.sin(2 * a + 0.7 * ph + 2));
    px *= m; py *= m;
    out.push([x + px * cr - py * sr, y + px * sr + py * cr]);
  }
  return out;
}
const NUM = ['x', 'y', 'rx', 'ry', 'rot', 'n', 'sp', 'wb', 'a', 'dx', 'dy'];
export function lerpBlob(A, B, u) {
  const o = { ...B };
  for (const k of NUM) o[k] = lerp(A[k] ?? 0, B[k] ?? 0, u);
  o.n = Math.max(1.2, o.n);
  o.color = mixHex(A.color ?? B.color, B.color ?? A.color, u);
  return o;
}
// keyframed blob track: keys [{t, d?, e?, ...params}]; every key inherits the previous target and tweens to its own over d s
export function blobTrack(keys, ease, base = {}) {
  const R = []; let prev = { x: 540, y: 960, rx: 0, ry: 0, rot: 0, n: 2, sp: 0, wb: 0, a: 1, dx: 20, dy: 24, color: '#ffffff', ...base };
  for (const k of keys) { prev = { ...prev, d: 0.3, e: null, ...k }; R.push(prev); }
  return (t) => {
    if (!R.length || t < R[0].t) return null;
    let i = 0; while (i + 1 < R.length && t >= R[i + 1].t) i++;
    if (i === 0) return R[0];
    const k = R[i], u = k.d ? clamp((t - k.t) / k.d) : 1;
    const f = k.e === 'outBack' ? E.outBack(u, 1.8) : k.e ? E[k.e](u) : ease(u);
    return lerpBlob(R[i - 1], k, f);
  };
}

// halftone dot tile (newsprint drop shadow)
let DOTS = null;
function dotPattern(c) {
  if (DOTS) return DOTS;
  const cv = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(20, 20) : Object.assign(document.createElement('canvas'), { width: 20, height: 20 });
  const g = cv.getContext('2d');
  g.fillStyle = PAL.ink;
  for (const [x, y] of [[5, 5], [15, 15]]) { g.beginPath(); g.arc(x, y, 3.1, 0, TAU); g.fill(); }
  DOTS = c.createPattern(cv, 'repeat');
  return DOTS;
}
export function drawBackdrop(c, p, D, k, o = {}) {
  if (!p || p.a <= 0.01 || Math.min(p.rx, p.ry) < 3) return;
  const P = blobPts(p);
  c.save();
  c.globalCompositeOperation = 'multiply';
  // halftone shadow, offset down-right
  if (o.dots !== false) {
    const S = boil(P.map((q) => [q[0] + (p.dx ?? 20), q[1] + (p.dy ?? 24)]), D * 13 + k + 3, 3, 110);
    c.globalAlpha = p.a * 0.32;
    c.fillStyle = dotPattern(c);
    c.beginPath(); S.forEach((q, i) => (i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]))); c.closePath(); c.fill();
  }
  c.globalAlpha = p.a;
  fillPoly(c, boil(P, D * 13 + k, 3.2, 110), p.color);
  c.restore();
}

// ---------------------------------------------------------------- sunburst (alternating wedges, multiplied on paper)
export function sunburst(c, x, y, R, n, rot, color, D, k, a = 1) {
  if (R <= 2 || a <= 0.01) return;
  c.save(); c.globalCompositeOperation = 'multiply'; c.globalAlpha *= a;
  for (let i = 0; i < n; i += 2) {
    const a0 = rot + (i / n) * TAU, a1 = rot + ((i + 1) / n) * TAU;
    const pts = [[x, y]];
    for (let j = 0; j <= 8; j++) { const q = lerp(a0, a1, j / 8); pts.push([x + Math.cos(q) * R, y + Math.sin(q) * R]); }
    fillPoly(c, boil(resample(pts, 26, true), D * 13 + k + i, 4, 140), color);
  }
  c.restore();
}

// ---------------------------------------------------------------- confetti (deterministic linear-drag ballistics)
const CONF = [PAL.org, PAL.yel, PAL.grn, PAL.blue, PAL.pink, PAL.red, PAL.yel];
export function confetti(c, tq, t0, x, y, o = {}) {
  const u = tq - t0, life = o.life ?? 1.7;
  if (u < 0 || u > life) return;
  const n = o.n ?? 44, seed = o.seed ?? 1, g = o.g ?? 1500, kd = o.drag ?? 2.4;
  const f = (1 - Math.exp(-kd * u)) / kd;
  const fade = 1 - E.in2(clamp((u - (life - 0.35)) / 0.35));
  c.save();
  c.lineJoin = 'round'; c.strokeStyle = PAL.ink;
  for (let i = 0; i < n; i++) {
    const a = lerp(o.a0 ?? -Math.PI, o.a1 ?? 0, hs(seed, i, 1));
    const v = lerp(o.v0 ?? 900, o.v1 ?? 2000, Math.pow(hs(seed, i, 2), 0.7));
    const px = x + Math.cos(a) * v * f + 22 * Math.sin(u * (5 + 4 * hs(seed, i, 3)) + i) * clamp(u * 2);
    const py = y + (g / kd) * u + (Math.sin(a) * v - g / kd) * f;
    const sz = lerp(0.8, 1.35, hs(seed, i, 4)) * (o.size ?? 1) * Math.min(1, u * 12);
    const spin = (hs(seed, i, 5) - 0.5) * 16, flip = Math.cos(u * (7 + 9 * hs(seed, i, 6)) + i * 1.7);
    c.save();
    c.globalAlpha *= fade;
    c.translate(px, py); c.rotate(hs(seed, i, 7) * TAU + spin * u); c.scale(sz, sz * (0.25 + 0.75 * Math.abs(flip)));
    c.fillStyle = CONF[i % CONF.length];
    c.lineWidth = 2.6 / sz;
    c.beginPath();
    if (i % 4 === 3) c.arc(0, 0, 8, 0, TAU); else c.rect(-13, -6.5, 26, 13);
    c.fill(); c.stroke();
    c.restore();
  }
  c.restore();
}

// ---------------------------------------------------------------- a hand-inked heart ("like")
const HEART = Array.from({ length: 64 }, (_, i) => { const a = (i / 64) * TAU; return [16 * Math.sin(a) ** 3 / 16, -(13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a)) / 16]; });
export function heart(c, x, y, R, D, k, color = PAL.pink, rot = 0) {
  if (R <= 1) return;
  const cr = Math.cos(rot), sr = Math.sin(rot);
  const P = HEART.map(([u, v]) => [x + (u * cr - v * sr) * R, y + (u * sr + v * cr) * R]);
  fillShape(c, P, color, { seed: D * 13 + k, amp: 0.8, dx: -2, dy: 2 });
  inkLoop(c, P, { seed: D * 13 + k, w: Math.max(3, R * 0.11), amp: 0.8, heavy: 0.2 });
}

// ---------------------------------------------------------------- full-frame helpers
export function vignette(c, W, H, a = 0.2) {
  const g = c.createRadialGradient(W / 2, H * 0.48, H * 0.3, W / 2, H * 0.48, H * 0.78);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(1, `rgba(120,86,60,${a})`);
  c.save(); c.globalCompositeOperation = 'multiply'; c.fillStyle = g; c.fillRect(0, 0, W, H); c.restore();
}
export function invertFrame(c, W, H) {
  c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; c.globalCompositeOperation = 'difference'; c.fillStyle = '#fff'; c.fillRect(0, 0, W, H); c.restore();
}
