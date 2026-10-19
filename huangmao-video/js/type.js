// 黄毛理论 v2 · 综艺花字 (variety-show captions): fill + thick white stroke + coloured outer stroke + hard extrusion,
// per-character elastic pop (0 → 1.15 → 1 in ~8 frames, 2-frame stagger), gentle wiggle while they stay.
import { c, PAL } from './draw.js';
import { clamp, lerp, hs, E, popS } from './lib.js';

export const FONTS = { RH: '"RHR Heavy"', RB: '"RHR Bold"', SS: '"Smiley Sans"' };
const PUNCT = '，。？！：；、…—“”‘’（）';
export function measureLine(str, size, font = 'RH', tracking = 0) {
  c.font = `${size}px ${FONTS[font] || font}`;
  const ch = [...str], w = ch.map((x) => c.measureText(x).width * (PUNCT.includes(x) ? 0.78 : 1) + tracking);
  const tot = w.reduce((a, b) => a + b, 0) - tracking;
  return { ch, w, tot };
}
// plain text (labels / UI), no animation
export function label(str, x, y, size, col, o = {}) {
  c.save();
  c.font = `${size}px ${FONTS[o.font || 'RB'] || o.font}`;
  c.textAlign = o.align || 'center'; c.textBaseline = 'middle';
  if (o.tracking) c.letterSpacing = o.tracking + 'px';
  if (o.stroke) { c.lineJoin = 'round'; c.lineWidth = o.stroke * 2; c.strokeStyle = o.strokeCol || PAL.white; c.strokeText(str, x, y); }
  c.fillStyle = col; c.fillText(str, x, y);
  c.restore();
}
export const labelW = (str, size, font = 'RB') => { c.font = `${size}px ${FONTS[font] || font}`; return c.measureText(str).width; };

