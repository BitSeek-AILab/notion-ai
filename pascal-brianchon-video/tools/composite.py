#!/usr/bin/env python3
"""v5 正片合成：画面（out/F_0.mkv + out/F_1.mkv，ffv1 无损）+ 底部 300 px 乐谱带（tools/strip.py）+ 配乐（out/audio_master.wav）
→ out/pb_v5_full.mp4（H.264 High · yuv420p · BT.709 · AAC 256k）

  python3 tools/composite.py                              # 全片
  python3 tools/composite.py --from 20 --to 32 --out out/test.mp4
  python3 tools/composite.py --from 113.766667 --to 227.533333 --src C_ --src-start 113.766667 --audio none --out out/part_1.mp4
      # 分块（tools/chunks.sh）：画面来自 out/C_0.mkv + C_1.mkv（从 --src-start 起），只出画面
"""
import argparse, subprocess, sys, time
from pathlib import Path
import numpy as np
sys.path.insert(0, str(Path(__file__).resolve().parent))
from strip import Strip, ROOT, FPS, W, H as SH, DUR

ap = argparse.ArgumentParser()
ap.add_argument('--from', dest='t0', type=float, default=0.0)
ap.add_argument('--to', dest='t1', type=float, default=None)
ap.add_argument('--out', default=str(ROOT / 'out' / 'pb_v5_full.mp4'))
ap.add_argument('--crf', default='17')
ap.add_argument('--preset', default='slow')
ap.add_argument('--audio', default=str(ROOT / 'out' / 'audio_master.wav'))
ap.add_argument('--src', default='F_', help='画面分段前缀：out/<src>0.mkv + out/<src>1.mkv')
ap.add_argument('--src-start', dest='s0', type=float, default=0.0, help='画面分段的起点（秒）')
a = ap.parse_args()
HH = 1920
NF = int(round(DUR * FPS))
f0 = int(round(a.t0 * FPS)); f1 = NF if a.t1 is None else min(NF, int(round(a.t1 * FPS)))
lst = ROOT / 'out' / f'{a.src}list.txt'
lst.write_text(f"file '{ROOT / 'out' / (a.src + '0.mkv')}'\nfile '{ROOT / 'out' / (a.src + '1.mkv')}'\n")
sk = f0 - int(round(a.s0 * FPS)); assert sk >= 0, '--from 早于画面分段起点'
dec = ['ffmpeg', '-v', 'error'] + (['-ss', f'{sk / FPS:.6f}'] if sk else []) + ['-f', 'concat', '-safe', '0', '-i', str(lst),
       '-frames:v', str(f1 - f0), '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-']
has_audio = Path(a.audio).exists()
enc = ['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{HH}', '-r', str(FPS), '-i', '-']
if has_audio: enc += ['-ss', f'{f0 / FPS:.6f}', '-t', f'{(f1 - f0) / FPS:.6f}', '-i', a.audio]
enc += ['-map', '0:v'] + (['-map', '1:a', '-c:a', 'aac', '-b:a', '256k', '-ar', '48000'] if has_audio else [])
enc += ['-vf', 'scale=out_color_matrix=bt709:out_range=tv,format=yuv420p', '-c:v', 'libx264', '-preset', a.preset, '-crf', a.crf,
        '-profile:v', 'high', '-x264-params', 'aq-mode=3', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709',
        '-color_range', 'tv', '-movflags', '+faststart', a.out]
S = Strip()
pd = subprocess.Popen(dec, stdout=subprocess.PIPE, bufsize=W * HH * 3 * 2)
pe = subprocess.Popen(enc, stdin=subprocess.PIPE)
FB = W * HH * 3
t_start = time.time()
for fi in range(f0, f1):
    raw = pd.stdout.read(FB)
    if len(raw) < FB: print(f'!! film ended early at frame {fi}'); break
    fr = np.frombuffer(raw, np.uint8).reshape(HH, W, 3).copy()
    rgb, al = S.frame(fi / FPS)
    b = fr[-SH:].astype(np.float32); al3 = al[..., None]
    fr[-SH:] = (b * (1 - al3) + rgb.astype(np.float32) * al3 + 0.5).astype(np.uint8)
    pe.stdin.write(fr.tobytes())
    if (fi - f0) % 300 == 0:
        el = time.time() - t_start; done = fi - f0 + 1
        print(f'frame {fi} / {f1}  {el:.0f}s  ({done / max(el, 1e-6):.1f} fps)', flush=True)
pe.stdin.close(); pe.wait(); pd.stdout.close(); pd.wait()
print('wrote', a.out, f1 - f0, 'frames', f'{time.time() - t_start:.0f}s')
