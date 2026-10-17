// Lit 3-D section (beats 48–68) — "升到三维".
// The planar Brianchon figure floats up off the floor (its shadow stays behind under an overhead light), its sides
// tilt into rulings of a one-sheet hyperboloid (cel-shaded translucent glass, like Canton Tower), the three space
// diagonals meet at Q, and the overhead light shows that the shadow of it all is exactly the planar figure.
// Every element is the exact geometry of scene.js (lift V/Q, hover h0, λ); shading = 3-band cel ramp + rim + specular.
import { PAL, PAIR, clamp, inv, E } from './engine.js';
import * as G from './geo.js';
import * as S from './scene.js';
import { bp, rgba, mixHex, tip, sline, spoly, sfill } from './draw.js';

const TAU = Math.PI * 2;
const ramp = (a, b, n, e = 'io2') => E[e](inv(a, b, n));
const pulse = (n, n0, up, down) => (n < n0 ? 0 : n < n0 + up ? E.out2((n - n0) / up) : 1 - E.io2(clamp((n - n0 - up) / down)));
const sstep = (a, b, x) => { const u = clamp((x - a) / (b - a)); return u * u * (3 - 2 * u); };
const n3 = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const hex2rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const mix3 = (a, b, u) => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u];
const css = (c) => `rgb(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])})`;

export const LIGHT = n3([-0.5, 0.36, 0.79]);        // key light: high, front-left (cast shadows: straight down)
const SPEC = n3([-0.85, 0.5, 0.15]);               // glint light for the glass highlight
const SHADOW = '#02050B', OUTL = '#060E1A';
const FRONT = ['#3A6E9C', '#78BFE6', '#BDEFFF'].map(hex2rgb);
const BACK = ['#1C3E66', '#2F6190', '#4B86B5'].map(hex2rgb);
const RIM = hex2rgb('#E8FBFF'), WHITE = [255, 255, 255];
const BALL = {
  ice: ['#2F5F8C', '#9FE8FF', '#E6FBFF'],
  red: ['#8E1430', '#FF3B5C', '#FFB0BE'],
  gold: ['#8A6A2E', '#F2D9A0', '#FFF6E2'],
};

// camera eye in world space (inverse of scene.makeProj)
export function eyeOf(c) {
  const a = c.pitch * S.D2R, b = c.yaw * S.D2R, d = c.dist;
  return [c.x + d * Math.sin(a) * Math.sin(b), c.y + d * Math.sin(a) * Math.cos(b), c.z + d * Math.cos(a)];
}

// ---------------------------------------------------------------- floor light pool (overhead lamp)
export function drawPool(f, st, I) {
  if (I <= 0.003) return;
  const P = st.P, C = st.C, R = C.r * 2.6, h = 200;
  const o = P([C.x, C.y, 0]), px = P([C.x + h, C.y, 0]), py = P([C.x, C.y + h, 0]);
  f.save();
  f.transform((px[0] - o[0]) / h, (px[1] - o[1]) / h, (py[0] - o[0]) / h, (py[1] - o[1]) / h, o[0], o[1]);
  const g = f.createRadialGradient(0, 0, 0, 0, 0, R);
  g.addColorStop(0, rgba(PAL.cream, 0.17 * I)); g.addColorStop(0.45, rgba(PAL.cream, 0.1 * I)); g.addColorStop(1, rgba(PAL.cream, 0));
  f.fillStyle = g; f.beginPath(); f.arc(0, 0, R, 0, TAU); f.fill();
  f.restore();
}

