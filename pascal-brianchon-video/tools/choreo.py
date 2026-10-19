#!/usr/bin/env python3
"""v5 · 编舞表：每个画面事件 ← 乐谱里的哪一个音（小节 · 拍位 · 声部）→ js/cues.js

  python3 tools/score_align.py && python3 tools/choreo.py

原则（按音乐的层级来分配画面的层级，而不是哪里响就卡哪里）：
  · 乐句（4 小节）= 一个完整的“几何句子”：搭建 → 提问 → 结论；结论（共线）落在乐句的终止式上（属 → 主）。
  · 强拍 / 低音（左手每小节 4 个附点四分拍）= 结构性的动作：对边亮起、字幕换页。
  · 旋律音（右手）= 会“唱”的动作：点一个个出现、笔走过六边形的每个顶点、交点弹出。
  · 左手八分音符（伴奏）= 最轻的动作：三条延长线依次起步。
  · 长音 / 终止之后 = 静止与呼吸，不安排新事件。
  · 时刻全部取自 Levy 的实际演奏（含 rubato、左右手错开），画面比声音早 LEAD 落下。
"""
import json, os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
M = json.load(open(os.path.join(ROOT, 'out', 'score_map.json')))
OFF = 0.9      # 录音开头 1.1 s 是静音：剪掉 0.9 s，第一声（弱起 B♭4）在画面 0.22 s
LEAD = 0.025   # 画面比声音早 25 ms
RNAT = 1.4 * 0.73742   # “自然速度”：1 个剧情拍 = 1.03 s（与 v3/v4 第一幕相同），点、字幕等的弹出动画都按这个速度播放
IDX = {(o['bar'], round(o['pos'], 3)): o for o in M['onsets']}

def m(bar, pos, voice='mel'):
    o = IDX[(bar, round(float(pos), 3))]
    t = o['t_mel'] if voice == 'mel' and o['t_mel'] is not None else o['t_bass'] if voice == 'bass' and o['t_bass'] is not None else o['t']
    return round(t - OFF, 3)

def note(bar, pos, voice):
    o = IDX[(bar, round(float(pos), 3))]
    return (o['mel'] if voice == 'mel' else o['bass'] if voice == 'bass' else None) or '+'.join(o['n'])

