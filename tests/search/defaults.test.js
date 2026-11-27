// Search panel defaults (js/62-search-panel.js): grip null, parts mode any; single toggle flips any <-> all.
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const { load } = require("../_load");
const fs = require("fs");
const path = require("path");

function setup(){
  return load(["js/01-data-model.js", "js/01-data-storage.js", "js/02-constants-colors-icons.js", "js/03-i18n.js", "js/04-state.js", "js/05-data-helpers.js", "js/05-data-ops.js", "js/05-data-util.js",
    "js/07-id.js", "js/09-names.js", "js/61-search-index.js", "js/62-search-panel.js"]);
}

test("default filters: grip null (categories are headers), parts empty", () => {
  const c = setup();
  assert.strictEqual(c.searchFilters.grip, null);
  assert.strictEqual(c.searchFilters.parts.length, 0);
});


test("no default grip: empty filters are not a criterion", () => {
  const c = setup();
  const idx = [{ id: "a", grip: "ken", parts: [], tagIds: [], names: [], text: "abc", locs: [] }, { id: "b", grip: null, parts: [], tagIds: [], names: [], text: "abc", locs: [] }];
  assert.ok(!c.searchHasCriteria(c.parseSearchQuery(""), c.searchFilters)); // default grip is null
  assert.ok(c.searchHasCriteria(c.parseSearchQuery(""), { grip: "ken_sara", parts: [] }));
  const noGrip = { grip: null, parts: [] };
  assert.ok(!c.searchHasCriteria(c.parseSearchQuery(""), noGrip));
});

test("source: reset returns to default grip", () => {
  const src = fs.readFileSync(path.join(__dirname, "..", "..", "js/62-search-panel.js"), "utf8");
  assert.match(src, /searchFilters\.grip = SEARCH_DEFAULT_GRIP; searchFilters\.parts = \[\]/);
  assert.match(src, /searchInteracted = false;\s+var input/);
});

test("results gated on interaction: empty filters show hint", () => {
  const c = setup();
  const q = c.parseSearchQuery("");
  assert.strictEqual(c.searchInteracted, false);
  assert.strictEqual(c.searchShouldShowResults(q, c.searchFilters, c.searchInteracted), false);
  assert.strictEqual(c.searchShouldShowResults(q, c.searchFilters, true), false);
  assert.strictEqual(c.searchShouldShowResults(q, { grip: "ken_sara", parts: [] }, true), true);
  assert.strictEqual(c.searchShouldShowResults(q, { grip: null, parts: [] }, true), false);
  assert.strictEqual(c.searchShouldShowResults(c.parseSearchQuery("abc"), { grip: null, parts: [] }, true), true);
});

test("picked class tag: only tricks carrying it, look-alikes excluded", () => {
  const c = setup();
  const e = (id, tagIds) => ({ id, names: { zh: "", jp: "", en: "" }, romaji: "", shown: "", grip: "tama_tama", parts: ["sara", "tamaTop"], tagIds, locs: [] });
  const idx = [e("lunar", ["cMoon"]), e("suidama", [])]; // same grip + parts, only one carries the 月面 class
  assert.ok(c.searchHasCriteria(c.parseSearchQuery(""), { grip: null, parts: [], classId: "cMoon" }));
  assert.deepStrictEqual(Array.from(c.runSearch(idx, "", { grip: null, parts: [], classId: "cMoon" }, {})), ["lunar"]);
  assert.deepStrictEqual(Array.from(c.runSearch(idx, "", { grip: "tama_tama", parts: ["sara"], classId: "cMoon" }, {})), ["lunar"]);
  assert.deepStrictEqual(Array.from(c.runSearch(idx, "", { grip: "tama_tama", parts: ["sara"] }, {})), ["lunar", "suidama"]);
});

test("partMatches used: 劍頂 filter matches 劍尖 tricks, 中皿 matches 中皿邊 (match + ranking)", () => {
  const c = setup();
  const e = { id: "x", names: { zh: "", jp: "", en: "" }, romaji: "", shown: "", grip: "ken", parts: ["kensaki", "chuzaraEdge"], tagIds: [], locs: [] };
  const q = c.parseSearchQuery("");
  assert.ok(c.matchEntry(e, q, { grip: null, parts: ["kenchou"] }, {}));
  assert.ok(c.matchEntry(e, q, { grip: null, parts: ["kenchou", "chuzara"] }, {}));
  assert.ok(!c.matchEntry(e, q, { grip: null, parts: ["kenchou", "sara"] }, {}));
  // ranking: 劍尖 is covered by a 劍頂 pick and 中皿邊 by 中皿; only the unpicked grip is extra
  assert.deepStrictEqual(Object.assign({}, c.searchScoreEntry(e, { grip: null, parts: ["kenchou", "chuzara"] })), { matched: 2, extra: 1, total: 2 });
});
