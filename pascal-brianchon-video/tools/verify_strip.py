#!/usr/bin/env python3
"""v5 核验版：样片下方加一条“乐谱带”（钢琴卷帘），可以逐帧核对：画面事件 ↔ 乐谱里的哪个音。

  python3 tools/verify_strip.py out/v5_sample.mp4 out/v5_sample_check.mp4

乐谱带（向左滚动，红色竖线 = 此刻）：
  · 上排：画面事件（▼ + 名称），落在它所对应的那个音上；
  · 中间：右手旋律（Levy 实际弹奏的时刻 · 音名），金色 = 有画面事件的音；
  · 下排：左手低音（深色 = 每拍的低音，浅色 = 伴奏和弦）；
  · 底部：小节号 / 拍号刻度 / 乐句与和声的分析标注。
"""
import json, subprocess, sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
SRC, DST = sys.argv[1], sys.argv[2]
M = json.load(open(ROOT / 'out' / 'score_map.json')); CM = json.load(open(ROOT / 'out' / 'cues_marks.json'))
OFF = CM['offset']
probe = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', SRC], capture_output=True, text=True)
DUR = float(probe.stdout.strip()); FPS = 30; NF = int(round(DUR * FPS))
W, H, PPS, PX = 1080, 420, 150, 540             # strip size, pixels per second, playhead x
MARGIN = 5.0
X = lambda tv: int(round((tv + MARGIN) * PPS))
RW = X(DUR + MARGIN)
FN = '/usr/share/fonts/google-noto-cjk/NotoSansSC-%s.otf'
f_s, f_m, f_b, f_l = (ImageFont.truetype(FN % 'Medium', 19), ImageFont.truetype(FN % 'Medium', 22),
                      ImageFont.truetype(FN % 'Bold', 26), ImageFont.truetype(FN % 'Bold', 30))
BG, GRID, BARL = (14, 22, 36), (40, 54, 78), (92, 110, 140)
GOLD, CREAM, GREY, RED, ICE = (240, 196, 92), (238, 230, 214), (120, 132, 150), (236, 70, 90), (130, 210, 235)
PR = lambda s: s.replace('b', '♭') if len(s) > 1 and s[1] == 'b' else s
# lanes
Y_CUE0, Y_MEL0, Y_MEL1, Y_BAS0, Y_BAS1, Y_RUL = 52, 128, 288, 296, 352, 360
ons = [o for o in M['onsets'] if o['t'] - OFF < DUR + MARGIN and o['bar'] <= 7]
mel = [(o['t_mel'] - OFF, o['mel_p'], o['mel'], o['bar'], o['pos']) for o in ons if o['t_mel'] is not None]
bas = [(o['t_bass'] - OFF, o['bass_p'], o['bass'], abs(o['pos'] % 3) < 1e-6) for o in ons if o['t_bass'] is not None]
marks = CM['marks']
used = {(mk['bar'], round(mk['pos'], 3)) for mk in marks if mk['voice'] == 'mel'}
usedb = {(mk['bar'], round(mk['pos'], 3)) for mk in marks if mk['voice'] != 'mel'}
pm0, pm1 = min(p for _, p, *_ in mel) - 1, max(p for _, p, *_ in mel) + 1
ym = lambda p: Y_MEL1 - (p - pm0) / (pm1 - pm0) * (Y_MEL1 - Y_MEL0 - 18) - 9
pb0, pb1 = min(p for _, p, *_ in bas) - 1, max(p for _, p, *_ in bas) + 1
yb = lambda p: Y_BAS1 - (p - pb0) / (pb1 - pb0) * (Y_BAS1 - Y_BAS0 - 8) - 4
# beats: bar b, eighth pos q → video time (onsets on the grid)
grid = {(b, q): t - OFF for b, q, t in M['grid']}
ROLL = Image.new('RGB', (RW, H), BG); d = ImageDraw.Draw(ROLL)
d.rectangle([0, Y_MEL0 - 6, RW, Y_MEL1 + 4], fill=(18, 28, 46)); d.rectangle([0, Y_BAS0, RW, Y_BAS1 + 2], fill=(16, 25, 41))
for (b, q), tv in grid.items():
    if q % 3: continue
    x = X(tv); down = q == 0
    d.line([x, Y_CUE0 + 40 if down else Y_MEL0, x, Y_RUL + (26 if down else 10)], fill=BARL if down else GRID, width=2 if down else 1)
    if down: d.text((x + 5, Y_RUL + 4), f'第{b}小节', font=f_m, fill=CREAM)
    else: d.text((x + 4, Y_RUL + 4), f'{q // 3 + 1}', font=f_s, fill=GREY)
# phrase + harmony annotations (bar, pos, text, colour)
ANN = [(0, 11, '弱起', GREY), (1, 0, '乐句 A（主题，第1–4小节）', GOLD), (3, 0, '低音半音上行 B♭→B♮→C', ICE), (3, 9, '减七和弦（最紧张）', ICE),
       (4, 3, '属 B♭（悬着）', ICE), (4, 6, '终止：回到主 E♭', RED), (4, 11, '弱起', GREY), (5, 0, '乐句 A′（主题再现，装饰更多）', GOLD)]
