// 黄毛理论 v2 · canvas helpers (flat vector: solid shapes, round joins, one shade tone per shape)
import { clamp, lerp, hs, heartPts, starPts, burstPts, rrectPts, circlePts, spline, shade } from './lib.js';
export let c = null;
export const setCtx = (x) => { c = x; };

export const PAL = {
  blue: '#3d38f2', blue2: '#5b57ff', blue3: '#8f8cff', sky: '#9fd8ff', navy: '#17153a', ink: '#17153a',
  cream: '#fff4e2', paper: '#fffaf1', coral: '#ff5a4e', coral2: '#ff8a7a', mint: '#2fe0a2', mint2: '#9af0cf',
  pink: '#ff8fb8', pink2: '#ffc4d8', purple: '#7d5cff', lilac: '#c7b8ff', orange: '#ff9a3c',
  yel: '#ffd23f', yelD: '#f2a700', yelL: '#fff1a8', grey: '#9a9bb5', grey2: '#c9cadb', grey3: '#e6e6ef', white: '#ffffff',
  skin: '#ffc9a5', skinD: '#f2a982', skin2: '#e9a77d', skin2D: '#cf8a62', blush: '#ff8c8c', hairK: '#1d1b3a', hairB: '#5b3a2a', hairW: '#eceaf4',
};
export { shade };

export function path(P, close = true) { c.beginPath(); c.moveTo(P[0][0], P[0][1]); for (let i = 1; i < P.length; i++) c.lineTo(P[i][0], P[i][1]); if (close) c.closePath(); }
export function fillP(P, col) { path(P); c.fillStyle = col; c.fill(); }
export function strokeP(P, col, w, close = false) { path(P, close); c.strokeStyle = col; c.lineWidth = w; c.lineJoin = 'round'; c.lineCap = 'round'; c.stroke(); }
export function smooth(P, closed = true, col = null, m = 8) { const S = spline(P, closed, m); if (col) fillP(S, col); return S; }
export function rr(x, y, w, h, r) { c.beginPath(); c.roundRect(x, y, w, h, Math.max(0, Math.min(r, w / 2, h / 2))); }
export function rrFill(x, y, w, h, r, col) { rr(x, y, w, h, r); c.fillStyle = col; c.fill(); }
export function circ(x, y, r, col) { if (r <= 0) return; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fillStyle = col; c.fill(); }
export function ell(x, y, rx, ry, col, rot = 0) { if (rx <= 0 || ry <= 0) return; c.beginPath(); c.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); c.fillStyle = col; c.fill(); }
export function ring(x, y, r, w, col) { if (r <= 0) return; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.strokeStyle = col; c.lineWidth = w; c.stroke(); }
export function line(x0, y0, x1, y1, col, w, cap = 'round') { c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.strokeStyle = col; c.lineWidth = w; c.lineCap = cap; c.stroke(); }
export function poly(P, col, w = 0, wc = null) { path(P); if (col) { c.fillStyle = col; c.fill(); } if (w) { c.strokeStyle = wc; c.lineWidth = w; c.lineJoin = 'round'; c.stroke(); } }
export function arcLine(x, y, r, a0, a1, col, w) { c.beginPath(); c.arc(x, y, r, a0, a1); c.strokeStyle = col; c.lineWidth = w; c.lineCap = 'round'; c.stroke(); }
export function shadowEll(x, y, rx, ry = rx * 0.22, a = 0.16) { c.save(); c.globalAlpha *= a; ell(x, y, rx, ry, PAL.navy); c.restore(); }
export function lin(x0, y0, x1, y1, stops) { const g = c.createLinearGradient(x0, y0, x1, y1); for (const [o, col] of stops) g.addColorStop(o, col); return g; }
export function rad(x, y, r0, r1, stops) { const g = c.createRadialGradient(x, y, r0, x, y, r1); for (const [o, col] of stops) g.addColorStop(o, col); return g; }
export function withT(x, y, r, s, fn, sy = null) { c.save(); c.translate(x, y); if (r) c.rotate(r); if (s !== 1 || (sy !== null && sy !== 1)) c.scale(s, sy ?? s); fn(); c.restore(); }
export function alpha(a, fn) { if (a <= 0.001) return; c.save(); c.globalAlpha *= clamp(a); fn(); c.restore(); }
export function clipP(P) { path(P); c.clip(); }

