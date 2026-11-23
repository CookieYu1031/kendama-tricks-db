// Search (js/61-search-index.js): query parsing, index building, matching, scope.
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const { load } = require("../_load");

function setup(guest){
  const ctx = load(["js/01-data-model.js", "js/01-data-storage.js", "js/02-constants-colors-icons.js", "js/03-i18n.js", "js/04-state.js", "js/05-data-helpers.js", "js/05-data-ops.js", "js/05-data-util.js",
    "js/07-id.js", "js/09-names.js", "js/61-search-index.js"]);
  if(guest) ctx.isLoggedIn = () => false;
  const nm = (zh, jp, en) => ({ zh: zh || "", jp: jp || "", en: en || "" });
  ctx.db = ctx.normalizeDB({
    spaces: [
      { id: "t00", code: "00", locked: true, icon: "x", name: nm("總表"), viewMode: "tree" },
      { id: "t01", code: "01", locked: true, icon: "x", name: nm("檢定"), viewMode: "tree" },
      { id: "t02", code: "02", locked: true, icon: "x", name: nm("賽事"), viewMode: "tree" },
      { id: "fav", code: null, locked: false, icon: "x", name: nm("收藏"), viewMode: "tree" },
      { id: "u0a", code: "0a", locked: false, icon: "x", name: nm("我的"), viewMode: "tree" }
    ],
    categories: [
      { id: "c1", parentId: null, spaceId: "t00", name: nm("基本"), order: 0 },
      { id: "c2", parentId: "c1", spaceId: "t00", name: nm("子"), order: 0 },
      { id: "c3", parentId: null, spaceId: "t01", name: nm("級"), order: 0 },
      { id: "m1", parentId: null, spaceId: "u0a", name: nm("私人"), order: 0 }
    ],
    tricks: [
      { id: "a000001", name: nm("大皿", "おおざら", "Big cup"), categoryIds: ["c1"], grip: "ken", parts: ["sara", "kensaki"], tagIds: ["g1"] },
      { id: "a000002", name: nm("", "とめけん", ""), categoryIds: ["c2", "c3"], grip: "tama", parts: ["ana"], tagIds: ["g1", "g2"] },
      { id: "a000003", name: nm("", "", "Lighthouse"), categoryIds: ["c1"], grip: "ken", parts: ["sara"], tagIds: [] },
      { id: "a000004", name: nm("自創", "", ""), categoryIds: ["m1"], custom: true, grip: "ito", parts: [], tagIds: ["g2"] },
      { id: "a000005", name: nm("收藏的"), categoryIds: ["fav", "c1"], favorite: true },
      { id: "a000006", name: nm("只在收藏"), categoryIds: ["fav"], custom: true }
    ],
    infos: [],
    tags: [{ id: "g1", name: nm("入門", "", "Beginner") }, { id: "g2", name: nm("", "ちゅうきゅう", "Mid level") }]
  });
  ctx.invalidateDbIndex();
  return ctx;
}
const run = (c, raw, filters) => Array.from(c.runSearch(c.buildSearchIndex(c.db), raw, filters, c.buildTagLookup(c.db.tags))).sort();

test("parseSearchQuery: text, tags, underscore, lone #", () => {
  const c = setup();
  const q = c.parseSearchQuery("  Big  #Beginner #mid_level cup #");
  assert.strictEqual(q.text, "big cup");
  assert.deepStrictEqual(Array.from(q.tags), ["beginner", "mid level"]);
  assert.strictEqual(c.parseSearchQuery("").text, "");
  assert.strictEqual(c.currentTagToken("abc #be"), "be");
  assert.strictEqual(c.currentTagToken("abc #"), "");
  assert.strictEqual(c.currentTagToken("abc #be "), null);
});

test("name match: zh / jp / en / romaji / case-insensitive", () => {
  const c = setup();
  assert.deepStrictEqual(run(c, "大皿"), ["a000001"]);
  assert.deepStrictEqual(run(c, "とめ"), ["a000002"]);
  assert.deepStrictEqual(run(c, "LIGHT"), ["a000003"]);
  assert.deepStrictEqual(run(c, "big"), ["a000001"]);
  assert.deepStrictEqual(run(c, "tomeken"), ["a000002"]);   // romaji of jp-only name
  assert.deepStrictEqual(run(c, "zzz"), []);
});

