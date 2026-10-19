// 黄毛理论 v2 · scenes B17–B25 (regret research → the door of "想做的事" → three tips → comment CTA → end card)
import { c, PAL, bg, rrFill, rr, circ, ell, fillP, strokeP, line, heart, sparkle, dots, withT, alpha, shade, ring, lin, rad } from './draw.js';
import { B, bb, BEAT, DUR } from './beat.js';
import { clamp, lerp, hs, E, popS, ramp, pulse, K, spring, mix, prefix, spline, D2R } from './lib.js';
import { flower, cap, label, labelW } from './type.js';
import { person, personSide, heartMascot, LAOSHI, HUANGMAO, KID } from './char.js';
import { stage, blobs, rays, beatP, breathe, arc, GY } from './kit.js';
import { confetti, sparkleBurst, popLines, dust, floatTag, pill } from './fx.js';
import { door, cobweb, phone, chatBubble, cane, puff } from './props.js';
import { OFFICE, RIDER, GRANNY, GIRL, CHEF, UNCLE } from './s2.js';

const Y = PAL.yel;
const lightUp = (t, t0) => ramp(t, t0, 0.3, 'pop');

// ------------------------------------------------------------------ B17 the research: regret for actions fades, regret for inaction grows
const LA = spline([[200, 690], [420, 845], [660, 985], [892, 1062]], false, 12); // regret for what we did (falls)
const LB = spline([[200, 1088], [420, 1010], [660, 838], [892, 650]], false, 12); // regret for what we didn't do (rises)
export function chart(t) {
  bg(PAL.blue);
  dots(36, 36, 1080, 1920, 72, 5, 'rgba(255,255,255,0.10)');
  flower('心理学家发现：', 540, 300, t, bb(17, 0.1), B[18] - 0.12, { size: 108 });
  const s = popS(t, bb(17, 0.12), 0.34);
  if (s > 0) {
    c.save(); c.translate(540, 890); c.scale(s, s); c.rotate((1 - Math.min(1, s)) * 0.05); c.translate(-540, -890);
    alpha(0.25, () => rrFill(128, 494, 860, 830, 48, PAL.navy));
    rrFill(110, 474, 860, 830, 48, '#ffffff');
    label('后悔程度（示意）', 168, 548, 40, PAL.grey, { font: 'RB', align: 'left' });
    const ox = 176, oy = 1172;
    line(ox, oy, ox, 620, PAL.navy, 7); fillP([[ox - 17, 632], [ox, 600], [ox + 17, 632]], PAL.navy);
    line(ox, oy, 908, oy, PAL.navy, 7); fillP([[898, oy - 17], [930, oy], [898, oy + 17]], PAL.navy);
    label('刚发生', 246, 1232, 40, PAL.grey, { font: 'RB' });
    label('多年后', 846, 1232, 40, PAL.grey, { font: 'RB' });
    const u = ramp(t, bb(17, 0.55), 1.2, 'io2');
    const draw = (P, col) => { if (u <= 0) return; const Q = prefix(P, u); strokeP(Q, col, 18); const e = Q[Q.length - 1]; circ(e[0], e[1], 19, '#ffffff'); circ(e[0], e[1], 13, col); };
    draw(LA, PAL.coral); draw(LB, PAL.blue2);
    const tag = (str, x, y, col, t0) => { const k = popS(t, t0, 0.3); if (k <= 0) return; c.save(); c.translate(x, y); c.scale(k, k); const w = labelW(str, 42, 'RB') + 48; rrFill(-w / 2, -33, w, 66, 33, col); label(str, 0, 2, 42, '#ffffff', { font: 'RB' }); c.restore(); };
    tag('后悔“做了”的', 430, 640, PAL.coral, bb(17, 0.45));
    tag('后悔“没做”的', 560, 1108, PAL.blue2, bb(17, 0.6));
    const tEnd = bb(17, 0.55) + 1.2; // the inaction line keeps rising
    if (t > tEnd) { const k = ((t - tEnd) / 0.6) % 1; alpha(1 - k, () => ring(892, 650, 22 + 50 * k, 7, PAL.blue2)); }
    c.restore();
  }
  label('参考：Gilovich & Medvec, 1995', 540, 1380, 36, 'rgba(255,255,255,0.8)', { font: 'SS' });
  const ms = popS(t, bb(17, 2.5), 0.32);
  if (ms > 0) heartMascot(932, 1282, 64 * ms, t, { eyes: 'star', glow: 0.5, r: -0.12 });
}

