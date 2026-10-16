// 帕斯卡 ↔ 布列安桑 · 几何定理系列 01 — 48 s vertical film, every frame computed from exact projective geometry.
// Look: 02-line-art (midnight #0B1320, champagne-gold line, glowing pen tip, draw-on, dolly-out) × 05-cel-boil
// (line boil re-rolled every 2 frames, grain, cel impact FX) × 08-morph (the shape itself tells the story).
import { PAL, PAIR, clamp, lerp, inv, E, K, hs, Layers } from './engine.js';
import * as G from './geo.js';
import * as S from './scene.js';
import { BOIL, bp, rgba, mixHex, tip, sline, wline, spoly, sdot, sfill, ringWave, rays, sparkle, sparks } from './draw.js';
import { loadGlyphs, letters, measure, popIn, slamIn, dropOut } from './text.js';
import { drawLit3D, drawPool } from './lit3d.js';

export const W = S.W, H = S.H, FPS = S.FPS, DUR = S.DUR;
const bt = S.bt;
let cv, c, dpr = 1, LY;
const IMG = {};
const ramp = (a, b, n, e = 'io2') => E[e](inv(a, b, n));
const pulse = (n, n0, up, down) => (n < n0 ? 0 : n < n0 + up ? E.out2((n - n0) / up) : 1 - E.io2(clamp((n - n0 - up) / down)));

// ------------------------------------------------------------------ init
function mk(w, h) { const k = document.createElement('canvas'); k.width = Math.max(1, Math.round(w)); k.height = Math.max(1, Math.round(h)); return k; }
export async function init(canvas, dprIn = 1) {
  cv = canvas; dpr = dprIn;
  cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
  c = cv.getContext('2d');
  await loadGlyphs('./assets/glyphs.json');
  LY = new Layers(W, H, dpr);
  IMG.b1 = mk(cv.width / 2, cv.height / 2); IMG.b2 = mk(cv.width / 5, cv.height / 5);
  // background gradient + vignette (static)
  IMG.bg = mk(W, H);
  { const x = IMG.bg.getContext('2d');
    x.fillStyle = PAL.bg; x.fillRect(0, 0, W, H);
    const g = x.createRadialGradient(W * 0.5, H * 0.47, 60, W * 0.5, H * 0.5, H * 0.62);
    g.addColorStop(0, 'rgba(32,52,88,0.55)'); g.addColorStop(0.55, 'rgba(19,33,58,0.35)'); g.addColorStop(1, 'rgba(11,19,32,0)');
    x.fillStyle = g; x.fillRect(0, 0, W, H); }
  IMG.vig = mk(W, H);
  { const x = IMG.vig.getContext('2d');
    const g = x.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.72);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(2,5,12,0.62)');
    x.fillStyle = g; x.fillRect(0, 0, W, H); }
  // paper grain tile (re-rolled offsets on 2s)
  IMG.grain = mk(384, 384);
  { const x = IMG.grain.getContext('2d'), id = x.createImageData(384, 384);
    let s = 12345; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < id.data.length; i += 4) { const v = 128 + (rnd() - 0.5) * 120 + (rnd() - 0.5) * 60; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255; }
    x.putImageData(id, 0, 0); }
}

// ------------------------------------------------------------------ camera shake (impacts)
const HITS = [[4, 7, 0.10], [16, 6, 0.12], [48, 22, 0.16], [55, 7, 0.1], [64, 6, 0.1]];
function shakeAt(t) {
  let x = 0, y = 0;
  for (const [n0, A, tau] of HITS) {
    const dt = t - bt(n0);
    if (dt < 0 || dt > 6 * tau) continue;
    const a = A * Math.exp(-dt / tau);
    x += a * Math.sin(dt * 71 + n0); y += a * Math.cos(dt * 57 + n0 * 2);
  }
  return [x, y];
}

// ------------------------------------------------------------------ background: gradient + world-space dot grid on the floor (z = 0)
function drawBG(x, st, sh) {
  x.drawImage(IMG.bg, 0, 0, W, H);
  const P = st.P, sp = 56, C = S.CIRC;
  const cam = st.cam, pitch = cam.pitch;
  const R = pitch > 1 ? 1700 : 1400;
  x.save(); x.translate(sh[0] * 0.5, sh[1] * 0.5);
  x.fillStyle = PAL.grid;
  const gx0 = Math.floor((C.x - R) / sp) * sp, gy0 = Math.floor((C.y - R * 1.3) / sp) * sp;
  for (let gx = gx0; gx <= C.x + R; gx += sp) {
    for (let gy = gy0; gy <= C.y + R * 1.3; gy += sp) {
      const q = P([gx, gy, 0]);
      if (q[0] < -10 || q[0] > W + 10 || q[1] < -10 || q[1] > H + 10) continue;
      const fog = clamp(1 - (q[3] - 2600) / 2200) * clamp(1 - Math.hypot(gx - C.x, gy - C.y) / (R * 1.05));
      if (fog <= 0.02) continue;
      const r = 1.7 * Math.min(1.6, q[2]);
      x.globalAlpha = 0.72 * fog;
      x.fillRect(q[0] - r, q[1] - r, 2 * r, 2 * r);
    }
  }
  x.restore();
}

