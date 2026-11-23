"use strict";
const test = require("node:test");
const assert = require("node:assert");
const { load } = require("../_load");

function setup(){
  const ctx = load(
    ["js/01-data-model.js", "js/01-data-storage.js", "js/02-constants-colors-icons.js", "js/04-state.js", "js/05-data-helpers.js", "js/05-data-ops.js", "js/05-data-util.js", "js/20-browse-order.js", "js/29-browse-sort.js"],
    { localize: (n) => n && n.zh, addStrings: () => {}, t: (k) => k }
  );
  return ctx;
}
const names = (arr) => arr.map((x) => x.name.zh);
const mkItems = (list) => list.map((n, i) => ({ type: "category", id: "c" + i, name: { zh: n }, ref: { order: i } }));

test("cycle: default -> asc -> desc -> default", () => {
  const ctx = setup();
  assert.strictEqual(ctx.nextColSortMode("default"), "asc");
  assert.strictEqual(ctx.nextColSortMode("asc"), "desc");
  assert.strictEqual(ctx.nextColSortMode("desc"), "default");
});

test("asc/desc with numbers, Chinese, Japanese", () => {
  const ctx = setup();
  const items = mkItems(["item10", "item2", "banana", "Apple"]);
  assert.deepStrictEqual(names(ctx.applyColSort(items, "asc", null)), ["Apple", "banana", "item2", "item10"]);
  assert.deepStrictEqual(names(ctx.applyColSort(items, "desc", null)), ["item10", "item2", "banana", "Apple"]);
  ctx.state.lang = "jp";
  const jp = mkItems(["さ", "あ", "か"]);
  assert.deepStrictEqual(names(ctx.applyColSort(jp, "asc", null)), ["あ", "か", "さ"]);
  ctx.state.lang = "zh";
  const zh = mkItems(["乙", "甲", "丙"]);
  assert.strictEqual(ctx.applyColSort(zh, "asc", null).length, 3);
});

test("same name keeps default order (stable), both directions", () => {
  const ctx = setup();
  const items = mkItems(["a", "a", "a"]);
  assert.deepStrictEqual(ctx.applyColSort(items, "asc", null).map((x) => x.id), ["c0", "c1", "c2"]);
  assert.deepStrictEqual(ctx.applyColSort(items, "desc", null).map((x) => x.id), ["c0", "c1", "c2"]);
});

test("default equals sortColumnItems and does not mutate input", () => {
  const ctx = setup();
  const items = mkItems(["z", "y", "x"]);
  items[0].ref.order = 5; items[1].ref.order = 1; items[2].ref.order = 3;
  const before = items.map((x) => x.id);
  const a = ctx.applyColSort(items, "default", null).map((x) => x.id);
  assert.deepStrictEqual(a, ctx.sortColumnItems(items, null).map((x) => x.id));
  assert.deepStrictEqual(items.map((x) => x.id), before);
  assert.strictEqual(items[0].ref.order, 5);
});

test("prune removes keys not in chain; space change clears all", () => {
  const ctx = setup();
  ctx.pruneColSort(["__root__", "a", "b"]);
  ctx.state.colSort = { __root__: "asc", a: "desc", b: "asc" };
  ctx.pruneColSort(["__root__", "a"]);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(ctx.state.colSort)), { __root__: "asc", a: "desc" });
  ctx.state.activeSpace = "other";
  ctx.pruneColSort(["__root__", "a"]);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(ctx.state.colSort)), {});
  assert.strictEqual(ctx.colSortMode("a"), "default");
});
