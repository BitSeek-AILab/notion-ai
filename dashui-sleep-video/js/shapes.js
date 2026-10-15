// Shape library — every object is a closed hand-inked contour that can morph into the next one.
// (phone → pillow → cloud → “?” → clock → brain → … → battery → pillow → gauge → bars → phone)
import { PAL, hs, hr, clamp, lerp, inv, sstep, E, spline, resample, xf, boil, inkStroke, inkLoop, fillShape, fillPoly,
  polyPath, toN, morph, pathPts, ellPts, rrectPts, circlePts, N3, outline, arclen, prefix } from './engine.js';
import { letters } from './text.js';

export const REG = { dx: -5, dy: 4 }; // colour-to-line registration offset (hand colouring)
const CACHE = new Map();
export const memo = (k, f) => { if (!CACHE.has(k)) CACHE.set(k, f()); return CACHE.get(k); };
export const T = (x, y, s = 1, r = 0, sx = 1, sy = 1) => ({ x, y, r, sx: s * sx, sy: s * sy });
export const seedOf = (D, k) => D * 13 + k * 101;
// child transform: place a part at local (x, y) of parent tf, with relative scale s and rotation r
export const sub = (tf, x, y, s = 1, r = 0) => { const q = xf([[x, y]], tf)[0]; return { x: q[0], y: q[1], r: (tf.r || 0) + r, sx: tf.sx * s, sy: tf.sy * s }; };
const dense = (P, step = 4) => resample(spline(P, true, step), step, true);

// generic: fill + ink a closed dense local contour under transform tf
export function inked(c, dn, tf, D, k, o = {}) {
  const P = xf(dn, tf);
  const sd = seedOf(D, k);
  if (o.fill) fillShape(c, P, o.fill, { seed: sd, amp: o.amp ?? 1.6, dx: o.reg === false ? 0 : REG.dx, dy: o.reg === false ? 0 : REG.dy });
  if (o.w !== 0) inkLoop(c, P, { seed: sd, w: o.w ?? 7, amp: o.amp ?? 1.8, heavy: o.heavy ?? 0.3, color: o.ink ?? PAL.ink, splits: o.splits ?? 1 });
  return P;
}
export function stroke(c, P, tf, D, k, o = {}) { // open ink stroke from local control points
  return inkStroke(c, xf(P, tf), { seed: seedOf(D, k), w: o.w ?? 6, amp: o.amp ?? 1.6, t0: o.t0 ?? 10, t1: o.t1 ?? 16, color: o.color ?? PAL.ink, heavy: o.heavy ?? 0, jit: o.jit ?? 0.3, step: o.step ?? 5 });
}
export function dot(c, x, y, r, color, D, k, amp = 0.8) {
  const P = boil(circlePts(x, y, r, Math.max(10, Math.round(r * 1.2))), seedOf(D, k), amp, 40);
  fillPoly(c, P, color);
}
// dashed ink along a closed world-space polyline
export function dashed(c, P, D, k, o = {}) {
  const { dash = 24, gap = 16, w = 3.6, color = PAL.ink } = o;
  const Q = [...P, P[0]], L = arclen(Q), tot = L[L.length - 1];
  let j = 1, n = 0;
  const at = (s) => { while (j < L.length - 1 && L[j] < s) j++; const u = (s - L[j - 1]) / Math.max(1e-9, L[j] - L[j - 1]); return [lerp(Q[j - 1][0], Q[j][0], u), lerp(Q[j - 1][1], Q[j][1], u)]; };
  for (let s = 0; s + dash < tot; s += dash + gap, n++) {
    j = 1; const a = at(s), m = at(s + dash * 0.5), b = at(s + dash);
    inkStroke(c, [a, m, b], { seed: seedOf(D, k + n), w, amp: 0.8, t0: 3, t1: 3, color, heavy: 0 });
  }
}

