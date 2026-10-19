#!/usr/bin/env python3
"""v5 正片的乐谱带（画面底部 300 px）：钢琴卷帘向左滚动，红线 = 此刻（钢琴发声的时刻）。

  · 顶行：曲目 / 演奏者（Op.9 No.2 → Op.55 No.2），右侧金字 = 此刻在第几小节第几拍；
  · ▼ 行：画面事件，落在它对应的那个音上（红 = 共线/共点等“定理时刻”+钟声，蓝 = 提问 / 落在低音上，金 = 落在旋律上）；
  · 中间：右手旋律（金色 = 有画面事件的音），下面一条：左手低音（亮 = 每拍的低音）；
  · 底部：小节号 / 拍号刻度 / 乐句与和声标注；Op.55 No.2 的剪接点（第12小节 → 第39小节）用 ✂ 标出。

  模块：  from strip import Strip; S = Strip(); rgb, alpha = S.frame(tv)   # (300,1080,3) uint8 · (300,1080) float32
  命令行：python3 tools/strip.py stills 26.07,62.7 [--film]   → out/stills/strip_<t>.png（--film：叠在正片画面上）
"""
import json, re, subprocess, sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
FPS, W, H = 30, 1080, 300
PPS, PX, MARGIN = 150, 432, 4.0                 # 每秒 150 px；红线在 x = 432（看得到前方 4.3 s，身后 2.9 s）
FN = '/usr/share/fonts/google-noto-cjk/NotoSansSC-%s.otf'
def F(w, s): return ImageFont.truetype(FN % w, s)
f_xs, f_s, f_m, f_h, f_b = F('Medium', 15), F('Medium', 17), F('Medium', 19), F('Medium', 20), F('Bold', 23)
BG, HDR, LANE_M, LANE_B = (14, 22, 36), (10, 16, 28), (18, 28, 46), (16, 25, 41)
GRID, BARL = (38, 52, 76), (92, 110, 140)
GOLD, CREAM, GREY, RED, ICE, DIMN = (240, 196, 92), (238, 230, 214), (120, 132, 150), (236, 70, 90), (130, 210, 235), (92, 104, 124)
def mix(c, a, bg=BG): return tuple(int(round(c[i] * a + bg[i] * (1 - a))) for i in range(3))
def PR(s):
    if s and len(s) > 1 and s[1] in 'b#': return s[0] + ('♭' if s[1] == 'b' else '♯') + s[2:]
    return s
ACC = '♭♯♮'
def _segs(s):
    return [z for z in re.split('([♭♯♮])', s) if z]
_INK = {}
def ink(font, z):
    """真实的墨迹左右边界（CJK 字体里 ♭♯♮ 的 bbox = 全角宽度，不能用）。"""
    k = (font.path, font.size, z)
    if k not in _INK:
        im = Image.new('L', (font.size * 3, font.size * 3), 0)
        ImageDraw.Draw(im).text((font.size, 0), z, font=font, fill=255)
        b = im.getbbox(); _INK[k] = (b[0] - font.size, b[2] - font.size) if b else (0, 0)
    return _INK[k]
def _f2(font): return font.font_variant(size=max(8, int(round(font.size * 0.9))))
def tl(d, s, font):
    """文字宽度（♭♯♮ 紧排）。"""
    w = 0.0
    for z in _segs(s):
        if z in ACC: a, b = ink(_f2(font), z); w += (b - a) + 2
        else: w += d.textlength(z, font=font)
    return w
def tx(d, xy, s, font, fill):
    x, y = xy
    for z in _segs(s):
        if z in ACC:
            f2 = _f2(font); a, b = ink(f2, z)
            d.text((x - a + 0.5, y + (font.size - f2.size) * 0.45), z, font=f2, fill=fill); x += (b - a) + 2
        else:
            d.text((x, y), z, font=font, fill=fill); x += d.textlength(z, font=font)
    return x
Y_C0, Y_C1 = 47, 73                             # ▼ 两行
Y_MEL0, Y_MEL1 = 100, 206
Y_BAS0, Y_BAS1 = 210, 246
Y_RUL = 250

