// 黄毛理论 · props. Every prop is a closed contour (fill + boiled ink) or an open ink stroke, drawn on the live ctx from core.js.
import { PAL, hs, clamp, lerp, E, spline, resample, boil, inkStroke, inkLoop, fillShape, fillPoly, circlePts, ellPts, rrectPts, prefix, toN } from './engine.js';
import { c, line, drawMorph, letters, measure } from './core.js';
import { REG, mixHex } from './shapes.js';
import { YEL, YELL, ORG, ORGD, GINK, GREYL, GREYM, drawFlame } from './people.js';

export const RED = '#e5402b', HULL = '#3d4256', WOOD = '#c98f55', WOODD = '#9a6136', WATER = '#a9d3ec', SKYB = '#6f8fb3', OCHRE = '#c9971f';
export const sd = (D, k) => D * 13 + k;
export const dense = (P, closed = true, step = 4) => resample(spline(P, closed, step), 4, closed);
export const tfm = (P, x = 0, y = 0, s = 1, r = 0, sx = 1) => {
  const cs = Math.cos(r), sn = Math.sin(r);
  return P.map((p) => { const px = p[0] * s * sx, py = p[1] * s; return [x + px * cs - py * sn, y + px * sn + py * cs, p[2]]; });
};
// closed shape from local control points (o: x, y, s, r, sx, w, amp, ink, reg, dense)
export function shp(P, fill, D, k, o = {}) {
  const Q = tfm(o.dense ? P : dense(P, true, o.step ?? 4), o.x, o.y, o.s, o.r, o.sx);
  drawMorph(Q, fill, D, k, { w: o.w ?? 7, amp: o.amp ?? 1.3, ink: o.ink, reg: o.reg });
  return Q;
}
export function ln(P, D, k, o = {}) { return line(tfm(P, o.x, o.y, o.s, o.r, o.sx), D, k, o); }
export function box(x, y, w, h, r, fill, D, k, o = {}) { const Q = rrectPts(x - w / 2, y - h / 2, w, h, r, 4); drawMorph(Q, fill, D, k, { w: o.w ?? 6.5, amp: o.amp ?? 1.1, ink: o.ink, reg: o.reg }); return Q; }
export function disc(x, y, r, fill, D, k, o = {}) { const Q = circlePts(x, y, r, Math.max(14, Math.round(r * 0.9))); drawMorph(Q, fill, D, k, { w: o.w ?? 6, amp: o.amp ?? 1, ink: o.ink, reg: o.reg }); return Q; }
export function txt(str, x, y, size, fill, D, k, o = {}) { return letters(c, str, { font: o.font ?? 'MK', size, x, y, fill, ink: o.ink ?? null, inkW: o.inkW, D, seed: k, align: o.align, alpha: o.alpha, shadow: o.shadow, amp: o.amp }); }

// ------------------------------------------------------------------ heart
export function heartPts(x, y, R, n = 96) {
  const o = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const hx = 16 * Math.pow(Math.sin(a), 3), hy = -(13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a));
    o.push([x + (hx * R) / 16, y + (hy * R) / 16 + R * 0.12]);
  }
  return o;
}
export function heartD(x, y, R, D, k, o = {}) {
  if (R < 2) return;
  const Q = heartPts(x, y, R).map((p) => o.sx ? [x + (p[0] - x) * o.sx, y + (p[1] - y) * (o.sy ?? 1)] : p);
  drawMorph(Q, o.fill ?? PAL.pink, D, k, { w: o.w ?? Math.max(3, R * 0.09), amp: 1 });
  if (o.shine !== false) { c.save(); c.globalAlpha *= 0.85; fillPoly(c, boil(ellPts(x - R * 0.42, y - R * 0.3, R * 0.16, R * 0.1, 14, -0.6), sd(D, k + 3), 0.6, 30), PAL.hi); c.restore(); }
}
// broken heart: two halves split by a zigzag, pushed apart by gap (px) and tilted
export function brokenHeart(x, y, R, gap, D, k) {
  const zig = [[x + 2, y - R * 0.62], [x - R * 0.16, y - R * 0.25], [x + R * 0.14, y + R * 0.05], [x - R * 0.12, y + R * 0.38], [x + 2, y + R * 1.05]];
  for (const side of [-1, 1]) {
    c.save();
    c.translate(x + side * gap, y); c.rotate(side * 0.12 * clamp(gap / 30)); c.translate(-x, -y);
    c.beginPath();
    const far = x + side * R * 2;
    c.moveTo(zig[0][0], y - R * 2); zig.forEach((p) => c.lineTo(p[0], p[1])); c.lineTo(zig.at(-1)[0], y + R * 2); c.lineTo(far, y + R * 2); c.lineTo(far, y - R * 2); c.closePath();
    c.clip();
    heartD(x, y, R, D, k, { fill: PAL.pink, shine: side < 0 });
    line(zig, D, k + 5, { w: 5, t0: 2, t1: 2 });
    c.restore();
  }
}

