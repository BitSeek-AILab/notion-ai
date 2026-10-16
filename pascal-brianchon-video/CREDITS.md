# Credits & licenses

| 素材 | 来源 | 许可 |
|---|---|---|
| 线条 / 手绘 / 形变动效引擎的思路与部分代码（`js/engine.js` 改编自 demos/05-cel-boil，并参考 02-line-art、08-morph） | [Vincentwei1021/mg-styles-15](https://github.com/Vincentwei1021/mg-styles-15) | MIT |
| simplex-noise.js（`vendor/`） | Jonas Wagner | MIT |
| Noto Serif CJK SC Black / Bold（标题、副标题字形） | [notofonts/noto-cjk](https://github.com/notofonts/noto-cjk) | SIL OFL 1.1 |
| LXGW WenKai Medium 霞鹜文楷（手写注释字形） | [lxgw/LxgwWenKai](https://github.com/lxgw/LxgwWenKai) | SIL OFL 1.1 |
| 配乐 | 用户提供（不随仓库分发） | 仅用于本视频 |

- `assets/glyphs.json`（由 `tools/glyphs.py` 生成，体积较大未入库）是从上述 OFL 字体中提取的字形轮廓数据，随 SIL OFL 1.1 分发。
- 所有几何图形、立体光影、冲击特效均由代码逐帧计算绘制，原创。
- 音效均由 `tools/sfx.py` 现场合成，无第三方采样。
