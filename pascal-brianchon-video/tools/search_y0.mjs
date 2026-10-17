// one config for the Brianchon lift (Act II) AND Dandelin's Pascal proof (Act IV) on the same six lifted sides.
// R = 1, λ = LAM, heights relative to the waist plane. Wants: every opposite-side meeting P_k reasonably close,
// every Pascal crossing X_k close, the circumscribed hexagon not too lopsided, and nothing far below the waist.
import * as G from '../js/geo.js';
const D = Math.PI / 180, C1 = { x: 0, y: 0, r: 1 };
let rnd = +(process.argv[2] || 3); const R = () => ((rnd = (rnd * 16807) % 2147483647) / 2147483647);
const LAM = +(process.argv[3] || 1), ZMIN = +(process.argv[4] || -1.0), GMIN = +(process.argv[5] || 24);
const best = [];
const gapsOf = (deg) => deg.map((d, i) => (i < 5 ? deg[i + 1] - d : deg[0] + 360 - d));
export function evalCfg(deg, lam = LAM) {
  const g = gapsOf(deg); if (Math.min(...g) < GMIN || Math.max(...g) > 128) return null;
  const th = deg.map((d) => d * D);
  const lf = G.lift(C1, th, lam), V = lf.V, Q = lf.Q;
  const bri = G.brianchon(C1, th), dW = bri.W.map((w) => Math.hypot(w[0], w[1]));
  const S = th.map((a, i) => { const A = [Math.cos(a), Math.sin(a), 0], t = [-Math.sin(a), Math.cos(a)]; const s = i % 2 === 0 ? 1 : -1; return [A, [A[0] + t[0], A[1] + t[1], s * lam]]; });
  // sanity: S_i must contain V_{i-1} and V_i
  const P = [0, 1, 2].map((k) => G.closest3(S[k][0], S[k][1], S[k + 3][0], S[k + 3][1]));
  if (P.some((p) => p.gap > 1e-6 || Math.hypot(p[0], p[1]) > 4.6)) return null;
  const A2 = th.map((a) => [Math.cos(a), Math.sin(a)]);
  const pas = G.pascal(A2); if (!pas.X.every(Boolean)) return null;
  const dX = pas.X.map((x) => Math.hypot(x[0], x[1]));
  const angs = [0, 1, 2].map((k) => G.lineAngle(pas.L[k], pas.L[k + 3]) / D);
  if (Math.min(...angs) < 16) return null;
  const sp = Math.min(G.dist(pas.X[0], pas.X[1]), G.dist(pas.X[1], pas.X[2]), G.dist(pas.X[0], pas.X[2]));
  if (sp < 0.8) return null;
  const zs = [...V.map((v) => v[2]), ...P.map((p) => p[2]), Q[2]];
  let zmin = Math.min(...zs), zmax = Math.max(...zs), flip = 1;
  if (-zmax > zmin) { const a = zmin; zmin = -zmax; zmax = -a; flip = -1; }   // mirrored lift (LSIGN = -1)
  if (zmin < ZMIN) return null;
  const dP = P.map((p) => Math.hypot(p[0], p[1]));
  const sides = [0, 1, 2].map((k) => G.len3(G.sub3(P[k], P[(k + 1) % 3])));
  const fat = Math.min(...sides) / Math.max(...sides);
  if (fat < 0.3) return null;
  const pts2 = [...pas.X, ...P.map((p) => [p[0], p[1]]), ...bri.W]; for (let k = 0; k < 12; k++) pts2.push([Math.cos(k * 30 * D), Math.sin(k * 30 * D)]);
  let diam = 0; for (const a of pts2) for (const b of pts2) diam = Math.max(diam, G.dist(a, b));
  const WW = +(process.env.WW || 1.3); const ext = process.env.DIAM ? diam / 2 + 0.3 * Math.max(...dW) : Math.max(...dX, ...dP, ...dW.map((w) => WW * w));
  const score = -ext - +(process.env.ZW || 0.35) * (zmax - zmin) + Math.min(...g) / 60 * 0.5 + Math.min(...angs) / 60 * 0.3 + 0.2 * fat;
  return { diam, flip, deg, g, dW, dP, P, dX, angs, sp, zmin, zmax, ext, fat, score, Q, B: bri.B, chk: [0, 1, 2, 3, 4, 5].map((i) => Math.max(G.off3(S[i][0], S[i][1], V[(i + 5) % 6]), G.off3(S[i][0], S[i][1], V[i]))) };
}
if (process.argv[1].endsWith('search_y0.mjs')) {
  for (let it = 0; it < 500000; it++) {
    const gg = Array.from({ length: 6 }, () => 0.2 + R()); const s = gg.reduce((a, b) => a + b, 0);
    const deg = [R() * 360]; for (let i = 0; i < 5; i++) deg.push(deg[i] + (gg[i] * 360) / s);
    const e = evalCfg(deg.map((d) => Math.round(d * 10) / 10));
    if (e) { best.push(e); best.sort((a, b) => b.score - a.score); best.length = Math.min(best.length, 6); }
  }
  const f = (a, d = 2) => a.map((x) => x.toFixed(d)).join(',');
  for (const e of best) console.log(e.flip, f(e.deg, 1), '| g', f(e.g, 0), '| ext', e.ext.toFixed(2), 'diam', e.diam.toFixed(2), 'z', e.zmin.toFixed(2), e.zmax.toFixed(2), 'dW', f(e.dW), 'dP', f(e.dP), 'hP', f(e.P.map((p) => p[2])), 'Q', f(e.Q), 'dX', f(e.dX), 'opp', f(e.angs, 0), 'sp', e.sp.toFixed(2), 'fat', e.fat.toFixed(2), 'chk', Math.max(...e.chk).toExponential(1));
}
