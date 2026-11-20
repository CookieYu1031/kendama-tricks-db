#!/usr/bin/env bash
# Headless Chrome screenshot of the local preview, for Claude to inspect.
# Usage: scripts/shot.sh <out.png> [mobile|desktop|WxH] [url]
set -euo pipefail
OUT="${1:?out.png required}"
SIZE="${2:-mobile}"
URL="${3:-http://localhost:5000}"
case "$SIZE" in
  mobile)  WS="390,844" ;;
  tablet)  WS="820,1180" ;;
  desktop) WS="1440,900" ;;
  *)       WS="${SIZE/x/,}" ;;
esac
CHROME="/c/Program Files/Google/Chrome/Application/chrome.exe"
PROFILE="$(mktemp -d)"
"$CHROME" --headless=new --disable-gpu --hide-scrollbars --no-first-run \
  --user-data-dir="$PROFILE" --virtual-time-budget=4000 \
  --window-size="$WS" --screenshot="$OUT" "$URL" >/dev/null 2>&1
rm -rf "$PROFILE"
echo "$OUT"
