#!/usr/bin/env node
// 帕斯卡 ↔ 布列安桑 v4 · 卡点：把画面的关键节点挪到配乐的起音上
//
//   python3 tools/music_beats.py      # 配乐里的每个钢琴起音 + 强弱 → out/music_onsets.json
//   node tools/sync.mjs               # 选点 + 解时钟 → js/sync.js（画面、字幕、点缀音都跟着同一个时钟走）
//
// 关键节点（HITS，剧情拍）：边亮起来、两条线连出交点、三点共线 / 三线共点的“砸下”、字幕落地……每个都有权重。
// 对每个节点在 ±2 s 内挑一个起音作为目标（越响、越像拍子——左手低音——越好），用动态规划在整部片子上一起选，
// 代价 = 为了对上而改变的节奏：
//   · 优先改“停顿”（老师讲完一句之后的静止时间）：最多加长 0.7·h（≤ 1.2 s）、缩短到 0.65·h（不少于 0.45 s）；
//     思考计时圈那种停顿只许缩 15 %；
//   · 不够再改动画本身的快慢：一段动画整体快 / 慢最多 30 %（平顶缓动，起止处速度连续）；
//   · 不改音乐（不剪、不拉伸），总时长不变（41 处正负相抵），第二首夜曲的接入点也就不变。
// 画面比声音早 LEAD = 25 ms 落下（一帧 33 ms：这样落点所在的那一帧在起音前 25 ms ～ 后 8 ms 之间；宁可画面先到一点点）。
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as S from '../js/scene.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ON = JSON.parse(fs.readFileSync(path.join(ROOT, 'out', 'music_onsets.json'), 'utf8'));
const LEAD = 0.025, PEAK = 1 / (1 - 0.25), MAXPACE = 0.3, MAXSKIP = 3, WIN = 2.2;
const NV0 = -S.T0 / S.BEAT, NVEND = S.END + S.INSD;
const vb = (b) => (b < S.INS0 ? b : b + S.INSD);
const LAND = 0.3 / S.BEAT;   // a slam caption lands 0.3 s (story time) after its beat

// ---------------------------------------------------------------- the key moments (story beats, weight, label)
const HITS = [
  // Act I · 帕斯卡
  [0.6, 0.8, '第 1 个点'], [1.0, 0.35, '第 2 个点'], [1.4, 0.35, '第 3 个点'], [1.8, 0.35, '第 4 个点'], [2.2, 0.35, '第 5 个点'], [2.6, 0.35, '第 6 个点'],
  [4.2, 0.5, '六边形开始一笔画'], [5.6, 0.8, '六边形闭合'],
  [6.2, 1.2, '对边①亮起'], [6.8, 1.2, '对边②亮起'], [7.4, 1.2, '对边③亮起'],
  [9, 1.6, '交点 X₁'], [10, 1.6, '交点 X₂'], [11, 1.6, '交点 X₃'],
  [12, 3.0, '红线穿过三个交点：共线'], [12 + LAND, 1.0, '「竟然在一条直线上」落下'],
  [20.6, 0.6, '点 → 切线'], [24.5, 0.6, '外切六边形的顶点'], [27.0, 0.6, '外切六边形一笔画完'],
  [28.3, 1.0, '对角线①'], [29.3, 1.0, '对角线②'], [30.3, 1.0, '对角线③'],
  [32, 3.0, '三条对角线交于一点：共点'], [32 + LAND, 1.0, '「竟然交于一点」落下'],
  [40.8, 0.8, '字典：点 ⇄ 线'], [41.6, 0.8, '字典：交点 ⇄ 连线'], [42.4, 0.8, '字典：共线 ⇄ 共点'],
  [48, 2.0, '升到三维'], [48 + LAND, 0.8, '「升到三维」落下'],
  // Act II · 升维证明布列安桑
  [52.6, 0.5, '顶点编号'], [57.2, 0.8, '切线长相等 → 顶点 4'], [58.4, 0.6, '六个顶点'], [68, 0.9, '红点闪'], [74.5, 0.9, '闪'],
  [84.3, 1.2, '第 1 对边亮起（端点光圈）'], [89.6, 1.6, '交点 P'], [100.2, 0.8, '平面顶点'], [102.6, 1.0, '✓ 第 1 对'],
  [106.2, 1.2, '第 2 对边亮起（端点光圈）'], [107.6, 1.6, '交点 P₂'], [108.6, 0.6, '平面顶点'], [109.0, 1.0, '✓ 第 2 对'],
  [110.2, 1.2, '第 3 对边亮起（端点光圈）'], [111.8, 1.6, '交点 P₀'], [112.6, 0.6, '平面顶点'], [113.0, 1.0, '✓ 第 3 对'],
  [121.2, 0.5, '上 / 下'], [123.0 + 0.26 / S.BEAT, 0.8, '✗ 不是三角形（落下）'],
  [124, 3.0, '只能交于同一点 Q'], [124 + LAND, 1.0, '「只能交于同一点」落下'], [136, 0.9, '影子闪'],
  [140, 3.0, '降维打击'], [140 + LAND, 1.0, '「降维打击」落下'],
  // Act III · 对偶凭什么成立
  [148, 1.0, '点 P'], [150, 1.2, '两个切点'], [152.4, 0.5, '切点弦开始画'], [156.2, 0.5, 'P 的线浮现'], [164.1, 1.2, 'P 落到圆上'],
  [176.4, 1.0, '点 Q'], [180.4, 0.5, 'Q 的切线'], [181.6, 0.5, 'Q 的线开始画'], [182.4, 1.5, 'Q 的线穿过 P'],
  [184, 3.0, '你在我的线上 ⇔ 我在你的线上'], [184 + LAND, 1.0, '字幕落下'],
  [196.7, 0.8, '顶点 W₁'], [198.4, 0.6, '其余顶点'], [200.4, 1.2, '第 1 对边亮起'],
  [201.3, 1.6, '交点 X₁'], [202.3, 1.6, '交点 X₂'], [203.3, 1.6, '交点 X₃'], [204.4, 1.2, '布列安桑点闪'], [206.4, 0.8, '红线连成'],
  [208, 3.0, '帕斯卡定理也成立'], [208 + LAND, 1.0, '「帕斯卡定理也成立」落下'],
  // Act IV · Dandelin
  [216.2, 0.5, '玻璃上的六个点'], [224.6, 1.0, '屋顶闪'], [229.2, 1.6, '空间交点 1'], [229.9, 1.6, '空间交点 2'], [230.6, 1.6, '空间交点 3'],
  [234.2, 1.2, '对边①亮起'], [238.6, 0.5, '描出交线'], [241.8, 1.6, '交点 X₁'],
  [244.6, 1.2, '对边②亮起'], [246.2, 1.6, '交点 X₂'], [246.6, 1.2, '对边③亮起'], [247.9, 1.6, '交点 X₃'],
  [252.6, 0.6, '红线开始'], [254.2, 1.0, '红线连成：共线'], [256, 3.0, '降维打击 2.0'], [256 + LAND, 1.0, '「降维打击 2.0」落下'],
  // outro
  [260, 0.6, '片尾双图'],
];

