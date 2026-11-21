#!/usr/bin/env bash
# Renders site icons from assets/brand/kendama-white.png via scripts/icon-render.html (canvas):
#   assets/brand-icon.png (512, transparent), assets/app-icon-{180,192,512}.png (#313131 tile),
#   assets/favicon-{32,192}-{white,black}.png (transparent; white for dark tabs, black for light).
# Then run scripts/build-og-banner.sh for the share banner.
set -euo pipefail
cd "$(dirname "$0")/.."
CHROME="/c/Program Files/Google/Chrome/Application/chrome.exe"
PROFILE="$(mktemp -d)"
SRC="file:///$(cygpath -m "$PWD/scripts/icon-render.html" 2>/dev/null || echo "$PWD/scripts/icon-render.html")"
"$CHROME" --headless=new --disable-gpu --no-first-run --user-data-dir="$PROFILE" \
  --allow-file-access-from-files --disable-web-security --virtual-time-budget=4000 \
  --dump-dom "$SRC" 2>/dev/null \
  | node -e '
    var fs = require("fs"), html = fs.readFileSync(0, "utf8");
    var re = /([\w-]+\.png) data:image\/png;base64,([A-Za-z0-9+\/=]+)/g, m, n = 0;
    while((m = re.exec(html))){ fs.writeFileSync("assets/" + m[1], Buffer.from(m[2], "base64")); console.log("assets/" + m[1]); n++; }
    if(n !== 8){ console.error("expected 8 icons, got " + n); process.exit(1); }
  '
rm -rf "$PROFILE"
