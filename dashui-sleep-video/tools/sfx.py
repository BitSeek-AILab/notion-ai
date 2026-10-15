#!/usr/bin/env python3
"""大睡理论 · 音效与混音母带

所有音效均为程序合成（numpy / scipy，不使用任何采样），按影片的节拍网格放置，
叠加在用户提供的音乐下（音乐从 0 s 开始，截断至视频长度并淡出），
最后母带处理到约 -12 LUFS、真峰值 ≤ -1 dBTP（wav 限幅到 -2 dBTP，AAC 编码后仍 ≤ -1）。

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
DUR = 45.5
N = int(round(DUR * SR))
BPM, PH = 112.9, 0.082            # 与 js/film.js 完全一致
BEAT = 60 / BPM
E8, S16 = BEAT / 2, BEAT / 4
def bt(n): return PH + n * BEAT
def B(k): return bt(4 * k)
SLAM = 66 / 30                     # 枕头砸下的撞击帧 2.200 s

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

def s_blip(f=988, d=0.24, up=1.335):                 # 进度条“叮”（两段式金币音）
    t = tt(d)
    ff = np.where(t < 0.05, f, f * up)
    y = lp(signal.square(phase(ff), 0.35), 4500) * att(t, 0.002) * np.where(t < 0.05, 1, np.exp(-(t - 0.05) / 0.07))
    return norm(y)

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

# ---- 本片新增音效（F 小调：F Ab Bb C Eb，与音乐同调）
NOTE = dict(F5=698.46, Ab5=830.61, Bb5=932.33, C6=1046.50, Eb6=1244.51, F6=1396.91, Ab6=1661.22, Bb6=1864.66, C7=2093.00, Eb7=2489.02, F7=2793.83)

def s_notif(f0=1396.91, f1=1864.66):                 # 手机消息“叮咚”
    y = np.zeros(int(0.26 * SR))
    for f, t0 in ((f0, 0.0), (f1, 0.075)):
        t = tt(0.17)
        add(y, (np.sin(2 * np.pi * f * t) + 0.25 * np.sin(4 * np.pi * f * t)) * np.exp(-t / 0.055) * att(t, 0.002), t0)
    return norm(y)

def s_click(seed=0, f=2600, d=0.035):                # 开关“咔”
    t = tt(d)
    y = bp(noise(len(t), seed), f * 0.6, min(f * 2.4, 20000)) * np.exp(-t / 0.004)
    y += 0.6 * np.sin(2 * np.pi * 820 * t) * np.exp(-t / 0.012)
    return norm(y)

def s_cord(seed=0):                                  # 拉灯绳：咔—哒
    y = np.zeros(int(0.16 * SR))
    add(y, s_click(seed, 2300), 0.0); add(y, 0.55 * s_click(seed + 1, 3400), 0.075)
    return norm(y)

def s_poof(d=0.45, seed=0):                          # 枕头砸下的“噗”
    t = tt(d)
    y = lp(noise(len(t), seed), 900) * np.exp(-t / 0.09) * att(t, 0.004)
    y += 0.35 * bp(noise(len(t), seed + 1), 900, 3500) * np.exp(-t / 0.04)
    return norm(y)

def s_hiccup(f=420, seed=0):                         # 嗝
    d = 0.17; t = tt(d)
    ft = f * (1 + 0.8 * np.clip(t / 0.045, 0, 1)) * np.exp(-1.5 * t)
    src = signal.sawtooth(phase(ft)) * np.exp(-np.maximum(t - 0.035, 0) / 0.035) * att(t, 0.004)
    y = bp(src, 450, 2600) + 0.25 * bp(noise(len(t), seed), 1500, 4500) * np.exp(-t / 0.02)
    return norm(y)

def s_tock(f=2000, seed=0):                          # 钟表“滴答”
    t = tt(0.05)
    y = bp(noise(len(t), seed), f * 0.7, f * 1.6) * np.exp(-t / 0.005) + 0.6 * np.sin(2 * np.pi * f * t) * np.exp(-t / 0.009)
    return norm(y)

def s_alarm(d=0.34):                                 # 闹钟铃“叮铃铃”
    t = tt(d); y = np.zeros(len(t)); rate = 30
    for k in range(int(d * rate)):
        tl = tt(0.1)
        p = sum(a * np.sin(2 * np.pi * f * tl) for f, a in ((2093.0, 1.0), (2793.8, 0.55), (4186.0, 0.3), (5587.7, 0.18))) * np.exp(-tl / 0.028)
        add(y, p * (0.8 if k % 2 else 1.0), k / rate)
    return norm(y * tail(t, d, 0.05))

def s_crack(seed=0):                                 # 玻璃裂纹“咔嚓”
    d = 0.3; t = tt(d); r = np.random.default_rng(seed)
    y = hp(noise(len(t), seed), 3000) * np.exp(-t / 0.012)
    imp = np.zeros(len(t))
    for _ in range(16): imp[int(r.uniform(0, 0.17) * SR)] += r.uniform(0.3, 1.0) * r.choice([-1, 1])
    y += 3 * hp(signal.lfilter([1], [1, -0.6], imp), 2500)
    y += 0.5 * sum(a * np.sin(2 * np.pi * f * t) * np.exp(-t / 0.06) for f, a in ((4186, 0.4), (5274, 0.3), (6645, 0.2)))
    return norm(y)

def s_shatter(d=1.1, seed=0):                        # 防护盾碎裂“哗啦”
    t = tt(d); r = np.random.default_rng(seed)
    y = hp(noise(len(t), seed), 1800) * np.exp(-t / 0.13) * att(t, 0.002)
    for _ in range(30):
        t0 = 0.8 * r.uniform() ** 1.6; tl = tt(0.12)
        add(y, np.sin(2 * np.pi * r.uniform(2500, 7500) * tl) * np.exp(-tl / r.uniform(0.02, 0.05)) * r.uniform(0.2, 0.6), t0)
    y += 0.7 * lp(noise(len(t), seed + 7), 380) * np.exp(-t / 0.07)
    return norm(y)

def s_unshatter(seed=0, d=0.34):                     # 碎片倒放飞回
    x = s_shatter(0.9, seed)[: int(d * SR)][::-1].copy()
    return norm(x * att(np.arange(len(x)) / SR, 0.06))

def s_lowbat(f=523.25):                              # 低电量“嘟”
    d = 0.15; t = tt(d)
    y = 0.4 * signal.square(2 * np.pi * f * t) + np.sin(2 * np.pi * f * t)
    return norm(lp(y, 2600) * np.exp(-t / 0.07) * att(t, 0.003) * tail(t, d, 0.02))

def s_zap(d=0.36, seed=0):                           # 闪电“滋啦”
    t = tt(d); r = np.random.default_rng(seed)
    buzz = bp(signal.sawtooth(2 * np.pi * 110 * t + 4 * np.sin(2 * np.pi * 37 * t)), 200, 5000)
    imp = np.zeros(len(t))
    for _ in range(40): imp[int(r.uniform(0, d * 0.9) * SR)] += r.uniform(0.4, 1.0) * r.choice([-1, 1])
    crack = hp(signal.lfilter([1], [1, -0.85], imp), 1800)
    y = (0.55 * norm(buzz) + norm(crack)) * np.exp(-t / 0.14) * att(t, 0.002)
    return norm(y)

def s_squeak(f=1250, d=0.17):                        # 橡皮鸭“吱”
    t = tt(d); u = np.clip(t / d, 0, 1)
    ft = f * (1 + 0.3 * np.sin(np.pi * u)) + 45 * np.sin(2 * np.pi * 26 * t)
    y = np.sin(phase(ft)) + 0.45 * np.sin(2 * phase(ft))
    return norm(bp(y, 600, 6000) * np.sin(np.pi * u) ** 0.6)

def s_powerdown(f0=1300, f1=170, d=0.24):            # 屏幕熄灭“咻—”
    t = tt(d); ft = f0 * (f1 / f0) ** (t / d)
    return norm(lp(np.sin(phase(ft)) * np.exp(-t / 0.12) * att(t, 0.003), 4000))

def s_morph(f0=300, f1=900, d=0.26, seed=0):         # 形状变形：橡皮“啵呜”
    t = tt(d); u = t / d
    ft = f0 * (f1 / f0) ** (u ** 1.4) * (1 + 0.035 * np.sin(2 * np.pi * 15 * t))
    y = np.sin(phase(ft)) * np.sin(np.pi * u) ** 0.8
    y += 0.22 * bp(noise(len(t), seed), 700, 5000) * np.sin(np.pi * u) ** 2
    return norm(y)

def s_pluck(f, d=0.3):                               # 数字计数“叮”
    t = tt(d)
    y = (np.sin(2 * np.pi * f * t) + 0.3 * np.sin(4 * np.pi * f * t) + 0.12 * np.sin(6 * np.pi * f * t)) * np.exp(-t / 0.07) * att(t, 0.002)
    return norm(y)

def s_zz(f=780, seed=0):                             # 打呼的“Z”：软软的下滑音
    d = 0.22; t = tt(d); ft = f * (0.7 ** (t / d))
    y = np.sin(phase(ft)) * np.sin(np.pi * np.clip(t / d, 0, 1)) ** 1.5
    y += 0.15 * bp(noise(len(t), seed), 2000, 6000) * np.sin(np.pi * np.clip(t / d, 0, 1))
    return norm(y)

def s_scribble(d, seed=0):                           # 画笔在纸上“沙沙”
    t = tt(d); r = np.random.default_rng(seed)
    y = bp(noise(len(t), seed), 1500, 7000)
    am = 0.55 + 0.45 * np.sin(2 * np.pi * (7 + 3 * r.uniform()) * t + 2 * np.sin(2 * np.pi * 2.3 * t))
    return norm(y * am * att(t, 0.02) * tail(t, d, 0.04))

def s_wave(d=0.62, seed=0):                          # 脑脊液冲刷“哗—”
    t = tt(d); u = t / d; r = np.random.default_rng(seed)
    y = sweep_noise(d, lambda tm: 450 * (2600 / 450) ** np.sin(np.pi * np.clip(tm / d, 0, 1) * 0.9), 0.6, seed)
    y = y * np.sin(np.pi * np.clip(u, 0, 1)) ** 0.9 * (0.75 + 0.25 * np.sin(2 * np.pi * 6 * t))
    for k in range(6): add(y, 0.35 * s_bloop(r.uniform(380, 900), r.uniform(1.6, 2.4), 0.1, 0.03), r.uniform(0.05, d * 0.8))
    return norm(y)

def s_swell(d=0.9, seed=0):                          # 日出“嗡—”的明亮和弦（Ab 大三和弦，F 小调关系大调）
    t = tt(d)
    y = sum(np.sin(2 * np.pi * f * t + 0.3 * np.sin(2 * np.pi * 5 * t)) * a for f, a in ((415.30, 0.7), (523.25, 0.6), (622.25, 0.5), (830.61, 0.4), (1046.5, 0.25)))
    y = lp(y, 5000) * np.minimum(1, t / 0.05) * np.exp(-t / 0.45)
    y = norm(y); sp = s_sparkle(d, 8, seed, 3000).mean(axis=1); m = min(len(sp), len(y)); y[:m] += 0.25 * sp[:m]
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

# ------------------------------------------------------------------ cue sheet
def cues():
    C = []  # (time, sound, rel_dB, pan, win)  win=None → 整段 RMS
    def q(t, x, rel, pan=0.0, win=0.25): C.append((t, x, rel, pan, win))
    n = NOTE
    HLp = lambda t, s=0, f=1500: q(t, s_pop(520, f, 0.09, s), -6)
    SUBt = lambda t, s=0: q(t, s_tick(1500, s), -11)
    MORPH = lambda t, f0, f1, s, d=0.26: q(t, s_morph(f0, f1, d, s), -6, 0, None)
    # S1 hook 0 – B2：弱者熬夜 → 枕头砸下 → 强者大睡
    q(0.0, s_pop(420, 1200, 0.12, 1), -3)                                     # 手机弹出
    for i, (tb, pan, f0, f1) in enumerate([(bt(1), -0.3, n['F6'], n['Ab6']), (bt(2), 0.3, n['Ab6'], n['C7']), (bt(3), -0.3, n['C7'], n['Eb7'])]):
        q(tb, s_notif(f0, f1), -4, pan)                                        # 消息通知 ×3（踩拍）
    q(1.82, s_pop(700, 2100, 0.1, 5), -4, 0.35)                                # “!”
    q(1.62, s_whistle(SLAM - 1.62, 1900, 430), -5, 0, None)                   # 枕头从天而降
    q(SLAM, s_thump(0.7, 160, 40, 0.22, 0.4), 0)
    q(SLAM, s_poof(0.5, 21), -2)
    q(SLAM, s_crunch(0.22, 22), -9)                                            # 手机被压扁
    for i in range(4): q(SLAM + 0.1 + i * 0.05, s_pop(600 + 90 * i, 1500 + 120 * i, 0.08, 20 + i), -7, (i - 1.5) * 0.2)
    q(bt(5), s_whoosh(0.24, 900, 5200, 0.55, 23), -11, 0, None)               # 马克笔划线
    q(bt(6), s_ding(n['F6'], 1.3), -2); q(bt(6), s_sparkle(0.6, 5, 24, 3000), -9, 0, None)   # 皇冠
    MORPH(B(2) - 0.2, 320, 880, 25)                                            # 枕头 → 云朵
    # S2 title B2 – B3：大睡理论
    for i, f in enumerate([n['F5'], n['Ab5'], n['Bb5'], n['C6']]): q(B(2) + i * E8, s_bloop(f / 2.2, 2.2, 0.17, 0.055), -2, (i - 1.5) * 0.3)
    q(bt(10), s_sparkle(0.6, 5, 26, 3200), -8, 0.4, None)                     # 月亮
    SUBt(bt(10) + E8, 1); SUBt(bt(11) + E8, 2)
    q(bt(11), s_stamp(), -1, -0.35)                                            # 热搜同款 盖章
    MORPH(B(3) - 0.05, 700, 300, 27)                                           # 云 → ？
    # S3 question B3 – B4
    HLp(bt(12) + E8, 3); HLp(bt(14), 4)
    q(bt(13) - 0.26, s_whistle(0.26, 1500, 700), -9, 0, None)                 # 小脑袋掉下
    q(bt(13), s_boing(0.5, 220), -2)
    MORPH(B(4) - 0.05, 300, 800, 28)                                           # ？ → 闹钟
    # S4 clock B4 – B5：通宵 24 小时
    HLp(B(4) + 0.05, 5)
    for k in range(8): q(B(4) + k * E8, s_tock(2300 if k % 2 == 0 else 1700, 30 + k), -5, 0.15 * (1 if k % 2 else -1))
    q(B(4) + 7 * E8, s_alarm(0.32), -2)
    MORPH(B(5) - 0.05, 800, 380, 29)                                           # 闹钟 → 大脑
    # S5 drunk B5 – B6：≈ 喝醉了
    HLp(B(5) + 0.05, 6)
    q(B(5) + 0.3, s_arp([n['C7'], n['Eb7'], n['F7'], n['Eb7'], n['C7'], n['Eb7'], n['F7']], 0.05, 0.06), -13, 0, None)  # 晕眩星星
    q(bt(21), s_pop(300, 900, 0.14, 7), -4, 0.4); q(bt(21) + 0.06, s_clack(61, 2400), -7, 0.4)  # 啤酒杯
    q(bt(21) + E8, s_hiccup(420, 8), -1, -0.1); q(bt(22) + E8, s_hiccup(470, 9), -2, 0.1)      # 嗝 ×2
    HLp(bt(21) + E8 + 0.06, 9)
    SUBt(bt(22), 3); SUBt(bt(22) + E8, 4)
    q(bt(22), s_whoosh(0.3, 5000, 1500, 0.3, 40, down=True), -16, 0.7, None)  # 灯绳落下
    # 关灯 B6
    q(B(6) - 0.02, s_cord(41), -5, 0.7)
    q(B(6), s_thump(0.35, 120, 50, 0.1, 0.2, 42), -8)
    # S6 night B6 – B8
    q(B(6) + 0.04, s_morph(500, 1300, 0.34, 43), -9, 0, None); q(B(6) + 0.3, s_sparkle(0.6, 5, 44, 3000), -9, 0.4, None)  # 啤酒杯 → 月亮
    q(B(6) + E8, s_whoosh(0.32, 1600, 300, 0.35, 45, down=True), -9, 0, None)  # 盖被子
    HLp(B(6) + E8, 10)
    q(bt(25), s_pop(500, 1400, 0.1, 46), -6)                                   # 睡帽
    for i in range(4): q(bt(24 + i), s_sparkle(0.35, 2, 47 + i, 3600), -13, (-0.6, 0.6, -0.4, 0.5)[i], None)
    for i, tb in enumerate([bt(25), bt(26), bt(27), bt(29), bt(30), bt(31)]): q(tb, s_zz(820 - 40 * (i % 3), 50 + i), -13, 0.35)
    HLp(B(7) + 0.05, 11); HLp(bt(29), 12)
    q(B(7) + 0.2, s_riser(B(8) - B(7) - 0.2, 5), -5, 0, None)                  # 水位上涨蓄力
    q(B(8) - 0.3, s_whoosh(0.3, 300, 3200, 0.9, 51), -6, 0, None)
    # DROP B8：大浪拍下
    q(B(8), s_thump(0.9, 140, 36, 0.3, 0.3, 2), -1)
    q(B(8), s_splash(1.6, 1.6, 81), -1)
    q(B(8) + 0.12, s_drain(0.6, 82), -6, 0, None)
    # S7 bath B8 – B10
    HLp(B(8) + 0.06, 13); HLp(bt(33), 14, 1800)
    for i, tb in enumerate([bt(33), bt(34), bt(35)]): q(tb, s_splash(0.45, 0.45, 60 + i), -7, (300 + 240 * i - 540) / 540 * 0.6)
    q(bt(35) + E8, s_squeak(1250), -5, 0.5)                                    # 小黄鸭
    for i in range(6): q(bt(36) + i * 0.04, s_bloop(170 + 25 * i, 1.5, 0.09, 0.025), -9, -0.2)   # 垃圾冒出来
    q(bt(36) + E8, s_tick(1500, 63), -10, -0.5)
    for j, tb in enumerate([bt(37), bt(38), bt(39)]): q(tb - 0.04, s_wave(0.62, 64 + j), -3, -0.3 + 0.3 * j, None)  # 一波波冲刷
    SUBt(bt(37) + 0.05, 5); SUBt(bt(37) + E8, 6)
    MORPH(B(10) - 0.05, 300, 900, 66)                                          # 浴缸 → 进度条
    # S8 save B10 – B11
    HLp(B(10) + 0.05, 15); HLp(bt(41), 16)
    for i, f in enumerate([n['C6'], n['Eb6'], n['F6']]):
        q(bt(41 + i) - 0.18, s_whoosh(0.2, 600, 4000, 0.8, 67 + i), -12, (-0.6, 0.6, -0.6)[i], None)
        q(bt(41 + i), s_blip(f, 0.24, 1.335), -4, (-0.3, 0.3, -0.3)[i])
    q(bt(43) + E8, s_arp([n['C6'], n['Eb6'], n['F6'], n['Ab6'], n['C7']], 0.04, 0.08), -7, 0, None)   # 存盘完成
    MORPH(B(11) - 0.05, 600, 300, 70, 0.18)
    # S9 cycles B11 – B12
    HLp(B(11) + 0.05, 17); HLp(bt(45), 18)
    q(B(11) + 0.12, s_scribble(5 * E8 - 0.1, 71), -14, 0, None)                # 画笔画曲线
    for k, f in enumerate([n['F5'], n['Ab5'], n['Bb5'], n['C6'], n['Eb6']]): q(B(11) + (k + 1) * E8, s_pluck(f), -5, -0.6 + 0.3 * k)
    SUBt(bt(46) + E8, 7)
    MORPH(B(12) - 0.05, 350, 900, 72)                                          # 曲线 → 盾牌
    # S10 shield B12 – B13
    HLp(B(12) + 0.05, 19); q(bt(49), s_bonk(174.6), -5)
    for i in range(3): q(bt(49 + i), s_crack(73 + i), -6 + i, 0)
    SUBt(bt(50) + E8, 8)
    q(B(13), s_shatter(1.1, 77), -1.5); q(B(13), s_thump(0.4, 150, 60, 0.1, 0.3, 78), -5)
    # S11 virus B13 – B14：×4.2
    HLp(B(13) + 0.05, 20)
    for i, tin in enumerate([bt(52) + E8, bt(52) + E8 + 0.09, bt(53) + E8, bt(54), bt(54) + E8]):
        q(tin - 0.08, s_boing(0.32, 200 + 30 * i), -8, (-0.6, 0.5, -0.4, 0.6, 0.0)[i])
    q(bt(53), s_thump(0.6, 150, 40, 0.2, 0.4, 79), -1.5); q(bt(53), s_stamp(80), -6)
    SUBt(bt(54), 9); SUBt(bt(54) + E8, 10)
    q(B(14) - 0.06, s_unshatter(81), -4, 0, None)                              # 碎片飞回 → 电池
    # S12 battery B14 – B16
    HLp(B(14) + E8, 21)
    for i, tb in enumerate([B(14) + 0.2, bt(57), bt(58), bt(59)]): q(tb, s_lowbat(n['C6'] / 2), -6)
    q(bt(59) + E8, s_zap(0.36, 82), -7)
    for i, f in enumerate([n['C6'], n['Eb6'], n['F6'], n['Ab6']]): q(bt(60 + i), s_blip(f, 0.24, 1.335), -4, (-0.45, -0.15, 0.15, 0.45)[i])
    HLp(bt(60), 22)
    q(bt(62), s_riser(B(16) - bt(62), 83), -9, 0, None)
    q(bt(63) + E8, s_stamp(84), -4, 0.5)                                       # 满电！
    # S13 sunrise B16 – B17：强者大睡！
    q(B(16), s_thump(0.8, 150, 38, 0.26, 0.3, 3), -2.5)
    q(B(16), s_swell(1.0, 85), -2, 0, None)
    q(B(16) + 0.05, s_arp([n['C6'], n['Eb6'], n['F6'], n['Ab6'], n['C7'], n['Eb7'], n['F7']], 0.04, 0.1), -6, 0, None)
    HLp(B(16) + 0.03, 23); HLp(bt(65), 24, 1800)
    q(bt(65), s_ding(n['C7'], 1.5), -2); q(bt(65), s_sparkle(0.6, 5, 86, 3200), -8, 0, None)   # 皇冠
    MORPH(B(17) - 0.05, 300, 800, 87)                                          # 枕头 → 仪表盘
    # S14 tip1 B17 – B18
    q(B(17), s_pop(300, 900, 0.14, 88), -5); HLp(B(17) + 0.06, 25)
    for k in range(6): q(bt(69) + k * E8, s_tock(2400 if k % 2 == 0 else 1800, 89 + k), -8, 0.25 * (1 if k % 2 else -1))   # 指针来回摆
    q(bt(69), s_whoosh(0.2, 800, 4000, 0.5, 95), -12, 0, None)
    q(bt(71) + E8, s_ding(n['Ab6'], 0.9, 0.6), -5)
    SUBt(bt(70), 11)
    MORPH(B(18) - 0.05, 700, 350, 96)                                          # 仪表盘 → 柱状图
    # S15 tip2 B18 – B19
    q(B(18), s_pop(300, 900, 0.14, 97), -5); HLp(B(18) + 0.06, 26)
    for k in range(1, 4): q(B(18) + 0.1 + 0.066 * k, s_pop(500 + 120 * k, 1300 + 200 * k, 0.07, 97 + k), -10, 0)
    q(bt(73), s_morph(800, 330, 0.22, 101), -6, 0.5, None)                    # 周末柱子缩下去
    q(bt(74), s_morph(330, 800, 0.22, 102), -6, -0.4, None)                   # 工作日柱子长上来
    q(bt(75), s_ding(n['F6'], 0.9, 0.7), -4); q(bt(75) + 0.05, s_scribble(0.25, 103), -14, 0, None)
    SUBt(bt(74) + E8, 12)
    MORPH(B(19) - 0.05, 400, 900, 104)                                         # 柱子 → 手机
    # S16 tip3 B19 – B20
    q(B(19), s_pop(300, 900, 0.14, 105), -5); HLp(B(19) + 0.06, 27)
    q(bt(77) - 0.05, s_pop(320, 800, 0.12, 106), -8, -0.4)                    # 枕头出现
    q(bt(77), s_whistle(0.22, 1100, 500), -10, 0, None)                       # 手机倒下
    q(bt(77) + 0.22, s_thump(0.4, 170, 60, 0.12, 0.3, 107), -3); q(bt(77) + 0.22, s_poof(0.3, 108), -8)
    q(bt(77) + E8, s_powerdown(), -4)                                          # 屏幕熄灭
    q(bt(78), s_whoosh(0.3, 1600, 300, 0.35, 109, down=True), -9, 0.3, None)  # 被子盖上
    q(bt(78) + E8, s_pop(500, 1400, 0.1, 110), -6)                            # 睡帽
    for i, tb in enumerate([bt(79), bt(79) + E8, bt(80), bt(81), bt(82), bt(83)]): q(tb, s_zz(820 - 40 * (i % 3), 111 + i), -14, 0.3)
    SUBt(bt(77) + E8, 13)
    # S17 end B20 – end：今晚，你大睡了吗？
    HLp(B(20) + 0.05, 28); HLp(bt(81), 29, 1800)
    q(bt(82), s_pop(400, 1100, 0.1, 117), -6); HLp(bt(82) + 0.06, 30)
    q(bt(83), s_tick(2400, 31), -4); q(bt(83) + 0.04, s_ding(n['C7'], 0.9, 0.6), -4)   # 打卡 ✓
    q(bt(83) + E8, s_whoosh(0.3, 800, 5000, 0.7, 118), -6, 0.5, None)         # 箭头指向评论区
    q(bt(83) - 0.1, s_whoosh(0.3, 5000, 1500, 0.3, 119, down=True), -16, 0.7, None)   # 灯绳落下
    q(B(21) - 0.02, s_cord(120), -6, 0.7)                                     # 关灯
    q(B(21), s_thump(0.35, 120, 50, 0.1, 0.2, 121), -8)
    q(B(21) + 0.05, s_sparkle(0.6, 5, 122, 3000), -8, 0.4, None)
    q(B(21) + 0.42, s_ding(n['F7'], 1.0, 1.2), -4, 0.4)                       # 月亮眨眼
    return C

DUCKS = [(SLAM, 4.0, 0.5), (bt(11), 1.5, 0.25), (B(6), 2.5, 0.4), (B(8), 3.5, 0.7), (B(13), 3.5, 0.5), (bt(53), 2.5, 0.4),
         (B(16), 3.0, 0.6), (bt(63) + E8, 1.5, 0.25), (B(21), 2.0, 0.4)]

# ------------------------------------------------------------------ main
def load_music(path):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', str(path), '-t', f'{DUR + 0.5}', '-f', 'f32le', '-ac', '2', '-ar', str(SR), '-'],
                         check=True, capture_output=True).stdout
    m = np.frombuffer(raw, np.float32).reshape(-1, 2).astype(np.float64)
    if len(m) < N: m = np.vstack([m, np.zeros((N - len(m), 2))])
    m = m[:N].copy()
    t = np.arange(N) / SR
    m *= att(t, 0.005)[:, None]                                               # 防爆音
    fo = np.clip((t - 44.9) / (DUR - 44.9), 0, 1)
    m *= np.cos(fo * np.pi / 2)[:, None]                                       # 44.9 → 45.5 淡出
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