# key, design beat, (bar, pos, voice), 画面, 音乐
ROWS = [
    ('circle0', -0.582, (0, 11, 'mel'), '圆开始画', '弱起 B♭4（第一声，预备）'),
    ('circle1', 0.096, (1, 0, 'bass'), '圆闭合 · 字幕「圆上随便取6个点」', '第1小节强拍 · 低音 E♭2'),
    ('pt0', 0.6, (1, 0, 'mel'), '点1', '旋律 G5（比低音晚 0.17 s）'),
    ('pt1', 1.0, (1, 4, 'mel'), '点2', '旋律 F5'),
    ('pt2', 1.4, (1, 5, 'mel'), '点3', '旋律 G5'),
    ('pt3', 1.8, (1, 6, 'mel'), '点4', '旋律 F5 · 第3拍'),
    ('pt4', 2.2, (1, 9, 'mel'), '点5', '旋律 E♭5 · 第4拍'),
    ('pt5', 2.6, (1, 11, 'mel'), '点6', '旋律 B♭4（弱起）'),
    ('cap_hex', 4.0, (2, 0, 'bass'), '字幕「按顺序连成六边形」', '第2小节强拍 · 低音 C2'),
    ('v0', 4.2, (2, 0, 'mel'), '一笔画：从点1起笔', '旋律 G5'),
    ('v1', 4.2 + 1.4 / 6, (2, 2, 'mel'), '笔到点2', '旋律 C5'),
    ('v2', 4.2 + 2.8 / 6, (2, 3, 'mel'), '笔到点3', '旋律 C6（八度大跳）'),
    ('v3', 4.9, (2, 5, 'mel'), '笔到点4', '旋律 G5'),
    ('v4', 4.2 + 5.6 / 6, (2, 6, 'mel'), '笔到点5', '旋律 B♭5 · 第3拍'),
    ('v5', 4.2 + 7.0 / 6, (2, 9, 'mel'), '笔到点6', '旋律 A♭5 · 第4拍'),
    ('v6', 5.6, (2, 11, 'mel'), '回到点1 · 六边形闭合', '旋律 G5（弱起）'),
    ('pair0', 6.2, (3, 0, 'bass'), '对边①亮 · 字幕「六边形有3组对边」', '第3小节第1拍 · 低音 B♭2'),
    ('pair1', 6.8, (3, 3, 'bass'), '对边②亮 · 副字幕', '第2拍 · 低音 B♮2（半音上行）'),
    ('pair2', 7.4, (3, 6, 'bass'), '对边③亮', '第3拍 · 低音 C3（继续上行）'),
    ('ext0', 8.0, (3, 9, 'bass'), '对边①开始延长 · 字幕「把每组对边延长」', '第4拍 · 低音 A2（减七和弦）'),
    ('ext1', 8.05, (3, 10, 'any'), '对边②开始延长', '左手八分音'),
    ('ext2', 8.1, (3, 11, 'any'), '对边③开始延长', '左手八分音'),
    ('x0', 9.0, (4, 0, 'mel'), '交点 X₁ · 副字幕「每组都交出1个点」', '第4小节第1拍 · B♭4（属和弦）'),
    ('x1', 10.0, (4, 1, 'mel'), '交点 X₂', '旋律 D6（整句最高音）'),
    ('x2', 11.0, (4, 2, 'mel'), '交点 X₃', '旋律 C6'),
    ('q', 11.15, (4, 3, 'bass'), '提问「这3个交点 · 有什么关系？」', '第2拍 · 低音 B♭1（全句最低音，属音悬着）'),
    ('slice', 11.8, (4, 5.5, 'mel'), '红线切入', '导音 D5'),
    ('slam', 12.0, (4, 6, 'mel'), '共线！「竟然在一条直线上！」· 钟声', '第3拍 · E♭5 + E♭2：回到主和弦（终止式）'),
    ('cap_drag', 13.0, (4, 11, 'mel'), '副字幕「随便拖 · 永远共线」', '弱起 B♭4 → 主题再现 A′'),
    ('drag0', 13.4, (5, 0, 'mel'), '拖动点4', '第5小节 · G5（A′ 开始）'),
    ('drag0e', 14.4, (5, 3, 'mel'), '点4 放下', '旋律 F5（装饰音型开始）'),
    ('drag1', 14.8, (5, 4, 'mel'), '拖动点2', '旋律 F5（回音型的后半）'),
    ('drag1e', 15.6, (5, 6, 'mel'), '点2 放下', '旋律 F5 · 第3拍'),
    ('bar6', 16.0, (6, 0, 'bass'), '（样片之后）「帕斯卡定理」', '第6小节'),
]
CUE = {}; KN = [[-0.48906 / 0.73742, 0.0]]   # film start: story beat NV0 at t = 0
MARKS = []
for key, n, (b, q, v), vis, mus in ROWS:
    t = m(b, q, v)
    hit = round(t - LEAD, 3) if key not in ('circle0',) else t
    CUE[key] = hit
    KN.append([round(n, 4), hit])
    MARKS.append(dict(key=key, t=t, bar=b, pos=q, voice=v, note=note(b, q, v), vis=vis, mus=mus))
