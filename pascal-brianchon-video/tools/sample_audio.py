#!/usr/bin/env python3
"""v5 样片配乐：Levy 的 Op.9 No.2 原样（与正片相同的响度处理），剪掉开头 0.9 s 静音；
只在共线（第 4 小节第 3 拍，回到主和弦 E♭）的那个音上叠一声很轻的钟片（E♭6 + B♭6，主和弦里的音）。

  python3 tools/sample_audio.py 36.4      # → out/v5_sample_audio.wav（时长 36.4 s，最后 1.6 s 淡出）
"""
import json, sys
from pathlib import Path
import numpy as np
from scipy import signal
from scipy.io import wavfile
sys.path.insert(0, str(Path(__file__).resolve().parent))
from sfx import SR, ROOT, TUNE_A, decode, level, lufs, k_weight, chime, place, limiter, true_peak, midi_hz, rcos, hp, lp, tt

DUR = float(sys.argv[1]) if len(sys.argv) > 1 else 36.4
CM = json.load(open(ROOT / 'out' / 'cues_marks.json'))
OFF = CM['offset']
A = decode(ROOT / 'audio' / 'chopin_op9n2_levy.flac')
A *= 10 ** ((-20 - lufs(A)) / 20)
A, g = level(A)                                    # 与正片相同：整首做很轻的慢速电平平衡
A *= 10 ** ((-19 - lufs(A)) / 20)
N = len(A); mono = A.mean(axis=1); mk = k_weight(mono)
bus = np.zeros((N, 2))
for c in CM['chimes']:
    x = c['t'] + OFF                               # 录音时间（钟声与钢琴的音头重合，不提前）
    y = 0.8 * chime(midi_hz(c['midi'][0], TUNE_A), 2.8, 1) + 0.45 * chime(midi_hz(c['midi'][1], TUNE_A), 2.8, 2)
    i0 = int(round(x * SR)); w = int(0.3 * SR)
    sr_ = np.sqrt(np.mean(k_weight(y)[:w] ** 2)) + 1e-9
    mr = np.sqrt(np.mean(mk[i0:i0 + int(1.5 * SR)] ** 2))
    gain = 10 ** (-9 / 20) * mr / sr_              # 比同一时刻的钢琴低 9 dB
    place(bus, np.stack([gain * y, gain * y], axis=1), x)
    print(f"chime at {c['t']:.3f}s (video) {c['label']}  {20 * np.log10(gain):+.1f} dB")
bus = hp(bus, 50)
r = np.random.default_rng(99); ti = tt(2.4)
ir = np.stack([lp(r.standard_normal(len(ti)), 5000) * np.exp(-ti / 0.32) for _ in range(2)], axis=1)
ir = np.vstack([np.zeros((int(0.02 * SR), 2)), ir]); ir /= np.sqrt(np.sum(ir ** 2, axis=0, keepdims=True))
wet = np.stack([signal.oaconvolve(bus[:, k], ir[:, k])[:N] for k in range(2)], axis=1)
mix = A + bus + 10 ** (-8 / 20) * wet
# 母带增益按整首算（与正片一致：-17 LUFS，真峰值 ≤ -1.5 dBTP），再剪出样片这一段
g_db = -17 - lufs(mix)
for _ in range(6):
    y, gl = limiter(mix * 10 ** (g_db / 20), -1.5)
    L = lufs(y)
    if abs(L + 17) < 0.05: break
    g_db += -17 - L
seg = y[int(round(OFF * SR)): int(round((OFF + DUR) * SR))].copy()
t = np.arange(len(seg)) / SR
fo = np.clip((t - (DUR - 1.6)) / 1.6, 0, 1)
seg *= (np.cos(fo * np.pi / 2) ** 1.5)[:, None]
seg *= rcos(t, 0.01)[:, None]
out = ROOT / 'out' / 'v5_sample_audio.wav'
wavfile.write(out, SR, seg.astype(np.float32))
print(f'{len(seg) / SR:.3f}s, segment {lufs(seg):.1f} LUFS, TP {true_peak(seg):.2f} dBTP -> {out}')
