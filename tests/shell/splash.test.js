// 載入畫面：有本機資料才立刻收起（js/10-shell-splash.js）。
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const { load } = require("../_load");

test("bootHasCache: 有使用者快取且有內容才算", () => {
  const c = load(["js/10-shell-splash.js"]);
  assert.strictEqual(c.bootHasCache({}, { tricks: [{}], categories: [] }), true);
  assert.strictEqual(c.bootHasCache({}, { tricks: [], categories: [{}] }), true);
  assert.strictEqual(c.bootHasCache({}, { tricks: [], categories: [] }), false);
  assert.strictEqual(c.bootHasCache(null, { tricks: [{}] }), false);
});
