// Practice list (js/83-practice-logic.js, js/84-practice-panel.js, js/85-practice-sync.js).
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const { load } = require("../_load");

const BASE = ["js/01-data-model.js", "js/01-data-storage.js", "js/02-constants-colors-icons.js", "js/03-i18n.js", "js/04-state.js",
  "js/05-data-helpers.js", "js/05-data-ops.js", "js/05-data-util.js", "js/06-icons-svg.js", "js/80-tools.js", "js/83-practice-logic.js"];
const setup = () => load(BASE);
const arr = (x) => JSON.parse(JSON.stringify(x));

test("list limits: 20 lists, name rules", () => {
  const c = setup(), d = c.newPracticeData();
  assert.strictEqual(c.createPracticeList(d, "   "), null);
  for (let i = 0; i < 20; i++) assert.ok(c.createPracticeList(d, "L" + i));
  assert.strictEqual(c.createPracticeList(d, "x"), null);
  assert.strictEqual(d.lists.length, 20);
  assert.strictEqual(new Set(d.lists.map((l) => l.id)).size, 20);
  const l = d.lists[0];
  assert.ok(c.renamePracticeList(d, l.id, "a".repeat(60)));
  assert.strictEqual(l.name.length, 40);
  assert.strictEqual(c.renamePracticeList(d, l.id, " "), false);
  assert.ok(c.deletePracticeList(d, l.id));
  assert.strictEqual(d.lists.length, 19);
  assert.strictEqual(c.deletePracticeList(d, "nope"), false);
});

test("items: 50 cap, dedupe, remove", () => {
  const c = setup(), d = c.newPracticeData(), l = c.createPracticeList(d, "A");
  assert.strictEqual(c.addPracticeTrick(l, "t1"), true);
  assert.strictEqual(c.addPracticeTrick(l, "t1"), "dup");
  assert.strictEqual(c.addPracticeTrick(l, ""), "bad");
  for (let i = 2; i <= 50; i++) assert.strictEqual(c.addPracticeTrick(l, "t" + i), true);
  assert.strictEqual(c.addPracticeTrick(l, "t51"), "full");
  assert.strictEqual(l.items.length, 50);
  assert.deepStrictEqual(arr(l.items[0]), { trickId: "t1", target: 10, count: 0 });
  assert.strictEqual(c.removePracticeTrick(l, "t1"), true);
  assert.strictEqual(c.removePracticeTrick(l, "t1"), false);
});

test("count floor, target clamp, reset, progress", () => {
  const c = setup(), d = c.newPracticeData(), l = c.createPracticeList(d, "A");
  c.addPracticeTrick(l, "a"); c.addPracticeTrick(l, "b");
  assert.strictEqual(c.bumpPracticeCount(l, "a", -1), 0);
  assert.strictEqual(c.bumpPracticeCount(l, "a", 1), 1);
  assert.strictEqual(c.bumpPracticeCount(l, "zz", 1), null);
  assert.strictEqual(c.setPracticeTarget(l, "a", 0), 1);
  assert.strictEqual(c.setPracticeTarget(l, "a", 5000), 999);
  assert.strictEqual(c.setPracticeTarget(l, "a", "abc"), 10);
  assert.strictEqual(c.setPracticeTarget(l, "a", 3.9), 3);
  for (let i = 0; i < 12; i++) c.bumpPracticeCount(l, "a", 1); // past target is allowed
  assert.strictEqual(l.items[0].count, 13);
  assert.deepStrictEqual(arr(c.practiceProgress(l)), { done: 1, total: 2 });
  assert.deepStrictEqual(arr(c.practiceProgress(l, (id) => id === "b")), { done: 0, total: 1 });
  c.resetPracticeCounts(l);
  assert.ok(l.items.every((it) => it.count === 0));
  assert.strictEqual(l.items[0].target, 3);
});

