#!/usr/bin/env python3
"""大水理论 · 音效与混音母带

所有音效均为程序合成（numpy / scipy，不使用任何采样），按影片的节拍网格放置，
叠加在用户提供的音乐下（音乐从 0 s 开始，截断至视频长度并淡出），
最后母带处理到约 -12 LUFS、真峰值 ≤ -1 dBTP。

  python3 tools/sfx.py [--music audio/music.mp3] [--out out/audio_master.wav]

每个音效的响度都相对“同一时刻音乐的 K 加权响度”自动校准（rel 列，单位 dB），
所以换音乐后音效依然清晰但不抢戏。
"""
import argparse
import subprocess
from pathlib import Path

import numpy as np
from scipy import signal
from scipy.io import wavfile
from scipy.ndimage import minimum_filter1d, uniform_filter1d

SR = 48000
DUR = 45.2
N = int(round(DUR * SR))
BPM, PH = 112.9, 0.082            # 与 js/film.js 完全一致
BEAT = 60 / BPM
E8, S16 = BEAT / 2, BEAT / 4
def bt(n): return PH + n * BEAT
def B(k): return bt(4 * k)
SLAM = 66 / 30                     # 撞击帧 2.200 s
TM = bt(18)

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

def s_splash(d=1.1, big=1.0, seed=2):                # 水花：带通噪声 + 回落的小水滴 + 低频
    r = np.random.default_rng(seed)
    t = tt(d); n = len(t)
    flutter = 0.6 + 0.4 * norm(lp(r.standard_normal(n), 40))
    env = att(t, 0.004) * (0.75 * np.exp(-t / (0.12 * big)) + 0.25 * np.exp(-t / (0.45 * big)))
    y = bp(r.standard_normal(n), 350, 7000) * env * flutter
    y = norm(y)
    for _ in range(int(10 * big)):
        t0 = r.uniform(0.05, 0.7 * d)
        add(y, s_bloop(r.uniform(350, 1100), r.uniform(1.8, 3.0), 0.1, r.uniform(0.02, 0.04)) * r.uniform(0.15, 0.4) * np.exp(-t0 / 0.4), t0)
    y += 0.5 * big * np.sin(phase(55 + 60 * np.exp(-t / 0.05))) * np.exp(-t / 0.15)
    return norm(y * tail(t, d, 0.05))

def s_crunch(d=0.28, seed=11):                       # 奶茶杯被压扁：塑料碎裂
    r = np.random.default_rng(seed)
    t = tt(d); n = len(t)
    imp = (r.random(n) < 0.02 * np.exp(-t / 0.06)) * r.standard_normal(n)
    y = bp(np.convolve(imp, np.exp(-np.arange(120) / 25.0))[:n], 700, 7000)
    y += 0.5 * bp(r.standard_normal(n), 1500, 6000) * np.exp(-t / 0.02)
    return norm(y * att(t, 0.001))

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

def s_glitch(f=880, seed=5):                         # 大脑“掉线”：断续方波 + 降采样
    t = tt(0.24)
    ff = np.where(t < 0.1, f, f * 0.5 * (1 - 0.3 * np.clip((t - 0.1) / 0.14, 0, 1)))
    y = 0.7 * signal.square(phase(ff)) + 0.3 * signal.square(phase(ff * 1.5))
    gate = ((t < 0.035) | ((t > 0.05) & (t < 0.085)) | (t > 0.1)).astype(float)
    y = y * gate * np.where(t > 0.1, np.exp(-(t - 0.1) / 0.05), 1.0)
    y = np.round(y * 3) / 3
    y = np.repeat(y[::6], 6)[: len(t)]
    return norm(lp(y, 6000) * tail(t, 0.24, 0.01))

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

