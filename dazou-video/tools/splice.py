#!/usr/bin/env python3
"""把局部重渲染的片段拼回无损母版，再编码成成片（省掉整片重渲染的 20 分钟）。

  node render.mjs video --from 30.8 --to 34.1 --workers 3 --prefix patchA_ --segonly
  python3 tools/splice.py 924:1023:patchA_ [更多 f0:f1:prefix ...]

母版 out/full_lossless.mkv（ffv1，全片 1428 帧）会被原地更新；随后输出
out/video_silent.mp4 与混入 out/audio_master.wav 的 out/video.mp4（编码参数与 render.mjs 相同）。
"""
import subprocess, sys
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / 'out'
FPS, TOTAL = 30, 1428
ff = lambda *a: subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', *a], check=True)

patches = sorted((int(a), int(b), p) for a, b, p in (s.split(':') for s in sys.argv[1:]))
base = OUT / 'full_lossless.mkv'
inputs, chains, labels, cur, k = ['-i', str(base)], [], [], 0, 0
pieces = []
for i, (f0, f1, pre) in enumerate(patches):
    lst = OUT / f'{pre}list.txt'
    segs = sorted(OUT.glob(f'{pre}[0-9]*.mkv'))
    lst.write_text('\n'.join(f"file '{s}'" for s in segs))
    inputs += ['-f', 'concat', '-safe', '0', '-i', str(lst)]
    if f0 > cur: pieces.append(('base', cur, f0))
    pieces.append((i + 1, f0, f1)); cur = f1
if cur < TOTAL: pieces.append(('base', cur, TOTAL))
nb = sum(1 for p in pieces if p[0] == 'base')
g = [f"[0:v]split={nb}" + ''.join(f'[b{j}]' for j in range(nb))] if nb > 1 else []
j = 0
for n, (src, a, b) in enumerate(pieces):
    if src == 'base':
        g.append(f"[{'b%d' % j if nb > 1 else '0:v'}]trim=start_frame={a}:end_frame={b},setpts=PTS-STARTPTS[p{n}]"); j += 1
    else:
        g.append(f"[{src}:v]setpts=PTS-STARTPTS[p{n}]")
g.append(''.join(f'[p{n}]' for n in range(len(pieces))) + f"concat=n={len(pieces)}:v=1:a=0[v]")
tmp = OUT / 'full_lossless.new.mkv'
ff(*inputs, '-filter_complex', ';'.join(g), '-map', '[v]', '-r', str(FPS), '-c:v', 'ffv1', '-level', '3', '-pix_fmt', 'yuv444p', str(tmp))
tmp.replace(base)
silent, final = OUT / 'video_silent.mp4', OUT / 'video.mp4'
ff('-i', str(base), '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-movflags', '+faststart', '-r', str(FPS), str(silent))
audio = OUT / 'audio_master.wav'
if audio.exists():
    ff('-i', str(silent), '-i', str(audio), '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '256k', '-ar', '48000', '-shortest', '-movflags', '+faststart', str(final))
print('pieces:', pieces, '->', final if audio.exists() else silent)
