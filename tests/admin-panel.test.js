"use strict";
// v0.6: admin panel pure logic + updates unread logic.
const test = require("node:test");
const assert = require("node:assert");
const { load } = require("./_load");

function stubEl(){
  return { addEventListener(){}, classList: { add(){}, remove(){}, toggle(){}, contains(){ return false; } }, setAttribute(){}, style: {} };
}
function ctx(){
  const c = load(["js/01-data-model.js","js/02-constants-colors-icons.js","js/03-i18n.js","js/04-state.js","js/05-data-helpers.js","js/16-shell-updates.js","js/70-admin-panel.js"], {
    document: { getElementById: stubEl, querySelector(){ return null; }, querySelectorAll: () => [], addEventListener(){}, createElement: stubEl, documentElement: stubEl() }
  });
  return c;
}

test("nextVersionLabel", () => {
  const c = ctx();
  assert.strictEqual(c.nextVersionLabel("1.0.3"), "1.0.4");
  assert.strictEqual(c.nextVersionLabel("1.0.9"), "1.0.10");
  assert.strictEqual(c.nextVersionLabel("v1.2"), "v1.3");
  assert.strictEqual(c.nextVersionLabel("2"), "3");
  assert.strictEqual(c.nextVersionLabel("1.0.3-beta"), "1.0.4-beta");
  assert.strictEqual(c.nextVersionLabel(""), "0.1.0");
  assert.strictEqual(c.nextVersionLabel(null), "0.1.0");
  assert.strictEqual(c.nextVersionLabel("abc"), "0.1.0");
});

test("validateVersionLabel", () => {
  const c = ctx();
  assert.strictEqual(c.validateVersionLabel("1.0.4"), "");
  assert.strictEqual(c.validateVersionLabel("v1_2-rc 1"), "");
  assert.strictEqual(c.validateVersionLabel("  "), "adminLabelEmpty");
  assert.strictEqual(c.validateVersionLabel(""), "adminLabelEmpty");
  assert.strictEqual(c.validateVersionLabel("1.0/4"), "adminLabelBad");
  assert.strictEqual(c.validateVersionLabel("版本1"), "adminLabelBad");
  assert.strictEqual(c.validateVersionLabel("a".repeat(32)), "");
  assert.strictEqual(c.validateVersionLabel("a".repeat(33)), "adminLabelBad");
});

test("updatesHasUnread + seen storage", () => {
  const c = ctx();
  assert.strictEqual(c.getUpdatesSeen(), 0);
  assert.strictEqual(c.updatesHasUnread(3, 0), true);
  assert.strictEqual(c.updatesHasUnread(3, 3), false);
  assert.strictEqual(c.updatesHasUnread(3, 5), false);
  assert.strictEqual(c.updatesHasUnread(0, 0), false);
  assert.strictEqual(c.updatesHasUnread(undefined, 0), false);
  c.setUpdatesSeen(4);
  assert.strictEqual(c.getUpdatesSeen(), 4);
  c.setUpdatesSeen(2); // never goes backwards
  assert.strictEqual(c.getUpdatesSeen(), 4);
});

test("normalizePending: numbers, arrays, lists, empty", () => {
  const c = ctx();
  const e = c.normalizePending(null);
  assert.strictEqual(e.total, 0);
  const p = c.normalizePending({ added: 2, modified: 1, removed: 0, tags: 3, lists: { added: ["A", "B"], modified: ["C"], removed: [] } });
  assert.strictEqual(p.total, 6);
  assert.deepStrictEqual(Array.from(p.lists.added), ["A", "B"]);
  const q = c.normalizePending({ added: ["x", "y"], modified: [], removed: ["z"], tags: 0 });
  assert.strictEqual(q.added, 2);
  assert.strictEqual(q.total, 3);
  assert.deepStrictEqual(Array.from(q.lists.removed), ["z"]);
});

test("formatPendingCounts + lastVersionLabel + date", () => {
  const c = ctx();
  const p = c.normalizePending({ added: 3, modified: 2, removed: 1, tags: 4 });
  assert.strictEqual(c.formatPendingCounts(p), "新增 3 · 變動 2 · 移除 1 · 標籤 4");
  assert.strictEqual(c.lastVersionLabel({ latestVersion: 3, latestLabel: "1.0.2" }), "1.0.2");
  assert.strictEqual(c.lastVersionLabel({ latestVersion: 3 }), "v3");
  assert.strictEqual(c.lastVersionLabel({ latestVersion: 0 }), "");
  assert.strictEqual(c.formatPublishedDate(null), "");
  assert.strictEqual(c.formatPublishedDate(new Date(2026, 10, 5)), "2026-11-05");
  assert.strictEqual(c.formatPublishedDate({ toDate: () => new Date(2026, 0, 31) }), "2026-01-31");
});
