// Practice list (js/83-practice-logic.js, js/84-practice-panel.js, js/85-practice-sync.js).
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const { load } = require("../_load");

const BASE = ["js/01-data-model.js", "js/01-data-storage.js", "js/02-constants-colors-icons.js", "js/03-i18n.js", "js/04-state.js",
  "js/05-data-helpers.js", "js/05-data-ops.js", "js/05-data-util.js", "js/06-icons-svg.js", "js/80-tools.js", "js/83-practice-logic.js", "js/84-practice-modes.js"];
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
  assert.deepStrictEqual(arr(l.items[0]), { trickId: "t1", target: null, count: 0 });
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
  assert.strictEqual(c.setPracticeTarget(l, "a", "abc"), null);
  assert.strictEqual(c.setPracticeTarget(l, "a", ""), null);
  assert.strictEqual(c.setPracticeTarget(l, "a", 6), 6);
  assert.strictEqual(c.setPracticeTarget(l, "a", 3.9), 3);
  c.setPracticeTarget(l, "a", 3);
  for (let i = 0; i < 12; i++) c.bumpPracticeCount(l, "a", 1); // bump (no tap rule) may pass the target
  assert.strictEqual(l.items[0].count, 13);
  assert.deepStrictEqual(arr(c.practiceProgress(l)), { done: 1, total: 1, items: 2 }); // b has no goal: not in the ratio
  assert.deepStrictEqual(arr(c.practiceProgress(l, (id) => id === "b")), { done: 0, total: 0, items: 1 });
  c.resetPracticeCounts(l);
  assert.ok(l.items.every((it) => it.count === 0));
  assert.strictEqual(l.items[0].target, 3);
});

