// Exactness audit over EVERY video frame (pure geometry, no rendering): node tools/verify_geometry.mjs
// (video clock → story clock through the 4-beat insert, exactly as film.js does)
//  · Pascal: the three opposite-side crossings X_k of the inscribed hexagon are collinear
//  · Brianchon: the three diagonals of the circumscribed hexagon are concurrent at B
//  · pole / polar (Act III): W_i = pole of chord A_iA_{i+1};  X_k = pole of diagonal W_kW_{k+3};  B = pole of the Pascal line
//    (La Hire: B on the three diagonals ⇔ the three poles X_k on the polar of B)
//  · 3-D lift (Act II): every lifted vertex and tilted side lies on the hyperboloid x²+y²−z²/λ² = R²; each tilted side passes
//    through its tangent point; opposite sides are coplanar (they meet); the three space diagonals pass through Q; shadow(Q) = B
//  · Dandelin (Act IV): roof k = plane(V_k, A_k, A_{k+1}) contains sides k, k+1 and meets the waist plane in chord A_kA_{k+1};
//    PK_k = side k ∩ side k+3; the edge PK_kPK_{k+1} pierces the waist plane exactly at the Pascal crossing X_k
import * as S from '../js/scene.js';
import * as G from '../js/geo.js';
const worst = {};
const upd = (k, v, t) => { if (!Number.isFinite(v)) v = Infinity; if (!(k in worst) || v > worst[k][0]) worst[k] = [v, t]; };
const cross3 = (u, v) => [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
let nF = 0, nLift = 0, nIns = 0;
for (let f = 0; f <= Math.round(S.DUR * S.FPS); f++) {
  const t = f / S.FPS, nv = S.warpNV(t), n = S.storyN(nv), g = S.geomAt(n), C = g.C, R = C.r;
  nF++; if (S.insB(nv) > 0) nIns++;
  if (g.pas.X.every(Boolean)) {
    const sz = Math.max(...g.pas.X.map((x) => G.dist(x, [C.x, C.y])), R);
    if (sz < 1e6) upd('Pascal collinearity (relative)', g.pas.resid / sz, t);
  }
  if (g.bri.B) {
    upd('Brianchon concurrency (relative)', g.bri.resid / R, t);
    for (let i = 0; i < 6; i++) {           // circumscribed: every side is tangent to the circle
      const l = G.lineThrough(g.bri.W[i], g.bri.W[(i + 1) % 6]);
      upd('hexagon sides tangent |d−R|/R', Math.abs(Math.abs(G.lineDist(l, [C.x, C.y])) - R) / R, t);
      const pw = G.pole(C, G.lineThrough(g.A[i], g.A[(i + 1) % 6]));
      if (pw) upd('W_i = pole of chord A_iA_i+1 (relative)', G.dist(pw, g.bri.W[i]) / R, t);
    }
    for (let k = 0; k < 3; k++) {
      const px = G.pole(C, G.lineThrough(g.bri.W[k], g.bri.W[k + 3]));
      if (px && g.pas.X[k]) { const sc = Math.max(R, G.dist(px, [C.x, C.y])); upd('X_k = pole of diagonal W_kW_k+3 (relative)', G.dist(px, g.pas.X[k]) / sc, t); }
      if (g.pas.X[k]) { const pl = G.polar(C, g.bri.B); upd('La Hire: X_k on polar(B) (relative)', Math.abs(G.lineDist(pl, g.pas.X[k])) / Math.max(R, G.dist(g.pas.X[k], [C.x, C.y])), t); }
    }
    if (g.pas.line) { const p = G.pole(C, g.pas.line); if (p) upd('B = pole of Pascal line (relative)', G.dist(p, g.bri.B) / R, t); }
  }
  if (g.lam > 1e-3) {
    nLift++;
    const lam = Math.abs(g.lam), O = [C.x, C.y, g.h0], V = g.lift.V.map((v) => G.sub3(v, O)), Q = g.lift.Q;
    const hyp = (p) => Math.abs(p[0] * p[0] + p[1] * p[1] - (p[2] * p[2]) / (lam * lam) - R * R) / (R * R);
    const Al = g.A.map((a) => [a[0] - C.x, a[1] - C.y, 0]);
    for (let i = 0; i < 6; i++) {
      const a = V[i], b = V[(i + 1) % 6];
      for (let s = -0.5; s <= 1.5; s += 0.125) upd('tilted sides on hyperboloid (relative)', hyp(G.lerp3(a, b, s)), t);
      upd('tilted side through its tangent point (relative)', G.off3(a, b, Al[(i + 1) % 6]) / R, t);
    }
    for (let k = 0; k < 3; k++) {
      upd('opposite tilted sides meet: gap (relative)', G.closest3(V[(k + 5) % 6], V[k], V[(k + 2) % 6], V[k + 3]).gap / R, t);
      upd('space diagonals through Q (relative)', G.off3(g.lift.V[k], g.lift.V[k + 3], Q) / R, t);
    }
    upd('shadow of Q = B (relative)', Math.hypot(Q[0] - g.bri.B[0], Q[1] - g.bri.B[1]) / R, t);
    for (let k = 0; k < 6; k++) upd('shadow of V = W (relative)', Math.hypot(g.lift.V[k][0] - g.bri.W[k][0], g.lift.V[k][1] - g.bri.W[k][1]) / R, t);
    // Dandelin: roofs, their traces on the waist plane, and the triangle PK₀PK₁PK₂
    for (let k = 0; k < 6; k++) {
      const u = G.sub3(Al[k], V[k]), w = G.sub3(Al[(k + 1) % 6], V[k]), nn = cross3(u, w), L = G.len3(nn);
      const dPl = (p) => Math.abs(G.dot3(nn, G.sub3(p, V[k]))) / L;
      upd('roof k contains sides k, k+1 (relative)', Math.max(dPl(V[(k + 5) % 6]), dPl(V[(k + 1) % 6])) / R, t);
    }
    const Pk = g.Pk.map((p) => G.sub3(p, O));
    for (let k = 0; k < 3; k++) {
      const a = Pk[k], b = Pk[(k + 1) % 3];
      if (Math.abs(b[2] - a[2]) < 1e-9 || !g.pas.X[k]) continue;
      const s = -a[2] / (b[2] - a[2]), hit = [a[0] + s * (b[0] - a[0]) + C.x, a[1] + s * (b[1] - a[1]) + C.y];
      const sc = Math.max(R, G.dist(g.pas.X[k], [C.x, C.y]));
      upd('Dandelin: edge PK_kPK_k+1 meets waist at X_k (relative)', G.dist(hit, g.pas.X[k]) / sc, t);
      upd('Dandelin: PK_k on side k and side k+3 (gap, relative)', g.Pk[k].gap / R, t);
    }
  }
}
console.log(`${nF} video frames checked (${nLift} with the 3-D figure, ${nIns} in the insert)`);
let ok = true;
for (const [k, [v, t]] of Object.entries(worst)) { const pass = v < 1e-9; ok &&= pass; console.log(`${pass ? 'OK  ' : 'FAIL'} ${k.padEnd(58)} max ${v.toExponential(2)}  (t = ${t.toFixed(2)} s)`); }
process.exit(ok ? 0 : 1);