// default per-char animation: pop in from tIn, exit at tOut (shrink + rise), wiggle in between
export function popAnim(t, tIn, tOut = 1e9, o = {}) {
  const st = o.st ?? 0.067, d = o.d ?? 0.27, seed = o.seed ?? 7;
  return (i, n) => {
    const t0 = tIn + (o.rev ? (n - 1 - i) : i) * st;
    let s = popS(t, t0, d);
    const u = clamp((t - t0) / d);
    let r = (1 - E.out3(u)) * (hs(seed, i) - 0.5) * 0.7;
    let dy = (1 - E.out3(u)) * (o.drop ?? 40);
    let a = t < t0 ? 0 : 1;
    if (o.wiggle !== 0 && t > t0 + d) { const w = o.wiggle ?? 1; r += w * 0.022 * Math.sin((t - t0) * 7.5 + i * 1.7); s *= 1 + w * 0.012 * Math.sin((t - t0) * 9 + i * 2.3); }
    if (t > tOut) { const v = clamp((t - tOut - (n - 1 - i) * 0.015) / 0.16); s *= 1 - E.in2(v); dy -= 50 * E.in2(v); a *= 1 - v * 0.3; }
    return { s, r, dy, dx: 0, a };
  };
}
// draw one line of 花字. o: { x, y, size, font, align, tracking, fill (col | [[o,col]..]), white, outer, outerCol, ext, extCol, colors{i:col}, outers{i:col}, anim(i,n) }
export function hz(str, o) {
  const size = o.size ?? 110, font = o.font ?? 'RH', tr = o.tracking ?? 2;
  const { ch, w, tot } = measureLine(str, size, font, tr);
  const n = ch.length, al = o.align ?? 'center';
  let x = o.x - (al === 'center' ? tot / 2 : al === 'right' ? tot : 0);
  const pos = [];
  for (let i = 0; i < n; i++) { pos.push(x + w[i] / 2 - tr / 2); x += w[i]; }
  const A = ch.map((_, i) => (o.anim ? o.anim(i, n) : { s: 1, r: 0, dx: 0, dy: 0, a: 1 }));
  const white = o.white ?? size * 0.085, outer = o.outer ?? size * 0.075, ext = o.ext ?? size * 0.07;
  const outerCol = o.outerCol ?? PAL.navy, extCol = o.extCol ?? outerCol;
  c.save();
  c.font = `${size}px ${FONTS[font] || font}`;
  c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineJoin = 'round'; c.miterLimit = 2;
  const each = (fn) => { for (let i = 0; i < n; i++) { const a = A[i]; if (!a || a.s <= 0.001 || a.a <= 0.001 || ch[i] === ' ') continue; c.save(); c.globalAlpha *= clamp(a.a); c.translate(pos[i] + (a.dx || 0), o.y + (a.dy || 0)); if (a.r) c.rotate(a.r); c.scale(a.s * (a.sx ?? 1), a.s * (a.sy ?? 1)); fn(i); c.restore(); } };
  const yo = size * 0.04; // optical baseline correction for CJK
  if (ext > 0) each((i) => { c.lineWidth = 2 * (white + outer); c.strokeStyle = (o.exts && o.exts[i]) || extCol; c.fillStyle = c.strokeStyle; const ex = ext * (o.extX ?? 0.35), ey = ext; c.strokeText(ch[i], ex, ey + yo); c.fillText(ch[i], ex, ey + yo); });
  if (outer > 0) each((i) => { c.lineWidth = 2 * (white + outer); c.strokeStyle = (o.outers && o.outers[i]) || outerCol; c.strokeText(ch[i], 0, yo); });
  if (white > 0) each((i) => { c.lineWidth = 2 * white; c.strokeStyle = o.whiteCol ?? PAL.white; c.strokeText(ch[i], 0, yo); });
  each((i) => {
    let f = (o.colors && o.colors[i]) || o.fill || PAL.white;
    if (Array.isArray(f)) { const g = c.createLinearGradient(0, -size * 0.5, 0, size * 0.5); for (const [k, col] of f) g.addColorStop(k, col); f = g; }
    c.fillStyle = f; c.fillText(ch[i], 0, yo);
    if (o.innerLine) { c.lineWidth = o.innerLine; c.strokeStyle = o.innerCol ?? 'rgba(255,255,255,0.0)'; c.strokeText(ch[i], 0, yo); }
  });
  c.restore();
  return { x0: o.x - (al === 'center' ? tot / 2 : al === 'right' ? tot : 0), w: tot, pos };
}
// convenience: index map for highlighted characters
export function tint(str, sub, col) { const o = {}; const s = [...str]; const k = [...sub]; for (let i = 0; i + k.length <= s.length; i++) { if (k.every((ch, j) => s[i + j] === ch)) for (let j = 0; j < k.length; j++) o[i + j] = col; } return o; }
export const merge = (...m) => Object.assign({}, ...m);
// the house caption style: white fill, navy outline, coloured extrusion; hl words in yellow
export function cap(str, x, y, t, tIn, tOut, o = {}) {
  if (t < tIn - 0.01 || t > tOut + 0.4) return null;
  const size = o.size ?? 104;
  const colors = merge(...(o.hl || []).map(([s, col]) => tint(str, s, col ?? PAL.yel)));
  return hz(str, { x, y, size, font: o.font ?? 'RH', fill: o.fill ?? [[0, '#ffffff'], [1, '#fff3dc']], colors, white: o.white ?? 0, outer: o.outer ?? size * 0.11, outerCol: o.outerCol ?? PAL.navy, ext: o.ext ?? size * 0.09, extCol: o.extCol ?? PAL.navy, extX: o.extX ?? 0.3, align: o.align, tracking: o.tracking ?? 3, anim: o.anim ?? popAnim(t, tIn, tOut, { st: o.st ?? 0.05, d: o.d ?? 0.27, seed: o.seed ?? 11, wiggle: o.wiggle ?? 0.6, drop: o.drop ?? 36 }) });
}
// variety 花字 (three-layer: gradient fill + fat white + coloured outer + extrusion)
export function flower(str, x, y, t, tIn, tOut, o = {}) {
  if (t < tIn - 0.01 || t > tOut + 0.4) return null;
  const size = o.size ?? 150;
  const colors = merge(...(o.hl || []).map(([s, col]) => tint(str, s, col)));
  return hz(str, { x, y, size, font: o.font ?? 'RH', fill: o.fill ?? [[0, '#fff7b0'], [0.55, PAL.yel], [1, '#ffb300']], colors, white: o.white ?? size * 0.075, outer: o.outer ?? size * 0.07, outerCol: o.outerCol ?? PAL.navy, ext: o.ext ?? size * 0.08, extCol: o.extCol ?? PAL.navy, extX: o.extX ?? 0.3, align: o.align, tracking: o.tracking ?? 4, outers: o.outers, anim: o.anim ?? popAnim(t, tIn, tOut, { st: o.st ?? 0.067, d: o.d ?? 0.27, seed: o.seed ?? 5, wiggle: o.wiggle ?? 1, drop: o.drop ?? 50 }) });
}