# per-element extras
CUE['circle'] = [CUE['circle0'], CUE['circle1']]
CUE['pt'] = [CUE[f'pt{i}'] for i in range(6)]
CUE['stroke'] = [CUE[f'v{i}'] for i in range(7)]
CUE['pair'] = [CUE[f'pair{i}'] for i in range(3)]
CUE['ext'] = [[CUE[f'ext{k}'], CUE[f'x{k}']] for k in range(3)]
CUE['x'] = [CUE[f'x{k}'] for k in range(3)]
# caption → [real time it lands, real time its exit starts]. A caption leaves 0.2 s before the next one in its slot
# lands (the 0.18 s drop-out ends on the beat); the answer "slams" in so that it LANDS on the cadence note.
SLAMD = 0.3 * 1.4          # slamIn lasts 0.3 story-seconds = 0.42 s real
CAPS = {
    '圆上随便取[6]个点': [CUE['circle1'], CUE['cap_hex'] - 0.2],
    '按顺序连成[六边形]': [CUE['cap_hex'], CUE['pair0'] - 0.2],
    '六边形有[3组对边]': [CUE['pair0'], CUE['ext0'] - 0.2],
    '面对面的两条边 · 同色为一组': [CUE['pair1'], CUE['x0'] - 0.2],
    '把每组对边[延长]': [CUE['ext0'], CUE['q'] - 0.2],
    '每组都交出1个点': [CUE['x0'], CUE['slice'] - 0.15],
    '这3个交点 · 有什么关系？': [CUE['q'], CUE['slice'] - 0.15],
    '竟然在[一条直线]上！': [CUE['slam'] - SLAMD, CUE['bar6'] - 0.2],
    '随便拖 · 永远共线': [CUE['cap_drag'], CUE['bar6'] - 0.2],
}
CAPS = {k: [round(a, 3), round(b, 3)] for k, (a, b) in CAPS.items()}
KN.sort()
assert all(KN[i + 1][0] > KN[i][0] and KN[i + 1][1] > KN[i][1] for i in range(len(KN) - 1)), KN
# monotone cubic (Fritsch–Carlson) slopes for the knots
xs = [k[0] for k in KN]; ys = [k[1] for k in KN]
d = [(ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]) for i in range(len(xs) - 1)]
ms = [d[0]] + [0.0 if d[i - 1] * d[i] <= 0 else 3 * (xs[i + 1] - xs[i - 1]) / ((2 * xs[i + 1] - xs[i] - xs[i - 1]) / d[i - 1] + (xs[i + 1] + xs[i] - 2 * xs[i - 1]) / d[i]) for i in range(1, len(xs) - 1)] + [d[-1]]
KD = [[xs[i], ys[i], round(ms[i], 5)] for i in range(len(xs))]
# the one chime: on the cadence (E♭ major), at the note itself (not early)
CHIMES = [dict(t=m(4, 6, 'mel'), midi=[87, 94], label='共线 · E♭6+B♭6（主和弦）')]


# ================================================================== v5 · 全片（第 6 小节以后）
# 片子被锚点切成一段一段：每个锚点 = 一个设计好的画面时刻 ← 乐谱里的一个音（第几小节 · 第几拍 · 哪个声部）。
# 两个锚点之间，动画按自然速度 × α 播放，老师式停顿 × β（js/scene.js 求 α、β：先让停顿去吸收快慢，动画尽量不变速）。
# 配乐 B（Op. 55 No. 2）剪成 B[0, 60.89] + B[176.84, 结尾]：第 12 小节的终止式 ≈ 第 38 小节的终止式，
# 第 13 小节与第 39 小节是同一句的开头（D♭5 C5 B4），所以从第 12 小节直接接到第 39 小节，听不出接缝。
MB = json.load(open(os.path.join(ROOT, 'out', 'score_map_op55.json')))
IDXB = {(o['bar'], round(o['pos'], 3)): o for o in MB['onsets']}
B_AT = 262.2                 # B 的第 0 秒在画面的这一刻（第一个音 B♭5 = 文件 1.32 s → 画面 263.52 s = 第三幕开场）
CUT = (60.89, 176.84)        # 剪接点（两处都在下一小节起音前 0.15 s 的呼吸里）
SPL = round(CUT[1] - CUT[0], 3)
B_END = 306.62               # B 的最后一个音的余音收尾（文件时间）
TAIL = 2.1
def mb(bar, pos, voice='any'):
    o = IDXB[(bar, round(float(pos), 3))]
    t = o['t_mel'] if voice == 'mel' and o['t_mel'] is not None else o['t_bass'] if voice == 'bass' and o['t_bass'] is not None else o['t']
    return round(B_AT + t - (SPL if bar >= 39 else 0), 3)
