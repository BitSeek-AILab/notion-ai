// 帕斯卡 ↔ 布列安桑 · timeline + exact geometry state + camera (pure functions; also runs in Node for checks).
// Every frame is recomputed from scratch from the six angles → all incidences are exact at every instant.
import * as G from './geo.js';
import { K, E, clamp, inv, lerp } from './engine.js';

export const W = 1080, H = 1920, FPS = 30;
export const T0 = 0.489, BEAT = 0.73742;          // music grid (Memory Reboot, 81.365 BPM half-time; first downbeat 0.489 s)
export const bt = (n) => T0 + n * BEAT;            // time of beat n (bar k starts at beat 4k)
export const nOf = (t) => (t - T0) / BEAT;
export const DUR = 48.45;
export const D2R = Math.PI / 180;

export const CIRC = { x: 655, y: 978, r: 222 };
// six angles (deg, screen-clockwise, unwrapped increasing) — named configurations
export const P0 = [148.1, 184.9, 221.2, 266.0, 363.0, 462.6];   // home: Pascal line on the left, all three crossings in frame
export const P1 = [148.1, 168.9, 221.2, 242.0, 363.0, 462.6];   // after the two drags of bar 1
export const P2 = [148.1, 196.9, 221.2, 266.0, 363.0, 483.6];   // after the two drags of bar 5
export const PQ = [158.0, 182.5, 207.3, 233.7, 364.6, 457.1];   // conic scene (all six stay on the near part of the hyperbola)
export const P3 = [139.1, 169.4, 204.9, 250.0, 356.1, 474.0];   // twin-scene sway
export const Z0 = [116.0, 198.0, 214.0, 298.0, 367.0, 457.0];   // 3-D lift config: the space diagonals meet well above the floor
export const LSIGN = 1, LMAX = 1.25;
export const CON = { ax: 132.8, k: 0.21, emax: 1.5 };          // conic family r = p/(1+e cos φ), focus = circle centre

const with1 = (a, i, v) => { const b = a.slice(); b[i] = v; return b; };
// keyframed arrays: [[n, array, ease?], ...]
function Kv(n, keys) {
  if (n <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const [n1, v1, e] = keys[i];
    if (n <= n1) {
      const [n0, v0] = keys[i - 1];
      const u = (E[e || 'io2'])((n - n0) / Math.max(1e-9, n1 - n0));
      return v0.map((x, j) => x + (v1[j] - x) * u);
    }
  }
  return keys[keys.length - 1][1];
}
export const DRAGS = [  // [i, n0, n1, from, to] — hand-drag moments (used by the hand cursor + sfx)
  [3, 5.5, 6.5], [1, 6.9, 7.7], [5, 20.5, 21.5], [3, 22.0, 23.0],
];
const A_KEYS = [
  [0, P0], [5.5, P0], [6.5, with1(P0, 3, 242.0)], [6.9, with1(P0, 3, 242.0)], [7.7, P1],
  [8.0, P1], [8.75, PQ], [11.6, PQ], [12.4, P0],
  [20.5, P0], [21.5, with1(P0, 5, 483.6)], [22.0, with1(P0, 5, 483.6)], [23.0, P2],
  [24.6, P2], [26.4, P3, 'io2'], [28.6, P0, 'io2'],
  [29.0, P0], [31.5, Z0, 'io3'],
  [49.0, Z0], [51.6, P0, 'io2'],
  [56.0, P0], [58.0, P3, 'io2'], [60.0, P0, 'io2'], [62.0, P3, 'io2'], [64.0, P0, 'io2'],
];
export const baseAngles = (n) => Kv(n, A_KEYS);

export function conicAt(n) {
  const e = K(n, [[8, 0], [8.75, 0.6, 'io3'], [9.0, 0.6], [9.75, 1.0, 'io3'], [10.0, 1.0], [10.75, 1.5, 'io3'], [11.25, 1.5], [11.9, 0, 'io3']]);
  return { e, ax: CON.ax, p: CIRC.r * (1 + 0.25 * e) };
}
const wrap = (a) => ((a + 180) % 360 + 360) % 360 - 180;
export function anglesAt(n) {
  const a = baseAngles(n), con = conicAt(n);
  if (con.e <= 0) return a;
  const c = 1 - CON.k * Math.min(1, con.e / CON.emax);
  return a.map((d) => CON.ax + wrap(d - CON.ax) * c);
}
// dual morph: u = inscribed hexagon → tangential hexagon (12-gon), v = Pascal line → Brianchon point / crossings → diagonals
export const dualU = (n) => K(n, [[12.5, 0], [15.5, 1, 'io2'], [52.5, 1], [54.75, 0, 'io2']]);
export const dualV = (n) => K(n, [[14.0, 0], [15.75, 1, 'io3'], [52.9, 1], [54.75, 0, 'io3']]);
// 3-D lift (alternate tangent sides tilt ±λ); the slam at beat 48 flattens everything back onto the plane
export const liftAt = (n) => K(n, [[32, 0], [34, LMAX, 'io3'], [46, LMAX], [47.55, LMAX * 1.12, 'out2'], [48, 0, 'in3']]);

// ---------------------------------------------------------------- geometry at an instant
export function geomAt(n) {
  const deg = anglesAt(n), con = conicAt(n);
  const th = deg.map((d) => d * D2R);
  const C = CIRC, F = [C.x, C.y], ax = con.ax * D2R;
  const A = th.map((a) => G.conicPt(F, ax, con.p, con.e, a - ax));
  const pas = G.pascal(A);
  const bri = G.brianchon(C, th);
  const lam = liftAt(n);
  const lift = G.lift(C, th, LSIGN * Math.max(lam, 1e-6));
  return { n, deg, th, C, con, A, pas, bri, lam, lift, u: dualU(n), v: dualV(n) };
}

