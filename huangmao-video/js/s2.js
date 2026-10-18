// 黄毛理论 · scenes B9–B16: three true stories (prow → rain ride → superbike → cart/leave slip) → same fire → what 黄毛 is NOT → 高富帅 vs anyone → CLIMAX
import { PAL, hs, clamp, lerp, E, K, rrectPts } from './engine.js';
import { c, B, bt, BEAT, E8, pulse, appear, ioL, slam, HL, SUB, tint, morphW, drawMorph, line } from './core.js';
import { YEL, YELL, ORG, ORGD, GINK, GREYL, GREYM, P, mixP, person, drawFlame, flamePts } from './people.js';
import { HULL, dense, tfm, box, disc, txt, PROW, deckY, prowDetails, water, wavesToRain, oldBike, OLD_BODY, SUPER_BODY, van, checkerFlag, cart, slip, stampZhun,
  dyeBottle, spikyHead, brokenHeart, redX, pedestal, topHat, dice, wheel } from './props.js';
import { puff, twinkle, speedLines } from './fx.js';
import { mixHex, drawSeal } from './shapes.js';
import { GROUND, DROP_GUY, colS, chestOf } from './s1.js';

const RY = 1440;                                   // road level of the bike stories
const PY = 150, PRW = PROW.map(([x, y, cr]) => [x, y + PY, cr]);
let _prw = null; const PRWD = () => (_prw ||= dense(PRW, true, 4));
const deck = (x) => deckY(x) + PY;
const hopAt = (t, t0, d = 0.3, h = 1) => (t < t0 || t > t0 + d ? 0 : h * Math.sin(Math.PI * (t - t0) / d));
const dropFlame = () => { const ch = chestOf(P.cheer(), DROP_GUY), s = colS(B[9]); return flamePts(ch[0], ch[1] + 40, 150 * s, 200 * s, B[9] * 2.2, 0, 1, 0); };

// ------------------------------------------------------------------ B9: the flame column bends into a ship's prow; "Jack" spreads his arms
const JX = 330, JS = 0.9, JY = deck(JX) - 256 * JS;
const shipBob = (tq) => 7 * Math.sin((tq - B[9]) * 3.4);
function jackAt(tq) {
  const v = ioL((tq - B[9]) / 0.4), bob = shipBob(tq);
  if (v < 1) return { tf: { x: lerp(DROP_GUY.x, JX, v), y: lerp(DROP_GUY.y, JY + bob, v) - 230 * Math.sin(Math.PI * v), s: lerp(DROP_GUY.s, JS, v), flip: v < 0.5 ? 1 : -1 }, pose: P.jump(Math.sin(Math.PI * v)), v };
  return { tf: { x: JX, y: JY + bob, s: JS, flip: -1 }, pose: mixP(P.stand(), P.wide(), E.outBack(clamp((tq - bt(37)) / 0.25), 1.8)), v: 1 };
}
export function sShip(t, tq, D) {
  if (tq < B[9] || tq >= B[10]) return;
  const u = E.out3(clamp((tq - B[9]) / 0.3)), bob = shipBob(tq);
  if (u > 0.5) for (let i = 0; i < 7; i++) { // wind
    const yy = 650 + i * 50 + 24 * hs(i, 3), L = 90 + 90 * hs(i, 4), x = ((hs(i, 5) * 1400 + (tq - B[9]) * 1150) % 1500) - 250;
    line([[x, yy], [x + L, yy]], D, 400 + i, { w: 4, color: GINK, t0: 2, t1: 2 });
  }
  c.save(); c.translate(0, bob * u);
  if (u < 1) drawMorph(morphW(dropFlame(), PRWD(), u, 'f2p'), mixHex(YEL, HULL, u), D, 410, { w: 7.5 });
  else drawMorph(PRWD(), HULL, D, 410, { w: 7.5 });
  c.save(); c.translate(0, PY); prowDetails(D, 412, clamp((tq - B[9] - 0.22) / 0.15)); c.restore();
  c.restore();
  // ticket
  const ta = appear(tq, bt(37.5), 0.25);
  if (ta > 0.01) {
    c.save(); c.translate(745, 820 + bob); c.rotate(0.14 + 0.04 * Math.sin(tq * 4)); c.scale(ta, ta);
    box(0, 0, 250, 118, 12, '#f6d7a8', D, 420, { w: 5.5 });
    line([[-78, -44], [-78, 44]], D, 421, { w: 3, color: GINK, t0: 1, t1: 1 });
    disc(-100, 0, 9, PAL.ink, D, 422, { w: 0 });
    txt('三等舱', 26, 2, 54, PAL.ink, D, 423, { font: 'KL' });
    c.restore();
  }
  const J = jackAt(tq);
  const R = person(c, J.tf, J.pose, { D, k: 430, face: tq >= bt(38) ? 'shock' : 'grin', hair: 'cap', hairC: mixHex(PAL.ink, YELL, clamp(J.v * 1.6)), chest: lerp(1.15, 0.8, J.v), glow: 1 });
  if (tq >= bt(38)) { // yell
    const a = appear(tq, bt(38), 0.15);
    for (let j = 0; j < 3; j++) {
      const an = Math.PI + (j - 1) * 0.45, r0 = R.R * 1.4, r1 = r0 + 64 * a + 8 * Math.sin(tq * 30 + j);
      line([[R.hc[0] + Math.cos(an) * r0, R.hc[1] + 8 + Math.sin(an) * r0], [R.hc[0] + Math.cos(an) * r1, R.hc[1] + 8 + Math.sin(an) * r1]], D, 440 + j, { w: 7 });
    }
  }
  const wy = lerp(1960, 1450, E.out3(clamp((tq - B[9]) / 0.35)));
  water(wy, tq * 2.4, D, 450, 1);
  for (let j = 0; j < 3; j++) { const ph = (tq * 1.6 + j / 3) % 1; c.save(); c.globalAlpha *= (1 - ph) * u; puff(c, 330 - 90 * ph - j * 12, wy - 6 - 50 * ph, 16 + 26 * ph, D, 455 + j); c.restore(); }
  SUB('“黄毛教父”杰克', tq, B[9] + 0.06, B[10] - 0.06, 300, { D, size: 60, seed: 80, color: tint('“黄毛教父”杰克', '黄毛', ORGD) });
  HL('坐三等舱，', tq, bt(37), B[10] - 0.06, 415, { D, size: 108, seed: 81 });
  HL('照样喊“世界之王”', tq, bt(38), B[10] - 0.06, 535, { D, size: 100, seed: 82 });
}

