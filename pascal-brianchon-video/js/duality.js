// Flat (2-D) parts after Act I: the Brianchon figure after the first slam, Act III "why duality works"
// (a point's line = its polar: tangents → chord of contact; 你在我的线上 ⇔ 我在你的线上), the hexagon read through it
// (→ Pascal), the flattened Pascal figure after Act IV, and the outro twins. Exact geometry from scene.js / geo.js.
import { PAL, PAIR, clamp, inv, E, lerp } from './engine.js';
import * as G from './geo.js';
import * as S from './scene.js';
import { rgba, mixHex, tip, sline, spoly, sdot, sfill, ringWave, bD } from './draw.js';
import { letters, popIn } from './text.js';

const ramp = (a, b, n, e = 'io2') => E[e](inv(a, b, n));
const win = (n, a, b, c, d) => ramp(a, b, n) * (1 - ramp(c, d, n));
const pulse = (n, n0, up, down) => (n < n0 ? 0 : n < n0 + up ? E.out2((n - n0) / up) : 1 - E.io2(clamp((n - n0 - up) / down)));
const bt = S.bt, FPS = S.FPS, D2R = S.D2R;
const S3 = (p) => [p[0], p[1], 0];

// ---------------------------------------------------------------- the demo point P and the point Q on its line
const PDIR = 205 * D2R;
export function demoAt(n) {
  const C = S.CIRC, R = C.r, d0 = [Math.cos(PDIR), Math.sin(PDIR)];
  // P: 2R out → onto the circle (160–164) → back out (166.5–168.5)
  const dP = S.ss(160, 164, n) * -1 + S.ss(166.4, 168.4, n) * 1 + 2.0 - 0;   // 2 → 1 → 2
  const Pp = [C.x + d0[0] * R * dP, C.y + d0[1] * R * dP];
  const pol = G.polar(C, Pp);
  // Q on P's line: foot F (R²/|OP| from O) + s·u
  const u = [-d0[1], d0[0]];
  const F = [C.x + d0[0] * (R / dP), C.y + d0[1] * (R / dP)];
  const s = 1.5 - 2.6 * E.io2(inv(188.6, 192.4, n)) + 1.9 * E.io2(inv(192.8, 195.6, n));   // slides along P's line
  const Qp = [F[0] + u[0] * R * s, F[1] + u[1] * R * s];
  return { Pp, pol, Qp, polQ: G.polar(C, Qp), F, u, dP, s };
}
// tangent points from an outside point
function tanPts(C, p) {
  const dx = p[0] - C.x, dy = p[1] - C.y, d = Math.hypot(dx, dy);
  if (d <= C.r * (1 + 1e-6)) return null;
  const a = Math.atan2(dy, dx), b = Math.acos(C.r / d);
  return [G.onC(C, a - b), G.onC(C, a + b)];
}
const rect = [-400, -400, 1480, 2320];
function fullLine(f, P, l, o) {
  // clip in world space generously, then draw
  const wr = [-3000, -3000, 5000, 5000], seg = G.clipLine(l, wr);
  if (!seg) return;
  const a = P(S3(seg[0])), b = P(S3(seg[1]));
  const sc = G.clipLine(G.lineThrough(a, b), rect);
  if (sc) sline(f, sc[0], sc[1], o);
}
const lbl = (f, s, q, o = {}) => letters(f, s, { font: o.font || 'SM', size: o.size || 44, x: q[0], y: q[1], align: o.align, fill: o.fill || PAL.cream, alpha: o.alpha ?? 1, anim: o.anim, D: o.D ?? 0, seed: o.seed || 3, amp: 0.4, knock: 7 });

