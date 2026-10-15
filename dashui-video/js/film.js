// 大水理论 · 喝水科普 — 45 s vertical (1080×1920 @30fps) hand-drawn line-boil film.
// Every frame is a pure function of t. Cue grid is locked to the music (112.9 BPM, first beat 0.082 s).
import { PAL, hs, hr, clamp, lerp, inv, sstep, E, K, spline, resample, xf, boil, inkStroke, inkLoop, fillShape, fillPoly,
  circlePts, ellPts, rrectPts, prefix, arclen, morph, toN, pathPts, onN, N3, signedArea, centroid } from './engine.js';
import { loadGlyphs, letters, measure, popIn, flyOut } from './text.js';
import { REG, T, inked, stroke, dot, drawBottle, bottleDense, bottleLevelY, drawCup, cupDense, drawFace, drawDrop, dropDense, puddleDense,
  drawCrown, bodyDense, HEAD, brainDense, BRAIN_FOLDS, drawGlass, glassDense, drawCube, drawSoda, sodaDense, drawClock, drawWarn, drawWifi,
  drawCheckbox, drawApprox, drawArrow, mixHex, waterSurface, DRYC } from './shapes.js';
import { twinkle, starBurst, speedLines, linesH, droplet, splash, crownSplash, ripple, puff, bubble, flood, burstFill } from './fx.js';

export const W = 1080, H = 1920, FPS = 30, DUR = 45.2;
export const BPM = 112.9, PH = 0.082, BEAT = 60 / BPM;
export const bt = (n) => PH + n * BEAT;
export const bar = (k) => bt(4 * k);
const B = Array.from({ length: 24 }, (_, k) => bar(k));
const E8 = BEAT / 2;

let c = null, DPR = 1;
const IMG = {};
const loadImg = (src) => new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = src; });

export async function init(canvas, dpr = 1) {
  DPR = 1;
  canvas.width = W; canvas.height = H;
  c = canvas.getContext('2d');
  await loadGlyphs('./assets/glyphs.json');
  IMG.paper = await loadImg('./assets/paper_base.jpg');
  IMG.tooth = await loadImg('./assets/paper_tooth.png');
}

// ------------------------------------------------------------------ helpers
const win = (t, a, b) => t >= a && t < b;
const pulse = (t, t0, k = 9) => (t < t0 ? 0 : Math.exp(-(t - t0) * k));
function beatPulse(t, beats, k = 9) { let p = 0; for (const b of beats) p = Math.max(p, pulse(t, b, k)); return p; }
function withCam(cam, fn) {
  c.save();
  c.translate(W / 2 + (cam.x || 0), H / 2 + (cam.y || 0));
  c.rotate(cam.r || 0);
  c.scale(cam.s || 1, cam.s || 1);
  c.translate(-W / 2 - (cam.px || 0), -H / 2 - (cam.py || 0));
  fn();
  c.restore();
}
function shakeAt(t, hits) {
  let x = 0, y = 0;
  for (const [t0, a] of hits) {
    const u = t - t0;
    if (u < 0 || u > 0.35) continue;
    const e = a * Math.exp(-u * 14);
    const f = Math.floor(t * FPS);
    x += e * (hs(f, 1) - 0.5) * 2; y += e * (hs(f, 2) - 0.5) * 2;
  }
  return { x, y };
}
// text in/out: pop in at tIn (stagger), shrink out at tOut
function say(str, t, tIn, tOut, o = {}) {
  if (t < tIn || t >= tOut + 0.2) return null;
  const st = o.st ?? 0.05;
  const inA = popIn(t, tIn, st, o.dur ?? 0.26, { rot: o.rot ?? 0.25, drop: o.drop ?? 0, seed: o.seed ?? 3 });
  const anim = (i, n, ch) => {
    const a = inA(i, n);
    if (t >= tOut) { const u = clamp((t - tOut - (n - 1 - i) * 0.015) / 0.12); a.s = (a.s ?? 1) * (1 - E.in2(u)); a.dy = (a.dy ?? 0) - 30 * u; }
    if (o.color && o.color[i]) a.fill = o.color[i];
    if (o.wobble) { a.r = (a.r ?? 0) + o.wobble * Math.sin(t * 9 + i * 1.3); }
    return a;
  };
  return letters(c, str, { ...o, anim, D: o.D });
}
// marker highlight swash under a word (drawn on)
function swash(x0, x1, y, u, D, k, color = PAL.yel, w = 34) {
  if (u <= 0) return;
  const pts = [];
  for (let i = 0; i <= 12; i++) { const v = i / 12; pts.push([lerp(x0, x1, v), y + 6 * Math.sin(v * 3.1 + k)]); }
  const pr = prefix(spline(pts, false, 6), E.out2(clamp(u)));
  if (pr.length < 2) return;
  c.save(); c.globalAlpha *= 0.9;
  inkStroke(c, pr, { seed: D * 13 + k, w, amp: 1.2, color, t0: 8, t1: 14, dense: true, heavy: 0, jit: 0.2 });
  c.restore();
}

// ------------------------------------------------------------------ paper, tooth, tag
function drawPaper() { c.drawImage(IMG.paper, 0, 0, W, H); }
function drawTooth(D) {
  const v = D % 4;
  const ox = Math.floor(hs(v, 51) * 300), oy = Math.floor(hs(v, 52) * 460);
  c.save(); c.setTransform(1, 0, 0, 1, 0, 0);
  c.globalCompositeOperation = 'multiply'; c.globalAlpha = 0.42;
  c.drawImage(IMG.tooth, ox, oy, W, H, 0, 0, W, H);
  c.restore();
}
const TAG = '喝水小科普';
function drawTag(t, D) {
  // series tag, top-left (inside the platform-UI safe zone)
  const a = clamp((t - 0.25) / 0.2);
  if (a <= 0) return;
  const s = E.outBack(a, 2);
  c.save(); c.translate(78, 236); c.scale(s, s); c.rotate(-0.025);
  const tw = measure(TAG, 'MK', 36).w;
  const box = rrectPts(0, -34, 60 + tw + 24, 68, 16);
  fillShape(c, box, PAL.hi, { seed: D * 13 + 7, amp: 0.8, dx: -3, dy: 3 });
  inkLoop(c, box, { seed: D * 13 + 7, w: 3.6, amp: 0.8, heavy: 0.2 });
  const dp = xf(dropDense(100), { x: 34, y: 2, sx: 0.17, sy: 0.17 });
  fillShape(c, dp, PAL.blue, { seed: D * 13 + 8, amp: 0.5, dx: -1.5, dy: 1.5 }); inkLoop(c, dp, { seed: D * 13 + 8, w: 2.6, amp: 0.5 });
  letters(c, TAG, { font: 'MK', size: 36, x: 60, y: 1, align: 'left', fill: PAL.ink, ink: null, D, seed: 5, amp: 0.5 });
  c.restore();
}

