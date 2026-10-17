// 帕斯卡 ↔ 布列安桑 · 几何定理系列 01 — 59.6 s vertical film (v2), every frame computed from exact projective geometry.
// Look: 02-line-art (midnight #0B1320, champagne-gold line, glowing pen tip, draw-on, dolly-out) × 05-cel-boil
// (line boil re-rolled every 2 frames, grain, cel impact FX) × 08-morph (the shape itself tells the story).
// Story in beats n (1 beat = 0.737 s, bar = 4 beats):
//   0–20  Pascal, shown one step at a time: 6 points → hexagon → 3 pairs of opposite sides → extend → 3 crossings → 共线!
//  20–40  point → tangent line (one by one) → circumscribed hexagon; crossing → diagonal (one by one) → 共点! Brianchon
//  40–48  twins + duality dictionary · 可是凭什么？   48–68  3-D proof in 5 numbered steps   68  降维打击
//  72–76  dual back → Pascal for free                 76–80  end card
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
const HITS = [[12, 7, 0.10], [32, 6, 0.12], [68, 22, 0.16], [74.5, 7, 0.1]];
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

// ------------------------------------------------------------------ the figure
const S3 = (p) => [p[0], p[1], p[2] || 0];
// choreography (beats)
const SCH = {
  pt: (i) => 0.6 + 0.4 * i,            // the six points pop (with their numbers)
  side0: 4.2, side1: 5.6,              // hexagon drawn in one stroke 1→2→…→6→1
  pair: (k) => 6.2 + 0.6 * k,          // opposite-side pair k lights up in its colour
  ext: (k) => 8.4 + k,                 // pair k is extended (0.6 beat) → its crossing pops at 9 + k
  slice: 11.8, slam1: 12,              // red line slices through the three crossings
  tan: (i) => 20.6 + 0.5 * i,          // point i grows into its tangent line (0.45 beat)
  ret0: 24.2, ret1: 25.2,              // tangent overshoot retracts → circumscribed hexagon
  wpop: (i) => 24.5 + 0.3 * i,         // its six vertices pop one by one, numbered
  trace0: 26.3, trace1: 27.2,          // then its six sides are traced in one stroke
  fly: (k) => 28.3 + k,                // crossing k flies into diagonal k (S.flightK)
  shrink0: 31.4, slam2: 32,            // red line shrinks into the red point
};
function circlePts(st) {
  const C = st.C, P = st.P, out = [];
  for (let i = 0; i <= 200; i++) { const a = (i / 200) * Math.PI * 2 + 200 * S.D2R; out.push(P([C.x + C.r * Math.cos(a), C.y + C.r * Math.sin(a), 0])); }
  return out;
}
function drawFigure(f, st, t, n) {
  // ---------- overhead lamp: a soft light pool on the floor for the whole 3-D act
  const w3v = S.w3(n);
  if (w3v > 0.003) drawPool(f, st, w3v * (0.7 + 0.5 * ramp(64, 64.5, n)));
  // ---------- the lit 3-D act (floating / lifted figure, hyperboloid, shadows) has its own renderer
  if (st.h0 > 0.5 || st.lam > 1e-3) { drawLit3D(f, st, t, n, LY); return; }
  const cps = circlePts(st);
  const cA = 1 - 0.5 * ramp(24.3, 24.9, n) * (1 - ramp(27.4, 28.0, n));   // the circle steps back while the new hexagon is shown
  if (t < 0.6) spoly(f, cps, { w: 3.2, color: PAL.gold, to: E.io2(clamp((t - 0.06) / 0.5)), tip: true, tipR: 22, alpha: 1 });
  else spoly(f, cps, { w: 3.2, color: PAL.gold, closed: true, alpha: cA });
  if (n < 72.4) drawForward(f, st, t, n); else drawBack(f, st, t, n);
}