// ------------------------------------------------------------------ speech bubble (one contour incl. the tail)
export function bubblePts(x, y, rx, ry, tx, ty, wt = 0.3) {
  const aT = Math.atan2((ty - y) / ry, (tx - x) / rx), o = [], n = 80;
  for (let i = 0; i <= n; i++) { const a = aT + wt + (i / n) * (Math.PI * 2 - 2 * wt); o.push([x + rx * Math.cos(a), y + ry * Math.sin(a)]); }
  o.push([tx, ty]);
  return resample(o, 4, true);
}
export function bubble(x, y, rx, ry, tx, ty, s, D, k, o = {}) {
  if (s <= 0.01) return;
  c.save(); c.translate(tx, ty); c.scale(s, s); c.translate(-tx, -ty);
  drawMorph(bubblePts(x, y, rx, ry, tx, ty, o.wt ?? 0.3), o.fill ?? PAL.hi, D, k, { w: o.w ?? 6, amp: 1.1 });
  if (o.str) letters(c, o.str, { font: o.font ?? 'KL', size: o.size ?? 64, x, y: y + 2, fill: o.color ?? PAL.ink, ink: null, D, seed: k + 1, color: o.cmap });
  c.restore();
}

// ------------------------------------------------------------------ scribble tangle (open dense polyline)
const TANGLE = new Map();
export function tanglePts(cx, cy, w, h, seed = 3, n = 15) {
  const key = [cx, cy, w, h, seed, n].join('|');
  if (TANGLE.has(key)) return TANGLE.get(key);
  const P = [[cx - w * 0.5, cy + h * 0.2]];
  for (let i = 0; i < n; i++) {
    const a = i * 2.4 + hs(seed, i) * 1.4, rr = 0.55 + 0.45 * hs(seed, i, 2);
    P.push([cx + Math.cos(a) * w * 0.42 * rr + (i / n - 0.5) * w * 0.25, cy + Math.sin(a) * h * 0.45 * rr]);
  }
  P.push([cx + w * 0.5, cy - h * 0.1]);
  const Q = resample(spline(P, false, 4), 3, false);
  TANGLE.set(key, Q);
  return Q;
}

// ------------------------------------------------------------------ brush (bristles at origin, handle to +x)
export function brush(x, y, r, s, label, D, k, o = {}) {
  c.save(); c.translate(x, y); c.rotate(r); c.scale(s, s);
  shp([[44, -24, 1], [300, -18, 1], [322, 0], [300, 18, 1], [44, 24, 1]], WOOD, D, k, { w: 5.5, step: 3 });
  shp([[0, -34, 1], [52, -34, 1], [52, 34, 1], [0, 34, 1]], GREYM, D, k + 1, { w: 5.5, step: 3 });
  shp([[4, -32, 1], [-56, -38], [-108, -26], [-130, -2], [-112, 24], [-58, 38], [4, 32, 1]], PAL.ink, D, k + 2, { w: 4 });
  if (o.wet !== false) for (let i = 0; i < 3; i++) ln([[-40 - i * 26, -18 + i * 12], [-96 - i * 8, -10 + i * 10]], D, k + 3 + i, { w: 2.4, color: '#5a5048' });
  letters(c, label, { font: 'KL', size: o.size ?? 40, x: 186, y: 1, fill: PAL.hi, ink: PAL.ink, inkW: 3, D, seed: k + 6, shadow: PAL.ink, sdx: 2, sdy: 3 });
  c.restore();
}