// ------------------------------------------------------------------ figure helpers
const S3 = (p) => [p[0], p[1], p[2] || 0];
function circlePts(st) {
  const C = st.C, con = st.con, P = st.P, out = [];
  if (con.e < 1e-4) { for (let i = 0; i <= 200; i++) { const a = (i / 200) * Math.PI * 2 + 200 * S.D2R; out.push(P([C.x + C.r * Math.cos(a), C.y + C.r * Math.sin(a), 0])); } out.far = false; return [out]; }
  // conic r = p/(1+e cos φ) about the focus (circle centre); r < 0 traces the far branch of a hyperbola
  const F = [C.x, C.y], ax = con.ax * S.D2R, polys = [];
  for (const far of con.e > 1 ? [false, true] : [false]) {
    let cur = [];
    for (let i = 0; i <= 720; i++) {
      const ph = (far ? 0 : -Math.PI) + (Math.PI * 2 * i) / 720, den = 1 + con.e * Math.cos(ph);
      const ok = far ? den < -1e-3 : den > 1e-3;
      const r = ok ? con.p / den : Infinity;
      if (!ok || Math.abs(r) > 2600) { if (cur.length > 1) { cur.far = far; polys.push(cur); } cur = []; continue; }
      cur.push(P([F[0] + r * Math.cos(ax + ph), F[1] + r * Math.sin(ax + ph), 0]));
    }
    if (cur.length > 1) { cur.far = far; polys.push(cur); }
  }
  return polys;
}
// extend a world segment by px (screen-ish: world units at scale ~1)
const extW = (a, b, e0, e1) => G.extend(a, b, e0, e1);
// visible span of the Pascal line through the three crossings
function pascalSpan(X, m) { return G.spanOf(X, m); }

// ------------------------------------------------------------------ the figure
function drawFigure(f, st, t, n) {
  const P = st.P, A = st.A, C = st.C, pas = st.pas, bri = st.bri, L = st.lift;
  const u = st.u, v = st.v, lam = st.lam, sc = st.cam.s;
  const is3D = st.cam.pitch > 0.5 || lam > 1e-3;
  const Ps = (p) => P(S3(p));
  // ---------- overhead lamp: a soft light pool on the floor for the whole 3-D act
  const w3v = S.w3(n);
  if (w3v > 0.003) drawPool(f, st, w3v * (0.7 + 0.5 * ramp(44, 44.5, n)));
  // ---------- the lit 3-D act (floating / lifted figure, hyperboloid, shadows) has its own renderer
  if (st.h0 > 0.5 || lam > 1e-3) { drawLit3D(f, st, t, n, LY); return; }
  // ---------- schedules
  const circDraw = E.io2(clamp((t - 0.06) / 0.5));
  const aCirc = 1 - 0.35 * ramp(30, 32, n) * (1 - ramp(48, 49, n));
  const popA = (i) => clamp((n - 0.25 * i) / 0.32);
  const hexDraw = clamp((n - 1.25) / 0.75);
  const extDraw = (k) => E.out2(clamp((n - (2 + 0.5 * k)) / 0.42));
  const xPop = (k) => clamp((n - (2.4 + 0.5 * k)) / 0.3);
  const twinA = ramp(24, 25, n) * (1 - ramp(28.4, 29.4, n));      // inscribed world overlay in bar 6
  const lateTan = ramp(56, 57, n);                                     // tangential overlay in the recap
  const aIns = n < 12.5 ? 1 : n < 52.5 ? twinA : 1;
  const aExt = n < 12.5 ? 1 - ramp(12.4, 13.0, n) : n < 52.5 ? 0.3 * twinA : 0.55 * ramp(54.6, 55.2, n);
  const aPasc = n < 15 ? 1 : n < 52.5 ? twinA : 1;                     // Pascal line + crossings (inside the v-morph they are always on)
  const sliceU = clamp((n - 3.8) / 0.2);
  const ice = PAL.ice;
  // ---------- circle / conic
  const cps = circlePts(st);
  const cw = 3.2;
  if (n < 0.62 / S.BEAT && cps.length === 1) {
    spoly(f, cps[0], { w: cw, color: PAL.gold, to: circDraw, tip: true, tipR: 22, alpha: 1 });
  } else for (const pl of cps) spoly(f, pl, { w: pl.far ? 2.6 : cw, color: PAL.gold, closed: st.con.e < 1e-4, alpha: aCirc * (pl.far ? 0.75 : 1) });
  // ---------- 3-D: hyperboloid rulings (behind everything else)
  if (lam > 1e-3) drawHyperboloid(f, st, n);
  // ---------- inscribed hexagon world (A, extensions, crossings, Pascal line)
  const As = A.map(Ps);
  const morphing = u > 1e-4 && u < 1 - 1e-4;
  const twinOnly = u >= 0.5 && twinA > 0.003;                         // bar 6: the inscribed twin over the tangential figure
  if (!morphing && (u < 0.5 || twinOnly) && aIns > 0.003) {
    // sides (one-stroke draw-on in bar 0)
    for (let i = 0; i < 6; i++) {
      const fr = n < 2.05 ? clamp(hexDraw * 6 - i) : 1;
      if (fr <= 0) continue;
      const k = i % 3;
      const col = n < 12 ? mixHex(PAL.gold, PAIR[k], 0.85 * clamp((n - (2 + 0.5 * k)) / 0.25)) : mixHex(PAL.gold, PAIR[k], 0.85);
      sline(f, As[i], As[(i + 1) % 6], { w: twinOnly ? 2.4 : 3.2, color: col, to: fr, tip: n < 2.05, alpha: aIns * (twinOnly ? 0.7 : 1) });
    }
  }
  if (u < 1 - 1e-4 || twinA > 0) {
    // extensions of the opposite sides to their crossing
    if (aExt > 0.003 && pas.X.every(Boolean)) for (let k = 0; k < 3; k++) {
      const dr = n < 12 ? extDraw(k) : 1;
      if (dr <= 0) continue;
      for (const side of [k, k + 3]) {
        const a = A[side], b = A[(side + 1) % 6], X = pas.X[k];
        // grow from the nearer endpoint toward X (plus a little overshoot)
        const near = G.dist(a, X) < G.dist(b, X) ? a : b;
        const over = G.add(X, G.mul(G.nrm(G.sub(X, near)), 46 / sc));
        sline(f, Ps(near), Ps(over), { w: 2.2, color: PAIR[k], to: dr, tip: dr < 1, alpha: aExt * 0.9 });
      }
    }
  }
  // points on the conic
  if (!morphing && aIns > 0.003 && (u < 0.5 || twinOnly)) for (let i = 0; i < 6; i++) {
    const pu = n < 2 ? popA(i) : 1;
    if (pu <= 0) continue;
    sdot(f, As[i], { r: 8.5, s: E.outBack(pu, 2.4), color: PAL.gold, alpha: aIns });
  }
  // ---------- 12-gon morph: inscribed → tangential (u)
  if (morphing) {
    const Wp = bri.W;
    for (let i = 0; i < 6; i++) {
      const a = A[i], wm = Wp[(i + 5) % 6], wp = Wp[i];
      const Tm = G.lerp2(a, wm, u), Tp = G.lerp2(a, wp, u);
      const Tn = G.lerp2(A[(i + 1) % 6], wp, u);
      sline(f, Ps(Tm), Ps(Tp), { w: 3.2, color: ice, alpha: 1 });                          // vertex → tangent segment
      sline(f, Ps(Tp), Ps(Tn), { w: 3.2, color: mixHex(PAL.gold, ice, u), alpha: 1 - 0.6 * u * u }); // side → its pole
      sdot(f, Ps(a), { r: 7.5 - 2.5 * u, color: mixHex(PAL.gold, ice, u), alpha: 1 });
    }
  }
  // ---------- tangential world (u = 1): flat or lifted
  const aTan = n < 52.5 ? (u >= 1 - 1e-4 ? 1 : 0) : (u >= 1 - 1e-4 ? 1 : lateTan);
  if (aTan > 0.003 && !morphing) drawTangential(f, st, n, aTan, is3D);
  // ---------- crossings → diagonals and Pascal line → point (v-morph) / steady states
  drawDualPieces(f, st, t, n, { aPasc, sliceU, twinA });
}