// ------------------------------------------------------------------ B10: waves tear into rain; prow → TV van; the apprentice chases it on an old bike
const VAN_BODY = [[-210, -40, 1], [-210, -226, 1], [118, -226, 1], [196, -150], [214, -40, 1]];
const RIDE = { hip: [0, 0], lean: 0.5, legs: [{ t: 1.2, k: 1.5, f: 0.2 }, { t: 1.1, k: 1.45, f: 0.2 }], arms: [{ t: 0.95, k: -0.4 }, { t: 0.85, k: -0.3 }], head: -0.3, face: 'grin' };
const BS = 1.1;
const vanX = (tq) => 800 + 12 * Math.sin(tq * 3.1) + (tq > B[11] ? 760 * E.in2(clamp((tq - B[11]) / 0.42)) : 0);
const bikeX = (tq) => lerp(-320, 250, E.out3(clamp((tq - B[10]) / 0.4))) + 110 * clamp((tq - B[10]) / (B[11] - B[10]));
const seatOf = (bx, by) => ({ x: bx - 60, y: by - 196, s: 0.8, flip: 1 });
function road(tq, D, a = 1) {
  if (a > 0) line([[540 - 640 * a, RY], [540 + 640 * a, RY]], D, 500, { w: 8 });
  for (let i = 0; i < 6; i++) { const x = 1160 - (((tq - B[10]) * 950 + i * 220) % 1320); line([[x, RY + 34], [x + 70, RY + 34]], D, 502 + i, { w: 5, color: GINK, t0: 2, t1: 2 }); }
}
export function sBike(t, tq, D) {
  if (tq < B[10] || tq >= B[11]) return;
  const u = E.out3(clamp((tq - B[10]) / 0.32)), ur = clamp((tq - B[10]) / 0.6);
  water(1450 + 260 * ur, tq * 2.4, D, 450, 1 - ur);
  road(tq, D, E.out2(clamp((tq - B[10] - 0.1) / 0.3)));
  const vx = vanX(tq);
  if (u < 1) drawMorph(morphW(PRWD(), tfm(dense(VAN_BODY, true, 3), vx, RY, 1), u, 'p2v'), mixHex(HULL, PAL.hi, u), D, 510, { w: 7 });
  const va = clamp((u - 0.75) / 0.25);
  if (va > 0) { c.save(); c.globalAlpha *= va; van(vx, RY, 1, D, 512, { spin: tq * 12 }); c.restore(); }
  const bx = bikeX(tq), bump = 18 * hopAt(tq, bt(41), 0.22);
  if (tq >= bt(41) + 0.18) { c.save(); c.globalAlpha *= 0.9; for (const [ox, k] of [[-121, 521], [121, 522]]) { const v = (tq - bt(41) - 0.18) / 0.4; if (v < 1) puff(c, bx + ox - 40 * v, RY - 6 - 20 * v, 14 + 22 * v, D, k, { fill: '#cfe6f5' }); } c.restore(); }
  oldBike(bx, RY - bump, BS, tq * 14, D, 520, { color: PAL.blue });
  const w = ioL((tq - B[10]) / 0.38), J = jackAt(B[10] - 0.001), seat = seatOf(bx, RY - bump);
  const tf = w < 1 ? { x: lerp(J.tf.x, seat.x, w), y: lerp(J.tf.y, seat.y, w) - 140 * Math.sin(Math.PI * w), s: lerp(J.tf.s, seat.s, w), flip: w < 0.5 ? -1 : 1 } : seat;
  const R = person(c, tf, w < 1 ? mixP(P.wide(), RIDE, w) : RIDE, { D, k: 530, face: 'grin', hair: 'cap', hairC: w < 0.5 ? YELL : PAL.ink, chest: 0.8, glow: 0.9 });
  if (w > 0.3 && w < 0.98) { const pv = (w - 0.3) / 0.68; c.save(); c.globalAlpha *= 1 - pv; puff(c, R.hc[0], R.hc[1], 50 + 50 * pv, D, 535); c.restore(); }
  wavesToRain(tq - B[10], 1450, ur, D, 540);
  if (tq >= bt(42) && tq < bt(42) + 0.22) {
    const bolt = [[968, 600, 1], [905, 720, 1], [980, 760, 1], [902, 920, 1]];
    line(bolt, D, 545, { w: 20, color: PAL.ink, t0: 4, t1: 14 }); line(bolt, D, 546, { w: 10, color: YEL, t0: 3, t1: 10 });
  }
  const fl = pulse(tq, bt(42), 11);
  if (tq >= bt(42) && fl > 0.02) { c.save(); c.globalAlpha = 0.45 * fl; c.fillStyle = PAL.hi; c.fillRect(-300, -300, 1680, 2520); c.restore(); }
  HL('19岁修车学徒，', tq, B[10] + 0.06, B[11] - 0.06, 320, { D, size: 104, seed: 84 });
  HL('冒雨骑100多公里', tq, bt(41), B[11] - 0.06, 440, { D, size: 104, seed: 85, color: tint('冒雨骑100多公里', '100', YEL) });
  SUB('追电视台摄制组，求一个上节目的机会', tq, bt(42), B[11] - 0.06, 552, { D, size: 48, seed: 86 });
}

