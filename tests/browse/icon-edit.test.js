// 編輯模式點圖示：寫回圖示與顏色（js/25-browse-icon-edit.js）。
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const { load } = require("../_load");

test("iconEditWrite: 沒變更不寫；預設色依類型存", () => {
  const c = load(["js/25-browse-icon-edit.js"]);
  const tr = { icon: "", color: "" }, cat = { icon: "🔥", color: "red" }, bare = {};
  assert.strictEqual(c.iconEditWrite(tr, "trick", "", ""), false);
  assert.strictEqual(c.iconEditWrite(bare, "category", "", ""), false);
  assert.deepStrictEqual(Object.keys(bare), []);
  assert.strictEqual(c.iconEditWrite(tr, "trick", "⭐", "blue"), true);
  assert.deepStrictEqual(tr, { icon: "⭐", color: "blue" });
  assert.strictEqual(c.iconEditWrite(cat, "category", "", ""), true); // 還原預設
  assert.deepStrictEqual(cat, { icon: "", color: "default" });
});
