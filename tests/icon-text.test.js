// Icon text limit (iconTextFits in js/02) and add-modal arrow navigation (addArrowTarget in js/47).
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const { load } = require("./_load");

const ctx = load(["js/01-data-model.js", "js/02-constants-colors-icons.js", "js/03-i18n.js", "js/04-state.js", "js/05-data-helpers.js",
  "js/07-id.js", "js/09-names.js", "js/20-browse-order.js", "js/30-drawer-logic.js", "js/31-drawer-sections.js", "js/32-trick-drawer.js", "js/47-modal-add.js"]);

test("iconTextFits: empty / whitespace / nullish fit", () => {
  assert.ok(ctx.iconTextFits(""));
  assert.ok(ctx.iconTextFits("   "));
  assert.ok(ctx.iconTextFits(null));
});
test("iconTextFits: ascii max 2 chars", () => {
  assert.ok(ctx.iconTextFits("V"));
  assert.ok(ctx.iconTextFits("V2"));
  assert.ok(!ctx.iconTextFits("V22"));
});
test("iconTextFits: CJK max 1 char", () => {
  assert.ok(ctx.iconTextFits("招"));
  assert.ok(ctx.iconTextFits("あ"));
  assert.ok(!ctx.iconTextFits("招式"));
  assert.ok(!ctx.iconTextFits("ABC"));
});
test("iconTextFits: mixed counts full-width as 2", () => {
  assert.ok(!ctx.iconTextFits("招V"));
  assert.ok(!ctx.iconTextFits("V招"));
});
test("iconTextFits: emoji and image icons always fit", () => {
  assert.ok(ctx.iconTextFits("🔥"));
  assert.ok(ctx.iconTextFits("🗂️"));
  assert.ok(ctx.iconTextFits("img:data:image/webp;base64,AAAA"));
});
test("iconTextFits: not applied while typing (no truncation of long IME text)", () => {
  assert.ok(!ctx.iconTextFits("ㄓㄨㄥ"));
});

test("addArrowTarget: single-line input moves down/up", () => {
  const f = { multiline: false, value: "x", selStart: 0, selEnd: 0, idx: 1, count: 4 };
  assert.strictEqual(ctx.addArrowTarget({ ...f, key: "ArrowDown" }), 2);
  assert.strictEqual(ctx.addArrowTarget({ ...f, key: "ArrowUp" }), 0);
  assert.strictEqual(ctx.addArrowTarget({ ...f, key: "ArrowUp", idx: 0 }), -1);
  assert.strictEqual(ctx.addArrowTarget({ ...f, key: "ArrowDown", idx: 3 }), -1);
  assert.strictEqual(ctx.addArrowTarget({ ...f, key: "Enter" }), -1);
});
test("addArrowTarget: ignores IME composition", () => {
  assert.strictEqual(ctx.addArrowTarget({ key: "ArrowDown", multiline: false, value: "", selStart: 0, selEnd: 0, idx: 0, count: 3, composing: true }), -1);
});
test("addArrowTarget: textarea only on last/first line", () => {
  const v = "ab\ncd";
  const base = { multiline: true, value: v, idx: 1, count: 3 };
  assert.strictEqual(ctx.addArrowTarget({ ...base, key: "ArrowDown", selStart: 1, selEnd: 1 }), -1);
  assert.strictEqual(ctx.addArrowTarget({ ...base, key: "ArrowDown", selStart: 4, selEnd: 4 }), 2);
  assert.strictEqual(ctx.addArrowTarget({ ...base, key: "ArrowUp", selStart: 4, selEnd: 4 }), -1);
  assert.strictEqual(ctx.addArrowTarget({ ...base, key: "ArrowUp", selStart: 1, selEnd: 1 }), 0);
  assert.strictEqual(ctx.addArrowTarget({ ...base, key: "ArrowDown", selStart: 4, selEnd: 5 }), -1);
});
