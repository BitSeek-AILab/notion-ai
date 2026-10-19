// 帕斯卡 ↔ 布列安桑 · timeline + exact geometry state + camera (pure functions; also runs in Node for checks).
// Every frame is recomputed from scratch from the six angles → all incidences are exact at every instant.
import * as G from './geo.js';
import { K, E, clamp, inv, lerp } from './engine.js';
import { KD, ANCH, CUE, RNAT } from './cues.js';

export const W = 1080, H = 1920, FPS = 30;
export const T0 = 0.489, BEAT = 0.73742;          // music grid (Memory Reboot, 81.365 BPM half-time; first downbeat 0.489 s)
// v3: every animation runs on the music grid directly (beat n = music beat n; a bar = 4 beats).
//   Act I    0–48   Pascal → dual → Brianchon → 凭什么？            (unchanged from v2)
//   Act II  48–144  Brianchon proved in 3-D, five slow steps ①–⑤; slams 124 (同一点) and 140 (降维打击)
//   Act III 144–208 why duality works: point ⇄ line (pole / polar), 你在我的线上 ⇔ 我在你的线上 → Pascal (drop 208)
//   Act IV  208–256 Dandelin 1826: Pascal proved on the same 3-D figure; slam 256 (降维打击 2.0)
//   outro   256–278
export const bt = (n) => T0 + n * BEAT;
// v5: effects that belong to a scored moment (slams, flashes, rings) run on real time from their note, at natural
// speed — a teacher's hold or a slower segment never freezes a flash. cuN = natural beats since cue key, cuS = story-seconds.
let RT_ = 0;
export const setRT = (t) => { RT_ = t; };
export const cuN = (key) => (RT_ - CUE[key]) / RNAT;
export const cuS = (key) => cuN(key) * BEAT;
export const nOf = (t) => (t - T0) / BEAT;
export const musicBeat = (n) => n, storyBeat = (m) => m;
export const END = 278;      // story end (beats)
// v3: step ④ gets a 4-beat insert — the story holds at INS0 while the "why not a triangle" overlay runs on video beats
export const INS0 = 123.0, INSD = 4;
export const storyN = (nv) => (nv < INS0 ? nv : nv < INS0 + INSD ? INS0 - 1e-7 : nv - INSD);   // (hold just below 123: no beat-123 cue fires early)
export const insU = (nv) => Math.min(1, Math.max(0, (nv - INS0) / INSD));
// camera of the insert: fly up to an almost top-down view of the waist plane, hold, come back
export const insB = (nv) => (nv === undefined || nv <= INS0 || nv >= INS0 + INSD ? 0 : E.io2(inv(INS0, INS0 + 0.8, nv)) * (1 - E.io2(inv(INS0 + INSD - 0.8, INS0 + INSD, nv))));
const INSCAM = { x: 706, y: 1052, z: 430, s: 1.04, pitch: 15, yaw: 360, ox: -6, oy: 92 };
// ---- v3 calm: the teacher's clock. Every animation is still authored on (video) beats; the film plays them
// slower (k = seconds per beat ÷ BEAT) and, after each idea, holds still for H seconds (eased over w beats) so
// the viewer can read, look and think. realT(nv) = real seconds at video beat nv; warpNV(tv) is its inverse.
export const SPEED = [[-1, 1.4], [47.6, 1.4], [48.6, 1.5],         // Act I a little quicker (simple pictures), Acts II–IV calm,
  [143.2, 1.5], [143.6, 1.9], [144.4, 1.9], [145.0, 1.5],              // the 降维打击 collapse a touch slower (video beats = story 139.2–141),
  [259.2, 1.5], [259.6, 1.9], [260.4, 1.9], [261.0, 1.5],              // (same for 2.0 — video beats)
  [267.5, 1.5], [268.5, 1.3]];                                         // the end card a little quicker