// ---------------------------------------------------------------- music onsets and how good each one is as a target
const O = ON.onsets.map(([t, , bass, mel, flux]) => ({ t, bass, mel, flux }));
for (const o of O) {
  const nb = O.filter((p) => Math.abs(p.t - o.t) <= 4 && p.flux >= 1).map((p) => p.flux).sort((a, b) => a - b);
  const ref = nb.length ? nb[Math.floor(0.7 * (nb.length - 1))] : 1;
  o.rel = o.flux / Math.max(ref, 1);
}
for (const o of O) if (O.some((p) => p.t < o.t && p.t >= o.t - 0.15 && p.flux > o.flux)) o.rel *= 0.6;   // inside a fast run
for (const o of O) {   // the left-hand bass (the nocturne's 12/8 pulse) relative to the neighbouring onsets
  const nb = O.filter((p) => Math.abs(p.t - o.t) <= 4).map((p) => p.bass).sort((a, b) => a - b);
  o.brel = o.bass / Math.max(nb[Math.floor(0.7 * (nb.length - 1))], 0.5);
}
for (const o of O) o.sal = 0.6 + 0.4 * Math.min(2.5, o.rel) ** 0.7 + (o.brel >= 1.2 && o.rel >= 0.6 ? 0.2 : 0);
const GOOD = O.filter((o) => o.rel >= 0.4);
const minRel = (w) => (w >= 2.5 ? 0.9 : 0.4);   // the big moments only land on clearly audible notes

// ---------------------------------------------------------------- nodes: film start, hits, film end
const hits = HITS.map(([b, w, label]) => ({ b, w, label, nv: vb(b) })).sort((a, b) => a.nv - b.nv);
hits.forEach((h) => { h.t0 = S.realT0(h.nv); });
const nodes = [{ nv: NV0, t0: 0, w: 0, label: '片头', fixed: true }, ...hits, { nv: NVEND, t0: S.realT0(NVEND), w: 0, label: '片尾', fixed: true }];
for (const nd of nodes) {
  nd.cands = nd.fixed ? [{ D: 0, sal: 0, o: null }]
    : GOOD.filter((o) => o.rel >= minRel(nd.w) && Math.abs(o.t - LEAD - nd.t0) <= WIN).map((o) => ({ D: o.t - LEAD - nd.t0, sal: o.sal, o }));
}