// ------------------------------------------------------------------ S1 + S2: 弱者喝饮料 / 强者喝大水 (0 – B2)
const SLAM = 66 / FPS; // impact frame (2.200 s), on the bar-1 downbeat (2.208)
const BOT1 = { x: 540, y: 1010, s: 1.04 };
function sceneHook(t, tq, D) {
  if (t >= B[2] + 0.25) return;
  // ---- milk-tea cup
  if (t < SLAM + 0.5) {
    const pop = K(t, [[0, 0.62], [0.16, 1.1, 'out2'], [0.3, 0.95, 'io2'], [0.42, 1, 'io2']]);
    const bp = beatPulse(tq, [bt(1), bt(2), bt(3)], 10);
    let sx = pop * (1 + 0.06 * bp), sy = pop * (1 - 0.08 * bp);
    let y = 1130, face = 'smug', look = [0, 0], rr = 0.04 * Math.sin(tq * 6);
    if (t > 1.82) { face = 'shock'; look = [0, -10]; rr = 0; }
    if (t >= SLAM) { // squashed flat under the bottle
      const u = clamp((t - SLAM) / 0.08);
      sx = lerp(1.0, 1.75, E.out3(u)); sy = lerp(1.0, 0.16, E.out3(u)); y = lerp(1130, 1345, E.out3(u)); face = 'dizzy';
    }
    if (t < SLAM + 0.4) drawCup(c, T(540, y, 1, rr, sx, sy), { D, t: tq, face, look });
  }
  // falling bottle shadow (anticipation)
  if (t > 1.7 && t < SLAM + 0.05) {
    const u = clamp((t - 1.7) / (SLAM - 1.7));
    c.save(); c.globalAlpha = 0.18 + 0.2 * u;
    fillPoly(c, boil(ellPts(540, 1390, 60 + 140 * E.in2(u), 14 + 16 * E.in2(u), 30), D * 13 + 1, 1.2, 50), PAL.ink);
    c.restore();
  }
  // sugar twinkles around the cup on beats
  if (t < SLAM) {
    [[300, 900, bt(1)], [790, 980, bt(2)], [270, 1210, bt(3)]].forEach(([x, y, tb], i) => {
      const u = clamp((tq - tb) / 0.2); if (u > 0) twinkle(c, x, y, 34 * E.outBack(u, 2.5) * (1 - 0.3 * clamp((tq - tb - 0.4) / 0.3)), D, 40 + i, PAL.yel, 0.2 * i);
    });
    if (t > 1.82) { // "!" over the cup
      const u = clamp((t - 1.82) / 0.12);
      letters(c, '!', { font: 'KL', size: 120, x: 760, y: 820, fill: PAL.red, ink: PAL.ink, inkW: 5, D, seed: 31, anim: () => ({ s: E.outBack(u, 3) }) });
    }
  }
  // impact speed lines (behind the bottle, two fans that avoid the cap)
  if (t >= SLAM && t < SLAM + 0.35) {
    speedLines(c, 540, 1250, 400, 760, 10, D, 300, { w: 9, a0: Math.PI * 1.0, a1: Math.PI * 1.36 });
    speedLines(c, 540, 1250, 400, 760, 10, D, 310, { w: 9, a0: Math.PI * 1.64, a1: Math.PI * 2.0 });
  }
  // ---- the big bottle slams down (the push-in in sceneTitle takes over at B2 - 0.2)
  if (t >= SLAM - 0.14 && t < B[2] - 0.2) {
    let y, sx = 1, sy = 1;
    if (t < SLAM) {
      const u = clamp((t - (SLAM - 0.14)) / 0.14);
      y = lerp(-520, BOT1.y, E.in2(u));
      sy = 1 + 0.9 * u; sx = 1 - 0.2 * u; // smear stretch
    } else {
      const u = t - SLAM;
      y = BOT1.y + 30 * Math.exp(-u * 12) * Math.cos(u * 30);
      sy = 1 - 0.16 * Math.exp(-u * 9) * Math.cos(u * 26);
      sx = 1 + 0.12 * Math.exp(-u * 9) * Math.cos(u * 26);
    }
    // smear frame: speed lines above the bottle
    if (t < SLAM) linesH(c, 0, 0, [], D, 1);
    if (t >= SLAM - 0.07 && t < SLAM) {
      for (let i = 0; i < 7; i++) { const x = 400 + i * 46; inkStroke(c, [[x, y - 600], [x, y - 1100]], { seed: D * 13 + 200 + i, w: 6, amp: 1, t0: 40, t1: 4 }); }
    }
    const u2 = Math.max(0, t - SLAM);
    const exitS = t > B[2] - 0.2 ? 1 : 1;
    const crownOn = clamp((tq - bt(6)) / 0.18);
    // anchor at the base so squash happens from the ground
    const baseY = y + 354 * BOT1.s;
    const tf = T(BOT1.x, baseY - 354 * BOT1.s * sy, BOT1.s, 0, sx, sy);
    drawBottle(c, tf, { D, t: tq, level: 0.72, wave: 6 + 30 * Math.exp(-u2 * 3.5), tilt: 0.12 * Math.exp(-u2 * 3) * Math.sin(u2 * 9) });
    if (crownOn > 0) drawCrown(c, { x: BOT1.x + 6, y: baseY - 354 * BOT1.s * sy * 2 - 30, sx: 0.9 * E.outBack(crownOn, 2.5), sy: 0.9 * E.outBack(crownOn, 2.5), r: 0.14 }, D);
  }
  // impact FX
  if (t >= SLAM && t < SLAM + 0.9) {
    const u = t - SLAM;
    crownSplash(c, 330, 1372, u, D, 320, { w: 200, h: 120, fill: PAL.tea });
    crownSplash(c, 750, 1372, u, D, 321, { w: 200, h: 120, fill: PAL.tea });
    splash(c, 300, 1360, u, D, 330, { n: 7, v: 1100, spread: 1.4, up: -Math.PI * 0.72, size: 28, fill: PAL.tea });
    splash(c, 780, 1360, u, D, 340, { n: 7, v: 1100, spread: 1.4, up: -Math.PI * 0.28, size: 28, fill: PAL.tea });
    if (u > 0.05 && u < 0.6) { puff(c, 250 - 120 * u, 1380, 50 + 40 * u, D, 350); puff(c, 830 + 120 * u, 1380, 50 + 40 * u, D, 351); }
  }
  // twinkles on beats after the slam
  [[230, 820, bt(5)], [860, 900, bt(6)], [250, 1180, bt(7)], [840, 1240, bt(7) + E8]].forEach(([x, y, tb], i) => {
    const u = clamp((tq - tb) / 0.18); if (u > 0 && t < B[2] - 0.2) twinkle(c, x, y, 40 * E.outBack(u, 2.5), D, 60 + i, PAL.yel, 0.3 * i);
  });
  // ---- headlines
  if (t < SLAM + 0.5) {
    const anim = t < SLAM ? popIn(t, 0.0, 0.05, 0.24, { rot: 0.3, seed: 2 }) : flyOut(t, SLAM, 0.5, { seed: 4 });
    letters(c, '弱者喝饮料', { font: 'KL', size: 150, x: 540, y: 440, fill: PAL.red, ink: PAL.ink, inkW: 7, shadow: PAL.ink, D, seed: 11, anim });
  }
  if (t >= SLAM + 0.1) {
    const r = say('强者喝大水', t, SLAM + 0.1, B[2] - 0.2, { font: 'KL', size: 168, x: 540, y: 440, fill: PAL.blue, ink: PAL.ink, inkW: 7.5, shadow: PAL.ink, D, seed: 12, st: 0.045, rot: 0.35 });
    if (r && t < B[2] - 0.2) {
      const L = measure('强者喝', 'KL', 168), M = measure('强者喝大水', 'KL', 168);
      const x0 = 540 - M.w / 2 + L.adv - 10, x1 = 540 + M.w / 2 + 6;
      c.save(); c.globalCompositeOperation = 'multiply';
      swash(x0, x1, 530, (tq - bt(5)) / 0.25, D, 70);
      c.restore();
    }
  }
}

// ------------------------------------------------------------------ S3: 大水理论 title card (B2 – B3)
function badgeShape(t, D, cx, cy, R) {
  // comic water "splat": alternating long / short rounded lobes
  const lobes = 9, pts = [];
  for (let i = 0; i < lobes * 2; i++) {
    const a = i / (lobes * 2) * Math.PI * 2 - Math.PI / 2 + 0.1;
    const long = i % 2 === 0;
    const rr = R * (long ? 1.0 + 0.07 * hs(i, 3) : 0.84 + 0.04 * hs(i, 5)) * (1 + 0.02 * Math.sin(t * 3 + i));
    pts.push([cx + Math.cos(a) * rr * 1.13, cy + Math.sin(a) * rr * 0.84]);
  }
  return resample(spline(pts, true, 5), 5, true);
}
function sceneTitle(t, tq, D) {
  if (t < B[2] - 0.2 || t >= B[3] + 0.3) return;
  // push-in on the label (B2 - 0.2 .. B2)
  if (t < B[2]) {
    const u = clamp((t - (B[2] - 0.2)) / 0.2);
    withCam({ s: 1 + 2.2 * E.in3(u), px: 0, py: (BOT1.y + 86 * BOT1.s - H / 2) * E.out2(u) }, () => {
      drawBottle(c, T(BOT1.x, BOT1.y, BOT1.s), { D, t: tq, level: 0.72, wave: 6 });
      drawCrown(c, { x: BOT1.x + 6, y: BOT1.y - 354 * BOT1.s - 30, sx: 0.9, sy: 0.9, r: 0.14 }, D);
    });
    speedLines(c, 540, 960, 380, 1100, 28, D, 400, { w: 7 });
    return;
  }
  const u = t - B[2];
  const out = clamp((t - (B[3] - 0.02)) / 0.22);
  const cy = 800 - 900 * E.in3(out);
  const s = E.outBack(clamp(u / 0.3), 1.8) * (1 - 0.3 * out);
  if (s <= 0.01) return;
  // badge
  c.save(); c.translate(540, cy); c.scale(s, s); c.translate(-540, -cy);
  const P = badgeShape(tq, D, 540, cy, 390);
  fillShape(c, P, PAL.blue, { seed: D * 13 + 410, amp: 2, dx: REG.dx, dy: REG.dy });
  c.save(); c.beginPath(); pathPts(c, P); c.clip();
  const wv = waterSurface(100, 980, cy + 150, tq, { amp: 14, k: 0.012, sp: 3 });
  fillPoly(c, [...wv, [980, cy + 500], [100, cy + 500]], PAL.blueD);
  c.restore();
  for (let i = 0; i < 5; i++) { const ph = (tq * 0.4 + hs(i, 12)) % 1; bubble(c, 250 + 580 * hs(i, 13), cy + 260 - 420 * ph, 10 + 8 * hs(i, 14), D, 460 + i); }
  inkLoop(c, P, { seed: D * 13 + 410, w: 8, amp: 2, heavy: 0.3 });
  // drips under the badge
  [[380, 1, 0.0], [640, 1.4, 0.4], [760, 0.8, 0.8]].forEach(([x, l, ph], i) => {
    const yy = cy + 330 + 30 * l + 14 * Math.sin(tq * 4 + ph * 6);
    droplet(c, x, yy, 40, Math.PI / 2 + Math.PI, D, 420 + i);
  });
  // inner highlight arcs
  inkStroke(c, [[260, cy - 160], [330, cy - 250], [430, cy - 290]], { seed: D * 13 + 430, w: 16, color: PAL.hi, amp: 1.2, t0: 20, t1: 30 });
  // title letters land on eighths with a splash each
  const tl = (i) => B[2] + i * E8;
  letters(c, '大水理论', { font: 'KL', size: 205, x: 540, y: cy - 12, fill: PAL.hi, ink: PAL.ink, inkW: 8.5, shadow: PAL.ink, D, seed: 21, tracking: 4,
    anim: (i) => { const v = clamp((tq - tl(i)) / 0.2); return { s: v <= 0 ? 0 : E.outBack(v, 2.4), r: (1 - v) * (i % 2 ? 0.3 : -0.3), dy: -(1 - E.out3(v)) * 60 }; } });
  for (let i = 0; i < 4; i++) splash(c, 540 + (i - 1.5) * 205, cy - 110, tq - tl(i), D, 440 + i * 10, { n: 5, v: 650, size: 18, life: 0.5, fill: PAL.blueL });
  c.restore();
  // stamp "全网爆火"
  const su = clamp((tq - bt(11)) / 0.14);
  if (su > 0 && out < 1) {
    const ss = (1 + 1.2 * (1 - E.out3(su))) * (1 - out);
    c.save(); c.translate(250, cy - 330); c.rotate(-0.16); c.scale(ss, ss);
    const box = rrectPts(-150, -52, 300, 104, 18);
    fillShape(c, box, PAL.red, { seed: D * 13 + 450, amp: 1, dx: REG.dx, dy: REG.dy });
    inkLoop(c, box, { seed: D * 13 + 450, w: 5, amp: 1 });
    letters(c, '全网爆火', { font: 'KL', size: 70, x: 0, y: 0, fill: PAL.hi, ink: PAL.ink, inkW: 3.4, D, seed: 23, tracking: 4 });
    c.restore();
  }
  // subline
  if (out < 1) {
    say('每天一瓶 1.5～2L 大瓶水', t, bt(10) + E8, B[3] - 0.05, { font: 'MK', size: 60, x: 540, y: 1255, fill: PAL.ink, ink: null, D, seed: 24, st: 0.025, rot: 0.1 });
    say('用它代替奶茶和饮料', t, bt(11) + E8, B[3] - 0.05, { font: 'MK', size: 60, x: 540, y: 1345, fill: PAL.ink, ink: null, D, seed: 25, st: 0.025, rot: 0.1 });
  }
}

