// 黄毛理论 · scenes B17–B24. The merged flame becomes a palm that pushes out “不” → the top stroke of 不 becomes a match → it burns “我不配” into “我试试”
// → the two 试 become two doors (one was opened: he fell and laughs; one never was: he grows old) → the flame burns that door open → everything shrinks into a phone
// → the viewer's hair lights up → his flame becomes an arrow to the comment box → every flame gathers into the title.
import { PAL, hs, clamp, lerp, E, K, rrectPts, fillPoly, boil, inkStroke } from './engine.js';
import { layout } from './text.js';
import { W, H, c, B, bt, BEAT, E8, pulse, beatPulse, appear, slam, HL, SUB, tint, morphW, drawMorph, line, letters, card } from './core.js';
import { YEL, YELL, ORG, GINK, GREYL, GREYM, G0, P, mixP, person, solveP, drawFlame, flamePts } from './people.js';
import { RED, WOODD, dense, tfm, box, disc, txt, heartD, bubble, bubblePts, PALM, matchstick, matchbox, progressBar, door, phoneFrame } from './props.js';
import { puff, twinkle, speedLines } from './fx.js';
import { mixHex, drawSweat } from './shapes.js';
import { drawBackdrop } from './fx2.js';
import { GROUND } from './s1.js';
import { END16 } from './s2.js';

const withS = (x, y, s, fn, r = 0) => { if (s <= 0.004) return; c.save(); c.translate(x, y); if (r) c.rotate(r); c.scale(s, s); c.translate(-x, -y); fn(); c.restore(); };
const withA = (a, fn) => { if (a <= 0.004) return; c.save(); c.globalAlpha *= Math.min(1, a); fn(); c.restore(); };
const arc = (a, b, u, h) => [lerp(a[0], b[0], u), lerp(a[1], b[1], u) - h * Math.sin(Math.PI * u)];
function lowY(pose) { const J = solveP(pose); let m = J.C[1] + G0.headR; for (const l of J.legs) m = Math.max(m, l.K[1], l.A[1], l.T[1]); for (const a of J.arms) m = Math.max(m, a.H[1]); return m; }
const onGround = (pose, s) => GROUND - lowY(pose) * s;
const headOf = (pose, tf) => { const J = solveP(pose); return [tf.x + J.C[0] * tf.s * (tf.flip ?? 1), tf.y + J.C[1] * tf.s]; };
const chestAt = (pose, tf) => { const J = solveP(pose); return [tf.x + lerp(J.N[0], J.H[0], 0.4) * tf.s * (tf.flip ?? 1), tf.y + lerp(J.N[1], J.H[1], 0.4) * tf.s]; };

// ------------------------------------------------------------------ B17: the flame opens into a palm; the palm pushes out a big red “不” and blows the invitation away
const PC = { x: 540, y: 1150, s: 1.45 };
let _pd = null, _f17 = null;
const palmD = () => (_pd ||= dense(PALM, true, 3));
const palmAt = (s = PC.s) => tfm(palmD(), PC.x, PC.y, s);
const f17 = () => (_f17 ||= flamePts(END16.x, END16.y, 150 * END16.s, 200 * END16.s, B[17] * 2.4, 0, 1, 0));
const NO = { x: 540, y: 1010, size: 410 };
const noS = (tq) => slam(tq, bt(69)) * (1 + 0.07 * beatPulse(tq, [bt(70), bt(71)], 10));
const palmS = (tq) => PC.s * (1 + 0.1 * pulse(tq, bt(69), 8) + 0.035 * beatPulse(tq, [bt(70), bt(71)], 10));
function drawNo(D, s, a = 1) {
  if (s <= 0.01 || a <= 0.01) return;
  const o = { font: 'KL', size: NO.size, x: NO.x, y: NO.y, D, seed: 1701, alpha: a, anim: () => ({ s }), shadow: null };
  letters(c, '不', { ...o, fill: PAL.hi, ink: PAL.hi, inkW: 50 });   // white sticker halo
  letters(c, '不', { ...o, fill: RED, ink: PAL.ink, inkW: 14 });
}
function palm(tq, D) {
  const s = palmS(tq);
  drawMorph(palmAt(s), YEL, D, 1710, { w: 8 });
  line(tfm([[-58, 40], [-10, 64], [44, 52]], PC.x, PC.y, s), D, 1712, { w: 5 });
  line(tfm([[-40, 112], [10, 124], [52, 106]], PC.x, PC.y, s), D, 1713, { w: 4.5 });
}
export function sPalm(t, tq, D) {
  if (tq < B[17] || tq >= B[18]) return;
  const u = tq - B[17], mu = E.io2(clamp(u / 0.3));
  if (mu < 1) drawMorph(morphW(f17(), palmAt(), mu, 'f2p'), YEL, D, 1710, { w: 8 });
  else palm(tq, D);
  const ba = appear(tq, B[17] + 0.1, 0.3), blow = clamp((tq - bt(69)) / 0.3);
  if (ba > 0.01 && blow < 1) {
    const bx = 715 + 380 * E.in2(blow), by = 650 - 170 * blow;
    withS(bx, by, 1 - 0.4 * blow, () => bubble(bx, by, 225, 84, bx + 165, by + 118, ba, D, 1720, { str: '今晚喝一杯？', size: 58 }), 0.7 * blow);
  }
  if (blow > 0 && blow < 1) withA(1 - blow, () => puff(c, 715, 650, 60 + 110 * blow, D, 1725));
  if (tq >= bt(69)) {
    const v = (tq - bt(69)) / 0.32;
    if (v < 1) withA(1 - v, () => speedLines(c, NO.x, NO.y, 250 + 140 * v, 400 + 220 * v, 16, D, 1730, { w: 8 }));
    drawNo(D, noS(tq));
  }
  HL('① 不想去的局，', tq, B[17] + 0.04, B[18] - 0.06, 320, { D, size: 100, seed: 170 });
  HL('说“不”', tq, bt(69), B[18] - 0.06, 455, { D, size: 140, seed: 171, color: tint('说“不”', '不', RED) });
}