// ---------------------------------------------------------------- how much the gap between two nodes can stretch / shrink
const kMin = (a, b) => { let m = Infinity; for (let i = 0; i <= 40; i++) { const u = a + ((b - a) * i) / 40, e = 1e-4; m = Math.min(m, (S.realT0(u + e) - S.realT0(u - e)) / (2 * e)); } return m; };
const GAP = new Map();
function gap(i, j) {
  const key = i + ':' + j;
  if (GAP.has(key)) return GAP.get(key);
  const a = nodes[i].nv, b = nodes[j].nv, holds = [];
  S.HOLDS.forEach(([c, h, w, q], k) => {
    if (c - w / 2 >= a - 1e-9 && c + w / 2 <= b + 1e-9) holds.push({ k, c, h, w, q, ext: q ? 0.6 : Math.min(1.0, 0.6 * h), shr: q ? 0.25 * h : Math.max(0, h - Math.max(0.45, 0.65 * h)) });
  });
  // the plateau ease adds d·PEAK/(w·rate) at most to the local pace; rate = the slowest real seconds per beat in the gap, holds excluded
  let rate = Infinity;
  for (let s = 0; s <= 60; s++) {
    const u = a + ((b - a) * s) / 60;
    if (holds.some((h) => Math.abs(u - h.c) < h.w / 2 + 0.02) || S.HOLDS.some(([c, , w]) => Math.abs(u - c) < w / 2 + 0.02)) continue;
    const e = 1e-4; rate = Math.min(rate, (S.realT0(u + e) - S.realT0(u - e)) / (2 * e));
  }
  if (!isFinite(rate)) rate = kMin(a, b);
  const g = { a, b, holds, ext: holds.reduce((s, h) => s + h.ext, 0), shr: holds.reduce((s, h) => s + h.shr, 0), cs: (MAXPACE * (b - a) * rate) / PEAK };
  GAP.set(key, g);
  return g;
}
const LH = { ext: 0.35, shr: 0.6 }, LS = 1.5;
function split(g, d) {   // → [hold part, pace part, cost]
  const ad = Math.abs(d), cH = d >= 0 ? g.ext : g.shr, lh = d >= 0 ? LH.ext : LH.shr, cS = g.cs;
  if (ad < 1e-9) return [0, 0, 0];
  if (ad > cH + cS + 1e-9) return null;
  const wh = cH > 0 ? (cH * cH) / lh : 0, ws = (cS * cS) / LS;
  let x = (ad * wh) / (wh + ws);
  x = Math.min(cH, Math.max(ad - cS, x));
  const y = ad - x, cost = (cH > 0 ? lh * (x / cH) ** 2 : 0) + LS * (y / cS) ** 2;
  return [Math.sign(d) * x, Math.sign(d) * y, cost];
}

// ---------------------------------------------------------------- dynamic programme over the whole film
const N = nodes.length;
const dp = nodes.map((nd) => nd.cands.map(() => ({ v: -Infinity, p: null })));
dp[0][0].v = 0;
const skipPen = (nd) => 1.5 * nd.w;
for (let i = 1; i < N; i++) {
  const nd = nodes[i];
  nd.cands.forEach((c, ci) => {
    let best = -Infinity, arg = null, skip = 0;
    for (let j = i - 1; j >= Math.max(0, i - 1 - MAXSKIP); j--) {
      if (j < i - 1) skip += skipPen(nodes[j + 1]);
      const g = gap(j, i);
      nodes[j].cands.forEach((cj, cjI) => {
        const pv = dp[j][cjI].v;
        if (!isFinite(pv)) return;
        const sp = split(g, c.D - cj.D);
        if (!sp) return;
        const v = pv - skip - sp[2];
        if (v > best) { best = v; arg = [j, cjI]; }
      });
    }
    dp[i][ci] = { v: best + nd.w * c.sal - 0.03 * Math.abs(c.D), p: arg };
  });
}
// back-track
const path_ = [];
for (let i = N - 1, ci = 0; i !== null && i !== undefined;) { path_.push([i, ci]); const p = dp[i][ci].p; if (!p) break; [i, ci] = p; }
path_.reverse();
if (path_[0][0] !== 0) throw new Error('no feasible solution');