def noteB(bar, pos, voice):
    o = IDXB[(bar, round(float(pos), 3))]
    return (o['mel'] if voice == 'mel' else o['bass'] if voice == 'bass' else '+'.join(o['n'])) or '+'.join(o['n'])
INS0, INSD = 123.0, 4
vb = lambda n: n if n < INS0 else n + INSD          # 剧情拍 → 画面拍（第二幕 ④ 的插入动画占 4 个画面拍）
# (key, 剧情拍 | 'v'+画面拍, 曲, 小节, 拍位(八分音符), 声部, 画面, 音乐)
AN = [
    # ---- 第一幕后半：对偶（A 第 6–13 小节）
    ('cap_pascal2', 16.6, 'A', 6, 3, 'mel', None, ''),
    ('a20', 20.0, 'A', 7, 0, 'mel', '「把点换成线」', '第7小节 · F5（B 段之前的 A 句第3小节）'),
    ('a24', 24.0, 'A', 7, 9, 'bass', '「6条切线 · 围成新的六边形」', '第4拍 · 低音 A2（减七）'),
    ('a28', 28.0, 'A', 8, 7, 'bass', '「把交点换成连线」', '终止式之后的左手八分音 G3'),
    ('q31', 31.05, 'A', 9, 0, 'mel', '提问「这3条对角线 · 又会怎样？」', '第9小节 · F5 / B♭2（属音持续：悬着）'),
    ('slam32', 32.0, 'A', 9, 6, 'mel', '共点！「竟然交于一点！」· 钟声', '第3拍 · F5 / A2'),
    ('drag3', 33.5, 'A', 10, 0, 'mel', '拖动点6', '第10小节 · E♭5'),
    ('a36', 36.0, 'A', 10, 6, 'mel', '「布列安桑定理」', '第3拍 · E♭5 / E♭2（回到主和弦）'),
    ('a40', 40.0, 'A', 11, 6, 'mel', '「一对镜像双胞胎」', '第11小节第3拍 · F5 / F2'),
    ('a44', 44.0, 'A', 12, 6, 'mel', '「可是 · 凭什么？」', '第12小节第3拍 · B♭4 / B♭3（属：半终止，问句）'),
    ('a48', 48.0, 'A', 13, 0, 'mel', '「升到三维！」第二幕', '第13小节 · G5 / E♭2（主题再现）'),
    # ---- 第二幕（A 第 13–34 小节）
    ('a52', 52.0, 'A', 14, 0, 'mel', '「6条边 · 一上一下翘起来」', '第14小节 · G5 / C3'),
    ('a55', 55.4, 'A', 14, 6, 'mel', '「相邻两边 · 照样相交」', '第3拍 · B♭5 / F2'),
    ('a60', 60.0, 'A', 15, 6, 'mel', '「小蛮腰」曲面', '第15小节第3拍 · E♭5 / C3'),
    ('a64', 64.0, 'A', 16, 3, 'mel', '「曲面由直线织成」', '第16小节第2拍 · C6 / B♭1（句子的最高点）'),
    ('a67', 67.0, 'A', 16, 9, 'bass', '「金蓝交替」', '终止式之后 · 低音 E♭3'),
    ('a72', 72.0, 'A', 18, 0, 'mel', '「连出3条空间对角线」', '第18小节 · E♭5 / A♭2'),
    ('q76', 76.0, 'A', 18, 6, 'mel', '提问「它们两两相交吗？」', '第3拍 · E♭5 / E♭2'),
    ('a80', 80.0, 'A', 19, 6, 'mel', '「先看25和36」', '第19小节第3拍 · F5 / F2'),
    ('a84', 84.0, 'A', 20, 4, 'mel', '「看4个端点」', '第20小节第2拍的第2个八分音 · C5 / F3'),
    ('a88', 88.0, 'A', 21, 0, 'mel', '「把边23和边56延长」', '第21小节 · G5 / E♭2（主题第三次出现）'),
    ('a89', 89.6, 'A', 21, 6, 'mel', '「真的碰上了！交于一点 P」', '第3拍 · F5 / E♭3'),
    ('a90', 90.8, 'A', 22, 0, 'mel', '「为什么？看影子」', '第22小节 · G5 / C3'),
    ('a93', 93.4, 'A', 22, 9, 'mel', '「一样远 → 升得一样高」', '第4拍 · A♭5 / F2'),
    ('a96', 96.0, 'A', 23, 3, 'mel', '「两条相交直线 → 定出一个平面」', '第23小节第2拍 · G5 / B2'),
    ('a100', 100.0, 'A', 24, 0, 'mel', '「2、3、5、6 都在这个平面上」', '第24小节 · B♭4 / B♭2'),
    ('a102', 102.4, 'A', 24, 6, 'mel', '「一定相交！」', '第3拍 · E♭5 / E♭2（半音下行的华彩落到主和弦）'),
    ('a106', 106.0, 'A', 25, 3, 'mel', '「再看36和14」', '第25小节第2拍 · F5'),
    ('a110', 110.0, 'A', 26, 0, 'mel', '「最后14和25」', '第26小节 · E♭5 / E♭2'),
    ('a114', 114.0, 'A', 27, 0, 'mel', '「3条线 · 两两相交」', '第27小节 · B♭5'),
    ('a118', 118.0, 'A', 28, 0, 'mel', '「要是围成三角形」', '第28小节 · B5 / B♭2'),
    ('a121', 121.0, 'A', 28, 6, 'mel', '「可6个顶点一上一下！」', '第3拍 · E♭5 / E♭2'),
    ('ins0', 'v123', 'A', 29, 0, 'mel', '④ 插入动画：俯视腰面', '第29小节 · E♭5 / A♭1'),
    ('ins1', 'v125.25', 'A', 29, 9, 'bass', '插入动画第二句', '第4拍 · 低音 E♭3'),
    ('slam124', 124.0, 'A', 30, 8, 'mel', '「只能交于同一点！」· 钟声', '第30小节 · 上行琶音的顶点 E♭7'),
    ('a128', 128.0, 'A', 32, 0, 'mel', '「从正上方打光 · 看影子」', '第32小节 · B6：华彩开始'),
    ('a132', 132.0, 'A', 32, 14, 'mel', '「影子 = 原来的平面图形！」', '华彩 · B6–B♭6–C7–A6 闪烁音型开始'),
    ('a136', 136.0, 'A', 32, 39, 'mel', '「影子也交于一点」', '华彩的最高音 D7'),
    ('slam140', 140.0, 'A', 33, 0, 'mel', '「降维打击！」· 钟声', '第33小节 · E♭5 / E♭2：华彩落地，回到主和弦'),
    ('qed1', 141.8, 'A', 33, 6, 'mel', '「布列安桑定理 · 证毕」', '第3拍 · E♭5 / E♭2'),
    # ---- 第三幕（B 第 1–12 小节）
    ('b144', 144.0, 'B', 1, 0, 'mel', '第三幕「可是 · 对偶凭什么成立？」', 'B 的第一个音 B♭5'),
    ('b148', 148.0, 'B', 2, 3, 'mel', '「圆外一点 P · 引两条切线」', '第2小节第2拍 · A♭5'),
    ('b152', 152.0, 'B', 3, 6, 'mel', '「连起两个切点」', '第3小节第3拍 · D5 / A2'),
    ('b156', 156.0, 'B', 4, 6, 'mel', '「这条线 · 就是 P 的线」', '第4小节第3拍 · E♭5 / E♭2（第一句的终止）'),
    ('b160', 160.0, 'B', 6, 0, 'mel', '「P 往圆上走……」', '第6小节 · E♭5 / C2'),
    ('b164', 164.0, 'B', 7, 3, 'mel', '「P 在圆上 → 它的线 = 切线！」', '第7小节第2拍 · C5'),
    ('b168', 168.0, 'B', 8, 0, 'mel', '「用坐标说清楚」', '第8小节 · G4 / G2'),
    ('b172', 172.0, 'B', 9, 0, 'mel', '「切点弦方程」', '第9小节 · G5 / E♭2（主题再现）'),
    ('b176', 176.0, 'B', 10, 0, 'mel', '「Q(c, d) 在 P 的线上」', '第10小节 · E♭5 / G2'),
    ('q178', 178.6, 'B', 10, 9, 'mel', '提问「反过来 · P 在 Q 的线上吗？」', '第4拍 · B4 / A♭3（属七：悬着）'),
    ('b180', 180.0, 'B', 11, 6, 'mel', '「换个角度读：P 在 Q 的线上！」', '第11小节第3拍 · E♭5 / A2'),
    ('slam184', 184.0, 'B', 12, 6, 'mel', '「你在我的线上 ⇔ 我在你的线上」· 钟声', '第12小节第3拍 · E♭5 / E♭2（终止式）→ 剪接到第39小节'),
    ('b188', 188.0, 'B', 40, 0, 'mel', '「Q 沿着 P 的线滑动」', '第40小节 · C5 / A♭2'),
    ('b192', 192.0, 'B', 41, 0, 'mel', '「点在线上 ⇔ 线过点」', '第41小节 · C5 / A♭2'),
    ('b196', 196.0, 'B', 42, 6, 'mel', '「回到六边形」', '第42小节第3拍 · E♭5 / A2'),
    ('b200', 200.0, 'B', 44, 0, 'mel', '「对角线 → 对边的交点」', '第44小节 · D♭5 / B2'),
    ('b204', 204.0, 'B', 45, 6, 'mel', '「3条对角线交于 B」', '第45小节第3拍 · F5 / B♭2（属）'),
    ('slam208', 208.0, 'B', 47, 0, 'bass', '「帕斯卡定理也成立！」· 钟声', '第47小节 · 低音 E♭2（回到主和弦）'),
    # ---- 第四幕（B 第 48–63 小节）
    ('b212', 212.0, 'B', 48, 0, 'mel', '「其实帕斯卡 · 也能升维」', '第48小节 · C5 / A♭2'),
    ('b216', 216.0, 'B', 49, 6, 'mel', '「6条边 · 穿过6个切点」', '第49小节第3拍 · E♭5 / A2'),
    ('b220', 220.0, 'B', 51, 0, 'mel', '「张成一个三角面」', '第51小节 · D5 / B♭2'),
    ('b224', 224.0, 'B', 52, 6, 'mel', '「6个三角面 ↔ 6条边」', '第52小节 · 颤音中'),
    ('b228', 228.0, 'B', 54, 0.083, 'mel', '「对边交于3个点」', '第54小节 · G5（颤音结束）'),
    ('b232', 232.0, 'B', 55, 3, 'bass', '「3个点 → 定出一个平面」', '第55小节第2拍 · 低音 B♭2（属持续音）'),
    ('b234', 234.0, 'B', 56, 0, 'bass', '「看这条棱」', '第56小节 · 低音 E♭3'),
    ('b238', 238.0, 'B', 57, 3, 'bass', '「两个三角面 · 交出一组对边」', '第57小节第2拍 · 低音 A2'),
    ('q239', 239.6, 'B', 57, 9, 'bass', '提问「棱穿过腰平面的点在哪？」', '第4拍 · G♭4（半音和弦：悬着）'),
    ('b242', 242.0, 'B', 59, 0, 'bass', '「= 对边交点！」', '第59小节 · E♭3'),
    ('b245', 245.0, 'B', 60, 0, 'bass', '「另外两条棱 · 同理」', '第60小节 · D3'),
    ('b249', 249.0, 'B', 61, 3, 'bass', '「既在三角形平面上 · 又在腰平面上」', '第61小节第2拍 · B♭2'),
    ('b253', 253.0, 'B', 62, 5, 'mel', '「两个平面相交 → 一条直线！」', '第62小节 · G5 / E♭3'),
    ('slam256', 256.0, 'B', 63, 2, 'bass', '「降维打击 2.0！」· 钟声', '第63小节 · 全曲最低音 E♭1（主和弦）'),
    ('qed2', 257.9, 'B', 63, 6, 'bass', '「帕斯卡定理 · 证毕」', '第63小节第3拍 · B♭3'),
    # ---- 片尾
    ('b260', 260.0, 'B', 64, 0, 'mel', '「一座小蛮腰 · 两个定理」', '第64小节 · B♭5 / B♭2'),
    ('b264', 264.0, 'B', 65, 2, 'mel', '片尾卡「帕斯卡 ⇄ 布列安桑」', '第65小节 · 最后的和弦'),
]
ANCH = []
for key, n, pc, bar, pos, voice, vis, mus in AN:
    t = m(bar, pos, voice) if pc == 'A' else mb(bar, pos, voice)
    nn = noteA = (note(bar, pos, voice) if pc == 'A' else noteB(bar, pos, voice))
    hit = round(t - LEAD, 3)
    CUE[key] = hit
    nvid = float(n[1:]) if isinstance(n, str) else vb(n)
    if vis is not None: ANCH.append([round(nvid, 4), hit])
    MARKS.append(dict(key=key, t=t, piece=pc, bar=bar, pos=pos, voice=voice, note=nn, vis=vis or '', mus=mus))
