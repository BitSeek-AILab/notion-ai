// 帕斯卡 ↔ 布列安桑 · 几何定理系列 — line-art / cel-boil drawing engine (Canvas2D).
// Adapted from mg-styles-15 demos/05-cel-boil/js/engine.js (MIT, Vincentwei1021 & Claude Opus 5.5).
// Every primitive is a pure function of its inputs + a seed. "Boil" = re-rolling the seed per drawing.
import { createNoise3D } from '../vendor/simplex-noise.js';

export const PAL = {
  bg: '#0B1320',      // deep midnight (02-line-art)
  bg2: '#13213A',     // lifted centre of the gradient
  grid: '#2A3A57',    // dot grid
  gold: '#F2D9A0',    // champagne-gold line (hero line colour)
  goldD: '#B89A5E',   // dimmed gold (auxiliary lines)
  cream: '#FFF6E2',   // points / highlights
  ink: '#0B1320',
  c1: '#FF8A5B',      // opposite-side pair 1 (coral)
  c2: '#4FD6C8',      // pair 2 (aqua)
  c3: '#B39BFF',      // pair 3 (lavender)
  red: '#FF3B5C',     // the Pascal line / the Brianchon point
  ice: '#9FE8FF',     // the dual (tangential) world
  iceD: '#4C8FB0',
  white: '#FFFFFF',
};
export const PAIR = [PAL.c1, PAL.c2, PAL.c3];

export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const N3 = createNoise3D(mulberry32(0x5eed1e));
// global drawing-scale compensation (close-ups: keep the pen weight and boil amplitude "drawn at the same size")
export const GLOBAL = { ink: 1, amp: 1 };

// hash of any numbers -> [0,1)
export function hs(...a) {
  let h = 2166136261 >>> 0;
  for (const v of a) {
    h = Math.imul(h ^ ((Math.round(v * 997) | 0) >>> 0), 16777619) >>> 0;
    h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995) >>> 0; h ^= h >>> 15;
  }
  return (h >>> 0) / 4294967296;
}
export const hr = (a, b, ...s) => a + (b - a) * hs(...s); // hashed range

// ---------------------------------------------------------------- math / easing
export const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const inv = (a, b, x) => clamp((x - a) / (b - a));
export const sstep = (a, b, x) => { const t = inv(a, b, x); return t * t * (3 - 2 * t); };
export const E = {
  lin: (t) => t,
  in2: (t) => t * t,
  out2: (t) => 1 - (1 - t) * (1 - t),
  in3: (t) => t * t * t,
  out3: (t) => 1 - Math.pow(1 - t, 3),
  out4: (t) => 1 - Math.pow(1 - t, 4),
  io2: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  io3: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  outBack: (t, s = 1.9) => 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2),
  inBack: (t, s = 1.7) => (s + 1) * t * t * t - s * t * t,
  outElastic: (t) => (t === 0 || t === 1 ? t : Math.pow(2, -9 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI / 3.2)) + 1),
};
// piecewise keys: [[t, v, easeName?], ...]; ease applies on the segment ENDING at that key
export function K(t, keys) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const [t1, v1, e] = keys[i];
    if (t <= t1) {
      const [t0, v0] = keys[i - 1];
      const u = (t - t0) / Math.max(1e-9, t1 - t0);
      const f = typeof e === 'function' ? e : E[e || 'io2'];
      return v0 + (v1 - v0) * f(u);
    }
  }
  return keys[keys.length - 1][1];
}