function drawTangential(f, st, n, aT, is3D) {
  const P = st.P, bri = st.bri, Lf = st.lift, lam = st.lam, A = st.A;
  const ice = PAL.ice;
  const late = n >= 52.5 && st.u < 1e-4;          // recap overlay (with the inscribed hexagon)
  const lifted = lam > 1e-3;
  const V = Lf.V;
  const Wf = bri.W.map((w) => [w[0], w[1], 0]);
  // floor shadow (planar Brianchon figure) while lifted
  const shadowA = lifted ? clamp(lam / 0.15) : 0;
  if (lifted) {
    for (let i = 0; i < 6; i++) wline(f, P, Wf[(i + 5) % 6], Wf[i], { w: 2, color: ice, alpha: 0.42 * aT * shadowA, dash: [10, 9] });
    for (let i = 0; i < 6; i++) { const q0 = P(V[i]), q1 = P(Wf[i]); sline(f, q0, q1, { w: 1.4, color: PAL.cream, alpha: 0.3 * aT * shadowA, dash: [4, 7] }); }
  }
  // sides (tilted when lifted). side i: V[i-1] → V[i], passes through the tangent point A_i on the floor
  for (let i = 0; i < 6; i++) {
    const a = lifted ? V[(i + 5) % 6] : Wf[(i + 5) % 6], b = lifted ? V[i] : Wf[i];
    if (lifted) seg3(f, P, a, b, { w: 3.2, color: ice, alpha: aT * (late ? 0.75 : 1) });
    else wline(f, P, a, b, { w: 3.2, color: ice, alpha: aT * (late ? 0.75 : 1) });
  }
  // tangent points
  for (let i = 0; i < 6; i++) sdot(f, P([A[i][0], A[i][1], 0]), { r: 5.5, color: ice, core: '#0B1320', alpha: aT * (late ? 0.0 : 0.9) });
  // vertices
  for (let i = 0; i < 6; i++) sdot(f, P(lifted ? V[i] : Wf[i]), { r: 7.5, color: ice, alpha: aT * (late ? 0.7 : 1) });
}
// 3-D segment: the part under the floor is drawn fainter
function seg3(f, P, a, b, o) {
  if ((a[2] >= 0 && b[2] >= 0) || (a[2] <= 0 && b[2] <= 0)) {
    const under = a[2] + b[2] < 0;
    wline(f, P, a, b, { ...o, alpha: o.alpha * (under ? 0.5 : 1) });
    return;
  }
  const u = a[2] / (a[2] - b[2]), m = G.lerp3(a, b, u);
  wline(f, P, a, m, { ...o, alpha: o.alpha * (a[2] < 0 ? 0.5 : 1) });
  wline(f, P, m, b, { ...o, alpha: o.alpha * (b[2] < 0 ? 0.5 : 1) });
}

function drawHyperboloid(f, st, n) {
  const a = ramp(34, 35.6, n) * (1 - ramp(43.5, 45, n));
  if (a <= 0.003) return;
  const P = st.P, C = st.C, lam = st.lam * S.LSIGN, R = C.r, N = 22;
  const tm = 1.3 * R;
  for (const fam of [1, -1]) {
    for (let j = 0; j < N; j++) {
      const ph = (j / N) * Math.PI * 2 + (fam > 0 ? 0 : Math.PI / N);
      const A0 = [C.x + R * Math.cos(ph), C.y + R * Math.sin(ph)], T = G.tanDir(ph);
      const p = [A0[0] - T[0] * tm, A0[1] - T[1] * tm, -fam * lam * tm], q = [A0[0] + T[0] * tm, A0[1] + T[1] * tm, fam * lam * tm];
      seg3(f, P, p, q, { w: 1.3, color: PAL.ice, alpha: 0.2 * a, depth: false });
    }
  }
  // rims
  for (const z of [lam * tm, -lam * tm]) {
    const rr = Math.sqrt(R * R + tm * tm), pts = [];
    for (let i = 0; i <= 96; i++) { const ph = (i / 96) * Math.PI * 2; pts.push(P([C.x + rr * Math.cos(ph), C.y + rr * Math.sin(ph), z])); }
    spoly(f, pts, { w: 1.5, color: PAL.ice, alpha: (z > 0 ? 0.32 : 0.16) * a });
  }
}