// ------------------------------------------------------------------ B18: 不's top stroke slides out as a match; the palm folds into a matchbox; strike → light day one
const MB = { x: 700, y: 1310, s: 1.25 };
let _mbr = null; const mbRect = () => (_mbr ||= rrectPts(MB.x - 150 * MB.s, MB.y - 85 * MB.s, 300 * MB.s, 170 * MB.s, 14, 4));
const PB = { x: 540, y: 690, w: 840, h: 104, seg: 7 };
const FW = (PB.w - 12) / PB.seg, SEG1 = PB.x - PB.w / 2 + 6 + FW / 2;
const MS = 1.27, STRY = MB.y - 64 * MB.s, PBL = PB.y + PB.h / 2 + 100;
// match head path (B18 → B19): x, y, head direction
const HX = [[B[18], 712], [B[18] + 0.2, 760, 'out2'], [bt(72.72), 545, 'io2'], [bt(73), 868, 'in2'], [bt(73.5), 720, 'out2'], [bt(74.85), SEG1, 'io2'], [bt(76), SEG1 + 34, 'io2'],
  [bt(76.35), 620, 'io2'], [bt(76.6), 930, 'io2'], [bt(76.9), 905, 'io2'], [bt(77.2), 935, 'out2'], [bt(78), 1250, 'in2']];
const HY = [[B[18], 858], [B[18] + 0.2, 800, 'out2'], [bt(72.72), STRY, 'io2'], [bt(73), STRY, 'lin'], [bt(73.5), 1000, 'out2'], [bt(74.85), PBL, 'io2'], [bt(76), PBL + 14, 'io2'],
  [bt(76.35), 790, 'io2'], [bt(76.6), 820, 'io2'], [bt(76.9), 1100, 'io2'], [bt(77.2), 1120, 'out2'], [bt(78), 1380, 'in2']];
const HR = [[B[18], 0], [B[18] + 0.2, -0.25, 'out2'], [bt(72.72), 0.5, 'io2'], [bt(73), 0.5], [bt(73.5), -1.25, 'out2'], [bt(74.85), -Math.PI / 2, 'io2'], [bt(76), -Math.PI / 2 + 0.15, 'io2'],
  [bt(76.35), 0, 'io2'], [bt(76.6), -0.3, 'io2'], [bt(76.9), -Math.PI / 2 - 0.55, 'io2'], [bt(77.2), -Math.PI / 2 - 0.4, 'out2'], [bt(78), -0.3, 'in2']];
