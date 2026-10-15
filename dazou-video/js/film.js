// 大走理论 · 走路科普 — 47.6 s vertical (1080×1920 @30 fps) hand-inked line film.
// One ink line keeps becoming the next thing: sofa → flatline → heartbeat → walker → 大走 → chair → timeline → glucose peak → ground →
// watch ring → brain → bulb → switches → footprints → tips → end card. Every frame is a pure function of t.
// Cue grid is locked to the music (112.9 BPM, first beat 0.083 s): bt(n) = beat n, B[k] = bar k downbeat.
import { PAL, hs, hr, clamp, lerp, inv, sstep, E, K, spline, resample, xf, boil, inkStroke, inkLoop, fillShape, fillPoly,
  circlePts, ellPts, rrectPts, prefix, arclen, toN, pathPts, onN, N3, signedArea, centroid } from './engine.js';
import { loadGlyphs, letters, measure, popIn, flyOut } from './text.js';
import { REG, T, inked, stroke, dot, mixHex, drawSweat, footDense, drawFoot, drawSofa, drawPhone, CHAIR, CHAIR_W, drawDesk, drawLaptop,
  drawClock, clockDense, batteryDense, drawBattery, WATCH_R, watchDense, drawWatch, bulbDense, drawBulb, SW, switchDense, drawSwitch,
  drawBowl, bowlDense, scribbleDense, drawSeal, brainDense, drawBrain, face2, drawCheckbox, drawArrow, drawFatArrow, ecgPts } from './shapes.js';
import { twinkle, starBurst, speedLines, puff } from './fx.js';
import { blobTrack, drawBackdrop, sunburst, confetti, vignette, invertFrame, heart } from './fx2.js';
import { G, poseStand, poseWalk, poseSit, poseLie, poseBig, poseJump, mixPose, solve, drawGuy, N_ST, rs, profile, lerpStroke, drawStroke,
  calli, guyStrokes } from './guy.js';

export const W = 1080, H = 1920, FPS = 30, DUR = 47.6;
export const BPM = 112.9, PH = 0.083, BEAT = 60 / BPM;
export const bt = (n) => PH + n * BEAT;
const B = Array.from({ length: 24 }, (_, k) => bt(4 * k));
const E8 = BEAT / 2, E16 = BEAT / 4;

let c = null;
const IMG = {};
const loadImg = (src) => new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = src; });
export async function init(canvas) {
  canvas.width = W; canvas.height = H;
  c = canvas.getContext('2d');
  await loadGlyphs('./assets/glyphs.json');
  IMG.paper = await loadImg('./assets/paper_base.jpg');
  IMG.tooth = await loadImg('./assets/paper_tooth.png');
}

// ------------------------------------------------------------------ helpers
const pulse = (t, t0, k = 9) => (t < t0 ? 0 : Math.exp(-(t - t0) * k));
function beatPulse(t, beats, k = 9) { let p = 0; for (const b of beats) p = Math.max(p, pulse(t, b, k)); return p; }
const beatsIn = (a, b) => { const o = []; for (let n = 0; n < 100; n++) { const x = bt(n); if (x >= a - 1e-6 && x < b - 1e-6) o.push(x); } return o; };
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
    if (o.allFill) a.fill = o.allFill;
    if (o.wobble) { a.r = (a.r ?? 0) + o.wobble * Math.sin(t * 9 + i * 1.3); }
    if (o.dy) a.dy = (a.dy ?? 0) + o.dy;
    if (o.punch) a.s = (a.s ?? 1) * (1 + o.punch);
    return a;
  };
  return letters(c, str, { ...o, anim, D: o.D });
}
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
const HL = (str, t, tIn, tOut, y, o = {}) => say(str, t, tIn, tOut, { font: 'KL', size: o.size ?? 120, x: o.x ?? 540, y, fill: o.fill ?? PAL.hi, ink: PAL.ink, inkW: o.inkW ?? 6.5, shadow: PAL.ink, D: o.D, seed: o.seed ?? 50, st: o.st ?? 0.045, rot: 0.3, color: o.color, align: o.align, allFill: o.allFill, punch: o.punch, dy: o.dy, tracking: o.tracking });
const SUB = (str, t, tIn, tOut, y, o = {}) => say(str, t, tIn, tOut, { font: 'MK', size: o.size ?? 58, x: o.x ?? 540, y, fill: o.fill ?? PAL.ink, ink: null, D: o.D, seed: o.seed ?? 60, st: 0.022, rot: 0.1, color: o.color });
const appear = (t, t0, d = 0.25, s = 2.2) => (t < t0 ? 0 : E.outBack(clamp((t - t0) / d), s));
const vanish = (t, t0, d = 0.16) => 1 - E.in2(clamp((t - t0) / d));
const ioL = (u) => E.io3(clamp(u)); // line-art signature ease (≈ cubic-bezier(.65,0,.35,1))

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
const TAG = '走路小科普';
function drawTag(t, D) {
  const a = clamp((t - 0.25) / 0.2);
  if (a <= 0) return;
  const s = E.outBack(a, 2);
  c.save(); c.translate(78, 236); c.scale(s, s); c.rotate(-0.025);
  const tw = measure(TAG, 'MK', 36).w;
  const box = rrectPts(0, -34, 62 + tw + 24, 68, 16);
  fillShape(c, box, PAL.hi, { seed: D * 13 + 7, amp: 0.8, dx: -3, dy: 3 });
  inkLoop(c, box, { seed: D * 13 + 7, w: 3.6, amp: 0.8, heavy: 0.2 });
  drawFoot(c, T(34, 6, 0.17, 0.35), D, 9, { w: 2.4 });
  letters(c, TAG, { font: 'MK', size: 36, x: 62, y: 1, align: 'left', fill: PAL.ink, ink: null, D, seed: 5, amp: 0.5 });
  c.restore();
}

