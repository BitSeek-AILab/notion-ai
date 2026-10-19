// 黄毛理论 v2 · scenes B0–B8 (hook → title → three traits → dictionary → childhood → painted black → DROP)
import { c, PAL, bg, rrFill, rr, circ, ell, fillP, strokeP, line, arcLine, heart, burst, sparkle, dots, withT, alpha, shade, ring, path, sunburst, lin } from './draw.js';
import { B, bb, BEAT } from './beat.js';
import { clamp, lerp, hs, E, popS, ramp, pulse, K, spring, mix, prefix, spline, circlePts } from './lib.js';
import { flower, cap, label, hz, FONTS, labelW } from './type.js';
import { person, personSide, heartMascot, LAOSHI, HUANGMAO, KID } from './char.js';
import { stage, blobs, rays, beatP, breathe, arc, runPose, lying, header, GY } from './kit.js';
import { confetti, sparkleBurst, popLines, dust, splash, say, think, zzz, floatTag, shards, badgeFx } from './fx.js';
import { bouquet, sprayCan, puff, battery, roller, moon, starsBg, bed, blanket, scroll } from './props.js';

const sideSplit = (y) => 610 - 140 * (y + 50) / 2050;
function clipRight() { c.beginPath(); c.moveTo(610, -60); c.lineTo(1300, -60); c.lineTo(1300, 2100); c.lineTo(sideSplit(2100), 2100); c.closePath(); c.clip(); }
function likeHeart(x, y, s, t) { heart(x, y, s, PAL.pink, { hi: 'rgba(255,255,255,0.75)' }); }

// ------------------------------------------------------------------ B0 hook: 老实人 vs 黄毛, the heart picks 黄毛
export function hook(t) {
  bg(PAL.cream);
  dots(-20, 0, 640, GY, 46, 3.2, '#ecd9b6', 1);
  rrFill(-200, GY, 1480, 800, 0, '#f1dfbf');
  c.save(); clipRight(); bg(PAL.blue); rays(830, 640, t, 'rgba(255,255,255,0.08)', 16, 0.25); rrFill(-200, GY, 1480, 800, 0, '#2d29c4'); c.restore();
  // split edge
  c.save(); c.strokeStyle = PAL.navy; c.lineWidth = 10; c.beginPath(); c.moveTo(610, -60); c.lineTo(sideSplit(2100), 2100); c.stroke(); c.restore();
  const land = bb(0, 2.25), lose = ramp(t, land, 0.35), win = ramp(t, land, 0.25);
  const J1 = person({ ...LAOSHI, x: 280, y: GY, h: 560, hunch: lerp(0.35, 1, lose), turn: 0.55, look: [0.6, lerp(-0.6, 0.4, lose)], eyes: lose > 0.5 ? 'sad' : 'dot', mouth: lose > 0.5 ? 'frown' : 'smile', brows: lose > 0.5 ? 'worried' : 'up', sweat: lose, armR: [lerp(62, 28, lose), lerp(78, 40, lose)], armL: [12, 6], sy: breathe(t), headTilt: lerp(-4, 6, lose) }, t);
  bouquet(J1.handR[0] + 8, J1.handR[1] + 4, 1.3, t, { droop: lose, r: lerp(-0.25, 0.1, lose) });
  const J2 = person({ ...HUANGMAO, x: 805, y: GY, h: 600, turn: -0.45, look: [-0.5, -0.4], eyes: win > 0.5 ? 'happy' : 'dot', mouth: win > 0.5 ? 'grin' : 'smirk', brows: 'up', armL: [12, 6], armR: [lerp(12, 155, E.outBack(win)), lerp(6, -25, win)], sy: breathe(t, 1.3), hairBounce: pulse(t, land, 5) * 1.5 }, t);
  // VS badge
  const vs = popS(t, -0.12, 0.32) * (1 + 0.06 * beatP(t));
  if (vs > 0) withT(545, 1010, -0.12 + 0.04 * Math.sin(t * 3), vs, () => { burst(0, 0, 118, 104, PAL.coral, { k: 12, seed: 3, jag: 0.24, edge: 10, edgeCol: PAL.navy }); label('VS', 0, 6, 92, '#ffffff', { font: 'SS', stroke: 5, strokeCol: PAL.navy }); });
  // the heart: hesitates near 老实人, then swerves to 黄毛
  const hx = K(t, [[0, 540], [bb(0, 0.9), 420, 'io2'], [bb(0, 1.45), 455, 'io2'], [land, 740, 'io3']]);
  const hy = K(t, [[0, 600], [bb(0, 0.9), 585], [bb(0, 1.45), 610], [bb(0, 1.85), 470, 'out2'], [land, 545, 'in2']]) + (t < land ? 8 * Math.sin(t * 7) : 0);
  const hs_ = 78 * (1 + 0.25 * pulse(t, land, 7)) * (t < land ? 1 + 0.04 * Math.sin(t * 9) : 1);
  if (t > bb(0, 0.95) && t < bb(0, 1.5)) { const q = popS(t, bb(0, 0.95), 0.25) * (1 - ramp(t, bb(0, 1.4), 0.1)); alpha(q, () => label('？', 330, 600, 96, PAL.navy, { font: 'RH', stroke: 8, strokeCol: '#fff' })); }
  likeHeart(hx, hy, hs_, t);
  sparkleBurst(t, land, hx, hy, 80, { n: 8, s: 20 });
  floatTag(t, land + 0.05, 930, 600, '+1', { size: 96 });
}

