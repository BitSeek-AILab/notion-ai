#!/usr/bin/env python3
"""帕斯卡 ↔ 布列安桑 · 稀疏点缀音效 + 混音母带

音乐（用户提供）从 0 s 开始，截断到片长并在结尾淡出，除此之外不做任何改动。
音效只是“点缀”：全片只有 8 个“恍然大悟”的瞬间各来一下“叮叮叮”或“咚”，
其余时间只有音乐（音乐自己有旋律，不和它抢）。

所有音效都是程序合成（numpy / scipy，不使用任何采样）。
“叮”的音高取自音乐的 D# 小调，并且跟随音乐本身约 +39 音分的调音偏移
（实测：这首曲子整体比 A=440 标准音高了将近四分之一个半音，不跟随的话“叮”会听起来走调）。

  python3 tools/sfx.py [--music audio/music.wav] [--out out/audio_master.wav]

每个音效的响度都相对“同一时刻音乐的 K 加权响度”自动校准（rel 列，单位 dB）。
母带：音乐先归一到 -14 LUFS → 叠加音效 → 整体 -13 LUFS，真峰值 ≤ -2 dBTP（AAC 编码后仍 ≤ -1）。
"""
import argparse
import subprocess
from pathlib import Path

import numpy as np
from scipy import signal
from scipy.io import wavfile
from scipy.ndimage import minimum_filter1d, uniform_filter1d

SR = 48000
DUR = 69.9                         # 与 js/scene.js 的 DUR 一致
N = int(round(DUR * SR))
T0, BEAT = 0.489, 0.73742          # 音乐节拍网格：第 m 拍 = T0 + m·BEAT（与 js/scene.js 一致）
# 剧情拍 → 音乐拍（与 js/scene.js 的 WARP 一致）：三维证明（剧情拍 48–68）放慢播放，降维打击落在音乐第 80 拍
WARP = [(48, 48), (49.6, 49.6), (50, 51), (52, 54), (54, 58), (56, 62), (58, 64), (58.2, 65), (60, 69), (62, 71), (64, 75), (67, 79), (68, 80)]
def music_beat(n):
    if n <= WARP[0][0]: return n
    if n >= WARP[-1][0]: return n + WARP[-1][1] - WARP[-1][0]
    for (a0, b0), (a1, b1) in zip(WARP, WARP[1:]):
        if n <= a1: return b0 + (n - a0) * (b1 - b0) / (a1 - a0)
def bt(n): return T0 + music_beat(n) * BEAT     # 剧情拍 n 的时刻（秒）

TUNE = 2 ** (39 / 1200)            # 音乐整体偏高约 39 音分
_PC = {'C': -9, 'C#': -8, 'D': -7, 'D#': -6, 'E': -5, 'F': -4, 'F#': -3, 'G': -2, 'G#': -1, 'A': 0, 'A#': 1, 'B': 2}
def hz(name):                      # 'D#6' → 频率（已含调音偏移）
    p, o = name[:-1], int(name[-1])
    return 440.0 * 2 ** ((_PC[p] + 12 * (o - 4)) / 12) * TUNE

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

def s_ding(f=1568, d=1.4, bright=1.0):               # 钟片“叮”
    t = tt(d)
    parts = [(1, 1, 1.0), (2.0, 0.35, 0.55), (2.76, 0.4, 0.4), (5.4, 0.2 * bright, 0.2), (8.93, 0.08 * bright, 0.1)]
    y = sum(a * np.sin(2 * np.pi * f * m * t) * np.exp(-t / (tau * d * 0.5)) for m, a, tau in parts)
    return norm(y * att(t, 0.002) * tail(t, d, 0.05))


def s_dong(f, d=0.8, tau=0.2, bend=1.35, skin=0.3, seed=1, ex=0.55, knock=0.3):
    """“咚”：调音过的鼓（圆膜的非谐泛音 1 : 1.59 : 2.14 : 2.30 + 鼓皮噪声 + 鼓槌）。
    再并联一路“谐波激励”（强饱和后只留 300 Hz 以上），让手机外放这种没有低音的喇叭也能听出“咚”。"""
    t = tt(d)
    g = 1 + (bend - 1) * np.exp(-t / 0.025)
    y = np.zeros_like(t)
    for m, a, k in [(1.0, 1.0, 1.0), (1.594, 0.42, 0.55), (2.136, 0.22, 0.4), (2.296, 0.12, 0.35)]:
        y += a * np.sin(phase(f * m * g)) * np.exp(-t / (tau * k))
    y = norm(y)
    exc = hp(np.tanh(4.0 * y), 300, 4) * np.exp(-t / (0.6 * tau))                 # 谐波激励（3f、5f…）
    y = y + ex * exc
    y += knock * np.sin(phase(f * 3.6 * g)) * np.exp(-t / 0.03)                  # 鼓槌敲击的中频“笃”
    y += skin * bp(noise(len(t), seed), 300, 3000) * np.exp(-t / 0.015)
    y += 0.12 * hp(noise(len(t), seed + 1), 3000) * np.exp(-t / 0.002)
    y *= att(t, 0.0008) * tail(t, d, 0.05)
    return norm(np.tanh(1.3 * norm(y)))

