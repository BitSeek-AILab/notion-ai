#!/usr/bin/env python3
"""帕斯卡 ↔ 布列安桑 v4 · 配乐里的“点”

从片子里实际响着的配乐（两首肖邦夜曲，按 tools/sfx.py 的位置、增益、交叉淡化摆好，和成片逐采样一致）
找出每一个钢琴音的起音时刻（onset），并给每个起音打一个“强弱”分：
  · flux   全频段谱通量（对数幅度、跨 3 个频点取最大的 SuperFlux 写法，5 ms 一帧）——有没有新音进来；
  · bass   300 Hz 以下的谱通量——左手低音（夜曲 12/8 拍里每个附点四分音符拍上的低音），也就是“拍子”；
  · mel    700 Hz 以上的谱通量——右手旋律音；
  · acc    综合强弱 = 相对于前后 ±3 s 内起音的典型值（中位数）的倍数，1 = 这一段的普通音，>1.6 算“重音”。
起音时刻用峰值附近的抛物线插值，精度约 2 ms（一帧画面是 33 ms）。

  python3 tools/music_beats.py [--out out/music_onsets.json]
输出给 tools/sync.mjs：把画面的关键节点（边亮起、交点出现、三点共线、三线共点……）挪到最近的好拍点上。
"""
import argparse
import json
import sys
from pathlib import Path

import numpy as np
from scipy.ndimage import maximum_filter1d, uniform_filter1d

sys.path.insert(0, str(Path(__file__).resolve().parent))
import sfx  # noqa: E402

SR = sfx.SR
NFFT, HOP = 2048, 240           # 42.7 ms 窗、5 ms 一帧
FPS_O = SR / HOP


