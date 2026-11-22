// Rail mode button (js/12-shell-rail.js): view -> edit (pen, 編輯) -> view (check, 完成編輯). No review mode.
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const src = fs.readFileSync(path.join(__dirname, "..", "..", "js", "12-shell-rail.js"), "utf8");
const m = src.match(/function modeCycleSpec[\s\S]*?\r?\n  \}\r?\n/);
const modeCycleSpec = new Function(m[0] + "; return modeCycleSpec;")();

test("view -> edit with pen icon", () => {
  const s = modeCycleSpec("view");
  assert.deepStrictEqual([s.next, s.icon, s.labelKey], ["edit", "ICON_EDIT", "modeToEdit"]);
});
test("edit -> view with check icon, for admin and non-admin alike", () => {
  [true, false].forEach((a) => {
    const s = modeCycleSpec("edit", a);
    assert.deepStrictEqual([s.next, s.icon, s.labelKey], ["view", "ICON_CHECK", "modeToView"]);
  });
});
test("two taps return to view", () => {
  let mode = "view";
  for (let i = 0; i < 2; i++) mode = modeCycleSpec(mode).next;
  assert.strictEqual(mode, "view");
});
