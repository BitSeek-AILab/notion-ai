#!/usr/bin/env python3
"""黄毛理论 · 音效与混音母带

所有音效均为程序合成（numpy / scipy，不使用任何采样），按影片的节拍网格放置，
叠加在用户提供的音乐下（音乐从 0 s 开始，截断至视频长度 53.2 s，52.4 s 起淡出），
最后母带处理到约 -12 LUFS、真峰值 ≤ -1 dBTP（wav 限幅到 -2 dBTP，AAC 编码后仍 ≤ -1）。

  python3 tools/sfx.py [--music audio/music.mp3] [--out out/audio_master.wav]

每个音效的响度都相对“同一时刻音乐的 K 加权响度”自动校准（rel 列，单位 dB），
所以换音乐后音效依然清晰但不抢戏。音效时间点与 js/s1.js–s3.js 的动画时间点一一对应
（bt(n) = 第 n 拍，B(k) = 第 k 小节强拍）；DROP（B8）与高潮（B16）处音乐闪避 4.5 dB 让冲击声透出来。
"""
import argparse
import subprocess
from pathlib import Path

import numpy as np
from scipy import signal
from scipy.io import wavfile
from scipy.ndimage import minimum_filter1d, uniform_filter1d

SR = 48000
DUR = 53.2                         # 与 js/core.js 一致
FADE0 = 52.4                       # 画面与音乐同时淡出
N = int(round(DUR * SR))
BPM, PH = 112.9, 0.082             # 与 js/core.js 完全一致
BEAT = 60 / BPM
E8, S16 = BEAT / 2, BEAT / 4
FPS = 30
def bt(n): return PH + n * BEAT
def B(k): return bt(4 * k)
def tq_of_frame(f): return np.floor((f + 1) / 2) * 2 / FPS   # 与 js/film.js 的“一拍二”量化一致

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

# ------------------------------------------------------------------ cue sheet（与 js 动画时间点一一对应）
def year_ticks():                                      # B11 年份 2006→2026 每跳一次的画面时刻
    t0, t1 = bt(44.5), bt(45.75)
    out, prev = [], None
    for f in range(int(t0 * FPS) - 2, int(t1 * FPS) + 4):
        tq = tq_of_frame(f)
        yr = int(np.floor(2006 + 20 * float(io2((tq - t0) / (t1 - t0))) + 0.5))
        if prev is not None and yr != prev: out.append((f / FPS, yr - prev))
        prev = yr
    return out

