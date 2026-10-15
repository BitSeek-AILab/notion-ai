// 线条小人 (Line Guy) — a one-line stick figure whose limbs are ink strokes that can morph into other strokes
// (the brush strokes of 大 / 走, a chair, a flat line …). Pose → joints → polylines → boiled ink.
import { PAL, hs, clamp, lerp, E, spline, resample, xf, boil, inkStroke, inkLoop, fillShape, fillPoly, circlePts, ellPts,
  outline, arclen, toN, N3, GLOBAL } from './engine.js';

export const G = { torso: 190, thigh: 128, shin: 124, foot: 46, up: 92, fore: 88, headR: 58, neckGap: 10 };
const dir = (a) => [Math.sin(a), Math.cos(a)];           // angle from straight-down; +a swings toward +x
const add = (p, v, s) => [p[0] + v[0] * s, p[1] + v[1] * s];
const sd = (D, k) => D * 13 + k * 101;

// ------------------------------------------------------------------ poses (all angles in radians)
// lean: torso tilt (+ = toward +x); legs/arms: [{t: thigh/upper-arm angle, k: knee/elbow flex}]; hip: [x,y] offset
export function poseStand(o = {}) {
  return { hip: [0, 0], lean: o.lean ?? 0.02, legs: [{ t: -0.08, k: 0.04 }, { t: 0.08, k: 0.04 }], arms: [{ t: -0.18, k: 0.25 }, { t: 0.18, k: 0.25 }], head: o.head ?? 0, face: o.face ?? 'happy' };
}
// one step per beat: phase 0..1 covers two steps; stride ≈ thigh swing amplitude
export function poseWalk(ph, o = {}) {
  const A = o.stride ?? 0.46, arm = o.arm ?? 0.62;
  const legs = [], arms = [];
  for (let j = 0; j < 2; j++) {
    const psi = 2 * Math.PI * (ph + j / 2);
    const t = A * Math.sin(psi);
    const k = 0.08 + (o.knee ?? 1.0) * 0.95 * Math.pow(Math.max(0, Math.cos(psi + Math.PI / 4)), 2);
    legs.push({ t, k, f: 0.25 * Math.max(0, Math.cos(psi + Math.PI / 3)) });
    arms.push({ t: -arm * Math.sin(psi), k: 0.55 + 0.35 * Math.max(0, -Math.sin(psi)) });
  }
  const bob = -(o.bob ?? 14) * Math.cos(4 * Math.PI * ph);
  return { hip: [0, bob], lean: o.lean ?? 0.12, legs, arms, head: 0.05, face: o.face ?? 'happy' };
}
export function poseSit(o = {}) {
  return { hip: [0, 0], lean: o.lean ?? -0.05, legs: [{ t: 1.5, k: 1.5 }, { t: 1.42, k: 1.42 }], arms: [{ t: 0.9, k: 0.5 }, { t: 1.05, k: 0.45 }], head: o.head ?? 0.12, face: o.face ?? 'meh' };
}
// lying flat on the back, head toward -x
export function poseLie(o = {}) {
  const b = o.breath ?? 0;
  return { hip: [0, 0], lean: -Math.PI / 2 + 0.08, legs: [{ t: Math.PI / 2 - 0.02, k: 0.0 }, { t: Math.PI / 2 + 0.45, k: 0.9 }], arms: [{ t: 2.5 + b, k: -1.6 }, { t: 0.25, k: 0.1 }], head: -0.15, face: o.face ?? 'meh' };
}
// "大": arms out flat, legs spread
export function poseBig(o = {}) {
  const s = o.spread ?? 1;
  return { hip: [0, 0], lean: 0, legs: [{ t: -0.42 * s, k: 0 }, { t: 0.42 * s, k: 0 }], arms: [{ t: -Math.PI / 2 * s, k: 0 }, { t: Math.PI / 2 * s, k: 0 }], head: 0, face: o.face ?? 'grin' };
}
export function poseJump(u, o = {}) { // u: 0 crouch .. 1 airborne stretch
  const c = 1 - u;
  return { hip: [0, 0], lean: 0.05, legs: [{ t: 0.9 * c - 0.15, k: 1.6 * c + 0.05 }, { t: 0.7 * c + 0.1, k: 1.3 * c + 0.05 }], arms: [{ t: lerp(-0.6, -2.7, u), k: 0.2 }, { t: lerp(0.6, 2.7, u), k: 0.2 }], head: 0, face: o.face ?? 'grin' };
}
export function mixPose(a, b, u) {
  const L = (x, y) => lerp(x, y, u);
  return {
    hip: [L(a.hip[0], b.hip[0]), L(a.hip[1], b.hip[1])], lean: L(a.lean, b.lean), head: L(a.head ?? 0, b.head ?? 0),
    legs: a.legs.map((l, i) => ({ t: L(l.t, b.legs[i].t), k: L(l.k, b.legs[i].k), f: L(l.f ?? 0, b.legs[i].f ?? 0) })),
    arms: a.arms.map((l, i) => ({ t: L(l.t, b.arms[i].t), k: L(l.k, b.arms[i].k) })),
    face: u < 0.5 ? a.face : b.face,
  };
}

