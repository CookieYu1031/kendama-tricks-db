// Part info page examples (js/48-modal-part-info.js): three rows, every part key is a real PART_KEYS entry.
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const { load } = require("../_load");

test("partInfoExamples has 3 rows with valid part keys and 3-language names", () => {
  const c = load(["js/01-data-model.js", "js/01-data-storage.js", "js/02-constants-colors-icons.js", "js/03-i18n.js", "js/04-state.js",
    "js/05-data-util.js", "js/32-trick-drawer.js", "js/48-modal-part-info.js"]);
  const rows = c.partInfoExamples();
  assert.strictEqual(rows.length, 3);
  rows.forEach((r) => {
    assert.ok(r.en);
    ["zh", "jp", "en"].forEach((l) => assert.ok(r.name[l], l));
    r.parts.forEach((k) => assert.ok([...c.PART_KEYS].includes(k), k));
  });
});
