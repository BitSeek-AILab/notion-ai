# Credits & licenses

| 素材 | 来源 | 许可 |
|---|---|---|
| 线条 / 手绘 / 形变动效引擎的思路与部分代码（`js/engine.js` 改编自 demos/05-cel-boil，并参考 02-line-art、08-morph） | [Vincentwei1021/mg-styles-15](https://github.com/Vincentwei1021/mg-styles-15) | MIT |
| simplex-noise.js（`vendor/`） | Jonas Wagner | MIT |
| Noto Serif CJK SC Black / Bold（标题、副标题字形） | [notofonts/noto-cjk](https://github.com/notofonts/noto-cjk) | SIL OFL 1.1 |
| LXGW WenKai Medium 霞鹜文楷（手写注释字形） | [lxgw/LxgwWenKai](https://github.com/lxgw/LxgwWenKai) | SIL OFL 1.1 |
| 配乐 A：肖邦《降 E 大调夜曲》Op. 9 No. 2 · Frank Levy 演奏 | Musopen「Set Chopin Free」· [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Chopin_-_Nocturne_No._2_in_E-flat_major,_Op._9_No._2_%28Frank_Levy%29.flac)（`tools/get_music.sh` 下载，不随仓库分发） | 公有领域（作品与录音） |
| 配乐 B：肖邦《降 E 大调夜曲》Op. 55 No. 2 · Xuan He 演奏 | Musopen「Set Chopin Free」· [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Chopin_-_Nocturne_No._16_in_E-flat_major,_Op._55_No._2_%28Xuan_He%29.flac)（同上） | 公有领域（作品与录音） |

- `assets/glyphs.json`（由 `tools/glyphs.py` 生成，体积较大未入库）是从上述 OFL 字体中提取的字形轮廓数据，随 SIL OFL 1.1 分发。
- 所有几何图形、立体光影、光环特效均由代码逐帧计算绘制，原创。
- 点缀音（钟片 / 低音钟）均由 `tools/sfx.py` 程序合成，无第三方采样；对两份配乐录音只做了响度对齐、轻微电平平衡与淡入淡出。
