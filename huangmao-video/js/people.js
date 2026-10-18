// 黄毛理论 · characters. A line guy (5 ink strokes + head) whose head can be round (alive) or square (boxed in),
// with a flame tuft on the head (literal "黄毛") or a flame in the chest ("黄毛在心里"). Pure functions of (pose, t, D).
import { PAL, hs, clamp, lerp, E, spline, resample, boil, inkStroke, inkLoop, fillShape, fillPoly, circlePts, ellPts, N3 } from './engine.js';
import { drawFace } from './guy.js';
import { blobPts } from './fx2.js';
import { mixHex } from './shapes.js';

export const YEL = '#ffc61a', YELL = '#ffe58c', ORG = '#ff8a1f', ORGD = '#e2541b';
export const GINK = '#6d665f', GREYL = '#dcd7ce', GREYM = '#bdb6ab';
export const G0 = { torso: 190, thigh: 128, shin: 124, foot: 40, up: 92, fore: 88, headR: 58, neckGap: 10 };
export const KID = { torso: 108, thigh: 76, shin: 72, foot: 28, up: 56, fore: 52, headR: 64, neckGap: 6 };
const dir = (a) => [Math.sin(a), Math.cos(a)];
const add = (p, v, s) => [p[0] + v[0] * s, p[1] + v[1] * s];
const sd = (D, k) => D * 13 + k * 101;

export function solveP(p, g = G0) {
  const H = p.hip;
  const up = [Math.sin(p.lean), -Math.cos(p.lean)];
  const N = add(H, up, g.torso);
  const S = add(N, up, -g.torso * 0.126);
  const ha = p.lean + (p.head ?? 0);
  const C = add(N, [Math.sin(ha), -Math.cos(ha)], g.headR + g.neckGap);
  const legs = p.legs.map((l) => {
    const K = add(H, dir(l.t), g.thigh);
    const sa = l.t - l.k;
    const A = add(K, dir(sa), g.shin);
    const T = add(A, dir(sa + Math.PI / 2 - (l.f ?? 0)), g.foot);
    return { K, A, T };
  });
  const arms = p.arms.map((a) => { const El = add(S, dir(a.t), g.up); return { E: El, H: add(El, dir(a.t + a.k), g.fore) }; });
  return { H, N, S, C, ha, legs, arms };
}

