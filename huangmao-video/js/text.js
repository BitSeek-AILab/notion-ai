// Hand-lettering from real glyph outlines (assets/glyphs.json, built by tools/glyphs.py).
// Every letter is a boiled ink outline over an off-register colour fill, like a hand-inked title card.
import { PAL, N3, boil, hs, clamp, lerp, E, prefix, arclen } from './engine.js';

export let GL = null;
export async function loadGlyphs(url) { GL = await (await fetch(url)).json(); }

const LAYOUT = new Map();
// layout a string: returns {w, x0, y0, x1, y1 (bbox in px at size, baseline 0), chars:[{ch, x, cx, cy, polys:[[ [x,y],... ]] }]}
export function layout(str, font = 'KL', size = 100, tracking = 0) {
  const key = font + '|' + size + '|' + tracking + '|' + str;
  let L = LAYOUT.get(key);
  if (L) return L;
  const F = GL[font], k = size / F.upem;
  let x = 0, bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
  const chars = [];
  for (const ch of str) {
    if (ch === ' ') { x += size * 0.32 + tracking; continue; }
    const g = F.glyphs[ch] || GL.MK.glyphs[ch];
    if (!g) { x += size * 0.5; continue; }
    const kk = F.glyphs[ch] ? k : size / GL.MK.upem;
    const polys = g.c.map((c) => { const P = []; for (let i = 0; i < c.length; i += 2) P.push([x + c[i] * kk, c[i + 1] * kk]); return P; });
    let gx0 = Infinity, gy0 = Infinity, gx1 = -Infinity, gy1 = -Infinity;
    for (const P of polys) for (const p of P) { gx0 = Math.min(gx0, p[0]); gy0 = Math.min(gy0, p[1]); gx1 = Math.max(gx1, p[0]); gy1 = Math.max(gy1, p[1]); }
    if (polys.length) { bx0 = Math.min(bx0, gx0); by0 = Math.min(by0, gy0); bx1 = Math.max(bx1, gx1); by1 = Math.max(by1, gy1); }
    chars.push({ ch, x, adv: g.adv * kk, cx: polys.length ? (gx0 + gx1) / 2 : x + g.adv * kk / 2, cy: polys.length ? (gy0 + gy1) / 2 : -size * 0.4, polys });
    x += g.adv * kk + tracking;
  }
  L = { w: x - tracking, x0: bx0, y0: by0, x1: bx1, y1: by1, chars };
  LAYOUT.set(key, L);
  return L;
}