function drawDualPieces(f, st, t, n, o) {
  const P = st.P, pas = st.pas, bri = st.bri, Lf = st.lift, v = st.v, sc = st.cam.s, lam = st.lam;
  const Ps = (p) => P(S3(p));
  const X = pas.X, ok = X.every(Boolean);
  const Bp = bri.B;
  const inV = v > 1e-4 && v < 1 - 1e-4;
  const lifted = lam > 1e-3;
  // ---- the Pascal line (red) and its three crossings
  if (ok && (v < 1 - 1e-4 || (o.twinA > 0.003 && n < 52.5))) {
    const span = pascalSpan(X, 80 / sc);
    let a = span[0], b = span[1];
    if (inV) { const ev = E.io2(v); a = G.lerp2(a, Bp, ev); b = G.lerp2(b, Bp, ev); }
    const aL = inV ? 1 : o.aPasc;
    if (n < 4.0 && n >= 3.8) {
      sline(f, Ps(a), Ps(b), { w: 4.4, color: PAL.red, to: E.in2(o.sliceU), tip: true, tipR: 30, halo: 4, alpha: 1 });
    } else if (n >= 4.0) {
      const flash = pulse(n, 4, 0.05, 1.2);
      sline(f, Ps(a), Ps(b), { w: 4.4 + 3 * flash, color: mixHex(PAL.red, '#FFD0D8', flash * 0.6), halo: 4.5, alpha: aL });
    }
    // crossings
    for (let k = 0; k < 3; k++) {
      const pu = n < 12 ? xPopK(n, k) : 1;
      if (pu <= 0) continue;
      let p = X[k], s = E.outBack(pu, 2.6);
      if (inV) { const ev = E.io2(v); const M = G.lerp2(bri.W[k], bri.W[k + 3], 0.5); p = G.lerp2(X[k], M, ev); s *= 1 - v; }
      const aX = inV ? 1 : o.aPasc;
      sdot(f, Ps(p), { r: 10.5, s, color: PAIR[k], core: '#FFFFFF', halo: 3.2, alpha: aX });
    }
  }
  // ---- diagonals (growing out of the crossings during the morph) and the Brianchon point
  const aDiag = inV ? 1 : (v >= 1 - 1e-4 ? 1 : 0);
  const recap = n >= 56 ? ramp(56, 57, n) : 0;
  const diagA = n >= 52.5 && v < 1e-4 ? 0.7 * recap : aDiag;
  if (diagA > 0.003) {
    for (let k = 0; k < 3; k++) {
      const W0 = bri.W[k], W1 = bri.W[k + 3];
      if (inV) {
        const ev = E.io2(v), M = G.lerp2(W0, W1, 0.5), cen = G.lerp2(X[k] || M, M, ev);
        const d = G.nrm(G.sub(W1, W0)), hl = ev * (G.dist(W0, W1) / 2 + 24 / sc);
        sline(f, Ps(G.sub(cen, G.mul(d, hl))), Ps(G.add(cen, G.mul(d, hl))), { w: 3, color: PAIR[k], alpha: 1 });
      } else if (lifted) {
        // floor shadow of the diagonals + the space diagonals (drawn on at beats 36/36.5/37)
        const sh = clamp(lam / 0.2);
        wline(f, P, [W0[0], W0[1], 0], [W1[0], W1[1], 0], { w: 2, color: PAIR[k], alpha: 0.32 * sh, dash: [10, 9] });
        const dr = E.out2(clamp((n - (36 + 0.5 * k)) / 0.45));
        const glow = 0.25 * planeGlow(n, k) + 0.25 * planeGlow(n, (k + 2) % 3);
        if (dr > 0) {
          const [a3, b3] = ext3(Lf.V[k], Lf.V[k + 3], 0.1);
          const q0 = P(a3), q1 = P(b3);
          sline(f, q0, q1, { w: 3.2 + 2 * glow, color: PAIR[k], to: dr, tip: dr < 1, halo: 2 + 3 * glow, alpha: 1 });
        }
      } else {
        const [a, b] = G.extend(W0, W1, 24 / sc, 24 / sc);
        const hi = n >= 64 ? 0 : pulse(n, 16, 0.05, 1.5) + pulse(n, 48, 0.04, 1.8);
        sline(f, Ps(a), Ps(b), { w: 3 + 2 * hi, color: PAIR[k], halo: 2 + 2 * hi, alpha: diagA });
      }
    }
  }
  // ---- planes through pairs of space diagonals (the heart of the 3-D proof)
  if (lifted) {
    for (let k = 0; k < 3; k++) {
      const g = planeGlow(n, k);
      if (g <= 0.003) continue;
      const V = Lf.V, q = [V[k], V[(k + 1) % 6], V[(k + 3) % 6], V[(k + 4) % 6]].map(P);
      const col = mixHex(PAIR[k], PAIR[(k + 1) % 3], 0.5);
      sfill(f, q, col, 0.2 * g);
      for (let e = 0; e < 4; e++) sline(f, q[e], q[(e + 1) % 4], { w: 1.6, color: col, alpha: 0.55 * g, dash: [8, 8] });
    }
  }
  // ---- the Brianchon point / its 3-D ancestor
  if (lifted) {
    // shadow point on the floor
    sdot(f, P([Bp[0], Bp[1], 0]), { r: 7, color: PAL.red, core: '#FFD9DF', alpha: 0.55 * clamp(lam / 0.2) });
    const qp = clamp((n - 40.4) / 0.35);
    if (qp > 0) {
      const q = P(Lf.Q);
      sdot(f, q, { r: 11, s: E.outBack(qp, 2.6), color: PAL.red, core: '#FFFFFF', halo: 4 + 3 * pulse(n, 42, 0.05, 1.2), alpha: 1 });
    }
    // the vertical beam: "look straight down"
    const ba = ramp(44.2, 45, n);
    if (ba > 0) {
      const q0 = P(Lf.Q), q1 = P([Bp[0], Bp[1], 0]);
      sline(f, q0, q1, { w: 10, color: PAL.cream, alpha: 0.12 * ba });
      sline(f, q0, q1, { w: 2.2, color: PAL.cream, alpha: 0.85 * ba, dash: [6, 7], dashOff: -t * 60 });
    }
  } else if (v > 0.85 || (n >= 52.5 && v > 1e-4)) {
    const bs = inV ? clamp((v - 0.82) / 0.18) : 1;
    const hi = pulse(n, 16, 0.05, 1.6) + pulse(n, 48, 0.04, 2);
    sdot(f, Ps(Bp), { r: 11.5, s: E.outBack(bs, 2.4) * (1 + 0.25 * hi), color: PAL.red, core: '#FFFFFF', halo: 3.5 + 4 * hi, alpha: 1 });
  } else if (n >= 56 && v < 1e-4) {
    sdot(f, Ps(Bp), { r: 10, color: PAL.red, core: '#FFFFFF', halo: 3, alpha: recap });
  }
  // ---- bar 6 twin: O, the perpendicular O→B→ℓ and the right angle
  const oa = ramp(25.2, 26, n) * (1 - ramp(28.2, 29, n));
  if (oa > 0.003 && ok) {
    const O = [st.C.x, st.C.y];
    const foot = footOn(pas.line, O);
    sline(f, Ps(O), Ps(foot), { w: 1.8, color: PAL.cream, alpha: 0.75 * oa, dash: [9, 8] });
    sdot(f, Ps(O), { r: 5, color: PAL.cream, alpha: oa });
    rightMark(f, Ps, foot, O, pas.line, 22 / sc, oa);
  }
}
const xPopK = (n, k) => clamp((n - (2.4 + 0.5 * k)) / 0.3);
function ext3(a, b, e) { const d = G.sub3(b, a); return [G.sub3(a, G.mul3(d, e)), G.add3(b, G.mul3(d, e))]; }
function planeGlow(n, k) { const n0 = 37.5 + 0.75 * k; return pulse(n, n0, 0.12, 0.9) * 0.7 + 0.3 * ramp(n0, n0 + 0.3, n) * (1 - ramp(40.2, 41, n)); }
function footOn(l, p) { const d = G.lineDist(l, p), nn = G.nrm([l[0], l[1]]); return [p[0] - nn[0] * d, p[1] - nn[1] * d]; }
function rightMark(f, Ps, foot, O, l, s, a) {
  const d1 = G.nrm(G.sub(O, foot)), d2 = G.nrm([-l[1], l[0]]);
  const p1 = G.add(foot, G.mul(d1, s)), p2 = G.add(p1, G.mul(d2, s)), p3 = G.add(foot, G.mul(d2, s));
  sline(f, Ps(p1), Ps(p2), { w: 1.8, color: PAL.cream, alpha: 0.8 * a });
  sline(f, Ps(p2), Ps(p3), { w: 1.8, color: PAL.cream, alpha: 0.8 * a });
}