function drawMatch(tq, D) {
  const hx = K(tq, HX), hy = K(tq, HY), r = K(tq, HR);
  matchstick(hx - 16 * MS * Math.cos(r), hy - 16 * MS * Math.sin(r), r, MS, D, 1750);
  if (tq >= bt(73)) drawFlame(c, hx + 8 * Math.cos(r), hy + 8 * Math.sin(r) + 6, 0.5 * E.outBack(clamp((tq - bt(73)) / 0.18), 2.4), D, 1752, { ph: tq * 3, glow: 0.9 });
}
function bar(tq, D, s = 1) {
  const fu = tq < bt(75) ? 0 : E.outBack(clamp((tq - bt(75)) / 0.22), 2) + 0.18 * clamp((tq - bt(75.4)) / 1.2);
  withS(PB.x, PB.y, s, () => {
    progressBar(PB.x, PB.y, PB.w, PB.h, fu, D, 1760, { seg: PB.seg });
    if (fu <= 0) return;
    drawFlame(c, PB.x - PB.w / 2 + 6 + FW * fu - 12, PB.y - PB.h / 2 + 12, 0.36 * clamp(fu), D, 1768, { ph: tq * 3, glow: 0.6 });
    letters(c, '今天', { font: 'KL', size: 46, x: SEG1, y: PB.y + 2, fill: PAL.ink, ink: null, D, seed: 1769, anim: () => ({ s: E.outBack(clamp((tq - bt(75)) / 0.25), 2.4) }) });
  });
}
export function sMatch(t, tq, D) {
  if (tq < B[18] || tq >= B[19]) return;
  const u = tq - B[18], nu = clamp(u / 0.2), mu = E.io2(clamp(u / 0.3));
  if (nu < 1) drawNo(D, 1 - 0.35 * E.in2(nu), 1 - E.in2(nu));
  if (mu < 1) drawMorph(morphW(palmAt(), mbRect(), mu, 'p2m'), mixHex(YEL, '#e8b04a', mu), D, 1740, { w: 7 });
  else matchbox(MB.x, MB.y, MB.s, D, 1740);
  bar(tq, D, appear(tq, B[18] + 0.12, 0.3));
  drawMatch(tq, D);
  const sv = (tq - bt(73)) / 0.38;
  if (sv >= 0 && sv < 1) {
    for (let i = 0; i < 5; i++) { const a = -0.4 - i * 0.6, rr = 40 + 100 * E.out2(sv); twinkle(c, 868 + Math.cos(a) * rr, STRY + Math.sin(a) * rr, 18 * (1 - sv), D, 1780 + i, YEL); }
    withS(860, 1105, E.outBack(clamp(sv * 3), 2.5) * (1 - E.in2(clamp((sv - 0.6) / 0.4))), () => letters(c, '嚓！', { font: 'KL', size: 72, x: 860, y: 1105, fill: ORG, ink: PAL.ink, inkW: 5, D, seed: 1785 }), -0.15);
  }
  HL('② 想做的事，', tq, B[18] + 0.04, B[19] - 0.06, 320, { D, size: 100, seed: 180 });
  HL('今天就开个头', tq, bt(73), B[19] - 0.06, 450, { D, size: 124, seed: 181, color: tint('今天就开个头', '今天', YEL) });
}

// ------------------------------------------------------------------ B19: the match sets “我不配” alight; 不配 burns away right → left; “试试” pops in
const WB = { x: 540, y: 1010, size: 230 };
let _xl = null;
const XL = () => (_xl ??= (() => { const L = layout('我不配', 'KL', WB.size); return WB.x - (L.x1 - L.x0) / 2; })());
const BURN0 = bt(77), BURN1 = bt(78.3);
function burnX(tq) {
  const L = layout('我不配', 'KL', WB.size), ax = XL() - L.x0;
  return lerp(ax + L.x1 + 16, ax + L.chars[1].x - 4, E.io2(clamp((tq - BURN0) / (BURN1 - BURN0))));
}
const wav = (y, tq) => 16 * Math.sin(y * 0.045 + tq * 7) + 9 * Math.sin(y * 0.11 - tq * 11);
export function sBurn(t, tq, D) {
  if (tq < B[19] || tq >= B[20]) return;
  const u = tq - B[19], xv = E.in2(clamp(u / 0.22));
  if (xv < 1) { bar(tq, D, 1 - xv); matchbox(MB.x, MB.y + 700 * xv, MB.s, D, 1740); }
  const L = layout('我不配', 'KL', WB.size), bh = L.y1 - L.y0, y0 = WB.y - bh / 2 - 34, y1 = WB.y + bh / 2 + 34;
  if (tq < bt(78.5)) {
    const X = burnX(tq), burning = tq >= BURN0;
    c.save();
    if (burning) { c.beginPath(); c.moveTo(-300, y0 - 600); for (let y = y0; y <= y1; y += 8) c.lineTo(X + wav(y, tq), y); c.lineTo(-300, y1 + 600); c.closePath(); c.clip(); }
    letters(c, '我不配', { font: 'KL', size: WB.size, x: XL(), y: WB.y, align: 'left', fill: GREYL, ink: PAL.ink, inkW: 10, shadow: GREYM, D, seed: 1901, anim: (i) => ({ s: appear(tq, B[19] + 0.04 + i * 0.07, 0.28) }) });
    c.restore();
    if (burning) {
      const edge = []; for (let y = y0; y <= y1; y += 8) edge.push([X + wav(y, tq), y]);
      inkStroke(c, edge, { seed: D * 13 + 1910, w: 22, amp: 2, color: '#3b2516', t0: 6, t1: 6, dense: true });
      inkStroke(c, edge.map(([x, y]) => [x + 12, y]), { seed: D * 13 + 1911, w: 9, amp: 2, color: ORG, t0: 4, t1: 4, dense: true });
      for (let k = 0; k < 5; k++) { const y = lerp(y0 + 40, y1 - 6, k / 4); drawFlame(c, X + wav(y, tq) + 10, y + 16, 0.34 + 0.08 * Math.sin(tq * 9 + k), D, 1920 + k * 2, { ph: tq * 3 + k, glow: 0.5 }); }
      for (let i = 0; i < 12; i++) {
        const age = tq - BURN0 - hs(i, 3) * 0.6; if (age < 0) continue;
        const life = (age * 1.4) % 1;
        disc(X + 30 + hs(i, 4) * 150 + 26 * Math.sin(tq * 3 + i), y1 - 40 - life * 460, 8 * (1 - life), i % 3 ? ORG : '#5a3d2e', D, 1930 + i, { w: 0 });
      }
    }
  } else {
    const v = (tq - bt(78.5)) / 0.4;
    if (v < 1) withA(1 - v, () => puff(c, burnX(tq) + 40, WB.y, 80 + 120 * v, D, 1940, { fill: GREYL }));
    const bp = 1 + 0.07 * pulse(tq, bt(79), 9);
    letters(c, '我试试', { font: 'KL', size: WB.size, x: XL(), y: WB.y, align: 'left', fill: PAL.hi, ink: PAL.ink, inkW: 10, shadow: PAL.ink, D, seed: 1901,
      anim: (i) => i === 0 ? { s: bp, fill: mixHex(GREYL, PAL.hi, clamp((tq - bt(78.5)) / 0.2)) } : { s: appear(tq, bt(78.5) + (i - 1) * 0.06, 0.3, 2.6) * bp, fill: YEL } });
    const tv = (tq - bt(78.5)) / 0.45;
    if (tv < 1) for (let i = 0; i < 4; i++) twinkle(c, [600, 930, 640, 900][i], [860, 880, 1160, 1150][i], 30 * Math.sin(Math.PI * tv), D, 1945 + i, YEL);
  }
  if (tq < bt(78)) drawMatch(tq, D);
  HL('③ 把“我不配”', tq, B[19] + 0.04, B[20] - 0.06, 320, { D, size: 100, seed: 190, color: tint('③ 把“我不配”', '我不配', GREYL) });
  HL('改成“我试试”', tq, bt(78.5), B[20] - 0.06, 450, { D, size: 124, seed: 191, color: tint('改成“我试试”', '我试', YEL) });
}

