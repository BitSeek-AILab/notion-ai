# 大睡理论 · 睡眠科普竖屏短视频（45 秒）

“弱者熬夜，强者大睡”——用一部 45 秒的竖屏动画，把爆火的“大睡理论”讲成一条有依据的睡眠科普：通宵有多伤、睡着后大脑在干什么、睡不够会怎样、怎么睡才对。

- **成片规格**：1080×1920 竖屏 · 30 fps · 45.5 s · H.264 + AAC
- **音乐**：用户提供的配乐，从 0 s 开始，截断到 45.5 s（44.9 s 起淡出）。BPM 实测 112.9，首拍 0.082 s，所有镜头切换、形状变形、文字弹出都落在小节 / 拍 / 八分音符上
- **动效风格**：全程采用 [mg-styles-15](https://github.com/Vincentwei1021/mg-styles-15) 的 **逐帧手绘风** `05-cel-boil`——墨线每 2 帧重画一次（“抖线”），色块与线稿错位上色，纸张纹理；夜景用同一套纸纹的深蓝底
- **形状即叙事**（`08-morph`）：手机 → 枕头 → 云朵 → 问号 → 闹钟 → 大脑 → 啤酒杯 → 月亮 → 洪水 → 浴缸 → 进度条 → 直线 → 睡眠周期曲线 → 盾牌 → 碎片 → 电池 → 枕头 → 仪表盘 → 柱状图 → 手机，平均每 1 小节（≈2.1 s）一次大的形状变化，变形时颜色沿色相环过渡
- 画面全部由代码逐帧绘制（Canvas2D），每一帧都是时间 t 的纯函数，可重复渲染

## 分镜 / 节拍表

拍点：`bt(n) = 0.082 + n × 0.53144 s`，小节 `B[k] = bt(4k)`。

| # | 时间 | 拍点 | 画面 | 形状变化 |
|---|---|---|---|---|
| 1 | 0 – 4.33 | 0 – B2 | “弱者熬夜”：02:00 的手机，三条通知踩拍弹出 → 2.2 s 枕头从天而降砸扁手机 → “强者大睡” + 皇冠（bt6） | 手机 → 枕头 |
| 2 | 4.33 – 6.46 | B2 – B3 | “大睡理论”四个字按八分音符落进云朵；“热搜同款”盖章；晚上十点睡，睡够 8 小时 / 拒绝报复性熬夜 | 枕头 → 云朵 |
| 3 | 6.46 – 8.59 | B3 – B4 | 是玩梗？还是真科学？戴睡帽的小脑袋落成问号的点 | 云朵 → 问号 |
| 4 | 8.59 – 10.71 | B4 – B5 | 通宵不睡：时钟狂转，3…24 小时按八分音符计数，闹铃 | 问号 → 闹钟 |
| 5 | 10.71 – 12.84 | B5 – B6 | 通宵后的大脑 ≈ 喝醉了！反应力相当于血液酒精 0.1%（已超过醉驾标准） | 闹钟 → 大脑 |
| 6 | 12.84 – 17.09 | B6 – B8 | B6 拉灯 → 夜晚：啤酒杯飘起变成月亮，大脑戴睡帽盖被子；那睡着以后呢？你的大脑会偷偷……水位踩拍上涨蓄力 | 啤酒杯 → 月亮 |
| 7 | 17.09 – 19.21 | B8（DROP）– B9 | 大浪拍下 → 浴缸：大脑在“洗澡”！ | 洪水 → 浴缸 |
| 8 | 19.21 – 21.34 | B9 – B10 | 冲走大脑垃圾：脑脊液波浪踩 3 拍把代谢废物冲走 | — |
| 9 | 21.34 – 23.47 | B10 – B11 | 白天学的，夜里“存盘”：单词 / 公式 / 技能卡片踩拍飞进大脑，进度条存盘完成 | 浴缸 → 进度条 |
| 10 | 23.47 – 25.59 | B11 – B12 | 一夜约 5 个睡眠周期，每个约 90 分钟：小脑袋当笔画出睡眠周期图 | 进度条 → 直线 → 曲线 |
| 11 | 25.59 – 27.72 | B12 – B13 | 每晚睡不到 6 小时，免疫防线会变脆：三拍三道裂纹 | 曲线 → 盾牌 |
| 12 | 27.72 – 29.84 | B13 – B14 | 盾牌碎裂，病毒围攻：感冒风险 ×4.2 | 盾牌 → 碎片 |
| 13 | 29.84 – 34.09 | B14 – B16 | 碎片飞回拼成电池：好好睡一觉，全身都在充电（修复 / 记忆 / 免疫 / 情绪四格踩拍充满）满电！ | 碎片 → 电池 |
| 14 | 34.09 – 36.22 | B16 – B17 | 高潮：日出径向擦除天亮，强者大睡！ | 电池 → 枕头 |
| 15 | 36.22 – 38.35 | B17 – B18 | ① 睡 7～9 小时（指针来回摆后停在 8），睡太久，也不好 | 枕头 → 仪表盘 |
| 16 | 38.35 – 40.47 | B18 – B19 | ② 别靠周末补觉：一周 7 根柱子由参差变整齐，规律作息，才是关键 | 仪表盘 → 柱状图 |
| 17 | 40.47 – 42.60 | B19 – B20 | ③ 睡前放下手机：手机躺倒、熄屏、戴睡帽盖被子，屏幕光会让你更难入睡 | 柱状图 → 手机 |
| 18 | 42.60 – 45.5 | B20 – 结尾 | 今晚，你大睡了吗？评论区打卡 ✓ → B21 再次拉灯，月亮眨眼：晚安～ | — |

## 事实依据

| 片中说法 | 依据 |
|---|---|
| 连续 24 小时不睡，反应力≈血液酒精 0.1%（我国醉驾标准为 80 mg/100 mL，即 0.08%） | Dawson D, Reid K. Fatigue, alcohol and performance impairment. *Nature* 1997;388:235 |
| 睡眠时大脑“洗澡”：脑脊液冲刷、清除代谢废物 | Xie L, et al. Sleep drives metabolite clearance from the adult brain. *Science* 2013;342:373–377；Fultz NE, et al. *Science* 2019;366:628–631（睡眠中脑脊液的节律性波动） |
| 白天学的，夜里“存盘” | Diekelmann S, Born J. The memory function of sleep. *Nat Rev Neurosci* 2010;11:114–126 |
| 一夜约 5 个睡眠周期，每个约 90 分钟 | 睡眠生理学常识（一夜 4–6 个 NREM/REM 周期，每个约 90 分钟） |
| 每晚睡不到 6 小时，感冒风险是 7 小时以上的 4.2 倍 | Prather AA, et al. Behaviorally assessed sleep and susceptibility to the common cold. *Sleep* 2015;38:1353–1359 |
| 成年人睡 7～9 小时，睡太久也不好 | Hirshkowitz M, et al. National Sleep Foundation's sleep time duration recommendations. *Sleep Health* 2015;1:40–43 |
| 别靠周末补觉 | Depner CM, et al. Ad libitum weekend recovery sleep fails to prevent metabolic dysregulation… *Curr Biol* 2019;29:957–967 |
| 睡前放下手机 | Chang AM, et al. Evening use of light-emitting eReaders negatively affects sleep… *PNAS* 2015;112:1232–1237 |
| “大睡理论”梗：弱者熬夜，强者大睡；晚上十点睡，睡够 8 小时；拒绝报复性熬夜 | [凤凰网](https://feng.ifeng.com/c/8xBuJcOwRxr)、[新浪](https://www.sina.cn/news/detail/5351801475827871.html) |

## 目录

```
index.html            # 页面：加载 js/film.js，暴露 window.renderAt(t)
render.mjs            # Playwright 逐帧截图 → ffmpeg 编码，并混入 out/audio_master.wav
js/engine.js          # 手绘引擎：样条、boil 抖线、墨线粗细、错位上色（改编自 mg-styles-15 / 05-cel-boil）
js/text.js            # 手写字：字体轮廓 → 抖动墨线 + 错位填色 + 投影；中文标点自动紧排
js/shapes.js          # 角色与物件：手机、枕头、云朵、月亮、大脑、啤酒杯、浴缸、小黄鸭、盾牌、病毒、电池、太阳、闹钟、仪表盘……
js/fx.js              # 特效：水花、星芒、速度线、烟团、全屏洪水
js/film.js            # 18 个镜头的时间线（全部锁定在音乐节拍网格上）+ 形状变形
tools/glyphs.py       # 从字体提取用到的字形轮廓 → assets/glyphs.json
tools/gen_paper.py    # 由 ambientCG Paper001 生成白天纸张、夜晚纸张与纸纹
tools/sfx.py          # 合成音效并与配乐混音、母带 → out/audio_master.wav
tools/beat_grid.py    # 节拍跟踪 → BPM 112.9 / 首拍 0.082 s
tools/fetch_assets.sh # 下载字体与纸张贴图并生成 assets/
vendor/simplex-noise.js
assets/glyphs.json    # 已提取的字形数据（可直接渲染）
```

## 声音

- 配乐：用户提供的音乐，从 0 s 开始，截断到 45.5 s，44.9 s 起淡出。音乐为 F 小调，带音高的音效（通知、进度条、计数、琶音、叮）都取 F 小调五声音阶，与配乐同调。
- 音效：`tools/sfx.py` 全部程序合成（无采样），共 206 个音效点，与画面事件逐一对齐——通知叮咚、滑哨 + 枕头“噗”、皇冠“叮”、盖章、钟表滴答 + 闹铃、打嗝、拉灯“咔哒”、蓄力 + 大浪、小黄鸭、脑脊液冲刷、存盘音、画笔沙沙、玻璃裂纹 + 碎裂、病毒弹入、低电量、闪电、充电、日出和弦、熄屏、打呼、打卡、月亮眨眼……每次形状变形都有一个橡皮感的“啵呜”。
- 每个音效按同一时刻音乐的 K 加权响度自动校准；大撞击（枕头、DROP、盾牌碎裂、×4.2、日出）时音乐自动闪避 2.5–4 dB。
- 母带：BS.1770 积分响度 −12 LUFS，4× 过采样前瞻限幅到 −2 dBTP，AAC 编码后真峰值仍 ≤ −1 dBTP。

## 如何渲染

依赖：Node 18+（`npm i`，即 playwright）、Chromium、ffmpeg、Python 3（`pip install fonttools pillow numpy scipy`）

```bash
bash tools/fetch_assets.sh            # 字体 + 纸张贴图 → assets/（glyphs.json 已提交，可跳过字体）
cp /path/to/music.mp3 audio/music.mp3 # 配乐（未提交到仓库）
python3 tools/sfx.py                  # → out/audio_master.wav（配乐截断到 45.5 s + 音效）
node render.mjs stills 2.2,17.1,34.4  # 预览单帧 → out/stills/
node render.mjs video --workers 2     # → out/video.mp4
```

Chromium 路径可用环境变量 `CHROME_PATH` 指定。

素材与许可见 [CREDITS.md](CREDITS.md)。