// ------------------------------------------------------------------ hand (touch indicator) for the drags
function drawHand(f, st, t, n) {
  const P = st.P;
  const D = S.DRAGS;
  for (let j = 0; j < D.length; j++) {
    const [i, n0, n1] = D[j];
    const prev = D[j - 1], next = D[j + 1];
    const chainIn = prev && n0 - prev[2] < 1.0, chainOut = next && next[1] - n1 < 1.0;
    const a0 = chainIn ? prev[2] + 0.12 : n0 - 0.5, a1 = chainOut ? next[1] : n1 + 0.5;
    if (n < a0 || n > a1) continue;
    if (chainOut && n > n1 + 0.12) continue; // the next drag draws the travel
    const pt = (nn) => { const g = S.geomAt(nn); return P([g.A[i][0], g.A[i][1], 0]); };
    let p, alpha = 1, press = 0;
    if (n < n0) {
      const target = pt(n0);
      let from;
      if (chainIn) { const g = S.geomAt(prev[2]); from = P([g.A[prev[0]][0], g.A[prev[0]][1], 0]); }
      else from = [target[0] + 90, target[1] + 150];
      const u = E.io2(inv(a0, n0, n));
      p = [lerp(from[0], target[0], u), lerp(from[1], target[1], u)];
      alpha = chainIn ? 1 : u; press = clamp((n - (n0 - 0.12)) / 0.12);
    } else if (n <= n1) { p = pt(n); press = 1; }
    else {
      const from = pt(n1), u = E.io2(inv(n1, a1, n));
      p = [from[0] + 90 * u, from[1] + 150 * u]; alpha = 1 - u; press = 1 - clamp((n - n1) / 0.12);
    }
    touch(f, p, press, alpha, t, n0);
  }
}
function touch(f, p, press, alpha, t, n0) {
  const r = 30 - 6 * press;
  f.save(); f.globalAlpha *= alpha;
  f.beginPath(); f.arc(p[0], p[1], r, 0, Math.PI * 2); f.fillStyle = rgba(PAL.cream, 0.14 + 0.12 * press); f.fill();
  f.lineWidth = 3; f.strokeStyle = rgba(PAL.cream, 0.95); f.stroke();
  f.restore();
  const dt = t - bt(n0);
  if (dt > 0 && dt < 0.5) ringWave(f, p, dt / 0.5, { r0: 24, R: 74, w: 3, color: PAL.cream, alpha: alpha * 0.9 });
}

