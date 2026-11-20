---
name: preview
description: Host the site locally, open it in the user's Chrome, and/or take headless screenshots (mobile/tablet/desktop) for Claude to inspect. Use after any UI change, when the user asks to see/check the page, or to visually verify a fix.
---

# Local preview

1. Start server (skip if `curl -s -o /dev/null -w "%{http_code}" http://localhost:5000` already returns 200):
   `firebase serve --only hosting -p 5000` — run with `run_in_background: true`. Poll with curl until 200.
2. For the user: PowerShell `Start-Process chrome http://localhost:5000`.
   Only when the user should look (end of a work step), not for Claude's own checks.
3. For Claude: `scripts/shot.sh <scratchpad>/<name>.png mobile|tablet|desktop|WxH [url]`, then Read the PNG.
   Check mobile (390x844) first: the design is mobile-first.
   Screenshots are signed-out state. Logged-in flows need the user to check in Chrome.
4. Compare against the existing look (colors, fonts, radius, spacing). The style must not drift.
