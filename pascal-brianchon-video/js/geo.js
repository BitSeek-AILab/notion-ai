// 帕斯卡 ↔ 布列安桑 · exact projective-geometry core (pure functions, no DOM; also runs in Node for checks).
// Screen coordinates: x right, y down. Angles measured from +x toward +y (i.e. clockwise on screen).
export const TAU = Math.PI * 2;
export const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
export const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
export const mul = (a, k) => [a[0] * k, a[1] * k];
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
export const len = (a) => Math.hypot(a[0], a[1]);
export const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
export const nrm = (a) => { const l = Math.hypot(a[0], a[1]) || 1; return [a[0] / l, a[1] / l]; };
export const lerp2 = (a, b, u) => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];
export const lerp3 = (a, b, u) => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u];
export const perp = (a) => [-a[1], a[0]];
export const dir = (th) => [Math.cos(th), Math.sin(th)];

// ---------------------------------------------------------------- homogeneous lines / points
export const cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const hom = (p) => [p[0], p[1], 1];
export const lineThrough = (p, q) => cross3(hom(p), hom(q));
export function meet(l, m) {
  const p = cross3(l, m);
  if (Math.abs(p[2]) < 1e-12 * (Math.abs(p[0]) + Math.abs(p[1]) + 1e-30)) return null; // parallel
  return [p[0] / p[2], p[1] / p[2]];
}
// signed distance of point from line (line normalised)
export function lineDist(l, p) { return (l[0] * p[0] + l[1] * p[1] + l[2]) / Math.hypot(l[0], l[1]); }
// how far p is from line through a,b (px)
export function offLine(a, b, p) { return Math.abs(lineDist(lineThrough(a, b), p)); }
// angle between two lines (0..pi/2)
export function lineAngle(l, m) {
  const a = Math.atan2(l[1], l[0]), b = Math.atan2(m[1], m[0]);
  let d = Math.abs(a - b) % Math.PI; return Math.min(d, Math.PI - d);
}
// clip infinite line to rect [x0,y0,x1,y1] -> [p,q] or null
export function clipLine(l, r) {
  const [a, b, c] = l, out = [];
  const [x0, y0, x1, y1] = r;
  if (Math.abs(b) > 1e-12) { for (const x of [x0, x1]) { const y = -(a * x + c) / b; if (y >= y0 - 1e-6 && y <= y1 + 1e-6) out.push([x, y]); } }
  if (Math.abs(a) > 1e-12) { for (const y of [y0, y1]) { const x = -(b * y + c) / a; if (x >= x0 - 1e-6 && x <= x1 + 1e-6) out.push([x, y]); } }
  if (out.length < 2) return null;
  let best = [out[0], out[1]], bd = -1;
  for (let i = 0; i < out.length; i++) for (let j = i + 1; j < out.length; j++) { const d = dist(out[i], out[j]); if (d > bd) { bd = d; best = [out[i], out[j]]; } }
  return best;
}
// extend segment ab beyond its ends by e0 (at a) and e1 (at b) px
export function extend(a, b, e0, e1 = e0) { const d = nrm(sub(b, a)); return [sub(a, mul(d, e0)), add(b, mul(d, e1))]; }
// segment from p0 along the line through p0,p1 that also covers extra points (all collinear), with margin
export function spanOf(pts, margin = 0) {
  const d = nrm(sub(pts[pts.length - 1], pts[0]));
  let lo = Infinity, hi = -Infinity;
  for (const p of pts) { const s = dot(sub(p, pts[0]), d); lo = Math.min(lo, s); hi = Math.max(hi, s); }
  return [add(pts[0], mul(d, lo - margin)), add(pts[0], mul(d, hi + margin))];
}

// ---------------------------------------------------------------- circle helpers  C = {x, y, r}
export const onC = (C, th) => [C.x + C.r * Math.cos(th), C.y + C.r * Math.sin(th)];
export const tanDir = (th) => [-Math.sin(th), Math.cos(th)];
// intersection of the tangents at angles t1, t2 (pole of the chord)
export function tanMeet(C, t1, t2) {
  const m = (t1 + t2) / 2, k = C.r / Math.cos((t2 - t1) / 2);
  return [C.x + k * Math.cos(m), C.y + k * Math.sin(m)];
}
// pole of a line w.r.t. circle
export function pole(C, l) {
  const [a, b, c] = l; const cc = c + a * C.x + b * C.y;
  if (Math.abs(cc) < 1e-12) return null;
  return [C.x - (a * C.r * C.r) / cc, C.y - (b * C.r * C.r) / cc];
}
// polar line of a point w.r.t. circle: (p-c)·(x-c) = r^2
export function polar(C, p) {
  const dx = p[0] - C.x, dy = p[1] - C.y;
  return [dx, dy, -(dx * C.x + dy * C.y) - C.r * C.r];
}

// ---------------------------------------------------------------- Pascal (any 6 points, any order)
// P: 6 points in hexagon order. Returns sides (as point pairs), the 3 opposite-side crossings X[k] = (side k) ∩ (side k+3),
// the Pascal line through them and a collinearity residual (px) for checks.
export function pascal(P) {
  const L = [];
  for (let i = 0; i < 6; i++) L.push(lineThrough(P[i], P[(i + 1) % 6]));
  const X = [0, 1, 2].map((k) => meet(L[k], L[k + 3]));
  let line = null, resid = Infinity;
  if (X.every(Boolean)) {
    // best line: through the two farthest points
    let ia = 0, ib = 1, bd = -1;
    for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) { const d = dist(X[i], X[j]); if (d > bd) { bd = d; ia = i; ib = j; } }
    line = lineThrough(X[ia], X[ib]);
    resid = Math.max(...X.map((x) => Math.abs(lineDist(line, x))));
  }
  return { L, X, line, resid };
}

