// Hand-drawn cel FX: star bursts, twinkles, speed lines, puffs, splashes, ripples (adapted from the 大水理论 film).
import { PAL, hs, hr, clamp, lerp, E, spline, resample, xf, boil, inkStroke, inkLoop, fillShape, fillPoly, circlePts, ellPts, N3 } from './engine.js';
import { dropDense, REG } from './shapes.js';

const sd = (D, k) => D * 13 + k * 101;

export function twinkle(c, x, y, R, D, k, color = PAL.yel, rot = 0) {
  const pts = [];
  for (let i = 0; i < 8; i++) { const a = rot + i / 8 * Math.PI * 2 - Math.PI / 2; const r = i % 2 ? R * 0.26 : R; pts.push([x + Math.cos(a) * r, y + Math.sin(a) * r, 1]); }
  const P = resample(spline(pts, true, 3), 3, true);
  fillShape(c, P, color, { seed: sd(D, k), amp: 0.7, dx: -2, dy: 2 });
  inkLoop(c, P, { seed: sd(D, k), w: Math.max(2.6, R * 0.09), amp: 0.7, heavy: 0 });
}
export function starBurst(c, x, y, R, n, D, k, color = PAL.yel, rot = 0, inner = 0.62) {
  const pts = [];
  for (let i = 0; i < n * 2; i++) { const a = rot + i / (n * 2) * Math.PI * 2; const r = (i % 2 ? R * inner : R) * (0.9 + 0.2 * hs(k, i)); pts.push([x + Math.cos(a) * r, y + Math.sin(a) * r, 1]); }
  const P = resample(spline(pts, true, 4), 4, true);
  fillShape(c, P, color, { seed: sd(D, k), amp: 1.2, dx: REG.dx, dy: REG.dy });
  inkLoop(c, P, { seed: sd(D, k), w: 6, amp: 1.2, heavy: 0.2 });
}
export function speedLines(c, cx, cy, r0, r1, n, D, k, o = {}) {
  const { w = 6, color = PAL.ink, a0 = 0, a1 = Math.PI * 2, jitter = 0.5 } = o;
  for (let i = 0; i < n; i++) {
    const a = lerp(a0, a1, (i + 0.5 * hs(k, i, D % 3)) / n);
    const rr0 = r0 * (1 + jitter * 0.4 * hs(k, i, 2, D % 2)), rr1 = r1 * (0.8 + 0.3 * hs(k, i, 3));
    inkStroke(c, [[cx + Math.cos(a) * rr0, cy + Math.sin(a) * rr0], [cx + Math.cos(a) * rr1, cy + Math.sin(a) * rr1]], { seed: sd(D, k + i), w: w * (0.6 + 0.6 * hs(k, i, 4)), amp: 0.8, t0: 3, t1: 30, color });
  }
}
export function linesH(c, x0, x1, ys, D, k, o = {}) { // horizontal motion lines
  ys.forEach((y, i) => inkStroke(c, [[x0, y], [x1, y]], { seed: sd(D, k + i), w: o.w ?? 5, amp: 0.8, t0: 30, t1: 4, color: o.color ?? PAL.ink }));
}
// a small water droplet (teardrop) oriented along angle a
export function droplet(c, x, y, size, a, D, k, o = {}) {
  const P = xf(dropDense(100), { x, y, r: a + Math.PI / 2, sx: size / 100 * (o.sx ?? 1), sy: size / 100 * (o.sy ?? 1) });
  fillShape(c, P, o.fill ?? PAL.blue, { seed: sd(D, k), amp: 0.6, dx: -2, dy: 2 });
  inkLoop(c, P, { seed: sd(D, k), w: o.w ?? Math.max(2.8, size * 0.05), amp: 0.6, heavy: 0 });
}
// ballistic splash: droplets thrown from (x,y) at time t (seconds since impact)
export function splash(c, x, y, t, D, k, o = {}) {
  const { n = 9, v = 900, g = 2600, spread = 2.4, up = -Math.PI / 2, size = 26, life = 0.7, fill = PAL.blue } = o;
  if (t < 0 || t > life) return;
  for (let i = 0; i < n; i++) {
    const ang = up + (hs(k, i) - 0.5) * spread;
    const vv = v * (0.55 + 0.6 * hs(k, i, 2));
    const vx = Math.cos(ang) * vv, vy = Math.sin(ang) * vv;
    const px = x + vx * t, py = y + vy * t + 0.5 * g * t * t;
    const dvx = vx, dvy = vy + g * t;
    const sz = size * (0.55 + 0.7 * hs(k, i, 3)) * (1 - 0.5 * (t / life));
    droplet(c, px, py, sz, Math.atan2(dvy, dvx) + Math.PI, D, k + i, { fill, sy: 1 + 0.4 * clamp(Math.hypot(dvx, dvy) / 1500) });
  }
}
// a "crown" splash sheet at impact
export function crownSplash(c, x, y, t, D, k, o = {}) {
  const { w = 220, h = 120, life = 0.45, fill = PAL.blueL } = o;
  if (t < 0 || t > life) return;
  const u = t / life, grow = E.out3(clamp(u * 2.2)), fall = clamp((u - 0.45) / 0.55);
  const hh = h * grow * (1 - fall * 0.9), ww = w * (0.5 + 0.5 * grow);
  const pts = [[-ww * 0.5, 0, 1]];
  const spikes = 7;
  for (let i = 0; i <= spikes * 2; i++) {
    const f = i / (spikes * 2);
    const xx = lerp(-ww * 0.5, ww * 0.5, f);
    const base = Math.sin(f * Math.PI);
    const yy = i % 2 ? -hh * (0.45 + 0.25 * base) : -hh * (0.75 + 0.35 * base) * (0.8 + 0.4 * hs(k, i));
    pts.push([xx, yy, 0]);
  }
  pts.push([ww * 0.5, 0, 1]);
  const P = resample(spline(pts.map((p) => [x + p[0], y + p[1], p[2]]), true, 4), 4, true);
  fillShape(c, P, fill, { seed: sd(D, k), amp: 1, dx: REG.dx * 0.6, dy: REG.dy * 0.6 });
  inkLoop(c, P, { seed: sd(D, k), w: 5.5, amp: 1, heavy: 0.1 });
}
export function ripple(c, x, y, t, D, k, o = {}) {
  const { n = 3, gap = 0.16, life = 1.0, rx = 300, ry = 70, w = 6, color = PAL.ink } = o;
  for (let i = 0; i < n; i++) {
    const u = (t - i * gap) / life;
    if (u <= 0 || u >= 1) continue;
    const e = E.out3(u);
    const P = ellPts(x, y, rx * (0.15 + 0.85 * e), ry * (0.15 + 0.85 * e), 48);
    c.save(); c.globalAlpha *= 1 - u;
    inkLoop(c, P, { seed: sd(D, k + i), w: w * (1 - 0.6 * u), amp: 1, heavy: 0, color });
    c.restore();
  }
}
export function puff(c, x, y, r, D, k, o = {}) {
  const P = [];
  const n = 6;
  for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2 + hs(k, 1); const rr = r * (0.75 + 0.35 * hs(k, i)); P.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.8]); }
  // scalloped cloud outline
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = P[i], b = P[(i + 1) % n];
    const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
    const dx = mx - x, dy = my - y, L = Math.hypot(dx, dy) || 1;
    pts.push([a[0], a[1], 1]); pts.push([mx + dx / L * r * 0.35, my + dy / L * r * 0.35]);
  }
  const C = resample(spline(pts, true, 3), 3, true);
  fillShape(c, C, o.fill ?? PAL.hi, { seed: sd(D, k), amp: 0.8, dx: -3, dy: 3 });
  inkLoop(c, C, { seed: sd(D, k), w: o.w ?? 5, amp: 0.9, heavy: 0.2 });
}
export function bubble(c, x, y, r, D, k, o = {}) {
  const P = circlePts(x, y, r, Math.max(10, Math.round(r)));
  if (o.fill) fillShape(c, P, o.fill, { seed: sd(D, k), amp: 0.5, dx: -1, dy: 1 });
  inkLoop(c, P, { seed: sd(D, k), w: o.w ?? Math.max(2.4, r * 0.12), amp: 0.5, heavy: 0, color: o.color ?? PAL.hi });
  inkStroke(c, [[x - r * 0.5, y - r * 0.15], [x - r * 0.25, y - r * 0.5]], { seed: sd(D, k + 1), w: Math.max(2, r * 0.14), amp: 0.3, t0: 1, t1: 1, color: o.color ?? PAL.hi });
}
// full-frame water: everything below the front curve y = f(x) is water (vertical flood, rising or draining)
// front: base y, t: time for wave motion
export function flood(c, yFront, t, D, k, o = {}) {
  const { W = 1080, H = 1920, amp = 28, color = PAL.blue, light = PAL.blueL, foam = true, curl = 0 } = o;
  if (yFront > H + 80) return;
  const n = 36;
  const surf = [];
  for (let i = 0; i <= n; i++) {
    const x = lerp(-60, W + 60, i / n);
    const y = yFront + amp * Math.sin(x * 0.009 + t * 7) + amp * 0.6 * Math.sin(x * 0.021 - t * 9 + 2) + curl * Math.sin(x * 0.006 + 1.5) * 1.5;
    surf.push([x, y]);
  }
  const body = [...surf, [W + 60, H + 200], [-60, H + 200]];
  const P = boil(body, sd(D, k), 2, 90);
  fillPoly(c, P, color);
  // lighter crest band
  const crest = [...surf, ...surf.slice().reverse().map((p, i) => [p[0], p[1] + 46 + 14 * Math.sin(i * 0.9 + t * 5)])];
  fillPoly(c, boil(crest, sd(D, k + 1), 2, 90), light);
  inkStroke(c, boil(surf, sd(D, k + 2), 1.6, 80), { seed: sd(D, k + 3), w: 8, amp: 1, t0: 4, t1: 4, dense: true });
  if (foam) {
    for (let i = 0; i < 12; i++) {
      const x = lerp(30, W - 30, (i + 0.5 * hs(k, i)) / 12);
      const y = yFront + amp * Math.sin(x * 0.009 + t * 7) + amp * 0.6 * Math.sin(x * 0.021 - t * 9 + 2) - 6;
      const r = 14 + 14 * hs(k, i, 2);
      const P2 = circlePts(x, y - r * 0.4, r, 14);
      fillShape(c, P2, PAL.hi, { seed: sd(D, k + 10 + i), amp: 0.8, dx: 0, dy: 0 });
      inkLoop(c, P2, { seed: sd(D, k + 10 + i), w: 4.5, amp: 0.8, heavy: 0 });
    }
  }
}
// radial splash fill (water bursting out from a point to cover the frame)
export function burstFill(c, x, y, R, t, D, k, o = {}) {
  const { color = PAL.blue, lobes = 13 } = o;
  if (R <= 0) return;
  const pts = [];
  for (let i = 0; i < lobes * 2; i++) {
    const a = i / (lobes * 2) * Math.PI * 2 + 0.2;
    const rr = R * (i % 2 ? 0.86 : 1.0 + 0.12 * hs(k, i));
    pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]);
  }
  const P = resample(spline(pts, true, 6), 6, true);
  fillShape(c, P, color, { seed: sd(D, k), amp: 2.5, dx: 0, dy: 0 });
  inkLoop(c, P, { seed: sd(D, k), w: 8, amp: 2, heavy: 0.2 });
}