// ---------------------------------------------------------------- camera
// weights of the point groups the 2-D camera keeps in frame
const ramp = (a, b, n) => E.io2(inv(a, b, n));
export function wX(n) {
  if (n < 12) return ramp(1.6, 2.3, n);
  if (n < 24) return 1 - dualV(n);
  if (n < 30) return ramp(24, 25, n) * (1 - ramp(28.4, 29.4, n));
  if (n < 52) return 0;
  return 1 - dualV(n);
}
export const wW = (n) => (n < 56 ? dualU(n) * (n < 52 ? 1 : 1) : 1);
function fitRaw(n) {
  const g = geomAt(n), C = g.C, pts = [];
  const cen = [C.x, C.y];
  // conic: sample the arc that holds the points (full circle when e = 0)
  const span = 180 - 85 * Math.min(1, g.con.e / 0.6);
  for (let k = 0; k <= 24; k++) {
    const ph = (-span + (2 * span * k) / 24) * D2R;
    pts.push(G.conicPt(cen, g.con.ax * D2R, g.con.p, g.con.e, ph));
  }
  for (const a of g.A) pts.push(a);
  const wx = wX(n), ww = wW(n);
  if (wx > 0 && g.pas.X.every(Boolean)) for (const x of g.pas.X) pts.push(G.lerp2(cen, x, wx));
  if (ww > 0) for (const w of g.bri.W) pts.push(G.lerp2(cen, w, ww));
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of pts) { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); }
  const bx = boxAt(n);
  const pad = 30;
  const s = clamp(Math.min((bx[2] - bx[0] - 2 * pad) / (x1 - x0), (bx[3] - bx[1] - 2 * pad) / (y1 - y0)), 0.5, smaxAt(n));
  return { x: (x0 + x1) / 2, y: (y0 + y1) / 2, s, sx: (bx[0] + bx[2]) / 2, sy: (bx[1] + bx[3]) / 2 };
}
// screen box the figure must live in
export function boxAt(n) {
  const A = [80, 450, 925, 1495], B = [150, 440, 930, 1175];
  const u = ramp(55.6, 56.6, n);
  return A.map((v, i) => lerp(v, B[i], u));
}
const smaxAt = (n) => K(n, [[0, 1.3], [16, 1.3], [16.5, 1.45, 'io2'], [19.5, 1.45], [20.5, 1.3, 'io2']]);
const SM = [-4, -3, -2, -1, 0, 1, 2, 3, 4].map((k) => [k * 0.065, Math.exp(-(k * k) / 8)]);
export function cam2D(n) {
  let x = 0, y = 0, s = 0, sx = 0, sy = 0, wsum = 0;
  const dn = 1 / BEAT;
  for (const [dt, w] of SM) { const f = fitRaw(n + dt * dn); x += f.x * w; y += f.y * w; s += f.s * w; sx += f.sx * w; sy += f.sy * w; wsum += w; }
  return { x: x / wsum, y: y / wsum, z: 0, s: s / wsum, ox: sx / wsum - W / 2, oy: sy / wsum - H / 2, pitch: 0, yaw: 0, dist: 2600 };
}
export const w3 = (n) => K(n, [[29.4, 0], [31.6, 1, 'io2'], [48.0, 1], [49.6, 0, 'io2']]);
function cam3D(n) {
  const L = geomAt(Math.min(Math.max(n, 34), 46)).lift; // Q3 at full lift (push-in target)
  const q = L.Q;
  const pu = ramp(43.6, 46, n) * (1 - ramp(47.3, 48.0, n));
  return {
    x: lerp(CIRC.x, q[0], pu), y: lerp(CIRC.y, q[1], pu), z: lerp(55, q[2], pu) * (1 - ramp(47.6, 48.2, n)),
    s: K(n, [[31.6, 0.9], [43.6, 0.9], [46, 1.3, 'io2'], [47.55, 1.14, 'io2'], [48.0, 0.96, 'in2']]),
    ox: -20, oy: 40,
    pitch: K(n, [[31.6, 57], [43.6, 60], [46, 53, 'io2'], [48, 50]]),
    yaw: K(n, [[29.4, 0], [33.5, 30, 'io2'], [41.5, -22, 'io2'], [46.5, 12, 'io2'], [49.6, 0, 'io2']]),
    dist: 2600,
  };
}
export function camAt(n) {
  const c2 = cam2D(n), w = w3(n);
  if (w <= 0) return c2;
  const c3 = cam3D(n);
  const o = {};
  for (const k of ['x', 'y', 'z', 's', 'ox', 'oy', 'dist']) o[k] = lerp(c2[k], c3[k], w);
  o.pitch = c3.pitch * w;
  o.yaw = c3.yaw; // already returns to 0 at both ends of the 3-D section
  return o;
}
export function makeProj(c) {
  const a = c.pitch * D2R, b = c.yaw * D2R;
  const ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b);
  const d = c.dist, f = c.s * d, cx = W / 2 + c.ox, cy = H / 2 + c.oy;
  const P = (p) => {
    const qx0 = p[0] - c.x, qy0 = p[1] - c.y, qz = (p[2] || 0) - c.z;
    const qx = qx0 * cb - qy0 * sb, qy = qx0 * sb + qy0 * cb;
    const yc = qy * ca - qz * sa;
    const zc = d - qy * sa - qz * ca;
    const k = f / Math.max(1, zc);
    return [cx + qx * k, cy + yc * k, k / c.s, zc];
  };
  P.cam = c;
  return P;
}
export function state(t) {
  const n = nOf(t);
  const g = geomAt(n);
  g.t = t; g.cam = camAt(n); g.P = makeProj(g.cam);
  return g;
}
