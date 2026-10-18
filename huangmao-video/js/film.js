// 黄毛理论 · 53.2 s vertical (1080×1920 @30 fps) hand-inked line film.
// Grey squares (boxed-in, people-pleasing) vs one yellow flame (黄毛). The flame starts as a tuft of hair, moves into the chest at the DROP,
// then keeps becoming the next thing: prow → rain → bikes → cart → people → palm → match → doors → phone → arrow → title. Every frame is a pure function of t.
// Cue grid locked to the music (112.9 BPM, first beat 0.082 s): bt(n) = beat n, B[k] = bar k downbeat.
import { PAL, hs, clamp, lerp, E, rrectPts, fillShape, inkLoop, onN } from './engine.js';
import { loadGlyphs, letters, measure } from './text.js';
import { W, H, FPS, DUR, BPM, PH, BEAT, bt, B, setCtx, c, pulse, ioL } from './core.js';
import { blobTrack, drawBackdrop, sunburst, confetti, vignette, invertFrame } from './fx2.js';
import { drawFlame } from './people.js';
import { sRow, sKnot, sLeap, sKid, sDrop } from './s1.js';
import { sShip, sBike, sCart, sThree, sNot, sPodium } from './s2.js';
import { sPalm, sMatch, sBurn, sDoors, sPhone, sArrow, sEnd } from './s3.js';
export { W, H, FPS, DUR, BPM, PH, BEAT, bt };

const IMG = {};
const loadImg = (src) => new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = src; });
export async function init(canvas) {
  canvas.width = W; canvas.height = H;
  setCtx(canvas.getContext('2d'));
  await loadGlyphs('./assets/glyphs.json');
  IMG.paper = await loadImg('./assets/paper_base.jpg');
  IMG.tooth = await loadImg('./assets/paper_tooth.png');
}

function shakeAt(t, hits) {
  let x = 0, y = 0;
  const f = Math.floor(t * FPS);
  for (const [t0, a] of hits) {
    const u = t - t0;
    if (u < 0 || u > 0.35) continue;
    const e = a * Math.exp(-u * 14);
    x += e * (hs(f, 1) - 0.5) * 2; y += e * (hs(f, 2) - 0.5) * 2;
  }
  if (t > bt(30) && t < B[8]) { const e = 7 * (t - bt(30)) / (B[8] - bt(30)); x += e * (hs(f, 3) - 0.5) * 2; y += e * (hs(f, 4) - 0.5) * 2; }
  if (t > bt(62) && t < B[16]) { const e = 6 * (t - bt(62)) / (B[16] - bt(62)); x += e * (hs(f, 5) - 0.5) * 2; y += e * (hs(f, 6) - 0.5) * 2; }
  return { x, y };
}
const SHAKES = [[B[1], 18], [bt(3), 6], [bt(9), 9], [bt(14), 6], [bt(19), 16], [bt(28), 6], [bt(29), 6], [bt(30), 8], [B[8], 26], [B[8] + 0.11, 12],
  [B[9], 6], [bt(46), 10], [bt(47), 8], [bt(50.5), 14], [bt(57), 7], [bt(58), 7], [bt(59), 9], [B[16], 26], [B[16] + 0.11, 12], [bt(69), 14], [bt(73), 8], [bt(75), 8],
  [bt(78.5), 10], [bt(85), 10], [bt(90), 12], [bt(94), 8], [B[24], 10]];
const PUNCH = [[B[1], 0.05, 540, 600, 0.02], [bt(3), 0.03, 540, 1000, 0], [bt(9), 0.04, 470, 900, 0.015], [bt(14), 0.03, 540, 575, 0], [bt(19), 0.03, 890, 1200, 0],
  [B[8], 0.09, 540, 1000, 0.03], [bt(46), 0.04, 700, 1100, 0], [bt(50.5), 0.05, 720, 1100, -0.02], [B[16], 0.09, 540, 1000, -0.03], [bt(69), 0.05, 540, 900, 0.02],
  [bt(78.5), 0.04, 540, 950, 0], [bt(90), 0.04, 820, 1000, 0], [B[24], 0.05, 540, 880, 0.02]];
