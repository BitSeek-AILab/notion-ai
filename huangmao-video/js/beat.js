// 黄毛理论 v2 · music grid (shared by the picture and tools/export_cues.mjs → tools/sfx.py)
export const BPM = 112.9, PH = 0.082, BEAT = 60 / BPM, BAR = 4 * BEAT;
export const bt = (n) => PH + n * BEAT;           // beat n (n can be fractional: 0.5 = eighth)
export const B = Array.from({ length: 30 }, (_, k) => PH + k * BAR); // bar k downbeat
export const NBARS = 26;
export const DUR = Math.round((PH + NBARS * BAR) * 1000) / 1000; // 55.352
export const FADE0 = DUR - 0.8;
export const W = 1080, H = 1920, FPS = 30;
// beat inside bar k: bb(k, j) with j in 0..3 (fractional ok)
export const bb = (k, j = 0) => PH + (4 * k + j) * BEAT;
