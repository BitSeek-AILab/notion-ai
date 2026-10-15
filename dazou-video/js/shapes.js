// Shape library for 大走理论 — every object is a hand-inked closed contour (or a line-art stroke set)
// that can morph into the next one. Local coordinates; place with T(x, y, s, r, sx, sy).
import { PAL, hs, hr, clamp, lerp, E, spline, resample, xf, boil, inkStroke, inkLoop, fillShape, fillPoly,
  polyPath, toN, morph, pathPts, ellPts, rrectPts, circlePts, N3, outline, arclen, prefix } from './engine.js';
import { letters } from './text.js';

export const REG = { dx: -5, dy: 4 }; // colour-to-line registration offset (hand colouring)
const CACHE = new Map();
const memo = (k, f) => { if (!CACHE.has(k)) CACHE.set(k, f()); return CACHE.get(k); };
function mirror(R) { // right-hand profile (top-centre -> bottom-centre, x >= 0) -> closed control polygon
  const left = R.slice(1, -1).reverse().map((p) => [-p[0], p[1], p[2]]);
  return [...R, ...left];
}
export const T = (x, y, s = 1, r = 0, sx = 1, sy = 1) => ({ x, y, r, sx: s * sx, sy: s * sy });
const seedOf = (D, k) => D * 13 + k * 101;
const sc = (tf) => Math.abs(tf.sx ?? 1);

export function inked(c, dense, tf, D, k, o = {}) {
  const P = xf(dense, tf);
  const sd = seedOf(D, k);
  if (o.fill) fillShape(c, P, o.fill, { seed: sd, amp: o.amp ?? 1.6, dx: o.reg === false ? 0 : REG.dx * (o.regK ?? 1), dy: o.reg === false ? 0 : REG.dy * (o.regK ?? 1) });
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
export function mixHex(a, b, u) {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16)), pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  const m = pa.map((v, i) => Math.round(v + (pb[i] - v) * clamp(u)));
  return '#' + m.map((v) => v.toString(16).padStart(2, '0')).join('');
}
const DROP_C = [[0, -1.62, 1], [0.3, -1.14], [0.7, -0.64], [0.97, -0.1], [0.93, 0.42], [0.63, 0.82], [0.22, 1.0], [-0.22, 1.0], [-0.63, 0.82], [-0.93, 0.42], [-0.97, -0.1], [-0.7, -0.64], [-0.3, -1.14]];
export const dropDense = (R = 100) => memo('drop' + R, () => resample(spline(DROP_C.map((p) => [p[0] * R, p[1] * R, p[2]]), true, 4), 4, true));
export function drawSweat(c, x, y, s, D, k) {
  const P = xf(dropDense(100), { x, y, sx: 0.2 * s, sy: 0.2 * s, r: 0.25 });
  fillShape(c, P, PAL.blueL, { seed: seedOf(D, k), amp: 0.6, dx: -1.5, dy: 1.5 });
  inkLoop(c, P, { seed: seedOf(D, k), w: 3.4 * s, amp: 0.6, heavy: 0 });
}

// ------------------------------------------------------------------ footprint (barefoot sole print, toes up = walking direction)
const SOLE_C = [[-2, -100], [26, -96], [44, -80], [52, -52], [50, -18], [40, 16], [34, 46], [36, 72], [28, 94], [8, 104], [-14, 102], [-30, 88],
  [-34, 64], [-28, 38], [-22, 14], [-30, -14], [-44, -46], [-46, -76], [-30, -94]];