// ------------------------------------------------------------------ morph helpers
const MC = new Map();
function morphW(A, Bc, u, key, n = 240) { // closed contour morph, alignment cached by key
  const a = toN(A, n), b0 = toN(Bc, n);
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
// slice of a morph stroke {p, w} from fraction a to b (b < a reverses direction)
function sliceStroke(st, a, b) {
  const lo = Math.min(a, b), hi = Math.max(a, b);
  let P = rs(sliceOpen(st.p, lo, hi));
  const w0 = (u) => st.w(lo + (hi - lo) * u);
  if (a > b) return { p: P.reverse(), w: (u) => w0(1 - u) };
  return { p: P, w: w0 };
}
const growStroke = (st, u) => ({ p: rs(prefix(st.p, Math.max(0.02, u))), w: (v) => st.w(v * u) * Math.min(1, u * 3) });
const shiftStroke = (st, dx, dy) => ({ p: st.p.map((q) => [q[0] + dx, q[1] + dy]), w: st.w });
const constStroke = (P, w) => ({ p: rs(spline(P, false, 4)), w: profile([w, w, w]) });
// a guy drawn from morph strokes: S = {torso, legs, arms, C, R}; headS scales the head
function drawStrokeGuy(S, D, k, o = {}) {
  const col = o.color ?? PAL.ink;
  const ds = (st, kk) => st && drawStroke(c, st, D, k + kk, { color: col, amp: o.amp ?? 1.4 });
  ds(S.arms[0], 1); ds(S.legs[0], 2); ds(S.torso, 3); ds(S.legs[1], 4);
  if (S.R > 1 && (o.headS ?? 1) > 0.02) {
    const R = S.R * (o.headS ?? 1);
    const HP = circlePts(S.C[0], S.C[1], R, 40);
    fillShape(c, HP, PAL.hi, { seed: D * 13 + k + 7, amp: 1.2, dx: -3, dy: 3 });
    inkLoop(c, HP, { seed: D * 13 + k + 7, w: Math.max(3, 12 * R / 58), amp: 1.4, heavy: 0.25, color: col });
  }
  ds(S.arms[1], 5);
}
const lerpPt = (a, b, u) => [lerp(a[0], b[0], u), lerp(a[1], b[1], u)];
// stat pill: label + green down-arrow + number
function drawStat(x, y, s, label, num, D, k, o = {}) {
  if (s <= 0.01) return;
  c.save(); c.translate(x, y); c.rotate(o.r ?? 0); c.scale(s, s);
  const lw = measure(label, 'KL', 64).w, nw = measure(num, 'KL', 84).w;
  const wTot = lw + 30 + 60 + 12 + nw + 80, h = 116;
  const P = rrectPts(-wTot / 2, -h / 2, wTot, h, 40);
  fillShape(c, P, o.fill ?? PAL.hi, { seed: D * 13 + k, amp: 1.1, dx: REG.dx, dy: REG.dy });
  inkLoop(c, P, { seed: D * 13 + k, w: 6.5, amp: 1.3, heavy: 0.3 });
  const x0 = -wTot / 2 + 40;
  letters(c, label, { font: 'KL', size: 64, x: x0, y: 2, align: 'left', fill: PAL.ink, ink: null, D, seed: k + 1, amp: 0.7 });
  drawFatArrow(c, x0 + lw + 30 + 30, 2, 0.62, 1, o.arrow ?? PAL.grn, D, k + 2);
  letters(c, num, { font: 'KL', size: 84, x: x0 + lw + 30 + 60 + 12, y: 0, align: 'left', fill: o.numFill ?? PAL.grn, ink: PAL.ink, inkW: 4, D, seed: k + 3, amp: 0.8 });
  c.restore();
}
function drawBadge(x, y, R, s, fill, str, D, k, o = {}) {
  if (s <= 0.01) return;
  c.save(); c.translate(x, y); c.rotate(o.r ?? 0); c.scale(s, s);
  const P = boil(circlePts(0, 0, R, 48), D * 13 + k, 1.2, 50);
  fillShape(c, P, fill, { seed: D * 13 + k, amp: 1, dx: REG.dx * 0.7, dy: REG.dy * 0.7 });
  inkLoop(c, P, { seed: D * 13 + k, w: 6, amp: 1.2, heavy: 0.3 });
  letters(c, str, { font: 'KL', size: o.size ?? R * 0.62, x: 0, y: 2, fill: o.color ?? PAL.ink, ink: o.ink === undefined ? null : o.ink, inkW: 3, D, seed: k, amp: 0.6 });
  c.restore();
}
// big number with a fat arrow in front (dir 1 = down)
// slam-in scale: comes from the lens (2.3×), hits the paper, overshoots, settles
const slam = (t, t0) => (t < t0 ? 0 : K(t, [[t0, 2.3], [t0 + 0.09, 0.9, 'in2'], [t0 + 0.17, 1.05, 'out2'], [t0 + 0.27, 1, 'io2']]));
function bigNum(str, x, y, size, s, fill, dir, D, k) {
  if (s <= 0.01) return;
  const m = measure(str, 'KL', size).w, aw = size * 0.55, gap = size * 0.08, tot = aw + gap + m;
  c.save(); c.translate(x, y); c.scale(s, s); c.rotate(-0.04);
  drawFatArrow(c, -tot / 2 + aw / 2, size * 0.02, size / 125 * 1.0, dir, fill, D, k);
  letters(c, str, { font: 'KL', size, x: -tot / 2 + aw + gap + m / 2, y: 0, fill, ink: PAL.ink, inkW: size * 0.045, shadow: PAL.ink, D, seed: k + 1 });
  c.restore();
}
// ground line with scrolling tick marks; off = scroll offset in px
function ground(x0, x1, y, off, D, k, o = {}) {
  inkStroke(c, [[x0, y], [x1, y]], { seed: D * 13 + k, w: o.w ?? 9, amp: 1.2, t0: 6, t1: 6, color: o.color ?? PAL.ink });
  if (o.ticks === false) return;
  const gap = 120;
  for (let i = -1; i < 12; i++) {
    const x = x0 + ((i * gap - off) % (gap * 11) + gap * 11) % (gap * 11);
    if (x < x0 + 10 || x > x1 - 40) continue;
    inkStroke(c, [[x, y + 22], [x + 34, y + 22]], { seed: D * 13 + k + 3 + i, w: 4.5, amp: 0.8, t0: 3, t1: 3, color: 'rgba(28,22,19,0.45)' });
  }
}
function dashed(x0, x1, y, D, k, o = {}) {
  const n = Math.floor((x1 - x0) / 42);
  for (let i = 0; i < n; i++) { const a = x0 + i * 42; inkStroke(c, [[a, y], [a + 24, y]], { seed: D * 13 + k + i, w: o.w ?? 6, amp: 0.8, t0: 2, t1: 2, color: o.color ?? PAL.ink }); }
}

// walking guy helper: one step per beat, heel strike on the beat
const walkPh = (t, t0 = PH) => (t - t0) / (2 * BEAT) + 0.25;
const STEP = (s) => 205 * s;        // ground travel per step (px)
const HIPH = (s) => 250 * s;        // hip height above the ground while walking/standing
// footprints left behind on the ground (top-down icons, toes point +x), scrolling left at walk speed
function footTrail(t, tq, t0, t1, x0, y, s, D, k, o = {}) {
  const v = STEP(o.gs ?? 1) / BEAT;
  for (const tb of beatsIn(t0, t1)) {
    if (tq < tb) continue;
    const i = Math.round((tb - PH) / BEAT);
    const x = x0 - v * (tq - tb);
    if (x < -80) continue;
    const a = appear(tq, tb, 0.16, 2.4) * (o.fade ? o.fade : 1);
    if (a <= 0.01) continue;
    const left = i % 2 === 0;
    drawFoot(c, T(x, y + (left ? -16 : 16), s * a, Math.PI / 2, left ? -1 : 1, 1), D, k + (i % 8) * 7, { w: 3.5 });
  }
}

// ------------------------------------------------------------------ S0: 弱者躺平 (0 – B1)
const SOFA = { x: 540, y: 1132 };
const FLOOR = 1300;
const FLAT = bt(3);             // 1.677: the couch potato is pressed into a flat line
const LIE = { x: 624, y: 1080, s: 0.95 };
function lyingPose(tq) {
  const p = poseLie({ face: 'meh' });
  p.arms = [{ t: Math.PI + 0.5, k: -0.11 + 0.06 * Math.max(0, Math.sin(tq * 11)) }, { t: Math.PI / 2 + 0.1, k: 0.45 }];
  p.head = -0.25;
  return p;
}
function sceneSofa(t, tq, D) {
  if (t >= FLAT + 0.1) return;
  let sink = 0;
  for (const b of [bt(1), bt(2)]) sink += 9 * E.out3(clamp((t - b) / 0.1));
  const bp = beatPulse(t, [bt(0), bt(1), bt(2)], 10);
  let sx = 1, sy = 1;
  if (t > FLAT - 0.16) {
    const a = clamp((t - (FLAT - 0.16)) / 0.1);
    const b = clamp((t - (FLAT - 0.06)) / 0.1);
    sy = lerp(1 + 0.09 * E.out2(a), 0.03, E.in2(b));
    sx = lerp(1 - 0.03 * a, 1.4, E.in2(b));
  }
  const G = 1.1, gp = (x, y) => [540 + (x - 540) * G, FLOOR + (y - FLOOR) * G];
  c.save(); c.translate(540, FLOOR); c.scale(sx * G, sy * G * (1 - 0.03 * bp)); c.translate(-540, -FLOOR);
  drawSofa(c, T(SOFA.x, SOFA.y + sink * 0.3, 1, 0, 1 + 0.01 * bp, 1), D);
  const tf = { x: LIE.x, y: LIE.y + sink, s: LIE.s };
  const pose = lyingPose(tq);
  const g = drawGuy(c, tf, pose, { D, k: 100, face: 'meh' });
  // phone in the raised hand + screen glow on the face
  const hand = g.T([g.J.arms[0].H])[0];
  c.save(); c.globalAlpha *= 0.28;
  fillPoly(c, boil([[hand[0] - 30, hand[1] + 40], [hand[0] + 34, hand[1] + 40], [g.hc[0] + 60, g.hc[1] + 10], [g.hc[0] - 60, g.hc[1] + 10]], D * 13 + 5, 2, 50), PAL.blueL);
  c.restore();
  drawPhone(c, T(hand[0], hand[1] - 6, 1.0, Math.PI + 0.25), D, 140, { scroll: tq * 2.2 });
  c.restore();
  // remembered for the night layer (phone light + "likes" twinkles are drawn above the dark overlay)
  NIGHT.hand = gp(hand[0], hand[1]); NIGHT.face = gp(g.hc[0], g.hc[1]);
}
// ------------------------------------------------------------------ v2: the opening is at night – a dark room lit only by the phone
const NIGHT = { hand: [640, 960], face: [560, 1040] };
const NAVY = '#1a2140';
const HOLE = { x: 540, y: FLOOR - 420, R: 1500, d: 0.34 };
function nightFX(t, tq, D) {
  if (t >= B[1] + HOLE.d + 0.05) return;
  const R = t < B[1] ? 0 : HOLE.R * E.out2(clamp((t - B[1]) / HOLE.d));
  const glow = 1 - clamp((t - (FLAT - 0.14)) / 0.16);
  const [hx, hy] = glow > 0 ? NIGHT.hand : [540, 1000];
  const hole = R > 0 ? boil(circlePts(HOLE.x, HOLE.y, R, 120), D * 13 + 5, 9, 150) : null;
  c.save();
  c.beginPath(); c.rect(-400, -400, W + 800, H + 800);
  if (hole) { hole.forEach((q, i) => (i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]))); c.closePath(); }
  c.clip('evenodd');
  c.globalCompositeOperation = 'multiply';
  const gr = c.createRadialGradient(hx, hy, 0, hx, hy, 950);
  gr.addColorStop(0, mixHex(NAVY, '#dfe7ff', glow));
  gr.addColorStop(0.25, mixHex(NAVY, '#8798cf', glow));
  gr.addColorStop(0.6, mixHex(NAVY, '#2f3a66', glow));
  gr.addColorStop(1, NAVY);
  c.fillStyle = gr; c.fillRect(-400, -400, W + 800, H + 800);
  c.restore();
  if (glow > 0.01) { // the screen itself glows
    c.save(); c.globalCompositeOperation = 'screen';
    const g2 = c.createRadialGradient(hx, hy, 0, hx, hy, 300);
    g2.addColorStop(0, `rgba(110,160,255,${0.6 * glow})`); g2.addColorStop(1, 'rgba(110,160,255,0)');
    c.fillStyle = g2; c.fillRect(hx - 300, hy - 300, 600, 600);
    c.restore();
    // "likes" popping out of the phone on the beats (doom-scrolling), floating up
    [[95, -95, bt(0)], [-95, -120, bt(1)], [60, -175, bt(2)]].forEach(([dx, dy, tb], i) => {
      const u = clamp((tq - tb) / 0.18), up = 60 * E.out2(clamp((tq - tb) / 0.6));
      if (u > 0 && t < FLAT - 0.1) heart(c, hx + dx, hy + dy - up, 40 * E.outBack(u, 2.5) * vanish(tq, tb + 0.45, 0.2), D, 150 + i, PAL.pink, (i - 1) * 0.25);
    });
  }
  // the flatline glows like a heart monitor
  if (t >= FLAT - 0.04 && t < B[1]) {
    const u = E.out3(clamp((t - (FLAT - 0.04)) / 0.12));
    const L = [[540 - 640 * u, FLOOR], [540 + 640 * u, FLOOR]];
    c.save();
    c.shadowColor = 'rgba(70,255,150,0.95)'; c.shadowBlur = 30;
    inkStroke(c, L, { seed: D * 13 + 170, w: 9, amp: 1.2, t0: 4, t1: 4, color: '#39e07c' });
    c.shadowBlur = 0;
    inkStroke(c, L, { seed: D * 13 + 170, w: 3.2, amp: 1.2, t0: 4, t1: 4, color: '#e2fff0' });
    const x = lerp(540, 1100, clamp((t - FLAT) / (B[1] - FLAT)));
    const g3 = c.createRadialGradient(x, FLOOR, 0, x, FLOOR, 70);
    g3.addColorStop(0, 'rgba(150,255,190,0.9)'); g3.addColorStop(1, 'rgba(150,255,190,0)');
    c.globalCompositeOperation = 'screen'; c.fillStyle = g3; c.fillRect(x - 70, FLOOR - 70, 140, 140);
    c.globalCompositeOperation = 'source-over';
    dot(c, x, FLOOR, 11, '#f2fff7', D, 172);
    c.restore();
  }
  // B1: the light bursts out of the heartbeat spike – an orange shock ring rides the edge
  if (hole && t < B[1] + HOLE.d) {
    const u = clamp((t - B[1]) / HOLE.d);
    c.save(); c.globalAlpha *= 1 - E.in2(u);
    inkLoop(c, hole, { seed: D * 13 + 6, w: lerp(54, 14, u), amp: 1.5, heavy: 0, color: PAL.org });
    inkLoop(c, boil(circlePts(HOLE.x, HOLE.y, R * 0.86, 100), D * 13 + 8, 7, 150), { seed: D * 13 + 9, w: lerp(22, 6, u), amp: 1.5, heavy: 0, color: PAL.yel });
    c.restore();
  }
}
function sceneFlat(t, tq, D) {
  if (t < FLAT - 0.04 || t >= B[1]) return;
  const u = E.out3(clamp((t - (FLAT - 0.04)) / 0.12));
  inkStroke(c, [[540 - 640 * u, FLOOR], [540 + 640 * u, FLOOR]], { seed: D * 13 + 170, w: 9, amp: 1.2, t0: 4, t1: 4 });
  // monitor blip running along the flat line
  const x = lerp(540, 1100, clamp((t - FLAT) / (B[1] - FLAT)));
  c.save(); c.globalAlpha *= 0.35; dot(c, x, FLOOR, 22, PAL.red, D, 171); c.restore();
  dot(c, x, FLOOR, 10, PAL.red, D, 172);
}

