// 黄毛理论 v2 · math, easing, hashing, keyframes, polygons, morph (pure, no DOM)
export function hs(...a) {
  let h = 2166136261 >>> 0;
  for (const v of a) {
    h = Math.imul(h ^ ((Math.round(v * 997) | 0) >>> 0), 16777619) >>> 0;
    h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995) >>> 0; h ^= h >>> 15;
  }
  return (h >>> 0) / 4294967296;
}
export const hr = (a, b, ...s) => a + (b - a) * hs(...s);
export const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const inv = (a, b, x) => clamp((x - a) / (b - a));
export const sstep = (a, b, x) => { const t = inv(a, b, x); return t * t * (3 - 2 * t); };
export const D2R = Math.PI / 180;
export const E = {
  lin: (t) => t,
  in2: (t) => t * t,
  out2: (t) => 1 - (1 - t) * (1 - t),
  in3: (t) => t * t * t,
  out3: (t) => 1 - Math.pow(1 - t, 3),
  out4: (t) => 1 - Math.pow(1 - t, 4),
  out5: (t) => 1 - Math.pow(1 - t, 5),
  io2: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  io3: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  io4: (t) => (t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2),
  outBack: (t, s = 1.70158) => 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2),
  inBack: (t, s = 1.70158) => (s + 1) * t * t * t - s * t * t,
  // the flat-vector "soul": cubic-bezier(0.34,1.56,0.64,1)
  pop: (t) => bez(0.34, 1.56, 0.64, 1, t),
  outElastic: (t) => (t <= 0 ? 0 : t >= 1 ? 1 : Math.pow(2, -9 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI / 3.2)) + 1),
};
// cubic-bezier easing (CSS semantics), solved by Newton + bisection
const BZ = new Map();
export function bez(x1, y1, x2, y2, t) {
  if (t <= 0) return 0; if (t >= 1) return 1;
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const X = (u) => ((ax * u + bx) * u + cx) * u, Y = (u) => ((ay * u + by) * u + cy) * u, dX = (u) => (3 * ax * u + 2 * bx) * u + cx;
  let u = t;
  for (let i = 0; i < 8; i++) { const e = X(u) - t; if (Math.abs(e) < 1e-6) break; const d = dX(u); if (Math.abs(d) < 1e-6) break; u -= e / d; }
  if (u < 0 || u > 1 || Math.abs(X(u) - t) > 1e-4) { let lo = 0, hi = 1; u = t; for (let i = 0; i < 30; i++) { const x = X(u); if (Math.abs(x - t) < 1e-6) break; if (x < t) lo = u; else hi = u; u = (lo + hi) / 2; } }
  return Y(u);
}
// keyframes: [[t, v], [t, v, ease], ...]
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
// 0 before t0, eased 0..1 over d
export const ramp = (t, t0, d, e = 'io2') => (t <= t0 ? 0 : t >= t0 + d ? 1 : (typeof e === 'function' ? e : E[e])((t - t0) / d));
// elastic pop-in scale: 0 -> 1.15 -> 1 (about 8 frames)
export const popS = (t, t0, d = 0.27) => (t <= t0 ? 0 : t >= t0 + d ? 1 : E.pop((t - t0) / d));
// anticipation -> burst -> settle (squash & stretch helper): returns {sx, sy}
export function squash(t, t0, amt = 0.12, d = 0.35) {
  const u = (t - t0) / d;
  if (u < 0 || u > 1) return { sx: 1, sy: 1 };
  const k = Math.sin(u * Math.PI * 2.2) * Math.exp(-u * 4) * amt;
  return { sx: 1 + k, sy: 1 - k };
}
export const pulse = (t, t0, k = 9) => (t < t0 ? 0 : Math.exp(-(t - t0) * k));
// spring settle from overshoot (damped)
export const spring = (t, t0, f = 3.2, z = 5.5) => (t <= t0 ? 0 : 1 - Math.exp(-(t - t0) * z) * Math.cos((t - t0) * f * 2 * Math.PI));
export const wob = (t, f = 1, a = 1, ph = 0) => a * Math.sin(t * f * 2 * Math.PI + ph);