for b, q, s, col in ANN:
    o = next((o for o in ons if o['bar'] == b and abs(o['pos'] - q) < 1e-6), None)
    if o: d.text((X(o['t'] - OFF) + 6, Y_RUL + 30), s, font=f_s, fill=col)
# melody notes
for i, (tv, p, nm, b, q) in enumerate(mel):
    nx = mel[i + 1][0] if i + 1 < len(mel) else tv + 1.0
    hot = (b, round(q, 3)) in used
    x0, x1, y = X(tv), max(X(tv) + 6, X(nx) - 3), ym(p)
    d.rounded_rectangle([x0, y - 7, x1, y + 7], radius=5, fill=GOLD if hot else (96, 108, 128))
    d.text((x0 + 2, y - 33), PR(nm), font=f_m if hot else f_s, fill=GOLD if hot else GREY)
for tv, p, nm, beat in bas:
    x0, y = X(tv), yb(p)
    d.rounded_rectangle([x0, y - 4, x0 + (40 if beat else 14), y + 4], radius=3, fill=(150, 170, 200) if beat else (70, 82, 104))
    if beat: d.text((x0 + 44, y - 13), PR(nm), font=f_s, fill=(150, 170, 200))
d.text((8, Y_MEL0 - 4), '旋律', font=f_s, fill=GREY); d.text((8, Y_BAS0 + 2), '低音', font=f_s, fill=GREY)
SHORT = dict(circle0='画圆', circle1='圆闭合', cap_hex='字幕②', v0='起笔', v6='六边形闭合', q='提问', slice='红线切入', slam='共线！',
             cap_drag='副字幕', drag0='拖点4', drag0e='放下', drag1='拖点2', drag1e='放下', bar6='（样片后）')
for i in range(6): SHORT[f'pt{i}'] = f'点{i + 1}'
for i in range(1, 6): SHORT[f'v{i}'] = f'笔到{i + 1}'
for k in range(3): SHORT[f'pair{k}'] = f'对边{"①②③"[k]}'; SHORT[f'ext{k}'] = f'延长{"①②③"[k]}'; SHORT[f'x{k}'] = f'交点{"①②③"[k]}'
cues = []
last = [-1e9, -1e9]
for mk in marks:
    tv = mk['t']; x = X(tv); s = SHORT.get(mk['key'], mk['key'])
    row = 0 if x - last[0] > 96 else 1 if x - last[1] > 96 else 0
    last[row] = x + len(s) * 20
    y = Y_CUE0 + row * 30
    col = RED if mk['key'] in ('slam', 'slice') else GOLD if mk['voice'] == 'mel' else ICE
    d.polygon([(x - 7, y + 4), (x + 7, y + 4), (x, y + 15)], fill=col)
    d.line([x, y + 15, x, Y_BAS1 if mk['voice'] != 'mel' else Y_MEL1], fill=col, width=1)
    d.text((x + 9, y - 6), s, font=f_s, fill=col)
    cues.append((tv, s, col))
# legend / header (static parts are drawn per frame)
enc = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-i', SRC, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-',
                        '-filter_complex', '[0:v][1:v]vstack=inputs=2[v]', '-map', '[v]', '-map', '0:a', '-c:v', 'libx264', '-preset', 'medium',
                        '-crf', '19', '-pix_fmt', 'yuv420p', '-c:a', 'copy', '-movflags', '+faststart', DST], stdin=subprocess.PIPE)
def where(tv):
    best = None
    for (b, q), t in grid.items():
        if t <= tv + 1e-6 and (best is None or t > best[2]): best = (b, q, t)
    return best
for fi in range(NF):
    tv = fi / FPS
    fr = ROLL.crop((X(tv) - PX, 0, X(tv) - PX + W, H)); dd = ImageDraw.Draw(fr)
    dd.rectangle([0, 0, W, 44], fill=(10, 16, 28))
    dd.text((12, 6), '核验版 · 下方乐谱带向左滚动，红线 = 此刻', font=f_m, fill=CREAM)
    w = where(tv)
    if w:
        b, q, _ = w
        dd.text((W - 400, 4), f'第{b}小节 · 第{q // 3 + 1}拍', font=f_b, fill=GOLD)
    dd.text((W - 92, 9), f'{tv:5.2f}s', font=f_s, fill=GREY)
    # the cue that just fired: glow
    for ct, s, col in cues:
        if 0 <= tv - ct < 0.45:
            a = 1 - (tv - ct) / 0.45
            x = PX + int((ct - tv) * PPS)
            dd.rounded_rectangle([x - 4, Y_CUE0 - 10, x + 30 + 20 * len(s), Y_CUE0 + 50], radius=8, outline=tuple(int(c * a + 14 * (1 - a)) for c in col), width=3)
    dd.line([PX, 46, PX, H], fill=RED, width=3)
    enc.stdin.write(fr.tobytes())
enc.stdin.close(); enc.wait()
print('wrote', DST, NF, 'frames')
