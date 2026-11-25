"use strict";
const test = require("node:test");
const assert = require("node:assert");
const { load } = require("../_load");

function setup(){
  const ctx = load(
    ["js/01-data-model.js", "js/01-data-storage.js", "js/02-constants-colors-icons.js", "js/04-state.js", "js/05-data-helpers.js", "js/05-data-ops.js", "js/05-data-prefix.js", "js/05-data-util.js", "js/20-browse-order.js", "js/29-browse-sort.js"],
    { localize: (n) => n && n.zh, addStrings: () => {}, t: (k) => k }
  );
  return ctx;
}
const names = (arr) => arr.map((x) => x.name.zh);
const mkItems = (list) => list.map((n, i) => ({ type: "category", id: "c" + i, name: { zh: n }, ref: { order: i } }));

test("toggle: default <-> desc", () => {
  const ctx = setup();
  assert.strictEqual(ctx.nextColSortMode("default"), "desc");
  assert.strictEqual(ctx.nextColSortMode("desc"), "default");
});

test("desc = the custom order reversed, names and prefixes never matter", () => {
  const ctx = setup();
  const items = mkItems(["b", "c", "a"]);
  assert.deepStrictEqual(names(ctx.applyColSort(items, "default", null)), ["b", "c", "a"]);
  assert.deepStrictEqual(names(ctx.applyColSort(items, "desc", null)), ["a", "c", "b"]);
  const tied = mkItems(["z", "a", "m"]);
  tied.forEach((x) => { x.ref.order = 1; });
  assert.deepStrictEqual(names(ctx.applyColSort(tied, "default", null)), ["z", "a", "m"]); // ties: insertion order
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

test("sort bar kind: 2+ items button, 1 item fixed label, empty / collapsed blank", () => {
  const ctx = setup();
  assert.deepStrictEqual([2, 1, 0].map((n) => ctx.colSortBarKind(n, false)), ["on", "fixed", "blank"]);
  assert.strictEqual(ctx.colSortBarKind(5, true), "blank");
});

test("prune removes keys not in chain; space change clears all", () => {
  const ctx = setup();
  ctx.pruneColSort(["__root__", "a", "b"]);
  ctx.state.colSort = { __root__: "desc", a: "desc", b: "desc" };
  ctx.pruneColSort(["__root__", "a"]);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(ctx.state.colSort)), { __root__: "desc", a: "desc" });
  ctx.state.activeSpace = "other";
  ctx.pruneColSort(["__root__", "a"]);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(ctx.state.colSort)), {});
  assert.strictEqual(ctx.colSortMode("a"), "default");
});
