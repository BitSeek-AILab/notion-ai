// Lit 3-D acts (v3) — Act II (beats 48–144): Brianchon proved in space, five slow steps;
// Act IV (208–256): Dandelin's 1826 proof of Pascal on the very same figure.
// Every element is the exact geometry of scene.js (lifted vertices V, meeting points P_k, Q, Pascal crossings X);
// shading / primitives come from lit3d.js.
import { PAL, PAIR, clamp, inv, E, lerp } from './engine.js';
import * as G from './geo.js';
import * as S from './scene.js';
import { bp, rgba, mixHex, tip, sline, spoly, sfill, sdot, ringWave, sparkle, check, bD } from './draw.js';
import { letters, popIn } from './text.js';
import { tube, ball, BALL, splitPoly, sampleSeg, surfaceFaces, paintFaces, blitLayer, silhouettes, glint, eyeOf, SHADOW, OUTL, ext3 } from './lit3d.js';

const TAU = Math.PI * 2;
const ramp = (a, b, n, e = 'io2') => E[e](inv(a, b, n));
const win = (n, a, b, c, d) => ramp(a, b, n) * (1 - ramp(c, d, n));
const pulse = (n, n0, up, down) => (n < n0 ? 0 : n < n0 + up ? E.out2((n - n0) / up) : 1 - E.io2(clamp((n - n0 - up) / down)));
const bt = S.bt, FPS = S.FPS;
// the two ruling families of the hyperboloid: sides S_0, S_2, S_4 belong to family +1, S_1, S_3, S_5 to family −1
export const FAMC = { 1: '#F5BE5C', '-1': '#8FE3FF' };
const FAMD = { 1: '#8A5F1E', '-1': '#2F5F8C' };
export const famOf = (i) => (i % 2 === 0 ? 1 : -1);
// pair plane k contains diagonals k, k+1 and the opposite sides S_{k+1}, S_{k+4}, which meet at P_{(k+1)%3}
export const PLANE = [0, 1, 2].map((k) => ({ k, e1: k + 1, e2: (k + 4) % 6, p: (k + 1) % 3, verts: [k, k + 1, k + 3, (k + 4) % 6], diags: [k, (k + 1) % 3] }));
// Act II: the slow pair is plane 1 (diagonals 25 & 36, sides 23 & 56 → P₂), then plane 2 (36 & 14 → P₀), plane 0 (14 & 25 → P₁)
export const PAIRS = [
  { k: 1, foc: [80.0, 80.8, 105.0, 105.8], rings: [84.3, 84.9], hi: [84.2, 85.0], ext: [88.2, 89.6], pop: 89.6, shad: [91.0, 91.8, 98.6, 99.6], ray: [93.4, 94.2, 98.6, 99.6], sweep: [96.2, 97.8], quad: [100.0, 100.8], vring: 100.2, glow: [100.8, 101.6], cross: 102.6, end: [105.0, 105.8] },
  { k: 2, foc: [106.0, 106.6, 109.6, 110.2], rings: [106.2, 106.2], hi: [106.0, 106.6], ext: [106.6, 107.6], pop: 107.6, shad: [106.8, 107.4, 109.6, 110.1], ray: [107.2, 107.8, 109.6, 110.1], sweep: [107.8, 108.6], quad: [108.4, 109.0], vring: 108.6, glow: [108.6, 109.2], cross: 109.0, end: [109.6, 110.2] },
  { k: 0, foc: [110.0, 110.6, 113.6, 114.4], rings: [110.2, 110.2], hi: [110.0, 110.6], ext: [110.6, 111.8], pop: 111.8, shad: [110.8, 111.4, 113.6, 114.1], ray: [111.4, 112.0, 113.6, 114.1], sweep: [112.0, 112.8], quad: [112.4, 113.0], vring: 112.6, glow: [112.6, 113.2], cross: 113.0, end: [113.6, 114.4] },
];
const PCOL = (k) => mixHex(mixHex(PAIR[k], PAIR[(k + 1) % 3], 0.5), '#FFFFFF', 0.2);
const lbl = (f, s, q, o = {}) => letters(f, s, { font: o.font || 'SM', size: o.size || 40, x: q[0], y: q[1], fill: o.fill || PAL.cream, alpha: o.alpha ?? 1, anim: o.anim, D: o.D ?? 0, seed: o.seed || 7, amp: 0.35, knock: o.knock ?? 7 });