// ------------------------------------------------------------------ impacts
function drawImpacts(f, st, t, n) {
  const P = st.P, pas = st.pas, bri = st.bri;
  const Ps = (p) => P(S3(p));
  const at = (n0, d) => (t - bt(n0)) / d;
  // bar 1: the red line lands
  if (pas.X.every(Boolean) && n > 3.9 && n < 6) {
    for (let k = 0; k < 3; k++) { const q = Ps(pas.X[k]); ringWave(f, q, at(4, 0.55), { R: 120, w: 4, color: PAIR[k] }); rays(f, q, at(4, 0.4), { n: 10, R0: 22, R1: 120, w: 5, seed: k + 1, color: PAL.cream }); }
  }
  // bar 3 end: "still collinear" on the hyperbola
  if (pas.X.every(Boolean) && n > 10.9 && n < 12.5) { const q = Ps(pas.X[1]); ringWave(f, q, at(11, 0.6), { R: 140, w: 4, color: PAL.red }); }
  // bar 4: Brianchon point
  if (n > 15.9 && n < 18) {
    const q = Ps(bri.B);
    ringWave(f, q, at(16, 0.6), { R: 170, w: 5, color: PAL.red }); ringWave(f, q, at(16.25, 0.6), { R: 240, w: 3, color: PAL.cream });
    rays(f, q, at(16, 0.42), { n: 16, R0: 26, R1: 190, w: 6, seed: 7, color: PAL.cream });
    sparks(f, q, at(16, 0.7), { n: 16, R: 230, seed: 4, colors: [PAL.cream, PAL.red, PAL.gold] });
  }
  // 3-D: the single meeting point
  if (st.lam > 0.05 && n > 41.9 && n < 44) { const q = P(st.lift.Q); ringWave(f, q, at(42, 0.6), { R: 130, w: 4, color: PAL.red }); sparkle(f, q, 46 * (1 - clamp(at(42, 0.5))), at(42, 1) * 3, PAL.cream, 1 - clamp(at(42, 0.5))); }
  // HERO slam
  if (n > 47.95 && n < 51) {
    const q = Ps(bri.B);
    ringWave(f, q, at(48, 0.5), { R: 260, w: 9, color: PAL.cream });
    ringWave(f, q, at(48.12, 0.7), { R: 420, w: 6, color: PAL.red });
    ringWave(f, q, at(48.3, 0.9), { R: 620, w: 4, color: PAL.ice });
    rays(f, q, at(48, 0.5), { n: 26, R0: 40, R1: 520, w: 10, seed: 11, color: PAL.cream });
    sparks(f, q, at(48, 0.9), { n: 28, R: 460, seed: 9, w: 4, colors: [PAL.cream, PAL.red, PAL.gold, PAL.ice] });
  }
  // bar 13: Pascal again
  if (pas.X.every(Boolean) && n > 54.9 && n < 57) {
    for (let k = 0; k < 3; k++) { const q = Ps(pas.X[k]); ringWave(f, q, at(55, 0.55), { R: 110, w: 4, color: PAIR[k] }); }
  }
}

