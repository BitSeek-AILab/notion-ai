// Line-art primitives (02-line-art × 05-cel-boil): screen-space boil re-rolled on 2s, round caps, glowing pen tip.
import { PAL, N3, clamp, lerp, hs, E } from './engine.js';

export const BOIL = { seed: 0, amp: 1.05, scale: 95 };
// displace a screen point by the current boil field (coincident points move together → incidences stay visually exact)
export function bp(p) {
  const z = BOIL.seed * 2.371 + 0.5, s = BOIL.scale, a = BOIL.amp;
  return [p[0] + a * N3(p[0] / s, p[1] / s, z), p[1] + a * N3(p[0] / s + 41.3, p[1] / s - 17.9, z)];
}
export function rgba(hex, a = 1) {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}
export function mixHex(a, b, u) {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16)), pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  const m = pa.map((v, i) => Math.round(v + (pb[i] - v) * clamp(u)));
  return '#' + m.map((v) => v.toString(16).padStart(2, '0')).join('');
}
// subdivide + boil a straight screen segment
function segPts(a, b, step = 16) {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const m = Math.max(1, Math.ceil(L / step));
  const out = [];
  for (let k = 0; k <= m; k++) out.push(bp([a[0] + (b[0] - a[0]) * k / m, a[1] + (b[1] - a[1]) * k / m]));
  return out;
}
function strokePts(c, pts, o) {
  if (pts.length < 2) return;
  c.beginPath(); c.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]);
  if (o.closed) c.closePath();
  c.stroke();
}
function applyStyle(c, o) {
  c.lineCap = o.cap || 'round'; c.lineJoin = 'round';
  c.lineWidth = o.w ?? 3;
  c.strokeStyle = o.color || PAL.gold;
  if (o.dash) { c.setLineDash(o.dash); c.lineDashOffset = o.dashOff || 0; } else c.setLineDash([]);
}
// glowing pen tip
export function tip(c, p, r = 15, color = PAL.cream, a = 1) {
  if (a <= 0) return;
  c.save(); c.globalCompositeOperation = 'lighter';
  const g = c.createRadialGradient(p[0], p[1], 0, p[0], p[1], r);
  g.addColorStop(0, rgba('#FFFFFF', 0.95 * a)); g.addColorStop(0.3, rgba(color, 0.6 * a)); g.addColorStop(1, rgba(color, 0));
  c.fillStyle = g; c.beginPath(); c.arc(p[0], p[1], r, 0, Math.PI * 2); c.fill();
  c.restore();
}
// Liang–Barsky clip of a screen segment against a generous viewport (lines toward a far-away crossing stay cheap)
const CLIP = [-400, -400, 1480, 2320];
function clipSeg(a, b) {
  let t0 = 0, t1 = 1;
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const p = [-dx, dx, -dy, dy], q = [a[0] - CLIP[0], CLIP[2] - a[0], a[1] - CLIP[1], CLIP[3] - a[1]];
  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) { if (q[i] < 0) return null; continue; }
    const r = q[i] / p[i];
    if (p[i] < 0) { if (r > t1) return null; if (r > t0) t0 = r; } else { if (r < t0) return null; if (r < t1) t1 = r; }
  }
  return [t0, t1];
}
// straight line between SCREEN points a→b, drawn over [from, to] fraction. o: {w, color, alpha, halo, dash, tip}
export function sline(c, a, b, o = {}) {
  const f0 = clamp(o.from ?? 0), f1 = clamp(o.to ?? 1);
  if (f1 <= f0 || (o.alpha ?? 1) <= 0.003) return;
  let A = [lerp(a[0], b[0], f0), lerp(a[1], b[1], f0)], B = [lerp(a[0], b[0], f1), lerp(a[1], b[1], f1)];
  if (![A[0], A[1], B[0], B[1]].every(Number.isFinite)) return;
  const cl = clipSeg(A, B);
  if (!cl) return;
  if (cl[0] > 0 || cl[1] < 1) {
    const L = Math.hypot(B[0] - A[0], B[1] - A[1]);
    if (o.dash) o = { ...o, dashOff: (o.dashOff || 0) + cl[0] * L };
    const A2 = [lerp(A[0], B[0], cl[0]), lerp(A[1], B[1], cl[0])], B2 = [lerp(A[0], B[0], cl[1]), lerp(A[1], B[1], cl[1])];
    A = A2; B = B2;
  }
  const pts = segPts(A, B);
  c.save();
  c.globalAlpha *= o.alpha ?? 1;
  if (o.halo) { applyStyle(c, { ...o, w: (o.w ?? 3) * o.halo, dash: null }); c.globalAlpha *= 0.16; strokePts(c, pts, o); c.globalAlpha /= 0.16; }
  applyStyle(c, o);
  strokePts(c, pts, o);
  c.restore();
  if (o.tip && f1 < 1 && f1 > 0) tip(c, pts[pts.length - 1], o.tipR ?? 16, o.color || PAL.gold, (o.alpha ?? 1));
}
// world segment through projector P (3-D aware: width scales gently with depth)
export function wline(c, P, a, b, o = {}) {
  const pa = P(a), pb = P(b);
  const k = Math.sqrt((pa[2] + pb[2]) / 2);
  sline(c, pa, pb, { ...o, w: (o.w ?? 3) * (o.depth === false ? 1 : k) });
}
// polyline (screen points), draw-on by arc length fraction [from, to]
export function spoly(c, pts, o = {}) {
  if ((o.alpha ?? 1) <= 0.003 || pts.length < 2) return;
  const src = o.closed ? [...pts, pts[0]] : pts;
  const L = [0];
  for (let i = 1; i < src.length; i++) L.push(L[i - 1] + Math.hypot(src[i][0] - src[i - 1][0], src[i][1] - src[i - 1][1]));
  const tot = L[L.length - 1];
  const s0 = tot * clamp(o.from ?? 0), s1 = tot * clamp(o.to ?? 1);
  if (s1 - s0 < 0.5) return;
  const out = [];
  for (let i = 0; i < src.length - 1; i++) {
    const a = L[i], b = L[i + 1];
    if (b < s0 || a > s1) continue;
    const u0 = clamp((s0 - a) / Math.max(1e-9, b - a)), u1 = clamp((s1 - a) / Math.max(1e-9, b - a));
    const p = src[i], q = src[i + 1];
    if (!out.length) out.push([lerp(p[0], q[0], u0), lerp(p[1], q[1], u0)]);
    out.push([lerp(p[0], q[0], u1), lerp(p[1], q[1], u1)]);
  }
  const bpts = out.map(bp);
  const full = o.closed && (o.from ?? 0) <= 0 && (o.to ?? 1) >= 1;
  c.save(); c.globalAlpha *= o.alpha ?? 1;
  if (o.halo) { applyStyle(c, { ...o, w: (o.w ?? 3) * o.halo, dash: null }); c.globalAlpha *= 0.16; strokePts(c, bpts, { closed: full }); c.globalAlpha /= 0.16; }
  applyStyle(c, o);
  strokePts(c, bpts, { closed: full });
  c.restore();
  if (o.tip && (o.to ?? 1) < 1 && bpts.length) tip(c, bpts[bpts.length - 1], o.tipR ?? 16, o.color || PAL.gold, o.alpha ?? 1);
}
// point marker: dark core knock-out, coloured ring, cream centre. o: {r, color, s (scale), alpha, halo}
export function sdot(c, p, o = {}) {
  const s = o.s ?? 1, a = o.alpha ?? 1;
  if (s <= 0.01 || a <= 0.003) return;
  const r = (o.r ?? 9) * s, q = bp(p);
  c.save(); c.globalAlpha *= a;
  if (o.halo) {
    c.save(); c.globalCompositeOperation = 'lighter';
    const g = c.createRadialGradient(q[0], q[1], 0, q[0], q[1], r * o.halo);
    g.addColorStop(0, rgba(o.color || PAL.gold, 0.55)); g.addColorStop(1, rgba(o.color || PAL.gold, 0));
    c.fillStyle = g; c.beginPath(); c.arc(q[0], q[1], r * o.halo, 0, Math.PI * 2); c.fill(); c.restore();
  }
  c.beginPath(); c.arc(q[0], q[1], r + 3.5 * s, 0, Math.PI * 2); c.fillStyle = 'rgba(11,19,32,0.9)'; c.fill();
  c.beginPath(); c.arc(q[0], q[1], r, 0, Math.PI * 2); c.fillStyle = o.core || PAL.cream; c.fill();
  c.lineWidth = (o.ringW ?? 3) * Math.min(1, s); c.strokeStyle = o.color || PAL.gold; c.stroke();
  c.restore();
}
// translucent polygon (screen points)
export function sfill(c, pts, color, alpha) {
  if (alpha <= 0.003 || pts.length < 3) return;
  c.save(); c.globalAlpha *= alpha; c.fillStyle = color;
  c.beginPath(); const b = pts.map(bp); c.moveTo(b[0][0], b[0][1]); for (let i = 1; i < b.length; i++) c.lineTo(b[i][0], b[i][1]); c.closePath(); c.fill();
  c.restore();
}
// ---------------------------------------------------------------- cel FX
export function ringWave(c, p, u, o = {}) {
  if (u <= 0 || u >= 1) return;
  const R = (o.r0 ?? 10) + ((o.R ?? 160) - (o.r0 ?? 10)) * E.out3(u);
  c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha *= (1 - u) * (o.alpha ?? 1);
  c.lineWidth = (o.w ?? 5) * (1 - 0.7 * u); c.strokeStyle = o.color || PAL.cream;
  c.beginPath(); c.arc(p[0], p[1], R, 0, Math.PI * 2); c.stroke(); c.restore();
}
// tapered rays bursting out (cel impact)
export function rays(c, p, u, o = {}) {
  if (u <= 0 || u >= 1) return;
  const n = o.n ?? 14, R0 = o.R0 ?? 30, R1 = o.R1 ?? 260, seed = o.seed ?? 1;
  c.save(); c.globalCompositeOperation = 'lighter'; c.fillStyle = o.color || PAL.cream; c.globalAlpha *= (o.alpha ?? 1) * (1 - E.in2(u));
  for (let i = 0; i < n; i++) {
    const ang = (i / n) * Math.PI * 2 + (hs(seed, i) - 0.5) * 0.5 + (o.rot ?? 0);
    const len = (0.6 + 0.6 * hs(seed, i, 2));
    const a = R0 + (R1 - R0) * E.out3(u) * 0.55 * len, b = R0 + (R1 - R0) * E.out3(Math.min(1, u * 1.35)) * len;
    const w = (o.w ?? 7) * (1 - u) * (0.6 + 0.8 * hs(seed, i, 3));
    const cs = Math.cos(ang), sn = Math.sin(ang);
    c.beginPath();
    c.moveTo(p[0] + cs * a - sn * w * 0.15, p[1] + sn * a + cs * w * 0.15);
    c.lineTo(p[0] + cs * (a + b) / 2 - sn * w, p[1] + sn * (a + b) / 2 + cs * w);
    c.lineTo(p[0] + cs * b, p[1] + sn * b);
    c.lineTo(p[0] + cs * (a + b) / 2 + sn * w, p[1] + sn * (a + b) / 2 - cs * w);
    c.closePath(); c.fill();
  }
  c.restore();
}
// 4-point sparkle
export function sparkle(c, p, R, rot = 0, color = PAL.cream, a = 1) {
  if (a <= 0 || R <= 0.5) return;
  c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha *= a; c.fillStyle = color;
  c.translate(p[0], p[1]); c.rotate(rot);
  c.beginPath();
  for (let k = 0; k < 8; k++) { const r = k % 2 === 0 ? R : R * 0.18; const an = (k / 8) * Math.PI * 2; c.lineTo(Math.cos(an) * r, Math.sin(an) * r); }
  c.closePath(); c.fill(); c.restore();
}
// sparks flying out with drag
export function sparks(c, p, u, o = {}) {
  if (u <= 0 || u >= 1) return;
  const n = o.n ?? 18, seed = o.seed ?? 3, R = o.R ?? 220;
  c.save(); c.globalCompositeOperation = 'lighter'; c.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const ang = hs(seed, i) * Math.PI * 2, sp = 0.45 + 0.55 * hs(seed, i, 1);
    const d0 = R * sp * E.out3(u), d1 = R * sp * E.out3(Math.max(0, u - 0.12));
    const col = (o.colors || [PAL.cream])[i % (o.colors || [PAL.cream]).length];
    c.strokeStyle = col; c.globalAlpha = (1 - u) * (o.alpha ?? 1); c.lineWidth = (o.w ?? 3.2) * (1 - u * 0.6);
    c.beginPath(); c.moveTo(p[0] + Math.cos(ang) * d1, p[1] + Math.sin(ang) * d1); c.lineTo(p[0] + Math.cos(ang) * d0, p[1] + Math.sin(ang) * d0); c.stroke();
  }
  c.restore();
}
