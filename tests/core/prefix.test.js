// Item prefix data model (js/01-data-storage.js normalize*, js/05-data-prefix.js).
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const { load } = require("../_load");

function setup(){
  return load(["js/01-data-model.js", "js/01-data-storage.js", "js/02-constants-colors-icons.js", "js/04-state.js", "js/05-data-helpers.js", "js/05-data-ops.js", "js/05-data-prefix.js", "js/05-data-util.js"]);
}
const J = (o) => JSON.parse(JSON.stringify(o));

test("normalizePrefix trims, collapses spaces, caps at PREFIX_MAX, rejects non-strings", () => {
  const c = setup();
  assert.strictEqual(c.normalizePrefix("  1-2  "), "1-2");
  assert.strictEqual(c.normalizePrefix("a   b"), "a b");
  assert.strictEqual(c.normalizePrefix("x".repeat(40)).length, c.PREFIX_MAX);
  assert.strictEqual(c.normalizePrefix(5), "");
  assert.strictEqual(c.normalizePrefix(null), "");
});

test("normalizePrefixMap drops empties, sorts keys, null when empty", () => {
  const c = setup();
  assert.deepStrictEqual(Object.keys(c.normalizePrefixMap({ b: "2", a: "1", z: " " })), ["a", "b"]);
  assert.strictEqual(c.normalizePrefixMap({ a: "" }), null);
  assert.strictEqual(c.normalizePrefixMap(null), null);
});

test("setTrickPrefix: set, empty value removes entry and then the field", () => {
  const c = setup();
  const tr = { id: "t1" };
  c.setTrickPrefix(tr, "c1", "1");
  c.setTrickPrefix(tr, "a0", "2");
  assert.deepStrictEqual(Object.keys(tr.prefixByCategory), ["a0", "c1"]);
  c.setTrickPrefix(tr, "c1", "");
  assert.strictEqual(c.getTrickPrefix(tr, "c1"), "");
  c.setTrickPrefix(tr, "a0", "  ");
  assert.strictEqual("prefixByCategory" in tr, false);
});

test("setCategoryPrefix + normalizeDB: fields only when non-empty", () => {
  const c = setup();
  const cat = { id: "c1" };
  c.setCategoryPrefix(cat, " A ");
  assert.strictEqual(cat.prefix, "A");
  c.setCategoryPrefix(cat, "");
  assert.strictEqual("prefix" in cat, false);
  const nm = { zh: "n", jp: "", en: "" };
  const db = c.normalizeDB({ categories: [{ id: "c1", parentId: null, spaceId: "t00", name: nm, order: 0 }, { id: "c2", parentId: null, spaceId: "t00", name: nm, order: 1, prefix: " P " }],
    tricks: [{ id: "t000001", name: nm, categoryIds: ["c1"] }, { id: "t000002", name: nm, categoryIds: ["c1"], prefixByCategory: { c1: "x", b: "", a: "y" } }], infos: [], tags: [] });
  const g = (id) => db.categories.find((x) => x.id === id), tk = (id) => db.tricks.find((x) => x.id === id);
  assert.strictEqual("prefix" in g("c1"), false);
  assert.strictEqual(g("c2").prefix, "P");
  assert.strictEqual("prefixByCategory" in tk("t000001"), false);
  assert.deepStrictEqual(Object.keys(J(tk("t000002").prefixByCategory)), ["a", "c1"]);
});

test("info prefix: normalizeDB keeps it only when non-empty; itemPrefix reads it", () => {
  const c = setup();
  const nm = { zh: "i", jp: "", en: "" };
  const d = c.normalizeDB({ infos: [
    { id: "i1", parentId: null, title: nm, prefix: "  A-1 " },
    { id: "i2", parentId: null, title: nm, prefix: "  " },
    { id: "i3", parentId: null, title: nm }
  ] });
  assert.strictEqual(d.infos[0].prefix, "A-1");
  assert.ok(!("prefix" in d.infos[1]) && !("prefix" in d.infos[2]));
  assert.strictEqual(c.itemPrefix({ type: "info", ref: d.infos[0] }, null), "A-1");
  assert.strictEqual(c.itemPrefix({ type: "info", ref: d.infos[2] }, null), "");
  c.setCategoryPrefix(d.infos[0], "");
  assert.ok(!("prefix" in d.infos[0]));
});
