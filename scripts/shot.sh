#!/usr/bin/env bash
# Headless Chrome screenshot of the local preview, for Claude to inspect.
# Usage: scripts/shot.sh <out.png> [mobile|tablet|desktop|WxH] [url]
# Headless Chrome can't go below ~504px wide, so narrower sizes render the
# page inside an iframe of the exact size (real mobile layout), left-aligned.
set -euo pipefail
OUT="${1:?out.png required}"
SIZE="${2:-mobile}"
URL="${3:-http://localhost:5000}"
case "$SIZE" in
  mobile)  W=390; H=844 ;;
  tablet)  W=820; H=1180 ;;
  desktop) W=1440; H=900 ;;
  *)       W="${SIZE%x*}"; H="${SIZE#*x}" ;;
esac
CHROME="/c/Program Files/Google/Chrome/Application/chrome.exe"
PROFILE="$(mktemp -d)"
TARGET="$URL"; WW="$W"
if [ "$W" -lt 520 ]; then
  WRAP="$PROFILE/wrap.html"
  printf '<!doctype html><body style="margin:0;background:#000"><iframe src="%s" style="border:0;width:%spx;height:%spx;display:block"></iframe></body>' "$URL" "$W" "$H" > "$WRAP"
  TARGET="file:///$(cygpath -m "$WRAP" 2>/dev/null || echo "$WRAP")"
  WW=520
fi
"$CHROME" --headless=new --disable-gpu --hide-scrollbars --no-first-run \
  --user-data-dir="$PROFILE" --virtual-time-budget=6000 --allow-file-access-from-files \
  --window-size="$WW,$H" --screenshot="$OUT" "$TARGET" >/dev/null 2>&1
rm -rf "$PROFILE"
echo "$OUT"
