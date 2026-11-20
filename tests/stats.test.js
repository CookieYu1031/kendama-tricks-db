"use strict";
const test = require("node:test");
const assert = require("node:assert");
const { load } = require("./_load");

const FILES = ["js/01-data-model.js", "js/02-constants-colors-icons.js", "js/03-i18n.js", "js/04-state.js",
  "js/05-data-helpers.js", "js/57-user-stats.js", "js/75-admin-stats.js"];
const ctx = load(FILES, {});
const DAY = 86400000;

const inPub = (tr, sid) => (tr.sp || []).indexOf(sid) !== -1;
const mk = (id, o) => Object.assign({ id, sp: ["t00"] }, o || {});

test("payload: only public tables, favorites and rates", () => {
  const tricks = [mk("a", { favorite: true, rate: "most" }), mk("b", { rate: "rare" }), mk("c", { sp: ["t05"], favorite: true, rate: "mastered" }),
    mk("d", { sp: ["t02"], favorite: true }), mk("e", { rate: "bogus" })];
  const p = ctx.buildUserStatsPayload(tricks, inPub, "jp");
  assert.deepStrictEqual(Array.from(p.favorites), ["a", "d"]);
  assert.deepStrictEqual(Array.from(p.landed), ["a", "b"]);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(p.rates)), { a: "most", b: "rare" });
  assert.strictEqual(p.lang, "jp");
  assert.strictEqual(ctx.buildUserStatsPayload([], inPub, "xx").lang, "zh");
});

test("payload: 2000 limit", () => {
  const tricks = [];
  for(let i = 0; i < 2500; i++) tricks.push(mk("t" + i, { favorite: true, rate: "rare" }));
  const p = ctx.buildUserStatsPayload(tricks, inPub, "en");
  assert.strictEqual(p.favorites.length, 2000);
  assert.strictEqual(p.landed.length, 2000);
  assert.strictEqual(Object.keys(p.rates).length, 2000);
});

test("hash changes with content, stable for same content; daily refresh", () => {
  const a = ctx.buildUserStatsPayload([mk("a", { favorite: true })], inPub, "zh");
  const a2 = ctx.buildUserStatsPayload([mk("a", { favorite: true })], inPub, "zh");
  const b = ctx.buildUserStatsPayload([mk("a", { favorite: true, rate: "rare" })], inPub, "zh");
  const h = ctx.userStatsHash(a);
  assert.strictEqual(h, ctx.userStatsHash(a2));
  assert.notStrictEqual(h, ctx.userStatsHash(b));
  const now = 10 * DAY;
  assert.strictEqual(ctx.userStatsShouldWrite(h, null, now), true);
  assert.strictEqual(ctx.userStatsShouldWrite(h, { hash: h, at: now - 1000 }, now), false);
  assert.strictEqual(ctx.userStatsShouldWrite(h, { hash: h, at: now - DAY - 1 }, now), true);
  assert.strictEqual(ctx.userStatsShouldWrite(h, { hash: "x", at: now - 1000 }, now), true);
});

test("aggregation: registered, lang, active windows, tops, rates", () => {
  const now = 100 * DAY;
  const docs = [
    { lang: "zh", lastActiveAt: now - 1 * DAY, favorites: ["a", "b"], landed: ["a"], rates: { a: "rare" } },
    { lang: "jp", lastActiveAt: now - 10 * DAY, favorites: ["a"], landed: ["a", "b"], rates: { a: "mastered", b: "most" } },
    { lang: "en", lastActiveAt: now - 40 * DAY, favorites: ["a", "c"], landed: [], rates: {} },
    { lang: "zh", lastActiveAt: null }
  ];
  const g = ctx.aggregateUserStats(docs, now);
  assert.strictEqual(g.registered, 4);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(g.lang)), { zh: 2, jp: 1, en: 1 });
  assert.strictEqual(g.active7, 1);
  assert.strictEqual(g.active30, 2);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(g.topFav[0])), { id: "a", count: 3 });
  assert.strictEqual(g.topFav.length, 3);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(g.topLanded)), [{ id: "a", count: 2 }, { id: "b", count: 1 }]);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(g.rates)), { rare: 1, sometimes: 0, most: 1, mastered: 1 });
  const empty = ctx.aggregateUserStats([], now);
  assert.strictEqual(empty.registered, 0);
  assert.strictEqual(empty.topFav.length, 0);
});

test("top 5 cap", () => {
  const favs = ["a","b","c","d","e","f","g"];
  assert.strictEqual(ctx.aggregateUserStats([{ lang: "zh", favorites: favs }], 0).topFav.length, 5);
});

test("base counts per table and backup filename", () => {
  const base = { categories: [{ id: "c1", spaceId: "t01" }], tricks: [
    { id: "a", categoryIds: ["t00"] }, { id: "b", categoryIds: ["c1"] }, { id: "c", categoryIds: ["t02", "t02"] }, { id: "d", categoryIds: ["zz"] }] };
  assert.deepStrictEqual(JSON.parse(JSON.stringify(ctx.countBaseTricksBySpace(base))), { t00: 1, t01: 1, t02: 1 });
  assert.strictEqual(ctx.backupFilename(7), "kendama-base-v7.json");
});