export function heart(x, y, s, col, o = {}) {
  const P = heartPts(x, y, s);
  fillP(P, col);
  if (o.hi) { c.save(); clipP(P); ell(x - s * 0.38, y - s * 0.42, s * 0.22, s * 0.14, o.hi, -0.6); c.restore(); }
  return P;
}
export function star(x, y, r1, r2, col, k = 5, rot = -Math.PI / 2) { fillP(starPts(x, y, r1, r2, k, rot), col); }
// 4-point sparkle ✦
export function sparkle(x, y, r, col, rot = 0) {
  if (r <= 0.5) return;
  const P = [];
  for (let i = 0; i < 8; i++) { const a = rot + (i / 8) * Math.PI * 2, rr2 = i % 2 ? r * 0.22 : r; P.push([x + rr2 * Math.cos(a), y + rr2 * Math.sin(a)]); }
  fillP(spline(P, true, 4), col);
}
export function burst(x, y, rx, ry, col, o = {}) {
  const P = burstPts(x, y, rx, ry, o.k ?? 14, o.seed ?? 1, o.jag ?? 0.28);
  if (o.edge) { const Q = burstPts(x, y, rx + o.edge, ry + o.edge, o.k ?? 14, o.seed ?? 1, o.jag ?? 0.28); fillP(Q, o.edgeCol ?? PAL.navy); }
  fillP(P, col); return P;
}
// speech bubble (rounded rect + tail toward (tx,ty))
export function bubble(x, y, w, h, tx, ty, col, o = {}) {
  const r = o.r ?? Math.min(h / 2, 46);
  c.beginPath(); c.roundRect(x - w / 2, y - h / 2, w, h, r);
  const bx = clamp(tx, x - w / 2 + r, x + w / 2 - r), by = ty > y ? y + h / 2 - 2 : y - h / 2 + 2;
  const tw = o.tw ?? Math.min(46, w * 0.18);
  c.moveTo(bx - tw / 2, by); c.lineTo(tx, ty); c.lineTo(bx + tw / 2, by); c.closePath();
  if (o.edge) { c.save(); c.lineWidth = o.edge * 2; c.strokeStyle = o.edgeCol ?? PAL.navy; c.lineJoin = 'round'; c.stroke(); c.restore(); }
  c.fillStyle = col; c.fill();
}
// thought cloud (scalloped ellipse)
export function cloud(x, y, w, h, col, seed = 1, n = 9) {
  c.beginPath();
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2, px = x + (w / 2) * 0.82 * Math.cos(a), py = y + (h / 2) * 0.72 * Math.sin(a);
    const r = Math.min(w, h) * (0.26 + 0.05 * hs(seed, i));
    c.moveTo(px + r, py); c.arc(px, py, r, 0, Math.PI * 2);
  }
  c.moveTo(x + w * 0.42, y); c.ellipse(x, y, w * 0.42, h * 0.4, 0, 0, Math.PI * 2);
  c.fillStyle = col; c.fill();
}
// radial sunburst wedges
export function sunburst(x, y, R, n, colA, colB, rot = 0) {
  if (colB) { c.fillStyle = colB; c.fillRect(-2000, -2000, 5000, 6000); }
  c.fillStyle = colA;
  c.beginPath();
  for (let i = 0; i < n; i++) {
    const a0 = rot + (i / n) * Math.PI * 2, a1 = a0 + Math.PI / n;
    c.moveTo(x, y); c.lineTo(x + R * Math.cos(a0), y + R * Math.sin(a0)); c.lineTo(x + R * Math.cos(a1), y + R * Math.sin(a1)); c.closePath();
  }
  c.fill();
}
export function stripes(x0, y0, w, h, sw, col, ang = -0.5, off = 0) {
  c.save(); c.beginPath(); c.rect(x0, y0, w, h); c.clip();
  c.translate(x0 + w / 2, y0 + h / 2); c.rotate(ang);
  const L = Math.hypot(w, h);
  c.fillStyle = col;
  for (let x = -L + ((off % (2 * sw)) + 2 * sw) % (2 * sw); x < L; x += 2 * sw) c.fillRect(x, -L, sw, 2 * L);
  c.restore();
}
// dotted halftone field (decor)
export function dots(x0, y0, w, h, step, r, col, a = 1) {
  c.save(); c.globalAlpha *= a; c.fillStyle = col; c.beginPath();
  for (let y = y0; y < y0 + h; y += step) for (let x = x0 + ((Math.round((y - y0) / step) % 2) * step) / 2; x < x0 + w; x += step) { c.moveTo(x + r, y); c.arc(x, y, r, 0, Math.PI * 2); }
  c.fill(); c.restore();
}
export function bg(col) { c.fillStyle = col; c.fillRect(-200, -200, 1480, 2320); }
export { rrectPts, circlePts, heartPts, starPts, burstPts };