// ------------------------------------------------------------------ B1 title + gag: dyeing the hair doesn't help
const slam = (t, t0) => (i, n) => { const ti = t0 + i * 0.055; const u = clamp((t - ti) / 0.2); const s = t < ti ? 0 : lerp(2.3, 1, E.out3(u)) * (1 + 0.07 * pulse(t, ti + 0.2, 9)) * (1 + 0.01 * Math.sin((t - ti) * 8 + i)); return { s, r: (1 - u) * 0.25 * (i % 2 ? 1 : -1), dy: 0, a: Math.min(1, u * 4) }; };
export function title(t) {
  stage(PAL.blue, { deco: () => rays(540, 340, t, 'rgba(255,255,255,0.07)', 18, 0.12) });
  const t0 = bb(1, 0);
  const s0 = popS(t, t0 + 0.12, 0.3);
  if (s0 > 0) withT(540, 345, -0.035, s0, () => { burst(0, 0, 490, 200, '#ffffff', { k: 18, seed: 4, jag: 0.2 }); });
  flower('黄毛理论', 540, 345, t, t0, 99, { size: 196, anim: slam(t, t0) });
  // the gag
  const canIn = bb(1, 0.85), dyeT = bb(1, 1.5), ta = bb(1, 1.75), fly0 = bb(1, 2.05), fly1 = bb(1, 2.95);
  const dyed = t >= dyeT, look = ramp(t, fly0 + 0.1, 0.6), sad = ramp(t, fly1 - 0.25, 0.3);
  const tada = ramp(t, ta, 0.25, 'pop') * (1 - ramp(t, fly0 + 0.2, 0.3));
  const raise = ramp(t, canIn, 0.25) * (1 - ramp(t, dyeT + 0.12, 0.2));
  const J = person({ ...LAOSHI, x: 540, y: GY, h: 600, hunch: lerp(1, 0.7, tada), hair: dyed ? 'spiky' : 'neat', hairCol: dyed ? PAL.yel : PAL.hairK, hairBounce: pulse(t, dyeT, 6),
    turn: lerp(lerp(0, -0.2, tada), 0.9, look), look: [lerp(0, 1, look), -0.3],
    eyes: sad > 0.5 ? 'sad' : tada > 0.3 ? 'happy' : look > 0.3 ? 'wide' : 'dot', mouth: sad > 0.5 ? 'frown' : tada > 0.3 ? 'grin' : look > 0.3 ? 'o' : 'flat', brows: sad > 0.3 ? 'worried' : 'up', sweat: sad,
    armR: [lerp(lerp(12, 150, raise), 95, tada), lerp(lerp(6, 40, raise), -30, tada)], armL: [lerp(12, 95, tada), lerp(6, -30, tada)], sy: breathe(t) }, t);
  if (t >= canIn && t < dyeT + 0.35) { const a = ramp(t, canIn, 0.15) * (1 - ramp(t, dyeT + 0.15, 0.2)); alpha(a, () => sprayCan(J.handR[0], J.handR[1] - 20, 1.2, -2.5)); }
  if (t > canIn + 0.15 && t < dyeT) for (let i = 0; i < 10; i++) { const u = ((t * 3 + i / 10) % 1); circ(lerp(J.handR[0] - 30, J.head[0] + 10, u), lerp(J.handR[1] - 70, J.head[1] - 40, u) + Math.sin(i * 3) * 18 * u, 8 * (1 - u) + 3, PAL.yel); }
  puff(t, dyeT - 0.08, J.head[0], J.head[1] - 40, 120, '#ffffff');
  if (tada > 0.2) for (let i = 0; i < 3; i++) sparkle(J.head[0] + [-120, 130, 100][i], J.head[1] + [-90, -130, 40][i], 22 * tada * (0.8 + 0.2 * Math.sin(t * 9 + i)), PAL.yel, t);
  // heart flies past him
  if (t > fly0 && t < fly1 + 0.1) { const u = E.io2(clamp((t - fly0) / (fly1 - fly0))); likeHeart(lerp(-120, 1240, u), 650 - Math.sin(u * Math.PI) * 140, 62, t); for (let i = 1; i < 4; i++) { const v = Math.max(0, u - i * 0.035); alpha(0.25 / i, () => likeHeart(lerp(-120, 1240, v), 650 - Math.sin(v * Math.PI) * 140, 62 * (1 - i * 0.12), t)); } }
}

