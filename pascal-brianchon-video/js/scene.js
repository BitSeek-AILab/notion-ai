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
export const P3 = [139.1, 169.4, 204.9, 250.0, 356.1, 474.0];   // twin-scene sway
export const Z0 = [116.0, 198.0, 214.0, 298.0, 367.0, 457.0];   // 3-D lift config: the space diagonals meet well above the floor
export const LSIGN = 1, LMAX = 1.25;
// conic scene keyframes (tools/search_conic9.mjs): circle P1 → ellipse → parabola → hyperbola → circle P0; the six
// points slide along the curve (polar angles about the focus = circle centre), every frame exact
export const CK = {"ax1":119.106,"ax2":114.239,"ax3":128.628,"e1":0.5,"p1":246.136,"f1":[-119.9,-103.8,-69.6,-41.8,-9.2,160.6],"p2":193.101,"f2":[-125.2,-111.1,-85.9,-9.2,79.2,140],"e3":1.6,"p3":355.981,"f3":[-83.2,-68.6,-44.5,28.4,91.7,105.7],"w1":[0.4,0.8],"w2":[0.2,1],"w3":[0,0.5],"P1u":[148.1,168.9,221.2,242,363,462.6],"P0u":[148.1,184.9,221.2,266,363,462.6]};
export const TL = { s1a: 8.0, s1b: 8.6, h1: 9.1, s2b: 9.6, h2: 10.15, s3b: 10.65, h3: 11.25, eB: 12.091, aA: 11.562, aB: 12.004 };

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
  [8.0, P1], [TL.aB, P0],
  [20.5, P0], [21.5, with1(P0, 5, 483.6)], [22.0, with1(P0, 5, 483.6)], [23.0, P2],
  [24.6, P2], [26.4, P3, 'io2'], [28.6, P0, 'io2'],
  [29.0, P0], [31.5, Z0, 'io3'],
  [49.0, Z0], [51.6, P0, 'io2'],
  [56.0, P0], [58.0, P3, 'io2'], [60.0, P0, 'io2'], [62.0, P3, 'io2'], [64.0, P0, 'io2'],
];
export const baseAngles = (n) => Kv(n, A_KEYS);

