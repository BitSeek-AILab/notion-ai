// 黄毛理论 · scenes B0–B8: hook → title → three habits → "黄毛 meant kids" → brushed black → DROP (flame moves into the chest)
import { PAL, hs, clamp, lerp, E, K, spline, resample, prefix, circlePts, inkLoop } from './engine.js';
import { c, B, bt, BEAT, pulse, beatPulse, appear, vanish, ioL, lerpPt, HL, SUB, tint, swash, lerpLine, line, letters, measure } from './core.js';
import { YEL, YELL, ORG, GINK, GREYL, GREYM, G0, KID, P, mixP, person, drawFlame } from './people.js';
import { RED, heartD, bubble, tanglePts, brush, frameRing, frameShards, txt, box } from './props.js';
import { puff, twinkle, speedLines } from './fx.js';
import { drawSweat, mixHex } from './shapes.js';

export const GROUND = 1480;
const ROWX = [100, 285, 470, 655, 840], RS = 0.7, RHIP = GROUND - 256 * RS, HX = ROWX[2], BOW = 0.75;
const bowEnv = (t, b) => (t < b ? 0 : E.out2(clamp((t - b) / 0.11)) * (1 - E.io2(clamp((t - b - 0.2) / 0.27))));
const bowAt = (t, beats) => beats.reduce((m, b) => Math.max(m, bowEnv(t, b)), 0);
export const mixG = (a, b, u) => Object.fromEntries(Object.keys(a).map((k) => [k, lerp(a[k], b[k], u)]));
export const bump = (t, a, b) => (t < a || t > b ? 0 : Math.sin(Math.PI * (t - a) / (b - a)));
const HEADACHE = () => ({ hip: [0, 0], lean: 0.06, legs: [{ t: -0.12, k: 0.05 }, { t: 0.12, k: 0.05 }], arms: [{ t: -2.05, k: -1.75 }, { t: 2.05, k: 1.75 }], head: 0.12, face: 'meh' });
const guy = (tf, pose, D, k, o = {}) => person(c, tf, pose, { D, k, ...o });

// ------------------------------------------------------------------ zoom from the row onto guy #1 (B2)
const F0 = [ROWX[1], RHIP], F1 = [470, 1180], ZM = 1.69;
export const MAIN = { x: 470, y: 1180, s: RS * ZM };
export const G2 = 1180 + (GROUND - RHIP) * ZM;
const zoomU = (t) => ioL((t - (B[2] - 0.22)) / 0.42);
function mapZ(u) { const z = lerp(1, ZM, u), C = lerpPt([540, 960], F1, u), P0 = lerpPt([540, 960], F0, u); return { z, f: (x, y) => [C[0] + (x - P0[0]) * z, C[1] + (y - P0[1]) * z] }; }
const knock = (t, i) => (i < 2 ? -1 : 1) * K(t - B[1] - Math.abs(i - 2) * 0.05, [[0, 0], [0.1, 0.62, 'out2'], [0.36, 0.1, 'io2'], [0.62, 0.3, 'io2'], [0.9, 0.22, 'io2']]);
const heartPos = (t) => {
  if (t < bt(3)) return [900, 800 - 14 * beatPulse(t, [bt(0), bt(1), bt(2)], 7)];
  const u = E.out3(clamp((t - bt(3)) / 0.16));
  return [lerp(900, 598, u), lerp(800, 985, u) - 80 * Math.sin(Math.PI * u) - 10 * beatPulse(t, [bt(4), bt(5), bt(6), bt(7)], 7)];
};