// beats 0–72.4: the Pascal figure is built step by step, then turned into its dual piece by piece
function drawForward(f, st, t, n) {
  const P = st.P, A = st.A, pas = st.pas, bri = st.bri, sc = st.cam.s;
  const Ps = (p) => P(S3(p));
  const X = pas.X, ok = X.every(Boolean), Wv = bri.W, Bp = bri.B, ice = PAL.ice;
  const pre = n < 40;                                                   // the construction (before the twins)
  const twinA = pre ? 0 : ramp(40, 41, n) * (1 - ramp(44, 45, n));       // inscribed twin over the dual figure
  const dimIns = n < 20.2 ? 1 : 1 - 0.72 * ramp(20.2, 21.2, n);         // the Pascal figure steps back while the dual grows
  const gone = (k) => 1 - ramp(SCH.fly(k), SCH.fly(k) + 0.6, n);         // pair k leaves together with its crossing
  const As = A.map(Ps);
  // ---- circumscribed hexagon: a brief glass fill when it closes
  const fillA = 0.13 * pulse(n, 27.0, 0.3, 1.5);
  if (fillA > 0.003) sfill(f, Wv.map(Ps), ice, fillA);
  // ---- inscribed hexagon: one-stroke draw-on, then the three pairs of opposite sides light up
  for (let i = 0; i < 6; i++) {
    const k = i % 3;
    let a, w = 3.2, fr = 1, col, halo;
    if (pre) {
      a = dimIns * gone(k);
      fr = clamp(((n - SCH.side0) / (SCH.side1 - SCH.side0)) * 6 - i);
      col = mixHex(PAL.gold, PAIR[k], 0.85 * clamp((n - SCH.pair(k)) / 0.25));
      const pp = pulse(n, SCH.pair(k), 0.08, 0.9);
      w += 3.4 * pp; if (pp > 0.01) halo = 2 + 2.5 * pp;
    } else { a = 0.7 * twinA; w = 2.4; col = mixHex(PAL.gold, PAIR[k], 0.85); }
    if (a <= 0.003 || fr <= 0) continue;
    sline(f, As[i], As[(i + 1) % 6], { w, color: col, to: fr, tip: fr < 1, tipR: 20, alpha: a, halo });
  }
  // ---- extensions of each pair to its crossing
  if (ok) for (let k = 0; k < 3; k++) {
    const dr = E.out2(clamp((n - SCH.ext(k)) / 0.6));
    const a = pre ? 0.9 * dimIns * gone(k) : 0.3 * twinA;
    if (dr <= 0 || a <= 0.003) continue;
    for (const side of [k, k + 3]) {
      const p = A[side], q = A[(side + 1) % 6], Xk = X[k];
      const near = G.dist(p, Xk) < G.dist(q, Xk) ? p : q;
      const over = G.add(Xk, G.mul(G.nrm(G.sub(Xk, near)), 46 / sc));
      sline(f, Ps(near), Ps(over), { w: 2.2, color: PAIR[k], to: dr, tip: dr < 1, alpha: a });
    }
  }
  // ---- point → tangent line (grows out of the point, overshoots, then trims to the circumscribed hexagon)
  const ov = 0.45 * (1 - ramp(SCH.ret0, SCH.ret1, n));
  for (let i = 0; i < 6; i++) {
    const g = E.out2(clamp((n - SCH.tan(i)) / 0.45));
    if (g <= 0) continue;
    const a0 = A[i], e0 = G.add(a0, G.mul(G.sub(Wv[(i + 5) % 6], a0), g * (1 + ov))), e1 = G.add(a0, G.mul(G.sub(Wv[i], a0), g * (1 + ov)));
    const q0 = Ps(e0), q1 = Ps(e1);
    sline(f, q0, q1, { w: 3.2, color: ice, alpha: 1 });
    if (g < 1) { tip(f, q0, 18, ice, 1); tip(f, q1, 18, ice, 1); }
  }
  // ---- one-stroke tracer around the circumscribed hexagon: six sides, six corners
  if (pre && n > SCH.trace0 && n < SCH.trace1 + 0.8) {
    const pr = ((n - SCH.trace0) / (SCH.trace1 - SCH.trace0)) * 6, fa = 1 - ramp(SCH.trace1 + 0.1, SCH.trace1 + 0.7, n);
    for (let e = 0; e < 6; e++) {
      const fr = clamp(pr - e);
      if (fr <= 0) continue;
      sline(f, Ps(Wv[e]), Ps(Wv[(e + 1) % 6]), { w: 6, color: '#E6FBFF', to: fr, tip: fr < 1, tipR: 26, halo: 3, alpha: 0.85 * fa });
    }
  }
  // ---- diagonals: each grows out of its flying crossing
  for (let k = 0; k < 3; k++) {
    const ev = pre ? S.flightK(n, k) : 1;
    if (ev <= 0) continue;
    const W0 = Wv[k], W1 = Wv[k + 3], M = G.lerp2(W0, W1, 0.5);
    if (ev < 1) {
      const cen = G.lerp2(X[k] || M, M, ev), d = G.nrm(G.sub(W1, W0)), hl = ev * (G.dist(W0, W1) / 2 + 24 / sc);
      sline(f, Ps(G.sub(cen, G.mul(d, hl))), Ps(G.add(cen, G.mul(d, hl))), { w: 3, color: PAIR[k], alpha: 1 });
    } else {
      const [a, b] = G.extend(W0, W1, 24 / sc, 24 / sc);
      const hi = pulse(n, 32, 0.05, 1.5) + pulse(n, 68, 0.04, 1.8);
      sline(f, Ps(a), Ps(b), { w: 3 + 2 * hi, color: PAIR[k], halo: 2 + 2 * hi, alpha: 1 });
    }
  }
  // ---- the red Pascal line (slices in at 11.8–12; shrinks into the red point at 31.4–32; twin overlay later)
  if (ok && n >= SCH.slice && (n < SCH.slam2 || twinA > 0.003)) {
    const span = G.spanOf(X, 80 / sc);
    let a = span[0], b = span[1], aL = twinA;
    if (pre) {
      const sh = E.io2(inv(SCH.shrink0, SCH.slam2, n));
      a = G.lerp2(a, Bp, sh); b = G.lerp2(b, Bp, sh);
      aL = 1 - 0.4 * ramp(20.2, 21.2, n) * (1 - ramp(31.0, 31.4, n));
    }
    if (n < SCH.slam1) sline(f, Ps(a), Ps(b), { w: 4.4, color: PAL.red, to: E.in2(clamp((n - SCH.slice) / 0.2)), tip: true, tipR: 30, halo: 4, alpha: 1 });
    else {
      const fl = pulse(n, SCH.slam1, 0.05, 1.2);
      sline(f, Ps(a), Ps(b), { w: 4.4 + 3 * fl, color: mixHex(PAL.red, '#FFD0D8', fl * 0.6), halo: 4.5, alpha: aL });
    }
  }
  // ---- points on the circle: gold vertices of the inscribed hexagon → small tangent points
  for (let i = 0; i < 6; i++) {
    const pu = clamp((n - SCH.pt(i)) / 0.32);
    if (pu <= 0) continue;
    const tg = clamp((n - SCH.tan(i)) / 0.35);
    const ga = pre ? 1 - tg : twinA;
    if (ga > 0.003) sdot(f, As[i], { r: 8.5, s: E.outBack(pu, 2.4), color: PAL.gold, alpha: ga });
    if (tg > 0) sdot(f, As[i], { r: 4.6, color: ice, core: '#0B1320', alpha: 0.75 * tg * (1 - 0.6 * twinA) });
  }
  // ---- circumscribed hexagon vertices
  for (let i = 0; i < 6; i++) {
    const wp = clamp((n - SCH.wpop(i)) / 0.3);
    if (wp <= 0) continue;
    // the tracer passes corner i+1 at trace0 + (i+1)/6 of the stroke: a small bump
    const tb = pre ? pulse(n, SCH.trace0 + ((i + 1) % 6 || 6) / 6 * (SCH.trace1 - SCH.trace0), 0.06, 0.5) : 0;
    sdot(f, Ps(Wv[i]), { r: 9, s: E.outBack(wp, 2.4) * (1 + 0.35 * tb), color: ice, core: '#FFFFFF', halo: 2 + 2 * tb, alpha: 1 });
  }
  // ---- the three crossings (pop at 9, 10, 11; fly into the diagonals at 28.3 + k)
  if (ok) for (let k = 0; k < 3; k++) {
    const pu = clamp((n - (9 + k)) / 0.3);
    if (pu <= 0) continue;
    let p = X[k], s = E.outBack(pu, 2.6), a = 1;
    if (pre) {
      const ev = S.flightK(n, k);
      if (ev >= 1) continue;
      p = G.lerp2(X[k], G.lerp2(Wv[k], Wv[k + 3], 0.5), ev); s *= 1 - ev;
    } else a = twinA;
    if (a > 0.003) sdot(f, Ps(p), { r: 10.5, s, color: PAIR[k], core: '#FFFFFF', halo: 3.2, alpha: a });
  }
  // ---- the Brianchon point (born from the shrinking red line at 32)
  const bs = clamp((n - 31.9) / 0.25);
  if (bs > 0) {
    const hi = pulse(n, 32, 0.05, 1.6) + pulse(n, 68, 0.04, 2);
    sdot(f, Ps(Bp), { r: 11.5, s: E.outBack(bs, 2.4) * (1 + 0.25 * hi), color: PAL.red, core: '#FFFFFF', halo: 3.5 + 4 * hi, alpha: 1 });
  }
  // ---- point numbers 1–6 (so "in order" and "opposite" are unambiguous)
  const la = 1 - ramp(16.5, 17.5, n);
  if (la > 0.003) {
    const O = Ps([st.C.x, st.C.y]);
    for (let i = 0; i < 6; i++) {
      const t0 = bt(SCH.pt(i) + 0.08);
      if (t < t0) continue;
      const q = As[i], d = G.nrm(G.sub(q, O)), p = [q[0] + d[0] * 40, q[1] + d[1] * 40];
      letters(f, String(i + 1), { font: 'SM', size: 46, x: p[0], y: p[1], fill: PAL.cream, alpha: la, anim: popIn(t, t0, 0, 0.24, { rot: 0.1 }), D: Math.floor(t * FPS / 2), seed: 70 + i, amp: 0.4, knock: 7 });
    }
  }
  // ---- corner numbers 1–6 of the circumscribed hexagon (so "opposite corners" 1–4, 2–5, 3–6 are unambiguous)
  const lw = pre ? 1 - ramp(31.1, 31.6, n) : 0;
  if (lw > 0.003 && n > SCH.wpop(0)) {
    const O = Ps([st.C.x, st.C.y]);
    for (let i = 0; i < 6; i++) {
      const t0 = bt(SCH.wpop(i) + 0.06);
      if (t < t0) continue;
      const q = Ps(Wv[i]), d = G.nrm(G.sub(q, O)), p = [q[0] + d[0] * 40, q[1] + d[1] * 40];
      letters(f, String(i + 1), { font: 'SM', size: 44, x: p[0], y: p[1], fill: '#DDF6FF', alpha: lw, anim: popIn(t, t0, 0, 0.24, { rot: 0.1 }), D: Math.floor(t * FPS / 2), seed: 90 + i, amp: 0.4, knock: 7 });
    }
  }
}

