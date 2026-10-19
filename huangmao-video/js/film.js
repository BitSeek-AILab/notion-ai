// 黄毛理论 v2 · shot list, transitions, camera, global caption track, corner tag, fades
import { setCtx, c, PAL, bg, rrFill, circ, ring, heartPts, path, fillP } from './draw.js';
import { B, bb, BEAT, BAR, DUR, FADE0, W, H, FPS } from './beat.js';
import { clamp, lerp, hs, E, ramp, pulse, inv, popS } from './lib.js';
import { cap, flower, label, FONTS } from './type.js';
import { loadFonts } from './fonts.js';
import * as S1 from './s1.js';
import * as S2 from './s2.js';
import * as S3 from './s3.js';
export { W, H, FPS, DUR };

// [start, end, scene, transition-in, camera]
export const SHOTS = [
  [0, B[1], S1.hook, null, { push: 0.035 }],
  [B[1], B[2], S1.title, { k: 'iris', d: 0.42, x: 540, y: 700, col: PAL.yel }, { push: 0.03 }],
  [B[2], B[3], S1.trait1, { k: 'diag', d: 0.4, col: PAL.coral }, { push: 0.03 }],
  [B[3], B[4], S1.trait2, { k: 'slats', d: 0.45, col: PAL.navy }, { push: 0.025 }],
  [B[4], B[5], S1.trait3, { k: 'iris', d: 0.42, x: 540, y: 1200, col: PAL.yel }, { push: 0.03 }],
  [B[5], B[6], S1.dict, { k: 'push', d: 0.42, col: PAL.blue }, { push: 0.03 }],
  [B[6], B[8], S1.kid, { k: 'iris', d: 0.42, x: 540, y: 900, col: PAL.mint }, { push: 0.07 }],
  [B[8], B[9], S1.drop, { k: 'cut' }, { push: 0.03, shake: [B[8], 26, 2.2] }],
  [B[9], B[10], S2.meet, { k: 'heart', d: 0.48, x: 540, y: 560, col: PAL.coral }, { push: 0.03 }],
  [B[10], B[11], S2.ride, { k: 'diag', d: 0.4, col: PAL.yel }, { push: 0.025 }],
  [B[11], B[12], S2.love, { k: 'iris', d: 0.42, x: 540, y: 900, col: PAL.pink2 }, { push: 0.03 }],
  [B[12], B[13], S2.skate, { k: 'diag', d: 0.4, col: PAL.coral, rev: true }, { push: 0.03 }],
  [B[13], B[14], S2.lineup, { k: 'slats', d: 0.45, col: PAL.yel }, { push: 0.03 }],
  [B[14], B[16], S2.fate, { k: 'iris', d: 0.42, x: 540, y: 820, col: PAL.purple }, { push: 0.0 }],
  [B[16], B[17], S2.climax, { k: 'cut' }, { push: 0.03, shake: [B[16], 22, 2.4] }],
  [B[17], B[18], S3.chart, { k: 'slats', d: 0.45, col: PAL.blue }, { push: 0.025 }],
  [B[18], B[20], S3.regret, { k: 'diag', d: 0.4, col: PAL.mint }, { push: 0.04 }],
  [B[20], B[23], S3.tips, { k: 'iris', d: 0.42, x: 540, y: 960, col: PAL.yel }, { push: 0.0 }],
  [B[23], B[24], S3.cta, { k: 'heart', d: 0.48, x: 540, y: 900, col: PAL.pink }, { push: 0.03 }],
  [B[24], DUR + 1, S3.end, { k: 'iris', d: 0.45, x: 540, y: 620, col: PAL.yel }, { push: 0.03 }],
];