export const ss = (a, b, x) => { const u = clamp((x - a) / (b - a)); return u * u * (3 - 2 * u); };
const io2c = (u) => (u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2);
const io3c = (u) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
function conicStage(n) {
  const X = CK, T = TL;
  const S0 = { e: 0, p: CIRC.r, ax: X.ax1, th: X.P1u };
  const S1 = { e: X.e1, p: X.p1, ax: X.ax1, th: X.f1.map((v) => v + X.ax1) };
  const S2 = { e: 1, p: X.p2, ax: X.ax2, th: X.f2.map((v) => v + X.ax2) };
  const S3 = { e: X.e3, p: X.p3, ax: X.ax3, th: X.f3.map((v) => v + X.ax3) };
  const S4 = { e: 0, p: CIRC.r, ax: X.ax3, th: X.P0u };
  const mix = (a, b, ue, ua) => ({ e: a.e + (b.e - a.e) * ue, p: a.p + (b.p - a.p) * ue, ax: a.ax + (b.ax - a.ax) * ua, th: a.th.map((v, i) => v + (b.th[i] - v) * ua) });
  if (n <= T.s1a) return S0;
  if (n <= T.s1b) { const u = (n - T.s1a) / (T.s1b - T.s1a); return mix(S0, S1, io3c(u), io2c(clamp((u - X.w1[0]) / (X.w1[1] - X.w1[0])))); }
  if (n <= T.h1) return S1;
  if (n <= T.s2b) { const u = (n - T.h1) / (T.s2b - T.h1); return mix(S1, S2, io3c(u), io2c(clamp((u - X.w2[0]) / (X.w2[1] - X.w2[0])))); }
  if (n <= T.h2) return S2;
  if (n <= T.s3b) { const u = (n - T.h2) / (T.s3b - T.h2); return mix(S2, S3, io3c(u), io2c(clamp((u - X.w3[0]) / (X.w3[1] - X.w3[0])))); }
  if (n <= T.h3) return S3;
  return mix(S3, S4, io2c(clamp((n - T.h3) / (T.eB - T.h3))), io2c(clamp((n - T.aA) / (T.aB - T.aA))));
}
const inConic = (n) => n > TL.s1a && n < Math.max(TL.aB, TL.eB);
export function conicAt(n) {
  if (!inConic(n)) return { e: 0, ax: 0, p: CIRC.r };
  const st = conicStage(n);
  return { e: Math.max(0, st.e), ax: st.ax, p: st.p };
}
export function anglesAt(n) { return inConic(n) ? conicStage(n).th : baseAngles(n); }
// dual morph: u = inscribed hexagon → tangential hexagon (12-gon), v = Pascal line → Brianchon point / crossings → diagonals
export const dualU = (n) => K(n, [[12.5, 0], [15.5, 1, 'io2'], [52.5, 1], [54.75, 0, 'io2']]);
export const dualV = (n) => K(n, [[14.0, 0], [15.75, 1, 'io3'], [52.9, 1], [54.75, 0, 'io3']]);
// 3-D lift (alternate tangent sides tilt ±λ); the slam at beat 48 flattens everything back onto the plane
export const liftAt = (n) => K(n, [[32, 0], [34, LMAX, 'io3'], [46, LMAX], [47.55, LMAX * 1.12, 'out2'], [48, 0, 'in3']]);
// "升到三维": the whole figure first rises off the floor (its shadow stays behind under the overhead light), the slam at
// beat 48 drops it back onto its own shadow
export const HOV = 300;
export const HOV2 = 420;   // beats 44–47.6: it climbs a bit higher so the shadow below shows clearly
export const hoverAt = (n) => K(n, [[30.0, 0], [31.6, HOV, 'io2'], [43.8, HOV], [45.6, HOV2, 'io2'], [47.55, HOV2 * 1.06, 'out2'], [48, 0, 'in3']]);

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
  const h0 = hoverAt(n);
  if (h0 > 0) { for (const v of lift.V) v[2] += h0; lift.Q[2] += h0; }
  return { n, deg, th, C, con, A, pas, bri, lam, lift, h0, u: dualU(n), v: dualV(n) };
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
  // conic: the whole closed curve while it is a circle / compact ellipse; once the ellipse starts running off to
  // infinity (e → 1) the far part is released (weight → 0, continuous) and only the near arc stays framed
  const e = g.con.e, wFar = e < 0.62 ? 1 : e < 0.8 ? 1 - (e - 0.62) / 0.18 : 0, axr = g.con.ax * D2R;
  for (let k = 0; k < 24; k++) {
    const ph = (-180 + 15 * k) * D2R;
    const near = Math.abs(-180 + 15 * k) <= 60;
    if (!near && wFar <= 0) continue;
    if (1 + e * Math.cos(ph) < 0.05) continue;
    const q = G.conicPt(cen, axr, g.con.p, e, ph);
    pts.push(near ? q : G.lerp2(cen, q, wFar));
  }
  if (e > 1.05 && n > 10.4 && n < 11.4) { const r = g.con.p / (1 - e); pts.push([cen[0] + r * Math.cos(axr), cen[1] + r * Math.sin(axr)]); }
  for (const a of g.A) pts.push(a);
  const wx = wX(n), ww = wW(n);
  // a crossing that runs off toward infinity (opposite sides turning parallel during a conic morph) is released from
  // the framing box smoothly (weight → 0 beyond ~3 radii) so the camera never chases it
  if (wx > 0 && g.pas.X.every(Boolean)) for (const x of g.pas.X) pts.push(G.lerp2(cen, x, wx * (1 - ss(700, 1400, G.dist(cen, x)))));
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
  // frames the floating figure together with its shadow on the floor; at beats 43.6–46.4 it climbs toward the
  // top view ("look from straight above"), the slam then flattens everything and w3 brings the camera home
  const h0 = hoverAt(n);
  return {
    x: CIRC.x, y: CIRC.y, z: (CAMZ0 + 0.5 * h0) * (1 - ramp(47.6, 48.2, n)),
    s: K(n, [[31.6, CAMS], [43.6, CAMS], [46.4, CAMS2, 'io2'], [48.0, 0.96, 'io2']]),
    ox: CAMOX, oy: CAMOY,
    pitch: K(n, [[31.6, 57], [43.6, 60], [46.4, CAMP2, 'io2'], [48, CAMP2 - 4, 'io2']]),
    yaw: K(n, [[29.4, 0], [33.5, 30, 'io2'], [41.5, -22, 'io2'], [46.2, 0, 'io2']]),
    dist: 2600,
  };
}
export let CAMZ0 = 40, CAMS = 0.86, CAMS2 = 0.82, CAMOY = 40, CAMP2 = 52, CAMOX = 30;
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
export const _fitRaw = (n) => fitRaw(n);
