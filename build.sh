#!/bin/sh
# 分割ソースを1枚のHTMLに結合する
cd "$(dirname "$0")"

# --- 本体 ---
cat src/00-head.html \
    src/10-config.js \
    src/12-ball.js \
    src/14-shot.js \
    src/15-actors.js \
    src/16-rally.js \
    src/30-gym.js \
    src/40-player.js \
    src/41-bomb.js \
    src/42-motions.js \
    src/44-explosion-fx.js \
    src/45-camera.js \
    src/50-input.js \
    src/60-hud.js \
    src/90-boot.js \
    src/99-tail.html > bakudan-volley.html
cp bakudan-volley.html index.html   # GitHub Pages はルートの index.html を配信する

# --- 検証ページ ---
# 本体と同じく1枚に結合する（<script src> で隣を読むと表示環境によって読み込まれないため）
cat src/verify-head.html \
    src/10-config.js \
    src/12-ball.js \
    src/14-shot.js \
    src/15-actors.js \
    src/16-rally.js \
    src/verify-tests.js \
    src/99-tail.html > verify.html

echo "built bakudan-volley.html + index.html ($(wc -c < bakudan-volley.html) bytes)"
echo "built verify.html ($(wc -c < verify.html) bytes)"