export const footDense = () => memo('sole', () => resample(spline(SOLE_C, true, 3), 3, true));
const TOES = [[-24, -130, 18], [6, -137, 13], [29, -130, 11], [46, -117, 9.5], [58, -98, 8.5]];
// tf: transform (left foot: sx < 0). o: {fill, w, toes (0..1 pop), D, k, alpha}
export function drawFoot(c, tf, D, k, o = {}) {
  const fill = o.fill ?? PAL.org;
  const P = xf(footDense(), tf);
  const s = sc(tf);
  fillShape(c, P, fill, { seed: seedOf(D, k), amp: 1.2, dx: REG.dx * 0.8 * Math.min(1, s * 1.5), dy: REG.dy * 0.8 * Math.min(1, s * 1.5) });
  if (o.w !== 0) inkLoop(c, P, { seed: seedOf(D, k), w: o.w ?? Math.max(2.5, 7 * s), amp: 1.2, heavy: 0.3 });
  const tu = o.toes ?? 1;
  TOES.forEach(([x, y, r], i) => {
    const u = clamp(tu * 1.6 - i * 0.15);
    if (u <= 0) return;
    const q = xf([[x, y]], tf)[0];
    const R = r * s * E.outBack(u, 2.6);
    const C = circlePts(q[0], q[1], R, 14);
    fillShape(c, C, fill, { seed: seedOf(D, k + 1 + i), amp: 0.6, dx: REG.dx * 0.5 * Math.min(1, s * 1.5), dy: REG.dy * 0.5 * Math.min(1, s * 1.5) });
    if (o.w !== 0) inkLoop(c, C, { seed: seedOf(D, k + 1 + i), w: Math.max(2, (o.w ?? 7 * s) * 0.75), amp: 0.6, heavy: 0.2 });
  });
  return P;
}

// ------------------------------------------------------------------ sofa (front view), origin = seat-top centre
const sofaParts = () => memo('sofa', () => ({
  back: rrectPts(-370, -215, 740, 230, 70),
  seat: rrectPts(-300, -32, 600, 104, 34),
  armL: rrectPts(-410, -120, 122, 248, 56),
  armR: rrectPts(288, -120, 122, 248, 56),
  base: rrectPts(-392, 58, 784, 74, 28),
}));
export function drawSofa(c, tf, D, o = {}) {
  const S = sofaParts();
  const col = o.fill ?? PAL.sofa, dk = o.dark ?? PAL.sofaD;
  for (const lx of [-330, 330]) stroke(c, [[lx, 130], [lx - Math.sign(lx) * 8, 168]], tf, D, 30 + (lx > 0 ? 1 : 0), { w: 14 * sc(tf), t0: 2, t1: 2 });
  inked(c, S.back, tf, D, 20, { fill: col, w: 7.5 * sc(tf) });
  // tufting on the back
  for (const bx of [-200, 0, 200]) { const q = xf([[bx, -120]], tf)[0]; dot(c, q[0], q[1], 7 * sc(tf), dk, D, 21 + bx); }
  inked(c, S.base, tf, D, 22, { fill: dk, w: 7.5 * sc(tf) });
  inked(c, S.seat, tf, D, 23, { fill: col, w: 7.5 * sc(tf) });
  stroke(c, [[0, -26], [0, 66]], tf, D, 24, { w: 5 * sc(tf), t0: 4, t1: 4 });
  inked(c, S.armL, tf, D, 25, { fill: col, w: 7.5 * sc(tf) });
  inked(c, S.armR, tf, D, 26, { fill: col, w: 7.5 * sc(tf) });
  // highlights
  stroke(c, [[-330, -170], [-250, -190], [-160, -196]], tf, D, 27, { w: 12 * sc(tf), color: 'rgba(255,246,226,0.75)', t0: 8, t1: 10 });
  stroke(c, [[-385, -80], [-385, -20]], tf, D, 28, { w: 10 * sc(tf), color: 'rgba(255,246,226,0.75)', t0: 6, t1: 6 });
}

// ------------------------------------------------------------------ phone (portrait), origin = centre
export function drawPhone(c, tf, D, k, o = {}) {
  const body = rrectPts(-34, -60, 68, 120, 14);
  inked(c, body, tf, D, k, { fill: PAL.ink, w: 5 * sc(tf), amp: 0.8, reg: false });
  const scr = xf(rrectPts(-26, -50, 52, 96, 8), tf);
  fillPoly(c, boil(scr, seedOf(D, k + 1), 0.6, 40), o.screen ?? PAL.blueL);
  // scrolling feed lines
  const sh = (o.scroll ?? 0) % 1;
  for (let i = 0; i < 4; i++) {
    const y = -40 + ((i * 26 + sh * 26 * 4) % 96);
    if (y > 38) continue;
    stroke(c, [[-18, y], [16, y]], tf, D, k + 2 + i, { w: 5 * sc(tf), color: 'rgba(28,22,19,0.45)', t0: 2, t1: 2, amp: 0.4 });
  }
}