const vb = (n) => (n < INS0 ? n : n + INSD);    // story beat → video beat
const Hs = (n, h, w = 0.3, q = '') => [vb(n), h, w, q], Hv = (nv, h, w = 0.3, q = '') => [nv, h, w, q];
// holds: [video beat (centre), seconds, width (beats), 'q' = think-time after a question (draws the ring timer)]
export const HOLDS = [
  // Act I
  Hs(3.3, 1.0), Hs(5.65, 0.8, 0.2), Hs(7.6, 1.2, 0.2), Hs(11.72, 2.6, 0.06, 'q'), Hs(12.75, 1.8), Hs(15.7, 0.8, 0.2),
  Hs(19.55, 2.0), Hs(23.55, 1.0), Hs(27.55, 1.2), Hs(31.62, 2.4, 0.06, 'q'), Hs(32.85, 1.8, 0.1), Hs(34.75, 1.5, 0.2), Hs(39.5, 2.0),
  Hs(43.5, 2.0), Hs(46.3, 1.6),
  // Act II
  Hs(51.0, 1.2), Hs(55.55, 1.2, 0.2), Hs(57.55, 2.6), Hs(59.42, 1.2, 0.2), Hs(63.5, 1.5), Hs(66.5, 1.2), Hs(71.5, 1.5),
  Hs(75.5, 1.2), Hs(76.75, 2.5, 0.3, 'q'), Hs(79.5, 1.0), Hs(83.6, 1.8), Hs(87.5, 1.5), Hs(88.9, 2.2, 0.3, 'q'),
  Hs(90.4, 1.2), Hs(93.0, 2.6), Hs(95.55, 1.5), Hs(99.5, 1.5), Hs(101.95, 2.2), Hs(104.65, 2.0, 0.2), Hs(109.5, 1.5, 0.2),
  Hs(113.5, 1.8, 0.2), Hs(116.65, 2.6, 0.3, 'q'), Hs(120.5, 1.5), Hs(122.45, 2.8),
  Hv(124.12, 2.8, 0.1), Hv(126.15, 2.8, 0.05),                         // the ④ insert (video beats)
  Hs(125.1, 2.2, 0.2), Hs(131.5, 1.2), Hs(133.6, 1.5), Hs(135.5, 1.5), Hs(139.2, 1.2), Hs(140.1, 1.2, 0.1), Hs(142.2, 3.0, 0.3), Hs(143.3, 3.0, 0.3),
  // Act III
  Hs(146.3, 1.6), Hs(151.4, 1.0), Hs(155.45, 1.2), Hs(159.5, 1.8), Hs(162.6, 2.6, 0.3, 'q'), Hs(167.4, 2.0),
  Hs(171.4, 2.0), Hs(175.4, 1.5), Hs(179.4, 2.6, 0.3, 'q'), Hs(183.4, 2.0), Hs(185.4, 2.5), Hs(195.55, 2.0),
  Hs(199.4, 2.0), Hs(203.45, 2.0), Hs(207.4, 2.0), Hs(209.6, 2.0),
  // Act IV
  Hs(215.0, 1.2), Hs(219.35, 1.5), Hs(223.4, 1.8), Hs(227.4, 1.2), Hs(231.4, 1.5), Hs(232.9, 1.2, 0.2), Hs(237.4, 2.0),
  Hs(240.6, 2.8, 0.3, 'q'), Hs(244.5, 2.0), Hs(248.4, 1.2), Hs(251.7, 2.8, 0.3, 'q'), Hs(255.25, 1.5), Hs(258.0, 2.5),
  // outro
  Hs(263.4, 1.5),
];
// real-time span of hold i (for the think-time ring)
export const holdSpan = (i) => { const [c, , w] = HOLDS[i]; return [realT(c - w / 2), realT(c + w / 2)]; };
const NV0 = -T0 / BEAT, NVEND = END + INSD;
const sstep = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * x * (x * (6 * x - 15) + 10));
function kInt(a, b) {   // ∫_a^b k(u) du for the piecewise-linear SPEED profile
  const K = SPEED, kAt = (u) => {
    if (u <= K[0][0]) return K[0][1];
    for (let i = 1; i < K.length; i++) if (u <= K[i][0]) { const [u0, k0] = K[i - 1], [u1, k1] = K[i]; return k0 + (k1 - k0) * (u - u0) / (u1 - u0); }
    return K[K.length - 1][1];
  };
  const cuts = [a, ...K.map((q) => q[0]).filter((u) => u > a && u < b), b];
  let s = 0;
  for (let i = 1; i < cuts.length; i++) s += 0.5 * (kAt(cuts[i - 1]) + kAt(cuts[i])) * (cuts[i] - cuts[i - 1]);
  return s;
}
export function realT0(nv) {   // the v3 teacher's clock (before 卡点)
  let s = BEAT * (nv >= NV0 ? kInt(NV0, nv) : -kInt(nv, NV0));
  for (const [c, h, w] of HOLDS) s += h * sstep((nv - c) / w + 0.5);
  return s;
}
// v5 编舞时钟 (whole film): up to the last knot of the opening (bar 6 of Op. 9 No. 2) the clock is a monotone cubic
// through [story beat, real second] knots (tools/choreo.py); after it, the film is cut into segments between anchors
// [video beat, real second] (js/cues.js ANCH: each one = a designed moment ← a note in the performance). Inside a
// segment the animation keeps its natural (v3) pace × α and the teacher's holds are scaled × β, chosen so the segment
// lasts exactly as long as the music: realT = t_i + α·BEAT·∫k + β·Σ holds (holds absorb the rubato, animation ≈ natural).
const KD_N1 = KD[KD.length - 1][0];
function hermKD(nv) {
  if (nv <= KD[0][0]) return KD[0][1] + (nv - KD[0][0]) * KD[0][2];
  let i = 0;
  while (i < KD.length - 2 && nv > KD[i + 1][0]) i++;
  const [x0, y0, m0] = KD[i], [x1, y1, m1] = KD[i + 1], h = x1 - x0, s = (nv - x0) / h, s2 = s * s, s3 = s2 * s;
  return (2 * s3 - 3 * s2 + 1) * y0 + (s3 - 2 * s2 + s) * h * m0 + (-2 * s3 + 3 * s2) * y1 + (s3 - s2) * h * m1;
}
export const natA = (a, b) => BEAT * (b >= a ? kInt(a, b) : -kInt(b, a));          // natural animation seconds
export function natH(a, b) {                                                        // natural hold seconds in [a, b]
  let s = 0;
  for (const [c, h, w] of HOLDS) s += h * (sstep((b - c) / w + 0.5) - sstep((a - c) / w + 0.5));
  return s;
}
export const SEG = [];
{ const L = [[KD_N1, KD[KD.length - 1][1]], ...ANCH.filter((a) => a[0] > KD_N1 + 1e-6)];
  for (let i = 0; i + 1 < L.length; i++) {
    const [a, ta] = L[i], [b, tb] = L[i + 1], A = natA(a, b), H = natH(a, b), D = tb - ta;
    // least squares in log space: keep the animation near its natural pace (α ≈ 1, expensive), let the holds
    // breathe (β, 16× cheaper): minimise ln²α + 0.06·ln²β subject to α·A + β·H = D, β on a log grid [0.25, 4]
    let al = D / A, be = 1;
    if (H > 0.05) {
      let best = Infinity;
      for (let j = 0; j <= 400; j++) {
        const bj = Math.exp(Math.log(0.25) + (Math.log(16) * j) / 400), aj = (D - bj * H) / A;
        if (aj <= 0.05) continue;
        const c = Math.log(aj) ** 2 + 0.06 * Math.log(bj) ** 2;
        if (c < best) { best = c; al = aj; be = bj; }
      }
      if (best === Infinity) { be = (0.5 * D) / H; al = (0.5 * D) / A; }
    }
    SEG.push({ a, b, ta, tb, A, H, al, be });
  } }