// ---------------------------------------------------------------- realise as clock terms
const terms = [], paces = [];
let maxPace = 0;
for (let s = 1; s < path_.length; s++) {
  const [j, cj] = path_[s - 1], [i, ci] = path_[s];
  const g = gap(j, i), d = nodes[i].cands[ci].D - nodes[j].cands[cj].D;
  const [x, y] = split(g, d);
  const cap = x >= 0 ? g.ext : g.shr;
  if (Math.abs(x) > 1e-6) for (const h of g.holds) { const part = (x * (x >= 0 ? h.ext : h.shr)) / cap; if (Math.abs(part) > 1e-5) terms.push([h.c, part, h.w, 'h']); }
  if (Math.abs(y) > 1e-6) { terms.push([(g.a + g.b) / 2, y, g.b - g.a, 'p']); const pc = (Math.abs(y) / g.cs) * MAXPACE; maxPace = Math.max(maxPace, pc); paces.push(Math.sign(y) * pc); }
}
const synced = new Map(path_.filter(([i]) => !nodes[i].fixed).map(([i, ci]) => [i, nodes[i].cands[ci]]));
const R = (nv) => S.realT0(nv) + S.syncT(nv, terms);
// checks: every synced hit lands LEAD before its onset; the clock stays monotonic; the length is unchanged
let worst = 0;
for (const [i, c] of synced) worst = Math.max(worst, Math.abs(R(nodes[i].nv) - (c.o.t - LEAD)));
let minRate = Infinity;
for (let u = NV0; u < NVEND; u += 0.01) minRate = Math.min(minRate, (R(u + 0.005) - R(u - 0.005)) / 0.01);
const dur = Math.round(R(NVEND) * 100) / 100;
const minHold = S.HOLDS.map(([c, h], k) => h + terms.filter((t) => t[3] === 'h' && t[0] === c).reduce((s, t) => s + t[1], 0));

// ---------------------------------------------------------------- report + js/sync.js
const lines = [];
const f3 = (x) => (x >= 0 ? '+' : '') + x.toFixed(3);
let nS = 0, sumAbs = 0;
for (let i = 1; i < N - 1; i++) {
  const nd = nodes[i], c = synced.get(i), t = R(nd.nv);
  if (c) { nS++; sumAbs += Math.abs(c.D); }
  lines.push(`${String(+nd.b.toFixed(3)).padStart(8)}  ${nd.t0.toFixed(3).padStart(8)} → ${t.toFixed(3).padStart(8)} (${f3(t - nd.t0)})  ` +
    (c ? `♪ ${c.o.t.toFixed(3)}  强度 ${c.o.rel.toFixed(2)}${c.o.brel >= 1.2 ? ' +低音' : ''}` : '   （不卡：跟着前后走）') + `  ${nd.label}`);
}
const hdr = `${nS}/${hits.length} 个节点卡在钢琴起音上（画面早 ${LEAD * 1000} ms），平均挪动 ${(sumAbs / Math.max(1, nS)).toFixed(3)} s；` +
  `${terms.filter((t) => t[3] === 'h').length} 处停顿微调 + ${terms.filter((t) => t[3] === 'p').length} 段动画快慢微调（最多 ${(maxPace * 100).toFixed(0)} %）；` +
  `最短停顿 ${Math.min(...minHold).toFixed(2)} s；最慢/最快 ${minRate.toFixed(3)} s/拍；时长 ${dur} s（原 ${S.DUR} s）；落点误差 ${(worst * 1000).toFixed(2)} ms`;
const hist = [0.1, 0.2, 0.25, 0.3001].map((x, i, a) => paces.filter((p) => Math.abs(p) <= x && (i === 0 || Math.abs(p) > a[i - 1])).length);
lines.push(`动画快慢改动：≤10 % ${hist[0]} 段，10–20 % ${hist[1]} 段，20–25 % ${hist[2]} 段，25–30 % ${hist[3]} 段`);
console.log(lines.join('\n'));
console.log(hdr);
if (dur !== S.DUR && !process.argv.includes('--force')) throw new Error('length changed');
const fmt = (x, d = 4) => +x.toFixed(d);
const out = `// generated by tools/sync.mjs (v4 卡点) — rerun: python3 tools/music_beats.py && node tools/sync.mjs
// ${hdr}
export const LEAD = ${LEAD};
// clock terms [video beat c, seconds d, width w (video beats), 'h' = lengthen / shorten the hold at c | 'p' = plateau pace change]
export const SYNC = [
${terms.map((t) => `  [${fmt(t[0])}, ${fmt(t[1], 5)}, ${fmt(t[2])}, '${t[3]}'],`).join('\n')}
];
// the synced moments: [story beat, music onset (s), label]
export const SYNCED = [
${[...synced].map(([i, c]) => `  [${fmt(nodes[i].b)}, ${fmt(c.o.t)}, '${nodes[i].label}'],`).join('\n')}
];
`;
if (!process.argv.includes('--dry')) fs.writeFileSync(path.join(ROOT, 'js', 'sync.js'), out);
fs.writeFileSync(path.join(ROOT, 'out', 'sync_report.txt'), lines.join('\n') + '\n' + hdr + '\n');