// ------------------------------------------------------------------ B18–B19 the door of "想做的事": he ages beside it, rewinds, opens it, trips, laughs
const DX = 800, DW = 290, DH = 600, PX = 562, PH = 480;
function clock(x, y, r, spin) {
  alpha(0.2, () => circ(x + 8, y + 12, r + 14, PAL.navy));
  circ(x, y, r + 14, PAL.navy); circ(x, y, r, '#ffffff');
  for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; line(x + Math.sin(a) * r * 0.76, y - Math.cos(a) * r * 0.76, x + Math.sin(a) * r * 0.88, y - Math.cos(a) * r * 0.88, PAL.grey2, i % 3 ? 4 : 8); }
  const am = spin * Math.PI * 2 + 0.2, ah = am / 12 + 1.9;
  line(x, y, x + Math.sin(ah) * r * 0.48, y - Math.cos(ah) * r * 0.48, PAL.navy, 12);
  line(x, y, x + Math.sin(am) * r * 0.72, y - Math.cos(am) * r * 0.72, PAL.coral, 8);
  circ(x, y, 11, PAL.navy);
}
function rewindIcon(x, y, s) {
  if (s <= 0.001) return;
  c.save(); c.translate(x, y); c.scale(s / 100, s / 100);
  for (const ox of [-46, 46]) { const P = [[ox - 46, 0], [ox + 46, -58], [ox + 46, 58]]; c.save(); c.lineJoin = 'round'; c.lineWidth = 26; c.strokeStyle = PAL.navy; c.beginPath(); c.moveTo(...P[0]); c.lineTo(...P[1]); c.lineTo(...P[2]); c.closePath(); c.stroke(); c.restore(); fillP(P, '#ffffff'); }
  c.restore();
}
const rotAbout = (px, py, cx, cy, a) => { const dx = px - cx, dy = py - cy; return [cx + dx * Math.cos(a) - dy * Math.sin(a), cy + dx * Math.sin(a) + dy * Math.cos(a)]; };
export function regret(t) {
  const g = K(t, [[bb(18, 0.95), 0], [bb(18, 1.35), 0.5, 'io2'], [bb(18, 2.4), 0.5], [bb(18, 2.8), 1, 'io2'], [bb(19, 0.05), 1], [bb(19, 0.85), 0, 'io2']]);
  const rew = t >= B[19] && t < bb(19, 0.9);
  const open = ramp(t, bb(19, 1.15), 0.35, 'out3');
  c.save(); if (rew) c.translate(9 * Math.sin(t * 97), 0);
  stage(mix(PAL.sky, '#8d92b4', g * 0.85), { ground: mix(PAL.cream, '#ddd6cb', g * 0.8) });
  clock(230, 600, 92, K(t, [[bb(18, 0.95), 0], [bb(18, 2.85), 9, 'io2'], [bb(19, 0.05), 9], [bb(19, 0.85), 0, 'io2']]));
  // the door (mirrored: hinge on the right, handle on his side)
  c.save(); c.translate(2 * DX, 0); c.scale(-1, 1); door(DX, GY, DW, DH, open, t, { col: PAL.purple }); c.restore();
  const pw = DW * (1 - 0.85 * E.io2(open)), pcx = DX + DW / 2 - pw / 2;
  alpha(1 - ramp(open, 0.35, 0.3, 'lin'), () => { c.save(); c.translate(pcx, GY - DH * 0.7); c.scale(pw / DW, 1); c.rotate(-0.05); alpha(0.2, () => rrFill(-104, -38, 220, 92, 12, PAL.navy)); rrFill(-110, -46, 220, 92, 12, PAL.yel); label('想做的事', 0, 0, 44, PAL.navy, { font: 'RH' }); c.restore(); });
  cobweb(DX - DW / 2 - 18, GY - DH - 18, 0.95, g * (1 - open));
  if (open > 0) {
    alpha(open * 0.55, () => { c.fillStyle = rad(DX, GY - DH / 2, 60, 620, [[0, 'rgba(255,246,200,0.95)'], [1, 'rgba(255,246,200,0)']]); c.fillRect(DX - 640, GY - DH - 320, 1280, 1160); });
    alpha(open * 0.5, () => fillP([[DX - DW / 2, GY], [DX + DW / 2, GY], [DX + DW / 2 + 160, GY + 340], [DX - DW / 2 - 230, GY + 340]], PAL.yelL));
    sparkleBurst(t, bb(19, 1.15), DX, GY - DH / 2, 230, { n: 12 });
  }
  // him
  const reach = K(t, [[bb(18, 0.15), 10], [bb(18, 0.45), 62, 'out3'], [bb(18, 0.75), 62], [bb(18, 1.0), 12, 'io2']]); // reaches… pulls back
  const reach2 = K(t, [[bb(19, 0.95), 12], [bb(19, 1.15), 64, 'out3'], [bb(19, 1.45), 64], [bb(19, 1.6), 24, 'io2']]);
  const rot = K(t, [[bb(19, 1.6), 0], [bb(19, 1.92), 1.5, 'in2'], [bb(19, 2.35), 1.5], [bb(19, 2.72), 0, 'out3']]);
  const up = t > bb(19, 2.55), down = rot > 0.3;
  const sad = t > bb(18, 0.95) && t < bb(19, 0.6);
  const old = g > 0.75;
  const badge = lightUp(t, bb(19, 0.9));
  const lean = g * 14;
  const armF = up ? [150 + 10 * Math.sin(t * 10), 15] : t < B[19] ? (old ? [26, -14] : [reach, 12]) : down ? [120, 10] : [reach2, 12];
  personSide({ ...LAOSHI, view: 'side', dir: 1, x: PX, y: GY, h: PH, hairCol: mix(PAL.hairK, PAL.hairW, g), lean, rot,
    armF, armB: up ? [-150, -15] : down ? [-110, 0] : [-12, 10], legF: [10 - 4 * g, 7 * g], legB: down ? [-30, 10] : [-10 + 4 * g, 7 * g],
    eyes: up ? 'happy' : down ? 'closed' : sad ? 'sad' : 'dot', mouth: up ? 'grin' : down ? 'open' : sad ? 'frown' : 'smile',
    badge, badgeGlow: 0.6 + 0.8 * badge + (up ? 0.4 * beatP(t) : 0), jump: up ? arc(t, bb(19, 2.72), bb(19, 3.3), 70) : 0 }, t);
  if (old && t < bb(19, 0.5)) { // cane in the front hand (hand position rotated by the lean about the hip)
    const s = PH / 100, sh = [PX, GY - 69.5 * s], a1 = 26 * D2R, a2 = 12 * D2R;
    const hx = sh[0] + Math.sin(a1) * 15.5 * s + Math.sin(a2) * 14.5 * s, hy = sh[1] + Math.cos(a1) * 15.5 * s + Math.cos(a2) * 14.5 * s;
    const [cx, cy] = rotAbout(hx, hy, PX, GY - 44 * s, lean * D2R);
    alpha(ramp(g, 0.75, 0.1, 'lin'), () => cane(cx, GY, GY - cy));
  }
  if (badge > 0) sparkleBurst(t, bb(19, 0.9), PX + 22, GY - 290, 80, { n: 8 });
  if (down || (t > bb(19, 1.9) && t < bb(19, 2.6))) { // tripped: dust + dizzy sparkles
    const hx = PX + 0.86 * PH * Math.sin(rot), hy = GY - 0.86 * PH * Math.cos(rot);
    for (let i = 0; i < 3; i++) { const a = t * 7 + (i * Math.PI * 2) / 3; sparkle(hx + Math.cos(a) * 70, hy - 70 + Math.sin(a) * 22, 16, PAL.yel, t * 3); }
  }
  dust(t, bb(19, 1.92), PX + 380, GY - 6, 11, { w: 120 });
  floatTag(t, bb(19, 2.85), PX + 30, GY - 560, '遗憾 -1', { size: 74, life: 1.3, rise: 80 });
  confetti(t, bb(19, 2.72), PX, GY - 420, 77, { n: 26, spd: 1100 });
  // age tag
  let str = null, ps = 1;
  if (t < B[19]) { const a = g < 0.25 ? 20 : g < 0.75 ? 50 : 80; str = a + '岁'; ps = popS(t, a === 20 ? bb(18, 0.1) : a === 50 ? bb(18, 1.15) : bb(18, 2.6), 0.3); }
  else if (t < bb(19, 1.25)) { str = Math.round(lerp(20, 80, g)) + '岁'; ps = 1 - ramp(t, bb(19, 1.05), 0.2); }
  if (str) pill(515, 690 + 6 * Math.sin(t * 5), str, ps, { size: 52, col: g > 0.6 ? '#ffffff' : PAL.yel, rot: -0.05 });
  c.restore();
  if (rew) { // VHS rewind
    alpha(0.16, () => { c.fillStyle = '#ffffff'; for (let i = 0; i < 6; i++) { const yy = ((i * 340 + (t - B[19]) * 2600) % 2040) - 60; c.fillRect(-20, yy, 1120, 18 + 12 * hs(i, 3)); } });
    rewindIcon(540, 470, 110 * popS(t, B[19] + 0.02, 0.25) * (1 - ramp(t, bb(19, 0.7), 0.2)));
  }
}