// ---------------------------------------------------------------- flat renderer
export function drawFlat(f, st, t, n) {
  const P = st.P, C = st.C, A = st.A, pas = st.pas, bri = st.bri, sc = st.cam.s;
  const Ps = (p) => P(S3(p));
  const X = pas.X, ok = X.every(Boolean), Wv = bri.W, Bp = bri.B, ice = PAL.ice;
  const D = bD(t);
  const at = (n0, d) => (t - bt(n0)) / d;
  const act3 = n < 212, outro = n >= 256;
  const lf = act3 ? 1 - ramp(209.4, 210.6, n) : 1;          // before Act IV lifts off: only circle + circumscribed hexagon stay
  // ---------- base figures
  const circ = []; for (let i = 0; i <= 200; i++) { const a = (i / 200) * Math.PI * 2; circ.push(P([C.x + C.r * Math.cos(a), C.y + C.r * Math.sin(a), 0])); }
  spoly(f, circ, { w: 3.2, color: PAL.gold, closed: true, alpha: 1 });
  // Brianchon figure: bright after the slam, steps back for the demo, returns for the hexagon reading; outro twin
  const briA = act3 ? K3(n, [[140, 1], [144.6, 1], [146.4, 0.14], [195.8, 0.14], [197.2, 0.85], [209.4, 0.85], [210.6, 1]]) : 0.75 * ramp(260, 261.2, n);
  const hiB = pulse(S.cuN('slam140'), 0, 0.04, 1.8);
  if (briA > 0.003) {
    for (let i = 0; i < 6; i++) sline(f, Ps(Wv[(i + 5) % 6]), Ps(Wv[i]), { w: 3.2, color: ice, alpha: briA });
    for (let k = 0; k < 3; k++) {
      const [a, b] = G.extend(Wv[k], Wv[k + 3], 24 / sc, 24 / sc);
      const hk = act3 ? pulse(n, 200.4 + 1.0 * k, 0.1, 1.6) : 0;
      sline(f, Ps(a), Ps(b), { w: 3 + 2 * hiB + 2.5 * hk, color: PAIR[k], halo: 2 + 2 * hiB + 2 * hk, alpha: Math.max(briA, hk) * lf });
    }
    for (let i = 0; i < 6; i++) sdot(f, Ps(Wv[i]), { r: 8, color: ice, core: '#FFFFFF', alpha: briA });
    for (let i = 0; i < 6; i++) sdot(f, Ps(A[i]), { r: 4.6, color: ice, core: '#0B1320', alpha: 0.75 * briA });
    const hb = pulse(n, 204.4, 0.1, 1.6);
    sdot(f, Ps(Bp), { r: 11.5, s: 1 + 0.25 * (hiB + hb), color: PAL.red, core: '#FFFFFF', halo: 3.5 + 4 * (hiB + hb), alpha: Math.max(briA, act3 && n > 204 ? 1 : 0) * lf });
  }
  // ---------- Act III demo: P, its tangents, its line; the formula; Q on P's line; Q's line through P; sliding
  if (act3 && n > 147 && n < 197) drawDemo(f, st, t, n, D, at);
  // ---------- Act III hexagon reading (196–208) and the Pascal figure (208–212, 256–278)
  const pasA = act3 ? ramp(197, 197.6, n) : 1;
  if (pasA > 0.003 && lf > 0.003 && (n > 196 || !act3)) {
    f.save(); f.globalAlpha *= lf;
    // vertex W_i → chord A_iA_{i+1} (its line): W₁ slowly, then the rest
    for (let i = 0; i < 6; i++) {
      const n0 = act3 ? (i === 0 ? 197.4 : 198.4 + 0.3 * (i - 1)) : -1;
      const fr = act3 ? E.out2(clamp((n - n0) / (i === 0 ? 0.7 : 0.35))) : 1;
      if (fr <= 0) continue;
      const k = i % 3, kc = act3 ? clamp((n - (200.4 + 1.0 * k)) / 0.3) : 1;
      sline(f, Ps(A[i]), Ps(A[(i + 1) % 6]), { w: 3.4, color: mixHex(PAL.gold, PAIR[k], 0.85 * kc), to: fr, tip: fr < 1, alpha: 1 });
    }
    if (act3 && n > 196.6 && n < 199) {
      // W₁ with its two tangents (= the two sides of the circumscribed hexagon through A₁, A₂)
      const a = win(n, 196.6, 197.0, 198.4, 199);
      sline(f, Ps(A[0]), Ps(Wv[0]), { w: 5, color: '#E6FBFF', alpha: a, halo: 3 });
      sline(f, Ps(A[1]), Ps(Wv[0]), { w: 5, color: '#E6FBFF', alpha: a, halo: 3 });
      ringWave(f, Ps(Wv[0]), at(196.7, 0.6), { R: 60, w: 3.5, color: PAL.cream });
    }
    if (act3 && n > 198.3 && n < 200.2) for (let i = 1; i < 6; i++) ringWave(f, Ps(Wv[i]), at(198.4 + 0.3 * (i - 1), 0.5), { R: 46, w: 3, color: ice });
    // diagonal k ⇄ crossing X_k: its two opposite sides extend to X_k
    if (ok) for (let k = 0; k < 3; k++) {
      const dr = act3 ? E.out2(clamp((n - (200.7 + 1.0 * k)) / 0.6)) : 1;
      if (dr <= 0) continue;
      for (const side of [k, k + 3]) {
        const p = A[side], q = A[(side + 1) % 6], Xk = X[k];
        const near = G.dist(p, Xk) < G.dist(q, Xk) ? p : q;
        const over = G.add(Xk, G.mul(G.nrm(G.sub(Xk, near)), 46 / sc));
        sline(f, Ps(near), Ps(over), { w: 2.2, color: PAIR[k], to: dr, tip: dr < 1, alpha: 0.9 });
      }
    }
    // the red line = B's line (through the three crossings)
    const rl = act3 ? E.in2(clamp((n - 205) / 1.4)) : 1;
    if (ok && rl > 0) {
      const span = G.spanOf(X, 80 / sc), fl = pulse(S.cuN('slam208'), 0, 0.05, 1.2) + pulse(S.cuN('slam256'), 0, 0.04, 1.6);
      sline(f, Ps(span[0]), Ps(span[1]), { w: 4.4 + 3 * fl, color: mixHex(PAL.red, '#FFD0D8', fl * 0.6), to: rl, tip: rl < 1, tipR: 30, halo: 4.5, alpha: 1 });
    }
    for (let i = 0; i < 6; i++) sdot(f, Ps(A[i]), { r: 8.5, color: PAL.gold, alpha: act3 ? clamp((n - 197.4 - 0.3 * Math.max(0, i - 1)) / 0.3) : 1 });
    if (ok) for (let k = 0; k < 3; k++) {
      const pu = act3 ? clamp((n - (201.3 + 1.0 * k)) / 0.3) : 1;
      if (pu <= 0) continue;
      sdot(f, Ps(X[k]), { r: 10.5, s: E.outBack(pu, 2.6), color: PAIR[k], core: '#FFFFFF', halo: 3.2, alpha: 1 });
      if (act3) ringWave(f, Ps(X[k]), at(201.3 + 1.0 * k, 0.5), { R: 70, w: 3.5, color: PAIR[k] });
    }
    f.restore();
  }
}
function K3(n, keys) { if (n <= keys[0][0]) return keys[0][1]; for (let i = 1; i < keys.length; i++) if (n <= keys[i][0]) { const u = E.io2((n - keys[i - 1][0]) / (keys[i][0] - keys[i - 1][0])); return keys[i - 1][1] + (keys[i][1] - keys[i - 1][1]) * u; } return keys[keys.length - 1][1]; }

