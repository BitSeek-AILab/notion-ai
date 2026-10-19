#!/usr/bin/env python3
"""黄毛理论 v2 · 音效与混音母带

所有音效均为程序合成（numpy / scipy，不使用任何采样），按影片的节拍网格放置，
叠加在用户提供的音乐下（音乐从 0 s 开始，截断至视频长度 55.352 s，54.552 s 起淡出），
最后母带处理到约 -12 LUFS、真峰值 ≤ -1 dBTP（wav 限幅到 -2 dBTP，AAC 编码后仍 ≤ -1）。

  python3 tools/sfx.py [--music audio/music.mp3] [--out out/audio_master.wav]

每个音效的响度都相对“同一时刻音乐的 K 加权响度”自动校准（rel 列，单位 dB），
所以换音乐后音效依然清晰但不抢戏。音效时间点与 js/s1.js–s3.js 的动画时间点一一对应
（bb(k, j) = 第 k 小节第 j 拍，与 js/beat.js 相同）；字幕弹出与转场的时刻由 tools/export_cues.mjs
直接从 js/film.js 导出，改了画面就会自动跟上。DROP（B8）与高潮（B16）处音乐闪避 4.5 dB 让冲击声透出来。
"""
import argparse
import json
import subprocess
from pathlib import Path

import numpy as np
from scipy import signal
from scipy.io import wavfile
from scipy.ndimage import minimum_filter1d, uniform_filter1d

SR = 48000
DUR = 55.352                       # 与 js/beat.js 一致（26 小节）
FADE0 = DUR - 0.8                  # 画面与音乐同时淡出
N = int(round(DUR * SR))
BPM, PH = 112.9, 0.082             # 与 js/beat.js 完全一致
BEAT = 60 / BPM
E8, S16 = BEAT / 2, BEAT / 4
FPS = 30
def bt(n): return PH + n * BEAT
def B(k): return bt(4 * k)
def bb(k, j=0.0): return PH + (4 * k + j) * BEAT       # 第 k 小节第 j 拍（j 可为小数）

# ------------------------------------------------------------------ helpers
def tt(d): return np.arange(int(round(d * SR))) / SR
def norm(x, peak=1.0): return x * (peak / (np.max(np.abs(x)) + 1e-12))
def phase(f): return 2 * np.pi * np.cumsum(f) / SR
def att(t, a): return np.clip(t / max(a, 1e-5), 0, 1)
def tail(t, d, r=0.01): return np.clip((d - t) / r, 0, 1)
def _sos(kind, f, order=2): return signal.butter(order, f, kind, fs=SR, output='sos')
def bp(x, lo, hi, o=2): return signal.sosfilt(_sos('bandpass', [lo, hi], o), x, axis=0)
def lp(x, f, o=2): return signal.sosfilt(_sos('lowpass', f, o), x, axis=0)
def hp(x, f, o=2): return signal.sosfilt(_sos('highpass', f, o), x, axis=0)
def noise(n, seed): return np.random.default_rng(seed).standard_normal(n)
def add(y, x, t0):
    i0 = int(round(t0 * SR)); i1 = min(len(y), i0 + len(x))
    if i1 > i0: y[i0:i1] += x[: i1 - i0]
    return y

def sweep_noise(d, fc, bw=0.6, seed=0):
    """白噪声经过中心频率随时间变化的（对数频率高斯）带通，fc(t) 单位 Hz。"""
    n = int(round(d * SR))
    f, tm, Z = signal.stft(noise(n + 4096, seed), SR, nperseg=1024, noverlap=768)
    c = np.log2(np.maximum(fc(np.clip(tm, 0, d)), 20))[None, :]
    Z = Z * np.exp(-0.5 * ((np.log2(np.maximum(f, 20))[:, None] - c) / bw) ** 2)
    return norm(signal.istft(Z, SR, nperseg=1024, noverlap=768)[1][:n])

# ------------------------------------------------------------------ sound design
def s_pop(f0=520, f1=1500, d=0.09, seed=0):          # 文字弹出：上扬“啵”
    t = tt(d)
    f = f0 + (f1 - f0) * (1 - np.exp(-t / 0.012))
    y = np.sin(phase(f)) * np.exp(-t / 0.024) * att(t, 0.0015)
    y += 0.22 * hp(noise(len(t), seed), 2500) * np.exp(-t / 0.002)
    return norm(y)

def s_tick(f=1500, seed=0):                          # 副标题：轻“嗒”
    t = tt(0.05)
    y = (np.sin(2 * np.pi * f * t) + 0.4 * np.sin(2 * np.pi * 2.01 * f * t)) * np.exp(-t / 0.009) * att(t, 0.0005)
    y += 0.15 * hp(noise(len(t), seed), 4000) * np.exp(-t / 0.0015)
    return norm(y)

def s_bloop(f0=300, ratio=2.6, d=0.16, tau=0.05):    # 水滴“咕噜/啵”：快速上扫的正弦
    t = tt(d)
    f = f0 * (1 + (ratio - 1) * (1 - np.exp(-t / 0.025)))
    return norm(np.sin(phase(f)) * np.exp(-t / tau) * att(t, 0.002))

def s_thump(d=0.6, f0=150, f1=42, tau=0.2, click=0.3, seed=1):
    t = tt(d)
    f = f1 + (f0 - f1) * np.exp(-t / 0.035)
    y = np.sin(phase(f)) * np.exp(-t / tau) * att(t, 0.001)
    y += click * lp(noise(len(t), seed), 3500) * np.exp(-t / 0.006)
    return norm(np.tanh(1.6 * y))

def s_whoosh(d=0.42, lo=350, hi=3800, peak=0.72, seed=3, down=False):
    t = tt(d)
    def fc(tm):
        u = np.clip(tm / d, 0, 1)
        return lo * (hi / lo) ** ((1 - u if down else u) ** 1.3)
    u = t / d
    env = np.where(u < peak, (u / peak) ** 2.2, np.exp(-(u - peak) / (1 - peak) * 3.5))
    return norm(sweep_noise(d, fc, 0.55, seed) * env)

def s_riser(d, seed=4):                              # 掉进水前的蓄力上升
    t = tt(d); u = t / d
    nz = sweep_noise(d, lambda tm: 300 * (8000 / 300) ** (np.clip(tm / d, 0, 1) ** 1.6), 0.7, seed)
    f = 180 * 4.0 ** (u ** 1.4) * (1 + 0.02 * np.sin(2 * np.pi * (5 + 12 * u) * t))
    tone = norm(lp(signal.sawtooth(phase(f)), 2500))
    return norm((0.6 * nz + 0.4 * tone) * u ** 2 * tail(t, d, 0.008))

def s_whistle(d=0.5, f0=1900, f1=420, fpk=None):     # 卡通滑哨（下落 / 起跳）
    t = tt(d); u = t / d
    if fpk is None: f = f0 * (f1 / f0) ** (u ** 1.1)
    else: f = np.where(u < 0.5, f0 * (fpk / f0) ** np.sin(np.pi * u), f1 * (fpk / f1) ** np.sin(np.pi * u))
    f = f * (1 + 0.012 * np.sin(2 * np.pi * 7 * t))
    y = np.sin(phase(f)) + 0.15 * np.sin(2 * phase(f))
    env = att(t, 0.03) * tail(t, d, 0.02)
    return norm(y * env + 0.05 * bp(noise(len(t), 12), 800, 4000) * env)

def s_boing(d=0.5, f=210):                           # 水滴落到“？”下的弹簧感
    t = tt(d)
    fm = f * (1 + 0.45 * np.exp(-t / 0.12) * np.sin(2 * np.pi * 13 * t))
    return norm((np.sin(phase(fm)) + 0.3 * np.sin(2 * phase(fm))) * np.exp(-t / 0.16) * att(t, 0.003))

def s_blip(f=988, d=0.24, up=1.335):                 # 进度条“叮”（两段式金币音）
    t = tt(d)
    ff = np.where(t < 0.05, f, f * up)
    y = lp(signal.square(phase(ff), 0.35), 4500) * att(t, 0.002) * np.where(t < 0.05, 1, np.exp(-(t - 0.05) / 0.07))
    return norm(y)