// ------------------------------------------------------------------ shared helpers for the morph chain
const MC = new Map();
// world-space closed contour morph A -> B (both resampled to n points; alignment cached by key)
function morphW(A, B, u, key, n = 240) {
  const a = toN(A, n), b0 = toN(B, n);
  let m = MC.get(key);
  if (!m) {
    const rev = Math.sign(signedArea(a)) !== Math.sign(signedArea(b0));
    const b = rev ? [...b0].reverse() : b0;
    const ca = centroid(a), cb = centroid(b);
    let best = 0, bd = Infinity;
    for (let k = 0; k < n; k += 2) {
      let d = 0;
      for (let i = 0; i < n; i += 3) { const p = a[i], q = b[(i + k) % n]; const dx = (p[0] - ca[0]) - (q[0] - cb[0]), dy = (p[1] - ca[1]) - (q[1] - cb[1]); d += dx * dx + dy * dy; }
      if (d < bd) { bd = d; best = k; }
    }
    m = { rev, best }; MC.set(key, m);
  }
  const b = m.rev ? [...b0].reverse() : b0;
  return a.map((p, i) => { const q = b[(i + m.best) % n]; return [p[0] + (q[0] - p[0]) * u, p[1] + (q[1] - p[1]) * u]; });
}
function drawMorph(P, fill, D, k, o = {}) {
  if (fill) fillShape(c, P, fill, { seed: D * 13 + k, amp: o.amp ?? 1.6, dx: REG.dx, dy: REG.dy });
  inkLoop(c, P, { seed: D * 13 + k, w: o.w ?? 7.5, amp: o.amp ?? 1.6, heavy: 0.3 });
}
// open polyline slice [a, b] of its arclength
function sliceOpen(P, a, b) {
  const L = arclen(P), tot = L[L.length - 1];
  const out = [];
  const at = (s) => { let j = 1; while (j < L.length - 1 && L[j] < s) j++; const u = (s - L[j - 1]) / Math.max(1e-9, L[j] - L[j - 1]); return [lerp(P[j - 1][0], P[j][0], u), lerp(P[j - 1][1], P[j][1], u)]; };
  const sa = a * tot, sb = b * tot;
  out.push(at(sa));
  for (let i = 0; i < P.length; i++) if (L[i] > sa && L[i] < sb) out.push(P[i]);
  out.push(at(sb));
  return out;
}
const lerpPts = (A, B, u) => A.map((p, i) => [lerp(p[0], B[i][0], u), lerp(p[1], B[i][1], u)]);
const appear = (t, t0, d = 0.25, s = 2.2) => (t < t0 ? 0 : E.outBack(clamp((t - t0) / d), s));
const vanish = (t, t0, d = 0.16) => 1 - E.in2(clamp((t - t0) / d));
const BRAIN_PINK = '#f5a3b5', BRAIN_INK = '#c4566f';
const DRY = '#8fb2cf';
const TINT = '#e3ebe6'; // opaque stand-in for the bottle's plastic tint (morph fills)

// brain with folds + face
function drawBrain(tf, st) {
  const { D, face = 'happy', look = [0, 0], folds = 1 } = st;
  const P = xf(brainDense(), tf);
  fillShape(c, P, BRAIN_PINK, { seed: D * 13 + 1500, amp: 1.6, dx: REG.dx, dy: REG.dy });
  BRAIN_FOLDS.forEach((F, i) => {
    const pr = prefix(spline(F, false, 4), clamp(folds * 1.4 - i * 0.08));
    if (pr.length > 1) inkStroke(c, xf(pr, tf), { seed: D * 13 + 1510 + i, w: 6, amp: 1.2, color: BRAIN_INK, t0: 8, t1: 10, dense: true });
  });
  stroke(c, [[-160, -100], [-120, -136], [-60, -150]], tf, D, 1520, { w: 10, color: PAL.hi, t0: 10, t1: 14 });
  inkLoop(c, P, { seed: D * 13 + 1500, w: 7.5, amp: 1.6, heavy: 0.35 });
  drawFace(c, tf, { D, kind: face, y: 40, gap: 62, size: 1.25, look, k: 1530 });
  return P;
}
// round sticker badge with text
function drawBadge(x, y, R, s, fill, str, D, k, o = {}) {
  if (s <= 0.01) return;
  c.save(); c.translate(x, y); c.rotate(o.r ?? 0); c.scale(s, s);
  const P = boil(circlePts(0, 0, R, 48), D * 13 + k, 1.2, 50);
  fillShape(c, P, fill, { seed: D * 13 + k, amp: 1, dx: REG.dx * 0.7, dy: REG.dy * 0.7 });
  inkLoop(c, P, { seed: D * 13 + k, w: 6, amp: 1.2, heavy: 0.3 });
  letters(c, str, { font: o.font ?? 'KL', size: o.size ?? R * 0.62, x: 0, y: 2, fill: o.color ?? PAL.ink, ink: o.ink === undefined ? null : o.ink, inkW: 3, D, seed: k, amp: 0.6 });
  c.restore();
}
// tear-off calendar page
function drawCalendar(x, y, s, label, D, k) {
  if (s <= 0.01) return;
  c.save(); c.translate(x, y); c.scale(s, s);
  const body = rrectPts(-112, -96, 224, 206, 20);
  fillShape(c, body, PAL.hi, { seed: D * 13 + k, amp: 1, dx: REG.dx, dy: REG.dy });
  const head = rrectPts(-112, -96, 224, 66, 20);
  fillShape(c, head, PAL.red, { seed: D * 13 + k + 1, amp: 1, dx: REG.dx * 0.6, dy: REG.dy * 0.6 });
  inkStroke(c, [[-110, -30], [110, -30]], { seed: D * 13 + k + 2, w: 5, amp: 1, t0: 4, t1: 4 });
  inkLoop(c, body, { seed: D * 13 + k, w: 6.5, amp: 1.2, heavy: 0.3 });
  for (const rx of [-56, 56]) inkStroke(c, [[rx, -118], [rx, -76]], { seed: D * 13 + k + 3 + rx, w: 11, amp: 0.6, t0: 3, t1: 3 });
  letters(c, label, { font: 'KL', size: 62, x: 0, y: 42, fill: PAL.ink, ink: null, D, seed: k, amp: 0.6 });
  c.restore();
}
// horizontal pill progress bar
const PILL = { x: 110, y: 925, w: 860, h: 160 };
const pillDense = () => rrectPts(PILL.x, PILL.y, PILL.w, PILL.h, PILL.h / 2, 5);
function drawPill(p, tq, D) {
  const P = pillDense();
  fillShape(c, P, PAL.hi, { seed: D * 13 + 1600, amp: 1.2, dx: REG.dx, dy: REG.dy });
  if (p > 0.002) {
    const cy = PILL.y + PILL.h / 2;
    c.save(); c.beginPath(); pathPts(c, boil(P.map((q) => [540 + (q[0] - 540) * 0.965, cy + (q[1] - cy) * 0.86]), D * 13 + 1601, 1, 60)); c.clip();
    const xf0 = PILL.x + PILL.w * p;
    const edge = [];
    for (let i = 0; i <= 14; i++) { const v = i / 14; const yy = lerp(PILL.y - 20, PILL.y + PILL.h + 20, v); edge.push([xf0 + 12 * Math.sin(v * 7 + tq * 9), yy]); }
    fillPoly(c, [[PILL.x - 40, PILL.y - 20], ...edge, [PILL.x - 40, PILL.y + PILL.h + 20]].map((q) => [q[0] + REG.dx, q[1] + REG.dy]), PAL.blueL);
    fillPoly(c, [[PILL.x - 40, PILL.y + PILL.h * 0.62], ...edge.filter((q) => q[1] > PILL.y + PILL.h * 0.62), [PILL.x - 40, PILL.y + PILL.h + 20]], PAL.blue);
    inkStroke(c, edge, { seed: D * 13 + 1602, w: 5, amp: 1, color: PAL.blueD, t0: 3, t1: 3, dense: true });
    c.restore();
  }
  for (let k = 1; k < 4; k++) { const x = PILL.x + PILL.w * k / 4; inkStroke(c, [[x, PILL.y + 18], [x, PILL.y + 46]], { seed: D * 13 + 1610 + k, w: 4, amp: 0.8, t0: 2, t1: 2, color: 'rgba(28,22,19,0.6)' }); }
  stroke(c, [[PILL.x + 60, PILL.y + 34], [PILL.x + 240, PILL.y + 30]], { x: 0, y: 0, sx: 1, sy: 1 }, D, 1620, { w: 10, color: PAL.hi, t0: 10, t1: 10 });
  inkLoop(c, P, { seed: D * 13 + 1600, w: 8, amp: 1.4, heavy: 0.3 });
  return P;
}
// a line of headline (shared style)
const HL = (str, t, tIn, tOut, y, o = {}) => say(str, t, tIn, tOut, { font: 'KL', size: o.size ?? 120, x: o.x ?? 540, y, fill: o.fill ?? PAL.hi, ink: PAL.ink, inkW: o.inkW ?? 6.5, shadow: PAL.ink, D: o.D, seed: o.seed ?? 50, st: o.st ?? 0.045, rot: 0.3, color: o.color, align: o.align });
const SUB = (str, t, tIn, tOut, y, o = {}) => say(str, t, tIn, tOut, { font: 'MK', size: o.size ?? 60, x: o.x ?? 540, y, fill: o.fill ?? PAL.ink, ink: null, D: o.D, seed: o.seed ?? 60, st: 0.022, rot: 0.1 });