// ---------------------------------------------------------------- geometry
// centripetal Catmull-Rom; points [x,y,corner?]
function crp(p0, p1, p2, p3, t) {
  const d = (p, q) => Math.sqrt(Math.hypot(q[0] - p[0], q[1] - p[1])) + 1e-4;
  const t0 = 0, t1 = d(p0, p1), t2 = t1 + d(p1, p2), t3 = t2 + d(p2, p3);
  const tt = t1 + (t2 - t1) * t;
  const L = (a, b, ta, tb) => { const w = (tt - ta) / (tb - ta); return [a[0] + (b[0] - a[0]) * w, a[1] + (b[1] - a[1]) * w]; };
  const A1 = L(p0, p1, t0, t1), A2 = L(p1, p2, t1, t2), A3 = L(p2, p3, t2, t3);
  const B1 = L(A1, A2, t0, t2), B2 = L(A2, A3, t1, t3);
  return L(B1, B2, t1, t2);
}
export function spline(P, closed = false, step = 5) {
  const n = P.length, out = [];
  if (n < 2) return P.map((p) => [p[0], p[1]]);
  const segN = closed ? n : n - 1;
  for (let i = 0; i < segN; i++) {
    const p1 = P[i], p2 = P[(i + 1) % n];
    let p0 = closed ? P[(i - 1 + n) % n] : (i - 1 < 0 ? p1 : P[i - 1]);
    let p3 = closed ? P[(i + 2) % n] : (i + 2 >= n ? p2 : P[i + 2]);
    if (p1[2]) p0 = p1;
    if (p2[2]) p3 = p2;
    const dd = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
    const m = Math.max(1, Math.ceil(dd / step));
    for (let k = 0; k < m; k++) out.push(crp(p0, p1, p2, p3, k / m));
  }
  if (!closed) out.push([P[n - 1][0], P[n - 1][1]]);
  return out;
}
export function arclen(pts, closed = false) {
  const L = [0];
  for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  if (closed && pts.length > 1) L.push(L[L.length - 1] + Math.hypot(pts[0][0] - pts[pts.length - 1][0], pts[0][1] - pts[pts.length - 1][1]));
  return L;
}
export function resample(pts, step = 3.5, closed = false) {
  const src = closed ? [...pts, pts[0]] : pts;
  const L = arclen(src);
  const tot = L[L.length - 1];
  if (tot < 1e-6) return [src[0].slice(0, 2)];
  const n = Math.max(2, Math.round(tot / step));
  const out = [];
  let j = 1;
  const N = closed ? n : n + 1;
  for (let i = 0; i < N; i++) {
    const s = (tot * i) / n;
    while (j < L.length - 1 && L[j] < s) j++;
    const a = src[j - 1], b = src[j];
    const u = (s - L[j - 1]) / Math.max(1e-9, L[j] - L[j - 1]);
    out.push([a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u]);
  }
  return out;
}
// prefix of an open polyline by fraction of length
export function prefix(pts, frac) {
  if (frac >= 1) return pts;
  const L = arclen(pts), tot = L[L.length - 1], s = tot * Math.max(0, frac);
  const out = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    if (L[i] <= s) { out.push(pts[i]); continue; }
    const u = (s - L[i - 1]) / Math.max(1e-9, L[i] - L[i - 1]);
    out.push([lerp(pts[i - 1][0], pts[i][0], u), lerp(pts[i - 1][1], pts[i][1], u)]);
    break;
  }
  return out;
}
// affine: scale (sx,sy) about origin, shear kx (x += kx * -y), rotate r, translate (x,y)
export function xf(P, o) {
  const { x = 0, y = 0, r = 0, sx = 1, sy = 1, kx = 0 } = o;
  const c = Math.cos(r), s = Math.sin(r);
  return P.map((p) => {
    let px = p[0] * sx, py = p[1] * sy;
    px += kx * -py;
    return [x + px * c - py * s, y + px * s + py * c, p[2]];
  });
}
export function circlePts(cx, cy, r, n = 0, rx = null) {
  n = n || Math.max(10, Math.round((2 * Math.PI * r) / 5));
  const out = [];
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; out.push([cx + (rx ?? r) * Math.cos(a), cy + r * Math.sin(a)]); }
  return out;
}

// ---------------------------------------------------------------- boil
// Turbulent-displace style boil: world-space noise field, re-rolled by seed.
export function boil(pts, seed, amp = 2.4, scale = 70) {
  amp *= GLOBAL.amp;
  if (!amp) return pts.map((p) => [p[0], p[1]]);
  const z = seed * 2.371 + 0.5;
  return pts.map(([x, y]) => [
    x + amp * N3(x / scale, y / scale, z),
    y + amp * N3(x / scale + 41.3, y / scale - 17.9, z),
  ]);
}