// ---------------------------------------------------------------- the lit 3-D figure, both acts
export function drawSpace(f, st, t, n, LY) {
  const II = n < 200;
  const P = st.P, C = st.C, R = C.r, V = st.lift.V, Q = st.lift.Q, A = st.A, Wv = st.bri.W, B = st.bri.B, PK = st.Pk, X = st.pas.X;
  const lamS = st.lam * S.LSIGN, h0 = st.h0, sc = st.cam.s;
  const eye = eyeOf(st.cam);
  const flat = st.lam < 0.03;
  const D = bD(t);
  const l2 = Math.max(lamS * lamS, 1e-6);
  const facing = flat ? () => 1 : (p) => (p[0] - C.x) * (eye[0] - p[0]) + (p[1] - C.y) * (eye[1] - p[1]) - ((p[2] - h0) / l2) * (eye[2] - p[2]);
  const facingWaist = (p) => (p[0] - C.x) * (eye[0] - p[0]) + (p[1] - C.y) * (eye[1] - p[1]);
  const fl = (p) => [p[0], p[1], 0], wa = (p) => [p[0], p[1], h0];
  const Sd = (i) => [V[(i + 5) % 6], V[i]];
  const at = (n0, d) => (t - bt(n0)) / d;
  const sh = clamp(h0 / 40);
  const ins = II ? S.insB(st.nv) : 0;                                            // ④ insert: declutter
  // ---------------------------------------------------------------- schedules
  const lit = II ? ramp(48, 48.6, n) : ramp(211, 211.6, n);
  const dA = II ? 1 - ramp(51.4, 52.4, n) : 0;                                  // floating planar diagonals + B
  const aH = (1 - 0.55 * ins) * (II ? K2(n, [[60, 0], [61.2, 1], [71, 1], [72.5, 0.42], [79.5, 0.42], [81, 0.2], [90.6, 0.2], [91.6, 0.07], [96.0, 0.07], [97.2, 0.2], [114.2, 0.2], [115.6, 0.34], [127.5, 0.34], [129.5, 0]])
    : K2(n, [[213, 0], [214.8, 0.5], [219.6, 0.5], [220.6, 0.2], [255.4, 0.2], [256, 0]]));

  const grow = II ? E.out2(ramp(60, 61.6, n, 'lin')) : E.out2(ramp(213, 214.6, n, 'lin'));
  const famHi = (fam) => (II ? (fam > 0 ? win(n, 63.8, 64.6, 69.6, 70.6) : win(n, 65.4, 66.2, 69.6, 70.6)) : 0);
  const famT0 = (fam) => (fam > 0 ? 63.8 : 65.4);
  const edgeFam = (i) => (II ? ramp(67.0 + 0.3 * i, 67.4 + 0.3 * i, n) * (1 - ramp(128.6, 129.6, n)) : 0);
  const drK = (k) => (II ? (n < 72 ? 0 : E.out2(clamp((n - (72.4 + 0.9 * k)) / 0.7))) * (1 - ramp(139.55, 140, n)) : 0);
  const labA = II ? win(n, 52.6, 53.2, 139.0, 139.5) : 0;
  const arrows = II ? win(n, 52.2, 52.7, 54.8, 55.4) : 0;
  const foc1 = II ? win(n, 55.6, 56.4, 59.3, 60.0) : 0;                          // step ①: vertex 4 (V₃) in detail
  const updn = II ? win(n, 121.0, 121.8, 125.5, 126.5) : 0;                       // step ④: up / down at every vertex
  const qRed = II ? clamp((n - 124) / 0.3) * (1 - ramp(139.55, 140, n)) : 0;
  const beamA = II ? win(n, 128.4, 129.2, 139.55, 140) : 0;
  const rayA = beamA;
  const ov = II ? ramp(131.4, 132.4, n) * (1 - ramp(139.55, 140, n)) : 0;
  const fd = 1 - 0.45 * (II ? win(n, 131.6, 132.4, 139.0, 139.5) : 0);
  const bSh = II ? ramp(135.6, 136.4, n) : 0;
  // pair focus (Act II ③)
  const pairs = II ? PAIRS.map((p) => {
    const o = { ...p, F: win(n, ...p.foc), H: win(n, p.hi[0], p.hi[1], p.end[0], p.end[1]), X: E.out2(ramp(p.ext[0], p.ext[1], n, 'lin')) * (1 - ramp(p.end[0], p.end[1], n)),
      Pp: clamp((n - p.pop) / 0.3) * (1 - ramp(p.end[0], p.end[1], n)), Sh: win(n, ...p.shad), Ry: win(n, ...p.ray), Sw: E.out2(ramp(p.sweep[0], p.sweep[1], n, 'lin')) * (1 - 0.75 * ramp(p.end[0], p.end[1], n)),
      Qd: win(n, p.quad[0], p.quad[1], p.end[0], p.end[1]), Gl: win(n, p.glow[0], p.glow[1], p.end[0], p.end[1]), Cx: clamp((n - p.cross) / 0.3) };
    if (n > 114.6) { o.X = 0; o.Pp = 0; o.Sw = 0; }
    return o;
  }) : [];
  const dimOther = (k) => { let d = 1; for (const p of pairs) if (p.F > 0) { const inP = PLANE[p.k].diags.includes(k); d = Math.min(d, inP ? 1 : 1 - 0.75 * p.F); } return d; };
  const diagBoost = (k) => { let b = 0; for (const p of pairs) if (PLANE[p.k].diags.includes(k)) b = Math.max(b, 0.6 * p.F + 0.8 * p.Gl); return b; };
  const edgeBoost = (i) => { let b = 0; for (const p of pairs) if (PLANE[p.k].e1 === i || PLANE[p.k].e2 === i) b = Math.max(b, p.H); if (foc1 > 0 && (i === 3 || i === 4)) b = Math.max(b, foc1); return b; };
  // Act IV
  const gA = II ? 0 : ramp(213.6, 215, n) * (1 - ramp(255.6, 256, n));
  const hexA = II ? 0 : ramp(216.4, 217.8, n, 'lin');
  const roofDemo = II ? 0 : win(n, 220.4, 221.2, 223.8, 224.6);
  const roofFlash = (k) => (II ? 0 : pulse(n, 224.6 + 0.4 * k, 0.15, 0.7));
  const extIV = (m) => (II ? 0 : E.out2(ramp(228.4 + 0.7 * m, 229.2 + 0.7 * m, n, 'lin')) * (1 - ramp(255.6, 256, n)));
  const pIV = (m) => (II ? 0 : clamp((n - (229.2 + 0.7 * m)) / 0.3) * (1 - ramp(255.6, 256, n)));
  const sigA = II ? 0 : ramp(231.6, 232.8, n) * (1 - ramp(255.6, 256, n));
  // v4: the side lights up with a quick attack + a short flash, so the moment can sit on a note
  const hiOn = (a, b, c, d) => E.out2(ramp(a, b, n, 'lin')) * (1 - ramp(c, d, n));
  const sideHi = (k) => (II ? 0 : [hiOn(234.2, 234.55, 243.6, 244.4), hiOn(244.6, 244.9, 246.4, 247.0), hiOn(246.6, 246.9, 248.2, 248.8)][k]);
  const sideFl = (k) => (II ? 0 : pulse(n, [234.2, 244.6, 246.6][k], 0.06, 0.9));
  const bigPl = (k) => (II ? 0 : [win(n, 235.2, 236.4, 242.8, 243.8), win(n, 244.8, 245.4, 246.2, 246.8), win(n, 246.8, 247.4, 248.0, 248.6)][k]);
  const trace = (k) => (II ? 0 : E.out2(ramp(...[[238.6, 240.2], [245.2, 246.0], [246.9, 247.7]][k], n, 'lin')));
  const xPop = (k) => (II ? 0 : clamp((n - [241.8, 246.2, 247.9][k]) / 0.3));
  const redA = II ? 0 : ramp(252.6, 254.2, n, 'lin');
  // ---------------------------------------------------------------- beam of light from straight above (⑤)
  if (beamA > 0.003) {
    const o = P([C.x, C.y, 0]), hw = 1.9 * R * o[2] * sc, tw = 0.35 * hw;
    f.save(); f.globalCompositeOperation = 'lighter';
    const g = f.createLinearGradient(0, -60, 0, o[1]);
    g.addColorStop(0, rgba(PAL.cream, 0.1 * beamA)); g.addColorStop(0.7, rgba(PAL.cream, 0.05 * beamA)); g.addColorStop(1, rgba(PAL.cream, 0));
    f.fillStyle = g; f.beginPath(); f.moveTo(o[0] - tw, -60); f.lineTo(o[0] + tw, -60); f.lineTo(o[0] + hw, o[1]); f.lineTo(o[0] - hw, o[1]); f.closePath(); f.fill();
    f.restore();
  }
  // ---------------------------------------------------------------- floor: soft shadows (vertical projection)
  const Wf = V.map(fl);
  const shl = (a, b, s, o = {}) => {
    const pa = P(a), pb = P(b), k = Math.sqrt(Math.max(0.2, (pa[2] + pb[2]) / 2));
    sline(f, pa, pb, { w: 11 * k, color: SHADOW, alpha: 0.15 * s, from: o.from, to: o.to });
    sline(f, pa, pb, { w: 5 * k, color: SHADOW, alpha: 0.4 * s, from: o.from, to: o.to });
    if (o.hi) sline(f, pa, pb, { w: (o.hw || 2.2) * k, color: o.hc || PAL.ice, alpha: o.hi * s, from: o.from, to: o.to, halo: 2.2 });
  };
  let zA = 0, zB = 0;
  if (!flat) {
    const zs = V.map((v) => v[2] - h0);
    zA = Math.max(Math.min(...zs) - 0.12 * R, -(h0 - 30)); zB = Math.max(...zs) + 0.42 * R;
    zA *= 0.15 + 0.85 * grow; zB *= 0.15 + 0.85 * grow;
  }
  if (sh > 0.003) {
    if (aH > 0.003 && !flat) {
      const rr = Math.sqrt(R * R + (zA * zA) / l2);
      f.save(); f.globalAlpha *= 0.14 * aH * sh; f.fillStyle = SHADOW; f.beginPath();
      for (const [rad, dir] of [[rr, 1], [R, -1]]) for (let i = 0; i <= 96; i++) { const ph = dir * (i / 96) * TAU, q = bp(P([C.x + rad * Math.cos(ph), C.y + rad * Math.sin(ph), 0])); i ? f.lineTo(q[0], q[1]) : f.moveTo(q[0], q[1]); }
      f.fill('nonzero'); f.restore();
    }
    const circ = []; for (let i = 0; i <= 120; i++) { const ph = (i / 120) * TAU; circ.push(P([C.x + R * Math.cos(ph), C.y + R * Math.sin(ph), 0])); }
    spoly(f, circ, { w: 9, color: SHADOW, alpha: 0.13 * sh }); spoly(f, circ, { w: 4, color: SHADOW, alpha: 0.32 * sh });
    for (let i = 0; i < 6; i++) shl(Wf[(i + 5) % 6], Wf[i], sh, { hi: foc1 > 0 && (i === 3 || i === 4) ? 0.55 * foc1 : 0 });
    for (let k = 0; k < 3; k++) {
      const a = dA > 0.003 ? dA : 1, to = dA > 0.003 ? 1 : drK(k);
      if ((dA <= 0.003 && to <= 0) || a <= 0.003) continue;
      const [p, q] = dA > 0.003 ? G.extend(Wv[k], Wv[k + 3], 24 / sc, 24 / sc) : (() => { const e = ext3(V[k], V[k + 3], 0.1); return [e[0], e[1]]; })();
      shl([p[0], p[1], 0], [q[0], q[1], 0], sh * a * dimOther(k), { to });
    }
    const bA = Math.max(dA, qRed);
    if (bA > 0.003) { const q = bp(P([B[0], B[1], 0])); f.save(); f.globalAlpha *= 0.45 * sh * bA; f.fillStyle = SHADOW; f.beginPath(); f.arc(q[0], q[1], 13 * Math.sqrt(P([B[0], B[1], 0])[2]), 0, TAU); f.fill(); f.restore(); }
    // ① the two shadow segments at vertex 4 have equal length (tick marks)
    if (foc1 > 0.003) {
      for (const a of [A[3], A[4]]) sline(f, P(fl(a)), P(Wf[3]), { w: 5.5, color: PAL.cream, alpha: 0.95 * foc1, halo: 2.6 });
      ticks(f, P, fl(A[3]), Wf[3], foc1, 1); ticks(f, P, fl(A[4]), Wf[3], foc1, 1);
      for (const a of [A[3], A[4]]) { const q = P(fl(a)); sdot(f, q, { r: 5 * Math.sqrt(q[2]), color: PAL.cream, alpha: foc1 }); }
    }
    // ③ shadows of the two extended opposite sides meet at T (tick marks: equal tangent lengths)
    for (const p of pairs) {
      if (p.Sh <= 0.003) continue;
      const pl = PLANE[p.k], T = fl(PK[pl.p]);
      for (const e of [pl.e1, pl.e2]) {
        const [a, b] = Sd(e), near = G.len3(G.sub3(a, PK[pl.p])) < G.len3(G.sub3(b, PK[pl.p])) ? a : b, far = near === a ? b : a;
        const ov2 = G.add3(T, G.mul3(G.sub3(T, fl(near)), 40 / (sc * Math.max(1, G.len3(G.sub3(T, fl(near)))))));
        shl(fl(far), ov2, sh * p.Sh, { hi: 0.95 * p.Sh, hc: FAMC[famOf(e)], hw: 3.4 });
        sline(f, P(fl(A[e])), P(T), { w: 5.5, color: PAL.cream, alpha: 0.9 * p.Sh, halo: 2.6 });   // the two equal tangent lengths
        ticks(f, P, fl(A[e]), T, p.Sh, p.k === 1 ? 1 : 0);
      }
      const q = P(T); sdot(f, q, { r: 6.5 * Math.sqrt(q[2]), color: PAL.cream, alpha: p.Sh });
      ringWave(f, q, at(p.shad[0] + 0.4, 0.5), { R: 46, w: 3, color: PAL.cream, alpha: 0.8 });
    }
    // ⑤ the shadow, recoloured: it IS the planar Brianchon figure
    if (ov > 0.003) {
      spoly(f, circ, { w: 2.6, color: PAL.gold, alpha: 0.6 * ov });
      for (let i = 0; i < 6; i++) sline(f, P(Wf[(i + 5) % 6]), P(Wf[i]), { w: 3.2, color: PAL.ice, alpha: 0.9 * ov, halo: 2.4 });
      for (let k = 0; k < 3; k++) { const e = ext3(V[k], V[k + 3], 0.1); sline(f, P(fl(e[0])), P(fl(e[1])), { w: 3.2, color: PAIR[k], alpha: 0.95 * ov, halo: 2.4 }); }
      const q = P([B[0], B[1], 0]);
      ball(f, q, 10.5 * Math.sqrt(q[2]), BALL.red, { alpha: ov * bSh, halo: 3.4 + 2.5 * pulse(n, 136, 0.1, 1.4) });
    }
  }
  // ---------------------------------------------------------------- Act IV: the glass waist plane
  if (gA > 0.003) drawGlass(f, st, gA, n);
  // ---------------------------------------------------------------- hyperboloid back sheet
  let faces = null;
  if (!flat && aH > 0.003) {
    faces = surfaceFaces(st, eye, lamS, zA, zB);
    const lb = LY.get(1); lb.setTransform(f.getTransform()); paintFaces(lb, faces, false); blitLayer(f, lb, 0.46 * aH);
  }
  // rulings + rims (two families of straight lines)
  const rul = { front: [], back: [] };
  if (faces) {
    const NR = 18;
    for (const fam of [1, -1]) for (let j = 0; j < NR; j++) {
      const ps = (j / NR) * TAU + (fam > 0 ? 0 : Math.PI / NR), c0 = Math.cos(ps), s0 = Math.sin(ps);
      // a ruling through the waist point at angle ps: from height zA to zB
      const uA = zA / (fam * lamS), uB = zB / (fam * lamS), pts = [];
      for (let i = 0; i <= 24; i++) { const u = uA + ((uB - uA) * i) / 24; pts.push([C.x + R * c0 - s0 * u, C.y + R * s0 + c0 * u, h0 + fam * lamS * u]); }
      const hi = famHi(fam), dr = hi > 0 ? clamp((n - (famT0(fam) + 0.05 * j)) / 0.6) : 1;
      for (const pc of splitPoly(pts, facing)) (pc.front ? rul.front : rul.back).push({ pts: pc.pts, fam, hi, dr });
    }
    for (const zz of [zB, zA]) {
      const rr = Math.sqrt(R * R + (zz * zz) / l2), pts = [];
      for (let i = 0; i <= 120; i++) { const ph = (i / 120) * TAU; pts.push([C.x + rr * Math.cos(ph), C.y + rr * Math.sin(ph), h0 + zz]); }
      for (const pc of splitPoly(pts, facing)) (pc.front ? rul.front : rul.back).push({ pts: pc.pts, rim: true });
    }
  }
  const drawRul = (list, front) => {
    for (const pc of list) {
      const pts = pc.pts.map(P);
      if (pc.rim) { spoly(f, pts, { w: front ? 2.4 : 1.6, color: PAL.ice, alpha: (front ? 0.85 : 0.42) * aH }); continue; }
      spoly(f, pts, { w: 1.2, color: PAL.ice, alpha: (front ? 0.2 : 0.11) * aH * (1 - pc.hi) });
      if (pc.hi > 0.003) spoly(f, pts, { w: front ? 3 : 2, color: FAMC[pc.fam], alpha: (front ? 0.95 : 0.45) * pc.hi * Math.max(aH, 0.6), to: pc.dr, halo: front ? 2 : 0 });
    }
  };
  drawRul(rul.back, false);
  // ---------------------------------------------------------------- pieces on the surface (back sheet first)
  const sides = [];
  for (let i = 0; i < 6; i++) {
    const [a, b] = Sd(i);
    for (const pc of splitPoly(sampleSeg(a, b), facing)) sides.push({ i, front: pc.front, a: pc.pts[0], b: pc.pts[pc.pts.length - 1] });
  }
  const waist = []; for (let i = 0; i <= 160; i++) { const ph = (i / 160) * TAU; waist.push([C.x + R * Math.cos(ph), C.y + R * Math.sin(ph), h0]); }
  const waistPcs = splitPoly(waist, facingWaist);
  const edgeCol = (i) => mixHex(PAL.ice, FAMC[famOf(i)], edgeFam(i));
  const edgeDk = (i) => mixHex('#2F5F8C', FAMD[famOf(i)], edgeFam(i));
  const drawPieces = (front) => {
    for (const pc of waistPcs) {
      if (pc.front !== front) continue;
      const pts = pc.pts.map(P);
      if (lit > 0.01) spoly(f, pts, { w: 6.6, color: OUTL, alpha: 0.6 * lit * fd });
      spoly(f, pts, { w: 3.4, color: PAL.gold, alpha: 0.9 * fd });
      if (lit > 0.01) spoly(f, pts, { w: 1.1, color: PAL.cream, alpha: 0.5 * lit * fd });
    }
    for (const s of sides) {
      if (s.front !== front) continue;
      const bo = edgeBoost(s.i);
      tube(f, P(s.a), P(s.b), { w: 6 + 3 * bo, w0: 3.2, color: edgeCol(s.i), dark: edgeDk(s.i), lit, cap: 'butt', alpha: fd, halo: bo > 0.01 ? 1 + 1.6 * bo : undefined });
    }
    for (let i = 0; i < 6; i++) {
      const p = wa(A[i]);
      if ((facingWaist(p) > 0) !== front) continue;
      const q = P(p);
      if (II || hexA <= 0) ball(f, q, 4.6 * Math.sqrt(q[2]), BALL.ice, { lit, alpha: fd });
    }
    for (let i = 0; i < 6; i++) {
      if ((facing(V[i]) > 0) !== front) continue;
      const q = P(V[i]);
      ball(f, q, 8.5 * Math.sqrt(q[2]), BALL.ice, { lit, alpha: fd });
    }
  };
  drawPieces(false);
  if (II) drawInsert(f, st, 0, { wa, D });
  // ---------------------------------------------------------------- Act IV: hexagon on the glass, roofs, traces
  if (!II) drawDandelinLow(f, st, n, { hexA, roofDemo, roofFlash, trace, sideHi, bigPl, at });
  // ---------------------------------------------------------------- interior: pair planes, diagonals, crossings, Q
  if (!flat) for (const p of pairs) {
    const pl = PLANE[p.k], Pp = PK[pl.p], col = PCOL(p.k);
    const farOf = (e) => { const [a, b] = Sd(e); return G.len3(G.sub3(a, Pp)) > G.len3(G.sub3(b, Pp)) ? a : b; };
    const nearOf = (e) => { const [a, b] = Sd(e); return G.len3(G.sub3(a, Pp)) > G.len3(G.sub3(b, Pp)) ? b : a; };
    if (p.Sw > 0.003) {
      const f1 = farOf(pl.e1), f2 = farOf(pl.e2), u = p.Sw;
      const tri = [Pp, G.lerp3(Pp, f1, u), G.lerp3(Pp, f2, u)].map(P);
      sfill(f, tri, col, 0.22 * Math.min(1, u * 3));
      sline(f, tri[1], tri[2], { w: 2.4, color: col, alpha: 0.8 * (1 - ramp(0.9, 1, u)) * Math.min(1, u * 4), halo: 2 });   // the sweeping edge
    }
    if (p.Qd > 0.003) {
      const qd = [nearOf(pl.e1), farOf(pl.e1), farOf(pl.e2), nearOf(pl.e2)].map(P);
      sfill(f, qd, col, 0.3 * p.Qd);
      for (let e = 0; e < 4; e++) sline(f, qd[e], qd[(e + 1) % 4], { w: 2.2, color: col, alpha: 0.85 * p.Qd, dash: e % 2 ? [8, 8] : null });
    }
  }
  for (let k = 0; k < 3; k++) {
    const dk = mixHex(PAIR[k], '#0B1320', 0.5);
    if (dA > 0.003) {
      const [p, q] = G.extend(Wv[k], Wv[k + 3], 24 / sc, 24 / sc);
      tube(f, P(wa(p)), P(wa(q)), { w: 5, w0: 3, color: PAIR[k], dark: dk, lit, alpha: dA, halo: 2 * (1 - lit) });
    }
    const dr = drK(k);
    if (dr > 0 && !flat) {
      const bo = diagBoost(k), [a3, b3] = ext3(V[k], V[k + 3], 0.1);
      tube(f, P(a3), P(b3), { w: 5 + 2.5 * bo, color: PAIR[k], dark: dk, lit: 1, to: dr, tip: dr < 1, halo: 1 + 2 * bo, alpha: fd * dimOther(k) * (1 - 0.7 * ins) });
    }
  }
  // crossings of each pair (all at Q — step ④ explains why that is no accident)
  for (const p of pairs) {
    if (p.Cx <= 0 || n > 124.2) continue;
    const q = P(Q);
    sdot(f, q, { r: 8 * Math.sqrt(q[2]), s: E.outBack(p.Cx, 2.4), color: '#FFFFFF', core: PAL.cream, halo: 3, alpha: (1 - ramp(123.8, 124.1, n)) * (1 - 0.75 * ins) });
    ringWave(f, q, at(p.cross, 0.55), { R: 70, w: 3.5, color: PCOL(p.k) });
  }
  if (dA > 0.003) { const q = P(wa(B)); ball(f, q, 11 * Math.sqrt(q[2]), BALL.red, { lit, alpha: dA, halo: 3 }); }
  if (qRed > 0 && !flat) { const q = P(Q); ball(f, q, 12 * Math.sqrt(q[2]) * E.outBack(qRed, 2.6), BALL.red, { halo: 3.5 + 3 * pulse(S.cuN('slam124'), 0, 0.05, 1.2) }); }
  // ---------------------------------------------------------------- near sheet
  if (faces) { const lf = LY.get(2); lf.setTransform(f.getTransform()); paintFaces(lf, faces, true); blitLayer(f, lf, 0.3 * aH); }
  drawRul(rul.front, true);
  if (faces) {
    for (const cv of silhouettes(st, eye, lamS, zA, zB)) {
      let run = [];
      const flush = () => { if (run.length > 1) spoly(f, run, { w: 2.6, color: PAL.ice, alpha: 0.9 * aH }); run = []; };
      for (const p of cv) { if (p) run.push(P(p)); else flush(); }
      flush();
    }
    const gl = glint(st, eye, lamS, zA, zB).filter(Boolean).map((g) => ({ q: P(g.p), m: g.m }));
    if (gl.length > 2) for (const [wk, al] of [[3.2, 0.1], [1, 0.55]]) {
      const L = [], Rr = [];
      for (let j = 0; j < gl.length; j++) {
        const a = gl[Math.max(0, j - 1)].q, b = gl[Math.min(gl.length - 1, j + 1)].q, q = bp(gl[j].q);
        const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, hw = wk * 5.2 * Math.pow(gl[j].m, 0.8) * Math.sqrt(gl[j].q[2]);
        L.push([q[0] - (dy / l) * hw, q[1] + (dx / l) * hw]); Rr.push([q[0] + (dy / l) * hw, q[1] - (dx / l) * hw]);
      }
      f.save(); f.globalAlpha *= al * aH; f.fillStyle = '#FFFFFF'; f.beginPath();
      L.forEach((p, i) => (i ? f.lineTo(p[0], p[1]) : f.moveTo(p[0], p[1]))); for (let i = Rr.length - 1; i >= 0; i--) f.lineTo(Rr[i][0], Rr[i][1]);
      f.closePath(); f.fill(); f.restore();
    }
  }
  drawPieces(true);
  // ---------------------------------------------------------------- overlays (outside the surface)
  // ③ extensions of the two opposite sides to their meeting point P, the vertical ray from its shadow T
  for (const p of pairs) {
    const pl = PLANE[p.k], Pp = PK[pl.p];
    if (p.X > 0.003) for (const e of [pl.e1, pl.e2]) {
      const [a, b] = Sd(e), near = G.len3(G.sub3(a, Pp)) < G.len3(G.sub3(b, Pp)) ? a : b;
      const over = G.add3(Pp, G.mul3(G.sub3(Pp, near), 34 / (sc * G.len3(G.sub3(Pp, near)))));
      tube(f, P(near), P(over), { w: 4.2, color: FAMC[famOf(e)], dark: FAMD[famOf(e)], lit: 1, to: p.X, tip: p.X < 1, tipR: 16, alpha: 0.95, halo: 1.6 });
    }
    if (p.Ry > 0.003) {
      const q0 = P(fl(Pp)), q1 = P(Pp);
      sline(f, q0, q1, { w: 2.4, color: PAL.cream, alpha: 0.9 * p.Ry, dash: [7, 9], dashOff: -t * 60, to: E.out2(clamp((n - p.ray[0]) / 0.8)) });
    }
    if (p.Pp > 0) {
      const q = P(Pp);
      ball(f, q, 11 * Math.sqrt(q[2]) * E.outBack(p.Pp, 2.6), BALL.gold, { halo: 3 + 2 * pulse(n, p.pop, 0.05, 1) });
      ringWave(f, q, at(p.pop, 0.5), { R: 64, w: 3.5, color: PAL.cream });
      if (p.k === 1) lbl(f, 'P', [q[0] - 34, q[1] - 30], { size: 44, alpha: p.Pp * (1 - ramp(p.end[0], p.end[1], n)), D, anim: popIn(t, bt(p.pop + 0.1), 0, 0.24) });
    }
    if (p.Cx > 0 && n < 114.5) {   // check mark next to the crossing
      const q = P(Q), a = p.Cx * (1 - ramp(p.end[0], p.end[1], n));
      if (a > 0.003) check(f, [q[0] + 46, q[1] - 36], 46, { color: PCOL(p.k), alpha: a, u: clamp((n - p.cross - 0.15) / 0.4) });
    }
    for (const [j, r0] of [[0, p.rings[0]], [1, p.rings[1]]]) {     // endpoint rings
      if (n < r0 || n > r0 + 1) continue;
      const vs = p.k === 1 ? (j === 0 ? [1, 2] : [4, 5]) : (j === 0 ? PLANE[p.k].verts : []);
      for (const v of vs) ringWave(f, P(V[v]), at(r0, 0.6), { R: 52, w: 3.5, color: PAL.cream });
    }
    if (n > p.vring && n < p.vring + 1) for (const v of PLANE[p.k].verts) ringWave(f, P(V[v]), at(p.vring, 0.6), { R: 52, w: 3.5, color: PCOL(p.k) });
  }
  // ① step detail: the two equal tangent segments rise equally to vertex 4
  if (foc1 > 0.003) {
    const q0 = P(Wf[3]), q1 = P(V[3]);
    sline(f, q0, q1, { w: 2.4, color: PAL.cream, alpha: 0.95 * foc1, dash: [7, 9], dashOff: -t * 60 });
    if (n > 57.2 && n < 58.4) ringWave(f, q1, at(57.2, 0.6), { R: 60, w: 3.5, color: PAL.cream });
  }
  if (II && n > 58.3 && n < 60.4) for (let i = 0; i < 6; i++) ringWave(f, P(V[i]), at(58.4 + 0.22 * i, 0.55), { R: 54, w: 3.2, color: PAL.cream });
  // vertical light rays: every point drops straight down onto its shadow
  const dropA = Math.min(1, sh) * (II ? 0.14 + 0.66 * Math.max(rayA, 0.75 * arrows) : 0.12);
  if (dropA > 0.003) {
    const dash = [5 + 2 * rayA, 8], off = -t * 70 * rayA;
    for (let i = 0; i < 6; i++) sline(f, P(V[i]), P(Wf[i]), { w: 1.5 + 0.8 * rayA, color: PAL.cream, alpha: dropA, dash, dashOff: off });
    if (qRed > 0 && !flat) {
      const q0 = P(Q), q1 = P([B[0], B[1], 0]);
      if (rayA > 0.003) sline(f, q0, q1, { w: 12, color: PAL.cream, alpha: 0.1 * rayA });
      sline(f, q0, q1, { w: 2 + 0.6 * rayA, color: PAL.cream, alpha: Math.min(1, dropA * 1.15) * qRed, dash, dashOff: off });
    }
  }
  // ① arrows while the sides tilt; ④ up / down relative to the waist
  if (arrows > 0.003 || updn > 0.003) for (let i = 0; i < 6; i++) {
    const up = V[i][2] > h0;
    const a0 = P(wa(Wv[i])), a1 = P(V[i]);
    if (updn > 0.003) {
      const pu = clamp((n - (121.2 + 0.3 * i)) / 0.3);
      if (pu > 0) {
        sline(f, a0, a1, { w: 3, color: up ? '#FFD27A' : '#7FD8FF', alpha: updn * pu, halo: 1.8 });
        sdot(f, a0, { r: 4.5, color: PAL.cream, alpha: updn * pu });
        const d = G.nrm(G.sub(a1, a0)), q = [a1[0] + d[0] * 30, a1[1] + d[1] * 30];
        lbl(f, up ? '上' : '下', [q[0] + 30, q[1]], { font: 'SB', size: 40, fill: up ? '#FFD27A' : '#7FD8FF', alpha: updn * pu, D, anim: popIn(t, bt(121.2 + 0.3 * i), 0, 0.24) });
      }
    }
    if (arrows > 0.003) {
      const q = P(V[i]), dy = up ? -1 : 1;
      arrow(f, [q[0] + 26, q[1] + 26 * dy], [q[0] + 26, q[1] + 70 * dy], { color: PAL.cream, alpha: arrows * 0.9 });
    }
  }
  if (II) drawInsert(f, st, 1, { wa, D });
  // vertex numbers 1–6
  if (labA > 0.003) {
    const O = P([C.x, C.y, h0]), qs = V.map((v) => P(v));
    const anc = qs.map((q) => { const d = G.nrm(G.sub(q, O)); return [q[0] + d[0] * 36, q[1] + d[1] * 36]; });
    const ps = anc.map((a) => [a[0], a[1]]);
    for (let it = 0; it < 12; it++) {          // soft repulsion: labels keep clear of each other and of the other vertices
      for (let i = 0; i < 6; i++) for (let j = i + 1; j < 6; j++) {
        const dx = ps[j][0] - ps[i][0], dy = ps[j][1] - ps[i][1], dd = Math.hypot(dx, dy) || 1e-3, m = 54;
        if (dd < m) { const k = 0.25 * (m - dd) / dd; ps[i][0] -= dx * k; ps[i][1] -= dy * k; ps[j][0] += dx * k; ps[j][1] += dy * k; }
      }
      for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) {
        if (i === j) continue;
        const dx = ps[i][0] - qs[j][0], dy = ps[i][1] - qs[j][1], dd = Math.hypot(dx, dy) || 1e-3, m = 34;
        if (dd < m) { const k = 0.5 * (m - dd) / dd; ps[i][0] += dx * k; ps[i][1] += dy * k; }
      }
      for (let i = 0; i < 6; i++) { ps[i][0] += (anc[i][0] - ps[i][0]) * 0.08; ps[i][1] += (anc[i][1] - ps[i][1]) * 0.08; }
    }
    const Fm = pairs.reduce((m, pp) => Math.max(m, pp.F), 0);
    for (let i = 0; i < 6; i++) {
      const hl = pairs.some((pp) => pp.F > 0.5 && PLANE[pp.k].verts.includes(i));
      const al = labA * (hl ? 1 : 0.85 * (1 - 0.6 * Fm)) * (1 - 0.75 * updn) * (1 - ins);
      lbl(f, String(i + 1), ps[i], { size: 40, fill: hl ? '#FFFFFF' : '#DDF6FF', alpha: al, D, seed: 90 + i, anim: popIn(t, bt(52.6 + 0.12 * i), 0, 0.24, { rot: 0.1 }) });
    }
  }
  // Q glows through the glass
  if (qRed > 0 && !flat) {
    const q = bp(P(Q)), r = 30 + 26 * pulse(S.cuN('slam124'), 0, 0.05, 1.2);
    f.save(); f.globalCompositeOperation = 'lighter';
    const g = f.createRadialGradient(q[0], q[1], 0, q[0], q[1], r);
    g.addColorStop(0, rgba('#FF8FA3', 0.35 * qRed)); g.addColorStop(1, rgba(PAL.red, 0));
    f.fillStyle = g; f.beginPath(); f.arc(q[0], q[1], r, 0, TAU); f.fill(); f.restore();
  }
  if (!II) drawDandelinHigh(f, st, t, n, { extIV, pIV, sigA, sideHi, sideFl, xPop, redA, at, D });
}

