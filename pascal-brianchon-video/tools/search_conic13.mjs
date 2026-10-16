// conic scene search v13: like v12, but a crossing may pass through infinity during a morph (soft penalty FLIP); the
// camera (and this metric) fade far crossings out of the framing box exactly like scene.js fitRaw; holds = rich metrics
import * as G from '../js/geo.js';
import fs from 'fs';
const F = [655, 978], R = 222;
const P1 = [148.1, 168.9, 221.2, 242.0, 363.0, 462.6];
const P0 = [148.1, 184.9, 221.2, 266.0, 363.0, 462.6];
const rad = (d) => d * Math.PI / 180;
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const io2 = (u) => (u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2);
const io3 = (u) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
let seed = +(process.argv[2] || 7); const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const ITER = +(process.argv[3] || 20000), RESTARTS = +(process.argv[4] || 4);
const FLIP = +(process.env.FLIP || 3);
const TL = { s1a: 8.0, s1b: 8.6, h1: 9.1, s2b: 9.6, h2: 10.15, s3b: 10.65, h3: 11.25 };
const BOX = [80, 450, 925, 1495], PAD = 30, SMAX = 1.3;
const win = (u, w) => io2(clamp((u - w[0]) / (w[1] - w[0])));
function stages(X) {
  return [
    { e: 0, p: R, ax: X.ax1, th: X.P1u },
    { e: X.e1, p: X.p1, ax: X.ax1, th: X.f1.map((v) => v + X.ax1) },
    { e: 1, p: X.p2, ax: X.ax2, th: X.f2.map((v) => v + X.ax2) },
    { e: X.e3, p: X.p3, ax: X.ax3, th: X.f3.map((v) => v + X.ax3) },
    { e: 0, p: R, ax: X.ax3, th: X.P0u }];
}
function stageAt(n, X, S) {
  const mix = (a, b, ue, ua) => ({ e: a.e + (b.e - a.e) * ue, p: a.p + (b.p - a.p) * ue, ax: a.ax + (b.ax - a.ax) * ua, th: a.th.map((v, i) => v + (b.th[i] - v) * ua) });
  const T = TL;
  if (n <= T.s1a) return S[0];
  if (n <= T.s1b) { const u = (n - T.s1a) / (T.s1b - T.s1a); return mix(S[0], S[1], io3(u), win(u, X.w1)); }
  if (n <= T.h1) return S[1];
  if (n <= T.s2b) { const u = (n - T.h1) / (T.s2b - T.h1); return mix(S[1], S[2], io3(u), win(u, X.w2)); }
  if (n <= T.h2) return S[2];
  if (n <= T.s3b) { const u = (n - T.h2) / (T.s3b - T.h2); return mix(S[2], S[3], io3(u), win(u, X.w3)); }
  if (n <= T.h3) return S[3];
  return mix(S[3], S[4], io2(clamp((n - T.h3) / (X.eB - T.h3))), io2(clamp((n - X.aA) / (X.aB - X.aA))));
}
const ptOf = (st, d) => { const ph = rad(d - st.ax), den = 1 + st.e * Math.cos(ph); if (den < 0.18) return null; const r = st.p / den; return [F[0] + r * Math.cos(rad(d)), F[1] + r * Math.sin(rad(d))]; };
const ssm = (a, b, x) => { const u = clamp((x - a) / (b - a)); return u * u * (3 - 2 * u); };
const xFall = (x) => 1 - ssm(700, 1400, G.dist(F, x));
function geo(st, farV, path) {
  const A = []; for (const d of st.th) { const q = ptOf(st, d); if (!q) return null; A.push(q); }
  const L = []; for (let i = 0; i < 6; i++) L.push(G.lineThrough(A[i], A[(i + 1) % 6]));
  const W = [0, 1, 2].map((k) => G.cross3(L[k], L[k + 3]));
  const Xs = W.map((p) => (Math.abs(p[2]) > 1e-9 ? [p[0] / p[2], p[1] / p[2]] : null));
  if (!Xs.every(Boolean)) return null;
  const pts = [...A, ...(path ? Xs.map((x) => G.lerp2(F, x, xFall(x))) : Xs)];
  const e = st.e, axr = rad(st.ax), wFar = e < 0.62 ? 1 : e < 0.8 ? 1 - (e - 0.62) / 0.18 : 0;
  for (let j = 0; j < 24; j++) {
    const f = -180 + 15 * j, den = 1 + e * Math.cos(rad(f)); if (den < 0.05) continue;
    const near = Math.abs(f) <= 60; if (!near && wFar <= 0) continue;
    const r = st.p / den, q = [F[0] + r * Math.cos(axr + rad(f)), F[1] + r * Math.sin(axr + rad(f))];
    pts.push(near ? q : G.lerp2(F, q, wFar));
  }
  if (farV && e > 1.05) { const r = st.p / (1 - e); pts.push([F[0] + r * Math.cos(axr), F[1] + r * Math.sin(axr)]); }
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const q of pts) { x0 = Math.min(x0, q[0]); y0 = Math.min(y0, q[1]); x1 = Math.max(x1, q[0]); y1 = Math.max(y1, q[1]); }
  const s = Math.min(SMAX, (BOX[2] - BOX[0] - 2 * PAD) / (x1 - x0), (BOX[3] - BOX[1] - 2 * PAD) / (y1 - y0));
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  let dA = 1e9, dX = 1e9, dXA = 1e9;
  for (let i = 0; i < 6; i++) for (let j = i + 1; j < 6; j++) dA = Math.min(dA, s * G.dist(A[i], A[j]));
  const XN = path ? Xs.filter((x) => xFall(x) > 0.5) : Xs;
  for (let i = 0; i < XN.length; i++) for (let j = i + 1; j < XN.length; j++) dX = Math.min(dX, s * G.dist(XN[i], XN[j]));
  for (const x of XN) for (const q of A) dXA = Math.min(dXA, s * G.dist(x, q));
  const ang = Math.min(...[0, 1, 2].map((q) => G.lineAngle(L[q], L[q + 3]))) * 180 / Math.PI;
  return { A, L, W, Xs, s, cx, cy, dA, dX, dXA, ang };
}
// rich composition metrics of a static keyframe
function rich(st, g) {
  // Pascal line through the two farthest crossings
  let ia = 0, ib = 1, bd = -1; for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) { const d = G.dist(g.Xs[i], g.Xs[j]); if (d > bd) { bd = d; ia = i; ib = j; } }
  const pl = G.lineThrough(g.Xs[ia], g.Xs[ib]);
  let dL = 1e9; for (const q of g.A) dL = Math.min(dL, g.s * Math.abs(G.lineDist(pl, q)));
  // visible conic samples (screen)
  const sx = (BOX[0] + BOX[2]) / 2, sy = (BOX[1] + BOX[3]) / 2;
  const scr = (q) => [sx + (q[0] - g.cx) * g.s, sy + (q[1] - g.cy) * g.s];
  const vis = [];
  for (let j = 0; j <= 240; j++) {
    const f = -180 + 1.5 * j, den = 1 + st.e * Math.cos(rad(f)); if (den < 0.02) { vis.push(null); continue; }
    const r = st.p / den, q = scr([F[0] + r * Math.cos(rad(st.ax + f)), F[1] + r * Math.sin(rad(st.ax + f))]);
    vis.push(q[0] > 0 && q[0] < 1080 && q[1] > 380 && q[1] < 1560 ? q : null);
  }
  const plS = G.lineThrough(scr(g.Xs[ia]), scr(g.Xs[ib]));
  let dLC = 1e9, prev = null, prevD = 0;
  for (const q of vis) {
    if (!q) { prev = null; continue; }
    const d = G.lineDist(plS, q);
    if (prev && Math.sign(d) !== Math.sign(prevD)) { // crossing: angle between the chord and the line
      const ch = G.lineThrough(prev, q); dLC = Math.min(dLC, 70 * (G.lineAngle(ch, plS) * 180 / Math.PI) / 35);
    } else dLC = Math.min(dLC, Math.abs(d));
    prev = q; prevD = d;
  }
  let dXC = 1e9; for (const x of g.Xs) { const xs = scr(x); for (const q of vis) if (q) dXC = Math.min(dXC, G.dist(xs, q)); }
  return { dL, dLC, dXC };
}
const hinge = (m, t) => { const d = Math.max(0, 1 - m / t); return d * d; };
function penalty(X, report) {
  const S = stages(X);
  let P = 0;
  const nEnd = Math.max(X.aB, X.eB) + 0.05;
  let sg = null, bp = 9, nFlip = 0;
  for (let n = 8.0; n <= nEnd; n += 0.025) {
    const st = stageAt(n, X, S);
    const g = geo(st, n > 10.4 && n < 11.4, true);
    if (!g) { if (st.th.some((d) => 1 + st.e * Math.cos(rad(d - st.ax)) < 0.18)) { P += 1000; bp = 0; } continue; }
    const sgn = g.W.map((w) => Math.sign(w[2]));
    if (sg && sgn.some((v, i) => v !== sg[i])) { P += FLIP; nFlip++; }    // a crossing went through infinity (allowed, soft)
    sg = sgn;
    if (Math.round(n / 0.025) % 2 === 0) {
      P += 2 * (hinge(g.dA, 55) + hinge(g.dX, 80) + hinge(g.dXA, 30) + hinge(g.ang, 13) + 2 * hinge(g.s, 0.85));
      bp = Math.min(bp, g.dA / 55, g.dX / 80, g.dXA / 30, g.ang / 13, g.s / 0.85);
    }
  }
  let bh = 9; const rows = [];
  for (const [k, far] of [[1, false], [2, false], [3, true]]) {
    const st = S[k], g = geo(st, far); if (!g) { P += 5000; bh = 0; continue; }
    const r = rich(st, g);
    const h = [g.dA / 135, g.dX / 190, g.dXA / 75, g.ang / 26, g.s / 0.9, r.dL / 60, r.dLC / 70, r.dXC / 45];
    P += 25 * h.reduce((a, v) => a + hinge(v, 1), 0);
    if (k >= 2) { const rel = st.th.map((d) => d - st.ax); const nNeg = rel.filter((v) => v < -25).length, nPos = rel.filter((v) => v > 25).length; P += 25 * (hinge(Math.min(nNeg, nPos), 2) + hinge(g.s * st.p, 190)); h.push(Math.min(nNeg, nPos) / 2, g.s * st.p / 190); }
    P += 3 * (1 - Math.abs(Math.sin(rad(st.ax))));   // portrait frame: prefer a vertical axis
    bh = Math.min(bh, ...h);
    if (report) rows.push(`S${k} e${st.e.toFixed(2)} ax${st.ax.toFixed(0)} s${g.s.toFixed(2)} dA${g.dA.toFixed(0)} dX${g.dX.toFixed(0)} dXA${g.dXA.toFixed(0)} a${g.ang.toFixed(0)} dL${r.dL.toFixed(0)} dLC${r.dLC.toFixed(0)} dXC${r.dXC.toFixed(0)}`);
  }
  if (report) return { bp, bh, rows: [...rows, 'flips ' + nFlip] };
  return P;
}
function unwrapTo(src, ref) { const ms = src.reduce((a, b) => a + b) / 6, mr = ref.reduce((a, b) => a + b) / 6; const k = Math.round((mr - ms) / 360); return src.map((v) => v + 360 * k); }
function okOrder(f, e) {
  for (let i = 0; i < 5; i++) if (f[i + 1] - f[i] < 14) return false;
  if (f[5] - f[0] > 360 - 14) return false;
  if (e >= 1) { const lim = e > 1 ? Math.acos(-1 / e) * 180 / Math.PI - 8 : 170; if (f[0] < -lim || f[5] > lim) return false; }
  return true;
}
function finalize(X) {
  X.ax2 = X.ax1 + (((X.ax2 - X.ax1 + 180) % 360 + 360) % 360 - 180); X.ax3 = X.ax2 + (((X.ax3 - X.ax2 + 180) % 360 + 360) % 360 - 180);
  X.P1u = unwrapTo(P1, X.f1.map((v) => v + X.ax1)); X.P0u = unwrapTo(P0, X.f3.map((v) => v + X.ax3)); return X;
}
function valid(X) {
  return okOrder(X.f1, X.e1) && okOrder(X.f2, 1) && okOrder(X.f3, X.e3) && X.e1 > 0.5 && X.e1 < 0.85 && X.e3 > 1.6 && X.e3 < 3.0 && X.p1 > 100 && X.p2 > 80 && X.p3 > 80 &&
    Math.abs(X.ax2 - X.ax1) <= 90 && Math.abs(X.ax3 - X.ax2) <= 60 &&
    [X.w1, X.w2, X.w3].every((w) => w[0] >= 0 && w[1] <= 1 && w[1] - w[0] >= 0.35) && X.eB >= 11.5 && X.eB <= 12.1 && X.aA >= 11.25 && X.aA <= 11.9 && X.aB >= 11.9 && X.aB <= 12.45 && X.aB - X.aA >= 0.4;
}
function randX() {
  const ax = rnd() * 360, sorted = (lo, hi) => Array.from({ length: 6 }, () => lo + rnd() * (hi - lo)).sort((p, q) => p - q);
  const e3 = 1.6 + rnd() * 1.2, lim3 = Math.acos(-1 / e3) * 180 / Math.PI - 10;
  return finalize({ ax1: ax, ax2: ax + (rnd() - 0.5) * 120, ax3: ax + (rnd() - 0.5) * 120, e1: 0.55 + rnd() * 0.25, p1: R * (0.7 + rnd() * 0.4), f1: sorted(-175, 175), p2: R * (0.5 + rnd() * 0.6), f2: sorted(-150, 150),
    e3, p3: R * (0.5 + rnd() * 0.9), f3: sorted(-lim3, lim3), w1: [0, 0.5 + 0.5 * rnd()], w2: [0, 0.5 + 0.5 * rnd()], w3: [0, 0.5 + 0.5 * rnd()], eB: 11.75, aA: 11.45, aB: 12.1 });
}
const WARM = process.env.WARM ? JSON.parse(fs.readFileSync(process.env.WARM, 'utf8').split('\n')[0].replace(/^[0-9.\-]+ /, '')) : null;
function mutate(X, T) {
  const Y = JSON.parse(JSON.stringify(X));
  const k = Math.floor(rnd() * 9), g = () => (rnd() - 0.5) * 2 * T;
  if (k === 0) { const w = ['ax1', 'ax2', 'ax3'][Math.floor(rnd() * 3)]; Y[w] += g() * 25; }
  else if (k === 1) { Y.e1 += g() * 0.1; Y.p1 += g() * 40; }
  else if (k === 2) { Y.p2 += g() * 40; }
  else if (k === 3) { Y.e3 += g() * 0.4; Y.p3 += g() * 40; }
  else if (k <= 6) { const f = Y[['f1', 'f2', 'f3'][k - 4]]; f[Math.floor(rnd() * 6)] += g() * 30; }
  else if (k === 7) { if (rnd() < 0.5) { const w = Y[['w1', 'w2', 'w3'][Math.floor(rnd() * 3)]]; w[Math.floor(rnd() * 2)] += g() * 0.2; } else { const w = ['eB', 'aA', 'aB'][Math.floor(rnd() * 3)]; Y[w] += g() * 0.2; } }
  else { const d = g() * 25; const w = ['f1', 'f2', 'f3'][Math.floor(rnd() * 3)]; Y[w] = Y[w].map((v) => v + d); }
  return finalize(Y);
}
const best = [];
for (let r = 0; r < RESTARTS; r++) {
  let X = null, sc = -1e18;
  for (let t = 0; t < 3000; t++) { const Y = t === 0 && WARM && r % 2 === 0 ? finalize(JSON.parse(JSON.stringify(WARM))) : randX(); if (!valid(Y)) continue; const s = -penalty(Y); if (s > sc) { X = Y; sc = s; } }
  if (!X) continue;
  for (let it = 0; it < ITER; it++) { const Y = mutate(X, 1 - 0.9 * it / ITER); if (!valid(Y)) continue; const s = -penalty(Y); if (s >= sc) { X = Y; sc = s; } }
  const rep = penalty(X, true);
  best.push({ sc, X, rep }); console.error('restart', r, sc.toFixed(2), 'path', rep.bp.toFixed(2), 'hold', rep.bh.toFixed(2));
}
best.sort((a, b) => b.sc - a.sc);
const rd = (v) => (Array.isArray(v) ? v.map((x) => +x.toFixed(1)) : typeof v === 'number' ? +v.toFixed(3) : v);
for (const b of best) { const o = {}; for (const k of Object.keys(b.X)) o[k] = rd(b.X[k]); console.log(b.sc.toFixed(2) + ' ' + JSON.stringify(o)); console.log('# path ' + b.rep.bp.toFixed(2) + ' hold ' + b.rep.bh.toFixed(2) + ' | ' + b.rep.rows.join(' | ')); }
