"use strict";
// v0.14.7 admin-editable grip / part names: db.labels normalize, t() override, edit helper, publish/pending/base.
const test = require("node:test");
const assert = require("node:assert");
const { load } = require("../_load");
const eq = (a, b) => assert.strictEqual(JSON.stringify(a), JSON.stringify(b));

const dummyEl = { addEventListener(){}, classList:{ add(){}, remove(){}, toggle(){}, contains(){ return false; } }, closest(){ return null; } };
const doc = { getElementById: () => dummyEl, querySelector: () => null, querySelectorAll: () => [], addEventListener(){}, createElement: () => ({ style:{}, classList:{ add(){}, remove(){}, toggle(){} }, appendChild(){}, setAttribute(){}, addEventListener(){} }) };
function ctx(){
  return load(["js/01-data-model.js", "js/01-data-storage.js", "js/02-constants-colors-icons.js", "js/03-i18n.js", "js/04-state.js",
    "js/05-data-helpers.js", "js/05-data-ops.js", "js/05-data-util.js", "js/50-sync-core.js", "js/51-shared-base.js", "js/56-pending.js", "js/77-admin-tags.js", "js/77-admin-labels.js"],
    { URL, document: doc, TextEncoder, TextDecoder });
}

test("normalizeLabels: known keys only, trimmed, capped, empty dropped", () => {
  const c = ctx();
  const out = c.normalizeLabels({
    grip_ken_sara: { zh: "  皿  ", jp: 5, en: "x".repeat(100) },
    part_sara: { zh: "", jp: "", en: "" },
    bogus_key: { zh: "a" },
    gripS_ito: { zh: "線" }
  });
  eq(Object.keys(out), ["grip_ken_sara", "gripS_ito"]);
  assert.strictEqual(out.grip_ken_sara.zh, "皿");
  assert.strictEqual(out.grip_ken_sara.jp, "");
  assert.strictEqual(out.grip_ken_sara.en.length, 60);
  eq(c.normalizeLabels(null), {});
  eq(c.normalizeDB({ categories: [], tricks: [], labels: { part_ana: { en: "Hole2" } } }).labels, { part_ana: { zh: "", jp: "", en: "Hole2" } });
});

test("t(): override for current language, else built-in", () => {
  const c = ctx();
  const builtin = c.t("part_sara");
  c.state.lang = "zh";
  c.db.labels = { part_sara: { zh: "大皿X", jp: "", en: "" } };
  assert.strictEqual(c.t("part_sara"), "大皿X");
  c.state.lang = "en";
  assert.strictEqual(c.t("part_sara"), c.defaultText("part_sara", "en"));
  c.state.lang = "zh"; c.db.labels = {};
  assert.strictEqual(c.t("part_sara"), builtin);
  assert.strictEqual(c.t("nonexistentKey"), "nonexistentKey");
});

test("applyLabelEdit: equal-to-default and empty dropped; reset removes", () => {
  const c = ctx();
  c.state.lang = "zh";
  let l = c.applyLabelEdit({}, "grip_ken_sara", { zh: "新皿", jp: c.defaultText("grip_ken_sara", "jp"), en: "" });
  eq(l, { grip_ken_sara: { zh: "新皿", jp: "", en: "" } });
  l = c.applyLabelEdit(l, "grip_ken_sara", { zh: "", jp: "", en: "" });
  eq(l, {});
  eq(c.applyLabelEdit({}, "nope", { zh: "a" }), {});
});

test("publish snapshot / base snapshot carry labels; pending counts changes", () => {
  const c = ctx();
  const labels = { part_ana: { zh: "洞", jp: "", en: "" } };
  const snap = c.buildPublishSnapshot({ categories: [], tricks: [], infos: [], tags: [], labels });
  eq(snap.labels, labels);
  eq(c.normalizeBaseSnapshot(3, { labels }).labels, labels);
  eq(c.normalizeBaseSnapshot(3, {}).labels, {});
  const base = { categories: [], tricks: [], infos: [], tags: [], labels: {} };
  const data = { categories: [], tricks: [], infos: [], tags: [], labels };
  assert.strictEqual(c.computePendingStatus(base, data).summary.tags, 1);
  assert.strictEqual(c.computePendingStatus(data, data).summary.tags, 0);
  assert.strictEqual(c.computePendingStatus(data, base).summary.tags, 1);
});

test("tagDropSlot: wrapping chip row, same line by x midpoint, later line before pointer", () => {
  const c = ctx();
  const R = (left, top) => ({ left, top, bottom: top + 30, width: 60 });
  // two lines: [0,70,140] on y 0..30, [0,70] on y 40..70
  const rects = [R(0, 0), R(70, 0), R(140, 0), R(0, 40), R(70, 40)];
  assert.strictEqual(c.tagDropSlot(rects, 10, 10), 0);
  assert.strictEqual(c.tagDropSlot(rects, 50, 10), 1);
  assert.strictEqual(c.tagDropSlot(rects, 250, 10), 3);
  assert.strictEqual(c.tagDropSlot(rects, 20, 50), 3);
  assert.strictEqual(c.tagDropSlot(rects, 200, 50), 5);
  assert.strictEqual(c.tagDropSlot([], 5, 5), 0);
});