export function realT(nv) {
  if (nv <= KD_N1) return hermKD(nv);
  let lo = 0, hi = SEG.length - 1;
  if (nv >= SEG[hi].b) { const g = SEG[hi]; return g.tb + natA(g.b, nv) + natH(g.b, nv); }
  while (lo < hi) { const m = (lo + hi) >> 1; if (nv > SEG[m].b) lo = m + 1; else hi = m; }
  const g = SEG[lo];
  return g.ta + g.al * natA(g.a, nv) + g.be * natH(g.a, nv);
}
export function warpNV(tv) {
  let a = NV0 - 2, b = NVEND + 2;
  for (let i = 0; i < 56; i++) { const m = 0.5 * (a + b); if (realT(m) < tv) a = m; else b = m; }
  return 0.5 * (a + b);
}
export const DUR = Math.round(realT(NVEND) * 100) / 100;   // = the last anchor (end of the music + its tail)   // video length in seconds (story beat END)
export const D2R = Math.PI / 180;

export const CIRC = { x: 655, y: 978, r: 222 };
// six angles (deg, screen-clockwise, unwrapped increasing) — named configurations
export const P0 = [148.1, 184.9, 221.2, 266.0, 363.0, 462.6];   // home: Pascal line on the left, all three crossings in frame
export const P1 = [148.1, 168.9, 221.2, 242.0, 363.0, 462.6];   // after the two drags of bar 1
export const P2 = [148.1, 196.9, 221.2, 266.0, 363.0, 483.6];   // after the two drags of bar 5
export const P3 = [139.1, 169.4, 204.9, 250.0, 356.1, 474.0];   // twin-scene sway
// 3-D config (v3): close to P0 (rms 9.5°) so the lift-off morph is gentle; with LSIGN = −1 the slow pair's meeting
// point P₂ (边23 ∩ 边56) floats just above the waist in front-left, P₀ sits below the waist, P₁ is far up behind.
export const Y0 = [149.8, 191.3, 216.6, 272.2, 344.1, 471.8];
export const LSIGN = -1, LMAX = 0.8;

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
  [47.0, P0], [50.0, Y0, 'io3'],
  [141.0, Y0], [145.5, P0, 'io2'],              // Act III happens on the home figure
  [210.6, P0], [213.4, Y0, 'io3'],              // Act IV: the same 3-D figure again
  [256.6, Y0], [259.8, P0, 'io2'],              // outro twins on the home figure
];
export const baseAngles = (n) => Kv(n, A_KEYS);

