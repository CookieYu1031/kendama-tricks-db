"use strict";
const test = require("node:test");
const assert = require("node:assert");
const { load } = require("../_load");

const ctx = load(["js/08-loc-code.js"]);
function mk(tree){
  // tree node: [type, id, children?]
  const map = {};
  function conv(n){ const o = { type: n[0], id: n[1] }; map[n[1]] = (n[2] || []).map(conv); return o; }
  const roots = tree.map(conv);
  return { roots, kids: (it) => map[it.id] || [] };
}
function codes(res){ return JSON.parse(JSON.stringify(res.map((r) => r.code))); }

test("root folder and nested chain", () => {
  const t = mk([["fo", "A", [["tr", "x"], ["fo", "B", [["tr", "T"]]]]]]);
  const r = ctx.computeLocCodes("00", t.roots, t.kids);
  assert.strictEqual(ctx.locCodeOf(r, "A")[0], "00-fo-00");
  assert.strictEqual(ctx.locCodeOf(r, "B")[0], "001a-fo-00");
  assert.strictEqual(ctx.locCodeOf(r, "T")[0], "001a2b-tr-00");
  assert.strictEqual(r[0].parentId, null);
  assert.strictEqual(r[3].parentId, "B");
});

test("serial counts same type only", () => {
  const t = mk([["fo", "f"], ["tr", "t1"], ["in", "i"], ["tr", "t2"]]);
  assert.deepStrictEqual(codes(ctx.computeLocCodes("01", t.roots, t.kids)),
    ["01-fo-00", "01-tr-00", "01-in-00", "01-tr-01"]);
});

test("27th sibling letter is A; 53rd ancestor overflows to null", () => {
  const sibs = [];
  for (let i = 0; i < 53; i++) sibs.push(["fo", "f" + i, [["tr", "c" + i]]]);
  const t = mk(sibs);
  const r = ctx.computeLocCodes("00", t.roots, t.kids);
  assert.strictEqual(ctx.locCodeOf(r, "c26")[0], "001A-tr-00");
  assert.strictEqual(ctx.locCodeOf(r, "c51")[0], "001Z-tr-00");
  assert.strictEqual(ctx.locCodeOf(r, "c52")[0], null);
  assert.strictEqual(ctx.locCodeOf(r, "f52")[0], "00-fo-1g"); // 52 = 1*36+16 -> "1g"
});

test("serial overflow -> null", () => {
  const sibs = [];
  for (let i = 0; i < 1297; i++) sibs.push(["tr", "t" + i]);
  const t = mk(sibs);
  const r = ctx.computeLocCodes("00", t.roots, t.kids);
  assert.strictEqual(r[1295].code, "00-tr-zz");
  assert.strictEqual(r[1296].code, null);
});

test("multi-placement trick gets two codes", () => {
  const t = mk([["fo", "A", [["tr", "T"]]], ["fo", "B", [["tr", "y"], ["tr", "T"]]]]);
  const r = ctx.computeLocCodes("00", t.roots, t.kids);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(ctx.locCodeOf(r, "T"))),
    ["001a-tr-00", "001b-tr-01"]);
});

test("custom table codes", () => {
  assert.strictEqual(ctx.customTableCode(0), "0a");
  assert.strictEqual(ctx.customTableCode(2), "0c");
  assert.strictEqual(ctx.customTableCode(25), "0z");
  assert.strictEqual(ctx.customTableCode(26), null);
  const t = mk([["tr", "t"]]);
  assert.strictEqual(ctx.computeLocCodes("0c", t.roots, t.kids)[0].code, "0c-tr-00");
  assert.deepStrictEqual(JSON.parse(JSON.stringify(ctx.TABLE_CODES_LOCKED)), ["00", "01", "02"]);
});

test("null table code -> empty", () => {
  const t = mk([["tr", "t"]]);
  assert.strictEqual(ctx.computeLocCodes(null, t.roots, t.kids).length, 0);
});

test("level 5 ignored", () => {
  const t = mk([["fo", "a", [["fo", "b", [["fo", "c", [["fo", "d", [["tr", "e"]]]]]]]]]]);
  const r = ctx.computeLocCodes("00", t.roots, t.kids);
  assert.strictEqual(r.length, 4);
  assert.strictEqual(ctx.locCodeOf(r, "d")[0], "001a2a3a-fo-00");
  assert.strictEqual(ctx.locCodeOf(r, "e").length, 0);
});