// ------------------------------------------------------------------ poses (angles from straight down, + toward the facing side)
export const P = {
  stand: (o = {}) => ({ hip: [0, 0], lean: o.lean ?? 0.02, legs: [{ t: -0.08, k: 0.04 }, { t: 0.08, k: 0.04 }], arms: [{ t: -0.16, k: 0.2 }, { t: 0.16, k: 0.2 }], head: o.head ?? 0, face: o.face ?? 'happy' }),
  akimbo: (o = {}) => ({ hip: [0, 0], lean: o.lean ?? -0.04, legs: [{ t: -0.17, k: 0.02 }, { t: 0.17, k: 0.02 }], arms: [{ t: -0.9, k: 1.5 }, { t: 0.9, k: -1.5 }], head: o.head ?? -0.08, face: o.face ?? 'grin' }),
  bow: (u, o = {}) => ({ hip: [-10 * u, 0], lean: 1.12 * u, legs: [{ t: -0.07 - 0.06 * u, k: 0.03 }, { t: 0.07 - 0.06 * u, k: 0.03 }], arms: [{ t: lerp(-0.12, -1.12 * 0.95, u), k: 0.1 }, { t: lerp(0.12, -1.12 * 0.9, u), k: 0.12 }], head: 0.38 * u, face: o.face ?? 'meh' }),
  wide: (o = {}) => ({ hip: [0, 0], lean: o.lean ?? -0.08, legs: [{ t: -0.22, k: 0.02 }, { t: 0.22, k: 0.02 }], arms: [{ t: -(Math.PI / 2 + 0.32), k: 0.05 }, { t: Math.PI / 2 + 0.32, k: -0.05 }], head: o.head ?? -0.22, face: o.face ?? 'grin' }),
  cheer: (o = {}) => ({ hip: [0, 0], lean: 0, legs: [{ t: -0.2, k: 0.05 }, { t: 0.2, k: 0.05 }], arms: [{ t: -2.6, k: 0.2 }, { t: 2.6, k: -0.2 }], head: -0.12, face: o.face ?? 'grin' }),
  jump: (u, o = {}) => { const c = 1 - u; return { hip: [0, 0], lean: 0.05, legs: [{ t: 0.9 * c - 0.15, k: 1.6 * c + 0.05 }, { t: 0.7 * c + 0.1, k: 1.3 * c + 0.05 }], arms: [{ t: lerp(-0.6, -2.7, u), k: 0.2 }, { t: lerp(0.6, 2.7, u), k: 0.2 }], head: 0, face: o.face ?? 'grin' }; },
  run: (ph, o = {}) => {
    const A = o.stride ?? 0.75, legs = [], arms = [];
    for (let j = 0; j < 2; j++) {
      const psi = 2 * Math.PI * (ph + j / 2);
      legs.push({ t: A * Math.sin(psi), k: 0.15 + 1.5 * Math.pow(Math.max(0, Math.cos(psi + Math.PI / 4)), 2), f: 0.2 });
      arms.push({ t: -0.9 * Math.sin(psi), k: -1.4 });
    }
    return { hip: [0, -16 * Math.abs(Math.sin(2 * Math.PI * ph))], lean: o.lean ?? 0.32, legs, arms, head: -0.2, face: o.face ?? 'grin' };
  },
  sit: (o = {}) => ({ hip: [0, 0], lean: o.lean ?? 0.12, legs: [{ t: 1.25, k: 1.45 }, { t: 1.12, k: 1.35 }], arms: [{ t: 1.25, k: 0.15 }, { t: 1.35, k: 0.1 }], head: o.head ?? -0.1, face: o.face ?? 'grin' }),
  tuck: (o = {}) => ({ hip: [0, 0], lean: 1.05, legs: [{ t: 0.95, k: 2.1 }, { t: 0.85, k: 2.0 }], arms: [{ t: 1.0, k: 0.7 }, { t: 1.1, k: 0.6 }], head: -0.75, face: o.face ?? 'grin' }),
  old: (o = {}) => ({ hip: [0, 0], lean: 0.5, legs: [{ t: -0.05, k: 0.25 }, { t: 0.14, k: 0.3 }], arms: [{ t: 0.25, k: 0.1 }, { t: 0.62, k: -0.2 }], head: (o.head ?? -0.9), face: o.face ?? 'meh' }),
  shout: (o = {}) => ({ hip: [0, 0], lean: -0.12, legs: [{ t: -0.3, k: 0.02 }, { t: 0.3, k: 0.02 }], arms: [{ t: -0.5, k: 0.3 }, { t: 0.55, k: -0.3 }], head: -0.18, face: 'shock' }),
  laugh: (o = {}) => ({ hip: [0, 0], lean: -0.3, legs: [{ t: -0.18, k: 0.1 }, { t: 0.22, k: 0.1 }], arms: [{ t: 0.9, k: -2.1 }, { t: 1.05, k: -2.3 }], head: -0.35, face: 'grin' }),
  draw: (o = {}) => ({ hip: [0, 0], lean: 0.1, legs: [{ t: -0.12, k: 0.05 }, { t: 0.2, k: 0.05 }], arms: [{ t: -0.2, k: 0.3 }, { t: 2.2, k: -0.5 }], head: -0.1, face: 'happy' }),
  sad: (o = {}) => ({ hip: [0, 0], lean: 0.18, legs: [{ t: -0.06, k: 0.06 }, { t: 0.06, k: 0.06 }], arms: [{ t: 0.05, k: 0.05 }, { t: 0.12, k: 0.05 }], head: 0.3, face: 'meh' }),
  fallen: (o = {}) => ({ hip: [0, 0], lean: -1.35, legs: [{ t: 1.25, k: 0.5 }, { t: 1.7, k: 0.2 }], arms: [{ t: -2.4, k: 0.3 }, { t: 2.9, k: -0.5 }], head: 0.5, face: 'grin' }),
};
export function mixP(a, b, u) {
  const L = (x, y) => lerp(x, y, u);
  return {
    hip: [L(a.hip[0], b.hip[0]), L(a.hip[1], b.hip[1])], lean: L(a.lean, b.lean), head: L(a.head ?? 0, b.head ?? 0),
    legs: a.legs.map((l, i) => ({ t: L(l.t, b.legs[i].t), k: L(l.k, b.legs[i].k), f: L(l.f ?? 0, b.legs[i].f ?? 0) })),
    arms: a.arms.map((l, i) => ({ t: L(l.t, b.arms[i].t), k: L(l.k, b.arms[i].k) })),
    face: u < 0.5 ? a.face : b.face,
  };
}

