// 黄毛理论 · shared state + helpers (canvas ctx is a live binding set by film.init)
import { PAL, hs, clamp, lerp, E, K, spline, resample, prefix, arclen, toN, inkStroke, inkLoop, fillShape, boil, signedArea, centroid, rrectPts } from './engine.js';
import { letters, measure, popIn, flyOut } from './text.js';
import { REG } from './shapes.js';

export const W = 1080, H = 1920, FPS = 30;
export const BPM = 112.9, PH = 0.082, BEAT = 60 / BPM;
export const bt = (n) => PH + n * BEAT;
export const B = Array.from({ length: 27 }, (_, k) => bt(4 * k));
export const DUR = 53.2;
export const E8 = BEAT / 2, E16 = BEAT / 4;

export let c = null;
export function setCtx(x) { c = x; }

export const pulse = (t, t0, k = 9) => (t < t0 ? 0 : Math.exp(-(t - t0) * k));
export function beatPulse(t, beats, k = 9) { let p = 0; for (const b of beats) p = Math.max(p, pulse(t, b, k)); return p; }
export const beatsIn = (a, b) => { const o = []; for (let n = 0; n < 120; n++) { const x = bt(n); if (x >= a - 1e-6 && x < b - 1e-6) o.push(x); } return o; };
export const appear = (t, t0, d = 0.25, s = 2.2) => (t < t0 ? 0 : E.outBack(clamp((t - t0) / d), s));
export const vanish = (t, t0, d = 0.16) => 1 - E.in2(clamp((t - t0) / d));
export const win = (t, a, b) => t >= a && t < b;
export const ioL = (u) => E.io3(clamp(u));
export const slam = (t, t0) => (t < t0 ? 0 : K(t, [[t0, 2.3], [t0 + 0.09, 0.9, 'in2'], [t0 + 0.17, 1.06, 'out2'], [t0 + 0.27, 1, 'io2']]));
export const lerpPt = (a, b, u) => [lerp(a[0], b[0], u), lerp(a[1], b[1], u)];

// text in/out: pop in at tIn (stagger), shrink out at tOut
export function say(str, t, tIn, tOut, o = {}) {
  if (t < tIn || t >= tOut + 0.2) return null;
  const st = o.st ?? 0.05;
  const inA = popIn(t, tIn, st, o.dur ?? 0.26, { rot: o.rot ?? 0.25, drop: o.drop ?? 0, seed: o.seed ?? 3 });
  const anim = (i, n) => {
    const a = inA(i, n);
    if (t >= tOut) { const u = clamp((t - tOut - (n - 1 - i) * 0.012) / 0.12); a.s = (a.s ?? 1) * (1 - E.in2(u)); a.dy = (a.dy ?? 0) - 30 * u; }
    if (o.color && o.color[i]) a.fill = o.color[i];
    if (o.wobble) a.r = (a.r ?? 0) + o.wobble * Math.sin(t * 9 + i * 1.3);
    if (o.punch) a.s = (a.s ?? 1) * (1 + o.punch);
    if (o.jit) { const f = Math.floor(t * 15); a.dx = (a.dx ?? 0) + o.jit * (hs(f, i, 1) - 0.5); a.dy = (a.dy ?? 0) + o.jit * (hs(f, i, 2) - 0.5); }
    return a;
  };
  return letters(c, str, { ...o, anim });
}
export const HL = (str, t, tIn, tOut, y, o = {}) => say(str, t, tIn, tOut, { font: 'KL', size: o.size ?? 118, x: o.x ?? 540, y, fill: o.fill ?? PAL.hi, ink: PAL.ink, inkW: o.inkW ?? 6.5, shadow: o.shadow === undefined ? PAL.ink : o.shadow, D: o.D, seed: o.seed ?? 50, st: o.st ?? 0.045, rot: o.rot ?? 0.3, color: o.color, align: o.align, punch: o.punch, tracking: o.tracking, wobble: o.wobble, jit: o.jit, dur: o.dur });
export const SUB = (str, t, tIn, tOut, y, o = {}) => say(str, t, tIn, tOut, { font: 'MK', size: o.size ?? 58, x: o.x ?? 540, y, fill: o.fill ?? PAL.ink, ink: o.ink ?? null, inkW: o.inkW, D: o.D, seed: o.seed ?? 60, st: o.st ?? 0.022, rot: 0.1, color: o.color, align: o.align, shadow: o.shadow ?? null });
// colour map helper: indices of chars to tint
export const tint = (str, chars, col) => { const o = {}; [...str].forEach((ch, i) => { if (chars.includes(ch)) o[i] = col; }); return o; };

export function swash(x0, x1, y, u, D, k, color = '#ffc61a', w = 34, alpha = 0.92) {
  if (u <= 0) return;
  const pts = [];
  for (let i = 0; i <= 12; i++) { const v = i / 12; pts.push([lerp(x0, x1, v), y + 7 * Math.sin(v * 3.1 + k)]); }
  const pr = prefix(spline(pts, false, 6), E.out2(clamp(u)));
  if (pr.length < 2) return;
  c.save(); c.globalAlpha *= alpha;
  inkStroke(c, pr, { seed: D * 13 + k, w, amp: 1.2, color, t0: 8, t1: 14, dense: true, heavy: 0, jit: 0.2 });
  c.restore();
}

// closed-contour morph with cached alignment
const MC = new Map();
export function morphW(A, Bc, u, key, n = 240) {
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
export function drawMorph(P, fill, D, k, o = {}) {
  if (fill) fillShape(c, P, fill, { seed: D * 13 + k, amp: o.amp ?? 1.5, dx: o.reg === false ? 0 : REG.dx, dy: o.reg === false ? 0 : REG.dy });
  if (o.w !== 0) inkLoop(c, P, { seed: D * 13 + k, w: o.w ?? 7.5, amp: o.amp ?? 1.5, heavy: 0.3, color: o.ink ?? PAL.ink });
}
// open polyline morph (same point count)
export function lerpLine(A, Bl, u, n = 120) { const a = toN(A, n, false), b = toN(Bl, n, false); return a.map((p, i) => lerpPt(p, b[i], u)); }
export function line(P, D, k, o = {}) { // ink a dense/control open polyline
  return inkStroke(c, o.dense ? P : spline(P, false, 4), { seed: D * 13 + k, w: o.w ?? 8, amp: o.amp ?? 1.4, t0: o.t0 ?? 6, t1: o.t1 ?? 10, dense: true, color: o.color ?? PAL.ink, heavy: o.heavy ?? 0.15, jit: o.jit ?? 0.25 });
}
// pill label / card helper
export function card(x, y, w, h, r, fill, D, k, o = {}) {
  const Pc = rrectPts(x - w / 2, y - h / 2, w, h, r, 5);
  fillShape(c, Pc, fill, { seed: D * 13 + k, amp: o.amp ?? 1, dx: o.dx ?? REG.dx, dy: o.dy ?? REG.dy });
  inkLoop(c, Pc, { seed: D * 13 + k, w: o.w ?? 6, amp: o.amp ?? 1.1, heavy: 0.3, color: o.ink ?? PAL.ink });
  return Pc;
}
export { letters, measure, popIn, flyOut };
