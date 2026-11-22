---
name: local-test
description: Write and run a small local test for a new feature and the code it touches. Use whenever a feature/fix is added (project rule A5), before reporting the step as done.
---

# Local test convention

- Runner: `node scripts/test.js` runs only tests related to what changed (vs main + uncommitted). `--list` shows the plan, `<category…>` picks folders, `--all` runs everything (CI). One file: `node --test tests/<category>/<name>.test.js`.
- Load the browser scripts with `tests/_load.js`:
  `const ctx = load(["js/03-i18n.js", ...], { state: {...} })`. Top-level `var`/`function` become `ctx.*`.
  List dependency files in load order (same order as index.html). Pass missing globals via the 2nd arg.
- One file per feature, in its category folder: `tests/<category>/<feature>.test.js` (categories and mapping: CLAUDE.md 測試, `scripts/test.js`). Require the loader as `require("../_load")`; repo root is `path.join(__dirname, "..", "..")`. Cover the new feature + directly related functions only.
  Target pure logic (ID encode, loc code, name fallback, diff/merge, validation). DOM rendering → use `preview` screenshots instead.
- Keep it small: a few `test()` cases, edge cases that matter (boundaries, empty, collision).
- Don't write: "removed feature is gone" checks, CSS/HTML string matching, per-feature i18n key checks (`tests/rules/i18n.test.js` covers all strings).
- Run `node scripts/test.js` during work and before handing back.
- CI runs all tests before deploy (.github/workflows/deploy.yml). A red test blocks deploy.
