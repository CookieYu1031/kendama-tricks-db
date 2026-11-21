"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const { load } = require("./_load");

const read = (f) => fs.readFileSync(path.join(__dirname, "..", f), "utf8");

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

test("columns js: tablet keeps last two open, swipe-back phone-only", () => {
  const col = read("js/21-browse-columns.js");
  assert.ok(/isTabletViewport\(\)/.test(col));
  assert.ok(/colIndex <= columns\.length - 3/.test(col));
  assert.ok(/isMobile && colIndex === columns\.length-1/.test(col));
  const sw = read("js/27-browse-swipe-back.js");
  assert.ok(/narrow: isPhoneViewport\(\)/.test(sw));
});

test("css: tablet two-column block, phone single column, fluid width", () => {
  const css = read("css/browse-columns.css");
  assert.ok(/@media \(min-width: 601px\) and \(max-width: 860px\)/.test(css));
  assert.ok(/@media \(max-width: 600px\)[\s\S]*mobile-active/.test(css));
  assert.ok(/min-width: 601px\)\{ \.swipe-back-handle/.test(css));
  assert.ok(/--col-w: clamp\(260px, calc\(21vw \/ var\(--ui-zoom\)\), 320px\)/.test(css));
});