export function sRow(t, tq, D) {
  if (t >= B[3]) return;
  const u = zoomU(tq), Z = mapZ(u);
  const fade = 1 - clamp((tq - B[2]) / 0.12);
  line([Z.f(-400, GROUND + 4), Z.f(1480, GROUND + 4)], D, 1, { w: 7 * Z.z });
  // shockwave ring at B1
  if (tq >= B[1] && tq < B[1] + 0.4) {
    const v = (tq - B[1]) / 0.4, ctr = Z.f(HX, 1180);
    c.save(); c.globalAlpha *= 1 - v;
    inkLoop(c, circlePts(ctr[0], ctr[1], 60 + 760 * E.out2(v), 90), { seed: D * 13 + 5, w: 16 * (1 - v) + 3, amp: 2, heavy: 0 });
    c.restore();
  }
  // grey row
  for (const i of [0, 1, 3, 4]) {
    const fl = 1;
    if (i !== 1 && fade <= 0) continue;
    let bow = bowAt(tq, [bt(0), bt(1), bt(2), bt(3), bt(5), bt(6), bt(7)]) * BOW;
    let tilt = tq >= B[1] ? knock(tq, i) : 0;
    const isMain = i === 1 && tq >= B[2] - 0.22;
    let pose, sq = 1, fill = GREYM, face = tq >= B[1] && tq < B[1] + 0.9 ? 'shock' : 'meh', tuft = 0;
    if (isMain) {
      tilt *= 1 - u;
      const hold = E.out2(clamp((tq - bt(8)) / 0.12)) * 0.95, u9 = clamp((tq - bt(9)) / 0.55);
      const b0 = tq < bt(8) ? bow : hold;
      pose = mixP(P.bow(b0), P.akimbo(), tq < bt(9) ? 0 : E.outElastic(u9));
      sq = tq < bt(9) ? 1 : 1 - E.outElastic(clamp((tq - bt(9)) / 0.4));
      fill = mixHex(GREYM, PAL.hi, clamp((tq - bt(9)) / 0.1));
      face = tq < bt(9) ? 'meh' : 'grin';
      tuft = appear(tq, bt(9), 0.3) * (1 + 0.3 * pulse(tq, bt(10), 6));
    } else pose = P.bow(bow);
    const foot = Z.f(ROWX[i] + 8 * fl, GROUND), hip = Z.f(ROWX[i], RHIP);
    c.save();
    if (!isMain) c.globalAlpha *= fade;
    c.translate(foot[0], foot[1]); c.rotate(tilt); c.translate(-foot[0], -foot[1]);
    const R = guy({ x: hip[0], y: hip[1], s: RS * Z.z, flip: fl }, pose, D, 10 + i * 40, { square: sq, headFill: fill, face, tuft, glow: 0 });
    if (!isMain && tq > bt(1) && tq < B[2] && i % 2 === 0) drawSweat(c, R.hc[0] - fl * R.R * 0.9, R.hc[1] - R.R * 0.6 + 30 * ((tq * 2 + i * 0.3) % 1), 1.1 * Z.z, D, 300 + i);
    c.restore();
  }
  // the 黄毛 (middle)
  if (fade > 0) {
    c.save(); c.globalAlpha *= fade;
    const b = tq < bt(3) ? bowAt(tq, [bt(0), bt(1), bt(2)]) * BOW : 0;
    const uu = clamp((tq - bt(3)) / 0.45), ua = E.outBack(clamp((tq - B[1] - 0.3) / 0.3), 1.6);
    const pose = tq < bt(3) ? P.bow(b) : mixP(mixP(P.bow(0), P.cheer(), E.outElastic(uu)), P.akimbo(), ua);
    const sq = tq < bt(3) ? 1 : 1 - E.outElastic(clamp((tq - bt(3)) / 0.4));
    const sw = tq > B[1] ? 0.8 * Math.sin((tq - B[1]) * 19) * Math.exp(-(tq - B[1]) * 4.5) : 0;
    const hip = Z.f(HX, RHIP);
    guy({ x: hip[0], y: hip[1], s: RS * Z.z, flip: 1 }, pose, D, 120, { square: sq, headFill: mixHex(GREYM, PAL.hi, clamp((tq - bt(3)) / 0.1)), face: tq < bt(3) ? 'meh' : 'grin',
      tuft: appear(tq, bt(3), 0.28) * (1 + 0.45 * pulse(tq, B[1], 4)), tuftRot: sw });
    // heart
    const hp = heartPos(tq), hz = Z.f(hp[0], hp[1]);
    const sq2 = tq > bt(3) ? 0.25 * Math.sin((tq - bt(3) - 0.16) * 30) * Math.exp(-(tq - bt(3) - 0.16) * 9) * (tq > bt(3) + 0.16 ? 1 : 0) : 0;
    heartD(hz[0], hz[1], (tq < bt(3) ? 74 : lerp(74, 54, clamp((tq - bt(3)) / 0.16))) * Z.z * (1 + 0.08 * beatPulse(tq, [bt(0), bt(1), bt(2)], 8)), D, 140, { sx: 1 + sq2, sy: 1 - sq2 });
    if (tq >= bt(3) && tq < bt(3) + 0.6) for (let j = 0; j < 6; j++) {
      const v = (tq - bt(3) - 0.12) / 0.5; if (v <= 0) continue;
      const a = -Math.PI / 2 + (j - 2.5) * 0.5, r = 30 + 120 * E.out2(v);
      c.save(); c.globalAlpha *= 1 - v; heartD(hz[0] + Math.cos(a) * r, hz[1] + Math.sin(a) * r, 13 * Z.z, D, 150 + j, { shine: false }); c.restore();
    }
    c.restore();
  }
  // spark flying in to light guy #1 (B2)
  if (tq >= bt(8.45) && tq < bt(9)) {
    const v = E.in2((tq - bt(8.45)) / (bt(9) - bt(8.45)));
    drawFlame(c, lerp(1120, 480, v), lerp(560, 812, v) - 160 * Math.sin(Math.PI * v), 0.32, D, 170, { rot: lerp(-1.2, 0.3, v), glow: 1.2 });
  }
  // speech bubbles of yes-saying, burst at bt(9)
  for (const [tb, x, y, rx, str, k] of [[bt(8) + 0.04, 800, 830, 150, '是是是', 180], [bt(8.5), 740, 650, 170, '好好好', 185]]) {
    if (tq < tb) continue;
    if (tq < bt(9)) bubble(x, y, rx, 72, 770, 975, appear(tq, tb, 0.22), D, k, { str, size: 60 });
    else if (tq < bt(9) + 0.25) { const v = (tq - bt(9)) / 0.25; c.save(); c.globalAlpha *= 1 - v; puff(c, x, y, 70 + 80 * v, D, k + 2); c.restore(); }
  }
  // text
  HL('为什么老实人', tq, bt(0) + 0.02, B[1] - 0.1, 330, { D });
  HL('总输给黄毛？', tq, bt(2), B[1] - 0.1, 470, { D, color: tint('总输给黄毛？', '黄毛', YEL), seed: 52 });
  if (tq >= B[1] && tq < B[2]) swash(170, 910, 690, (tq - B[1] - 0.04) / 0.32, D, 7, YEL, 34);
  HL('黄毛理论', tq, B[1] + 0.05, B[2] - 0.16, 590, { D, size: 178, color: tint('黄毛理论', '黄毛', YEL), st: 0.07, seed: 54 });
  SUB('赢的从来不是头发', tq, bt(6), B[2] - 0.16, 778, { D, size: 64 });
  HL('① 不迎合', tq, bt(9), B[3] - 0.1, 360, { D, size: 150, seed: 56 });
}

