// search a home configuration whose Pascal figure AND circumscribed hexagon both read clearly
import * as G from '../js/geo.js';
const C = { x: 0, y: 0, r: 1 }, D = Math.PI / 180;
let rnd = 7; const R = () => ((rnd = (rnd * 16807) % 2147483647) / 2147483647);
const best = [];
function evalCfg(deg) {
  const th = deg.map((d) => d * D);
  const gaps = deg.map((d, i) => (i < 5 ? deg[i + 1] - d : deg[0] + 360 - d));
  const gmin = Math.min(...gaps), gmax = Math.max(...gaps);
  if (gmin < 38 || gmax > 115) return null;
  const A = th.map((a) => [Math.cos(a), Math.sin(a)]);
  const pas = G.pascal(A); if (!pas.X.every(Boolean)) return null;
  const dX = pas.X.map((x) => Math.hypot(x[0], x[1]));
  if (Math.max(...dX) > 3.3) return null;
  const sp = Math.min(G.dist(pas.X[0], pas.X[1]), G.dist(pas.X[1], pas.X[2]), G.dist(pas.X[0], pas.X[2]));
  if (sp < 0.9) return null;
  const angs = [0, 1, 2].map((k) => G.lineAngle(pas.L[k], pas.L[k + 3]) / D);
  if (Math.min(...angs) < 24) return null;
  const lineD = Math.abs(G.lineDist(pas.line, [0, 0]));
  if (lineD < 1.25) return null;                       // Pascal line clearly outside the circle
  const bri = G.brianchon(C, th);
  const dg = [0, 1, 2].map((k) => G.lineAngle(bri.D[k], bri.D[(k + 1) % 3]) / D);
  if (Math.min(...dg) < 28) return null;
  // framing: circle + X + W in a 930 x 1100 box
  const pts = [...pas.X, ...bri.W];
  for (let k = 0; k < 24; k++) pts.push([Math.cos(k * 15 * D), Math.sin(k * 15 * D)]);
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const w = Math.max(...xs) - Math.min(...xs), h = Math.max(...ys) - Math.min(...ys);
  const sc = Math.min(900 / w, 1045 / h) / 222;        // scale relative to r=222
  const score = sc * 1.0 + gmin / 60 * 0.6 + Math.min(...dg) / 60 * 0.3;
  return { deg, gaps, gmin, gmax, dX, sp, angs, lineD, dg, sc, score };
}
for (let it = 0; it < 400000; it++) {
  const g = Array.from({ length: 6 }, () => 38 + R() * 80); const s = g.reduce((a, b) => a + b, 0);
  const gaps = g.map((x) => (x * 360) / s);
  const start = R() * 360;
  const deg = [start]; for (let i = 0; i < 5; i++) deg.push(deg[i] + gaps[i]);
  const e = evalCfg(deg.map((d) => Math.round(d * 10) / 10));
  if (e) { best.push(e); best.sort((a, b) => b.score - a.score); best.length = Math.min(best.length, 8); }
}
for (const e of best) console.log(e.deg.map((d) => d.toFixed(1)).join(','), '| gaps', e.gaps.map((x) => x.toFixed(0)).join(','), '| sc', e.sc.toFixed(2), 'dX', e.dX.map((x) => x.toFixed(2)).join(','), 'sp', e.sp.toFixed(2), 'oppAng', e.angs.map((x) => x.toFixed(0)).join(','), 'lineD', e.lineD.toFixed(2), 'diagAng', e.dg.map((x) => x.toFixed(0)).join(','));
// reference: P0
const P0 = [148.1, 184.9, 221.2, 266.0, 363.0, 462.6];
console.log('P0 gaps', P0.map((d, i) => (i < 5 ? P0[i + 1] - d : P0[0] + 360 - d).toFixed(0)).join(','));