// ------------------------------------------------------------------ B20–B21: the two 试 become two doors. Left: opened (he fell, he laughs). Right: never opened (he grows old, looks back)
const DL = { x: 262, yb: GROUND, w: 256, h: 540 }, DR = { x: 818, yb: GROUND, w: 256, h: 540 }, DOORS = [DL, DR];
const FS = 0.7, OS = 0.8, OX = 612;
const ageU = (tq) => [81, 82, 83].reduce((a, n) => a + E.out2(clamp((tq - bt(n)) / 0.16)) / 3, 0);
const AGES = ['20岁', '40岁', '60岁', '80岁'];
const ageIdx = (tq) => (tq >= bt(86) ? 0 : [81, 82, 83].filter((n) => tq >= bt(n)).length);
const burnU = (tq) => E.out2(clamp((tq - bt(85)) / 0.55));
function doorEntry(tq, D) {
  const mu = E.io2(clamp((tq - B[20]) / 0.3));
  if (mu >= 1) return 1;
  const L2 = layout('我试试', 'KL', WB.size), ax = XL() - L2.x0, ay = WB.y - (L2.y0 + (L2.y1 - L2.y0) / 2);
  [1, 2].forEach((i, j) => {
    const ch = L2.chars[i], Dd = DOORS[j];
    box(lerp(ax + ch.cx, Dd.x, mu), lerp(ay + ch.cy, Dd.yb - Dd.h / 2, mu), lerp(200, Dd.w + 30, mu), lerp(200, Dd.h + 26, mu), lerp(34, 6, mu), mixHex(YEL, WOODD, mu), D, 2000 + j * 4, { w: 6.5 });
  });
  return mu;
}
function doors(tq, D) {
  door(DL.x, DL.yb, DL.w, DL.h, E.out2(clamp((tq - (B[20] + 0.3)) / 0.25)), D, 2010, {});
  const bu = burnU(tq);
  door(DR.x, DR.yb, DR.w, DR.h, bu > 0 ? 0.03 : 0, D, 2020, { burn: bu > 0 ? bu : undefined, web: ageU(tq) > 0.5 && bu < 0.4 });
  if (bu <= 0) return;
  const cy = DR.yb - DR.h / 2;
  withA(0.5 * bu, () => fillPoly(c, boil([[DR.x - DR.w / 2, DR.yb], [DR.x + DR.w / 2, DR.yb], [DR.x + DR.w / 2 + 110, DR.yb + 80], [DR.x - DR.w / 2 - 110, DR.yb + 80]], D * 13 + 2025, 1, 50), YELL));
  if (bu < 1) {
    const R = bu * DR.w * 1.1;
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + 0.4, px = DR.x + Math.cos(a) * R, py = cy + Math.sin(a) * R;
      if (Math.abs(px - DR.x) < DR.w / 2 - 8 && Math.abs(py - cy) < DR.h / 2 - 8) drawFlame(c, px, py, 0.3 + 0.12 * (1 - bu), D, 2030 + i * 2, { ph: tq * 3 + i, rot: a + Math.PI / 2, glow: 0 });
    }
  }
}
function goer(tq, D, k) {
  const a = appear(tq, bt(80.75), 0.3);
  if (a <= 0.01) return;
  const up = clamp((tq - bt(85.4)) / 0.3);
  const pose = up > 0 ? mixP(P.fallen(), P.cheer(), clamp(E.outBack(up, 1.5))) : P.fallen();
  const hop = tq > bt(86) ? 38 * Math.abs(Math.sin(Math.PI * (tq - bt(86)) / BEAT)) : 0;
  const jig = up > 0 ? 0 : 3 * Math.sin(tq * 38);
  person(c, { x: DL.x + 70 + jig, y: onGround(pose, FS) - hop - (1 - Math.min(1, a)) * 140, s: FS, flip: 1 }, pose, { D, k, face: 'grin', hair: 'cap', hairC: YEL, tuft: 0.75, alpha: clamp(a * 2) });
  if (up <= 0 && tq > bt(81.3)) withS(215, GROUND - 300, 1, () => letters(c, '哈哈', { font: 'KL', size: 66, x: 215, y: GROUND - 300, fill: PAL.hi, ink: PAL.ink, inkW: 4, D, seed: k + 50, anim: (i) => ({ s: appear(tq, bt(81.3) + i * 0.08, 0.25), dy: -7 * Math.abs(Math.sin(tq * 14 + i)) }) }), 0.1 * Math.sin(tq * 9));
  const dv = (tq - bt(81)) / 0.4;
  if (dv > 0 && dv < 1) withA(1 - dv, () => puff(c, DL.x + 70, GROUND - 14, 40 + 70 * dv, D, k + 60));
}
function waiter(tq, D, k) {
  const a = appear(tq, B[20] + 0.32, 0.3);
  if (a <= 0.01) return;
  const au = ageU(tq), yu = tq >= bt(86) ? E.outBack(clamp((tq - bt(86)) / 0.25), 1.8) : 0;
  const run0 = bt(86.45), runU = clamp((tq - run0) / (bt(87.8) - run0));
  if (runU >= 1) return;
  const turned = tq >= bt(83) + 0.1 && tq < bt(84);
  const old = mixP(P.stand({ face: 'meh' }), P.old(), au);
  let pose = old;
  if (yu > 0) pose = mixP(old, P.akimbo(), clamp(yu));
  if (runU > 0) pose = mixP(P.akimbo(), P.run((tq - run0) * 2.6), clamp(runU * 5));
  const sOld = lerp(OS, 0.74, au), s = (yu > 0 ? lerp(0.74, OS, clamp(yu)) : sOld) * (1 - 0.55 * E.in2(runU));
  const fl = turned ? -1 : 1;
  const tf = { x: lerp(OX, DR.x, E.in2(runU)), y: onGround(pose, s) - 70 * runU + (1 - Math.min(1, a)) * 220, s, flip: fl };
  const chest = tq < bt(84) ? 0 : tq < bt(86) ? K(tq, [[bt(84), 0], [bt(84) + 0.16, 1.5, 'out2'], [bt(84.6), 1.2, 'io2'], [bt(85), 0.5, 'in2']]) : lerp(0.5, 1, clamp(yu));
  const face = turned ? 'meh' : tq >= bt(86) ? 'grin' : tq >= bt(84) ? 'shock' : 'meh';
  const R = person(c, tf, pose, { D, k, face, hair: 'cap', hairC: tq < bt(86) ? mixHex(PAL.ink, GREYL, au) : YEL, tuft: 0.9 * yu, chest, glow: 1.2, alpha: clamp(a * 2) * (1 - E.in2(runU)) });
  // the cane (appears with age, drops when he is young again)
  const fall = clamp((tq - bt(86)) / 0.45);
  if (au > 0.4 && fall < 1) {
    const tfo = { x: OX, y: onGround(old, sOld), s: sOld, flip: tq >= bt(86) ? 1 : fl }, J = solveP(old);
    const hand = [tfo.x + J.arms[1].H[0] * sOld * tfo.flip, tfo.y + J.arms[1].H[1] * sOld], f2 = tfo.flip;
    const top = [hand[0], hand[1] - 14], bot = [hand[0] + 10 * f2, GROUND], ang = fall * 1.4 * f2;
    const rot = (p) => [bot[0] + (p[0] - bot[0]) * Math.cos(ang) - (p[1] - bot[1]) * Math.sin(ang), bot[1] + (p[0] - bot[0]) * Math.sin(ang) + (p[1] - bot[1]) * Math.cos(ang)];
    withA(clamp((au - 0.4) * 4) * (1 - fall), () => {
      line([top, bot].map(rot), D, k + 70, { w: 9, color: WOODD });
      line([top, [top[0] + 20 * f2, top[1] - 24], [top[0] + 40 * f2, top[1] - 6]].map(rot), D, k + 71, { w: 9, color: WOODD });
    });
  }
  if (turned) drawSweat(c, R.hc[0] - fl * R.R * 0.95, R.hc[1] - R.R * 0.5 + 30 * (((tq - bt(83)) * 2) % 1), 1.1, D, k + 80);
  // age tag
  if (tq < run0) {
    const idx = ageIdx(tq), tc = tq >= bt(86) ? bt(86) : idx === 0 ? B[20] + 0.36 : bt([81, 82, 83][idx - 1]);
    const ts = appear(tq, tc, 0.22, 2.6), tx = R.hc[0], ty = R.hc[1] - R.R - 74;
    withS(tx, ty, ts, () => { card(tx, ty, 156, 70, 24, idx === 3 ? GREYL : PAL.hi, D, k + 90); txt(AGES[idx], tx, ty + 2, 46, PAL.ink, D, k + 91, { font: 'KL' }); });
  }
  // the flame leaps from his chest to the door
  const lv = clamp((tq - bt(84.6)) / (bt(85) - bt(84.6)));
  if (lv > 0 && lv < 1) { const p = arc(chestAt(pose, tf), [DR.x, DR.yb - DR.h / 2], E.io2(lv), 120); drawFlame(c, p[0], p[1], 0.45 + 0.3 * lv, D, k + 95, { ph: tq * 3, glow: 1 }); }
}
function doorScene(tq, D) { // also used (shrunk) inside the phone in B22
  if (doorEntry(tq, D) >= 1) doors(tq, D);
  goer(tq, D, 2100);
  waiter(tq, D, 2200);
}
export function sDoors(t, tq, D) {
  if (tq < B[20] || tq >= B[22]) return;
  if (tq < B[20] + 0.22) letters(c, '我试试', { font: 'KL', size: WB.size, x: XL(), y: WB.y, align: 'left', fill: PAL.hi, ink: PAL.ink, inkW: 10, shadow: PAL.ink, D, seed: 1901, anim: (i) => (i === 0 ? { s: 1 - E.in2(clamp((tq - B[20]) / 0.2)) } : { s: 0 }) });
  doorScene(tq, D);
  if (tq < B[21]) {
    HL('年轻时没去做，', tq, B[20] + 0.04, B[21] - 0.06, 320, { D, size: 104, seed: 200 });
    HL('老了肯定后悔', tq, bt(81), B[21] - 0.06, 440, { D, size: 120, seed: 201 });
    SUB('研究发现：时间越久，人越后悔“没做”的事', tq, bt(81.5), B[21] - 0.06, 556, { D, size: 42, seed: 202 });
    SUB('（Gilovich & Medvec, 1995）', tq, bt(82), B[21] - 0.06, 608, { D, size: 32, seed: 203, fill: GINK });
  } else {
    HL('做了，就算失败，', tq, B[21] + 0.04, B[22] - 0.06, 320, { D, size: 104, seed: 210 });
    HL('也不会后悔', tq, bt(85), B[22] - 0.06, 440, { D, size: 124, seed: 211 });
    SUB('—— 修车学徒出身的冠军老板', tq, bt(86), B[22] - 0.06, 556, { D, size: 46, seed: 212 });
  }
}

