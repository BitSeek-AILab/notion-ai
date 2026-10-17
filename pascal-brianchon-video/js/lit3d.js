// Lit 3-D primitives (v3: the acts themselves live in space.js) — "升到三维".
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
export const SHADOW = '#02050B', OUTL = '#060E1A';
const FRONT = ['#3A6E9C', '#78BFE6', '#BDEFFF'].map(hex2rgb);
const BACK = ['#1C3E66', '#2F6190', '#4B86B5'].map(hex2rgb);
const RIM = hex2rgb('#E8FBFF'), WHITE = [255, 255, 255];
export const BALL = {
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
export function tube(f, a, b, o) {
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
export function ball(f, q, r, pal, o = {}) {
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
export function splitPoly(pts, fac) {
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
export const sampleSeg = (a, b, m = 36) => Array.from({ length: m + 1 }, (_, i) => G.lerp3(a, b, i / m));

// ---------------------------------------------------------------- the hyperboloid x²+y²−(z−h0)²/λ² = R²
export function surfaceFaces(st, eye, lam, zA, zB, NU = 128, NV = 30) {
  const C = st.C, R = C.r, h0 = st.h0, P = st.P, l2 = lam * lam;
  const zs = [], rs = [];
  for (let j = 0; j <= NV; j++) { const z = zA + ((zB - zA) * j) / NV; zs.push(z); rs.push(Math.sqrt(R * R + (z * z) / l2)); }
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
export function shade(Ns, Vv, front) {
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
export function glint(st, eye, lam, zA, zB, NZ = 36, NPH = 160) {
  const C = st.C, R = C.r, h0 = st.h0, l2 = lam * lam, out = [];
  for (let j = 0; j <= NZ; j++) {
    const z = zA + ((zB - zA) * j) / NZ, r = Math.sqrt(R * R + (z * z) / l2);
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
export function paintFaces(x, faces, front) {
  x.lineJoin = 'round'; x.lineWidth = 1.4;
  for (const fc of faces) {
    if (fc.front !== front) continue;
    const q = fc.q;
    x.beginPath(); x.moveTo(q[0][0], q[0][1]); x.lineTo(q[1][0], q[1][1]); x.lineTo(q[2][0], q[2][1]); x.lineTo(q[3][0], q[3][1]); x.closePath();
    x.fillStyle = fc.col; x.fill(); x.strokeStyle = fc.col; x.stroke();
  }
}
export function blitLayer(f, x, alpha) {
  if (alpha <= 0.003) return;
  const k = x.getTransform().a;                                  // device px per css px
  f.save(); f.setTransform(1, 0, 0, 1, 0, 0); f.globalAlpha = alpha; f.filter = `blur(${(1.6 * k).toFixed(2)}px)`;   // hides facet steps
  f.drawImage(x.canvas, 0, 0); f.filter = 'none'; f.restore();
}
// outline curves where the view ray grazes the surface (two per height level: left / right)
export function silhouettes(st, eye, lam, zA, zB, NZ = 40, NPH = 220) {
  const C = st.C, R = C.r, h0 = st.h0, l2 = lam * lam, curves = [[], []];
  for (let j = 0; j <= NZ; j++) {
    const z = zA + ((zB - zA) * j) / NZ, r = Math.sqrt(R * R + (z * z) / l2);
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

export function ext3(a, b, e) { const d = G.sub3(b, a); return [G.sub3(a, G.mul3(d, e)), G.add3(b, G.mul3(d, e))]; }
export function planeGlowV2(n, k) { const n0 = 58.2 + 0.75 * k; return pulse(n, n0, 0.12, 0.9) * 0.7 + 0.3 * ramp(n0, n0 + 0.3, n) * (1 - ramp(61, 61.8, n)); }