def s_gulp(seed=8):                                  # 咕咚（喝一口）
    t = tt(0.22)
    f = 120 + 240 * np.exp(-t / 0.025)
    env = att(t, 0.006) * np.exp(-t / 0.05)
    y = np.sin(phase(f)) * env + 0.5 * lp(noise(len(t), seed), 700) * env
    add(y, 0.35 * s_bloop(420, 2.2, 0.09, 0.025), 0.07)
    return norm(y)

def s_bonk(f=196):                                   # 警告“嗡”
    t = tt(0.26)
    y = signal.sawtooth(2 * np.pi * f * t) + signal.sawtooth(2 * np.pi * f * 1.012 * t) + 0.5 * np.sin(np.pi * f * t)
    y = norm(lp(y, 1400)) * att(t, 0.004) * np.exp(-t / 0.09)
    add(y, 0.5 * s_thump(0.25, 140, 70, 0.07, 0.1), 0)
    return norm(y)

def s_cap(seed=9):                                   # 瓶盖崩开 + 气泡嘶嘶
    r = np.random.default_rng(seed)
    t = tt(1.4); n = len(t)
    y = np.zeros(n)
    add(y, s_pop(1700, 600, 0.06, seed), 0)
    add(y, 0.6 * bp(r.standard_normal(int(0.012 * SR)), 1000, 4000), 0)
    crack = (r.random(n) < 0.006) * r.standard_normal(n)
    fizz = hp(np.convolve(crack, np.exp(-np.arange(60) / 10.0))[:n], 4000) + 0.25 * hp(r.standard_normal(n), 6000)
    y += 0.35 * norm(fizz) * att(t, 0.02) * np.exp(-t / 0.5)
    return norm(y * tail(t, 1.4, 0.05))

def s_drain(d=0.9, seed=10):                         # 退水的咕噜声
    r = np.random.default_rng(seed)
    t = tt(d); u = t / d
    y = sweep_noise(d, lambda tm: 1600 * (250 / 1600) ** np.clip(tm / d, 0, 1), 0.5, seed)
    y = y * (0.6 + 0.4 * np.sin(2 * np.pi * 9 * t)) * np.sin(np.pi * np.clip(u, 0, 1)) ** 0.7
    for k in range(12):
        t0 = r.uniform(0.02, d * 0.85)
        add(y, 0.5 * s_bloop(700 - 450 * t0 / d + r.uniform(-60, 60), r.uniform(1.6, 2.4), 0.1, 0.03), t0)
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

def s_fill(d=0.9, seed=15):                          # 身体里的水位上涨
    r = np.random.default_rng(seed)
    t = tt(d); u = t / d
    y = sweep_noise(d, lambda tm: 250 * (1400 / 250) ** np.clip(tm / d, 0, 1), 0.45, seed)
    y = y * att(t, 0.12) * tail(t, d, 0.25) * 0.6
    for k in range(9):
        t0 = (k + r.uniform(0, 0.6)) * d / 10
        add(y, 0.5 * s_bloop(260 + 500 * t0 / d, 2.2, 0.12, 0.035), t0)
    return norm(y)

def s_fizz(d, seed=16):                              # 倒饮料的气泡底噪
    r = np.random.default_rng(seed)
    t = tt(d); n = len(t)
    crack = (r.random(n) < 0.01) * r.standard_normal(n)
    y = hp(np.convolve(crack, np.exp(-np.arange(50) / 8.0))[:n], 3000) + 0.3 * bp(r.standard_normal(n), 2500, 9000)
    return norm(y * att(t, 0.15) * tail(t, d, 0.3))

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