export const ss = (a, b, x) => { const u = clamp((x - a) / (b - a)); return u * u * (3 - 2 * u); };
export const conicAt = () => ({ e: 0, ax: 0, p: CIRC.r });
export const anglesAt = (n) => baseAngles(n);
// u = 1 while the tangential (外切) figure is shown (Act I construction from beat 20 on)
export const dualU = (n) => (n < 20.2 ? 0 : 1);
export const dualV = (n) => (n < 28.3 ? 0 : 1);
// 3-D lift (alternate tangent sides tilt ±λ); each act's slam (140, 256) flattens everything back onto the plane
export const liftAt = (n) => K(n, [[52, 0], [54.6, LMAX, 'io3'], [139.5, LMAX], [139.78, LMAX * 1.1, 'out2'], [140, 0, 'in3'],
  [212.4, 0], [214.8, LMAX, 'io3'], [255.5, LMAX], [255.78, LMAX * 1.1, 'out2'], [256, 0, 'in3']]);
// the whole figure floats up off the floor (its shadow stays behind under the overhead light); step ⑤ climbs higher
export const HOV = 430, HOV2 = 500;
export const hoverAt = (n) => K(n, [[48.0, 0], [50.2, HOV, 'io2'], [128.5, HOV], [131.5, HOV2, 'io2'], [139.5, HOV2], [139.78, HOV2 * 1.05, 'out2'], [140, 0, 'in3'],
  [210.8, 0], [213.2, HOV, 'io2'], [255.5, HOV], [255.78, HOV * 1.05, 'out2'], [256, 0, 'in3']]);
