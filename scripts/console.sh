#!/usr/bin/env bash
# Print browser console messages + uncaught errors from a headless page load.
# Usage: scripts/console.sh [url]   (exit 1 if any error/uncaught line)
set -uo pipefail
URL="${1:-http://localhost:5000}"
CHROME="/c/Program Files/Google/Chrome/Application/chrome.exe"
PROFILE="$(mktemp -d)"
OUT="$("$CHROME" --headless=new --disable-gpu --no-first-run --user-data-dir="$PROFILE" \
  --enable-logging=stderr --log-level=0 --virtual-time-budget=5000 --dump-dom "$URL" 2>&1 >/dev/null \
  | grep ":CONSOLE" | sed 's/^.*:CONSOLE:[0-9]*\] //')"
rm -rf "$PROFILE"
if [ -z "$OUT" ]; then echo "console: clean"; exit 0; fi
echo "$OUT"
echo "$OUT" | grep -qiE "error|uncaught" && exit 1 || exit 0