# ------------------------------------------------------------------ cue sheet
def cues():
    C = []  # (time, sound, rel_dB, pan, win)  win=None → 整段 RMS
    def q(t, x, rel, pan=0.0, win=0.25): C.append((t, x, rel, pan, win))
    HLp = lambda t, s=0: q(t, s_pop(520, 1500, 0.09, s), -6)
    SUBt = lambda t, s=0: q(t, s_tick(1500, s), -11)
    # S1 hook 0 – B2
    q(0.0, s_pop(420, 1200, 0.12, 1), -3)                                  # 奶茶杯弹出
    for i in range(5): q(0.02 + i * 0.05, s_pop(600 + 60 * i, 1500 + 80 * i, 0.07, 10 + i), -9, (i - 2) * 0.18)  # 弱者喝饮料
    q(1.70, s_whistle(SLAM - 1.70, 1900, 430), -5, 0, None)                # 大瓶水从天而降
    q(SLAM, s_thump(0.7, 160, 40, 0.22, 0.4), +1.5)
    q(SLAM, s_crunch(), -4)
    q(SLAM + 0.01, s_splash(1.2, 1.2, 21), -1.5)
    for i in range(5): q(SLAM + 0.1 + i * 0.05, s_pop(650 + 70 * i, 1600 + 90 * i, 0.07, 20 + i), -8, (i - 2) * 0.18)  # 强者喝大水
    q(B(2) - 0.42 * 0.8, s_whoosh(0.42, 300, 4200, 0.8, 31), -6, 0, None)   # 推镜转场
    # S2 title B2 – B3: 4 个字落下各一个水滴
    for i in range(4): q(B(2) + i * E8, s_bloop(260 * 1.12 ** i, 2.6, 0.18, 0.055), -2, (i - 1.5) * 0.3)
    SUBt(bt(10) + E8, 1); SUBt(bt(11) + E8, 2)
    q(bt(11) + 0.07, s_stamp(), -1, -0.35)                                  # 全网爆火 盖章
    q(B(3) - 0.3, s_whoosh(0.36, 400, 3600, 0.75, 32), -6, 0, None)
    # S3 question B3 – B4
    HLp(bt(12) + E8, 3); HLp(bt(14), 4)
    q(bt(13) - 0.28, s_whistle(0.28, 1500, 700), -9, 0, None)              # 水滴落成“？”的点
    q(bt(13), s_boing(0.5, 210), -2)
    # S4 splash B4 – TM: 跳起翻转后扎进水线
    q(B(4), s_whistle(bt(17) - B(4), 520, 480, 1500), -7, 0, None)
    q(bt(17), s_bloop(240, 3.0, 0.22, 0.07), -1)
    q(bt(17) + 0.01, s_splash(0.8, 0.7, 41), -4)
    q(TM - 0.3, s_whoosh(0.36, 300, 3000, 0.8, 33), -7, 0, None)           # 波纹 → 人体
    HLp(TM, 5)
    # S5 body
    q(B(5), s_fill(0.9), -8, 0, None)
    HLp(B(5) + E8, 6)
    q(bt(22), s_pop(800, 1900, 0.08, 7), -6, -0.4)                          # 60% 括号
    # S6 brain
    q(B(6) - 0.3, s_whoosh(0.36, 300, 3200, 0.8, 34), -7, 0, None)
    HLp(B(6) + E8, 8)
    q(B(6) + 0.25, s_twoTone(), -8, 0.3)
    for i, f in enumerate([880, 740, 587]): q(bt(25 + i), s_glitch(f, 50 + i), -3, 0.3)
    HLp(bt(25), 9); SUBt(bt(26) + E8, 3)
    q(bt(27) + 0.12, s_arp([2349, 2794, 3136, 2794, 2349, 2794, 3136], 0.05, 0.06), -12, 0, None)  # 晕眩星星
    # S7 thirst → 蓄力 → S8 洪水 DROP
    q(B(7) - 0.3, s_whoosh(0.36, 300, 3200, 0.8, 35), -7, 0, None)
    HLp(B(7) + E8, 10); HLp(bt(29) + E8, 11)
    q(16.0, s_riser(B(8) - 16.0), -3, 0, None)
    q(B(8), s_thump(0.9, 140, 36, 0.3, 0.3, 2), +0.5)
    q(B(8), s_splash(1.6, 1.6, 81), +0.5)
    HLp(B(8) + E8, 12); HLp(bt(34), 13)
    q(18.96 - 0.1, s_drain(0.85, 82), -3, 0, None)                         # 退水
    # S9 amount B9 – B10
    HLp(B(9), 14); q(bt(37), s_pop(420, 1300, 0.12, 15), -3); HLp(bt(37) + 0.3, 16); SUBt(bt(38), 4)
    GX = [255, 445, 635, 825, 255, 445, 635, 825]
    for i in range(8): q(bt(37) + E8 + i * S16, s_pop(700 + 45 * i, 1700 + 90 * i, 0.07, 30 + i), -6, (GX[i] - 540) / 540 * 0.6)
    q(B(10) - 0.06, s_pop(300, 900, 0.12, 39), -6)                          # 大瓶出现
    for r in range(8): q(B(10) + r * S16 + 0.3, s_bloop(230 * 1.07 ** r, 2.4, 0.14, 0.045), -4)  # 一杯杯倒进瓶子，音高逐渐升高
    # S10/11 一瓶大水
    q(bt(42), s_pop(380, 1200, 0.12, 40), -4); SUBt(bt(43), 5)
    # S12 progress B11 – B12
    q(B(11) - 0.3, s_whoosh(0.36, 300, 3400, 0.8, 36), -7, 0, None)
    HLp(bt(45), 17)
    for i in range(4): q(bt(44.5 + i), s_blip(784 * 1.122 ** i * (1.06 if i == 3 else 1), 0.24), -4)
    # S13 sugar B12 – B14
    q(B(12) - 0.3, s_whoosh(0.36, 300, 3400, 0.8, 37), -7, 0, None)
    HLp(B(12) + E8, 18)
    q(bt(49) - 0.22, s_fizz(bt(49) + 11 * E8 + 0.6 - (bt(49) - 0.22)), -14, -0.3, None)
    for j in range(12):
        tj = bt(49) + j * E8
        q(tj, s_bloop(190, 1.8, 0.1, 0.03), -10, -0.3)                      # 饮料“咕”一下吐出方糖
        q(tj + 0.38, s_clack(60 + j, 2100 * 2 ** (np.random.default_rng(60 + j).uniform(-0.15, 0.15))), -6.5, 0.35)
    SUBt(bt(53), 6)
    # S14 days B14 – B15
    q(B(14) - 0.25, s_whoosh(0.32, 400, 3800, 0.8, 38), -7, 0, None)
    HLp(B(14) + E8, 19); q(B(14) + E8, s_flap(71), -5, -0.45)
    q(bt(57), s_pop(420, 1300, 0.12, 20), -3); q(bt(57), s_flap(72), -5, 0.45); SUBt(bt(58), 7)
    # S15 swap B15 – B16
    q(B(15), s_arp([1046, 1318, 1568, 2093, 2637, 3136], 0.035, 0.09), -6, 0, None)  # 方糖 → 水滴
    q(B(15) - 0.05, s_whoosh(0.3, 600, 5000, 0.6, 39), -10, 0, None)
    HLp(B(15) + E8, 21)
    for r in range(12): q(B(15) + 0.25 + r * S16 + 0.3, s_bloop(300 * 1.05 ** r, 2.4, 0.13, 0.04), -5)
    for i, tb in enumerate([bt(61), bt(62), bt(63)]):
        q(tb, s_pop(500, 1500, 0.1, 50 + i), -3, (i - 1) * 0.5)
        q(tb, s_sparkle(0.6, 4, 52 + i, 3000), -9, 0, None)
    q(bt(63), s_riser(B(16) - bt(63), 5), -6, 0, None)                    # 瓶子颤抖蓄力
    # S16 hero B16
    q(B(16), s_cap(), -2)
    q(B(16), s_thump(0.8, 150, 38, 0.26, 0.3, 3), -0.5)
    q(B(16) + 0.01, s_splash(1.4, 1.4, 91), -0.5)
    q(B(16) + 0.3, s_sparkle(0.9, 9, 92, 2600), -5, 0, None)
    HLp(B(16) + E8, 22); HLp(bt(65), 23)
    q(bt(65), s_sparkle(0.6, 5, 93, 3200), -8, 0, None)
    q(bt(66), s_ding(1568, 1.6), -2)                                       # 皇冠
    q(B(17) - 0.1, s_drain(0.7, 94), -3, 0, None)
    # S17 tip1 B17 – B18
    SUBt(bt(69), 8)
    for i in range(3): q(bt(69 + i), s_gulp(100 + i), -3)
    # S18 tip2 B18 – B19
    q(B(18), s_pop(300, 900, 0.14, 41), -5)
    for i in range(3): q(bt(73 + i), s_bonk(196), -4.5)
    SUBt(bt(73) + E8, 9)
    # S19 end B19 –
    q(B(19) - 0.3, s_whoosh(0.36, 300, 3200, 0.8, 40), -7, 0, None)
    HLp(B(19) + E8, 24); HLp(bt(77), 25); q(bt(77), s_bloop(300, 2.6, 0.18, 0.05), -4)
    HLp(bt(79) + 0.06, 26)
    q(B(20), s_tick(2400, 27), -4); q(B(20) + 0.04, s_ding(2093, 0.9, 0.6), -4)   # 打卡 ✓
    q(bt(81) - 0.2, s_whoosh(0.3, 800, 5000, 0.7, 41), -5, 0.5, None)       # 箭头指向评论区
    q(B(21), s_ding(2637, 1.0, 1.2), -3); q(B(21), s_sparkle(0.6, 5, 95, 3400), -9, 0, None)  # 眨眼
    return C