// ------------------------------------------------------------------ S1: 强者大走 (B1 – B2)
const GUY1 = { x: 540, s: 1.0 };
const GY = FLOOR - HIPH(GUY1.s);
const MORPH1 = [B[1] + 0.07, B[1] + 0.3];
let SPIKE = null;
const spikeLine = () => (SPIKE ||= resample(spline(ecgPts(370, 750, FLOOR, 540, 1, 420).slice(1, -1), false, 3), 3));
function ecgWithAmp(a) { return spline(ecgPts(-20, 1100, FLOOR, 540, a, 420), false, 4); }
function walkPose1(t) { return poseWalk(walkPh(t), { stride: 0.46, arm: 0.7, bob: 12, lean: 0.12, face: 'grin' }); }
function guy1Strokes(t) { return guyStrokes({ x: GUY1.x, y: GY, s: GUY1.s }, walkPose1(t)); }
function sceneWalk1(t, tq, D) {
  if (t < B[1] || t >= B[2] + 0.4) return;
  const a = E.outBack(clamp((t - B[1]) / 0.07), 1.6);
  // ground (the flat line); the heartbeat spike rises out of it, then stands up as the walker
  const gOff = t > MORPH1[1] ? (tq - MORPH1[1]) * STEP(1) / BEAT : 0;
  const gFade = t > B[2] ? vanish(t, B[2] + 0.05, 0.25) : 1;
  if (t < MORPH1[0]) {
    inkStroke(c, ecgWithAmp(a), { seed: D * 13 + 200, w: 9, amp: 1.2, t0: 4, t1: 4, dense: true });
  } else if (gFade > 0) {
    const half = 640 * gFade;
    inkStroke(c, [[540 - half, FLOOR], [540 + half, FLOOR]], { seed: D * 13 + 201, w: 9, amp: 1.2, t0: 4, t1: 4 });
    if (gFade > 0.98) for (let i = 0; i < 11; i++) { const x = ((i * 120 - gOff) % 1320 + 1320) % 1320 - 60; inkStroke(c, [[x, FLOOR + 22], [x + 34, FLOOR + 22]], { seed: D * 13 + 205 + i, w: 4.5, amp: 0.8, t0: 3, t1: 3, color: 'rgba(28,22,19,0.45)' }); }
  }
  if (t < MORPH1[0]) return;
  if (t < MORPH1[1]) {
    const u = ioL((t - MORPH1[0]) / (MORPH1[1] - MORPH1[0]));
    const Sp = { p: rs(spikeLine()), w: profile([9, 9, 9]) };
    const to = guyStrokes({ x: GUY1.x, y: GY, s: GUY1.s }, walkPose1(MORPH1[1]));
    const src = [sliceStroke(Sp, 0.13, 0), sliceStroke(Sp, 0.43, 0.13), sliceStroke(Sp, 0.43, 0.6), sliceStroke(Sp, 0.6, 0.78), sliceStroke(Sp, 0.78, 1)];
    const dst = [to.legs[0], to.torso, to.arms[0], to.arms[1], to.legs[1]];
    const m = src.map((s, i) => lerpStroke(s, dst[i], u));
    const apex = [540, FLOOR - 420];
    drawStrokeGuy({ legs: [m[0], m[4]], torso: m[1], arms: [m[2], m[3]], C: lerpPt(apex, to.C, u), R: to.R }, D, 220, { headS: E.outBack(clamp(u * 1.3), 2) });
    return;
  }
  if (t >= B[2] - 0.06) return; // the 大 morph takes over
  // the walker: in place, world scrolls; footprints stamped on each beat
  footTrail(t, tq, B[1] + BEAT, B[2], GUY1.x + 90, FLOOR + 70, 0.42, D, 240);
  const p = walkPose1(tq);
  drawGuy(c, { x: GUY1.x, y: GY, s: GUY1.s }, p, { D, k: 260, face: 'grin' });
  // speed lines behind
  for (let i = 0; i < 3; i++) { const y = GY - 160 + i * 70, x0 = 330 - 30 * i - 20 * Math.sin(tq * 9 + i); inkStroke(c, [[x0, y], [x0 - 120, y]], { seed: D * 13 + 280 + i, w: 6, amp: 0.8, t0: 3, t1: 20 }); }
}
function textHook(t, tq, D) {
  if (t < B[1] + 0.04) {
    const anim0 = popIn(t, -0.3, 0.05, 0.24, { rot: 0.3, seed: 2 });
    const grey = t >= FLAT;
    const bp = beatPulse(tq, [bt(0), bt(1), bt(2)], 10), sq = grey ? pulse(t, FLAT, 10) : 0;
    c.save(); c.translate(540, 470); c.scale(1 + 0.05 * bp + 0.12 * sq, 1 + 0.05 * bp - 0.38 * sq); c.translate(-540, -470);
    if (!grey) { c.shadowColor = 'rgba(170,150,255,0.55)'; c.shadowBlur = 34; }
    letters(c, '弱者躺平', { font: 'KL', size: 160, x: 540, y: 470 + (grey ? 16 * E.out3(clamp((t - FLAT) / 0.1)) : 0), fill: grey ? PAL.greyL : '#cdc1f5', ink: PAL.ink, inkW: 7, shadow: PAL.ink, D, seed: 11, anim: anim0 });
    c.restore();
  }
  if (t >= B[1] && t < B[1] + 0.5) letters(c, '弱者躺平', { font: 'KL', size: 160, x: 540, y: 486, fill: PAL.greyL, ink: PAL.ink, inkW: 7, shadow: PAL.ink, D, seed: 11, anim: flyOut(t, B[1], 0.5, { seed: 4 }) });
  if (t >= B[1] + 0.04) {
    const r = say('强者大走', t, B[1] + 0.04, B[2] - 0.12, { font: 'KL', size: 176, x: 540, y: 470, fill: PAL.hi, ink: PAL.ink, inkW: 7.5, shadow: PAL.ink, D, seed: 12, st: 0.045, rot: 0.35, color: { 2: PAL.org, 3: PAL.org } });
    if (r && t < B[2] - 0.1) {
      const M = measure('强者大走', 'KL', 176), L = measure('强者', 'KL', 176);
      c.save(); c.globalCompositeOperation = 'multiply';
      swash(540 - M.w / 2 + L.adv - 6, 540 + M.w / 2 + 8, 575, (tq - bt(6)) / 0.25, D, 290);
      c.restore();
    }
  }
}

// ------------------------------------------------------------------ S2: 大走 + 理论 seal (B2 – B3)
const DA = { x: 292, y: 780, S: 440 }, ZOU = { x: 745, y: 780, S: 440 };
let CAL_DA = null, CAL_ZOU = null;
const daSt = () => (CAL_DA ||= calli('大', DA.x, DA.y, DA.S));
const zouSt = () => (CAL_ZOU ||= calli('走', ZOU.x, ZOU.y, ZOU.S));
const BIG1 = { x: GUY1.x, y: GY, s: GUY1.s };
const DA_T = [B[2] + 0.04, B[2] + 0.3];     // guy → 大
const PEEL = [bt(9), bt(9) + 0.16];          // a second walker peels out of 大
const ZOU_T = [bt(10) - 0.02, bt(10) + 0.24]; // walker → 走
const SEAL_T = bt(11);
function daPairs(S) {
  const [h, pie, na] = daSt();
  return [[S.arms[0], sliceStroke(h, 0.5, 0)], [S.arms[1], sliceStroke(h, 0.5, 1)], [S.torso, sliceStroke(pie, 0, 0.36)], [S.legs[0], sliceStroke(pie, 0.36, 1)], [S.legs[1], na]];
}
const daTop = () => daSt()[1].p[0];
function walker2(t) { // walks from 大 to 走 between PEEL and ZOU_T
  const u = clamp((t - PEEL[0]) / (ZOU_T[0] - PEEL[0]));
  return { tf: { x: lerp(DA.x + 20, ZOU.x - 10, E.io2(u)), y: 900 - HIPH(0.8) + 90, s: 0.8 }, pose: poseWalk(walkPh(t) * 2, { stride: 0.55, arm: 0.8, bob: 10, lean: 0.16, face: 'grin' }) };
}
function zouPairs(S) {
  const Z = zouSt();
  return [[S.arms[0], Z[0]], [S.torso, Z[1]], [S.arms[1], Z[2]], [S.legs[0], Z[5]], [S.legs[1], Z[6]]];
}
function drawDaStatic(D, k, o = {}) { daSt().forEach((st, i) => drawStroke(c, st, D, k + i, { amp: 1.3, color: o.color })); }
function drawZouStatic(D, k, o = {}) { zouSt().forEach((st, i) => drawStroke(c, st, D, k + i, { amp: 1.3, color: o.color })); }
function sceneTitle(t, tq, D) {
  if (t < B[2] - 0.06 || t >= B[3]) return;
  // 1) the walker spreads into a big "大" pose, then his strokes become the brush strokes of 大
  if (t < DA_T[0]) {
    const u = E.out3(clamp((t - (B[2] - 0.06)) / 0.1));
    drawGuy(c, BIG1, mixPose(walkPose1(B[2] - 0.06), poseBig({ face: 'grin' }), u), { D, k: 300, face: 'grin' });
  } else if (t < DA_T[1]) {
    const u = ioL((t - DA_T[0]) / (DA_T[1] - DA_T[0]));
    const S = guyStrokes(BIG1, poseBig({ face: 'grin' }));
    const m = daPairs(S).map(([a, b]) => lerpStroke(a, b, u));
    drawStrokeGuy({ arms: [m[0], m[1]], torso: m[2], legs: [m[3], m[4]], C: lerpPt(S.C, daTop(), u), R: S.R }, D, 310, { headS: 1 - E.in2(u) });
    if (u > 0.85) for (let i = 0; i < 4; i++) { const a = -0.5 + i * 0.9; twinkle(c, DA.x + Math.cos(a) * 280, DA.y + Math.sin(a) * 260, 30 * (1 - u) * 6, D, 320 + i, PAL.yel); }
  } else drawDaStatic(D, 330);
  // 2) a second walker peels out of 大 and strides over, then becomes 走
  if (t >= PEEL[0] && t < ZOU_T[0]) {
    const w = walker2(t);
    if (t < PEEL[1]) {
      const u = ioL((t - PEEL[0]) / (PEEL[1] - PEEL[0]));
      const S = guyStrokes(w.tf, w.pose, 13 / 0.8 * 0.85);
      const m = daPairs(S).map(([a, b]) => lerpStroke(b, a, u));
      drawStrokeGuy({ arms: [m[0], m[1]], torso: m[2], legs: [m[3], m[4]], C: lerpPt(daTop(), S.C, u), R: S.R }, D, 340, { headS: E.out2(u), color: PAL.orgD });
    } else drawGuy(c, w.tf, w.pose, { D, k: 350, face: 'grin' });
  }
  if (t >= ZOU_T[0]) {
    if (t < ZOU_T[1]) {
      const u = ioL((t - ZOU_T[0]) / (ZOU_T[1] - ZOU_T[0]));
      const w = walker2(ZOU_T[0]);
      const S = guyStrokes(w.tf, w.pose, 13 / 0.8 * 0.85);
      const m = zouPairs(S).map(([a, b]) => lerpStroke(a, b, u));
      const Z = zouSt();
      drawStrokeGuy({ arms: [m[0], m[2]], torso: m[1], legs: [m[3], m[4]], C: lerpPt(S.C, Z[1].p[0], u), R: S.R }, D, 360, { headS: 1 - E.in2(u) });
      drawStroke(c, growStroke(Z[3], u), D, 370); drawStroke(c, growStroke(Z[4], clamp(u * 1.4 - 0.4)), D, 371);
    } else drawZouStatic(D, 380);
  }
  // 3) the red seal 理论 stamps in
  const su = clamp((t - SEAL_T) / 0.12);
  if (su > 0) drawSeal(c, 878, 1135, 1.1 * (1 + 0.9 * (1 - E.out3(su))), '理论', D, 390, { r: -0.07 });
  if (su > 0 && t - SEAL_T < 0.4) for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2 + 0.3; const r = 160 + 140 * E.out3(clamp((t - SEAL_T) / 0.3)); inkStroke(c, [[878 + Math.cos(a) * r, 1135 + Math.sin(a) * r], [878 + Math.cos(a) * (r + 40), 1135 + Math.sin(a) * (r + 40)]], { seed: D * 13 + 395 + i, w: 6, amp: 0.6, t0: 2, t1: 6 }); }
  SUB('拒绝躺平久坐 · 每天多走路', t, bt(9) + E8, B[3] - 0.08, 1370, { D, seed: 398, size: 64 });
}