// ------------------------------------------------------------------ chair (side view, facing +x) as morphable strokes; origin = seat centre
// [seat, back post + back leg, front leg]
export const CHAIR = [
  [[-92, 0], [0, -2], [92, 0]],
  [[-104, -240], [-97, -115], [-92, 0], [-95, 70], [-101, 135]],
  [[84, 0], [88, 70], [94, 135]],
];
export const CHAIR_W = [[18, 16, 18], [16, 15, 16, 14, 13], [15, 14, 13]];

// ------------------------------------------------------------------ desk + laptop (side view), origin = desktop left end
export function drawDesk(c, tf, D, o = {}) {
  const u = o.draw ?? 1; // line-art draw-on
  const top = rrectPts(0, -16, 400, 26, 8);
  if (u >= 1) inked(c, top, tf, D, 40, { fill: PAL.wood, w: 6.5 * sc(tf) });
  else {
    const pr = prefix([[0, -3], [400, -3]].map((p) => p), u);
    if (pr.length > 1) stroke(c, spline(pr, false, 4), tf, D, 40, { w: 12 * sc(tf), t0: 3, t1: 3 });
  }
  const lu = clamp((u - 0.4) / 0.6);
  for (const [x, i] of [[26, 0], [374, 1]]) {
    if (lu <= 0) continue;
    stroke(c, prefix(spline([[x, 10], [x + (i ? 6 : -6), 240]], false, 4), lu), tf, D, 41 + i, { w: 14 * sc(tf), t0: 2, t1: 2 });
  }
}
// laptop seen from the side; screen faces -x (toward the sitter). glow 0..1
export function drawLaptop(c, tf, D, o = {}) {
  const base = rrectPts(40, -30, 200, 14, 5);
  inked(c, base, tf, D, 50, { fill: PAL.greyL, w: 5.5 * sc(tf) });
  const scr = [[52, -30], [10, -190]];
  if ((o.glow ?? 0) > 0) {
    c.save(); c.globalAlpha *= 0.15 * o.glow;
    const G = xf([[30, -110], [-200, -190], [-200, -10]], tf);
    fillPoly(c, boil(G, seedOf(D, 51), 2, 60), PAL.blueL);
    c.restore();
  }
  stroke(c, scr, tf, D, 52, { w: 14 * sc(tf), t0: 3, t1: 3 });
  stroke(c, [[46, -42], [12, -172]], tf, D, 53, { w: 5 * sc(tf), color: PAL.blue, t0: 3, t1: 3 });
}

