// 帕斯卡 ↔ 布列安桑 · timeline + exact geometry state + camera (pure functions; also runs in Node for checks).
// Every frame is recomputed from scratch from the six angles → all incidences are exact at every instant.
import * as G from './geo.js';
import { K, E, clamp, inv, lerp } from './engine.js';

export const W = 1080, H = 1920, FPS = 30;
export const T0 = 0.489, BEAT = 0.73742;          // music grid (Memory Reboot, 81.365 BPM half-time; first downbeat 0.489 s)
// "story beats" n drive every animation. Up to story beat 48 they are the music beats; the 3-D proof (story beats
// 48–68) is played slower — each step gets time to be read — and lands its slam on music beat 80 (a bar line);
// after that story beat n is music beat n + 12.
const WARP = [[48, 48], [49.6, 49.6], [50, 51], [52, 54], [54, 58], [56, 62], [58, 64], [58.2, 65], [60, 69], [62, 71], [64, 75], [67, 79], [68, 80]];
export const SHIFT = 12;
const warp = (x, a, b) => {
  const L = WARP[0][a], R = WARP[WARP.length - 1][a];
  if (x <= L) return x; if (x >= R) return x + (WARP[WARP.length - 1][b] - R);
  for (let i = 1; i < WARP.length; i++) if (x <= WARP[i][a]) { const p = WARP[i - 1], q = WARP[i]; return p[b] + ((x - p[a]) * (q[b] - p[b])) / (q[a] - p[a]); }
  return x;
};
export const musicBeat = (n) => warp(n, 0, 1);      // story beat → music beat
export const storyBeat = (m) => warp(m, 1, 0);      // music beat → story beat
export const bt = (n) => T0 + musicBeat(n) * BEAT;  // time of story beat n (music bar k starts at music beat 4k)
export const nOf = (t) => storyBeat((t - T0) / BEAT);
export const DUR = 69.9;
export const D2R = Math.PI / 180;

export const CIRC = { x: 655, y: 978, r: 222 };
// six angles (deg, screen-clockwise, unwrapped increasing) — named configurations
export const P0 = [148.1, 184.9, 221.2, 266.0, 363.0, 462.6];   // home: Pascal line on the left, all three crossings in frame
export const P1 = [148.1, 168.9, 221.2, 242.0, 363.0, 462.6];   // after the two drags of bar 1
export const P2 = [148.1, 196.9, 221.2, 266.0, 363.0, 483.6];   // after the two drags of bar 5
export const P3 = [139.1, 169.4, 204.9, 250.0, 356.1, 474.0];   // twin-scene sway
export const Z0 = [116.0, 198.0, 214.0, 298.0, 367.0, 457.0];   // 3-D lift config: the space diagonals meet well above the floor
export const LSIGN = 1, LMAX = 1.25;

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
export const DRAGS = [  // [i, n0, n1] — hand-drag moments (used by the hand cursor)
  [3, 13.4, 14.4], [1, 14.8, 15.6], [5, 33.5, 34.5], [3, 35.0, 36.0],
];
const A_KEYS = [
  [0, P0], [13.4, P0], [14.4, with1(P0, 3, 242.0)], [14.8, with1(P0, 3, 242.0)], [15.6, P1],
  [16.5, P1], [19.5, P0, 'io2'],
  [33.5, P0], [34.5, with1(P0, 5, 483.6)], [35.0, with1(P0, 5, 483.6)], [36.0, P2],
  [36.6, P2], [39.4, P0, 'io2'],
  [40.6, P0], [42.3, P3, 'io2'], [44.0, P0, 'io2'],
  [47.0, P0], [49.5, Z0, 'io3'],
  [69.0, Z0], [71.6, P0, 'io2'],
  [76.4, P0], [78.6, P3, 'io2'], [81.2, P0, 'io2'],
];
export const baseAngles = (n) => Kv(n, A_KEYS);

export const ss = (a, b, x) => { const u = clamp((x - a) / (b - a)); return u * u * (3 - 2 * u); };
export const conicAt = () => ({ e: 0, ax: 0, p: CIRC.r });
export const anglesAt = (n) => baseAngles(n);
// u = 1 while the tangential (外切) figure is the main one, v = 1 once the crossings have become diagonals.
// The forward construction (beats 20–32) is choreographed piece by piece in film.js; u/v only drive the reverse
// "对偶回去" morph at beats 72.4–74.4 (12-gon morph + diagonals → crossings, point → line).
export const dualU = (n) => (n < 20.2 ? 0 : n < 72.4 ? 1 : K(n, [[72.4, 1], [74.2, 0, 'io2']]));
export const dualV = (n) => (n < 28.3 ? 0 : n < 72.7 ? 1 : K(n, [[72.7, 1], [74.4, 0, 'io3']]));
// 3-D lift (alternate tangent sides tilt ±λ); the slam at beat 68 flattens everything back onto the plane
export const liftAt = (n) => K(n, [[50, 0], [52, LMAX, 'io3'], [66, LMAX], [67.55, LMAX * 1.12, 'out2'], [68, 0, 'in3']]);
// "升到三维": the whole figure first rises off the floor (its shadow stays behind under the overhead light), the slam at
// beat 68 drops it back onto its own shadow
export const HOV = 300;
export const HOV2 = 420;   // beats 64–67.6: it climbs a bit higher so the shadow below shows clearly
export const hoverAt = (n) => K(n, [[48.0, 0], [49.6, HOV, 'io2'], [63.8, HOV], [65.6, HOV2, 'io2'], [67.55, HOV2 * 1.06, 'out2'], [68, 0, 'in3']]);

