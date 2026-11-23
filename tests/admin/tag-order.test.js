"use strict";
// v0.14.7 admin tag drag-reorder: moveTag, mergeTagLists, pending order change, 3-way merge keeps order.
const test = require("node:test");
const assert = require("node:assert");
const { load } = require("../_load");
const eq = (a, b) => assert.strictEqual(JSON.stringify(a), JSON.stringify(b));

const dummyEl = { addEventListener(){}, classList:{ add(){}, remove(){}, toggle(){}, contains(){ return false; } }, closest(){ return null; } };
const doc = { getElementById: () => dummyEl, querySelector: () => null, querySelectorAll: () => [], addEventListener(){}, createElement: () => ({ style:{}, classList:{ add(){}, remove(){}, toggle(){} }, appendChild(){}, setAttribute(){}, addEventListener(){} }) };
function ctx(){
  return load(["js/01-data-model.js", "js/01-data-storage.js", "js/02-constants-colors-icons.js", "js/03-i18n.js", "js/04-state.js",
    "js/05-data-helpers.js", "js/05-data-ops.js", "js/05-data-util.js", "js/30-drawer-logic.js", "js/50-sync-core.js", "js/51-shared-base.js",
    "js/55-sync-conflict.js", "js/56-pending.js"], { URL, document: doc, TextEncoder, TextDecoder });
}
const T = (id, kind) => ({ id, kind, name: { zh: id, jp: "", en: "" } });
const ids = (l) => l.map((x) => x.id);

test("moveTag: reorders within kind, other kind keeps its slots", () => {
  const c = ctx();
  const tags = [T("a", "class"), T("x", "text"), T("b", "class"), T("c", "class"), T("y", "text")];
  eq(ids(c.moveTag(tags, "class", "c", 0)), ["c", "x", "a", "b", "y"]);
  eq(ids(c.moveTag(tags, "class", "a", 2)), ["b", "x", "c", "a", "y"]);
  eq(ids(c.moveTag(tags, "class", "a", 99)), ["b", "x", "c", "a", "y"]);
  eq(ids(c.moveTag(tags, "text", "y", 0)), ["a", "y", "b", "c", "x"]);
  eq(ids(c.moveTag(tags, "class", "nope", 0)), ids(tags));
  assert.notStrictEqual(c.moveTag(tags, "class", "a", 0), tags);
});

test("mergeTagLists: own order first for admin, base order first otherwise", () => {
  const c = ctx();
  const base = [T("a"), T("b"), T("c")];
  const own = [T("c"), T("a"), T("n")];
  eq(ids(c.mergeTagLists(base, own, true)), ["c", "a", "n", "b"]);
  eq(ids(c.mergeTagLists(base, own, false)), ["a", "b", "c", "n"]);
  const own2 = [Object.assign(T("a"), { name: { zh: "new", jp: "", en: "" } })];
  assert.strictEqual(c.mergeTagLists(base, own2, false)[0].name.zh, "new");
});

test("pending: a pure reorder counts as one tag change; adds/removes do not double count", () => {
  const c = ctx();
  const mk = (tags) => ({ categories: [], tricks: [], infos: [], tags, labels: {} });
  const base = mk([T("a"), T("b"), T("c")]);
  assert.strictEqual(c.computePendingStatus(base, mk([T("a"), T("b"), T("c")])).summary.tags, 0);
  assert.strictEqual(c.computePendingStatus(base, mk([T("c"), T("a"), T("b")])).summary.tags, 1);
  assert.strictEqual(c.computePendingStatus(base, mk([T("a"), T("b"), T("c"), T("d")])).summary.tags, 1);
  assert.strictEqual(c.computePendingStatus(base, mk([T("a"), T("c")])).summary.tags, 1);
});

test("threeWayMerge keeps the side that reordered tags", () => {
  const c = ctx();
  const base = { tags: [T("a"), T("b"), T("c")] };
  const reordered = { tags: [T("c"), T("a"), T("b")] };
  const same = { tags: [T("a"), T("b"), T("c")] };
  eq(ids(c.threeWayMerge(base, reordered, same, false).tags), ["c", "a", "b"]);
  eq(ids(c.threeWayMerge(base, same, reordered, true).tags), ["c", "a", "b"]);
  // both reorder -> newer wins
  const other = { tags: [T("b"), T("c"), T("a")] };
  eq(ids(c.threeWayMerge(base, reordered, other, true).tags), ["c", "a", "b"]);
  eq(ids(c.threeWayMerge(base, reordered, other, false).tags), ["b", "c", "a"]);
  // reorder + other side adds a tag
  eq(ids(c.threeWayMerge(base, reordered, { tags: [T("a"), T("b"), T("c"), T("d")] }, true).tags), ["c", "a", "b", "d"]);
});

test("normalizeDB keeps tag array order", () => {
  const c = ctx();
  const out = c.normalizeDB({ categories: [], tricks: [], tags: [T("z", "class"), T("m", "text"), T("a", "class")] });
  eq(ids(out.tags), ["z", "m", "a"]);
});