// ------------------------------------------------------------------ B11: old bike → superbike, 2006 → 2026, flag, 冠军 seal.  B12: wheel → cart → leave slip → 准
const L0 = bt(46) - 0.25;
const superX = (tq) => 360 + (tq < L0 ? 2.5 * Math.sin(tq * 70) : 1500 * E.in2(clamp((tq - L0) / 0.4)));
let _ob = null, _sb = null; const OBD = () => (_ob ||= dense(OLD_BODY)), SBD = () => (_sb ||= dense(SUPER_BODY));
const BASKET = [[-160, -250, 1], [160, -250, 1], [126, -112, 1], [-126, -112, 1]];
const CX = 640, CS = 1.15, SLIP = { x: 640, y: 1000, s: 0.92 };
export function sCart(t, tq, D) {
  if (tq >= B[11] && tq < B[12]) champ(tq, D);
  else if (tq >= B[12] && tq < B[13]) leave(tq, D);
}
function champ(tq, D) {
  const u = tq - B[11];
  const ra = 1 - clamp(u / 0.3);
  if (ra > 0) { c.save(); c.globalAlpha *= ra; wavesToRain(tq - B[10], 1450, 1, D, 540); c.restore(); }
  road(tq, D, 1);
  const vx = vanX(tq); if (vx < 1350) van(vx, RY, 1, D, 512, { spin: tq * 16 });
  const fa = appear(tq, bt(45.5), 0.3);
  if (fa > 0.01) { c.save(); c.translate(860, RY); c.scale(1, fa); c.translate(-860, -RY); checkerFlag(860, RY, 0.85, tq, D, 560); c.restore(); }
  // calendar 2006 → 2026
  const ca = appear(tq, B[11] + 0.08, 0.3);
  if (ca > 0.01) {
    const yr = Math.round(lerp(2006, 2026, E.io2(clamp((tq - bt(44.5)) / (bt(45.75) - bt(44.5))))));
    const tick = tq > bt(44.5) && tq < bt(45.8) ? 0.06 * Math.sin(tq * 60) : 0;
    c.save(); c.translate(560, 790); c.scale(ca * (1 + 0.12 * pulse(tq, bt(45.75), 8)), ca); c.rotate(0.03 + tick);
    box(0, 0, 340, 250, 16, PAL.hi, D, 570, { w: 6.5 });
    box(0, -98, 340, 54, 10, '#e5402b', D, 571, { w: 5 });
    for (const x of [-110, 110]) line([[x, -140], [x, -108]], D, 572 + x, { w: 7 });
    txt(String(yr), 0, 34, 116, yr === 2026 ? ORGD : PAL.ink, D, 575, { font: 'KL' });
    c.restore();
  }
  // superbike (riderless: he built it)
  const sp = E.io2(clamp(u / 0.35)), sx = superX(tq);
  if (sx < 1450) {
    if (tq > L0 + 0.1) for (let j = 0; j < 4; j++) line([[sx - 240 - j * 26, RY - 60 - j * 46], [sx - 420 - j * 26, RY - 60 - j * 46]], D, 580 + j, { w: 6, t0: 10, t1: 2 });
    oldBike(sx, RY, BS, tq * (tq > L0 ? 40 : 18), D, 520, { morph: sp, body: sp <= 0 ? undefined : sp >= 1 ? SBD() : morphW(OBD(), SBD(), sp, 'o2s'), color: PAL.blue });
  }
  if (u < 0.3) { c.save(); c.globalAlpha *= 1 - u / 0.3; puff(c, 360, RY - 180, 60 + 120 * u, D, 586); c.restore(); }
  // the apprentice hops off and cheers at the line
  const hv = ioL(u / 0.4), seat = seatOf(360, RY), st = { x: 170, y: RY - 256 * 0.85, s: 0.85, flip: 1 };
  const tf = hv < 1 ? { x: lerp(seat.x, st.x, hv), y: lerp(seat.y, st.y, hv) - 170 * Math.sin(Math.PI * hv), s: lerp(0.8, 0.85, hv), flip: 1 } : { ...st, y: st.y - 60 * hopAt(tq, bt(46), 0.35) - 40 * hopAt(tq, bt(47), 0.3) };
  const pose = hv < 1 ? mixP(RIDE, P.jump(Math.sin(Math.PI * hv)), Math.min(1, hv * 2)) : mixP(P.akimbo(), P.cheer(), tq >= bt(46) ? E.outBack(clamp((tq - bt(46)) / 0.25), 1.6) : 0);
  person(c, tf, pose, { D, k: 530, face: 'grin', hair: 'cap', hairC: PAL.ink, chest: 0.8, glow: 0.9 });
  const ss = slam(tq, bt(47));
  if (ss > 0) drawSeal(c, 610, 1110, ss * 1.25, '冠军', D, 590, { r: -0.1 });
  HL('20年后，他造的摩托', tq, B[11] + 0.06, B[12] - 0.06, 320, { D, size: 98, seed: 88, color: tint('20年后，他造的摩托', '20', YEL) });
  HL('在世界赛上夺冠', tq, bt(46), B[12] - 0.06, 445, { D, size: 120, seed: 89, color: tint('在世界赛上夺冠', '夺冠', YEL) });
}
function leave(tq, D) {
  const u = tq - B[12];
  line([[-80, RY], [1160, RY]], D, 500, { w: 8 });
  const rollU = E.out3(clamp(u / 0.42)), mU = E.io2(clamp((u - 0.36) / 0.24)), sU = E.io2(clamp((tq - bt(49)) / 0.28));
  const BK = tfm(dense(BASKET, true, 3), CX, RY, CS);
  if (mU <= 0) {
    const wx = lerp(1220, CX, rollU);
    wheel(wx, RY - 74, 74, -(wx - CX) / 74, D, 600, { hub: GREYL });
  } else if (sU <= 0) {
    if (mU < 1) drawMorph(morphW(dense([[CX - 74, RY - 74, 0], [CX, RY - 148, 0], [CX + 74, RY - 74, 0], [CX, RY, 0]], true, 4), BK, mU, 'w2c'), mixHex(PAL.ink, '#cfe7f7', mU), D, 602, { w: 7 });
    else cart(CX, RY, CS, D, 604, { spin: 0 });
  } else {
    const SR = rrectPts(SLIP.x - 300 * SLIP.s, SLIP.y - 200 * SLIP.s, 600 * SLIP.s, 400 * SLIP.s, 18, 4);
    if (sU < 1) drawMorph(morphW(BK, SR, sU, 'c2s'), mixHex('#cfe7f7', PAL.hi, sU), D, 606, { w: 7 });
    const a = clamp((sU - 0.6) / 0.4);
    if (a > 0) { c.save(); c.globalAlpha *= a; slip(SLIP.x, SLIP.y, SLIP.s, D, 608, { r: 0 }); c.restore(); }
  }
  if (mU >= 1 && u < 0.75) { const v = (u - 0.6) / 0.15; if (v > 0 && v < 1) { c.save(); c.globalAlpha *= 1 - v; puff(c, CX, RY - 180, 80 + 90 * v, D, 609); c.restore(); } }
  // the supermarket boss (grey hair) pops in; stamps it
  const ba = appear(tq, bt(48.5), 0.3);
  if (ba > 0.01) {
    const pt = tq >= bt(50.5) ? E.outBack(clamp((tq - bt(50.5)) / 0.2), 1.6) : 0;
    person(c, { x: 190, y: RY - 256 * 0.9 + (1 - Math.min(1, ba)) * 90, s: 0.9, flip: 1 }, mixP(P.akimbo(), P.draw(), pt), { D, k: 610, face: 'grin', hair: 'cap', hairC: GREYL, chest: 0.8, glow: 0.9, alpha: clamp(ba * 2) });
  }
  const ss = slam(tq, bt(50.5));
  if (ss > 0) stampZhun(800, 1085, ss, D, 620, { r: -0.22 });
  HL('开超市的老板，', tq, B[12] + 0.06, B[13] - 0.06, 320, { D, size: 108, seed: 90 });
  HL('给员工放“不开心假”', tq, bt(49), B[13] - 0.06, 440, { D, size: 96, seed: 91, color: tint('给员工放“不开心假”', '不开心', YEL) });
  SUB('管理层不能不批', tq, bt(50), B[13] - 0.06, 552, { D, size: 58, seed: 92 });
}