// ------------------------------------------------------------------ B2 ① 不迎合
export function trait1(t) {
  stage(PAL.mint, { deco: () => blobs(12, '#5cf0bd', 6) });
  header('1', '不迎合', 300, t, bb(2, 0.05), B[3] - 0.08);
  const nod = Math.abs(Math.sin((t - B[2]) * Math.PI / BEAT * 2)) * 4;
  const J1 = person({ ...LAOSHI, x: 300, y: GY, h: 560, hunch: 0.9, eyes: 'happy', mouth: 'smile', brows: 'worried', sweat: 0.8, headDy: nod, headTilt: -3 + nod, armsFront: 'LR', armL: [16, -100], armR: [16, -100], sy: breathe(t), turn: 0.3 }, t);
  const hx = J1.head[0], hy = J1.head[1];
  say(t, bb(2, 0.45), 99, 230, 640, '好好好', hx - 10, hy - 70, { size: 58, rot: -0.2 });
  say(t, bb(2, 1.0), 99, 400, 545, '是是是', hx + 20, hy - 80, { size: 58, rot: 0.2 });
  say(t, bb(2, 1.55), 99, 240, 450, '您说得对', hx, hy - 90, { size: 56, rot: -0.15 });
  const up = ramp(t, bb(2, 2.05), 0.3, 'pop');
  const J2 = person({ ...HUANGMAO, x: 790, y: GY, h: 600, eyes: 'dot', mouth: up > 0.5 ? 'smile' : 'smirk', brows: up > 0.5 ? 'cool' : 'none', turn: -0.35, armL: [12, 6], armR: [lerp(12, 72, up), lerp(6, 92, up)], sy: breathe(t, 1.1) * (1 + 0.03 * pulse(t, bb(2, 2.05), 7)), hairBounce: pulse(t, bb(2, 2.05), 6) }, t);
  say(t, bb(2, 2.15), 99, 800, 560, '我不这么看', J2.head[0] - 10, J2.head[1] - 90, { size: 58, col: PAL.yel, rot: 0.18 });
  popLines(t, bb(2, 2.15), J2.head[0] + 10, J2.head[1] - 20, 120, { n: 5 });
}