// ------------------------------------------------------------------ S3 + S4: 一坐就是一整天 / 肌肉“停工” (B3 – B5)
const SEAT = { x: 300, y: 1135 };
const FLOOR2 = SEAT.y + 135;
const SIT = { x: SEAT.x - 8, y: SEAT.y - 12, s: 1.0 };
const DESK = { x: 455, y: 1020 };
const CLK = { x: 800, y: 690, s: 1.0 };
const CH_T = [B[3], B[3] + 0.34];
let CHAIR_ST = null;
const chairSt = () => (CHAIR_ST ||= CHAIR.map((P, i) => ({ p: rs(spline(P.map(([x, y]) => [SEAT.x + x, SEAT.y + y]), false, 4)), w: profile(CHAIR_W[i]) })));
function sitPose(tq, slump = 0) {
  const p = poseSit({ face: 'meh' });
  const ty = 0.06 * Math.sin(tq * 26);
  p.arms = [{ t: 1.0 + ty - slump * 0.35, k: 0.55 + slump * 0.2 }, { t: 1.1 - ty - slump * 0.35, k: 0.45 + slump * 0.2 }];
  p.lean = -0.05 + slump * 0.26; p.head = 0.12 + slump * 0.45;
  return p;
}
const sitTf = () => ({ x: SIT.x, y: SIT.y, s: SIT.s });
function sceneDesk(t, tq, D) {
  if (t < B[3] || t >= B[5] + 0.2) return;
  const out = t >= B[5] - 0.04 ? E.in2(clamp((t - (B[5] - 0.04)) / 0.16)) : 0; // everything but the desk top pops away
  const slump = E.io2(clamp((t - B[4]) / (B[5] - B[4] - 0.2)));
  // --- chair (from 大) and sitter (from 走)
  if (out < 1) {
    c.save(); c.translate(SEAT.x, SEAT.y); c.scale(1 - out, 1 - out); c.translate(-SEAT.x, -SEAT.y);
    if (t < CH_T[1]) {
      const u = ioL((t - CH_T[0]) / (CH_T[1] - CH_T[0]));
      const [h, pie, na] = daSt(), ch = chairSt();
      [[h, ch[0]], [pie, ch[1]], [na, ch[2]]].forEach(([a, b], i) => drawStroke(c, lerpStroke(a, b, u), D, 400 + i));
      const Z = zouSt();
      const S = guyStrokes(sitTf(), sitPose(tq, 0));
      const m = [[Z[1], S.torso], [Z[0], S.arms[0]], [Z[2], S.arms[1]], [Z[5], S.legs[0]], [Z[6], S.legs[1]]].map(([a, b]) => lerpStroke(a, b, u));
      drawStrokeGuy({ torso: m[0], arms: [m[1], m[2]], legs: [m[3], m[4]], C: lerpPt(Z[1].p[0], S.C, u), R: S.R }, D, 410, { headS: E.outBack(clamp(u * 1.2 - 0.2), 2) });
      drawStroke(c, growStroke(Z[3], 1 - u), D, 418); drawStroke(c, growStroke(Z[4], 1 - u), D, 419);
    } else {
      chairSt().forEach((st, i) => drawStroke(c, st, D, 420 + i));
      const legInk = mixHex(PAL.ink, '#9aa0a6', E.io2(clamp((t - B[4]) / 0.35)));
      const face = t >= bt(18) ? 'sleep' : 'meh';
      drawGuy(c, sitTf(), sitPose(t < B[4] ? tq : onN(t, FPS, 4), slump), { D, k: 430, face, legInk, shoe: t >= B[4] ? mixHex(PAL.org, PAL.grey, E.io2(clamp((t - B[4]) / 0.35))) : undefined });
      // Zzz rising from the idle legs
      [bt(17) + E8, bt(18) + E8, bt(19) + E8].forEach((tz, i) => {
        const u = (t - tz) / 0.9; if (u <= 0 || u >= 1) return;
        c.save(); c.globalAlpha *= 1 - E.in2(u);
        letters(c, 'Z', { font: 'KL', size: 76 + 16 * i, x: 470 + 60 * i + 150 * E.out2(u) + 18 * Math.sin(u * 6), y: 1215 - 30 * i - 110 * E.out2(u), fill: PAL.greyL, ink: PAL.ink, inkW: 4, D, seed: 440 + i, anim: () => ({ s: E.outBack(clamp(u * 4), 2), r: -0.2 + 0.1 * i }) });
        c.restore();
      });
    }
    c.restore();
  }
  // --- desk + laptop (desk draws on; its top line survives into the timeline)
  const du = clamp((t - (B[3] + 0.16)) / 0.4);
  if (t < B[5] - 0.04) {
    if (du > 0) drawDesk(c, T(DESK.x, DESK.y, 1), D, { draw: E.io2(du) });
    const ls = appear(t, bt(13), 0.22, 2.2);
    if (ls > 0.01) {
      c.save(); c.translate(DESK.x + 140, DESK.y); c.scale(ls, ls); c.translate(-(DESK.x + 140), -DESK.y);
      drawLaptop(c, T(DESK.x, DESK.y - 14, 1), D, { glow: 1 - 0.6 * slump });
      c.restore();
    }
  } else if (out < 1) {
    // legs and laptop shrink away, the top line is handed to the timeline
    c.save(); c.translate(DESK.x + 200, DESK.y + 120); c.scale(1 - out, 1 - out); c.translate(-(DESK.x + 200), -(DESK.y + 120));
    for (const [x, i] of [[26, 0], [374, 1]]) stroke(c, [[x, 10], [x + (i ? 6 : -6), 240]], T(DESK.x, DESK.y), D, 41 + i, { w: 14, t0: 2, t1: 2 });
    drawLaptop(c, T(DESK.x, DESK.y - 14, 1), D, { glow: 0.3 });
    c.restore();
  }
  // --- wall clock spinning (S3) → battery draining (S4)
  const cs = appear(t, bt(13) + E8, 0.22, 2.4);
  if (t < B[4] && cs > 0.01) {
    const m = (t - bt(13)) * 9;
    drawClock(c, T(CLK.x, CLK.y, CLK.s * cs), { D, h: m / 12 + 1.5, m });
  } else if (t >= B[4] && t < B[5]) {
    const mu = ioL((t - B[4]) / 0.26);
    const lv = 0.92 - [bt(17), bt(18), bt(19)].reduce((a, tb) => a + 0.26 * E.out3(clamp((t - tb) / 0.12)), 0);
    if (mu < 1) drawMorph(morphW(xf(clockDense(), { x: CLK.x, y: CLK.y, sx: CLK.s, sy: CLK.s }), xf(batteryDense(), { x: CLK.x, y: CLK.y, sx: 1.1, sy: 1.1 }), mu, 'clock-batt'), PAL.hi, D, 450);
    else {
      const blink = t > bt(19) + 0.2 && Math.floor((t - bt(19)) * 6) % 2 === 0;
      drawBattery(c, T(CLK.x, CLK.y, 1.1, 0.04 * Math.sin(tq * 3)), D, lv, { color: blink ? PAL.redL : undefined });
    }
  }
  HL('一坐就是一整天？', t, B[3] + 0.08, B[4] - 0.1, 430, { D, seed: 460, size: 112 });
  HL('肌肉“停工”', t, B[4] + 0.06, B[5] - 0.1, 430, { D, seed: 461, size: 130, color: { 3: PAL.red, 4: PAL.red } });
  SUB('坐着不动，代谢跟着变慢', t, bt(17), B[5] - 0.1, 1420, { D, seed: 462 });
}

// ------------------------------------------------------------------ S5 + S6: 8 小时实验 / 每 30 分钟走 5 分钟 (B5 – B7)
const TL = { x0: 110, x1: 970, y: 1300 };
const TLX = (f) => lerp(TL.x0, TL.x1, f);
const CLK2 = { x: 540, y: 900, s: 1.5 };
const FP_T = (i) => B[6] + i * E16; // 16 footprints on sixteenths
function timelineLine(t, D, k) {
  const u = ioL((t - (B[5] - 0.04)) / 0.3);
  const a0 = lerpPt([DESK.x, DESK.y - 3], [TL.x0, TL.y], u), a1 = lerpPt([DESK.x + 400, DESK.y - 3], [TL.x1, TL.y], u);
  inkStroke(c, [a0, a1], { seed: D * 13 + k, w: lerp(12, 10, u), amp: 1.2, t0: 4, t1: 4 });
  return u;
}
function ticks(t, D, k, tIn) {
  for (let i = 0; i <= 16; i++) {
    const u = clamp((t - tIn - i * 0.018) / 0.12); if (u <= 0) continue;
    const x = TLX(i / 16), L = (i % 2 ? 14 : 26) * E.out2(u);
    inkStroke(c, [[x, TL.y - L], [x, TL.y + L]], { seed: D * 13 + k + i, w: i % 2 ? 4 : 6, amp: 0.8, t0: 2, t1: 2 });
  }
}
function sceneTimeline(t, tq, D) {
  if (t < B[5] - 0.04 || t >= B[7] + 0.05) return;
  const u = timelineLine(t, D, 500);
  if (u >= 1) ticks(t, D, 510, B[5] + 0.22);
  const lab = appear(t, B[5] + 0.4, 0.2, 2);
  if (lab > 0) { for (const [s, f] of [['0h', 0], ['8h', 1]]) letters(c, s, { font: 'KL', size: 50, x: TLX(f), y: TL.y + 70, fill: PAL.ink, ink: null, D, seed: 530 + f, anim: () => ({ s: lab }) }); }
  // S5: 8-hour progress (orange) + clock
  const p5 = clamp((t - (B[5] + 0.3)) / (B[6] - B[5] - 0.45));
  if (t < B[6] && p5 > 0) inkStroke(c, [[TL.x0, TL.y - 1], [lerp(TL.x0, TL.x1, E.io2(p5)), TL.y - 1]], { seed: D * 13 + 540, w: 22, amp: 1, t0: 4, t1: 4, color: PAL.orgL, heavy: 0 });
  // battery → clock
  const mu = ioL((t - B[5]) / 0.3);
  if (mu < 1) drawMorph(morphW(xf(batteryDense(), { x: CLK.x, y: CLK.y, sx: 1.1, sy: 1.1 }), xf(clockDense(), { x: CLK2.x, y: CLK2.y, sx: CLK2.s, sy: CLK2.s }), mu, 'batt-clock'), PAL.hi, D, 545);
  else {
    let h, m, arc;
    if (t < B[6]) { const hp = E.io2(p5) * 8; h = hp / 12 * Math.PI * 2; m = hp * Math.PI * 2; arc = h; }
    else { // one half-turn of the minute hand per footprint
      let n = 0; for (let i = 0; i < 16; i++) if (t >= FP_T(i)) n = i + 1 - 1 + E.out3(clamp((t - FP_T(i)) / 0.08));
      m = n * Math.PI; h = m / 12; arc = 0;
    }
    const bp = t >= B[6] ? beatPulse(t, Array.from({ length: 16 }, (_, i) => FP_T(i)), 14) : 0;
    drawClock(c, T(CLK2.x, CLK2.y, CLK2.s * (1 + 0.04 * bp)), { D, h, m, arc });
  }
  // S6: footprints pop at every 30-min mark on sixteenths, a little walker follows
  if (t >= B[6]) {
    const gone = t >= B[7] ? clamp((t - B[7]) / 0.05) : 0;
    let last = -1;
    for (let i = 0; i < 16; i++) {
      const a = appear(t, FP_T(i), 0.14, 2.6) * vanish(t, B[7] - 0.02 + i * 0.004, 0.08);
      if (a <= 0.01) continue; last = i;
      const left = i % 2 === 0;
      drawFoot(c, T(TLX((i + 0.5) / 16), TL.y - 46 + (left ? -9 : 9), 0.21 * a, Math.PI / 2, left ? -1 : 1, 1), D, 560 + i * 3, { w: 3 });
    }
    if (last >= 0 && t < B[7]) {
      const x = TLX((last + 0.5) / 16) + 30;
      drawGuy(c, { x, y: TL.y - 92 - HIPH(0.3), s: 0.3 }, poseWalk(walkPh(tq) * 2, { stride: 0.5, face: 'grin' }), { D, k: 600, w: 15, face: 'grin' });
    }
  }
  HL('实验：连坐 8 小时', t, B[5] + 0.06, B[6] - 0.1, 430, { D, seed: 620, size: 112, color: { 5: PAL.org } });
  SUB('哥伦比亚大学 · 2023', t, B[5] + 0.4, B[6] - 0.1, 1440, { D, seed: 621 });
  HL('每 30 分钟', t, B[6] + 0.04, B[7] - 0.08, 400, { D, seed: 622, size: 120, color: { 1: PAL.org, 2: PAL.org } });
  HL('起来走 5 分钟', t, bt(25), B[7] - 0.08, 545, { D, seed: 623, size: 120, color: { 3: PAL.org } });
}