// ------------------------------------------------------------------ B20–B22 three things to try today (panels push in; header stays)
const TIPCOL = [PAL.sky, PAL.mint, PAL.lilac];
export function tips(t) {
  const k = t < B[21] ? 0 : t < B[22] ? 1 : 2, lt = t - B[20 + k], PUSH = 0.42;
  if (k > 0 && lt < PUSH) {
    const e = E.io3(lt / PUSH);
    c.save(); c.translate(-1080 * e, 0); tipPanel(k - 1, t); c.restore();
    c.save(); c.translate(1080 * (1 - e), 0); tipPanel(k, t); c.restore();
    rrFill(1080 * (1 - e) - 46, -60, 46, 2100, 0, PAL.navy);
  } else tipPanel(k, t);
  flower('今天就能试：', 540, 300, t, bb(20, 0.15), B[23] - 0.12, { size: 116 });
}
function tipPanel(k, t) {
  const t0 = B[20 + k];
  bg(TIPCOL[k]);
  blobs(30 + k, 'rgba(255,255,255,0.2)', 6);
  [tipNo, tipToday, tipTry][k](t, t0, (x) => t0 + x * BEAT);
}
function numDisc(n, x, y, t, t0) {
  const s = popS(t, t0, 0.32); if (s <= 0) return;
  c.save(); c.translate(x, y); c.rotate((1 - clamp((t - t0) / 0.32)) * -0.8 - 0.08); c.scale(s, s);
  circ(6, 10, 66, 'rgba(23,21,58,0.3)'); circ(0, 0, 66, PAL.navy); circ(0, 0, 56, PAL.coral);
  label(String(n), 0, 6, 80, '#ffffff', { font: 'RH' });
  c.restore();
}
// ① a chat: "今晚喝一杯？" "就差你了！" → "不了，谢谢～"
function tipNo(t, t0, j) {
  const s = popS(t, t0 + 0.05, 0.36), px = 540, py = 950;
  c.save(); c.translate(px, py + (1 - Math.min(1, s)) * 300); c.rotate(-0.035 + 0.01 * Math.sin((t - t0) * 3)); c.translate(-px, -py);
  phone(px, py, 600, 880, (x0, y0, w, h) => {
    rrFill(x0, y0, w, 160, 0, '#ffffff');
    label('群聊', x0 + w / 2, y0 + 112, 46, PAL.navy, { font: 'RB' });
    strokeP([[x0 + 66, y0 + 92], [x0 + 46, y0 + 112], [x0 + 66, y0 + 132]], PAL.navy, 7);
    const msg = (tt, yy, str, side, col) => { const k = popS(t, tt, 0.3); if (k <= 0) return; if (side < 0) circ(x0 + 66, yy + 49, 38 * Math.min(1, k), col); chatBubble(side < 0 ? x0 + 120 : x0 + w - 40, yy, str, side, k, { size: 46, col: side < 0 ? '#ffffff' : PAL.blue2 }); };
    msg(j(0.4), y0 + 210, '今晚喝一杯？', -1, PAL.orange);
    msg(j(0.8), y0 + 340, '就差你了！', -1, PAL.mint);
    if (t > j(1.1) && t < j(1.6)) { const bx = x0 + w - 190, by = y0 + 480; rrFill(bx, by, 150, 98, 34, PAL.blue2); for (let i = 0; i < 3; i++) circ(bx + 40 + i * 35, by + 49 - 9 * Math.max(0, Math.sin((t - j(1.1)) * 12 - i * 0.9)), 9, '#ffffff'); }
    msg(j(1.6), y0 + 480, '不了，谢谢～', 1);
    if (t > j(2.0)) alpha(ramp(t, j(2.0), 0.2), () => { strokeP([[x0 + w - 92, y0 + 618], [x0 + w - 78, y0 + 632], [x0 + w - 52, y0 + 604]], PAL.mint, 7); label('已发送', x0 + w - 110, y0 + 618, 32, PAL.grey, { font: 'RB', align: 'right' }); });
    rrFill(x0 + 28, y0 + h - 128, w - 56, 92, 46, '#ffffff');
    label('发消息…', x0 + 80, y0 + h - 80, 38, PAL.grey2, { font: 'RB', align: 'left' });
  });
  c.restore();
  numDisc(1, 250, 530, t, t0 + 0.15);
  const ms = popS(t, j(2.3), 0.32);
  if (ms > 0) { heartMascot(885, 1236 - 10 * Math.sin((t - t0) * 5), 78 * ms, t, { eyes: 'happy', glow: 0.6, r: 0.12 }); puff(t, j(2.45), 800, 1190, 34); }
}
// ② the calendar flips 明年 → 下个月 → 明天 → 今天; note "第一步" gets a tick
function tipToday(t, t0, j) {
  const s = popS(t, t0 + 0.05, 0.36);
  const cx = 540, cy = 860, cw = 580, ch = 600, top = cy - ch / 2, pageY = top + 150, pageH = ch - 150;
  c.save(); c.translate(cx, cy + (1 - Math.min(1, s)) * 300); c.rotate(0.03); c.translate(-cx, -cy);
  alpha(0.22, () => rrFill(cx - cw / 2 + 16, top + 22, cw, ch, 44, PAL.navy));
  rrFill(cx - cw / 2, top, cw, ch, 44, '#ffffff');
  c.save(); rr(cx - cw / 2, top, cw, ch, 44); c.clip(); c.fillStyle = PAL.coral; c.fillRect(cx - cw / 2, top, cw, 150); c.restore();
  for (const dx of [-150, 150]) { circ(cx + dx, top + 44, 15, shade(PAL.coral, -0.3)); rrFill(cx + dx - 12, top - 44, 24, 90, 12, PAL.navy); }
  const pages = ['明年', '下个月', '明天', '今天'], flips = [j(0.35), j(0.7), j(1.05)];
  let cur = 0; for (const f of flips) if (t >= f) cur++;
  const today = cur === 3;
  withT(cx, pageY + pageH / 2 + 8, 0, today ? popS(t, flips[2], 0.3) : 1, () => label(pages[cur], 0, 0, today ? 210 : 150, today ? PAL.coral : PAL.navy, { font: 'RH' }));
  for (let i = 0; i < 3; i++) {
    const u = (t - flips[i]) / 0.55; if (u <= 0 || u >= 1) continue;
    alpha(1 - u, () => { c.save(); c.translate(cx - cw / 2 + u * 260, pageY - u * 140 + u * u * 820); c.rotate(u * 0.55); rrFill(0, 0, cw, pageH, 30, '#ffffff'); label(pages[i], cw / 2, pageH / 2 + 8, 150, PAL.navy, { font: 'RH' }); c.restore(); });
  }
  c.restore();
  if (today) { sparkleBurst(t, flips[2], cx, pageY + pageH / 2, 230, { n: 12 }); popLines(t, flips[2], cx, pageY + pageH / 2, 270, { n: 10 }); }
  numDisc(2, 268, 582, t, t0 + 0.15);
  const ns = ramp(t, j(1.6), 0.4, 'out3');
  if (ns > 0) {
    const nx = 540, ny = 1300 + (1 - ns) * 300;
    c.save(); c.translate(nx, ny); c.rotate(-0.04);
    alpha(0.2, () => rrFill(-240, -52, 500, 132, 18, PAL.navy));
    rrFill(-250, -66, 500, 132, 18, PAL.yel);
    rr(-196, -34, 68, 68, 14); c.fillStyle = '#ffffff'; c.fill(); c.lineWidth = 6; c.strokeStyle = PAL.navy; c.stroke();
    label('第一步', 46, 4, 66, PAL.navy, { font: 'RH' });
    const cu = ramp(t, j(2.3), 0.25, 'out2');
    if (cu > 0) strokeP(prefix([[-184, -4], [-162, 22], [-112, -42]], cu), PAL.coral, 15);
    c.restore();
    sparkleBurst(t, j(2.5), nx - 162, ny, 90, { n: 8 });
  }
}
// ③ the card: "我不配" gets crossed out, flips to "我试试"
function tipTry(t, t0, j) {
  const s = popS(t, t0 + 0.05, 0.36), cx = 540, cy = 880, cw = 800, ch = 470;
  const tf = j(1.8), fu = ramp(t, tf - 0.17, 0.34, 'io2'), back = fu >= 0.5, sx = Math.max(0.02, Math.abs(Math.cos(fu * Math.PI)));
  c.save(); c.translate(cx, cy + (1 - Math.min(1, s)) * 300); c.rotate(back ? 0.03 : -0.03); c.scale(sx, 1);
  alpha(0.22, () => rrFill(-cw / 2 + 16, -ch / 2 + 22, cw, ch, 48, PAL.navy));
  rrFill(-cw / 2, -ch / 2, cw, ch, 48, back ? PAL.coral : '#ffffff');
  if (!back) {
    label('我不配', 0, 10, 190, PAL.grey, { font: 'RH' });
    const su = ramp(t, j(0.95), 0.35, 'out2');
    if (su > 0) { const P = []; for (let i = 0; i <= 24; i++) { const u = i / 24; P.push([lerp(-310, 310, u), 18 + 10 * Math.sin(u * 9) - 24 * u]); } strokeP(prefix(P, su), PAL.coral, 30); }
  } else flower('我试试', 0, 8, t, tf + 0.1, B[23] + 1, { size: 200 });
  c.restore();
  if (back) { sparkleBurst(t, tf + 0.1, cx, cy, 400, { n: 14 }); confetti(t, tf + 0.1, cx, cy - 120, 61, { n: 40, spd: 1300 }); }
  numDisc(3, 160, 660, t, t0 + 0.15);
  const ms = popS(t, j(2.4), 0.32);
  if (ms > 0) heartMascot(872, 1172 - 8 * Math.sin((t - t0) * 6), 80 * ms, t, { eyes: 'star', glow: 0.7, mouth: 'open', r: -0.1 });
}