// ------------------------------------------------------------------ joints
export function solve(p) {
  const H = p.hip;
  const up = [Math.sin(p.lean), -Math.cos(p.lean)];
  const N = add(H, up, G.torso);
  const S = add(N, up, -24);
  const ha = p.lean + (p.head ?? 0);
  const C = add(N, [Math.sin(ha), -Math.cos(ha)], G.headR + G.neckGap);
  const legs = p.legs.map((l) => {
    const K = add(H, dir(l.t), G.thigh);
    const sa = l.t - l.k;
    const A = add(K, dir(sa), G.shin);
    const fa = sa + Math.PI / 2 - (l.f ?? 0);         // foot points "forward" (+x when the shin is vertical)
    const T = add(A, dir(fa), G.foot);
    return { K, A, T, sa };
  });
  const arms = p.arms.map((a) => {
    const El = add(S, dir(a.t), G.up);
    const Hd = add(El, dir(a.t + a.k), G.fore);
    return { E: El, H: Hd };
  });
  return { H, N, S, C, up, ha, legs, arms };
}

// open polylines for each limb (local coordinates)
export function limbs(J) {
  const sp = (P) => spline(P, false, 4);
  return {
    torso: sp([J.N, J.H]),
    legs: J.legs.map((l) => sp([J.H, l.K, l.A])),
    arms: J.arms.map((a) => sp([J.S, a.E, a.H])),
  };
}

// ------------------------------------------------------------------ drawing
export const SHOE = '#ff6a1f';
// sneaker: capsule from heel to toe along the foot direction
export function shoePts(A, T, s = 1) {
  const dx = T[0] - A[0], dy = T[1] - A[1], L = Math.hypot(dx, dy) || 1;
  const ux = dx / L, uy = dy / L, nx = -uy, ny = ux;   // n points "down" (sole side) for a +x foot
  const P = [];
  const h0 = -16 * s, len = L + 18 * s, hgt = 30 * s;
  const ctrl = [[-14, 4], [-14, -18], [0, -26], [len * 0.55 / s, -22], [len / s, -6], [len / s + 4, 6], [len * 0.5 / s, 10], [0, 10]];
  for (const [a, b] of ctrl) P.push([A[0] + ux * a * s + nx * b * s * -1, A[1] + uy * a * s + ny * b * s * -1]);
  return resample(spline(P, true, 3), 3, true);
}

// tf: {x, y, s, flip}  (flip = -1 mirrors to face -x).  o: {D, k, w, face, shoes, alpha, ink, faceA, headFill}
export function drawGuy(c, tf, pose, o = {}) {
  const J = solve(pose);
  const s = tf.s ?? 1, fl = tf.flip ?? 1;
  const T = (P) => P.map((p) => [tf.x + p[0] * s * fl, tf.y + p[1] * s]);
  const D = o.D ?? 0, k = o.k ?? 0;
  const w = (o.w ?? 13) * s;
  const ink = o.ink ?? PAL.ink;
  const Lb = limbs(J);
  const st = (P, kk, ww = w, col = ink) => inkStroke(c, T(P), { seed: sd(D, k + kk), w: ww, amp: (o.amp ?? 1.6), t0: 3, t1: 6, dense: true, color: col, heavy: 0.2, jit: 0.22 });
  const legInk = o.legInk ?? ink;
  // back limbs first (index 0 = far side)
  st(Lb.arms[0], 1, w * 0.95);
  st(Lb.legs[0], 2, w, legInk);
  if (o.shoes !== false) drawShoe(c, T([J.legs[0].A])[0], T([J.legs[0].T])[0], s, fl, D, k + 3, o);
  st(Lb.torso, 4, w * 1.08);
  st(Lb.legs[1], 5, w, legInk);
  if (o.shoes !== false) drawShoe(c, T([J.legs[1].A])[0], T([J.legs[1].T])[0], s, fl, D, k + 6, o);
  // head
  const hc = T([J.C])[0], R = G.headR * s;
  const HP = circlePts(hc[0], hc[1], R, 40);
  fillShape(c, HP, o.headFill ?? PAL.hi, { seed: sd(D, k + 7), amp: 1.2, dx: -3 * s, dy: 3 * s });
  inkLoop(c, HP, { seed: sd(D, k + 7), w: w * 0.95, amp: 1.4, heavy: 0.25, color: ink });
  if ((o.faceA ?? 1) > 0.02) drawFace(c, hc, R, J.ha, fl, o.face ?? pose.face, D, k + 8, o.faceA ?? 1, o);
  st(Lb.arms[1], 9, w * 0.95);
  return { J, T, hc, R };
}