def cues():
    C = []  # (time, sound, rel_dB, pan, win)  win=None → 整段 RMS
    def q(t, x, rel, pan=0.0, win=0.25): C.append((t, x, rel, pan, win))
    HLp = lambda t, s=0, rel=-7: q(t, s_pop(520, 1500, 0.09, s), rel)
    SUBt = lambda t, s=0, rel=-11: q(t, s_tick(1500, s), rel)
    MORPH = lambda t, s=0, rel=-9, d=0.32: q(t - 0.06, s_whoosh(d, 400, 4200, 0.6, s), rel, 0, None)
    STEP = lambda t, s=0, rel=-10, pan=0.0: q(t, s_step(s), rel - 3, pan)
    PANS3 = (-0.4, 0.0, 0.4)

    # B0 一排老实人每拍鞠躬；第 4 拍中间那个不弯腰，头顶“噗”地窜出黄火苗
    for i, n in enumerate((0, 1, 2)): q(bt(n), swish(100 + i), -15, (-0.2, 0.2, 0)[i])
    HLp(bt(0) + 0.02, 1, -6); HLp(bt(2), 2, -6)
    q(bt(3), s_boing(0.45, 230), -9)
    q(bt(3) + 0.01, s_ignite(0.45, 400, 3000, 101, 0.3), -5, 0, None)
    q(bt(3) + 0.1, s_sparkle(0.5, 6, 102, 3000), -15, 0, None)
    # B1 火苗一甩 → 墨印“黄毛理论”；两边的方块头被震歪
    q(B(1) - 0.16, s_whoosh(0.2, 600, 6000, 0.85, 110), -8, 0, None)
    q(B(1), s_thump(0.55, 170, 45, 0.18, 0.45, 111), -5)
    q(B(1), s_whoosh(0.5, 300, 2500, 0.12, 113, down=True), -12, 0, None)            # 冲击波
    q(B(1) + 0.04, s_brush(0.32, 112), -7, -0.2, None)                                # 墨刷
    q(B(1) + 0.08, s_bloop(260, 1.8, 0.2, 0.06), -14, -0.5); q(B(1) + 0.11, s_bloop(300, 1.8, 0.2, 0.06), -14, 0.5)
    for i, n in enumerate((5, 6, 7)): q(bt(n), swish(114 + i), -19, (-0.3, 0.3, 0)[i])
    SUBt(bt(6), 117)
    # B2 镜头推近；“是是是”“好好好”被弹直的脊梁震破 → ① 不迎合
    q(B(2) - 0.24, s_whoosh(0.4, 300, 2500, 0.6, 120), -11, 0, None)
    q(bt(8) + 0.04, s_bloop(380, 2.4, 0.16, 0.05), -8, 0.35); q(bt(8.5), s_bloop(420, 2.4, 0.16, 0.05), -8, 0.25)
    q(bt(8.45), s_whistle(0.3, 500, 1700), -15, 0, None)
    q(bt(9), s_poof(121), -9, 0.3); q(bt(9) + 0.03, s_poof(122), -10, 0.2)
    q(bt(9), s_boing(0.5, 200), -7); q(bt(9), s_thump(0.3, 140, 60, 0.08, 0.2, 123), -8)
    q(bt(9) + 0.03, s_ignite(0.35, 500, 3000, 124, 0.2), -10, 0, None); HLp(bt(9) + 0.01, 125)
    # B3 乱线团 → 被火苗一拽，拉直成箭 → ② 不内耗
    q(B(3) + 0.04, s_scribble(0.4, 12, 130), -10, 0.15, None)
    q(bt(13), s_scribble(0.22, 16, 131), -15, 0.15)
    q(bt(13.4), s_whistle(0.45, 400, 1400), -15, -0.1, None)
    q(bt(14) - 0.03, s_zip(0.2, 60, 420, 132), -8, 0, None); HLp(bt(14) + 0.01, 133, -8)
    q(bt(14) + 0.22, s_clack(134, 2000), -11, 0.4); q(bt(14.4), s_boing(0.35, 330), -15, 0.4)
    # B4 箭 → 路，裂出一道沟；方块头犹豫，黄毛助跑一跃 → ③ 说干就干
    MORPH(B(4), 140, -10)
    q(bt(16.4), s_thump(0.4, 110, 40, 0.12, 0.5, 141), -8); q(bt(16.4), s_rumble(0.35, 142), -12, 0, None)
    q(bt(16.6), s_bloop(900, 0.6, 0.12, 0.04), -16, -0.3)
    for k in range(4): STEP(bt(17) + k * S16, 143 + k, -12, 0.1 * (k - 1.5))
    q(bt(18), s_whistle(0.45, 500, 1900), -10, 0, None); HLp(bt(18) + 0.01, 147)
    q(bt(19), s_thump(0.45, 160, 40, 0.15, 0.4, 148), -6); q(bt(19) + 0.02, s_poof(149), -9)
    # B5 breakdown：线条缩回去，变成头顶一撮黄毛的小孩；词典卡片
    q(B(5) - 0.04, s_whoosh(0.45, 300, 2600, 0.6, 150), -10, 0, None)
    q(B(5) + 0.1, s_arp([1047, 1319, 1568, 2093], 0.04, 0.1), -13); HLp(B(5) + 0.04, 151, -9)
    q(bt(21), s_flap(152), -8); HLp(bt(22), 153, -8)
    # B6 小孩每拍一个动作：蹦 / “我不！” / 哈哈哈 / 涂鸦
    q(bt(24), s_whistle(0.4, 600, 1800), -12, 0, None); HLp(bt(24) + 0.01, 160, -8)
    q(bt(25), s_bloop(300, 2.8, 0.18, 0.06), -6, 0.3); HLp(bt(25.5), 161)
    for j in range(3): q(bt(26) + j * 0.07, s_pop(700 + 150 * j, 1600 + 200 * j, 0.07, 162 + j), -11, 0.3)
    q(bt(27) + 0.02, s_scribble(0.45, 13, 165), -9, -0.2, None)
    # B7 三把黑刷子一拍一刷；方框越压越紧（吱呀 + 蓄力）
    for i, (n, pan) in enumerate(((28, 0.3), (29, -0.3), (30, 0.3))):
        q(bt(n) - 0.06, s_brush(0.34, 170 + i), -4, pan, None)
        q(bt(n), s_thump(0.25, 120, 50, 0.08, 0.15, 175 + i), -12, pan)
    HLp(bt(28) + 0.02, 174, -9)
    q(bt(29.5), s_thump(0.3, 200, 80, 0.06, 0.3, 178), -10); q(bt(29.5), s_clack(179, 1200), -12)
    q(bt(30.4), s_creak(B(8) - bt(30.4), 25, 90, 700, 180), -12, 0, None)
    q(bt(30), s_riser(B(8) - bt(30), 181), -16, 0, None)
    # B8 DROP：方框炸碎，火苗从胸口冲天而起
    q(B(8), s_boom(1.4, 190), -8, 0, 0.3)
    q(B(8), s_shatter(0.7, 44, 191), -8, 0, None)
    q(B(8) + 0.02, s_ignite(0.9, 200, 2200, 192, 0.4), -6, 0, None)
    q(B(8) + 0.01, s_popper(193), -13, -0.6); q(B(8) + 0.03, s_popper(194), -13, 0.6)
    q(B(8) + 0.05, s_sparkle(0.9, 9, 195, 2800), -12, 0, None)
    q(B(8) + 0.15, s_crackle(1.6, 22, 196, 0.6), -16, 0, None)
    HLp(bt(34), 197, -5); q(bt(34), s_thump(0.3, 150, 60, 0.08, 0.2, 198), -9)
    # B9 火柱弯成船头；海浪、海风；张开双臂喊“世界之王”
    MORPH(B(9), 200, -8, 0.4)
    q(B(9), s_wave(2.1, 201), -15, -0.2, None); q(B(9) + 0.2, s_wind(1.9, 202), -18, 0.2, None)
    SUBt(B(9) + 0.06, 203)
    q(bt(37), s_whoosh(0.25, 800, 5000, 0.7, 204), -11, 0, None); HLp(bt(37) + 0.01, 205)
    q(bt(37.5), s_flap(206), -11, 0.3)
    HLp(bt(38), 207, -5); q(bt(38) + 0.02, s_sparkle(0.6, 7, 208, 3000), -13, 0, None)
    q(bt(38), s_whoosh(0.6, 300, 2000, 0.3, 209), -13, 0, None)
    # B10 浪 → 雨；旧摩托在雨里追摄制组的车；颠一下溅起水花；电闪雷鸣
    q(B(10) - 0.1, s_rain(B(11) - B(10) + 0.3, 210), -14, 0, None)
    MORPH(B(10), 211)
    q(B(10), s_engine(B(11) - B(10) + 0.1, 22, 30, 212, 0.6), -12, 0, None)
    HLp(B(10) + 0.06, 213)
    q(bt(41), s_thump(0.2, 180, 90, 0.05, 0.3, 214), -10); HLp(bt(41) + 0.01, 215, -8)
    q(bt(41) + 0.18, s_splash(216), -8)
    q(bt(42), s_thunder(2.2, 217), -2, 0, 0.4); SUBt(bt(42) + 0.02, 218, -12)
    # B11 旧摩托 → 赛车；2006 → 2026；发车、冲线、夺冠印章
    L0 = bt(46) - 0.25
    MORPH(B(11), 220, -8, 0.35); q(B(11), s_arp([784, 988, 1175, 1568], 0.035, 0.08), -13)
    q(B(11) + 0.1, s_engine(L0 - B(11) - 0.1, 30, 46, 221, 0.4), -12, 0, None)
    q(B(11) + 0.08, s_flap(222), -10, 0.2); HLp(B(11) + 0.06, 223)
    for k, (tk, _) in enumerate(year_ticks()): q(tk, s_clock(3000 + 40 * (k % 5), 230 + k), -15, 0.2)
    q(bt(45.5), s_flap(224), -12, 0.4)
    q(bt(45.75), s_ding(1568, 0.8, 0.8), -9, 0.2)
    q(L0, s_engine(0.6, 60, 150, 225, 0.3, 0.7), -6, 0.3, None); q(L0, s_whoosh(0.5, 300, 5000, 0.5, 226), -8, 0.5, None)
    q(L0, s_whistle(0.25, 600, 1600), -15, -0.1)
    HLp(bt(46) + 0.01, 227, -6); q(bt(46), s_popper(228), -12, 0.4); q(bt(46) + 0.03, s_sparkle(0.6, 7, 229, 3000), -12, 0.3, None)
    q(bt(47), s_stamp(255), -6, 0.2); q(bt(47), s_thump(0.4, 150, 50, 0.12, 0.3, 256), -6)
    # B12 车轮滚成购物车；“不开心假”假条；“准”字章
    q(B(12), s_roll(0.42, 240), -9, -0.3, None)
    q(B(12) + 0.3, s_whoosh(0.28, 400, 4000, 0.6, 241), -10, 0, None); HLp(B(12) + 0.06, 242)
    q(bt(48.5), s_flap(243), -8, 0.2)
    HLp(bt(49) + 0.01, 244); q(bt(49), s_bloop(250, 2.2, 0.2, 0.06), -11, -0.2)
    SUBt(bt(50), 245)
    q(bt(50.5), s_stamp(246), -6, 0.2); q(bt(50.5), s_thump(0.45, 160, 45, 0.14, 0.4, 247), -10)
    # B13 三个人、三种发色、一把火
    for i in range(3): q(B(13) + 0.04 + i * 0.1, s_bloop(260 + 60 * i, 2.4, 0.16, 0.05), -10, PANS3[i])
    HLp(B(13) + 0.06, 250, -8)
    for i in range(3): q(bt(53) + i * E8, s_blip(1047 * 1.26 ** i, 0.16, 1.5), -12, PANS3[i])
    q(bt(54), s_whoosh(bt(55) - bt(54) + 0.05, 300, 3000, 0.85, 251), -9, 0, None); HLp(bt(54) + 0.01, 252, -6)
    q(bt(55), s_ignite(0.7, 250, 2400, 253, 0.5), -4, 0, None); q(bt(55) + 0.02, s_sparkle(0.5, 6, 254, 2800), -13, 0, None)
    # B14 黄毛 ≠ 染发 / 叛逆 / 渣：红笔一拍一个叉
    for i in range(3): q(B(14) + 0.08 + i * 0.08, s_pop(400 + 80 * i, 1200 + 150 * i, 0.1, 260 + i), -10, PANS3[i])
    HLp(B(14) + 0.06, 263)
    for i in range(3): q(bt(57 + i), s_xmark(264 + 2 * i), -4, PANS3[i])
    for i in range(3): q(B(15) + i * 0.04, s_whistle(0.4, 1400, 400), -17, PANS3[i])
    # B15 高台升起（高富帅 + 骰子“命”）；人群胸口的小火苗越闪越快
    q(B(15), s_rumble(0.4, 270), -8, 0, None); q(B(15) + 0.3, s_thump(0.25, 140, 60, 0.08, 0.2, 271), -10)
    HLp(B(15) + 0.06, 272); q(B(15) + 0.4, s_ding(2637, 0.5, 1.2), -15)
    q(bt(61), s_dice((0.0, 0.227, 0.4545), 273), -8, 0.4)
    q(bt(62), s_bloop(200, 2, 0.2, 0.06), -12); HLp(bt(62) + 0.01, 274, -5)
    for k, n in enumerate((62.5, 63, 63.25, 63.5, 63.75)): q(bt(n), s_ignite(0.14, 600 + 120 * k, 3000, 275 + k, 0.1), -14 + 0.8 * k)
    q(bt(62), s_riser(B(16) - bt(62), 280), -14, 0, None)
    # B16 高潮：全场点燃，高帽飞走，高台沉没
    q(B(16), s_boom(1.5, 290), -8, 0, 0.3)
    q(B(16), s_ignite(1.0, 180, 2200, 291, 0.5), -8, 0, None)
    q(B(16) + 0.02, s_pop(300, 900, 0.12, 292), -8, 0.3); q(B(16) + 0.05, s_whistle(0.6, 700, 2000), -14, 0.4, None)
    q(B(16) + 0.03, s_boing(0.4, 240), -12, -0.4); q(B(16) + 0.06, s_boing(0.4, 290), -12, 0.4)
    q(B(16) + 0.1, s_rumble(0.6, 293), -13, 0, None)
    q(B(16) + 0.01, s_popper(294), -12, -0.6); q(B(16) + 0.03, s_popper(295), -12, 0.6)
    q(B(16) + 0.05, s_sparkle(1.0, 10, 296, 2800), -11, 0, None)
    q(B(16) + 0.2, s_crackle(1.8, 26, 297, 0.6), -15, 0, None)
    HLp(bt(65), 298, -5); q(bt(65), s_arp([1047, 1319, 1568, 2093], 0.04, 0.12), -10)
    q(bt(66), s_whoosh(bt(67.5) - bt(66) + 0.1, 300, 2600, 0.8, 299), -10, 0, None)
    # B17 火苗 → 手掌；邀约气泡被一掌推飞，大字“不”
    MORPH(B(17), 300, -8, 0.34)
    q(B(17) + 0.1, s_bloop(420, 2.4, 0.16, 0.05), -8, 0.35); HLp(B(17) + 0.04, 301)
    q(bt(69), s_thump(0.5, 170, 45, 0.16, 0.45, 302), -4); q(bt(69), s_stamp(303), -8)
    q(bt(69) + 0.02, s_whoosh(0.4, 600, 5000, 0.3, 304), -8, 0.4, None)
    # B18 “不”的一横 → 火柴，“嚓”地划燃；进度条第一格“今天”亮起
    MORPH(B(18), 310)
    HLp(B(18) + 0.04, 311); q(B(18) + 0.12, s_flap(312), -11, -0.3)
    q(B(18) + 0.02, s_whoosh(0.2, 800, 4000, 0.6, 313), -14, 0.2)
    q(bt(72.72), s_match(314, bt(73) - bt(72.72)), -3, 0.3, None)
    HLp(bt(73) + 0.01, 315); q(bt(73) + 0.02, s_sparkle(0.45, 6, 316, 3200), -12, 0.3, None)
    q(bt(73.6), s_whoosh(0.5, 300, 2500, 0.6, 317), -16, 0, None)
    q(bt(75), s_blip(1319, 0.24, 1.335), -6, -0.2); q(bt(75) + 0.02, s_sparkle(0.4, 5, 318, 3400), -13, -0.2, None)
    q(bt(73) + 0.1, s_crackle(bt(77) - bt(73), 14, 319, 0.45), -20, 0.2, None)
    # B19 火柴把“我不配”烧掉，变成“我试试”
    for i in range(3): q(B(19) + 0.04 + i * 0.07, s_thump(0.18, 160, 90, 0.05, 0.25, 320 + i), -12)
    HLp(B(19) + 0.04, 323, -9)
    q(bt(76.35), s_whoosh(0.25, 500, 3500, 0.6, 324), -15, 0.3); q(bt(76.75), s_whoosh(0.25, 500, 3500, 0.6, 325), -15, 0.4)
    q(bt(77), s_ignite(0.5, 300, 2500, 326, 0.3), -8, 0.3, None)
    q(bt(77), s_crackle(bt(78.3) - bt(77) + 0.2, 40, 327, 0.6), -11, 0.1, None)
    q(bt(78), s_whoosh(0.3, 400, 2500, 0.4, 328, down=True), -14, 0.5)
    q(bt(78.5), s_pop(500, 1500, 0.12, 329), -5); q(bt(78.5) + 0.03, s_arp([1319, 1568, 2093, 2637], 0.04, 0.1), -10)
    q(bt(78.5) + 0.05, s_sparkle(0.45, 6, 330, 3200), -14, 0, None)
    # B20 两扇门：推开的那扇摔了一跤在笑；关着的门前，人一拍老一截
    MORPH(B(20), 331)
    HLp(B(20) + 0.04, 332); q(B(20) + 0.25, s_creak(0.55, 30, 55, 850, 333), -11, -0.4, None)
    q(B(20) + 0.32, s_bloop(240, 2, 0.16, 0.05), -14, 0.4)
    q(bt(80.75), s_whistle(0.25, 1500, 500), -14, -0.4)
    q(bt(81), s_thump(0.35, 130, 45, 0.1, 0.4, 334), -5, -0.4); q(bt(81) + 0.02, s_poof(335), -10, -0.4)
    HLp(bt(81) + 0.01, 336, -8)
    for i in range(2): q(bt(81.3) + i * 0.08, s_pop(800 + 100 * i, 1700 + 100 * i, 0.07, 337 + i), -12, -0.5)
    SUBt(bt(81.5), 339, -12); SUBt(bt(82), 340, -13)
    for k, n in enumerate((81, 82, 83)):
        q(bt(n), s_clock(2600, 341 + k), -8, 0.4)
        q(bt(n) + 0.02, s_whoosh(0.3, 300, 2000, 0.3, 344 + k, down=True), -15, 0.4)
    q(bt(83) + 0.15, s_bloop(1000, 0.6, 0.12, 0.04), -14, 0.4)
    # B21 胸口的火跳到门上，把门烧开；老人变回少年冲出去
    q(bt(84), s_ignite(0.45, 400, 2800, 350, 0.3), -5, 0.3, None); HLp(B(21) + 0.04, 351, -8)
    q(bt(84.55), s_whoosh(0.3, 500, 4000, 0.7, 352), -10, 0.3, None)
    q(bt(85), s_ignite(0.9, 200, 2200, 353, 0.5), -8, 0.3, None); q(bt(85), s_thump(0.4, 150, 45, 0.12, 0.4, 354), -10)
    q(bt(85) + 0.1, s_crackle(1.0, 30, 355, 0.6), -15, 0.3, None); HLp(bt(85) + 0.01, 356)
    q(bt(85.4), s_boing(0.35, 260), -13, -0.4)
    q(bt(86), s_arp([1047, 1319, 1568, 2093, 2637], 0.035, 0.1), -7, 0.3); q(bt(86), s_pop(400, 1300, 0.1, 357), -9, 0.3)
    SUBt(bt(86) + 0.02, 358)
    q(bt(86) + 0.42, s_clatter(359), -11, 0.4)
    for k in range(5): STEP(bt(86.5) + k * (bt(87.7) - bt(86.5)) / 4, 360 + k, -12, 0.3 - 0.05 * k)
    # B22 一切缩进手机屏幕；屏幕外的观众头顶“噗”地点燃
    q(B(22) - 0.1, s_whoosh(0.55, 300, 2500, 0.5, 370, down=True), -10, 0, None)
    HLp(B(22) + 0.04, 371); q(B(22) + 0.28, s_twoTone(880, 1320), -13, -0.3)
    q(bt(89.2), s_whoosh(0.3, 1500, 7000, 0.7, 372), -10, 0.3); q(bt(89.2), s_sparkle(0.4, 5, 373, 3500), -14, 0.3, None)
    q(bt(90), s_ignite(0.5, 400, 3000, 374, 0.4), -4, 0.4, None); q(bt(90) + 0.01, s_poof(375), -11, 0.4)
    q(bt(90) + 0.05, s_blip(1568, 0.2, 1.335), -8, -0.3); q(bt(90) + 0.05, s_sparkle(0.45, 5, 376, 3200), -14, 0.4, None)
    # B23 火苗 → 箭头指向评论区；“@TA”
    MORPH(B(23), 380, -8, 0.34)
    q(B(23) + 0.12, s_zip(0.25, 80, 300, 381), -12); q(B(23) + 0.15, s_flap(382), -9)
    HLp(B(23) + 0.04, 383); HLp(bt(93), 384, -5)
    for k, n in enumerate((93, 94, 95)): q(bt(n), s_thump(0.2, 200, 90, 0.05, 0.2, 385 + k), -12)
    q(bt(94), s_pop(350, 1100, 0.12, 388), -5); q(bt(94), s_stamp(389), -12)
    for k, n in enumerate((94.5, 95)): q(bt(n), s_key(390 + k), -6)
    q(bt(95) + 0.02, s_sparkle(0.45, 6, 392, 3200), -12, 0, None)
    # B24 全片的火苗收拢成标题“黄毛理论”；一排不同发色的人，胸口都亮着
    q(bt(95.5) - 0.02, s_whoosh(B(24) - bt(95.5) + 0.08, 300, 4000, 0.92, 395), -6, 0, None)
    q(B(24), s_thump(0.6, 170, 42, 0.2, 0.5, 396), -6); q(B(24), s_stamp(397), -9)
    q(B(24) + 0.01, s_popper(398), -12, -0.6); q(B(24) + 0.03, s_popper(399), -12, 0.6)
    q(B(24) + 0.05, s_sparkle(0.9, 9, 400, 2800), -11, 0, None)
    HLp(bt(97), 401, -7)
    for i in range(5): q(bt(97.5) + i * 0.06, s_bloop(260 + 40 * i, 2.2, 0.14, 0.05), -13, (-0.6, -0.3, 0, 0.3, 0.6)[i])
    q(bt(98), s_ding(2093, 1.0, 1.0), -8); q(bt(98) + 0.02, s_sparkle(0.7, 7, 402, 3200), -13, 0, None)
    return C

# 音乐闪避：(时刻, dB, 释放 s, 保持 s)
DUCKS = [(B(1), 2.0, 0.3), (B(8), 4.5, 0.7), (bt(42), 2.0, 0.6), (bt(47), 1.5, 0.3), (bt(50.5), 1.5, 0.3), (B(16), 4.5, 0.7),
         (bt(69), 1.5, 0.3), (bt(73), 1.5, 0.3), (bt(78.5), 1.5, 0.3), (bt(85), 3.0, 0.4), (bt(90), 1.5, 0.3), (B(24), 2.5, 0.5)]

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
    m *= np.cos(fo * np.pi / 2)[:, None]                                       # 52.4 → 53.2 与画面同时淡出
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
    for t0, x, rel, pan, win in cues():
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