// ------------------------------------------------------------------ S7 – S9: 血糖高峰 → 踩下去 −58% → 那走多少步？ (B7 – B10)
const PEAK = { x: 600, wl: 110, wr: 230, H: 420 };
const JUMP = bt(31), LAND = B[8];
const BOWL = { x: 330, y: TL.y - 72, s: 0.55 };
const GJ = { x0: 150, s: 0.42 };
function peakH(t) {
  if (t < LAND) return PEAK.H * E.in2(clamp((t - (B[7] + 0.08)) / (JUMP - B[7] - 0.08)));
  if (t < B[9]) return K(t, [[LAND, 420], [LAND + 0.07, 140, 'in2'], [LAND + 0.18, 192, 'out2'], [LAND + 0.3, 176, 'io2']]);
  return 176 * (1 - ioL((t - B[9]) / 0.3));
}
function curvePts(Hh, yb = TL.y) {
  const P = [];
  for (let i = 0; i <= 90; i++) {
    const x = lerp(TL.x0, TL.x1, i / 90);
    const d = x - PEAK.x, w = d < 0 ? PEAK.wl : PEAK.wr;
    P.push([x, yb - Hh * Math.exp(-(d * d) / (w * w))]);
  }
  return P;
}
function sceneCurve(t, tq, D) {
  if (t < B[7] - 0.02 || t >= B[10] + 0.35) return;
  const Hh = peakH(t);
  const gFade = t > B[10] ? vanish(t, B[10] + 0.02, 0.25) : 1;
  // impact (behind the curve and the walker), centred on the stomp point
  if (t >= LAND && t < LAND + 0.32) {
    const u = t - LAND, cy = TL.y - Hh;
    c.save(); c.globalAlpha *= 1 - E.in2(clamp((u - 0.18) / 0.14));
    starBurst(c, PEAK.x, cy, 90 + 200 * E.out3(clamp(u / 0.2)), 12, D, 760, PAL.yel, 0.3);
    speedLines(c, PEAK.x, cy, 220, 360, 12, D, 770, { w: 6 });
    c.restore();
  }
  if (gFade > 0) {
    if (t < B[9] + 0.3) {
      const P = curvePts(Hh);
      // area under the peak tinted red (rising) / green (after the stomp)
      if (Hh > 4) { c.save(); c.globalAlpha *= 0.5; fillPoly(c, boil([...P, [TL.x1, TL.y], [TL.x0, TL.y]].map((q) => [q[0] + REG.dx, q[1] + REG.dy]), D * 13 + 700, 1.4, 60), t < LAND ? PAL.redL : PAL.grnL); c.restore(); }
      inkStroke(c, P, { seed: D * 13 + 701, w: 10, amp: 1.2, t0: 4, t1: 4, dense: true });
      if (t < B[8]) ticks(t, D, 702, -1);
    } else {
      const half = (TL.x1 - TL.x0) / 2 * gFade, cx = (TL.x0 + TL.x1) / 2;
      ground(cx - half, cx + half, TL.y, (tq - B[9]) * STEP(GJ.s) / BEAT, D, 705, { ticks: gFade > 0.98 });
    }
  }
  if (t >= LAND && t < B[9] + 0.1) { // old peak level, dashed
    const a = clamp((t - LAND - 0.06) / 0.15) * vanish(t, B[9] - 0.05, 0.15);
    if (a > 0) { c.save(); c.globalAlpha *= a; dashed(420, 790, TL.y - PEAK.H, D, 710, { color: PAL.red }); c.restore();
      letters(c, '一直坐着', { font: 'MK', size: 46, x: 424, y: TL.y - PEAK.H - 44, align: 'left', fill: PAL.red, ink: null, D, seed: 715, anim: () => ({ s: a }) }); }
  }
  // clock → rice bowl (the meal), then the bowl sits on the line
  const mu = ioL((t - B[7]) / 0.3);
  const bOut = vanish(t, B[8] - 0.1, 0.12);
  if (t < B[8]) {
    if (mu < 1) drawMorph(morphW(xf(clockDense(), { x: CLK2.x, y: CLK2.y, sx: CLK2.s, sy: CLK2.s }), xf(bowlDense(), { x: BOWL.x, y: BOWL.y, sx: BOWL.s, sy: BOWL.s }), mu, 'clock-bowl'), PAL.hi, D, 720);
    else if (bOut > 0.01) drawBowl(c, T(BOWL.x, BOWL.y + (1 - bOut) * 40, BOWL.s * bOut), D, tq);
  }
  // the walker: crouch (riser) → jump on the cymbal → stomp the peak on the drop → walk on
  let gx = GJ.x0, gy = TL.y, pose, face = 'grin';
  if (t < JUMP) {
    const cu = E.io2(clamp((t - B[7] - 0.3) / (JUMP - B[7] - 0.3)));
    pose = mixPose(poseStand({ face: 'happy' }), poseJump(0, { face: 'grin' }), cu);
    gy = TL.y; face = cu > 0.5 ? 'grin' : 'happy';
  } else if (t < LAND) {
    const u = (t - JUMP) / (LAND - JUMP);
    gx = lerp(GJ.x0, PEAK.x, u); gy = lerp(TL.y, TL.y - PEAK.H, u) - 160 * 4 * u * (1 - u);
    pose = poseJump(u < 0.75 ? 1 : lerp(1, 0.3, (u - 0.75) / 0.25), { face: 'grin' });
  } else if (t < B[9]) {
    gx = PEAK.x; gy = TL.y - Hh;
    const sq = clamp((t - LAND) / 0.25);
    pose = mixPose(poseJump(0.3, { face: 'grin' }), poseBig({ spread: 0.6, face: 'grin' }), E.out3(sq));
    pose.arms = [{ t: -2.6, k: 0.2 }, { t: 2.6, k: -0.2 }];
  } else {
    gx = PEAK.x; gy = TL.y - Hh;
    pose = poseWalk(walkPh(tq), { stride: 0.46, face: 'grin' });
  }
  const gS = t > B[10] ? GJ.s * vanish(t, B[10], 0.2) : GJ.s;
  if (gS > 0.01) {
    if (t >= B[9] + 0.3 && t < B[10]) footTrail(t, tq, B[9] + 0.3, B[10], gx + 40, TL.y + 40, 0.17, D, 730, { gs: GJ.s });
    drawGuy(c, { x: gx, y: gy - HIPH(gS) + (t < JUMP ? 16 * E.io2(clamp((t - B[7] - 0.3) / 1)) * 0 : 0), s: gS }, pose, { D, k: 740, w: 15, face });
  }
  if (t >= LAND && t < LAND + 0.6) { puff(c, PEAK.x - 140 - 120 * (t - LAND), TL.y - 20, 40 + 40 * (t - LAND), D, 780); puff(c, PEAK.x + 150 + 120 * (t - LAND), TL.y - 20, 40 + 40 * (t - LAND), D, 781); }
  // the smartwatch pops in with a question
  if (t >= bt(37) && t < B[10]) {
    const s = 0.62 * appear(t, bt(37) + E8, 0.26, 2.2);
    drawWatch(c, T(330, 860, s, -0.06 + 0.05 * Math.sin(tq * 4)), D, { steps: '?', ring: 0, size: 150, label: ' ' });
  }
  HL('饭后一直坐着', t, B[7] + 0.06, B[8] - 0.1, 380, { D, seed: 790, size: 112 });
  HL('血糖一路飙升', t, bt(29), B[8] - 0.1, 520, { D, seed: 791, size: 120, allFill: PAL.red, punch: 0.05 * beatPulse(tq, [bt(30), JUMP], 10) });
  HL('饭后血糖峰值', t, LAND + 0.02, B[9] - 0.1, 380, { D, seed: 792, size: 116 });
  if (t >= LAND + 0.02 && t < B[9] + 0.1) { c.save(); c.globalAlpha *= clamp((t - LAND - 0.02) / 0.05); bigNum('58%', 540, 610, 255, slam(t, LAND + 0.02) * vanish(t, B[9] - 0.1, 0.12), PAL.grn, 1, D, 793); c.restore(); }
  SUB('对比一直坐着不动', t, LAND + 0.35, B[9] - 0.1, 1440, { D, seed: 795 });
  HL('那每天', t, B[9] + 0.06, B[10] - 0.08, 380, { D, seed: 796, size: 112 });
  HL('走多少步才够？', t, bt(37), B[10] - 0.08, 520, { D, seed: 797, size: 120, color: { 1: PAL.org, 2: PAL.org, 3: PAL.org } });
}

// ------------------------------------------------------------------ S10 + S11: 每天 7000 步 / 全因死亡风险 ↓47% (B10 – B12)
const WCH = { x: 540, y: 1010, s: 1.0 }, WCH2 = { x: 540, y: 1090, s: 0.85 };
function stepsAt(t) { return 7000 * E.io2(clamp((t - B[10] - 0.15) / (B[11] - 0.12 - B[10] - 0.15))); }
function sceneWatch(t, tq, D) {
  if (t < B[10] - 0.02 || t >= B[12] + 0.3) return;
  const mu = ioL((t - B[10]) / 0.3), mv = ioL((t - B[11] - 0.02) / 0.22);
  const x = lerp(330, WCH.x, mu), y = lerp(lerp(860, WCH.y, mu), WCH2.y, mv), s = lerp(lerp(0.62, WCH.s, mu), WCH2.s, mv);
  const n = stepsAt(t), ring = n / 7000;
  const punch = pulse(t, B[11], 7) * 0.18;
  if (t < B[12]) {
    // footprints marching around the watch
    if (ring > 0.01 && ring < 1.02) {
      for (let j = 0; j < 12; j++) {
        const a = -Math.PI / 2 + ring * Math.PI * 2 - j * 0.3;
        if (a < -Math.PI / 2) break;
        const out = j % 2 ? 1 : -1, r = (WATCH_R + 74 + out * 14) * s;
        const fa = appear(t, B[10] + 0.15, 0.2, 2) * (1 - j / 12);
        drawFoot(c, T(x + Math.cos(a) * r, y + Math.sin(a) * r, 0.26 * fa, a + Math.PI, out > 0 ? 1 : -1, 1), D, 800 + j * 3, { w: 3.2 });
      }
    }
    if (t >= B[11] && t < B[11] + 0.5) { const u = t - B[11]; for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2 + 0.2; twinkle(c, x + Math.cos(a) * (300 + 160 * E.out3(u * 3)), y + Math.sin(a) * (300 + 160 * E.out3(u * 3)), 34 * (1 - u * 2), D, 840 + i, i % 2 ? PAL.yel : PAL.orgL, a); } }
    const shown = t < B[11] ? String(Math.round(n / 10) * 10) : '7000';
    drawWatch(c, T(x, y, s * (1 + punch), 0.03 * Math.sin(tq * 3)), D, { steps: shown, ring: Math.min(1, ring), size: shown.length > 3 ? 84 : 100, label: '步' });
  } else { // watch ring → brain (S12 picks up the contour)
    const u = ioL((t - B[12]) / 0.3);
    const A = xf(watchDense(), { x: WCH2.x, y: WCH2.y, sx: WCH2.s, sy: WCH2.s });
    drawMorph(morphW(A, xf(brainDense(), { x: 540, y: 990, sx: 1.2, sy: 1.2 }), u, 'watch-brain'), mixHex(PAL.greyL, PAL.pink, u), D, 860);
  }
  HL('每天 7000 步', t, B[10] + 0.06, B[11] - 0.1, 400, { D, seed: 870, size: 140, color: { 2: PAL.org, 3: PAL.org, 4: PAL.org, 5: PAL.org } });
  HL('全因死亡风险', t, B[11] + 0.02, B[12] - 0.08, 370, { D, seed: 871, size: 104 });
  if (t >= B[11] + 0.04 && t < B[12] + 0.1) { c.save(); c.globalAlpha *= clamp((t - B[11] - 0.04) / 0.05); bigNum('47%', 540, 565, 232, slam(t, B[11] + 0.04) * vanish(t, B[12] - 0.1, 0.12), PAL.grn, 1, D, 872); c.restore(); }
  SUB('对比每天 2000 步', t, bt(45), B[12] - 0.08, 1440, { D, seed: 874, size: 60 });
  SUB('《柳叶刀·公共卫生》2025', t, bt(45) + E8, B[12] - 0.08, 1515, { D, seed: 875, size: 46 });
}

// ------------------------------------------------------------------ S12: 大脑也受益 (B12 – B13)
const BR = { x: 540, y: 990, s: 1.2 };
function sceneBrain(t, tq, D) {
  if (t < B[12] || t >= B[13] + 0.3) return;
  const bp = beatPulse(tq, [bt(49), bt(50), bt(51)], 9);
  if (t < B[12] + 0.3) { /* watch → brain morph is drawn by sceneWatch */ }
  else if (t < B[13]) {
    drawBrain(c, T(BR.x, BR.y - 14 * bp, BR.s, 0.03 * Math.sin(tq * 3), 1 + 0.03 * bp, 1 - 0.03 * bp), D, { folds: clamp((t - B[12] - 0.3) / 0.4), face: t > bt(49) - 0.1 ? 'grin' : (t > B[12] + 0.5 ? 'happy' : null) });
    [[250, 760, bt(49)], [840, 800, bt(50)], [860, 1150, bt(51)]].forEach(([x, y, tb], i) => { const u = clamp((tq - tb) / 0.18); if (u > 0) twinkle(c, x, y, 40 * E.outBack(u, 2.5), D, 880 + i, PAL.yel, 0.3 * i); });
  } else {
    const u = ioL((t - B[13]) / 0.3);
    drawMorph(morphW(xf(brainDense(), { x: BR.x, y: BR.y, sx: BR.s, sy: BR.s }), xf(bulbDense(), { x: 540, y: 1040, sx: 1, sy: 1 }), u, 'brain-bulb'), mixHex(PAL.pink, PAL.hi, u), D, 890);
  }
  drawStat(540, 1340, 1.12 * appear(t, bt(49), 0.24, 2.4) * vanish(t, B[13] - 0.1, 0.12), '痴呆风险', '38%', D, 900, { r: -0.02 });
  drawStat(540, 1490, 1.12 * appear(t, bt(50), 0.24, 2.4) * vanish(t, B[13] - 0.1, 0.12), '抑郁症状', '22%', D, 910, { r: 0.02 });
  HL('大脑也受益！', t, B[12] + 0.06, B[13] - 0.08, 420, { D, seed: 920, size: 126 });
}