// ---------------------------------------------------------------- ④ insert (video beats 123–127, the story waits at 123)
// If the three diagonals formed a triangle, all six vertices would lie in one plane Π. Π meets the waist plane in a
// line ℓ: on one side of ℓ, Π is above the waist (高), on the other below (低). So, seen from above, the feet of the
// 上-vertices would all sit on one side of ℓ and the 下-ones on the other — but they alternate round the hexagon,
// so every line ℓ leaves some of them on the wrong side (red rings).
const INS_TH0 = 55;   // ℓ starts at 55° (two feet on the wrong side) and turns half a turn
function insLine(nv) { return (INS_TH0 + 180 * E.io2(inv(124.15, 126.15, nv))) * Math.PI / 180; }
function drawInsert(f, st, layer, o) {
  const nv = st.nv;
  if (!(nv > 122.95 && nv < 127.05)) return;
  const tv = globalThis.__TVB ?? st.t, at = (n0, d) => (tv - bt(n0)) / d;
  const P = st.P, C = st.C, R = C.r, h0 = st.h0, V = st.lift.V, Wv = st.bri.W, D = o.D;
  const A = win(nv, 123.0, 123.35, 126.15, 126.6);
  if (A <= 0.003) return;
  const th = insLine(nv), d = [Math.cos(th), Math.sin(th)], nr = [-d[1], d[0]];
  const off = 0.3 * R * Math.sin(TAU * E.io2(inv(124.15, 126.15, nv)));            // ℓ also slides sideways: ANY line, not only through the centre
  const Oc = [C.x + nr[0] * off, C.y + nr[1] * off], O = [Oc[0], Oc[1], h0];
  const lnA = A * ramp(123.75, 124.1, nv), lnGrow = E.out2(ramp(123.75, 124.2, nv, 'lin'));
  const up = V.map((v) => v[2] > h0);
  const sd = Wv.map((w) => (w[0] - Oc[0]) * nr[0] + (w[1] - Oc[1]) * nr[1]);         // signed distance from ℓ (+ = 高 side)
  if (layer === 0) {
    // the two half-planes of the waist plane, tinted 高 (gold) / 低 (blue)
    if (lnA > 0.003) {
      const rT = 2.75 * R, q0 = P(O);
      for (const [sg, col] of [[1, '#FFD27A'], [-1, '#7FD8FF']]) {
        const pts = [];
        for (let i = 0; i <= 48; i++) { const ph = th + (sg > 0 ? 0 : Math.PI) + (i / 48) * Math.PI; pts.push(P([Oc[0] + rT * Math.cos(ph), Oc[1] + rT * Math.sin(ph), h0])); }
        let rs = 1; for (const q of pts) rs = Math.max(rs, Math.hypot(q[0] - q0[0], q[1] - q0[1]));
        const g = f.createRadialGradient(q0[0], q0[1], 0, q0[0], q0[1], rs);
        g.addColorStop(0, rgba(col, 0.2 * lnA)); g.addColorStop(0.55, rgba(col, 0.15 * lnA)); g.addColorStop(1, rgba(col, 0));
        f.save(); f.fillStyle = g; f.beginPath();
        pts.forEach((q, i) => { const b = bp(q); i ? f.lineTo(b[0], b[1]) : f.moveTo(b[0], b[1]); });
        f.closePath(); f.fill(); f.restore();
      }
    }
    return;
  }
  // ℓ itself (red), drawn out from the centre
  if (lnA > 0.003) {
    const L = 2.7 * R * lnGrow, a = P([Oc[0] - d[0] * L, Oc[1] - d[1] * L, h0]), b = P([Oc[0] + d[0] * L, Oc[1] + d[1] * L, h0]);
    const cr = clipRect(a, b, 18, 674, 1062, 1432);                                 // keep ℓ between the cards and the pills, soft ends
    if (cr) {
      const sl = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, fd = Math.min(0.45 * (cr[1] - cr[0]), 90 / sl), NP = 7;
      const seg = (u0, u1, al) => { sline(f, a, b, { from: u0, to: u1, w: 10, color: PAL.red, alpha: 0.18 * lnA * al }); sline(f, a, b, { from: u0, to: u1, w: 4, color: PAL.red, alpha: 0.95 * lnA * al, halo: 2.2 }); };
      seg(cr[0] + fd, cr[1] - fd, 1);
      for (let k = 0; k < NP; k++) {
        const al = (k + 0.5) / NP, u = fd / NP;
        seg(cr[0] + k * u, cr[0] + (k + 1) * u + 0.002, al); seg(cr[1] - (k + 1) * u - 0.002, cr[1] - k * u, al);
      }
      const ex = lerp(a[0], b[0], cr[1] - fd * 1.15), ey = lerp(a[1], b[1], cr[1] - fd * 1.15), sdx = (b[0] - a[0]) / sl, sdy = (b[1] - a[1]) / sl;
      lbl(f, 'ℓ', [ex - sdy * 30, ey + sdx * 30], { font: 'SM', size: 42, fill: '#FF8FA3', alpha: lnA, D, seed: 61, knock: 6 });
    }
    for (const [sg, s, col] of [[1, '高', '#FFD27A'], [-1, '低', '#7FD8FF']]) {   // side badges, either side of ℓ
      const q = bp(P([Oc[0] + sg * nr[0] * 0.6 * R, Oc[1] + sg * nr[1] * 0.6 * R, h0])), r = 31 * E.outBack(clamp((nv - 123.95) / 0.3), 2.4);
      if (r <= 0.5) continue;
      f.save(); f.globalAlpha *= lnA; f.shadowColor = 'rgba(0,0,0,0.5)'; f.shadowBlur = 8;
      f.beginPath(); f.arc(q[0], q[1], r, 0, TAU); f.fillStyle = col; f.fill(); f.shadowBlur = 0;
      f.lineWidth = 3; f.strokeStyle = 'rgba(11,19,32,0.85)'; f.stroke(); f.restore();
      lbl(f, s, [q[0], q[1] + 1], { font: 'SB', size: 40 * r / 31, fill: '#0B1320', alpha: lnA, D, seed: sg > 0 ? 62 : 63, knock: 0 });
    }
  }
  // the six feet (vertical shadows of the vertices on the waist plane): gold = 上, blue = 下; red ring = wrong side of ℓ
  for (let i = 0; i < 6; i++) {
    const q = P(o.wa(Wv[i])), s = E.outBack(clamp((nv - (123.25 + 0.1 * i)) / 0.3), 2.6);
    if (s <= 0.01) continue;
    const bad = lnA * clamp(0.5 - (up[i] ? 1 : -1) * sd[i] / (0.16 * R));
    if (bad > 0.01) {
      const r = (19 + 4 * Math.sin(tv * 14)) * Math.sqrt(q[2]);
      f.save(); f.globalAlpha *= A * bad; f.lineWidth = 4; f.strokeStyle = PAL.red; f.shadowColor = PAL.red; f.shadowBlur = 10;
      const b = bp(q); f.beginPath(); f.arc(b[0], b[1], r, 0, TAU); f.stroke(); f.restore();
    }
    ball(f, q, 9.5 * Math.sqrt(q[2]) * s, up[i] ? BALL.gold : BALL.ice, { alpha: A, halo: 1.6 + 1.6 * (1 - clamp(at(123.25 + 0.1 * i, 0.4))) });
  }
}