// ------------------------------------------------------------------ texts
const TY = 250, TY2 = 368, CY = 1610;
const T = [];   // {n0, n1, s, font, size, y, x, fill, hl, ent, ext, draw}
const add = (o) => T.push(o);
// bar 0 — the hook
add({ n0: -0.6, n1: 1.25, s: '圆上任取[6]个点', size: 100, y: TY, ent: 'pop' });
add({ n0: 1.25, n1: 2.0, s: '连成六边形', size: 100, y: TY, ent: 'pop' });
add({ n0: 2.0, n1: 3.95, s: '延长三组[对边]', size: 100, y: TY, ent: 'pop' });
add({ n0: 4.0, n1: 5.5, s: '三个交点 · [共线]！', size: 112, y: TY, ent: 'slam', hl: PAL.red });
add({ n0: 5.5, n1: 7.95, s: '[帕斯卡]定理', size: 112, y: TY, ent: 'draw', hl: PAL.gold });
add({ n0: 6.1, n1: 7.95, s: '1639年 · 帕斯卡才16岁', font: 'SM', size: 52, y: TY2 + 8, ent: 'pop', fill: PAL.gold });
add({ n0: 5.35, n1: 7.9, s: '随便拖 · 永远共线', font: 'WK', size: 62, y: CY, ent: 'pop' });
// bar 2 — conics
add({ n0: 8.0, n1: 10.95, s: '换成别的[圆锥曲线]？', size: 92, y: TY, ent: 'pop' });
add({ n0: 8.4, n1: 9.4, s: '[椭圆]', font: 'WK', size: 76, y: CY - 16, ent: 'pop', hl: PAL.gold });
add({ n0: S.TL.s2b, n1: S.TL.h2 - 0.08, s: '[抛物线]', font: 'WK', size: 76, y: CY - 16, ent: 'pop', hl: PAL.gold });
add({ n0: S.TL.h2 + 0.3, n1: S.TL.h3, s: '[双曲线]', font: 'WK', size: 76, y: CY - 16, ent: 'pop', hl: PAL.gold });
add({ n0: 11.0, n1: 11.95, s: '照样 · [共线]！', size: 112, y: TY, ent: 'slam', hl: PAL.red });
add({ n0: 8.5, n1: 11.95, s: '都是圆的“影子” · 直线的影子还是直线', font: 'SM', size: 48, y: TY2 + 8, ent: 'pop', fill: PAL.gold });
// bar 3 — duality
add({ n0: 12.0, n1: 15.95, s: '把[点]和[线]互换', size: 104, y: TY, ent: 'pop', hl: PAL.ice });
add({ n0: 12.6, n1: 13.95, s: '顶点 → 切线　边 → 顶点', font: 'WK', size: 58, y: CY, ent: 'pop' });
add({ n0: 14.0, n1: 15.95, s: '交点 → 对角线　红线 → 红点', font: 'WK', size: 58, y: CY, ent: 'pop' });
// bar 4 — Brianchon
add({ n0: 16.0, n1: 17.45, s: '三条对角线', size: 100, y: TY - 58, ent: 'slam' });
add({ n0: 16.15, n1: 17.45, s: '交于[一点]！', size: 112, y: TY + 70, ent: 'slam', hl: PAL.red });
add({ n0: 17.5, n1: 23.95, s: '[布列安桑]定理', size: 112, y: TY, ent: 'draw', hl: PAL.ice });
add({ n0: 18.2, n1: 23.95, s: '1806年 · 他还是个大学生', font: 'SM', size: 52, y: TY2 + 8, ent: 'pop', fill: PAL.ice });
add({ n0: 18.9, n1: 19.95, s: '比帕斯卡晚了167年', font: 'WK', size: 60, y: CY, ent: 'pop' });
add({ n0: 20.0, n1: 23.9, s: '随便拖 · 永远共点', font: 'WK', size: 62, y: CY, ent: 'pop' });
// bar 6 — twins
add({ n0: 24.0, n1: 27.95, s: '一对[镜像双胞胎]', size: 100, y: TY, ent: 'pop', hl: PAL.gold });
add({ n0: 24.6, n1: 27.95, s: '红线 ⇄ 红点 · 同步移动', font: 'SM', size: 52, y: TY2 + 8, ent: 'pop', fill: PAL.cream });
add({ n0: 25.6, n1: 27.9, s: '（行话：极线 ⇄ 极点）', font: 'WK', size: 54, y: CY, ent: 'pop', fill: PAL.cream });
// bar 7 — why? go 3-D
add({ n0: 28.0, n1: 29.95, s: '可是 · [凭什么]？', size: 108, y: TY, ent: 'pop', hl: PAL.red });
add({ n0: 30.0, n1: 31.95, s: '升到[三维]！', size: 128, y: TY, ent: 'slam', hl: PAL.gold });
add({ n0: 30.4, n1: 31.95, s: '平面里难证 · 到空间里一眼看穿', font: 'SM', size: 52, y: TY2 + 30, ent: 'pop', fill: PAL.cream });
// bar 8 — lift
add({ n0: 32.0, n1: 33.95, s: '六条边 · 一上一下翘起来', font: 'SM', size: 66, y: TY, ent: 'pop' });
add({ n0: 32.4, n1: 35.95, s: '相邻两边照样相交（切线长相等）', font: 'WK', size: 50, y: CY, ent: 'pop' });
add({ n0: 34.0, n1: 35.95, s: '全都躺在一张[双曲面]上', font: 'SM', size: 66, y: TY, ent: 'pop', hl: PAL.ice });
add({ n0: 34.5, n1: 35.95, s: '（广州塔“小蛮腰”的形状）', font: 'WK', size: 46, y: TY2 - 6, ent: 'pop', fill: PAL.ice });
// bar 9 — space diagonals & planes
add({ n0: 36.0, n1: 39.95, s: '三条[空间对角线]', size: 96, y: TY, ent: 'pop', hl: PAL.gold });
add({ n0: 37.5, n1: 39.95, s: '每两条 · 都在同一个平面里', font: 'WK', size: 58, y: CY, ent: 'pop' });
// bar 10 — logic
add({ n0: 40.0, n1: 43.95, s: '两两相交 · 又不共面', font: 'SM', size: 70, y: TY - 50, ent: 'pop' });
add({ n0: 41.85, n1: 43.95, s: '⇒ 只能交于[同一点]', size: 92, y: TY + 66, ent: 'slam', hl: PAL.red });
// bar 11 — set up the slam
add({ n0: 44.0, n1: 47.9, s: '从正上方打光 · 看[影子]', size: 96, y: TY, ent: 'pop', hl: PAL.gold });
add({ n0: 45.0, n1: 47.9, s: '空间里交于一点 → 影子也交于一点', font: 'WK', size: 50, y: CY, ent: 'pop' });
// bar 12 — HERO
add({ n0: 48.0, n1: 51.95, s: '[降维打击]！', size: 150, y: TY + 10, ent: 'slam', hl: PAL.red, big: 3.2 });
add({ n0: 49.6, n1: 51.95, s: '布列安桑定理 · 证毕 ■', font: 'SM', size: 58, y: TY2 + 46, ent: 'pop', fill: PAL.ice });
// bar 13 — dual back
add({ n0: 52.0, n1: 54.95, s: '再[对偶]回去', size: 104, y: TY, ent: 'pop', hl: PAL.gold });
add({ n0: 55.0, n1: 55.95, s: '[帕斯卡定理]也成立！', size: 100, y: TY, ent: 'slam', hl: PAL.red });
add({ n0: 55.35, n1: 55.95, s: '一个证明 · 白送一个定理', font: 'WK', size: 58, y: CY, ent: 'pop', fill: PAL.gold });
// bar 14 — the dictionary
add({ n0: 56.0, n1: 59.95, s: '对偶字典', size: 104, y: TY, ent: 'draw', hl: PAL.gold });
const DROW = [[56.5, '点', '线'], [57.5, '共线', '共点'], [58.5, '内接', '外切']];
// bar 15 — end card
add({ n0: 60.0, n1: 99, s: '帕斯卡 ⇄ 布列安桑', size: 96, y: TY, ent: 'draw', hl: PAL.gold });
add({ n0: 60.75, n1: 99, s: '点和线 · 互为[镜像]', font: 'SM', size: 70, y: 1300, ent: 'pop', hl: PAL.gold });
add({ n0: 61.5, n1: 99, s: '几何定理系列 · 01', font: 'SM', size: 44, y: 1410, ent: 'pop', fill: PAL.goldD });
add({ n0: 62.25, n1: 99, s: '你还见过哪些「对偶」？评论区聊', font: 'WK', size: 52, y: CY, ent: 'pop', fill: PAL.cream });