// ---------------------------------------------------------------- Brianchon for a circle, tangent points at angles th[0..5]
// tangential hexagon vertices W[i] = tangent(th[i]) ∩ tangent(th[i+1]); diagonals W[k]–W[k+3]; Brianchon point B.
export function brianchon(C, th) {
  const W = [];
  for (let i = 0; i < 6; i++) {
    let a = th[i], b = th[(i + 1) % 6];
    while (b <= a) b += TAU;
    W.push(tanMeet(C, a, b));
  }
  const D = [0, 1, 2].map((k) => lineThrough(W[k], W[k + 3]));
  const B1 = meet(D[0], D[1]), B2 = meet(D[1], D[2]), B3 = meet(D[0], D[2]);
  const B = B1 && B2 && B3 ? [(B1[0] + B2[0] + B3[0]) / 3, (B1[1] + B2[1] + B3[1]) / 3] : null;
  const resid = B ? Math.max(...D.map((d) => Math.abs(lineDist(d, B)))) : Infinity;
  return { W, D, B, resid };
}

// ---------------------------------------------------------------- 3D lift (the "升维" proof of Brianchon)
// Tilt the tangent line at A_i out of the plane with slope s_i = ±lam (alternating). Adjacent tilted sides still meet because
// both tangent segments from a vertex have the same length (切线长相等). Vertex heights: h_i = ±lam * R * tan(gap_i / 2).
// All tilted sides are rulings of the hyperboloid x²+y² − z²/lam² = R², so opposite tilted sides are coplanar; hence the
// three space diagonals pairwise meet, are not coplanar, and therefore pass through ONE point Q3 above the Brianchon point.
export function lift(C, th, lam) {
  const V = [], h = [];
  for (let i = 0; i < 6; i++) {
    let a = th[i], b = th[(i + 1) % 6];
    while (b <= a) b += TAU;
    const w = tanMeet(C, a, b);
    const t = C.r * Math.tan((b - a) / 2);           // tangent length from W_i to A_i and to A_{i+1}
    const hi = (i % 2 === 0 ? 1 : -1) * lam * t;
    V.push([w[0], w[1], hi]); h.push(hi);
  }
  // space diagonals V_k V_{k+3}; closest point of lines 0 and 1 (they intersect exactly)
  const Q = closest3(V[0], V[3], V[1], V[4]);
  return { V, h, Q };
}
export const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const add3 = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const mul3 = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
export const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const len3 = (a) => Math.hypot(a[0], a[1], a[2]);
// midpoint of the shortest segment between lines p1p2 and p3p4 (+ its length as .gap)
export function closest3(p1, p2, p3, p4) {
  const u = sub3(p2, p1), v = sub3(p4, p3), w = sub3(p1, p3);
  const a = dot3(u, u), b = dot3(u, v), c = dot3(v, v), d = dot3(u, w), e = dot3(v, w);
  const den = a * c - b * b;
  const s = Math.abs(den) < 1e-12 ? 0 : (b * e - c * d) / den, t = Math.abs(den) < 1e-12 ? 0 : (a * e - b * d) / den;
  const P = add3(p1, mul3(u, s)), Q = add3(p3, mul3(v, t));
  const M = mul3(add3(P, Q), 0.5); M.gap = len3(sub3(P, Q));
  return M;
}
// distance of point X from 3D line ab
export function off3(a, b, X) {
  const u = sub3(b, a), w = sub3(X, a);
  const c = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
  return len3(c) / len3(u);
}

// ---------------------------------------------------------------- conics by eccentricity (focus F, axis angle ax, semi-latus p)
// r(φ) = p / (1 + e cos φ), φ measured from the axis. e=0 circle, e<1 ellipse, e=1 parabola, e>1 hyperbola (near branch).
export function conicPt(F, ax, p, e, phi) {
  const r = p / (1 + e * Math.cos(phi));
  return [F[0] + r * Math.cos(ax + phi), F[1] + r * Math.sin(ax + phi)];
}
// sample the visible part of the conic as polylines inside rect (handles both hyperbola branches)
export function conicPolys(F, ax, p, e, rect, n = 720) {
  const polys = []; let cur = [];
  const inR = (q) => q[0] > rect[0] - 400 && q[0] < rect[2] + 400 && q[1] > rect[1] - 400 && q[1] < rect[3] + 400;
  for (let i = 0; i <= n; i++) {
    const phi = -Math.PI + (TAU * i) / n;
    const den = 1 + e * Math.cos(phi);
    if (den <= 1e-3 && e >= 1) { if (cur.length > 1) polys.push(cur); cur = []; continue; }
    const q = conicPt(F, ax, p, e, phi);
    if (!inR(q)) { if (cur.length > 1) polys.push(cur); cur = []; continue; }
    cur.push(q);
  }
  if (cur.length > 1) polys.push(cur);
  // far branch of a hyperbola: den < 0 → r < 0 gives points on the other branch
  if (e > 1) {
    let c2 = [];
    for (let i = 0; i <= n; i++) {
      const phi = -Math.PI + (TAU * i) / n;
      const den = 1 + e * Math.cos(phi);
      if (den >= -1e-3) { if (c2.length > 1) polys.push(c2); c2 = []; continue; }
      const q = conicPt(F, ax, p, e, phi);
      if (!inR(q)) { if (c2.length > 1) polys.push(c2); c2 = []; continue; }
      c2.push(q);
    }
    if (c2.length > 1) polys.push(c2);
  }
  return polys;
}