// ------------------------------------------------------------------ square frame (ring) + its shards
export function frameRing(x, y, w, h, th, fill, D, k, o = {}) {
  const A = rrectPts(x - w / 2, y - h / 2, w, h, 16, 5), Bq = rrectPts(x - w / 2 + th, y - h / 2 + th, w - 2 * th, h - 2 * th, 8, 5);
  const a = boil(A, sd(D, k) + 0.5, 1.2, 70), b = boil(Bq, sd(D, k) + 0.7, 1.2, 70);
  c.save(); c.beginPath();
  for (const P of [a, b]) { P.forEach((p, i) => (i ? c.lineTo(p[0] + REG.dx, p[1] + REG.dy) : c.moveTo(p[0] + REG.dx, p[1] + REG.dy))); c.closePath(); }
  c.fillStyle = fill; c.fill('evenodd'); c.restore();
  inkLoop(c, A, { seed: sd(D, k), w: o.w ?? 7, amp: 1.2, heavy: 0.3 });
  inkLoop(c, Bq, { seed: sd(D, k + 1), w: (o.w ?? 7) * 0.8, amp: 1.2, heavy: 0.3 });
}
export function frameShards(x, y, w, h, th, n, u, fill, D, k) {
  if (u > 1.4) return;
  const M = 12, N = n * M;
  const A = toN(rrectPts(x - w / 2, y - h / 2, w, h, 16, 5), N), Bq = toN(rrectPts(x - w / 2 + th, y - h / 2 + th, w - 2 * th, h - 2 * th, 8, 5), N);
  for (let i = 0; i < n; i++) {
    const P = [];
    for (let j = i * M; j <= i * M + M; j++) P.push(A[j % N]);
    for (let j = i * M + M; j >= i * M; j--) P.push(Bq[j % N]);
    let cx = 0, cy = 0; P.forEach((p) => { cx += p[0]; cy += p[1]; }); cx /= P.length; cy /= P.length;
    const dx = cx - x, dy = cy - y, dl = Math.hypot(dx, dy) || 1, v = 1500 * (0.6 + 0.7 * hs(k, i)), rot = (hs(k, i, 2) - 0.5) * 10 * u;
    const ox = (dx / dl) * v * u, oy = (dy / dl) * v * u + 1300 * u * u - 250 * u;
    const cs = Math.cos(rot), sn = Math.sin(rot), sc = 1 - 0.3 * u;
    drawMorph(P.map((p) => { const px = (p[0] - cx) * sc, py = (p[1] - cy) * sc; return [cx + ox + px * cs - py * sn, cy + oy + px * sn + py * cs]; }), fill, D, k + i, { w: 5.5, amp: 1 });
  }
}

// ------------------------------------------------------------------ red X (two strokes drawn on)
export function redX(x, y, R, u, D, k) {
  if (u <= 0) return;
  const a = clamp(u * 2), b = clamp(u * 2 - 1);
  const s1 = [[x - R, y - R * 0.9], [x, y + R * 0.02], [x + R, y + R]], s2 = [[x + R * 0.95, y - R], [x, y], [x - R * 0.9, y + R * 0.95]];
  if (a > 0) inkStroke(c, prefix(spline(s1, false, 4), a), { seed: sd(D, k), w: R * 0.2, amp: 1.2, t0: 8, t1: 20, dense: true, color: RED, heavy: 0, jit: 0.25 });
  if (b > 0) inkStroke(c, prefix(spline(s2, false, 4), b), { seed: sd(D, k + 1), w: R * 0.2, amp: 1.2, t0: 8, t1: 20, dense: true, color: RED, heavy: 0, jit: 0.25 });
}

