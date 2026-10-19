// 黄毛理论 v2 · scenes B9–B16 (everyday people light up → lineup → fate vs choice → climax)
import { c, PAL, bg, rrFill, rr, circ, ell, fillP, strokeP, line, heart, burst, sparkle, dots, withT, alpha, shade, ring, sunburst, lin, path } from './draw.js';
import { B, bb, BEAT } from './beat.js';
import { clamp, lerp, hs, E, popS, ramp, pulse, K, spring, mix } from './lib.js';
import { label, FONTS } from './type.js';
import { person, personSide, heartMascot, LAOSHI, HUANGMAO, KID } from './char.js';
import { stage, blobs, rays, beatP, breathe, arc, runPose, GY } from './kit.js';
import { confetti, sparkleBurst, popLines, dust, say, floatTag, badgeFx, rain, speedLines, pill } from './fx.js';
import { bouquet, table, boardChart, motorbike, ticket, skateboard, podium, moneyBag, die, magnifier } from './props.js';

export const OFFICE = { hair: 'bob', hairCol: PAL.hairB, top: PAL.purple, topStyle: 'suit', skirt: PAL.navy, bottom: PAL.navy, shoes: PAL.navy };
export const RIDER = { hair: 'short', hairCol: PAL.hairK, top: PAL.mint, topStyle: 'jacket', inner: '#fff', bottom: '#3b3f72', shoes: PAL.navy, skin: PAL.skin2 };
export const GRANNY = { hair: 'grandma', hairCol: PAL.hairW, glasses: true, top: PAL.pink, topStyle: 'tee', bottom: PAL.blue, shoes: '#ffffff' };
export const GIRL = { hair: 'long', hairCol: PAL.hairB, top: PAL.mint, topStyle: 'tee', skirt: PAL.blue, bottom: PAL.blue, shoes: PAL.coral };
export const CHEF = { hair: 'short', hairCol: PAL.hairK, top: '#ffffff', topStyle: 'apron', apron: PAL.coral, bottom: PAL.navy, skin: PAL.skin2 };
export const UNCLE = { hair: 'old', hairCol: '#6b6a80', top: PAL.orange, topStyle: 'overall', overall: PAL.blue, bottom: PAL.blue };
const lightUp = (t, t0) => ramp(t, t0, 0.3, 'pop');

// ------------------------------------------------------------------ B9 meeting: she raises her hand
export function meet(t) {
  stage('#c7b8ff', { deco: () => { rrFill(0, 0, 1080, 160, 0, '#b6a5f7'); } });
  boardChart(300, 600, 420, 300, t, B[9] + 0.15);
  rrFill(80, 760, 440, 10, 5, '#a796f0');
  const raise = ramp(t, bb(9, 0.85), 0.25, 'pop'), look = ramp(t, bb(9, 1.25), 0.25), lit = lightUp(t, bb(9, 1.5));
  const P1 = person({ hair: 'short', hairCol: PAL.hairK, glasses: true, top: '#8d93b8', topStyle: 'suit', tie: PAL.navy, bottom: PAL.navy, x: 210, y: 1330, h: 540, turn: lerp(0, 0.8, look), look: [lerp(0, 1, look), -0.3], eyes: look > 0.5 ? 'wide' : 'dot', mouth: look > 0.5 ? 'o' : 'flat', armL: [10, 4], armR: [10, 4], sy: breathe(t, 0.4) }, t);
  const P3 = person({ hair: 'slick', hairCol: '#3a2a22', top: PAL.navy, topStyle: 'suit', tie: PAL.coral, bottom: PAL.navy, x: 870, y: 1330, h: 560, turn: lerp(0, -0.8, look), look: [lerp(0, -1, look), -0.3], eyes: look > 0.5 ? 'wide' : 'dot', mouth: look > 0.5 ? 'o' : 'flat', brows: look > 0.5 ? 'up' : 'none', armL: [10, 4], armR: [10, 4], sy: breathe(t, 2.1) }, t);
  const J = person({ ...OFFICE, x: 540, y: 1330, h: 560, eyes: 'dot', mouth: raise > 0.5 ? 'open' : 'flat', brows: raise > 0.5 ? 'up' : 'none', armR: [lerp(10, 168, raise), lerp(4, 4, raise)], armL: [10, 4], sy: breathe(t) * (1 + 0.04 * pulse(t, bb(9, 0.85), 8)), badge: lit, badgeS: 1.15 }, t);
  table(540, 1050, 1040);
  rrFill(140, 1000, 120, 60, 10, '#ffffff'); rrFill(820, 1004, 110, 56, 10, '#ffffff'); // papers
  say(t, bb(9, 0.95), 99, 760, 560, '我有个想法！', J.handR[0] + 10, J.handR[1] + 40, { size: 60, col: PAL.yel, rot: 0.2 });
  popLines(t, bb(9, 0.9), J.handR[0], J.handR[1] - 20, 70, { n: 5 });
  if (lit > 0) badgeFx(t, bb(9, 1.5), J.chest[0], J.chest[1], 1.1);
}