// draw a line of hand-lettering.
// o: { font, size, x, y (visual centre), align: 'center'|'left'|'right', tracking, fill, ink, inkW, shadow, sdx, sdy,
//      amp, D (drawing index), seed, anim(i, n) -> {s, dx, dy, r, a, fill}, reg: [dx,dy], alpha, draw (0..1 outline draw-on), fillA }
export function letters(c, str, o = {}) {
  const font = o.font || 'KL', size = o.size || 100, tr = o.tracking ?? 0;
  const L = layout(str, font, size, tr);
  const n = L.chars.length;
  const bw = L.x1 - L.x0, bh = L.y1 - L.y0;
  let ox = o.x ?? 540, oy = o.y ?? 960;
  // anchor: visual bbox centre / left / right
  const ax = o.align === 'left' ? ox - L.x0 : o.align === 'right' ? ox - L.x1 : ox - (L.x0 + bw / 2);
  const ay = oy - (L.y0 + bh / 2);
  const D = o.D ?? 0, seed = o.seed ?? 1;
  const amp = o.amp ?? Math.max(0.8, size * 0.012);
  const inkW = o.inkW ?? Math.max(2.2, size * 0.05);
  const ink = o.ink === undefined ? PAL.ink : o.ink;
  const fill = o.fill === undefined ? PAL.ink : o.fill;
  const reg = o.reg ?? [-size * 0.03, size * 0.024];
  const shadow = o.shadow ?? null;
  const sdx = o.sdx ?? size * 0.055, sdy = o.sdy ?? size * 0.07;
  c.save();
  if (o.alpha !== undefined) c.globalAlpha *= clamp(o.alpha);
  const totalDraw = o.draw ?? 1;
  for (let i = 0; i < n; i++) {
    const ch = L.chars[i];
    const an = o.anim ? o.anim(i, n, ch) : null;
    if (an && (an.s ?? 1) <= 0.001) continue;
    if (an && an.a !== undefined && an.a <= 0.001) continue;
    const s = an?.s ?? 1, r = an?.r ?? 0, dx = an?.dx ?? 0, dy = an?.dy ?? 0;
    const pcx = ch.cx, pcy = ch.cy;
    const cs = Math.cos(r), sn = Math.sin(r);
    const tf = (p) => { const x = (p[0] - pcx) * s, y = (p[1] - pcy) * s; return [ax + pcx + dx + x * cs - y * sn, ay + pcy + dy + x * sn + y * cs]; };
    const sd = seed * 131 + i * 17 + D * 7;
    const polys = ch.polys.map((P) => boil(P.map(tf), sd, amp, 60));
    c.save();
    if (an && an.a !== undefined) c.globalAlpha *= clamp(an.a);
    // draw-on fraction for this char (sequential)
    const u = clamp(totalDraw * n - i);
    if (u <= 0) { c.restore(); continue; }
    const fillA = (o.fillA ?? 1) * (o.draw !== undefined ? clamp((u - 0.75) / 0.25) : 1);
    if (shadow && fillA > 0) {
      c.save(); c.globalAlpha *= fillA;
      c.beginPath();
      for (const P of polys) { c.moveTo(P[0][0] + sdx, P[0][1] + sdy); for (let k = 1; k < P.length; k++) c.lineTo(P[k][0] + sdx, P[k][1] + sdy); c.closePath(); }
      c.fillStyle = shadow; c.fill('nonzero'); c.restore();
    }
    if (fill && fillA > 0) {
      const fpolys = ch.polys.map((P) => boil(P.map(tf), sd + 0.5, amp, 60));
      c.save(); c.globalAlpha *= fillA;
      c.beginPath();
      for (const P of fpolys) { c.moveTo(P[0][0] + reg[0], P[0][1] + reg[1]); for (let k = 1; k < P.length; k++) c.lineTo(P[k][0] + reg[0], P[k][1] + reg[1]); c.closePath(); }
      c.fillStyle = an?.fill || fill; c.fill('nonzero'); c.restore();
    }
    if (ink && inkW > 0) {
      c.lineJoin = 'round'; c.lineCap = 'round'; c.strokeStyle = ink;
      if (u >= 1) {
        c.lineWidth = inkW * (an?.w ?? 1);
        c.beginPath(); for (const P of polys) { c.moveTo(P[0][0], P[0][1]); for (let k = 1; k < P.length; k++) c.lineTo(P[k][0], P[k][1]); c.closePath(); }
        c.stroke();
      } else {
        // outline draw-on: every contour of this glyph grows together
        c.lineWidth = inkW;
        c.beginPath();
        for (const P of polys) { const Q = prefix([...P, P[0]], u / 0.75); if (Q.length > 1) { c.moveTo(Q[0][0], Q[0][1]); for (let k = 1; k < Q.length; k++) c.lineTo(Q[k][0], Q[k][1]); } }
        c.stroke();
      }
    }
    c.restore();
  }
  c.restore();
  return { w: bw, h: bh, x0: ax + L.x0, y0: ay + L.y0, x1: ax + L.x1, y1: ay + L.y1, L, ax, ay };
}

// bbox of a string at size (for layout decisions)
export function measure(str, font = 'KL', size = 100, tracking = 0) {
  const L = layout(str, font, size, tracking);
  return { w: L.x1 - L.x0, h: L.y1 - L.y0, adv: L.w };
}

// standard per-char pop-in animation: chars land one after another from t0 with stagger st
export function popIn(t, t0, st = 0.06, dur = 0.28, o = {}) {
  const { rot = 0.22, drop = 0, seed = 3 } = o;
  return (i, n) => {
    const u = clamp((t - t0 - i * st) / dur);
    if (u <= 0) return { s: 0 };
    const s = E.outBack(u, 2.2);
    return { s: Math.max(0.001, s), r: (1 - u) * rot * (hs(seed, i) - 0.5) * 2, dy: (1 - E.out3(u)) * drop };
  };
}
// knock-out: chars fly away from t0 (scatter)
export function flyOut(t, t0, dur = 0.45, o = {}) {
  const { seed = 9, power = 900, grav = 2600 } = o;
  return (i, n) => {
    const u = t - t0;
    if (u <= 0) return { s: 1 };
    if (u > dur) return { s: 0 };
    const ang = -Math.PI / 2 + (hs(seed, i) - 0.5) * 2.6;
    const v = power * (0.7 + 0.6 * hs(seed, i, 2));
    return { s: 1 - 0.3 * u / dur, dx: Math.cos(ang) * v * u, dy: Math.sin(ang) * v * u + 0.5 * grav * u * u, r: (hs(seed, i, 3) - 0.5) * 9 * u, a: 1 - Math.pow(u / dur, 3) };
  };
}