// ------------------------------------------------------------------ ship prow (screen space), waves, water, rain
export const PROW = [[196, 1040, 1], [560, 1012], [1150, 958, 1], [1150, 1520, 1], [640, 1500], [380, 1350], [250, 1150]];
export const deckY = (x) => 1040 + (x - 196) * (958 - 1040) / (1150 - 196);
export function prowDetails(D, k, a = 1, dx = 0) {
  if (a <= 0.02) return;
  c.save(); c.globalAlpha *= a; c.translate(dx, 0);
  const rail = []; for (let x = 222; x <= 1120; x += 18) rail.push([x, deckY(x) - 58]);
  line(rail, D, k, { w: 5, color: PAL.hi, t0: 2, t1: 2 });
  for (let x = 260; x <= 1110; x += 74) line([[x, deckY(x) - 58], [x, deckY(x) - 4]], D, k + x, { w: 4, color: PAL.hi, t0: 1, t1: 1 });
  for (let x = 620; x <= 1100; x += 112) disc(x, deckY(x) + 120, 17, PAL.hi, D, k + 50 + x, { w: 4 });
  line([[300, 1205], [700, 1188], [1150, 1170]], D, k + 9, { w: 9, color: RED, t0: 6, t1: 6 });
  c.restore();
}
export function waterLine(y, A, L, ph, x0 = -60, x1 = 1140) { const P = []; for (let x = x0; x <= x1; x += 14) P.push([x, y + A * Math.sin((x / L) * Math.PI * 2 + ph)]); return P; }
export function water(y, ph, D, k, a = 1) {
  if (a <= 0.02) return;
  c.save(); c.globalAlpha *= a;
  const top = waterLine(y, 14, 260, ph);
  fillShape(c, [...top, [1140, 2000], [-60, 2000]], WATER, { seed: sd(D, k), amp: 1.2, dx: 0, dy: 0 });
  line(top, D, k, { w: 6, dense: false, t0: 4, t1: 4, color: PAL.blueD });
  for (let j = 1; j < 4; j++) line(waterLine(y + j * 70, 9, 180 + j * 20, ph * (1 + j * 0.3) + j), D, k + j, { w: 4.5, color: PAL.blue });
  c.restore();
}
// wave segments that tear off and become rain (u: 0 = waves, 1 = rain)
export function wavesToRain(t, y, u, D, k, o = {}) {
  const n = 34, sp = o.speed ?? 2300;
  for (let i = 0; i < n; i++) {
    const row = i % 3, x0 = -40 + ((i * 37) % 1160), y0 = y + row * 70 + 10 * Math.sin(x0 / 40);
    const rx = 20 + hs(k, i) * 1060, fall = (hs(k, i, 2) * 2200 + sp * Math.max(0, t)) % 2200 - 160;
    const v = E.io2(clamp(u * 1.4 - hs(k, i, 3) * 0.4));
    const px = lerp(x0, rx - 0.18 * fall, v), py = lerp(y0, fall, v);
    const ang = lerp(0.05, 1.37, v), L = lerp(46, 64, v);
    const dx = Math.cos(ang) * L / 2, dy = Math.sin(ang) * L / 2;
    const ddx = -dx * Math.sign(1 - v + 0.001) * (v > 0.5 ? 0.25 : 1);
    line([[px - ddx, py - dy], [px + ddx, py + dy]], D, k + i, { w: lerp(4.5, 3.6, v), color: v > 0.5 ? SKYB : PAL.blue, t0: 3, t1: 3 });
  }
}
export function rain(t, D, k, a = 1, n = 38) {
  if (a <= 0.02) return;
  c.save(); c.globalAlpha *= a;
  for (let i = 0; i < n; i++) {
    const fall = (hs(k, i, 2) * 2200 + 2300 * t) % 2200 - 160, x = 20 + hs(k, i) * 1100 - 0.2 * fall;
    line([[x + 10, fall - 30], [x - 10, fall + 30]], D, k + i, { w: 3.6, color: SKYB, t0: 3, t1: 3 });
  }
  c.restore();
}