// ---------------------------------------------------------------- brush (variable-width stroke)
// pts: dense polyline; wfn(u, s, i) -> width in px. Returns outline polygon (with round caps).
export function outline(pts, wfn, caps = true) {
  const n = pts.length;
  if (n < 2) return [];
  const L = arclen(pts), tot = L[n - 1] || 1;
  const Lp = [], Rp = [];
  let w0 = 0, wN = 0;
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    let tx = b[0] - a[0], ty = b[1] - a[1];
    const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
    const w = Math.max(0, wfn(L[i] / tot, L[i], i, tx, ty)) / 2;
    if (i === 0) w0 = w; if (i === n - 1) wN = w;
    Lp.push([pts[i][0] - ty * w, pts[i][1] + tx * w]);
    Rp.push([pts[i][0] + ty * w, pts[i][1] - tx * w]);
  }
  const poly = [...Lp];
  const cap = (c, a0, w, into) => {
    if (w < 0.6 || !caps) return;
    for (let k = 1; k < 8; k++) { const a = a0 - (Math.PI * k) / 8; into.push([c[0] + Math.cos(a) * w, c[1] + Math.sin(a) * w]); }
  };
  { // end cap: from L side to R side around the end
    const a = pts[n - 2], b = pts[n - 1];
    const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
    cap(b, ang + Math.PI / 2, wN, poly); // starts at left normal, sweeps through forward to right
  }
  for (let i = n - 1; i >= 0; i--) poly.push(Rp[i]);
  {
    const a = pts[0], b = pts[1];
    const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
    cap(a, ang - Math.PI / 2, w0, poly);
  }
  return poly;
}
export function polyPath(ctx, poly, close = true) {
  if (!poly.length) return;
  ctx.moveTo(poly[0][0], poly[0][1]);
  for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i][0], poly[i][1]);
  if (close) ctx.closePath();
}
export function fillPoly(ctx, poly, color, rule = 'nonzero') {
  ctx.beginPath(); polyPath(ctx, poly); ctx.fillStyle = color; ctx.fill(rule);
}

// Standard hand-ink width profile: taper in/out + pressure noise + heavier on the shadow side.
export function inkW(o) {
  const { w = 6, seed = 1, t0 = 14, t1 = 26, jit = 0.35, min = 0.25, heavy = 0.35, lx = 0.55, ly = 0.83, tot = null, taper = true } = o;
  return (u, s, i, tx, ty) => {
    let k = 1 + jit * N3(s / 60, seed * 1.37, 3.1);
    // shadow side: outward normal ~ (ty,-tx) for CW loops; use |dot| so both orientations weight the lower-right edge
    const nx = ty, ny = -tx;
    k *= 1 + heavy * Math.max(0, nx * lx + ny * ly);
    if (taper && tot) {
      const a = sstep(0, t0, s), b = sstep(0, t1, tot - s);
      k *= min + (1 - min) * Math.min(a, b);
    }
    return w * k * GLOBAL.ink;
  };
}

// open ink stroke from control points
export function inkStroke(ctx, P, o = {}) {
  const { seed = 1, amp = 2.2, scale = 70, step = 5, color = PAL.ink, dense = false } = o;
  let pts = dense ? P : spline(P, false, step);
  pts = resample(pts, 3.2);
  pts = boil(pts, seed, amp, scale);
  const tot = arclen(pts).at(-1);
  const wf = o.wfn ? o.wfn(tot) : inkW({ ...o, tot });
  const poly = outline(pts, wf, o.caps ?? true);
  fillPoly(ctx, poly, color);
  return pts;
}

