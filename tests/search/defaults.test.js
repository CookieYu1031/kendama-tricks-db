// Search panel defaults (js/62-search-panel.js): grip 持劍, mode any (≈) / all (≅).
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

test("default filters: grip ken, parts empty, mode any", () => {
  const c = setup();
  assert.strictEqual(c.searchFilters.grip, "ken");
  assert.strictEqual(c.searchFilters.partsMode, "any");
  assert.strictEqual(c.searchFilters.parts.length, 0);
});


test("grip default filters out tricks without a grip (text-only search keeps others only with grip off)", () => {
  const c = setup();
  const idx = [{ id: "a", grip: "ken", parts: [], tagIds: [], names: [], text: "abc", locs: [] }, { id: "b", grip: null, parts: [], tagIds: [], names: [], text: "abc", locs: [] }];
  assert.ok(c.searchHasCriteria(c.parseSearchQuery(""), c.searchFilters)); // default grip counts as a criterion
  const noGrip = { grip: null, parts: [], partsMode: "any" };
  assert.ok(!c.searchHasCriteria(c.parseSearchQuery(""), noGrip));
});

test("source: mode buttons carry title + aria-label; reset returns to default grip", () => {
  const src = fs.readFileSync(path.join(__dirname, "..", "..", "js/62-search-panel.js"), "utf8");
  assert.match(src, /b\.title = full/);
  assert.match(src, /aria-label/);
  assert.match(src, /searchFilters\.grip = SEARCH_DEFAULT_GRIP; searchFilters\.parts = \[\]/);
  assert.match(src, /searchInteracted = false;\s+var input/);
});

test("results gated on interaction: default grip alone shows hint", () => {
  const c = setup();
  const q = c.parseSearchQuery("");
  assert.strictEqual(c.searchInteracted, false);
  assert.strictEqual(c.searchShouldShowResults(q, c.searchFilters, c.searchInteracted), false);
  assert.strictEqual(c.searchShouldShowResults(q, c.searchFilters, true), true);
  assert.strictEqual(c.searchShouldShowResults(q, { grip: null, parts: [], partsMode: "any" }, true), false);
  assert.strictEqual(c.searchShouldShowResults(c.parseSearchQuery("abc"), { grip: null, parts: [] }, true), true);
});

test("class tag overwrites grip and parts (only specified dimensions)", () => {
  const c = setup();
  const f = { grip: "ken", parts: ["sara"], partsMode: "any" };
  c.searchApplyClassTag(f, { kind: "class", combo: { grip: "tama", parts: ["ana", "tamaTop"] } });
  assert.strictEqual(f.grip, "tama");
  assert.deepStrictEqual(Array.from(f.parts), ["ana", "tamaTop"]);
  c.searchApplyClassTag(f, { kind: "class", combo: { grip: null, parts: ["sara"] } });
  assert.strictEqual(f.grip, "tama");
  assert.deepStrictEqual(Array.from(f.parts), ["sara"]);
  c.searchApplyClassTag(f, { kind: "class", combo: { grip: "ito", parts: [] } });
  assert.strictEqual(f.grip, "ito");
  assert.deepStrictEqual(Array.from(f.parts), ["sara"]);
  c.searchApplyClassTag(f, { kind: "text" });
  assert.strictEqual(f.grip, "ito");
});

test("partMatches used: 劍頂 filter matches 劍尖 tricks, 中皿 matches 中皿邊 (any + all)", () => {
  const c = setup();
  const e = { id: "x", names: { zh: "", jp: "", en: "" }, romaji: "", shown: "", grip: "ken", parts: ["kensaki", "chuzaraEdge"], tagIds: [], locs: [] };
  const q = c.parseSearchQuery("");
  assert.ok(c.matchEntry(e, q, { grip: null, parts: ["kenchou"], partsMode: "any" }, {}));
  assert.ok(c.matchEntry(e, q, { grip: null, parts: ["kenchou", "chuzara"], partsMode: "all" }, {}));
  assert.ok(!c.matchEntry(e, q, { grip: null, parts: ["kenchou", "sara"], partsMode: "all" }, {}));
  assert.ok(c.matchEntry(e, q, { grip: null, parts: ["kenchou", "sara"], partsMode: "any" }, {}));
});