def s_twoTone(f0=660, f1=990):                       # Wi-Fi 连接提示
    t = tt(0.16)
    ff = np.where(t < 0.06, f0, f1)
    return norm(np.sin(phase(ff)) * att(t, 0.002) * np.where(t < 0.06, 1, np.exp(-(t - 0.06) / 0.04)))

def s_clack(seed, f=2300):                           # 方糖落堆
    r = np.random.default_rng(seed)
    t = tt(0.09)
    y = hp(r.standard_normal(len(t)), 1500) * np.exp(-t / 0.003)
    for m, a, tau in [(1, 1, 0.018), (1.58, 0.6, 0.012), (0.48, 0.5, 0.03)]:
        y += a * np.sin(2 * np.pi * f * m * t + r.uniform(0, 6)) * np.exp(-t / tau)
    return norm(y * att(t, 0.0005))

def s_ding(f=1568, d=1.4, bright=1.0):               # 钟片“叮”
    t = tt(d)
    parts = [(1, 1, 1.0), (2.0, 0.35, 0.55), (2.76, 0.4, 0.4), (5.4, 0.2 * bright, 0.2), (8.93, 0.08 * bright, 0.1)]
    y = sum(a * np.sin(2 * np.pi * f * m * t) * np.exp(-t / (tau * d * 0.5)) for m, a, tau in parts)
    return norm(y * att(t, 0.002) * tail(t, d, 0.05))

def s_sparkle(d=0.8, n=7, seed=6, base=2600):        # 闪光（立体声）
    r = np.random.default_rng(seed)
    y = np.zeros((int(d * SR), 2))
    for k in range(n):
        t0 = r.uniform(0, 0.3); f = base * 2 ** r.uniform(0, 1.2); p = r.uniform(-0.8, 0.8)
        t = tt(0.35)
        ping = np.sin(2 * np.pi * f * t) * np.exp(-t / 0.07) * att(t, 0.001) * (1 - 0.5 * k / n)
        i0 = int(t0 * SR); m = min(len(t), len(y) - i0)
        y[i0:i0 + m, 0] += ping[:m] * min(1, 1 - p); y[i0:i0 + m, 1] += ping[:m] * min(1, 1 + p)
    return norm(y)

def s_arp(notes, step=0.035, tau=0.09):              # 上行琶音（变身闪烁 / 晕眩星星）
    y = np.zeros(int((len(notes) * step + 0.4) * SR))
    for k, f in enumerate(notes):
        t = tt(0.35)
        add(y, np.sin(2 * np.pi * f * t) * np.exp(-t / tau) * att(t, 0.001), k * step)
    return norm(y)

def s_bonk(f=196):                                   # 警告“嗡”
    t = tt(0.26)
    y = signal.sawtooth(2 * np.pi * f * t) + signal.sawtooth(2 * np.pi * f * 1.012 * t) + 0.5 * np.sin(np.pi * f * t)
    y = norm(lp(y, 1400)) * att(t, 0.004) * np.exp(-t / 0.09)
    add(y, 0.5 * s_thump(0.25, 140, 70, 0.07, 0.1), 0)
    return norm(y)

def s_stamp(seed=13):                                # 盖章“啪”
    t = tt(0.35)
    y = 0.8 * s_thump(0.35, 110, 55, 0.08, 0.6, seed)
    y += 0.8 * norm(lp(noise(len(t), seed), 2500)) * np.exp(-t / 0.02)
    return norm(y)

def s_flap(seed=14):                                 # 日历纸片弹出
    t = tt(0.12)
    y = bp(noise(len(t), seed), 900, 5000) * (np.exp(-t / 0.012) + 0.6 * np.exp(-np.maximum(t - 0.035, 0) / 0.015) * (t > 0.035))
    return norm(y)

# ------------------------------------------------------------------ loudness (ITU-R BS.1770-4)
def k_weight(x):
    y = signal.lfilter([1.53512485958697, -2.69169618940638, 1.19839281085285], [1.0, -1.69065929318241, 0.73248077421585], x, axis=0)
    return signal.lfilter([1.0, -2.0, 1.0], [1.0, -1.99004745483398, 0.99007225036621], y, axis=0)

def lufs(x):
    p = k_weight(x) ** 2
    p = p.sum(axis=1) if p.ndim == 2 else p
    cs = np.concatenate([[0], np.cumsum(p)])
    blk, hop = int(0.4 * SR), int(0.1 * SR)
    s = np.arange(0, len(p) - blk + 1, hop)
    z = (cs[s + blk] - cs[s]) / blk
    l = -0.691 + 10 * np.log10(z + 1e-20)
    z1 = z[l > -70]
    rel = -0.691 + 10 * np.log10(z1.mean()) - 10
    return -0.691 + 10 * np.log10(z[(l > -70) & (l > rel)].mean())

def true_peak(x):
    return 20 * np.log10(np.max(np.abs(signal.resample_poly(x, 4, 1, axis=0))) + 1e-12)

def limiter(x, ceil_db=-1.5, look=0.003, rel=0.08):
    """前瞻真峰值限幅：4× 过采样找峰 → 最小值滤波 + 平滑（保证峰值处增益足够）→ 释放。"""
    ceil = 10 ** (ceil_db / 20)
    pk = np.abs(signal.resample_poly(x, 4, 1, axis=0)).max(axis=1).reshape(-1, 4).max(axis=1)
    req = np.minimum(1.0, ceil / np.maximum(pk, 1e-9))
    L = int(look * SR)
    g = uniform_filter1d(minimum_filter1d(req, 2 * L + 1, mode='nearest'), L + 1, mode='nearest')
    a = 1 - np.exp(-1 / (rel * SR))
    out = g.copy()
    idx = np.flatnonzero(g < 1)
    if len(idx):  # 只在有压缩的区域逐点做释放
        prev = 1.0; last = -10
        for i in range(idx[0], len(g)):
            if g[i] >= 1 and prev >= 0.99999 and i > last: out[i] = 1.0; prev = 1.0; continue
            v = g[i] if g[i] < prev else prev + (g[i] - prev) * a
            out[i] = v; prev = v
            if g[i] < 1: last = i + int(rel * SR * 8)
            if i > last and prev > 0.99999: prev = 1.0
    return x * out[:, None], out


# ------------------------------------------------------------------ sounds for this film
def io2(u): u = np.clip(u, 0, 1); return np.where(u < 0.5, 2 * u * u, 1 - (-2 * u + 2) ** 2 / 2)

def crossings(t0, t1, fn, levels):                   # fn(t) 单调上升时，返回越过每个 level 的时刻
    ts = np.linspace(t0, t1, 4000); v = fn(ts)
    return [float(ts[np.argmax(v >= L)]) for L in levels if v[-1] >= L]

def s_step(seed=0, heavy=0.0):                       # 脚步“嗒”：鞋底落地 + 鞋尖二次触地
    r = np.random.default_rng(seed)
    t = tt(0.16)
    y = lp(r.standard_normal(len(t)), 1800 + 800 * r.random()) * np.exp(-t / 0.012)
    y += (0.6 + heavy) * np.sin(phase(90 + 80 * np.exp(-t / 0.02))) * np.exp(-t / (0.035 + 0.04 * heavy))
    y += 0.25 * bp(r.standard_normal(len(t)), 2500, 7000) * np.exp(-np.maximum(t - 0.03, 0) / 0.01) * (t > 0.03)
    return norm(y * att(t, 0.0008))

def s_beep(f=988, d=0.12):                           # 心电监护“滴”（d 很长时就是拉直线的“滴——”）
    t = tt(d)
    y = np.sin(2 * np.pi * f * t) + 0.18 * np.sin(2 * np.pi * 2 * f * t) + 0.06 * np.sin(2 * np.pi * 3 * f * t)
    return norm(y * att(t, 0.003) * tail(t, d, 0.025))