// ------------------------------------------------------------------ faces
export function drawFace(c, tf, o) {
  const { D = 0, kind = 'happy', y = 0, gap = 40, size = 1, look = [0, 0], k = 80 } = o;
  const s = size;
  const lx = look[0] || 0, ly = look[1] || 0;
  const eyeL = [-gap + lx, y + ly], eyeR = [gap + lx, y + ly];
  const toW = (p) => xf([p], tf)[0];
  const sc = Math.abs(tf.sx);
  const eyeDot = (e, ry = 1) => { const q = toW(e); const R = 15 * s * sc; const pts = boil(ellPts(q[0], q[1], R * 0.82, R * ry, 16), seedOf(D, k + e[0]), 0.6, 30); fillPoly(c, pts, PAL.ink); dot(c, q[0] - R * 0.25, q[1] - R * 0.35 * ry, R * 0.3, '#fff', D, k + 3 + e[0], 0.2); };
  const arc = (cx, cy, rx, ry, a0, a1, w, kk, col = PAL.ink) => { const pts = []; for (let i = 0; i <= 10; i++) { const a = lerp(a0, a1, i / 10); pts.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)]); } stroke(c, pts, tf, D, kk, { w: w * s, t0: 3, t1: 3, color: col }); };
  const line = (P, w, kk, col = PAL.ink) => stroke(c, P, tf, D, kk, { w: w * s, t0: 3, t1: 3, color: col });
  const wavy = (cx, cy, wd, amp, waves, w, kk) => { const pts = []; for (let i = 0; i <= 12; i++) { const u = i / 12; pts.push([cx - wd / 2 + wd * u, cy + amp * Math.sin(u * Math.PI * waves)]); } line(pts, w, kk); };
  // blush
  if (kind !== 'cool' && kind !== 'wilt' && kind !== 'angry') {
    const hot = kind === 'drunk';
    for (const e of [eyeL, eyeR]) {
      const q = toW([e[0] + (e[0] < lx ? -14 : 14) * s, e[1] + 30 * s]);
      const pts = boil(ellPts(q[0], q[1], (hot ? 28 : 20) * s * sc, (hot ? 15 : 11) * s * sc, 14), seedOf(D, k + 9), 0.6, 30);
      c.save(); c.globalAlpha *= hot ? 0.8 : 0.55; fillPoly(c, pts, hot ? '#ff5d5d' : PAL.pink); c.restore();
    }
  }
  if (kind === 'happy' || kind === 'strong') {
    eyeDot(eyeL); eyeDot(eyeR);
    arc(lx, y + 22 * s + ly, 22 * s, 16 * s, 0.15 * Math.PI, 0.85 * Math.PI, 5, k + 20);
    if (kind === 'strong') { arc(eyeL[0], eyeL[1] - 28 * s, 16 * s, 8 * s, 1.15 * Math.PI, 1.85 * Math.PI, 4.5, k + 21); arc(eyeR[0], eyeR[1] - 28 * s, 16 * s, 8 * s, 1.15 * Math.PI, 1.85 * Math.PI, 4.5, k + 22); }
  } else if (kind === 'smug') {
    eyeDot([eyeL[0], eyeL[1] + 3 * s], 0.7); eyeDot([eyeR[0], eyeR[1] + 3 * s], 0.7);
    line([[eyeL[0] - 18 * s, eyeL[1] - 8 * s], [eyeL[0] + 16 * s, eyeL[1] - 10 * s]], 5, k + 23);
    line([[eyeR[0] - 16 * s, eyeR[1] - 10 * s], [eyeR[0] + 18 * s, eyeR[1] - 8 * s]], 5, k + 24);
    line([[lx - 22 * s, y + 34 * s + ly], [lx + 4 * s, y + 40 * s + ly], [lx + 26 * s, y + 26 * s + ly]], 5, k + 25);
  } else if (kind === 'shock') {
    for (const e of [eyeL, eyeR]) { const q = toW(e); const R = 17 * s * sc; const pts = boil(circlePts(q[0], q[1], R, 16), seedOf(D, k + e[0]), 0.6, 30); fillPoly(c, pts, '#fff'); inkLoop(c, pts, { seed: seedOf(D, k + 31), w: 4 * s * sc, amp: 0.5 }); dot(c, q[0], q[1], R * 0.42, PAL.ink, D, k + 32 + e[0], 0.3); }
    const q = toW([lx, y + 40 * s + ly]); const pts = boil(ellPts(q[0], q[1], 13 * s * sc, 17 * s * sc, 16), seedOf(D, k + 33), 0.6, 30); fillPoly(c, pts, PAL.ink);
  } else if (kind === 'wilt') {
    arc(eyeL[0], eyeL[1], 15 * s, 8 * s, 0.1 * Math.PI, 0.9 * Math.PI, 5, k + 40);
    arc(eyeR[0], eyeR[1], 15 * s, 8 * s, 0.1 * Math.PI, 0.9 * Math.PI, 5, k + 41);
    wavy(lx, y + 40 * s + ly, 48 * s, 5 * s, 3, 4.5, k + 42);
  } else if (kind === 'blink' || kind === 'wink') {
    if (kind === 'wink') eyeDot(eyeL); else arc(eyeL[0], eyeL[1] - 4 * s, 15 * s, 8 * s, 1.1 * Math.PI, 1.9 * Math.PI, 5, k + 50);
    arc(eyeR[0], eyeR[1] - 4 * s, 15 * s, 8 * s, 1.1 * Math.PI, 1.9 * Math.PI, 5, k + 51);
    arc(lx, y + 22 * s + ly, 22 * s, 16 * s, 0.15 * Math.PI, 0.85 * Math.PI, 5, k + 52);
  } else if (kind === 'dizzy') {
    for (const e of [eyeL, eyeR]) { const pts = []; for (let i = 0; i <= 24; i++) { const a = i / 24 * Math.PI * 3.2; const r = 2 + 14 * s * i / 24; pts.push([e[0] + r * Math.cos(a), e[1] + r * Math.sin(a)]); } stroke(c, pts, tf, D, k + 60 + e[0], { w: 3.8 * s, t0: 2, t1: 2 }); }
    wavy(lx, y + 40 * s + ly, 44 * s, 6 * s, 4, 4.5, k + 62);
  } else if (kind === 'cool') {
    for (const e of [eyeL, eyeR]) { const q = toW(e); const pts = boil(rrectPts(q[0] - 30 * s * sc, q[1] - 16 * s * sc, 60 * s * sc, 34 * s * sc, 14 * s * sc), seedOf(D, k + 70), 0.6, 30); fillPoly(c, pts, PAL.ink); line([[e[0] - 18 * s, e[1] - 6 * s], [e[0] - 6 * s, e[1] - 10 * s]], 4, k + 71 + e[0], '#fff'); }
    line([[eyeL[0] + 28 * s, eyeL[1] - 6 * s], [eyeR[0] - 28 * s, eyeR[1] - 6 * s]], 5, k + 73);
    arc(lx + 4 * s, y + 30 * s + ly, 22 * s, 12 * s, 0.1 * Math.PI, 0.8 * Math.PI, 5, k + 74);
  } else if (kind === 'sleep') {
    // closed eyes (lashes down) + small content smile
    arc(eyeL[0], eyeL[1], 17 * s, 10 * s, 0.08 * Math.PI, 0.92 * Math.PI, 5.5, k + 80);
    arc(eyeR[0], eyeR[1], 17 * s, 10 * s, 0.08 * Math.PI, 0.92 * Math.PI, 5.5, k + 81);
    arc(lx, y + 30 * s + ly, 12 * s, 8 * s, 0.15 * Math.PI, 0.85 * Math.PI, 4.5, k + 82);
  } else if (kind === 'tired') {
    eyeDot([eyeL[0], eyeL[1] + 6 * s], 0.5); eyeDot([eyeR[0], eyeR[1] + 6 * s], 0.5);
    line([[eyeL[0] - 20 * s, eyeL[1] - 1 * s], [eyeL[0] + 19 * s, eyeL[1] + 1 * s]], 5.5, k + 83);
    line([[eyeR[0] - 19 * s, eyeR[1] + 1 * s], [eyeR[0] + 20 * s, eyeR[1] - 1 * s]], 5.5, k + 84);
    arc(eyeL[0], eyeL[1] + 16 * s, 17 * s, 8 * s, 0.12 * Math.PI, 0.88 * Math.PI, 4, k + 85, '#7d5aa8');
    arc(eyeR[0], eyeR[1] + 16 * s, 17 * s, 8 * s, 0.12 * Math.PI, 0.88 * Math.PI, 4, k + 86, '#7d5aa8');
    wavy(lx, y + 46 * s + ly, 40 * s, 3.5 * s, 2, 4.5, k + 87);
  } else if (kind === 'drunk') {
    // one droopy eye + one swirl, wobbly grin
    eyeDot([eyeL[0], eyeL[1] + 5 * s], 0.5);
    line([[eyeL[0] - 20 * s, eyeL[1] - 2 * s], [eyeL[0] + 19 * s, eyeL[1] + 2 * s]], 5.5, k + 88);
    { const e = eyeR, pts = []; for (let i = 0; i <= 24; i++) { const a = i / 24 * Math.PI * 3.2; const r = 2 + 14 * s * i / 24; pts.push([e[0] + r * Math.cos(a), e[1] + r * Math.sin(a)]); } stroke(c, pts, tf, D, k + 89, { w: 3.8 * s, t0: 2, t1: 2 }); }
    const pts = []; for (let i = 0; i <= 14; i++) { const u = i / 14; pts.push([lx - 26 * s + 52 * s * u, y + 34 * s + ly + 10 * s * Math.sin(u * Math.PI) + 4 * s * Math.sin(u * Math.PI * 5)]); }
    line(pts, 5, k + 90);
  } else if (kind === 'yawn') {
    line([[eyeL[0] - 16 * s, eyeL[1] - 10 * s], [eyeL[0] + 14 * s, eyeL[1]], [eyeL[0] - 16 * s, eyeL[1] + 10 * s]], 5, k + 91);
    line([[eyeR[0] + 16 * s, eyeR[1] - 10 * s], [eyeR[0] - 14 * s, eyeR[1]], [eyeR[0] + 16 * s, eyeR[1] + 10 * s]], 5, k + 92);
    const q = toW([lx, y + 44 * s + ly]); const R = 20 * s * sc;
    const pts = boil(ellPts(q[0], q[1], R * 0.85, R * 1.15, 18), seedOf(D, k + 93), 0.6, 30);
    fillPoly(c, pts, '#7a2430'); inkLoop(c, pts, { seed: seedOf(D, k + 94), w: 4.5 * s * sc, amp: 0.5 });
  } else if (kind === 'angry') {
    eyeDot(eyeL); eyeDot(eyeR);
    line([[eyeL[0] - 20 * s, eyeL[1] - 30 * s], [eyeL[0] + 16 * s, eyeL[1] - 16 * s]], 6, k + 95);
    line([[eyeR[0] + 20 * s, eyeR[1] - 30 * s], [eyeR[0] - 16 * s, eyeR[1] - 16 * s]], 6, k + 96);
    line([[lx - 20 * s, y + 40 * s + ly], [lx - 10 * s, y + 32 * s + ly], [lx, y + 40 * s + ly], [lx + 10 * s, y + 32 * s + ly], [lx + 20 * s, y + 40 * s + ly]], 4.5, k + 97);
  }
}