// ------------------------------------------------------------------ B3 ② 不内耗 (night, two beds)
export function trait2(t) {
  bg(PAL.navy); starsBg(t, 7, 22, 0, 0, 1080, 1900);
  moon(930, 470, 50, PAL.navy);
  header('2', '不内耗', 300, t, bb(3, 0.05), B[4] - 0.08, { numCol: PAL.purple });
  const panel = (y0, col) => { rrFill(70, y0, 940, 520, 44, col); };
  panel(420, '#2a2766'); panel(990, '#2a2766');
  // top: 老实人 awake, battery draining
  const drain = ramp(t, bb(3, 0.3), bb(3, 2.7) - bb(3, 0.3), 'io2'), lvl = lerp(1, 0.03, drain);
  bed(170, 870, 640, '#5b57ff');
  lying({ ...LAOSHI, h: 470, eyes: 'wide', look: [0, -1], brows: 'worried', mouth: 'wavy', sweat: 0.4 + 0.6 * drain, armL: [10, 4], armR: [10, 4] }, 760, 812, t);
  blanket(330, 870, 470, '#a9c1ff', { lump: 6 });
  // anxiety scribble
  alpha(ramp(t, bb(3, 0.4), 0.3), () => { c.save(); c.translate(250, 640); const P = []; for (let i = 0; i < 60; i++) { const a = i * 0.55 + t * 3; P.push([Math.cos(a) * (30 + 12 * Math.sin(i * 0.7)) + i * 0.6, Math.sin(a) * (22 + 8 * Math.cos(i * 0.9))]); } strokeP(P, '#ffffff', 5); c.restore(); });
  think(t, bb(3, 0.55), 99, 520, 560, '他生气了？', 330, 700, { size: 52, seed: 2 });
  think(t, bb(3, 1.3), 99, 700, 470 + 0, '我说错了？', 560, 560, { size: 52, seed: 5 });
  const blink = lvl < 0.1 ? (Math.sin(t * 22) > 0 ? 1 : 0.35) : 1;
  alpha(blink, () => battery(880, 700, 0.95, lvl));
  // bottom: 黄毛 sleeping, full battery
  bed(170, 1440, 640, '#ff8a7a');
  lying({ ...HUANGMAO, h: 470, eyes: 'closed', mouth: 'smile', armL: [10, 4], armR: [10, 4] }, 760, 1382, t);
  blanket(330, 1440, 470, '#ffc4d8', { lump: 4 + 3 * Math.sin(t * 2.5) });
  zzz(t, 300, 1230, { size: 70, col: PAL.yel });
  battery(880, 1270, 0.95, 1, { bolt: true });
}

// ------------------------------------------------------------------ B4 ③ 说干就干 (gap jump)
export function trait3(t) {
  bg(PAL.purple); blobs(21, '#8f72ff', 5);
  // cliffs
  const gy = GY;
  rrFill(-60, gy, 500, 900, 30, PAL.cream); rrFill(-60, gy, 500, 18, 9, '#ead9bb');
  rrFill(650, gy, 500, 900, 30, PAL.cream); rrFill(650, gy, 500, 18, 9, '#ead9bb');
  c.fillStyle = lin(0, gy, 0, 1920, [[0, '#4b33c9'], [1, '#17153a']]); c.fillRect(440, gy + 30, 210, 900);
  header('3', '说干就干', 300, t, bb(4, 0.05), B[5] - 0.08, { numCol: PAL.mint });
  // 老实人 at the edge with a growing scroll
  const len = lerp(140, 760, ramp(t, bb(4, 0.3), bb(4, 3.6) - bb(4, 0.3), 'io2'));
  const fly0 = bb(4, 1.45), fly1 = bb(4, 2.25);
  const watch = ramp(t, fly0, 0.4);
  const J1 = person({ ...LAOSHI, x: 270, y: gy, h: 560, hunch: 0.8, turn: lerp(0.4, 0.9, watch), look: [1, lerp(0, -1, watch)], eyes: watch > 0.4 ? 'wide' : 'dot', mouth: watch > 0.4 ? 'o' : 'flat', brows: 'worried', armsFront: 'LR', armL: [20, -95], armR: [20, -95], sy: breathe(t) }, t);
  scroll(J1.handR[0] + 70, J1.handR[1] - 10, 300, len, ['等我准备好……', 0.9, 0.7, 0.8, 0.6, 0.85, 0.7, 0.5, 0.8, 0.6, 0.7, 0.9, 0.6], t);
  // 黄毛 runs in, leaps, lands
  const xr = K(t, [[bb(4, 0.35), -160], [fly0, 380, 'lin'], [fly1, 790, 'lin'], [fly1 + 0.35, 840, 'out3']]);
  const air = arc(t, fly0, fly1, 300);
  const landed = t >= fly1, pose = ramp(t, fly1 + 0.15, 0.3, 'pop');
  const rp = runPose(t, 2.8, landed ? 1 - ramp(t, fly1, 0.2) : 1);
  const o = { ...HUANGMAO, view: 'side', x: xr, y: gy - air - (landed ? 0 : rp.bob), h: 560, dir: 1, lean: landed ? lerp(rp.lean, 0, pose) : rp.lean, legF: rp.legF, legB: rp.legB, armF: rp.armF, armB: rp.armB, eyes: landed ? 'happy' : 'dot', mouth: 'grin' };
  if (t > fly0 && t < fly1) { const u = (t - fly0) / (fly1 - fly0); Object.assign(o, { legF: [60, 80], legB: [-30, 40], armF: [150, 10], armB: [-120, 10], lean: 18 - 20 * u }); }
  if (landed) { o.armF = [lerp(o.armF[0], 165, pose), lerp(o.armF[1], 10, pose)]; o.legF = [lerp(10, 12, pose), 4]; o.legB = [-10, 4]; const sq = 1 - 0.12 * pulse(t, fly1, 10); o.sy = sq; o.sx = 2 - sq; }
  if (t > bb(4, 0.3)) person(o, t);
  dust(t, fly0 - 0.05, 400, gy, 3, { w: 60 }); dust(t, fly1, 800, gy, 4, { w: 90, n: 8 });
  if (landed) sparkleBurst(t, fly1 + 0.12, 860, gy - 520, 110, { n: 8 });
}