// ------------------------------------------------------------------ B3: a knot of thoughts pulled straight into an arrow
const TG = () => tanglePts(520, 575, 400, 180, 7, 17);
const STRAIGHT = () => resample([[300, 575], [860, 575]], 3, false);
const GLINE = () => resample([[-40, GROUND + 4], [1120, GROUND + 4]], 3, false);
export function sKnot(t, tq, D) {
  if (tq < B[3] || tq >= B[4]) return;
  const u14 = ioL((tq - bt(14)) / 0.3);
  const pose = tq < bt(14) ? mixP(P.akimbo(), HEADACHE(), E.out2(clamp((tq - B[3]) / 0.15))) : mixP(HEADACHE(), P.cheer(), E.outBack(clamp((tq - bt(14)) / 0.3), 1.6));
  const st = bump(tq, bt(13.4), bt(14.25));
  line([[-40, G2], [1120, G2]], D, 2, { w: 9 });
  guy(MAIN, pose, D, 50, { face: tq < bt(14) ? 'meh' : 'grin', tuft: 1 + 1.0 * st, tuftLean: 0.25 * st, tuftSway: 1 + st });
  const draw = E.out2(clamp((tq - B[3] - 0.04) / 0.36));
  let L = tq < bt(14) ? prefix(TG(), draw) : lerpLine(TG(), STRAIGHT(), u14, 160);
  if (tq < bt(14) && tq > B[3] + 0.4) { const j = 4 * beatPulse(tq, [bt(13)], 6); L = L.map((p, i) => [p[0] + j * Math.sin(i * 0.7 + tq * 40), p[1] + j * Math.cos(i * 0.5 + tq * 37)]); }
  const nudge = tq > bt(14.4) ? 18 * Math.sin((tq - bt(14.4)) * 9) * Math.exp(-(tq - bt(14.4)) * 2) : 0;
  if (L.length > 1) line(L.map((p) => [p[0] + nudge, p[1]]), D, 60, { dense: true, w: 9, color: tq < bt(14) ? GINK : PAL.ink });
  if (u14 > 0.7) { const a = appear(tq, bt(14) + 0.22, 0.2); const x = 860 + nudge; line([[x - 58 * a, 575 - 46 * a], [x + 4, 575], [x - 58 * a, 575 + 46 * a]], D, 61, { w: 11 }); }
  HL('② 不内耗', tq, bt(14), B[4] - 0.1, 360, { D, size: 150, seed: 58 });
}