// ------------------------------------------------------------------ small utilities
const DROP_C = [[0, -1.62, 1], [0.3, -1.14], [0.7, -0.64], [0.97, -0.1], [0.93, 0.42], [0.63, 0.82], [0.22, 1.0], [-0.22, 1.0], [-0.63, 0.82], [-0.93, 0.42], [-0.97, -0.1], [-0.7, -0.64], [-0.3, -1.14]];
export const dropDense = (R = 100) => memo('drop' + R, () => dense(DROP_C.map((p) => [p[0] * R, p[1] * R, p[2]])));
export function mixHex(a, b, u) {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16)), pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  const m = pa.map((v, i) => Math.round(v + (pb[i] - v) * clamp(u)));
  return '#' + m.map((v) => v.toString(16).padStart(2, '0')).join('');
}
// morph-fill colour: interpolate in HSL along the short hue arc (keeps transitions candy-bright, never muddy)
const rgb2hsl = ([r, g, b]) => {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  if (d < 1e-6) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
};
const hsl2hex = (h, s, l) => {
  const C = (1 - Math.abs(2 * l - 1)) * s, X = C * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - C / 2;
  const [r, g, b] = h < 60 ? [C, X, 0] : h < 120 ? [X, C, 0] : h < 180 ? [0, C, X] : h < 240 ? [0, X, C] : h < 300 ? [X, 0, C] : [C, 0, X];
  return '#' + [r, g, b].map((v) => Math.round(clamp(v + m) * 255).toString(16).padStart(2, '0')).join('');
};
export function mixHue(a, b, u) {
  u = clamp(u);
  const A = rgb2hsl([1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16))), Bq = rgb2hsl([1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16)));
  if (A[1] < 0.12) A[0] = Bq[0]; if (Bq[1] < 0.12) Bq[0] = A[0];   // greys/creams borrow the other hue
  let dh = Bq[0] - A[0]; if (dh > 180) dh -= 360; if (dh < -180) dh += 360;
  const sat = lerp(A[1], Bq[1], u) + 0.12 * Math.sin(Math.PI * u) * (1 - lerp(A[1], Bq[1], u));
  return hsl2hex((A[0] + dh * u + 360) % 360, clamp(sat), lerp(A[2], Bq[2], u));
}
export function drawCrown(c, tf, D) {
  const P = [[-60, 30, 1], [-66, -40, 1], [-30, -6, 1], [0, -56, 1], [30, -6, 1], [66, -40, 1], [60, 30, 1]];
  const W = xf(dense(P), tf);
  fillShape(c, W, PAL.yel, { seed: seedOf(D, 600), amp: 1, dx: REG.dx * 0.6, dy: REG.dy * 0.6 });
  inkLoop(c, W, { seed: seedOf(D, 600), w: 5.5, amp: 1 });
  for (const p of [[-66, -40], [0, -56], [66, -40]]) { const q = xf([p], tf)[0]; dot(c, q[0], q[1], 8 * Math.abs(tf.sx), PAL.red, D, 610 + p[0]); }
}
export function drawCheckbox(c, tf, st) {
  const D = st.D ?? 0;
  const Bx = xf(rrectPts(-42, -42, 84, 84, 14), tf);
  fillShape(c, Bx, PAL.hi, { seed: seedOf(D, 1100), amp: 1, dx: REG.dx * 0.6, dy: REG.dy * 0.6 });
  inkLoop(c, Bx, { seed: seedOf(D, 1100), w: 6, amp: 1.2 });
  const u = clamp(st.check ?? 0);
  if (u > 0) {
    const pr = prefix(spline([[-30, -2], [-8, 26], [44, -46]], false, 3), u);
    if (pr.length > 1) inkStroke(c, xf(pr, tf), { seed: seedOf(D, 1101), w: 13, amp: 1, color: PAL.red, t0: 4, t1: 6, dense: true });
  }
}
// hand-drawn "≈" (KuaiLe has no glyph for it)
export function drawApprox(c, x, y, s, D, col = PAL.ink) {
  for (const dy of [-14, 14]) {
    const pts = []; for (let i = 0; i <= 16; i++) { const u = i / 16; pts.push([x + (u - 0.5) * 70 * s, y + dy * s + Math.sin(u * Math.PI * 2) * -9 * s]); }
    inkStroke(c, pts, { seed: seedOf(D, 1200 + dy), w: 9 * s, amp: 1, t0: 3, t1: 3, color: col });
  }
}
export function drawArrow(c, pts, D, k, o = {}) {
  const P = spline(pts, false, 4);
  const u = clamp(o.draw ?? 1);
  const pr = prefix(P, u);
  if (pr.length < 2) return;
  inkStroke(c, pr, { seed: seedOf(D, k), w: o.w ?? 8, amp: 1.3, color: o.color ?? PAL.ink, t0: 6, t1: 6, dense: true });
  if (u >= 0.98) {
    const a = P[P.length - 1], b = P[P.length - 6] || P[0];
    const ang = Math.atan2(a[1] - b[1], a[0] - b[0]);
    const L = o.head ?? 34;
    for (const s of [-1, 1]) inkStroke(c, [[a[0], a[1]], [a[0] - Math.cos(ang + s * 0.55) * L, a[1] - Math.sin(ang + s * 0.55) * L]], { seed: seedOf(D, k + s), w: o.w ?? 8, amp: 1, color: o.color ?? PAL.ink, t0: 3, t1: 6 });
  }
}

