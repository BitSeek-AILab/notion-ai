#!/usr/bin/env python3
"""v5 正片配乐 → out/audio_master.wav（时长 = 片长 454.97 s）

  · A：Levy 的 Op.9 No.2，剪掉开头 0.9 s 静音，从画面 0 s 开始；
  · B：Xuan He 的 Op.55 No.2 从画面 262.2 s 进来（第一个音 263.52 s = 第三幕的第一拍）；
       中间剪掉 B 的 60.89–176.84 s（第13–38小节），两边都剪在下一个强拍之前的余音里，200 ms 等功率交叉淡化；
  · 7 声钟片（共线 / 共点 / …）落在钢琴的那个音上，比同一时刻的钢琴低 9 dB，与样片相同的厅堂混响；
  · 整体很轻的慢速电平平衡，母带 -17 LUFS，真峰值 ≤ -1.5 dBTP。

  python3 tools/film_audio.py
"""
import json, sys
from pathlib import Path
import numpy as np
from scipy import signal
from scipy.io import wavfile
sys.path.insert(0, str(Path(__file__).resolve().parent))
from scipy.ndimage import minimum_filter1d, uniform_filter1d
from sfx import SR, ROOT, TUNE_A, TUNE_B, decode, k_weight, chime, place, peak4, midi_hz, rcos, hp, lp, tt

# ---------------------------------------------------------------- 省内存版的响度 / 电平 / 限幅（片长 7.6 分钟，机器内存 4 GB，同时还在渲染画面）
KB = ([1.53512485958697, -2.69169618940638, 1.19839281085285], [1.0, -1.69065929318241, 0.73248077421585])
KH = ([1.0, -2.0, 1.0], [1.0, -1.99004745483398, 0.99007225036621])
SUB = int(0.1 * SR)
def p100(x, chunk=1 << 20):
    """K 加权功率，按 100 ms 小块求和（两声道相加）→ 一维数组。分块滤波，滤波器状态接续。"""
    x = x if x.ndim == 2 else x[:, None]
    zb = [signal.lfilter_zi(*KB) * 0 for _ in range(x.shape[1])]; zh = [signal.lfilter_zi(*KH) * 0 for _ in range(x.shape[1])]
    nsub = len(x) // SUB; acc = np.zeros(nsub + 1)
    for i in range(0, len(x), chunk):
        seg = x[i:i + chunk].astype(np.float64)
        e = np.zeros(len(seg))
        for c in range(x.shape[1]):
            y, zb[c] = signal.lfilter(*KB, seg[:, c], zi=zb[c]); y, zh[c] = signal.lfilter(*KH, y, zi=zh[c]); e += y * y
        k = np.arange(i, i + len(seg)) // SUB
        acc[k[0]:k[-1] + 1] += np.bincount(k - k[0], weights=e)
    return acc[:nsub]
def lufs(x):
    p = p100(x); z = np.convolve(p, np.ones(4), 'valid') / (4 * SUB)
    l = -0.691 + 10 * np.log10(z + 1e-20)
    rel = -0.691 + 10 * np.log10(z[l > -70].mean()) - 10
    return -0.691 + 10 * np.log10(z[(l > -70) & (l > rel)].mean())
def short_term(x):
    p = p100(x); cs = np.concatenate([[0], np.cumsum(p)]); n = len(p); k = np.arange(n)
    a, b = np.clip(k - 15, 0, n), np.clip(k + 15, 0, n)
    return k * 0.1, -0.691 + 10 * np.log10((cs[b] - cs[a]) / np.maximum(b - a, 1) / SUB + 1e-20)
