#!/usr/bin/env python3
"""v5 · 乐谱对齐：把《降E大调夜曲》Op.9 No.2 乐谱（Mutopia MIDI）里的每一个音，对到 Frank Levy 的录音上。

  python3 tools/score_align.py        # → out/score_map.json

做法（score-informed，不是“看波峰”）：
  1. 把 MIDI 合成成一段“假钢琴”（谐波 + 指数衰减 + 踏板式延音），和录音算同样的特征：
     CQT 色度（和声/旋律内容）+ 色度起音（每个音级的能量突增）；
  2. 两条特征序列做 DTW（动态时间规整）→ 乐谱时间 ↔ 录音时间的整体对应（吸收 Levy 的 rubato）；
  3. 每个乐谱起音点在 DTW 估计 ±90 ms 内，用“只看这几个音高（基频 + 2、3 次谐波）的能量突增”精修到真正的击键时刻；
  4. 输出：每个起音的（小节、拍位、音高、声部、录音时刻、可信度）+ 每个八分音符格点的时刻 + 每小节/每拍的速度。
"""
import json, os, sys
import numpy as np, librosa, mido
from scipy.spatial.distance import cdist
from scipy.ndimage import maximum_filter1d, uniform_filter1d

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PIECE = sys.argv[1] if len(sys.argv) > 1 else 'op9'
CFG = {   # v5: both nocturnes of the film. op55's reference MIDI is not redistributed (see tools/get_music.sh)
    'op9': dict(aud='chopin_op9n2_levy.flac', mid='chopin_nocturne_op9_n2.mid', ons='music_onsets.json', out='score_map.json'),
    'op55': dict(aud='chopin_op55n2_xuanhe.flac', mid='op55n2_ref.mid', ons='music_onsets_op55.json', out='score_map_op55.json'),
}[PIECE]
AUD = os.path.join(ROOT, 'audio', CFG['aud'])
MID = os.path.join(ROOT, 'score', CFG['mid'])
SR, HOP, FHOP = 22050, 1024, 256
NAMES = 'C Db D Eb E F Gb G Ab A Bb B'.split()
nm = lambda p: NAMES[p % 12] + str(p // 12 - 1)

# ---------------------------------------------------------------- score
m = mido.MidiFile(MID)
TPB = m.ticks_per_beat; E8 = TPB // 2; BAR = 12 * E8
PU = E8 if PIECE == 'op9' else 0               # op9: one-eighth pickup · op55: the MIDI's bar n = the printed bar n (its bar 0 is empty)
SPT = 0.909090 / TPB                       # seconds per tick at the MIDI tempo (♪ = 132); op55: set from the recording's length below
notes = []
for ti, tr in enumerate(m.tracks):
    t = 0; on = {}
    for msg in tr:
        t += msg.time
        if msg.type == 'note_on' and msg.velocity > 0: on.setdefault(msg.note, []).append(t)
        elif msg.type in ('note_off', 'note_on') and on.get(msg.note):
            notes.append((on[msg.note].pop(0), t, msg.note, ti))
if PIECE == 'op55':
    # the sequencer let the trill of bars 52–54 drift 4 ticks early; everything from bar 54's second half on is back on the grid + 4
    FIX0 = 54 * BAR + 110
    notes = [(s + 4 if s >= FIX0 else s, e + 4 if e >= FIX0 else e, p, ti) for s, e, p, ti in notes]
notes.sort()
end_tk = max(e for s, e, p, ti in notes)
S0 = min(s for s, e, p, ti in notes)          # first note (op55: after the MIDI's empty bar 0)
if PIECE == 'op9':
    # bar 32 is the cadenza (\cadenzaOn): bars 1–31 regular, the cadenza starts at bar 32's downbeat, bars 33–34 regular after it
    CAD0 = PU + 31 * BAR
    # cadenza length: whatever remains after the regular bars 33 and 34
    CADLEN = (end_tk - CAD0) - 2 * BAR
    CADLEN = int(round(CADLEN / (E8 // 4)) * (E8 // 4))
else:
    CAD0, CADLEN = 10 ** 9, 0
def barpos(tk, cad_len):
    if tk < CAD0: b = (tk - PU) // BAR + 1 if PIECE == 'op9' else tk // BAR; return int(b), (tk - PU - (b - 1) * BAR) / E8 if PIECE == 'op9' else (tk - b * BAR) / E8
    if tk < CAD0 + cad_len: return 32, (tk - CAD0) / E8
    r = tk - CAD0 - cad_len; b = r // BAR; return int(33 + b), (r - b * BAR) / E8
groups = {}
for s, e, p, ti in notes: groups.setdefault(s, []).append((p, e - s, ti))
onsets = sorted(groups)

# ---------------------------------------------------------------- synth the score (piano-ish)
def synth(dur):
    y = np.zeros(int((dur + 4) * SR), np.float32)
    for s, e, p, ti in notes:
        t0 = (s - S0) * SPT; d = max((e - s) * SPT, 0.25) + 0.9            # pedal-ish ring
        f0 = 440 * 2 ** ((p - 69) / 12); tau = 0.6 + 2.2 * np.clip((84 - p) / 48, 0, 1)
        n = int(min(d, 4.0) * SR); tt = np.arange(n) / SR
        env = np.exp(-tt / tau) * np.minimum(1, tt / 0.004) * np.clip((d - tt) / 0.15, 0, 1)
        w = np.zeros(n, np.float32)
        for k in range(1, 7):
            if f0 * k > SR / 2 - 500: break
            w += (0.8 / k ** 1.3) * np.sin(2 * np.pi * f0 * k * tt * (1 + 0.0004 * k * k)) * np.exp(-tt * (k - 1) * 0.6)
        i0 = int(t0 * SR); y[i0:i0 + n] += (w * env * (0.7 if ti == 2 else 1.0)).astype(np.float32)
    return y / (np.abs(y).max() + 1e-9)

def feats(y, hop):
    C = np.abs(librosa.cqt(y, sr=SR, hop_length=hop, fmin=librosa.note_to_hz('A0'), n_bins=88 * 3, bins_per_octave=36))
    L = np.log1p(100 * C / (C.max() + 1e-9))
    ch = np.zeros((12, L.shape[1]))
    for b in range(L.shape[0]): ch[(b // 3 + 9) % 12] += L[b]   # bin 0 = A0
    on = np.maximum(0, np.diff(L, axis=1, prepend=L[:, :1]))
    oc = np.zeros((12, L.shape[1]))
    for b in range(on.shape[0]): oc[(b // 3 + 9) % 12] += on[b]
    oc = uniform_filter1d(oc, 3, axis=1)
    nrm = lambda X: X / (np.linalg.norm(X, axis=0, keepdims=True) + 1e-6)
    return nrm(ch), nrm(oc), L

if __name__ == '__main__':
    ya, _ = librosa.load(AUD, sr=SR, mono=True)
    r = librosa.feature.rms(y=ya, frame_length=2048, hop_length=512)[0]
    loud = np.where(20 * np.log10(r + 1e-9) > -50)[0]
    A0, A1 = max(0, loud[0] * 512 - 2048), min(len(ya), loud[-1] * 512 + 2048)   # the recording's silent head / tail are not music
    T_OFF = A0 / SR
    if PIECE == 'op55': SPT = (A1 - A0) / SR / (end_tk - S0)          # constant tempo with the recording's average speed
    ys = synth((end_tk - S0) * SPT)
    print(f'audio {len(ya) / SR:.2f}s (music {A0 / SR:.2f}–{A1 / SR:.2f}s) · score {(end_tk - S0) * SPT:.2f}s · {len(notes)} notes, {len(onsets)} onsets, cadenza {CADLEN / E8:.2f} eighths')
    ca, oa, La = feats(ya[A0:A1], HOP); cs, os_, _ = feats(ys, HOP)
    X = np.vstack([ca, 0.7 * oa]); Y = np.vstack([cs, 0.7 * os_])
    Cm = cdist(X.T, Y.T, 'cosine').astype(np.float64)
    D, wp = librosa.sequence.dtw(C=Cm, step_sizes_sigma=np.array([[1, 1], [1, 2], [2, 1]]), weights_add=np.array([0, 0, 0]),
                                 weights_mul=np.array([1, 1.3, 1.3]))
    wp = wp[::-1]
    ta = wp[:, 0] * HOP / SR + T_OFF; ts = wp[:, 1] * HOP / SR
    # monotone map score-seconds → audio-seconds (average audio time for each score frame)
    us, inv = np.unique(ts, return_inverse=True); ua = np.bincount(inv, ta) / np.bincount(inv)
    s2a = lambda s: np.interp(s, us, ua)
    print('dtw cost', round(float(D[-1, -1]) / len(wp), 4))

    # ---- refinement on a fine grid: pitch-specific flux
    Cf = np.abs(librosa.cqt(ya, sr=SR, hop_length=FHOP, fmin=librosa.note_to_hz('A0'), n_bins=88 * 3, bins_per_octave=36))
    Lf = np.log1p(100 * Cf / (Cf.max() + 1e-9))
    Ff = np.maximum(0, Lf[:, 2:] - Lf[:, :-2]); Ff = np.pad(Ff, ((0, 0), (1, 1)))      # 2-frame rise (≈23 ms)
    broad = Ff.sum(0); broad /= np.percentile(broad, 99)
    fps = SR / FHOP
    def pflux(pitches):
        rows = []
        for p in pitches:
            b0 = (p - 21) * 3 + 1
            for k, w in ((1, 1.0), (2, 0.6), (3, 0.35)):
                bb = b0 + int(round(36 * np.log2(k)))
                if 0 <= bb < Ff.shape[0]: rows.append(w * Ff[max(0, bb - 1):bb + 2].max(0))
        return np.sum(rows, 0)
    def pick(ps, lo, hi, est, sd, extra=None):
        i0, i1 = max(0, int(lo * fps)), int(hi * fps) + 1
        if i1 <= i0 + 1: return max(lo, min(hi, est)) if hi >= lo else lo, 0.0     # (dense trills: no room left)
        full = pflux(ps); f = full[i0:i1] + 0.3 * broad[i0:i1]
        w = np.exp(-0.5 * ((np.arange(i0, i1) / fps - est) / sd) ** 2)
        j = int(np.argmax(f * w)); conf = float(f[j] / (np.median(full[max(0, i0 - 200):i1 + 200]) + 1e-6))
        return (i0 + j) / fps, conf
    ONS = os.path.join(ROOT, 'out', CFG['ons'])
    SF = json.load(open(ONS))['onsets'] if os.path.exists(ONS) else []
    SFt = np.array([o[0] for o in SF]); SFb = np.array([o[2] for o in SF]); SFm = np.array([o[3] for o in SF])
    def snap(x, tol, band, lo_=-1e9, hi_=1e9):   # move to the independent (SuperFlux) onset if one is within tol (and inside the window)
        if not len(SFt): return x
        i = int(np.argmin(abs(SFt - x)))
        return float(SFt[i]) if abs(SFt[i] - x) <= tol and SF[i][band] >= 0.8 and lo_ <= SFt[i] <= hi_ else x
    def snap_bass(lo_, hi_, est):
        if not len(SFt): return None
        k = np.where((SFt >= lo_) & (SFt <= hi_) & (SFb >= 2.0))[0]
        if not len(k): return None
        sc = SFb[k] * np.exp(-0.5 * ((SFt[k] - est) / 0.12) ** 2)
        return float(SFt[k[int(np.argmax(sc))]])
    res = []; prev = 0.0
    ESTS = [float(s2a((tk - S0) * SPT)) for tk in onsets] + [1e9]
    for oi, tk in enumerate(onsets):
        g = groups[tk]; ps = sorted({p for p, d, ti in g})
        up = [p for p, d, ti in g if ti == 1]; lo = [p for p, d, ti in g if ti == 2]
        est = ESTS[oi]; nxt = ESTS[oi + 1] - 0.04          # never reach into the next score onset
        t, conf = pick(ps, max(prev + 0.03, est - 0.12), min(est + 0.12, nxt), est, 0.07)        # the group's first attack
        tm = tb = None
        if up:                                            # melody (RH top voice) may come late: Levy often breaks the hands
            lo_, hi_ = max(prev + 0.03, t - 0.06), max(min(t + 0.30, nxt), t + 0.02)
            tm, _ = pick([max(up)], lo_, hi_, t, 0.12)
            tm = snap(tm, 0.04, 3, lo_, hi_)
        if lo:                                            # bass (LH lowest note) may come early; CQT is blurred down there → use the onset detector
            tb, _ = pick([min(lo)], max(prev + 0.03, t - 0.06), max(min(t + 0.12, nxt), t + 0.02), t, 0.05)
            tb = snap_bass(max(prev + 0.03, est - 0.25), min(est + 0.12, nxt), est) or snap(tb, 0.04, 2, prev + 0.03, nxt)
        t = min(x for x in (t, tm, tb) if x is not None)
        prev = t
        b, q = barpos(tk, CADLEN)
        res.append(dict(tick=int(tk), bar=b, pos=round(q, 3), t=round(t, 3), dtw=round(est, 3), conf=round(conf, 2),
                        t_mel=round(tm, 3) if tm is not None else None, t_bass=round(tb, 3) if tb is not None else None,
                        mel=nm(max(up)) if up else None, mel_p=max(up) if up else None,
                        mel_len=round(max(d for p, d, ti in g if ti == 1 and p == max(up)) / E8, 3) if up else None,
                        bass=nm(min(lo)) if lo else None, bass_p=min(lo) if lo else None,
                        n=[nm(p) for p in ps]))
    # second pass: melody notes must come out in score order. If a (fast ornament) note grabbed its successor's attack,
    # re-pick it strictly before that successor (≥ 40 ms gap); group times follow.
    MI = [i for i, r in enumerate(res) if r['t_mel'] is not None]
    fixed = 0
    for _ in range(3):
        for a in range(len(MI) - 2, -1, -1):
            i, j = MI[a], MI[a + 1]
            if res[i]['t_mel'] > res[j]['t_mel'] - 0.04:
                pv = res[MI[a - 1]]['t_mel'] if a > 0 else 0.0
                lo_, hi_ = max(pv + 0.03, res[i]['dtw'] - 0.25), res[j]['t_mel'] - 0.04
                if hi_ - lo_ < 0.02: tm = (pv + res[j]['t_mel']) / 2
                else:
                    tm, _ = pick([res[i]['mel_p']], lo_, hi_, min(res[i]['t'], hi_), 0.1)
                    tm = snap(tm, 0.03, 3, lo_, hi_)
                res[i]['t_mel'] = round(tm, 3); res[i]['t'] = round(min(res[i]['t'], tm), 3); fixed += 1
    bad = [(res[MI[a]]['bar'], res[MI[a]]['pos']) for a in range(len(MI) - 1) if res[MI[a]]['t_mel'] >= res[MI[a + 1]]['t_mel']]
    print('melody order fixes:', fixed, '· still non-increasing:', bad)
    # eighth grid: time of every eighth position (bars 0..34, cadenza excluded) from onsets on the grid, interpolated elsewhere
    grid = {}
    for r in res:
        if (PIECE != 'op9' or r['bar'] != 32) and abs(r['pos'] - round(r['pos'])) < 1e-6: grid[(r['bar'], int(round(r['pos'])))] = r['t']
    out = dict(audio=os.path.basename(AUD), score=os.path.basename(MID), cadenza_eighths=CADLEN / E8, onsets=res,
               grid=[[b, q, t] for (b, q), t in sorted(grid.items())])
    json.dump(out, open(os.path.join(ROOT, 'out', CFG['out']), 'w'), ensure_ascii=False, indent=0)
    print('wrote out/' + CFG['out'], len(res), 'onsets,', len(grid), 'grid points')
