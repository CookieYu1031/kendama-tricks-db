// Left-swipe select pure decisions (js/25-browse-swipe-select.js).
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const { load } = require("../_load");

const c = load(["js/25-browse-swipe-select.js"]);

test("intent: leftward horizontal locks, rightward / vertical abort, small = pending", () => {
  assert.strictEqual(c.swipeSelIntent(-12, 2), "lock");
  assert.strictEqual(c.swipeSelIntent(-12, 10), "pending"); // 12 < 1.5 * 10
  assert.strictEqual(c.swipeSelIntent(-30, 25), "abort");  // vertical enough, not horizontal enough
  assert.strictEqual(c.swipeSelIntent(14, 1), "abort");    // rightward = phone swipe-back's
  assert.strictEqual(c.swipeSelIntent(-5, 3), "pending");
  assert.strictEqual(c.swipeSelIntent(0, 14), "abort");
});

test("shift: 1:1 up to 72px, damped after, capped", () => {
  assert.strictEqual(c.swipeSelShift(-5), 0);
  assert.strictEqual(c.swipeSelShift(30), 30);
  assert.strictEqual(c.swipeSelShift(72), 72);
  const s = c.swipeSelShift(120);
  assert.ok(s > 72 && s < 120);
  assert.strictEqual(c.swipeSelShift(5000), 96);
});

test("decision: 48px or a flick toggles, otherwise cancel", () => {
  assert.strictEqual(c.swipeSelDecision(60, 0.1), "toggle");
  assert.strictEqual(c.swipeSelDecision(48, 0), "toggle");
  assert.strictEqual(c.swipeSelDecision(47, 0.1), "cancel");
  assert.strictEqual(c.swipeSelDecision(20, 0.8), "toggle");
  assert.strictEqual(c.swipeSelDecision(8, 2), "cancel"); // tiny flick is noise
  assert.strictEqual(c.swipeSelDecision(0, 5), "cancel");
});