// ---------------------------------------------------------------- primitives
// a glossy tube between projected points a, b (cel: dark outline, base, shade stripe, highlight stripe)
function tube(f, a, b, o) {
  const k = Math.sqrt(Math.max(0.35, (a[2] + b[2]) / 2));
  const L = o.lit ?? 1, al = o.alpha ?? 1;
  if (al <= 0.003) return;
  const w = (o.w0 !== undefined ? o.w0 + (o.w - o.w0) * L : o.w) * k;
  const cap = o.cap || 'round', from = o.from ?? 0, to = o.to ?? 1;
  if (L > 0.01) sline(f, a, b, { w: w + 3.4 * k, color: OUTL, alpha: 0.82 * al * L, cap, from, to });
  sline(f, a, b, { w, color: o.color, alpha: al, cap, from, to, halo: o.halo });
  if (L > 0.01) {
    const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
    let nx = -dy / l, ny = dx / l;
    if (nx + 0.8 * ny > 0) { nx = -nx; ny = -ny; }                    // toward the screen's upper-left (key light)
    const od = 0.27 * w, oh = 0.22 * w;
    sline(f, [a[0] - nx * od, a[1] - ny * od], [b[0] - nx * od, b[1] - ny * od], { w: 0.36 * w, color: o.dark || OUTL, alpha: 0.55 * al * L, cap, from, to });
    sline(f, [a[0] + nx * oh, a[1] + ny * oh], [b[0] + nx * oh, b[1] + ny * oh], { w: 0.3 * w, color: '#FFFFFF', alpha: 0.62 * al * L, cap, from, to });
  }
  if (o.tip && to < 1 && to > 0) tip(f, [a[0] + (b[0] - a[0]) * to, a[1] + (b[1] - a[1]) * to], o.tipR ?? 20, o.color, al);
}
// a cel-shaded ball (dark rim, shade, lit cap, highlight, specular, rim light)
function ball(f, q, r, pal, o = {}) {
  const a = o.alpha ?? 1, L = o.lit ?? 1;
  if (a <= 0.003 || r <= 0.3) return;
  const p = bp(q), [dk, md, lt] = pal;
  f.save(); f.globalAlpha *= a;
  if (o.halo) {
    f.save(); f.globalCompositeOperation = 'lighter';
    const g = f.createRadialGradient(p[0], p[1], 0, p[0], p[1], r * o.halo);
    g.addColorStop(0, rgba(md, 0.6)); g.addColorStop(1, rgba(md, 0));
    f.fillStyle = g; f.beginPath(); f.arc(p[0], p[1], r * o.halo, 0, TAU); f.fill(); f.restore();
  }
  const disk = (x, y, rr, col, al = 1) => { f.globalAlpha = a * al; f.beginPath(); f.arc(x, y, rr, 0, TAU); f.fillStyle = col; f.fill(); };
  disk(p[0], p[1], r + 2.8, OUTL, 0.92);
  disk(p[0], p[1], r, L > 0.5 ? dk : md);
  disk(p[0] - 0.13 * r, p[1] - 0.15 * r, 0.84 * r, md, L > 0.5 ? 1 : 0);
  disk(p[0] - 0.3 * r, p[1] - 0.34 * r, 0.44 * r, lt, 0.95 * L);
  disk(p[0] - 0.42 * r, p[1] - 0.46 * r, 0.17 * r, '#FFFFFF', L);
  f.globalAlpha = a * 0.55 * L; f.lineWidth = Math.max(1, 0.16 * r); f.strokeStyle = lt; f.lineCap = 'round';
  f.beginPath(); f.arc(p[0], p[1], 0.8 * r, 0.1 * Math.PI, 0.45 * Math.PI); f.stroke();
  f.restore();
}
// split a sampled 3-D polyline by the sign of fac (front > 0)
function splitPoly(pts, fac) {
  const out = []; let cur = null, pv = 0;
  for (let i = 0; i < pts.length; i++) {
    const v = fac(pts[i]), fr = v > 0;
    if (!cur) cur = { front: fr, pts: [pts[i]] };
    else if (fr !== cur.front) {
      const u = pv / (pv - v), m = G.lerp3(pts[i - 1], pts[i], u);
      cur.pts.push(m); out.push(cur); cur = { front: fr, pts: [m, pts[i]] };
    } else cur.pts.push(pts[i]);
    pv = v;
  }
  if (cur && cur.pts.length > 1) out.push(cur);
  return out;
}
const sampleSeg = (a, b, m = 36) => Array.from({ length: m + 1 }, (_, i) => G.lerp3(a, b, i / m));

