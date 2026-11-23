// Item colour values: palette keys (old ones stay valid) and strict custom "#rrggbb".
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const { load } = require("../_load");

const ctx = load(["js/01-data-model.js", "js/01-data-storage.js", "js/02-constants-colors-icons.js"]);

test("normalizeHexColor: #RGB expands, case folds, junk rejected", () => {
  assert.strictEqual(ctx.normalizeHexColor("#ABC"), "#aabbcc");
  assert.strictEqual(ctx.normalizeHexColor(" #3366CC "), "#3366cc");
  ["", "#12", "#12345", "#1234567", "123456", "#gggggg", "red", "#fff;x", "url(x)", null, 5].forEach(v =>
    assert.strictEqual(ctx.normalizeHexColor(v), "", String(v)));
});
test("sanitizeColorKey: palette, legacy and hex kept; others fall back", () => {
  ["default", "gray", "pink", "magenta", "lime", "sky", "#a1b2c3"].forEach(k => assert.strictEqual(ctx.sanitizeColorKey(k), k));
  assert.strictEqual(ctx.sanitizeColorKey("#A1B2C3"), "#a1b2c3");
  assert.strictEqual(ctx.sanitizeColorKey("red;background:url(x)"), "default");
  assert.strictEqual(ctx.sanitizeColorKey("bogus", ""), "");
});
test("COLOR_PALETTE keys are all valid stored keys; order starts with default", () => {
  ctx.COLOR_PALETTE.forEach(c => assert.ok(ctx.isValidColorKey(c.key), c.key));
  assert.strictEqual(ctx.COLOR_PALETTE[0].key, "default");
  assert.strictEqual(ctx.COLOR_PALETTE.length, 13);
});
test("colorHex / hexToRgba: hex passes through, unknown -> default, var() uses color-mix", () => {
  assert.strictEqual(ctx.colorHex("#ABCDEF"), "#abcdef");
  assert.strictEqual(ctx.colorHex("evil"), ctx.COLOR_PALETTE[0].hex);
  assert.strictEqual(ctx.hexToRgba("#ff0000", 0.22), "rgba(255,0,0,0.22)");
  assert.ok(ctx.hexToRgba(ctx.colorHex("default"), 0.22).startsWith("color-mix("));
});
test("normalizeDB: custom hex kept, invalid colour reset, legacy key kept", () => {
  const db = ctx.normalizeDB({ spaces: [], categories: [
    { id: "c1", parentId: null, name: { zh: "a" }, color: "#ABCDEF" },
    { id: "c2", parentId: null, name: { zh: "b" }, color: "x;y" },
    { id: "c3", parentId: null, name: { zh: "c" }, color: "gray" }], infos: [], tricks: [
    { id: "t1", name: { zh: "t" }, color: "#12" }, { id: "t2", name: { zh: "u" }, color: "#00ff00" }] });
  const col = id => db.categories.find(c => c.id === id).color;
  assert.strictEqual(col("c1"), "#abcdef");
  assert.strictEqual(col("c2"), "default");
  assert.strictEqual(col("c3"), "gray");
  assert.strictEqual(db.tricks.find(t => t.id === "t1").color, "");
  assert.strictEqual(db.tricks.find(t => t.id === "t2").color, "#00ff00");
});
