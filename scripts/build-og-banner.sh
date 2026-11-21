#!/usr/bin/env bash
# Renders scripts/og-banner.html to assets/og-banner.png (1200x630) with headless Chrome.
set -euo pipefail
cd "$(dirname "$0")/.."
CHROME="/c/Program Files/Google/Chrome/Application/chrome.exe"
PROFILE="$(mktemp -d)"
SRC="file:///$(cygpath -m "$PWD/scripts/og-banner.html" 2>/dev/null || echo "$PWD/scripts/og-banner.html")"
OUT="$(cygpath -m "$PWD/assets/og-banner.png" 2>/dev/null || echo "$PWD/assets/og-banner.png")"
"$CHROME" --headless=new --disable-gpu --hide-scrollbars --no-first-run \
  --user-data-dir="$PROFILE" --virtual-time-budget=6000 --allow-file-access-from-files \
  --window-size=1200,630 --screenshot="$OUT" "$SRC" >/dev/null 2>&1
rm -rf "$PROFILE"
echo "$OUT"