// ------------------------------------------------------------------ phone (the 熬夜 villain)
export const phoneDense = () => memo('phone', () => rrectPts(-150, -285, 300, 570, 54, 4));
// st: {D, on (screen 0..1), time, face, look, glow}
export function drawPhone(c, tf, st) {
  const D = st.D ?? 0, sd = seedOf(D, 2000);
  const body = xf(phoneDense(), tf);
  fillShape(c, body, st.body ?? PAL.phone, { seed: sd, amp: 1.4, dx: REG.dx, dy: REG.dy });
  const on = st.on ?? 1;
  const scr = xf(rrectPts(-124, -246, 248, 482, 30, 4), tf);
  fillShape(c, scr, mixHex('#454a66', PAL.screen, on), { seed: sd + 1, amp: 1.0, dx: 0, dy: 0 });
  if (on > 0.5) {
    stroke(c, [[-96, -150], [-60, -206]], tf, D, 2003, { w: 16, color: '#ffffff', t0: 6, t1: 6 });
    stroke(c, [[-96, -96], [-82, -118]], tf, D, 2004, { w: 12, color: '#ffffff', t0: 4, t1: 4 });
  }
  inkLoop(c, scr, { seed: sd + 1, w: 4.5, amp: 1.0, heavy: 0 });
  stroke(c, [[-34, -266], [34, -266]], tf, D, 2005, { w: 9, t0: 2, t1: 2, color: '#151726' });
  stroke(c, [[-48, 258], [48, 258]], tf, D, 2006, { w: 7, t0: 2, t1: 2, color: '#151726' });
  inkLoop(c, body, { seed: sd, w: st.w ?? 7.5, amp: 1.6, heavy: 0.35 });
  if (st.time) {
    const q = xf([[0, -138]], tf)[0];
    c.save(); c.translate(q[0], q[1]); c.rotate(tf.r || 0); c.scale(tf.sx, tf.sy);
    letters(c, st.time, { font: 'KL', size: 76, x: 0, y: 0, fill: on > 0.5 ? PAL.phone : '#777b97', ink: null, D, seed: 2010, amp: 0.8 });
    c.restore();
  }
  if (st.face) drawFace(c, tf, { D, kind: st.face, y: 70, gap: 54, size: 1.2, look: st.look, k: 2020 });
  return body;
}

// ------------------------------------------------------------------ pillow (the 大睡 hero)
const PILLOW_C = [[-262, -150, 1], [-130, -166], [0, -172], [130, -166], [262, -150, 1], [276, -70], [282, 0], [276, 70], [262, 150, 1], [130, 166], [0, 172], [-130, 166], [-262, 150, 1], [-276, 70], [-282, 0], [-276, -70]];
export const pillowDense = () => memo('pillow', () => dense(PILLOW_C));
const pillowSeam = () => memo('pillowSeam', () => dense(PILLOW_C.map((p) => [p[0] * 0.86, p[1] * 0.8, p[2]])));
// st: {D, face, look, fill, shade, label}
export function drawPillow(c, tf, st) {
  const D = st.D ?? 0, sd = seedOf(D, 2100);
  const P = xf(pillowDense(), tf);
  fillShape(c, P, st.fill ?? PAL.pillow, { seed: sd, amp: 1.6, dx: REG.dx, dy: REG.dy });
  c.save(); c.beginPath(); pathPts(c, boil(P, sd + 0.5, 1.6, 70)); c.clip();
  fillPoly(c, xf([[-320, 92], [-160, 118], [0, 126], [160, 118], [320, 92], [320, 240], [-320, 240]], tf), st.shade ?? PAL.pillowS);
  c.restore();
  dashed(c, xf(pillowSeam(), tf), D, 2140, { dash: 22 * Math.abs(tf.sx), gap: 15 * Math.abs(tf.sx), w: 3.4, color: 'rgba(28,22,19,0.55)' });
  for (const [kx, ky] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    stroke(c, [[kx * 262, ky * 150], [kx * 236, ky * 118]], tf, D, 2110 + kx * 3 + ky, { w: 4, t0: 2, t1: 6 });
    stroke(c, [[kx * 262, ky * 150], [kx * 222, ky * 140]], tf, D, 2115 + kx * 3 + ky, { w: 4, t0: 2, t1: 6 });
  }
  stroke(c, [[-206, -112], [-130, -130], [-50, -134]], tf, D, 2120, { w: 13, color: PAL.hi, t0: 10, t1: 14 });
  inkLoop(c, P, { seed: sd, w: st.w ?? 7.5, amp: 1.8, heavy: 0.35 });
  if (st.label) {
    const q = xf([[0, 78]], tf)[0];
    c.save(); c.translate(q[0], q[1]); c.rotate(tf.r || 0); c.scale(tf.sx, tf.sy);
    letters(c, st.label, { font: 'KL', size: 70, x: 0, y: 0, fill: PAL.indigo, ink: PAL.ink, inkW: 3, D, seed: 2125, tracking: 6, amp: 0.8 });
    c.restore();
  }
  if (st.face) drawFace(c, tf, { D, kind: st.face, y: st.faceY ?? -14, gap: 74, size: 1.35, look: st.look, k: 2130 });
  return P;
}