// closed ink loop, inked as 1–2 overlapping pen strokes with tapered ends
export function inkLoop(ctx, dense, o = {}) {
  const { seed = 1, amp = 2.2, scale = 70, color = PAL.ink, splits = 1, overlap = 0.05, overshoot = 2.5 } = o;
  let pts = boil(resample(dense, 3.2, true), seed, amp, scale);
  const n = pts.length;
  if (n < 6) return;
  // orientation -> outward normal sign
  let A = 0; for (let i = 0; i < n; i++) { const p = pts[i], q = pts[(i + 1) % n]; A += p[0] * q[1] - q[0] * p[1]; }
  const sgn = A > 0 ? 1 : -1; // canvas coords (y down): A>0 means clockwise on screen
  const s0 = Math.floor(hs(seed, 7) * n);
  const cuts = [];
  for (let k = 0; k < splits; k++) cuts.push(Math.floor(s0 + (n * k) / splits + (hs(seed, 9, k) - 0.5) * n * 0.15));
  for (let k = 0; k < splits; k++) {
    const a = cuts[k], b = k + 1 < splits ? cuts[k + 1] : cuts[0] + n;
    const ext = Math.max(2, Math.floor(n * overlap));
    const seg = [];
    for (let j = a; j <= b + ext; j++) {
      const p = pts[((j % n) + n) % n];
      if (j > b) {
        const q = pts[(((j + 1) % n) + n) % n], r0 = pts[(((j - 1) % n) + n) % n];
        let tx = q[0] - r0[0], ty = q[1] - r0[1]; const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
        const off = ((j - b) / ext) * overshoot * sgn;
        seg.push([p[0] - ty * off, p[1] + tx * off]);
      } else seg.push(p);
    }
    const tot = arclen(seg).at(-1);
    const wf = inkW({ ...o, seed: seed + k * 13, tot, t0: o.t0 ?? 10, t1: o.t1 ?? 22 });
    // make "heavy" side consistent: flip normal sign for CCW loops
    const wf2 = sgn > 0 ? wf : (u, s, i, tx, ty) => wf(u, s, i, -tx, -ty);
    fillPoly(ctx, outline(seg, wf2), color);
  }
  return pts;
}

// flat fill of a closed shape, independently boiled and off-register
export function fillShape(ctx, dense, color, o = {}) {
  const { seed = 1, amp = 2.2, scale = 70, dx = 0, dy = 0 } = o;
  let pts = boil(dense, seed + 0.5, amp, scale);
  if (dx || dy) pts = pts.map((p) => [p[0] + dx, p[1] + dy]);
  fillPoly(ctx, pts, color);
  return pts;
}

// hatch lines clipped to a polygon (hand shading)
export function hatch(ctx, clipPoly, o = {}) {
  const { seed = 1, gap = 14, ang = -0.9, w = 2.2, color = PAL.ink, amp = 1.6, len = 2000, cx = 960, cy = 540, jitter = 0.35 } = o;
  ctx.save();
  ctx.beginPath(); polyPath(ctx, clipPoly); ctx.clip();
  const c = Math.cos(ang), s = Math.sin(ang);
  let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
  for (const p of clipPoly) { bx0 = Math.min(bx0, p[0]); by0 = Math.min(by0, p[1]); bx1 = Math.max(bx1, p[0]); by1 = Math.max(by1, p[1]); }
  const R = Math.hypot(bx1 - bx0, by1 - by0) / 2 + 10, mx = (bx0 + bx1) / 2, my = (by0 + by1) / 2;
  let k = 0;
  for (let d = -R; d <= R; d += gap, k++) {
    const off = d + (hs(seed, k) - 0.5) * gap * jitter;
    const px = mx - s * off, py = my + c * off;
    const a = [px - c * R * 1.1, py - s * R * 1.1], b = [px + c * R * 1.1, py + s * R * 1.1];
    inkStroke(ctx, [a, b], { seed: seed * 31 + k, amp, w: w * (0.8 + 0.4 * hs(seed, k, 2)), t0: 8, t1: 8, jit: 0.3, heavy: 0, color });
  }
  ctx.restore();
}

// ---------------------------------------------------------------- offscreen layers
export class Layers {
  constructor(W, H, dpr) {
    this.W = W; this.H = H; this.dpr = dpr; this.pool = [];
  }
  get(i) {
    if (!this.pool[i]) {
      const c = document.createElement('canvas');
      c.width = Math.round(this.W * this.dpr); c.height = Math.round(this.H * this.dpr);
      this.pool[i] = c;
    }
    const c = this.pool[i], x = c.getContext('2d');
    x.setTransform(1, 0, 0, 1, 0, 0);
    x.globalCompositeOperation = 'source-over'; x.globalAlpha = 1;
    x.clearRect(0, 0, c.width, c.height);
    x.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    return x;
  }
}
// composite a layer canvas into ctx (screen space)
export function blit(ctx, layerCtx, alpha = 1, op = 'source-over') {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = alpha; ctx.globalCompositeOperation = op;
  ctx.drawImage(layerCtx.canvas, 0, 0);
  ctx.restore();
}