// ------------------------------------------------------------------ B22: pull back — it was all on a phone screen; the viewer next to it lights up
const PHN = { x: 380, y: 1000, z: 0.4 }, VW = { x: 835, s: 0.86 };
function phoneT(tq) {
  const zu = E.io3(clamp((tq - B[22]) / 0.42)), ex = E.in2(clamp((tq - B[23]) / 0.3));
  return { zu, z: lerp(1, PHN.z, zu) * (1 - 0.5 * ex), x: lerp(540, PHN.x, zu) - 760 * ex, y: lerp(960, PHN.y, zu) };
}
function phoneUI(tq, D) { // local full-frame coords: like / comment column + progress line
  const lk = tq >= bt(90);
  withS(985, 1090, 1 + 0.35 * pulse(tq, bt(90), 7), () => heartD(985, 1090, 56, D, 2260, { fill: lk ? RED : PAL.hi }));
  drawMorph(bubblePts(985, 1250, 56, 46, 950, 1305), PAL.hi, D, 2262, { w: 7 });
  for (let i = -1; i <= 1; i++) disc(985 + i * 22, 1250, 6, PAL.ink, D, 2263 + i, { w: 0 });
  line([[60, 1830], [1020, 1830]], D, 2266, { w: 10, color: GREYM });
  line([[60, 1830], [lerp(560, 760, clamp((tq - B[22]) / (B[23] - B[22]))), 1830]], D, 2267, { w: 12, color: YEL });
}
const vPose = (lu) => (lu > 0 ? mixP(P.stand({ head: 0.3 }), P.cheer(), clamp(lu)) : P.stand({ head: 0.3, face: 'meh' }));
const VTF0 = () => ({ x: VW.x, y: onGround(P.stand({ head: 0.3 }), VW.s), s: VW.s, flip: -1 });
function viewer(tq, D) {
  const a = appear(tq, B[22] + 0.28, 0.3);
  if (a <= 0.01) return;
  const lu = tq >= bt(90) ? E.outBack(clamp((tq - bt(90)) / 0.25), 2) : 0;
  const ex = clamp((tq - (B[23] + 0.12)) / 0.45);
  let pose = vPose(lu);
  if (ex > 0) pose = mixP(pose, P.run((tq - B[23]) * 2.6), clamp(ex * 4));
  const tf = { x: VW.x + 560 * E.in2(ex), y: onGround(pose, VW.s) + (1 - Math.min(1, a)) * 260, s: VW.s, flip: ex > 0 ? 1 : -1 };
  const R = person(c, tf, pose, { D, k: 2280, face: lu > 0 ? 'grin' : 'meh', hair: 'cap', hairC: lu > 0 ? YEL : PAL.ink, tuft: tq >= B[23] ? 0 : 0.95 * lu, chest: lu, glow: 1.2, alpha: clamp(a * 2) });
  const v = (tq - bt(90)) / 0.42;
  if (v >= 0 && v < 1) {
    withA(1 - v, () => puff(c, R.hc[0], R.hc[1] - R.R - 40, 44 + 90 * v, D, 2290));
    for (let i = 0; i < 4; i++) { const ang = -Math.PI / 2 + (i - 1.5) * 0.7; twinkle(c, R.hc[0] + Math.cos(ang) * (90 + 70 * v), R.hc[1] - R.R + Math.sin(ang) * (90 + 70 * v), 22 * (1 - v), D, 2292 + i, YEL); }
  }
}
export function sPhone(t, tq, D) {
  if (tq < B[22] || tq >= B[23] + 0.3) return;
  const T = phoneT(tq), sw = W * T.z, sh = H * T.z;
  c.save();
  c.beginPath(); c.rect(T.x - sw / 2, T.y - sh / 2, sw, sh); c.clip();
  c.translate(T.x, T.y); c.scale(T.z, T.z); c.translate(-540, -960);
  withA(clamp(T.zu * 4), () => { c.fillStyle = '#f1e7cf'; c.fillRect(0, 0, W, H); drawBackdrop(c, { x: 760, y: 1080, rx: 380, ry: 420, n: 2, color: '#ffe38a', a: 1 }, D, 2250); });
  doorScene(tq, D);
  withA(clamp((T.zu - 0.5) * 3), () => phoneUI(tq, D));
  c.restore();
  phoneFrame(T.x, T.y, sw, sh, D, 2270, 1);
  viewer(tq, D);
  // a spark leaps out of the screen onto the viewer's head
  const sv = clamp((tq - bt(89.2)) / (bt(90) - bt(89.2)));
  if (sv > 0 && sv < 1) {
    const from = [T.x + (DR.x - 540) * T.z, T.y + (DR.yb - DR.h / 2 - 960) * T.z], hd = headOf(P.stand({ head: 0.3 }), VTF0());
    const p = arc(from, [hd[0], hd[1] - 70], E.io2(sv), 260);
    drawFlame(c, p[0], p[1], 0.3 + 0.1 * Math.sin(Math.PI * sv), D, 2296, { ph: tq * 3, glow: 0.9 });
  }
  if (tq < B[23]) {
    HL('你心里那撮黄毛，', tq, B[22] + 0.04, B[23] - 0.06, 320, { D, size: 100, seed: 220, color: tint('你心里那撮黄毛，', '黄毛', YEL) });
    HL('该染回来了', tq, bt(90), B[23] - 0.06, 450, { D, size: 130, seed: 221, color: tint('该染回来了', '染回来', YEL) });
  }
}