// ------------------------------------------------------------------ B13: three people, three hair colours, one fire
const TRIO = [{ x: 220, hair: YELL, pose: () => P.wide(), k: 630 }, { x: 540, hair: PAL.ink, pose: () => P.akimbo(), k: 650 }, { x: 860, hair: GREYL, pose: () => P.stand({ face: 'happy' }), k: 670 }];
const TS = 0.86, TY = GROUND - 256 * TS, MERGE = [540, 860];
export function sThree(t, tq, D) {
  if (tq < B[13] || tq >= B[14]) return;
  const u = tq - B[13];
  if (u < 0.3) { const v = E.in2(u / 0.3); slip(lerp(SLIP.x, 980, v), lerp(SLIP.y, 420, v), SLIP.s * (1 - v), D, 608, { r: v * 0.9 }); stampZhun(lerp(800, 1060, v), lerp(1085, 520, v), 1 - v, D, 620, { r: -0.22 + v }); }
  const fly = E.io2(clamp((tq - bt(54)) / (bt(55) - bt(54))));
  const chs = [];
  TRIO.forEach((m, i) => {
    const a = appear(tq, B[13] + 0.04 + i * 0.1, 0.3);
    if (a <= 0.01) return;
    const hop = 28 * hopAt(tq, bt(53) + i * E8, 0.24);
    const R = person(c, { x: m.x, y: TY + (1 - Math.min(1, a)) * 170 - hop, s: TS, flip: i === 2 ? -1 : 1 }, m.pose(), { D, k: m.k, face: 'grin', hair: 'cap', hairC: m.hair, chest: fly > 0 ? lerp(1, 0.3, fly) : 1, glow: 1, alpha: clamp(a * 2) });
    chs.push(R.ch);
    const tw = bt(53) + i * E8, sp = pulse(tq, tw, 5);
    if (tq >= tw && sp > 0.08) twinkle(c, R.hc[0] + (i === 2 ? -78 : 78), R.hc[1] - 62, 12 + 26 * sp, D, m.k + 9, YEL);
  });
  if (fly > 0 && chs.length === 3) {
    if (fly < 1) chs.forEach((p, i) => drawFlame(c, lerp(p[0], MERGE[0], fly), lerp(p[1] + 46, MERGE[1], fly) - 130 * Math.sin(Math.PI * fly), lerp(0.53, 0.9, fly), D, 690 + i * 2, { ph: tq * 2 + i, glow: 1 }));
    else drawFlame(c, MERGE[0], MERGE[1], 1.5 * (1 + 0.12 * pulse(tq, bt(55), 7)), D, 698, { ph: tq * 2.2, glow: 1.5 });
  }
  HL('发色不一样，', tq, B[13] + 0.06, B[14] - 0.06, 320, { D, size: 112, seed: 94 });
  HL('火是同一把', tq, bt(54), B[14] - 0.06, 450, { D, size: 130, seed: 95, color: tint('火是同一把', '火', ORG) });
}