def level(m, ratio=1.6, max_db=4.0, free_tail=9.0):
    """同 sfx.level（很轻的慢速电平平衡，1.6:1，最多 ±4 dB，1.5 s 零相位平滑，安静处不提升），原地分块施加。"""
    tc, Ls = short_term(m); Li = lufs(m)
    g = np.clip(-(Ls - Li) * (1 - 1 / ratio), -max_db, max_db)
    g *= np.clip((Ls - (Li - 24)) / 6, 0, 1)
    dur = len(m) / SR
    g *= 1 - np.clip((tc - (dur - free_tail - 2)) / 2, 0, 1)
    b, a = signal.butter(1, (1 / (2 * np.pi * 1.5)) / 5.0)
    g = signal.filtfilt(b, a, g)
    for i in range(0, len(m), 1 << 20):
        ts = np.arange(i, min(len(m), i + (1 << 20))) / SR
        m[i:i + len(ts)] *= (10 ** (np.interp(ts, tc, g) / 20)).astype(m.dtype)[:, None]
    return m, g
def limiter(x, ceil_db=-1.5, look=0.003, rel=0.12):
    """同 sfx.limiter（前瞻真峰值限幅），float32、原地施加。"""
    ceil = 10 ** (ceil_db / 20)
    req = np.minimum(1.0, ceil / np.maximum(peak4(x), 1e-9)).astype(np.float32)
    L = int(look * SR)
    g = uniform_filter1d(minimum_filter1d(req, 2 * L + 1, mode='nearest'), L + 1, mode='nearest'); del req
    a = 1 - np.exp(-1 / (rel * SR))
    idx = np.flatnonzero(g < 1)
    if len(idx):
        tailn = int(rel * SR * 10)
        cuts = np.flatnonzero(np.diff(idx) > tailn)
        starts = np.concatenate([[idx[0]], idx[cuts + 1]]); ends = np.concatenate([idx[cuts], [idx[-1]]]) + tailn
        for s0, e0 in zip(starts, ends):
            prev = 1.0
            for i in range(s0, min(len(g), e0)):
                v = g[i] if g[i] < prev else prev + (g[i] - prev) * a
                g[i] = v; prev = v
    x *= g[:, None]
    return x, g
def true_peak(x): return 20 * np.log10(peak4(x).max() + 1e-12)


CM = json.load(open(ROOT / 'out' / 'cues_marks.json'))
MU = CM['music']; A_OFF, B_AT, (C0, C1), DUR = MU['a_off'], MU['b_at'], MU['cut'], MU['dur']
N = int(round(DUR * SR))
smooth = lambda u: (lambda v: v * v * (3 - 2 * v))(np.clip(u, 0, 1))

A = decode(ROOT / 'audio' / 'chopin_op9n2_levy.flac').astype(np.float32); A *= np.float32(10 ** ((-20 - lufs(A)) / 20))
B = decode(ROOT / 'audio' / 'chopin_op55n2_xuanhe.flac').astype(np.float32); B *= np.float32(10 ** ((-21 - lufs(B)) / 20))   # B 是更安静的一首：比 A 低 1 dB

# ---- B 的剪接：B[0, C0) + B[C1, …)，交叉淡化窗 [cut − 0.14, cut + 0.06]（都在下一个强拍之前）
XF, PRE = 0.20, 0.14
i0, i1, nx = int(round((C0 - PRE) * SR)), int(round((C1 - PRE) * SR)), int(round(XF * SR))
u = (np.arange(nx) + 0.5) / nx
g_out, g_in = np.cos(u * np.pi / 2)[:, None].astype(np.float32), np.sin(u * np.pi / 2)[:, None].astype(np.float32)
Bc = np.concatenate([B[:i0], B[i0:i0 + nx] * g_out + B[i1:i1 + nx] * g_in, B[i1 + nx:]]); del B
spl = (i1 - i0) / SR
assert abs(spl - MU['spl']) < 1e-3, (spl, MU['spl'])
tb = np.arange(len(Bc)) / SR
k6 = int(6 * SR); Bc[:k6] *= (10 ** ((-6 + 6 * smooth((tb[:k6] - 0.6) / 5.0)) / 20)).astype(np.float32)[:, None]; del tb     # B 的开头 5 s 从 -6 dB 推上来（A 的结尾是 pp）