def s_squish(seed=17):                               # 被压扁：下滑“噗叽” + 闷响
    t = tt(0.3)
    f = 520 * (90 / 520) ** np.clip(t / 0.22, 0, 1)
    y = np.sin(phase(f)) * np.exp(-t / 0.12) * att(t, 0.003)
    y += 0.6 * lp(noise(len(t), seed), 900) * np.exp(-t / 0.05)
    add(y, 0.7 * s_thump(0.25, 120, 45, 0.07, 0.2, seed), 0.0)
    return norm(np.tanh(1.3 * y))

def s_brush(d=0.3, seed=18):                         # 毛笔“唰”：上扫噪声 + 纸面颗粒
    r = np.random.default_rng(seed)
    t = tt(d); u = t / d; n = len(t)
    nz = sweep_noise(d, lambda tm: 900 * (5200 / 900) ** np.clip(tm / d, 0, 1), 0.6, seed)
    grain = 0.55 + 0.45 * norm(lp(np.abs(r.standard_normal(n)), 70))
    env = np.sin(np.pi * np.clip(u, 0, 1)) ** 0.8 * (1 - 0.4 * u)
    return norm(nz * grain * env)

def s_scribble(d=0.4, rate=11, seed=19):             # 铅笔涂画“沙沙”
    r = np.random.default_rng(seed)
    t = tt(d); n = len(t)
    y = bp(r.standard_normal(n), 2200, 7500)
    strokes = 0.35 + 0.65 * np.sin(2 * np.pi * rate * t + r.uniform(0, 6)) ** 2
    y = y * strokes * (0.7 + 0.3 * norm(lp(r.standard_normal(n), 30)))
    return norm(y * att(t, 0.02) * tail(t, d, 0.04))

def s_clock(f=3200, seed=20):                        # 钟表“咔”
    r = np.random.default_rng(seed)
    t = tt(0.04)
    y = hp(r.standard_normal(len(t)), 2000) * np.exp(-t / 0.0015)
    y += 0.6 * np.sin(2 * np.pi * f * t) * np.exp(-t / 0.004) + 0.4 * np.sin(2 * np.pi * f * 1.47 * t) * np.exp(-t / 0.003)
    return norm(y * att(t, 0.0003))

def s_click(seed=21):                                # 开关“咔哒”
    y = np.zeros(int(0.14 * SR))
    add(y, s_clock(2600, seed), 0.0)
    add(y, 0.8 * s_clock(1900, seed + 1), 0.028)
    add(y, 0.5 * s_thump(0.1, 220, 120, 0.02, 0.05, seed), 0.028)
    return norm(y)

def s_powerdown(d=0.5):                              # 断电“嗡↓”（腿变灰）
    t = tt(d); u = t / d
    f = 420 * (70 / 420) ** (u ** 0.8)
    y = lp(signal.sawtooth(phase(f)), 1600) + 0.5 * np.sin(phase(f))
    return norm(y * att(t, 0.01) * (1 - u) ** 1.5)

def s_zz(d=0.35, f=140):                             # 打盹“zz”
    t = tt(d)
    y = lp(signal.sawtooth(phase(f * (1 + 0.04 * np.sin(2 * np.pi * 3 * t)))), 900) * (0.6 + 0.4 * np.sin(2 * np.pi * 26 * t) ** 2)
    return norm(y * np.sin(np.pi * np.clip(t / d, 0, 1)) ** 1.2)

def s_poof(seed=23):                                 # 落地扬尘“噗”
    t = tt(0.3)
    return norm(lp(noise(len(t), seed), 1200) * att(t, 0.004) * np.exp(-t / 0.07))


# ------------------------------------------------------------------ sounds added for 黄毛理论
def s_ignite(d=0.6, f0=300, f1=2600, seed=31, sub=0.6):   # 火苗“呼——”：上扫带通噪声 + 低频“嘭”
    t = tt(d)
    fc = lambda tm: f0 * (f1 / f0) ** np.clip(tm / (0.35 * d), 0, 1)
    y = sweep_noise(d, fc, 0.7, seed) * np.exp(-np.maximum(t - 0.04, 0) / (0.28 * d)) * att(t, 0.012)
    y = y + sub * np.sin(phase(55 + 90 * np.exp(-t / 0.05))) * np.exp(-t / 0.12) * att(t, 0.003)
    return norm(y * tail(t, d, 0.02))

def s_crackle(d=1.0, rate=28, seed=32, bed=0.35):     # 燃烧“噼啪”：随机爆裂脉冲 + 低沉火声
    r = np.random.default_rng(seed)
    n = int(round(d * SR)); y = np.zeros(n); t = tt(d)
    for _ in range(r.poisson(rate * d)):
        L = int(SR * r.uniform(0.002, 0.008)); i = int(r.integers(0, max(1, n - L)))
        tl = np.arange(L) / SR
        y[i:i + L] += r.uniform(0.3, 1.0) * r.standard_normal(L) * np.exp(-tl / (L / SR / 4))
    y = hp(y, 900)
    roar = lp(noise(n, seed + 1), 900) * (0.6 + 0.4 * np.sin(2 * np.pi * 3.1 * t + 6 * r.random()))
    return norm((norm(y) + bed * norm(roar)) * att(t, 0.05) * tail(t, d, 0.15))

def s_rain(d=2.2, seed=33):                            # 雨：带通噪声 + 细密雨滴（立体声）
    n = int(round(d * SR)); t = tt(d); out = []
    for ch in range(2):
        r = np.random.default_rng(seed + ch)
        drops = np.zeros(n); tl = np.arange(200) / SR
        for i in r.integers(0, n - 200, int(170 * d)):
            drops[i:i + 200] += r.uniform(0.2, 1) * np.sin(2 * np.pi * r.uniform(2500, 6500) * tl) * np.exp(-tl / 0.0015)
        out.append(0.6 * norm(bp(r.standard_normal(n), 500, 7000)) + 0.5 * norm(drops))
    return norm(np.stack(out, axis=1) * (att(t, 0.25) * tail(t, d, 0.4))[:, None])

def s_thunder(d=2.4, seed=34):                         # 雷：先“咔嚓”裂响，再滚过去的隆隆
    r = np.random.default_rng(seed); t = tt(d); n = len(t)
    crack = hp(r.standard_normal(n), 1500) * np.exp(-t / 0.04) * att(t, 0.001)
    am = lp(np.abs(r.standard_normal(n)), 6); am = am / (np.max(am) + 1e-9)
    rum = lp(r.standard_normal(n), 160, 4) * (0.5 + 0.5 * am) * np.exp(-t / 0.9) * att(t, 0.06)
    return norm(np.tanh(1.4 * (0.5 * norm(crack) + norm(rum))) * tail(t, d, 0.3))

def s_wave(d=2.0, seed=35):                            # 海浪：低频涌起 + 浪花嘶嘶
    t = tt(d); sw = np.sin(np.pi * np.clip(t / d, 0, 1)) ** 1.5
    return norm(norm(lp(noise(len(t), seed), 700)) * sw + 0.5 * norm(hp(noise(len(t), seed + 1), 2500)) * sw ** 3)

def s_wind(d=2.0, seed=36):                            # 风：慢慢摆动的窄带噪声
    t = tt(d)
    fc = lambda tm: 500 + 500 * np.sin(2 * np.pi * tm / d * 1.5) ** 2
    return norm(sweep_noise(d, fc, 0.35, seed) * np.sin(np.pi * np.clip(t / d, 0, 1)) ** 1.2)

def s_engine(d=1.5, f0=28, f1=34, seed=37, grit=0.5, curve=1.5):   # 摩托：点火脉冲列（f0→f1 Hz）+ 排气共振
    t = tt(d); u = t / d
    pulse = np.maximum(np.sin(phase(f0 + (f1 - f0) * u ** curve)), 0) ** 8
    y = np.tanh(3 * norm(lp(pulse, 900) + grit * lp(noise(len(t), seed), 2500) * pulse))
    return norm(bp(y, 60, 3000) * att(t, 0.04) * tail(t, d, 0.12))