def spectra_flux(x):
    """返回 (全频段, 低频, 高频) 三条 SuperFlux 曲线（每 5 ms 一个值，帧中心对齐）"""
    win = np.hanning(NFFT).astype(np.float32)
    f = np.fft.rfftfreq(NFFT, 1 / SR)
    lo, mid, hi = (f > 25) & (f < 300), (f >= 300) & (f < 700), (f >= 700) & (f < 9000)
    xp = np.concatenate([np.zeros(NFFT // 2, np.float32), x.astype(np.float32), np.zeros(NFFT, np.float32)])
    n_fr = (len(x) + HOP - 1) // HOP
    ref = np.sqrt(np.mean(x ** 2)) * NFFT / 4 + 1e-9
    out = np.zeros((3, n_fr), np.float32)
    prev = None
    CH = 4096
    for s in range(0, n_fr, CH):
        e = min(n_fr, s + CH)
        idx = (np.arange(s - 2, e)[:, None] * HOP + np.arange(NFFT)[None, :])
        idx = np.clip(idx, 0, len(xp) - 1)
        Y = np.log10(1 + 100 * np.abs(np.fft.rfft(xp[idx] * win, axis=1)) / ref).astype(np.float32)
        Ym = maximum_filter1d(Y, 3, axis=1)                  # 跨频点最大值：抑制颤音 / 踏板里的细小抖动
        d = np.maximum(0, Y[2:] - Ym[:-2])                   # 与 10 ms 前比较（μ = 2 帧）
        if s == 0: d[:2] = 0
        out[0, s:e] = d.sum(1)
        out[1, s:e] = d[:, lo].sum(1)
        out[2, s:e] = d[:, hi].sum(1) + 0.5 * d[:, mid].sum(1)
    return out


def peaks(o, pre=6, post=6, avg_pre=20, avg_post=14, delta=0.12):
    """madmom 式峰值挑选（单位：帧）。o 已按局部尺度归一化。"""
    mx = maximum_filter1d(o, pre + post + 1, origin=(pre - post) // 2)
    av = uniform_filter1d(o, avg_pre + avg_post + 1, origin=(avg_pre - avg_post) // 2)
    cand = np.flatnonzero((o == mx) & (o >= av + delta) & (o > 0))
    keep, last = [], -10 ** 9
    for i in cand:                                           # 至少相隔 30 ms
        if i - last >= 6: keep.append(i); last = i
        elif o[i] > o[keep[-1]]: keep[-1] = i; last = i
    return np.array(keep, int)


def local_scale(o, sec=4.0, q=0.9):
    """局部尺度：每 0.5 s 取 ±sec 窗口内的 q 分位数，再插值回每一帧"""
    step = int(0.5 * FPS_O); half = int(sec * FPS_O)
    cs = np.arange(0, len(o), step)
    v = np.array([np.quantile(o[max(0, c - half): c + half + 1], q) for c in cs])
    v = np.maximum(v, np.max(v) * 0.02)
    return np.interp(np.arange(len(o)), cs, v)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--a', default=str(sfx.ROOT / 'audio' / 'chopin_op9n2_levy.flac'))
    ap.add_argument('--b', default=str(sfx.ROOT / 'audio' / 'chopin_op55n2_xuanhe.flac'))
    ap.add_argument('--out', default=str(sfx.ROOT / 'out' / 'music_onsets.json'))
    a = ap.parse_args()
    dur, _ = sfx.scene([])
    music, b_at = sfx.music_bed(a.a, a.b, dur)
    music, _ = sfx.level(music)
    mono = music.mean(axis=1)
    del music
    F = spectra_flux(mono)
    sm = lambda v: uniform_filter1d(v, 3)
    full, low, mel = (sm(F[i]) for i in range(3))
    # 每条曲线按局部尺度归一化（安静段落里的音也算数），再按全局再乘一点“绝对响度”的权重
    fs, ls, ms = local_scale(full), local_scale(low), local_scale(mel)
    gl = np.quantile(full, 0.9)
    loud = np.clip(fs / gl, 0.05, 1.0) ** 0.35                # 几乎无声处（两首交接的余音里）的“起音”降权
    on = full / fs
    pk = peaks(on)
    rows = []
    for i in pk:
        if 0 < i < len(on) - 1:                              # 抛物线插值求亚帧位置
            y0, y1, y2 = on[i - 1], on[i], on[i + 1]
            den = y0 - 2 * y1 + y2
            dx = 0.5 * (y0 - y2) / den if den < 0 else 0.0
        else: dx = 0.0
        t = (i + float(np.clip(dx, -0.5, 0.5))) * HOP / SR
        w = slice(max(0, i - 3), i + 4)
        rows.append([t, float(on[i] * loud[i]), float(np.max(low[w]) / ls[i]), float(np.max(mel[w]) / ms[i]), float(on[i])])
    R = np.array(rows)
    # acc：相对 ±3 s 内起音强度中位数的倍数（低音拍、旋律音一起算）
    raw = R[:, 1] * (0.55 + 0.25 * np.minimum(R[:, 2], 2.5) + 0.2 * np.minimum(R[:, 3], 2.5))
    acc = np.zeros(len(R))
    for j, t in enumerate(R[:, 0]):
        m = np.abs(R[:, 0] - t) <= 3.0
        acc[j] = raw[j] / (np.median(raw[m]) + 1e-9)
    out = {'dur': dur, 'b_at': b_at, 'hop_s': HOP / SR, 'fields': ['t', 'acc', 'bass', 'mel', 'flux'],
           'onsets': [[round(float(t), 4), round(float(c), 3), round(float(b), 3), round(float(m), 3), round(float(f), 3)]
                      for (t, _, b, m, f), c in zip(R, acc)]}
    Path(a.out).parent.mkdir(parents=True, exist_ok=True)
    Path(a.out).write_text(json.dumps(out))
    ioi = np.diff(R[:, 0])
    strong = R[acc > 1.6, 0]
    print(f'DUR {dur:.2f}s, B at {b_at:.2f}s | {len(R)} onsets ({len(R) / dur:.2f}/s), median IOI {np.median(ioi) * 1000:.0f} ms, '
          f'{len(strong)} accents (acc>1.6, median gap {np.median(np.diff(strong)):.2f}s) -> {a.out}')


if __name__ == '__main__':
    main()
