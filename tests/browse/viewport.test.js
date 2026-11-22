"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const { load } = require("../_load");

const read = (f) => fs.readFileSync(path.join(__dirname, "..", "..", f), "utf8");

test("viewport classes: phone / tablet / desktop", () => {
  const c = load(["js/01-data-model.js", "js/01-data-storage.js", "js/02-constants-colors-icons.js", "js/04-state.js", "js/05-data-helpers.js"]);
  const at = (w) => { c.window.innerWidth = w; return [c.isPhoneViewport(), c.isTabletViewport(), c.visibleColumnCount()]; };
  assert.deepStrictEqual(at(390), [true, false, 1]);
  assert.deepStrictEqual(at(600), [true, false, 1]);
  assert.deepStrictEqual(at(601), [false, true, 2]);
  assert.deepStrictEqual(at(820), [false, true, 2]);
  assert.deepStrictEqual(at(860), [false, true, 2]);
  assert.deepStrictEqual(at(861), [false, false, 0]);
  assert.strictEqual(c.isNarrowViewport(), false);
  c.window.innerWidth = 700;
  assert.strictEqual(c.isNarrowViewport(), true);
});