// ------------------------------------------------------------------ B10 ride: chase the chance through dusk rain
export function ride(t) {
  const lt = t - B[10];
  c.fillStyle = lin(0, 0, 0, 1250, [[0, '#3a2e8f'], [0.55, '#c9608f'], [1, '#ff9f6b']]); c.fillRect(-50, -50, 1180, 1400);
  circ(760, 1150, 170, PAL.coral2);
  // city silhouette (parallax)
  for (let i = 0; i < 12; i++) { const w = 120 + 60 * hs(i, 3), h = 160 + 260 * hs(i, 4); const x = ((i * 150 - lt * 140) % 1800 + 1800) % 1800 - 300; rrFill(x, 1180 - h, w, h + 10, 8, i % 2 ? '#4b3a8f' : '#5a4399'); }
  rain(t, -100, 0, 1300, 1250, 46, { a: 0.3 });
  // road
  rrFill(-100, 1180, 1300, 800, 0, '#2b2a55'); rrFill(-100, 1180, 1300, 14, 0, '#3d3b70');
  for (let i = 0; i < 8; i++) { const x = ((i * 260 - lt * 1500) % 2080 + 2080) % 2080 - 300; rrFill(x, 1360, 150, 16, 8, '#ffffff'); }
  speedLines(t, -100, 700, 1300, 520, 12, { a: 0.35, spd: 2600 });
  const grab = bb(10, 2.15), got = t >= grab;
  const bx = K(t, [[B[10], 360], [grab, 560, 'io2'], [B[11] + 0.5, 600, 'out2']]);
  const by = 1250 - 4 * Math.abs(Math.sin(t * 15));
  const M = motorbike(bx, by, 1.15, t, { col: PAL.coral });
  const lit = lightUp(t, grab + 0.2);
  const reach = ramp(t, grab - 0.35, 0.3, 'io2');
  const o = { ...RIDER, view: 'side', dir: 1, hat: 'helmet', hatCol: PAL.yel === PAL.yel ? '#ffffff' : '#fff', h: 430, lean: 22, legF: [95, 95], legB: [80, 95], armF: [lerp(75, 150, reach), lerp(-10, 0, reach)], armB: [70, -10], eyes: 'dot', mouth: got ? 'grin' : 'flat', badge: lit };
  const s = 4.3; o.x = M.seat[0] + 10; o.y = M.seat[1] + 44 * s;
  const R = person(o, t);
  // the chance (flying ticket) ahead
  const tx = got ? R.hand[0] + 10 : K(t, [[B[10], 930], [grab, 820, 'io2']]);
  const ty = got ? R.hand[1] - 20 : 720 + 30 * Math.sin(t * 4);
  ticket(tx, ty, got ? 0.95 : 1.1, t, '机会');
  if (got) { sparkleBurst(t, grab, tx, ty, 110, { n: 8 }); }
}