// ------------------------------------------------------------------ B4: arrow → road with a gap; square hesitates, 黄毛 jumps
const GAP = [560, 760];
const HERO4 = { x: 150, s: 1.0 }, H4Y = GROUND - 256 * HERO4.s;
export const LANDX = 890;
function heroLeap(tq) {
  const u0 = ioL((tq - B[4]) / 0.28);
  if (tq < bt(17)) return { tf: { x: lerp(MAIN.x, HERO4.x, u0), y: lerp(MAIN.y, H4Y, u0) - 120 * Math.sin(Math.PI * u0), s: lerp(MAIN.s, HERO4.s, u0), flip: 1 }, pose: P.akimbo() };
  if (tq < bt(18)) { const v = (tq - bt(17)) / (bt(18) - bt(17)); return { tf: { x: lerp(HERO4.x, GAP[0] - 20, v), y: H4Y, s: HERO4.s, flip: 1 }, pose: P.run(v * 2.2 + 0.1, { lean: 0.3 }), run: true }; }
  if (tq < bt(19)) { const v = (tq - bt(18)) / (bt(19) - bt(18)); return { tf: { x: lerp(GAP[0] - 20, LANDX, v), y: H4Y - 300 * Math.sin(Math.PI * v), s: HERO4.s, flip: 1 }, pose: P.jump(Math.sin(Math.PI * Math.min(1, v * 1.15))), air: true }; }
  const v = clamp((tq - bt(19)) / 0.3);
  return { tf: { x: LANDX, y: H4Y + 26 * Math.sin(Math.PI * v), s: HERO4.s, flip: 1 }, pose: mixP(P.jump(0), P.cheer(), E.outBack(v, 1.5)) };
}
export const heroEnd4 = () => ({ x: LANDX, y: H4Y, s: HERO4.s });
export function sLeap(t, tq, D) {
  if (tq < B[4] || tq >= B[5] + 0.4) return;
  const ug = ioL((tq - B[4]) / 0.28), gap = 200 * E.outBack(clamp((tq - bt(16.4)) / 0.25), 1.4);
  const out = 1 - ioL((tq - B[5]) / 0.3);
  if (ug < 1) {
    const L = lerpLine(STRAIGHT(), GLINE(), ug, 160);
    line(L, D, 70, { dense: true, w: 9 });
  } else if (out > 0) {
    const gc = (GAP[0] + GAP[1]) / 2;
    line([[lerp(gc - gap / 2 - 100, -40, out), GROUND + 4], [gc - gap / 2, GROUND + 4]], D, 71, { w: 9 });
    line([[gc + gap / 2, GROUND + 4], [lerp(gc + gap / 2 + 100, 1120, out), GROUND + 4]], D, 72, { w: 9 });
    if (gap > 4) for (const [x, k] of [[gc - gap / 2, 73], [gc + gap / 2, 74]]) line([[x, GROUND + 4], [x + (k === 73 ? 14 : -14), GROUND + 4 + 120 * clamp(gap / 200) * out]], D, k, { w: 6 });
  }
  // the hesitant square
  const ga = appear(tq, B[4] + 0.3, 0.25) * (1 - clamp((tq - B[5]) / 0.12));
  if (ga > 0.01) {
    const shake = tq > bt(16.5) ? 3 * Math.sin(tq * 70) : 0;
    const look = tq > bt(18) && tq < bt(19.3) ? -0.5 : 0.42;
    guy({ x: 440 + shake, y: H4Y + (1 - ga) * 60, s: HERO4.s, flip: 1 }, P.stand({ lean: -0.12, head: look, face: 'meh' }), D, 80, { square: 1, headFill: GREYM, face: tq > bt(18) && tq < bt(19.3) ? 'shock' : 'meh', alpha: ga });
    if (tq > bt(16.6) && tq < B[5] && (tq < bt(17.3) || tq > bt(18.2))) drawSweat(c, 372, H4Y - 300 + 40 * ((tq * 1.7) % 1), 1.4, D, 81);
  }
  const H = heroLeap(tq);
  if (tq < B[5]) {
    if (H.run) speedLines(c, H.tf.x - 60, H.tf.y - 60, 0, 0, 0, D, 90);
    if (H.run) for (let j = 0; j < 3; j++) line([[H.tf.x - 120 - j * 30, H.tf.y - 90 + j * 50], [H.tf.x - 230 - j * 30, H.tf.y - 90 + j * 50]], D, 91 + j, { w: 5, t0: 10, t1: 2 });
    guy(H.tf, H.pose, D, 95, { tuft: 1, face: 'grin' });
  }
  if (tq >= bt(19) && tq < bt(19) + 0.35) { const v = (tq - bt(19)) / 0.35; c.save(); c.globalAlpha *= 1 - v; puff(c, LANDX - 90 - 60 * v, GROUND - 10, 34, D, 96); puff(c, LANDX + 90 + 60 * v, GROUND - 10, 30, D, 97); c.restore(); }
  HL('③ 说干就干', tq, bt(18), B[5] - 0.1, 360, { D, size: 150, seed: 60 });
}

