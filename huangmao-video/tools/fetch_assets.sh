#!/usr/bin/env bash
# Downloads the two SIL-OFL font families used by the film and rebuilds the glyph subsets in assets/fonts/.
#   Resource Han Rounded CN (Heavy + Bold)  https://github.com/CyanoHao/Resource-Han-Rounded
#   Smiley Sans / 得意黑 (Oblique)           https://github.com/atelier-anchor/smiley-sans
# Needs: curl, 7za (p7zip), unzip, pyftsubset (pip3 install fonttools)
set -euo pipefail
cd "$(dirname "$0")/.."
SRC=fonts/src
mkdir -p "$SRC/smiley" assets/fonts
if [ ! -f "$SRC/ResourceHanRoundedCN-Heavy.ttf" ] || [ ! -f "$SRC/ResourceHanRoundedCN-Bold.ttf" ]; then
  curl -fsSL -o /tmp/rhr-cn.7z https://github.com/CyanoHao/Resource-Han-Rounded/releases/download/v0.990/RHR-CN-0.990.7z
  7za e -y -o"$SRC" /tmp/rhr-cn.7z ResourceHanRoundedCN-Heavy.ttf ResourceHanRoundedCN-Bold.ttf >/dev/null
fi
if [ ! -f "$SRC/smiley/SmileySans-Oblique.ttf" ]; then
  curl -fsSL -o /tmp/smiley-sans.zip https://github.com/atelier-anchor/smiley-sans/releases/download/v2.0.1/smiley-sans-v2.0.1.zip
  unzip -o -q -j /tmp/smiley-sans.zip SmileySans-Oblique.ttf -d "$SRC/smiley"
fi
python3 tools/subset_fonts.py --src "$SRC"
echo "assets ready -> assets/fonts/"
