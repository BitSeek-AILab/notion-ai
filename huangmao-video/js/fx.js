// 黄毛理论 v2 · effects: confetti, sparkle rings, badge light-up, dust, splash, rain, speed lines, shards, zzz, bubbles with text
import { c, PAL, circ, ell, line, sparkle, fillP, path, bubble, cloud, rrFill, ring, star } from './draw.js';
import { clamp, lerp, hs, hr, E, popS, ramp, D2R, starPts } from './lib.js';
import { FONTS, label } from './type.js';

const CONF = [PAL.coral, PAL.mint, PAL.blue2, PAL.pink, PAL.yel, PAL.purple, '#ffffff', PAL.sky];
// confetti burst from (x,y). o: { n, spd, up, g, life, cols, spread, ang }
export function confetti(t, t0, x, y, seed = 1, o = {}) {
  const lt = t - t0; if (lt < 0) return;
  const n = o.n ?? 60, life = o.life ?? 2.4, g = o.g ?? 1500, cols = o.cols ?? CONF;
  for (let i = 0; i < n; i++) {
    const ang = (o.ang ?? -Math.PI / 2) + (hs(seed, i) - 0.5) * (o.spread ?? Math.PI * 1.7);
    const sp = (o.spd ?? 1500) * (0.35 + 0.65 * hs(seed, i, 2));
    const T = Math.min(lt, life) * (0.9 + 0.2 * hs(seed, i, 9));
    const drag = 1.6, k = (1 - Math.exp(-drag * T)) / drag;
    const px = x + Math.cos(ang) * sp * k + Math.sin(T * 4 + i) * 18;
    const py = y + Math.sin(ang) * sp * k + 0.5 * g * T * T * 0.55;
    const a = 1 - ramp(lt, life * 0.65, life * 0.35);
    if (a <= 0 || py > 2100) continue;
    const col = cols[Math.floor(hs(seed, i, 4) * cols.length) % cols.length];
    c.save(); c.globalAlpha *= a; c.translate(px, py); c.rotate(T * (4 + 6 * hs(seed, i, 5)) + i);
    const sz = (o.size ?? 22) * (0.6 + 0.6 * hs(seed, i, 6)), kind = Math.floor(hs(seed, i, 7) * 3);
    c.fillStyle = col;
    if (kind === 0) { c.scale(1, Math.abs(Math.cos(T * 7 + i)) + 0.15); c.fillRect(-sz / 2, -sz * 0.3, sz, sz * 0.6); }
    else if (kind === 1) { c.beginPath(); c.arc(0, 0, sz * 0.36, 0, Math.PI * 2); c.fill(); }
    else { c.scale(Math.abs(Math.cos(T * 6 + i)) + 0.2, 1); c.beginPath(); c.moveTo(0, -sz * 0.45); c.lineTo(sz * 0.42, sz * 0.32); c.lineTo(-sz * 0.42, sz * 0.32); c.closePath(); c.fill(); }
    c.restore();
  }
}
// ring of sparkles + expanding ring: the "badge lights up" accent
export function sparkleBurst(t, t0, x, y, r = 90, o = {}) {
  const lt = t - t0; if (lt < 0 || lt > 0.9) return;
  const u = E.out3(clamp(lt / 0.6)), a = 1 - clamp((lt - 0.35) / 0.5);
  c.save(); c.globalAlpha *= a;
  ring(x, y, r * (0.5 + 0.9 * u), (o.w ?? 10) * (1 - u) + 1, o.ringCol ?? '#ffffff');
  const n = o.n ?? 8;
  for (let i = 0; i < n; i++) {
    const ang = (i / n) * Math.PI * 2 + (o.rot ?? 0.3);
    const d = r * (0.6 + 1.0 * u);
    sparkle(x + Math.cos(ang) * d, y + Math.sin(ang) * d, (o.s ?? 20) * (1 - 0.6 * u) * (i % 2 ? 0.7 : 1), i % 2 ? (o.col2 ?? PAL.yel) : (o.col ?? '#ffffff'), lt * 3);
  }
  c.restore();
}
// short radial "pop lines" (emphasis ticks around a point)
export function popLines(t, t0, x, y, r = 80, o = {}) {
  const lt = t - t0; if (lt < 0 || lt > 0.45) return;
  const u = E.out3(lt / 0.45), n = o.n ?? 7, a0 = o.a0 ?? -Math.PI * 0.9, a1 = o.a1 ?? -Math.PI * 0.1;
  for (let i = 0; i < n; i++) {
    const ang = lerp(a0, a1, n === 1 ? 0.5 : i / (n - 1));
    const r0 = r * (1 + 0.5 * u), r1 = r * (1.25 + 0.75 * u) - r * 0.3 * u;
    line(x + Math.cos(ang) * r0, y + Math.sin(ang) * r0, x + Math.cos(ang) * Math.max(r0, r1), y + Math.sin(ang) * Math.max(r0, r1), o.col ?? PAL.navy, (o.w ?? 9) * (1 - u * 0.7));
  }
}
export function dust(t, t0, x, y, seed = 3, o = {}) {
  const lt = t - t0; if (lt < 0 || lt > 0.7) return;
  const n = o.n ?? 6;
  for (let i = 0; i < n; i++) {
    const s = i % 2 ? 1 : -1, d = (o.w ?? 70) * (0.4 + hs(seed, i)) * E.out3(lt / 0.7);
    const rr = (o.r ?? 20) * (0.6 + 0.6 * hs(seed, i, 2)) * (1 - lt / 0.7);
    c.save(); c.globalAlpha *= 0.85; circ(x + s * d, y - 6 - lt * 40 * hs(seed, i, 3), rr, o.col ?? '#ffffff'); c.restore();
  }
}
export function splash(t, t0, x, y, seed = 5, o = {}) {
  const lt = t - t0; if (lt < 0 || lt > 0.9) return;
  const n = o.n ?? 12;
  for (let i = 0; i < n; i++) {
    const ang = -Math.PI / 2 + (hs(seed, i) - 0.5) * 2.4, sp = (o.spd ?? 900) * (0.5 + 0.5 * hs(seed, i, 2));
    const px = x + Math.cos(ang) * sp * lt, py = y + Math.sin(ang) * sp * lt + 1800 * lt * lt;
    const r = (o.r ?? 13) * (0.6 + 0.6 * hs(seed, i, 3)) * (1 - lt / 0.9);
    ell(px, py, r * 0.8, r * 1.1, o.col ?? PAL.sky, ang + Math.PI / 2);
  }
}
export function rain(t, x0, y0, w, h, n = 40, o = {}) {
  c.save(); c.globalAlpha *= o.a ?? 0.35; c.strokeStyle = o.col ?? '#ffffff'; c.lineWidth = o.w ?? 4; c.lineCap = 'round';
  c.beginPath();
  for (let i = 0; i < n; i++) {
    const sp = 1700 + 500 * hs(i, 4), L = 50 + 40 * hs(i, 5);
    const yy = y0 + (((hs(i, 2) * h + t * sp) % h) + h) % h, xx = x0 + hs(i, 3) * w - (yy - y0) * 0.18;
    c.moveTo(xx, yy); c.lineTo(xx - L * 0.18, yy + L);
  }
  c.stroke(); c.restore();
}
export function speedLines(t, x0, y0, w, h, n = 14, o = {}) {
  c.save(); c.globalAlpha *= o.a ?? 0.5; c.fillStyle = o.col ?? '#ffffff';
  for (let i = 0; i < n; i++) {
    const L = (o.L ?? 220) * (0.5 + hs(i, 7)), sp = (o.spd ?? 2600) * (0.7 + 0.6 * hs(i, 8));
    const xx = x0 + w - ((((hs(i, 1) * (w + L)) + t * sp) % (w + L)) + (w + L)) % (w + L);
    const yy = y0 + hs(i, 2) * h, th = (o.th ?? 8) * (0.5 + hs(i, 3));
    c.beginPath(); c.roundRect(xx, yy, L, th, th / 2); c.fill();
  }
  c.restore();
}
// shards of a box flying out (drop moment)
export function shards(t, t0, x, y, w, h, col, seed = 9, o = {}) {
  const lt = t - t0; if (lt < 0 || lt > 1.6) return;
  const n = o.n ?? 14;
  for (let i = 0; i < n; i++) {
    const ang = (i / n) * Math.PI * 2 + hs(seed, i) * 0.4, sp = 1300 + 900 * hs(seed, i, 2);
    const px = x + Math.cos(ang) * sp * lt, py = y + Math.sin(ang) * sp * lt + 1400 * lt * lt;
    const s = (o.s ?? 70) * (0.6 + 0.7 * hs(seed, i, 3));
    c.save(); c.globalAlpha *= 1 - clamp((lt - 1.0) / 0.6); c.translate(px, py); c.rotate(lt * (6 * hs(seed, i, 4) - 3) * 2);
    fillP([[-s * 0.5, -s * 0.4], [s * 0.55, -s * 0.2], [s * 0.1, s * 0.5]], i % 3 === 0 ? PAL.grey2 : col);
    c.restore();
  }
}
// floating Z z z
export function zzz(t, x, y, o = {}) {
  for (let i = 0; i < 3; i++) {
    const u = ((t * 0.7 + i / 3) % 1);
    c.save(); c.globalAlpha *= Math.sin(u * Math.PI); c.translate(x + u * 70 + Math.sin(u * 6) * 8, y - u * 150); c.rotate(-0.2);
    c.font = `${(o.size ?? 64) * (0.6 + 0.5 * u)}px ${FONTS.RH}`; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.lineWidth = 10; c.strokeStyle = o.edge ?? PAL.navy; c.lineJoin = 'round'; c.strokeText('Z', 0, 0); c.fillStyle = o.col ?? '#ffffff'; c.fillText('Z', 0, 0);
    c.restore();
  }
}
// speech bubble with text that pops in from its tail. o: { size, font, col, txt, edge, dir }
export function say(t, t0, t1, x, y, str, tx, ty, o = {}) {
  if (t < t0) return;
  const size = o.size ?? 56, font = o.font ?? 'RH';
  c.font = `${size}px ${FONTS[font]}`; const tw = c.measureText(str).width;
  const w = tw + size * 1.1, h = size * 1.7;
  let s = popS(t, t0, 0.3);
  if (t > t1) s *= 1 - E.in2(clamp((t - t1) / 0.18));
  if (s <= 0.001) return;
  const px = lerp(tx, x, 0.5), py = lerp(ty, y, 0.5);
  c.save(); c.translate(px, py); c.scale(s, s); c.rotate((1 - Math.min(1, (t - t0) / 0.3)) * (o.rot ?? -0.15)); c.translate(-px, -py);
  if (o.shadow !== false) { c.save(); c.globalAlpha *= 0.15; c.translate(8, 10); bubble(x, y, w, h, tx + 8, ty + 10, PAL.navy, { r: o.r }); c.restore(); }
  bubble(x, y, w, h, tx, ty, o.col ?? '#ffffff', { edge: o.edge, edgeCol: o.edgeCol, r: o.r });
  c.font = `${size}px ${FONTS[font]}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = o.txt ?? PAL.navy;
  c.fillText(str, x, y + size * 0.05);
  c.restore();
  return { w, h };
}
// thought cloud with text
export function think(t, t0, t1, x, y, str, tx, ty, o = {}) {
  if (t < t0) return;
  const size = o.size ?? 50, font = o.font ?? 'RB';
  c.font = `${size}px ${FONTS[font]}`; const tw = c.measureText(str).width;
  const w = tw + size * 1.6, h = size * 2.4;
  let s = popS(t, t0, 0.32); if (t > t1) s *= 1 - E.in2(clamp((t - t1) / 0.18));
  if (s <= 0.001) return;
  c.save(); c.translate(x, y); c.scale(s, s); c.translate(-x, -y);
  const col = o.col ?? '#ffffff';
  c.save(); c.globalAlpha *= 0.15; cloud(x + 8, y + 10, w, h, PAL.navy, o.seed ?? 3, 10); c.restore();
  cloud(x, y, w, h, col, o.seed ?? 3, 10);
  circ(lerp(x, tx, 0.55), lerp(y + h * 0.35, ty, 0.55), size * 0.32, col); circ(lerp(x, tx, 0.85), lerp(y + h * 0.35, ty, 0.85), size * 0.2, col);
  c.font = `${size}px ${FONTS[font]}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = o.txt ?? PAL.navy; c.fillText(str, x, y + size * 0.05);
  c.restore();
}
// badge light-up accent (call at the chest position)
export function badgeFx(t, t0, x, y, s = 1) {
  sparkleBurst(t, t0, x, y, 70 * s, { n: 8, s: 18 * s });
}
// white flash overlay
export function flash(t, t0, d = 0.25, a = 1, col = '#ffffff') {
  const lt = t - t0; if (lt < 0 || lt > d) return;
  c.save(); c.globalAlpha *= a * (1 - lt / d); c.fillStyle = col; c.fillRect(-100, -100, 1300, 2200); c.restore();
}
// "+1" / small floating tags
export function floatTag(t, t0, x, y, str, o = {}) {
  const lt = t - t0; if (lt < 0 || lt > (o.life ?? 1.2)) return;
  const s = popS(t, t0, 0.25), a = 1 - clamp((lt - (o.life ?? 1.2) + 0.3) / 0.3);
  c.save(); c.globalAlpha *= a; c.translate(x, y - E.out3(clamp(lt / 1.2)) * (o.rise ?? 60)); c.scale(s, s);
  c.font = `${o.size ?? 70}px ${FONTS[o.font ?? 'RH']}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineJoin = 'round';
  c.lineWidth = (o.size ?? 70) * 0.22; c.strokeStyle = o.edge ?? PAL.navy; c.strokeText(str, 0, 0); c.fillStyle = o.col ?? PAL.yel; c.fillText(str, 0, 0);
  c.restore();
}
// rounded label pill (age tags, small UI stickers); scales from its centre
export function pill(x, y, str, s = 1, o = {}) {
  if (s <= 0.001) return;
  const size = o.size ?? 46, font = o.font ?? 'RH';
  c.save(); c.font = `${size}px ${FONTS[font]}`; const w = c.measureText(str).width + size * 1.1, h = size * 1.5;
  c.translate(x, y); c.rotate(o.rot ?? 0); c.scale(s, s);
  rrFill(-w / 2 - 6, -h / 2 - 6 + 8, w + 12, h + 12, h / 2 + 6, 'rgba(23,21,58,0.25)');
  rrFill(-w / 2 - 6, -h / 2 - 6, w + 12, h + 12, h / 2 + 6, o.edge ?? PAL.navy);
  rrFill(-w / 2, -h / 2, w, h, h / 2, o.col ?? '#ffffff');
  label(str, 0, size * 0.05, size, o.txt ?? PAL.navy, { font });
  c.restore();
}