// ---------------------------------------------------------------- the hyperboloid x²+y²−(z−h0)²/λ² = R²
function surfaceFaces(st, eye, lam, Zt, NU = 128, NV = 28) {
  const C = st.C, R = C.r, h0 = st.h0, P = st.P, l2 = lam * lam;
  const zs = [], rs = [];
  for (let j = 0; j <= NV; j++) { const z = -Zt + (2 * Zt * j) / NV; zs.push(z); rs.push(Math.sqrt(R * R + (z * z) / l2)); }
  const cs = [], sn = [];
  for (let i = 0; i <= NU; i++) { const ph = (i / NU) * TAU; cs.push(Math.cos(ph)); sn.push(Math.sin(ph)); }
  const scr = [];
  for (let j = 0; j <= NV; j++) { const row = []; for (let i = 0; i <= NU; i++) row.push(bp(P([C.x + rs[j] * cs[i], C.y + rs[j] * sn[i], h0 + zs[j]]))); scr.push(row); }
  const faces = [];
  for (let j = 0; j < NV; j++) for (let i = 0; i < NU; i++) {
    const zc = (zs[j] + zs[j + 1]) / 2, rc = Math.sqrt(R * R + (zc * zc) / l2), ph = ((i + 0.5) / NU) * TAU;
    const c0 = Math.cos(ph), s0 = Math.sin(ph);
    const p = [C.x + rc * c0, C.y + rc * s0, h0 + zc];
    const N = n3([rc * c0, rc * s0, -zc / l2]);
    const Vv = n3([eye[0] - p[0], eye[1] - p[1], eye[2] - p[2]]);
    const front = dot3(N, Vv) > 0;
    const Ns = front ? N : [-N[0], -N[1], -N[2]];
    faces.push({ q: [scr[j][i], scr[j][i + 1], scr[j + 1][i + 1], scr[j + 1][i]], d: P(p)[3], front, col: css(shade(Ns, Vv, front)) });
  }
  faces.sort((a, b) => b.d - a.d);
  return faces;
}
function shade(Ns, Vv, front) {
  const I = Math.max(0, dot3(Ns, LIGHT));
  const pal = front ? FRONT : BACK;
  let col = mix3(pal[0], pal[1], sstep(0.16, 0.34, I));                    // soft-edged cel bands
  col = mix3(col, pal[2], sstep(0.5, 0.66, I));
  col = mix3([0, 0, 0], col, 0.86 + 0.22 * I);                               // a little gradient inside each band
  const ndv = Math.abs(dot3(Ns, Vv));
  col = mix3(col, RIM, (front ? 0.75 : 0.3) * sstep(0.3, 0.08, ndv));       // fresnel rim band
  return col;
}
// the glint: for every height the brightest specular point of the near sheet → one smooth vertical streak
function glint(st, eye, lam, Zt, NZ = 36, NPH = 160) {
  const C = st.C, R = C.r, h0 = st.h0, l2 = lam * lam, out = [];
  for (let j = 0; j <= NZ; j++) {
    const z = -Zt + (2 * Zt * j) / NZ, r = Math.sqrt(R * R + (z * z) / l2);
    let best = -1, bp3 = null;
    for (let i = 0; i < NPH; i++) {
      const ph = (i / NPH) * TAU, c0 = Math.cos(ph), s0 = Math.sin(ph);
      const p = [C.x + r * c0, C.y + r * s0, h0 + z];
      const N = n3([r * c0, r * s0, -z / l2]), Vv = n3([eye[0] - p[0], eye[1] - p[1], eye[2] - p[2]]);
      if (dot3(N, Vv) <= 0.05) continue;
      const H = n3([SPEC[0] + Vv[0], SPEC[1] + Vv[1], SPEC[2] + Vv[2]]), v = dot3(N, H);
      if (v > best) { best = v; bp3 = p; }
    }
    out.push(bp3 ? { p: bp3, m: sstep(0.8, 0.985, best) } : null);
  }
  return out;
}
function paintFaces(x, faces, front) {
  x.lineJoin = 'round'; x.lineWidth = 1.4;
  for (const fc of faces) {
    if (fc.front !== front) continue;
    const q = fc.q;
    x.beginPath(); x.moveTo(q[0][0], q[0][1]); x.lineTo(q[1][0], q[1][1]); x.lineTo(q[2][0], q[2][1]); x.lineTo(q[3][0], q[3][1]); x.closePath();
    x.fillStyle = fc.col; x.fill(); x.strokeStyle = fc.col; x.stroke();
  }
}
function blitLayer(f, x, alpha) {
  if (alpha <= 0.003) return;
  const k = x.getTransform().a;                                  // device px per css px
  f.save(); f.setTransform(1, 0, 0, 1, 0, 0); f.globalAlpha = alpha; f.filter = `blur(${(1.6 * k).toFixed(2)}px)`;   // hides facet steps
  f.drawImage(x.canvas, 0, 0); f.filter = 'none'; f.restore();
}
// outline curves where the view ray grazes the surface (two per height level: left / right)
function silhouettes(st, eye, lam, Zt, NZ = 40, NPH = 220) {
  const C = st.C, R = C.r, h0 = st.h0, l2 = lam * lam, curves = [[], []];
  for (let j = 0; j <= NZ; j++) {
    const z = -Zt + (2 * Zt * j) / NZ, r = Math.sqrt(R * R + (z * z) / l2);
    const found = [null, null];
    let pv = null, pph = 0;
    for (let i = 0; i <= NPH; i++) {
      const ph = (i / NPH) * TAU, c0 = Math.cos(ph), s0 = Math.sin(ph);
      const x = C.x + r * c0, y = C.y + r * s0, zz = h0 + z;
      const v = r * c0 * (eye[0] - x) + r * s0 * (eye[1] - y) - (z / l2) * (eye[2] - zz);
      if (pv !== null && (pv > 0) !== (v > 0)) {
        const u = pv / (pv - v), phx = pph + (ph - pph) * u, ty = pv > 0 ? 0 : 1;
        if (!found[ty]) found[ty] = [C.x + r * Math.cos(phx), C.y + r * Math.sin(phx), zz];
      }
      pv = v; pph = ph;
    }
    curves[0].push(found[0]); curves[1].push(found[1]);
  }
  return curves;
}