test("normalize garbage input", () => {
  const c = setup();
  assert.deepStrictEqual(arr(c.normalizePracticeData(null)), { lists: [], clientUpdatedAt: 0 });
  assert.deepStrictEqual(arr(c.normalizePracticeData("x")), { lists: [], clientUpdatedAt: 0 });
  const lists = [];
  for (let i = 0; i < 30; i++) lists.push({ id: "l" + i, name: "n", items: [] });
  lists.push(null, { id: "" }, { id: "l1" }, 5);
  assert.strictEqual(c.normalizePracticeData({ lists }).lists.length, 20);
  const items = [{ trickId: "a", target: -5, count: -3 }, { trickId: "a" }, { trickId: 7 }, null, { trickId: "b", target: "x", count: "4.7" }];
  for (let i = 0; i < 60; i++) items.push({ trickId: "z" + i });
  const n = c.normalizePracticeData({ lists: [{ id: "q", name: 12, items }], clientUpdatedAt: "bad" });
  assert.strictEqual(n.clientUpdatedAt, 0);
  assert.strictEqual(n.lists[0].items.length, 50);
  assert.deepStrictEqual(arr(n.lists[0].items.slice(0, 2)), [{ trickId: "a", target: 1, count: 0 }, { trickId: "b", target: 10, count: 4 }]);
  assert.strictEqual(n.lists[0].name, "12");
});

test("merge decision: cloud vs local vs guest copy", () => {
  const c = setup();
  const mk = (cu, n) => c.normalizePracticeData({ clientUpdatedAt: cu, lists: n ? [{ id: "a", name: "x", items: [] }] : [] });
  assert.strictEqual(c.practiceDecideSync(mk(5, 1), mk(9, 1), null).action, "useCloud");
  assert.strictEqual(c.practiceDecideSync(mk(9, 1), mk(5, 1), null).action, "pushLocal");
  assert.strictEqual(c.practiceDecideSync(mk(5, 1), mk(5, 1), null).action, "none");
  assert.strictEqual(c.practiceDecideSync(null, mk(5, 1), mk(7, 1)).action, "useCloud");
  assert.strictEqual(c.practiceDecideSync(mk(5, 1), null, null).action, "pushLocal");
  const g = c.practiceDecideSync(null, null, mk(7, 1));
  assert.strictEqual(g.action, "copyGuest");
  assert.strictEqual(g.data.lists.length, 1);
  assert.strictEqual(c.practiceDecideSync(null, null, mk(7, 0)).action, "none");
  assert.strictEqual(c.practiceDecideSync(null, null, null).action, "none");
  // existing account data wins over guest data
  assert.strictEqual(c.practiceDecideSync(mk(3, 1), null, mk(9, 1)).action, "pushLocal");
});

test("practice tool open is a function after loading 84", () => {
  const c = load(BASE.concat(["js/84-practice-panel.js"]));
  assert.strictEqual(typeof c.getToolById("practice").open, "function");
  assert.strictEqual(c.isToolAvailable(c.getToolById("practice")), true);
  assert.strictEqual(c.getToolById("kwc").open, null);
});

test("sync storage: per-account keys, local roundtrip, edit stamps", () => {
  const c = load(BASE.concat(["js/85-practice-sync.js"]));
  assert.strictEqual(c.practiceKeyFor(null), "kendama-practice-guest-v1");
  assert.strictEqual(c.practiceKeyFor("u1"), "kendama-practice-u1-v1");
  assert.strictEqual(c.practiceLoadLocal(null), null);
  const d = c.practiceGet();
  c.createPracticeList(d, "A");
  c.practiceChanged();
  assert.ok(d.clientUpdatedAt > 0);
  assert.strictEqual(c.practiceLoadLocal(null).lists.length, 1);
  assert.strictEqual(c.practiceLoadLocal("u1"), null);
  c.localStorage.setItem("kendama-practice-u1-v1", "{broken");
  assert.strictEqual(c.practiceLoadLocal("u1").lists.length, 0);
});
