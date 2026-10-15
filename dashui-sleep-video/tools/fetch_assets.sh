#!/usr/bin/env bash
# Downloads the open-licensed fonts + paper texture and rebuilds assets/.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p fonts tex assets
curl -sSL -o fonts/ZCOOLKuaiLe-Regular.ttf https://github.com/google/fonts/raw/main/ofl/zcoolkuaile/ZCOOLKuaiLe-Regular.ttf
curl -sSL -o /tmp/lxgwmarker.zip https://github.com/lxgw/LxgwMarkerGothic/releases/download/v1.004/LxgwMarkerGothic-v1.004.zip
unzip -o -q -j /tmp/lxgwmarker.zip '*/fonts/ttf/LXGWMarkerGothic-Regular.ttf' -d fonts
curl -sSL -o /tmp/paper001.zip 'https://ambientcg.com/get?file=Paper001_4K-JPG.zip'
unzip -o -q /tmp/paper001.zip -d tex
python3 tools/gen_paper.py
python3 tools/glyphs.py
echo "assets ready"