// ---------------------------------------------------------------- polygons
export function arclen(pts, closed = false) {
  const L = [0];
  for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  if (closed && pts.length > 1) L.push(L[L.length - 1] + Math.hypot(pts[0][0] - pts[pts.length - 1][0], pts[0][1] - pts[pts.length - 1][1]));
  return L;
}
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
export function signedArea(P) { let A = 0; for (let i = 0; i < P.length; i++) { const p = P[i], q = P[(i + 1) % P.length]; A += p[0] * q[1] - q[0] * p[1]; } return A / 2; }
export function centroid(P) { let x = 0, y = 0; for (const p of P) { x += p[0]; y += p[1]; } return [x / P.length, y / P.length]; }
export function alignTo(A, B) {
  const n = A.length;
  let Bp = B;
  if (Math.sign(signedArea(A)) !== Math.sign(signedArea(B))) Bp = [...B].reverse();
  const ca = centroid(A), cb = centroid(Bp);
  let best = 0, bd = Infinity;
  for (let k = 0; k < n; k++) {
    let d = 0;
    for (let i = 0; i < n; i += 2) { const a = A[i], b = Bp[(i + k) % n]; const dx = (a[0] - ca[0]) - (b[0] - cb[0]), dy = (a[1] - ca[1]) - (b[1] - cb[1]); d += dx * dx + dy * dy; }
    if (d < bd) { bd = d; best = k; }
  }
  return Bp.map((_, i) => Bp[(i + best) % n]);
}
const MC = new Map();
// morph closed contours given as functions of nothing (static point lists); cache alignment by key
export function morph(A, B, u, n = 160, key = null) {
  let pair = key && MC.get(key);
  if (!pair) { const a = toN(A, n), b = alignTo(a, toN(B, n)); pair = [a, b]; if (key) MC.set(key, pair); }
  const [a, b] = pair;
  return a.map((p, i) => [p[0] + (b[i][0] - p[0]) * u, p[1] + (b[i][1] - p[1]) * u]);
}
export function circlePts(cx, cy, r, n = 64, ry = null) {
  const out = [];
  for (let i = 0; i < n; i++) { const a = -Math.PI / 2 + (i / n) * Math.PI * 2; out.push([cx + r * Math.cos(a), cy + (ry ?? r) * Math.sin(a)]); }
  return out;
}
export function rrectPts(x, y, w, h, r, n = 8) {
  const out = []; r = Math.min(r, w / 2, h / 2);
  const arc = (cx, cy, a0) => { for (let i = 0; i <= n; i++) { const a = a0 + (i / n) * Math.PI / 2; out.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); } };
  arc(x + w - r, y + r, -Math.PI / 2); arc(x + w - r, y + h - r, 0); arc(x + r, y + h - r, Math.PI / 2); arc(x + r, y + r, Math.PI);
  return out;
}
export function heartPts(cx, cy, s, n = 96) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const x = 16 * Math.pow(Math.sin(a), 3);
    const y = 13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a);
    out.push([cx + (x * s) / 17, cy - (y * s) / 17]);
  }
  return out;
}
export function starPts(cx, cy, r1, r2, k = 5, rot = -Math.PI / 2) {
  const out = [];
  for (let i = 0; i < 2 * k; i++) { const a = rot + (i / (2 * k)) * Math.PI * 2, r = i % 2 ? r2 : r1; out.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
  return out;
}
// comic burst ("爆炸框"): jagged star with hashed spike lengths
export function burstPts(cx, cy, rx, ry, k = 14, seed = 1, jag = 0.28) {
  const out = [];
  for (let i = 0; i < 2 * k; i++) {
    const a = -Math.PI / 2 + (i / (2 * k)) * Math.PI * 2 + (hs(seed, i, 3) - 0.5) * 0.12;
    const r = i % 2 ? 1 - jag - hs(seed, i) * 0.08 : 1 + hs(seed, i, 7) * 0.12;
    out.push([cx + rx * r * Math.cos(a), cy + ry * r * Math.sin(a)]);
  }
  return out;
}
export const rot2 = (x, y, a) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
export function xf(P, o) {
  const { x = 0, y = 0, r = 0, sx = 1, sy = 1 } = o;
  const c = Math.cos(r), s = Math.sin(r);
  return P.map((p) => { const px = p[0] * sx, py = p[1] * sy; return [x + px * c - py * s, y + px * s + py * c]; });
}
// Catmull-Rom through points (open)
export function crp(p0, p1, p2, p3, t) {
  const t2 = t * t, t3 = t2 * t;
  return [0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
          0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3)];
}
export function spline(P, closed = false, m = 8) {
  const n = P.length, out = [];
  if (n < 3) return P.map((p) => [p[0], p[1]]);
  const segN = closed ? n : n - 1;
  for (let i = 0; i < segN; i++) {
    const p1 = P[i], p2 = P[(i + 1) % n];
    const p0 = closed ? P[(i - 1 + n) % n] : (i - 1 < 0 ? p1 : P[i - 1]);
    const p3 = closed ? P[(i + 2) % n] : (i + 2 >= n ? p2 : P[i + 2]);
    for (let k = 0; k < m; k++) out.push(crp(p0, p1, p2, p3, k / m));
  }
  if (!closed) out.push([P[n - 1][0], P[n - 1][1]]);
  return out;
}
// colour helpers
export function hex2rgb(h) { const v = parseInt(h.slice(1), 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; }
export function rgb2hex(r, g, b) { return '#' + [r, g, b].map((x) => Math.round(clamp(x, 0, 255)).toString(16).padStart(2, '0')).join(''); }
export function mix(a, b, u) { const A = hex2rgb(a), Bc = hex2rgb(b); return rgb2hex(lerp(A[0], Bc[0], u), lerp(A[1], Bc[1], u), lerp(A[2], Bc[2], u)); }
export const shade = (c, k) => (k >= 0 ? mix(c, '#ffffff', k) : mix(c, '#17153a', -k));