# 夜曲 A 的尾声（证毕之后）：最后三个 E♭ 和弦 → 布列安桑点轻轻回应（js/film.js codaZoom / drawImpacts）
CUE['coda'] = [round(m(34, q, 'any') - LEAD, 3) for q in (0, 3, 6)]
for i, q in enumerate((0, 3, 6)):
    MARKS.append(dict(key=f'coda{i}', t=m(34, q, 'any'), piece='A', bar=34, pos=q, voice='any', note=note(34, q, 'any'), vis='尾声：布列安桑点的光环', mus='第34小节 · E♭ 和弦'))
END_T = round(B_AT + B_END - SPL + TAIL, 2)
ANCH.append([278 + INSD, END_T])
assert all(ANCH[i + 1][0] > ANCH[i][0] and ANCH[i + 1][1] > ANCH[i][1] for i in range(len(ANCH) - 1)), ANCH
# ---- 第一幕后半的逐个元素（实时，不走时钟）：切线 6 条、外切六边形 6 个顶点、描边、交点飞成对角线
TAN = [(7, 1, 'bass'), (7, 2, 'bass'), (7, 3, 'mel'), (7, 4, 'mel'), (7, 5, 'mel'), (7, 6, 'mel')]
WPOP = [(7, 10, 'bass'), (7, 11, 'bass'), (8, 0, 'mel'), (8, 1, 'mel'), (8, 2, 'mel'), (8, 3, 'mel')]
TRACE = [(8, 3.5, 'mel'), (8, 4, 'mel'), (8, 4.5, 'mel'), (8, 4.771, 'mel'), (8, 5, 'mel'), (8, 5.5, 'mel'), (8, 6, 'mel')]
FLY = [(8, 8, 'bass'), (8, 9, 'bass'), (8, 10, 'mel')]
for name, lst, desc in [('tan', TAN, '点 {} → 切线'), ('wpop', WPOP, '外切顶点 {}'), ('trace', TRACE, '描边到顶点 {}'), ('fly', FLY, '交点 {} → 对角线')]:
    CUE[name] = [round(m(b, q, v) - LEAD, 3) for b, q, v in lst]
    for i, (b, q, v) in enumerate(lst):
        MARKS.append(dict(key=f'{name}{i}', t=m(b, q, v), piece='A', bar=b, pos=q, voice=v, note=note(b, q, v), vis=desc.format(i + 1), mus=''))
