"use strict";
const test = require("node:test");
const assert = require("node:assert");
const { load } = require("../_load");

const c = load(["js/27-browse-swipe-back.js"]);

test("swipeBackClamp", () => {
  assert.strictEqual(c.swipeBackClamp(-20, 300), 0);
  assert.strictEqual(c.swipeBackClamp(0, 300), 0);
  assert.strictEqual(c.swipeBackClamp(120, 300), 120);
  assert.strictEqual(c.swipeBackClamp(999, 300), 300);
  assert.strictEqual(c.swipeBackClamp(NaN, 300), 0);
});

test("swipeBackDecision", () => {
  assert.strictEqual(c.swipeBackDecision(150, 300, 0), "commit");   // > 35%
  assert.strictEqual(c.swipeBackDecision(100, 300, 0), "cancel");   // < 35%
  assert.strictEqual(c.swipeBackDecision(40, 300, 0.8), "commit");  // flick
  assert.strictEqual(c.swipeBackDecision(40, 300, 0.3), "cancel");
  assert.strictEqual(c.swipeBackDecision(0, 300, 2), "cancel");     // nothing dragged
  assert.strictEqual(c.swipeBackDecision(100, 0, 0), "cancel");
});

test("swipeBackAvailable", () => {
  assert.strictEqual(c.swipeBackAvailable({ narrow:true, treeView:true, columnCount:2 }), true);
  assert.strictEqual(c.swipeBackAvailable({ narrow:true, treeView:true, columnCount:1 }), false);
  assert.strictEqual(c.swipeBackAvailable({ narrow:false, treeView:true, columnCount:3 }), false);
  assert.strictEqual(c.swipeBackAvailable({ narrow:true, treeView:false, columnCount:2 }), false);
});

