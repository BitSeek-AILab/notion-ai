#!/usr/bin/env python3
"""大走理论 · 音效与混音母带

所有音效均为程序合成（numpy / scipy，不使用任何采样），按影片的节拍网格放置，
叠加在用户提供的音乐下（音乐从 0 s 开始，截断至视频长度并淡出），
最后母带处理到约 -12 LUFS、真峰值 ≤ -1 dBTP（wav 限幅到 -2 dBTP，AAC 编码后仍 ≤ -1）。

  python3 tools/sfx.py [--music audio/music.mp3] [--out out/audio_master.wav]

每个音效的响度都相对“同一时刻音乐的 K 加权响度”自动校准（rel 列，单位 dB），
所以换音乐后音效依然清晰但不抢戏。
唯一对音乐本身的“动作”：1.68 s 小人被压成一条直线时，音乐做一次“磁带急停”，
只剩心电监护的“滴——”，到 2.21 s（第 2 小节强拍）在原位置恢复，节拍网格不受影响。
"""
import argparse
import subprocess
from pathlib import Path

import numpy as np
from scipy import signal
from scipy.io import wavfile
from scipy.ndimage import minimum_filter1d, uniform_filter1d

SR = 48000
DUR = 47.6
N = int(round(DUR * SR))
BPM, PH = 112.9, 0.083            # 与 js/film.js 完全一致
BEAT = 60 / BPM
E8, S16 = BEAT / 2, BEAT / 4
def bt(n): return PH + n * BEAT
def B(k): return bt(4 * k)
FLAT = bt(3)                       # 躺平 → 被压成直线
SEAL_T = bt(11)                    # “理论”印章
JUMP, LAND = bt(31), B(8)          # 起跳（镲片）/ 踩扁血糖峰（drop）
FLIP1, FLIP2 = bt(57), bt(61)      # 代谢 / 精神 开关
STAMP_R = bt(65)                   # 右脚踩下
UNT = bt(78)                       # 线团解开 → 灯泡
STOP = B(22)                       # 收尾眨眼

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


