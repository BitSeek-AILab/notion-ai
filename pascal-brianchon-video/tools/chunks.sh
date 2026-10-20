#!/bin/bash
# v5 分块出片（省盘、可断点续做）：每块先无损渲染画面（UT Video RGB，out/C_0.mkv + C_1.mkv），
# 再叠底部乐谱带、编码 → out/part_K.mp4（只有画面），删掉无损分段；4 块都在后拼接 + 配乐 → out/pb_v5_full.mp4。
# 已有的 out/part_K.mp4 会跳过，所以中断后重跑即可续做。
#   bash tools/chunks.sh          # 全部（2 核约 75 分钟，峰值约 8 GB 临时文件）
#   bash tools/chunks.sh 2        # 只做第 2 块
set -e
cd "$(dirname "$0")/.."
FPS=30; B=(0 3413 6826 10239 13649)
sec() { python3 -c "print(f'{$1 / $FPS:.6f}')"; }
for k in 0 1 2 3; do
  [ -n "$1" ] && [ "$1" != "$k" ] && continue
  P=out/part_$k.mp4
  [ -s $P ] && { echo "part $k: exists"; continue; }
  a=$(sec ${B[$k]}); b=$(sec ${B[$((k + 1))]})
  echo "part $k: frames ${B[$k]}–$((${B[$((k + 1))]} - 1))  render $(date +%T)"
  node render.mjs video --from $a --to $b --workers 2 --prefix C_ --segonly --lossless utvideo > out/chunk_$k.render.log 2>&1
  echo "part $k: composite $(date +%T)"
  python3 -u tools/composite.py --from $a --to $b --src C_ --src-start $a --audio none --out out/part_$k.tmp.mp4 > out/chunk_$k.comp.log 2>&1
  mv out/part_$k.tmp.mp4 $P; rm -f out/C_0.mkv out/C_1.mkv
  echo "part $k: done $(date +%T)"
done
[ -n "$1" ] && exit 0
[ -s out/audio_master.wav ] || python3 -u tools/film_audio.py
printf "file '%s'\n" "$PWD"/out/part_{0,1,2,3}.mp4 > out/parts.txt
ffmpeg -v error -y -f concat -safe 0 -i out/parts.txt -t "$(sec ${B[4]})" -i out/audio_master.wav -map 0:v -map 1:a -c:v copy \
  -c:a aac -b:a 256k -ar 48000 -movflags +faststart out/pb_v5_full.mp4
echo "wrote out/pb_v5_full.mp4 $(date +%T)"