// ------------------------------------------------------------------ S4: 是玩梗？还是真科学？ (B3 – B4)
const QM = [[352, 835], [376, 737], [452, 675], [556, 663], [660, 693], [718, 775], [702, 865], [640, 929], [575, 979], [545, 1045], [540, 1121], [540, 1170]];
let QPTS = null;
const qPts = () => (QPTS ||= resample(spline(QM, false, 4), 4));
const DOT = { x: 540, y: 1305, s: 0.55 };
function sceneQuestion(t, tq, D) {
  if (t < B[3] || t >= B[4] + 0.6) return;
  const Q = qPts();
  const mu = E.io3(clamp((t - B[4]) / 0.32)); // "?" -> water line
  const surf = waterSurface(110, 970, 1000, tq, { amp: 9, k: 0.012, sp: 4, n: 60 });
  if (t < B[4]) {
    const du = E.io2(clamp((t - B[3] - 0.06) / 0.5));
    const pr = prefix(Q, du);
    if (pr.length > 1) {
      inkStroke(c, pr.map((p) => [p[0] + REG.dx * 2, p[1] + REG.dy * 2]), { seed: D * 13 + 700, w: 64, amp: 1.4, color: PAL.yel, t0: 30, t1: 12, dense: true, heavy: 0 });
      inkStroke(c, pr, { seed: D * 13 + 701, w: 26, amp: 1.6, t0: 26, t1: 10, dense: true, heavy: 0.2 });
    }
  }
  // drop = the dot of the "?"
  if (t < B[4]) {
    const tl = bt(13);
    let y = DOT.y, sx = 1, sy = 1, expr = 'happy', look = [0, -6];
    if (t < tl) { const u = clamp((t - (tl - 0.28)) / 0.28); y = lerp(-200, DOT.y, E.in2(u)); sy = 1 + 0.5 * u; sx = 1 - 0.2 * u; }
    else { const u = t - tl; sy = 1 - 0.28 * Math.exp(-u * 8) * Math.cos(u * 22); sx = 1 + 0.2 * Math.exp(-u * 8) * Math.cos(u * 22); }
    if (t > bt(14) + E8 && t < bt(14) + E8 + 0.14) expr = 'blink';
    if (t > bt(15)) { look = [10, -10]; }
    const bp = beatPulse(tq, [bt(14), bt(15)], 10);
    if (t >= tl - 0.28) drawDrop(c, T(DOT.x, DOT.y + (y - DOT.y) + 54 * (1 - sy) * DOT.s, DOT.s, 0, sx * (1 + 0.05 * bp), sy * (1 - 0.06 * bp)), { D, t: tq, expr, look });
    if (t >= tl && t < tl + 0.4) ripple(c, DOT.x, DOT.y + 58, t - tl, D, 720, { n: 2, rx: 120, ry: 22, life: 0.4, w: 4 });
  }
  // twinkles
  [[210, 760, bt(13)], [880, 900, bt(14)], [860, 650, bt(15)]].forEach(([x, y, tb], i) => { const u = clamp((tq - tb) / 0.18); if (u > 0 && t < B[4]) twinkle(c, x, y, 36 * E.outBack(u, 2.5), D, 730 + i, PAL.yel, 0.3 * i); });
  HL('是玩梗？', t, bt(12) + E8, B[4] - 0.12, 395, { D, fill: PAL.yel, seed: 41 });
  HL('还是真科学？', t, bt(14), B[4] - 0.12, 530, { D, fill: PAL.blue, seed: 42 });
  return { Q, surf, mu };
}

// ------------------------------------------------------------------ S5: drop -> water -> ripple -> body outline (B4 – B5)
const BODY = { x: 540, y: 1040, s: 0.95 };
let BODYW = null;
const bodyW = () => (BODYW ||= xf(bodyDense(), { x: BODY.x, y: BODY.y, sx: BODY.s, sy: BODY.s }));
const TM = bt(18); // ripple -> body morph start
function sceneSplash(t, tq, D) {
  if (t < B[4] || t >= B[5] + 0.05) return;
  const Q = qPts();
  const surf = waterSurface(110, 970, 1000, tq, { amp: 9, k: 0.012, sp: 4, n: 60 });
  // "?" -> water line (open-curve morph), then the line retracts into the body
  const mu = E.io3(clamp((t - B[4]) / 0.32));
  const qN = toN(Q, 61, false);
  let line = lerpPts(qN, surf, mu);
  const ret = E.io2(clamp((t - (TM - 0.1)) / 0.4));
  if (ret < 1) {
    if (ret > 0) line = sliceOpen(line, 0.5 * ret, 1 - 0.5 * ret);
    if (line.length > 1) {
      inkStroke(c, line.map((p) => [p[0] + REG.dx * 2, p[1] + REG.dy * 2]), { seed: D * 13 + 700, w: lerp(64, 30, mu), amp: 1.4, color: mixHex(PAL.yel, PAL.blueL, mu), t0: 30, t1: 12, dense: true, heavy: 0 });
      inkStroke(c, line, { seed: D * 13 + 701, w: lerp(26, 12, mu), amp: 1.6, t0: 26, t1: 10, dense: true, heavy: 0.2, color: mixHex(PAL.ink, PAL.blueD, mu) });
    }
  }
  // the drop jumps and dives into the line
  const ti = bt(17);
  if (t < ti) {
    const v = clamp((t - B[4]) / (ti - B[4]));
    const y = lerp(DOT.y, 1000, v) - 4 * 430 * v * (1 - v);
    const vy = (1000 - DOT.y) - 4 * 430 * (1 - 2 * v);
    const st = 1 + 0.35 * clamp(Math.abs(vy) / 900);
    drawDrop(c, T(DOT.x, y, DOT.s, -Math.PI * 2 * E.io2(v), 1 / Math.sqrt(st), st), { D, t: tq, expr: v < 0.5 ? 'happy' : 'shock', look: [0, -6] });
  }
  const ui = t - ti;
  if (ui >= 0 && ui < 0.8) {
    crownSplash(c, 540, 1004, ui, D, 740, { w: 240, h: 150, fill: PAL.blueL, life: 0.5 });
    splash(c, 540, 990, ui, D, 750, { n: 9, v: 1050, spread: 1.6, size: 26, life: 0.75, fill: PAL.blue });
  }
  // ripples; ring 0 is captured by the morph at TM
  if (ui >= 0) {
    for (let i = 0; i < 3; i++) {
      const u = (t - ti - i * 0.16) / 1.0;
      if (u <= 0 || u >= 1) continue;
      if (i === 0 && t >= TM) continue;
      const e = E.out3(u);
      c.save(); c.globalAlpha *= (1 - u) * (1 - clamp((t - TM) / 0.15));
      inkLoop(c, ellPts(540, 1010, 330 * (0.15 + 0.85 * e), 64 * (0.15 + 0.85 * e), 48), { seed: D * 13 + 760 + i, w: 7 * (1 - 0.6 * u), amp: 1, heavy: 0, color: PAL.blueD });
      c.restore();
    }
  }
  // ripple ring -> body outline (shape morph, line-art)
  if (t >= TM && t < B[5] - 0.02) {
    const u0 = (TM - ti) / 1.0, e0 = E.out3(u0);
    const ring = ellPts(540, 1010, 330 * (0.15 + 0.85 * e0), 64 * (0.15 + 0.85 * e0), 96);
    const u = E.io3(clamp((t - TM) / 0.5));
    const P = morphW(ring, bodyW(), u, 'ring-body', 260);
    c.save(); c.globalAlpha *= lerp(1 - u0, 1, clamp((t - TM) / 0.15));
    inkLoop(c, P, { seed: D * 13 + 770, w: lerp(5, 8.5, u), amp: 1.6, heavy: 0.3, color: u < 0.5 ? PAL.blueD : PAL.ink });
    c.restore();
    const fu = clamp((t - TM - 0.45) / 0.2);
    if (fu > 0) drawFace(c, T(BODY.x, BODY.y + HEAD.y * BODY.s, BODY.s * E.outBack(fu, 2.5)), { D, kind: 'happy', y: 4, gap: 30, size: 0.95, k: 780 });
  }
  HL('先看看你的身体', t, TM, B[5] - 0.1, 430, { D, seed: 43, size: 115 });
}

