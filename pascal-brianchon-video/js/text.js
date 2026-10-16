// Lettering from real glyph outlines (assets/glyphs.json, built by tools/glyphs.py).
// Line-art titles: optional gold outline draw-on (pen traces the glyph), then the fill lands; a dark knock-out
// stroke keeps text legible over the geometry. Markup: characters inside [ ] use the highlight colour.
import { PAL, boil, hs, clamp, E, prefix } from './engine.js';

export let GL = null;
export async function loadGlyphs(url) { GL = await (await fetch(url)).json(); }

function parse(str) {
  let plain = '', hl = [], on = false;
  for (const ch of str) {
    if (ch === '[') { on = true; continue; }
    if (ch === ']') { on = false; continue; }
    plain += ch; hl.push(on);
  }
  return { plain, hl };
}
const LAYOUT = new Map();
export function layout(str, font = 'SB', size = 100, tracking = 0) {
  const key = font + '|' + size + '|' + tracking + '|' + str;
  let L = LAYOUT.get(key);
  if (L) return L;
  const { plain, hl } = parse(str);
  const F = GL[font], k = size / F.upem;
  let x = 0, bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity, ci = 0;
  const chars = [];
  for (const ch of plain) {
    const h = hl[ci++];
    if (ch === ' ') { x += size * 0.3 + tracking; continue; }
    let g = F.glyphs[ch], kk = k;
    if (!g) { for (const alt of ['SB', 'SM', 'WK']) if (GL[alt].glyphs[ch]) { g = GL[alt].glyphs[ch]; kk = size / GL[alt].upem; break; } }
    if (!g) { x += size * 0.5; continue; }
    const polys = g.c.map((c) => { const P = []; for (let i = 0; i < c.length; i += 2) P.push([x + c[i] * kk, c[i + 1] * kk]); return P; });
    let gx0 = Infinity, gy0 = Infinity, gx1 = -Infinity, gy1 = -Infinity;
    for (const P of polys) for (const p of P) { gx0 = Math.min(gx0, p[0]); gy0 = Math.min(gy0, p[1]); gx1 = Math.max(gx1, p[0]); gy1 = Math.max(gy1, p[1]); }
    if (polys.length) { bx0 = Math.min(bx0, gx0); by0 = Math.min(by0, gy0); bx1 = Math.max(bx1, gx1); by1 = Math.max(by1, gy1); }
    chars.push({ ch, h, x, adv: g.adv * kk, cx: polys.length ? (gx0 + gx1) / 2 : x + g.adv * kk / 2, cy: polys.length ? (gy0 + gy1) / 2 : -size * 0.4, polys });
    x += g.adv * kk + tracking;
  }
  // vertical metrics from the em box so lines of mixed glyphs align (CJK: centre ≈ -0.38 em)
  L = { w: x - tracking, x0: bx0, y0: -size * 0.88, y1: size * 0.12, x1: bx1, gy0: by0, gy1: by1, chars };
  LAYOUT.set(key, L);
  return L;
}
export function measure(str, font = 'SB', size = 100, tracking = 0) {
  const L = layout(str, font, size, tracking);
  return { w: L.x1 - L.x0, h: L.y1 - L.y0 };
}