// a line leaves just before the next line that lands in the same place
let SLOTTED = false;
function slotTexts() {
  for (const o of T) {
    for (const q of T) {
      if (q === o || q.n0 <= o.n0 + 1e-6) continue;
      if (Math.abs((q.y ?? 0) - (o.y ?? 0)) < 0.55 * Math.max(q.size, o.size)) o.n1 = Math.min(o.n1, q.n0 - 0.2);
    }
  }
  SLOTTED = true;
}
function drawTexts(f, t, n) {
  if (!SLOTTED) slotTexts();
  for (let j = 0; j < T.length; j++) {
    const o = T[j];
    const exitD = 0.32;
    if (n < o.n0 - 0.001 || n > o.n1 + exitD) continue;
    const t0 = bt(o.n0), t1 = bt(o.n1);
    const font = o.font || 'SB';
    let size = o.size;
    const m = measure(o.s, font, size);
    if (m.w > 960) size *= 960 / m.w;
    let anim, draw;
    if (t >= t1) anim = dropOut(t, t1, 0.13, { dist: 22, st: 0.008 });
    else if (o.ent === 'slam') anim = slamIn(t, t0, 0.2, { big: o.big ?? 2.3 });
    else if (o.ent === 'draw') { draw = clamp((t - t0) / 0.75); anim = null; }
    else anim = popIn(t, t0, 0.035, 0.24, { rot: 0.14 });
    letters(f, o.s, { font, size, x: o.x ?? 540, y: o.y, fill: o.fill ?? PAL.cream, hl: o.hl ?? PAL.gold, anim, draw, D: Math.floor(t * FPS / 2), seed: j + 1, amp: font === 'WK' ? 0.9 : 0.45 });
  }
  // dictionary rows
  if (n >= 56.4 && n < 60.4) {
    DROW.forEach(([n0, a, b], r) => {
      if (n < n0) return;
      const y = 1290 + r * 112, t0 = bt(n0);
      const out = n >= 59.95 ? dropOut(t, bt(59.95), 0.22, { dist: 22 }) : null;
      const pa = out || popIn(t, t0, 0.04, 0.24), pb = out || popIn(t, t0 + 0.12, 0.04, 0.24), pc = out || popIn(t, t0 + 0.06, 0, 0.24);
      letters(f, a, { font: 'SB', size: 76, x: 430, y, align: 'right', fill: PAL.gold, anim: pa, seed: 40 + r });
      letters(f, '⇄', { font: 'SB', size: 70, x: 540, y, fill: PAL.cream, anim: pc, seed: 50 + r });
      letters(f, b, { font: 'SB', size: 76, x: 650, y, align: 'left', fill: PAL.ice, anim: pb, seed: 60 + r });
    });
  }
  // eccentricity read-out during the conic morph
  if (n > 8.3 && n < S.TL.h3 + 0.4) {
    const e = S.conicAt(n).e, a = ramp(8.3, 8.6, n) * (1 - ramp(S.TL.h3, S.TL.h3 + 0.3, n));
    letters(f, 'e = ' + e.toFixed(2), { font: 'SM', size: 44, x: 540, y: CY + 78, fill: PAL.goldD, alpha: a, amp: 0.3 });
  }
}

// ------------------------------------------------------------------ bloom + post
function bloomAt(n) { return 0.9 + 0.8 * pulse(n, 4, 0.04, 1) + 0.9 * pulse(n, 16, 0.04, 1.4) + 1.4 * pulse(n, 48, 0.03, 2) + 0.6 * pulse(n, 55, 0.04, 1) + 0.5 * pulse(n, 64, 0.04, 1.2); }
function composite(fg, n) {
  const src = fg.canvas;
  const b1 = IMG.b1.getContext('2d'), b2 = IMG.b2.getContext('2d');
  b1.setTransform(1, 0, 0, 1, 0, 0); b1.clearRect(0, 0, IMG.b1.width, IMG.b1.height);
  b1.filter = `blur(${Math.max(1, 5 * dpr)}px)`; b1.drawImage(src, 0, 0, IMG.b1.width, IMG.b1.height); b1.filter = 'none';
  b2.setTransform(1, 0, 0, 1, 0, 0); b2.clearRect(0, 0, IMG.b2.width, IMG.b2.height);
  b2.filter = `blur(${Math.max(1, 7 * dpr)}px)`; b2.drawImage(src, 0, 0, IMG.b2.width, IMG.b2.height); b2.filter = 'none';
  c.save(); c.setTransform(1, 0, 0, 1, 0, 0);
  const k = bloomAt(n);
  c.globalCompositeOperation = 'lighter';
  c.globalAlpha = Math.min(1, 0.42 * k); c.drawImage(IMG.b2, 0, 0, cv.width, cv.height);
  c.globalAlpha = Math.min(1, 0.36 * k); c.drawImage(IMG.b1, 0, 0, cv.width, cv.height);
  c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
  c.drawImage(src, 0, 0);
  c.restore();
}
function post(t, n) {
  c.save(); c.setTransform(dpr, 0, 0, dpr, 0, 0);
  // flashes
  const fl = 0.1 * pulse(n, 4, 0.02, 0.3) + 0.25 * pulse(n, 16, 0.02, 0.4) + 0.75 * pulse(n, 48, 0.015, 0.55) + 0.18 * pulse(n, 55, 0.02, 0.35) + 0.25 * pulse(n, 64, 0.02, 0.5);
  if (fl > 0.003) { c.globalCompositeOperation = 'lighter'; c.globalAlpha = Math.min(1, fl); c.fillStyle = '#FFF1D6'; c.fillRect(0, 0, W, H); }
  // grain (re-rolled every 2 frames)
  const g = Math.floor(t * FPS / 2);
  c.globalCompositeOperation = 'overlay'; c.globalAlpha = 0.07;
  const ox = -Math.floor(hs(g, 1) * 384), oy = -Math.floor(hs(g, 2) * 384);
  for (let y = oy; y < H; y += 384) for (let x = ox; x < W; x += 384) c.drawImage(IMG.grain, x, y);
  c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
  c.drawImage(IMG.vig, 0, 0, W, H);
  // fade in / out
  const fo = clamp((t - (DUR - 0.55)) / 0.5) + (t < 0.05 ? 1 - t / 0.05 : 0);
  if (fo > 0) { c.globalAlpha = clamp(fo); c.fillStyle = '#05080F'; c.fillRect(0, 0, W, H); }
  c.restore();
}

// ------------------------------------------------------------------ frame
export function render(t) {
  const st = S.state(t), n = st.n;
  BOIL.seed = Math.floor(t * FPS / 2); BOIL.amp = 1.05;
  const sh = shakeAt(t);
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
  drawBG(c, st, sh);
  const f = LY.get(0);
  f.save(); f.translate(sh[0], sh[1]);
  drawFigure(f, st, t, n);
  drawImpacts(f, st, t, n);
  drawHand(f, st, t, n);
  f.restore();
  drawTexts(f, t, n);
  composite(f, n);
  post(t, n);
}
