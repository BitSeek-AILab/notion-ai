"""Music analysis: BPM / first-beat phase / per-bar energy, spectral bands and section guesses."""
import librosa, numpy as np, json, sys
from pathlib import Path
P = Path(__file__).resolve().parent.parent
y, sr = librosa.load((P/'audio'/'music.mp3').as_posix(), sr=44100, mono=True, duration=75)
hop = 128
oenv = librosa.onset.onset_strength(y=y, sr=sr, hop_length=hop)
tempo, beats = librosa.beat.beat_track(onset_envelope=oenv, sr=sr, hop_length=hop, units='time', tightness=200)
print('librosa tempo', tempo, 'n beats', len(beats), 'first beats', np.round(beats[:6], 3))
best = None
for bpm in np.arange(110.0, 116.0, 0.01):
    per = 60/bpm
    for ph in np.arange(0, per, 0.002):
        g = np.arange(ph, 72, per)
        fr = np.round(g*sr/hop).astype(int)
        s = oenv[fr].sum()
        if best is None or s > best[0]: best = (s, bpm, ph)
bpm, ph = best[1], best[2]; per = 60/bpm
print('grid bpm %.3f phase %.4f beat %.4f bar %.4f' % (bpm, ph, per, 4*per))
S = np.abs(librosa.stft(y, n_fft=2048, hop_length=hop))
freqs = librosa.fft_frequencies(sr=sr, n_fft=2048)
low = S[freqs < 150].sum(0); mid = S[(freqs >= 150) & (freqs < 2000)].sum(0); hi = S[freqs > 4000].sum(0)
grid = np.arange(ph, 72, per)
lowb = np.array([low[int(t*sr/hop):int(t*sr/hop)+int(0.08*sr/hop)].mean() for t in grid])
for k in range(4):
    print('phase', k, 'low mean', lowb[k::4].mean().round(2))
rms = librosa.feature.rms(y=y, frame_length=2048, hop_length=hop)[0]
def seg(a, t0, t1):
    return a[int(t0*sr/hop):int(t1*sr/hop)].mean()
print('\nbar  t0      rms    low     mid     hi    onset')
bars = []
for b in range(34):
    t0 = ph + b*4*per; t1 = t0 + 4*per
    if t1 > 74: break
    r = dict(bar=b, t0=round(t0,3), rms=float(seg(rms,t0,t1)), low=float(seg(low,t0,t1)), mid=float(seg(mid,t0,t1)), hi=float(seg(hi,t0,t1)), on=float(seg(oenv,t0,t1)))
    bars.append(r)
mx = {k: max(b[k] for b in bars) for k in ['rms','low','mid','hi','on']}
for r in bars:
    print('%3d %6.2f  %5.2f  %5.2f  %5.2f  %5.2f  %5.2f' % (r['bar'], r['t0'], r['rms']/mx['rms'], r['low']/mx['low'], r['mid']/mx['mid'], r['hi']/mx['hi'], r['on']/mx['on']))
json.dump(dict(bpm=bpm, phase=ph, beat=per, bar=4*per, bars=bars), open(P/'tools'/'music_analysis.json','w'), indent=1)
# chroma -> key guess
chroma = librosa.feature.chroma_cqt(y=y[:sr*60], sr=sr)
prof = chroma.mean(1)
names = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B']
maj = np.array([6.35,2.23,3.48,2.33,4.38,4.09,2.52,5.19,2.39,3.66,2.29,2.88]); minr = np.array([6.33,2.68,3.52,5.38,2.60,3.53,2.54,4.75,3.98,2.69,3.34,3.17])
sc = [(np.corrcoef(np.roll(maj,i),prof)[0,1], names[i]+' major') for i in range(12)] + [(np.corrcoef(np.roll(minr,i),prof)[0,1], names[i]+' minor') for i in range(12)]
sc.sort(reverse=True); print('\nkey guesses', [(round(a,3),b) for a,b in sc[:4]])
