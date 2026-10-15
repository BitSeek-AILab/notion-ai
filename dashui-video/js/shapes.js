// Shape library — every object is a closed hand-inked contour that can morph into the next one.
import { PAL, hs, hr, clamp, lerp, inv, sstep, E, spline, resample, xf, boil, inkStroke, inkLoop, fillShape, fillPoly,
  polyPath, toN, morph, pathPts, ellPts, rrectPts, circlePts, N3, outline, arclen, prefix } from './engine.js';
import { letters } from './text.js';

export const REG = { dx: -5, dy: 4 }; // colour-to-line registration offset (hand colouring)
const CACHE = new Map();
const memo = (k, f) => { if (!CACHE.has(k)) CACHE.set(k, f()); return CACHE.get(k); };
// mirror a right-hand profile (top-centre -> bottom-centre, x >= 0) into a closed control polygon
function mirror(R) {
  const left = R.slice(1, -1).reverse().map((p) => [-p[0], p[1], p[2]]);
  return [...R, ...left];
}
export const T = (x, y, s = 1, r = 0, sx = 1, sy = 1) => ({ x, y, r, sx: s * sx, sy: s * sy });
const seedOf = (D, k) => D * 13 + k * 101;

// generic: fill + ink a closed dense local contour under transform tf
export function inked(c, dense, tf, D, k, o = {}) {
  const P = xf(dense, tf);
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

// ------------------------------------------------------------------ big bottle (1.5–2 L)
const BOTTLE_R = [[0, -350], [30, -350, 1], [36, -344], [36, -302, 1], [45, -300, 1], [45, -289, 1], [33, -287, 1], [33, -264],
  [50, -246], [86, -214], [113, -178], [127, -138], [130, -100], [130, -24, 1], [121, -14], [130, -4, 1], [130, 170, 1], [121, 180],
  [130, 190, 1], [130, 292], [126, 320], [110, 342], [80, 352], [0, 354]];
export const bottleDense = () => memo('bottle', () => resample(spline(mirror(BOTTLE_R), true, 4), 4, true));
const capDense = () => memo('cap', () => resample(spline([[-36, -302, 1], [-36, -340], [-30, -350, 1], [30, -350, 1], [36, -340], [36, -302, 1]], true, 4), 4, true));
const labelDense = () => memo('label', () => resample(spline([[-130, 20, 1], [130, 20, 1], [130, 150, 1], [-130, 150, 1]], true, 4), 4, true));
// interior (slightly inset) used as the water clip
const bottleInner = () => memo('bottleIn', () => xf(bottleDense(), { sx: 0.955, sy: 0.975, y: 4 }));
// level 0..1 maps to y 345 .. -246 (top of shoulder)
export const bottleLevelY = (lv) => lerp(345, -250, lv);
export function waterSurface(x0, x1, y, t, o = {}) {
  const { amp = 7, k = 0.025, sp = 5, tilt = 0, n = 40 } = o;
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const x = lerp(x0, x1, i / n);
    pts.push([x, y + amp * Math.sin(k * x + sp * t) + amp * 0.45 * Math.sin(k * 2.3 * x - sp * 1.4 * t + 1.3) + tilt * x]);
  }
  return pts;
}
// st: {level, t, wave, tilt, label, capOff:[dx,dy,r], capOn, D, tint, bubbles}
export function drawBottle(c, tf, st) {
  const D = st.D ?? 0;
  const body = xf(bottleDense(), tf);
  const sd = seedOf(D, 1);
  // plastic tint
  fillShape(c, body, st.tint ?? 'rgba(214,236,250,0.55)', { seed: sd, amp: 1.4, dx: REG.dx, dy: REG.dy });
  // water
  const lv = st.level ?? 0.7;
  if (lv > 0.001) {
    c.save();
    const clipP = boil(xf(bottleInner(), tf), sd + 0.5, 1.4, 70);
    c.beginPath(); pathPts(c, clipP); c.clip();
    const yS = bottleLevelY(lv);
    const surf = waterSurface(-160, 160, yS, st.t ?? 0, { amp: st.wave ?? 6, tilt: st.tilt ?? 0 });
    const poly = xf([...surf, [160, 420], [-160, 420]], tf);
    fillPoly(c, poly.map((p) => [p[0] + REG.dx, p[1] + REG.dy]), PAL.blueL);
    // deeper band at the bottom
    const deep = xf([...waterSurface(-160, 160, Math.max(yS, 120) + 70, (st.t ?? 0) * 0.7, { amp: 4 }), [160, 420], [-160, 420]], tf);
    c.globalAlpha = 0.35; fillPoly(c, deep, PAL.blue); c.globalAlpha = 1;
    // surface line
    inkStroke(c, xf(surf, tf), { seed: sd + 3, w: 5.5, amp: 1.2, color: PAL.blue, t0: 4, t1: 4, dense: true, heavy: 0 });
    // bubbles
    for (let i = 0; i < (st.bubbles ?? 4); i++) {
      const bx = -90 + 180 * hs(i, 4.1), ph = ((st.t ?? 0) * 0.35 + hs(i, 7)) % 1;
      const by = lerp(330, yS + 20, ph);
      if (by > yS + 12) { const q = xf([[bx + 8 * Math.sin((st.t ?? 0) * 3 + i), by]], tf)[0]; inkLoop(c, circlePts(q[0], q[1], 7 + 5 * hs(i, 2), 12), { seed: sd + 9 + i, w: 2.6, amp: 0.6, color: PAL.blue }); }
    }
    c.restore();
  }
  // label band
  if (st.label !== false) {
    const lab = xf(labelDense(), tf);
    fillShape(c, lab, st.labelColor ?? PAL.yel, { seed: sd + 2, amp: 1.2, dx: REG.dx, dy: REG.dy });
    const a = xf([[-130, 20], [130, 20]], tf), b = xf([[-130, 150], [130, 150]], tf);
    inkStroke(c, a, { seed: sd + 4, w: 5, amp: 1.2, t0: 6, t1: 6 });
    inkStroke(c, b, { seed: sd + 5, w: 5, amp: 1.2, t0: 6, t1: 6 });
    if (st.labelText !== false) {
      const q = xf([[0, 86]], tf)[0];
      const sc = Math.hypot(tf.sx, 0) ;
      c.save(); c.translate(q[0], q[1]); c.rotate(tf.r || 0); c.scale(tf.sx, tf.sy);
      letters(c, st.labelText ?? '大水', { font: 'KL', size: 92, x: 0, y: 0, fill: PAL.blueD, ink: PAL.ink, inkW: 3.4 / Math.max(0.3, Math.abs(tf.sx)), D, seed: 77, tracking: 6, amp: 0.9 });
      c.restore();
    }
  }
  // ridge grooves (short ink ticks)
  for (const gy of [-14, 180]) {
    stroke(c, [[-118, gy], [118, gy]], tf, D, 30 + gy, { w: 3.2, amp: 1, t0: 30, t1: 30, color: 'rgba(28,22,19,0.55)' });
  }
  // highlight
  stroke(c, [[-96, -150], [-104, -40], [-104, 120], [-98, 260]], tf, D, 40, { w: 11, color: PAL.hi, amp: 1.2, t0: 30, t1: 40 });
  stroke(c, [[-70, 210], [-70, 270]], tf, D, 41, { w: 8, color: PAL.hi, amp: 1, t0: 10, t1: 10 });
  // outline
  inkLoop(c, body, { seed: sd, w: st.w ?? 7.5, amp: 1.8, heavy: 0.35 });
  // cap
  if (st.capOn !== false) {
    const co = st.capOff || [0, 0, 0];
    const ctf = { x: 0, y: 0 };
    let capP = capDense().map((p) => [p[0], p[1] + 326]);
    capP = xf(capP, { x: co[0], y: co[1] - 326, r: co[2] });
    const capW = xf(capP, tf);
    fillShape(c, capW, PAL.blueD, { seed: sd + 6, amp: 1.2, dx: REG.dx, dy: REG.dy });
    inkLoop(c, capW, { seed: sd + 6, w: 6, amp: 1.2 });
    for (let i = -2; i <= 2; i++) {
      const l = xf(xf([[i * 12, -342 + 326], [i * 12, -310 + 326]], { x: co[0], y: co[1] - 326, r: co[2] }), tf);
      inkStroke(c, l, { seed: sd + 60 + i, w: 2.6, amp: 0.6, t0: 3, t1: 3, color: PAL.hi });
    }
  }
  return body;
}