CM = json.load(open(ROOT / 'out' / 'cues_marks.json'))
MU = CM['music']; A_OFF, B_AT, SPL, DUR = MU['a_off'], MU['b_at'], MU['spl'], MU['dur']
SPLICE_V = B_AT + MU['cut'][0]                   # 剪接点在画面里的时刻（≈323.09 s）
def fade(tv): return min(1.0, max(0.0, (tv - (DUR - 0.6)) / 0.55)) + (1 - tv / 0.05 if tv < 0.05 else 0)   # 与 js/film.js 相同

SHORT = dict(circle0='画圆', circle1='圆闭合', cap_hex='连成六边形', v0='起笔', v6='闭合', q='有什么关系？', slice='红线切入', slam='共线！',
             cap_drag='随便拖', drag0='拖点4', drag0e='放下', drag1='拖点2', drag1e='放下', bar6='帕斯卡定理', cap_pascal2='1639年',
             a20='把点换成线', a24='6条切线', a28='交点换连线', q31='又会怎样？', slam32='共点！', drag3='拖点6', a36='布列安桑定理',
             a40='镜像双胞胎', a44='凭什么？', a48='升到三维！', a52='边翘起来', a55='照样相交', a60='小蛮腰', a64='直线织成',
             a67='金蓝交替', a72='空间对角线', q76='两两相交吗？', a80='先看25和36', a84='看4个端点', a88='延长23和56', a89='交于一点P',
             a90='看影子', a93='升得一样高', a96='定出平面', a100='都在平面上', a102='一定相交！', a106='再看36和14', a110='最后14和25',
             a114='两两相交', a118='围成三角形？', a121='一上一下！', ins0='俯视腰面', ins1='俯视 · 二', slam124='同一点！',
             a128='从上打光', a132='影子＝原图', a136='影子也共点', slam140='降维打击！', qed1='证毕',
             b144='第三幕', b148='引两条切线', b152='连切点', b156='P 的线', b160='P 往圆上走', b164='线＝切线！', b168='用坐标',
             b172='切点弦方程', b176='Q 在 P 的线上', q178='反过来呢？', b180='P 在 Q 的线上！', slam184='你⇔我！', b188='Q 滑动',
             b192='点⇔线', b196='回到六边形', b200='对边交点', b204='交于 B', slam208='帕斯卡成立！', b212='帕斯卡升维', b216='6条边',
             b220='三角面', b224='面↔边', b228='对边交点', b232='定出平面', b234='看这条棱', b238='交出对边', q239='穿过哪里？',
             b242='＝对边交点！', b245='同理', b249='两个平面上', b253='交成直线！', slam256='降维打击 2.0！', qed2='证毕', b260='两个定理',
             b264='片尾')
for i in range(6): SHORT[f'pt{i}'] = f'点{i + 1}'; SHORT[f'tan{i}'] = f'切线{i + 1}'; SHORT[f'wpop{i}'] = f'顶点{i + 1}'
for i in range(1, 6): SHORT[f'v{i}'] = f'笔到{i + 1}'
for k in range(3):
    c = '①②③'[k]; SHORT[f'pair{k}'] = f'对边{c}'; SHORT[f'ext{k}'] = f'延长{c}'; SHORT[f'x{k}'] = f'交点{c}'; SHORT[f'fly{k}'] = f'对角线{c}'
    SHORT[f'coda{k}'] = 'E♭'
SHORT['trace0'] = '描边'
for i in range(1, 7): SHORT[f'trace{i}'] = ''

# 乐句 / 和声标注：(曲目, 小节, 位置, 文字, 颜色)
ANN = [('A', 0, 11, '弱起', GREY), ('A', 1, 0, '主题 A', GOLD), ('A', 3, 0, '低音半音上行 B♭→B♮→C', ICE), ('A', 3, 9, '减七和弦', ICE),
       ('A', 4, 3, '属和弦（悬着）', ICE), ('A', 4, 6, '终止：回到主和弦 E♭', RED), ('A', 5, 0, 'A（再现 · 装饰更多）', GOLD),
       ('A', 9, 0, 'B（副旋律）· 属音持续', ICE), ('A', 13, 0, 'A（第三次）', GOLD), ('A', 17, 0, 'B', ICE), ('A', 21, 0, 'A（第四次）', GOLD),
       ('A', 25, 0, '尾声 C', ICE), ('A', 32, 0, '华彩 · senza tempo（无固定速度）', RED), ('A', 33, 0, '华彩落地 · 主和弦', GOLD),
       ('A', 34, 0, '终止和弦 E♭', GOLD),
       ('B', 1, 0, '第二首 · 主题（降E大调，12/8）', GOLD), ('B', 7, 0, '半音装饰', ICE), ('B', 12, 6, '终止', RED), ('B', 50, 0, '半音装饰', ICE),
       ('B', 52, 0, '颤音（第52–54小节）', ICE), ('B', 63, 2, '全曲最低音 E♭1', RED), ('B', 66, 2, '最后的和弦', GOLD)]


