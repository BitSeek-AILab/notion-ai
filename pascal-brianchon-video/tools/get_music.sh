#!/bin/bash
# 下载配乐（公有领域录音 · Musopen「Set Chopin Free」· Wikimedia Commons）到 audio/
#   A  肖邦《降 E 大调夜曲》Op. 9 No. 2 —— Frank Levy 演奏
#   B  肖邦《降 E 大调夜曲》Op. 55 No. 2 —— Xuan He 演奏
set -e
cd "$(dirname "$0")/.."
mkdir -p audio
C=https://upload.wikimedia.org/wikipedia/commons
UA="pascal-brianchon-video/3.0 (math pop-sci video; music credits in CREDITS.md)"
[ -s audio/chopin_op9n2_levy.flac ]   || curl -L -A "$UA" -o audio/chopin_op9n2_levy.flac   "$C/8/89/Chopin_-_Nocturne_No._2_in_E-flat_major%2C_Op._9_No._2_%28Frank_Levy%29.flac"
[ -s audio/chopin_op55n2_xuanhe.flac ] || curl -L -A "$UA" -o audio/chopin_op55n2_xuanhe.flac "$C/4/44/Chopin_-_Nocturne_No._16_in_E-flat_major%2C_Op._55_No._2_%28Xuan_He%29.flac"
ls -l audio/*.flac