// ------------------------------------------------------------------ milk-tea cup (the "weak" drink)
const CUP_R = [[0, -254], [168, -254, 1], [168, -230, 1], [152, -228, 1], [126, 246], [114, 268], [92, 276], [0, 278]];
export const cupDense = () => memo('cup', () => resample(spline(mirror(CUP_R), true, 4), 4, true));
const cupInner = () => memo('cupIn', () => xf(cupDense(), { sx: 0.94, sy: 0.97, y: 6 }));
// st: {D, t, face:'smug'|'shock'|'squash', look}
export function drawCup(c, tf, st) {
  const D = st.D ?? 0, sd = seedOf(D, 2);
  const body = xf(cupDense(), tf);
  // straw (behind lid line, in front of tea)
  const strawP = rrectPts(-17, -470, 34, 360, 14).map((p) => [p[0], p[1]]);
  const strawT = xf(xf(strawP, { x: 70, y: 40, r: 0.32 }), tf);
  fillShape(c, strawT, PAL.red, { seed: sd + 1, amp: 1.2, dx: REG.dx, dy: REG.dy });
  inkLoop(c, strawT, { seed: sd + 1, w: 5.5, amp: 1.2 });
  // cup plastic + tea
  fillShape(c, body, 'rgba(255,248,236,0.9)', { seed: sd, amp: 1.4, dx: REG.dx, dy: REG.dy });
  c.save();
  const clipP = boil(xf(cupInner(), tf), sd + 0.5, 1.3, 70);
  c.beginPath(); pathPts(c, clipP); c.clip();
  const surf = waterSurface(-200, 200, -176, st.t ?? 0, { amp: 3, sp: 3 });
  fillPoly(c, xf([...surf, [200, 300], [-200, 300]], tf).map((p) => [p[0] + REG.dx, p[1] + REG.dy]), PAL.tea);
  inkStroke(c, xf(surf, tf), { seed: sd + 3, w: 4, amp: 1, color: PAL.teaD, dense: true, t0: 3, t1: 3 });
  // pearls
  const pearls = [[-80, 236], [-36, 246], [10, 240], [56, 246], [96, 232], [-104, 200], [-58, 206], [-14, 204], [32, 210], [76, 200], [-30, 170], [44, 172]];
  pearls.forEach((p, i) => {
    const q = xf([p], tf)[0]; const r = 19 * Math.abs(tf.sx);
    dot(c, q[0], q[1], r, PAL.pearl, D, 300 + i);
    dot(c, q[0] - r * 0.35, q[1] - r * 0.35, r * 0.28, 'rgba(255,240,220,0.55)', D, 340 + i, 0.3);
  });
  c.restore();
  // sealing film + rim line
  stroke(c, [[-150, -228], [150, -228]], tf, D, 3, { w: 5, t0: 4, t1: 4 });
  // face
  drawFace(c, tf, { D, kind: st.face || 'smug', y: -30, gap: 62, size: 1.1, look: st.look, k: 60 });
  // highlight
  stroke(c, [[-118, -150], [-104, 120]], tf, D, 8, { w: 10, color: PAL.hi, t0: 20, t1: 30 });
  inkLoop(c, body, { seed: sd, w: 7.5, amp: 1.8, heavy: 0.35 });
  return body;
}