// ------------------------------------------------------------------ S6: 人体约 60% 是水 (B5 – B6)
const LV60 = BODY.y + 424 * BODY.s - 0.6 * 844 * BODY.s; // 60% of the body height, from the feet
function bodyWater(level, tq, D, alpha = 1) {
  const P = bodyW();
  c.save(); c.beginPath(); pathPts(c, boil(xf(bodyDense(), { x: BODY.x, y: BODY.y + 3, sx: BODY.s * 0.965, sy: BODY.s * 0.985 }), D * 13 + 801, 1.2, 60)); c.clip();
  c.globalAlpha *= alpha;
  const surf = waterSurface(300, 780, level, tq, { amp: 9, k: 0.02, sp: 5 });
  fillPoly(c, [...surf, [780, 1500], [300, 1500]].map((q) => [q[0] + REG.dx, q[1] + REG.dy]), PAL.blueL);
  fillPoly(c, [...waterSurface(300, 780, Math.max(level, 1100) + 120, tq * 0.7, { amp: 5 }), [780, 1500], [300, 1500]], PAL.blue);
  inkStroke(c, surf, { seed: D * 13 + 802, w: 6, amp: 1.2, color: PAL.blueD, t0: 4, t1: 4, dense: true });
  for (let i = 0; i < 6; i++) { const ph = (tq * 0.45 + hs(i, 31)) % 1; const by = lerp(1430, level + 20, ph); if (by > level + 14) bubble(c, 420 + 240 * hs(i, 32) + 8 * Math.sin(tq * 3 + i), by, 8 + 6 * hs(i, 33), D, 810 + i); }
  c.restore();
  return P;
}
function sceneBody(t, tq, D) {
  if (t < B[5] - 0.02 || t >= B[6]) return;
  const lv = lerp(1460, LV60, E.out3(clamp((t - B[5]) / 0.9)));
  bodyWater(lv, tq, D);
  inkLoop(c, bodyW(), { seed: D * 13 + 770, w: 8.5, amp: 1.6, heavy: 0.3 });
  const blink = t > bt(23) + E8 && t < bt(23) + E8 + 0.14;
  drawFace(c, T(BODY.x, BODY.y + HEAD.y * BODY.s, BODY.s), { D, kind: blink ? 'blink' : 'happy', y: 4, gap: 30, size: 0.95, k: 780 });
  // 60% bracket at the left
  const tb = bt(22);
  const du = E.out2(clamp((t - tb) / 0.22));
  if (du > 0) {
    const y1 = BODY.y + 424 * BODY.s;
    const pr = prefix([[300, y1], [300, lerp(y1, LV60, 0.5)], [300, LV60]], du);
    if (pr.length > 1) inkStroke(c, pr, { seed: D * 13 + 820, w: 7, amp: 1.2, t0: 3, t1: 3, dense: false });
    inkStroke(c, [[282, y1], [318, y1]], { seed: D * 13 + 821, w: 6, amp: 1, t0: 2, t1: 2 });
    if (du >= 1) inkStroke(c, [[282, LV60], [330, LV60]], { seed: D * 13 + 822, w: 6, amp: 1, t0: 2, t1: 2 });
    const s = appear(t, tb + 0.12, 0.25, 2.6);
    if (s > 0) letters(c, '60%', { font: 'KL', size: 96, x: 182, y: lerp(y1, LV60, 0.5), fill: PAL.blue, ink: PAL.ink, inkW: 5.5, shadow: PAL.ink, D, seed: 83, anim: () => ({ s, r: -0.08 }) });
  }
  const twk = clamp((tq - tb) / 0.18);
  if (twk > 0) { twinkle(c, 860, 840, 40 * E.outBack(twk, 2.5), D, 830, PAL.yel); twinkle(c, 830, 1260, 30 * E.outBack(twk, 2.5), D, 831, PAL.yel, 0.4); }
  HL('人体约 60% 是水', t, B[5] + E8, B[6] - 0.1, 430, { D, seed: 44, size: 118, color: { 3: PAL.blue, 4: PAL.blue, 5: PAL.blue } });
}

// ------------------------------------------------------------------ S7: 缺水 2% → 大脑“掉线” (B6 – B7)
const BRAIN = { x: 540, y: 1075, s: 1.45 };
let BRAINW = null;
const brainW = () => (BRAINW ||= xf(brainDense(), { x: BRAIN.x, y: BRAIN.y, sx: BRAIN.s, sy: BRAIN.s }));
function sceneBrain(t, tq, D) {
  if (t < B[6] || t >= B[7]) return;
  const mu = E.io3(clamp((t - B[6]) / 0.3));
  const drops = [bt(25), bt(26), bt(27)];
  const bars = 3 - drops.filter((x) => tq >= x).length;
  const hit = beatPulse(t, drops, 12);
  if (mu < 1) {
    const P = morphW(bodyW(), brainW(), mu, 'body-brain', 260);
    drawMorph(P, mixHex(PAL.blueL, BRAIN_PINK, mu), D, 850);
  } else {
    const face = bars === 3 ? 'happy' : bars === 2 ? 'shock' : 'dizzy';
    const sh = hit * 14 * Math.sin(t * 80);
    drawBrain({ x: BRAIN.x + sh, y: BRAIN.y, sx: BRAIN.s * (1 + 0.04 * hit), sy: BRAIN.s * (1 - 0.05 * hit), r: 0.02 * Math.sin(tq * 5) }, { D, face, folds: clamp((t - B[6] - 0.3) / 0.35) });
    if (bars === 0) { // dizzy stars orbiting
      for (let i = 0; i < 3; i++) { const a = tq * 5 + i * 2.1; twinkle(c, 540 + Math.cos(a) * 250, 800 + Math.sin(a) * 40, 30, D, 860 + i, PAL.yel, a); }
    }
  }
  // wifi above the brain
  const ws = appear(t, B[6] + 0.25, 0.25, 2.4);
  if (ws > 0) {
    const sh = hit * 10 * Math.sin(t * 90);
    drawWifi(c, T(540 + sh, 772, 0.62 * ws), { D, bars, color: bars >= 2 ? PAL.blue : PAL.red });
    drops.forEach((tb, i) => { const u = t - tb; if (u > 0 && u < 0.4) { c.save(); c.globalAlpha = 1 - u / 0.4; letters(c, '×', { font: 'KL', size: 70, x: 680 + 40 * i, y: 700 - 120 * u, fill: PAL.red, ink: PAL.ink, inkW: 3, D, seed: 870 + i }); c.restore(); } });
  }
  HL('只要缺水 2%', t, B[6] + E8, B[7] - 0.1, 430, { D, seed: 45, size: 120, color: { 4: PAL.red, 5: PAL.red } });
  HL('大脑就会“掉线”', t, bt(25), B[7] - 0.1, 565, { D, seed: 46, size: 108, fill: PAL.yel });
  SUB('注意力、记忆力都会下降', t, bt(26) + E8, B[7] - 0.1, 1420, { D, seed: 47, size: 60 });
}

// ------------------------------------------------------------------ S8: 等你口渴时，身体早就缺水了 (B7 – B8 + flood)
const DD = { x: 540, y: 1110, s: 1.9 };
const dryShape = (dry) => morph(dropDense(100), puddleDense(100), E.io2(dry), 200, 'drop-puddle');
function sceneThirst(t, tq, D) {
  if (t < B[7] || t >= B[8] + 0.2) return;
  const mu = E.io3(clamp((t - B[7]) / 0.36));
  const riser = clamp((t - 16.0) / (B[8] - 16.0));
  const dry = 0.45 + 0.25 * E.in2(riser);
  if (mu < 1) {
    const P = morphW(brainW(), xf(dryShape(0.45), { x: DD.x, y: DD.y, sx: DD.s, sy: DD.s }), mu, 'brain-drop', 240);
    drawMorph(P, mixHex(BRAIN_PINK, mixHex(PAL.blue, DRYC, clamp(0.45 * 1.3)), mu), D, 880);
  } else {
    const tr = riser * 9 * Math.sin(t * 70);
    const breathe = 0.03 * Math.sin(tq * 6);
    drawDrop(c, T(DD.x + tr, DD.y, DD.s, 0.03 * Math.sin(tq * 4), 1 + breathe, 1 - breathe), { D, t: tq, dry, expr: 'wilt', sweat: true });
    // heat squiggles rising
    for (let i = 0; i < 4; i++) {
      const x0 = [250, 330, 750, 830][i];
      const ph = (tq * 0.8 + i * 0.27) % 1;
      const yb = 1300 - 260 * ph;
      const pts = []; for (let k = 0; k <= 10; k++) { const v = k / 10; pts.push([x0 + 16 * Math.sin(v * Math.PI * 3 + tq * 6 + i), yb - 170 * v]); }
      c.save(); c.globalAlpha *= Math.sin(ph * Math.PI) * 0.9;
      inkStroke(c, pts, { seed: D * 13 + 890 + i, w: 7, amp: 1, color: PAL.red, t0: 10, t1: 10 });
      c.restore();
    }
  }
  HL('等你口渴时', t, B[7] + E8, B[8] - 0.2, 430, { D, seed: 48, size: 120 });
  HL('身体早就缺水了', t, bt(29) + E8, B[8] - 0.2, 565, { D, seed: 49, size: 112, color: { 2: PAL.red, 3: PAL.red } });
}

// ------------------------------------------------------------------ S9: flood → 那每天该喝多少水？ (B8 – B9)
const FL0 = 16.96, FL1 = 17.22, DR0 = B[9] - 0.25, DR1 = B[9] + 0.1;
function waterBG(t, tq, D, k) {
  c.fillStyle = PAL.blue; c.fillRect(-60, -60, W + 120, H + 120);
  c.save(); c.globalAlpha = 0.16;
  for (let i = 0; i < 3; i++) { const x = 160 + i * 330 + 40 * Math.sin(tq * 1.5 + i); fillPoly(c, [[x, -40], [x + 120, -40], [x - 240, H + 40], [x - 420, H + 40]], PAL.blueL); }
  c.restore();
  for (let i = 0; i < 14; i++) { const ph = (tq * (0.25 + 0.2 * hs(k, i)) + hs(k, i, 2)) % 1; bubble(c, 80 + 920 * hs(k, i, 3) + 14 * Math.sin(tq * 3 + i), lerp(1950, -50, ph), 9 + 16 * hs(k, i, 4), D, k + i); }
}
function sceneFlood(t, tq, D) {
  if (t < FL0 || t >= DR1) return;
  if (t < FL1) { // rising wave front
    const u = E.io2(clamp((t - FL0) / (FL1 - FL0)));
    flood(c, lerp(2060, -170, u), tq, D, 900, { amp: 36 });
    return;
  }
  if (t >= DR0) { // draining
    const u = E.in2(clamp((t - DR0) / (DR1 - DR0)));
    flood(c, lerp(-170, 2100, u), tq, D, 901, { amp: 30 });
    return;
  }
  waterBG(t, tq, D, 910);
  // the drop revives underwater
  const u = t - B[8];
  const dry = 0.7 * (1 - E.out3(clamp(u / 0.25)));
  const bp = beatPulse(tq, [bt(33), bt(34), bt(35)], 9);
  const out = vanish(t, DR0 - 0.18, 0.16);
  const s = 1.75 * (1 + 0.15 * Math.exp(-Math.max(0, u) * 6) * Math.sin(Math.max(0, u) * 18)) * out;
  const expr = u < 0.22 ? 'shock' : t < bt(34) ? 'happy' : 'strong';
  if (s > 0.02) drawDrop(c, T(540, 1150 - 40 * bp + 10 * Math.sin(tq * 3), s, 0.05 * Math.sin(tq * 4), 1 + 0.06 * bp, 1 - 0.06 * bp), { D, t: tq, dry, expr, arms: t >= bt(34) ? 'up' : 'none', fill: '#d5ecff' });
  if (u < 0.6) splash(c, 540, 900, u, D, 920, { n: 10, v: 900, spread: 3.2, size: 24, life: 0.6, fill: PAL.blueL });
  HL('那每天', t, B[8] + E8, DR0 - 0.15, 420, { D, seed: 51, size: 118 });
  HL('该喝多少水？', t, bt(34), DR0 - 0.15, 565, { D, seed: 52, size: 132, fill: PAL.yel });
}

