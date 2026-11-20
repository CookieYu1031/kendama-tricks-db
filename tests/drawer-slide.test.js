"use strict";
// v0.4 E5: mobile drawer slides in from the right; swipe-right-to-close decision.
const test = require("node:test");
const assert = require("node:assert");
const { load } = require("./_load");

const ctx = load(["js/01-data-model.js", "js/02-constants-colors-icons.js", "js/03-i18n.js", "js/05-data-helpers.js",
  "js/07-id.js", "js/08-loc-code.js", "js/09-names.js", "js/30-trick-drawer.js"], { state: { lang: "zh", activeSpace: "t00" } });
const d = ctx.drawerSwipeDecision;

test("close past 30% of width", () => {
  assert.strictEqual(d(120, 5, 0.1, 400), "close");
  assert.strictEqual(d(100, 5, 0.1, 400), "back");
});
test("fast flick closes even when short", () => {
  assert.strictEqual(d(40, 3, 0.8, 400), "close");
  assert.strictEqual(d(10, 1, 0.9, 400), "back"); // too short to count as a flick
});
test("mostly vertical or leftward is ignored", () => {
  assert.strictEqual(d(30, 80, 1, 400), "ignore");
  assert.strictEqual(d(-50, 0, 1, 400), "ignore");
  assert.strictEqual(d(0, 0, 0, 400), "ignore");
});
test("old bottom-sheet state removed", () => {
  assert.strictEqual(typeof ctx.setDrawerExpanded, "undefined");
  assert.strictEqual(typeof ctx.attachDrawerDragToClose, "undefined");
});