// ------------------------------------------------------------------ cloud badge
export function cloudDense(rx, ry, n = 10, bulge = 0.42, key = 1) {
  return memo('cloud' + [rx, ry, n, bulge, key].join(','), () => {
    const pts = [];
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (i / n) * Math.PI * 2 + 0.17, a2 = -Math.PI / 2 + ((i + 1) / n) * Math.PI * 2 + 0.17;
      const r1 = 1 + 0.07 * (hs(key, i) - 0.5);
      pts.push([Math.cos(a) * rx * r1, Math.sin(a) * ry * r1, 1]);
      for (const f of [0.22, 0.5, 0.78]) {
        const am = lerp(a, a2, f);
        const out = 1 + bulge * Math.sin(f * Math.PI) * (0.8 + 0.4 * hs(key, i, 2)) * (2 * Math.PI / n);
        pts.push([Math.cos(am) * rx * out, Math.sin(am) * ry * out]);
      }
    }
    return dense(pts, 4);
  });
}

// ------------------------------------------------------------------ crescent moon
export const moonDense = (R = 100) => memo('moon' + R, () => {
  const cx2 = 0.46 * R, cy2 = -0.18 * R, r2 = 0.84 * R, N = 180, out = [], inn = [];
  const psi = Math.atan2(cy2, cx2);
  for (let i = 0; i < N; i++) { const a = psi + (i / N) * Math.PI * 2; const p = [R * Math.cos(a), R * Math.sin(a)]; if (Math.hypot(p[0] - cx2, p[1] - cy2) > r2) out.push(p); }
  for (let i = 0; i < N; i++) { const a = psi + (i / N) * Math.PI * 2; const p = [cx2 + r2 * Math.cos(a), cy2 + r2 * Math.sin(a)]; if (Math.hypot(p[0], p[1]) < R) inn.push(p); }
  const e = out[out.length - 1];
  const d0 = Math.hypot(inn[0][0] - e[0], inn[0][1] - e[1]), d1 = Math.hypot(inn[inn.length - 1][0] - e[0], inn[inn.length - 1][1] - e[1]);
  return resample([...out, ...(d0 < d1 ? inn : inn.reverse())], 4, true);
});
export function drawMoon(c, tf, st = {}) {
  const D = st.D ?? 0;
  const P = inked(c, moonDense(100), tf, D, 2200, { fill: PAL.moon, w: 6.5, amp: 1.3 });
  for (const [x, y, r] of [[-52, 10, 12], [-30, 52, 8], [-60, -40, 7]]) { const q = xf([[x, y]], tf)[0]; dot(c, q[0], q[1], r * Math.abs(tf.sx), '#efb83a', D, 2205 + x); }
  if (st.face) drawFace(c, tf, { D, kind: st.face, y: -6, gap: 20, size: 0.75, look: [-44, 0], k: 2210 });
  return P;
}

// ------------------------------------------------------------------ beer mug
const MUG_C = [[-96, -112, 1], [-84, -146], [-52, -150], [-30, -168], [2, -156], [30, -172], [62, -152], [92, -146], [100, -112, 1], [96, 118], [88, 136, 1], [-88, 136, 1], [-96, 118]];
export const mugDense = () => memo('mug', () => dense(MUG_C));
export function drawMug(c, tf, st = {}) {
  const D = st.D ?? 0, sd = seedOf(D, 2300);
  // handle (behind)
  const H = [[96, -70], [150, -72], [168, -20], [164, 40], [140, 74], [96, 72]];
  stroke(c, H, tf, D, 2301, { w: 34 * Math.abs(tf.sx), t0: 2, t1: 2, color: PAL.ink, step: 4 });
  stroke(c, H, tf, D, 2302, { w: 18 * Math.abs(tf.sx), t0: 2, t1: 2, color: '#ffe9b0', step: 4 });
  const P = xf(mugDense(), tf);
  fillShape(c, P, PAL.beer, { seed: sd, amp: 1.4, dx: REG.dx, dy: REG.dy });
  c.save(); c.beginPath(); pathPts(c, boil(P, sd + 0.5, 1.4, 70)); c.clip();
  fillPoly(c, xf([[-120, -200], [120, -200], [120, -92], [80, -80], [40, -96], [0, -78], [-40, -94], [-80, -80], [-120, -92]], tf), PAL.hi);
  for (let i = 0; i < 5; i++) { const ph = ((st.t ?? 0) * 0.5 + hs(i, 3)) % 1; const q = xf([[-60 + 120 * hs(i, 4), lerp(110, -60, ph)]], tf)[0]; inkLoop(c, circlePts(q[0], q[1], (6 + 4 * hs(i, 5)) * Math.abs(tf.sx), 10), { seed: sd + 9 + i, w: 2.6, amp: 0.5, color: PAL.hi, heavy: 0 }); }
  c.restore();
  stroke(c, [[-62, -40], [-62, 90]], tf, D, 2303, { w: 12, color: PAL.hi, t0: 8, t1: 8 });
  stroke(c, [[-20, -30], [-20, 100]], tf, D, 2304, { w: 5, color: 'rgba(28,22,19,0.35)', t0: 8, t1: 8 });
  stroke(c, [[24, -30], [24, 100]], tf, D, 2305, { w: 5, color: 'rgba(28,22,19,0.35)', t0: 8, t1: 8 });
  inkLoop(c, P, { seed: sd, w: 7, amp: 1.6, heavy: 0.3 });
  return P;
}