// ------------------------------------------------------------------ B5 dictionary card
export function dict(t) {
  bg(PAL.cream); dots(0, 0, 1080, 1920, 46, 3.2, '#ecd9b6', 1);
  const t0 = bb(5, 0);
  const s = popS(t, t0 + 0.05, 0.35);
  const x0 = 130, y0 = 600, w = 820, h = 720;
  withT(540, y0 + h / 2, (1 - clamp((t - t0) / 0.35)) * 0.08, Math.max(0.001, s), () => {
    c.translate(-540, -(y0 + h / 2));
    c.save(); c.globalAlpha *= 0.16; rrFill(x0 + 18, y0 + 24, w, h, 44, PAL.navy); c.restore();
    rrFill(x0, y0, w, h, 44, '#ffffff');
    c.save(); rr(x0, y0, w, h, 44); c.clip(); rrFill(x0, y0, w, 100, 0, PAL.blue); c.restore();
    label('词  典', x0 + 70, y0 + 52, 46, '#ffffff', { font: 'RB', align: 'left' });
    fillP([[x0 + w - 130, y0 - 10], [x0 + w - 70, y0 - 10], [x0 + w - 70, y0 + 150], [x0 + w - 100, y0 + 125], [x0 + w - 130, y0 + 150]], PAL.coral);
    const a1 = ramp(t, t0 + 0.3, 0.2), a2 = ramp(t, t0 + 0.55, 0.2), a3 = ramp(t, bb(5, 1.0), 0.2), a4 = ramp(t, bb(5, 1.9), 0.2);
    alpha(a1, () => { label('黄毛', x0 + 70, y0 + 230, 150, PAL.navy, { font: 'RH', align: 'left' }); label('〔名〕', x0 + 400, y0 + 250, 48, PAL.grey, { font: 'RB', align: 'left' }); });
    alpha(a2, () => label('huáng máo', x0 + 74, y0 + 350, 46, PAL.grey, { font: 'RB', align: 'left' }));
    // definition with marker sweep
    const hl = ramp(t, bb(5, 1.35), 0.4, 'io2');
    alpha(a3, () => {
      const pre = '黄发，', key = '借指年幼的人', size = 64;
      const wp = labelW(pre, size, 'RB'), wk = labelW(key, size, 'RB');
      const lx = x0 + 70, ly = y0 + 470;
      if (hl > 0) rrFill(lx + wp - 8, ly - 30, (wk + 16) * hl, 60, 14, PAL.yel);
      label(pre, lx, ly, size, PAL.grey, { font: 'RB', align: 'left' });
      label(key, lx + wp, ly, size, PAL.navy, { font: 'RB', align: 'left' });
    });
    alpha(a4, () => label('例：黄毛丫头 · 黄毛小子', x0 + 70, y0 + 590, 50, PAL.grey, { font: 'RB', align: 'left' }));
  });
  // two little kids peek over the top of the card
  const k1 = ramp(t, bb(5, 2.2), 0.35, 'pop'), k2 = ramp(t, bb(5, 2.45), 0.35, 'pop');
  if (s >= 1) {
    c.save(); c.beginPath(); c.rect(0, 0, 1080, y0 + 2); c.clip();
    if (k1 > 0) person({ ...KID, x: 330, y: y0 + 330 - 200 * k1, h: 330, hair: 'bun', hairCol: '#ffd75e', top: PAL.pink, topStyle: 'tee', eyes: 'happy', mouth: 'open', armR: [150, 10], shadow: false }, t);
    if (k2 > 0) person({ ...KID, x: 700, y: y0 + 320 - 190 * k2, h: 310, eyes: 'dot', mouth: 'grin', armL: [150, -10], shadow: false }, t);
    c.restore();
  }
}

