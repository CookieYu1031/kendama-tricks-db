"use strict";
const test = require("node:test");
const assert = require("node:assert");
const { load } = require("../_load");

function setup(){
  return load(["js/01-data-model.js", "js/01-data-storage.js", "js/50-sync-core.js", "js/55-sync-conflict.js"],
    { localize: (n) => n && n.zh, addStrings: () => {} });
}
const J = (x) => JSON.parse(JSON.stringify(x));
const item = (id, v) => ({ id, v });
const mk = (tricks) => ({ spaces: [], categories: [], infos: [], tags: [], tricks });
const ids = (arr) => Array.from(arr).map((x) => x.id + ":" + x.v).sort();

test("untouched side takes the other side's change", () => {
  const c = setup();
  const base = mk([item("a", 1), item("b", 1)]);
  const local = mk([item("a", 2), item("b", 1)]);
  const cloud = mk([item("a", 1), item("b", 3)]);
  assert.deepStrictEqual(ids(J(c.threeWayMerge(base, local, cloud, false)).tricks), ["a:2", "b:3"]);
});

test("deleted on one side, untouched on the other -> deleted", () => {
  const c = setup();
  const base = mk([item("a", 1), item("b", 1)]);
  const local = mk([item("b", 1)]);
  const cloud = mk([item("a", 1)]);
  assert.deepStrictEqual(ids(J(c.threeWayMerge(base, local, cloud, true)).tricks), []);
});

test("delete vs edit follows the newer side", () => {
  const c = setup();
  const base = mk([item("a", 1)]);
  const local = mk([]);
  const cloud = mk([item("a", 2)]);
  assert.deepStrictEqual(ids(J(c.threeWayMerge(base, local, cloud, true)).tricks), []);
  assert.deepStrictEqual(ids(J(c.threeWayMerge(base, local, cloud, false)).tricks), ["a:2"]);
});

test("both edited the same item: newer side wins", () => {
  const c = setup();
  const base = mk([item("a", 1)]);
  const local = mk([item("a", 2)]);
  const cloud = mk([item("a", 3)]);
  assert.deepStrictEqual(ids(J(c.threeWayMerge(base, local, cloud, true)).tricks), ["a:2"]);
  assert.deepStrictEqual(ids(J(c.threeWayMerge(base, local, cloud, false)).tricks), ["a:3"]);
});

test("both added different items -> union; identical edits kept", () => {
  const c = setup();
  const base = mk([item("s", 1)]);
  const local = mk([item("s", 2), item("l", 1)]);
  const cloud = mk([item("s", 2), item("c", 1)]);
  assert.deepStrictEqual(ids(J(c.threeWayMerge(base, local, cloud, false)).tricks), ["c:1", "l:1", "s:2"]);
});

test("missing base is treated as empty: falls back to newer side", () => {
  const c = setup();
  const local = mk([item("a", 2)]);
  const cloud = mk([item("a", 3), item("b", 1)]);
  assert.deepStrictEqual(ids(J(c.threeWayMerge(null, local, cloud, true)).tricks), ["a:2", "b:1"]);
});

test("merges every collection", () => {
  const c = setup();
  const l = { spaces: [item("s1", 1)], categories: [item("c1", 1)], tricks: [], infos: [item("i1", 1)], tags: [item("g1", 1)] };
  const empty = { spaces: [], categories: [], tricks: [], infos: [], tags: [] };
  const r = J(c.threeWayMerge(empty, l, empty, true));
  assert.strictEqual(r.spaces.length + r.categories.length + r.infos.length + r.tags.length, 4);
});