// ------------------------------------------------------------------ faces
// kind: happy | smug | shock | wilt | wink | blink | cool | dizzy | strong
export function drawFace(c, tf, o) {
  const { D = 0, kind = 'happy', y = 0, gap = 40, size = 1, look = [0, 0], k = 80 } = o;
  const s = size;
  const lx = look[0] || 0, ly = look[1] || 0;
  const eyeL = [-gap + lx, y + ly], eyeR = [gap + lx, y + ly];
  const P = (pts) => pts.map((p) => [p[0], p[1]]);
  const toW = (p) => xf([p], tf)[0];
  const sc = Math.abs(tf.sx);
  const eyeDot = (e, ry = 1) => { const q = toW(e); const R = 15 * s * sc; const pts = boil(ellPts(q[0], q[1], R * 0.82, R * ry, 16), seedOf(D, k + e[0]), 0.6, 30); fillPoly(c, pts, PAL.ink); dot(c, q[0] - R * 0.25, q[1] - R * 0.35 * ry, R * 0.3, '#fff', D, k + 3 + e[0], 0.2); };
  const arc = (cx, cy, rx, ry, a0, a1, w, kk, col = PAL.ink) => { const pts = []; for (let i = 0; i <= 10; i++) { const a = lerp(a0, a1, i / 10); pts.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)]); } stroke(c, pts, tf, D, kk, { w: w * s, t0: 3, t1: 3, color: col }); };
  // blush
  if (kind !== 'cool' && kind !== 'wilt') {
    for (const e of [eyeL, eyeR]) { const q = toW([e[0] + (e[0] < lx ? -14 : 14) * s, e[1] + 30 * s]); const pts = boil(ellPts(q[0], q[1], 20 * s * sc, 11 * s * sc, 14), seedOf(D, k + 9), 0.6, 30); c.globalAlpha = 0.55; fillPoly(c, pts, PAL.pink); c.globalAlpha = 1; }
  }
  if (kind === 'happy' || kind === 'strong') {
    eyeDot(eyeL); eyeDot(eyeR);
    arc(lx, y + 22 * s + ly, 22 * s, 16 * s, 0.15 * Math.PI, 0.85 * Math.PI, 5, k + 20);
    if (kind === 'strong') { arc(eyeL[0], eyeL[1] - 28 * s, 16 * s, 8 * s, 1.15 * Math.PI, 1.85 * Math.PI, 4.5, k + 21); arc(eyeR[0], eyeR[1] - 28 * s, 16 * s, 8 * s, 1.15 * Math.PI, 1.85 * Math.PI, 4.5, k + 22); }
  } else if (kind === 'smug') {
    // half-lidded eyes + smirk
    eyeDot([eyeL[0], eyeL[1] + 3 * s], 0.7); eyeDot([eyeR[0], eyeR[1] + 3 * s], 0.7);
    stroke(c, [[eyeL[0] - 18 * s, eyeL[1] - 8 * s], [eyeL[0] + 16 * s, eyeL[1] - 10 * s]], tf, D, k + 23, { w: 5 * s, t0: 3, t1: 3 });
    stroke(c, [[eyeR[0] - 16 * s, eyeR[1] - 10 * s], [eyeR[0] + 18 * s, eyeR[1] - 8 * s]], tf, D, k + 24, { w: 5 * s, t0: 3, t1: 3 });
    stroke(c, [[lx - 22 * s, y + 34 * s + ly], [lx + 4 * s, y + 40 * s + ly], [lx + 26 * s, y + 26 * s + ly]], tf, D, k + 25, { w: 5 * s, t0: 3, t1: 3 });
  } else if (kind === 'shock') {
    for (const e of [eyeL, eyeR]) { const q = toW(e); const R = 17 * s * sc; const pts = boil(circlePts(q[0], q[1], R, 16), seedOf(D, k + e[0]), 0.6, 30); fillPoly(c, pts, '#fff'); inkLoop(c, pts, { seed: seedOf(D, k + 31), w: 4 * s, amp: 0.5 }); dot(c, q[0], q[1], R * 0.42, PAL.ink, D, k + 32 + e[0], 0.3); }
    const q = toW([lx, y + 40 * s + ly]); const pts = boil(ellPts(q[0], q[1], 13 * s * sc, 17 * s * sc, 16), seedOf(D, k + 33), 0.6, 30); fillPoly(c, pts, PAL.ink);
  } else if (kind === 'wilt') {
    arc(eyeL[0], eyeL[1], 15 * s, 8 * s, 0.1 * Math.PI, 0.9 * Math.PI, 5, k + 40);
    arc(eyeR[0], eyeR[1], 15 * s, 8 * s, 0.1 * Math.PI, 0.9 * Math.PI, 5, k + 41);
    const pts = []; for (let i = 0; i <= 12; i++) { const u = i / 12; pts.push([lx - 24 * s + 48 * s * u, y + 40 * s + ly + 5 * s * Math.sin(u * Math.PI * 3)]); }
    stroke(c, pts, tf, D, k + 42, { w: 4.5 * s, t0: 3, t1: 3 });
  } else if (kind === 'blink' || kind === 'wink') {
    if (kind === 'wink') eyeDot(eyeL); else arc(eyeL[0], eyeL[1] - 4 * s, 15 * s, 8 * s, 0.1 * Math.PI, 0.9 * Math.PI, 5, k + 50);
    arc(eyeR[0], eyeR[1] - 4 * s, 15 * s, 8 * s, 0.1 * Math.PI, 0.9 * Math.PI, 5, k + 51);
    arc(lx, y + 22 * s + ly, 22 * s, 16 * s, 0.15 * Math.PI, 0.85 * Math.PI, 5, k + 52);
  } else if (kind === 'dizzy') {
    for (const e of [eyeL, eyeR]) { const pts = []; for (let i = 0; i <= 24; i++) { const a = i / 24 * Math.PI * 3.2; const r = 2 + 14 * s * i / 24; pts.push([e[0] + r * Math.cos(a), e[1] + r * Math.sin(a)]); } stroke(c, pts, tf, D, k + 60 + e[0], { w: 3.8 * s, t0: 2, t1: 2 }); }
    const pts = []; for (let i = 0; i <= 12; i++) { const u = i / 12; pts.push([lx - 22 * s + 44 * s * u, y + 40 * s + ly + 6 * s * Math.sin(u * Math.PI * 4)]); }
    stroke(c, pts, tf, D, k + 62, { w: 4.5 * s, t0: 3, t1: 3 });
  } else if (kind === 'cool') {
    // sunglasses
    for (const e of [eyeL, eyeR]) { const q = toW(e); const pts = boil(rrectPts(q[0] - 30 * s * sc, q[1] - 16 * s * sc, 60 * s * sc, 34 * s * sc, 14 * s * sc), seedOf(D, k + 70), 0.6, 30); fillPoly(c, pts, PAL.ink); stroke(c, [[e[0] - 18 * s, e[1] - 6 * s], [e[0] - 6 * s, e[1] - 10 * s]], tf, D, k + 71 + e[0], { w: 4 * s, color: '#fff', t0: 2, t1: 2 }); }
    stroke(c, [[eyeL[0] + 28 * s, eyeL[1] - 6 * s], [eyeR[0] - 28 * s, eyeR[1] - 6 * s]], tf, D, k + 73, { w: 5 * s, t0: 2, t1: 2 });
    arc(lx + 4 * s, y + 30 * s + ly, 22 * s, 12 * s, 0.1 * Math.PI, 0.8 * Math.PI, 5, k + 74);
  }
}