test("normalize garbage input", () => {
  const c = setup();
  assert.deepStrictEqual(arr(c.normalizePracticeData(null)), { lists: [], dailyResetHour: 3, clientUpdatedAt: 0 });
  assert.deepStrictEqual(arr(c.normalizePracticeData("x")), { lists: [], dailyResetHour: 3, clientUpdatedAt: 0 });
  const lists = [];
  for (let i = 0; i < 30; i++) lists.push({ id: "l" + i, name: "n", items: [] });
  lists.push(null, { id: "" }, { id: "l1" }, 5);
  assert.strictEqual(c.normalizePracticeData({ lists }).lists.length, 20);
  assert.ok(c.normalizePracticeData({ lists }).lists.every((l) => l.mode === "count")); // legacy -> count
  const items = [{ trickId: "a", target: -5, count: -3 }, { trickId: "a" }, { trickId: 7 }, null, { trickId: "b", target: "x", count: "4.7" }];
  for (let i = 0; i < 60; i++) items.push({ trickId: "z" + i });
  const n = c.normalizePracticeData({ lists: [{ id: "q", name: 12, items }], clientUpdatedAt: "bad" });
  assert.strictEqual(n.clientUpdatedAt, 0);
  assert.strictEqual(n.lists[0].items.length, 50);
  assert.deepStrictEqual(arr(n.lists[0].items.slice(0, 2)), [{ trickId: "a", target: 1, count: 0 }, { trickId: "b", target: null, count: 4 }]);
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

test("legacy data: no mode -> count, keeps target, per-mode 20 cap", () => {
  const c = setup();
  const n = c.normalizePracticeData({ lists: [{ id: "a", name: "x", items: [{ trickId: "t", target: 10, count: 12 }] }] });
  assert.strictEqual(n.lists[0].mode, "count");
  assert.deepStrictEqual(arr(n.lists[0].items[0]), { trickId: "t", target: 10, count: 12 }); // kept, not removed
  assert.strictEqual(n.dailyResetHour, 3);
  const lists = [];
  for (let i = 0; i < 30; i++) lists.push({ id: "c" + i, name: "n", items: [] });
  for (let i = 0; i < 30; i++) lists.push({ id: "d" + i, name: "n", mode: "daily", items: [] });
  const m = c.normalizePracticeData({ lists, dailyResetHour: 30 });
  assert.strictEqual(m.lists.filter((l) => l.mode === "count").length, 20);
  assert.strictEqual(m.lists.filter((l) => l.mode === "daily").length, 20);
  assert.strictEqual(m.dailyResetHour, 3);
  assert.strictEqual(c.normalizePracticeData({ dailyResetHour: 23 }).dailyResetHour, 23);
  const d = c.newPracticeData();
  for (let i = 0; i < 20; i++) { assert.ok(c.createPracticeList(d, "c" + i)); assert.ok(c.createPracticeList(d, "d" + i, null, "daily")); }
  assert.strictEqual(c.createPracticeList(d, "x"), null);
  assert.strictEqual(c.createPracticeList(d, "x", null, "daily"), null);
  assert.strictEqual(d.lists.length, 40);
});

test("dayKey: reset hour boundary (local time)", () => {
  const c = setup();
  const at = (h, m) => new Date(2026, 5, 10, h, m, 0).getTime();
  assert.strictEqual(c.practiceDayKey(at(2, 59), 3), "2026-06-09");
  assert.strictEqual(c.practiceDayKey(at(3, 0), 3), "2026-06-10");
  assert.strictEqual(c.practiceDayKey(at(23, 59), 3), "2026-06-10");
  assert.strictEqual(c.practiceDayKey(at(0, 0), 0), "2026-06-10");
  assert.strictEqual(c.practiceDayKey(at(22, 59), 23), "2026-06-09");
  assert.strictEqual(c.practiceDayKey(at(23, 0), 23), "2026-06-10");
});

test("daily: count resets across days, target required", () => {
  const c = setup(), d = c.newPracticeData(), l = c.createPracticeList(d, "D", null, "daily");
  c.addPracticeTrick(l, "a");
  assert.deepStrictEqual(arr(l.items[0]), { trickId: "a", target: 10, count: 0, day: "" });
  assert.strictEqual(c.setPracticeTarget(l, "a", ""), 10);
  const at = (day, h) => new Date(2026, 5, day, h, 0, 0).getTime();
  c.setPracticeTarget(l, "a", 2);
  assert.strictEqual(c.practiceTap(l, "a", 1, null, 3, at(10, 5)).count, 1);
  assert.strictEqual(c.practiceTap(l, "a", 1, null, 3, at(10, 20)).count, 2);
  const k = (day, h) => c.practiceDayKey(at(day, h), 3);
  assert.strictEqual(c.practiceItemCount(l.items[0], k(10, 20)), 2);
  assert.strictEqual(c.practiceItemDone(l.items[0], k(10, 20)), true);
  assert.strictEqual(c.practiceItemCount(l.items[0], k(11, 2)), 2);   // before 03:00 next day: still same day
  assert.strictEqual(c.practiceItemCount(l.items[0], k(11, 3)), 0);   // after reset: reads as 0
  assert.strictEqual(c.practiceItemDone(l.items[0], k(11, 3)), false);
  assert.deepStrictEqual(arr(c.practiceProgress(l, null, k(11, 3))), { done: 0, total: 1, items: 1 });
  const r = c.practiceTap(l, "a", 1, null, 3, at(11, 5));            // new day: restarts from 0
  assert.deepStrictEqual(arr(r), { count: 1, removed: false });
  assert.strictEqual(l.items.length, 1);                              // daily never removes
  c.practiceTap(l, "a", 5, null, 3, at(11, 6));
  assert.strictEqual(l.items.length, 1);
  assert.strictEqual(c.setPracticeResetHour(d, 30), 3);
  assert.strictEqual(c.setPracticeResetHour(d, 7), 7);
});

test("count: reaching the target on a tap removes the item; no target = unlimited", () => {
  const c = setup(), d = c.newPracticeData(), l = c.createPracticeList(d, "A");
  c.addPracticeTrick(l, "a"); c.addPracticeTrick(l, "b"); c.addPracticeTrick(l, "old");
  for (let i = 0; i < 200; i++) c.practiceTap(l, "a", 1);             // target null: unlimited
  assert.strictEqual(l.items[0].count, 200);
  c.setPracticeTarget(l, "b", 3);
  assert.deepStrictEqual(arr(c.practiceTap(l, "b", 1)), { count: 1, removed: false });
  c.practiceTap(l, "b", 1);
  assert.deepStrictEqual(arr(c.practiceTap(l, "b", 1)), { count: 3, removed: true });
  assert.strictEqual(c.findPracticeItem(l, "b"), null);
  assert.strictEqual(c.practiceTap(l, "b", 1), null);
  // legacy item already past its target: shown done, tapping again does not remove it
  const n = c.normalizePracticeData({ lists: [{ id: "x", name: "x", items: [{ trickId: "old", target: 5, count: 8 }] }] });
  assert.strictEqual(n.lists[0].items.length, 1);
  assert.strictEqual(c.practiceItemDone(n.lists[0].items[0]), true);
  assert.deepStrictEqual(arr(c.practiceTap(n.lists[0], "old", 1)), { count: 9, removed: false });
  assert.deepStrictEqual(arr(c.practiceTap(n.lists[0], "old", -1)), { count: 8, removed: false });
  assert.strictEqual(c.practiceItemDone({ target: null, count: 99 }), false);
});