// ------------------------------------------------------------------ bathtub (side view)
const TUB_C = [[-352, -112, 1], [352, -112, 1], [352, -84, 1], [330, -80], [316, 10], [282, 92], [204, 140], [0, 150], [-204, 140], [-282, 92], [-316, 10], [-330, -80], [-352, -84, 1]];
export const tubDense = () => memo('tub', () => dense(TUB_C));
export function drawTubBack(c, tf, st = {}) { // faucet + back rim, drawn before what sits in the tub
  const D = st.D ?? 0;
  stroke(c, [[-300, -112], [-300, -236], [-280, -262], [-240, -262], [-222, -240], [-222, -214]], tf, D, 2401, { w: 26 * Math.abs(tf.sx), t0: 2, t1: 2, color: PAL.ink });
  stroke(c, [[-300, -112], [-300, -236], [-280, -262], [-240, -262], [-222, -240], [-222, -214]], tf, D, 2402, { w: 13 * Math.abs(tf.sx), t0: 2, t1: 2, color: '#c9d3dc' });
}
export function drawTub(c, tf, st = {}) {
  const D = st.D ?? 0, sd = seedOf(D, 2400);
  for (const kx of [-1, 1]) inked(c, dense([[kx * 230 - 30, 130, 1], [kx * 230 + 30, 130, 1], [kx * 230 + 24, 186], [kx * 230 + 40, 200, 1], [kx * 230 - 40, 200, 1], [kx * 230 - 24, 186]]), tf, D, 2410 + kx, { fill: PAL.gold, w: 5.5, amp: 1 });
  const P = xf(tubDense(), tf);
  fillShape(c, P, st.fill ?? '#f7f3ea', { seed: sd, amp: 1.6, dx: REG.dx, dy: REG.dy });
  c.save(); c.beginPath(); pathPts(c, boil(P, sd + 0.5, 1.6, 70)); c.clip();
  fillPoly(c, xf([[-400, 70], [-200, 104], [0, 112], [200, 104], [400, 70], [400, 260], [-400, 260]], tf), '#d9d2c4');
  c.restore();
  stroke(c, [[-330, -84], [330, -84]], tf, D, 2420, { w: 4.5, t0: 6, t1: 6 });
  stroke(c, [[-250, -40], [-262, 40], [-228, 100]], tf, D, 2421, { w: 12, color: PAL.hi, t0: 10, t1: 12 });
  inkLoop(c, P, { seed: sd, w: 7.5, amp: 1.8, heavy: 0.35 });
  return P;
}
export function drawDuck(c, tf, D, k = 2450) {
  const P = dense([[-62, 10], [-52, -18], [-20, -24], [-6, -52], [18, -70], [46, -62], [56, -40], [80, -36, 1], [56, -22], [44, -10], [62, 8], [52, 38], [10, 50], [-40, 44]]);
  inked(c, P, tf, D, k, { fill: PAL.yel, w: 5.5, amp: 1 });
  stroke(c, [[-34, 4], [-6, 12], [14, 0]], tf, D, k + 1, { w: 4.5, t0: 3, t1: 3 });
  const q = xf([[30, -48]], tf)[0]; dot(c, q[0], q[1], 6 * Math.abs(tf.sx), PAL.ink, D, k + 2, 0.3);
  inked(c, dense([[56, -40, 1], [84, -36, 1], [60, -24, 1]]), tf, D, k + 3, { fill: PAL.orange, w: 4, amp: 0.6 });
}

// ------------------------------------------------------------------ junk blob (代谢废物)
export const blobDense = (r, key) => memo('blob' + r + ',' + key, () => { const P = []; for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2 + hs(key, 1); const rr = r * (0.75 + 0.45 * hs(key, i)); P.push([Math.cos(a) * rr, Math.sin(a) * rr * 0.85]); } return dense(P, 3); });
export function drawJunk(c, x, y, r, rot, D, k) {
  const tf = { x, y, r: rot, sx: 1, sy: 1 };
  inked(c, blobDense(r, k % 7), tf, D, k, { fill: PAL.junk, w: 4.5, amp: 0.9, heavy: 0.2 });
  for (const [px, py] of [[-0.3, -0.15], [0.32, -0.12]]) {
    stroke(c, [[px * r - 6, py * r - 6], [px * r + 6, py * r + 6]], tf, D, k + 1 + px, { w: 3.5, t0: 1, t1: 1 });
    stroke(c, [[px * r + 6, py * r - 6], [px * r - 6, py * r + 6]], tf, D, k + 3 + px, { w: 3.5, t0: 1, t1: 1 });
  }
  dot(c, x + Math.cos(rot) * r * 0.35, y + Math.sin(rot) * r * 0.35 + r * 0.3, r * 0.12, PAL.junkD, D, k + 5);
}

// ------------------------------------------------------------------ shield (免疫防线)
const SHIELD_C = [[0, -222], [104, -206], [206, -240, 1], [214, -60], [176, 90], [96, 194], [0, 252, 1], [-96, 194], [-176, 90], [-214, -60], [-206, -240, 1], [-104, -206]];
export const shieldDense = () => memo('shield', () => dense(SHIELD_C));
export const CRACKS = [
  [[-30, -214, 1], [-10, -150, 1], [-46, -102, 1], [-14, -40, 1], [-40, 10, 1]],
  [[206, -120, 1], [140, -96, 1], [120, -30, 1], [60, -10, 1], [30, 40, 1]],
  [[-150, 150, 1], [-104, 96, 1], [-120, 40, 1], [-60, 20, 1], [-30, 60, 1], [0, 30, 1]],
];
// shards: wedges of the shield around a centre, each a closed local polygon + its centroid
export const SHARDS = memo('shards', () => {
  const S = shieldDense(), n = S.length, M = 9, cx = 6, cy = 4, out = [];
  const ang = (p) => Math.atan2(p[1] - cy, p[0] - cx);
  const cuts = []; for (let i = 0; i < M; i++) cuts.push(-Math.PI + (i + 0.3 + 0.4 * hs(i, 77)) / M * Math.PI * 2);
  for (let i = 0; i < M; i++) {
    const a0 = cuts[i], a1 = i + 1 < M ? cuts[i + 1] : cuts[0] + Math.PI * 2;
    const pts = S.filter((p) => { let a = ang(p); while (a < a0) a += Math.PI * 2; return a < a1; }).sort((p, q) => { let a = ang(p), b = ang(q); while (a < a0) a += Math.PI * 2; while (b < a0) b += Math.PI * 2; return a - b; });
    if (pts.length < 2) continue;
    const ctr = [cx + 18 * (hs(i, 78) - 0.5), cy + 18 * (hs(i, 79) - 0.5)];
    const poly = [ctr, ...pts];
    const m = poly.reduce((a, p) => [a[0] + p[0] / poly.length, a[1] + p[1] / poly.length], [0, 0]);
    out.push({ poly: resample(poly.map((p) => [p[0] - m[0], p[1] - m[1]]), 4, true), m, a: (a0 + a1) / 2 });
  }
  return out;
});
export function drawShield(c, tf, st = {}) {
  const D = st.D ?? 0;
  const P = inked(c, shieldDense(), tf, D, 2500, { fill: st.fill ?? '#6fb3ff', w: 8, amp: 1.6 });
  inked(c, dense(SHIELD_C.map((p) => [p[0] * 0.8, p[1] * 0.8 - 6, p[2]])), tf, D, 2501, { fill: st.fill2 ?? '#a6d2ff', w: 4, amp: 1.2, reg: false });
  stroke(c, [[-150, -190], [-158, -80], [-130, 20]], tf, D, 2502, { w: 13, color: PAL.hi, t0: 10, t1: 12 });
  (st.cracks || []).forEach((u, i) => { if (u <= 0) return; const pr = prefix(spline(CRACKS[i], false, 4), u); if (pr.length > 1) stroke(c, pr, tf, D, 2510 + i, { w: 6, t0: 2, t1: 8, step: 50 }); });
  if (st.face) drawFace(c, tf, { D, kind: st.face, y: st.faceY ?? 60, gap: 58, size: 1.25, look: st.look, k: 2520 });
  return P;
}