// beats 72.4–80: dual back (12-gon morph u, diagonals → crossings v), then the twin end card
function drawBack(f, st, t, n) {
  const P = st.P, A = st.A, pas = st.pas, bri = st.bri, sc = st.cam.s, u = st.u, v = st.v;
  const Ps = (p) => P(S3(p));
  const X = pas.X, ok = X.every(Boolean), Wv = bri.W, Bp = bri.B, ice = PAL.ice;
  const morphing = u > 1e-4 && u < 1 - 1e-4, inV = v > 1e-4 && v < 1 - 1e-4;
  const late = ramp(76, 77, n);                                         // end card: the dual twin comes back as an overlay
  const As = A.map(Ps);
  if (u <= 1e-4) {
    if (late > 0.003) {
      for (let i = 0; i < 6; i++) wline(f, P, S3(Wv[(i + 5) % 6]), S3(Wv[i]), { w: 3.2, color: ice, alpha: 0.75 * late });
      for (let i = 0; i < 6; i++) sdot(f, Ps(Wv[i]), { r: 7.5, color: ice, alpha: 0.7 * late });
    }
    for (let i = 0; i < 6; i++) sline(f, As[i], As[(i + 1) % 6], { w: 3.2, color: mixHex(PAL.gold, PAIR[i % 3], 0.85), alpha: 1 });
    const aExt = 0.55 * ramp(74.0, 74.5, n);
    if (ok && aExt > 0.003) for (let k = 0; k < 3; k++) for (const side of [k, k + 3]) {
      const p = A[side], q = A[(side + 1) % 6], near = G.dist(p, X[k]) < G.dist(q, X[k]) ? p : q;
      sline(f, Ps(near), Ps(G.add(X[k], G.mul(G.nrm(G.sub(X[k], near)), 46 / sc))), { w: 2.2, color: PAIR[k], alpha: aExt * 0.9 });
    }
    for (let i = 0; i < 6; i++) sdot(f, As[i], { r: 8.5, color: PAL.gold, alpha: 1 });
  } else if (morphing) {
    for (let i = 0; i < 6; i++) {
      const a = A[i], wm = Wv[(i + 5) % 6], wp = Wv[i];
      const Tm = G.lerp2(a, wm, u), Tp = G.lerp2(a, wp, u), Tn = G.lerp2(A[(i + 1) % 6], wp, u);
      sline(f, Ps(Tm), Ps(Tp), { w: 3.2, color: ice, alpha: 1 });                                    // tangent segment → vertex
      sline(f, Ps(Tp), Ps(Tn), { w: 3.2, color: mixHex(PAL.gold, ice, u), alpha: 1 - 0.6 * u * u });  // pole → side
      sdot(f, Ps(a), { r: 7.5 - 2.5 * u, color: mixHex(PAL.gold, ice, u), alpha: 1 });
    }
  } else {
    for (let i = 0; i < 6; i++) wline(f, P, S3(Wv[(i + 5) % 6]), S3(Wv[i]), { w: 3.2, color: ice, alpha: 1 });
    for (let i = 0; i < 6; i++) sdot(f, As[i], { r: 5.5, color: ice, core: '#0B1320', alpha: 0.9 });
    for (let i = 0; i < 6; i++) sdot(f, Ps(Wv[i]), { r: 7.5, color: ice, alpha: 1 });
  }
  // diagonals (shrinking back into the crossings) / recap overlay
  const dA = v >= 1 - 1e-4 ? 1 : inV ? 1 : 0.7 * late;
  if (dA > 0.003) for (let k = 0; k < 3; k++) {
    const W0 = Wv[k], W1 = Wv[k + 3];
    if (inV) {
      const ev = E.io2(v), M = G.lerp2(W0, W1, 0.5), cen = G.lerp2(X[k] || M, M, ev);
      const d = G.nrm(G.sub(W1, W0)), hl = ev * (G.dist(W0, W1) / 2 + 24 / sc);
      sline(f, Ps(G.sub(cen, G.mul(d, hl))), Ps(G.add(cen, G.mul(d, hl))), { w: 3, color: PAIR[k], alpha: 1 });
    } else {
      const [a, b] = G.extend(W0, W1, 24 / sc, 24 / sc);
      sline(f, Ps(a), Ps(b), { w: 3, color: PAIR[k], halo: 2, alpha: dA });
    }
  }
  // red line growing back out of the red point, and the crossings
  if (ok && v < 1 - 1e-4) {
    const span = G.spanOf(X, 80 / sc);
    let a = span[0], b = span[1];
    if (inV) { const ev = E.io2(v); a = G.lerp2(a, Bp, ev); b = G.lerp2(b, Bp, ev); }
    const fl = pulse(n, 74.5, 0.05, 1.0);
    sline(f, Ps(a), Ps(b), { w: 4.4 + 3 * fl, color: mixHex(PAL.red, '#FFD0D8', fl * 0.6), halo: 4.5, alpha: 1 });
    for (let k = 0; k < 3; k++) {
      let p = X[k], s = 1;
      if (inV) { const ev = E.io2(v); p = G.lerp2(X[k], G.lerp2(Wv[k], Wv[k + 3], 0.5), ev); s = 1 - v; }
      sdot(f, Ps(p), { r: 10.5, s, color: PAIR[k], core: '#FFFFFF', halo: 3.2, alpha: 1 });
    }
  }
  // the red point
  const bA = v >= 1 - 1e-4 ? 1 : inV ? clamp((v - 0.82) / 0.18) : late;
  if (bA > 0.003) sdot(f, Ps(Bp), { r: 11.5, s: inV ? E.outBack(bA, 2.4) : 1, color: PAL.red, core: '#FFFFFF', halo: 3.5, alpha: inV ? 1 : bA });
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
  const X = pas.X, ok = X.every(Boolean);
  // the crossings pop (9, 10, 11)
  if (ok && n > 8.9 && n < 11.8) for (let k = 0; k < 3; k++) ringWave(f, Ps(X[k]), at(9 + k, 0.45), { R: 76, w: 3.5, color: PAIR[k] });
  // slam 1: the red line lands
  if (ok && n > 11.9 && n < 14) for (let k = 0; k < 3; k++) { const q = Ps(X[k]); ringWave(f, q, at(12, 0.55), { R: 120, w: 4, color: PAIR[k] }); rays(f, q, at(12, 0.4), { n: 10, R0: 22, R1: 120, w: 5, seed: k + 1, color: PAL.cream }); }
  // point → tangent line
  if (n > 20.5 && n < 24) for (let i = 0; i < 6; i++) ringWave(f, Ps(st.A[i]), at(SCH.tan(i), 0.45), { R: 56, w: 3, color: PAL.ice });
  // the six corners of the circumscribed hexagon pop one by one
  if (n > 24.4 && n < 26.6) for (let i = 0; i < 6; i++) ringWave(f, Ps(bri.W[i]), at(SCH.wpop(i), 0.45), { R: 54, w: 3, color: PAL.ice });
  // crossing k → diagonal k: its two opposite vertices light up
  if (n > 28.2 && n < 31.6) for (let k = 0; k < 3; k++) for (const j of [k, k + 3]) ringWave(f, Ps(bri.W[j]), at(SCH.fly(k), 0.6), { R: 64, w: 3.5, color: PAIR[k] });
  // slam 2: the Brianchon point
  if (n > 31.9 && n < 34) {
    const q = Ps(bri.B);
    ringWave(f, q, at(32, 0.6), { R: 170, w: 5, color: PAL.red }); ringWave(f, q, at(32.25, 0.6), { R: 240, w: 3, color: PAL.cream });
    rays(f, q, at(32, 0.42), { n: 16, R0: 26, R1: 190, w: 6, seed: 7, color: PAL.cream });
    sparks(f, q, at(32, 0.7), { n: 16, R: 230, seed: 4, colors: [PAL.cream, PAL.red, PAL.gold] });
  }
  // 3-D step 1: adjacent tilted sides still meet at every vertex
  if (st.lam > 0.05 && n > 52 && n < 54.5) for (let i = 0; i < 6; i++) ringWave(f, P(st.lift.V[i]), at(52.2 + 0.25 * i, 0.55), { R: 58, w: 3.5, color: PAL.cream });
  // 3-D step 4: the single meeting point
  if (st.lam > 0.05 && n > 61.9 && n < 64) { const q = P(st.lift.Q); ringWave(f, q, at(62, 0.6), { R: 130, w: 4, color: PAL.red }); sparkle(f, q, 46 * (1 - clamp(at(62, 0.5))), at(62, 1) * 3, PAL.cream, 1 - clamp(at(62, 0.5))); }
  // HERO slam
  if (n > 67.95 && n < 71) {
    const q = Ps(bri.B);
    ringWave(f, q, at(68, 0.5), { R: 260, w: 9, color: PAL.cream });
    ringWave(f, q, at(68.12, 0.7), { R: 420, w: 6, color: PAL.red });
    ringWave(f, q, at(68.3, 0.9), { R: 620, w: 4, color: PAL.ice });
    rays(f, q, at(68, 0.5), { n: 26, R0: 40, R1: 520, w: 10, seed: 11, color: PAL.cream });
    sparks(f, q, at(68, 0.9), { n: 28, R: 460, seed: 9, w: 4, colors: [PAL.cream, PAL.red, PAL.gold, PAL.ice] });
  }
  // Pascal again
  if (ok && n > 74.4 && n < 76.5) for (let k = 0; k < 3; k++) ringWave(f, Ps(X[k]), at(74.5, 0.55), { R: 110, w: 4, color: PAIR[k] });
}

