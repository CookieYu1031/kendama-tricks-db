// Rate info page rows (js/48-modal-rate-info.js): none first, then every RATE_LEVELS step with its name and hint.
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const { load } = require("../_load");

test("rateInfoRows lists none + all rate levels with names and hints", () => {
  const c = load(["js/01-data-model.js", "js/01-data-storage.js", "js/02-constants-colors-icons.js", "js/03-i18n.js", "js/04-state.js",
    "js/05-data-util.js", "js/32-trick-drawer.js", "js/48-modal-rate-info.js"]);
  const rows = c.rateInfoRows();
  assert.deepStrictEqual([...rows.map((r) => r.level)], ["none"].concat([...c.RATE_LEVELS]));
  rows.forEach((r) => {
    assert.ok(r.name && r.name !== "rate_" + r.level, r.level);
    assert.ok(r.hint && r.hint !== "rateHint_" + r.level, r.level);
  });
});