// ------------------------------------------------------------------ vehicles (local: ground y = 0, facing +x)
export function wheel(x, y, r, spin, D, k, o = {}) {
  disc(x, y, r, o.fill ?? PAL.ink, D, k, { w: 5 });
  disc(x, y, r * 0.55, o.hub ?? GREYL, D, k + 1, { w: 4 });
  for (let i = 0; i < 3; i++) { const a = spin + (i * Math.PI * 2) / 3; line([[x, y], [x + Math.cos(a) * r * 0.5, y + Math.sin(a) * r * 0.5]], D, k + 2 + i, { w: 3.5, t0: 1, t1: 1 }); }
}
export const OLD_BODY = [[-118, -150], [-92, -174], [-6, -172], [16, -206], [96, -208], [112, -178], [100, -142], [-16, -128], [-104, -128]];
export const SUPER_BODY = [[-196, -128], [-152, -178], [-40, -186], [58, -224], [154, -210], [214, -150], [196, -104], [96, -92], [-24, -88], [-128, -100]];
export const bikeBody = (u) => u <= 0 ? dense(OLD_BODY) : u >= 1 ? dense(SUPER_BODY) : null;
export function oldBike(x, y, s, spin, D, k, o = {}) {
  c.save(); c.translate(x, y); c.scale(s, s);
  const sp = o.morph ?? 0;
  const wr = lerp(60, 68, sp), wx = lerp(132, 156, sp);
  ln([[-wx, -wr], [-60, -150], [92, -186]], D, k, { w: 8 });
  ln([[96, -190], [wx, -wr]], D, k + 1, { w: 8 });
  if (sp < 0.5) { box(10, -100, 84, 56, 10, GREYM, D, k + 2, { w: 5 }); ln([[-20, -84], [-110, -82], [-178, -70]], D, k + 3, { w: 9, color: GREYM }); }
  wheel(-wx, -wr, wr, spin, D, k + 4); wheel(wx, -wr, wr, spin, D, k + 10);
  const body = o.body ?? dense(OLD_BODY);
  drawMorph(body, mixHex(o.color ?? PAL.blue, RED, sp), D, k + 20, { w: 6.5 });
  if (sp < 0.5) { shp([[-112, -150], [-84, -170], [-4, -170], [-8, -152], [-96, -146]], PAL.ink, D, k + 21, { w: 4, reg: false }); disc(124, -188, 15, YELL, D, k + 22, { w: 4 }); ln([[94, -192], [78, -238], [52, -242]], D, k + 23, { w: 6 }); }
  else { disc(10, -156, 30, PAL.hi, D, k + 24, { w: 4 }); txt('1', 10, -154, 44, PAL.ink, D, k + 25, { font: 'KL' }); ln([[60, -224], [40, -250]], D, k + 26, { w: 6 }); shp([[150, -206], [204, -150], [168, -150], [128, -196]], '#bfe0f5', D, k + 27, { w: 4 }); }
  c.restore();
}
export function van(x, y, s, D, k, o = {}) {
  c.save(); c.translate(x, y); c.scale(s, s);
  ln([[-70, -232], [-58, -270]], D, k, { w: 6 });
  shp(ellPts(-58, -290, 46, 18, 24, 0).map((p) => [p[0], p[1], 0]), GREYL, D, k + 1, { r: 0, w: 5, dense: true });
  shp([[-210, -40, 1], [-210, -226, 1], [118, -226, 1], [196, -150], [214, -40, 1]], PAL.hi, D, k + 2, { w: 7 });
  shp([[124, -206, 1], [184, -146, 1], [124, -146, 1]], '#bfe0f5', D, k + 3, { w: 5, step: 3 });
  shp([[-210, -116, 1], [214, -116, 1], [214, -86, 1], [-210, -86, 1]], PAL.blue, D, k + 4, { w: 4, step: 3 });
  txt('TV', -60, -168, 96, RED, D, k + 5, { font: 'KL', ink: PAL.ink, inkW: 4 });
  wheel(-120, -40, 44, o.spin ?? 0, D, k + 6); wheel(126, -40, 44, o.spin ?? 0, D, k + 12);
  c.restore();
}
export function checkerFlag(x, y, s, t, D, k) {
  c.save(); c.translate(x, y); c.scale(s, s);
  ln([[0, 0], [0, -420]], D, k, { w: 9 });
  const nx = 5, ny = 4, W = 240, H = 160, P = (u, v) => [u * W, -420 + v * H + 14 * Math.sin(u * 5 - t * 9) * u];
  for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
    if ((i + j) % 2) continue;
    fillPoly(c, boil([P(i / nx, j / ny), P((i + 1) / nx, j / ny), P((i + 1) / nx, (j + 1) / ny), P(i / nx, (j + 1) / ny)], sd(D, k + i * 7 + j), 0.8, 40), PAL.ink);
  }
  const edge = []; for (let i = 0; i <= 10; i++) edge.push(P(i / 10, 0)); for (let i = 10; i >= 0; i--) edge.push(P(i / 10, 1));
  inkLoop(c, resample(edge, 4, true), { seed: sd(D, k + 50), w: 5, amp: 1, heavy: 0.2 });
  c.restore();
}
export function cart(x, y, s, D, k, o = {}) {
  c.save(); c.translate(x, y); c.scale(s, s);
  const bk = [[-160, -250, 1], [160, -250, 1], [126, -112, 1], [-126, -112, 1]];
  shp(bk, o.fill ?? '#cfe7f7', D, k, { w: 7, step: 3 });
  for (let i = 1; i < 6; i++) { const u = i / 6; ln([[lerp(-160, 160, u), -250], [lerp(-126, 126, u), -112]], D, k + i, { w: 3.5, t0: 1, t1: 1 }); }
  for (let j = 1; j < 3; j++) { const v = j / 3; ln([[lerp(-160, -126, v), lerp(-250, -112, v)], [lerp(160, 126, v), lerp(-250, -112, v)]], D, k + 10 + j, { w: 3.5, t0: 1, t1: 1 }); }
  ln([[160, -250], [196, -300], [242, -300]], D, k + 20, { w: 8 });
  ln([[-126, -112], [-110, -60], [120, -60], [126, -112]], D, k + 21, { w: 7 });
  if (o.wheels !== false) { wheel(-96, -28, 28, o.spin ?? 0, D, k + 22); wheel(96, -28, 28, o.spin ?? 0, D, k + 28); }
  c.restore();
}
// leave slip + stamp
export function slip(x, y, s, D, k, o = {}) {
  if (s <= 0.01) return;
  c.save(); c.translate(x, y); c.rotate(o.r ?? -0.03); c.scale(s, s);
  box(0, 0, 600, 400, 18, PAL.hi, D, k, { w: 7 });
  txt('请假条', 0, -122, 76, PAL.ink, D, k + 1, { font: 'KL' });
  line([[-250, -64], [250, -64]], D, k + 2, { w: 4, t0: 2, t1: 2 });
  txt('事由：不开心', -250, 6, 60, PAL.ink, D, k + 3, { align: 'left' });
  line([[-60, 46], [250, 46]], D, k + 4, { w: 3.5, t0: 2, t1: 2, color: GINK });
  txt('天数：1 天', -250, 112, 46, GINK, D, k + 5, { align: 'left' });
  c.restore();
}
export function stampZhun(x, y, s, D, k, o = {}) {
  if (s <= 0.01) return;
  c.save(); c.translate(x, y); c.rotate(o.r ?? -0.22); c.scale(s, s); c.globalAlpha *= o.a ?? 0.92;
  const R = 92;
  for (const [r, w] of [[R, 10], [R - 16, 4]]) inkLoop(c, circlePts(0, 0, r, 60), { seed: sd(D, k + r), w, amp: 1.4, heavy: 0, color: RED });
  txt('准', 0, 4, 112, RED, D, k + 2, { font: 'KL' });
  c.restore();
}