// ------------------------------------------------------------------ B11 love: say it directly
export function love(t) {
  stage(PAL.pink, { deco: () => { for (let i = 0; i < 7; i++) { const x = hs(i, 2) * 1080, y = 300 + ((hs(i, 3) * 900 - (t - B[11]) * 60) % 900 + 900) % 900; alpha(0.35, () => heart(x, y, 30 + 30 * hs(i, 4), '#ffc4d8')); } } });
  const step = ramp(t, bb(11, 0.7), 0.3, 'pop'), lit = lightUp(t, bb(11, 1.05)), blush = ramp(t, bb(11, 1.5), 0.3);
  const J = person({ ...LAOSHI, x: lerp(300, 350, step), y: GY, h: 580, hunch: lerp(0.5, 0, step), lean: lerp(0, 6, step), turn: 0.6, look: [1, 0], eyes: 'dot', mouth: step > 0.5 ? 'open' : 'flat', brows: 'up', blush: 1.2, armR: [lerp(30, 78, step), lerp(40, 10, step)], armL: [12, 6], badge: lit, badgeS: 1.15, sy: breathe(t) }, t);
  bouquet(J.handR[0] + 20, J.handR[1] - 10, 1.35, t, { r: lerp(-0.1, 0.4, step) });
  const G = person({ ...GIRL, x: 790, y: GY, h: 560, turn: -0.6, look: [-1, 0], eyes: blush > 0.5 ? 'happy' : 'wide', mouth: blush > 0.5 ? 'smile' : 'o', blush: 0.8 + 1.4 * blush, armL: [12, 6], armR: [lerp(12, 40, blush), lerp(6, -100, blush)], armsFront: 'R', sy: breathe(t, 1.2), headTilt: -6 * blush }, t);
  say(t, bb(11, 0.8), 99, 380, 560, '我喜欢你！', J.head[0] + 30, J.head[1] - 90, { size: 62, col: PAL.yel, rot: -0.2 });
  if (lit > 0) badgeFx(t, bb(11, 1.05), J.chest[0], J.chest[1], 1.1);
  for (let i = 0; i < 4; i++) { const t0 = bb(11, 1.6 + i * 0.35), u = clamp((t - t0) / 1.2); if (u > 0 && u < 1) alpha(1 - u, () => heart(G.head[0] + (i % 2 ? 60 : -50) + Math.sin(u * 6 + i) * 20, G.head[1] - 110 - u * 220, 26 * popS(t, t0, 0.25), PAL.coral, { hi: 'rgba(255,255,255,0.6)' })); }
}

// ------------------------------------------------------------------ B12 skate: sixty and learning
export function skate(t) {
  const lt = t - B[12];
  const spd = lerp(300, 900, ramp(t, bb(12, 1.4), 0.6));
  const off = lt * 300 + Math.max(0, lt - (bb(12, 1.4) - B[12])) * 600;
  bg(PAL.mint);
  for (let i = 0; i < 6; i++) { const x = ((i * 330 - off * 0.5) % 1980 + 1980) % 1980 - 300; rrFill(x + 40, 760, 22, 500, 11, '#1fb886'); circ(x + 51, 720, 130 + 30 * hs(i, 2), i % 2 ? '#1fc98f' : '#5cf0bd'); }
  rrFill(-200, GY, 1480, 800, 0, PAL.cream); rrFill(-200, GY, 1480, 18, 0, '#ead9bb');
  for (let i = 0; i < 7; i++) { const x = ((i * 300 - off) % 2100 + 2100) % 2100 - 300; rrFill(x, GY + 120, 120, 12, 6, '#ead9bb'); }
  const bal = ramp(t, bb(12, 1.4), 0.35, 'pop'), lit = lightUp(t, bb(12, 1.65));
  const wob = (1 - bal) * Math.sin(lt * 14), x = 500;
  const by = GY - 18, br = (1 - bal) * 0.06 * Math.sin(lt * 14);
  skateboard(x, by, 1.25, br);
  const o = { ...GRANNY, view: 'side', dir: 1, hat: 'helmet', hatCol: PAL.coral, h: 520, x, y: by - 38, rot: wob * 0.06,
    legF: [lerp(14 + 10 * wob, 18, bal), lerp(18, 26, bal)], legB: [lerp(-14 - 10 * wob, -18, bal), lerp(18, 26, bal)],
    armF: [lerp(120 + 40 * Math.sin(lt * 16), 90, bal), lerp(40, 0, bal)], armB: [lerp(-120 - 40 * Math.sin(lt * 16 + 1), -90, bal), lerp(40, 0, bal)],
    lean: lerp(-4, 8, bal), eyes: bal > 0.5 ? 'happy' : 'dot', mouth: bal > 0.5 ? 'grin' : 'open', glasses: true, badge: lit };
  const P = person(o, t);
  if (bal > 0.5) speedLines(t, -100, 820, 400, 420, 8, { a: 0.5, col: '#ffffff', spd: 2200 });
  if (lit > 0) sparkleBurst(t, bb(12, 1.65), x + 20, by - 300, 90, { n: 8 });
  if (bal < 0.5) { c.save(); c.translate(x + 110, by - 480); const s = 1 - bal * 2; c.scale(s, s); c.beginPath(); c.moveTo(0, -24); c.quadraticCurveTo(17, 1, 0, 15); c.quadraticCurveTo(-17, 1, 0, -24); c.fillStyle = '#7fd3ff'; c.fill(); c.restore(); }
  dust(t, bb(12, 1.4), x - 140, GY - 10, 7, { w: 60 });
  pill(x + 30, by - 640 + 6 * Math.sin(lt * 5), '60岁', popS(t, bb(12, 0.25), 0.3), { size: 50, rot: -0.06 });
}