# ------------------------------------------------------------------ cue sheet
def cues():
    C = []  # (time, sound, rel_dB, pan, win)  win=None → 整段 RMS
    def q(t, x, rel, pan=0.0, win=0.25): C.append((t, x, rel, pan, win))
    HLp = lambda t, s=0, rel=-6: q(t, s_pop(520, 1500, 0.09, s), rel)
    SUBt = lambda t, s=0: q(t, s_tick(1500, s), -11)
    MORPH = lambda t, s=0, rel=-9: q(t, s_whoosh(0.3, 400, 4200, 0.6, s), rel, 0, None)
    STEP = lambda t, s=0, rel=-8, pan=0.0: q(t, s_step(s), rel, pan)

    # S0 弱者躺平 0 – B1：刷手机 → 被压成一条直线（音乐急停，只剩“滴——”）
    q(0.0, s_pop(420, 1200, 0.12, 1), -5)
    for i in range(3): q(bt(i), s_twoTone(1320, 1760), -15, -0.3)                    # 点赞提示音
    for i in (1, 2): q(bt(i), s_thump(0.3, 120, 50, 0.08, 0.1, 2 + i), -10)           # 陷进沙发
    q(FLAT - 0.01, s_squish(), -2)
    q(FLAT + 0.02, s_beep(988, B(1) - FLAT - 0.04), -5, 0, None)                      # 心电拉直线
    # S1 强者大走 B1 – B2
    q(B(1) - 0.16, s_whoosh(0.18, 600, 6000, 0.9, 30), -8, 0, None)
    q(B(1), s_thump(0.55, 170, 45, 0.18, 0.45, 31), -1)
    q(B(1), s_beep(988, 0.09), -5); q(B(1) + 0.16, s_beep(988, 0.09), -9)            # 心跳回来了
    HLp(B(1) + 0.05, 2, -7)
    q(B(1) + 0.03, s_sparkle(0.5, 6, 32, 3000), -14, 0, None)                         # v2：黑夜被光撕开的闪光
    for i, n in enumerate((5, 6, 7)): STEP(bt(n), 40 + i, -8, (-0.15, 0.15)[i % 2])
    q(bt(6) + 0.02, s_brush(0.25, 41), -10)                                           # 大走 下划线
    # S2 大走 + 理论 B2 – B3
    q(B(2) - 0.08, s_brush(0.34, 42), -4, -0.2, None)                                 # 小人 → 大
    q(B(2) + 0.04, s_thump(0.3, 140, 60, 0.08, 0.15, 43), -9)
    q(bt(9), s_pop(300, 900, 0.1, 44), -8, -0.1)                                      # 第二个小人跳出来
    STEP(bt(9) + E8, 45, -12, 0.1)
    q(bt(10) - 0.04, s_brush(0.32, 46), -4, 0.2, None)                                # 小人 → 走
    q(SEAL_T, s_stamp(47), -1, 0.25)                                                  # 盖章 理论
    SUBt(bt(9) + E8, 48)
    # S3 一坐就是一整天 B3 – B4
    MORPH(B(3) - 0.02, 50)
    q(B(3) + 0.3, s_thump(0.25, 110, 50, 0.07, 0.1, 51), -10)                         # 坐下
    q(B(3) + 0.16, s_scribble(0.42, 12, 52), -13, 0.2, None)                          # 桌子画出来
    HLp(B(3) + 0.09, 53)
    q(bt(13), s_pop(300, 900, 0.12, 54), -9, 0.1); q(bt(13) + E8, s_pop(420, 1200, 0.1, 55), -9, 0.4)
    for i in range(8): q(bt(14) + i * S16, s_clock(3400 if i % 2 == 0 else 2700, 56 + i), -12, 0.4)   # 时钟飞转
    # S4 肌肉“停工” B4 – B5
    MORPH(B(4) - 0.02, 64)
    HLp(B(4) + 0.07, 65)
    q(B(4) + 0.03, s_powerdown(0.55), -9, -0.2, None)
    for i, f in enumerate((784, 659, 523)): q(bt(17 + i), s_blip(f, 0.2, 1 / 1.335), -7, 0.4)       # 电量往下掉
    for i in range(3): q(bt(17 + i) + E8, s_zz(0.32, 130 + 10 * i), -17, -0.1)
    q(bt(19) + E8 + 0.05, s_bonk(185), -10, 0.4)                                      # 低电量
    SUBt(bt(17) + 0.01, 66)
    # S5 连坐 8 小时 B5 – B6
    MORPH(B(5) - 0.05, 70)
    for i in range(9): q(B(5) + 0.22 + i * 0.036, s_tick(2600 + 90 * i, 71 + i), -17, -0.6 + 0.15 * i)   # 刻度“咔咔”
    HLp(B(5) + 0.07, 80); SUBt(B(5) + 0.41, 81)
    hrs = crossings(B(5) + 0.3, B(6) - 0.15, lambda x: 8 * io2((x - (B(5) + 0.3)) / (B(6) - B(5) - 0.45)), range(1, 9))
    for i, th in enumerate(hrs): q(th, s_clock(3000 - 60 * i, 82 + i), -13)          # 每过 1 小时“咔”
    # S6 每 30 分钟走 5 分钟 B6 – B7：16 个脚印踩在十六分音符上
    HLp(B(6) + 0.05, 90)
    for i in range(16): q(B(6) + i * S16, s_pop(380 + 28 * i, 1000 + 60 * i, 0.07, 91 + i), -12, -0.7 + 1.4 * i / 15)
    HLp(bt(25), 108)
    # S7 饭后一直坐着 → 血糖飙升 B7 – B8
    MORPH(B(7) - 0.02, 110)
    HLp(B(7) + 0.07, 111)
    q(B(7) + 0.1, s_riser(JUMP - B(7) - 0.1, 112), -12, 0, None)
    HLp(bt(29) + 0.01, 113, -5); q(bt(29) + 0.02, s_bonk(196), -11); q(bt(30), s_bonk(196), -11)
    q(JUMP, s_whistle(LAND - JUMP, 620, 560, 1800), -7, -0.2, None)                  # 起跳 → 下落
    # S8 一脚踩扁 B8（drop）
    q(LAND, s_thump(0.9, 175, 36, 0.26, 0.55, 120), -1)
    q(LAND, s_stamp(121), -4)
    q(LAND + 0.05, s_boing(0.42, 170), -9)                                            # 血糖峰被踩得一弹
    q(LAND + 0.02, s_poof(122), -10, -0.5); q(LAND + 0.02, s_poof(123), -10, 0.5)
    q(LAND + 0.07, s_whistle(0.32, 1500, 380), -10, 0, None)                          # ↓58%
    q(LAND + 0.05, s_sparkle(0.7, 7, 125, 2800), -13, 0, None)                        # v2：彩纸闪光
    SUBt(LAND + 0.36, 124)
    # S9 那每天走多少步才够？ B9 – B10
    HLp(B(9) + 0.07, 130)
    for i, n in enumerate((37, 38, 39)): STEP(bt(n), 131 + i, -9, (-0.15, 0.15)[i % 2])
    q(bt(37) + E8, s_pop(300, 900, 0.14, 134), -6, -0.35)                             # 手表弹出
    HLp(bt(37) + 0.01, 135)
    q(bt(38) + E8, s_boing(0.4, 300), -12, -0.35)
    # S10 每天 7000 步 B10 – B11
    MORPH(B(10) - 0.03, 140)
    HLp(B(10) + 0.07, 141)
    cnt = crossings(B(10) + 0.15, B(11) - 0.12, lambda x: 7000 * io2((x - B(10) - 0.15) / (B(11) - 0.12 - B(10) - 0.15)), range(250, 7001, 250))
    for i, tc in enumerate(cnt[:-1]): q(tc, s_tick(1700 + 40 * i, 142 + i), -15)      # 计步“嗒嗒嗒”
    q(B(11), s_ding(1568, 1.3), -3); q(B(11), s_sparkle(0.7, 8, 175, 2800), -9, 0, None)
    q(B(11) + 0.01, s_arp([1047, 1319, 1568, 2093], 0.03), -11, 0, None)
    # S11 全因死亡风险 ↓47%
    HLp(B(11) + 0.03, 176, -8)
    q(B(11) + 0.09, s_whistle(0.3, 1500, 380), -11, 0, None)
    SUBt(bt(45), 177); SUBt(bt(45) + E8, 178)
    # S12 大脑也受益 B12 – B13
    MORPH(B(12) - 0.03, 180)
    HLp(B(12) + 0.07, 181)
    q(B(12) + 0.3, s_scribble(0.4, 9, 182), -13, 0, None)                             # 脑沟画出来
    q(B(12) + 0.5, s_bloop(420, 2.2, 0.12, 0.04), -13)
    for i, (n, p) in enumerate(((49, -0.5), (50, 0.5), (51, 0.55))): q(bt(n), s_sparkle(0.5, 4, 183 + i, 3000), -11, p, None)
    for i, n in enumerate((49, 50)): q(bt(n) + 0.01, s_pop(360, 1100, 0.1, 186 + i), -8); q(bt(n) + 0.03, s_flap(188 + i), -12)
    # S13 边走边想 创意 +60% B13 – B14
    MORPH(B(13) - 0.03, 190)
    HLp(B(13) + 0.07, 191)
    q(bt(53), s_click(192), -9); q(bt(53) + 0.01, s_ding(2093, 1.2), -6); q(bt(53) + 0.02, s_sparkle(0.8, 8, 193, 3200), -9, 0, None)
    HLp(bt(53) + 0.02, 194, -9)
    SUBt(bt(54) + 0.01, 195)
    # S14 代谢在线 / S15 精神在线 B14 – B16
    MORPH(B(14) - 0.03, 200)
    HLp(B(14) + 0.09, 201, -8)
    q(FLIP1, s_click(202), -8, 0.2); q(FLIP1 + 0.02, s_arp([784, 988, 1175, 1568], 0.035), -9, 0.2, None)
    q(B(15), s_pop(300, 900, 0.14, 203), -6, 0.2); HLp(B(15) + 0.07, 204, -8)
    q(FLIP2, s_click(205), -8, 0.2); q(FLIP2 + 0.02, s_arp([1047, 1319, 1568, 2093], 0.035), -9, 0.2, None)
    for i, tb in enumerate((bt(62), bt(63), bt(63) + E8)): q(tb, s_bloop(330 + 60 * i, 2.0, 0.12, 0.04), -14)
    for n, p in ((58, 0.6), (59, 0.65), (60, -0.4), (62, 0.65), (63, -0.4)): q(bt(n), s_sparkle(0.35, 3, 300 + n, 3400), -15, p, None)   # 开关旁的节拍闪光
    q(B(16) - 0.3, s_whoosh(0.3, 500, 5000, 0.85, 206), -8, 0, None)                  # 开关 → 脚丫
    # S16 这就是大走理论！ B16 – B17（高潮）
    q(B(16), s_thump(0.9, 175, 36, 0.26, 0.55, 210), -1, -0.15)
    q(B(16), s_stamp(211), -3, -0.15)
    q(B(16) + 0.02, s_sparkle(0.8, 9, 212, 2600), -9, 0, None)
    q(B(16) + 0.03, s_whoosh(0.5, 300, 3000, 0.25, 213, down=True), -12, 0, None)     # 小脚印四散
    HLp(B(16) + 0.05, 214, -8)
    q(STAMP_R, s_thump(0.7, 165, 40, 0.22, 0.5, 215), -4, 0.15); q(STAMP_R, s_stamp(216), -6, 0.15)
    HLp(STAMP_R + 0.03, 217, -7)
    for i in range(7): STEP(bt(66) + i * E8, 220 + i, -15, ((i * 0.37) % 1.2) - 0.6)  # 人群一起走
    # S17 – S19 三个小建议 B17 – B20
    MORPH(B(17) - 0.03, 230)
    q(B(17) + 0.02, s_pop(300, 900, 0.14, 231), -7); HLp(B(17) + 0.08, 232, -8)
    mins = crossings(B(17) + 0.3, bt(70), lambda x: 6 * io2((x - B(17) - 0.3) / (bt(70) - B(17) - 0.3)), range(1, 7))
    for i, tm in enumerate(mins): q(tm, s_clock(3100, 233 + i), -13, -0.4)
    q(bt(70), s_whoosh(0.22, 800, 5000, 0.7, 240), -11, 0.1, None); HLp(bt(70) + 0.01, 241)
    q(bt(70) + E8, s_pop(420, 1200, 0.1, 242), -9, 0.45); STEP(bt(71), 243, -9, 0.45)
    MORPH(B(18) - 0.03, 250)
    q(B(18) + 0.02, s_pop(300, 900, 0.14, 251), -7); HLp(B(18) + 0.08, 252, -8)
    cnt2 = crossings(B(18) + 0.3, bt(75), lambda x: 7000 * io2((x - B(18) - 0.3) / (bt(75) - B(18) - 0.3)), range(500, 7001, 500))
    for i, tc in enumerate(cnt2[:-1]): q(tc, s_tick(1800 + 60 * i, 253 + i), -15)
    HLp(bt(73) + 0.01, 268)
    q(bt(75), s_ding(1760, 1.1), -5); q(bt(75), s_sparkle(0.6, 6, 269, 3000), -10, 0, None)
    q(B(19) - 0.02, s_scribble(0.3, 14, 270), -12, 0, None)                            # 手表 → 线团
    q(B(19) + 0.02, s_pop(300, 900, 0.14, 271), -7); HLp(B(19) + 0.08, 272, -8)
    q(B(19) + 0.3, s_scribble(UNT - B(19) - 0.3, 17, 273), -15, 0, None)              # 线团乱抖
    q(B(19) + 0.3, s_boing(0.35, 300), -10, -0.5); q(B(19) + 0.3 + E8, s_boing(0.35, 360), -10, 0.5)
    q(UNT - 0.02, s_whoosh(0.3, 500, 5000, 0.8, 274), -9, 0, None)
    q(UNT + 0.02, s_arp([1047, 1319, 1568, 2093], 0.04), -10, 0, None); HLp(UNT + 0.02, 275)
    q(UNT + 0.3, s_ding(2093, 1.0), -6)
    for i in range(6): STEP(UNT + (2 + i) * S16, 3760 + i, -12 if i == 2 else -15, -0.45 + 0.18 * i)   # v2：灯泡下一圈脚印（左 → 右）
    # S20 – S22 今天，你大走了吗？ B20 – end
    MORPH(B(20) - 0.03, 280)
    q(B(20) + 0.16, s_scribble(0.26, 12, 281), -14, 0, None)
    q(B(20) + 0.3, s_sparkle(1.1, 7, 296, 2200), -14, 0.3, None)                     # v2：日出微光
    HLp(B(20) + 0.07, 282)
    for i, n in enumerate(range(81, 88)):
        STEP(bt(n), 283 + i, -10, (-0.12, 0.12)[i % 2])
        q(bt(n) + 0.02, s_blip(1319 + 40 * i, 0.12, 1.335), -18, 0.3)                    # 每一步 “+1”
    HLp(bt(81) + 0.01, 290, -5)
    q(B(21), s_pop(300, 900, 0.14, 291), -7, -0.3); HLp(B(21) + 0.07, 292, -8)
    q(bt(86), s_tick(2400, 293), -6, -0.3); q(bt(86) + 0.04, s_ding(2093, 0.9, 0.6), -6, -0.3)   # 打勾 ✓
    q(bt(87), s_whoosh(0.3, 800, 5000, 0.7, 294), -9, 0.5, None)                       # 箭头指向评论区
    q(STOP, s_ding(2637, 1.0, 1.2), -3); q(STOP, s_sparkle(0.6, 5, 295, 3400), -9, 0, None)       # 眨眼
    q(STOP, s_pop(260, 760, 0.08, 297), -8, -0.7); q(STOP + 0.015, s_pop(280, 800, 0.08, 298), -8, 0.7)   # v2：两侧礼花筒
    q(STOP + 0.05, s_sparkle(0.6, 8, 299, 3000), -13, 0, None)
    return C

