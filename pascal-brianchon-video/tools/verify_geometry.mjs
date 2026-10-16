// Exactness audit over EVERY frame of the film (pure geometry, no rendering): node tools/verify_geometry.mjs
//  · Pascal: the three opposite-side crossings of the inscribed hexagon are collinear (circle, ellipse, parabola, hyperbola)
//  · Brianchon: the three diagonals of the circumscribed hexagon are concurrent; B is the pole of the Pascal line
//  · 3-D lift: every lifted vertex and every tilted side lies on the hyperboloid x²+y²−z²/λ² = R²; each tilted side still
//    passes through its tangent point; the three space diagonals pass through one point Q; Q's shadow (straight down) is B
import * as S from '../js/scene.js';
import * as G from '../js/geo.js';
const worst = {};
const upd = (k, v, t) => { if (!(k in worst) || v > worst[k][0]) worst[k] = [v, t]; };
let nF = 0, nLift = 0;
for (let f = 0; f <= Math.round(S.DUR * S.FPS); f++) {
  const t = f / S.FPS, n = S.state(t).n, g = S.geomAt(n), C = g.C, R = C.r;
  nF++;
  if (g.pas.X.every(Boolean)) {
    const sz = Math.max(...g.pas.X.map((x) => G.dist(x, [C.x, C.y])), R);
    if (sz < 1e6) upd('Pascal collinearity (relative)', g.pas.resid / sz, t);
  }
  if (g.bri.B) {
    upd('Brianchon concurrency (relative)', g.bri.resid / R, t);
    for (let i = 0; i < 6; i++) {           // circumscribed: every side is tangent to the circle
      const l = G.lineThrough(g.bri.W[i], g.bri.W[(i + 1) % 6]);
      upd('hexagon sides tangent |d−R|/R', Math.abs(Math.abs(G.lineDist(l, [C.x, C.y])) - R) / R, t);
    }
    if (g.con.e === 0 && g.pas.line) { const p = G.pole(C, G.pascal(g.th.map((a) => G.onC(C, a))).line); if (p) upd('B = pole of Pascal line (relative)', G.dist(p, g.bri.B) / R, t); }
  }
  if (g.lam > 1e-3) {
    nLift++;
    const lam = Math.abs(g.lam), V = g.lift.V.map((v) => [v[0] - C.x, v[1] - C.y, v[2] - g.h0]), Q = g.lift.Q;
    const hyp = (p) => Math.abs(p[0] * p[0] + p[1] * p[1] - (p[2] * p[2]) / (lam * lam) - R * R) / (R * R);
    for (let i = 0; i < 6; i++) {
      const a = V[i], b = V[(i + 1) % 6];
      for (let s = -0.5; s <= 1.5; s += 0.125) upd('tilted sides on hyperboloid (relative)', hyp(G.lerp3(a, b, s)), t);
      const A = G.onC({ x: 0, y: 0, r: R }, g.th[(i + 1) % 6]);
      upd('tilted side through its tangent point (relative)', G.off3(a, b, [A[0], A[1], 0]) / R, t);
    }
    for (let k = 0; k < 3; k++) upd('space diagonals through Q (relative)', G.off3(g.lift.V[k], g.lift.V[k + 3], Q) / R, t);
    upd('shadow of Q = B (relative)', Math.hypot(Q[0] - g.bri.B[0], Q[1] - g.bri.B[1]) / R, t);
    for (let k = 0; k < 3; k++) upd('shadow of V = W (relative)', Math.hypot(g.lift.V[k][0] - g.bri.W[k][0], g.lift.V[k][1] - g.bri.W[k][1]) / R, t);
  }
}
console.log(`${nF} frames checked (${nLift} with the 3-D lift)`);
let ok = true;
for (const [k, [v, t]] of Object.entries(worst)) { const pass = v < 1e-9; ok &&= pass; console.log(`${pass ? 'OK  ' : 'FAIL'} ${k.padEnd(52)} max ${v.toExponential(2)}  (t = ${t.toFixed(2)} s)`); }
process.exit(ok ? 0 : 1);