// ------------------------------------------------------------------ B13 lineup: none of them has yellow hair
export function lineup(t) {
  stage(PAL.blue, { deco: () => rays(540, 700, t, 'rgba(255,255,255,0.06)', 18, 0.1) });
  const cast = [[OFFICE, 175, 520], [RIDER, 405, 540], [LAOSHI, 645, 560], [GRANNY, 880, 500]];
  const mx = K(t, [[bb(13, 0.3), -120], [bb(13, 3.1), 1200, 'io2']]);
  const heads = [];
  cast.forEach(([P, x, h], i) => {
    const pass = t > bb(13, 0.3) && mx > x;
    const tp = bb(13, 0.3) + (x + 120) / 1320 * (bb(13, 3.1) - bb(13, 0.3));
    const J = person({ ...P, x, y: GY, h, eyes: pass ? 'happy' : 'dot', mouth: pass ? 'grin' : 'smile', armL: [12, 6], armR: [12, 6], badge: 1, badgeGlow: 0.6 + 0.6 * pulse(t, tp, 3), jump: arc(t, tp, tp + 0.3, 30), sy: breathe(t, i) }, t);
    heads.push(J.head);
    sparkleBurst(t, tp, J.chest[0], J.chest[1], 60, { n: 6, s: 16 });
  });
  const my = 735 + 18 * Math.sin((t - B[13]) * 6);
  if (t > bb(13, 0.25) && t < bb(13, 3.2)) magnifier(mx, my, 100, 1);
}

// ------------------------------------------------------------------ B14–B15 fate vs choice; spotlight swings, push into the badge
export function fate(t) {
  const swing = ramp(t, bb(15, 0.0), 0.5, 'io3');
  const zoom = ramp(t, bb(15, 0.6), B[16] - bb(15, 0.6), 'in3');
  const fx = 790, fy = GY - 0.585 * 560; // focus: the ordinary guy's badge
  c.save();
  const Z = 1 + 5.5 * zoom;
  c.translate(fx, fy); c.scale(Z, Z); c.translate(-fx, -fy);
  bg('#231f5c');
  stars(t);
  rrFill(-200, GY, 1480, 800, 0, '#2f2a73');
  // spotlight cones
  const cone = (x, a) => { if (a <= 0) return; c.save(); c.globalAlpha *= a; c.fillStyle = lin(0, 0, 0, GY, [[0, 'rgba(255,248,220,0.0)'], [1, 'rgba(255,248,220,0.38)']]); c.beginPath(); c.moveTo(x - 60, -50); c.lineTo(x + 60, -50); c.lineTo(x + 300, GY + 60); c.lineTo(x - 300, GY + 60); c.closePath(); c.fill(); ell(x, GY + 40, 300, 50, 'rgba(255,248,220,0.35)'); c.restore(); };
  cone(360, 1 - swing); cone(fx, swing);
  // podium + 高富帅
  alpha(1 - 0.55 * swing, () => {
    podium(360, 1040, 330, 220, '高富帅', PAL.purple);
    person({ hair: 'slick', hairCol: '#2a1e18', hat: 'top', shades: true, top: PAL.navy, topStyle: 'suit', tie: PAL.coral, bottom: PAL.navy, shoes: '#000', x: 360, y: 1040, h: 600, sy: 1.08, eyes: 'cool', mouth: 'smirk', armL: [12, 6], armR: [30, 40] }, t);
    moneyBag(470, 1000, 0.9);
    for (let i = 0; i < 3; i++) sparkle(360 + [-150, 140, 120][i], 520 + [40, -20, 200][i], 26 * (0.7 + 0.3 * Math.sin(t * 6 + i * 2)), '#ffffff', t);
  });
  // the die of fate
  const d0 = bb(14, 0.55), d1 = bb(14, 1.55);
  if (t > d0) {
    const u = clamp((t - d0) / (d1 - d0));
    const x = lerp(1250, 800, E.out3(u)), y = GY - 100 - Math.abs(Math.sin(u * Math.PI * 2.5)) * 240 * (1 - u);
    const r = (1 - E.out3(u)) * 9;
    alpha(1 - swing, () => die(x, y, 1.05, r, u > 0.85 ? '命' : (Math.floor(u * 9) % 2 ? null : '命')));
    if (u >= 1) popLines(t, d1, 800, GY - 200, 130, { n: 6, col: '#ffffff' });
  }
  // the ordinary guy (enters with the swing)
  const enter = ramp(t, bb(14, 3.2), 0.5, 'out3');
  if (enter > 0) {
    const glow = ramp(t, bb(15, 0.4), 0.4);
    person({ ...LAOSHI, x: fx, y: GY, h: 560, hunch: lerp(0.4, 0, glow), eyes: glow > 0.5 ? 'happy' : 'dot', mouth: 'smile', armL: [12, 6], armR: [12, 6], badge: 0.6 + 0.6 * glow, badgeGlow: 0.6 + 0.8 * glow + 0.3 * beatP(t), sy: breathe(t), turn: lerp(-0.4, 0, glow) }, t);
    if (glow > 0) for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + t * 0.8; sparkle(fx + Math.cos(a) * 60 * (1 + zoom), fy + Math.sin(a) * 60 * (1 + zoom), 9 * glow, PAL.yel, t * 2); }
  }
  c.restore();
}
function stars(t) { for (let i = 0; i < 20; i++) { const x = hs(i, 11) * 1080, y = hs(i, 12) * 1000, tw = 0.5 + 0.5 * Math.sin(t * 3 + i); sparkle(x, y, (6 + 8 * hs(i, 13)) * tw, '#ffffff', 0); } }