// ---------------------------------------------------------------- helpers
// Liang–Barsky: parameter interval of screen segment ab inside the rectangle, or null
function clipRect(a, b, x0, y0, x1, y1) {
  let t0 = 0, t1 = 1; const dx = b[0] - a[0], dy = b[1] - a[1];
  for (const [p, q] of [[-dx, a[0] - x0], [dx, x1 - a[0]], [-dy, a[1] - y0], [dy, y1 - a[1]]]) {
    if (Math.abs(p) < 1e-9) { if (q < 0) return null; continue; }
    const r = q / p; if (p < 0) { if (r > t1) return null; if (r > t0) t0 = r; } else { if (r < t0) return null; if (r < t1) t1 = r; }
  }
  return t1 - t0 > 1e-4 ? [t0, t1] : null;
}
function K2(n, keys) { if (n <= keys[0][0]) return keys[0][1]; for (let i = 1; i < keys.length; i++) if (n <= keys[i][0]) { const u = E.io2((n - keys[i - 1][0]) / (keys[i][0] - keys[i - 1][0])); return keys[i - 1][1] + (keys[i][1] - keys[i - 1][1]) * u; } return keys[keys.length - 1][1]; }
// equal-length marks: two short ticks across the middle of segment ab (3-D points, projected)
function ticks(f, P, a, b, alpha, dbl, col = PAL.gold) {
  const pa = P(a), pb = P(b), m = [(pa[0] + pb[0]) / 2, (pa[1] + pb[1]) / 2];
  const d = G.nrm(G.sub(pb, pa)), nn = [-d[1], d[0]], L = 17, gap = dbl ? 7 : 0;
  for (const s of dbl ? [-1, 1] : [0]) {
    const c = [m[0] + d[0] * gap * s, m[1] + d[1] * gap * s];
    sline(f, [c[0] - nn[0] * L, c[1] - nn[1] * L], [c[0] + nn[0] * L, c[1] + nn[1] * L], { w: 9, color: SHADOW, alpha: 0.55 * alpha });
    sline(f, [c[0] - nn[0] * L, c[1] - nn[1] * L], [c[0] + nn[0] * L, c[1] + nn[1] * L], { w: 4.5, color: col, alpha, halo: 1.6 });
  }
}
function arrow(f, a, b, o) {
  const d = G.nrm(G.sub(b, a)), nn = [-d[1], d[0]], h = 12;
  sline(f, a, b, { w: 3, color: o.color, alpha: o.alpha });
  sline(f, b, [b[0] - d[0] * h + nn[0] * h * 0.7, b[1] - d[1] * h + nn[1] * h * 0.7], { w: 3, color: o.color, alpha: o.alpha });
  sline(f, b, [b[0] - d[0] * h - nn[0] * h * 0.7, b[1] - d[1] * h - nn[1] * h * 0.7], { w: 3, color: o.color, alpha: o.alpha });
}
// Act IV glass: the waist plane as a large translucent disc
function drawGlass(f, st, a, n) {
  const P = st.P, C = st.C, h0 = st.h0, R = C.r, Rg = 4.3 * R;
  const pts = []; for (let i = 0; i <= 96; i++) { const ph = (i / 96) * TAU; pts.push(P([C.x + Rg * Math.cos(ph), C.y + Rg * Math.sin(ph), h0])); }
  const o = P([C.x, C.y, h0]);
  f.save(); f.globalAlpha *= a;
  f.beginPath(); pts.forEach((q, i) => (i ? f.lineTo(q[0], q[1]) : f.moveTo(q[0], q[1]))); f.closePath();   // path in screen space…
  const rx = Math.max(...pts.map((q) => Math.abs(q[0] - o[0]))), ry = Math.max(...pts.map((q) => Math.abs(q[1] - o[1])));
  f.translate(o[0], o[1]); f.scale(1, Math.max(0.05, ry / rx));                                             // …gradient squashed onto the ellipse
  const g = f.createRadialGradient(0, 0, 0, 0, 0, rx);
  g.addColorStop(0, 'rgba(159,232,255,0.13)'); g.addColorStop(0.7, 'rgba(159,232,255,0.08)'); g.addColorStop(1, 'rgba(159,232,255,0.0)');
  f.fillStyle = g; f.fill();
  f.restore();
  // faint concentric guide rings on the glass
  for (const k of [1.6, 2.4, 3.2]) {
    const q = []; for (let i = 0; i <= 96; i++) { const ph = (i / 96) * TAU; q.push(P([C.x + k * R * Math.cos(ph), C.y + k * R * Math.sin(ph), h0])); }
    spoly(f, q, { w: 1.2, color: PAL.ice, alpha: 0.09 * a * (1.3 - k / 4) });
  }
}
// Act IV, drawn under the interior: the inscribed (gold) hexagon on the glass, the roofs, the traces
function drawDandelinLow(f, st, n, o) {
  const P = st.P, A = st.A, V = st.lift.V, h0 = st.h0, X = st.pas.X, PK = st.Pk;
  const wa = (p) => [p[0], p[1], h0];
  const Aw = A.map((a) => P(wa(a)));
  // the roof demo (vertex 4: V₃ with A₃, A₄) and the six roofs flashing in turn
  for (let k = 0; k < 6; k++) {
    const a = k === 3 ? Math.max(o.roofDemo, o.roofFlash(k)) : o.roofFlash(k);
    if (a <= 0.003) continue;
    const tri = [P(V[k]), Aw[k], Aw[(k + 1) % 6]], col = FAMC[famOf(k)];
    sfill(f, tri, mixHex(col, '#FFFFFF', 0.3), 0.3 * a);
    sline(f, tri[0], tri[1], { w: 2, color: col, alpha: 0.8 * a }); sline(f, tri[0], tri[2], { w: 2, color: col, alpha: 0.8 * a });
    sline(f, tri[1], tri[2], { w: 5, color: '#FFF1C9', alpha: a, halo: 3 });
  }
  // the two big planes through side k of triangle P₀P₁P₂ (vertices k and k+3) — their traces on the glass
  for (let k = 0; k < 3; k++) {
    const a = o.bigPl(k);
    if (a <= 0.003) continue;
    const p0 = PK[k], p1 = PK[(k + 1) % 3];
    for (const v of [k, k + 3]) {
      const tri = [V[v], p0, p1].map(P), col = v === k ? '#FFC88A' : '#A8E6FF';
      sfill(f, tri, col, 0.2 * a);
      for (let e = 0; e < 3; e++) sline(f, tri[e], tri[(e + 1) % 3], { w: 1.8, color: col, alpha: 0.7 * a });
    }
  }
  // gold hexagon on the glass (draw-on), plus its opposite sides extended to the crossings X_k (traces of the planes)
  const ha = o.hexA * (1 - ramp(255.6, 256, n));
  if (ha > 0.003 || n > 220) {
    const pr = o.hexA * 6;
    for (let i = 0; i < 6; i++) { const fr = clamp(pr - i); if (fr > 0) sline(f, Aw[i], Aw[(i + 1) % 6], { w: 3.4, color: PAL.gold, to: fr, tip: fr < 1, alpha: 1 - ramp(255.6, 256, n) }); }
  }
  for (let k = 0; k < 3; k++) {
    const tr = o.trace(k);
    if (tr <= 0.003 || !X[k]) continue;
    for (const side of [k, k + 3]) {
      const p = A[side], q = A[(side + 1) % 6], near = G.dist(p, X[k]) < G.dist(q, X[k]) ? p : q;
      const over = G.add(X[k], G.mul(G.nrm(G.sub(X[k], near)), 50 / st.cam.s));
      sline(f, P(wa(near)), P(wa(over)), { w: 3, color: PAIR[k], to: tr, tip: tr < 1, alpha: 0.95 * (1 - ramp(255.6, 256, n)), halo: 2 });
      sline(f, Aw[side], Aw[(side + 1) % 6], { w: 4.4, color: mixHex(PAL.gold, PAIR[k], 0.7), alpha: tr * (1 - ramp(255.6, 256, n)) });
    }
  }
  for (let i = 0; i < 6; i++) { const pu = clamp((n - (216.2 + 0.2 * i)) / 0.3); if (pu > 0) sdot(f, Aw[i], { r: 8, s: E.outBack(pu, 2.4), color: PAL.gold, alpha: 1 - ramp(255.6, 256, n) }); }
}
// Act IV, drawn on top: extended opposite sides → P₀, P₁, P₂; triangle σ; its sides piercing the glass at X; the red line
function drawDandelinHigh(f, st, t, n, o) {
  const P = st.P, V = st.lift.V, PK = st.Pk, X = st.pas.X, h0 = st.h0, sc = st.cam.s;
  const Sd = (i) => [V[(i + 5) % 6], V[i]];
  const wa = (p) => [p[0], p[1], h0];
  for (let m = 0; m < 3; m++) {
    const ex = o.extIV(m);
    if (ex <= 0.003) continue;
    for (const e of [m, m + 3]) {
      const [a, b] = Sd(e), Pp = PK[m], near = G.len3(G.sub3(a, Pp)) < G.len3(G.sub3(b, Pp)) ? a : b;
      const over = G.add3(Pp, G.mul3(G.sub3(Pp, near), 30 / (sc * G.len3(G.sub3(Pp, near)))));
      tube(f, P(near), P(over), { w: 3.6, color: PAL.ice, dark: '#2F5F8C', lit: 1, to: ex, tip: ex < 1, tipR: 14, alpha: 0.9 });
    }
  }
  if (o.sigA > 0.003) {
    const tri = PK.map(P);
    sfill(f, tri, '#FF8FA3', 0.12 * o.sigA);
    for (let k = 0; k < 3; k++) sline(f, tri[k], tri[(k + 1) % 3], { w: 2, color: '#FFB3C0', alpha: 0.55 * o.sigA });
  }
  // side k of the triangle (P_k P_{k+1}), extended to where it pierces the glass (X_k)
  for (let k = 0; k < 3; k++) {
    const a = Math.max(o.sideHi(k), 0.85 * clamp((n - [241.8, 246.2, 247.9][k]) / 0.3)) * (1 - ramp(255.6, 256, n));
    if (a <= 0.003 || !X[k]) continue;
    const p0 = PK[k], p1 = PK[(k + 1) % 3], x3 = wa(X[k]);
    const pts = [p0, p1, x3];
    const d = G.sub3(p1, p0), u = (pp) => G.dot3(G.sub3(pp, p0), d) / G.dot3(d, d);
    const lo = Math.min(...pts.map(u)), hi = Math.max(...pts.map(u));
    const e0 = G.add3(p0, G.mul3(d, lo - 0.06)), e1 = G.add3(p0, G.mul3(d, hi + 0.06));
    sline(f, P(e0), P(e1), { w: 3.4 + 2 * o.sideHi(k) + 1.6 * o.sideFl(k), color: PAIR[k], alpha: a, halo: 2 + 2 * o.sideHi(k) + 2.5 * o.sideFl(k) });
  }
  for (let m = 0; m < 3; m++) { const pp = o.pIV(m); if (pp > 0) { const q = P(PK[m]); ball(f, q, 10 * Math.sqrt(q[2]) * E.outBack(pp, 2.6), BALL.gold, { halo: 3 }); ringWave(f, q, o.at(229.2 + 0.7 * m, 0.5), { R: 60, w: 3.5, color: PAL.cream }); } }
  for (let k = 0; k < 3; k++) {
    const xp = o.xPop(k);
    if (xp <= 0 || !X[k]) continue;
    const q = P(wa(X[k]));
    sdot(f, q, { r: 10.5 * Math.sqrt(q[2]), s: E.outBack(xp, 2.6), color: PAIR[k], core: '#FFFFFF', halo: 3.2, alpha: 1 });
    ringWave(f, q, o.at([241.8, 246.2, 247.9][k], 0.55), { R: 80, w: 4, color: PAIR[k] });
  }
  if (o.redA > 0.003 && X.every(Boolean)) {
    const span = G.spanOf(X, 90 / sc);
    sline(f, P(wa(span[0])), P(wa(span[1])), { w: 4.6, color: PAL.red, to: o.redA, tip: o.redA < 1, tipR: 26, halo: 4, alpha: 1 - ramp(255.6, 256, n) });
  }
}