// ------------------------------------------------------------------ B14: 黄毛 ≠ dyed hair ≠ rebel ≠ player (red X on the beats)
const ICONS = [[200, '染发'], [540, '叛逆'], [880, '渣']], IY = 1010;
export function sNot(t, tq, D) {
  if (tq < B[14] || tq >= B[15] + 0.4) return;
  const u = tq - B[14];
  if (u < 0.22) drawFlame(c, MERGE[0], MERGE[1], 1.5 * (1 - E.in2(u / 0.22)), D, 698, { ph: tq * 2.2, glow: 1.2 });
  ICONS.forEach(([x, label], i) => {
    const a = appear(tq, B[14] + 0.08 + i * 0.08, 0.32);
    if (a <= 0.01) return;
    const fall = tq > B[15] ? E.in2(clamp((tq - B[15] - i * 0.04) / 0.35)) : 0;
    const ca = clamp(a), px = lerp(540, x, ca), py = lerp(860, IY, ca) + 950 * fall;
    const xt = bt(57 + i), hit = tq >= xt;
    const sh = hit ? 12 * Math.sin((tq - xt) * 50) * Math.exp(-(tq - xt) * 9) : 0;
    c.save(); c.translate(px + sh, py); c.rotate(fall * 1.4 * (i - 1)); c.scale(a, a);
    if (hit) c.globalAlpha *= lerp(1, 0.6, clamp((tq - xt) / 0.25));
    if (i === 0) dyeBottle(0, 20, 1.15, D, 700);
    else if (i === 1) spikyHead(0, 30, 1.0, D, 710, tq * 6);
    else brokenHeart(0, -10, 108, hit ? 8 + 14 * clamp((tq - xt) / 0.2) : 5, D, 720);
    txt(label, 0, 205, 88, PAL.ink, D, 730 + i, { font: 'KL' });
    c.restore();
    if (hit) redX(px, py + 20, 125, clamp((tq - xt) / 0.18), D, 740 + i * 3);
  });
  if (tq < B[15]) HL('但黄毛 ≠', tq, B[14] + 0.06, B[15] - 0.06, 330, { D, size: 140, seed: 96, color: tint('但黄毛 ≠', '黄毛', YEL) });
}