// ------------------------------------------------------------------ the water-drop character (水滴仔)
const DROP_C = [[0, -1.62, 1], [0.3, -1.14], [0.7, -0.64], [0.97, -0.1], [0.93, 0.42], [0.63, 0.82], [0.22, 1.0], [-0.22, 1.0], [-0.63, 0.82], [-0.93, 0.42], [-0.97, -0.1], [-0.7, -0.64], [-0.3, -1.14]];
export const dropDense = (R = 100) => memo('drop' + R, () => resample(spline(DROP_C.map((p) => [p[0] * R, p[1] * R, p[2]]), true, 4), 4, true));
const PUDDLE_C = [[0, -0.55, 1], [0.35, -0.42], [0.9, -0.2], [1.45, 0.25], [1.5, 0.62], [0.9, 0.86], [0.2, 0.92], [-0.2, 0.92], [-0.9, 0.86], [-1.5, 0.62], [-1.45, 0.25], [-0.9, -0.2], [-0.35, -0.42]];
export const puddleDense = (R = 100) => memo('pud' + R, () => resample(spline(PUDDLE_C.map((p) => [p[0] * R, p[1] * R, p[2]]), true, 4), 4, true));
// st: {D, t, expr, dry (0..1 -> puddle), look, arms:'none'|'flex'|'wave'|'up', crown, sweat}
export const DRYC = '#a9b6bf';
export function drawDrop(c, tf, st) {
  const D = st.D ?? 0, sd = seedOf(D, 5);
  const R = 100;
  const dry = clamp(st.dry ?? 0);
  const shape = dry > 0 ? morph(dropDense(R), puddleDense(R), E.io2(dry), 200, 'drop-puddle') : dropDense(R);
  const P = xf(shape, tf);
  // arms behind body
  if (st.arms && st.arms !== 'none') drawArms(c, tf, st, D);
  const col = dry > 0 ? mixHex(st.fill ?? PAL.blue, DRYC, clamp(dry * 1.3)) : (st.fill ?? PAL.blue);
  fillShape(c, P, col, { seed: sd, amp: 1.5, dx: REG.dx, dy: REG.dy });
  // inner light + highlight
  const hiP = xf([[-0.62 * R, -0.12 * R], [-0.52 * R, -0.5 * R], [-0.3 * R, -0.86 * R]].map((p) => [p[0], p[1] + dry * 0.5 * R]), tf);
  inkStroke(c, hiP, { seed: sd + 2, w: 12 * Math.abs(tf.sx), amp: 1, color: PAL.hi, t0: 10, t1: 14 });
  dot(c, xf([[-0.62 * R, 0.18 * R + dry * 0.3 * R]], tf)[0][0], xf([[-0.62 * R, 0.18 * R + dry * 0.3 * R]], tf)[0][1], 7 * Math.abs(tf.sx), PAL.hi, D, 501);
  if (dry > 0.3) { // cracks / wrinkles when dried out
    stroke(c, [[-60, 30], [-30, 40], [-10, 30]], tf, D, 510, { w: 3.2, color: 'rgba(28,22,19,0.6)' });
    stroke(c, [[30, 40], [55, 30], [70, 44]], tf, D, 511, { w: 3.2, color: 'rgba(28,22,19,0.6)' });
  }
  inkLoop(c, P, { seed: sd, w: st.w ?? 7, amp: 1.7, heavy: 0.35 });
  drawFace(c, tf, { D, kind: st.expr || 'happy', y: lerp(0.08 * R, 0.42 * R, dry), gap: lerp(0.36, 0.5, dry) * R, size: 1, look: st.look || [0, 0], k: 520 });
  if (st.sweat) {
    const q = xf([[0.95 * R, -0.75 * R]], tf)[0];
    const sw = xf(dropDense(R), { x: q[0], y: q[1], sx: 0.16 * Math.abs(tf.sx), sy: 0.16 * Math.abs(tf.sy), r: 0.3 });
    fillShape(c, sw, PAL.blueL, { seed: sd + 7, amp: 0.6 }); inkLoop(c, sw, { seed: sd + 7, w: 3.2, amp: 0.6 });
  }
  if (st.crown) drawCrown(c, { x: xf([[0, -1.62 * R]], tf)[0][0], y: xf([[0, -1.62 * R]], tf)[0][1] - 18 * Math.abs(tf.sy), sx: Math.abs(tf.sx) * st.crown, sy: Math.abs(tf.sy) * st.crown, r: (tf.r || 0) + 0.12 }, D);
  return P;
}
function drawArms(c, tf, st, D) {
  const R = 100, w = 8.5;
  const k = st.arms;
  const t = st.t ?? 0;
  const sides = [-1, 1];
  for (const sgn of sides) {
    let pts;
    if (k === 'flex') pts = [[sgn * 0.9 * R, 0.25 * R], [sgn * 1.45 * R, 0.1 * R], [sgn * 1.55 * R, -0.35 * R], [sgn * 1.35 * R, -0.62 * R]];
    else if (k === 'up') pts = [[sgn * 0.9 * R, 0.1 * R], [sgn * 1.3 * R, -0.3 * R], [sgn * 1.45 * R, -0.9 * R]];
    else if (k === 'wave') pts = sgn > 0 ? [[0.9 * R, 0.2 * R], [1.35 * R, -0.1 * R + 0.12 * R * Math.sin(t * 14)], [1.5 * R, -0.65 * R + 0.2 * R * Math.sin(t * 14)]] : [[-0.9 * R, 0.3 * R], [-1.3 * R, 0.55 * R], [-1.42 * R, 0.8 * R]];
    else pts = [[sgn * 0.9 * R, 0.3 * R], [sgn * 1.25 * R, 0.6 * R], [sgn * 1.35 * R, 0.85 * R]];
    stroke(c, pts, tf, D, 560 + sgn, { w: w, t0: 2, t1: 2 });
    const e = xf([pts[pts.length - 1]], tf)[0];
    const hand = boil(circlePts(e[0], e[1], 15 * Math.abs(tf.sx), 12), seedOf(D, 570 + sgn), 0.6, 30);
    fillPoly(c, hand, '#fff'); inkLoop(c, hand, { seed: seedOf(D, 571 + sgn), w: 4.5, amp: 0.5 });
    if (k === 'flex') { // little bicep bump
      const b = xf([[sgn * 1.32 * R, 0.02 * R]], tf)[0];
      const bp = boil(ellPts(b[0], b[1] - 8, 22 * Math.abs(tf.sx), 16 * Math.abs(tf.sy), 14), seedOf(D, 575 + sgn), 0.6, 30);
      fillPoly(c, bp, PAL.blue); inkLoop(c, bp, { seed: seedOf(D, 576 + sgn), w: 4.5, amp: 0.5 });
    }
  }
}
export function mixHex(a, b, u) {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16)), pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  const m = pa.map((v, i) => Math.round(v + (pb[i] - v) * clamp(u)));
  return '#' + m.map((v) => v.toString(16).padStart(2, '0')).join('');
}