// ------------------------------------------------------------------ S13: 边走边想，创意 +60% (B13 – B14)
const BULB = { x: 540, y: 1040, s: 1.0 };
function sceneBulb(t, tq, D) {
  if (t < B[13] || t >= B[14] + 0.3) return;
  const lit = E.out3(clamp((t - bt(53)) / 0.15));
  if (t < B[13] + 0.3) { /* brain → bulb morph is drawn by sceneBrain */ }
  else if (t < B[14]) {
    const bp = beatPulse(tq, [bt(54), bt(55)], 9);
    drawBulb(c, T(BULB.x, BULB.y - 10 * bp, BULB.s * (1 + 0.03 * bp), 0.03 * Math.sin(tq * 3)), D, lit);
    if (lit > 0) [[240, 860], [850, 900], [820, 1300], [250, 1250]].forEach(([x, y], i) => { const u = clamp((tq - bt(53) - i * E16) / 0.18); if (u > 0) twinkle(c, x, y, 38 * E.outBack(u, 2.5), D, 930 + i, PAL.yel, 0.3 * i); });
  } else {
    const u = ioL((t - B[14]) / 0.3);
    drawMorph(morphW(xf(bulbDense(), { x: BULB.x, y: BULB.y, sx: 1, sy: 1 }), xf(switchDense(), { x: SW1.x, y: SW1.y, sx: SW1.s, sy: SW1.s }), u, 'bulb-sw'), mixHex(PAL.yel, PAL.greyL, u), D, 940);
  }
  HL('边走边想', t, B[13] + 0.06, B[14] - 0.08, 380, { D, seed: 950, size: 126 });
  HL('创意 +60%', t, bt(53), B[14] - 0.08, 550, { D, seed: 951, size: 150, color: { 2: PAL.org, 3: PAL.org, 4: PAL.org, 5: PAL.org } });
  SUB('斯坦福大学 · 2014', t, bt(54), B[14] - 0.08, 1440, { D, seed: 952 });
}

// ------------------------------------------------------------------ S14 + S15: 代谢在线 / 精神在线 (B14 – B16)
const SW1 = { x: 650, y: 880, s: 1.1 }, SW2 = { x: 650, y: 1170, s: 1.1 };
const FLIP1 = bt(57), FLIP2 = bt(61);
const FOOT_L = { x: 400, y: 1135, s: 1.8, r: -0.16 }, FOOT_R = { x: 690, y: 995, s: 1.8, r: 0.16 };
const footTf = (F, k = 1) => ({ x: F.x, y: F.y, r: F.r, sx: (F === FOOT_L ? -1 : 1) * F.s * k, sy: F.s * k });
function sceneSwitch(t, tq, D) {
  if (t < B[14] || t >= B[16]) return;
  const bp = beatPulse(tq, [bt(58), bt(59), bt(60), bt(62), bt(63), bt(63) + E8], 10), bp2 = beatPulse(tq, [bt(62), bt(63), bt(63) + E8], 10);
  const on1 = clamp((t - FLIP1) / 0.12), on2 = clamp((t - FLIP2) / 0.12);
  // beat sparkles around the switches that are already ON
  for (const [x, y, n] of [[905, 770, 58], [930, 985, 59], [430, 745, 60], [930, 1290, 62], [420, 1330, 63]]) {
    const u = clamp((tq - bt(n)) / 0.16), v = vanish(tq, bt(n) + 0.35, 0.15);
    if (u > 0 && v > 0 && t < B[16] - 0.15) twinkle(c, x, y, 40 * E.outBack(u, 2.5) * v, D, 985 + n, n % 2 ? PAL.yel : PAL.grnL, 0.4 * n);
  }
  // switch 1 morphs into the left foot just before the drop, switch 2 into the right foot
  const m1 = ioL((t - (B[16] - 0.13)) / 0.13);
  if (t < B[14] + 0.3) { /* bulb → switch morph is drawn by sceneBulb */ }
  else if (m1 <= 0) drawSwitch(c, T(SW1.x, SW1.y - 8 * bp, SW1.s * (1 + 0.03 * bp)), D, 960, on1);
  else drawMorph(morphW(xf(switchDense(), { x: SW1.x, y: SW1.y, sx: SW1.s, sy: SW1.s }), xf(footDense(), footTf(FOOT_L)), m1, 'sw1-foot'), mixHex(PAL.grn, PAL.org, m1), D, 965);
  const s2 = appear(t, B[15], 0.26, 2.2);
  if (s2 > 0.01) drawSwitch(c, T(SW2.x, SW2.y - 8 * bp2, SW2.s * s2 * (1 + 0.03 * bp2)), D, 970, on2);
  for (const [lab, y, tIn, k] of [['代谢', SW1.y, B[14] + 0.08, 975], ['精神', SW2.y, B[15] + 0.06, 976]]) {
    const a = appear(t, tIn, 0.24, 2.4) * vanish(t, B[16] - 0.12, 0.1);
    if (a > 0.01) letters(c, lab, { font: 'KL', size: 104, x: 262, y: y + 4, fill: PAL.ink, ink: null, D, seed: k, anim: (i) => ({ s: a, r: (i ? 0.04 : -0.04) }) });
  }
  // "click" sparks
  for (const [tf, sw] of [[FLIP1, SW1], [FLIP2, SW2]]) if (t >= tf && t < tf + 0.3) speedLines(c, sw.x + 120, sw.y, 120, 190, 7, D, 980 + (sw === SW2 ? 10 : 0), { w: 6, a0: -0.9, a1: 0.9 });
  HL('代谢在线！', t, FLIP1, B[16] - 0.1, 380, { D, seed: 990, size: 126, color: { 2: PAL.grn, 3: PAL.grn } });
  HL('精神在线！', t, FLIP2, B[16] - 0.1, 525, { D, seed: 991, size: 126, color: { 2: PAL.grn, 3: PAL.grn } });
}

// ------------------------------------------------------------------ S16: 这就是大走理论！ (B16 – B17)
const STAMP_R = bt(65);
function sceneClimax(t, tq, D) {
  if (t < B[16] - 0.13 || t >= B[17] + 0.05) return;
  const out = t >= B[17] ? 1 : 0;
  // starburst + flying mini footprints
  if (t >= B[16]) {
    const bu = appear(t, B[16], 0.3, 1.8) * (t >= B[17] - 0.1 ? vanish(t, B[17] - 0.1, 0.12) : 1);
    starBurst(c, 545, 1060, 390 * bu * (1 + 0.04 * beatPulse(tq, [bt(66), bt(67)], 8)), 14, D, 1000, PAL.yel, tq * 0.4);
    const u = t - B[16];
    if (u < 0.9) for (let i = 0; i < 10; i++) {
      const a = i / 10 * Math.PI * 2 + 0.25, r = 260 + 700 * E.out3(clamp(u / 0.9));
      drawFoot(c, T(545 + Math.cos(a) * r, 1060 + Math.sin(a) * r, 0.24 * (1 - u / 0.9), a + Math.PI / 2, i % 2 ? 1 : -1, 1), D, 1010 + i * 3, { w: 3 });
    }
  }
  // the right foot morphs from switch 2 and stamps on the next beat
  if (t < B[17]) {
    const sL = 1 + 0.35 * (1 - E.out3(clamp((t - B[16]) / 0.1)));
    if (t >= B[16]) drawFoot(c, footTf(FOOT_L, sL), D, 1040, { w: 9, toes: clamp((t - B[16]) / 0.25) });
    const m2 = ioL((t - (STAMP_R - 0.13)) / 0.13);
    if (t >= B[16] && m2 <= 0) drawSwitch(c, T(SW2.x, SW2.y, SW2.s), D, 970, 1);
    else if (m2 > 0 && t < STAMP_R) drawMorph(morphW(xf(switchDense(), { x: SW2.x, y: SW2.y, sx: SW2.s, sy: SW2.s }), xf(footDense(), footTf(FOOT_R)), m2, 'sw2-foot'), mixHex(PAL.grn, PAL.org, m2), D, 1045);
    else if (t >= STAMP_R) drawFoot(c, footTf(FOOT_R, 1 + 0.35 * (1 - E.out3(clamp((t - STAMP_R) / 0.1)))), D, 1050, { w: 9, toes: clamp((t - STAMP_R) / 0.25) });
    // marching crowd
    const cu = clamp((t - bt(66)) / 0.3);
    if (cu > 0) for (let i = 0; i < 7; i++) {
      const x = 80 + i * 150 + ((tq - bt(66)) * 60) % 150;
      const s = 0.21 * E.outBack(clamp(cu * 1.5 - i * 0.08), 2);
      if (s > 0.01) drawGuy(c, { x, y: 1520 - HIPH(s), s }, poseWalk(walkPh(tq) + i * 0.13, { face: 'grin' }), { D, k: 1060 + i * 10, w: 16, face: 'grin' });
    }
  } else if (t < B[17] + 0.05) { /* tips scene morphs the feet */ }
  HL('这就是', t, B[16] + 0.04, B[17] - 0.1, 380, { D, seed: 1080, size: 110 });
  HL('大走理论！', t, STAMP_R + 0.02, B[17] - 0.1, 560, { D, seed: 1081, size: 186, allFill: PAL.org, punch: 0.05 * beatPulse(tq, [bt(66), bt(67)], 10) });
}

