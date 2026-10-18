# 黄毛理论 · 竖屏科普短视频（制作中）

> 进度：① 调研 ✅ → **② 和用户对齐讲法（进行中）** → ③ 动画 → ④ 音效与混音 → ⑤ 成片

- **目标**：≤ 1 分钟竖屏（1080×1920 · 30 fps），短平快；每 1 小节（≈ 2.13 s）至少一次大的形状变化
- **风格**（取自 [mg-styles-15](https://github.com/Vincentwei1021/mg-styles-15)）：线条风 `02-line-art` + 手绘风 `05-cel-boil` + 形状即叙事 `08-morph`
- **配乐**：用户提供，从 0 s 起按片长截断；BPM 112.9、首拍 0.082 s、F 小调；DROP 17.09 s、高潮 34.09 s（`tools/analyze_music.py`）
- **画面里不出现“开智”**

## 文件

- [`RESEARCH.md`](RESEARCH.md)：黄毛理论调研——词源、时间线、三个版本、边界、对标人物、研究依据、文案红线
- [`STORYBOARD.md`](STORYBOARD.md)：分镜草案 v0（25 小节 ≈ 53 s）+ 待对齐的问题
- `tools/analyze_music.py` → `tools/music_analysis.json`：节拍网格、逐小节能量、段落判断
