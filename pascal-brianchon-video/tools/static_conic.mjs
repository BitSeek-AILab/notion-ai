// static keyframe quality: best achievable spread for a single conic (e, ax free) — calibrates targets
import * as G from '../js/geo.js';
const F = [655, 978];
const rad = (d) => d * Math.PI / 180;
let seed = +(process.argv[2] || 7); const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const ITER = +(process.argv[3] || 20000), REST = +(process.argv[4] || 20), E = +(process.argv[5] || 1);
const BOX = [80, 450, 925, 1495], PAD = 30;
function evalX(X) {
  const axr = rad(X.ax), A = [];
  for (const d of X.f) { const den = 1 + E * Math.cos(rad(d)); if (den < 0.18) return null; const r = 200 / den; A.push([F[0] + r * Math.cos(axr + rad(d)), F[1] + r * Math.sin(axr + rad(d))]); }
  const pc = G.pascal(A); if (!pc.X.every(Boolean)) return null;
  const pts = [...A, ...pc.X];
  for (let j = 0; j < 24; j++) { const f = -180 + 15 * j, den = 1 + E * Math.cos(rad(f)); if (den < 0.05) continue; if (E >= 0.75 && Math.abs(f) > 60) continue; const r = 200 / den; pts.push([F[0] + r * Math.cos(axr + rad(f)), F[1] + r * Math.sin(axr + rad(f))]); }
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const q of pts) { x0 = Math.min(x0, q[0]); y0 = Math.min(y0, q[1]); x1 = Math.max(x1, q[0]); y1 = Math.max(y1, q[1]); }
  const s = Math.min((BOX[2] - BOX[0] - 2 * PAD) / (x1 - x0), (BOX[3] - BOX[1] - 2 * PAD) / (y1 - y0));
  let dA = 1e9, dX = 1e9, dXA = 1e9;
  for (let i = 0; i < 6; i++) for (let j = i + 1; j < 6; j++) dA = Math.min(dA, s * G.dist(A[i], A[j]));
  for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) dX = Math.min(dX, s * G.dist(pc.X[i], pc.X[j]));
  for (const x of pc.X) for (const q of A) dXA = Math.min(dXA, s * G.dist(x, q));
  const ang = Math.min(...[0, 1, 2].map((q) => G.lineAngle(pc.L[q], pc.L[q + 3]))) * 180 / Math.PI;
  return { s, dA, dX, dXA, ang, sc: Math.min(dA / 120, dX / 180, dXA / 70, ang / 26) };
}
const lim = E > 1 ? Math.acos(-1 / E) * 180 / Math.PI - 8 : E === 1 ? 165 : 180;
function ok(X) { for (let i = 0; i < 5; i++) if (X.f[i + 1] - X.f[i] < 10) return false; if (X.f[5] - X.f[0] > 350) return false; return X.f[0] > -lim && X.f[5] < lim; }
const out = [];
for (let r = 0; r < REST; r++) {
  let X = null, sc = -1;
  for (let t = 0; t < 2000; t++) { const Y = { ax: rnd() * 360, f: Array.from({ length: 6 }, () => -lim + rnd() * 2 * lim).sort((a, b) => a - b) }; if (!ok(Y)) continue; const m = evalX(Y); if (m && m.sc > sc) { X = Y; sc = m.sc; } }
  for (let it = 0; it < ITER; it++) {
    const T = 1 - 0.95 * it / ITER, Y = { ax: X.ax, f: X.f.slice() };
    if (rnd() < 0.15) Y.ax += (rnd() - 0.5) * 40 * T; else Y.f[Math.floor(rnd() * 6)] += (rnd() - 0.5) * 60 * T;
    if (!ok(Y)) continue; const m = evalX(Y); if (m && m.sc >= sc) { X = Y; sc = m.sc; }
  }
  const m = evalX(X); out.push({ sc: +sc.toFixed(3), ax: +X.ax.toFixed(1), f: X.f.map((v) => +v.toFixed(1)), s: +m.s.toFixed(2), dA: Math.round(m.dA), dX: Math.round(m.dX), dXA: Math.round(m.dXA), ang: Math.round(m.ang) });
}
out.sort((a, b) => b.sc - a.sc);
for (const o of out.slice(0, 4)) console.log(JSON.stringify(o));