// ------------------------------------------------------------------ texts
const TY = 250, TY2 = 368, CY = 1610;
const T = [];   // {n0, n1, s, font, size, y, x, fill, hl, ent}
const add = (o) => T.push(o);
// ① Pascal, one step at a time
add({ n0: -0.6, n1: 4.0, s: '圆上随便取[6]个点', size: 100, y: TY, ent: 'pop' });
add({ n0: 4.0, n1: 6.0, s: '按顺序连成[六边形]', size: 100, y: TY, ent: 'pop' });
add({ n0: 6.0, n1: 8.0, s: '六边形有[3组对边]', size: 100, y: TY, ent: 'pop' });
add({ n0: 6.35, n1: 9.05, s: '面对面的两条边 · 同色为一组', font: 'WK', size: 56, y: CY, ent: 'pop' });
add({ n0: 8.0, n1: 11.2, s: '把每组对边[延长]', size: 100, y: TY, ent: 'pop' });
add({ n0: 9.1, n1: 11.95, s: '每组都交出1个点', font: 'WK', size: 58, y: CY, ent: 'pop' });
add({ n0: 11.2, n1: 12.0, s: '这3个交点……', size: 100, y: TY, ent: 'pop' });
add({ n0: 12.0, n1: 16.0, s: '竟然在[一条直线]上！', size: 108, y: TY, ent: 'slam', hl: PAL.red });
add({ n0: 13.0, n1: 16.0, s: '随便拖 · 永远共线', font: 'WK', size: 62, y: CY, ent: 'pop' });
add({ n0: 16.0, n1: 20.0, s: '[帕斯卡]定理', size: 112, y: TY, ent: 'draw', hl: PAL.gold });
add({ n0: 16.6, n1: 20.0, s: '1639年 · 帕斯卡才16岁', font: 'SM', size: 52, y: TY2 + 8, ent: 'pop', fill: PAL.gold });
add({ n0: 17.2, n1: 20.0, s: '圆内接六边形 · 三组对边的交点共线', font: 'WK', size: 54, y: CY, ent: 'pop' });
// ② the dual, one piece at a time
add({ n0: 20.0, n1: 24.0, s: '把[点]换成[线]', size: 104, y: TY, ent: 'pop', hl: PAL.ice });
add({ n0: 20.4, n1: 24.0, s: '圆上每个点 → 过这点的切线', font: 'WK', size: 58, y: CY, ent: 'pop' });
add({ n0: 24.0, n1: 28.0, s: '6条切线 · 围成新的六边形', size: 92, y: TY, ent: 'pop' });
add({ n0: 25.0, n1: 28.0, s: '它把圆包在里面 · 叫「外切六边形」', font: 'WK', size: 54, y: CY, ent: 'pop' });
add({ n0: 28.0, n1: 31.2, s: '把[交点]换成[连线]', size: 104, y: TY, ent: 'pop', hl: PAL.ice });
add({ n0: 28.3, n1: 31.95, s: '交点 → 连接两个相对顶点的「对角线」', font: 'WK', size: 52, y: CY, ent: 'pop' });
add({ n0: 31.2, n1: 32.0, s: '这3条对角线……', size: 100, y: TY, ent: 'pop' });
add({ n0: 32.0, n1: 36.0, s: '竟然[交于一点]！', size: 108, y: TY, ent: 'slam', hl: PAL.red });
add({ n0: 32.3, n1: 36.0, s: '红线 → 红点 · 共线 → 共点', font: 'SM', size: 52, y: TY2 + 8, ent: 'pop', fill: PAL.cream });
add({ n0: 32.9, n1: 36.0, s: '随便拖 · 永远共点', font: 'WK', size: 62, y: CY, ent: 'pop' });
add({ n0: 36.0, n1: 40.0, s: '[布列安桑]定理', size: 112, y: TY, ent: 'draw', hl: PAL.ice });
add({ n0: 36.6, n1: 40.0, s: '1806年 · 他还是个大学生', font: 'SM', size: 52, y: TY2 + 8, ent: 'pop', fill: PAL.ice });
add({ n0: 37.2, n1: 40.0, s: '圆外切六边形 · 三条对角线共点', font: 'WK', size: 54, y: CY, ent: 'pop' });
// ③ twins, duality, why?
add({ n0: 40.0, n1: 44.0, s: '一对[镜像双胞胎]', size: 100, y: TY, ent: 'pop', hl: PAL.gold });
add({ n0: 40.4, n1: 44.0, s: '数学家叫它「对偶」', font: 'SM', size: 54, y: TY2 + 8, ent: 'pop', fill: PAL.cream });
const DROW = [[40.8, '点', '线'], [41.6, '交点', '连线'], [42.4, '共线', '共点']];
add({ n0: 44.0, n1: 48.0, s: '可是 · [凭什么]？', size: 108, y: TY, ent: 'pop', hl: PAL.red });
add({ n0: 44.6, n1: 48.0, s: '3条对角线 · 凭什么一定交于一点？', font: 'SM', size: 50, y: TY2 + 12, ent: 'pop', fill: PAL.cream });
// ④ the 3-D proof, five numbered steps
add({ n0: 48.0, n1: 50.0, s: '升到[三维]！', size: 128, y: TY, ent: 'slam', hl: PAL.gold });
add({ n0: 48.4, n1: 50.0, s: '平面里难证 · 到空间里一眼看穿', font: 'SM', size: 52, y: TY2 + 30, ent: 'pop', fill: PAL.cream });
add({ n0: 50.0, n1: 52.0, s: '6条边 · 一上一下翘起来', font: 'SM', size: 68, y: TY, ent: 'pop' });
add({ n0: 52.0, n1: 54.0, s: '相邻两边 · 照样相交', font: 'SM', size: 68, y: TY, ent: 'pop' });
add({ n0: 52.3, n1: 54.0, s: '同一顶点的两段切线一样长 → 翘起来一样高', font: 'WK', size: 48, y: CY, ent: 'pop' });
add({ n0: 54.0, n1: 56.0, s: '全都躺在一张「小蛮腰」曲面上', font: 'SM', size: 64, y: TY, ent: 'pop' });
add({ n0: 54.4, n1: 56.0, s: '广州塔就是这个形状 · 叫单叶双曲面', font: 'WK', size: 46, y: TY2 - 6, ent: 'pop', fill: PAL.ice });
add({ n0: 56.0, n1: 58.0, s: '连出3条[空间对角线]', size: 92, y: TY, ent: 'pop', hl: PAL.gold });
add({ n0: 58.0, n1: 60.0, s: '每两条 · 都在同一个平面里', font: 'SM', size: 64, y: TY, ent: 'pop' });
add({ n0: 58.3, n1: 60.0, s: '同一平面里的两条线（不平行）→ 一定相交', font: 'WK', size: 48, y: CY, ent: 'pop' });
add({ n0: 60.0, n1: 64.0, s: '两两相交 · 又不共面', font: 'SM', size: 70, y: TY - 38, ent: 'pop' });
add({ n0: 62.0, n1: 64.0, s: '⇒ 只能交于[同一点]！', size: 92, y: TY + 84, ent: 'slam', hl: PAL.red });
add({ n0: 62.4, n1: 64.0, s: '（否则3个交点围成三角形 · 3条线就共面了）', font: 'WK', size: 44, y: CY, ent: 'pop' });
add({ n0: 64.0, n1: 68.0, s: '从正上方打光 · 看[影子]', size: 96, y: TY, ent: 'pop', hl: PAL.gold });
add({ n0: 65.5, n1: 68.0, s: '空间里交于一点 → 影子也交于一点', font: 'WK', size: 50, y: CY, ent: 'pop' });
// ⑤ the slam, dual back, end card
add({ n0: 68.0, n1: 72.0, s: '[降维打击]！', size: 150, y: TY + 10, ent: 'slam', hl: PAL.red, big: 3.2 });
add({ n0: 69.6, n1: 72.0, s: '布列安桑定理 · 证毕 ■', font: 'SM', size: 58, y: TY2 + 46, ent: 'pop', fill: PAL.ice });
add({ n0: 72.0, n1: 74.5, s: '再[对偶]回去', size: 104, y: TY, ent: 'pop', hl: PAL.gold });
add({ n0: 72.5, n1: 74.6, s: '线 → 点 · 共点 → 共线', font: 'WK', size: 58, y: CY, ent: 'pop' });
add({ n0: 74.5, n1: 76.5, s: '[帕斯卡定理]也成立！', size: 100, y: TY, ent: 'slam', hl: PAL.red });
add({ n0: 74.85, n1: 78.3, s: '一个证明 · 白送一个定理', font: 'WK', size: 58, y: CY, ent: 'pop', fill: PAL.gold });
add({ n0: 76.5, n1: 99, s: '帕斯卡 ⇄ 布列安桑', size: 96, y: TY, ent: 'draw', hl: PAL.gold });
add({ n0: 77.1, n1: 99, s: '点和线 · 互为[镜像]', font: 'SM', size: 70, y: 1300, ent: 'pop', hl: PAL.gold });
add({ n0: 77.7, n1: 99, s: '几何定理系列 · 01', font: 'SM', size: 44, y: 1410, ent: 'pop', fill: PAL.goldD });
add({ n0: 78.3, n1: 99, s: '你还见过哪些「对偶」？评论区聊', font: 'WK', size: 52, y: CY, ent: 'pop', fill: PAL.cream });

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
// 3-D proof progress: ①②③④⑤ at the top
const STEPS = [50, 54, 56, 60, 64];
function drawSteps(f, t, n) {
  const a = ramp(49.6, 50.2, n) * (1 - ramp(67.6, 68.0, n));
  if (a <= 0.003) return;
  let cur = -1; STEPS.forEach((n0, i) => { if (n >= n0) cur = i; });
  const y = 128, dx = 96;
  f.save(); f.globalAlpha *= a;
  f.lineWidth = 3; f.strokeStyle = rgba(PAL.goldD, 0.45); f.beginPath(); f.moveTo(540 - 2 * dx + 30, y); f.lineTo(540 + 2 * dx - 30, y); f.stroke();
  for (let i = 0; i < 5; i++) {
    const x = 540 + (i - 2) * dx, on = i === cur, done = i < cur;
    const pop = on ? E.outBack(clamp((n - STEPS[i]) / 0.3), 2.6) : 1;
    const r = on ? 22 + 8 * pop : 20;
    if (on) { const g = f.createRadialGradient(x, y, 0, x, y, r * 2.4); g.addColorStop(0, rgba(PAL.gold, 0.45)); g.addColorStop(1, rgba(PAL.gold, 0)); f.fillStyle = g; f.beginPath(); f.arc(x, y, r * 2.4, 0, Math.PI * 2); f.fill(); }
    f.beginPath(); f.arc(x, y, r + 4, 0, Math.PI * 2); f.fillStyle = 'rgba(11,19,32,0.92)'; f.fill();
    f.beginPath(); f.arc(x, y, r, 0, Math.PI * 2);
    if (on || done) { f.fillStyle = on ? PAL.gold : rgba(PAL.goldD, 0.75); f.fill(); }
    f.lineWidth = 3; f.strokeStyle = on ? PAL.cream : rgba(PAL.goldD, 0.9); f.stroke();
    letters(f, String(i + 1), { font: 'SM', size: on ? 30 + 8 * pop : 28, x, y: y + 1, fill: on || done ? '#0B1320' : PAL.goldD, knock: 0, amp: 0.25, D: Math.floor(t * FPS / 2), seed: 90 + i });
  }
  f.restore();
}
function drawTexts(f, t, n) {
  if (!SLOTTED) slotTexts();
  drawSteps(f, t, n);
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
  // duality dictionary (twins bar)
  if (n >= 40.7 && n < 44.4) {
    DROW.forEach(([n0, a, b], r) => {
      if (n < n0) return;
      const y = 1290 + r * 112, t0 = bt(n0);
      const out = n >= 43.95 ? dropOut(t, bt(43.95), 0.22, { dist: 22 }) : null;
      const pa = out || popIn(t, t0, 0.04, 0.24), pb = out || popIn(t, t0 + 0.12, 0.04, 0.24), pc = out || popIn(t, t0 + 0.06, 0, 0.24);
      letters(f, a, { font: 'SB', size: 76, x: 450, y, align: 'right', fill: PAL.gold, anim: pa, seed: 40 + r });
      letters(f, '⇄', { font: 'SB', size: 70, x: 540, y, fill: PAL.cream, anim: pc, seed: 50 + r });
      letters(f, b, { font: 'SB', size: 76, x: 630, y, align: 'left', fill: PAL.ice, anim: pb, seed: 60 + r });
    });
  }
}