// ------------------------------------------------------------------ B23: his flame leaps off and becomes a fat arrow → the comment box → “@TA”
const ARROW = [[-26, -60, 1], [26, -60, 1], [26, 6, 1], [62, 6, 1], [0, 70, 1], [-62, 6, 1], [-26, 6, 1]];
const AR = { x: 540, y: 860, s: 3.0 };
let _ad = null, _af = null;
const arrowAt = () => (_ad ||= tfm(dense(ARROW, true, 3), AR.x, AR.y, AR.s));
const flameAt = () => (_af ||= flamePts(AR.x, AR.y + 215, 300, 400, B[23] * 3, 0, 1, 0));
const CB = { x: 540, y: 1330 };
export function sArrow(t, tq, D) {
  if (tq < B[23] || tq >= B[24]) return;
  const u = tq - B[23];
  const fv = E.io2(clamp(u / 0.3)), mv = E.io2(clamp((u - 0.3) / 0.25)), bv = E.in2(clamp((tq - bt(95.5)) / (B[24] - bt(95.5))));
  const bob = 30 * beatPulse(tq, [bt(93), bt(94), bt(95)], 7);
  if (mv <= 0) {
    const hd = headOf(vPose(1), VTF0()), p = arc([hd[0], hd[1] - 60], [AR.x, AR.y + 215], fv, 170);
    drawFlame(c, p[0], p[1], lerp(0.6, 2, fv), D, 2300, { ph: B[23] * 3, glow: 1 });
  } else if (bv <= 0) {
    drawMorph(morphW(flameAt(), arrowAt(), mv, 'f2a').map(([x, y]) => [x, y + bob]), YEL, D, 2302, { w: 8 });
  } else {
    const f = 1 - 0.75 * bv;
    withA(1 - E.in2(clamp((bv - 0.7) / 0.3)), () => drawMorph(morphW(arrowAt(), flameAt(), bv, 'a2f').map(([x, y]) => [540 + (x - 540) * f, 880 + (y - 880) * f]), YEL, D, 2302, { w: 8 }));
  }
  const ca = appear(tq, B[23] + 0.15, 0.32) * (1 - E.in2(bv));
  withS(CB.x, CB.y, ca, () => {
    card(CB.x, CB.y, 860, 170, 44, PAL.hi, D, 2310);
    card(255, CB.y - 108, 200, 74, 26, YEL, D, 2312);
    txt('评论区', 255, CB.y - 106, 46, PAL.ink, D, 2313, { font: 'KL' });
    disc(185, CB.y, 48, YELL, D, 2314, { w: 5 });
    drawFlame(c, 185, CB.y + 28, 0.32, D, 2315, { ph: tq * 3, lw: 3 });
    if (tq < bt(94)) txt('说点什么…', 256, CB.y + 2, 50, GREYM, D, 2316, { align: 'left' });
    else {
      const at = letters(c, '@TA', { font: 'MK', size: 118, x: 256, y: CB.y, align: 'left', fill: PAL.ink, ink: PAL.ink, inkW: 4, D, seed: 2317,
        anim: (i) => (i === 0 ? { s: slam(tq, bt(94)), fill: YEL } : { s: appear(tq, bt(94.5) + (i - 1) * E8, 0.2, 2.6) }) });
      const cx = tq < bt(94.5) ? at.x0 + 130 : tq < bt(95) ? at.x0 + 210 : at.x1 + 22;
      if (Math.floor((tq - bt(94)) * 3.8) % 2 === 0) line([[cx, CB.y - 46], [cx, CB.y + 46]], D, 2319, { w: 5, color: GINK });
    }
  });
  const tv = (tq - bt(95)) / 0.45;
  if (tv > 0 && tv < 1 && ca > 0.5) for (let i = 0; i < 4; i++) twinkle(c, [230, 380, 560, 640][i], [1220, 1215, 1250, 1410][i], 28 * Math.sin(Math.PI * tv), D, 2320 + i, YEL);
  HL('你身边最“黄毛”的人', tq, B[23] + 0.04, B[24] - 0.06, 320, { D, size: 88, seed: 230, color: tint('你身边最“黄毛”的人', '黄毛', YEL) });
  HL('是谁？', tq, bt(93), B[24] - 0.06, 470, { D, size: 160, seed: 231 });
}

