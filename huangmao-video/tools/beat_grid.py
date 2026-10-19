"""节拍网格：用 librosa 跟踪节拍并线性回归出 BPM 与首拍相位（结果写在 js/beat.js 与 tools/sfx.py 的 BPM / PH）。

  python3 tools/beat_grid.py   # 读取 audio/music.mp3
"""
import librosa, numpy as np
y, sr = librosa.load(__import__('pathlib').Path(__file__).resolve().parent.parent.joinpath('audio', 'music.mp3').as_posix(), sr=44100, mono=True, duration=70)
hop=128
oenv = librosa.onset.onset_strength(y=y, sr=sr, hop_length=hop)
tempo, beats = librosa.beat.beat_track(onset_envelope=oenv, sr=sr, hop_length=hop, units='time', tightness=200)
beats=np.array(beats)
# regression on beats from idx 2 onward
idx=np.arange(len(beats))
A=np.vstack([idx[2:],np.ones(len(idx)-2)]).T
p,res,_,_=np.linalg.lstsq(A,beats[2:],rcond=None)
print('period',p[0],'bpm',60/p[0],'phase',p[1])
resid=beats[2:]-(A@p); print('resid max',np.abs(resid).max())
# refine: phase that maximizes onset strength sum at grid positions for candidate periods
times=librosa.times_like(oenv, sr=sr, hop_length=hop)
best=None
for bpm in np.arange(111.5,113.5,0.01):
    per=60/bpm
    for ph in np.arange(0,per,0.002):
        g=np.arange(ph, 68, per)
        fr=np.round(g*sr/hop).astype(int)
        s=oenv[fr].sum()
        if best is None or s>best[0]: best=(s,bpm,ph)
print('best grid bpm %.3f phase %.4f'%(best[1],best[2]))
bpm,ph=best[1],best[2]; per=60/bpm
# low-band energy per beat, to guess downbeat (kick) phase
S=np.abs(librosa.stft(y,n_fft=2048,hop_length=hop))
freqs=librosa.fft_frequencies(sr=sr,n_fft=2048)
low=S[(freqs<150)].sum(0); hi=S[(freqs>4000)].sum(0)
grid=np.arange(ph,68,per)
lowb=[low[int(t*sr/hop):int(t*sr/hop)+int(0.08*sr/hop)].mean() for t in grid]
hib=[hi[int(t*sr/hop):int(t*sr/hop)+int(0.25*sr/hop)].mean() for t in grid]
lowb=np.array(lowb); hib=np.array(hib)
for k in range(4):
    print('phase',k,'low mean',lowb[k::4].mean().round(2))
print('hi energy per beat around 9-19s:')
for i,t in enumerate(grid):
    if 8<t<19.5: print(i, round(t,3), round(hib[i],3), round(lowb[i],2))
