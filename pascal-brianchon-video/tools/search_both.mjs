// one set of six rulings for BOTH proofs: waist tangent points th (Brianchon lift, Act II) and a horizontal section at
// height c = λR·tanδ whose six points φ_i = th_i + f_i·δ carry a nice Pascal hexagon (Dandelin, Act IV)
import * as G from '../js/geo.js';
const D = Math.PI / 180, C1 = { x: 0, y: 0, r: 1 };
let rnd = +(process.argv[2] || 3); const R = () => ((rnd = (rnd * 16807) % 2147483647) / 2147483647);
const LAM = +(process.argv[3] || 1.25), F0 = +(process.argv[4] || 1);
const best = [];
const gapsOf = (deg) => deg.map((d, i) => (i < 5 ? deg[i + 1] - d : deg[0] + 360 - d));
function evalCfg(deg, del) {
  const g = gapsOf(deg); if (Math.min(...g) < 22 || Math.max(...g) > 125) return null;
  const th = deg.map((d) => d * D);
  const bri = G.brianchon(C1, th), dW = bri.W.map((w) => Math.hypot(w[0], w[1]));
  // P_k: tangent meet of waist angles k, k+3
  const P = [0, 1, 2].map((k) => { const b = deg[k + 3] - deg[k]; const c = Math.cos(b * D / 2); return { d: 1 / Math.abs(c), h: (k % 2 ? -F0 : F0) * LAM * Math.tan(b * D / 2) }; });
  if (P.some((p) => p.d > 4)) return null;
  const phi = deg.map((d, i) => d + (i % 2 ? -F0 : F0) * del);
  const gs = gapsOf(phi); if (Math.min(...gs) < 26) return null;
  const rc = 1 / Math.cos(del * D);
  const A = phi.map((p) => [rc * Math.cos(p * D), rc * Math.sin(p * D)]);
  const pas = G.pascal(A); if (!pas.X.every(Boolean)) return null;
  const dX = pas.X.map((x) => Math.hypot(x[0], x[1]));
  const angs = [0, 1, 2].map((k) => G.lineAngle(pas.L[k], pas.L[k + 3]) / D);
  if (Math.min(...angs) < 18) return null;
  const sp = Math.min(G.dist(pas.X[0], pas.X[1]), G.dist(pas.X[1], pas.X[2]), G.dist(pas.X[0], pas.X[2]));
  if (sp < 0.8) return null;
  const hc = LAM * Math.tan(del * D);           // section height (R units, relative to the waist)
  const hV = deg.map((d, i) => (i % 2 ? -F0 : F0) * LAM * Math.tan(g[i] * D / 2));
  const ext = Math.max(...dX, ...P.map((p) => p.d), ...dW.map((w) => 1.3 * w));
  const hmax = Math.max(...P.map((p) => Math.abs(p.h - hc)));
  const score = -ext - 0.2 * hmax + Math.min(...gs) / 60 * 0.6 + Math.min(...g) / 60 * 0.3 + Math.min(...angs) / 60 * 0.3;
  return { deg, del, g, gs, phi, dW, P, dX, angs, sp, hc, hV, ext, hmax, score, B: bri.B };
}
for (let it = 0; it < 500000; it++) {
  const gg = Array.from({ length: 6 }, () => 0.2 + R()); const s = gg.reduce((a, b) => a + b, 0);
  const deg = [R() * 360]; for (let i = 0; i < 5; i++) deg.push(deg[i] + (gg[i] * 360) / s);
  const del = -45 + 90 * R();
  const e = evalCfg(deg.map((d) => Math.round(d * 10) / 10), Math.round(del * 10) / 10);
  if (e) { best.push(e); best.sort((a, b) => b.score - a.score); best.length = Math.min(best.length, 6); }
}
const f = (a, d = 2) => a.map((x) => x.toFixed(d)).join(',');
for (const e of best) console.log(f(e.deg, 1), 'δ', e.del, '| g', f(e.g, 0), 'gs', f(e.gs, 0), '| ext', e.ext.toFixed(2), 'dW', f(e.dW), 'dP', f(e.P.map((p) => p.d)), 'hP', f(e.P.map((p) => p.h)), 'hc', e.hc.toFixed(2), 'dX', f(e.dX), 'opp', f(e.angs, 0), 'sp', e.sp.toFixed(2), 'hV', f(e.hV), 'B', f(e.B));