// ------------------------------------------------------------------ B23 who's the most "黄毛" person around you? (spotlight picks one; comment box types @TA)
export function cta(t) {
  const j = (x) => B[23] + x * BEAT;
  bg(PAL.pink);
  blobs(41, 'rgba(255,255,255,0.18)', 6);
  rrFill(-200, GY, 1480, 800, 0, PAL.cream); rrFill(-200, GY, 1480, 18, 0, '#ead9bb');
  const cast = [[GIRL, 170, 400], [CHEF, 400, 430], [UNCLE, 660, 430], [RIDER, 905, 420]];
  const hops = [j(0.35), j(0.75), j(1.15), j(1.55), j(1.95)], seq = [0, 1, 2, 3, 1];
  let hi = -1; for (let i = 0; i < hops.length; i++) if (t >= hops[i]) hi = i;
  let sx = -400;
  if (hi >= 0) { const a = hi > 0 ? cast[seq[hi - 1]][1] : -300, b = cast[seq[hi]][1]; sx = lerp(a, b, E.out3(clamp((t - hops[hi]) / 0.14))); }
  const sel = t >= hops[4] ? 1 : -1;
  if (hi >= 0) alpha(0.9, () => { c.fillStyle = lin(0, 0, 0, GY, [[0, 'rgba(255,255,255,0)'], [1, 'rgba(255,255,255,0.55)']]); c.beginPath(); c.moveTo(sx - 50, -50); c.lineTo(sx + 50, -50); c.lineTo(sx + 190, GY + 40); c.lineTo(sx - 190, GY + 40); c.closePath(); c.fill(); ell(sx, GY + 30, 190, 40, 'rgba(255,255,255,0.6)'); });
  cast.forEach(([P, x, h], i) => {
    const ch = i === sel, lit = Math.abs(sx - x) < 60;
    person({ ...P, x, y: GY, h, eyes: ch ? 'happy' : lit ? 'wide' : 'dot', mouth: ch ? 'grin' : 'smile', armL: ch ? [150, -10] : [12, 6], armR: ch ? [150, 10] : [12, 6], badge: 1, badgeGlow: ch ? 1.5 + 0.4 * beatP(t) : 0.45, jump: ch ? arc(t, hops[4], hops[4] + 0.5, 70) : 0, sy: breathe(t, i) }, t);
  });
  if (sel >= 0) sparkleBurst(t, hops[4], cast[1][1], GY - 330, 150, { n: 10 });
  // comment box
  const bs = ramp(t, j(0.3), 0.45, 'out3'), by = 1335 + (1 - bs) * 380;
  alpha(0.2, () => rrFill(92, by + 14, 900, 150, 75, PAL.navy));
  rrFill(80, by, 920, 150, 75, '#ffffff');
  heartMascot(158, by + 80, 40, t, { eyes: 'happy' });
  if (t < j(2.25)) label('说点什么…', 230, by + 76, 46, PAL.grey2, { font: 'RB', align: 'left' });
  else {
    const str = '@TA'.slice(0, Math.min(3, Math.floor((t - j(2.25)) / 0.1) + 1));
    label(str, 230, by + 78, 62, PAL.blue2, { font: 'RH', align: 'left' });
    if (Math.floor((t - j(2.25)) / 0.25) % 2 === 0) rrFill(240 + labelW(str, 62, 'RH'), by + 40, 6, 74, 3, PAL.navy);
  }
  const press = pulse(t, j(3.0), 10);
  withT(915, by + 75, 0, 1 - 0.18 * press + 0.06 * beatP(t), () => { circ(0, 0, 56, PAL.coral); heart(0, 4, 30, '#ffffff'); });
  for (let i = 0; i < 6; i++) { const t0 = j(3.0) + i * 0.08, u = clamp((t - t0) / 0.9); if (u > 0 && u < 1) alpha(1 - u, () => heart(915 + Math.sin(u * 7 + i) * 40 + (i - 2.5) * 18, by + 30 - u * 400, 24 * popS(t, t0, 0.2), [PAL.coral, PAL.yel, '#ffffff'][i % 3])); }
}