# ---- 字幕（实时落地；离场 None = 跟着时钟在原设计的拍子离场）
CAPS.update({
    '1639年 · 帕斯卡才16岁': [CUE['cap_pascal2'], None],
    '圆内接六边形 · 三组对边的交点共线': [round(m(6, 6, 'mel') - LEAD, 3), None],
    '圆上每个点 → 过这点的切线': [CUE['tan'][0], None],
    '它把圆包在里面 · 叫「外切六边形」': [CUE['wpop'][2], None],
    '交点 → 连接两个相对顶点的「对角线」': [CUE['fly'][0], None],
    '竟然[交于一点]！': [round(CUE['slam32'] - SLAMD, 3), None],
    '1806年 · 他还是个大学生': [round(m(10, 9, 'mel') - LEAD, 3), None],
    '圆外切六边形 · 三条对角线共点': [round(m(11, 0, 'mel') - LEAD, 3), None],
    '数学家叫它「对偶」': [round(m(11, 9, 'mel') - LEAD, 3), None],
    '3条对角线 · 凭什么一定交于一点？': [round(m(12, 9, 'mel') - LEAD, 3), None],
    '升到[三维]！': [round(CUE['a48'] - SLAMD, 3), None],
    '平面里难证 · 到空间里一眼看穿': [round(m(13, 3, 'mel') - LEAD, 3), None],
    '⇒ 只能交于[同一点]！': [round(CUE['slam124'] - SLAMD, 3), None],
    '[降维打击]！': [round(CUE['slam140'] - SLAMD, 3), None],
    '你在我的线上 ⇔ [我在你的线上]': [round(CUE['slam184'] - SLAMD, 3), None],
    '[帕斯卡定理]也成立！': [round(CUE['slam208'] - SLAMD, 3), None],
    '[降维打击] 2.0！': [round(CUE['slam256'] - SLAMD, 3), None],
})
# ---- 钟声：只在“定理级”的顿悟上（和弦音，比钢琴低 9 dB）
TB = lambda key: CUE[key] + LEAD
CHIMES += [
    dict(t=TB('slam32'), midi=[89, 96], piece='A', label='共点 · F6+C7（F 大三和弦，第9小节第3拍）'),
    dict(t=TB('slam124'), midi=[87, 94], piece='A', label='同一点 · E♭6+B♭6（第30小节顶点 E♭7）'),
    dict(t=TB('slam140'), midi=[87, 94], piece='A', label='降维打击 · E♭6+B♭6（华彩落地）'),
    dict(t=TB('slam184'), midi=[87, 94], piece='B', label='你在我的线上 · E♭6+B♭6（B 第12小节终止）'),
    dict(t=TB('slam208'), midi=[87, 94], piece='B', label='帕斯卡也成立 · E♭6+B♭6（B 第47小节）'),
    dict(t=TB('slam256'), midi=[87, 94], piece='B', label='降维打击 2.0 · E♭6+B♭6（B 第63小节 E♭1）'),
]
CHIMES[0]['piece'] = 'A'
MUSIC = dict(a_off=OFF, b_at=B_AT, cut=list(CUT), spl=SPL, b_end=B_END, dur=END_T)
out = os.path.join(ROOT, 'js', 'cues.js')
with open(out, 'w') as f:
    f.write('// generated by tools/choreo.py (v5 编舞表：画面事件 ← 乐谱事件，时刻取自 Levy 的实际演奏) — 改编舞请改 tools/choreo.py\n')
    f.write(f'export const MUSIC_OFFSET = {OFF}, LEAD = {LEAD}, RNAT = {RNAT:.5f};\n')
    f.write('export const CUE = ' + json.dumps(CUE, ensure_ascii=False) + ';\n')
    f.write('export const CAPS = ' + json.dumps(CAPS, ensure_ascii=False) + ';\n')
    f.write('// clock knots [story beat, real seconds, slope] (monotone cubic)\nexport const KD = ' + json.dumps(KD) + ';\n')
    f.write('export const CHIMES = ' + json.dumps(CHIMES, ensure_ascii=False) + ';\n')
    f.write('// anchors [video beat, real seconds] after the opening knots (scene.js solves α, β per segment)\nexport const ANCH = ' + json.dumps(ANCH) + ';\n')
    f.write('export const MUSIC = ' + json.dumps(MUSIC) + ';\n')
json.dump(dict(offset=OFF, lead=LEAD, music=MUSIC, marks=MARKS, chimes=CHIMES, anch=ANCH), open(os.path.join(ROOT, 'out', 'cues_marks.json'), 'w'), ensure_ascii=False, indent=1)
print(f'wrote js/cues.js: {len(KD)} knots, {len(ANCH)} anchors, {len(MARKS)} marks; film {END_T}s')