// global caption track (house style: white fill, navy outline, yellow highlight)
const Y = PAL.yel;
export const CAPS = [
  { b: B[1] - 0.1, lines: [{ s: '为什么老实人，', y: 290, size: 96, tIn: -0.6 }, { s: '总输给黄毛？', y: 440, size: 132, tIn: bb(0, 0.95), hl: [['黄毛', Y]] }] },
  { b: B[2] + 0.22, lines: [{ s: '赢的，从来不是头发', y: 1440, size: 92, tIn: bb(1, 2.15) }] },
  { b: B[6] - 0.08, lines: [{ s: '可“黄毛”这个词，', y: 290, size: 100, tIn: bb(5, 0.2), hl: [['黄毛', Y]] }] },
  { b: B[6] - 0.08, lines: [{ s: '本来是说小孩', y: 1500, size: 116, tIn: bb(5, 2.05), hl: [['小孩', Y]] }] },
  { b: B[7] - 0.05, lines: [{ s: '小时候，', y: 290, size: 100, tIn: bb(6, 0.25) }, { s: '谁不是黄毛？', y: 430, size: 132, tIn: bb(6, 0.9), hl: [['黄毛', Y]] }] },
  { b: B[8] - 0.12, lines: [{ s: '后来，我们被一点点——', y: 290, size: 88, tIn: bb(7, 0.15) }, { s: '刷黑了', y: 440, size: 150, tIn: bb(7, 2.2), fill: [[0, '#4a4866'], [1, '#17153a']], outerCol: '#ffffff', extCol: '#9a9bb5' }] },
  { b: B[9] - 0.1, lines: [{ s: '黄毛不在头上，', y: 1440, size: 100, tIn: bb(8, 0.55) }, { s: '在心里', y: 1610, size: 170, tIn: bb(8, 1.35), hl: [['心里', Y]] }] },
  { b: B[10] - 0.08, lines: [{ s: '会上，敢举手', y: 1470, size: 110, tIn: bb(9, 0.45), hl: [['举手', Y]] }] },
  { b: B[11] - 0.08, lines: [{ s: '机会，自己去追', y: 1470, size: 110, tIn: bb(10, 0.45), hl: [['去追', Y]] }] },
  { b: B[12] - 0.08, lines: [{ s: '喜欢，就直接说', y: 1470, size: 110, tIn: bb(11, 0.45), hl: [['直接说', Y]] }] },
  { b: B[13] - 0.08, lines: [{ s: '六十岁，照样学滑板', y: 1470, size: 100, tIn: bb(12, 0.45), hl: [['学滑板', Y]] }] },
  { b: B[14] - 0.08, lines: [{ s: '他们的头发，', y: 1430, size: 100, tIn: bb(13, 0.3) }, { s: '一根都不黄', y: 1580, size: 128, tIn: bb(13, 1.2), hl: [['不黄', Y]] }] },
  { b: B[15] - 0.06, lines: [{ s: '高富帅，要看命', y: 1470, size: 112, tIn: bb(14, 0.5), hl: [['命', PAL.coral]] }] },
  { b: B[16] - 0.1, lines: [{ s: '黄毛呢？', y: 1480, size: 150, tIn: bb(15, 0.5), hl: [['黄毛', Y]] }] },
  { b: B[17] - 0.1, flower: true, lines: [{ s: '只要愿意，', y: 1420, size: 116, tIn: bb(16, 0.1) }, { s: '谁都能当！', y: 1590, size: 168, tIn: bb(16, 0.85) }] },
  { b: B[19] - 0.06, lines: [{ s: '时间越久，', y: 1430, size: 100, tIn: bb(18, 0.3) }, { s: '越后悔“没做”的事', y: 1580, size: 104, tIn: bb(18, 1.1), hl: [['没做', Y]] }] },
  { b: B[20] - 0.06, lines: [{ s: '做了，就算摔一跤，', y: 1430, size: 96, tIn: bb(19, 1.45) }, { s: '也少一个遗憾', y: 1580, size: 120, tIn: bb(19, 2.3), hl: [['少一个遗憾', Y]] }] },
  { b: B[21] - 0.06, lines: [{ s: '不想去的局，说“不”', y: 1500, size: 96, tIn: bb(20, 0.55), hl: [['不”', Y]] }] },
  { b: B[22] - 0.06, lines: [{ s: '想做的事，今天开个头', y: 1500, size: 92, tIn: bb(21, 0.35), hl: [['今天', Y]] }] },
  { b: B[23] - 0.06, lines: [{ s: '把“我不配”，改成“我试试”', y: 1500, size: 82, tIn: bb(22, 0.35), hl: [['我试试', Y]] }] },
  { b: B[24] - 0.1, lines: [{ s: '你身边最“黄毛”的人，', y: 290, size: 92, tIn: bb(23, 0.2), hl: [['黄毛', Y]] }, { s: '是谁？', y: 430, size: 140, tIn: bb(23, 0.95) }] },
];

