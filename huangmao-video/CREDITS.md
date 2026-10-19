# Credits & licenses

| 素材 | 来源 | 许可 |
|---|---|---|
| 视觉风格参考（扁平矢量动画、综艺花字） | [Vincentwei1021/mg-styles-15](https://github.com/Vincentwei1021/mg-styles-15) · demos/01-flat-vector、18-hanazi（仅参考视觉语法，本片代码为重写） | MIT |
| Resource Han Rounded CN 资源圆体（Heavy / Bold，标题与花字） | [CyanoHao/Resource-Han-Rounded](https://github.com/CyanoHao/Resource-Han-Rounded) v0.990 · © Cyano Hao、Adobe | SIL OFL 1.1 |
| Smiley Sans 得意黑（Oblique，角标与小字） | [atelier-anchor/smiley-sans](https://github.com/atelier-anchor/smiley-sans) v2.0.1 · © atelierAnchor | SIL OFL 1.1 |
| 配乐 | 用户提供（`audio/music.mp3`，不入库） | — |

- 所有角色、道具、背景、转场均为 Canvas 2D 代码绘制，未使用任何图片素材
- 所有音效由 `tools/sfx.py` 程序合成，未使用任何采样
- 字体只在 `tools/fetch_assets.sh` 中从上游下载，再用 `tools/subset_fonts.py` 按片中用字子集化（OFL 允许修改与再分发；子集保留原字体名与版权信息）