# ---- 音乐床
bed = np.zeros((N, 2), np.float32)
a = A[int(round(A_OFF * SR)):][:N]
ka = int((B_AT + 1.0) * SR); ta = np.arange(len(a) - ka) / SR
a[ka:] *= np.cos(np.pi / 2 * np.clip(ta / 5.0, 0, 1)).astype(np.float32)[:, None]   # A 的余音在 B 进来后 6 s 内收干净（此时已低于 -45 LUFS）
bed[:len(a)] += a
j0 = int(round(B_AT * SR)); bb = Bc[:N - j0]
bed[j0:j0 + len(bb)] += bb
T_F0, T_F1 = DUR - 3.97, DUR - 1.17                                         # 最后一个和弦（447.44 s）自然衰减后，451.0–453.8 s 收掉
kf = int(T_F0 * SR); tf = np.arange(N - kf) / SR + T_F0
bed[kf:] *= (0.5 + 0.5 * np.cos(np.pi * np.clip((tf - T_F0) / (T_F1 - T_F0), 0, 1))).astype(np.float32)[:, None]
bed[:480] *= rcos(np.arange(480) / SR, 0.01).astype(np.float32)[:, None]
del A, Bc, a, bb

bed, g = level(bed)
bed *= np.float32(10 ** ((-19 - lufs(bed)) / 20))
print(f'bed: A 0–{B_AT + 6:.1f}s · B from {B_AT:.2f}s, splice at {B_AT + C0:.2f}s (B {C0}→{C1}) · leveling {g.min():+.1f}…{g.max():+.1f} dB')

# ---- 钟片（逐个合成：干声 + 厅堂混响，直接加进音乐床）
r = np.random.default_rng(99); ti = tt(2.4)
ir = np.stack([lp(r.standard_normal(len(ti)), 5000) * np.exp(-ti / 0.32) for _ in range(2)], axis=1)
ir = np.vstack([np.zeros((int(0.02 * SR), 2)), ir]); ir /= np.sqrt(np.sum(ir ** 2, axis=0, keepdims=True))
for c in CM['chimes']:
    x = c['t']; cents = TUNE_A if c['piece'] == 'A' else TUNE_B
    y = 0.8 * chime(midi_hz(c['midi'][0], cents), 2.8, 1) + 0.45 * chime(midi_hz(c['midi'][1], cents), 2.8, 2)
    k0 = int(round(x * SR)); w = int(0.3 * SR); pre = int(1.0 * SR)
    sr_ = np.sqrt(np.mean(k_weight(y)[:w] ** 2)) + 1e-9
    seg = k_weight(bed[k0 - pre:k0 + int(1.5 * SR)].astype(np.float64).mean(axis=1))[pre:]
    mr = np.sqrt(np.mean(seg ** 2))
    gain = 10 ** (-9 / 20) * mr / sr_
    dry = hp(np.stack([gain * y, gain * y], axis=1), 50)
    dry = np.vstack([dry, np.zeros((len(ir), 2))])
    wet = np.stack([signal.oaconvolve(dry[:, k], ir[:, k])[:len(dry)] for k in range(2)], axis=1)
    place(bed, (dry + 10 ** (-8 / 20) * wet).astype(np.float32), x)
    print(f"  chime {x:8.3f}s  {c['label']}  {20 * np.log10(gain):+.1f} dB", flush=True)
mix = bed

g_db = -17 - lufs(mix)
for _ in range(6):
    y = None; y, gl = limiter(mix * np.float32(10 ** (g_db / 20)), -1.5)
    L = lufs(y)
    if abs(L + 17) < 0.05: break
    g_db += -17 - L
y[:480] *= rcos(np.arange(480) / SR, 0.01).astype(np.float32)[:, None]
out = ROOT / 'out' / 'audio_master.wav'
wavfile.write(out, SR, y.astype(np.float32))
gr = 20 * np.log10(np.maximum(gl, 1e-9))
tc, Ls = short_term(y); act = Ls > -45
print(f'master {lufs(y):.2f} LUFS, TP {true_peak(y):.2f} dBTP, limiter max GR {gr.min():.2f} dB, '
      f'short-term 10–95% {np.percentile(Ls[act], 10):.1f}…{np.percentile(Ls[act], 95):.1f} LUFS | {len(y) / SR:.3f}s -> {out}')
