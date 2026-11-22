"use strict";
const test = require("node:test");
const assert = require("node:assert");
const { load } = require("../_load");

function setup(){
  let seq = 0;
  return load(
    ["js/01-data-model.js", "js/01-data-storage.js", "js/02-constants-colors-icons.js", "js/04-state.js", "js/05-data-helpers.js", "js/05-data-ops.js", "js/05-data-util.js"],
    { localize: (n) => n && n.zh, nextId: (taken) => { let id; do { id = "id" + (++seq); } while(taken && taken(id)); return id; } }
  );
}
const sp = (code) => ({ id: "s" + code, code });
const customs = (n) => Array.from({ length: n }, (_, i) => sp("0" + String.fromCharCode(97 + i)));

test("allocSpaceCode: no customs -> 0a (locked codes ignored)", () => {
  const ctx = setup();
  assert.strictEqual(ctx.allocSpaceCode([sp("00"), sp("01"), sp("02"), sp(null)]), "0a");
});
test("allocSpaceCode: reuses lowest gap", () => {
  const ctx = setup();
  assert.strictEqual(ctx.allocSpaceCode([sp("0a"), sp("0c")]), "0b");
  assert.strictEqual(ctx.allocSpaceCode([sp("0b")]), "0a");
});
test("allocSpaceCode: full -> null", () => {
  const ctx = setup();
  assert.strictEqual(ctx.allocSpaceCode(customs(25)), "0z");
  assert.strictEqual(ctx.allocSpaceCode(customs(26)), null);
});
test("createSpace assigns code automatically, ignores fields.code, blocks at 26", () => {
  const ctx = setup();
  ctx.db = ctx.normalizeDB({ categories: [], tricks: [] });
  const a = ctx.createSpace({ name: { zh: "A" }, code: "0q" });
  assert.strictEqual(a.code, "0a");
  for(let i = 1; i < 26; i++) assert.ok(ctx.createSpace({ name: { zh: "x" } }));
  assert.strictEqual(ctx.createSpace({ name: { zh: "over" } }), null);
});
