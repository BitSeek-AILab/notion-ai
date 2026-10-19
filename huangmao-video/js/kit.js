// 黄毛理论 v2 · scene kit: stage backgrounds, beat pulses, pose helpers, scene headers
import { c, PAL, bg, rrFill, circ, ell, fillP, sunburst, dots, shade, ring } from './draw.js';
import { B, bb, BEAT, PH } from './beat.js';
import { clamp, lerp, hs, E, popS, ramp, pulse, K, D2R } from './lib.js';
import { flower, hz, popAnim, label } from './type.js';
import { person, heartMascot } from './char.js';

export const GY = 1250; // ground line
export function stage(top, o = {}) {
  if (top) bg(top);
  if (o.deco) o.deco();
  const gy = o.gy ?? GY;
  rrFill(-200, gy, 1480, 1000, 0, o.ground ?? PAL.cream);
  rrFill(-200, gy, 1480, 18, 0, o.edge ?? shade(o.ground ?? PAL.cream, -0.07));
}
// soft big circles decoration (flat style)
export function blobs(seed, col, n = 5, a = 1) {
  c.save(); c.globalAlpha *= a;
  for (let i = 0; i < n; i++) circ(hs(seed, i) * 1080, 150 + hs(seed, i, 2) * 1000, 90 + 160 * hs(seed, i, 3), col);
  c.restore();
}
export function rays(x, y, t, col = 'rgba(255,255,255,0.08)', n = 18, spd = 0.15) { c.save(); sunburst(x, y, 2600, n, col, null, t * spd); c.restore(); }
// beat pulse (1 at each beat, decays)
export const beatP = (t, k = 8) => { const u = ((t - PH) / BEAT) % 1; return u < 0 ? 0 : Math.exp(-u * BEAT * k); };
export const breathe = (t, ph = 0, a = 0.012) => 1 + a * Math.sin(t * 2 * Math.PI * 0.8 + ph);
// jump arc between t0 and t1 with height h (returns lift >= 0)
export const arc = (t, t0, t1, h) => (t <= t0 || t >= t1 ? 0 : 4 * h * ((t - t0) / (t1 - t0)) * (1 - (t - t0) / (t1 - t0)));
// run cycle for side view
export function runPose(t, f = 2.6, amp = 1) {
  const p = t * f * Math.PI * 2;
  return { legF: [38 * Math.sin(p) * amp, (40 + 30 * Math.sin(p + 1.4)) * amp], legB: [-38 * Math.sin(p) * amp, (40 + 30 * Math.sin(p + 1.4 + Math.PI)) * amp], armF: [-45 * Math.sin(p) * amp, 70], armB: [45 * Math.sin(p) * amp, 70], bob: Math.abs(Math.sin(p)) * 10 * amp, lean: 12 * amp };
}
// person lying on their back, feet at (x,y), head toward -x
export function lying(o, x, y, t) { c.save(); c.translate(x, y); c.rotate(-Math.PI / 2); const J = person({ ...o, x: 0, y: 0, shadow: false }, t); c.restore(); return J; }
// numbered header: disc + 花字 (pop)
export function header(num, str, y, t, t0, t1, o = {}) {
  if (t < t0 - 0.01 || t > t1 + 0.5) return;
  const size = o.size ?? 140;
  // measure for centring
  c.font = `${size}px "RHR Heavy"`; const w = c.measureText(str).width + (str.length - 1) * 4;
  const dw = num ? size * 0.95 : 0, tot = w + dw, x0 = 540 - tot / 2;
  if (num) {
    let s = popS(t, t0, 0.3); if (t > t1) s *= 1 - E.in2(clamp((t - t1) / 0.2));
    if (s > 0) { c.save(); c.translate(x0 + size * 0.38, y); c.scale(s, s); c.rotate((1 - clamp((t - t0) / 0.3)) * -0.6);
      circ(4, 8, size * 0.42, PAL.navy); circ(0, 0, size * 0.42, o.numCol ?? PAL.coral); label(num, 0, 4, size * 0.56, '#ffffff', { font: 'RH' }); c.restore(); }
  }
  flower(str, x0 + dw + w / 2, y, t, t0 + 0.08, t1, { size, fill: o.fill, outerCol: o.outerCol, extCol: o.extCol });
}
export { person, heartMascot };