// ---------------------------------------------------------------- morph helpers (one shape becomes the next)
// resample a closed dense contour to exactly n points
export function toN(pts, n, closed = true) {
  const src = closed ? [...pts, pts[0]] : pts;
  const L = arclen(src), tot = L[L.length - 1] || 1;
  const out = []; let j = 1;
  const N = closed ? n : n - 1;
  for (let i = 0; i < n; i++) {
    const s = (tot * i) / N;
    while (j < L.length - 1 && L[j] < s) j++;
    const a = src[j - 1], b = src[j];
    const u = (s - L[j - 1]) / Math.max(1e-9, L[j] - L[j - 1]);
    out.push([a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u]);
  }
  return out;
}
export function signedArea(P) { let A = 0; for (let i = 0; i < P.length; i++) { const p = P[i], q = P[(i + 1) % P.length]; A += p[0] * q[1] - q[0] * p[1]; } return A / 2; }
export function centroid(P) { let x = 0, y = 0; for (const p of P) { x += p[0]; y += p[1]; } return [x / P.length, y / P.length]; }
// rotate B's start index (and fix orientation) so it best matches A point-for-point
export function alignTo(A, B) {
  const n = A.length;
  let Bp = B;
  if (Math.sign(signedArea(A)) !== Math.sign(signedArea(B))) Bp = [...B].reverse();
  const ca = centroid(A), cb = centroid(Bp);
  let best = 0, bd = Infinity;
  const stepK = Math.max(1, Math.floor(n / 90));
  for (let k = 0; k < n; k += stepK) {
    let d = 0;
    for (let i = 0; i < n; i += 3) { const a = A[i], b = Bp[(i + k) % n]; const dx = (a[0] - ca[0]) - (b[0] - cb[0]), dy = (a[1] - ca[1]) - (b[1] - cb[1]); d += dx * dx + dy * dy; }
    if (d < bd) { bd = d; best = k; }
  }
  return Bp.map((_, i) => Bp[(i + best) % n]);
}
const MORPH_CACHE = new Map();
// morph closed contour A -> B by u (0..1); key caches the alignment
export function morph(A, B, u, n = 220, key = null) {
  let pair = key && MORPH_CACHE.get(key);
  if (!pair) {
    const a = toN(A, n), b = alignTo(a, toN(B, n));
    pair = [a, b];
    if (key) MORPH_CACHE.set(key, pair);
  }
  const [a, b] = pair;
  return a.map((p, i) => [p[0] + (b[i][0] - p[0]) * u, p[1] + (b[i][1] - p[1]) * u]);
}
// closed polyline -> path on ctx
export function pathPts(ctx, P, close = true) {
  ctx.moveTo(P[0][0], P[0][1]);
  for (let i = 1; i < P.length; i++) ctx.lineTo(P[i][0], P[i][1]);
  if (close) ctx.closePath();
}
// quantise time to drawings "on n's"
export const onN = (t, fps, n) => Math.floor(t * fps / n) * n / fps;
// ellipse points
export function ellPts(cx, cy, rx, ry, n = 0, a0 = 0) {
  n = n || Math.max(16, Math.round((Math.PI * (rx + ry)) / 5));
  const out = [];
  for (let i = 0; i < n; i++) { const a = a0 + (i / n) * Math.PI * 2; out.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)]); }
  return out;
}
export function rrectPts(x, y, w, h, r, step = 5) {
  const out = []; r = Math.min(r, w / 2, h / 2);
  const arc = (cx, cy, a0) => { const n = Math.max(4, Math.round((Math.PI / 2) * r / step)); for (let i = 0; i <= n; i++) { const a = a0 + (i / n) * Math.PI / 2; out.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); } };
  arc(x + w - r, y + r, -Math.PI / 2); arc(x + w - r, y + h - r, 0); arc(x + r, y + h - r, Math.PI / 2); arc(x + r, y + r, Math.PI);
  return resample(out, step, true);
}