// ------------------------------------------------------------------ S17 – S19: three tips (B17 – B20)
function tipTitle(num, l1, l2, t, tIn, tIn2, tOut, D, k, c1, c2) {
  const R = 58, M = measure(l1, 'KL', 116).w, gap = 26, tot = 2 * R + gap + M, x0 = 540 - tot / 2;
  drawBadge(x0 + R, 410, R, appear(t, tIn, 0.24, 2.6) * (t >= tOut ? vanish(t, tOut, 0.12) : 1), PAL.yel, num, D, k, { size: 80, r: -0.1 });
  HL(l1, t, tIn + 0.05, tOut, 410, { D, seed: k + 1, size: 116, x: x0 + 2 * R + gap + M / 2, color: c1 });
  HL(l2, t, tIn2, tOut, 560, { D, seed: k + 2, size: 124, color: c2 });
}
const TCLK = { x: 320, y: 1050, s: 1.6 };
const TW = { x: 540, y: 1060, s: 0.92 };
const SCR = { x: 540, y: 960, s: 1.3 };
const TBULB = { x: 540, y: 930, s: 0.85 };
function sceneTips(t, tq, D) {
  if (t < B[17] || t >= B[20] + 0.05) return;
  // ---- tip 1: feet → clock (30 min) → arrow → walker
  if (t < B[18] + 0.3) {
    if (t < B[17] + 0.3) {
      const u = ioL((t - B[17]) / 0.3);
      drawMorph(morphW(xf(footDense(), footTf(FOOT_L)), xf(clockDense(), { x: TCLK.x, y: TCLK.y, sx: TCLK.s, sy: TCLK.s }), u, 'foot-clock'), mixHex(PAL.org, PAL.hi, u), D, 1100);
      const s = 1 - E.in2(u); if (s > 0.01) drawFoot(c, footTf(FOOT_R, s), D, 1105, { w: 9 });
    } else if (t < B[18]) {
      const a = E.io2(clamp((t - B[17] - 0.3) / (bt(70) - B[17] - 0.3)));
      drawClock(c, T(TCLK.x, TCLK.y, TCLK.s), { D, m: a * Math.PI, h: 2 + a * Math.PI / 12, arc: a * Math.PI, arcColor: PAL.redL });
      const au = clamp((t - bt(70)) / 0.2);
      if (au > 0) drawArrow(c, [[510, 1070], [560, 1060], [610, 1070]], D, 1110, { draw: au, w: 9, head: 28 });
      const gs = 0.7 * appear(t, bt(70) + E8, 0.24, 2.2);
      if (gs > 0.01) {
        footTrail(t, tq, bt(71), B[18], 820, 1340, 0.28, D, 1120, { gs: 0.7 });
        drawGuy(c, { x: 790, y: 1300 - HIPH(gs), s: gs }, poseWalk(walkPh(tq), { face: 'grin' }), { D, k: 1130, w: 14, face: 'grin' });
      }
    } else {
      const u = ioL((t - B[18]) / 0.3);
      drawMorph(morphW(xf(clockDense(), { x: TCLK.x, y: TCLK.y, sx: TCLK.s, sy: TCLK.s }), xf(watchDense(), { x: TW.x, y: TW.y, sx: TW.s, sy: TW.s }), u, 'clock-watch'), mixHex(PAL.hi, PAL.greyL, u), D, 1140);
      const gs = 0.7 * (1 - E.in2(u)); if (gs > 0.01) drawGuy(c, { x: 790, y: 1300 - HIPH(gs), s: gs }, poseWalk(walkPh(tq), { face: 'grin' }), { D, k: 1130, w: 14, face: 'grin' });
    }
  }
  // ---- tip 2: watch counts to 7000
  if (t >= B[18] + 0.3 && t < B[19]) {
    const p = E.io2(clamp((t - B[18] - 0.3) / (bt(75) - B[18] - 0.3)));
    const punch = pulse(t, bt(75), 8) * 0.14;
    const st2 = String(Math.round(p * 700) * 10);
    drawWatch(c, T(TW.x, TW.y, TW.s * (1 + punch), 0.03 * Math.sin(tq * 3)), D, { steps: st2, ring: p, size: st2.length > 3 ? 84 : 100, label: '步' });
    if (t >= bt(75)) [[260, 900], [830, 920], [820, 1280], [250, 1260]].forEach(([x, y], i) => { const u = clamp((tq - bt(75) - i * E16) / 0.18); if (u > 0) twinkle(c, x, y, 36 * E.outBack(u, 2.5), D, 1150 + i, PAL.yel, 0.3 * i); });
  }
  // ---- tip 3: watch → tangled scribble (想不通？) → it untangles into a lit bulb (出去走走)
  const UNT = bt(78);
  if (t >= B[19] && t < B[20]) {
    if (t < B[19] + 0.3) {
      const u = ioL((t - B[19]) / 0.3);
      const P = morphW(xf(watchDense(), { x: TW.x, y: TW.y, sx: TW.s, sy: TW.s }), xf(scribbleDense(), { x: SCR.x, y: SCR.y, sx: SCR.s, sy: SCR.s }), u, 'watch-scrib', 260);
      inkLoop(c, P, { seed: D * 13 + 1160, w: 9, amp: 1.6, heavy: 0.2 });
    } else if (t < UNT) {
      const P = xf(scribbleDense(), { x: SCR.x + 6 * Math.sin(tq * 20), y: SCR.y, sx: SCR.s, sy: SCR.s, r: 0.1 * Math.sin(tq * 7) });
      inkLoop(c, P, { seed: D * 13 + 1161, w: 9, amp: 3, heavy: 0.2 });
      for (const [x, y, i] of [[245, 745, 0], [835, 770, 1]]) letters(c, '?', { font: 'KL', size: 110, x, y, fill: PAL.red, ink: PAL.ink, inkW: 4.5, shadow: PAL.ink, D, seed: 1165 + i, anim: () => ({ s: appear(t, B[19] + 0.3 + i * E8, 0.2, 2.6), r: i ? 0.25 : -0.25 }) });
    } else {
      const u = ioL((t - UNT) / 0.3);
      if (u < 1) drawMorph(morphW(xf(scribbleDense(), { x: SCR.x, y: SCR.y, sx: SCR.s, sy: SCR.s }), xf(bulbDense(), { x: TBULB.x, y: TBULB.y, sx: TBULB.s, sy: TBULB.s }), u, 'scrib-bulb', 260), u > 0.4 ? mixHex(PAL.hi, PAL.yel, u) : null, D, 1170, { w: 9 });
      else drawBulb(c, T(TBULB.x, TBULB.y, TBULB.s, 0.03 * Math.sin(tq * 3)), D, E.out3(clamp((t - UNT - 0.3) / 0.15)));
    }
    // footprints walk a lap beneath the idea (16ths), left → right
    for (let i = 0; i < 6; i++) {
      const tf = UNT + (2 + i) * E16, a = appear(tq, tf, 0.16, 2.6) * vanish(t, B[20] - 0.06 + i * 0.01, 0.1);
      if (a <= 0.01) continue;
      const th = lerp(2.75, 0.39, i / 5), left = i % 2 === 0, R = 300 + (left ? -17 : 17);
      const dir = Math.atan2(-Math.cos(th), Math.sin(th));
      drawFoot(c, T(540 + Math.cos(th) * R, 965 + Math.sin(th) * R, 0.27 * a, dir + Math.PI / 2, left ? -1 : 1, 1), D, 1180 + i * 3, { w: 3.2 });
    }
  }
  tipTitle('1', '每坐 30 分钟', '起来走 5 分钟', t, B[17] + 0.02, bt(70), B[18] - 0.1, D, 1200, { 2: PAL.org, 3: PAL.org }, { 3: PAL.org });
  tipTitle('2', '每天走够', '7000 步', t, B[18] + 0.02, bt(73), B[19] - 0.1, D, 1210, null, { 0: PAL.org, 1: PAL.org, 2: PAL.org, 3: PAL.org });
  tipTitle('3', '想不通？', '出去走走', t, B[19] + 0.02, UNT, B[20] - 0.1, D, 1220, { 3: PAL.red }, { 2: PAL.org, 3: PAL.org });
}

// ------------------------------------------------------------------ S20 – S22: 今天，你大走了吗？ (B20 – end) · v2: sunrise
// the idea (bulb) rolls down behind the horizon and rises as the sun; a new walker draws himself on and strides towards it
const GEND = { x: 380, s: 0.8 };
const GEY = FLOOR - HIPH(GEND.s);
const STOP = B[22];
const SUN = { x: 770, R: 185 }, SUNC = '#ffa92e';
const sunY = (t) => lerp(1228, 1082, E.io2(clamp((t - B[20] - 0.32) / (DUR - B[20] - 0.32))));
function skyClip() { c.beginPath(); c.rect(-400, -400, W + 800, FLOOR - 4 + 400); c.clip(); }
function sceneEnd(t, tq, D) {
  if (t < B[20]) return;
  const wp = t < STOP ? poseWalk(walkPh(tq), { stride: 0.46, arm: 0.7, face: 'grin' }) : mixPose(poseWalk(walkPh(STOP), { face: 'grin' }), poseStand({ face: 'wink' }), E.out3(clamp((t - STOP) / 0.2)));
  if (t >= STOP) wp.arms[1] = { t: lerp(wp.arms[1].t, 2.7, E.outBack(clamp((t - STOP) / 0.2), 2)), k: lerp(wp.arms[1].k, 0.3 + 0.25 * Math.sin((t - STOP) * 14), clamp((t - STOP) / 0.2)) };
  const S = guyStrokes({ x: GEND.x, y: GEY, s: GEND.s }, wp);
  const sy = sunY(tq), mu = ioL((t - B[20]) / 0.32), gl = E.out2(clamp((t - B[20] - 0.1) / 0.7));
  const bp = beatPulse(tq, beatsIn(B[20], DUR), 8);
  // warm morning light + slow god-ray wedges in the sky
  if (gl > 0) {
    c.save(); c.globalCompositeOperation = 'multiply'; c.globalAlpha *= gl;
    const g = c.createRadialGradient(SUN.x, sy, 60, SUN.x, sy, 1250);
    g.addColorStop(0, '#ffc46e'); g.addColorStop(0.38, '#ffe2b0'); g.addColorStop(1, '#fff9f0');
    c.fillStyle = g; c.fillRect(-400, -400, W + 800, H + 800);
    c.restore();
    c.save(); skyClip(); sunburst(c, SUN.x, sy, 1900, 22, -0.25 + 0.1 * (tq - B[20]), '#ffd99c', D, 1395, gl); c.restore();
  }
  c.save(); skyClip();
  if (mu < 1) drawMorph(morphW(xf(bulbDense(), { x: TBULB.x, y: TBULB.y, sx: TBULB.s, sy: TBULB.s }), circlePts(SUN.x, sy, SUN.R, 120), mu, 'bulb-sun', 200), mixHex(PAL.yel, SUNC, mu), D, 1305, { w: 10 });
  else {
    const ru = E.outBack(clamp((t - B[20] - 0.32) / 0.3), 2);
    for (let i = 0; i < 12; i++) {
      const a = -0.2 + 0.22 * (tq - B[20]) + (i / 12) * Math.PI * 2;
      const r0 = SUN.R + 28, r1 = r0 + (60 + 14 * Math.sin(i * 1.9)) * ru * (1 + 0.15 * bp);
      if (ru > 0.02) inkStroke(c, [[SUN.x + Math.cos(a) * r0, sy + Math.sin(a) * r0], [SUN.x + Math.cos(a) * r1, sy + Math.sin(a) * r1]], { seed: D * 13 + 1390 + i, w: 12, amp: 0.8, t0: 3, t1: 3 });
    }
    const P = circlePts(SUN.x, sy, SUN.R * (1 + 0.02 * bp), 90);
    fillShape(c, P, SUNC, { seed: D * 13 + 1301, amp: 1.3, dx: REG.dx, dy: REG.dy });
    const hl = []; for (let i = 0; i <= 8; i++) { const a = lerp(3.55, 4.35, i / 8); hl.push([SUN.x + Math.cos(a) * SUN.R * 0.72, sy + Math.sin(a) * SUN.R * 0.72]); }
    inkStroke(c, hl, { seed: D * 13 + 1303, w: 16, amp: 1, t0: 8, t1: 10, color: '#ffe9b8' });
    inkLoop(c, P, { seed: D * 13 + 1302, w: 10, amp: 1.4, heavy: 0.3 });
  }
  c.restore();
  // horizon draws out from the middle, then scrolls with the walk
  const half = 480 * E.out3(clamp((t - B[20] - 0.04) / 0.3));
  const off = (Math.min(tq, STOP) - B[20]) * STEP(GEND.s) / BEAT;
  if (half > 1) ground(540 - half, 540 + half, FLOOR, off, D, 1310, { ticks: half > 470 });
  if (t < B[20] + 0.42) {
    const g = clamp((t - B[20] - 0.1) / 0.3);
    if (g > 0) { const gr = (st) => growStroke(st, E.out2(g)); drawStrokeGuy({ torso: gr(S.torso), legs: S.legs.map(gr), arms: S.arms.map(gr), C: S.C, R: S.R }, D, 1320, { headS: E.outBack(clamp(g * 1.4), 2) }); }
  } else {
    footTrail(t < STOP ? t : STOP, t < STOP ? tq : STOP, B[20] + 0.42, STOP, GEND.x + 60, FLOOR + 50, 0.24, D, 1325, { gs: GEND.s });
    drawGuy(c, { x: GEND.x, y: GEY, s: GEND.s }, wp, { D, k: 1330, face: t >= STOP ? 'wink' : 'grin' });
    for (const tb of beatsIn(B[20] + 0.4, STOP)) { // each step counts: "+1" floats up behind him
      const u = (tq - tb) / 0.5; if (u < 0 || u >= 1) continue;
      const i = Math.round((tb - PH) / BEAT);
      c.save(); c.globalAlpha *= 1 - E.in2(u);
      letters(c, '+1', { font: 'KL', size: 86, x: GEND.x - (i % 2 ? 175 : 205), y: FLOOR - 90 - 120 * E.out2(u), fill: PAL.org, ink: PAL.ink, inkW: 4, shadow: PAL.ink, D, seed: 1380 + i, anim: () => ({ s: E.outBack(clamp(u * 4), 2.4), r: i % 2 ? 0.12 : -0.12 }) });
      c.restore();
    }
    if (t >= STOP) { const k = clamp((tq - STOP) / 0.18); twinkle(c, GEND.x + 200, GEY - 330, 46 * E.outBack(k, 2.5), D, 1340, PAL.yel, tq); twinkle(c, GEND.x - 190, GEY - 250, 30 * E.outBack(clamp(k * 1.3 - 0.3), 2.5), D, 1341, PAL.orgL, 0.4); }
  }
  HL('今天，', t, B[20] + 0.06, 99, 390, { D, seed: 1350, size: 116 });
  HL('你大走了吗？', t, bt(81), 99, 540, { D, seed: 1351, size: 132, color: { 1: PAL.org, 2: PAL.org } });
  // CTA: ☑ 评论区晒步数 ↗
  const M = measure('评论区晒步数', 'KL', 80).w, tot = 84 + 24 + M, x0 = 510 - tot / 2, y = 1468;
  const cs = appear(t, B[21], 0.24, 2.6);
  if (cs > 0) drawCheckbox(c, T(x0 + 42, y, 0.95 * cs * (1 + 0.1 * pulse(t, bt(86), 8))), { D, check: (t - bt(86)) / 0.2 });
  HL('评论区晒步数', t, B[21] + 0.06, 99, y, { D, seed: 1360, size: 80, allFill: PAL.red, x: x0 + 84 + 24 + M / 2 });
  const au = clamp((t - bt(87)) / 0.3);
  if (au > 0) drawArrow(c, [[x0 + tot + 20, y - 10], [x0 + tot + 90, y - 40], [985, y - 140]], D, 1370, { draw: au, w: 8, head: 30 });
}