// ------------------------------------------------------------------ S10: 每天喝 1500～1700 毫升 (B9 – B10)
const GPOS = [[255, 930], [445, 930], [635, 930], [825, 930], [255, 1170], [445, 1170], [635, 1170], [825, 1170]];
const GS = 1.15;
const gIn = (i) => bt(37) + E8 + i * (E8 / 2);
const GORDER = [1, 2, 5, 6, 0, 3, 4, 7];
const gOut = (i) => B[10] + GORDER.indexOf(i) * (E8 / 2); // departure toward the bottle (inner glasses first)
const B11B = { x: 540, y: 1010, s: 0.9 };
const MOUTH = [540, B11B.y - 350 * B11B.s - 8];
function sceneAmount(t, tq, D) {
  if (t < B[9] - 0.1 || t >= B[11]) return;
  // number line
  if (t < B[10] + 0.1) {
    HL('每天喝', t, B[9], B[10] - 0.12, 400, { D, seed: 53, size: 100 });
    const M1 = measure('1500～1700', 'KL', 136).w, M2 = measure('毫升', 'KL', 76).w;
    const tot = M1 + 22 + M2;
    HL('1500～1700', t, bt(37), B[10] - 0.12, 545, { D, seed: 54, size: 136, fill: PAL.blue, x: 540 - tot / 2 + M1 / 2, st: 0.035 });
    HL('毫升', t, bt(37) + 0.3, B[10] - 0.12, 568, { D, seed: 55, size: 76, x: 540 + tot / 2 - M2 / 2 });
    SUB('数据来源：《中国居民膳食指南（2022）》', t, bt(38), B[10] - 0.12, 1400, { D, seed: 56, size: 42, fill: '#5b4d44' });
  }
  // glasses: pop in on 16ths, then fly into the bottle one by one
  if (t >= B[10] - 0.06) {
    const s = appear(t, B[10] - 0.06, 0.25, 2);
    drawBottle(c, T(B11B.x, B11B.y, B11B.s * s), { D, t: tq, level: bottleFill(t), wave: 6 + 10 * beatPulse(t, GPOS.map((_, i) => gOut(i) + 0.3), 6) });
  }
  GPOS.forEach(([gx, gy], i) => {
    if (t < gIn(i)) return;
    const s = appear(t, gIn(i), 0.22, 2.4);
    const bob = 6 * Math.sin(tq * 6 + i);
    if (t < gOut(i)) { drawGlass(c, T(gx, gy + bob, GS * s), { D, t: tq, k: i, level: 0.78 }); return; }
    const u = clamp((t - gOut(i)) / 0.3);
    if (u >= 1) return;
    const x = lerp(gx, MOUTH[0], E.io2(u)), y = lerp(gy, MOUTH[1] - 40, u) - 240 * Math.sin(Math.PI * u);
    const r = (gx < 540 ? 1 : -1) * 2.1 * E.in2(u);
    drawGlass(c, T(x, y, GS * lerp(1, 0.4, E.in2(u)), r), { D, t: tq, k: i, level: 0.78 * (1 - E.in2(u)) });
  });
  GPOS.forEach((_, i) => { const u = t - gOut(i) - 0.3; if (u > 0 && u < 0.4) splash(c, MOUTH[0], MOUTH[1], u, D, 940 + i * 10, { n: 4, v: 600, spread: 1.6, size: 16, life: 0.4, fill: PAL.blueL }); });
}
const bottleFill = (t) => GPOS.reduce((a, _, i) => a + 0.1 * E.out2(clamp((t - gOut(i) - 0.3) / 0.14)), 0);

// ------------------------------------------------------------------ S11: ≈ 一瓶大水！ (B10 – B11)
function approxLine(str, t, tIn, tOut, y, o = {}) {
  const size = o.size ?? 140, as = size / 96;
  const M = measure(str, 'KL', size).w, aw = 72 * as, gap = 24;
  const tot = aw + gap + M, x0 = 540 - tot / 2;
  const s = appear(t, tIn, 0.22, 2.4) * (t >= tOut ? vanish(t, tOut, 0.12) : 1);
  if (s > 0.01) { c.save(); c.translate(x0 + aw / 2, y); c.scale(s, s); drawApprox(c, 0, 0, as, o.D, o.acol ?? PAL.ink); c.restore(); }
  HL(str, t, tIn + 0.08, tOut, y, { ...o, size, x: x0 + aw + gap + M / 2 });
}
function sceneOneBottle(t, tq, D) {
  if (t < B[10] || t >= B[11]) return;
  approxLine('一瓶大水！', t, bt(42), B[11] - 0.12, 440, { D, seed: 57, size: 140, fill: PAL.blue });
  const u = clamp((tq - bt(42)) / 0.2);
  if (u > 0) { twinkle(c, 250, 760, 46 * E.outBack(u, 2.5), D, 960, PAL.yel); twinkle(c, 840, 820, 38 * E.outBack(u, 2.5), D, 961, PAL.yel, 0.5); twinkle(c, 820, 1240, 30 * E.outBack(u, 2.5), D, 962, PAL.yel, 0.2); }
  SUB('大水理论，还真有依据', t, bt(43), B[11] - 0.12, 1420, { D, seed: 58, size: 62 });
}

// ------------------------------------------------------------------ S12: bottle → progress bar (B11 – B12)
const PSTEP = [bt(44) + E8, bt(45) + E8, bt(46) + E8, bt(47) + E8];
const prog = (t) => PSTEP.reduce((a, ts) => a + 0.25 * E.outBack(clamp((t - ts) / 0.2), 1.4), 0);
let BOT11W = null;
const bot11W = () => (BOT11W ||= xf(bottleDense(), { x: B11B.x, y: B11B.y, sx: B11B.s, sy: B11B.s }));
function sceneProgress(t, tq, D) {
  if (t < B[11] || t >= B[12]) return;
  const mu = E.io3(clamp((t - B[11]) / 0.38));
  if (mu < 1) {
    const P = morphW(bot11W(), pillDense(), mu, 'bottle-pill', 260);
    drawMorph(P, mixHex(PAL.blueL, PAL.hi, mu), D, 1000);
  } else {
    const p = Math.min(1, prog(t));
    drawPill(p, tq, D);
    ['8点', '12点', '16点', '20点'].forEach((lab, k) => {
      const s = appear(t, PSTEP[k], 0.22, 2.6);
      if (s > 0) letters(c, lab, { font: 'MK', size: 50, x: PILL.x + PILL.w * (k + 0.5) / 4, y: PILL.y + PILL.h + 62, fill: PAL.ink, ink: null, D, seed: 1010 + k, anim: () => ({ s }) });
    });
    // little drop riding the front
    const hop = PSTEP.reduce((a, ts) => Math.max(a, Math.sin(Math.PI * clamp((t - ts + 0.05) / 0.3))), 0);
    const fx = clamp(PILL.x + PILL.w * p, PILL.x + 60, PILL.x + PILL.w - 50);
    drawDrop(c, T(fx, PILL.y - 62 - 70 * hop, 0.42 * appear(t, B[11] + 0.38, 0.2), 0.1 * Math.sin(tq * 5)), { D, t: tq, expr: p >= 0.999 ? 'strong' : 'happy', arms: p >= 0.999 ? 'up' : 'none' });
    const fu = clamp((tq - PSTEP[3]) / 0.2);
    if (fu > 0) { starBurst(c, PILL.x + PILL.w - 30, PILL.y - 20, 70 * E.outBack(fu, 2.4), 8, D, 1020, PAL.yel, tq); }
  }
  HL('把“多喝水”', t, B[11] + E8, B[12] - 0.12, 430, { D, seed: 59, size: 120, color: { 2: PAL.blue, 3: PAL.blue, 4: PAL.blue } });
  HL('变成看得见的进度条', t, bt(45), B[12] - 0.12, 565, { D, seed: 60, size: 98, fill: PAL.yel });
}