// ------------------------------------------------------------------ B14 icons
export function dyeBottle(x, y, s, D, k) {
  c.save(); c.translate(x, y); c.scale(s, s);
  shp([[-52, 80, 1], [-56, -40], [-36, -82], [-14, -92, 1], [-14, -128, 1], [14, -128, 1], [14, -92, 1], [36, -82], [56, -40], [52, 80, 1]], '#c9a6f2', D, k, { w: 6.5 });
  shp([[-8, -128, 1], [-2, -176, 1], [8, -176, 1], [10, -128, 1]], GREYM, D, k + 1, { w: 4, step: 3 });
  box(0, 10, 76, 70, 10, PAL.hi, D, k + 2, { w: 4 });
  shp([[-22, -6], [0, -40], [22, -6], [12, 24], [-12, 24]], YEL, D, k + 3, { w: 3.5 });
  c.restore();
}
export function spikyHead(x, y, s, D, k, ph = 0) {
  c.save(); c.translate(x, y); c.scale(s, s);
  const sp = []; for (let i = 0; i < 11; i++) { const a = Math.PI + 0.15 + (i / 10) * (Math.PI - 0.3); const r = i % 2 ? 76 : 128 + 6 * Math.sin(ph + i); sp.push([Math.cos(a) * r, Math.sin(a) * r - 6, 1]); }
  shp([...sp, [70, 10], [-70, 10]], PAL.ink, D, k, { w: 5 });
  disc(0, 6, 72, PAL.hi, D, k + 1, { w: 6.5 });
  ln([[-40, -20], [-12, -8]], D, k + 2, { w: 6 }); ln([[40, -20], [12, -8]], D, k + 3, { w: 6 });
  disc(-24, 6, 7, PAL.ink, D, k + 4, { w: 0 }); disc(24, 6, 7, PAL.ink, D, k + 5, { w: 0 });
  ln([[-22, 40], [0, 32], [22, 40]], D, k + 6, { w: 5.5 });
  c.restore();
}