// ------------------------------------------------------------------ crown / sparkles
export function drawCrown(c, tf, D) {
  const P = [[-60, 30, 1], [-66, -40, 1], [-30, -6, 1], [0, -56, 1], [30, -6, 1], [66, -40, 1], [60, 30, 1]];
  const dense = resample(spline(P, true, 4), 4, true);
  const W = xf(dense, tf);
  fillShape(c, W, PAL.yel, { seed: seedOf(D, 600), amp: 1, dx: REG.dx * 0.6, dy: REG.dy * 0.6 });
  inkLoop(c, W, { seed: seedOf(D, 600), w: 5.5, amp: 1 });
  for (const p of [[-66, -40], [0, -56], [66, -40]]) { const q = xf([p], tf)[0]; dot(c, q[0], q[1], 8 * Math.abs(tf.sx), PAL.red, D, 610 + p[0]); }
}

// ------------------------------------------------------------------ human body (gingerbread-like, A-pose)
const BODY_R = [[0, -420], [46, -410], [74, -376], [80, -334], [70, -292], [46, -264], [30, -252], [30, -236, 1], [70, -228], [118, -212], [146, -186],
  [160, -150], [172, -70], [184, 10], [194, 70], [200, 96], [194, 122], [176, 128], [162, 110], [154, 60], [142, -20], [128, -96], [118, -128, 1],
  [114, -90], [110, -10], [114, 60], [118, 110], [112, 200], [104, 300], [100, 360], [110, 392], [116, 414], [86, 424], [44, 422], [36, 402],
  [34, 340], [30, 220], [22, 130], [0, 104, 1]];