def s_shatter(d=0.7, n=40, seed=38):                   # 方框碎裂：一串高频碎片脆响 + 噪声爆
    r = np.random.default_rng(seed); t = tt(d)
    y = hp(r.standard_normal(len(t)), 2000) * np.exp(-t / 0.03) * att(t, 0.0005)
    L = int(0.08 * SR); tl = np.arange(L) / SR
    for _ in range(n):
        t0 = 0.4 * r.random() ** 1.8; i = int(t0 * SR)
        y[i:i + L] += r.uniform(0.2, 0.8) * np.exp(-t0 / 0.25) * np.sin(2 * np.pi * r.uniform(2500, 9000) * tl + 6 * r.random()) * np.exp(-tl / r.uniform(0.008, 0.03))
    return norm(y)

def s_xmark(seed=39, f=98):                            # 红笔打叉：两笔“唰唰” + 低沉“嗞”错误音
    y = np.zeros(int(0.34 * SR))
    for k, t0 in enumerate((0.0, 0.075)): add(y, 0.8 * s_brush(0.07, seed + k), t0)
    tb = tt(0.2)
    bz = np.sign(np.sin(2 * np.pi * f * tb)) + 0.5 * np.sign(np.sin(2 * np.pi * f * 1.5 * tb))
    add(y, 0.6 * norm(lp(bz, 2400) * np.exp(-tb / 0.08) * att(tb, 0.004)), 0.06)
    return norm(y)

def _stick_slip(t, rate):                              # 摩擦脉冲列（吱呀 / 拉链）
    ph = np.cumsum(rate) / SR
    return (np.diff(np.floor(ph), prepend=0) > 0).astype(float)

def s_creak(d=0.6, r0=35, r1=70, f=900, seed=40):     # 门 / 方框“吱呀”
    t = tt(d); u = t / d
    imp = _stick_slip(t, r0 + (r1 - r0) * u) * (0.6 + 0.4 * np.random.default_rng(seed).random(len(t)))
    y = bp(imp, f * 0.8, f * 1.25) + 0.6 * bp(imp, f * 2.1, f * 2.6) + 0.3 * bp(imp, f * 3.3, f * 3.9)
    return norm(y * np.sin(np.pi * np.clip(u, 0, 1)) ** 0.6)

def s_zip(d=0.22, r0=60, r1=420, seed=44):             # 乱线“嗖”地拉直：加速的摩擦脉冲 + 上扫
    t = tt(d); u = t / d
    y = 3 * bp(_stick_slip(t, r0 * (r1 / r0) ** u), 1500, 6000) + 0.4 * s_whoosh(d, 800, 6000, 0.8, seed)
    return norm(y * att(t, 0.003) * tail(t, d, 0.02))

def s_dice(times=(0.0, 0.227, 0.4545), seed=41):       # 骰子落台：几声木质“哒”，一声比一声轻
    y = np.zeros(int(round((times[-1] + 0.25) * SR)))
    for k, t0 in enumerate(times):
        add(y, 0.85 ** k * s_clack(seed + k, 1500 + 200 * k), t0)
        add(y, 0.85 ** k * 0.6 * s_thump(0.12, 220, 120, 0.03, 0.2, seed + 10 + k), t0)
    return norm(y)

def s_match(seed=42, scratch=0.15):                    # 火柴“嚓”：粗糙摩擦 + 点燃“呼”
    t = tt(scratch)
    sc = bp(noise(len(t), seed), 1800, 7000) * (0.5 + 0.5 * np.abs(np.sin(2 * np.pi * 70 * t))) * np.sin(np.pi * t / scratch) ** 0.5
    y = np.zeros(int((scratch + 0.6) * SR)); add(y, norm(sc), 0.0)
    add(y, 0.8 * s_ignite(0.5, 500, 3200, seed + 1, 0.2), scratch - 0.01)
    return norm(y)

def s_clatter(seed=43):                                # 拐杖倒地：几声空心木棍“哐啷”
    r = np.random.default_rng(seed); y = np.zeros(int(0.6 * SR)); tl = tt(0.18)
    for k, t0 in enumerate((0.0, 0.11, 0.19, 0.25)):
        f = r.uniform(380, 520)
        x = sum(a * np.sin(2 * np.pi * f * m * tl) * np.exp(-tl / (0.05 / m)) for a, m in ((1, 1), (0.6, 2.76), (0.35, 5.4)))
        x = x + 0.3 * hp(r.standard_normal(len(tl)), 2000) * np.exp(-tl / 0.003)
        add(y, 0.8 ** k * norm(x), t0)
    return norm(y)

def s_rumble(d=0.5, seed=45):                          # 高台升起 / 下沉：低频隆隆
    t = tt(d); env = np.sin(np.pi * np.clip(t / d, 0, 1))
    y = norm(lp(noise(len(t), seed), 220, 4)) * env ** 0.7 + 0.3 * np.sin(phase(48 + 10 * t / d)) * env
    return norm(np.tanh(2 * norm(y)))

def s_key(seed=46):                                    # 打字“嗒”
    t = tt(0.06); r = np.random.default_rng(seed)
    y = norm(bp(r.standard_normal(len(t)), 1800, 5200)) * np.exp(-t / 0.004) + 0.5 * np.sin(2 * np.pi * 420 * t) * np.exp(-t / 0.012)
    return norm(y * att(t, 0.0003))

def s_splash(seed=47):                                 # 车轮压过水坑“哗”
    t = tt(0.45)
    return norm(norm(hp(noise(len(t), seed), 1200)) * np.exp(-t / 0.09) * att(t, 0.006) + 0.4 * norm(lp(noise(len(t), seed + 1), 900)) * np.exp(-t / 0.05))

def s_roll(d=0.45, seed=48):                           # 车轮滚动：低频轰轰 + 细碎颠簸
    t = tt(d); r = np.random.default_rng(seed)
    y = norm(lp(r.standard_normal(len(t)), 300)) * (0.7 + 0.3 * np.sin(2 * np.pi * 14 * t))
    y = y + 0.3 * norm(bp(r.standard_normal(len(t)), 1500, 4000)) * (np.sin(2 * np.pi * 22 * t) > 0.8)
    return norm(y * att(t, 0.03) * tail(t, d, 0.1))

def s_popper(seed=49):                                 # 礼花筒“嘭” + 纸屑沙沙
    t = tt(0.6); r = np.random.default_rng(seed)
    y = 0.9 * norm(lp(r.standard_normal(len(t)), 2500) * np.exp(-t / 0.012) * att(t, 0.0005))
    y = y + 0.5 * np.sin(phase(70 + 180 * np.exp(-t / 0.03))) * np.exp(-t / 0.05)
    rust = hp(r.standard_normal(len(t)), 3500) * (r.random(len(t)) > 0.97)
    return norm(y + 0.25 * norm(lp(rust, 9000)) * np.exp(-t / 0.25) * (t > 0.03))

def s_boom(d=1.4, seed=50):                            # DROP / 高潮：超低频冲击 + 爆裂噪声
    t = tt(d)
    sub = np.sin(phase(30 + 90 * np.exp(-t / 0.08))) * np.exp(-t / 0.45) * att(t, 0.002)
    nz = lp(noise(len(t), seed), 4000) * np.exp(-t / 0.08)
    return norm(np.tanh(1.8 * (norm(sub) + 0.5 * norm(nz))) * tail(t, d, 0.05))

def swish(seed, rel_down=True, d=0.2):                 # 鞠躬“唰”（衣服摩擦的短下扫）
    return s_whoosh(d, 300, 1800, 0.45, seed, down=rel_down)

# ------------------------------------------------------------------ sounds added for v2
def s_spray(d=0.5, seed=60):                           # 喷漆“嘶——”：高频噪声 + 阀门的轻微颤动
    t = tt(d)
    x = hp(bp(noise(len(t), seed), 3500, 12000, 2), 2500)
    return norm(x * att(t, 0.03) * tail(t, d, 0.06) * (0.85 + 0.15 * np.sin(2 * np.pi * 23 * t)), 0.7)