// o: { font, size, x, y (visual centre of the em box), align, tracking, fill, hl (highlight colour), knock (outline width in bg colour),
//      amp (boil px), D (drawing index), seed, anim(i, n, ch) -> {s, dx, dy, r, a}, draw (0..1 outline draw-on → fill), pen (draw-on colour), alpha }
export function letters(c, str, o = {}) {
  const font = o.font || 'SB', size = o.size || 100, tr = o.tracking ?? 0;
  const L = layout(str, font, size, tr);
  const n = L.chars.length;
  const bw = L.x1 - L.x0, bh = L.y1 - L.y0;
  const ox = o.x ?? 540, oy = o.y ?? 960;
  const ax = o.align === 'left' ? ox - L.x0 : o.align === 'right' ? ox - L.x1 : ox - (L.x0 + bw / 2);
  const ay = oy - (L.y0 + bh / 2);
  const D = o.D ?? 0, seed = o.seed ?? 1;
  const amp = o.amp ?? Math.max(0.35, size * 0.006);
  const fill = o.fill ?? PAL.cream, hl = o.hl ?? PAL.gold;
  const knock = o.knock ?? Math.max(4, size * 0.09);
  const pen = o.pen ?? PAL.gold;
  c.save();
  if (o.alpha !== undefined) c.globalAlpha *= clamp(o.alpha);
  const totalDraw = o.draw ?? 1;
  const tips = [];
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
    const polys = ch.polys.map((P) => boil(P.map(tf), sd, amp, 55));
    const u = clamp(totalDraw * n - i);
    if (u <= 0) continue;
    c.save();
    if (an && an.a !== undefined) c.globalAlpha *= clamp(an.a);
    const col = an?.fill || (ch.h ? hl : fill);
    const fillA = o.draw !== undefined ? clamp((u - 0.6) / 0.4) : 1;
    const path = () => { c.beginPath(); for (const P of polys) { c.moveTo(P[0][0], P[0][1]); for (let k = 1; k < P.length; k++) c.lineTo(P[k][0], P[k][1]); c.closePath(); } };
    if (fillA > 0) {
      c.save(); c.globalAlpha *= fillA;
      path();
      if (knock > 0) { c.lineJoin = 'round'; c.lineWidth = knock * s; c.strokeStyle = o.knockColor || 'rgba(11,19,32,0.92)'; c.stroke(); }
      c.fillStyle = col; c.fill('nonzero');
      c.restore();
    }
    if (u < 1 && o.draw !== undefined) {
      // pen traces every contour of this glyph together
      const f = clamp(u / 0.75);
      c.lineWidth = Math.max(1.6, size * 0.022); c.lineJoin = 'round'; c.lineCap = 'round'; c.strokeStyle = pen;
      c.beginPath();
      for (const P of polys) {
        const Q = prefix([...P, P[0]], f);
        if (Q.length > 1) { c.moveTo(Q[0][0], Q[0][1]); for (let k = 1; k < Q.length; k++) c.lineTo(Q[k][0], Q[k][1]); if (f < 1) tips.push(Q[Q.length - 1]); }
      }
      c.stroke();
    }
    c.restore();
  }
  // glowing pen tips (only the longest contour's tip per glyph would be ideal; a few tips read as sparks)
  if (tips.length) {
    c.save(); c.globalCompositeOperation = 'lighter';
    for (const p of tips.slice(-6)) {
      const g = c.createRadialGradient(p[0], p[1], 0, p[0], p[1], 14);
      g.addColorStop(0, 'rgba(255,246,226,0.95)'); g.addColorStop(0.35, 'rgba(242,217,160,0.55)'); g.addColorStop(1, 'rgba(242,217,160,0)');
      c.fillStyle = g; c.beginPath(); c.arc(p[0], p[1], 14, 0, Math.PI * 2); c.fill();
    }
    c.restore();
  }
  c.restore();
  return { w: bw, h: bh, x0: ax + L.x0, y0: ay + L.y0, x1: ax + L.x1, y1: ay + L.y1, ax, ay };
}

// per-char pop-in: chars land one after another from t0 with stagger st
export function popIn(t, t0, st = 0.045, dur = 0.26, o = {}) {
  const { rot = 0.18, drop = 0, seed = 3, from = 0 } = o;
  return (i) => {
    const u = clamp((t - t0 - i * st) / dur);
    if (u <= 0) return { s: 0 };
    const s = from + (1 - from) * E.outBack(u, 2.0);
    return { s: Math.max(0.001, s), r: (1 - u) * rot * (hs(seed, i) - 0.5) * 2, dy: (1 - E.out3(u)) * drop };
  };
}
// slam: whole word comes from the lens (big) and lands with overshoot
export function slamIn(t, t0, dur = 0.22, o = {}) {
  const { big = 2.4, st = 0 } = o;
  return (i) => {
    const u = clamp((t - t0 - i * st) / dur);
    if (u <= 0) return { s: 0 };
    const s = u < 1 ? big + (1 - big) * E.in2(u) : 1;
    return { s, a: clamp(u * 3) };
  };
}
// exit: chars drop + fade
export function dropOut(t, t0, dur = 0.22, o = {}) {
  const { st = 0.02, dist = 40 } = o;
  return (i) => {
    const u = clamp((t - t0 - i * st) / dur);
    if (u >= 1) return { s: 0 };
    return { s: 1 - 0.25 * E.in2(u), dy: dist * E.in2(u), a: 1 - u };
  };
}
// combine an entrance + exit
export function inOut(t, tin, tout, ent, ext) {
  return (i, n, ch) => {
    if (tout !== null && t >= tout) return ext(i, n, ch);
    return ent(i, n, ch);
  };
}