// ------------------------------------------------------------------ v2 layers: camera, colour backdrops, sunbursts, confetti
// camera: a slow push through every bar that eases back during the next morph, downbeat kicks, impact punches about the hit point
const BREATH = [0.07, 0.03, 0.03, 0.025, 0.035, 0.025, 0.025, 0.07, 0.02, 0.025, 0.04, 0.02, 0.03, 0.03, 0.025, 0.04, 0.03, 0.025, 0.025, 0.025];
let PUNCH = null;
const punches = () => (PUNCH ||= [[FLAT, 0.05, 540, 1300, -0.012], [B[1], 0.1, 540, 880, 0.014], [SEAL_T, 0.04, 878, 1135, 0], [LAND, 0.13, 600, 1124, 0.022],
  [LAND + 0.11, 0.03, 540, 610, 0], [B[11], 0.05, 540, 1090, 0.01], [B[11] + 0.13, 0.025, 540, 565, 0], [bt(53), 0.03, 540, 1040, 0], [FLIP1, 0.02, 650, 880, 0], [FLIP2, 0.02, 650, 1170, 0],
  [B[16], 0.15, 545, 1060, -0.022], [STAMP_R, 0.07, 690, 995, 0.014], [bt(78) + 0.3, 0.035, 540, 930, 0], [STOP, 0.04, 540, 1000, 0]]);
function camZoom(t) {
  if (t < B[1]) return 1 + BREATH[0] * E.io2(clamp(t / FLAT));
  if (t >= B[20]) return 1 + BREATH[19] * (1 - ioL((t - B[20]) / 0.3)) + 0.05 * E.io2(clamp((t - B[20] - 0.3) / (DUR - B[20] - 0.3)));
  const k = Math.min(19, Math.floor((t - PH) / (4 * BEAT) + 1e-9)), u = t - B[k];
  const prev = BREATH[k - 1] ?? 0, cur = BREATH[k] ?? 0;
  return 1 + (u < 0.3 ? prev * (1 - ioL(u / 0.3)) : cur * E.io2(clamp((u - 0.3) / (4 * BEAT - 0.3))));
}
function applyCamera(t) {
  let z = camZoom(t);
  for (let k = 2; k < 22; k++) if (k !== 8 && k !== 16) { const u = t - B[k]; if (u >= 0 && u < 0.6) z *= 1 + 0.014 * (u < 0.05 ? u / 0.05 : Math.exp(-(u - 0.05) * 10)); }
  const r = 0.0035 * Math.sin((2 * Math.PI * (t - PH)) / (8 * BEAT));
  c.translate(540, 960); c.rotate(r); c.scale(z, z); c.translate(-540, -960);
  for (const [t0, amp, x, y, rr] of punches()) {
    const u = t - t0; if (u < 0 || u > 0.8) continue;
    const s = 1 + amp * (u < 0.04 ? u / 0.04 : Math.exp(-(u - 0.04) * 9));
    c.translate(x, y); c.rotate(rr * Math.exp(-6 * u) * Math.sin(20 * u)); c.scale(s, s); c.translate(-x, -y);
  }
}
// colour backdrops: one riso-tinted blob behind the hero shape, re-shaped on every bar (with a halftone drop shadow)
const T_ORG = '#ffcf9f', T_YEL = '#ffe38a', T_GB = '#d3dde8', T_GREY = '#d8d4cc', T_TEAL = '#bfe8dc', T_LIME = '#dcefb0', T_RED = '#f9bfb0', T_GRN = '#c0e8cb', T_PINK = '#f9c9d6', T_BLUE = '#c9e3f5';
let BTRACK = null;
const backdropTrack = () => (BTRACK ||= blobTrack([
  { t: B[1], x: 540, y: 1040, rx: 0, ry: 0, color: T_ORG },
  { t: B[1] + 0.03, d: 0.42, e: 'outBack', rx: 330, ry: 330 },
  { t: B[2] - 0.06, d: 0.36, x: 520, y: 800, rx: 470, ry: 300, n: 4, rot: -0.03, color: T_YEL },
  { t: B[3], x: 545, y: 1010, rx: 410, ry: 320, n: 7, rot: 0.02, color: T_GB },
  { t: B[4], d: 0.6, x: 545, y: 1040, rx: 400, ry: 290, rot: -0.03, wb: 0.05, color: T_GREY },
  { t: B[5], x: 540, y: 900, rx: 300, ry: 300, n: 2, rot: 0, wb: 0, color: T_TEAL },
  { t: B[6], x: 540, y: 990, rx: 430, ry: 370, n: 3.2, rot: 0.04, color: T_LIME },
  { t: B[7], x: 580, y: 1050, rx: 360, ry: 320, n: 2, rot: 0, wb: 0.12, color: T_RED },
  { t: JUMP - 0.4, d: 0.5, e: 'in2', x: 590, y: 1030, rx: 420, ry: 380, sp: 0.14, wb: 0.08 },
  { t: LAND, d: 0.14, e: 'out3', x: 600, y: 1124, rx: 440, ry: 440, sp: 0.38, wb: 0, color: T_GRN },
  { t: B[9], x: 560, y: 1150, rx: 440, ry: 270, sp: 0 },
  { t: B[10], x: 540, y: 1010, rx: 330, ry: 330, color: T_ORG },
  { t: B[11], d: 0.2, e: 'out3', x: 540, y: 1090, rx: 320, ry: 320, sp: 0.22, color: T_YEL },
  { t: B[12], x: 540, y: 990, rx: 370, ry: 330, sp: 0, wb: 0.12, color: T_PINK },
  { t: B[13], x: 540, y: 1010, rx: 300, ry: 300, wb: 0, color: '#ffeab0' },
  { t: bt(53), d: 0.16, e: 'out3', x: 540, y: 1000, rx: 370, ry: 370, sp: 0.3, color: T_YEL },
  { t: B[14], x: 560, y: 1020, rx: 430, ry: 320, n: 4, sp: 0, color: T_GRN },
  { t: B[15], x: 560, y: 1030, rx: 440, ry: 370, rot: 0.03 },
  { t: B[16] - 0.13, d: 0.13, e: 'in2', a: 0 },
  { t: B[17] - 0.01, d: 0, x: 540, y: 1090, rx: 0, ry: 0, a: 1, n: 4, rot: 0, color: T_ORG },
  { t: B[17] + 0.02, d: 0.4, e: 'outBack', rx: 430, ry: 330 },
  { t: B[18], x: 540, y: 1060, rx: 320, ry: 320, n: 2, color: T_BLUE },
  { t: B[19], x: 540, y: 960, rx: 380, ry: 350, wb: 0.16, color: T_GREY },
  { t: bt(78), d: 0.18, e: 'out3', x: 540, y: 930, rx: 380, ry: 380, wb: 0, sp: 0.3, color: T_YEL },
  { t: B[20], d: 0.3, e: 'in2', rx: 0, ry: 0 },
], ioL));
function backdrop(t, tq, D) {
  const p = backdropTrack()(tq);
  if (!p) return;
  const bp = pulse(tq, bt(Math.floor((tq - PH) / BEAT + 1e-6)), 9);
  drawBackdrop(c, { ...p, rx: p.rx * (1 + 0.035 * bp), ry: p.ry * (1 + 0.035 * bp), ph: tq * 1.6 }, D, 1450);
}
// rotating sunburst wedges behind the two drops
function bursts(t, tq, D) {
  for (const [t0, t1, x, y, n, col, k] of [[LAND, LAND + 0.95, 600, 1124, 24, '#ffe08a', 1460], [B[16], B[17] - 0.08, 545, 1060, 28, '#ffd27a', 1470]]) {
    if (t < t0 || t >= t1) continue;
    const R = 1800 * E.out3(clamp((t - t0) / 0.24)), a = 1 - E.in2(clamp((t - (t1 - 0.3)) / 0.3));
    sunburst(c, x, y, R, n, 0.2 + 0.45 * (tq - t0), col, D, k, a);
  }
}
function confettiFX(t, tq) {
  confetti(c, tq, LAND, 600, 1124, { n: 46, seed: 7, a0: -Math.PI * 0.95, a1: -Math.PI * 0.05, v0: 1100, v1: 2600, drag: 2.2, life: 1.6, size: 1.45 });
  confetti(c, tq, B[16], 545, 1060, { n: 64, seed: 9, a0: -Math.PI, a1: 0, v0: 1200, v1: 2900, drag: 2.2, life: 1.9, size: 1.5 });
  confetti(c, tq, STOP, 30, 1780, { n: 34, seed: 11, a0: -Math.PI * 0.44, a1: -Math.PI * 0.24, v0: 2400, v1: 3700, drag: 1.6, life: 1.2, size: 1.6 });
  confetti(c, tq, STOP, 1050, 1780, { n: 34, seed: 12, a0: -Math.PI * 0.76, a1: -Math.PI * 0.56, v0: 2400, v1: 3700, drag: 1.6, life: 1.2, size: 1.6 });
}

// ------------------------------------------------------------------ render
export function render(t) {
  const f = Math.round(t * FPS);
  const D = Math.floor(f / 2);
  const tq = onN(t, FPS, 2);
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
  drawPaper();
  const sh = shakeAt(t, [[FLAT, 10], [B[1], 22], [SEAL_T, 8], [LAND, 26], [LAND + 0.11, 12], [B[11], 10], [B[11] + 0.13, 8], [B[16], 22], [STAMP_R, 14], [STOP, 6]]);
  c.save(); c.translate(sh.x, sh.y);
  applyCamera(t);
  bursts(t, tq, D);
  backdrop(t, tq, D);
  sceneSofa(t, tq, D);
  sceneFlat(t, tq, D);
  sceneWalk1(t, tq, D);
  nightFX(t, tq, D);
  textHook(t, tq, D);
  sceneTitle(t, tq, D);
  sceneDesk(t, tq, D);
  sceneTimeline(t, tq, D);
  sceneCurve(t, tq, D);
  sceneWatch(t, tq, D);
  sceneBrain(t, tq, D);
  sceneBulb(t, tq, D);
  sceneSwitch(t, tq, D);
  sceneClimax(t, tq, D);
  sceneTips(t, tq, D);
  sceneEnd(t, tq, D);
  confettiFX(t, tq);
  c.restore();
  vignette(c, W, H, 0.16);
  drawTag(t, D);
  drawTooth(D);
  // impact frames: the light flash at B1, 2 inverted frames on each drop
  if (f === Math.ceil(B[1] * FPS)) { c.save(); c.globalAlpha = 0.5; c.fillStyle = PAL.hi; c.fillRect(0, 0, W, H); c.restore(); }
  const fL = Math.round(LAND * FPS), f16 = Math.round(B[16] * FPS);
  if (f === fL || f === fL + 1 || f === f16 || f === f16 + 1) invertFrame(c, W, H);
}