function drawDemo(f, st, t, n, D, at) {
  const P = st.P, C = st.C, R = C.r;
  const Ps = (p) => P(S3(p));
  const dm = demoAt(n), Pp = dm.Pp, Qp = dm.Qp;
  const all = win(n, 147.6, 148.2, 195.6, 196.6);
  if (all <= 0.003) return;
  f.save(); f.globalAlpha *= all;
  const gold = PAL.gold, PC = '#FFE3A3', QC = PAL.c2;
  // coordinate axes (formula part)
  const ax = win(n, 168.2, 169.0, 186, 187.5);
  if (ax > 0.003) {
    const o = Ps([C.x, C.y]), L = 2.6 * R * st.cam.s;
    sline(f, [o[0] - L, o[1]], [o[0] + L, o[1]], { w: 1.6, color: PAL.cream, alpha: 0.35 * ax });
    sline(f, [o[0], o[1] + L * 0.9], [o[0], o[1] - L * 0.9], { w: 1.6, color: PAL.cream, alpha: 0.35 * ax });
    lbl(f, 'x', [o[0] + L - 6, o[1] + 26], { font: 'WK', size: 36, alpha: 0.6 * ax });
    lbl(f, 'y', [o[0] + 22, o[1] - L * 0.9 + 10], { font: 'WK', size: 36, alpha: 0.6 * ax });
    lbl(f, 'O', [o[0] - 20, o[1] + 24], { font: 'WK', size: 32, alpha: 0.6 * ax });
  }
  // P's tangents + tangent points + chord; then the full line
  const tg = tanPts(C, Pp);
  const tanA = win(n, 148.4, 148.6, 163.2, 164.0) + win(n, 167.6, 168.4, 175.6, 176.4) * 0.5;
  const tanD = E.out2(clamp((n - 148.6) / 1.2));
  if (tg && tanA > 0.003) for (const q of tg) {
    const e = G.add(q, G.mul(G.nrm(G.sub(q, Pp)), 70));
    sline(f, Ps(Pp), Ps(e), { w: 3, color: PAL.ice, to: tanD, tip: tanD < 1, alpha: tanA });
  }
  const chord = clamp((n - 152.4) / 1.0);
  const lineA = clamp((n - 156.2) / 0.8);
  if (tg && chord > 0 && lineA < 1) sline(f, Ps(tg[0]), Ps(tg[1]), { w: 4, color: gold, to: E.out2(chord), tip: chord < 1, alpha: 1, halo: 2.4 });
  if (lineA > 0) fullLine(f, P, dm.pol, { w: 4, color: gold, alpha: lineA, halo: 2.4 + 2 * pulse(n, 164.2, 0.1, 1.2) });
  if (tg && tanA > 0.003) for (const q of tg) sdot(f, Ps(q), { r: 7, s: E.outBack(clamp((n - 150) / 0.3), 2.4), color: PAL.ice, core: '#FFFFFF', alpha: tanA * clamp((n - 150) / 0.3) });
  // P on the circle: its line is the tangent there
  if (n > 164 && n < 166.5) ringWave(f, Ps(Pp), at(164.1, 0.6), { R: 70, w: 3.5, color: PAL.cream });
  // P
  const pA = clamp((n - 148) / 0.3);
  sdot(f, Ps(Pp), { r: 11, s: E.outBack(pA, 2.4), color: PC, core: '#FFFFFF', halo: 3, alpha: pA });
  const pq = Ps(Pp), coordA = ramp(169.4, 170, n);
  lbl(f, coordA > 0.5 ? 'P(a, b)' : 'P', [pq[0] - 16, pq[1] - 44], { size: 44, fill: PC, alpha: pA, D, anim: popIn(t, bt(148.2), 0, 0.24) });
  // the line's equation next to it
  const eqA = win(n, 169.8, 170.4, 186, 187);
  if (eqA > 0.003) {
    const seg = G.clipLine(dm.pol, [-3000, -3000, 5000, 5000]);
    const along = G.nrm(G.sub(seg[1], seg[0]));
    const base = G.add(dm.F, G.mul(dm.u, -1.05 * R));
    const q = Ps(base), ang = Math.atan2(along[1], along[0]);
    f.save(); f.translate(q[0], q[1]); f.rotate(ang > Math.PI / 2 || ang < -Math.PI / 2 ? ang + Math.PI : ang);
    lbl(f, 'ax + by = r²', [0, -30], { font: 'WK', size: 42, fill: gold, alpha: eqA, D });
    f.restore();
  }
  // Q on P's line, Q's tangents / chord / line through P
  const qA = clamp((n - 176.4) / 0.3) * (1 - ramp(195.6, 196.4, n));
  if (qA > 0) {
    const tq = tanPts(C, Qp);
    const qTan = win(n, 180.4, 180.8, 187.6, 188.4), qd = E.out2(clamp((n - 180.6) / 0.9));
    if (tq && qTan > 0.003) for (const q of tq) sline(f, Ps(Qp), Ps(G.add(q, G.mul(G.nrm(G.sub(q, Qp)), 60))), { w: 2.6, color: mixHex(QC, '#FFFFFF', 0.3), to: qd, tip: qd < 1, alpha: 0.8 * qTan });
    const ql = clamp((n - 181.6) / 0.9);
    if (ql > 0) {
      // ghosts while sliding
      if (n > 188.6) for (let j = 0; j < 14; j++) {
        const nj = 188.8 + 0.5 * j; if (nj > n) break;
        const g = demoAt(nj), a = 0.32 * (1 - clamp((n - nj) / 3.2));
        if (a <= 0.01) continue;
        fullLine(f, P, g.polQ, { w: 2, color: QC, alpha: a });
        sdot(f, Ps(g.Qp), { r: 5, color: QC, alpha: a * 1.6 });
      }
      fullLine(f, P, dm.polQ, { w: 3.6, color: QC, alpha: ql, to: 1, halo: 2.2 });
    }
    if (tq && qTan > 0.003) for (const q of tq) sdot(f, Ps(q), { r: 6, color: QC, core: '#FFFFFF', alpha: qTan * clamp((n - 181) / 0.3) });
    const qq = Ps(Qp);
    sdot(f, qq, { r: 10.5, s: E.outBack(qA, 2.4), color: QC, core: '#FFFFFF', halo: 3, alpha: 1 });
    lbl(f, 'Q(c, d)', [qq[0] + 70, qq[1] - 34], { size: 42, fill: QC, alpha: qA, D, anim: popIn(t, bt(176.5), 0, 0.24) });
    if (n > 182.3 && n < 184) ringWave(f, Ps(Pp), at(182.4, 0.6), { R: 70, w: 4, color: QC });
    if (n > 183.9 && n < 186) ringWave(f, Ps(Pp), S.cuS('slam184') / 0.7, { R: 130, w: 5, color: PAL.cream });
  }
  f.restore();
  // the formula card
  const card = win(n, 168.2, 168.8, 187.4, 188.2);
  if (card > 0.003) {
    f.save(); f.globalAlpha *= card * all;
    const x0 = 90, x1 = 990, y0 = 1250, y1 = 1552, r = 26;
    f.beginPath(); f.moveTo(x0 + r, y0); f.arcTo(x1, y0, x1, y1, r); f.arcTo(x1, y1, x0, y1, r); f.arcTo(x0, y1, x0, y0, r); f.arcTo(x0, y0, x1, y0, r); f.closePath();
    f.fillStyle = 'rgba(11,19,32,0.82)'; f.fill(); f.lineWidth = 2; f.strokeStyle = rgba(PAL.gold, 0.5); f.stroke();
    f.restore();
  }
}