export function drawShoe(c, A, T, s, fl, D, k, o = {}) {
  // build in screen space; for flipped figures the toe already points -x via T
  const P = shoePts(A, T, s);
  // ensure sole is on the ground side: if the foot points -x, mirror the normal by rebuilding with swapped sign
  let Q = P;
  if ((T[0] - A[0]) * fl < 0 || fl < 0) {
    const dx = T[0] - A[0], dy = T[1] - A[1], L = Math.hypot(dx, dy) || 1;
    const ux = dx / L, uy = dy / L, nx = -uy, ny = ux;
    Q = P.map((p) => { const rx = p[0] - A[0], ry = p[1] - A[1]; const a = rx * ux + ry * uy, b = rx * nx + ry * ny; return [A[0] + ux * a - nx * b, A[1] + uy * a - ny * b]; });
  }
  fillShape(c, Q, o.shoe ?? SHOE, { seed: sd(D, k), amp: 0.9, dx: -3 * s, dy: 2.5 * s });
  inkLoop(c, Q, { seed: sd(D, k), w: Math.max(3, 8 * s), amp: 1, heavy: 0.2, color: o.ink ?? PAL.ink });
}

export function drawFace(c, hc, R, ha, fl, face, D, k, alpha = 1, o = {}) {
  c.save(); c.globalAlpha *= alpha;
  const ca = Math.cos(ha), sa = Math.sin(ha);
  const P = (x, y) => { x *= fl; return [hc[0] + (x * ca - y * sa) * R, hc[1] + (x * sa + y * ca) * R]; };
  const ink = o.ink ?? PAL.ink, ww = Math.max(2.5, R * 0.12);
  const dotE = (x, y, r = 0.1) => { const q = P(x, y); fillPoly(c, boil(circlePts(q[0], q[1], r * R, 12), sd(D, k + x * 10), 0.6, 30), ink); };
  const line = (pts, kk, wm = 1) => inkStroke(c, pts.map(([x, y]) => P(x, y)), { seed: sd(D, k + kk), w: ww * wm, amp: 0.8, t0: 2, t1: 2, color: ink });
  if (face === 'sleep' || face === 'meh') {
    if (face === 'sleep') { line([[0.05, -0.12], [0.32, -0.1]], 1); line([[0.48, -0.12], [0.72, -0.1]], 2); }
    else { line([[0.08, -0.16], [0.3, -0.13]], 1, 0.9); line([[0.48, -0.16], [0.7, -0.13]], 2, 0.9); dotE(0.2, -0.04, 0.08); dotE(0.6, -0.04, 0.08); }
    line([[0.22, 0.38], [0.42, 0.36], [0.6, 0.38]], 3, 0.9);
  } else if (face === 'shock') {
    dotE(0.2, -0.12, 0.12); dotE(0.6, -0.12, 0.12);
    const q = P(0.42, 0.4); inkLoop(c, ellPts(q[0], q[1], 0.12 * R, 0.16 * R, 14), { seed: sd(D, k + 4), w: ww, amp: 0.6, heavy: 0, color: ink });
  } else if (face === 'wink') {
    line([[0.08, -0.08], [0.2, -0.16], [0.32, -0.08]], 1); dotE(0.6, -0.1, 0.11);
    line([[0.12, 0.28], [0.4, 0.5], [0.72, 0.26]], 3, 1.1);
  } else { // happy / grin
    dotE(0.2, -0.1, 0.11); dotE(0.6, -0.1, 0.11);
    if (face === 'grin') {
      const pts = [P(0.1, 0.22), P(0.4, 0.58), P(0.74, 0.2)];
      const M = spline([[...pts[0], 1], pts[1], [...pts[2], 1]], false, 3);
      const cl = [...M, P(0.42, 0.22)];
      fillPoly(c, boil(resample(cl, 3, true), sd(D, k + 5), 0.6, 30), ink);
    } else line([[0.14, 0.26], [0.4, 0.46], [0.68, 0.24]], 3);
    // blush
    for (const [x, y] of [[-0.12, 0.2], [0.86, 0.18]]) { const q = P(x, y); c.save(); c.globalAlpha *= 0.55; fillPoly(c, boil(ellPts(q[0], q[1], 0.15 * R, 0.09 * R, 14), sd(D, k + 6 + x), 0.6, 30), '#f08a8a'); c.restore(); }
  }
  c.restore();
}

