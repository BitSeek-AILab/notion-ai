// v5 · 时钟检查：每段 α（动画倍速）、β（停顿倍数），以及单调性 / 片长
import * as S from '../js/scene.js';
const rows = [];
for (const g of S.SEG) {
  const w = g.al < 0.8 || g.al > 1.25 ? '  ⚠ α' : '';
  rows.push(`${g.a.toFixed(2).padStart(7)} → ${g.b.toFixed(2).padStart(7)}  t ${g.ta.toFixed(2).padStart(7)} → ${g.tb.toFixed(2).padStart(7)}  D ${(g.tb - g.ta).toFixed(2).padStart(6)}  A ${g.A.toFixed(2).padStart(6)}  H ${g.H.toFixed(2).padStart(5)}  α ${g.al.toFixed(3)}  β ${g.be.toFixed(2)}${w}`);
}
console.log(rows.join('\n'));
let prev = -1e9, bad = 0;
for (let n = -1; n < 290; n += 0.01) { const t = S.realT(n); if (t < prev - 1e-9) bad++; prev = t; }
console.log('DUR', S.DUR, 'non-monotone samples', bad);