export const bodyDense = () => memo('body', () => resample(spline(mirror(BODY_R), true, 4), 4, true));
export const HEAD = { x: 0, y: -334, r: 82 };

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

// ------------------------------------------------------------------ glass (200 ml)
export const glassDense = () => memo('glass', () => resample(spline([[-62, -84, 1], [62, -84, 1], [52, 70], [46, 82], [34, 86], [-34, 86], [-46, 82], [-52, 70]], true, 3), 3, true));
export function drawGlass(c, tf, st) {
  const D = st.D ?? 0, sd = seedOf(D, 7 + (st.k ?? 0));
  const G = xf(glassDense(), tf);
  fillShape(c, G, 'rgba(214,236,250,0.6)', { seed: sd, amp: 1.2, dx: REG.dx, dy: REG.dy });
  const lv = st.level ?? 0.78;
  if (lv > 0.01) {
    c.save(); c.beginPath(); pathPts(c, boil(xf(xf(glassDense(), { sx: 0.92, sy: 0.96, y: 2 }), tf), sd + 0.5, 1, 60)); c.clip();
    const y = lerp(84, -80, lv);
    const surf = waterSurface(-80, 80, y, st.t ?? 0, { amp: 3, k: 0.05, sp: 6, n: 16 });
    fillPoly(c, xf([...surf, [80, 120], [-80, 120]], tf).map((p) => [p[0] + REG.dx * 0.6, p[1] + REG.dy * 0.6]), PAL.blueL);
    inkStroke(c, xf(surf, tf), { seed: sd + 2, w: 4, amp: 0.8, color: PAL.blue, dense: true, t0: 2, t1: 2 });
    c.restore();
  }
  stroke(c, [[-40, -60], [-34, 50]], tf, D, 700 + (st.k ?? 0), { w: 7, color: PAL.hi, t0: 8, t1: 8 });
  inkLoop(c, G, { seed: sd, w: st.w ?? 5.5, amp: 1.3, heavy: 0.3 });
  return G;
}

