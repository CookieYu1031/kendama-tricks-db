// Random trick (js/81-random-logic.js): pool, draw, reroll, history, conditions.
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const { load } = require("../_load");

function setup(){
  const ctx = load(["js/01-data-model.js", "js/01-data-storage.js", "js/02-constants-colors-icons.js", "js/03-i18n.js", "js/04-state.js", "js/05-data-helpers.js", "js/05-data-ops.js", "js/05-data-util.js",
    "js/07-id.js", "js/09-names.js", "js/61-search-index.js", "js/81-random-logic.js"]);
  const nm = (zh) => ({ zh: zh || "", jp: "", en: "" });
  ctx.db = ctx.normalizeDB({
    spaces: [
      { id: "t00", code: "00", locked: true, icon: "x", name: nm("總表"), viewMode: "tree" },
      { id: "t01", code: "01", locked: true, icon: "x", name: nm("檢定"), viewMode: "tree" },
      { id: "t02", code: "02", locked: true, icon: "x", name: nm("賽事"), viewMode: "tree" },
      { id: "u0a", code: "0a", locked: false, icon: "x", name: nm("我的"), viewMode: "tree" }
    ],
    categories: [
      { id: "c1", parentId: null, spaceId: "t00", name: nm("基本"), order: 0 },
      { id: "c2", parentId: "c1", spaceId: "t00", name: nm("子"), order: 0 },
      { id: "c3", parentId: null, spaceId: "t01", name: nm("級"), order: 0 },
      { id: "m1", parentId: null, spaceId: "u0a", name: nm("私人"), order: 0 }
    ],
    tricks: [
      { id: "a000001", name: nm("A"), categoryIds: ["c1"], grip: "ken", parts: ["sara"], tagIds: ["g1"], rate: "most" },
      { id: "a000002", name: nm("B"), categoryIds: ["c2"], grip: "tama", parts: ["ana"], tagIds: [], rate: null },
      { id: "a000003", name: nm("C"), categoryIds: ["c2"], grip: "ken", parts: ["kensaki", "sara"], tagIds: [] },
      { id: "a000004", name: nm("D"), categoryIds: ["c3"], grip: "ken", parts: [], tagIds: [] },
      { id: "a000005", name: nm("E"), categoryIds: ["m1"], custom: true, grip: "ito", parts: [], tagIds: [] }
    ],
    infos: [],
    tags: [{ id: "g1", name: nm("類") }]
  });
  ctx.invalidateDbIndex();
  return ctx;
}
const rates = { a000001: "most", a000002: null, a000003: "rare", a000004: "mastered", a000005: null };
const pool = (c, over, guest) => {
  const idx = c.buildSearchIndex(c.db, { guest: !!guest });
  const conds = Object.assign(c.defaultRandomConds(), over);
  return Array.from(c.buildRandomPool(idx, conds, { rateOf: (id) => rates[id] || null, ignoreRate: !!guest }));
};

test("scope: table, folder recursion", () => {
  const c = setup();
  assert.deepStrictEqual(pool(c, { space: "t00" }), ["a000001", "a000002", "a000003"]);
  assert.deepStrictEqual(pool(c, { space: "t00", folder: "c1" }), ["a000001", "a000002", "a000003"]);
  assert.deepStrictEqual(pool(c, { space: "t00", folder: "c2" }), ["a000002", "a000003"]);
  assert.deepStrictEqual(pool(c, { space: "t01" }), ["a000004"]);
  assert.deepStrictEqual(pool(c, { space: "u0a" }), ["a000005"]);
});

test("guest: custom table not in index", () => {
  const c = setup();
  assert.deepStrictEqual(pool(c, { space: "u0a" }, true), []);
  assert.deepStrictEqual(pool(c, { space: "t00", rates: ["mastered"] }, true).length, 3); // rate ignored
});

test("grip and parts: every part must match", () => {
  const c = setup();
  assert.deepStrictEqual(pool(c, { grip: "ken" }), ["a000001", "a000003"]);
  assert.deepStrictEqual(pool(c, { parts: ["sara", "ana"] }), []);
  assert.deepStrictEqual(pool(c, { parts: ["sara", "kensaki"] }), ["a000003"]);
});