function applyCamera(t) {
  let z = 1;
  const k = Math.floor((t - PH) / (4 * BEAT) + 1e-9);
  if (k >= 0 && k < 25 && k !== 2 && k !== 22) { const u = t - B[k]; z *= 1 + 0.03 * (u < 0.3 ? 0 : E.io2(clamp((u - 0.3) / (4 * BEAT - 0.3)))) ; if (u < 0.3) z *= 1 + 0.03 * (1 - ioL(u / 0.3)) * 0; }
  for (let j = 1; j < 25; j++) if (j !== 8 && j !== 16) { const u = t - B[j]; if (u >= 0 && u < 0.6) z *= 1 + 0.014 * (u < 0.05 ? u / 0.05 : Math.exp(-(u - 0.05) * 10)); }
  const r = 0.0035 * Math.sin((2 * Math.PI * (t - PH)) / (8 * BEAT));
  c.translate(540, 960); c.rotate(r); c.scale(z, z); c.translate(-540, -960);
  for (const [t0, amp, x, y, rr] of PUNCH) {
    const u = t - t0; if (u < 0 || u > 0.8) continue;
    const s = 1 + amp * (u < 0.04 ? u / 0.04 : Math.exp(-(u - 0.04) * 9));
    c.translate(x, y); c.rotate(rr * Math.exp(-6 * u) * Math.sin(20 * u)); c.scale(s, s); c.translate(-x, -y);
  }
}
const T_ORG = '#ffcf9f', T_YEL = '#ffe38a', T_GB = '#d3dde8', T_GREY = '#d8d4cc', T_TEAL = '#bfe8dc', T_LIME = '#dcefb0', T_RED = '#f9bfb0', T_GRN = '#c0e8cb', T_PINK = '#f9c9d6', T_BLUE = '#c9e3f5';
let BT = null;
const track = () => (BT ||= blobTrack([
  { t: bt(0), x: 880, y: 800, rx: 0, ry: 0, color: T_PINK },
  { t: bt(0) + 0.02, d: 0.4, e: 'outBack', rx: 230, ry: 210, wb: 0.1 },
  { t: B[1], d: 0.3, x: 540, y: 640, rx: 480, ry: 230, n: 4, wb: 0.04, color: T_YEL },
  { t: B[2] - 0.1, d: 0.4, x: 470, y: 960, rx: 400, ry: 430, n: 2.4, wb: 0.08, color: T_GB },
  { t: B[3], x: 520, y: 690, rx: 440, ry: 300, n: 3, color: T_TEAL },
  { t: B[4], x: 560, y: 1120, rx: 500, ry: 300, n: 4, wb: 0.05, color: T_GRN },
  { t: B[5], d: 0.3, e: 'in2', a: 0 },
  { t: bt(29.4), d: 0, x: 540, y: 1190, rx: 0, ry: 0, n: 6, wb: 0, color: T_GREY },
  { t: bt(29.5), d: 0.01, a: 1 },
  { t: bt(29.55), d: 0.35, e: 'outBack', rx: 480, ry: 620 },
  { t: bt(31), d: 0.9, e: 'in2', rx: 220, ry: 360 },
  { t: B[8], d: 0.16, e: 'out3', x: 540, y: 900, rx: 500, ry: 500, n: 2, sp: 0.32, color: T_YEL },
  { t: B[9], x: 520, y: 800, rx: 470, ry: 330, sp: 0, wb: 0.08, color: T_ORG },
  { t: B[10], x: 560, y: 1050, rx: 500, ry: 380, n: 3, color: T_BLUE },
  { t: B[11], d: 0.2, e: 'out3', x: 580, y: 1080, rx: 480, ry: 330, sp: 0.2, color: T_RED },
  { t: B[12], x: 560, y: 1050, rx: 420, ry: 380, sp: 0, color: T_LIME },
  { t: B[13], x: 540, y: 960, rx: 500, ry: 420, n: 2, wb: 0.1, color: T_ORG },
  { t: B[14], x: 540, y: 1060, rx: 480, ry: 290, n: 3.5, wb: 0, color: T_GREY },
  { t: B[15], x: 540, y: 980, rx: 420, ry: 430, n: 2, color: T_PINK },
  { t: B[16], d: 0.16, e: 'out3', x: 540, y: 1000, rx: 520, ry: 520, sp: 0.32, color: T_YEL },
  { t: B[17], x: 540, y: 980, rx: 430, ry: 430, sp: 0, color: T_ORG },
  { t: B[18], x: 540, y: 1100, rx: 470, ry: 340, n: 3, color: T_TEAL },
  { t: B[19], x: 540, y: 960, rx: 480, ry: 280, n: 4, color: T_RED },
  { t: B[20], x: 540, y: 1080, rx: 490, ry: 380, n: 2.5, color: T_GB },
  { t: B[21], x: 760, y: 1080, rx: 380, ry: 420, n: 2, color: T_YEL },
  { t: B[22], x: 470, y: 960, rx: 400, ry: 480, n: 3, color: T_PINK },
  { t: B[23], x: 540, y: 1250, rx: 470, ry: 330, n: 2.5, color: T_GRN },
  { t: B[24], d: 0.2, e: 'out3', x: 540, y: 880, rx: 500, ry: 360, sp: 0.18, color: T_YEL },
], ioL));
function backdrop(t, tq, D) {
  const p = track()(tq);
  if (!p) return;
  const bp = pulse(tq, bt(Math.floor((tq - PH) / BEAT + 1e-6)), 9);
  drawBackdrop(c, { ...p, rx: p.rx * (1 + 0.035 * bp), ry: p.ry * (1 + 0.035 * bp), ph: tq * 1.6 }, D, 1450);
}
function bursts(t, tq, D) {
  for (const [t0, t1, x, y, n, col, k] of [[B[8], B[9] - 0.1, 540, 900, 26, '#ffe08a', 1460], [B[16], B[17] - 0.1, 540, 1000, 28, '#ffd27a', 1470], [B[24], B[24] + 1.3, 540, 880, 22, '#ffe08a', 1480]]) {
    if (t < t0 || t >= t1) continue;
    const R = 1800 * E.out3(clamp((t - t0) / 0.24)), a = 1 - E.in2(clamp((t - (t1 - 0.3)) / 0.3));
    sunburst(c, x, y, R, n, 0.2 + 0.45 * (tq - t0), col, D, k, a);
  }
}
function confettiFX(t, tq, back = false) {
  if (back) { confetti(c, tq, B[24], 540, 900, { n: 46, seed: 15, a0: -Math.PI * 0.95, a1: -Math.PI * 0.05, v0: 900, v1: 2300, drag: 2.3, life: 1.6, size: 1.3 }); return; }
  confetti(c, tq, B[8], 540, 1000, { n: 56, seed: 7, a0: -Math.PI * 0.95, a1: -Math.PI * 0.05, v0: 1100, v1: 2700, drag: 2.2, life: 1.7, size: 1.5 });
  confetti(c, tq, B[16], 540, 1100, { n: 70, seed: 9, a0: -Math.PI, a1: 0, v0: 1200, v1: 3000, drag: 2.2, life: 1.9, size: 1.5 });
  confetti(c, tq, bt(46), 860, 900, { n: 30, seed: 13, a0: -Math.PI * 0.9, a1: -Math.PI * 0.1, v0: 800, v1: 1800, drag: 2.4, life: 1.3, size: 1.2 });
}