DUCKS = [(SLAM, 4.0, 0.5), (B(8), 4.5, 0.7), (B(16), 4.5, 0.7), (bt(11) + 0.07, 1.5, 0.25), (bt(66), 1.5, 0.4), (B(21), 1.5, 0.4)]

# ------------------------------------------------------------------ main
def load_music(path):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', str(path), '-t', f'{DUR + 0.5}', '-f', 'f32le', '-ac', '2', '-ar', str(SR), '-'],
                         check=True, capture_output=True).stdout
    m = np.frombuffer(raw, np.float32).reshape(-1, 2).astype(np.float64)
    if len(m) < N: m = np.vstack([m, np.zeros((N - len(m), 2))])
    m = m[:N].copy()
    t = np.arange(N) / SR
    m *= att(t, 0.005)[:, None]                                               # 防爆音
    fo = np.clip((t - 44.4) / (DUR - 44.4), 0, 1)
    m *= np.cos(fo * np.pi / 2)[:, None]                                       # 44.4 → 45.2 淡出
    return m

def main():
    ap = argparse.ArgumentParser()
    root = Path(__file__).resolve().parent.parent
    ap.add_argument('--music', default=str(root / 'audio' / 'music.mp3'))
    ap.add_argument('--out', default=str(root / 'out' / 'audio_master.wav'))
    ap.add_argument('--target', type=float, default=-12.0)
    a = ap.parse_args()

    music = load_music(a.music)
    L_music = lufs(music)
    music *= 10 ** ((-14 - L_music) / 20)                                     # 先把音乐统一到 -14 LUFS 再配音效
    mk = k_weight(music).sum(axis=1) / 2
    floor = np.sqrt(np.mean(mk ** 2)) * 10 ** (-8 / 20)

    t = np.arange(N) / SR
    duck = np.ones(N)
    for t0, db, rel in DUCKS:
        u = t - t0
        e = np.where(u < -0.015, 0, np.where(u < 0, (u + 0.015) / 0.015, np.where(u < 0.12, 1, np.exp(-(u - 0.12) / (rel / 3)))))
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
        y, gain = limiter(mix * 10 ** (g_db / 20))
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