// ------------------------------------------------------------------ B24: every flame gathers into the title; a row of people, every hair colour, all lit inside
const SRC = [[-90, 260], [1170, 380], [-120, 1250], [1200, 1450], [260, 2040], [820, 2060], [540, -120], [1180, 860]];
const TT = { x: 540, y: 860 };
const ROW = [[160, PAL.ink], [350, GREYL], [540, YELL], [730, '#8a5a3b'], [920, PAL.ink]];
export function sEnd(t, tq, D) {
  if (tq < bt(95.5)) return;
  const g0 = bt(95.5), g1 = B[24];
  if (tq < g1 + 0.05) SRC.forEach(([x, y], i) => {
    const v = E.in2(clamp((tq - g0 - i * 0.012) / (g1 - g0 - 0.06)));
    if (v > 0 && v < 1) drawFlame(c, lerp(x, TT.x, v), lerp(y, TT.y + 40, v), 0.8 * (1 - 0.6 * v), D, 2400 + i * 2, { ph: tq * 3 + i, glow: 0.8 });
  });
  if (tq < B[24]) return;
  const ts = slam(tq, B[24]) * (1 + 0.04 * beatPulse(tq, [bt(97), bt(98), bt(99)], 8));
  letters(c, '黄毛理论', { font: 'KL', size: 190, x: TT.x, y: TT.y, fill: PAL.hi, ink: PAL.ink, inkW: 10, shadow: PAL.ink, D, seed: 2410, anim: (i) => ({ s: ts, fill: i < 2 ? YEL : undefined, r: 0.03 * Math.sin(tq * 5 + i) }) });
  HL('黄毛不在头上，在心里', tq, bt(97), 99, 1020, { D, size: 78, inkW: 4.6, seed: 2420, color: tint('黄毛不在头上，在心里', '心', RED) });
  ROW.forEach(([x, hc], i) => {
    const a = appear(tq, bt(97.5) + i * 0.06, 0.3);
    if (a <= 0.01) return;
    const hop = tq > bt(98) ? 24 * Math.abs(Math.sin(Math.PI * (tq - bt(98) - i * 0.05) / BEAT)) : 0;
    const pose = i % 2 ? P.cheer() : P.akimbo();
    person(c, { x, y: onGround(pose, 0.52) - hop + (1 - Math.min(1, a)) * 200, s: 0.52, flip: i < 2 ? 1 : -1 }, pose, { D, k: 2430 + i * 12, face: 'grin', hair: 'cap', hairC: hc, chest: 1, glow: 0.9, alpha: clamp(a * 2) });
  });
}
