import * as G from '../js/geo.js';
const C = { x: 655, y: 978, r: 222 };
const deg = [148.1, 184.9, 221.2, 266.0, 363.0, 462.6];
const th = deg.map((d) => d * Math.PI / 180);
const P = th.map((t) => G.onC(C, t));
const pc = G.pascal(P);
console.log('Pascal X', pc.X.map((x) => x.map((v) => v.toFixed(1))), 'resid', pc.resid.toExponential(2));
const br = G.brianchon(C, th);
console.log('Brianchon B', br.B.map((v) => v.toFixed(2)), 'resid', br.resid.toExponential(2));
const pol = G.pole(C, pc.line);
console.log('pole of Pascal line', pol.map((v) => v.toFixed(2)), ' |B - pole| =', G.dist(pol, br.B).toExponential(2));
for (const lam of [0.2, 0.6, 1.0]) {
  const L = G.lift(C, th, lam);
  const g = [G.off3(L.V[0], L.V[3], L.Q), G.off3(L.V[1], L.V[4], L.Q), G.off3(L.V[2], L.V[5], L.Q)];
  // tilted side i passes through tangent point A_i at height 0 : side between V[i-1] and V[i]
  let sideErr = 0;
  for (let i = 0; i < 6; i++) {
    const a = L.V[(i + 5) % 6], b = L.V[i], A = G.onC(C, th[i]);
    sideErr = Math.max(sideErr, G.off3(a, b, [A[0], A[1], 0]));
  }
  console.log('lift', lam, 'Q3', L.Q.map((v) => v.toFixed(2)), 'diag offsets', g.map((v) => v.toExponential(1)), 'sides through tangent pts err', sideErr.toExponential(1), 'heights', L.h.map((v) => v.toFixed(0)));
}