# 音乐闪避：(时刻, dB, 释放 s, 保持 s)
DUCKS = [(B(1), 1.5, 0.25), (SEAL_T, 1.5, 0.25), (LAND, 4.5, 0.7), (B(11), 2.0, 0.35), (bt(53), 1.5, 0.3),
         (B(16), 4.5, 0.7), (STAMP_R, 1.5, 0.4), (STOP, 1.5, 0.4)]

# ------------------------------------------------------------------ music
def tape_stop(m, t0, d, t_back):
    """磁带急停：t0 起 d 秒内播放速度 1→0（音高下坠），随后静音，t_back 处按原时间位置恢复（节拍网格不变）。"""
    i0, n, i2 = int(round(t0 * SR)), int(round(d * SR)), int(round(t_back * SR))
    u = np.arange(n) / n
    pos = i0 + np.cumsum((1 - u) ** 1.6)
    src = np.arange(len(m))
    seg = np.stack([np.interp(pos, src, m[:, c]) for c in range(2)], axis=1) * ((1 - u) ** 0.6)[:, None]
    out = m.copy()
    out[i0:i0 + n] = lp(seg, 6000)
    out[i0 + n:i2] = 0
    k = int(0.004 * SR)
    out[i2:i2 + k] *= np.linspace(0, 1, k)[:, None]
    return out

def load_music(path):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', str(path), '-t', f'{DUR + 0.5}', '-f', 'f32le', '-ac', '2', '-ar', str(SR), '-'],
                         check=True, capture_output=True).stdout
    m = np.frombuffer(raw, np.float32).reshape(-1, 2).astype(np.float64)
    if len(m) < N: m = np.vstack([m, np.zeros((N - len(m), 2))])
    m = m[:N].copy()
    t = np.arange(N) / SR
    m *= att(t, 0.005)[:, None]                                               # 防爆音
    m = tape_stop(m, FLAT, 0.3, B(1))                                          # 躺平 → 音乐“断电”
    fo = np.clip((t - 47.0) / (DUR - 47.0), 0, 1)
    m *= np.cos(fo * np.pi / 2)[:, None]                                       # 47.0 → 47.6 淡出
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