// ------------------------------------------------------------------ B5–B7: the kid, the dictionary, the brushes, the squeeze
const KX = 540, KS = 1.35, KY = GROUND - 148 * KS - 2, AS = 1.0, AY = GROUND - 256 * AS;
function kidState(tq) {
  // returns tf, g, pose and look params for B5..B8
  const u5 = ioL((tq - B[5]) / 0.42), e4 = heroEnd4();
  const grow = ioL((tq - bt(30)) / (bt(31.6) - bt(30)));
  const g = tq < B[5] + 0.42 ? mixG(G0, KID, u5) : mixG(KID, G0, grow);
  let tf = tq < B[5] + 0.42 ? { x: lerp(e4.x, KX, u5), y: lerp(e4.y, KY, u5) - 80 * Math.sin(Math.PI * u5), s: lerp(e4.s, KS, u5), flip: 1 } : { x: KX, y: lerp(KY, AY, grow), s: lerp(KS, AS, grow), flip: 1 };
  let pose = mixP(P.cheer(), P.stand({ face: 'happy' }), u5), face = 'happy';
  if (tq >= bt(24) && tq < bt(25)) { const v = clamp((tq - bt(24)) / 0.46); tf = { ...tf, y: tf.y - 150 * Math.sin(Math.PI * v) }; pose = P.jump(Math.sin(Math.PI * v)); face = 'grin'; }
  else if (tq >= bt(25) && tq < bt(26)) { pose = mixP(P.stand(), P.shout(), E.outBack(clamp((tq - bt(25)) / 0.14), 1.6)); face = 'shock'; }
  else if (tq >= bt(26) && tq < bt(27)) { pose = mixP(P.shout(), P.laugh(), E.outBack(clamp((tq - bt(26)) / 0.14), 1.6)); face = 'grin'; }
  else if (tq >= bt(27) && tq < B[7]) { pose = mixP(P.laugh(), P.draw(), E.outBack(clamp((tq - bt(27)) / 0.14), 1.6)); face = 'happy'; }
  else if (tq >= B[7]) {
    const sq = ioL((tq - bt(30)) / (bt(31.7) - bt(30)));
    pose = mixP(mixP(P.draw(), P.stand({ face: 'meh' }), E.out2(clamp((tq - B[7]) / 0.2))), P.sad(), sq);
    face = tq < bt(28.2) ? 'shock' : 'meh';
  }
  return { tf, g, pose, face };
}
const BRUSHES = [[bt(28), '懂事', 1], [bt(29), '别冒头', -1], [bt(30), '标准答案', 1]];
const blackness = (tq) => BRUSHES.reduce((n, [tb]) => n + E.out2(clamp((tq - tb - 0.05) / 0.14)), 0) / 3;
export const FRAME = (tq) => { const v = E.in2(clamp((tq - bt(29.5)) / (B[8] - bt(29.5)))); return { x: 540, y: 1190, w: lerp(980, 420, v), h: lerp(1240, 720, v) }; };
export function sKid(t, tq, D) {
  if (tq < B[5] || tq >= B[8]) return;
  const S = kidState(tq);
  // crayon drawing (B6, beat 4)
  if (tq >= bt(27) && tq < B[7] + 0.2) {
    const v = clamp((tq - bt(27) - 0.05) / 0.4), a = 1 - clamp((tq - B[7]) / 0.2);
    const sun = []; for (let i = 0; i <= 40; i++) { const an = (i / 40) * Math.PI * 2.1; sun.push([800 + 70 * Math.cos(an), 900 + 70 * Math.sin(an)]); }
    c.save(); c.globalAlpha *= a;
    if (v > 0) line(prefix(spline(sun, false, 4), v), D, 200, { dense: true, w: 9, color: ORG });
    for (let j = 0; j < 8; j++) { const w = clamp(v * 8 - j); if (w <= 0) continue; const an = j * Math.PI / 4; line([[800 + 95 * Math.cos(an), 900 + 95 * Math.sin(an)], [800 + (95 + 45 * w) * Math.cos(an), 900 + (95 + 45 * w) * Math.sin(an)]], D, 210 + j, { w: 8, color: ORG }); }
    c.restore();
  }
  // brushed-black tuft: colour & size steps, then becomes a black cap
  const bk = blackness(tq), toCap = clamp((tq - bt(30.6)) / 0.3);
  const tuftC = mixHex(YEL, PAL.ink, bk), tuft = (tq < B[5] + 0.42 ? 1 : 1.25) * lerp(1, 0.42, bk) * (1 - toCap);
  const sq = ioL((tq - bt(30.4)) / (bt(31.7) - bt(30.4)));
  const shake = tq > bt(30) ? (tq - bt(30)) * 3 * Math.sin(tq * 80) : 0;
  person(c, { ...S.tf, x: S.tf.x + shake }, S.pose, { D, k: 220, g: S.g, face: S.face, tuft, tuftC, tuftCore: bk < 0.5, tuftSway: lerp(1, 0.3, bk), square: sq, headFill: mixHex(PAL.hi, GREYL, sq), hair: toCap > 0 ? 'cap' : null, hairC: PAL.ink });
  // frame
  if (tq >= bt(29.5)) { const F = FRAME(tq), a = appear(tq, bt(29.5), 0.3); c.save(); c.globalAlpha *= clamp(a); frameRing(F.x + shake * 0.5, F.y, F.w * (2 - a), F.h * (2 - a), 34, GREYM, D, 240, { w: 7 }); c.restore(); }
  // brushes
  BRUSHES.forEach(([tb, label, dir], i) => {
    const v = (tq - tb + 0.2) / 0.5; if (v < 0 || v > 1) return;
    const hy = S.tf.y - (S.g.torso + S.g.headR + 30) * S.tf.s - 40;
    const x = dir > 0 ? lerp(1250, -260, E.io2(v)) : lerp(-170, 1340, E.io2(v));
    brush(x, hy + 30 * Math.sin(v * Math.PI), (dir > 0 ? 0.25 : Math.PI - 0.25) + 0.3 * (v - 0.5) * dir, 1.25, label, D, 250 + i * 10, { size: 44 });
  });
  // dictionary card (B5)
  const ca = appear(tq, bt(21), 0.3) * vanish(tq, B[6] - 0.05, 0.15);
  if (ca > 0.01 && tq < B[6] + 0.2) {
    c.save(); c.translate(540, 672); c.scale(ca, ca); c.rotate(-0.02); c.translate(-540, -672);
    box(540, 672, 780, 270, 18, PAL.hi, D, 260, { w: 7 });
    txt('黄毛', 196, 594, 82, PAL.ink, D, 261, { font: 'KL', align: 'left' });
    txt('〔名〕', 370, 598, 44, GINK, D, 262, { align: 'left' });
    txt('黄发，借指年幼的人', 196, 682, 54, PAL.ink, D, 263, { align: 'left' });
    txt('例：黄毛丫头 · 黄毛小子', 196, 760, 44, GINK, D, 264, { align: 'left' });
    c.restore();
  }
  // B6 speech bubble
  if (tq >= bt(25) && tq < bt(26)) bubble(820, 830, 150, 84, 640, 990, appear(tq, bt(25), 0.18), D, 270, { str: '我不！', size: 72 });
  if (tq >= bt(26) && tq < bt(27)) for (let j = 0; j < 3; j++) txt('哈', 700 + j * 64, 900 - j * 36 - 12 * Math.sin(tq * 20 + j), 54 * appear(tq, bt(26) + j * 0.07, 0.15), PAL.ink, D, 275 + j, { font: 'KL' });
  // text
  HL('可“黄毛”这个词，', tq, B[5] + 0.04, B[6] - 0.1, 320, { D, size: 100, color: tint('可“黄毛”这个词，', '黄毛', YEL), seed: 62 });
  HL('本来是说小孩', tq, bt(22), B[6] - 0.1, 440, { D, size: 112, seed: 64 });
  HL('小时候，', tq, bt(24), B[7] - 0.1, 320, { D, size: 112, seed: 66 });
  HL('谁不是黄毛？', tq, bt(25.5), B[7] - 0.1, 440, { D, size: 118, color: tint('谁不是黄毛？', '黄毛', YEL), seed: 68 });
  HL('后来，我们', tq, bt(28), B[8] - 0.06, 320, { D, size: 112, seed: 70 });
  const a1 = '被一点点——', a2 = '刷黑了';
  const w1 = measure(a1, 'KL', 104).adv, w2 = measure(a2, 'KL', 104).adv, x0 = 540 - (w1 + w2) / 2;
  HL(a1, tq, bt(29), B[8] - 0.06, 440, { D, size: 104, x: x0, align: 'left', seed: 72 });
  HL(a2, tq, bt(30.2), B[8] - 0.06, 440, { D, size: 104, x: x0 + w1, align: 'left', fill: PAL.ink, shadow: GINK, seed: 74, jit: tq > bt(31) ? 5 : 0 });
}