// ------------------------------------------------------------------ B6–B7 childhood → painted black → boxed in
const DOODLES = [
  { t: 0.0, col: PAL.coral, P: () => spline(circlePts(210, 700, 60, 12), true, 3), w: 10 },
  { t: 0.12, col: PAL.coral, P: () => [[130, 600], [100, 570], [290, 600], [320, 570], [210, 590], [210, 545]], w: 9 },
  { t: 0.2, col: PAL.blue, P: () => [[800, 1060], [800, 920], [880, 850], [960, 920], [960, 1060], [800, 1060]], w: 10 },
  { t: 0.3, col: PAL.mint, P: () => { const o = []; for (let i = 0; i <= 20; i++) { const a = Math.PI + (i / 20) * Math.PI; o.push([880 + Math.cos(a) * 140, 760 + Math.sin(a) * 110]); } return o; }, w: 14 },
  { t: 0.38, col: PAL.purple, P: () => [[150, 1000], [190, 900], [230, 1000], [130, 935], [250, 935], [150, 1000]], w: 9 },
];
export function kid(t) {
  const p1 = bb(7, 0.85), p2 = bb(7, 1.6), p3 = bb(7, 2.35); // roller crosses the kid at these times
  const pass = (t >= p1) + (t >= p2) + (t >= p3);
  const grey = ramp(t, bb(7, 0.6), bb(7, 2.6) - bb(7, 0.6), 'lin');
  const sky = mix('#9fd8ff', '#9a9bb5', grey), wall = mix('#fff1d6', '#c9cadb', grey);
  bg(sky);
  // wall
  rrFill(40, 520, 1000, 740, 30, wall);
  c.save(); rr(40, 520, 1000, 740, 30); c.clip();
  // crayon doodles
  const d0 = bb(6, 2.95);
  for (const d of DOODLES) { const u = ramp(t, d0 + d.t, 0.35, 'io2'); if (u > 0) strokeP(prefix(d.P(), u), mix(d.col, '#9a9bb5', grey), d.w); }
  // roller trails (dark bands over the wall)
  const lanes = [[bb(7, 0.4), bb(7, 1.15), 640], [bb(7, 1.15), bb(7, 1.9), 860], [bb(7, 1.9), bb(7, 2.65), 1080]];
  for (const [a, b, y] of lanes) { const u = clamp((t - a) / (b - a)); if (u > 0) rrFill(-40, y - 80, lerp(-200, 1500, u) + 40, 160, 0, '#2a2840'); }
  c.restore();
  // sun (coral) top-right on sky
  alpha(1 - grey, () => { circ(930, 470, 58, PAL.coral); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4 + t * 0.6; line(930 + Math.cos(a) * 78, 470 + Math.sin(a) * 78, 930 + Math.cos(a) * 100, 470 + Math.sin(a) * 100, PAL.coral, 9); } });
  // ground + puddle
  rrFill(-200, GY, 1480, 800, 0, mix(PAL.cream, '#d9d9e6', grey)); rrFill(-200, GY, 1480, 18, 0, mix('#ead9bb', '#c0c0d2', grey));
  alpha(1 - grey, () => ell(540, GY + 40, 230, 38, PAL.sky));
  // the kid
  const jump0 = bb(6, 0.15), land = bb(6, 0.85);
  const crouch = (t > jump0 - 0.18 && t < jump0) ? 1 : 0;
  const air = arc(t, jump0, land, 200);
  const sq = 1 - 0.14 * pulse(t, land, 9) - 0.08 * crouch;
  const no = ramp(t, bb(6, 1.35), 0.2) * (1 - ramp(t, bb(6, 2.2), 0.15)), why = ramp(t, bb(6, 2.2), 0.2) * (1 - ramp(t, bb(6, 2.95), 0.15)), draw_ = ramp(t, bb(6, 2.95), 0.2) * (1 - ramp(t, bb(7, 0.3), 0.2));
  const hairCol = mix('#ffd75e', '#1d1b3a', pass / 3);
  const grow = [0, 0.33, 0.66, 1][pass];
  const box = ramp(t, bb(7, 2.75), 0.5, 'io3'), squeeze = ramp(t, bb(7, 3.25), 0.5, 'io2');
  let o;
  if (pass < 3) o = { ...KID, hairCol, h: lerp(430, 560, grow), headR: lerp(15.5, 14, grow), top: pass >= 1 ? mix(PAL.mint, '#8d93b8', 0.7) : PAL.mint, topStyle: pass >= 2 ? 'shirt' : 'stripe', hair: pass >= 1 ? 'neat' : 'tuft', bottom: pass >= 1 ? '#3b3f72' : PAL.blue, shoes: pass >= 1 ? PAL.navy : PAL.coral };
  else o = { ...LAOSHI, h: 600 };
  Object.assign(o, { x: 540, y: GY, jump: air, sy: sq * breathe(t), sx: 2 - sq, hunch: pass * 0.33, eyes: pass >= 2 ? 'sad' : pass === 1 ? 'dot' : 'happy', mouth: pass >= 2 ? 'flat' : pass === 1 ? 'flat' : 'open', brows: pass >= 2 ? 'worried' : 'none', sweat: squeeze });
  if (t < bb(6, 1.0)) { o.armL = [150 - air * 0.2, -10]; o.armR = [150 - air * 0.2, 10]; o.eyes = 'happy'; o.mouth = 'open'; }
  if (no > 0.5) { Object.assign(o, { armsFront: 'LR', armL: [30, -125], armR: [42, -125], mouth: 'frown', brows: 'angry', eyes: 'dot', headTilt: -10 }); }
  if (why > 0.5) { Object.assign(o, { armR: [40, 140], armL: [10, 5], mouth: 'o', eyes: 'wide', headTilt: 12, look: [0.5, -0.8] }); }
  if (draw_ > 0.5) { Object.assign(o, { armR: [140 + 20 * Math.sin(t * 14), 10], armL: [10, 5], mouth: 'grin', eyes: 'happy', turn: 0.4 }); }
  if (squeeze > 0) { o.sx *= 1 - 0.08 * squeeze; o.sy *= 1 - 0.05 * squeeze; o.hunch = 1 + 0.3 * squeeze; }
  const J = person(o, t);
  if (draw_ > 0.5) { c.save(); c.translate(J.handR[0], J.handR[1]); c.rotate(0.6); rrFill(-6, -40, 12, 44, 5, PAL.coral); c.restore(); }
  splash(t, land, 540, GY + 20, 5, { n: 14, spd: 900 });
  say(t, bb(6, 1.4), bb(6, 2.15), 300, 760, '我不！', J.head[0] - 40, J.head[1] - 30, { size: 72, rot: -0.25 });
  say(t, bb(6, 2.25), bb(6, 2.95), 790, 720, '为什么？', J.head[0] + 40, J.head[1] - 40, { size: 64, rot: 0.2 });
  for (const pt of [p1, p2, p3]) puff(t, pt - 0.06, 540, J.head[1] - 10, 120, '#ffffff', 3);
  // rollers
  const R = [['懂事', bb(7, 0.4), bb(7, 1.15), J.head[1] - 20], ['别冒头', bb(7, 1.15), bb(7, 1.9), J.head[1] - 20], ['标准答案', bb(7, 1.9), bb(7, 2.65), J.head[1] - 10]];
  for (const [str, a, b, y] of R) { const u = (t - a) / (b - a); if (u > -0.05 && u < 1.05) roller(lerp(-260, 1360, E.io2(clamp(u))), y, 0.95, 0.12 * Math.sin(u * 9), str); }
  // the box closing in
  if (box > 0) {
    const bw = lerp(1100, 560, box) - 90 * squeeze, bh = lerp(1000, 720, box) - 60 * squeeze;
    const cx = 540, cy = GY - bh / 2 + 10, tremble = squeeze * 5 * Math.sin(t * 60);
    c.save(); c.translate(tremble, 0); c.globalAlpha *= clamp(box * 1.5);
    c.lineWidth = 34; c.strokeStyle = '#4a4866'; c.lineJoin = 'round'; c.strokeRect(cx - bw / 2, cy - bh / 2, bw, bh);
    c.lineWidth = 8; c.strokeStyle = '#6e6d8a'; c.strokeRect(cx - bw / 2 + 22, cy - bh / 2 + 22, bw - 44, bh - 44);
    c.restore();
  }
}