def s_rewind(d=0.8, seed=61):                          # 录像带倒带“叽叽叽——”：锯齿式急速上扫 + 磁带嘶声 + 马达
    t = tt(d)
    lfo = (t * 13) % 1.0
    ph = phase(900 + 2300 * lfo ** 1.6 + 700 * t / d)
    chirp = (np.sin(ph) + 0.35 * np.sin(2 * ph)) * (0.55 + 0.45 * (1 - lfo))
    hiss = 0.3 * norm(bp(noise(len(t), seed), 2000, 9000))
    motor = 0.3 * np.sin(phase(160 + 300 * t / d))
    return norm((0.7 * chirp + hiss + motor) * att(t, 0.02) * tail(t, d, 0.08), 0.75)

def s_wahwah(notes=(233.1, 220.0, 207.7, 196.0), step=0.13, last=0.38):   # 失落的“哇哇哇哇——”（弱音小号）
    y = np.zeros(int(round((step * (len(notes) - 1) + last + 0.02) * SR)))
    for k, f in enumerate(notes):
        lastn = k == len(notes) - 1
        d = last if lastn else step * 0.94
        t = tt(d); u = t / d
        vib = 1 + (0.035 * np.sin(2 * np.pi * 5.5 * t) * np.clip((t - 0.08) / 0.1, 0, 1) if lastn else 0)
        ph = phase(f * vib * np.ones_like(t))
        b = np.sin(np.pi * np.clip(u if lastn else u * 1.4, 0, 1)) ** 0.8          # “wah”：每个音先亮后暗
        x = sum(np.sin(h * ph) / h * np.exp(-h / (1.0 + 9 * b)) for h in range(1, 14))
        add(y, x * att(t, 0.012) * tail(t, d, 0.03), k * step)
    return norm(y, 0.8)

def s_rustle(d=1.5, seed=62):                          # 纸卷展开“沙沙”：随机起伏的带通噪声
    t = tt(d)
    am = uniform_filter1d(np.abs(noise(len(t), seed + 1)), int(0.03 * SR)); am /= am.max()
    return norm(bp(noise(len(t), seed), 1200, 6500) * (0.3 + am ** 2) * att(t, 0.05) * tail(t, d, 0.1), 0.6)

NOTE = {'C6': 1046.5, 'Eb6': 1244.5, 'F6': 1396.9, 'G6': 1568.0, 'Ab6': 1661.2, 'Bb6': 1864.7, 'C7': 2093.0}

# ------------------------------------------------------------------ cue sheet（与 js 动画时间点一一对应）
def picture_cues(root):                                # 镜头 / 字幕时间直接取自 js/film.js（tools/export_cues.mjs）
    try:
        out = subprocess.run(['node', str(root / 'tools' / 'export_cues.mjs')], check=True, capture_output=True, cwd=root).stdout
        return json.loads(out)
    except Exception:
        return json.loads((root / 'tools' / 'cues_auto.json').read_text())