let ctx = null, dpr = 1;
export async function init(canvas, d = 1) {
  dpr = d; canvas.width = W * dpr; canvas.height = H * dpr; ctx = canvas.getContext('2d');
  await loadFonts();
}

function drawShot(i, t) {
  const [a, b, fn, , cam] = SHOTS[i];
  const lt = t - a, D = b - a;
  c.save();
  const k = 1 + (cam.push ?? 0.03) * clamp(lt / D);
  let sx = 0, sy = 0;
  if (cam.shake) { const [t0, amp, dec] = cam.shake; const e = t >= t0 ? Math.exp(-(t - t0) * dec) : 0; sx = amp * e * Math.sin(t * 71) * (0.6 + 0.4 * Math.sin(t * 13)); sy = amp * e * Math.cos(t * 59); }
  c.translate(540 + sx, 900 + sy); c.scale(k, k); c.translate(-540, -900);
  fn(t, lt, D);
  c.restore();
}
function clipFor(tr, u) {
  const e = E.io3(u);
  c.beginPath();
  if (tr.k === 'iris') { c.arc(tr.x ?? 540, tr.y ?? 960, 2300 * e, 0, Math.PI * 2); }
  else if (tr.k === 'heart') { const P = heartPts(tr.x ?? 540, tr.y ?? 900, 3200 * E.in2(u) + 60 * e); c.moveTo(P[0][0], P[0][1]); for (const p of P) c.lineTo(p[0], p[1]); c.closePath(); }
  else if (tr.k === 'diag') { const x = lerp(-900, 1500, e), sl = 600; if (tr.rev) { const xr = 1080 - x; c.moveTo(1300, -100); c.lineTo(xr - sl, -100); c.lineTo(xr + sl, 2100); c.lineTo(1300, 2100); } else { c.moveTo(-200, -100); c.lineTo(x + sl, -100); c.lineTo(x - sl, 2100); c.lineTo(-200, 2100); } }
  else if (tr.k === 'slats') { const n = 8, hh = 1920 / n; for (let j = 0; j < n; j++) { const v = E.io3(clamp(u * 1.6 - j * 0.06 * 1.0)); c.rect(-10, j * hh, 1100 * v, hh + 1); } }
  c.closePath();
}
function accent(tr, u) {
  if (!tr.col) return;
  const e = E.io3(u), w = 70 * (1 - u);
  c.save(); c.strokeStyle = tr.col; c.fillStyle = tr.col;
  if (tr.k === 'iris') { c.lineWidth = w * 1.4; c.beginPath(); c.arc(tr.x ?? 540, tr.y ?? 960, 2300 * e + w * 0.6, 0, Math.PI * 2); c.stroke(); }
  else if (tr.k === 'heart') { const P = heartPts(tr.x ?? 540, tr.y ?? 900, 3200 * E.in2(u) + 60 * e); c.lineWidth = w * 1.6; c.beginPath(); c.moveTo(P[0][0], P[0][1]); for (const p of P) c.lineTo(p[0], p[1]); c.closePath(); c.stroke(); }
  else if (tr.k === 'diag') { const x = lerp(-900, 1500, e), sl = 600; c.beginPath(); if (tr.rev) { const xr = 1080 - x; c.moveTo(xr - sl - 90, -100); c.lineTo(xr - sl, -100); c.lineTo(xr + sl, 2100); c.lineTo(xr + sl - 90, 2100); } else { c.moveTo(x + sl, -100); c.lineTo(x + sl + 90, -100); c.lineTo(x - sl + 90, 2100); c.lineTo(x - sl, 2100); } c.closePath(); c.fill(); }
  else if (tr.k === 'slats') { const n = 8, hh = 1920 / n; for (let j = 0; j < n; j++) { const v = E.io3(clamp(u * 1.6 - j * 0.06)), v2 = E.io3(clamp(u * 1.6 - j * 0.06 - 0.12)); c.fillRect(1100 * v2 - 10, j * hh, Math.max(0, 1100 * (v - v2)), hh + 1); } }
  c.restore();
}