// ------------------------------------------------------------------ flame (3 tongues).  base at (x,y), grows "up" (rotated by rot)
const FL = [[0, 0.03], [0.3, -0.04], [0.47, -0.22], [0.47, -0.46], [0.37, -0.64], [0.43, -0.87, 1], [0.24, -0.7], [0.14, -0.85], [0.03, -1, 1],
  [-0.1, -0.82], [-0.2, -0.64], [-0.38, -0.84, 1], [-0.43, -0.58], [-0.48, -0.34], [-0.38, -0.1]];
export function flamePts(x, y, w, h, ph = 0, rot = 0, sway = 1, lean = 0) {
  const Q = FL.map(([a, b, cr]) => {
    const k = -b;
    const sw = sway * (0.07 * Math.sin(ph * 6.3 + k * 3) + 0.045 * Math.sin(ph * 11.1 + 1.3 + k * 5)) * k * k + lean * k * k;
    const st = 1 + 0.07 * Math.sin(ph * 8.7 + a * 4) * k * sway;
    return [(a + sw) * w, b * h * st, cr];
  });
  const Dn = resample(spline(Q, true, 3), Math.max(2, Math.min(4, h / 40)), true);
  const cs = Math.cos(rot), sn = Math.sin(rot);
  return Dn.map(([px, py]) => [x + px * cs - py * sn, y + px * sn + py * cs]);
}
// s: 1 => 150 wide × 200 tall
export function drawFlame(c, x, y, s, D, k, o = {}) {
  if (s <= 0.004) return null;
  const ph = o.ph ?? D * 0.08, rot = o.rot ?? 0;
  const w = (o.w ?? 150) * s, h = (o.h ?? 200) * s;
  c.save();
  if (o.alpha !== undefined) c.globalAlpha *= clamp(o.alpha);
  if (o.glow) {
    const gr = c.createRadialGradient(x, y - h * 0.45, 0, x, y - h * 0.45, h * 1.1 * o.glow);
    gr.addColorStop(0, 'rgba(255,214,90,0.55)'); gr.addColorStop(1, 'rgba(255,214,90,0)');
    c.fillStyle = gr; c.beginPath(); c.arc(x, y - h * 0.45, h * 1.1 * o.glow, 0, Math.PI * 2); c.fill();
  }
  const Pf = flamePts(x, y, w, h, ph, rot, o.sway ?? 1, o.lean ?? 0);
  const amp = Math.min(1.4, 0.5 + s);
  fillShape(c, Pf, o.fill ?? YEL, { seed: sd(D, k), amp, dx: -4 * Math.min(1, s), dy: 3 * Math.min(1, s) });
  if (o.core !== false) {
    const ux = Math.sin(rot), uy = -Math.cos(rot);
    const Qc = flamePts(x + ux * h * 0.04, y + uy * h * 0.04, w * 0.5, h * 0.56, ph + 1.7, rot, 1.3, o.lean ?? 0);
    fillShape(c, Qc, o.coreC ?? ORG, { seed: sd(D, k + 1), amp: amp * 0.8, dx: 0, dy: 0 });
  }
  if (o.lw !== 0) inkLoop(c, Pf, { seed: sd(D, k), w: o.lw ?? Math.max(2.4, 7.5 * Math.min(1.4, s)), amp, heavy: 0.25, color: o.ink ?? PAL.ink });
  c.restore();
  return Pf;
}