// ------------------------------------------------------------------ B15: 高富帅 on a pedestal (+ dice 命), boxed-in crowd with flickering chest flames. B16 CLIMAX: everyone ignites
const CROWD = [70, 185, 300, 780, 895, 1010], CSc = 0.55, CYc = GROUND - 256 * CSc;
const PX = 540, PW = 360, PHt = 380, PTOP = 1110;
const podTop = (tq) => lerp(GROUND + 30, PTOP, E.outBack(clamp((tq - B[15]) / 0.38), 1.4)) + (GROUND + 60 - PTOP) * E.in2(clamp((tq - B[16] - 0.1) / 0.6));
function flick(tq) { let p = 0; for (let n = 62; n < 63; n += 0.5) p = Math.max(p, pulse(tq, bt(n), 12)); for (let n = 63; n < 64; n += 0.25) p = Math.max(p, pulse(tq, bt(n), 15)); return p; }
export function sPodium(t, tq, D) {
  if (tq < B[15] || tq >= B[17]) return;
  const climax = tq >= B[16], u16 = tq - B[16];
  const yT = podTop(tq), HS = 0.78, gy = yT - 256 * HS + 4;
  c.save(); c.beginPath(); c.rect(-300, -300, 1680, GROUND + 304); c.clip();
  pedestal(PX, yT, PW, PHt, D, 760);
  const sh = climax ? E.out2(clamp(u16 / 0.15)) : 0;
  person(c, { x: 470, y: gy, s: HS, flip: 1 }, climax ? mixP(P.akimbo(), P.shout(), sh) : P.akimbo({ head: -0.15 }), { D, k: 770, face: climax ? 'shock' : 'wink', hair: 'cap', hairC: PAL.ink, hat: climax ? null : topHat });
  if (tq >= bt(61)) {
    const dv = clamp((tq - bt(61)) / 0.5), bounce = Math.abs(Math.sin(Math.PI * 2.2 * dv)) * (1 - dv) * 170;
    dice(lerp(1180, 652, E.out2(dv)), yT - 66 - bounce, 0.88, (1 - E.out2(dv)) * 9, D, 780, { str: '命' });
  }
  c.restore();
  if (climax && u16 < 0.9) { const v = u16 / 0.9; topHat(c, [470 + 260 * v, gy - 230 * HS - 700 * v + 900 * v * v], 58 * HS, 4 * v, D); }
  CROWD.forEach((x, i) => {
    const a = appear(tq, bt(62) + i * 0.04, 0.28);
    if (a <= 0.01) return;
    const fl = x < PX ? 1 : -1;
    const sqv = climax ? 1 - E.outElastic(clamp((u16 - i * 0.03) / 0.45)) : 1;
    const hop = climax ? 44 * Math.abs(Math.sin(Math.PI * (u16 / BEAT))) * clamp(u16 / 0.2) : 0;
    const chest = climax ? K(u16, [[0, 0.4], [0.12, 2.1, 'out2'], [0.6, 1.45, 'io2']]) : 0.3 + 0.32 * flick(tq);
    const pose = climax ? mixP(P.stand({ head: -0.35 }), P.cheer(), E.outBack(clamp(u16 / 0.25), 1.6)) : P.stand({ head: -0.4, face: 'meh' });
    person(c, { x, y: CYc + (1 - Math.min(1, a)) * 120 - hop, s: CSc, flip: fl }, pose, { D, k: 800 + i * 12, face: climax ? 'grin' : 'meh', square: sqv, headFill: mixHex(GREYM, PAL.hi, 1 - sqv), chest, glow: climax ? 1.4 : 0.8, alpha: clamp(a * 2) });
  });
  if (climax) {
    const m = E.io2(clamp((tq - bt(66)) / (bt(67.5) - bt(66))));
    if (m < 1) [[400, 0.02], [540, 0], [680, 0.05]].forEach(([x, d], j) => drawFlame(c, lerp(x, 540, m), GROUND + 10, 1.9 * E.outBack(clamp((u16 - d) / 0.25), 1.6) * (1 - 0.3 * m), D, 850 + j * 2, { ph: tq * 2.6 + j, glow: 1.4 }));
    if (m > 0) drawFlame(c, 540, GROUND + 10, lerp(1.4, 2.4, m), D, 860, { ph: tq * 2.4, glow: 1.5, alpha: clamp(m * 3) });
    HL('只要愿意，', tq, B[16] + 0.04, B[17] - 0.06, 320, { D, size: 116, seed: 100 });
    HL('谁都能当！', tq, bt(65), B[17] - 0.06, 465, { D, size: 156, seed: 101, color: tint('谁都能当！', '谁都能当', YEL) });
  } else {
    HL('高富帅，要看命。', tq, B[15] + 0.06, B[16] - 0.06, 320, { D, size: 106, seed: 98 });
    HL('黄毛呢？', tq, bt(62), B[16] - 0.06, 450, { D, size: 136, seed: 99, color: tint('黄毛呢？', '黄毛', YEL) });
  }
}
export const END16 = { x: 540, y: GROUND + 10, s: 2.4 };