// ------------------------------------------------------------------ pedestal, top hat, dice
export function pedestal(x, yTop, w, h, D, k) {
  box(x, yTop + h / 2, w, h, 10, PAL.cream, D, k, { w: 7 });
  box(x, yTop + 16, w + 40, 34, 8, OCHRE, D, k + 1, { w: 6 });
  line([[x - w / 2 + 22, yTop + h * 0.32], [x + w / 2 - 22, yTop + h * 0.32]], D, k + 2, { w: 5, color: OCHRE });
  txt('高富帅', x, yTop + h * 0.58, 76, OCHRE, D, k + 3, { font: 'KL', ink: PAL.ink, inkW: 4 });
}
export function topHat(c2, hc, R, ha, D) {
  const cs = Math.cos(ha), sn = Math.sin(ha), P = (x, y) => [hc[0] + (x * cs - y * sn) * R, hc[1] + (x * sn + y * cs) * R];
  drawMorph(resample([P(-1.15, -0.62), P(1.15, -0.62), P(1.15, -0.8), P(0.68, -0.8), P(0.6, -1.9), P(-0.6, -1.9), P(-0.68, -0.8), P(-1.15, -0.8)], 4, true), PAL.ink, D, 71, { w: 4, reg: false });
  drawMorph(resample([P(-0.66, -0.86), P(0.66, -0.86), P(0.64, -1.1), P(-0.64, -1.1)], 4, true), OCHRE, D, 72, { w: 3, reg: false });
}
export function dice(x, y, s, r, D, k, o = {}) {
  c.save(); c.translate(x, y); c.rotate(r); c.scale(s, s);
  const S = 70;
  shp([[-S, -S, 1], [-S + 34, -S - 34, 1], [S + 34, -S - 34, 1], [S, -S, 1]], '#f3eee4', D, k, { w: 5, step: 3 });
  shp([[S, -S, 1], [S + 34, -S - 34, 1], [S + 34, S - 34, 1], [S, S, 1]], GREYL, D, k + 1, { w: 5, step: 3 });
  box(0, 0, 2 * S, 2 * S, 14, PAL.hi, D, k + 2, { w: 6 });
  for (const [px, py] of [[-28, -S - 17], [12, -S - 17], [52, -S - 17]]) disc(px, py, 6, PAL.ink, D, k + 3 + px, { w: 0 });
  txt(o.str ?? '命', 0, 4, 100, RED, D, k + 9, { font: 'KL' });
  c.restore();
}

// ------------------------------------------------------------------ palm (fingers up), match, matchbox, progress bar
export const PALM = [[-74, 210, 1], [-84, 70], [-150, 12], [-188, -36], [-174, -78], [-132, -62], [-90, -14, 1],
  [-96, -150], [-90, -214], [-68, -234], [-46, -216], [-42, -96, 1], [-38, -236], [-16, -264], [10, -264], [26, -236], [28, -96, 1],
  [34, -222], [54, -246], [76, -240], [88, -214], [84, -90, 1], [94, -170], [110, -192], [128, -188], [138, -164], [130, -56], [118, 70], [96, 210, 1]];
export function matchstick(x, y, r, s, D, k, o = {}) {
  c.save(); c.translate(x, y); c.rotate(r); c.scale(s, s);
  shp([[-260, -11, 1], [0, -11, 1], [0, 11, 1], [-260, 11, 1]], WOOD, D, k, { w: 5, step: 3 });
  shp(ellPts(16, 0, 30, 21, 24), o.burnt ? '#5a3d2e' : RED, D, k + 1, { w: 5, dense: true });
  c.restore();
}
export function matchbox(x, y, s, D, k) {
  c.save(); c.translate(x, y); c.scale(s, s);
  box(0, 0, 300, 170, 14, '#e8b04a', D, k, { w: 6.5 });
  box(0, -64, 300, 34, 6, WOODD, D, k + 1, { w: 4 });
  txt('火柴', 0, 22, 62, PAL.ink, D, k + 2, { font: 'KL' });
  c.restore();
}
export function progressBar(x, y, w, h, fillU, D, k, o = {}) {
  const P = rrectPts(x - w / 2, y - h / 2, w, h, h / 2, 4);
  drawMorph(P, PAL.hi, D, k, { w: 6 });
  const seg = o.seg ?? 7, fw = (w - 12) / seg;
  if (fillU > 0) {
    const Q = rrectPts(x - w / 2 + 6, y - h / 2 + 6, Math.max(h - 12, fw * fillU), h - 12, (h - 12) / 2, 4);
    fillShape(c, Q, YEL, { seed: sd(D, k + 1), amp: 1, dx: REG.dx, dy: REG.dy });
  }
  for (let i = 1; i < seg; i++) line([[x - w / 2 + 6 + i * fw, y - h / 2 + 8], [x - w / 2 + 6 + i * fw, y + h / 2 - 8]], D, k + 2 + i, { w: 3.5, color: GREYM, t0: 1, t1: 1 });
}

