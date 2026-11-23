// Custom colour modal pure logic (js/49): hex <-> HSV and the recent-colour list.
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const { load } = require("../_load");

const ctx = load(["js/01-data-model.js", "js/01-data-storage.js", "js/02-constants-colors-icons.js", "js/03-i18n.js", "js/49-modal-color-custom.js"]);

test("hexToHsv / hsvToHex: primaries, greys, invalid", () => {
  assert.deepStrictEqual(JSON.parse(JSON.stringify(ctx.hexToHsv("#ff0000"))), { h: 0, s: 1, v: 1 });
  assert.strictEqual(ctx.hexToHsv("#00ff00").h, 120);
  assert.strictEqual(ctx.hexToHsv("#0000ff").h, 240);
  assert.strictEqual(ctx.hexToHsv("#fff").s, 0);
  assert.strictEqual(ctx.hexToHsv("nope"), null);
  assert.strictEqual(ctx.hsvToHex(0, 1, 1), "#ff0000");
  assert.strictEqual(ctx.hsvToHex(240, 1, 1), "#0000ff");
  assert.strictEqual(ctx.hsvToHex(0, 0, 0), "#000000");
  assert.strictEqual(ctx.hsvToHex(720, 5, 9), "#ff0000"); // wraps hue, clamps s/v
});
test("hex -> hsv -> hex round trip stays within 1 unit per channel", () => {
  ["#3366cc", "#e88baa", "#dfab01", "#123456", "#a87a56"].forEach(h => {
    const v = ctx.hexToHsv(h), back = ctx.hsvToHex(v.h, v.s, v.v);
    for (let i = 1; i < 7; i += 2) assert.ok(Math.abs(parseInt(h.substr(i, 2), 16) - parseInt(back.substr(i, 2), 16)) <= 1, h);
  });
});
test("addRecentColor: newest first, de-duplicated, max 3, junk ignored", () => {
  let l = [];
  l = ctx.addRecentColor(l, "#111111");
  l = ctx.addRecentColor(l, "#222222");
  l = ctx.addRecentColor(l, "#333");
  assert.deepStrictEqual(Array.from(l), ["#333333", "#222222", "#111111"]);
  l = ctx.addRecentColor(l, "#111111");
  assert.deepStrictEqual(Array.from(l), ["#111111", "#333333", "#222222"]);
  l = ctx.addRecentColor(l, "#444444");
  assert.deepStrictEqual(Array.from(l), ["#444444", "#111111", "#333333"]);
  assert.deepStrictEqual(Array.from(ctx.addRecentColor(l, "bad")), Array.from(l));
});
test("recent colours persist in localStorage; corrupt data -> empty", () => {
  ctx.saveRecentColors(["#abcdef", "#123456"]);
  assert.deepStrictEqual(Array.from(ctx.loadRecentColors()), ["#abcdef", "#123456"]);
  ctx.localStorage.setItem("kendama-recent-colors-v1", "{oops");
  assert.deepStrictEqual(Array.from(ctx.loadRecentColors()), []);
});
