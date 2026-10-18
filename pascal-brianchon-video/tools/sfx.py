#!/usr/bin/env python3
"""帕斯卡 ↔ 布列安桑 v4 · 配乐 + 柔和点缀音 + 混音母带

配乐：两首肖邦夜曲（公有领域录音，Musopen「Set Chopin Free」，Wikimedia Commons；下载：tools/get_music.sh）
  A  《降 E 大调夜曲》Op. 9 No. 2 · Frank Levy      —— 从第 0 秒开始，完整播放（第一、二幕）
  B  《降 E 大调夜曲》Op. 55 No. 2 · Xuan He        —— 在 A 最后一个和弦的余音里接上（同为降 E 大调），
                                                      播到片尾，在它的一个乐句呼吸处（B 的第 176.5 秒）淡出
对音乐只做“雕花式”处理：两首对齐响度 + 很轻、很慢的电平平衡（像调音台推子，不动旋律和段落；不循环、不剪接）。

点缀音：全片只有 9 处，柔和的钟片 / 低音钟，音量比同一时刻的音乐低 5–9 dB，不压低音乐。
  · 音高从“这一刻音乐里正在响的音”（色度分析）里挑：高音钟片只用降 E 大调五声音阶（E♭ F G B♭ C），
    低音钟从 6 个降 E 大调常用和弦里挑最贴合的一个，所以不会和钢琴打架；
  · 时刻用“剧情拍”书写，由 js/scene.js 的老师节奏时钟 realT() 换算成真实秒数（含所有停顿），与画面逐帧一致。
  · v4 卡点：这些时刻（以及全片 85 个关键节点）已由 tools/sync.mjs 挪到钢琴的起音上（画面早 LEAD = 25 ms），
    钟声就放在“画面时刻 + LEAD”= 钢琴起音那一刻，和钢琴的音头合在一起，不会出现前后两下的“双击”。

  python3 tools/sfx.py [--a audio/chopin_op9n2_levy.flac] [--b audio/chopin_op55n2_xuanhe.flac] [--out out/audio_master.wav]
母带：整体 -17 LUFS（安静的钢琴片，不追求响），真峰值 ≤ -1.5 dBTP（AAC 编码后仍 ≤ -1）。
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
ROOT = Path(__file__).resolve().parent.parent
B_END = 176.5          # 片尾落在 B 的第 176.5 秒：那里是一个乐句的呼吸（-40 dB 的停顿）
TUNE_A, TUNE_B = 0.7, -2.3   # 两份录音的实测调音偏差（音分，相对 A=440）
LEAD = 0.025                 # 画面比钢琴起音早多少（由 js/sync.js 覆盖）

def scene(beats):
    """剧情拍（数字）/ 画面拍（'v…'）→ 真实秒数；同时返回片长 DUR。直接调用 js/scene.js（与画面同一个时钟）。"""
    code = ("const S = await import(process.argv[1]); const Y = await import(process.argv[1].replace('scene.js', 'sync.js'));"
            "const b = JSON.parse(process.argv[2]);"
            "const vb = (x) => typeof x === 'string' ? +x.slice(1) : (x < S.INS0 ? x : x + S.INSD);"
            "console.log(JSON.stringify({ dur: S.DUR, lead: Y.LEAD, t: b.map((x) => S.realT(vb(x))) }));")
    r = subprocess.run(['node', '--input-type=module', '-e', code, (ROOT / 'js' / 'scene.js').as_uri(), json.dumps(beats)],
                       check=True, capture_output=True, text=True)
    d = json.loads(r.stdout)
    global LEAD
    LEAD = d['lead']
    return d['dur'], d['t']

# ------------------------------------------------------------------ helpers
def tt(d): return np.arange(int(round(d * SR))) / SR
def norm(x, peak=1.0): return x * (peak / (np.max(np.abs(x)) + 1e-12))
def _sos(kind, f, order=2): return signal.butter(order, f, kind, fs=SR, output='sos')
def lp(x, f, o=2): return signal.sosfilt(_sos('lowpass', f, o), x, axis=0)
def hp(x, f, o=2): return signal.sosfilt(_sos('highpass', f, o), x, axis=0)
def rcos(t, a): return 0.5 - 0.5 * np.cos(np.pi * np.clip(t / a, 0, 1))
def midi_hz(m, cents=0.0): return 440.0 * 2 ** ((m - 69) / 12 + cents / 1200)
NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B']
def mname(m): return NAMES[m % 12] + str(m // 12 - 1)
PENTA = [3, 5, 7, 10, 0]   # 降 E 大调五声音阶：E♭ F G B♭ C

def chime(f, d=2.6, seed=0):
    """柔和钟片（颤音琴 / 钢片琴一类）：基音长、泛音少（1 : 4 : 10 的音条泛音 + 一点点 2、3 次谐波），起音 6 ms，不刺耳。"""
    t = tt(d); r = np.random.default_rng(seed)
    parts = [(1.0, 1.0, 1.15), (2.0, 0.08, 0.5), (3.0, 0.03, 0.3), (3.98, 0.12, 0.28), (9.9, 0.015, 0.05)]
    y = sum(a * np.sin(2 * np.pi * f * m * t + r.uniform(0, 6.28)) * np.exp(-t / tau) for m, a, tau in parts if f * m < 16000)
    y *= rcos(t, 0.006) * rcos(d - t, 0.25)
    return norm(lp(y, 7000))

def bell(f, d=4.2, seed=0):
    """柔和低音钟：八度下的“嗡” + 基音 + 少量谐波，起音 12 ms，长余音。"""
    t = tt(d); r = np.random.default_rng(seed)
    parts = [(0.5, 0.22, 2.2), (1.0, 1.0, 1.7), (2.0, 0.3, 1.0), (3.0, 0.1, 0.6), (4.07, 0.06, 0.35), (5.2, 0.025, 0.2)]
    y = sum(a * np.sin(2 * np.pi * f * m * t + r.uniform(0, 6.28)) * np.exp(-t / tau) for m, a, tau in parts)
    y *= rcos(t, 0.012) * rcos(d - t, 0.4)
    return norm(lp(y, 5000))

def place(y, x, t0):
    i0 = int(round(t0 * SR)); i1 = min(len(y), i0 + len(x))
    if i1 > i0: y[i0:i1] += x[: i1 - i0]

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

def short_term(x, win=3.0, hop=0.1):
    """短期响度曲线（K 加权，3 s 窗，0.1 s 步进）→ (中心时刻, LUFS)"""
    p = (k_weight(x) ** 2).sum(axis=1)
    cs = np.concatenate([[0], np.cumsum(p)])
    W, H = int(win * SR), int(hop * SR)
    c = np.arange(0, len(p), H)
    a, b = np.clip(c - W // 2, 0, len(p)), np.clip(c + W // 2, 0, len(p))
    z = (cs[b] - cs[a]) / np.maximum(b - a, 1)
    return c / SR, -0.691 + 10 * np.log10(z + 1e-20)

def peak4(x, blk=1 << 20, pad=256):
    """4× 过采样后的逐样本峰值（两声道取大），分块计算以省内存（片长 7 分多钟）"""
    n = len(x); out = np.empty(n)
    for i in range(0, n, blk):
        a, b = max(0, i - pad), min(n, i + blk + pad)
        u = np.abs(signal.resample_poly(x[a:b], 4, 1, axis=0)).max(axis=1).reshape(-1, 4).max(axis=1)
        out[i:min(n, i + blk)] = u[i - a: i - a + min(blk, n - i)]
    return out

def true_peak(x):
    return 20 * np.log10(peak4(x).max() + 1e-12)

def limiter(x, ceil_db=-1.5, look=0.003, rel=0.12):
    """前瞻真峰值限幅：4× 过采样找峰 → 最小值滤波 + 平滑 → 释放（只在真正压缩的片段里逐点计算）。"""
    ceil = 10 ** (ceil_db / 20)
    req = np.minimum(1.0, ceil / np.maximum(peak4(x), 1e-9))
    L = int(look * SR)
    g = uniform_filter1d(minimum_filter1d(req, 2 * L + 1, mode='nearest'), L + 1, mode='nearest')
    del req
    a = 1 - np.exp(-1 / (rel * SR))
    out = g.copy()
    idx = np.flatnonzero(g < 1)
    if len(idx):
        tailn = int(rel * SR * 10)
        cuts = np.flatnonzero(np.diff(idx) > tailn)
        starts = np.concatenate([[idx[0]], idx[cuts + 1]]); ends = np.concatenate([idx[cuts], [idx[-1]]]) + tailn
        for s0, e0 in zip(starts, ends):
            prev = 1.0
            for i in range(s0, min(len(g), e0)):
                v = g[i] if g[i] < prev else prev + (g[i] - prev) * a
                out[i] = v; prev = v
    return x * out[:, None], out

# ------------------------------------------------------------------ music bed
def decode(path, dur=None):
    cmd = ['ffmpeg', '-v', 'error', '-i', str(path)] + (['-t', f'{dur}'] if dur else []) + ['-f', 'f32le', '-ac', '2', '-ar', str(SR), '-']
    raw = subprocess.run(cmd, check=True, capture_output=True).stdout
    return np.frombuffer(raw, np.float32).reshape(-1, 2).astype(np.float64)

def level(m, ratio=1.6, max_db=4.0, free_tail=9.0):
    """很轻的慢速电平平衡：短期响度偏离整体响度的部分按 1.6:1 收一点（最多 ±4 dB），1.5 s 零相位平滑；
    几乎无声的地方（乐句间的呼吸、两首之间的余音）不提升。"""
    tc, Ls = short_term(m)
    Li = lufs(m)
    g = np.clip(-(Ls - Li) * (1 - 1 / ratio), -max_db, max_db)
    g *= np.clip((Ls - (Li - 24)) / 6, 0, 1)          # 很安静的地方：不提升
    dur = len(m) / SR
    g *= 1 - np.clip((tc - (dur - free_tail - 2)) / 2, 0, 1)   # 片尾淡出段不再做电平平衡，让它自己慢慢收
    b, a = signal.butter(1, (1 / (2 * np.pi * 1.5)) / 5.0)
    g = signal.filtfilt(b, a, g)
    gs = np.interp(np.arange(len(m)) / SR, tc, g)
    return m * (10 ** (gs / 20))[:, None], g

def music_bed(fa, fb, dur):
    N = int(round(dur * SR)); t = np.arange(N) / SR
    A = decode(fa); B = decode(fb, B_END + 1)
    A *= 10 ** ((-20 - lufs(A)) / 20)                  # 两首先对齐响度（B 是更安静的一首，再低 1 dB）
    B *= 10 ** ((-21 - lufs(B)) / 20)
    tb = np.arange(len(B)) / SR
    u = np.clip((tb - 0.9) / 5.1, 0, 1); u = u * u * (3 - 2 * u)
    B *= (10 ** ((-12 + 12 * u) / 20))[:, None]        # B 的开头 6 s 从 -12 dB 轻轻推上来：A 的结尾是极弱（pp），不让 B 突然闯进来
    b_at = dur - B_END                                 # B 的第 0 秒放在画面的这个时刻
    m = np.zeros((N, 2))
    a = A[:N].copy()
    fa_t = np.clip((t[:len(a)] - (b_at + 1.0)) / 5.0, 0, 1)
    a *= np.cos(fa_t * np.pi / 2)[:, None]             # A 的余音在 B 进来后 5 s 内收干净（此时已低于 -50 dB）
    m[:len(a)] += a
    i0 = int(round(b_at * SR)); bb = B[: N - i0]
    m[i0:i0 + len(bb)] += bb
    fo = np.clip((t - (dur - 9.0)) / 9.0, 0, 1)
    m *= (10 ** (-50 * fo ** 2 / 20))[:, None]         # 片尾 9 s 淡出（先慢后快，落在 B 的乐句呼吸上）
    m *= rcos(t, 0.01)[:, None]
    del A, B, a, bb
    return m, b_at

def chroma(mono, t0, t1, cents):
    """t0–t1 秒内的色度（12 个音级的能量，已归一化）"""
    seg = mono[max(0, int(t0 * SR)): int(t1 * SR)]
    f, _, Z = signal.stft(seg, SR, nperseg=8192, noverlap=6144)
    P = (np.abs(Z) ** 2).sum(axis=1)
    sel = (f > 70) & (f < 2600)
    pc = np.round(69 + 12 * np.log2(f[sel] / midi_hz(69, cents))).astype(int) % 12
    c = np.bincount(pc, weights=np.sqrt(P[sel]), minlength=12)
    return c / (c.max() + 1e-12)

def best_run(chs, lo=75, hi=92):
    """为一串依次出现的钟声挑音：上行、相邻 ≤ 5 个半音、全在五声音阶里，得分 = 各自时刻的色度之和"""
    notes = [m for m in range(lo, hi + 1) if m % 12 in PENTA]
    best, arg = -1, None
    def rec(seq):
        nonlocal best, arg
        if len(seq) == len(chs):
            s = sum(chs[i][m % 12] for i, m in enumerate(seq))
            if s > best: best, arg = s, list(seq)
            return
        for m in notes:
            if not seq or (0 < m - seq[-1] <= 5): rec(seq + [m])
    rec([])
    return arg

CHORDS = [[51, 58, 67], [48, 55, 63], [46, 53, 58], [51, 58, 63], [55, 58, 63], [44, 51, 60]]   # E♭(G) · Cm · B♭5 · E♭5 · E♭/G · A♭
def best_chord(ch):
    return max(CHORDS, key=lambda c: sum(ch[m % 12] for m in c) / len(c))

# ------------------------------------------------------------------ cue sheet（剧情拍；全片只有这些）
CUES = [
    # (拍, 类型, 相对音乐 dB, 声像, 说明)
    ((9.0, 10.0, 11.0), 'run', -9, (-0.2, -0.1, 0.0), '① 三个交点依次出现 · 叮 叮 叮'),
    (12.0, 'bell', -7, 0.0, '② 竟然在一条直线上'),
    (32.0, 'bell', -7, 0.0, '③ 竟然交于一点'),
    (124.0, 'pair', -9, 0.0, '④ 只能交于同一点 Q'),
    (140.0, 'boom', -5, 0.0, '⑤ 降维打击'),
    ((184.0, 184.4068), 'run', -9, (-0.3, 0.3), '⑥ 你在我的线上 ⇔ 我在你的线上（一问一答：第二声落在字幕落地的那个音上）'),
    ((208.0, 208.12, 208.24), 'run', -9, (-0.15, 0.0, 0.15), '⑦ 帕斯卡定理也成立'),
    ((229.2, 229.9, 230.6), 'run', -9, (-0.2, -0.1, 0.1), '⑧ 空间里对边交出 3 个点'),
    (256.0, 'boom', -5, 0.0, '⑨ 降维打击 2.0'),
]

def pan2(y, p):
    a = (p + 1) * np.pi / 4
    return np.stack([y * np.cos(a), y * np.sin(a)], axis=1) * np.sqrt(2)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--a', default=str(ROOT / 'audio' / 'chopin_op9n2_levy.flac'))
    ap.add_argument('--b', default=str(ROOT / 'audio' / 'chopin_op55n2_xuanhe.flac'))
    ap.add_argument('--out', default=str(ROOT / 'out' / 'audio_master.wav'))
    ap.add_argument('--target', type=float, default=-17.0)
    ap.add_argument('--ceiling', type=float, default=-1.5)
    a = ap.parse_args()

    beats = []
    for c in CUES: beats += list(c[0]) if isinstance(c[0], tuple) else [c[0]]
    dur, ts = scene(beats)
    tmap = dict(zip(map(str, beats), ts))
    T = lambda b: tmap[str(b)]
    N = int(round(dur * SR)); t = np.arange(N) / SR

    music, b_at = music_bed(a.a, a.b, dur)
    music, g = level(music)
    music *= 10 ** ((-19 - lufs(music)) / 20)
    print(f'DUR {dur:.2f}s | A 0–{min(dur, 271.5):.1f}s | B starts at {b_at:.2f}s (first note ≈ {b_at + 1.0:.1f}s), ends at B {B_END}s | '
          f'leveling {g.min():+.1f}…{g.max():+.1f} dB')
    if not 258 <= b_at <= 272: print('!! B 的接入点偏离 A 的结尾太多，请检查 B_END')
    mono = music.mean(axis=1)
    mk = k_weight(mono)
    floor = np.sqrt(np.mean(mk ** 2)) * 10 ** (-10 / 20)

    bus = np.zeros((N, 2))
    for b, kind, rel, pan, label in CUES:
        bs = list(b) if isinstance(b, tuple) else [b]
        t0s = [T(x) + LEAD for x in bs]
        cents = TUNE_A if t0s[0] < b_at + 1 else TUNE_B
        ev = []   # (t0, mono signal, pan)
        if kind == 'run':
            chs = [chroma(mono, x - 0.3, x + 1.2, cents) for x in t0s]
            ns = best_run(chs, 75 if len(bs) > 1 else 79, 92)
            for x, m_, p in zip(t0s, ns, pan): ev.append((x, chime(midi_hz(m_, cents), 2.6, m_), p))
            desc = ' '.join(mname(m_) for m_ in ns)
        elif kind == 'pair':
            ch = chroma(mono, t0s[0] - 0.3, t0s[0] + 1.5, cents)
            r = max(range(79, 88), key=lambda m_: ch[m_ % 12] + ch[(m_ + 7) % 12] if m_ % 12 in PENTA and (m_ + 7) % 12 in PENTA else -1)
            ev += [(t0s[0], 0.8 * chime(midi_hz(r, cents), 2.8, 1) + 0.45 * chime(midi_hz(r + 7, cents), 2.8, 2), pan)]
            desc = f'{mname(r)}+{mname(r + 7)}'
        else:   # bell / boom：低音钟和弦（轻轻琶音）；boom 再加一点高处的钟片光泽
            ch = chroma(mono, t0s[0] - 0.3, t0s[0] + 1.8, cents)
            cd = best_chord(ch)
            y = np.zeros(int(4.6 * SR))
            for i, m_ in enumerate(cd): place(y, (1.0, 0.75, 0.55)[i] * bell(midi_hz(m_, cents), 4.2, 10 + i), 0.035 * i)
            if kind == 'boom':
                top = max(cd) + 24
                place(y, 0.22 * chime(midi_hz(top, cents), 2.8, 7), 0.06)
            ev.append((t0s[0], norm(y), pan))
            desc = '+'.join(mname(m_) for m_ in cd)
        for x, y, p in ev:
            i0 = int(round(x * SR)); w = int((0.3 if kind in ('run', 'pair') else 0.8) * SR)
            sr_ = np.sqrt(np.mean(k_weight(y)[:w] ** 2)) + 1e-9
            seg = mk[i0: i0 + int(1.5 * SR)]
            mr = max(np.sqrt(np.mean(seg ** 2)), floor)
            gain = min(10 ** (rel / 20) * mr / sr_, 0.5)
            place(bus, pan2(gain * y, p), x)
        print(f'  {t0s[0]:7.2f}s  {label:<28s} {desc:<14s} {rel:+d} dB')
    bus = hp(bus, 50)
    # 柔和的厅堂混响，让合成钟声和钢琴录音坐在同一个空间里
    r = np.random.default_rng(99); ti = tt(2.4)
    ir = np.stack([lp(r.standard_normal(len(ti)), 5000) * np.exp(-ti / 0.32) for _ in range(2)], axis=1)
    ir = np.vstack([np.zeros((int(0.02 * SR), 2)), ir]); ir /= np.sqrt(np.sum(ir ** 2, axis=0, keepdims=True))
    wet = np.stack([signal.oaconvolve(bus[:, c], ir[:, c])[:N] for c in range(2)], axis=1)
    music += bus; music += 10 ** (-8 / 20) * wet
    mix = music; del bus, wet

    g_db = a.target - lufs(mix)
    for _ in range(6):
        y, gain = limiter(mix * 10 ** (g_db / 20), a.ceiling)
        L = lufs(y)
        if abs(L - a.target) < 0.05: break
        g_db += a.target - L
    y *= rcos(dur - t, 0.2)[:, None]
    tp = true_peak(y)
    Path(a.out).parent.mkdir(parents=True, exist_ok=True)
    wavfile.write(a.out, SR, y.astype(np.float32))
    gr = 20 * np.log10(gain)
    print(f'limiter: max GR {gr.min():.2f} dB, GR>1 dB for {np.mean(gr < -1) * 100:.2f}% of samples, GR>3 dB {np.mean(gr < -3) * 100:.3f}%')
    tc, Ls = short_term(y)
    act = Ls > -45
    print(f'master {lufs(y):.2f} LUFS, TP {tp:.2f} dBTP, short-term range (10–95%) {np.percentile(Ls[act], 10):.1f}…{np.percentile(Ls[act], 95):.1f} LUFS '
          f'| {len(y) / SR:.3f}s -> {a.out}')

if __name__ == '__main__':
    main()
