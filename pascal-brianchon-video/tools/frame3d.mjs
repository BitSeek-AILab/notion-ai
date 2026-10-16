// screen extents of the 3-D act: node tools/frame3d.mjs 44,45,46,47
import * as S from '../js/scene.js';
const ns = (process.argv[2] || '34,38,42,44,45,46,47,47.5').split(',').map(Number);
for (const n of ns) {
  const g = S.geomAt(n), cam = S.camAt(n), P = S.makeProj(cam), C = g.C;
  const pts = { fig: [], sh: [] };
  for (const v of g.lift.V) pts.fig.push(P(v));
  for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2; pts.fig.push(P([C.x + C.r * Math.cos(a), C.y + C.r * Math.sin(a), g.h0])); pts.sh.push(P([C.x + C.r * Math.cos(a), C.y + C.r * Math.sin(a), 0])); }
  for (const w of g.bri.W) pts.sh.push(P([w[0], w[1], 0]));
  const bb = (a) => { const xs = a.map((p) => p[0]), ys = a.map((p) => p[1]); return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)].map((v) => Math.round(v)); };
  const q = P(g.lift.Q), b = P([g.bri.B[0], g.bri.B[1], 0]);
  console.log(n.toFixed(2), 'h0', g.h0.toFixed(0), 'pitch', cam.pitch.toFixed(1), 's', cam.s.toFixed(2), 'fig', bb(pts.fig).join(','), 'shadow', bb(pts.sh).join(','), 'Q', q.slice(0, 2).map(Math.round).join(','), 'B', b.slice(0, 2).map(Math.round).join(','));
}