// ------------------------------------------------------------------ clock / battery / watch / bulb / switch / bowl / seal
export function drawClock(c, tf, st) {
  const D = st.D ?? 0;
  const C = xf(resample(circlePts(0, 0, 96, 60), 4, true), tf);
  fillShape(c, C, st.fill ?? PAL.hi, { seed: seedOf(D, 950), amp: 1.2, dx: REG.dx, dy: REG.dy });
  if (st.arc) { // elapsed-time wedge
    const pts = [[0, 0]]; const a0 = -Math.PI / 2, a1 = a0 + st.arc;
    for (let i = 0; i <= 30; i++) { const a = lerp(a0, a1, i / 30); pts.push([Math.cos(a) * 84, Math.sin(a) * 84]); }
    c.save(); c.globalAlpha *= 0.85; fillPoly(c, boil(xf(pts, tf), seedOf(D, 951), 1, 40), st.arcColor ?? PAL.orgL); c.restore();
  }
  inkLoop(c, C, { seed: seedOf(D, 950), w: 7 * sc(tf) / 1.0, amp: 1.5 });
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; const r0 = i % 3 ? 78 : 70; stroke(c, [[Math.cos(a) * r0, Math.sin(a) * r0], [Math.cos(a) * 86, Math.sin(a) * 86]], tf, D, 960 + i, { w: (i % 3 ? 3 : 5) * sc(tf), t0: 1, t1: 1 }); }
  const a1 = (st.h ?? 0) - Math.PI / 2, a2 = (st.m ?? 0) - Math.PI / 2;
  stroke(c, [[0, 0], [Math.cos(a1) * 46, Math.sin(a1) * 46]], tf, D, 980, { w: 8 * sc(tf), t0: 2, t1: 4 });
  stroke(c, [[0, 0], [Math.cos(a2) * 68, Math.sin(a2) * 68]], tf, D, 981, { w: 6 * sc(tf), t0: 2, t1: 4, color: PAL.orgD });
  const q = xf([[0, 0]], tf)[0]; dot(c, q[0], q[1], 9 * sc(tf), PAL.red, D, 982);
}
export const clockDense = () => memo('clock', () => resample(circlePts(0, 0, 96, 60), 4, true));
export const batteryDense = () => memo('batt', () => rrectPts(-110, -56, 220, 112, 22, 4));
// level 0..1; color auto (green -> yellow -> red) unless o.color
export function drawBattery(c, tf, D, lv, o = {}) {
  const B = xf(batteryDense(), tf);
  fillShape(c, B, PAL.hi, { seed: seedOf(D, 1300), amp: 1.2, dx: REG.dx, dy: REG.dy });
  const col = o.color ?? (lv > 0.55 ? PAL.grn : lv > 0.28 ? PAL.yel : PAL.red);
  if (lv > 0.01) {
    const w = 188 * clamp(lv);
    const bar = xf(rrectPts(-94, -40, Math.max(14, w), 80, 10, 4), tf);
    fillShape(c, bar, col, { seed: seedOf(D, 1301), amp: 1, dx: 0, dy: 0 });
    inkLoop(c, bar, { seed: seedOf(D, 1301), w: 3.5 * sc(tf), amp: 1, heavy: 0 });
  }
  const nub = xf(rrectPts(110, -22, 20, 44, 6), tf);
  fillShape(c, nub, PAL.ink, { seed: seedOf(D, 1302), amp: 0.8 });
  inkLoop(c, B, { seed: seedOf(D, 1300), w: 8 * sc(tf), amp: 1.4, heavy: 0.3 });
  if (o.bolt) {
    const bolt = resample(spline([[12, -66, 1], [-34, 8, 1], [-4, 8, 1], [-16, 66, 1], [34, -10, 1], [4, -10, 1]], true, 3), 3, true);
    inked(c, bolt, { ...tf, sx: tf.sx * o.bolt, sy: tf.sy * o.bolt }, D, 1303, { fill: PAL.yel, w: 4.5 * sc(tf) });
  }
}
// round smartwatch. o: {steps (number), ring 0..1, D, label}
export const WATCH_R = 205;
export const watchDense = () => memo('watch', () => resample(circlePts(0, 0, WATCH_R, 90), 4, true));
export function drawWatch(c, tf, D, o = {}) {
  const s = sc(tf);
  for (const sg of [-1, 1]) { // straps
    const strap = rrectPts(-96, sg < 0 ? -340 : 190, 192, 150, 30);
    inked(c, strap, tf, D, 1400 + (sg > 0 ? 1 : 0), { fill: PAL.org, w: 7 * s });
    for (let i = 0; i < 3; i++) { const yy = sg < 0 ? -310 + i * 34 : 250 + i * 34; stroke(c, [[-60, yy], [60, yy]], tf, D, 1403 + i + (sg > 0 ? 5 : 0), { w: 4 * s, color: PAL.orgD, t0: 3, t1: 3 }); }
  }
  const C = xf(watchDense(), tf);
  fillShape(c, C, PAL.greyL, { seed: seedOf(D, 1410), amp: 1.4, dx: REG.dx, dy: REG.dy });
  inkLoop(c, C, { seed: seedOf(D, 1410), w: 8 * s, amp: 1.5, heavy: 0.3 });
  const S = xf(resample(circlePts(0, 0, 172, 80), 4, true), tf);
  fillShape(c, S, '#2a2420', { seed: seedOf(D, 1411), amp: 1, dx: 0, dy: 0 });
  // button
  const btn = xf(rrectPts(200, -40, 26, 80, 10), tf);
  fillShape(c, btn, PAL.greyL, { seed: seedOf(D, 1412), amp: 0.6 }); inkLoop(c, btn, { seed: seedOf(D, 1412), w: 5 * s, amp: 0.6 });
  // progress ring
  const rg = clamp(o.ring ?? 0);
  const track = []; for (let i = 0; i <= 64; i++) { const a = -Math.PI / 2 + (i / 64) * Math.PI * 2; track.push([Math.cos(a) * 146, Math.sin(a) * 146]); }
  inkStroke(c, xf(track, tf), { seed: seedOf(D, 1413), w: 20 * s, amp: 0.8, color: 'rgba(255,246,226,0.16)', t0: 1, t1: 1, dense: true, heavy: 0 });
  if (rg > 0.005) {
    const n = Math.max(2, Math.round(64 * rg)); const arc = [];
    for (let i = 0; i <= n; i++) { const a = -Math.PI / 2 + (i / n) * Math.PI * 2 * rg; arc.push([Math.cos(a) * 146, Math.sin(a) * 146]); }
    inkStroke(c, xf(arc, tf), { seed: seedOf(D, 1414), w: 22 * s, amp: 0.8, color: o.ringColor ?? PAL.org, t0: 2, t1: 2, dense: true, heavy: 0 });
  }
  if (o.steps !== undefined) {
    const q = xf([[0, -14]], tf)[0];
    letters(c, String(o.steps), { font: 'KL', size: (o.size ?? 104) * s, x: q[0], y: q[1], fill: PAL.hi, ink: null, D, seed: 1415, amp: 0.6 * s });
    const q2 = xf([[0, 74]], tf)[0];
    letters(c, o.label ?? '步', { font: 'MK', size: 46 * s, x: q2[0], y: q2[1], fill: PAL.orgL, ink: null, D, seed: 1416, amp: 0.5 * s });
  }
  return C;
}
// light bulb (glass + screw base). lit 0..1
const BULB_C = [[0, -190], [76, -176], [128, -132], [150, -66], [140, 0], [110, 52], [76, 96], [62, 130, 1], [-62, 130, 1], [-76, 96], [-110, 52], [-140, 0], [-150, -66], [-128, -132], [-76, -176]];
export const bulbDense = () => memo('bulb', () => resample(spline(BULB_C, true, 4), 4, true));
export function drawBulb(c, tf, D, lit = 0, o = {}) {
  const s = sc(tf);
  if (lit > 0.01) { // rays
    for (let i = 0; i < 9; i++) {
      const a = -Math.PI / 2 + (i - 4) * 0.36;
      const r0 = 186 + 10 * Math.sin(i * 1.7), r1 = r0 + 70 * E.outBack(clamp(lit), 2);
      stroke(c, [[Math.cos(a) * r0, -50 + Math.sin(a) * r0], [Math.cos(a) * r1, -50 + Math.sin(a) * r1]], tf, D, 1500 + i, { w: 12 * s, t0: 3, t1: 3, color: PAL.ink });
    }
  }
  const P = xf(bulbDense(), tf);
  fillShape(c, P, mixHex(PAL.hi, PAL.yel, lit), { seed: seedOf(D, 1510), amp: 1.4, dx: REG.dx, dy: REG.dy });
  // filament
  stroke(c, [[-40, 128], [-34, 20], [-52, -10], [-26, -36], [0, -6], [26, -36], [52, -10], [34, 20], [40, 128]], tf, D, 1511, { w: 6 * s, t0: 3, t1: 3, color: lit > 0.5 ? PAL.orgD : PAL.ink });
  stroke(c, [[-96, -110], [-70, -148], [-30, -164]], tf, D, 1512, { w: 13 * s, t0: 8, t1: 10, color: PAL.hi });
  inkLoop(c, P, { seed: seedOf(D, 1510), w: 8 * s, amp: 1.5, heavy: 0.3 });
  const base = rrectPts(-64, 128, 128, 86, 18);
  inked(c, base, tf, D, 1513, { fill: PAL.grey, w: 7 * s });
  for (const y of [158, 186]) stroke(c, [[-62, y], [62, y - 6]], tf, D, 1514 + y, { w: 5 * s, t0: 3, t1: 3 });
  const tip = rrectPts(-30, 210, 60, 30, 12);
  inked(c, tip, tf, D, 1517, { fill: PAL.ink, w: 5 * s });
  return P;
}
// toggle switch pill. on 0..1 (knob position), lit 0..1 (track colour)
export const SW = { w: 330, h: 150 };
export const switchDense = () => memo('switch', () => rrectPts(-SW.w / 2, -SW.h / 2, SW.w, SW.h, SW.h / 2, 4));
export function drawSwitch(c, tf, D, k, on = 0, o = {}) {
  const s = sc(tf);
  const P = xf(switchDense(), tf);
  fillShape(c, P, mixHex(PAL.greyL, PAL.grn, clamp(o.lit ?? on)), { seed: seedOf(D, k), amp: 1.2, dx: REG.dx, dy: REG.dy });
  inkLoop(c, P, { seed: seedOf(D, k), w: 8 * s, amp: 1.4, heavy: 0.3 });
  const kx = lerp(-SW.w / 2 + SW.h / 2, SW.w / 2 - SW.h / 2, E.outBack(clamp(on), 1.6));
  const lab = on > 0.5 ? 'ON' : 'OFF';
  const lq = xf([[on > 0.5 ? -62 : 62, 2]], tf)[0];
  letters(c, lab, { font: 'KL', size: 58 * s, x: lq[0], y: lq[1], fill: on > 0.5 ? PAL.hi : 'rgba(28,22,19,0.45)', ink: null, D, seed: k + 3, amp: 0.6 });
  const Kn = xf(circlePts(kx, 0, SW.h / 2 - 14, 36), tf);
  fillShape(c, Kn, PAL.hi, { seed: seedOf(D, k + 1), amp: 1, dx: REG.dx * 0.6, dy: REG.dy * 0.6 });
  inkLoop(c, Kn, { seed: seedOf(D, k + 1), w: 7 * s, amp: 1.1, heavy: 0.3 });
  return P;
}
// rice bowl with steam
export function drawBowl(c, tf, D, t = 0) {
  const s = sc(tf);
  const rice = resample(spline([[-120, 0, 1], [-112, -40], [-70, -78], [0, -92], [70, -78], [112, -40], [120, 0, 1]], true, 4), 4, true);
  inked(c, rice, tf, D, 1600, { fill: PAL.hi, w: 6 * s });
  for (let i = 0; i < 6; i++) { const q = xf([[-70 + i * 28 + 8 * hs(i, 3), -50 + 22 * hs(i, 4)]], tf)[0]; inkLoop(c, ellPts(q[0], q[1], 8 * s, 5 * s, 10), { seed: seedOf(D, 1601 + i), w: 2.6 * s, amp: 0.4, heavy: 0 }); }
  const bowl = resample(spline([[-150, -6, 1], [150, -6, 1], [138, 50], [100, 100], [40, 124], [-40, 124], [-100, 100], [-138, 50]], true, 4), 4, true);
  inked(c, bowl, tf, D, 1610, { fill: PAL.blueL, w: 7 * s });
  stroke(c, [[-130, 30], [-60, 44], [0, 46], [60, 44], [130, 30]], tf, D, 1611, { w: 8 * s, color: PAL.blueD, t0: 4, t1: 4 });
  const foot = rrectPts(-50, 120, 100, 26, 8);
  inked(c, foot, tf, D, 1612, { fill: PAL.blue, w: 6 * s });
  for (let i = 0; i < 3; i++) {
    const x0 = -60 + i * 60, ph = t * 3 + i;
    const pts = []; for (let j = 0; j <= 8; j++) { const v = j / 8; pts.push([x0 + 14 * Math.sin(v * 6 + ph), -110 - v * 120]); }
    stroke(c, pts, tf, D, 1620 + i, { w: 7 * s, t0: 10, t1: 18, color: 'rgba(28,22,19,0.55)' });
  }
}
export const bowlDense = () => memo('bowlC', () => resample(spline([[-150, -6, 1], [-118, -10], [-105, -45], [-70, -80], [0, -94], [70, -80], [105, -45], [118, -10], [150, -6, 1], [138, 50], [100, 100], [40, 124], [-40, 124], [-100, 100], [-138, 50]], true, 4), 4, true));
// tangled thought scribble (closed loop) — "想不通"
export const scribbleDense = () => memo('scrib', () => {
  const P = [];
  for (let i = 0; i < 260; i++) { const a = i / 260 * Math.PI * 2; const r2 = 62 + 10 * Math.sin(a * 3); P.push([118 * Math.cos(a) + r2 * Math.cos(a * 7 + 0.4) + 14 * Math.sin(a * 11), 92 * Math.sin(a) + r2 * Math.sin(a * 7 + 0.4) + 12 * Math.cos(a * 13)]); }
  return P;
});
// red seal with stacked characters
export function drawSeal(c, x, y, s, str, D, k, o = {}) {
  if (s <= 0.01) return;
  c.save(); c.translate(x, y); c.rotate(o.r ?? -0.06); c.scale(s, s);
  const n = [...str].length, h = 30 + n * 96, w = 136;
  const P = rrectPts(-w / 2, -h / 2, w, h, 14, 4).map((p, i) => [p[0] + 3 * (hs(i, 7) - 0.5), p[1] + 3 * (hs(i, 8) - 0.5)]);
  fillShape(c, P, o.fill ?? '#d93a2b', { seed: seedOf(D, k), amp: 1.4, dx: 0, dy: 0 });
  const IN = rrectPts(-w / 2 + 12, -h / 2 + 12, w - 24, h - 24, 8, 4);
  inkLoop(c, IN, { seed: seedOf(D, k + 1), w: 4, amp: 1.2, heavy: 0, color: PAL.hi });
  [...str].forEach((ch, i) => letters(c, ch, { font: 'KL', size: 92, x: 0, y: -h / 2 + 15 + 48 + i * 96, fill: PAL.hi, ink: null, D, seed: k + 2 + i, amp: 0.8 }));
  c.restore();
}