function drawCaps(t) {
  for (const cp of CAPS) {
    const t0 = cp.lines[0].tIn;
    if (t < t0 - 0.05 || t > cp.b + 0.6) continue;
    for (const ln of cp.lines) {
      const o = { size: ln.size, hl: ln.hl, fill: ln.fill, outerCol: ln.outerCol, extCol: ln.extCol };
      for (const k in o) if (o[k] === undefined) delete o[k];
      if (cp.flower) flower(ln.s, 540, ln.y, t, ln.tIn, cp.b, { size: ln.size });
      else cap(ln.s, 540, ln.y, t, ln.tIn, cp.b, o);
    }
  }
}
function tag(t) {
  const a = 1 - ramp(t, B[24] - 0.2, 0.3);
  if (a <= 0) return;
  c.save(); c.globalAlpha *= a;
  const s = popS(t, -0.5, 0.4);
  c.translate(70, 120); c.scale(s, s);
  rrFill(0, -34, 236, 68, 34, PAL.navy);
  circ(36, 0, 20, PAL.yel);
  label('黄毛小科普', 140, 2, 38, '#ffffff', { font: 'SS' });
  c.restore();
}

export function render(t) {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); setCtx(ctx);
  t = clamp(t, 0, DUR - 1 / FPS / 2);
  let i = SHOTS.length - 1;
  for (let j = 0; j < SHOTS.length; j++) if (t >= SHOTS[j][0] && t < SHOTS[j][1]) { i = j; break; }
  const tr = SHOTS[i][3];
  bg(PAL.cream);
  if (tr && tr.k !== 'cut' && i > 0 && t < SHOTS[i][0] + tr.d) {
    const u = (t - SHOTS[i][0]) / tr.d;
    if (tr.k === 'push') {
      const e = E.io3(u);
      c.save(); c.translate(-1080 * e, 0); drawShot(i - 1, t); c.restore();
      c.save(); c.translate(1080 * (1 - e), 0); drawShot(i, t); c.restore();
      c.save(); c.fillStyle = tr.col; c.fillRect(1080 * (1 - e) - 46, -50, 46, 2100); c.restore();
    } else {
      drawShot(i - 1, t);
      c.save(); clipFor(tr, u); c.clip(); drawShot(i, t); c.restore();
      accent(tr, u);
    }
  } else drawShot(i, t);
  drawCaps(t);
  tag(t);
  // drop / climax flashes
  for (const tf of [B[8], B[16]]) { const lt = t - tf; if (lt >= 0 && lt < 0.2) { c.save(); c.globalAlpha = lt < 0.067 ? 0.95 : 0.95 * (1 - (lt - 0.067) / 0.133); c.fillStyle = '#ffffff'; c.fillRect(0, 0, W, H); c.restore(); } }
  // fade out
  if (t > FADE0) { c.save(); c.globalAlpha = E.in2(clamp((t - FADE0) / (DUR - FADE0))); c.fillStyle = '#000'; c.fillRect(0, 0, W, H); c.restore(); }
}