// ------------------------------------------------------------------ B24–end: title card, everyone's heart lit
export function end(t) {
  const lt = t - B[24];
  bg(PAL.blue);
  rays(540, 640, t, 'rgba(255,255,255,0.07)', 20, 0.12);
  stage(null);
  flower('黄毛理论', 540, 330, t, bb(24, 0.3), DUR + 5, { size: 210 });
  const ms = spring(t, bb(24, 0.9), 2.0, 5.5);
  if (ms > 0) heartMascot(540, 690 + 10 * Math.sin(lt * 3) - 18 * beatP(t), 128 * ms, t, { glow: 1, eyes: 'happy', mouth: 'open', bounce: beatP(t) });
  const cast = [KID, OFFICE, CHEF, LAOSHI, GRANNY, RIDER, HUANGMAO];
  cast.forEach((P, i) => {
    const x = 96 + i * 148, h = P === KID ? 300 : 380, t0 = bb(24, 1.2 + i * 0.12);
    const ph = (t - t0) / BEAT, k = ph - Math.floor(ph), hop = t > B[25] ? Math.sin(k * Math.PI) * 30 * (i % 2 ? 1 : 0.6) : 0;
    const wave = 150 + 18 * Math.sin(t * 9 + i * 1.3);
    person({ ...P, x, y: GY + 10, h, eyes: 'happy', mouth: 'grin', armL: i % 2 ? [wave, -10] : [12, 6], armR: i % 2 ? [12, 6] : [wave, 10], badge: popS(t, t0, 0.3), badgeGlow: 0.9, jump: arc(t, t0, t0 + 0.35, 40) + hop, sy: breathe(t, i) }, t);
  });
  confetti(t, B[25], 540, 520, 51, { n: 70, spd: 1700 });
  cap('黄毛不在头上，在心里', 540, 1470, t, bb(25, 0.1), DUR + 5, { size: 92, hl: [['在心里', Y]] });
}