class Piece:
    def __init__(self, name):
        self.name = name
        M = json.load(open(ROOT / 'out' / ('score_map.json' if name == 'A' else 'score_map_op55.json')))
        if name == 'A': self.v = lambda t, bar: t - A_OFF; keep = lambda bar: True
        else: self.v = lambda t, bar: B_AT + t - (SPL if bar >= 39 else 0); keep = lambda bar: bar <= 12 or bar >= 39
        ons = [o for o in M['onsets'] if keep(o['bar'])]
        self.ons = ons
        self.mel = [(self.v(o['t_mel'], o['bar']), o['mel_p'], o['mel'], o['bar'], round(o['pos'], 3)) for o in ons if o['t_mel'] is not None]
        self.bas = [(self.v(o['t_bass'], o['bar']), o['bass_p'], o['bass'], o['bar'], round(o['pos'], 3)) for o in ons if o['t_bass'] is not None]
        cad = 32 if name == 'A' else None
        ax = lambda b, q: b * 12 + q + (36 if cad and b > cad else 0)          # 乐谱位置轴（八分音符；A 的华彩算 48 个）
        anc = {}
        for o in M['onsets']: anc.setdefault(ax(o['bar'], o['pos']), o['t'])
        for b, q, t in M['grid']: anc[ax(b, q)] = t
        ks = sorted(anc); kv = np.array(ks); tv_ = np.array([anc[k] for k in ks])
        g = {(b, q): t for b, q, t in M['grid']}
        nb = max(o['bar'] for o in M['onsets'])
        for b in range(1, nb + 1):
            if b == cad: continue
            for q in (0, 3, 6, 9):
                if (b, q) in g: continue
                a = ax(b, q); i = int(np.searchsorted(kv, a))
                if 0 < i < len(kv) and kv[i] - kv[i - 1] <= 9:
                    g[(b, q)] = float(tv_[i - 1] + (a - kv[i - 1]) / (kv[i] - kv[i - 1]) * (tv_[i] - tv_[i - 1]))
        self.grid = sorted(((b, q, self.v(t, b)) for (b, q), t in g.items() if keep(b)), key=lambda z: z[2])
        self.at = {}                              # (bar, pos) → video time of the onset
        for o in ons: self.at[(o['bar'], round(o['pos'], 3))] = self.v(o['t'], o['bar'])
        for b, q, t in self.grid: self.at.setdefault((b, round(q, 3)), t)
        self.pos = sorted([(self.v(o['t'], o['bar']), o['bar'], o['pos']) for o in ons] + [(t, b, q) for b, q, t in self.grid])
        self.cad = cad
        self.end = 261.6 if name == 'A' else DUR - 3.0          # 最后一个和弦一直延续到这里（A 的余音被 B 接过去；B 到片尾）
        lo, hi = min(p for _, p, *_ in self.mel), max(p for _, p, *_ in self.mel)
        self.ym = lambda p: (Y_MEL1 - 7) - (p - lo) / (hi - lo) * (Y_MEL1 - 7 - (Y_MEL0 + 27))
        lo2, hi2 = min(p for _, p, *_ in self.bas), max(p for _, p, *_ in self.bas)
        self.yb = lambda p: (Y_BAS1 - 6) - (p - lo2) / (hi2 - lo2) * (Y_BAS1 - 6 - (Y_BAS0 + 6))