function drawPaper() { c.drawImage(IMG.paper, 0, 0, W, H); }
function drawTooth(D) {
  const v = D % 4;
  const ox = Math.floor(hs(v, 51) * 300), oy = Math.floor(hs(v, 52) * 460);
  c.save(); c.setTransform(1, 0, 0, 1, 0, 0);
  c.globalCompositeOperation = 'multiply'; c.globalAlpha = 0.42;
  c.drawImage(IMG.tooth, ox, oy, W, H, 0, 0, W, H);
  c.restore();
}
const TAG = '黄毛小科普';
function drawTag(t, D) {
  const a = clamp((t - 0.25) / 0.2);
  if (a <= 0) return;
  const s = E.outBack(a, 2);
  c.save(); c.translate(78, 236); c.scale(s, s); c.rotate(-0.025);
  const tw = measure(TAG, 'MK', 36).w;
  const box = rrectPts(0, -34, 62 + tw + 24, 68, 16);
  fillShape(c, box, PAL.hi, { seed: D * 13 + 7, amp: 0.8, dx: -3, dy: 3 });
  inkLoop(c, box, { seed: D * 13 + 7, w: 3.6, amp: 0.8, heavy: 0.2 });
  drawFlame(c, 34, 24, 0.24, D, 9, { lw: 2.6, ph: t * 2 });
  letters(c, TAG, { font: 'MK', size: 36, x: 62, y: 1, align: 'left', fill: PAL.ink, ink: null, D, seed: 5, amp: 0.5 });
  c.restore();
}

export function render(t) {
  const f = Math.round(t * FPS);
  // animate "on twos", centred on the beat grid: frames (2k-1, 2k) share pose k/15 s, so a cue lands within ±1 frame of its beat
  const D = Math.floor((f + 1) / 2);
  const tq = D * 2 / FPS;
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
  drawPaper();
  const wa = 0.38 * ioL((t - B[5]) / 0.3) * (1 - ioL((t - B[7]) / 0.4));
  if (wa > 0.005) { c.save(); c.globalAlpha = wa; c.fillStyle = PAL.hi; c.fillRect(0, 0, W, H); c.restore(); }
  const sh = shakeAt(t, SHAKES);
  c.save(); c.translate(sh.x, sh.y);
  applyCamera(t);
  bursts(t, tq, D);
  backdrop(t, tq, D);
  confettiFX(t, tq, true);
  for (const s of [sRow, sKnot, sLeap, sKid, sDrop, sShip, sBike, sCart, sThree, sNot, sPodium, sPalm, sMatch, sBurn, sDoors, sPhone, sArrow, sEnd]) s(t, tq, D);
  confettiFX(t, tq);
  c.restore();
  vignette(c, W, H, 0.16);
  drawTag(t, D);
  drawTooth(D);
  const fa = clamp((t - 52.4) / 0.8);
  if (fa > 0) { c.save(); c.globalAlpha = E.in2(fa); drawPaper(); c.restore(); }
  const f8 = Math.round(B[8] * FPS), f16 = Math.round(B[16] * FPS);
  if (f === f8 || f === f8 + 1 || f === f16 || f === f16 + 1) invertFrame(c, W, H);
}