def cues(P):
    C = []  # (time, sound, rel_dB, pan, win)  win=None → 整段 RMS
    def q(t, x, rel, pan=0.0, win=0.25): C.append((t, x, rel, pan, win))
    def POP(t, s=0, rel=-8, pan=0.0): q(t, s_pop(520, 1500, 0.09, s), rel, pan)
    def TICK(t, s=0, rel=-11, pan=0.0): q(t, s_tick(1500, s), rel, pan)
    def BOOP(t, f=300, rel=-11, pan=0.0): q(t, s_bloop(f, 2.4, 0.14, 0.05), rel, pan)
    def BADGE(t, f, s, pan=0.0):                       # 胸口的黄毛心亮起：全片同一个“叮”，一次比一次高
        q(t, s_blip(f, 0.24, 1.335), -8, pan); q(t + 0.03, s_sparkle(0.5, 6, s, 3000), -14, pan, None)

    # 字幕：每行弹出一声“啵”（大字更厚，花字再加一声“啪”）
    for i, cp in enumerate(P['caps']):
        t0 = cp['t']
        if t0 < 0: continue
        if cp['flower']:
            q(t0, s_pop(380, 1200, 0.12, 500 + i), -5); q(t0 + 0.02, s_stamp(600 + i), -10)
        elif cp['size'] >= 130:
            q(t0, s_pop(420, 1300, 0.11, 500 + i), -7); q(t0, s_thump(0.18, 180, 80, 0.05, 0.25, 700 + i), -14)
        else:
            q(t0, s_pop(540, 1550, 0.085, 500 + i), -8)
    # 转场：“嗖”，形状不同音色不同
    for sh in P['shots']:
        tr = sh['tr']
        if not tr or tr['k'] == 'cut': continue
        t0, d, i = sh['t'], tr.get('d', 0.42), sh['i']
        if tr['k'] == 'iris':
            q(t0 - 0.05, s_whoosh(d + 0.12, 400, 4500, 0.55, 800 + i), -10, 0, None)
        elif tr['k'] == 'diag':
            q(t0 - 0.05, s_whoosh(d + 0.1, 500, 6000, 0.6, 800 + i), -10, 0.25 if tr.get('rev') else -0.25, None)
        elif tr['k'] == 'slats':
            q(t0 - 0.04, s_whoosh(d + 0.12, 350, 3500, 0.5, 800 + i), -11, 0, None); q(t0 + 0.1, s_flap(820 + i), -14)
        elif tr['k'] == 'push':
            q(t0 - 0.06, s_whoosh(d + 0.12, 300, 3000, 0.55, 800 + i, down=True), -9, 0.3, None)
        elif tr['k'] == 'heart':
            q(t0 - 0.04, s_whoosh(d + 0.1, 400, 4000, 0.5, 800 + i), -11, 0, None); q(t0 + 0.05, s_boing(0.4, 300), -13)

    # B0 老实人 vs 黄毛：小红心犹豫一下，拐弯落到黄毛身上（+1）
    q(0.0, s_stamp(1), -9); q(0.0, s_pop(380, 1150, 0.12, 2), -8)                          # VS 徽章
    q(bb(0, 0.95), s_boing(0.35, 300), -14, -0.4)                                           # “？”
    q(bb(0, 1.45), s_whoosh(0.45, 600, 5000, 0.6, 3), -11, 0.3, None)                       # 红心拐弯
    q(bb(0, 2.25), s_blip(NOTE['C6'], 0.24, 1.335), -7, 0.4); q(bb(0, 2.25) + 0.02, s_sparkle(0.6, 7, 4, 3000), -13, 0.4, None)
    q(bb(0, 2.25) + 0.12, s_whistle(0.4, 900, 420), -16, -0.4)                              # 老实人泄气
    # B1 标题砸下；老实人把头发喷成黄色，红心照样飞走
    for i in range(4): q(bb(1, 0) + i * 0.055, s_stamp(10 + i), -10 - i, (-0.3, -0.1, 0.1, 0.3)[i])
    q(bb(1, 0), s_thump(0.45, 160, 45, 0.15, 0.4, 14), -6); q(bb(1, 0) + 0.3, s_sparkle(0.6, 7, 15, 3200), -15, 0, None)
    canIn, dyeT, ta, fly0, fly1 = bb(1, 0.85), bb(1, 1.5), bb(1, 1.75), bb(1, 2.05), bb(1, 2.95)
    q(canIn, s_pop(650, 1500, 0.07, 16), -12, 0.15)
    q(canIn + 0.15, s_spray(dyeT - canIn - 0.15, 17), -11, 0.1, None)
    q(dyeT - 0.08, s_poof(18), -9); q(dyeT, s_boing(0.4, 240), -12)
    q(ta, s_arp([1047, 1319, 1568, 2093], 0.035, 0.09), -10); q(ta + 0.03, s_sparkle(0.5, 6, 19, 3200), -14, 0, None)
    q(fly0, s_whoosh(fly1 - fly0, 300, 3000, 0.5, 20), -12, 0, None)
    q(fly1 - 0.25, s_wahwah(), -11)
    # B2 ①不迎合：老实人连说三句“是”，黄毛举手“我不这么看”
    POP(bb(2, 0.05), 30, -9)
    for i, jb in enumerate((0.45, 1.0, 1.55)): BOOP(bb(2, jb), 300 + 70 * i, -11, -0.35)
    q(bb(2, 2.05), swish(31, False), -14, 0.4)
    q(bb(2, 2.15), s_pop(380, 1150, 0.12, 32), -7, 0.4); q(bb(2, 2.18), s_ding(NOTE['G6'], 0.6, 0.9), -15, 0.4)
    # B3 ②不内耗：上铺失眠掉电，下铺打呼满电
    POP(bb(3, 0.05), 40, -9)
    q(bb(3, 0.4), s_scribble(1.7, 9, 41), -18, -0.3, None)
    for i, jb in enumerate((0.55, 1.3)): q(bb(3, jb), s_bloop(230 + 40 * i, 1.6, 0.18, 0.06), -12, -0.2)
    for jb in (1.0, 2.2): q(bb(3, jb), s_zz(0.4, 140), -15, 0.2)
    for jb in (2.55, 2.85): q(bb(3, jb), s_beep(1760, 0.08), -15, 0.35)
    # B4 ③说干就干：老实人的计划越写越长，黄毛助跑、起跳、落地
    POP(bb(4, 0.05), 50, -9)
    q(bb(4, 0.3), s_rustle(bb(4, 3.6) - bb(4, 0.3), 51), -19, -0.4, None)
    fly0, fly1 = bb(4, 1.45), bb(4, 2.25)
    for k in range(4): q(bb(4, 0.5) + k * (fly0 - 0.05 - bb(4, 0.5)) / 3, s_step(52 + k), -13, -0.5 + 0.15 * k)
    q(fly0 - 0.05, s_poof(56), -14, -0.1); q(fly0, s_whistle(fly1 - fly0, 520, 1500), -13, 0.1)
    q(fly1, s_thump(0.4, 140, 45, 0.12, 0.4, 57), -6, 0.3); q(fly1 + 0.01, s_poof(58), -10, 0.3)
    q(fly1 + 0.12, s_arp([1319, 1568, 2093], 0.035, 0.09), -11, 0.35); q(fly1 + 0.14, s_sparkle(0.5, 6, 59, 3200), -14, 0.35, None)
    # B5 词典卡：“黄毛”本来是说小孩
    t0 = bb(5, 0)
    q(t0 + 0.05, s_flap(60), -10); q(t0 + 0.05, s_pop(420, 1100, 0.1, 61), -11)
    for k, tk in enumerate((t0 + 0.3, t0 + 0.55, bb(5, 1.0), bb(5, 1.9))): TICK(tk, 62 + k, -12)
    q(bb(5, 1.35), s_brush(0.4, 66), -10)
    q(bb(5, 2.2), s_boing(0.4, 260), -11, -0.3); q(bb(5, 2.45), s_boing(0.4, 330), -11, 0.3)
    # B6–B7 小时候谁不是黄毛 → 被滚筒一遍遍刷黑、被方框框住
    q(bb(6, 0.15) - 0.05, s_boing(0.4, 220), -12)
    q(bb(6, 0.85), s_splash(70), -8); q(bb(6, 0.85), s_thump(0.25, 150, 60, 0.07, 0.3, 71), -12)
    q(bb(6, 1.4), s_pop(450, 1300, 0.1, 72), -8, -0.3)
    q(bb(6, 2.25), s_pop(620, 1600, 0.1, 73), -9, 0.3); q(bb(6, 2.3), s_boing(0.3, 360), -15, 0.3)
    q(bb(6, 2.95), s_scribble(1.0, 13, 74), -12, 0, None)
    for k, (a, b_) in enumerate(((0.4, 1.15), (1.15, 1.9), (1.9, 2.65))):
        q(bb(7, a), s_roll(bb(7, b_) - bb(7, a), 75 + k), -11, 0, None)
        q(bb(7, a + 0.45) - 0.06, s_squish(78 + k), -11); q(bb(7, a + 0.45) - 0.04, s_poof(81 + k), -13)
    q(bb(7, 1.6), s_riser(B(8) - bb(7, 1.6), 87), -15, 0, None)
    q(bb(7, 2.75), s_whoosh(0.5, 250, 2000, 0.8, 84, down=True), -12, 0, None)
    q(bb(7, 2.75) + 0.45, s_thump(0.3, 120, 50, 0.08, 0.5, 85), -9); q(bb(7, 2.75) + 0.45, s_clack(86, 1800), -12)
    q(bb(7, 3.25), s_creak(0.55, 30, 55, 700, 88), -12, 0, None)
    # B8 DROP：方框碎了，黄毛心冲出来
    q(B(8), s_boom(1.4, 90), -8, 0, 0.3)
    q(B(8), s_shatter(0.7, 44, 91), -8, 0, None)
    q(B(8) + 0.01, s_popper(92), -13, -0.6); q(B(8) + 0.03, s_popper(93), -13, 0.6)
    q(B(8) + 0.12, s_arp([1047, 1319, 1568, 2093, 2637], 0.035, 0.1), -9); q(B(8) + 0.12, s_sparkle(0.8, 9, 94, 2800), -12, 0, None)
    q(bb(8, 1.0), s_bloop(420, 2.4, 0.14, 0.05), -11); q(bb(8, 1.0) + 0.02, s_sparkle(0.5, 6, 95, 3300), -14, 0.2, None)
    q(bb(8, 2.0), s_popper(96), -14, 0.2)
    BADGE(bb(8, 2.4), NOTE['C6'], 97)
    # B9–B12 四个普通人：想法 / 机会 / 喜欢 / 60 岁学滑板
    q(B(9) + 0.15, s_flap(100), -14, -0.3)
    q(bb(9, 0.85), swish(101, False), -12, 0.2)
    q(bb(9, 0.9), s_pop(460, 1450, 0.1, 102), -7, 0.2); q(bb(9, 0.95), s_ding(NOTE['C7'], 0.6, 0.9), -15, 0.2)
    BADGE(bb(9, 1.5), NOTE['Eb6'], 103)
    q(B(10) - 0.05, s_rain(B(11) - B(10) + 0.2, 110), -18, 0, None)
    q(B(10), s_engine(B(11) - B(10), 26, 32, 111, 0.6), -14, 0, None)
    grab = bb(10, 2.15)
    q(grab - 0.35, swish(112, False), -14, 0.3)
    q(grab, s_pop(500, 1500, 0.1, 113), -8, 0.3); q(grab + 0.02, s_sparkle(0.5, 6, 114, 3200), -14, 0.3, None)
    BADGE(grab + 0.2, NOTE['F6'], 115)
    q(bb(11, 0.7), s_step(120, 0.5), -12, -0.2)
    q(bb(11, 0.8), s_pop(480, 1450, 0.1, 121), -7, -0.2)
    BADGE(bb(11, 1.05), NOTE['G6'], 122)
    q(bb(11, 1.5), s_bloop(520, 1.8, 0.2, 0.07), -13, 0.3)
    for i in range(4): q(bb(11, 1.6 + i * 0.35), s_bloop(620 + 110 * i, 2.0, 0.12, 0.04), -15, 0.4 if i % 2 else 0.1)
    q(B(12), s_roll(B(13) - B(12), 130), -17, 0, None)
    q(bb(12, 0.25), s_pop(520, 1500, 0.09, 131), -9, 0.1)
    q(bb(12, 1.4), s_whoosh(0.45, 400, 4000, 0.5, 132), -11, 0, None); q(bb(12, 1.4), s_poof(133), -14, -0.3)
    BADGE(bb(12, 1.65), NOTE['Bb6'], 134)
    # B13 放大镜扫过：头发一根都不黄，胸口都亮着
    q(bb(13, 0.25), s_whoosh(bb(13, 3.2) - bb(13, 0.25), 300, 1500, 0.5, 140), -20, 0, None)
    for i, x in enumerate((175, 405, 645, 880)):
        tp = bb(13, 0.3) + (x + 120) / 1320 * (bb(13, 3.1) - bb(13, 0.3))
        q(tp, s_ding((NOTE['C6'], NOTE['Eb6'], NOTE['F6'], NOTE['Ab6'])[i], 0.5, 0.9), -12, (x - 540) / 600)
        q(tp, s_bloop(300 + 50 * i, 2.2, 0.12, 0.04), -15, (x - 540) / 600)
    # B14–B15 高富帅要看命（骰子）；聚光灯转向普通人，镜头推进他的胸口
    q(B(14) + 0.2, s_sparkle(1.0, 8, 150, 3600), -17, -0.4, None)
    d0, d1 = bb(14, 0.55), bb(14, 1.55); D = d1 - d0
    q(d0 - 0.05, s_whoosh(0.3, 600, 4000, 0.7, 151), -14, 0.5, None)
    q(d0 + 0.4 * D, s_dice((0.0, 0.4 * D, 0.6 * D), 152), -8, 0.3)
    q(d1, s_stamp(153), -10, 0.3); q(d1 + 0.02, s_bonk(147), -12, 0.3)
    for k, jb in enumerate((3.3, 3.65)): q(bb(14, jb), s_step(154 + k), -14, 0.4)
    q(bb(15, 0.0), s_click(156), -8); q(bb(15, 0.0) + 0.02, s_whoosh(0.5, 300, 2500, 0.5, 157), -12, 0, None)
    q(bb(15, 0.4), s_arp([784, 1047, 1319, 1568], 0.05, 0.12), -11, 0.3); q(bb(15, 0.42), s_sparkle(0.7, 8, 158, 3000), -14, 0.3, None)
    q(bb(15, 0.6), s_riser(B(16) - bb(15, 0.6), 159), -11, 0, None)
    # B16 高潮：只要愿意，谁都能当
    q(B(16), s_boom(1.5, 160), -8, 0, 0.3)
    q(B(16) + 0.01, s_popper(161), -12, -0.6); q(B(16) + 0.03, s_popper(162), -12, 0.6)
    q(B(16) + 0.02, s_whoosh(0.5, 300, 3000, 0.3, 163, down=True), -12, 0, None)
    q(B(16) + 0.1, s_sparkle(0.9, 9, 164, 2800), -12, 0, None)
    q(bb(16, 2), s_popper(165), -12, -0.6); q(bb(16, 2) + 0.02, s_popper(166), -12, 0.6)
    for jb in (1, 2, 3): q(bb(16, jb), s_bloop(260, 1.8, 0.1, 0.04), -19)
    # B17 研究图：“没做”的后悔越来越大
    POP(bb(17, 0.1), 170, -8)
    q(bb(17, 0.12), s_flap(171), -11)
    TICK(bb(17, 0.45), 172, -12, -0.2); TICK(bb(17, 0.6), 173, -12, 0.2)
    q(bb(17, 0.55), s_whistle(1.2, 500, 1300), -16, 0.1)
    q(bb(17, 0.55), s_scribble(1.2, 10, 174), -20, 0, None)
    q(bb(17, 2.5), s_pop(420, 1250, 0.11, 175), -10, 0.4); q(bb(17, 2.52), s_boing(0.35, 300), -14, 0.4)
    # B18 门前犹豫的人：20 → 50 → 80 岁（钟表狂转）
    q(bb(18, 0.1), s_pop(560, 1550, 0.09, 180), -10, -0.1)
    q(bb(18, 0.75), s_bloop(420, 0.55, 0.16, 0.06), -14, 0.2)                            # 手缩回来
    t0c, t1c = bb(18, 0.95), bb(18, 2.85)
    for k, tk in enumerate(crossings(t0c, t1c, lambda x: 9 * io2((x - t0c) / (t1c - t0c)), np.arange(0.5, 9.01, 0.5))):
        q(tk, s_clock(3200 if k % 2 else 2500, 181 + k), -13, -0.5)
    q(bb(18, 1.15), s_pop(480, 1400, 0.1, 200), -10, -0.1); q(bb(18, 2.6), s_pop(400, 1250, 0.11, 201), -10, -0.1)
    q(bb(18, 2.4), s_creak(0.4, 25, 40, 600, 202), -16, 0.1, None)                        # 老骨头“嘎吱”
    # B19 倒带回到 20 岁；这次推门：摔一跤，爬起来，遗憾 -1
    q(B(19), s_rewind(bb(19, 0.85) - B(19), 210), -9, 0, None); q(B(19) + 0.02, s_click(211), -11)
    BADGE(bb(19, 0.9), NOTE['C7'], 212)
    q(bb(19, 1.15), s_creak(0.4, 40, 75, 900, 213), -13, 0.4, None)
    q(bb(19, 1.15), s_arp([1047, 1319, 1568, 2093, 2637], 0.04, 0.14), -10, 0.4); q(bb(19, 1.17), s_sparkle(0.8, 9, 214, 3000), -12, 0.4, None)
    q(bb(19, 1.6), s_whistle(0.32, 1500, 520), -12, 0.1)
    q(bb(19, 1.92), s_thump(0.35, 130, 45, 0.1, 0.4, 215), -8, 0.2); q(bb(19, 1.94), s_poof(216), -10, 0.3)
    q(bb(19, 2.1), s_arp([2637, 2093, 2349, 1760], 0.06, 0.08), -17, 0.1)               # 眼冒金星
    q(bb(19, 2.4), s_boing(0.4, 260), -11)
    q(bb(19, 2.72), s_popper(217), -12, 0.1); q(bb(19, 2.72), s_pop(420, 1300, 0.1, 218), -11)
    q(bb(19, 2.85), s_ding(NOTE['C7'], 0.9, 1.0), -10, 0.1); q(bb(19, 2.87), s_sparkle(0.6, 7, 219, 3300), -14, 0, None)
    # B20–B22 今天就能试：三张卡片，一张推走一张
    POP(bb(20, 0.15), 230, -8)
    for k in (1, 2): q(B(20 + k) - 0.05, s_whoosh(0.5, 300, 3200, 0.55, 231 + k, down=True), -9, 0.3, None)
    def panel_in(t0, s): q(t0 + 0.05, s_pop(400, 1100, 0.11, s), -10); q(t0 + 0.15, s_pop(650, 1600, 0.08, s + 1), -11, -0.4)
    j = lambda k, x: B(20 + k) + x * BEAT
    panel_in(B(20), 240)                                                                    # ① 群聊：不想去的局，说“不”
    q(j(0, 0.4), s_twoTone(880, 1320), -11, -0.2); q(j(0, 0.8), s_twoTone(990, 1480), -11, -0.2)
    for i in range(3): q(j(0, 1.15) + i * 0.13, s_key(242 + i), -13, 0.2)
    q(j(0, 1.6), s_whoosh(0.18, 1500, 6000, 0.7, 245), -13, 0.3, None); q(j(0, 1.62), s_bloop(700, 1.8, 0.12, 0.04), -10, 0.3)
    TICK(j(0, 2.0), 246, -13, 0.3)
    q(j(0, 2.3), s_pop(450, 1300, 0.1, 247), -10, 0.4); q(j(0, 2.45), s_poof(248), -15, 0.3)
    panel_in(B(21), 250)                                                                    # ② 日历：明年 → 下个月 → 明天 → 今天
    for i, x in enumerate((0.35, 0.7, 1.05)): q(j(1, x), s_flap(252 + i), -10 - i * 0.5, 0.1)
    q(j(1, 1.05), s_pop(380, 1200, 0.12, 255), -7); q(j(1, 1.07), s_sparkle(0.6, 8, 256, 3000), -12, 0, None)
    q(j(1, 1.6), swish(257, False, 0.3), -12)
    q(j(1, 2.3), s_scribble(0.25, 14, 258), -11, -0.2); q(j(1, 2.5), s_sparkle(0.45, 5, 259, 3400), -14, -0.2, None)
    panel_in(B(22), 260)                                                                    # ③ “我不配”划掉，翻面成“我试试”
    q(j(2, 0.95), s_brush(0.38, 262), -8)
    tf = j(2, 1.8)
    q(tf - 0.17, s_whoosh(0.34, 800, 5000, 0.5, 263), -10, 0, None); q(tf, s_flap(264), -10)
    q(tf + 0.1, s_popper(265), -11); q(tf + 0.1, s_arp([1047, 1319, 1568, 2093], 0.035, 0.1), -9); q(tf + 0.12, s_stamp(266), -12)
    q(j(2, 2.4), s_pop(450, 1300, 0.1, 267), -11, 0.4); q(j(2, 2.42), s_boing(0.35, 320), -14, 0.4)
    # B23 你身边最“黄毛”的人是谁？聚光灯跳来跳去，评论区 @TA
    jj = lambda x: B(23) + x * BEAT
    q(jj(0.3), swish(270, False, 0.3), -13)
    for i, x in enumerate((0.35, 0.75, 1.15, 1.55)): q(jj(x), s_bloop((392, 523, 659, 784)[i], 1.5, 0.1, 0.04), -11, ((170, 400, 660, 905)[i] - 540) / 600)
    q(jj(1.95), s_ding(NOTE['C7'], 0.8, 1.0), -9, -0.2); q(jj(1.95), s_stamp(271), -12, -0.2); q(jj(1.97), s_sparkle(0.6, 8, 272, 3000), -12, -0.2, None)
    for i in range(3): q(jj(2.25) + i * 0.1, s_key(273 + i), -8, -0.1)
    q(jj(3.0), s_pop(380, 1200, 0.12, 276), -7, 0.6)
    for i in range(6): q(jj(3.0) + i * 0.08, s_bloop(500 + 90 * i, 1.8, 0.1, 0.04), -16, 0.6)
    # B24–B25 片尾：标题砸下，七个人依次跳出来，胸口都亮着
    for i in range(4): q(bb(24, 0.3) + i * 0.067, s_stamp(280 + i), -10 - 0.5 * i, (-0.3, -0.1, 0.1, 0.3)[i])
    q(bb(24, 0.3), s_thump(0.5, 170, 42, 0.18, 0.5, 284), -6)
    q(bb(24, 0.9), s_boing(0.5, 220), -10); q(bb(24, 0.95), s_sparkle(0.7, 8, 285, 3000), -13, 0, None)
    for i in range(7): q(bb(24, 1.2 + i * 0.12), s_bloop(260 + 45 * i, 2.2, 0.14, 0.05), -13, (96 + 148 * i - 540) / 600)
    q(B(25), s_popper(290), -10, -0.6); q(B(25) + 0.02, s_popper(291), -10, 0.6); q(B(25) + 0.05, s_sparkle(0.9, 9, 292, 2800), -11, 0, None)
    q(bb(25, 1.0), s_ding(NOTE['C7'], 1.4, 1.0), -9); q(bb(25, 1.02), s_sparkle(0.8, 7, 293, 3300), -13, 0, None)
    return C

