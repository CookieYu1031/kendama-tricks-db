"use strict";
// v0.9.3: search index guide pure logic (js/78) + tag manager fixed size + stats without removed cards.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const { load } = require("./_load");

function stubEl(){
  return { addEventListener(){}, classList: { add(){}, remove(){}, toggle(){}, contains(){ return false; } }, setAttribute(){}, style: {} };
}
function ctx(){
  return load(["js/01-data-model.js", "js/01-data-storage.js","js/02-constants-colors-icons.js","js/03-i18n.js","js/04-state.js","js/05-data-helpers.js", "js/05-data-ops.js", "js/05-data-util.js",
    "js/16-shell-updates.js","js/70-admin-panel.js","js/78-admin-index-guide.js"], {
    document: { getElementById: stubEl, querySelector(){ return null; }, querySelectorAll: () => [], addEventListener(){}, createElement: stubEl, documentElement: stubEl() }
  });
}

test("indexGuideCompare", () => {
  const c = ctx();
  assert.strictEqual(c.indexGuideCompare(0, 3), "none");
  assert.strictEqual(c.indexGuideCompare(5, null), "unknown");
  assert.strictEqual(c.indexGuideCompare(5, 5), "uptodate");
  assert.strictEqual(c.indexGuideCompare(5, "5"), "uptodate");
  assert.strictEqual(c.indexGuideCompare(6, 5), "outdated");
});

test("indexPollStep state machine", () => {
  const c = ctx();
  const p0 = { status: "polling", startedAt: 1000, target: 7 };
  assert.strictEqual(c.indexPollStep(p0, 6, 2000).status, "polling");
  assert.strictEqual(c.indexPollStep(p0, null, 2000).status, "polling");
  assert.strictEqual(c.indexPollStep(p0, 7, 2000).status, "done");
  assert.strictEqual(c.indexPollStep(p0, 6, 1000 + 5 * 60 * 1000).status, "timeout");
  assert.strictEqual(c.indexPollStep(p0, 7, 1000 + 6 * 60 * 1000).status, "done"); // match wins over timeout
  const done = { status: "done", startedAt: 1, target: 7 };
  assert.strictEqual(c.indexPollStep(done, 1, 9e9), done);
  assert.strictEqual(c.indexPollStop(p0).status, "stopped");
  assert.strictEqual(c.indexPollStop(done).status, "done");
});

test("indexGuideSteps", () => {
  const c = ctx();
  const j = (x) => JSON.stringify(x);
  assert.strictEqual(j(c.indexGuideSteps("uptodate", false, "stopped")), j(["done","done","done","done"]));
  assert.strictEqual(j(c.indexGuideSteps("outdated", false, "stopped")), j(["done","active","pending","pending"]));
  assert.strictEqual(j(c.indexGuideSteps("outdated", true, "stopped")), j(["done","done","active","pending"]));
  assert.strictEqual(j(c.indexGuideSteps("outdated", true, "polling")), j(["done","done","done","active"]));
  assert.strictEqual(j(c.indexGuideSteps("outdated", true, "done")), j(["done","done","done","done"]));
});

test("i18n keys exist in zh/jp/en; removed stats strings gone", () => {
  const src = fs.readFileSync(path.join(__dirname, "../js/78-admin-index-guide.js"), "utf8");
  const keys = (src.match(/idx[A-Z]\w*(?=:")/g) || []);
  assert.ok(keys.length >= 3 * 15);
  const stats = fs.readFileSync(path.join(__dirname, "../js/75-admin-stats.js"), "utf8");
  ["stGa4", "stTopLanded", "stRateDist"].forEach((k) => assert.ok(stats.indexOf(k) === -1, k));
  assert.ok(stats.indexOf("使用者語言占比") !== -1);
});

test("tag manager modal has fixed size css", () => {
  const css = fs.readFileSync(path.join(__dirname, "../css/tags.css"), "utf8");
  assert.ok(/\.tagmgr-modal\{[^}]*\bheight:\d+px/.test(css));
});