// ------------------------------------------------------------------ the person
// tf {x, y (hip), s, flip}; o: {D, k, g, ink, w, headFill, square 0..1, face, tuft (flame on head, 0..), tuftC, hair: 'cap'|'quiff'|null, hairC,
//   chest (flame in chest, 0..), ph, alpha, faceA, hat}
export function person(c, tf, pose, o = {}) {
  const g = o.g ?? G0;
  const J = solveP(pose, g);
  const s = tf.s ?? 1, fl = tf.flip ?? 1;
  const T = (Q) => Q.map((p) => [tf.x + p[0] * s * fl, tf.y + p[1] * s, p[2]]);
  const D = o.D ?? 0, k = o.k ?? 0;
  const w = (o.w ?? 13) * s;
  const ink = o.ink ?? PAL.ink;
  const st = (Q, kk, ww = w) => inkStroke(c, spline(T(Q), false, 4), { seed: sd(D, k + kk), w: ww, amp: o.amp ?? 1.5, t0: 3, t1: 6, dense: true, color: ink, heavy: 0.2, jit: 0.22 });
  const leg = (l) => [J.H, l.K, [l.A[0], l.A[1], 1], l.T];
  const arm = (a) => [J.S, a.E, a.H];
  c.save();
  if (o.alpha !== undefined) c.globalAlpha *= clamp(o.alpha);
  st(arm(J.arms[0]), 1, w * 0.95);
  st(leg(J.legs[0]), 2);
  st([J.N, J.H], 4, w * 1.08);
  const ch = T([[lerp(J.N[0], J.H[0], 0.4), lerp(J.N[1], J.H[1], 0.4)]])[0];
  if ((o.chest ?? 0) > 0.01) {
    const cs = o.chest * s;
    drawFlame(c, ch[0], ch[1] + 62 * cs, 0.62 * cs, D, k + 20, { ph: o.ph ?? D * 0.08, glow: o.glow ?? 1.3, lw: Math.max(2.2, 6 * cs) });
  }
  st(leg(J.legs[1]), 5);
  // head
  const hc = T([J.C])[0], R = g.headR * s, haW = J.ha * fl;
  const sq = clamp(o.square ?? 0);
  const HP = blobPts({ x: hc[0], y: hc[1], rx: R * (1 - 0.05 * sq), ry: R * (1 - 0.05 * sq), rot: haW, n: lerp(2, 7.5, sq) }, 64);
  const up = [Math.sin(haW), -Math.cos(haW)];
  if ((o.tuft ?? 0) > 0.01) { // flame-hair behind the head outline so it grows out of the skull
    const ts = o.tuft;
    drawFlame(c, hc[0] + up[0] * R * 0.55, hc[1] + up[1] * R * 0.55, ts * R / 110, D, k + 30, { rot: haW + (o.tuftRot ?? 0), ph: o.ph ?? D * 0.08, fill: o.tuftC ?? YEL, core: o.tuftCore ?? true, lean: o.tuftLean ?? 0.08 * fl, sway: o.tuftSway ?? 1, lw: Math.max(2.4, 7 * s) });
  }
  fillShape(c, HP, o.headFill ?? PAL.hi, { seed: sd(D, k + 7), amp: 1.1, dx: -3 * s, dy: 3 * s });
  if (o.hair === 'cap') hairCap(c, hc, R, haW, fl, o.hairC ?? PAL.ink, D, k + 40, ink, s);
  inkLoop(c, HP, { seed: sd(D, k + 7), w: w * 0.92, amp: 1.3, heavy: 0.25, color: ink });
  if (o.hat) o.hat(c, hc, R, haW, D);
  if ((o.faceA ?? 1) > 0.02) drawFace(c, hc, R, haW, fl, o.face ?? pose.face, D, k + 8, o.faceA ?? 1, { ink });
  if (o.extra) o.extra(c, { hc, R, haW, T, J, ch });
  st(arm(J.arms[1]), 9, w * 0.95);
  c.restore();
  return { J, T, hc, R, haW, ch, up };
}

// hair cap (black / grey / blond): top of the skull + a jagged fringe
function hairCap(c, hc, R, ha, fl, col, D, k, ink, s) {
  const pts = [];
  for (let i = 0; i <= 18; i++) { const a = Math.PI + 0.25 + (i / 18) * (Math.PI - 0.5); pts.push([Math.cos(a) * R * 1.07, Math.sin(a) * R * 1.07]); }
  const fr = [[0.86, -0.18], [0.6, -0.42], [0.42, -0.2], [0.18, -0.46], [-0.06, -0.24], [-0.3, -0.48], [-0.5, -0.24], [-0.78, -0.4], [-0.95, -0.12]];
  for (const [x, y] of fr) pts.push([x * R * fl, y * R]);
  const cs = Math.cos(ha), sn = Math.sin(ha);
  const Q = resample(pts.map(([x, y]) => [hc[0] + x * cs - y * sn, hc[1] + x * sn + y * cs]), 3, true);
  fillShape(c, Q, col, { seed: sd(D, k), amp: 0.9, dx: 0, dy: 0 });
  inkLoop(c, Q, { seed: sd(D, k), w: Math.max(2, 5 * s), amp: 0.9, heavy: 0.1, color: ink });
}
export { mixHex };