# 音乐闪避：(时刻, dB, 释放 s, 保持 s)
DUCKS = [(B(1), 2.0, 0.3), (B(8), 4.5, 0.7), (B(16), 4.5, 0.7), (bb(19, 1.92), 1.5, 0.3), (bb(22, 1.9), 1.5, 0.3), (bb(24, 0.3), 2.5, 0.5)]

# ------------------------------------------------------------------ music
def load_music(path):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', str(path), '-t', f'{DUR + 0.5}', '-f', 'f32le', '-ac', '2', '-ar', str(SR), '-'],
                         check=True, capture_output=True).stdout
    m = np.frombuffer(raw, np.float32).reshape(-1, 2).astype(np.float64)
    if len(m) < N: m = np.vstack([m, np.zeros((N - len(m), 2))])
    m = m[:N].copy()
    t = np.arange(N) / SR
    m *= att(t, 0.005)[:, None]                                               # 防爆音
    fo = np.clip((t - FADE0) / (DUR - FADE0), 0, 1)
    m *= np.cos(fo * np.pi / 2)[:, None]                                       # FADE0 → DUR 与画面同时淡出
    return m

def main():
    ap = argparse.ArgumentParser()
    root = Path(__file__).resolve().parent.parent
    ap.add_argument('--music', default=str(root / 'audio' / 'music.mp3'))
    ap.add_argument('--out', default=str(root / 'out' / 'audio_master.wav'))
    ap.add_argument('--target', type=float, default=-12.0)
    ap.add_argument('--ceiling', type=float, default=-2.0, help='wav 真峰值上限；留 1 dB 给 AAC 编码过冲')
    a = ap.parse_args()

    music = load_music(a.music)
    L_music = lufs(music)
    music *= 10 ** ((-14 - L_music) / 20)                                     # 先把音乐统一到 -14 LUFS 再配音效
    mk = k_weight(music).sum(axis=1) / 2
    floor = np.sqrt(np.mean(mk ** 2)) * 10 ** (-8 / 20)

    t = np.arange(N) / SR
    duck = np.ones(N)
    for t0, db, rel, *hold in DUCKS:
        h = hold[0] if hold else 0.12
        u = t - t0
        e = np.where(u < -0.015, 0, np.where(u < 0, (u + 0.015) / 0.015, np.where(u < h, 1, np.exp(-(u - h) / (rel / 3)))))
        duck *= 1 - (1 - 10 ** (-db / 20)) * e
    music *= duck[:, None]

    bus = np.zeros((N, 2))
    n_ev = 0
    for t0, x, rel, pan, win in cues(picture_cues(root)):
        i0 = int(round(t0 * SR))
        mono = x if x.ndim == 1 else x.mean(axis=1)
        w = len(mono) if win is None else min(len(mono), int(win * SR))
        ks = k_weight(mono)[:w]
        sfx_rms = np.sqrt(np.mean(ks ** 2)) + 1e-9
        seg = mk[max(0, i0): max(0, i0) + max(w, int(0.1 * SR))]
        mus_rms = max(np.sqrt(np.mean(seg ** 2)) if len(seg) else 0, floor)
        g = 10 ** (rel / 20) * mus_rms / sfx_rms
        g = min(g, 0.9 / (np.max(np.abs(x)) + 1e-9))
        y = x * g
        if y.ndim == 1: y = np.stack([y * min(1, 1 - pan), y * min(1, 1 + pan)], axis=1)
        if i0 < 0: y = y[-i0:]; i0 = 0
        i1 = min(N, i0 + len(y))
        bus[i0:i1] += y[: i1 - i0]
        n_ev += 1
    bus = hp(bus, 30)
    # 轻微房间混响让音效和音乐更“粘”
    r = np.random.default_rng(99)
    ti = tt(0.6)
    ir = np.stack([lp(r.standard_normal(len(ti)), 6000) * np.exp(-ti / 0.09) for _ in range(2)], axis=1)
    ir = np.vstack([np.zeros((int(0.012 * SR), 2)), ir])
    ir /= np.sqrt(np.sum(ir ** 2, axis=0, keepdims=True))
    wet = np.stack([signal.fftconvolve(bus[:, c], ir[:, c])[:N] for c in range(2)], axis=1)
    mix = music + bus + 10 ** (-15 / 20) * wet

    g_db = a.target - lufs(mix)
    for _ in range(6):
        y, gain = limiter(mix * 10 ** (g_db / 20), a.ceiling)
        L = lufs(y)
        if abs(L - a.target) < 0.05: break
        g_db += a.target - L
    y *= tail(t, DUR, 0.2)[:, None]                                            # 结尾 0.2 s 收尾
    tp = true_peak(y)
    Path(a.out).parent.mkdir(parents=True, exist_ok=True)
    wavfile.write(a.out, SR, y.astype(np.float32))
    gr = 20 * np.log10(gain)
    m = (gr < -1.0).astype(int)
    edges = np.flatnonzero(np.diff(np.concatenate([[0], m, [0]])))
    regs = sorted(((gr[s:e].min(), s / SR, e / SR) for s, e in zip(edges[::2], edges[1::2])))[:8]
    print('limiter GR>1dB:', ', '.join(f'{a0:.2f}-{a1:.2f}s {g:.1f}dB' for g, a0, a1 in regs) or 'none')
    print(f'music {L_music:.2f} LUFS (raw) | {n_ev} sfx events | master {lufs(y):.2f} LUFS, TP {tp:.2f} dBTP, '
          f'max GR {20 * np.log10(gain.min()):.2f} dB | {len(y) / SR:.3f}s -> {a.out}')

if __name__ == '__main__':
    main()