// ---------------------------------------------------------------- geometry at an instant
export function geomAt(n) {
  const deg = anglesAt(n), con = conicAt(n);
  const th = deg.map((d) => d * D2R);
  const C = CIRC;
  const A = th.map((a) => G.onC(C, a));
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
// crossing k → diagonal k (beats 28.3+k … 29+k)
export const flightK = (n, k) => E.io2(inv(28.3 + k, 29 + k, n));
export function wX(n) {
  if (n < 20) return ramp(8.0, 9.3, n);
  if (n < 40) return 1 - ramp(28.3, 31.5, n);              // the crossings fly off into the diagonals
  if (n < 72) return ramp(40, 41, n) * (1 - ramp(44, 45, n)); // twins overlay
  return 1 - dualV(n);
}
export const wW = (n) => (n < 72 ? ramp(20.3, 23.5, n) : 1);
function fitRaw(n) {
  const g = geomAt(n), C = g.C, pts = [];
  const cen = [C.x, C.y];
  for (let k = 0; k < 24; k++) { const ph = (15 * k) * D2R; pts.push([C.x + C.r * Math.cos(ph), C.y + C.r * Math.sin(ph)]); }
  for (const a of g.A) pts.push(a);
  const wx = wX(n), ww = wW(n);
  // a crossing far out is released smoothly (weight → 0 beyond ~3 radii) so the camera never chases it
  if (n >= 28.3 && n < 40 && g.pas.X.every(Boolean)) {
    // the crossings fly into the diagonals one by one: the camera follows the flying dots
    g.pas.X.forEach((x, k) => { const p = G.lerp2(x, G.lerp2(g.bri.W[k], g.bri.W[k + 3], 0.5), flightK(n, k)); pts.push(G.lerp2(cen, p, 1 - ss(700, 1400, G.dist(cen, p)))); });
  } else if (wx > 0 && g.pas.X.every(Boolean)) for (const x of g.pas.X) pts.push(G.lerp2(cen, x, wx * (1 - ss(700, 1400, G.dist(cen, x)))));
  if (ww > 0) for (const w of g.bri.W) pts.push(G.lerp2(cen, w, ww));
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of pts) { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); }
  const bx = boxAt(n);
  const pad = 30;
  const s = clamp(Math.min((bx[2] - bx[0] - 2 * pad) / (x1 - x0), (bx[3] - bx[1] - 2 * pad) / (y1 - y0)), 0.5, smaxAt(n));
  return { x: (x0 + x1) / 2, y: (y0 + y1) / 2, s, sx: (bx[0] + bx[2]) / 2, sy: (bx[1] + bx[3]) / 2 };
}
// screen box the figure must live in
export const BOXA = [60, 440, 1020, 1545], BOXB = [150, 440, 930, 1175];
export function boxAt(n) {
  const u = ramp(40, 40.8, n) * (1 - ramp(44, 44.8, n)) + ramp(75.6, 76.6, n);   // twins dictionary / end card below
  return BOXA.map((v, i) => lerp(v, BOXB[i], u));
}
export const smaxAt = (n) => K(n, [[0, 1.5], [7.6, 1.5], [9.0, 1.3, 'io2']]);
const SM = [-4, -3, -2, -1, 0, 1, 2, 3, 4].map((k) => [k * 0.065, Math.exp(-(k * k) / 8)]);
export function cam2D(n) {
  let x = 0, y = 0, s = 0, sx = 0, sy = 0, wsum = 0;
  const dn = 1 / BEAT;
  for (const [dt, w] of SM) { const f = fitRaw(n + dt * dn); x += f.x * w; y += f.y * w; s += f.s * w; sx += f.sx * w; sy += f.sy * w; wsum += w; }
  return { x: x / wsum, y: y / wsum, z: 0, s: s / wsum, ox: sx / wsum - W / 2, oy: sy / wsum - H / 2, pitch: 0, yaw: 0, dist: 2600 };
}
export const w3 = (n) => K(n, [[47.0, 0], [49.2, 1, 'io2'], [68.0, 1], [69.6, 0, 'io2']]);
function cam3D(n) {
  // frames the floating figure together with its shadow on the floor; at beats 63.6–66.4 it climbs toward the
  // top view ("look from straight above"), the slam then flattens everything and w3 brings the camera home
  const h0 = hoverAt(n);
  return {
    x: CIRC.x, y: CIRC.y, z: (CAMZ0 + 0.5 * h0) * (1 - ramp(67.6, 68.2, n)),
    s: K(n, [[49.6, CAMS], [63.6, CAMS], [66.4, CAMS2, 'io2'], [68.0, 0.96, 'io2']]),
    ox: CAMOX, oy: CAMOY,
    pitch: K(n, [[49.6, 57], [63.6, 60], [66.4, CAMP2, 'io2'], [68, CAMP2 - 4, 'io2']]),
    yaw: K(n, [[47.0, 0], [51.5, 30, 'io2'], [61.5, -22, 'io2'], [66.2, 0, 'io2']]),
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