// ------------------------------------------------------------------ S13: 一瓶 500ml 甜饮料 ≈ 50 克糖 (B12 – B14)
const SODA = { x: 330, y: 960, s: 1.15 };
const POUR = 0.35; // soda tilt while pouring
const SMOUTH = [SODA.x + 238 * SODA.s * Math.sin(POUR), SODA.y - 238 * SODA.s * Math.cos(POUR)];
const CUBE_A = 44;
const PILE = (() => { const out = []; const rows = [[5, 1330], [4, 1264], [3, 1198]]; rows.forEach(([n, y]) => { for (let i = 0; i < n; i++) out.push([720 + (i - (n - 1) / 2) * 78, y]); }); return out; })();
const cubeT = (j) => bt(49) + j * E8;
let SODAW = null;
const sodaW = () => (SODAW ||= xf(sodaDense(), { x: SODA.x, y: SODA.y, sx: SODA.s, sy: SODA.s }));
function cubeAt(j, t) { // position of cube j while pouring / piled
  const [px, py] = PILE[j];
  const u = (t - cubeT(j)) / 0.38;
  if (u < 0) return null;
  if (u < 1) {
    const x = lerp(SMOUTH[0], px, E.lin(u)), y = lerp(SMOUTH[1], py, E.in2(u)) - 110 * Math.sin(Math.PI * u) * (1 - 0.3 * u);
    return { x, y, r: (1 - u) * 5 * (hs(j, 1) - 0.5), s: lerp(0.6, 1, E.out2(u)) };
  }
  const v = t - cubeT(j) - 0.38;
  return { x: px, y: py - 26 * Math.exp(-v * 9) * Math.abs(Math.sin(v * 16)), r: 0, s: 1 };
}
function sceneSugar(t, tq, D) {
  if (t < B[12] || t >= B[14] + 0.6) return;
  // soda (morph from the pill, exits at B14)
  if (t < B[14] + 0.3) {
    const mu = E.io3(clamp((t - B[12]) / 0.36));
    if (mu < 1) {
      const P = morphW(pillDense(), sodaW(), mu, 'pill-soda', 240);
      drawMorph(P, mixHex(PAL.blueL, PAL.cola, mu), D, 1100);
    } else {
      const ex = E.in3(clamp((t - B[14]) / 0.3));
      const burp = beatPulse(t, Array.from({ length: 12 }, (_, j) => cubeT(j)), 14);
      const tilt = POUR * E.io2(clamp((t - (bt(49) - 0.22)) / 0.2)) * (1 - E.io2(clamp((t - (cubeT(11) + 0.1)) / 0.3)));
      drawSoda(c, T(SODA.x - 520 * ex, SODA.y, SODA.s, tilt - 0.4 * ex + 0.03 * Math.sin(tq * 5), 1 + 0.06 * burp, 1 - 0.08 * burp), { D, t: tq });
    }
  }
  // cubes (pile until B14, then sceneDays takes over)
  if (t < B[14]) {
    let landed = 0;
    for (let j = 0; j < 12; j++) {
      const q = cubeAt(j, t);
      if (!q) continue;
      if (t - cubeT(j) >= 0.38) landed++;
      drawCube(c, q.x, q.y, CUBE_A * q.s, D, 1200 + j * 10, { r: q.r });
    }
    if (landed > 0) {
      const s = 1 + 0.25 * beatPulse(t, Array.from({ length: 12 }, (_, j) => cubeT(j) + 0.38), 10);
      letters(c, '×' + landed, { font: 'KL', size: 86, x: 905, y: 1095, fill: PAL.red, ink: PAL.ink, inkW: 4.5, shadow: PAL.ink, D, seed: 1300, anim: () => ({ s, r: 0.08 }) });
    }
  }
  HL('一瓶 500ml 甜饮料', t, B[12] + E8, B[14] - 0.12, 430, { D, seed: 61, size: 104, color: { 7: PAL.red, 8: PAL.red, 9: PAL.red } });
  approxLine('50 克糖', t, B[13], B[14] - 0.12, 585, { D, seed: 62, size: 140, fill: PAL.red });
  SUB('相当于 12 块方糖', t, bt(53), B[14] - 0.12, 1440, { D, seed: 63, size: 62 });
}

// ------------------------------------------------------------------ S14: 一瓶就喝掉 2 天的糖！ (B14 – B15)
const RANK = PILE.map((p, j) => j).sort((a, b) => PILE[a][0] - PILE[b][0] || PILE[b][1] - PILE[a][1]);
const GSLOT = (gx) => [[gx - 78, 1270], [gx, 1270], [gx + 78, 1270], [gx - 39, 1204], [gx + 39, 1204], [gx, 1138]];
const DAYSLOT = (() => { const out = []; const L = GSLOT(300), R = GSLOT(780); RANK.forEach((j, r) => { out[j] = r < 6 ? L[r] : R[r - 6]; }); return out; })();
const depDay = (j) => B[14] + RANK.indexOf(j) * 0.05;
function cubeDay(j, t) {
  const [ax, ay] = PILE[j], [bx, by] = DAYSLOT[j];
  const u = clamp((t - depDay(j)) / 0.32);
  return { x: lerp(ax, bx, E.io2(u)), y: lerp(ay, by, E.io2(u)) - 170 * Math.sin(Math.PI * u), r: 0.6 * Math.sin(Math.PI * u) * (bx < ax ? -1 : 1) };
}
function sceneDays(t, tq, D) {
  if (t < B[14] || t >= B[15] + 0.3) return;
  const out = vanish(t, B[15] - 0.04, 0.18);
  drawCalendar(300, 830, appear(t, B[14] + E8, 0.25, 2.2) * out, '第1天', D, 1400);
  drawCalendar(780, 830, appear(t, bt(57), 0.25, 2.2) * out, '第2天', D, 1410);
  if (t < B[15]) for (let j = 0; j < 12; j++) { const q = cubeDay(j, t); drawCube(c, q.x, q.y, CUBE_A, D, 1200 + j * 10, { r: q.r }); }
  HL('一瓶就喝掉', t, B[14] + E8, B[15] - 0.12, 430, { D, seed: 64, size: 112 });
  HL('2 天的糖！', t, bt(57), B[15] - 0.12, 578, { D, seed: 65, size: 140, fill: PAL.yel, color: { 0: PAL.red } });
  SUB('每天添加糖最好不超过 25 克', t, bt(58), B[15] - 0.12, 1420, { D, seed: 66, size: 58 });
}

// ------------------------------------------------------------------ S15: cubes → drops → 换成白水 (B15 – B16)
const B15B = { x: 540, y: 985, s: 0.82 };
const M15 = [540, B15B.y - 350 * B15B.s - 8];
const CUBE_HEX = [[0, -60], [52, -30], [52, 30], [0, 60], [-52, 30], [-52, -30]];
const cubeHexDense = () => resample(spline(CUBE_HEX.map((p) => [p[0], p[1], 1]), true, 3), 3, true);
const depDrop = (j) => B[15] + 0.25 + RANK.indexOf(j) * (E8 / 2);
const fill15 = (t) => Array.from({ length: 12 }, (_, j) => E.out2(clamp((t - depDrop(j) - 0.3) / 0.14)) / 12).reduce((a, b) => a + b, 0);
function sceneSwap(t, tq, D) {
  if (t < B[15] || t >= B[16] + 0.35) return;
  // the bottle that collects the drops (cap pops at B16 in sceneHero)
  const bs = appear(t, B[15] + 0.05, 0.25, 2);
  const trem = clamp((t - bt(63)) / (B[16] - bt(63)));
  const sh = 7 * trem * Math.sin(t * 75);
  const cu = clamp((t - B[16]) / 0.6);
  drawBottle(c, T(B15B.x + sh, B15B.y, B15B.s * bs), { D, t: tq, level: Math.min(0.96, fill15(t)), wave: 6 + 14 * trem, capOff: [0, -1300 * cu + 1500 * cu * cu, 8 * cu] });
  if (t < B[16]) {
    for (let j = 0; j < 12; j++) {
      const [x0, y0] = DAYSLOT[j];
      const mu = E.io3(clamp((t - B[15]) / 0.25));
      if (mu < 1) {
        const A = xf(cubeHexDense(), { x: x0, y: y0, sx: CUBE_A / 60, sy: CUBE_A / 60 });
        const Bd = xf(dropDense(100), { x: x0, y: y0 + 10, sx: 0.36, sy: 0.36 });
        drawMorph(morphW(A, Bd, mu, 'cube-drop', 120), mixHex(PAL.sugar, PAL.blue, mu), D, 1500 + j, { w: 4.6, amp: 1 });
        continue;
      }
      const u = clamp((t - depDrop(j)) / 0.3);
      if (u >= 1) continue;
      const x = lerp(x0, M15[0], E.io2(u)), y = lerp(y0 + 10, M15[1] - 30, u) - 260 * Math.sin(Math.PI * u);
      drawDrop(c, T(x, y, 0.36 * lerp(1, 0.6, E.in2(u)), (x0 < 540 ? 1 : -1) * 1.2 * E.in2(u)), { D, t: tq, expr: 'happy' });
    }
    for (let j = 0; j < 12; j++) { const u = t - depDrop(j) - 0.3; if (u > 0 && u < 0.35) splash(c, M15[0], M15[1], u, D, 1520 + j * 7, { n: 3, v: 520, spread: 1.4, size: 14, life: 0.35, fill: PAL.blueL }); }
  }
  [['0 糖', 270, PAL.yel, bt(61)], ['0 卡', 540, '#ff9a8a', bt(62)], ['0 负担', 810, PAL.blueL, bt(63)]].forEach(([str, x, col, tb], i) => {
    const s = appear(t, tb, 0.24, 2.6) * vanish(t, B[16] - 0.02, 0.14);
    drawBadge(x, 1385, 74, s * (1 + 0.06 * beatPulse(tq, [bt(62), bt(63)], 8)), col, str, D, 1540 + i * 5, { font: 'MK', size: str.length > 3 ? 44 : 56, r: (i - 1) * 0.08 });
  });
  HL('换成白水', t, B[15] + E8, B[16] - 0.06, 440, { D, seed: 67, size: 150, fill: PAL.blue });
}

// ------------------------------------------------------------------ S16: hero — 强者喝大水！ (B16 – B17)
function sceneHero(t, tq, D) {
  if (t < B[16] || t >= B[17] + 0.25) return;
  const u = t - B[16];
  if (u < 0.6) splash(c, M15[0], M15[1], u, D, 1600, { n: 14, v: 1500, spread: 1.1, size: 30, life: 0.6, fill: PAL.blueL });
  const R = 1650 * E.out3(clamp(u / 0.32));
  if (u < 0.32) { burstFill(c, M15[0], M15[1], R, t, D, 1610, { color: PAL.blue }); return; }
  if (t >= B[17] - 0.1) { // drain
    const v = E.in2(clamp((t - (B[17] - 0.1)) / 0.35));
    flood(c, lerp(-170, 2100, v), tq, D, 1620, { amp: 30 });
    return;
  }
  waterBG(t, tq, D, 1630);
  const out = vanish(t, B[17] - 0.26, 0.16);
  starBurst(c, 540, 1170, 460 * appear(t, B[16] + 0.3, 0.3, 1.8) * out, 14, D, 1640, PAL.yel, tq * 0.5);
  const bp = beatPulse(tq, [bt(65), bt(66), bt(67)], 9);
  const s = 1.95 * appear(t, B[16] + 0.34, 0.3, 2.2) * out;
  if (s > 0.02) drawDrop(c, T(540, 1245 - 40 * bp, s, 0.04 * Math.sin(tq * 4), 1 + 0.05 * bp, 1 - 0.05 * bp), { D, t: tq, expr: 'strong', arms: 'flex', crown: appear(t, bt(66), 0.22, 2.6), fill: PAL.blue });
  [[190, 830], [890, 810], [180, 1420], [900, 1400]].forEach(([x, y], i) => { const k = clamp((tq - bt(65 + (i % 2))) / 0.18); if (k > 0) twinkle(c, x, y, 44 * E.outBack(k, 2.5) * out, D, 1650 + i, PAL.hi, 0.4 * i); });
  HL('强者', t, B[16] + E8, B[17] - 0.2, 420, { D, seed: 68, size: 150, fill: PAL.yel });
  HL('喝大水！', t, bt(65), B[17] - 0.2, 595, { D, seed: 69, size: 172 });
}

