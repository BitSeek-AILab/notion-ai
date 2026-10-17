// search six tangent points whose Dandelin figure (Pascal in 3-D) AND Brianchon lift are both compact
import * as G from '../js/geo.js';
const C = { x: 0, y: 0, r: 1 }, D = Math.PI / 180;
let rnd = +(process.argv[2] || 11); const R = () => ((rnd = (rnd * 16807) % 2147483647) / 2147483647);
const LAM = +(process.argv[3] || 1.25);
const best = [];
function dandelin(th, lam) {
  // ruling through A_i: A_i + u (t_i + f_i lam e_z), f_i = (-1)^i
  const A = th.map((a) => [Math.cos(a), Math.sin(a), 0]);
  const T = th.map((a) => [-Math.sin(a), Math.cos(a)]);
  const S = A.map((a, i) => [a, [a[0] + T[i][0], a[1] + T[i][1], (i % 2 ? -1 : 1) * lam]]);
  const P = [0, 1, 2].map((k) => { const m = G.closest3(S[k][0], S[k][1], S[k + 3][0], S[k + 3][1]); const a = th[k + 3] - th[k]; if (Math.abs(Math.cos(a / 2)) < 0.2) m.bad = 1; return m; });
  return { A, S, P };
}
function evalCfg(deg) {
  const th = deg.map((d) => d * D);
  const gaps = deg.map((d, i) => (i < 5 ? deg[i + 1] - d : deg[0] + 360 - d));
  const gmin = Math.min(...gaps), gmax = Math.max(...gaps);
  if (gmin < +(process.env.GMIN || 24) || gmax > +(process.env.GMAX || 120)) return null;
  const A2 = th.map((a) => [Math.cos(a), Math.sin(a)]);
  const pas = G.pascal(A2); if (!pas.X.every(Boolean)) return null;
  const dX = pas.X.map((x) => Math.hypot(x[0], x[1]));
  const sp = Math.min(G.dist(pas.X[0], pas.X[1]), G.dist(pas.X[1], pas.X[2]), G.dist(pas.X[0], pas.X[2]));
  if (sp < 0.7) return null;
  const angs = [0, 1, 2].map((k) => G.lineAngle(pas.L[k], pas.L[k + 3]) / D);
  if (Math.min(...angs) < 16) return null;
  const bri = G.brianchon(C, th);
  const dW = bri.W.map((w) => Math.hypot(w[0], w[1]));
  const dd = dandelin(th, LAM);
  if (dd.P.some((p) => p.bad || p.gap > 1e-6)) return null;
  const dP = dd.P.map((p) => Math.hypot(p[0], p[1])), hP = dd.P.map((p) => p[2]);
  // the triangle must be a real triangle: min side / max side
  const sides = [0, 1, 2].map((k) => G.len3(G.sub3(dd.P[k], dd.P[(k + 1) % 3])));
  const fat = Math.min(...sides) / Math.max(...sides);
  if (fat < 0.3) return null;
  const lineD = Math.abs(G.lineDist(pas.line, [0, 0]));
  const ext = Math.max(...dX, ...dP, ...dW);
  const hmax = Math.max(...hP.map(Math.abs));
  const ext2 = Math.max(...dX, ...dP, ...dW.map((w) => w * +(process.env.WW || 1))); const score = -ext2 - 0.25 * hmax + gmin / 60 * 0.4 + fat * 0.3;
  return { deg, gaps, gmin, dX, dP, hP, dW, sp, angs, fat, lineD, ext, hmax, score, B: bri.B };
}
for (let it = 0; it < 600000; it++) {
  const g = Array.from({ length: 6 }, () => 0.15 + R()); const s = g.reduce((a, b) => a + b, 0);
  const gaps = g.map((x) => (x * 360) / s);
  const start = R() * 360;
  const deg = [start]; for (let i = 0; i < 5; i++) deg.push(deg[i] + gaps[i]);
  const e = evalCfg(deg.map((d) => Math.round(d * 10) / 10));
  if (e) { best.push(e); best.sort((a, b) => b.score - a.score); best.length = Math.min(best.length, 10); }
}
const f = (a, d = 2) => a.map((x) => x.toFixed(d)).join(',');
for (const e of best) console.log(f(e.deg, 1), '| gaps', f(e.gaps, 0), '| ext', e.ext.toFixed(2), 'hmax', e.hmax.toFixed(2), 'dX', f(e.dX), 'dP', f(e.dP), 'hP', f(e.hP), 'dW', f(e.dW), 'sp', e.sp.toFixed(2), 'opp', f(e.angs, 0), 'fat', e.fat.toFixed(2), 'lineD', e.lineD.toFixed(2), 'B', f(e.B));