// ------------------------------------------------------------------ doors, cane, phone
export function door(x, yb, w, h, open, D, k, o = {}) { // open 0..1: panel swings to the left hinge, light pours out
  box(x, yb - h / 2, w + 30, h + 26, 6, WOODD, D, k, { w: 6.5 });
  if (open > 0.02) {
    box(x, yb - h / 2 + 6, w, h - 12, 3, YELL, D, k + 1, { w: 4 });
    c.save(); c.globalAlpha *= 0.55 * open;
    fillPoly(c, boil([[x - w / 2, yb], [x + w / 2, yb], [x + w / 2 + 120 * open, yb + 90], [x - w / 2 - 120 * open, yb + 90]], sd(D, k + 2), 1, 50), YELL);
    c.restore();
  }
  const pw = w * (1 - 0.82 * open), x0 = x - w / 2;
  if (o.burn === undefined || o.burn < 1) {
    c.save();
    if (o.burn > 0) { c.beginPath(); c.rect(-100, -100, 2400, 3000); c.moveTo(x + o.burn * w * 1.1, yb - h * 0.5); c.arc(x, yb - h * 0.5, o.burn * w * 1.1, 0, Math.PI * 2, true); c.clip('evenodd'); }
    const P = [[x0, yb - h + 6], [x0 + pw, yb - h + 6 - 40 * open], [x0 + pw, yb + 40 * open], [x0, yb]];
    drawMorph(resample(P, 4, true), o.panel ?? '#b9844f', D, k + 3, { w: 6 });
    if (open < 0.5) disc(x0 + pw - 26, yb - h * 0.48, 11, OCHRE, D, k + 4, { w: 3.5 });
    c.restore();
    if (o.burn > 0) {
      const R = o.burn * w * 1.1;
      inkLoop(c, circlePts(x, yb - h * 0.5, R, 40).filter((p) => Math.abs(p[0] - x) < w / 2 && Math.abs(p[1] - (yb - h * 0.5)) < h / 2), { seed: sd(D, k + 5), w: 9, amp: 2.5, color: '#3a2a20' });
    }
  }
  if (o.web) { line([[x0 + 2, yb - h + 70], [x0 + 70, yb - h + 6]], D, k + 6, { w: 2.2, color: GINK }); line([[x0 + 2, yb - h + 40], [x0 + 26, yb - h + 30], [x0 + 40, yb - h + 6]], D, k + 7, { w: 2, color: GINK }); line([[x0 + 2, yb - h + 6], [x0 + 46, yb - h + 50]], D, k + 8, { w: 2, color: GINK }); }
}
export function phoneFrame(x, y, w, h, D, k, a = 1) {
  if (a <= 0.01) return;
  c.save(); c.globalAlpha *= a;
  const A = rrectPts(x - w / 2 - 26, y - h / 2 - 60, w + 52, h + 130, 56, 5), Bq = rrectPts(x - w / 2, y - h / 2, w, h, 14, 5);
  c.beginPath(); for (const P of [A, Bq]) { P.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]))); c.closePath(); }
  c.fillStyle = '#2a2b33'; c.fill('evenodd');
  inkLoop(c, A, { seed: sd(D, k), w: 7, amp: 1.2, heavy: 0.3 });
  inkLoop(c, Bq, { seed: sd(D, k + 1), w: 4, amp: 1, heavy: 0.1 });
  box(x, y - h / 2 - 30, 90, 14, 7, '#55565f', D, k + 2, { w: 0 });
  disc(x, y + h / 2 + 36, 18, '#55565f', D, k + 3, { w: 3 });
  c.restore();
}
export { YEL, YELL, ORG, ORGD, GINK, GREYL, GREYM, drawFlame, mixHex };