def s_boom(seed=7):
    """降维打击的大“咚！”：D#2 鼓身（音高从两倍急坠）+ D#3 + 冲击噪声。"""
    d = 1.8; t = tt(d)
    g = 1 + 1.0 * np.exp(-t / 0.04)
    y = np.sin(phase(hz('D#2') * g)) * np.exp(-t / 0.55)
    y += 0.55 * np.sin(phase(hz('D#3') * g)) * np.exp(-t / 0.28)
    y += 0.5 * lp(noise(len(t), seed), 4000) * np.exp(-t / 0.035)
    y += 0.25 * bp(noise(len(t), seed + 1), 200, 1200) * np.exp(-t / 0.12)
    y = norm(y)
    y += 0.5 * hp(np.tanh(4.0 * y), 300, 4) * np.exp(-t / 0.3)                  # 谐波激励（手机外放）
    y *= att(t, 0.001) * tail(t, d, 0.1)
    return norm(np.tanh(1.8 * norm(y)))

def s_dings(notes, step, d=0.9, bright=0.8):
    """“叮叮叮”：一串钟片音。"""
    y = np.zeros(int(round((step * (len(notes) - 1) + d) * SR)))
    for k, nm in enumerate(notes):
        add(y, (1 - 0.08 * k) * s_ding(hz(nm), d, bright), k * step)
    return norm(y)


# ------------------------------------------------------------------ cue sheet（全片只有这些）
def cues():
    C = []  # (time, sound, rel_dB, pan, win)
    def q(t, x, rel, pan=0.0, win=0.25): C.append((t, x, rel, pan, win))
    # ① 三组对边的交点依次冒出 → 叮 叮 叮（A#5 C#6 D#6 上行，一个交点一声）
    for k, (nm, pan) in enumerate([('A#5', -0.16), ('C#6', -0.25), ('D#6', -0.2)]):
        q(bt(9 + k) + 0.03, s_ding(hz(nm), 0.9, 0.8), -5, pan)
    # ② 红线切过三个交点 “竟然在一条直线上！” → 咚
    q(bt(12), s_dong(hz('D#3'), 0.8, 0.2, 1.35, 0.3, 11), -1)
    # ③ 红线缩成红点 “竟然交于一点！” → 咚咚
    q(bt(32), s_dong(hz('D#3'), 0.8, 0.22, 1.35, 0.32, 21), -1, -0.1)
    q(bt(32.25), s_dong(hz('F#3'), 0.6, 0.16, 1.3, 0.45, 23, 1.0, 0.6), -3, -0.1)
    # ④ “升到三维！” → 咚
    q(bt(48), s_dong(hz('A#2'), 0.9, 0.26, 1.4, 0.45, 31, 1.1, 0.6), -1)
    # ⑤ 三条空间对角线依次画出 → 叮 叮 叮（D#6 F#6 A#6，更亮）
    for k, nm in enumerate(['D#6', 'F#6', 'A#6']):
        q(bt(56.5 + 0.5 * k), s_ding(hz(nm), 0.9, 0.9), -5, (-0.15, 0.15, 0.0)[k])
    # ⑥ “只能交于同一点！” Q 点闪一下 → 叮（D#6 + 纯五度 A#6）
    q(bt(62), 0.8 * s_ding(hz('D#6'), 1.0, 0.9) + 0.4 * s_ding(hz('A#6'), 1.0, 0.6), -4)
    # ⑦ 降维打击 → 大“咚！”（音乐让出 3 dB）+ 一点亮光
    q(bt(68), s_boom(41), 1)
    q(bt(68) + 0.01, s_ding(hz('D#7'), 1.2, 0.6), -12)
    # ⑧ 再对偶回去 “帕斯卡定理也成立！” → 叮叮叮（呼应开场的 A#5 C#6 D#6，更快）
    q(bt(74.5), s_dings(['A#5', 'C#6', 'D#6'], 0.09, 0.9, 0.9), -3.5, -0.15)
    return C

# 音乐闪避（只有降维打击一处）：(时刻, dB, 释放 s, 保持 s)
DUCKS = [(bt(68), 3.0, 0.9, 0.2)]

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


FADE0 = 69.2                       # 音乐淡出起点（画面 69.3 s 起淡出到黑）

def load_music(path):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', str(path), '-t', f'{DUR + 0.5}', '-f', 'f32le', '-ac', '2', '-ar', str(SR), '-'],
                         check=True, capture_output=True).stdout
    m = np.frombuffer(raw, np.float32).reshape(-1, 2).astype(np.float64)
    if len(m) < N: m = np.vstack([m, np.zeros((N - len(m), 2))])
    m = m[:N].copy()
    t = np.arange(N) / SR
    m *= att(t, 0.005)[:, None]                                               # 防爆音
    fo = np.clip((t - FADE0) / (DUR - FADE0), 0, 1)
    m *= np.cos(fo * np.pi / 2)[:, None]                                       # 结尾淡出
    return m

def main():
    ap = argparse.ArgumentParser()
    root = Path(__file__).resolve().parent.parent
    ap.add_argument('--music', default=str(root / 'audio' / 'music.wav'))
    ap.add_argument('--out', default=str(root / 'out' / 'audio_master.wav'))
    ap.add_argument('--target', type=float, default=-13.0)
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