test("#tag: any language, substring, AND", () => {
  const c = setup();
  assert.deepStrictEqual(run(c, "#入門"), ["a000001", "a000002"]);
  assert.deepStrictEqual(run(c, "#beg"), ["a000001", "a000002"]);
  assert.deepStrictEqual(run(c, "#ちゅう"), ["a000002", "a000004"]);
  assert.deepStrictEqual(run(c, "#beginner #mid_level"), ["a000002"]);
  assert.deepStrictEqual(run(c, "#beginner tome"), ["a000002"]);
  assert.deepStrictEqual(run(c, "#nope"), []);
});

test("grip and parts (any / all), conditions-only search", () => {
  const c = setup();
  assert.deepStrictEqual(run(c, "", { grip: "ken", parts: [], partsMode: "any" }), ["a000001", "a000003"]);
  assert.deepStrictEqual(run(c, "", { grip: null, parts: ["sara", "ana"], partsMode: "any" }), ["a000001", "a000002", "a000003"]);
  assert.deepStrictEqual(run(c, "", { grip: null, parts: ["sara", "kensaki"], partsMode: "all" }), ["a000001"]);
  assert.deepStrictEqual(run(c, "", { grip: "ken", parts: ["sara"], partsMode: "all" }), ["a000001", "a000003"]);
  assert.deepStrictEqual(run(c, "cup", { grip: "tama", parts: [], partsMode: "any" }), []);
  assert.deepStrictEqual(run(c, "", { grip: null, parts: [], partsMode: "any" }), []); // no criteria
});

test("grip filter: a category matches its sub-grips, a sub is exact", () => {
  const c = setup();
  c.db.tricks.find((x) => x.id === "a000003").grip = "ken_sara";
  assert.deepStrictEqual(run(c, "", { grip: "ken", parts: [], partsMode: "any" }), ["a000001", "a000003"]);
  assert.deepStrictEqual(run(c, "", { grip: "ken_sara", parts: [], partsMode: "any" }), ["a000003"]);
  assert.deepStrictEqual(run(c, "", { grip: "ken_gun", parts: [], partsMode: "any" }), []);
});

test("index entries: format, multi-location, fav not duplicated", () => {
  const c = setup();
  const idx = c.buildSearchIndex(c.db);
  const e2 = idx.find(e => e.id === "a000002");
  assert.strictEqual(e2.locs.length, 2);
  assert.deepStrictEqual(Array.from(e2.locs[0].path), ["c1", "c2"]);
  assert.strictEqual(e2.locs[0].spaceId, "t00");
  assert.strictEqual(e2.locs[1].spaceId, "t01");
  assert.ok(e2.romaji.indexOf("tomeken") !== -1);
  const e5 = idx.find(e => e.id === "a000005");
  assert.strictEqual(e5.locs.length, 1);          // fav loc dropped, real one kept
  assert.strictEqual(e5.locs[0].spaceId, "t00");
  const e6 = idx.find(e => e.id === "a000006");
  assert.strictEqual(e6.locs[0].spaceId, "fav");  // only place -> kept
  assert.strictEqual(idx.find(e => e.id === "a000004").custom, true);
});

test("guest scope: only tricks in 00/01/02", () => {
  const c = setup(true);
  const idx = c.buildSearchIndex(c.db, { guest: true });
  const ids = Array.from(idx.map(e => e.id)).sort();
  assert.deepStrictEqual(ids, ["a000001", "a000002", "a000003", "a000005"]);
  assert.strictEqual(c.isGuest(), true);
  assert.deepStrictEqual(Array.from(c.getSearchIndex().map(e => e.id)).sort(), ids);
});

test("signed-in scope includes custom tables and fav-only tricks", () => {
  const c = setup();
  assert.strictEqual(c.buildSearchIndex(c.db).length, 6);
});