// ------------------------------------------------------------------ virus
export const virusDense = (R) => memo('virus' + R, () => { const P = []; for (let i = 0; i < 120; i++) { const a = i / 120 * Math.PI * 2; P.push([Math.cos(a) * R * (1 + 0.26 * Math.pow(Math.max(0, Math.cos(8 * a)), 8)), Math.sin(a) * R * (1 + 0.26 * Math.pow(Math.max(0, Math.cos(8 * a)), 8))]); } return P; });
export function drawVirus(c, x, y, R, rot, D, k, face = 'angry') {
  const tf = { x, y, r: rot, sx: 1, sy: 1 };
  inked(c, virusDense(R), tf, D, k, { fill: PAL.virus, w: 5, amp: 1, heavy: 0.25 });
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; const q = xf([[Math.cos(a) * R * 1.3, Math.sin(a) * R * 1.3]], tf)[0]; dot(c, q[0], q[1], R * 0.15, PAL.virusD, D, k + 1 + i); }
  drawFace(c, tf, { D, kind: face, y: -2, gap: R * 0.36, size: R / 70, k: k + 20 });
}

// ------------------------------------------------------------------ battery
export const BATT = { w: 540, h: 280, r: 46 };
export const batteryDense = () => memo('batt', () => rrectPts(-BATT.w / 2, -BATT.h / 2, BATT.w, BATT.h, BATT.r, 4));
export const boltDense = () => memo('bolt', () => resample([[-16, -86], [44, -86], [12, -18], [52, -18], [-26, 92], [-6, 14], [-46, 14]].map((p) => [p[0], p[1]]), 3, true));
// cells: array of 4 fill levels (0..1); low: red sliver level; st.colors
export function drawBattery(c, tf, st = {}) {
  const D = st.D ?? 0;
  inked(c, rrectPts(BATT.w / 2 - 4, -54, 46, 108, 16, 4), tf, D, 2600, { fill: st.nub ?? '#c9d3dc', w: 6, amp: 1 });
  const P = inked(c, batteryDense(), tf, D, 2601, { fill: st.fill ?? '#2b2f45', w: 8.5, amp: 1.6 });
  const cw = (BATT.w - 60 - 3 * 14) / 4, ch = BATT.h - 60;
  (st.cells || [0, 0, 0, 0]).forEach((v, i) => {
    if (v <= 0.001) return;
    const x0 = -BATT.w / 2 + 30 + i * (cw + 14);
    const s = v; const cx = x0 + cw / 2;
    const R = rrectPts(cx - cw / 2 * s, -ch / 2 * s, cw * s, ch * s, 14 * s, 4);
    inked(c, R, tf, D, 2610 + i, { fill: st.cellColor?.[i] ?? PAL.green, w: 4.5, amp: 1, heavy: 0.1 });
    stroke(c, [[cx - cw * 0.3 * s, -ch * 0.36 * s], [cx - cw * 0.3 * s, -ch * 0.1 * s]], tf, D, 2620 + i, { w: 8 * s, color: 'rgba(255,255,255,0.7)', t0: 3, t1: 3 });
  });
  if (st.low > 0) {
    const x0 = -BATT.w / 2 + 30;
    c.save(); c.globalAlpha *= clamp(st.low);
    inked(c, rrectPts(x0, -ch / 2, Math.max(10, cw * 0.42), ch, 12, 4), tf, D, 2630, { fill: PAL.red, w: 4.5, amp: 1 });
    c.restore();
  }
  if (st.bolt > 0.01) {
    const s = st.bolt;
    inked(c, xf(boltDense(), { x: 0, y: 0, sx: s * 1.15, sy: s * 1.15 }), tf, D, 2640, { fill: PAL.yel, w: 6, amp: 1 });
  }
  stroke(c, [[-BATT.w / 2 + 26, -BATT.h / 2 + 18], [-BATT.w / 2 + 160, -BATT.h / 2 + 14]], tf, D, 2650, { w: 9, color: 'rgba(255,255,255,0.55)', t0: 6, t1: 6 });
  return P;
}

// ------------------------------------------------------------------ sun
export function drawSun(c, tf, st = {}) {
  const D = st.D ?? 0, n = 12, rot = st.rot ?? 0;
  for (let i = 0; i < n; i++) {
    const a = rot + i / n * Math.PI * 2, L = i % 2 ? 1.42 : 1.62;
    const R = dense([[Math.cos(a - 0.12) * 112, Math.sin(a - 0.12) * 112, 1], [Math.cos(a) * 100 * L, Math.sin(a) * 100 * L, 1], [Math.cos(a + 0.12) * 112, Math.sin(a + 0.12) * 112, 1]], 3);
    inked(c, R, tf, D, 2700 + i, { fill: PAL.orange, w: 4.5, amp: 0.9 });
  }
  const P = inked(c, circlePts(0, 0, 110, 60), tf, D, 2720, { fill: PAL.yel, w: 7, amp: 1.4 });
  if (st.face) drawFace(c, tf, { D, kind: st.face, y: 0, gap: 34, size: 1.0, k: 2730 });
  return P;
}

// ------------------------------------------------------------------ nightcap
export function drawNightcap(c, tf, D, k = 2800) {
  const P = dense([[-96, 0, 1], [-82, -70], [-30, -132], [40, -168], [118, -160], [150, -122, 1], [100, -128], [52, -96], [40, -40], [96, 0, 1]]);
  inked(c, P, tf, D, k, { fill: PAL.indigo, w: 5.5, amp: 1.1 });
  for (const [x, y] of [[-40, -60], [20, -110], [70, -142], [10, -40]]) { const q = xf([[x, y]], tf)[0]; dot(c, q[0], q[1], 7 * Math.abs(tf.sx), PAL.gold, D, k + 1 + x); }
  inked(c, rrectPts(-108, -22, 216, 46, 22, 4), tf, D, k + 10, { fill: PAL.hi, w: 5, amp: 1 });
  inked(c, circlePts(150, -122, 30, 20), tf, D, k + 11, { fill: PAL.hi, w: 4.5, amp: 0.8 });
}

// ------------------------------------------------------------------ brain (side view)
const BRAIN_C = [[-206, 20], [-212, -44], [-184, -106], [-132, -152], [-60, -176], [12, -178], [84, -164], [144, -130], [190, -80], [210, -18], [204, 44], [178, 90],
  [130, 112], [100, 134], [64, 156], [22, 168], [-8, 156], [-26, 124], [-78, 122], [-140, 108], [-188, 72]];