class Strip:
    def __init__(self):
        self.P = {'A': Piece('A'), 'B': Piece('B')}
        self.RW = self.X(DUR) + (W - PX) + 16
        self.cues = []
        self._build()
        self.arr = np.asarray(self.roll, dtype=np.uint8)
        del self.roll
        x = np.arange(W)
        self.dim = (0.40 * np.clip((PX - 8 - x) / 70.0, 0, 1)).astype(np.float32)[None, :, None]   # 身后的部分逐渐压暗
        a = np.full(H, 0.94, np.float32); r = np.arange(12); a[:12] = 0.94 * (0.45 + 0.55 * (r / 11.0) ** 1.5)
        self.alpha0 = a[:, None]
        self.hdr = []                             # (t, text) 小节/拍
        for nm in 'AB':
            P = self.P[nm]
            for t, b, q in P.pos:
                if nm == 'A' and b == 0: s = '弱起'
                elif P.cad == b: s = f'第{b}小节 · 华彩'
                else: s = f'第{b}小节 · 第{int(q // 3) + 1}拍'
                self.hdr.append((t, s))
        self.hdr.sort(key=lambda z: z[0])
        self.hdr_t = np.array([z[0] for z in self.hdr])

    def X(self, tv): return int(round((tv + MARGIN) * PPS))

    def _build(self):
        RW = self.RW
        im = Image.new('RGB', (RW, H), BG); d = ImageDraw.Draw(im)
        self.roll = im
        d.rectangle([0, Y_MEL0, RW, Y_MEL1], fill=LANE_M); d.rectangle([0, Y_BAS0, RW, Y_BAS1], fill=LANE_B)
        X = self.X
        # ---- grid / ruler
        for nm, P in self.P.items():
            for b, q, tv in P.grid:
                if q % 3: continue
                x = X(tv); down = q == 0
                if nm == 'A' and b == 0:
                    d.line([x, Y_MEL0, x, Y_RUL + 8], fill=GRID, width=1); continue
                d.line([x, Y_C0 + 2 if down else Y_MEL0, x, Y_RUL + (22 if down else 8)], fill=BARL if down else GRID, width=2 if down else 1)
                if down: d.text((x + 5, Y_RUL), f'第{b}小节', font=f_m, fill=CREAM)
                else: d.text((x + 4, Y_RUL + 3), f'{q // 3 + 1}', font=f_xs, fill=GREY)
            if P.cad:
                c0 = min(t for (b, q), t in P.at.items() if b == P.cad)
                x = X(c0)
                d.line([x, Y_C0 + 2, x, Y_RUL + 22], fill=BARL, width=2)
                d.text((x + 5, Y_RUL), f'第{P.cad}小节', font=f_m, fill=CREAM)
        # 剪接点
        xs = X(SPLICE_V)
        for y in range(Y_C0, H, 10): d.line([xs, y, xs, y + 5], fill=RED, width=2)
        # ---- annotations
        for nm, b, q, s, col in ANN:
            tv = self.P[nm].at.get((b, round(q, 3)))
            if tv is None: print('!! annotation not found', nm, b, q); continue
            tx(d, (X(tv) + 6, Y_RUL + 25), s, f_xs, col)
        d.text((xs + 6, Y_RUL + 25), '✂ 剪接：第12小节 → 第39小节', font=f_xs, fill=RED)
        # ---- hot notes
        hot = {}
        for mk in CM['marks']:
            pc = mk.get('piece', 'A'); key = (pc, mk['bar'], round(mk['pos'], 3))
            hot.setdefault(key, set()).add(mk['voice'])
        # ---- melody
        for nm, P in self.P.items():
            mel = P.mel; last_end = -1e9
            hx = [X(t) for t, p, n, b, q in mel if 'mel' in hot.get((nm, b, q), ()) or 'any' in hot.get((nm, b, q), ())]
            hi_ = 0
            for i, (tv, p, n, b, q) in enumerate(mel):
                nx = mel[i + 1][0] if i + 1 < len(mel) else P.end
                h = hot.get((nm, b, q), set()); is_hot = 'mel' in h or 'any' in h
                x0 = X(tv); x1 = max(x0 + 6, min(X(nx) - 3, X(tv + 2.5) if i + 1 < len(mel) else X(nx))); y = P.ym(p)
                d.rounded_rectangle([x0, y - 5, x1, y + 5], radius=4, fill=GOLD if is_hot else DIMN)
                s = PR(n); fnt = f_m if is_hot else f_xs
                w = tl(d, s, fnt)
                while hi_ < len(hx) and hx[hi_] <= x0: hi_ += 1
                nxt_hot = hx[hi_] if hi_ < len(hx) else 1e12
                if is_hot:
                    dy = -24 if x0 > last_end + 2 else 7
                    tx(d, (x0, y + dy), s, fnt, GOLD); last_end = x0 + w if dy < 0 else last_end
                elif x0 > last_end + 5 and x0 + w + 5 < nxt_hot and x1 - x0 > 14:
                    tx(d, (x0, y - 20), s, fnt, GREY); last_end = x0 + w
        # ---- bass
        for nm, P in self.P.items():
            bas = P.bas; beats = [z for z in bas if abs(z[4] % 3) < 1e-6]; last_end = -1e9
            for i, (tv, p, n, b, q) in enumerate(bas):
                beat = abs(q % 3) < 1e-6
                h = hot.get((nm, b, q), set()); is_hot = 'bass' in h or 'any' in h
                x0, y = X(tv), P.yb(p)
                nb = next((z[0] for z in beats if z[0] > tv + 1e-6), tv + 2.0)
                w0 = min(40, max(10, X(nb) - x0 - 4)) if beat else 12
                if i == len(bas) - 1: w0 = X(P.end) - x0
                d.rounded_rectangle([x0, y - 3, x0 + w0, y + 3], radius=3, fill=ICE if is_hot else (150, 170, 200) if beat else (66, 78, 100))
                if beat or is_hot:
                    s = PR(n); fnt = f_s if is_hot else f_xs; w = tl(d, s, fnt)
                    if is_hot or (x0 + w0 + 3 > last_end + 4 and X(nb) > x0 + w0 + w + 8):
                        tx(d, (x0 + w0 + 3, y - 11), s, fnt, ICE if is_hot else (150, 170, 200)); last_end = x0 + w0 + 3 + w
        d.text((X(-MARGIN) + 6, Y_MEL0 + 2), '', font=f_xs, fill=GREY)
        # ---- cue markers
        last = [-1e9, -1e9]
        for mk in sorted(CM['marks'], key=lambda m: m['t']):
            k = mk['key']; pc = mk.get('piece', 'A'); tv = mk['t']; x = X(tv)
            s = SHORT.get(k)
            if s is None:
                g = re.findall('「([^」]*)」', mk['vis']); s = (g[0] if g else mk['vis']).split(' · ')[0][:8]
            col = RED if k.startswith('slam') else ICE if (k[0] == 'q' and not k.startswith('qed')) or mk['voice'] != 'mel' else GOLD
            w = tl(d, s, f_s) if s else 0
            row = 0 if x - 8 > last[0] else 1 if x - 8 > last[1] else -1
            if row < 0: row, s = (0 if last[0] < last[1] else 1), ''
            if s: last[row] = x + 9 + w
            y = (Y_C0, Y_C1)[row]
            P = self.P[pc]; key = (mk['bar'], round(mk['pos'], 3))
            if mk['voice'] == 'mel':
                n = next((z for z in P.mel if (z[3], z[4]) == key), None); yt = P.ym(n[1]) - 6 if n else Y_MEL1
            else:
                n = next((z for z in P.bas if (z[3], z[4]) == key), None); yt = P.yb(n[1]) - 4 if n else Y_BAS1
            d.line([x, y + 10, x, yt], fill=mix(col, 0.42, LANE_M), width=1)
            d.polygon([(x - 6, y), (x + 6, y), (x, y + 10)], fill=col)
            if s: tx(d, (x + 9, y - 6), s, f_s, col)
            self.cues.append((tv, x, y, w, col, k))
        self.cue_t = np.array([c[0] for c in self.cues])

    def frame(self, tv):
        x0 = self.X(tv) - PX
        a = self.arr[:, x0:x0 + W].astype(np.float32)
        bg = np.array(BG, np.float32)[None, None, :]
        a = a * (1 - self.dim) + bg * self.dim
        im = Image.fromarray(a.astype(np.uint8)); d = ImageDraw.Draw(im)
        # 刚触发的事件：发光框
        for i in np.nonzero((tv - self.cue_t >= 0) & (tv - self.cue_t < 0.5))[0]:
            ct, cx, cy, w, col, k = self.cues[i]
            u = (tv - ct) / 0.5; al = (1 - u) ** 1.5
            xx = cx - x0
            big = 6 if k.startswith('slam') else 3
            if w: d.rounded_rectangle([xx - 10 - big, cy - 7 - big, xx + 12 + w + big, cy + 18 + big], radius=8, outline=mix(col, al), width=2)
            else: d.ellipse([xx - 10, cy - 6, xx + 10, cy + 14], outline=mix(col, al), width=2)
        # 顶行
        d.rectangle([0, 0, W, 40], fill=HDR)
        ua = min(1.0, max(0.0, (tv - (B_AT + 0.2)) / 0.4)); ub = min(1.0, max(0.0, (tv - (B_AT + 0.6)) / 0.5))
        tA = '♪ 肖邦 · 降E大调夜曲 Op.9 No.2 · 演奏 Frank Levy'; tB = '♪ 肖邦 · 降E大调夜曲 Op.55 No.2 · 演奏 Xuan He'
        if ua < 1: tx(d, (14, 8), tA, f_h, mix(CREAM, 1 - ua, HDR))
        if ub > 0: tx(d, (14, 8), tB, f_h, mix(CREAM, ub, HDR))
        uo = min(1.0, max(0.0, (tv - 6.0) / 0.4)); ul = min(1.0, max(0.0, (tv - 6.4) / 0.4))   # 开头 6 s：右上角先说明怎么看
        if uo < 1:
            s = '红线 = 此刻 · ▼ = 画面事件'
            tx(d, (W - 16 - tl(d, s, f_h), 8), s, f_h, mix(GOLD, 1 - uo, HDR))
        i = int(np.searchsorted(self.hdr_t, tv + 1e-6)) - 1
        if i >= 0 and ul > 0:
            s = self.hdr[i][1]
            wv = d.textlength(s, font=f_b)
            d.text((W - 16 - wv, 5), s, font=f_b, fill=mix(GOLD, ul, HDR))
        for y, s in ((Y_MEL0 + 3, '旋律'), (Y_BAS0 + 3, '低音')):
            d.rounded_rectangle([4, y - 1, 44, y + 19], radius=5, fill=(12, 19, 32))
            d.text((9, y), s, font=f_xs, fill=GREY)
        # 红线 = 此刻
        d.line([PX - 3, 42, PX - 3, H], fill=mix(RED, 0.3), width=1); d.line([PX + 3, 42, PX + 3, H], fill=mix(RED, 0.3), width=1)
        d.line([PX, 42, PX, H], fill=RED, width=3)
        d.polygon([(PX - 7, 41), (PX + 7, 41), (PX, 50)], fill=RED)
        rgb = np.asarray(im, dtype=np.uint8)
        alpha = self.alpha0 * np.float32(1 - min(1.0, fade(tv)))
        return rgb, np.broadcast_to(alpha, (H, W))


