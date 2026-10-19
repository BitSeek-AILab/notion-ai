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
import { BOIL, bp, rgba, mixHex, tip, sline, wline, spoly, sdot, sfill, ringWave, rays, sparkle, sparks, check, bD } from './draw.js';
import { loadGlyphs, letters, measure, popIn, slamIn, dropOut } from './text.js';
import { drawPool } from './lit3d.js';
import { drawSpace } from './space.js';
import { drawFlat, demoAt } from './duality.js';
import { CUE, CAPS, RNAT } from './cues.js';

export const W = S.W, H = S.H, FPS = S.FPS, DUR = S.DUR;
const bt = S.bt;
let cv, c, dpr = 1, LY;
const IMG = {};
const ramp = (a, b, n, e = 'io2') => E[e](inv(a, b, n));
const pulse = (n, n0, up, down) => (n < n0 ? 0 : n < n0 + up ? E.out2((n - n0) / up) : 1 - E.io2(clamp((n - n0 - up) / down)));
// v5 编舞 (js/cues.js): every choreographed element starts at the real time of its note in Levy's performance and then
// plays at its natural speed, whatever the rubato does. CU(c) = natural story beats since real cue time c (< 0 before);
// CT(n0, c) = story-seconds clock of an element designed at beat n0 that lands at real time c.
const CU = (c) => (RT - c) / RNAT;
const CT = (n0, c) => bt(n0) + (RT - c) / 1.4;
function monoSpline(xs, ys) {   // Fritsch–Carlson monotone cubic through (xs, ys), clamped outside
  const n = xs.length, d = [], m = [];
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
  m[0] = d[0]; m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) {
    const h0 = xs[i] - xs[i - 1], h1 = xs[i + 1] - xs[i];
    m[i] = d[i - 1] * d[i] <= 0 ? 0 : (3 * (h0 + h1)) / ((2 * h1 + h0) / d[i - 1] + (h1 + 2 * h0) / d[i]);
  }
  return (x) => {
    if (x <= xs[0]) return ys[0]; if (x >= xs[n - 1]) return ys[n - 1];
    let i = 0; while (x > xs[i + 1]) i++;
    const h = xs[i + 1] - xs[i], s = (x - xs[i]) / h, s2 = s * s, s3 = s2 * s;
    return (2 * s3 - 3 * s2 + 1) * ys[i] + (s3 - 2 * s2 + s) * h * m[i] + (-2 * s3 + 3 * s2) * ys[i + 1] + (s3 - s2) * h * m[i + 1];
  };
}
const strokeAt = monoSpline(CUE.stroke, [0, 1, 2, 3, 4, 5, 6]);   // the pen reaches vertex k on melody note k of bar 2
const traceAt = monoSpline(CUE.trace, [0, 1, 2, 3, 4, 5, 6]);     // the tracer reaches corner k on note k of bar 8 (A♭5 G5 A♭5 A♭5 C5 D5 E♭5)

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
const HITS = [[140, 4, 0.2], [256, 4, 0.2]];   // v3 calm: only a whisper on the two 降维打击 landings
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
  x.save(); x.transform(KAP, 0, 0, KAP, KX, 0); x.translate(sh[0] * 0.5, sh[1] * 0.5);
  x.fillStyle = PAL.grid;
  const gx0 = Math.floor((C.x - R) / sp) * sp, gy0 = Math.floor((C.y - R * 1.3) / sp) * sp;
  for (let gx = gx0; gx <= C.x + R; gx += sp) {
    for (let gy = gy0; gy <= C.y + R * 1.3; gy += sp) {
      const q = P([gx, gy, 0]);
      if (q[0] < -KX / KAP - 10 || q[0] > W + KX / KAP + 10 || q[1] < -10 || q[1] > H + 10) continue;
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
  shrink0: 31.66, slam2: 32,            // red line shrinks into the red point
};
function circlePts(st) {
  const C = st.C, P = st.P, out = [];
  for (let i = 0; i <= 200; i++) { const a = (i / 200) * Math.PI * 2 + 200 * S.D2R; out.push(P([C.x + C.r * Math.cos(a), C.y + C.r * Math.sin(a), 0])); }
  return out;
}
function drawFigure(f, st, t, n) {
  // ---------- overhead lamp: a soft light pool on the floor for the two 3-D acts
  const w3v = S.w3(n);
  if (w3v > 0.003) drawPool(f, st, w3v * (0.7 + 0.5 * (n < 200 ? ramp(128.4, 129.2, n) : 0)));
  // ---------- Acts II and IV (lifted figure, hyperboloid, shadows) have their own renderer
  if (st.h0 > 0.5 || st.lam > 1e-3) { drawSpace(f, st, t, n, LY); return; }
  // ---------- after Act I: flat parts (Brianchon after the slam, Act III duality, Pascal, outro)
  if (n >= 48) { drawFlat(f, st, t, n); return; }
  const cps = circlePts(st);
  const cA = 1 - 0.5 * ramp(24.3, 24.9, n) * (1 - ramp(27.4, 28.0, n));   // the circle steps back while the new hexagon is shown
  if (t < 0.6) spoly(f, cps, { w: 3.2, color: PAL.gold, to: E.io2(clamp((t - 0.06) / 0.5)), tip: true, tipR: 22, alpha: 1 });
  else spoly(f, cps, { w: 3.2, color: PAL.gold, closed: true, alpha: cA });
  drawForward(f, st, t, n);
}

// beats 0–72.4: the Pascal figure is built step by step, then turned into its dual piece by piece
function drawForward(f, st, t, n) {
  const P = st.P, A = st.A, pas = st.pas, bri = st.bri, sc = st.cam.s;
  const Ps = (p) => P(S3(p));
  const X = pas.X, ok = X.every(Boolean), Wv = bri.W, Bp = bri.B, ice = PAL.ice;
  const pre = n < 40;                                                   // the construction (before the twins)
  const twinA = pre ? 0 : ramp(40, 41, n) * (1 - ramp(44, 45, n));       // inscribed twin over the dual figure
  const dimIns = n < 20.2 ? 1 : 1 - 0.72 * ramp(20.2, 21.2, n);         // the Pascal figure steps back while the dual grows
  const gone = (k) => 1 - E.io2(clamp(CU(CUE.fly[k]) / 0.6));            // pair k leaves together with its crossing (v5: on its note)
  const As = A.map(Ps);
  // ---- circumscribed hexagon: a brief glass fill when it closes
  const fillA = 0.13 * pulse(CU(CUE.trace[6]), 0, 0.3, 1.5);              // (v5: when the tracer closes the hexagon)
  if (fillA > 0.003) sfill(f, Wv.map(Ps), ice, fillA);
  // ---- inscribed hexagon: one-stroke draw-on, then the three pairs of opposite sides light up
  for (let i = 0; i < 6; i++) {
    const k = i % 3;
    let a, w = 3.2, fr = 1, col, halo;
    if (pre) {
      a = dimIns * gone(k);
      fr = clamp(strokeAt(RT) - i);
      col = mixHex(PAL.gold, PAIR[k], 0.85 * clamp(CU(CUE.pair[k]) / 0.25));
      const pp = pulse(CU(CUE.pair[k]), 0, 0.08, 0.9);
      w += 3.4 * pp; if (pp > 0.01) halo = 2 + 2.5 * pp;
    } else { a = 0.7 * twinA; w = 2.4; col = mixHex(PAL.gold, PAIR[k], 0.85); }
    if (a <= 0.003 || fr <= 0) continue;
    sline(f, As[i], As[(i + 1) % 6], { w, color: col, to: fr, tip: fr < 1, tipR: 20, alpha: a, halo });
  }
  // ---- extensions of each pair to its crossing
  if (ok) for (let k = 0; k < 3; k++) {
    const [e0, e1] = CUE.ext[k], pr = E.io2(clamp((RT - e0) / (e1 - e0))), ov2 = E.out2(clamp((RT - e1) / 0.25));
    const dr = pr;
    const a = pre ? 0.9 * dimIns * gone(k) : 0.3 * twinA;
    if (dr <= 0 || a <= 0.003) continue;
    for (const side of [k, k + 3]) {
      const p = A[side], q = A[(side + 1) % 6], Xk = X[k];
      const near = G.dist(p, Xk) < G.dist(q, Xk) ? p : q;
      const over = G.add(Xk, G.mul(G.nrm(G.sub(Xk, near)), 46 / sc));
      const L = G.dist(near, Xk), Lo = 46 / sc, to = (pr * L + ov2 * Lo) / (L + Lo);
      sline(f, Ps(near), Ps(over), { w: 2.2, color: PAIR[k], to, tip: to < 1, alpha: a });
    }
  }
  // ---- point → tangent line (grows out of the point, overshoots, then trims to the circumscribed hexagon)
  const ov = 0.45 * (1 - ramp(SCH.ret0, SCH.ret1, n));
  for (let i = 0; i < 6; i++) {
    const g = E.out2(clamp(CU(CUE.tan[i]) / 0.45));
    if (g <= 0) continue;
    const a0 = A[i], e0 = G.add(a0, G.mul(G.sub(Wv[(i + 5) % 6], a0), g * (1 + ov))), e1 = G.add(a0, G.mul(G.sub(Wv[i], a0), g * (1 + ov)));
    const q0 = Ps(e0), q1 = Ps(e1);
    sline(f, q0, q1, { w: 3.2, color: ice, alpha: 1 });
    if (g < 1) { tip(f, q0, 18, ice, 1); tip(f, q1, 18, ice, 1); }
  }
  // ---- one-stroke tracer around the circumscribed hexagon: six sides, six corners
  if (pre && RT > CUE.trace[0] && CU(CUE.trace[6]) < 0.8) {   // v5: corner k on melody note k of bar 8 (traceAt)
    const pr = traceAt(RT), fa = 1 - E.io2(clamp((CU(CUE.trace[6]) - 0.1) / 0.6));
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
      const hi = pulse(S.cuN('slam32'), 0, 0.05, 1.5) + pulse(n, 68, 0.04, 1.8);
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
    if (n < SCH.slam1) sline(f, Ps(a), Ps(b), { w: 4.4, color: PAL.red, to: E.in2(clamp((RT - CUE.slice) / (CUE.slam - CUE.slice))), tip: true, tipR: 30, halo: 4, alpha: 1 });
    else {
      const fl = pulse(CU(CUE.slam), 0, 0.05, 1.2);
      sline(f, Ps(a), Ps(b), { w: 4.4 + 3 * fl, color: mixHex(PAL.red, '#FFD0D8', fl * 0.6), halo: 4.5, alpha: aL });
    }
  }
  // ---- points on the circle: gold vertices of the inscribed hexagon → small tangent points
  for (let i = 0; i < 6; i++) {
    const pu = clamp(CU(CUE.pt[i]) / 0.32);
    if (pu <= 0) continue;
    const tg = clamp(CU(CUE.tan[i]) / 0.35);
    const ga = pre ? 1 - tg : twinA;
    if (ga > 0.003) sdot(f, As[i], { r: 8.5, s: E.outBack(pu, 2.4), color: PAL.gold, alpha: ga });
    if (tg > 0) sdot(f, As[i], { r: 4.6, color: ice, core: '#0B1320', alpha: 0.75 * tg * (1 - 0.6 * twinA) });
  }
  // ---- circumscribed hexagon vertices
  for (let i = 0; i < 6; i++) {
    const wp = clamp(CU(CUE.wpop[i]) / 0.3);
    if (wp <= 0) continue;
    // the tracer passes corner i (corner 1 = where it starts and closes): a small bump
    const tb = pre ? pulse(CU(CUE.trace[i === 0 ? 6 : i]), 0, 0.06, 0.5) : 0;
    sdot(f, Ps(Wv[i]), { r: 9, s: E.outBack(wp, 2.4) * (1 + 0.35 * tb), color: ice, core: '#FFFFFF', halo: 2 + 2 * tb, alpha: 1 });
  }
  // ---- the three crossings (pop at 9, 10, 11; fly into the diagonals at 28.3 + k)
  if (ok) for (let k = 0; k < 3; k++) {
    const pu = clamp(CU(CUE.x[k]) / 0.3);
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
    const hi = pulse(S.cuN('slam32'), 0, 0.05, 1.6) + pulse(n, 68, 0.04, 2);
    sdot(f, Ps(Bp), { r: 11.5, s: E.outBack(bs, 2.4) * (1 + 0.25 * hi), color: PAL.red, core: '#FFFFFF', halo: 3.5 + 4 * hi, alpha: 1 });
  }
  // ---- point numbers 1–6 (so "in order" and "opposite" are unambiguous)
  const la = 1 - ramp(16.5, 17.5, n);
  if (la > 0.003) {
    const O = Ps([st.C.x, st.C.y]);
    for (let i = 0; i < 6; i++) {
      const t0 = bt(SCH.pt(i) + 0.08), tl = CT(SCH.pt(i), CUE.pt[i]);
      if (tl < t0) continue;
      const q = As[i], d = G.nrm(G.sub(q, O)), p = [q[0] + d[0] * 40, q[1] + d[1] * 40];
      letters(f, String(i + 1), { font: 'SM', size: 46, x: p[0], y: p[1], fill: PAL.cream, alpha: la, anim: popIn(tl, t0, 0, 0.24, { rot: 0.1 }), D: bD(t), seed: 70 + i, amp: 0.4, knock: 7 });
    }
  }
  // ---- corner numbers 1–6 of the circumscribed hexagon (so "opposite corners" 1–4, 2–5, 3–6 are unambiguous)
  const lw = pre ? 1 - ramp(31.1, 31.6, n) : 0;
  if (lw > 0.003 && RT > CUE.wpop[0]) {
    const O = Ps([st.C.x, st.C.y]);
    for (let i = 0; i < 6; i++) {
      const t0 = bt(SCH.wpop(i) + 0.06), tl = CT(SCH.wpop(i), CUE.wpop[i]);
      if (tl < t0) continue;
      const q = Ps(Wv[i]), d = G.nrm(G.sub(q, O)), p = [q[0] + d[0] * 40, q[1] + d[1] * 40];
      letters(f, String(i + 1), { font: 'SM', size: 44, x: p[0], y: p[1], fill: '#DDF6FF', alpha: lw, anim: popIn(tl, t0, 0, 0.24, { rot: 0.1 }), D: bD(t), seed: 90 + i, amp: 0.4, knock: 7 });
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
      const from = pt(n1), u = E.io2(clamp((RT - S.realT(n1)) / (0.5 * RNAT)));
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
  const dt = (RT - S.realT(n0)) / 1.4;
  if (dt > 0 && dt < 0.5) ringWave(f, p, dt / 0.5, { r0: 24, R: 74, w: 3, color: PAL.cream, alpha: alpha * 0.9 });
}

// ------------------------------------------------------------------ impacts
function drawImpacts(f, st, t, n) {
  // v3 calm: every "aha" is marked by one or two soft expanding rings only (no rays, sparks or white-outs)
  const P = st.P, pas = st.pas, bri = st.bri;
  const Ps = (p) => P(S3(p));
  const at = (n0, d) => (t - bt(n0)) / d;
  const X = pas.X, ok = X.every(Boolean);
  // the crossings pop (9, 10, 11)
  if (ok && n > 8.9 && n < 13) for (let k = 0; k < 3; k++) ringWave(f, Ps(X[k]), (RT - CUE.x[k]) / (0.5 * 1.4), { R: 70, w: 3, color: PAIR[k] });
  // slam 1: the red line lands
  if (ok && n > 11.9 && n < 15) for (let k = 0; k < 3; k++) ringWave(f, Ps(X[k]), (RT - CUE.slam) / (0.7 * 1.4), { R: 100, w: 3.5, color: PAIR[k] });
  // point → tangent line
  if (RT > CUE.tan[0] - 0.05 && RT < CUE.tan[5] + 0.8) for (let i = 0; i < 6; i++) ringWave(f, Ps(st.A[i]), (RT - CUE.tan[i]) / (0.5 * 1.4), { R: 52, w: 3, color: PAL.ice });
  // the six corners of the circumscribed hexagon pop one by one
  if (RT > CUE.wpop[0] - 0.05 && RT < CUE.wpop[5] + 0.8) for (let i = 0; i < 6; i++) ringWave(f, Ps(bri.W[i]), (RT - CUE.wpop[i]) / (0.5 * 1.4), { R: 50, w: 3, color: PAL.ice });
  // crossing k → diagonal k: its two opposite vertices light up
  if (RT > CUE.fly[0] - 0.05 && RT < CUE.fly[2] + 0.9) for (let k = 0; k < 3; k++) for (const j of [k, k + 3]) ringWave(f, Ps(bri.W[j]), (RT - CUE.fly[k]) / (0.6 * 1.4), { R: 60, w: 3, color: PAIR[k] });
  // slam 2: the Brianchon point
  if (n > 31.9 && n < 34) ringWave(f, Ps(bri.B), S.cuS('slam32') / 0.8, { R: 150, w: 4, color: PAL.red });
  // v5: the coda's last three E♭ chords — the Brianchon point answers softly
  if (RT > CUE.coda[0] - 0.1 && RT < CUE.coda[2] + 2) CUE.coda.forEach((tc, j) => ringWave(f, Ps(bri.B), (RT - tc) / (1.3 * 1.4), { R: 90 + 30 * j, w: 2.6, color: j === 2 ? PAL.red : PAL.cream, alpha: 0.55 }));
  // Act II ④: the single meeting point Q
  if (st.lam > 0.05 && n > 123.95 && n < 126.5) ringWave(f, P(st.lift.Q), S.cuS('slam124') / 0.8, { R: 140, w: 4, color: PAL.red });
  // 降维打击: the figure lands on its shadow — the Brianchon point
  if (n > 139.95 && n < 143) {
    const q = Ps(bri.B);
    ringWave(f, q, S.cuS('slam140') / 0.9, { R: 240, w: 5, color: PAL.cream });
    ringWave(f, q, (S.cuS('slam140') - 0.25 * S.BEAT) / 1.1, { R: 380, w: 3.5, color: PAL.red });
  }
  // Act III: 你在我的线上 ⇔ 我在你的线上
  if (n > 183.95 && n < 186.5) {
    const dm = demoAt(n);
    [[dm.Pp, '#FFE3A3'], [dm.Qp, PAL.c2]].forEach(([p, col]) => ringWave(f, Ps(p), S.cuS('slam184') / 0.8, { R: 120, w: 4, color: col }));
  }
  // Pascal for free (flat)
  if (ok && n > 207.95 && n < 210) for (let k = 0; k < 3; k++) ringWave(f, Ps(X[k]), S.cuS('slam208') / 0.7, { R: 110, w: 3.5, color: PAIR[k] });
  // 降维打击 2.0: the figure lands, the red line on the floor
  if (ok && n > 255.95 && n < 259) {
    const span = G.spanOf(X, 0), m = Ps(G.lerp2(span[0], span[1], 0.5));
    ringWave(f, m, S.cuS('slam256') / 0.9, { R: 260, w: 5, color: PAL.cream });
    ringWave(f, m, (S.cuS('slam256') - 0.25 * S.BEAT) / 1.1, { R: 400, w: 3.5, color: PAL.red });
    for (let k = 0; k < 3; k++) ringWave(f, Ps(X[k]), (S.cuS('slam256') - 0.05 * S.BEAT) / 0.7, { R: 100, w: 3.5, color: PAIR[k] });
  }
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
add({ n0: 11.15, n1: 12.0, s: '这3个交点 · 有什么关系？', size: 92, y: TY, ent: 'pop', q: true, st: 0.012 });
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
add({ n0: 31.05, n1: 32.0, s: '这3条对角线 · 又会怎样？', size: 92, y: TY, ent: 'pop', q: true, st: 0.012 });
add({ n0: 32.0, n1: 36.0, s: '竟然[交于一点]！', size: 108, y: TY, ent: 'slam', hl: PAL.red });
add({ n0: 32.3, n1: 36.0, s: '红线 → 红点 · 共线 → 共点', font: 'SM', size: 52, y: TY2 + 8, ent: 'pop', fill: PAL.cream, st: 0.012 });
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
// ④ Act II — Brianchon proved in space, five steps
add({ n0: 48.0, n1: 52.0, s: '升到[三维]！', size: 128, y: TY, ent: 'slam', hl: PAL.gold });
add({ n0: 48.4, n1: 52.0, s: '平面里难证 · 到空间里一眼看穿', font: 'SM', size: 52, y: TY2 + 30, ent: 'pop', fill: PAL.cream });
add({ n0: 52.0, n1: 55.4, s: '6条边 · 一上一下[翘起来]', font: 'SM', size: 70, y: TY, ent: 'pop' });
add({ n0: 52.5, n1: 55.4, s: '每条边绕着切点转 · 像跷跷板', font: 'WK', size: 52, y: CY, ent: 'pop' });
add({ n0: 55.4, n1: 60.0, s: '相邻两边 · 照样[相交]', font: 'SM', size: 72, y: TY, ent: 'pop' });
add({ n0: 55.8, n1: 58.0, s: '看顶点4：两段切线一样长（影子上的记号）', font: 'WK', size: 48, y: CY, ent: 'pop' });
add({ n0: 58.0, n1: 60.0, s: '→ 翘起来一样高 → 正好碰头', font: 'WK', size: 52, y: CY, ent: 'pop' });
add({ n0: 60.0, n1: 64.0, s: '它们都在一个「[小蛮腰]」曲面上', font: 'SM', size: 66, y: TY, ent: 'pop' });
add({ n0: 60.5, n1: 64.0, s: '广州塔就是这个形状 · 叫单叶双曲面', font: 'WK', size: 46, y: TY2 - 6, ent: 'pop', fill: PAL.ice });
add({ n0: 64.0, n1: 67.0, s: '曲面由[直线]织成', size: 96, y: TY, ent: 'pop' });
add({ n0: 64.3, n1: 67.0, s: '金色一族 · 蓝色一族', font: 'WK', size: 54, y: CY, ent: 'pop' });
add({ n0: 67.0, n1: 72.0, s: '6条边：[金蓝交替]', size: 96, y: TY, ent: 'pop' });
add({ n0: 67.5, n1: 72.0, s: '相对的两条边 · 一定是一金一蓝', font: 'WK', size: 52, y: CY, ent: 'pop' });
add({ n0: 72.0, n1: 76.0, s: '连出3条[空间对角线]', size: 92, y: TY, ent: 'pop', hl: PAL.gold });
add({ n0: 72.4, n1: 76.0, s: '14 · 25 · 36（连相对的顶点）', font: 'WK', size: 54, y: CY, ent: 'pop' });
add({ n0: 76.0, n1: 80.0, s: '它们[两两相交]吗？', size: 96, y: TY, ent: 'pop', hl: PAL.red, q: true, st: 0.02 });
add({ n0: 77.2, n1: 80.0, s: '空间里的两条直线 · 多半是错开的', font: 'WK', size: 52, y: CY, ent: 'pop' });
add({ n0: 80.0, n1: 84.0, s: '先看 [25] 和 [36]', size: 100, y: TY, ent: 'pop' });
add({ n0: 80.5, n1: 84.0, s: '想证它俩相交 · 先找一个装下它俩的平面', font: 'WK', size: 48, y: CY, ent: 'pop' });
add({ n0: 84.0, n1: 88.0, s: '看4个端点：[2 3 5 6]', size: 88, y: TY, ent: 'pop' });
add({ n0: 84.5, n1: 88.0, s: '2、3 在边23上 · 5、6 在边56上', font: 'WK', size: 50, y: TY2, ent: 'pop', fill: PAL.ice });
add({ n0: 88.0, n1: 90.8, s: '把边23和边56 · [延长]', font: 'SM', size: 74, y: TY, ent: 'pop', st: 0.025 });
add({ n0: 88.2, n1: 89.6, s: '空间里的两条线 · 会碰上吗？', font: 'WK', size: 56, y: CY, ent: 'pop', q: true, st: 0.012 });
add({ n0: 89.6, n1: 91.6, s: '真的碰上了！交于一点 P', font: 'WK', size: 56, y: CY, ent: 'pop', fill: PAL.gold, st: 0.02 });
add({ n0: 90.8, n1: 93.4, s: '为什么？看[影子]', size: 100, y: TY, ent: 'pop' });
add({ n0: 91.8, n1: 93.4, s: '影子：两条切线交于一点 · 到切点一样远', font: 'WK', size: 50, y: CY, ent: 'pop', st: 0.02 });
add({ n0: 93.4, n1: 96.0, s: '一样远 → 升得[一样高]', size: 90, y: TY, ent: 'pop' });
add({ n0: 93.8, n1: 96.0, s: '所以在影子正上方碰头', font: 'WK', size: 54, y: CY, ent: 'pop' });
add({ n0: 96.0, n1: 100.0, s: '两条相交直线 → 定出[一个平面]', font: 'SM', size: 70, y: TY, ent: 'pop' });
add({ n0: 100.0, n1: 102.4, s: '2、3、5、6 都在这个平面上', font: 'SM', size: 70, y: TY, ent: 'pop' });
add({ n0: 100.4, n1: 102.4, s: '→ 对角线25、36也在这个平面上', font: 'WK', size: 52, y: CY, ent: 'pop' });
add({ n0: 102.4, n1: 106.0, s: '同一平面 · 不平行 → [一定相交]！', font: 'SM', size: 66, y: TY, ent: 'pop' });
add({ n0: 106.0, n1: 110.0, s: '再看 [36] 和 [14]', size: 100, y: TY, ent: 'pop' });
add({ n0: 106.4, n1: 110.0, s: '边34、边61延长 → 相交 → 同一平面 → 相交', font: 'WK', size: 46, y: CY, ent: 'pop' });
add({ n0: 110.0, n1: 114.0, s: '最后 [14] 和 [25]', size: 100, y: TY, ent: 'pop' });
add({ n0: 110.4, n1: 114.0, s: '边12、边45延长 → 相交（交点在很高处）→ 相交', font: 'WK', size: 44, y: CY, ent: 'pop' });
add({ n0: 114.0, n1: 118.0, s: '3条线 · [两两相交]', size: 96, y: TY, ent: 'pop' });
add({ n0: 114.4, n1: 118.0, s: '交点只有两种可能', font: 'SM', size: 52, y: TY2, ent: 'pop', fill: PAL.cream });
add({ n0: 115.9, n1: 118.0, s: '你觉得 · 会是哪一种？', font: 'WK', size: 58, y: CY, ent: 'pop', q: true, st: 0.02 });
add({ n0: 118.0, n1: 121.0, s: '要是围成三角形 → 3条线[共面]', font: 'SM', size: 68, y: TY, ent: 'pop' });
add({ n0: 118.4, n1: 121.0, s: '→ 6个顶点也都在这个平面上', font: 'WK', size: 52, y: CY, ent: 'pop' });
add({ n0: 121.0, n1: 124.0, s: '可6个顶点[一上一下]！', size: 92, y: TY, ent: 'pop' });
add({ n0: 121.4, n1: 122.65, s: '相邻顶点 · 一个在腰上方 · 一个在腰下方', font: 'WK', size: 48, y: CY, ent: 'pop', st: 0.02 });
// the ④ insert (video beats 123–127; the story clock waits at 123): why six alternating vertices cannot share a plane
add({ v: true, n0: 123.0, n1: 125.05, s: '假如共面：它和腰面交成一条线 · 一边高 一边低', font: 'WK', size: 46, y: CY, ent: 'pop', st: 0.02 });
add({ v: true, n0: 125.25, n1: 126.75, s: '可「上」「下」交替 · 哪条线都分不开！', font: 'WK', size: 52, y: CY, ent: 'pop', fill: PAL.cream, st: 0.02 });
add({ n0: 124.0, n1: 128.0, s: '⇒ 只能交于[同一点]！', size: 100, y: TY, ent: 'slam', hl: PAL.red });
add({ n0: 124.4, n1: 128.0, s: '3条空间对角线 · 交于一点 Q', font: 'SM', size: 52, y: TY2 + 10, ent: 'pop', fill: PAL.cream, st: 0.015 });
add({ n0: 128.0, n1: 132.0, s: '从正上方打光 · 看[影子]', size: 92, y: TY, ent: 'pop', hl: PAL.gold });
add({ n0: 128.4, n1: 132.0, s: '光线垂直向下 · 每个点落在正下方', font: 'WK', size: 52, y: CY, ent: 'pop' });
add({ n0: 132.0, n1: 136.0, s: '影子 = 原来的[平面图形]！', size: 88, y: TY, ent: 'pop', hl: PAL.ice });
add({ n0: 132.4, n1: 136.0, s: '6条边 → 外切六边形 · 空间对角线 → 平面对角线', font: 'WK', size: 46, y: CY, ent: 'pop' });
add({ n0: 136.0, n1: 140.0, s: '空间里交于一点 → 影子也[交于一点]', font: 'SM', size: 64, y: TY, ent: 'pop', hl: PAL.red });
add({ n0: 136.4, n1: 140.0, s: 'Q 的影子 = 布列安桑点', font: 'WK', size: 56, y: CY, ent: 'pop' });
add({ n0: 140.0, n1: 144.0, s: '[降维打击]！', size: 150, y: TY + 10, ent: 'slam', hl: PAL.red, big: 1.5 });
add({ n0: 141.8, n1: 144.0, s: '布列安桑定理 · 证毕 ■', font: 'SM', size: 58, y: TY2 + 46, ent: 'pop', fill: PAL.ice });
// ⑤ Act III — why duality works: a point's line (pole / polar)
add({ n0: 144.0, n1: 148.0, s: '可是 · [对偶]凭什么成立？', size: 88, y: TY, ent: 'pop', hl: PAL.gold });
add({ n0: 144.5, n1: 148.0, s: '点 · 凭什么能变成线？', font: 'SM', size: 54, y: TY2 + 8, ent: 'pop', fill: PAL.cream });
add({ n0: 148.0, n1: 152.0, s: '圆外一点 P · 引[两条切线]', font: 'SM', size: 72, y: TY, ent: 'pop' });
add({ n0: 152.0, n1: 156.0, s: '连起两个[切点]', size: 96, y: TY, ent: 'pop' });
add({ n0: 152.5, n1: 156.0, s: '得到一条线（切点弦）', font: 'WK', size: 54, y: CY, ent: 'pop' });
add({ n0: 156.0, n1: 160.0, s: '这条线 · 就是 P 的「[线]」', font: 'SM', size: 74, y: TY, ent: 'pop' });
add({ n0: 156.5, n1: 160.0, s: '数学家叫它 P 的「极线」', font: 'SM', size: 50, y: TY2, ent: 'pop', fill: PAL.ice });
add({ n0: 160.0, n1: 164.0, s: 'P 往圆上走……', size: 96, y: TY, ent: 'pop' });
add({ n0: 160.5, n1: 164.0, s: '它的线也跟着往外走', font: 'SM', size: 50, y: TY2, ent: 'pop', fill: PAL.ice });
add({ n0: 161.6, n1: 164.0, s: '走到圆上时 · 它的线会变成什么？', font: 'WK', size: 54, y: CY, ent: 'pop', q: true, st: 0.02 });
add({ n0: 164.0, n1: 168.0, s: 'P 在圆上 → 它的线 = [切线]！', font: 'SM', size: 70, y: TY, ent: 'pop' });
add({ n0: 164.5, n1: 168.0, s: '第一幕「点 → 切线」· 就是这个！', font: 'WK', size: 52, y: CY, ent: 'pop', fill: PAL.gold });
add({ n0: 168.0, n1: 172.0, s: '用[坐标]说清楚', size: 96, y: TY, ent: 'pop' });
add({ n0: 172.0, n1: 176.0, s: '课本里的「[切点弦方程]」', font: 'SM', size: 72, y: TY, ent: 'pop' });
add({ n0: 172.5, n1: 176.0, s: 'P 在圆上时 · 它正是切线方程', font: 'WK', size: 52, y: CY, ent: 'pop' });
add({ n0: 176.0, n1: 180.0, s: 'Q(c, d) 在 P 的线上', font: 'SM', size: 80, y: TY, ent: 'pop' });
add({ n0: 178.6, n1: 180.0, s: '反过来 · P 在 Q 的线上吗？', font: 'WK', size: 56, y: CY, ent: 'pop', q: true, st: 0.02 });
add({ n0: 180.0, n1: 184.0, s: '换个角度读：P 在 Q 的线上！', font: 'SM', size: 70, y: TY, ent: 'pop' });
add({ n0: 180.6, n1: 184.0, s: '两个式子 · 一模一样', font: 'WK', size: 54, y: CY, ent: 'pop', fill: PAL.gold });
add({ n0: 184.0, n1: 188.0, s: '你在我的线上 ⇔ [我在你的线上]', size: 80, y: TY, ent: 'slam', hl: PAL.red });
add({ n0: 184.4, n1: 188.0, s: '对偶的秘密 · 就这一句', font: 'SM', size: 54, y: TY2 + 20, ent: 'pop', fill: PAL.gold });
add({ n0: 188.0, n1: 192.0, s: 'Q 沿着 P 的线滑动……', font: 'SM', size: 74, y: TY, ent: 'pop' });
add({ n0: 188.5, n1: 192.0, s: 'Q 的线 · 始终绕着 P 转', font: 'WK', size: 54, y: CY, ent: 'pop' });
add({ n0: 192.0, n1: 196.0, s: '点在一条[线]上 ⇔ 线过同一个[点]', font: 'SM', size: 66, y: TY, ent: 'pop' });
add({ n0: 192.5, n1: 196.0, s: '共线 ⇔ 共点', size: 72, y: TY2 + 24, ent: 'pop', fill: PAL.gold });
add({ n0: 196.0, n1: 200.0, s: '回到六边形：顶点 → [一条边]', font: 'SM', size: 68, y: TY, ent: 'pop' });
add({ n0: 196.5, n1: 200.0, s: '从顶点引的两条切线 · 切点连起来 = 内接六边形的边', font: 'WK', size: 44, y: CY, ent: 'pop' });
add({ n0: 200.0, n1: 204.0, s: '对角线 → 一组[对边的交点]', font: 'SM', size: 70, y: TY, ent: 'pop' });
add({ n0: 200.5, n1: 204.0, s: '对角线过两个顶点 ⇔ 那两条对边过这个交点', font: 'WK', size: 46, y: CY, ent: 'pop' });
add({ n0: 204.0, n1: 208.0, s: '3条对角线交于 [B]', size: 92, y: TY, ent: 'pop', hl: PAL.red });
add({ n0: 204.5, n1: 208.0, s: '⇔ 3个交点都在 B 的线上', font: 'SM', size: 54, y: TY2 + 8, ent: 'pop', fill: PAL.cream });
add({ n0: 208.0, n1: 212.0, s: '[帕斯卡定理]也成立！', size: 100, y: TY, ent: 'slam', hl: PAL.red });
add({ n0: 208.5, n1: 212.0, s: '布列安桑 ⇒ 帕斯卡 · 对偶白送一个定理', font: 'WK', size: 54, y: CY, ent: 'pop', fill: PAL.gold, st: 0.02 });
// ⑥ Act IV — Pascal lifted too (Dandelin 1826)
add({ n0: 212.0, n1: 216.0, s: '其实帕斯卡 · 也能[升维]', size: 90, y: TY, ent: 'pop', hl: PAL.gold });
add({ n0: 212.5, n1: 216.0, s: 'Dandelin 1826 · 同一座小蛮腰', font: 'SM', size: 50, y: TY2 + 8, ent: 'pop', fill: PAL.ice });
add({ n0: 216.0, n1: 220.0, s: '同样的6条边 · 穿过6个[切点]', font: 'SM', size: 70, y: TY, ent: 'pop' });
add({ n0: 216.5, n1: 220.0, s: '6个切点连起来 = 帕斯卡的六边形（在腰上）', font: 'WK', size: 48, y: CY, ent: 'pop', fill: PAL.gold });
add({ n0: 220.0, n1: 224.0, s: '相邻两条边 → 张成一个[三角面]', font: 'SM', size: 70, y: TY, ent: 'pop' });
add({ n0: 220.5, n1: 224.0, s: '它和腰平面的交线 = 金色六边形的一条边', font: 'WK', size: 48, y: CY, ent: 'pop' });
add({ n0: 224.0, n1: 228.0, s: '6个三角面 ↔ 金色六边形的6条边', font: 'SM', size: 66, y: TY, ent: 'pop' });
add({ n0: 228.0, n1: 232.0, s: '对边交于[3个点]', size: 96, y: TY, ent: 'pop' });
add({ n0: 228.5, n1: 232.0, s: '第二幕证过：相对的两条边一定相交', font: 'WK', size: 50, y: CY, ent: 'pop' });
add({ n0: 232.0, n1: 234.0, s: '3个点 → 定出一个[平面]', font: 'SM', size: 74, y: TY, ent: 'pop' });
add({ n0: 234.0, n1: 238.0, s: '看这条棱：它同时在[两个三角面]上', font: 'SM', size: 64, y: TY, ent: 'pop' });
add({ n0: 234.5, n1: 238.0, s: '棱的两端 = 两组对边的交点', font: 'WK', size: 52, y: CY, ent: 'pop' });
add({ n0: 238.0, n1: 242.0, s: '两个三角面 · 和腰平面交出一组[对边]', font: 'SM', size: 64, y: TY, ent: 'pop' });
add({ n0: 239.6, n1: 242.0, s: '那么 · 棱穿过腰平面的点在哪？', font: 'WK', size: 54, y: CY, ent: 'pop', q: true, st: 0.02 });
add({ n0: 242.0, n1: 245.0, s: '棱穿过腰平面的点 = [对边交点]！', font: 'SM', size: 66, y: TY, ent: 'pop' });
add({ n0: 242.4, n1: 245.0, s: '它同时在两条对边的延长线上', font: 'WK', size: 52, y: CY, ent: 'pop' });
add({ n0: 245.0, n1: 249.0, s: '另外两条棱 · [同理]', size: 92, y: TY, ent: 'pop' });
add({ n0: 249.0, n1: 253.0, s: '3个交点：既在[三角形平面]上', font: 'SM', size: 70, y: TY, ent: 'pop' });
add({ n0: 249.5, n1: 253.0, s: '又在腰平面上', font: 'SM', size: 58, y: TY2 + 8, ent: 'pop', fill: PAL.ice });
add({ n0: 250.6, n1: 253.0, s: '两个平面相交 · 会交出什么？', font: 'WK', size: 56, y: CY, ent: 'pop', q: true, st: 0.02 });
add({ n0: 253.0, n1: 256.0, s: '两个平面相交 → [一条直线]！', font: 'SM', size: 72, y: TY, ent: 'pop', hl: PAL.red });
add({ n0: 256.0, n1: 260.0, s: '[降维打击] 2.0！', size: 140, y: TY + 10, ent: 'slam', hl: PAL.red, big: 1.5 });
add({ n0: 257.9, n1: 260.0, s: '三点共线 · 帕斯卡定理 证毕 ■', font: 'SM', size: 56, y: TY2 + 46, ent: 'pop', fill: PAL.gold });
// ⑦ outro
add({ n0: 260.0, n1: 264.0, s: '一座[小蛮腰] · 两个定理', size: 92, y: TY, ent: 'pop', hl: PAL.ice });
add({ n0: 264.0, n1: 999, s: '帕斯卡 ⇄ 布列安桑', size: 96, y: TY, ent: 'draw', hl: PAL.gold });
add({ n0: 264.6, n1: 999, s: '点和线 · 互为[镜像]', font: 'SM', size: 70, y: 1300, ent: 'pop', hl: PAL.gold });
add({ n0: 265.2, n1: 999, s: '几何定理系列 · 01', font: 'SM', size: 44, y: 1410, ent: 'pop', fill: PAL.goldD });
add({ n0: 265.8, n1: 999, s: '你还见过哪些「对偶」？评论区聊', font: 'WK', size: 52, y: CY, ent: 'pop', fill: PAL.cream });

// a line leaves just before the next line that lands in the same place
let SLOTTED = false;
function slotTexts() {
  for (const o of T) {
    for (const q of T) {
      if (q === o || !!q.v !== !!o.v || q.n0 <= o.n0 + 1e-6) continue;
      if (Math.abs((q.y ?? 0) - (o.y ?? 0)) < 0.55 * Math.max(q.size, o.size)) o.n1 = Math.min(o.n1, q.n0 - 0.2);
    }
  }
  // v5: real-time [lands, leaves] (js/cues.js CAPS). A caption without a scored exit leaves on the clock (beat n1);
  // a caption that lands early on its note (a slam lands ON the note) first pushes out whoever holds its slot.
  const vbeat = (o, n) => (o.v || n < S.INS0 ? n : n + S.INSD);
  for (const o of T) {
    const c0 = CAPS[o.s], clk = S.realT(vbeat(o, o.n1));
    let push = Infinity;
    for (const q of T) {
      if (q === o || !CAPS[q.s] || !!q.v !== !!o.v || q.n0 <= o.n0 + 1e-6 || q.n0 > o.n1 + 0.3) continue;
      if (Math.abs((q.y ?? 0) - (o.y ?? 0)) < 0.55 * Math.max(q.size, o.size)) push = Math.min(push, CAPS[q.s][0] - 0.2);
    }
    // every caption animates at natural speed from its landing (a hold never slows a pop-in or a drop-out)
    o.cap = c0 ? [c0[0], Math.min(c0[1] ?? clk, push)] : [S.realT(vbeat(o, o.n0)), Math.min(clk, push)];
    o.cap[1] = Math.max(o.cap[1], o.cap[0] + 0.3);
  }
  SLOTTED = true;
}
// 3-D proof progress: ①②③④⑤ at the top (Act II and Act IV)
const STEPS2 = [52, 60, 72, 114, 128], STEPS4 = [216, 220, 228, 234, 249];
function drawSteps(f, t, n) {
  const II = n < 200, STEPS = II ? STEPS2 : STEPS4;
  const a = II ? ramp(49.6, 50.2, n) * (1 - ramp(139.6, 140.0, n)) : ramp(213.0, 213.6, n) * (1 - ramp(255.6, 256.0, n));
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
    letters(f, String(i + 1), { font: 'SM', size: on ? 30 + 8 * pop : 28, x, y: y + 1, fill: on || done ? '#0B1320' : PAL.goldD, knock: 0, amp: 0.25, D: bD(t), seed: 90 + i });
  }
  f.restore();
}
function rrect(f, x0, y0, x1, y1, r) {
  f.beginPath(); f.moveTo(x0 + r, y0); f.arcTo(x1, y0, x1, y1, r); f.arcTo(x1, y1, x0, y1, r); f.arcTo(x0, y1, x0, y0, r); f.arcTo(x0, y0, x1, y0, r); f.closePath();
}
// a card that pops in (scale about its centre) and drops out
function cardAnim(t, n, n0, n1) {
  if (n < n0) return null;
  const pin = E.outBack(clamp((t - bt(n0)) / 0.3), 2.2), pout = clamp((t - bt(n1)) / 0.25);
  if (pout >= 1) return null;
  return { s: 0.6 + 0.4 * pin, a: clamp(pin * 1.4) * (1 - pout), dy: 26 * E.in2(pout) };
}
// Act II ④: the two possibilities for three pairwise-meeting lines (交于一点 / 围成三角形)
function drawPicto(f, t, n) {
  if (n < 114.5 || n > 126.6) return;
  const D = bD(t), cy = 548, hw = 205, hh = 112;
  const opts = [{ x: 300, n0: 114.7, lab: '交于一点' }, { x: 780, n0: 115.3, lab: '围成三角形' }];
  opts.forEach((o, j) => {
    const an = cardAnim(t, n, o.n0, 125.6);
    if (!an) return;
    const ko = j === 1 ? ramp(123.0, 123.3, n) : 0, win1 = j === 0 ? pulse(S.cuN('slam124'), 0, 0.06, 1.6) : 0;
    const hiTri = j === 1 ? ramp(118.1, 118.6, n) * (1 - ko) : 0;
    f.save(); f.globalAlpha *= an.a * (1 - 0.45 * ko);
    f.translate(o.x, cy + an.dy); f.scale(an.s, an.s);
    rrect(f, -hw, -hh, hw, hh, 24); f.fillStyle = 'rgba(11,19,32,0.84)'; f.fill();
    f.lineWidth = 2.5 + 2 * (hiTri + win1); f.strokeStyle = rgba(j === 0 && n > 124 ? PAL.gold : hiTri > 0.1 ? PAL.ice : PAL.goldD, 0.55 + 0.4 * Math.max(hiTri, win1, j === 0 && n > 124 ? 1 : 0)); f.stroke();
    const c0 = [0, -26];
    if (j === 0) {
      for (let k = 0; k < 3; k++) {
        const ang = (20 + 60 * k) * Math.PI / 180, dx = Math.cos(ang) * 92, dy = Math.sin(ang) * 66;
        sline(f, [c0[0] - dx, c0[1] - dy], [c0[0] + dx, c0[1] + dy], { w: 4, color: PAIR[k], alpha: 1 });
      }
      sdot(f, c0, { r: 9, s: 1 + 0.4 * win1, color: PAL.red, core: '#FFFFFF', halo: 2 + 3 * win1, alpha: 1 });
    } else {
      const tri = [[-62, 18], [58, 22], [-4, -78]].map((p) => [p[0] + c0[0], p[1] + c0[1] + 10]);
      if (hiTri > 0.003) { sfill(f, [[-150, 54], [140, 62], [120, -98], [-128, -104]], PAL.ice, 0.16 * hiTri); }
      for (let k = 0; k < 3; k++) {
        const a = tri[k], b = tri[(k + 1) % 3], d = G.nrm(G.sub(b, a));
        sline(f, [a[0] - d[0] * 38, a[1] - d[1] * 38], [b[0] + d[0] * 38, b[1] + d[1] * 38], { w: 4, color: PAIR[k], alpha: 1 });
      }
      for (const p of tri) sdot(f, p, { r: 6.5, color: PAL.cream, alpha: 1 });
      if (hiTri > 0.003) letters(f, '共面', { font: 'SM', size: 34, x: 128, y: -78, fill: PAL.ice, alpha: hiTri, D, seed: 31, amp: 0.3, knock: 0 });
    }
    letters(f, o.lab, { font: 'SM', size: 40, x: 0, y: 76, fill: j === 0 && n > 124 ? PAL.gold : PAL.cream, D, seed: 20 + j, amp: 0.35, knock: 0 });
    f.restore();
    // verdicts: ✗ on the triangle (123), ✓ on the single point (124)
    if (j === 1 && n > 123.0) letters(f, '✗', { font: 'WK', size: 160, x: o.x, y: cy - 10 + an.dy, fill: PAL.red, alpha: an.a, anim: slamIn(t, bt(123.0), 0.26, { big: 1.3 }), D, seed: 33 });
    if (j === 0 && n > 124.0) { const u = clamp((n - 124.0) / 0.3); check(f, [o.x + hw - 30, cy - hh + 22 + an.dy], 92 * (1 + 0.7 * (1 - E.out2(u))), { color: PAL.gold, alpha: an.a, u: clamp((n - 124.0) / 0.22) }); }
  });
}
// Act II ③: checklist of the three pairs
function drawChecks(f, t, n) {
  if (n < 102.8 || n > 126.6) return;
  const D = bD(t), y = 1488;
  [[102.8, '25 和 36', 1], [108.9, '36 和 14', 2], [112.9, '14 和 25', 0]].forEach(([n0, s, k], j) => {
    const an = cardAnim(t, n, n0, 125.6);
    if (!an) return;
    const x = 230 + 310 * j, col = mixHex(mixHex(PAIR[k], PAIR[(k + 1) % 3], 0.5), '#FFFFFF', 0.2);
    f.save(); f.globalAlpha *= an.a; f.translate(x, y + an.dy); f.scale(an.s, an.s);
    rrect(f, -132, -40, 132, 40, 20); f.fillStyle = 'rgba(11,19,32,0.84)'; f.fill(); f.lineWidth = 2.5; f.strokeStyle = rgba(col, 0.8); f.stroke();
    letters(f, s, { font: 'SM', size: 40, x: -22, y: 1, fill: PAL.cream, D, seed: 50 + j, amp: 0.3, knock: 0 });
    check(f, [94, 2], 40, { color: col, u: clamp((n - n0 - 0.15) / 0.35) });
    f.restore();
  });
}
// Act III: the formula card rows (the card itself is drawn with the figure)
const CROWS = [[168.4, 1316, '圆：x² + y² = r²', PAL.cream], [169.6, 1382, 'P(a, b) 的线：[ax + by = r²]', '#FFE3A3'],
  [176.6, 1450, 'Q 在 P 的线上：[a·c + b·d = r²]', PAL.c2], [180.6, 1512, 'P 在 Q 的线上：[c·a + d·b = r²]', PAL.c2]];
function drawCardRows(f, t, n) {
  if (n < 168.3 || n > 188.6) return;
  const D = bD(t);
  CROWS.forEach(([n0, y, s, hl], j) => {
    if (n < n0) return;
    const out = n >= 187.4 ? dropOut(t, bt(187.4), 0.2, { dist: 18 }) : null;
    const same = j >= 2 ? pulse(n, 182.4, 0.12, 1.4) : 0;
    let size = 46; const m = measure(s, 'WK', size); if (m.w > 860) size *= 860 / m.w;
    letters(f, s, { font: 'WK', size: size * (1 + 0.08 * same), x: 540, y, fill: PAL.cream, hl, anim: out || popIn(t, bt(n0), 0.03, 0.24), D, seed: 70 + j, amp: 0.7 });
  });
}
// ---- questions to the viewer (v3 calm): the ring of the "？" badge fills during the think-time hold
const TAU = Math.PI * 2, vbeat = (n) => (n < S.INS0 ? n : n + S.INSD);
function qRing(o) {
  if (o._h === undefined) {
    const a = o.v ? o.n0 : vbeat(o.n0), b = o.v ? o.n1 : vbeat(o.n1);
    o._h = S.HOLDS.findIndex((h) => h[3] === 'q' && h[0] > a && h[0] < b);
  }
  if (o._h < 0) return 0;
  const [ta, tb] = S.holdSpan(o._h);
  return clamp((RT - ta) / (tb - ta));
}
function qBadge(f, x, y, r, a, u, D) {
  f.save(); f.globalAlpha *= a;
  f.beginPath(); f.arc(x, y, r + 7, 0, TAU); f.fillStyle = 'rgba(11,19,32,0.9)'; f.fill();
  f.beginPath(); f.arc(x, y, r - 3, 0, TAU); f.fillStyle = rgba(PAL.gold, 0.12); f.fill();
  f.lineWidth = 5; f.strokeStyle = rgba(PAL.gold, 0.38); f.beginPath(); f.arc(x, y, r, 0, TAU); f.stroke();
  if (u > 0.002) { f.lineCap = 'round'; f.lineWidth = 7; f.strokeStyle = PAL.gold; f.beginPath(); f.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + TAU * u); f.stroke(); }
  f.restore();
  letters(f, '?', { font: 'SB', size: 1.5 * r, x, y: y + 0.02 * r, fill: PAL.gold, alpha: a, D, seed: 97, amp: 0.3, knock: 0 });
}
// ---- hard parts (v3 calm): a quiet pill — 这里有点绕 · 可以先暂停 (video beats)
const PAUSES = [[90.9, 95.4], [123.05, 125.6], [168.3 + 4, 172.6 + 4], [234.2 + 4, 238.4 + 4]];
const PAUSE_TXT = '这里有点绕 · 可以先暂停，慢慢看';
function drawPauseHint(f, n) {
  const nv = NV;
  for (const [a, b] of PAUSES) {
    const al = ramp(a, a + 0.5, nv) * (1 - ramp(b - 0.5, b, nv));
    if (al <= 0.003) continue;
    const size = 36, w = measure(PAUSE_TXT, 'SM', size).w, x0 = 540 - (w + 66) / 2, y = 1712;
    f.save(); f.globalAlpha *= al * 0.92;
    rrect(f, x0 - 26, y - 34, x0 + w + 92, y + 34, 34); f.fillStyle = 'rgba(11,19,32,0.84)'; f.fill();
    f.lineWidth = 2; f.strokeStyle = rgba(PAL.goldD, 0.7); f.stroke();
    f.fillStyle = PAL.gold;
    rrect(f, x0 + 6, y - 15, x0 + 16, y + 15, 3); f.fill();
    rrect(f, x0 + 25, y - 15, x0 + 35, y + 15, 3); f.fill();
    f.restore();
    letters(f, PAUSE_TXT, { font: 'SM', size, x: x0 + 66 + w / 2, y: y + 1, fill: PAL.cream, alpha: al * 0.92, D: bD(0), seed: 98, amp: 0.25, knock: 0 });
  }
}
function drawTexts(f, t, n) {
  if (!SLOTTED) slotTexts();
  drawSteps(f, t, n);
  drawPicto(f, t, n);
  drawChecks(f, t, n);
  drawCardRows(f, t, n);
  const tS = t, nS = n;
  for (let j = 0; j < T.length; j++) {
    const o = T[j], cap = o.cap;
    let t = o.v ? TV : tS, n = o.v ? NV : nS;   // v-captions run on the video clock (④ insert)
    const exitD = 0.32;
    const t0 = bt(o.n0), t1 = bt(o.n1);
    if (cap) {   // v5: [lands, leaves] in real time (js/cues.js), animated at natural speed
      if (RT < cap[0] - 0.001 || RT > cap[1] + 0.6) continue;
      t = RT < cap[1] ? Math.min(t0 + (RT - cap[0]) / 1.4, t1 - 1e-3) : t1 + (RT - cap[1]) / 1.4;
    } else if (n < o.n0 - 0.001 || n > o.n1 + exitD) continue;
    const font = o.font || 'SB';
    let size = o.size;
    const m = measure(o.s, font, size), maxW = o.q ? 860 : 960;
    if (m.w > maxW) size *= maxW / m.w;
    let tx = o.x ?? 540;
    if (o.q) {   // a question to the viewer: a "？" badge on the left whose ring fills during the think-time hold
      const w = Math.min(m.w, maxW), r = clamp(0.5 * size, 28, 38), gap = 22, tot = 2 * r + gap + w;
      tx = 540 - tot / 2 + 2 * r + gap + w / 2;
      const a = clamp((t - t0) / 0.3) * (1 - clamp((t - t1) / 0.13));
      if (a > 0.003) qBadge(f, 540 - tot / 2 + r, o.y, r, a, cap && CAPS[o.s] ? clamp((RT - cap[0] - 0.3) / (cap[1] - cap[0] - 0.3)) : qRing(o), bD(t));
    }
    let anim, draw;
    if (t >= t1) anim = dropOut(t, t1, 0.13, { dist: 22, st: 0.008 });
    else if (o.ent === 'slam') anim = slamIn(t, t0, 0.3, { big: o.big ?? 1.3 });   // v3 calm: a gentle landing
    else if (o.ent === 'draw') { draw = clamp((t - t0) / 0.75); anim = null; }
    else anim = popIn(t, t0, o.st ?? 0.035, 0.24, { rot: 0.14 });
    letters(f, o.s, { font, size, x: tx, y: o.y, fill: o.fill ?? PAL.cream, hl: o.hl ?? PAL.gold, anim, draw, D: bD(t), seed: j + 1, amp: font === 'WK' ? 0.9 : 0.45 });
  }
  drawPauseHint(f, nS);
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
function bloomAt(n) { return 0.9 + 0.3 * pulse(CU(CUE.slam), 0, 0.06, 1.2) + 0.35 * pulse(S.cuN('slam32'), 0, 0.06, 1.4) + 0.1 * pulse(S.cuN('a48'), 0, 0.06, 1) + 0.3 * pulse(S.cuN('slam124'), 0, 0.06, 1.2) + 0.55 * pulse(S.cuN('slam140'), 0, 0.06, 2) + 0.2 * pulse(S.cuN('slam184'), 0, 0.06, 1) + 0.3 * pulse(S.cuN('slam208'), 0, 0.06, 1.2) + 0.55 * pulse(S.cuN('slam256'), 0, 0.06, 2); }
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
function post(t, n, tv) {
  c.save(); c.setTransform(dpr, 0, 0, dpr, 0, 0);
  // flashes
  const fl = 0.02 * pulse(CU(CUE.slam), 0, 0.04, 0.5) + 0.05 * pulse(S.cuN('slam32'), 0, 0.04, 0.6) + 0.015 * pulse(S.cuN('a48'), 0, 0.04, 0.5) + 0.04 * pulse(S.cuN('slam124'), 0, 0.04, 0.5) + 0.14 * pulse(S.cuN('slam140'), 0, 0.04, 0.9) + 0.03 * pulse(S.cuN('slam184'), 0, 0.04, 0.5) + 0.05 * pulse(S.cuN('slam208'), 0, 0.04, 0.6) + 0.13 * pulse(S.cuN('slam256'), 0, 0.04, 0.9);   // v3 calm: soft glows, no white-outs
  if (fl > 0.003) { c.globalCompositeOperation = 'lighter'; c.globalAlpha = Math.min(1, fl); c.fillStyle = '#FFF1D6'; c.fillRect(0, 0, W, H); }
  // grain (re-rolled every 2 frames)
  const g = bD(t);
  c.globalCompositeOperation = 'overlay'; c.globalAlpha = 0.07;
  const ox = -Math.floor(hs(g, 1) * 384), oy = -Math.floor(hs(g, 2) * 384);
  for (let y = oy; y < H; y += 384) for (let x = ox; x < W; x += 384) c.drawImage(IMG.grain, x, y);
  c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
  c.drawImage(IMG.vig, 0, 0, W, H);
  // fade in / out
  const fo = clamp((tv - (DUR - 0.6)) / 0.55) + (tv < 0.05 ? 1 - tv / 0.05 : 0);
  if (fo > 0) { c.globalAlpha = clamp(fo); c.fillStyle = '#05080F'; c.fillRect(0, 0, W, H); }
  c.restore();
}

// ------------------------------------------------------------------ frame
// v5 layout: the whole picture is scaled by KAP about the top centre so that it ends at y = PIC_H; the score strip
// (tools/strip.py) is composited over the bottom STRIP_H px of the frame afterwards.
export const STRIP_H = 300, PIC_H = H - STRIP_H, KAP = PIC_H / H, KX = (W * (1 - KAP)) / 2;
// v5: after 证毕 the nocturne's coda plays on (≈ 14 s): the figure slowly leans in, then lets go as Act III begins
function codaZoom() {
  const z0 = CUE.qed1 + 0.5, z1 = CUE.b144 - 0.4, z2 = CUE.b144 + 2.6;
  if (RT <= z0 || RT >= z2) return 0;
  return E.io2(clamp((RT - z0) / (z1 - z0))) * (1 - E.io2(clamp((RT - z1) / (z2 - z1))));
}
let TV = 0, NV = 0, RT = 0;   // video time / video beat of the current frame (the story clock t, n stops during the ④ insert)
export function render(tv) {
  const nv = globalThis.__NVFIX ?? S.warpNV(tv), t = S.bt(S.storyN(nv));   // (__NVFIX: tools sample a video beat directly)
  globalThis.__TV = globalThis.__BOILFIX ?? tv;   // real time: the boil keeps breathing during holds
  globalThis.__TVB = S.bt(nv); TV = S.bt(nv); NV = nv; RT = tv; S.setRT(tv);   // video-beat clock (④ insert)
  const st = S.state(t, nv), n = st.n;
  BOIL.seed = bD(t); BOIL.amp = 1.05;
  const sh = shakeAt(t);
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
  drawBG(c, st, sh);
  const f = LY.get(0);
  f.setTransform(dpr * KAP, 0, 0, dpr * KAP, dpr * KX, 0);   // v5: the picture sits above the score strip (scaled about the top centre)
  f.save(); f.translate(sh[0], sh[1]);
  const zc = 0.05 * codaZoom();
  if (zc > 1e-4) { const B = st.bri && st.bri.B, q = B ? st.P([B[0], B[1], 0]) : [540, 900]; f.translate(q[0], q[1]); f.scale(1 + zc, 1 + zc); f.translate(-q[0], -q[1]); }
  drawFigure(f, st, t, n);
  drawImpacts(f, st, t, n);
  drawHand(f, st, t, n);
  f.restore();
  drawTexts(f, t, n);
  composite(f, n);
  post(t, n, tv);
}