test("class tag: only tricks carrying it (combo look-alikes excluded)", () => {
  const c = setup();
  assert.deepStrictEqual(pool(c, { classId: "g1" }), ["a000001"]);
  assert.deepStrictEqual(pool(c, { classId: "g1", grip: "ken" }), ["a000001"]);
  assert.deepStrictEqual(pool(c, { classId: "g1", grip: "tama" }), []);
});

test("rate filter incl. none", () => {
  const c = setup();
  const all = c.RANDOM_RATE_KEYS.slice();
  assert.deepStrictEqual(pool(c, { space: "t00", rates: ["none"] }), ["a000002"]);
  assert.deepStrictEqual(pool(c, { space: "t00", rates: ["most", "rare"] }), ["a000001", "a000003"]);
  assert.strictEqual(pool(c, { space: "t00", rates: all }).length, 3);
  assert.deepStrictEqual(pool(c, { space: "t00", rates: [] }), []);
});

test("draw: distinct, capped, round exclusion, exhaustion, reroll", () => {
  const c = setup();
  const p = ["a", "b", "c", "d", "e"];
  const round = c.newRandomRound();
  const r1 = c.drawRandom(p, 3, round);
  assert.strictEqual(new Set(r1.ids).size, 3);
  const r2 = c.drawRandom(p, 3, round);
  assert.strictEqual(r2.ids.length, 2);
  assert.ok(r2.ids.every((x) => r1.ids.indexOf(x) === -1));
  assert.strictEqual(c.drawRandom(p, 3, round).exhausted, true);
  const r3 = c.drawRandom(p, 3, c.newRandomRound(), () => 0);
  assert.deepStrictEqual(Array.from(r3.ids), ["a", "b", "c"]);
  const rd = c.newRandomRound();
  rd.used = { a: true, b: true, c: true };
  assert.strictEqual(c.rerollRandom(p, rd, "a", () => 0), "d");
  assert.strictEqual(c.rerollRandom(p, rd, "d", () => 0), "e");
  assert.strictEqual(c.rerollRandom(p, rd, "e", () => 0), null);
});

test("history cap 10, newest first, storage roundtrip", () => {
  const c = setup();
  let h = [];
  for (let i = 0; i < 12; i++) h = c.pushRandomHistory(h, ["x" + i], i);
  assert.strictEqual(h.length, 10);
  assert.strictEqual(h[0].at, 11);
  c.saveRandomHistory(h);
  assert.strictEqual(c.loadRandomHistory().length, 10);
  assert.deepStrictEqual(Array.from(c.normalizeRandomHistory([{ at: 1, ids: ["a", 2] }, null, { ids: [] }])[0].ids), ["a"]);
});

test("normalizeRandomConds", () => {
  const c = setup();
  const n = c.normalizeRandomConds({ space: "zz", grip: "bad", parts: ["sara", "sara", "nope"], count: 99, rates: ["rare", "x"] }, ["t00", "t01"]);
  assert.strictEqual(n.space, "t00");
  assert.strictEqual(n.grip, null);
  assert.deepStrictEqual(Array.from(n.parts), ["sara"]);
  assert.strictEqual(n.count, 10);
  assert.deepStrictEqual(Array.from(n.rates), ["rare"]);
  assert.strictEqual(c.normalizeRandomConds(null, ["t00"]).count, 3);
  assert.strictEqual(c.normalizeRandomConds({ count: 0 }, ["t00"]).count, 1);
  c.saveRandomConds(n);
  assert.strictEqual(c.loadRandomConds(["t00"]).count, 10);
});

test("grip filter: category matches its sub-grips, a sub matches only itself", () => {
  const c = setup();
  c.db.tricks.find((t) => t.id === "a000001").grip = "ken_sara";
  c.db.tricks.find((t) => t.id === "a000002").grip = "tama_stunt";
  c.db.tricks.find((t) => t.id === "a000003").grip = "ken_candle";
  c.invalidateDbIndex();
  assert.deepStrictEqual(pool(c, { grip: "ken" }), ["a000001", "a000003"]);
  assert.deepStrictEqual(pool(c, { grip: "ken_sara" }), ["a000001"]);
  assert.deepStrictEqual(pool(c, { grip: "tama" }), ["a000002"]);
  assert.deepStrictEqual(pool(c, { grip: "tama_tama" }), []);
  assert.strictEqual(c.normalizeRandomConds({ grip: "ken_sara" }, ["t00"]).grip, "ken_sara");
});