// ---------------------------------------------------------------- the whole lit 3-D figure
export function drawLit3D(f, st, t, n, LY) {
  const P = st.P, C = st.C, R = C.r, Lf3 = st.lift, V = Lf3.V, Q = Lf3.Q, A = st.A, bri = st.bri, Wv = bri.W, B = bri.B;
  const lam = st.lam * S.LSIGN, h0 = st.h0, sc = st.cam.s;
  const eye = eyeOf(st.cam);
  const flat = lam < 0.05;
  const lit = ramp(48, 48.6, n);                                   // 2-D line style → lit style right after the lift-off
  const sh = clamp(h0 / 40);                                       // the shadow emerges from under the figure
  const ice = PAL.ice;
  const l2 = Math.max(lam * lam, 1e-6);
  const facing = flat ? () => 1 : (p) => (p[0] - C.x) * (eye[0] - p[0]) + (p[1] - C.y) * (eye[1] - p[1]) - ((p[2] - h0) / l2) * (eye[2] - p[2]);
  const facingWaist = flat ? () => 1 : (p) => (p[0] - C.x) * (eye[0] - p[0]) + (p[1] - C.y) * (eye[1] - p[1]);
  // ---------- schedules
  const dA = n < 56 ? 1 - ramp(49.6, 50.4, n) : 0;                // the floating planar diagonals + B (before the tilt)
  const drK = (k) => (n < 56.5 ? 0 : E.out2(clamp((n - (56.5 + 0.5 * k)) / 0.45)));
  const qp = clamp((n - 62) / 0.35);
  const grow = E.out2(ramp(54, 55.4, n, 'lin'));
  const aH = ramp(54, 54.8, n) * (1 - ramp(63.5, 65, n)) * (1 - 0.5 * ramp(58.05, 58.3, n) * (1 - ramp(61.2, 61.8, n)));   // hyperboloid (steps back while the planes are shown)
  const ov = ramp(64.5, 65.3, n);                                   // the shadow shown in the planar colours
  const rayA = ramp(64.2, 65, n) * (1 - ramp(67.6, 68, n));         // "light from straight above"
  const fd = 1 - 0.45 * ramp(64.9, 65.6, n) * (1 - ramp(67.1, 67.55, n));   // the floating figure steps back while we read its shadow
  const Wf = Wv.map((w) => [w[0], w[1], 0]);
  // ---------- a soft beam of light from straight above (beats 64–68)
  const beamA = ramp(64, 64.8, n) * (1 - ramp(67.55, 68, n));
  if (beamA > 0.003) {
    const o = P([C.x, C.y, 0]), hw = 1.7 * R * o[2] * sc, tw = 0.35 * hw;
    f.save(); f.globalCompositeOperation = 'lighter';
    const g = f.createLinearGradient(0, -60, 0, o[1]);
    g.addColorStop(0, rgba(PAL.cream, 0.1 * beamA)); g.addColorStop(0.7, rgba(PAL.cream, 0.05 * beamA)); g.addColorStop(1, rgba(PAL.cream, 0.0));
    f.fillStyle = g; f.beginPath(); f.moveTo(o[0] - tw, -60); f.lineTo(o[0] + tw, -60); f.lineTo(o[0] + hw, o[1]); f.lineTo(o[0] - hw, o[1]); f.closePath(); f.fill();
    f.restore();
  }
  // ---------- floor: soft shadows (= vertical projection, overhead light)
  if (sh > 0.003) {
    const shl = (a, b, s, o = {}) => {
      const pa = P(a), pb = P(b), k = Math.sqrt((pa[2] + pb[2]) / 2);
      sline(f, pa, pb, { w: 11 * k, color: SHADOW, alpha: 0.15 * s, from: o.from, to: o.to });
      sline(f, pa, pb, { w: 5 * k, color: SHADOW, alpha: 0.4 * s, from: o.from, to: o.to });
    };
    // the hyperboloid's faint shadow (annulus between the waist and the rim)
    if (aH > 0.003) {
      const Zt = Math.min(lam * 1.3 * R, h0 - 10) * (0.15 + 0.85 * grow), rr = Math.sqrt(R * R + (Zt * Zt) / l2);
      f.save(); f.globalAlpha *= 0.14 * aH * sh; f.fillStyle = SHADOW; f.beginPath();
      for (const [rad, dir] of [[rr, 1], [R, -1]]) for (let i = 0; i <= 96; i++) { const ph = dir * (i / 96) * TAU, q = bp(P([C.x + rad * Math.cos(ph), C.y + rad * Math.sin(ph), 0])); i ? f.lineTo(q[0], q[1]) : f.moveTo(q[0], q[1]); }
      f.fill('nonzero'); f.restore();
    }
    const circ = []; for (let i = 0; i <= 120; i++) { const ph = (i / 120) * TAU; circ.push(P([C.x + R * Math.cos(ph), C.y + R * Math.sin(ph), 0])); }
    spoly(f, circ, { w: 9, color: SHADOW, alpha: 0.13 * sh }); spoly(f, circ, { w: 4, color: SHADOW, alpha: 0.32 * sh });
    for (let i = 0; i < 6; i++) shl(Wf[(i + 5) % 6], Wf[i], sh);
    for (let k = 0; k < 3; k++) {
      const a = dA > 0.003 ? dA : 1, to = dA > 0.003 ? 1 : drK(k);
      if ((dA <= 0.003 && to <= 0) || a <= 0.003) continue;
      const [p, q] = dA > 0.003 ? G.extend(Wv[k], Wv[k + 3], 24 / sc, 24 / sc) : (() => { const e = ext3(V[k], V[k + 3], 0.1); return [e[0], e[1]]; })();
      shl([p[0], p[1], 0], [q[0], q[1], 0], sh * a, { to });
    }
    const bA = Math.max(dA, qp);
    if (bA > 0.003) { const q = bp(P([B[0], B[1], 0])); f.save(); f.globalAlpha *= 0.45 * sh * bA; f.fillStyle = SHADOW; f.beginPath(); f.arc(q[0], q[1], 13 * Math.sqrt(P([B[0], B[1], 0])[2]), 0, TAU); f.fill(); f.restore(); }
    // the shadow, recoloured: it IS the planar Brianchon figure
    if (ov > 0.003) {
      spoly(f, circ, { w: 2.6, color: PAL.gold, alpha: 0.6 * ov });
      for (let i = 0; i < 6; i++) sline(f, P(Wf[(i + 5) % 6]), P(Wf[i]), { w: 3.2, color: ice, alpha: 0.9 * ov, halo: 2.4 });
      for (let k = 0; k < 3; k++) { const e = ext3(V[k], V[k + 3], 0.1); sline(f, P([e[0][0], e[0][1], 0]), P([e[1][0], e[1][1], 0]), { w: 3.2, color: PAIR[k], alpha: 0.95 * ov, halo: 2.4 }); }
      const q = P([B[0], B[1], 0]);
      ball(f, q, 10.5 * Math.sqrt(q[2]), BALL.red, { alpha: ov * qp, halo: 3.4 + 2.5 * pulse(n, 65.6, 0.1, 1.4) });
    }
  }
  // ---------- the hyperboloid: compute faces once, paint into back / front layers
  let faces = null, Zt = 0;
  if (!flat && aH > 0.003) {
    Zt = Math.min(lam * 1.3 * R, h0 - 10) * (0.15 + 0.85 * grow);
    faces = surfaceFaces(st, eye, lam, Zt);
    const lb = LY.get(1); lb.setTransform(f.getTransform()); paintFaces(lb, faces, false); blitLayer(f, lb, 0.46 * aH);
  }
  // rulings + rims (both ruling families: the surface is made of straight lines)
  const rul = { front: [], back: [] };
  if (faces) {
    const NR = 18, um = Zt / lam;
    for (const fam of [1, -1]) for (let j = 0; j < NR; j++) {
      const ps = (j / NR) * TAU + (fam > 0 ? 0 : Math.PI / NR), c0 = Math.cos(ps), s0 = Math.sin(ps);
      const pts = []; for (let i = 0; i <= 24; i++) { const u = -um + (2 * um * i) / 24; pts.push([C.x + R * c0 - s0 * u, C.y + R * s0 + c0 * u, h0 + fam * lam * u]); }
      for (const pc of splitPoly(pts, facing)) (pc.front ? rul.front : rul.back).push(pc.pts);
    }
    for (const zz of [Zt, -Zt]) {
      const rr = Math.sqrt(R * R + (zz * zz) / l2), pts = [];
      for (let i = 0; i <= 120; i++) { const ph = (i / 120) * TAU; pts.push([C.x + rr * Math.cos(ph), C.y + rr * Math.sin(ph), h0 + zz]); }
      for (const pc of splitPoly(pts, facing)) { pc.rim = true; (pc.front ? rul.front : rul.back).push(pc); }
    }
  }
  const drawRul = (list, front) => {
    for (const pc of list) {
      const pts = (pc.pts || pc).map(P);
      if (pc.rim) spoly(f, pts, { w: front ? 2.4 : 1.6, color: ice, alpha: (front ? 0.85 : 0.42) * aH });
      else spoly(f, pts, { w: 1.2, color: ice, alpha: (front ? 0.2 : 0.11) * aH });
    }
  };
  drawRul(rul.back, false);
  // ---------- pieces on the surface, split into the far (back) and near (front) sheets
  const sideW = 6, sideW0 = 3.2;
  const sides = [];
  for (let i = 0; i < 6; i++) {
    const a = V[(i + 5) % 6], b = V[i];
    for (const pc of splitPoly(sampleSeg(a, b), facing)) sides.push({ front: pc.front, a: pc.pts[0], b: pc.pts[pc.pts.length - 1] });
  }
  const waist = []; for (let i = 0; i <= 160; i++) { const ph = (i / 160) * TAU; waist.push([C.x + R * Math.cos(ph), C.y + R * Math.sin(ph), h0]); }
  const waistPcs = splitPoly(waist, facingWaist);
  const drawSurfacePieces = (front) => {
    for (const pc of waistPcs) {
      if (pc.front !== front) continue;
      const pts = pc.pts.map(P);
      if (lit > 0.01) spoly(f, pts, { w: 3.4 + 3.2, color: OUTL, alpha: 0.6 * lit * fd });
      spoly(f, pts, { w: 3.4, color: PAL.gold, alpha: 0.9 * fd });
      if (lit > 0.01) spoly(f, pts, { w: 1.1, color: PAL.cream, alpha: 0.5 * lit * fd });
    }
    for (const s of sides) if (s.front === front) tube(f, P(s.a), P(s.b), { w: sideW, w0: sideW0, color: ice, dark: '#2F5F8C', lit, cap: 'butt', alpha: fd });
    for (let i = 0; i < 6; i++) {
      const p = [A[i][0], A[i][1], h0];
      if ((facingWaist(p) > 0) !== front) continue;
      const q = P(p);
      ball(f, q, 4.6 * Math.sqrt(q[2]), BALL.ice, { lit, alpha: fd });
    }
    for (let i = 0; i < 6; i++) {
      if ((facing(V[i]) > 0) !== front) continue;
      const q = P(V[i]);
      ball(f, q, 8.5 * Math.sqrt(q[2]), BALL.ice, { lit, alpha: fd });
    }
  };
  drawSurfacePieces(false);
  // ---------- interior: planes through pairs of space diagonals, the diagonals, Q
  if (!flat) for (let k = 0; k < 3; k++) {
    const g = planeGlow(n, k);
    if (g <= 0.003) continue;
    const q = [V[k], V[(k + 1) % 6], V[(k + 3) % 6], V[(k + 4) % 6]].map(P);
    const col = mixHex(mixHex(PAIR[k], PAIR[(k + 1) % 3], 0.5), '#FFFFFF', 0.25);
    sfill(f, q, col, 0.4 * g);
    // its two edges along the hexagon (opposite sides) solid, the other two dashed
    for (let e = 0; e < 4; e++) sline(f, q[e], q[(e + 1) % 4], e % 2 ? { w: 1.8, color: col, alpha: 0.7 * g, dash: [8, 8] } : { w: 2.6, color: col, alpha: 0.9 * g, halo: 2 * g });
  }
  for (let k = 0; k < 3; k++) {
    const dk = mixHex(PAIR[k], '#0B1320', 0.5);
    if (dA > 0.003) {
      const [p, q] = G.extend(Wv[k], Wv[k + 3], 24 / sc, 24 / sc);
      tube(f, P([p[0], p[1], h0]), P([q[0], q[1], h0]), { w: 5, w0: 3, color: PAIR[k], dark: dk, lit, alpha: dA, halo: 2 * (1 - lit) });
    }
    const dr = drK(k);
    if (dr > 0 && !flat) {
      const glow = 0.6 * planeGlow(n, k) + 0.6 * planeGlow(n, (k + 2) % 3);
      const [a3, b3] = ext3(V[k], V[k + 3], 0.1);
      tube(f, P(a3), P(b3), { w: 5 + 2 * glow, color: PAIR[k], dark: dk, lit: 1, to: dr, tip: dr < 1, halo: 1 + 2 * glow, alpha: fd });
    }
  }
  // the planar B while floating, then the space point Q
  if (dA > 0.003) { const q = P([B[0], B[1], h0]); ball(f, q, 11 * Math.sqrt(q[2]), BALL.red, { lit, alpha: dA, halo: 3 }); }
  if (qp > 0 && !flat) { const q = P(Q); ball(f, q, 12 * Math.sqrt(q[2]) * E.outBack(qp, 2.6), BALL.red, { halo: 3.5 + 3 * pulse(n, 62, 0.05, 1.2) }); }
  // ---------- near sheet
  if (faces) { const lf = LY.get(2); lf.setTransform(f.getTransform()); paintFaces(lf, faces, true); blitLayer(f, lf, 0.3 * aH); }
  drawRul(rul.front, true);
  if (faces) {
    const sil = silhouettes(st, eye, lam, Zt);
    for (const cv of sil) {
      let run = [];
      const flush = () => { if (run.length > 1) spoly(f, run, { w: 2.6, color: ice, alpha: 0.9 * aH }); run = []; };
      for (const p of cv) { if (p) run.push(P(p)); else flush(); }
      flush();
    }
  }
  if (faces) {
    // glint ribbon (variable width, one filled shape → no overlapping joints)
    const gl = glint(st, eye, lam, Zt).filter(Boolean).map((g) => ({ q: P(g.p), m: g.m }));
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
  drawSurfacePieces(true);
  // ---------- vertical light rays: every point drops straight down onto its shadow
  const emph = ramp(52, 52.4, n) * (1 - ramp(53.8, 54.3, n));            // step 1: "相邻两边照样相交" — vertex heights
  const dropA = Math.min(1, sh) * (0.14 + 0.66 * Math.max(rayA, 0.75 * emph));
  if (dropA > 0.003) {
    const dash = [5 + 2 * rayA, 8], off = -t * 70 * rayA;
    for (let i = 0; i < 6; i++) sline(f, P(V[i]), P(Wf[i]), { w: 1.5 + 0.8 * rayA, color: PAL.cream, alpha: dropA, dash, dashOff: off });
    if (qp > 0 && !flat) {
      const q0 = P(Q), q1 = P([B[0], B[1], 0]);
      if (rayA > 0.003) sline(f, q0, q1, { w: 12, color: PAL.cream, alpha: 0.1 * rayA });
      sline(f, q0, q1, { w: 2 + 0.6 * rayA, color: PAL.cream, alpha: Math.min(1, dropA * 1.15) * qp, dash, dashOff: off });
    }
  }
  // Q glows through the glass
  if (qp > 0 && !flat) {
    const q = bp(P(Q)), r = 30 + 26 * pulse(n, 62, 0.05, 1.2);
    f.save(); f.globalCompositeOperation = 'lighter';
    const g = f.createRadialGradient(q[0], q[1], 0, q[0], q[1], r);
    g.addColorStop(0, rgba('#FF8FA3', 0.35 * qp)); g.addColorStop(1, rgba(PAL.red, 0));
    f.fillStyle = g; f.beginPath(); f.arc(q[0], q[1], r, 0, TAU); f.fill(); f.restore();
  }
}
function ext3(a, b, e) { const d = G.sub3(b, a); return [G.sub3(a, G.mul3(d, e)), G.add3(b, G.mul3(d, e))]; }
function planeGlow(n, k) { const n0 = 58.2 + 0.75 * k; return pulse(n, n0, 0.12, 0.9) * 0.7 + 0.3 * ramp(n0, n0 + 0.3, n) * (1 - ramp(61, 61.8, n)); }