// ------------------------------------------------------------------ strokes that morph
// A "stroke" = { p: dense polyline (screen space), w: width at u in [0,1] (function) }
export const N_ST = 64;
export const rs = (P) => toN(P, N_ST, false);
export function profile(ws) { // array of widths along the stroke → w(u)
  return (u) => { const x = clamp(u) * (ws.length - 1); const i = Math.min(ws.length - 2, Math.floor(x)); return lerp(ws[i], ws[i + 1], x - i); };
}
export function lerpStroke(a, b, u) {
  const P = a.p.map((p, i) => [lerp(p[0], b.p[i][0], u), lerp(p[1], b.p[i][1], u)]);
  return { p: P, w: (v) => lerp(a.w(v), b.w(v), u) };
}
export function drawStroke(c, st, D, k, o = {}) {
  let pts = boil(resample(st.p, 3.2), sd(D, k), o.amp ?? 1.6, 70);
  if (pts.length < 2) return;
  const tot = arclen(pts).at(-1) || 1;
  const wf = (u, s) => {
    const base = st.w(u);
    const n = 1 + 0.12 * N3(s / 60, k * 1.37, 3.1);
    const cap = Math.min(1, s / 6 + 0.35, (tot - s) / 6 + 0.35);
    return Math.max(0, base * n * cap) * GLOBAL.ink;
  };
  fillPoly(c, outline(pts, wf, true), o.color ?? PAL.ink);
}

// brush-script targets in a 1000-unit box centred on (0,0) (calibrated against a Song-style reference)
const CAL = {
  '大': [
    { p: [[-380, -130], [-200, -140], [0, -150], [200, -162], [390, -172]], w: [78, 60, 54, 56, 76] },
    { p: [[10, -460], [5, -300], [-5, -150], [-45, 40], [-135, 220], [-265, 365], [-420, 450]], w: [86, 76, 70, 56, 40, 22, 6] },
    { p: [[30, -60], [110, 90], [220, 250], [330, 370], [430, 440], [500, 455]], w: [16, 38, 58, 78, 96, 14] },
  ],
  '走': [
    { p: [[-250, -300], [0, -308], [250, -318]], w: [56, 46, 62] },
    { p: [[0, -470], [0, -320], [0, -170]], w: [62, 56, 56] },
    { p: [[-420, -150], [0, -162], [420, -178]], w: [62, 50, 72] },
    { p: [[20, -80], [20, 120], [20, 330]], w: [56, 50, 46] },
    { p: [[20, 95], [150, 91], [280, 88]], w: [44, 40, 58] },
    { p: [[-190, -40], [-200, 80], [-250, 220], [-330, 330], [-440, 410]], w: [58, 52, 40, 24, 7] },
    { p: [[-245, 235], [-120, 330], [60, 385], [260, 410], [430, 425], [500, 428]], w: [18, 40, 60, 80, 94, 14] },
  ],
};
// returns strokes in screen space: centre (x,y), glyph size S (px for the 1000-unit box)
export function calli(ch, x, y, S) {
  const k = S / 1000;
  return CAL[ch].map((st) => ({ p: rs(spline(st.p.map(([a, b]) => [x + a * k, y + b * k]), false, 4)), w: profile(st.w.map((v) => v * k)) }));
}

// the figure as morphable strokes in screen space: {torso, legs[2], arms[2], C (head centre), R}
export function guyStrokes(tf, pose, w = 13) {
  const J = solve(pose);
  const s = tf.s ?? 1, fl = tf.flip ?? 1;
  const T = (P) => P.map((p) => [tf.x + p[0] * s * fl, tf.y + p[1] * s]);
  const Lb = limbs(J);
  const W = profile([w * s, w * s, w * s]);
  const mk = (P) => ({ p: rs(T(P)), w: W });
  return { torso: mk(Lb.torso), legs: Lb.legs.map(mk), arms: Lb.arms.map(mk), C: T([J.C])[0], R: G.headR * s, J, T };
}
