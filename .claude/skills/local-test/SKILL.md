---
name: local-test
description: Write and run a small local test for a new feature and the code it touches. Use whenever a feature/fix is added (project rule A5), before reporting the step as done.
---

# Local test convention

- Runner: Node built-in, no deps. `node --test "tests/*.test.js"` (all) or `node --test tests/<name>.test.js` (one).
- Load the browser scripts with `tests/_load.js`:
  `const ctx = load(["js/03-i18n.js", ...], { state: {...} })`. Top-level `var`/`function` become `ctx.*`.
  List dependency files in load order (same order as index.html). Pass missing globals via the 2nd arg.
- One file per feature: `tests/<feature>.test.js`. Cover the new feature + directly related functions only.
  Target pure logic (ID encode, loc code, name fallback, diff/merge, validation). DOM rendering → use `preview` screenshots instead.
- Keep it small: a few `test()` cases, edge cases that matter (boundaries, empty, collision).
- Run only the related test file during work; run all before handing back.
- CI runs all tests before deploy (.github/workflows/deploy.yml). A red test blocks deploy.
