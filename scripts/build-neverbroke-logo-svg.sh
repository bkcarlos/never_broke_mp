#!/usr/bin/env bash
# 从 miniprogram/images/neverbroke-logo.png 生成双色矢量 neverbroke-logo.svg（绿 + 白，深色透明）
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/miniprogram/images/neverbroke-logo.png"
OUT="$ROOT/miniprogram/images/neverbroke-logo.svg"
SUF="${RANDOM}_$$"
TR="/tmp/nb-trim-${SUF}.png"
GS="/tmp/nb-gclean-${SUF}.svg"
WS="/tmp/nb-wclean-${SUF}.svg"

magick "$SRC" -fuzz 15% -trim +repage "$TR"

magick "$TR" -fx '(u.r>0.93 && u.g>0.93 && u.b>0.93) ? 0 : 1' -colorspace gray "/tmp/nb-wgray-${SUF}.png"
magick "/tmp/nb-wgray-${SUF}.png" -threshold 50% "/tmp/nb-wfg-${SUF}.pbm"
potrace -s --turdsize 2 -o "$WS" "/tmp/nb-wfg-${SUF}.pbm"

magick "$TR" -fuzz 18% -transparent "#1a1a1a" "/tmp/nb-x1-${SUF}.png"
magick "/tmp/nb-x1-${SUF}.png" -background white -alpha remove "/tmp/nb-x1f-${SUF}.png"
magick "/tmp/nb-x1f-${SUF}.png" -fx '(u.r>0.93 && u.g>0.93 && u.b>0.93) ? 1 : (u.g > u.r + 0.05 && u.g > u.b + 0.05 ? 0 : 1)' -colorspace gray "/tmp/nb-gfx-${SUF}.png"
magick "/tmp/nb-gfx-${SUF}.png" -threshold 50% "/tmp/nb-gfg-${SUF}.pbm"
potrace -s --turdsize 4 -o "$GS" "/tmp/nb-gfg-${SUF}.pbm"

export GS WS OUT
python3 - << 'PY'
import os, re, pathlib

def extract_path(svg_text):
    m = re.search(r'<path\s+d="([\s\S]*?)"\s*/>', svg_text)
    if not m:
        m = re.search(r'<path\s+d="([\s\S]*?)"\s*>', svg_text)
    if not m:
        raise SystemExit("no path in traced svg")
    return re.sub(r"\s+", " ", m.group(1).strip())

g = pathlib.Path(os.environ["GS"]).read_text()
w = pathlib.Path(os.environ["WS"]).read_text()
dg, dw = extract_path(g), extract_path(w)
GREEN = "#29A639"
WHITE = "#FFFFFF"
svg = f'''<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 334 316" width="334" height="316" role="img" aria-labelledby="nb-title nb-desc">
  <title id="nb-title">NeverBroke</title>
  <desc id="nb-desc">认知翻身账 · 绿色与白色图形，深色背景已去除</desc>
  <g transform="translate(0,316) scale(0.1,-0.1)" stroke="none">
    <path fill="{GREEN}" d="{dg}"/>
    <path fill="{WHITE}" d="{dw}"/>
  </g>
</svg>
'''
pathlib.Path(os.environ["OUT"]).write_text(svg, encoding="utf-8")
print("OK", os.environ["OUT"])
PY

rm -f "$TR" "$GS" "$WS" /tmp/nb-*-"${SUF}"*