export const brainDense = () => memo('brain', () => resample(spline(BRAIN_C, true, 4), 4, true));
export const BRAIN_FOLDS = [
  [[-150, -60], [-110, -96], [-60, -88], [-30, -120]],
  [[-170, 10], [-120, -10], [-80, 20], [-30, -10], [10, -40]],
  [[20, -150], [10, -100], [40, -60], [20, -20]],
  [[60, -110], [110, -96], [150, -50]],
  [[60, -10], [110, -20], [150, 20], [180, 40]],
  [[-110, 70], [-60, 50], [-10, 76], [40, 60], [80, 90]],
];
export function drawBrain(c, tf, st = {}) {
  const { D = 0, face = 'happy', look = [0, 0], folds = 1, cap = false } = st;
  const P = xf(brainDense(), tf);
  fillShape(c, P, st.fill ?? PAL.brain, { seed: seedOf(D, 1500), amp: 1.6, dx: REG.dx, dy: REG.dy });
  BRAIN_FOLDS.forEach((F, i) => {
    const pr = prefix(spline(F, false, 4), clamp(folds * 1.4 - i * 0.08));
    if (pr.length > 1) inkStroke(c, xf(pr, tf), { seed: seedOf(D, 1510 + i), w: 6, amp: 1.2, color: PAL.brainD, t0: 8, t1: 10, dense: true });
  });
  stroke(c, [[-160, -100], [-120, -136], [-60, -150]], tf, D, 1520, { w: 10, color: PAL.hi, t0: 10, t1: 14 });
  inkLoop(c, P, { seed: seedOf(D, 1500), w: 7.5, amp: 1.6, heavy: 0.35 });
  drawFace(c, tf, { D, kind: face, y: 40, gap: 62, size: 1.25, look, k: 1530 });
  if (cap) drawNightcap(c, sub(tf, -10, -160, 0.95 * cap, -0.12), D, 1560);
  return P;
}

// ------------------------------------------------------------------ alarm clock
export function drawClock(c, tf, st = {}) {
  const D = st.D ?? 0;
  if (st.bells) {
    for (const kx of [-1, 1]) {
      const a = -Math.PI / 2 + kx * 0.68;
      const bt = sub(tf, Math.cos(a) * 104, Math.sin(a) * 104, 1, kx * 0.68 + (st.ring ?? 0) * kx);
      inked(c, dense([[-34, 8, 1], [-30, -16], [-14, -30], [14, -30], [30, -16], [34, 8, 1]]), bt, D, 940 + kx, { fill: PAL.red, w: 5, amp: 1 });
    }
    stroke(c, [[-44, 92], [-60, 116]], tf, D, 945, { w: 9, t0: 2, t1: 2 });
    stroke(c, [[44, 92], [60, 116]], tf, D, 946, { w: 9, t0: 2, t1: 2 });
  }
  const C = xf(resample(circlePts(0, 0, 96, 60), 4, true), tf);
  fillShape(c, C, st.fill ?? PAL.hi, { seed: seedOf(D, 950), amp: 1.2, dx: REG.dx, dy: REG.dy });
  inkLoop(c, C, { seed: seedOf(D, 950), w: 7, amp: 1.5 });
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; const r0 = i % 3 ? 78 : 70; stroke(c, [[Math.cos(a) * r0, Math.sin(a) * r0], [Math.cos(a) * 86, Math.sin(a) * 86]], tf, D, 960 + i, { w: i % 3 ? 3 : 5, t0: 1, t1: 1 }); }
  const a1 = (st.h ?? 0) - Math.PI / 2, a2 = (st.m ?? 0) - Math.PI / 2;
  if (st.blur) { // motion smear behind the minute hand
    const pts = []; for (let i = 0; i <= 14; i++) { const a = a2 - st.blur * i / 14; pts.push([Math.cos(a) * 52, Math.sin(a) * 52]); }
    stroke(c, pts, tf, D, 979, { w: 30, t0: 2, t1: 30, color: 'rgba(47,134,224,0.35)' });
  }
  stroke(c, [[0, 0], [Math.cos(a1) * 46, Math.sin(a1) * 46]], tf, D, 980, { w: 8, t0: 2, t1: 4 });
  stroke(c, [[0, 0], [Math.cos(a2) * 68, Math.sin(a2) * 68]], tf, D, 981, { w: 6, t0: 2, t1: 4, color: PAL.blue });
  const q = xf([[0, 0]], tf)[0]; dot(c, q[0], q[1], 9 * Math.abs(tf.sx), PAL.red, D, 982);
  return C;
}

// ------------------------------------------------------------------ gauge (7～9 h)
export const gaugeDense = (R) => memo('gauge' + R, () => { const P = []; for (let i = 0; i <= 60; i++) { const a = Math.PI + i / 60 * Math.PI; P.push([Math.cos(a) * R, Math.sin(a) * R]); } P.push([R, 26]); P.push([-R, 26]); return resample(P, 4, true); });
export const gaugeAng = (h) => Math.PI + clamp((h - 4) / 8) * Math.PI;
export function drawGauge(c, tf, st = {}) {
  const D = st.D ?? 0, R = 300;
  const P = inked(c, gaugeDense(R), tf, D, 2900, { fill: PAL.hi, w: 8, amp: 1.5 });
  const zone = (h0, h1, col, k) => {
    const pts = [];
    for (let i = 0; i <= 16; i++) { const a = gaugeAng(lerp(h0, h1, i / 16)); pts.push([Math.cos(a) * (R - 26), Math.sin(a) * (R - 26)]); }
    for (let i = 16; i >= 0; i--) { const a = gaugeAng(lerp(h0, h1, i / 16)); pts.push([Math.cos(a) * (R - 96), Math.sin(a) * (R - 96)]); }
    inked(c, resample(pts, 4, true), tf, D, k, { fill: col, w: 4.5, amp: 1, reg: false });
  };
  zone(4, 7, PAL.red, 2901); zone(7, 9, PAL.green, 2902); zone(9, 12, PAL.orange, 2903);
  const hA = gaugeAng(st.h ?? 4);
  stroke(c, [[0, 0], [Math.cos(hA) * (R - 50), Math.sin(hA) * (R - 50)]], tf, D, 2910, { w: 16, t0: 2, t1: 14 });
  const q = xf([[0, 0]], tf)[0]; dot(c, q[0], q[1], 26 * Math.abs(tf.sx), PAL.ink, D, 2911); dot(c, q[0], q[1], 12 * Math.abs(tf.sx), PAL.red, D, 2912);
  return P;
}