// ------------------------------------------------------------------ sugar cube (isometric)
export function drawCube(c, x, y, a, D, k, o = {}) {
  const r = o.r ?? 0;
  const tf = { x, y, r, sx: a / 60, sy: a / 60 };
  const top = [[0, -60], [52, -30], [0, 0], [-52, -30]], left = [[-52, -30], [0, 0], [0, 60], [-52, 30]], right = [[0, 0], [52, -30], [52, 30], [0, 60]];
  const d = (P) => resample(spline(P.map((p) => [p[0], p[1], 1]), true, 3), 3, true);
  const faces = [[top, o.cTop ?? PAL.sugar], [left, o.cL ?? '#efe3cf'], [right, o.cR ?? '#e2d1b4']];
  faces.forEach(([F, col], i) => fillShape(c, xf(d(F), tf), col, { seed: seedOf(D, k + i), amp: 0.9, dx: REG.dx * 0.5, dy: REG.dy * 0.5 }));
  const outlineP = d([[0, -60], [52, -30], [52, 30], [0, 60], [-52, 30], [-52, -30]]);
  inkLoop(c, xf(outlineP, tf), { seed: seedOf(D, k), w: o.w ?? 4.6, amp: 1, heavy: 0.2 });
  stroke(c, [[-52, -30], [0, 0], [52, -30]], tf, D, k + 5, { w: 3.6, t0: 2, t1: 2 });
  stroke(c, [[0, 0], [0, 60]], tf, D, k + 6, { w: 3.6, t0: 2, t1: 2 });
  // grain specks
  for (let i = 0; i < 5; i++) { const q = xf([[-30 + 60 * hs(k, i), -44 + 40 * hs(k, i, 2) * 0.6]], tf)[0]; dot(c, q[0], q[1], 2.4, 'rgba(28,22,19,0.35)', D, k + 10 + i, 0.2); }
}

// ------------------------------------------------------------------ sugary soda bottle (500 ml)
const SODA_R = [[0, -232], [26, -232, 1], [28, -200, 1], [34, -198, 1], [34, -189, 1], [25, -187, 1], [25, -172], [42, -142], [66, -102], [78, -62], [78, 168], [74, 204], [56, 224], [0, 230]];
export const sodaDense = () => memo('soda', () => resample(spline(mirror(SODA_R), true, 4), 4, true));
export function drawSoda(c, tf, st) {
  const D = st.D ?? 0, sd = seedOf(D, 9);
  const B = xf(sodaDense(), tf);
  fillShape(c, B, 'rgba(255,240,226,0.7)', { seed: sd, amp: 1.3, dx: REG.dx, dy: REG.dy });
  c.save(); c.beginPath(); pathPts(c, boil(xf(xf(sodaDense(), { sx: 0.93, sy: 0.97, y: 3 }), tf), sd + 0.5, 1.2, 60)); c.clip();
  const surf = waterSurface(-100, 100, -150, st.t ?? 0, { amp: 3, k: 0.04 });
  fillPoly(c, xf([...surf, [100, 260], [-100, 260]], tf).map((p) => [p[0] + REG.dx, p[1] + REG.dy]), PAL.cola);
  for (let i = 0; i < 7; i++) { const ph = ((st.t ?? 0) * 0.5 + hs(i, 3)) % 1; const q = xf([[-50 + 100 * hs(i, 8), lerp(200, -140, ph)]], tf)[0]; inkLoop(c, circlePts(q[0], q[1], 5 + 3 * hs(i, 1), 10), { seed: sd + 20 + i, w: 2.2, amp: 0.4, color: 'rgba(255,230,200,0.8)' }); }
  c.restore();
  // label
  const lab = xf(resample(spline([[-78, -20, 1], [78, -20, 1], [78, 90, 1], [-78, 90, 1]], true, 4), 4, true), tf);
  fillShape(c, lab, PAL.red, { seed: sd + 2, amp: 1, dx: REG.dx, dy: REG.dy });
  stroke(c, [[-78, -20], [78, -20]], tf, D, 900, { w: 4.5, t0: 3, t1: 3 });
  stroke(c, [[-78, 90], [78, 90]], tf, D, 901, { w: 4.5, t0: 3, t1: 3 });
  const q = xf([[0, 36]], tf)[0];
  c.save(); c.translate(q[0], q[1]); c.rotate(tf.r || 0); c.scale(tf.sx, tf.sy);
  letters(c, '甜', { font: 'KL', size: 86, x: 0, y: 0, fill: PAL.hi, ink: PAL.ink, inkW: 3.4, D, seed: 91, amp: 0.9 });
  c.restore();
  stroke(c, [[-56, -100], [-60, 150]], tf, D, 902, { w: 9, color: PAL.hi, t0: 20, t1: 20 });
  inkLoop(c, B, { seed: sd, w: 6.5, amp: 1.6, heavy: 0.35 });
  const cap = xf(resample(spline([[-28, -200, 1], [-28, -226], [-24, -233, 1], [24, -233, 1], [28, -226], [28, -200, 1]], true, 3), 3, true), tf);
  fillShape(c, cap, PAL.red, { seed: sd + 3, amp: 1, dx: REG.dx * 0.5, dy: REG.dy * 0.5 }); inkLoop(c, cap, { seed: sd + 3, w: 5, amp: 1 });
  return B;
}