// ------------------------------------------------------------------ B16 climax: anyone can be one
export function climax(t) {
  const lt = t - B[16];
  bg(PAL.coral);
  c.save(); sunburst(540, 560, 2600, 22, 'rgba(255,214,90,0.35)', null, lt * 0.6); c.restore();
  rrFill(-200, GY, 1480, 800, 0, PAL.cream); rrFill(-200, GY, 1480, 18, 0, '#ead9bb');
  const ms = lerp(900, 170, E.out4(clamp(lt / 0.5))) * (1 + 0.06 * beatP(t));
  heartMascot(540, lerp(GY - 330, 560, E.out3(clamp(lt / 0.5))) + 10 * Math.sin(lt * 4), ms, t, { glow: 1, eyes: 'happy', mouth: 'open', bounce: beatP(t) });
  const back = [[KID, 130, 380], [CHEF, 330, 470], [GIRL, 540, 450], [UNCLE, 750, 470], [RIDER, 950, 480]];
  const front = [[OFFICE, 240, 430], [HUANGMAO, 540, 470], [GRANNY, 840, 420]];
  const pose = (i) => { const ph = ((t - bb(16, 0) - i * 0.06) / BEAT); const k = ph - Math.floor(ph); return { jump: ph > 0 ? Math.sin(k * Math.PI) * 50 : 0 }; };
  back.forEach(([P, x, h], i) => { const p = pose(i); person({ ...P, x, y: GY - 40, h: h * 0.9, jump: p.jump, eyes: 'happy', mouth: 'grin', armL: [150 + 10 * Math.sin(t * 9 + i), -10], armR: [150 + 10 * Math.sin(t * 9 + i + 1), 10], badge: 1, badgeGlow: 0.8 }, t); });
  front.forEach(([P, x, h], i) => { const p = pose(i + 3); person({ ...P, x, y: GY + 60, h, jump: p.jump, eyes: 'happy', mouth: 'grin', armL: [150, -10], armR: [150, 10], badge: 1, badgeGlow: 0.8 }, t); });
  confetti(t, B[16] + 0.02, 540, 700, 31, { n: 80, spd: 2000 });
  confetti(t, bb(16, 2), 200, 900, 32, { n: 30, spd: 1500, ang: -Math.PI / 3 });
  confetti(t, bb(16, 2), 880, 900, 33, { n: 30, spd: 1500, ang: -Math.PI * 2 / 3 });
}