// ------------------------------------------------------------------ bloom + post
function bloomAt(n) { return 0.9 + 0.8 * pulse(n, 12, 0.04, 1) + 0.9 * pulse(n, 32, 0.04, 1.4) + 1.4 * pulse(n, 68, 0.03, 2) + 0.6 * pulse(n, 74.5, 0.04, 1); }
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
  const fl = 0.1 * pulse(n, 12, 0.02, 0.3) + 0.25 * pulse(n, 32, 0.02, 0.4) + 0.75 * pulse(n, 68, 0.015, 0.55) + 0.18 * pulse(n, 74.5, 0.02, 0.35);
  if (fl > 0.003) { c.globalCompositeOperation = 'lighter'; c.globalAlpha = Math.min(1, fl); c.fillStyle = '#FFF1D6'; c.fillRect(0, 0, W, H); }
  // grain (re-rolled every 2 frames)
  const g = Math.floor(t * FPS / 2);
  c.globalCompositeOperation = 'overlay'; c.globalAlpha = 0.07;
  const ox = -Math.floor(hs(g, 1) * 384), oy = -Math.floor(hs(g, 2) * 384);
  for (let y = oy; y < H; y += 384) for (let x = ox; x < W; x += 384) c.drawImage(IMG.grain, x, y);
  c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
  c.drawImage(IMG.vig, 0, 0, W, H);
  // fade in / out
  const fo = clamp((t - (DUR - 0.6)) / 0.55) + (t < 0.05 ? 1 - t / 0.05 : 0);
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