// ------------------------------------------------------------------ icons
export function drawClock(c, tf, st) {
  const D = st.D ?? 0;
  const C = xf(resample(circlePts(0, 0, 96, 60), 4, true), tf);
  fillShape(c, C, PAL.hi, { seed: seedOf(D, 950), amp: 1.2, dx: REG.dx, dy: REG.dy });
  inkLoop(c, C, { seed: seedOf(D, 950), w: 7, amp: 1.5 });
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; const r0 = i % 3 ? 78 : 70; stroke(c, [[Math.cos(a) * r0, Math.sin(a) * r0], [Math.cos(a) * 86, Math.sin(a) * 86]], tf, D, 960 + i, { w: i % 3 ? 3 : 5, t0: 1, t1: 1 }); }
  const a1 = (st.h ?? 0) - Math.PI / 2, a2 = (st.m ?? 0) - Math.PI / 2;
  stroke(c, [[0, 0], [Math.cos(a1) * 46, Math.sin(a1) * 46]], tf, D, 980, { w: 8, t0: 2, t1: 4 });
  stroke(c, [[0, 0], [Math.cos(a2) * 68, Math.sin(a2) * 68]], tf, D, 981, { w: 6, t0: 2, t1: 4, color: PAL.blue });
  const q = xf([[0, 0]], tf)[0]; dot(c, q[0], q[1], 9 * Math.abs(tf.sx), PAL.red, D, 982);
}
export function drawWarn(c, tf, st) {
  const D = st.D ?? 0;
  const P = resample(spline([[0, -112, 1], [118, 92, 1], [-118, 92, 1]], true, 4), 4, true);
  const W = xf(P, tf);
  fillShape(c, W, PAL.yel, { seed: seedOf(D, 990), amp: 1.2, dx: REG.dx, dy: REG.dy });
  inkLoop(c, W, { seed: seedOf(D, 990), w: 8, amp: 1.5 });
  stroke(c, [[0, -48], [0, 22]], tf, D, 991, { w: 18, t0: 2, t1: 10 });
  const q = xf([[0, 56]], tf)[0]; dot(c, q[0], q[1], 11 * Math.abs(tf.sx), PAL.ink, D, 992);
}
export function drawWifi(c, tf, st) {
  const D = st.D ?? 0, bars = st.bars ?? 3, col = st.color ?? PAL.blue;
  for (let i = 0; i < 3; i++) {
    const r = 50 + i * 48;
    const pts = []; for (let k = 0; k <= 14; k++) { const a = lerp(-Math.PI * 0.78, -Math.PI * 0.22, k / 14); pts.push([Math.cos(a) * r, Math.sin(a) * r]); }
    const on = i < bars;
    stroke(c, pts, tf, D, 1000 + i, { w: 16, t0: 3, t1: 3, color: on ? col : 'rgba(28,22,19,0.18)' });
  }
  const q = xf([[0, 0]], tf)[0]; dot(c, q[0], q[1] - 6, 14 * Math.abs(tf.sx), bars > 0 ? col : PAL.red, D, 1010);
}
export function drawCheckbox(c, tf, st) {
  const D = st.D ?? 0;
  const B = xf(rrectPts(-42, -42, 84, 84, 14), tf);
  fillShape(c, B, PAL.hi, { seed: seedOf(D, 1100), amp: 1, dx: REG.dx * 0.6, dy: REG.dy * 0.6 });
  inkLoop(c, B, { seed: seedOf(D, 1100), w: 6, amp: 1.2 });
  const u = clamp(st.check ?? 0);
  if (u > 0) {
    const ck = spline([[-30, -2], [-8, 26], [44, -46]], false, 3);
    const pr = prefix(ck, u);
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