// ------------------------------------------------------------------ B8 DROP: frame shatters, flame bursts out of the chest
export const DROP_GUY = { x: 540, y: AY, s: AS };
export const colS = (tq) => K(tq, [[B[8], 0], [B[8] + 0.14, 2.9, 'out3'], [B[8] + 0.6, 2.35, 'io2']]);
export function chestOf(pose, tf) { const g = G0; const H = [tf.x, tf.y]; return [H[0] + Math.sin(pose.lean) * g.torso * 0.6 * tf.s * (tf.flip ?? 1), H[1] - Math.cos(pose.lean) * g.torso * 0.6 * tf.s]; }
export function sDrop(t, tq, D) {
  if (tq < B[8] || tq >= B[9]) return;
  const u = tq - B[8];
  const F = FRAME(B[8] - 0.001);
  frameShards(F.x, F.y, F.w, F.h, 34, 12, u, GREYM, D, 300);
  const pose = mixP(P.sad(), P.cheer(), E.outBack(clamp(u / 0.2), 1.7));
  const ch = chestOf(pose, DROP_GUY);
  drawFlame(c, ch[0], ch[1] + 40, colS(tq), D, 320, { glow: 1.6, ph: tq * 2.2 });
  person(c, DROP_GUY, pose, { D, k: 330, square: 1 - E.outElastic(clamp(u / 0.35)), headFill: mixHex(GREYL, PAL.hi, clamp(u / 0.1)), face: 'grin', hair: 'cap', hairC: PAL.ink, chest: K(tq, [[B[8], 0], [B[8] + 0.1, 1.5, 'out2'], [B[8] + 0.5, 1.15, 'io2']]) });
  HL('黄毛不在头上，', tq, B[8] + 0.04, B[9] - 0.1, 320, { D, size: 112, color: tint('黄毛不在头上，', '黄毛', YEL), seed: 76 });
  HL('在心里', tq, bt(34), B[9] - 0.1, 455, { D, size: 150, color: tint('在心里', '心里', YEL), seed: 78 });
}