export const ACT = (n) => (n < 48 ? 1 : n < 144 ? 2 : n < 208 ? 3 : n < 258 ? 4 : 5);

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
  // opposite tilted sides S_k = V_{k-1}V_k and S_{k+3} meet at P_k (above / below T_k = tangent(A_k) ∩ tangent(A_{k+3}));
  // the side P_kP_{k+1} of triangle P₀P₁P₂ pierces the waist plane at the Pascal crossing X_k (Dandelin)
  const V = lift.V, Sd = (i) => [V[(i + 5) % 6], V[i]];
  const Pk = [0, 1, 2].map((k) => G.closest3(Sd(k)[0], Sd(k)[1], Sd(k + 3)[0], Sd(k + 3)[1]));
  const Tk = [0, 1, 2].map((k) => G.tanMeet(C, th[k], th[k + 3] + (th[k + 3] < th[k] ? G.TAU : 0)));
  return { n, deg, th, C, con, A, pas, bri, lam, lift, h0, u: dualU(n), v: dualV(n), Pk, Tk };
}

// ---------------------------------------------------------------- camera
// weights of the point groups the 2-D camera keeps in frame
const ramp = (a, b, n) => E.io2(inv(a, b, n));
// crossing k → diagonal k (beats 28.3+k … 29+k)
export const flightK = (n, k) => E.io2(clamp((realT(n) - CUE.fly[k]) / (0.7 * RNAT)));   // v5: starts on its note (js/cues.js)
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
// ---------------------------------------------------------------- v3 cameras
// w3: 0 = flat top view (2-D acts), 1 = the lit 3-D camera (Acts II and IV)
export const w3 = (n) => K(n, [[47.0, 0], [49.2, 1, 'io2'], [140.15, 1], [141.8, 0, 'io2'], [210.6, 0], [212.8, 1, 'io2'], [256.15, 1], [257.8, 0, 'io2']]);
const CK = ['x', 'y', 'z', 's', 'pitch', 'yaw', 'ox', 'oy'];
// keyframes [[n, {fields}, ease?], ...] — missing fields carry over from the previous key
function prepKeys(list) {
  let prev = null;
  return list.map(([n, o, e]) => { const v = { ...(prev || {}), ...o }; prev = v; return [n, v, e]; });
}
function Kobj(n, keys) {
  const o = {};
  for (const k of CK) o[k] = K(n, keys.map(([m, v, e]) => [m, v[k], e]));
  return o;
}
const Cx = 655, Cy = 978, R0 = 222;
// world helpers for the keys: (u, v) in circle radii from the centre, z in px above the floor
const wx = (u) => Cx + u * R0, wy = (v) => Cy + v * R0;
export let CAM3 = prepKeys([
  // Act II — one slow orbit (yaw increases monotonically to 360 = back to the flat top view)
  [47.0, { x: 658.6, y: 995.5, z: 0, s: 1.3, pitch: 0, yaw: 0, ox: 0, oy: 32.5 }],          // = cam2D(47)
  [50.2, { x: 622.1, y: 987.4, z: 215, s: 1.185, pitch: 52, yaw: -10, ox: -171.8, oy: 7.7 }], // floats up over its shadow
  [52.0, {}],
  [54.6, { z: 190.6, s: 1.17, yaw: -5, ox: -129.9, oy: 76.3 }],                               // edges tilt
  [55.4, {}],
  [57.0, { x: 785.5, y: 811.9, z: 236.5, s: 1.702, pitch: 45, yaw: -15, ox: 19.2, oy: 98.8 }],  // ① zoom on vertex 4
  [59.6, { s: 1.691, yaw: -12, ox: 21.5, oy: 94.1 }],
  [62.4, { x: 651.3, y: 979, z: 350.7, s: 0.887, pitch: 48, yaw: 60, ox: -2.3, oy: -47.5 }],  // ② the whole tower
  [70.6, { s: 0.884, yaw: 64, ox: -2.2, oy: -47.2 }],
  [73.0, { x: 622.1, y: 987.4, z: 381.2, s: 1.155, yaw: 66, ox: -60.2, oy: -195.5 }],         // ③ diagonals (closer)
  [80.0, { s: 1.188, yaw: 72, ox: -33, oy: -191.6 }],
  [83.4, { x: 505.8, y: 1042.6, z: 253.3, s: 1.055, pitch: 42, yaw: 125, ox: 159.6, oy: 114.5 }], // slow pair 25 & 36
  [104.8, { s: 1.098, yaw: 137, ox: 202.3, oy: 151 }],
  [107.2, { x: 468.9, y: 861.3, z: 309.3, s: 1.391, yaw: 215, ox: 154.6, oy: 1.8 }],           // pair 36 & 14 (P₀)
  [109.6, { s: 1.29, yaw: 235, ox: 42.2, oy: 15.2 }],
  [111.6, { x: 660.4, y: 810.3, z: 524.8, s: 0.689, yaw: 315, ox: 15, oy: 198.5 }],            // pair 14 & 25 (P₁ high up)
  [113.6, { s: 0.679, yaw: 325, ox: -18.3, oy: 184.9 }],
  [115.6, { x: 608.2, y: 982.3, z: 385.7, s: 0.916, pitch: 32, yaw: 345, ox: -119.2, oy: 83 }],  // ④ only one point (low: heights show)
  [127.4, { s: 0.86, yaw: 355, ox: -93.1, oy: 44.4 }],
  [130.0, { x: 644, y: 981.1, z: 75.2, s: 1.024, pitch: 45, yaw: 358, ox: -81.3, oy: 174.4 }],  // ⑤ light from above
  [136.0, { s: 1.047, pitch: 30, yaw: 359, ox: -70.9, oy: 127.2 }],
  [139.6, { s: 1.098, pitch: 22, yaw: 360, ox: -65.6, oy: 95.1 }],
  [140.2, { x: 700.5, y: 1047.3, z: 0, s: 1.25, pitch: 0, yaw: 360, ox: 0, oy: 32.5 }],       // = camFlat(141.8)
  // Act IV (Dandelin)
  [141.9, {}],
  [210.6, { x: 546.6, y: 965.1, z: 0, s: 0.9, pitch: 0, yaw: 0, ox: 0, oy: 25 }],              // = camFlat(210.6)
  [213.4, { x: 651.3, y: 979, z: 350.7, s: 0.879, pitch: 50, yaw: -25, ox: -2.1, oy: -44.3 }],    // the tower again
  [215.6, { yaw: -27 }],
  [217.0, { x: 648.4, y: 979.9, z: 420.2, s: 1.077, pitch: 55, yaw: -28, ox: -62.8, oy: -28.6 }], // ① the gold hexagon on the waist
  [219.8, { yaw: -30, s: 1.07 }],
  [221.0, { x: 676.4, y: 965.9, z: 418.7, s: 1.27, pitch: 52, yaw: -32, ox: -140, oy: -33.7 }],    // ② one roof (vertex 4)
  [223.6, { yaw: -33, s: 1.25 }],
  [225.0, { x: 648.4, y: 979.9, z: 420.2, s: 1.062, pitch: 55, yaw: -36, ox: -64.6, oy: -2.6 }],  // all six roofs
  [227.8, { yaw: -38 }],
  [229.4, { x: 546.1, y: 864.1, z: 468.8, s: 0.786, pitch: 58, yaw: -45, ox: -44.5, oy: 237.4 }], // ③ P₀ P₁ P₂ and σ
  [233.0, { yaw: -47 }],
  [234.8, { x: 477.7, y: 899.4, z: 459.1, s: 0.764, pitch: 60, yaw: -50, ox: -31.6, oy: 192.9 }], // ④ σ's sides pierce the glass
  [248.4, { s: 0.73, pitch: 58, yaw: -47, ox: -45, oy: 183 }],
  [252.0, { s: 0.703, pitch: 56, yaw: -44, ox: -56.7, oy: 173.3 }],                                 // ⑤ two planes → one line
  [255.6, { s: 0.638, pitch: 50, yaw: -38, ox: -73, oy: 156.9 }],
  [256.2, { x: Cx, y: Cy, z: 0, s: 0.9, pitch: 0, yaw: 0, ox: 0, oy: 0 }],
]);
export const setCam3 = (list) => { CAM3 = prepKeys(list); };
function cam3D(n) { const o = Kobj(n, CAM3); o.dist = 2600; return o; }
// flat cameras for Act III / outro: fit point groups into a screen box
function fitPts(pts, bx, smax) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of pts) { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); }
  const pad = 30;
  const s = clamp(Math.min((bx[2] - bx[0] - 2 * pad) / (x1 - x0), (bx[3] - bx[1] - 2 * pad) / (y1 - y0)), 0.4, smax);
  return { x: (x0 + x1) / 2, y: (y0 + y1) / 2, s, ox: (bx[0] + bx[2]) / 2 - W / 2, oy: (bx[1] + bx[3]) / 2 - H / 2 };
}
const ringPts = (C, rr = 1) => Array.from({ length: 24 }, (_, k) => [C.x + rr * C.r * Math.cos(k * 15 * D2R), C.y + rr * C.r * Math.sin(k * 15 * D2R)]);
export const BOXC = [60, 470, 1020, 1500];
function flatFit(n, withX, bx) {
  const g = geomAt(n), pts = ringPts(g.C);
  for (const w of g.bri.W) pts.push(w);
  if (withX && g.pas.X.every(Boolean)) for (const x of g.pas.X) pts.push(G.lerp2([g.C.x, g.C.y], x, withX));
  return fitPts(pts, bx, 1.25);
}
// Act III demo camera (one point P outside the circle, its tangents / line, a formula card below)
export const DEMO = { x: wx(-0.62), y: wy(-0.2), s: 1.02, ox: 0, oy: -70 };
function camFlat(n) {
  const SMf = [-2, -1, 0, 1, 2].map((k) => [k * 0.12, Math.exp(-(k * k) / 3)]);
  const one = (m) => {
    if (m < 196) {
      const a = fitAvg(m, 0, BOXA);
      const u = E.io2(inv(146.5, 148.5, m));
      return mixCam(a, DEMO, u);
    }
    const u = E.io2(inv(195.5, 198.5, m));
    const b = flatFit(m, ramp(199.5, 201.5, m), m < 258 ? BOXC : mixBox(BOXC, BOXB, ramp(258, 260, m)));
    return mixCam(DEMO, b, u);
  };
  let o = { x: 0, y: 0, s: 0, ox: 0, oy: 0 }, ws = 0;
  for (const [dt, w] of SMf) { const c = one(n + dt); for (const k in o) o[k] += c[k] * w; ws += w; }
  for (const k in o) o[k] /= ws;
  return { ...o, z: 0, pitch: 0, yaw: 0, dist: 2600 };
}
const fitAvg = (m, wxv, bx) => flatFit(m, wxv, bx);
const mixCam = (a, b, u) => ({ x: lerp(a.x, b.x, u), y: lerp(a.y, b.y, u), s: lerp(a.s, b.s, u), ox: lerp(a.ox, b.ox, u), oy: lerp(a.oy, b.oy, u) });
const mixBox = (a, b, u) => a.map((v, i) => lerp(v, b[i], u));
export function camAt(n, nv) {
  if (globalThis.__CAMO) return { dist: 2600, ...globalThis.__CAMO };   // debug override (stills only)
  const c = camAt0(n);
  const b = insB(nv);                                                    // the ④ insert: look straight down on the waist
  if (b > 0) {
    for (const k of ['x', 'y', 'z', 's', 'ox', 'oy', 'pitch']) c[k] = lerp(c[k], INSCAM[k], b);
    c.yaw += b * (((((INSCAM.yaw - c.yaw) % 360) + 540) % 360) - 180);
  }
  return c;
}
function camAt0(n) {
  const w = w3(n);
  const c2 = n < 100 ? cam2D(n) : camFlat(n);
  if (w <= 0) return c2;
  const c3 = cam3D(n);
  if (w >= 1) return c3;
  const o = {};
  for (const k of ['x', 'y', 'z', 's', 'ox', 'oy', 'dist', 'pitch']) o[k] = lerp(c2[k], c3[k], w);
  const dy = ((((c3.yaw - c2.yaw) % 360) + 540) % 360) - 180;   // shortest way round (the Act II orbit ends at 360)
  o.yaw = c2.yaw + w * dy;
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
export function state(t, nv) {
  const n = nOf(t);
  const g = geomAt(n);
  g.t = t; g.nv = nv ?? n; g.cam = camAt(n, g.nv); g.P = makeProj(g.cam);
  return g;
}
export const _fitRaw = (n) => fitRaw(n);