def film_frame(tv):
    """正片画面（out/F_0.mkv / F_1.mkv）里时刻 tv 的那一帧（RGB）。"""
    fi = int(round(tv * FPS)); n0 = 6825
    src, ff = ('out/F_0.mkv', fi) if fi < n0 else ('out/F_1.mkv', fi - n0)
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-ss', f'{ff / FPS:.4f}', '-i', str(ROOT / src), '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'],
                         capture_output=True).stdout
    return np.frombuffer(raw, np.uint8).reshape(1920, W, 3) if len(raw) == 1920 * W * 3 else None


def composite(film, rgb, alpha):
    out = film.copy()
    b = out[-H:].astype(np.float32); a = alpha[..., None]
    out[-H:] = (b * (1 - a) + rgb.astype(np.float32) * a + 0.5).astype(np.uint8)
    return out


if __name__ == '__main__':
    if len(sys.argv) > 2 and sys.argv[1] == 'stills':
        S = Strip()
        print('roll', S.RW, 'px,', len(S.cues), 'cues')
        od = ROOT / 'out' / 'stills'; od.mkdir(parents=True, exist_ok=True)
        for t in map(float, sys.argv[2].split(',')):
            rgb, al = S.frame(t)
            if '--film' in sys.argv:
                fr = film_frame(t)
                if fr is None: print('no film frame at', t); fr = np.zeros((1920, W, 3), np.uint8)
                Image.fromarray(composite(fr, rgb, al)).save(od / f'strip_{t:.2f}.png')
            else:
                Image.fromarray(rgb).save(od / f'strip_{t:.2f}.png')
            print('wrote', od / f'strip_{t:.2f}.png')
