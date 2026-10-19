// 黄毛理论 v2 · flat props (px units; s = scale)
import { c, PAL, shade, circ, ell, rrFill, rr, fillP, strokeP, line, arcLine, ring, heart, star, sparkle, path, lin, poly } from './draw.js';
import { clamp, lerp, hs, E, D2R, popS, circlePts } from './lib.js';
import { FONTS, label } from './type.js';

export function bouquet(x, y, s, t, o = {}) {
  const droop = o.droop ?? 0;
  c.save(); c.translate(x, y); c.rotate((o.r ?? -0.15) + droop * 0.9); c.scale(s, s);
  // stems
  for (let i = -2; i <= 2; i++) line(i * 3, 0, i * 9, -62, PAL.mint, 5);
  // flowers
  const F = [[-26, -70, PAL.coral], [0, -84, PAL.pink], [26, -70, PAL.coral2], [-12, -56, PAL.pink2], [14, -54, PAL.pink]];
  F.forEach(([fx, fy, col], i) => {
    const sag = droop * (12 + i * 4);
    for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2 + i; circ(fx + Math.cos(a) * 9, fy + sag + Math.sin(a) * 9, 9, col); }
    circ(fx, fy + sag, 7, PAL.yelL);
  });
  // wrap
  fillP([[-30, -40], [30, -40], [9, 26], [-9, 26]], o.wrap ?? '#ffffff');
  fillP([[-30, -40], [0, -40], [-9, 26]], shade(o.wrap ?? '#ffffff', -0.06));
  fillP([[-9, -6], [9, -6], [16, 6], [-16, 6]], o.ribbon ?? PAL.coral);
  c.restore();
}
export function sprayCan(x, y, s, r = 0, o = {}) {
  c.save(); c.translate(x, y); c.rotate(r); c.scale(s, s);
  rrFill(-16, -46, 32, 72, 10, o.col ?? PAL.yel);
  rrFill(-16, -22, 32, 26, 0, '#ffffff'); label('黄', 0, -9, 20, PAL.navy, { font: 'RH' });
  rrFill(-9, -58, 18, 14, 4, PAL.grey); rrFill(-5, -66, 14, 9, 3, PAL.navy);
  c.restore();
}
export function puff(t, t0, x, y, r, col = '#ffffff', seed = 2) {
  const lt = t - t0; if (lt < 0 || lt > 0.8) return;
  const u = E.out3(clamp(lt / 0.5)), a = 1 - clamp((lt - 0.4) / 0.4);
  c.save(); c.globalAlpha *= a;
  for (let i = 0; i < 7; i++) { const ang = (i / 7) * Math.PI * 2 + hs(seed, i); circ(x + Math.cos(ang) * r * 0.7 * u, y + Math.sin(ang) * r * 0.55 * u, r * (0.45 + 0.2 * hs(seed, i, 2)) * (0.4 + 0.6 * u), col); }
  c.restore();
}
export function battery(x, y, s, level, o = {}) {
  const col = level > 0.5 ? PAL.mint : level > 0.2 ? PAL.yel : PAL.coral;
  c.save(); c.translate(x, y); c.scale(s, s);
  rrFill(-62, -34, 124, 68, 16, o.frame ?? '#ffffff'); rrFill(62, -14, 12, 28, 5, o.frame ?? '#ffffff');
  rrFill(-52, -24, 104, 48, 9, o.inner ?? PAL.navy);
  if (level > 0.005) rrFill(-48, -20, 96 * clamp(level), 40, 6, col);
  if (o.pct !== false) label(Math.round(level * 100) + '%', 0, 70, 42, o.txt ?? '#ffffff', { font: 'RH' });
  if (o.bolt) { fillP([[6, -30], [-14, 4], [0, 4], [-6, 30], [14, -4], [0, -4]], PAL.yel); }
  c.restore();
}
// paint roller with handle; label on the roller sleeve
export function roller(x, y, s, r, str, o = {}) {
  c.save(); c.translate(x, y); c.rotate(r); c.scale(s, s);
  // handle (goes down-right from the frame)
  strokeP([[0, 0], [0, 60], [40, 110], [40, 210]], PAL.grey, 12);
  rrFill(28, 190, 24, 120, 12, PAL.coral);
  // sleeve
  rrFill(-150, -46, 300, 92, 30, o.col ?? '#1d1b3a');
  c.save(); c.globalAlpha *= 0.25; rrFill(-140, -40, 280, 22, 11, '#ffffff'); c.restore();
  label(str, 0, 2, 52, '#ffffff', { font: 'RH' });
  c.restore();
}
export function moon(x, y, r, bgCol) { circ(x, y, r, PAL.cream); circ(x + r * 0.42, y - r * 0.28, r * 0.86, bgCol); }
export function starsBg(t, seed = 4, n = 26, x0 = 0, y0 = 0, w = 1080, h = 1100) {
  for (let i = 0; i < n; i++) { const x = x0 + hs(seed, i) * w, y = y0 + hs(seed, i, 2) * h, tw = 0.5 + 0.5 * Math.sin(t * 3 + i * 1.7); sparkle(x, y, (8 + 12 * hs(seed, i, 3)) * (0.6 + 0.4 * tw), '#ffffff', 0); }
}
// bed seen from the side: headboard left
export function bed(x, y, w, col, o = {}) {
  rrFill(x - 30, y - 150, 34, 210, 14, shade(col, -0.25));   // headboard
  rrFill(x + w - 20, y - 70, 26, 130, 12, shade(col, -0.25)); // footboard
  rrFill(x - 10, y - 40, w + 10, 60, 14, col);                // frame
  rrFill(x - 4, y - 70, w, 44, 18, '#ffffff');                // mattress
  rrFill(x + 6, y - 112, 120, 50, 24, o.pillow ?? '#ffffff');  // pillow
}
export function blanket(x, y, w, col, o = {}) {
  const P = [[x, y - 64], [x + w * 0.22, y - 100 - (o.lump ?? 0)], [x + w * 0.6, y - 96 - (o.lump ?? 0) * 0.6], [x + w, y - 80], [x + w + 8, y - 30], [x - 6, y - 30]];
  c.beginPath(); c.moveTo(P[0][0], P[0][1]); c.bezierCurveTo(x + w * 0.1, y - 110 - (o.lump ?? 0), x + w * 0.5, y - 108, x + w, y - 82); c.lineTo(x + w + 8, y - 28); c.lineTo(x - 6, y - 28); c.closePath();
  c.fillStyle = col; c.fill();
  c.save(); c.clip(); c.fillStyle = shade(col, -0.1); c.fillRect(x - 10, y - 50, w + 30, 30); c.restore();
}
// paper scroll unrolling downward from (x,y)
export function scroll(x, y, w, len, lines, t, o = {}) {
  rrFill(x - w / 2, y, w, len, 6, '#fffaf1');
  c.save(); c.beginPath(); c.rect(x - w / 2, y, w, len); c.clip();
  lines.forEach((ln, i) => { const yy = y + 50 + i * 54; if (yy > y + len - 10) return; if (typeof ln === 'string') label(ln, x, yy, 36, PAL.navy, { font: 'RB' }); else { line(x - w * 0.36, yy, x - w * 0.36 + w * 0.72 * ln, yy, PAL.grey2, 9); } });
  c.restore();
  rrFill(x - w / 2 - 12, y + len - 14, w + 24, 28, 14, '#e9dcc4');
  rrFill(x - w / 2 - 12, y - 14, w + 24, 28, 14, '#e9dcc4');
}
// meeting table (front)
export function table(x, y, w, col = '#6b4e3d') { rrFill(x - w / 2, y, w, 34, 10, shade(col, 0.1)); rrFill(x - w / 2 + 20, y + 30, w - 40, 260, 0, col); }
export function boardChart(x, y, w, h, t, t0) {
  rrFill(x - w / 2, y - h / 2, w, h, 20, '#ffffff');
  const bars = [0.35, 0.55, 0.45, 0.8];
  bars.forEach((v, i) => { const bh = (h - 90) * v * E.out3(clamp((t - t0 - i * 0.08) / 0.4)); rrFill(x - w / 2 + 50 + i * (w - 100) / 4, y + h / 2 - 40 - bh, (w - 100) / 4 - 26, bh, 8, i === 3 ? PAL.coral : PAL.blue3); });
}
// motorbike (side view, facing right). returns seat & bar points
export function motorbike(x, y, s, t, o = {}) {
  c.save(); c.translate(x, y); c.scale(s, s);
  const wheel = (wx) => { circ(wx, 0, 44, PAL.navy); circ(wx, 0, 20, PAL.grey2); c.save(); c.translate(wx, 0); c.rotate(t * 18); for (let i = 0; i < 3; i++) { c.rotate(Math.PI * 2 / 3); line(0, 0, 0, 18, PAL.navy, 5); } c.restore(); };
  wheel(-95); wheel(95);
  fillP([[-95, -10], [-40, -70], [40, -78], [70, -40], [95, -6], [60, -10], [10, -24], [-60, -16]], o.col ?? PAL.coral);
  fillP([[-60, -70], [20, -84], [24, -74], [-56, -60]], PAL.navy); // seat
  line(60, -60, 95, -2, PAL.grey, 9); line(56, -64, 72, -110, PAL.grey, 8); line(64, -110, 92, -112, PAL.navy, 10); // fork + bars
  circ(100, -58, 13, PAL.yelL); // headlight
  c.restore();
  return { seat: [x - 20 * s, y - 80 * s], bar: [x + 82 * s, y - 110 * s] };
}
export function ticket(x, y, s, t, str = '机会', o = {}) {
  c.save(); c.translate(x, y); c.scale(s, s); c.rotate(Math.sin(t * 5) * 0.1);
  const fl = Math.sin(t * 22) * 0.5 + 0.5;
  for (const sx of [-1, 1]) { c.save(); c.scale(sx, 1); fillP([[40, -10], [100, -50 - fl * 30], [110, -10], [92, 6]], '#ffffff'); c.restore(); }
  rrFill(-70, -40, 140, 80, 16, o.col ?? PAL.yel);
  c.save(); c.globalAlpha *= 0.3; rrFill(-60, -30, 120, 16, 8, '#ffffff'); c.restore();
  label(str, 0, 3, 46, PAL.navy, { font: 'RH' });
  c.restore();
}
export function skateboard(x, y, s, r = 0, o = {}) {
  c.save(); c.translate(x, y); c.rotate(r); c.scale(s, s);
  c.beginPath(); c.moveTo(-110, -14); c.quadraticCurveTo(-130, -30, -118, -40); c.lineTo(-100, -26); c.lineTo(100, -26); c.lineTo(118, -40); c.quadraticCurveTo(130, -30, 110, -14); c.closePath(); c.fillStyle = o.col ?? PAL.coral; c.fill();
  rrFill(-104, -22, 208, 10, 5, shade(o.col ?? PAL.coral, -0.2));
  circ(-70, 0, 15, PAL.navy); circ(70, 0, 15, PAL.navy); circ(-70, 0, 6, PAL.grey2); circ(70, 0, 6, PAL.grey2);
  c.restore();
}
export function podium(x, y, w, h, str, col = PAL.purple) {
  rrFill(x - w / 2, y, w, h, 14, col); rrFill(x - w / 2 - 14, y - 6, w + 28, 26, 12, shade(col, 0.2));
  label(str, x, y + h * 0.5, 64, '#ffffff', { font: 'RH' });
}
export function moneyBag(x, y, s) {
  c.save(); c.translate(x, y); c.scale(s, s);
  ell(0, 10, 46, 44, '#c8a165'); fillP([[-18, -30], [18, -30], [10, -44], [-10, -44]], '#b88f55'); rrFill(-24, -36, 48, 10, 5, PAL.coral);
  label('¥', 0, 14, 54, '#ffffff', { font: 'RH' });
  c.restore();
}
export function die(x, y, s, r, face = '命', o = {}) {
  c.save(); c.translate(x, y); c.rotate(r); c.scale(s, s);
  c.save(); c.globalAlpha *= 0.18; rrFill(-82, -66, 170, 170, 34, PAL.navy); c.restore();
  rrFill(-90, -90, 180, 180, 36, '#ffffff'); rrFill(-90, 52, 180, 38, 0, '#ffffff');
  c.save(); rr(-90, -90, 180, 180, 36); c.clip(); c.fillStyle = '#e8e6f4'; c.fillRect(-90, 60, 180, 40); c.restore();
  if (face) label(face, 0, -4, 110, o.col ?? PAL.coral, { font: 'RH' });
  else for (const [dx, dy] of [[-45, -45], [45, 45], [0, 0], [45, -45], [-45, 45]]) circ(dx, dy, 14, PAL.navy);
  c.restore();
}
export function door(x, y, w, h, open, t, o = {}) {
  // frame + light
  rrFill(x - w / 2 - 22, y - h - 22, w + 44, h + 22, 18, o.frame ?? shade(o.col ?? PAL.purple, -0.3));
  const g = c.createLinearGradient(x, y - h, x, y); g.addColorStop(0, '#fffbe6'); g.addColorStop(1, PAL.yelL);
  c.fillStyle = g; c.fillRect(x - w / 2, y - h, w, h);
  if (open > 0.02) { for (let i = 0; i < 5; i++) sparkle(x - w * 0.3 + hs(i, 1) * w * 0.6, y - h * 0.2 - hs(i, 2) * h * 0.7, 14 + 10 * Math.sin(t * 4 + i), PAL.yel, 0); }
  // panel (hinged on left): width shrinks with open (perspective)
  const pw = w * (1 - 0.85 * E.io2(clamp(open)));
  fillP([[x - w / 2, y - h], [x - w / 2 + pw, y - h + 30 * open], [x - w / 2 + pw, y - 30 * open], [x - w / 2, y]], o.col ?? PAL.purple);
  if (pw > 30) { rrFill(x - w / 2 + pw * 0.12, y - h * 0.86 + 20 * open, pw * 0.76, h * 0.3, 10, shade(o.col ?? PAL.purple, 0.12)); rrFill(x - w / 2 + pw * 0.12, y - h * 0.48 + 10 * open, pw * 0.76, h * 0.36, 10, shade(o.col ?? PAL.purple, 0.12)); circ(x - w / 2 + pw * 0.85, y - h * 0.5, 12, PAL.yel); }
  if (open < 0.05 && o.leak !== false) { c.save(); c.globalAlpha *= 0.85; c.fillStyle = PAL.yelL; c.fillRect(x + w / 2 - 6, y - h, 6, h); c.fillRect(x - w / 2, y - 6, w, 6); c.restore(); }
}
export function cobweb(x, y, s, a = 1) {
  if (a <= 0) return;
  c.save(); c.globalAlpha *= a * 0.9; c.translate(x, y); c.scale(s, s); c.strokeStyle = '#ffffff'; c.lineWidth = 2.4; c.lineCap = 'round';
  for (let i = 0; i <= 4; i++) { const ang = (i / 4) * Math.PI / 2; c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos(ang) * 110, Math.sin(ang) * 110); c.stroke(); }
  for (let k = 1; k <= 3; k++) { c.beginPath(); for (let i = 0; i <= 4; i++) { const ang = (i / 4) * Math.PI / 2, r = k * 32; const px = Math.cos(ang) * r, py = Math.sin(ang) * r; i ? c.quadraticCurveTo(Math.cos(ang - Math.PI / 8) * r * 0.8, Math.sin(ang - Math.PI / 8) * r * 0.8, px, py) : c.moveTo(px, py); } c.stroke(); }
  c.restore();
}
export function phone(x, y, w, h, fn) {
  c.save(); c.globalAlpha *= 0.18; rrFill(x - w / 2 + 16, y - h / 2 + 22, w, h, 70, PAL.navy); c.restore();
  rrFill(x - w / 2, y - h / 2, w, h, 70, PAL.navy);
  rrFill(x - w / 2 + 22, y - h / 2 + 22, w - 44, h - 44, 52, '#f3f1fb');
  rrFill(x - 70, y - h / 2 + 40, 140, 30, 15, PAL.navy);
  c.save(); rr(x - w / 2 + 22, y - h / 2 + 22, w - 44, h - 44, 52); c.clip(); fn && fn(x - w / 2 + 22, y - h / 2 + 22, w - 44, h - 44); c.restore();
}
export function chatBubble(x, y, str, side, s, o = {}) {
  if (s <= 0.001) return;
  const size = o.size ?? 50; c.font = `${size}px ${FONTS.RB}`; const tw = c.measureText(str).width;
  const w = tw + 70, h = size + 52;
  const ax = side < 0 ? x : x - w;
  c.save(); c.translate(side < 0 ? ax : ax + w, y + h / 2); c.scale(s, s); c.translate(-(side < 0 ? ax : ax + w), -(y + h / 2));
  rrFill(ax, y, w, h, 34, o.col ?? (side < 0 ? '#ffffff' : PAL.blue));
  label(str, ax + w / 2, y + h / 2 + 2, size, o.txt ?? (side < 0 ? PAL.navy : '#ffffff'), { font: 'RB' });
  c.restore();
}
export function magnifier(x, y, r, s = 1) {
  c.save(); c.translate(x, y); c.scale(s, s);
  line(r * 0.7, r * 0.7, r * 1.6, r * 1.6, PAL.navy, r * 0.28);
  c.save(); c.globalAlpha *= 0.35; circ(0, 0, r, '#ffffff'); c.restore();
  ring(0, 0, r, r * 0.16, PAL.navy);
  c.save(); c.globalAlpha *= 0.8; arcLine(0, 0, r * 0.7, Math.PI * 1.1, Math.PI * 1.45, '#ffffff', r * 0.1); c.restore();
  c.restore();
}
export function cane(x, y, h) { strokeP([[x, y], [x, y - h], [x - 26, y - h - 18]], '#8a5a3c', 10); }