// ------------------------------------------------------------------ S17 / S18: tips
function tipTitle(num, str, t, tIn, tOut, D, k) {
  const R = 62, M = measure(str, 'KL', 140).w, gap = 28, tot = 2 * R + gap + M, x0 = 540 - tot / 2;
  drawBadge(x0 + R, 432, R, appear(t, tIn, 0.24, 2.6) * (t >= tOut ? vanish(t, tOut, 0.12) : 1), PAL.yel, num, D, k, { size: 84, r: -0.1 });
  HL(str, t, tIn + 0.06, tOut, 430, { D, seed: k + 1, size: 140, x: x0 + 2 * R + gap + M / 2 });
}
function sceneTip1(t, tq, D) {
  if (t < B[17] - 0.1 || t >= B[18] + 0.1) return;
  const out = vanish(t, B[18] - 0.1, 0.16);
  const sips = [bt(69), bt(70), bt(71)];
  const lv = 0.86 - sips.reduce((a, ts) => a + 0.2 * E.out2(clamp((t - ts) / 0.16)), 0);
  const tilt = sips.reduce((a, ts) => a + Math.sin(Math.PI * clamp((t - ts + 0.08) / 0.3)), 0);
  const gs = 1.75 * appear(t, B[17], 0.26, 2.2) * out;
  if (gs > 0.02) drawGlass(c, T(365, 1010, gs, -0.22 * tilt), { D, t: tq, k: 20, level: lv });
  sips.forEach((ts, i) => { const u = t - ts; if (u > 0 && u < 0.45) { c.save(); c.globalAlpha = 1 - u / 0.45; letters(c, '咕', { font: 'KL', size: 54, x: 470 + 30 * i, y: 800 - 90 * u, fill: PAL.blue, ink: PAL.ink, inkW: 3, D, seed: 1700 + i }); c.restore(); } });
  const cs = 1.2 * appear(t, B[17] + E8, 0.26, 2.2) * out;
  if (cs > 0.02) {
    const m = (t - B[17]) / BEAT * Math.PI / 2;
    drawClock(c, T(745, 1010, cs), { D, h: m / 12 + 1.2, m });
    const au = clamp((t - B[17] - 0.4) / 0.35);
    if (au > 0) { const pts = []; for (let i = 0; i <= 24; i++) { const a = lerp(-0.35 * Math.PI, 1.3 * Math.PI, i / 24); pts.push([745 + Math.cos(a) * 168 * out, 1010 + Math.sin(a) * 168 * out]); } drawArrow(c, pts, D, 1710, { draw: au, w: 7, color: PAL.blueD, head: 30 }); }
  }
  tipTitle('1', '少量多次', t, B[17], B[18] - 0.12, D, 1720);
  SUB('每次一杯，约 200 毫升', t, bt(69), B[18] - 0.12, 1335, { D, seed: 1730, size: 64 });
}
const WARN_DENSE = () => resample(spline([[0, -112, 1], [118, 92, 1], [-118, 92, 1]], true, 4), 4, true);
const WARN = { x: 540, y: 1000, s: 1.9 };
function sceneTip2(t, tq, D) {
  if (t < B[18] - 0.05 || t >= B[19]) return;
  const hit = beatPulse(tq, [bt(73), bt(74), bt(75)], 10);
  const s = WARN.s * appear(t, B[18], 0.26, 2.4);
  drawWarn(c, T(WARN.x + 10 * hit * Math.sin(t * 70), WARN.y, s * (1 + 0.05 * hit), 0.05 * Math.sin(tq * 5)), { D });
  [bt(73), bt(74), bt(75)].forEach((tb, i) => { const u = t - tb; if (u > 0 && u < 0.6) splash(c, WARN.x, WARN.y - 200, u, D, 1740 + i * 10, { n: 6, v: 900, spread: 2.2, size: 24, life: 0.6, fill: PAL.blueL }); });
  [[225, 840, bt(73)], [860, 900, bt(74)]].forEach(([x, y, tb], i) => { const s2 = appear(t, tb, 0.2, 2.6); if (s2 > 0) letters(c, '!!', { font: 'KL', size: 96, x, y, fill: PAL.red, ink: PAL.ink, inkW: 4.5, shadow: PAL.ink, D, seed: 1760 + i, anim: () => ({ s: s2, r: i ? 0.2 : -0.2 }) }); });
  tipTitle('2', '也别猛灌', t, B[18], B[19] - 0.12, D, 1770);
  SUB('短时间狂饮，小心“水中毒”', t, bt(73) + E8, B[19] - 0.12, 1335, { D, seed: 1780, size: 62 });
}

// ------------------------------------------------------------------ S19: 今天，你喝够一瓶大水了吗？ (B19 – end)
const BEND = { x: 430, y: 995, s: 0.88 };
function sceneEnd(t, tq, D) {
  if (t < B[19]) return;
  const mu = E.io3(clamp((t - B[19]) / 0.36));
  if (mu < 1) {
    const A = xf(WARN_DENSE(), { x: WARN.x, y: WARN.y, sx: WARN.s, sy: WARN.s });
    const Bw = xf(bottleDense(), { x: BEND.x, y: BEND.y, sx: BEND.s, sy: BEND.s });
    drawMorph(morphW(A, Bw, mu, 'warn-bottle', 240), mixHex(PAL.yel, PAL.blueL, mu), D, 1800);
  } else {
    drawBottle(c, T(BEND.x, BEND.y, BEND.s), { D, t: tq, level: 0.95, wave: 6 + 8 * beatPulse(tq, [B[20], B[21]], 5) });
  }
  const ds = 0.82 * appear(t, bt(77), 0.3, 2.4);
  const wink = t >= B[21] && t < B[21] + 0.4;
  if (ds > 0.02) drawDrop(c, T(800, 1170 - 24 * beatPulse(tq, [bt(78), bt(79), bt(80), bt(81), bt(82), bt(83)], 9), ds, 0.06 * Math.sin(tq * 4)), { D, t: tq, expr: wink ? 'wink' : 'happy', arms: 'wave' });
  if (t >= B[21]) { const k = clamp((tq - B[21]) / 0.18); twinkle(c, 905, 1010, 46 * E.outBack(k, 2.5), D, 1810, PAL.yel); }
  HL('今天，你喝够', t, B[19] + E8, 99, 430, { D, seed: 70, size: 120 });
  HL('一瓶大水了吗？', t, bt(77), 99, 570, { D, seed: 71, size: 126, color: { 2: PAL.blue, 3: PAL.blue } });
  // CTA: ☑ 评论区打卡 ↗
  const M = measure('评论区打卡', 'KL', 82).w, tot = 84 + 24 + M, x0 = 500 - tot / 2, y = 1392;
  const cs = appear(t, bt(79), 0.24, 2.6);
  if (cs > 0) drawCheckbox(c, T(x0 + 42, y, 0.95 * cs * (1 + 0.1 * pulse(t, B[20], 8))), { D, check: (t - B[20]) / 0.22 });
  HL('评论区打卡', t, bt(79) + 0.06, 99, y, { D, seed: 72, size: 82, fill: PAL.red, x: x0 + 84 + 24 + M / 2 });
  const au = clamp((t - bt(81)) / 0.3);
  if (au > 0) drawArrow(c, [[x0 + 84 + 24 + M + 22, y + 4], [x0 + 84 + 24 + M + 110, y + 12], [990, y - 50]], D, 1820, { draw: au, w: 8, color: PAL.ink, head: 30 });
}

// ------------------------------------------------------------------ render
export function render(t) {
  const f = Math.round(t * FPS);
  const D = Math.floor(f / 2);
  const tq = onN(t, FPS, 2);
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
  drawPaper();
  const sh = shakeAt(t, [[SLAM, 22], [bt(17), 8], [B[8], 18], [B[16], 20], [B[20], 6]]);
  c.save(); c.translate(sh.x, sh.y);
  sceneHook(t, tq, D);
  sceneTitle(t, tq, D);
  sceneQuestion(t, tq, D);
  sceneSplash(t, tq, D);
  sceneBody(t, tq, D);
  sceneBrain(t, tq, D);
  sceneThirst(t, tq, D);
  sceneAmount(t, tq, D);
  sceneOneBottle(t, tq, D);
  sceneFlood(t, tq, D);      // after S10 so the drain uncovers it
  sceneProgress(t, tq, D);
  sceneSugar(t, tq, D);
  sceneDays(t, tq, D);
  sceneSwap(t, tq, D);
  sceneTip1(t, tq, D);
  sceneTip2(t, tq, D);
  sceneEnd(t, tq, D);
  sceneHero(t, tq, D);       // after the tips so its drain uncovers tip 1
  c.restore();
  drawTag(t, D);
  drawTooth(D);
  // impact flash (1 frame)
  if (f === Math.round(SLAM * FPS)) { c.save(); c.globalAlpha = 0.55; c.fillStyle = PAL.hi; c.fillRect(0, 0, W, H); c.restore(); }
}
