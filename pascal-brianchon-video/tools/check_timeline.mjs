// Frame-by-frame sanity check of the geometry + camera (VIDEO clock → story clock via the insert): everything important on screen, nothing degenerate.
import * as S from '../js/scene.js';
import * as G from '../js/geo.js';
const SAFE = [40, 300, 1040, 1560];
const issues = new Map();
const note = (k, t) => { if (!issues.has(k)) issues.set(k, []); issues.get(k).push(t); };
let minAng = 90, minGap = 360, maxGap = 0, minXsp = 1e9;
for (let f = 0; f <= S.DUR * S.FPS; f++) {
  const tv = f / S.FPS, nv = S.warpNV(tv), t = tv, g = S.state(S.bt(S.storyN(nv)), nv), n = g.n, P = g.P;
  const on = (p, tag) => { const q = P(p); if (q[0] < SAFE[0] || q[0] > SAFE[2] || q[1] < SAFE[1] || q[1] > SAFE[3]) note(tag, t); return q; };
  g.A.forEach((a) => on(a, 'A'));
  if (S.wX(n) > 0.5) { if (!g.pas.X.every(Boolean)) note('X-null', t); else g.pas.X.forEach((x) => on(x, 'X')); }
  if (S.wW(n) > 0.5 && g.lam < 1e-3) g.bri.W.forEach((w) => on(w, 'W'));
  if (g.lam > 1e-3) { g.lift.V.forEach((v) => on(v, 'V')); on(g.lift.Q, 'Q'); }
  for (let i = 0; i < 6; i++) { const gp = g.deg[(i + 1) % 6] + (i === 5 ? 360 : 0) - g.deg[i]; minGap = Math.min(minGap, gp); maxGap = Math.max(maxGap, gp); }
  if (S.wX(n) > 0.5 && g.pas.X.every(Boolean)) {
    const a = Math.min(...[0, 1, 2].map((k) => G.lineAngle(g.pas.L[k], g.pas.L[k + 3]))) * 180 / Math.PI; minAng = Math.min(minAng, a);
    const sc = g.cam.s;
    minXsp = Math.min(minXsp, sc * Math.min(G.dist(g.pas.X[0], g.pas.X[1]), G.dist(g.pas.X[1], g.pas.X[2]), G.dist(g.pas.X[0], g.pas.X[2])));
  }
  if (f % 90 === 0) console.log(t.toFixed(2).padStart(6), 'nv', nv.toFixed(1).padStart(5), 'n', n.toFixed(2).padStart(6), 's', g.cam.s.toFixed(2), 'pitch', g.cam.pitch.toFixed(0), 'yaw', g.cam.yaw.toFixed(0), 'e', g.con.e.toFixed(2), 'u', g.u.toFixed(2), 'v', g.v.toFixed(2), 'lam', g.lam.toFixed(2), 'X', g.pas.X.map((x) => x ? P(x).slice(0, 2).map(Math.round).join(',') : 'inf').join(' '), 'B', P(g.bri.B).slice(0, 2).map(Math.round).join(','));
}
console.log('minCrossAng', minAng.toFixed(1), 'gap range', minGap.toFixed(1), maxGap.toFixed(1), 'min X spacing on screen', minXsp.toFixed(0));
for (const [k, ts] of issues) console.log('ISSUE', k, ts.length, 'frames, e.g. t =', ts.slice(0, 3).map((x) => x.toFixed(2)).join(','), '…', ts.slice(-2).map((x) => x.toFixed(2)).join(','));