// ------------------------------------------------------------------ B8 DROP: the frame shatters, 黄毛心 bursts out of the chest
export function drop(t) {
  const t0 = B[8];
  bg(PAL.blue);
  c.save(); sunburst(540, 560, 2600, 20, 'rgba(255,255,255,0.10)', null, (t - t0) * 0.5); c.restore();
  const ringR = 200 + 700 * E.out3(clamp((t - t0) / 0.6));
  alpha(1 - clamp((t - t0) / 0.6), () => ring(540, 560, ringR, 30, '#ffffff'));
  stage(null, { deco: null });
  shards(t, t0, 540, 900, 560, 720, '#4a4866', 9, { n: 16, s: 80 });
  const straight = spring(t, t0 + 0.05, 2.4, 6);
  const joy = ramp(t, bb(8, 0.9), 0.2);
  const J = person({ ...LAOSHI, x: 540, y: GY, h: 600, hunch: lerp(1.2, 0, clamp(straight)), eyes: joy > 0.5 ? 'happy' : 'wide', mouth: joy > 0.5 ? 'grin' : 'o', brows: 'up', armL: [lerp(20, 135, clamp(straight)), -15], armR: [lerp(20, 135, clamp(straight)), -15], sy: 1 + 0.06 * (straight - 1) * 0 + 0.03 * Math.sin((t - t0) * 20) * Math.exp(-(t - t0) * 4), badge: ramp(t, bb(8, 2.4), 0.25, 'pop'), badgeS: 1.2 }, t);
  // mascot rises from the chest
  const u = clamp(spring(t, t0 + 0.02, 1.6, 5.5));
  const mx = 540, my = lerp(J.chest[1], 560, u);
  const ms = lerp(10, 150, Math.min(1.08, u)) * (1 + 0.05 * beatP(t)) * (1 + 0.03 * Math.sin((t - t0) * 5));
  heartMascot(mx, my + 10 * Math.sin((t - t0) * 3), ms, t, { glow: clamp((t - t0) * 2), eyes: t < bb(8, 1.0) ? 'star' : 'happy', mouth: t < bb(8, 1.0) ? 'open' : 'smile', bounce: pulse(t, t0 + 0.3, 3) * 1.5 });
  sparkleBurst(t, t0 + 0.1, 540, 560, 220, { n: 10, s: 34 });
  sparkleBurst(t, bb(8, 1.0), 540, 560, 260, { n: 8, s: 28, rot: 0.6 });
  confetti(t, t0 + 0.03, 540, 760, 11, { n: 70, spd: 1900 });
  confetti(t, bb(8, 2.0), 540, 600, 12, { n: 30, spd: 1300 });
  if (t > bb(8, 2.4)) badgeFx(t, bb(8, 2.4), J.chest[0], J.chest[1], 1.2);
}