// ------------------------------------------------------------------ brain (side view)
const BRAIN_C = [[-206, 20], [-212, -44], [-184, -106], [-132, -152], [-60, -176], [12, -178], [84, -164], [144, -130], [190, -80], [210, -18], [204, 44], [178, 90],
  [130, 112], [100, 134], [64, 156], [22, 168], [-8, 156], [-26, 124], [-78, 122], [-140, 108], [-188, 72]];
export const brainDense = () => memo('brain', () => resample(spline(BRAIN_C, true, 4), 4, true));
export const BRAIN_FOLDS = [
  [[-150, -60], [-110, -96], [-60, -88], [-30, -120]],
  [[-170, 10], [-120, -10], [-80, 20], [-30, -10], [10, -40]],
  [[-20, -150], [10, -110], [60, -120], [100, -90]],
  [[40, -40], [80, -60], [130, -30], [170, -50]],
  [[-110, 70], [-60, 50], [-20, 80], [30, 60], [60, 100]],
  [[90, 30], [130, 50], [170, 30]],
];
// small front-facing face. kind: happy | grin | wink | meh | sleep | shock
export function face2(c, x, y, s, kind, D, k) {
  const ww = 6 * s;
  const ln = (pts, kk, wm = 1) => inkStroke(c, pts.map(([a, b]) => [x + a * s, y + b * s]), { seed: seedOf(D, k + kk), w: ww * wm, amp: 0.8, t0: 2, t1: 2 });
  const eye = (ex, kk) => dot(c, x + ex * s, y, 11 * s, PAL.ink, D, k + kk, 0.5);
  if (kind === 'sleep' || kind === 'meh') { ln([[-46, -2], [-20, 0]], 1); ln([[20, 0], [46, -2]], 2); ln([[-16, 34], [0, 32], [16, 34]], 3, 0.9); }
  else if (kind === 'shock') { eye(-32, 1); eye(32, 2); inkLoop(c, ellPts(x, y + 38 * s, 11 * s, 15 * s, 14), { seed: seedOf(D, k + 3), w: ww, amp: 0.6, heavy: 0 }); }
  else if (kind === 'wink') { ln([[-46, 2], [-32, -10], [-18, 2]], 1); eye(32, 2); ln([[-24, 26], [0, 44], [24, 26]], 3, 1.1); }
  else {
    eye(-32, 1); eye(32, 2);
    if (kind === 'grin') { const M = spline([[-26, 22, 1], [0, 52], [26, 22, 1]], false, 3).map(([a, b]) => [x + a * s, y + b * s]); fillPoly(c, boil(resample([...M, [x, y + 22 * s]], 3, true), seedOf(D, k + 4), 0.6, 30), PAL.ink); }
    else ln([[-22, 24], [0, 40], [22, 24]], 3);
  }
  if (kind !== 'shock' && kind !== 'sleep') for (const bx of [-58, 58]) { c.save(); c.globalAlpha *= 0.55; fillPoly(c, boil(ellPts(x + bx * s, y + 26 * s, 16 * s, 9 * s, 14), seedOf(D, k + 6 + bx), 0.6, 30), '#f08a8a'); c.restore(); }
}
export function drawBrain(c, tf, D, o = {}) {
  const P = xf(brainDense(), tf);
  const s = sc(tf);
  fillShape(c, P, PAL.pink, { seed: seedOf(D, 1700), amp: 1.6, dx: REG.dx, dy: REG.dy });
  BRAIN_FOLDS.forEach((F, i) => {
    const pr = prefix(spline(F, false, 4), clamp((o.folds ?? 1) * 1.4 - i * 0.08));
    if (pr.length > 1) inkStroke(c, xf(pr, tf), { seed: seedOf(D, 1710 + i), w: 6 * s, amp: 1.2, color: PAL.pinkD, t0: 8, t1: 10, dense: true });
  });
  stroke(c, [[-160, -100], [-120, -136], [-60, -150]], tf, D, 1720, { w: 10 * s, color: PAL.hi, t0: 10, t1: 14 });
  inkLoop(c, P, { seed: seedOf(D, 1700), w: 7.5 * s, amp: 1.6, heavy: 0.35 });
  if (o.face) { const q = xf([[0, 30]], tf)[0]; face2(c, q[0], q[1], 1.15 * s, o.face, D, 1730); }
  return P;
}

// ------------------------------------------------------------------ UI bits
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
// fat block arrow (down = dir 1, up = dir -1); origin = centre
export function drawFatArrow(c, x, y, s, dir, fill, D, k) {
  const P = resample(spline([[-26, -60, 1], [26, -60, 1], [26, 6, 1], [62, 6, 1], [0, 70, 1], [-62, 6, 1], [-26, 6, 1]].map(([a, b]) => [a, b * dir, 1]), true, 3), 3, true);
  inked(c, P, T(x, y, s), D, k, { fill, w: 6 * s, amp: 1 });
}
// ECG trace (flat line with one heartbeat at cx). amp 0..1 scales the beat. returns control points (sharp corners)
export function ecgPts(x0, x1, y, cx, amp = 1, H = 420) {
  const a = amp;
  return [[x0, y, 1], [cx - 170, y, 1], [cx - 130, y - 40 * a], [cx - 92, y, 1], [cx - 58, y, 1], [cx - 40, y + 50 * a, 1], [cx, y - H * a, 1],
    [cx + 40, y + 120 * a, 1], [cx + 70, y, 1], [cx + 110, y, 1], [cx + 160, y - 70 * a], [cx + 210, y, 1], [x1, y, 1]];
}
