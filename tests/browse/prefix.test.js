// Row prefix lookup (js/05-data-prefix.js itemPrefix) as used by browse rows and sorting.
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const { load } = require("../_load");

function setup(){
  const ctx = load(["js/01-data-model.js", "js/01-data-storage.js", "js/02-constants-colors-icons.js", "js/04-state.js", "js/05-data-helpers.js", "js/05-data-ops.js", "js/05-data-prefix.js", "js/05-data-util.js", "js/20-browse-order.js"]);
  ctx.state.activeSpace = "t00";
  return ctx;
}

test("itemPrefix: category, trick per container, root uses table id, info none", () => {
  const c = setup();
  const cat = { id: "c1", prefix: "A" };
  const tr = { id: "t1", prefixByCategory: { c1: "1-2", t00: "R" } };
  assert.strictEqual(c.itemPrefix({ type: "category", ref: cat }, null), "A");
  assert.strictEqual(c.itemPrefix({ type: "trick", ref: tr }, "c1"), "1-2");
  assert.strictEqual(c.itemPrefix({ type: "trick", ref: tr }, null), "R");
  assert.strictEqual(c.itemPrefix({ type: "trick", ref: tr }, "other"), "");
  assert.strictEqual(c.itemPrefix({ type: "info", ref: {} }, "c1"), "");
  assert.strictEqual(c.itemPrefix(null, "c1"), "");
});
