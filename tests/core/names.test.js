// Display-name fallback, romaji derivation, kanji reading dictionary.
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const { load } = require("../_load");

function fresh(lang){
  const ctx = load(["js/03-i18n.js", "js/09-names.js"], { state: { lang: lang || "zh" } });
  return ctx;
}
function show(ctx, lang, nm){ ctx.state.lang = lang; return ctx.resolveDisplayName(nm); }

test("rule 1: own language wins", () => {
  const c = fresh(), n = { zh:"中", jp:"にほん", en:"En" };
  assert.deepStrictEqual({ ...show(c, "zh", n) }, { text:"中", sourceLang:"zh", transformed:false });
  assert.strictEqual(show(c, "jp", n).text, "にほん");
  assert.strictEqual(show(c, "en", n).text, "En");
});

test("rule 2: zh -> en, jp -> en", () => {
  const c = fresh(), n = { zh:"", jp:"", en:"Airplane" };
  assert.strictEqual(show(c, "zh", n).text, "Airplane");
  assert.strictEqual(show(c, "jp", n).sourceLang, "en");
  assert.strictEqual(show(c, "jp", { zh:"中", jp:"", en:"E" }).text, "E");
});

test("rule 2: en -> romaji from kana jp", () => {
  const c = fresh(), r = show(c, "en", { zh:"", jp:"とめけん", en:"" });
  assert.deepStrictEqual({ ...r }, { text:"Tomeken", sourceLang:"jp", transformed:true });
});

test("rule 3: first existing (zh, jp, en)", () => {
  const c = fresh();
  assert.strictEqual(show(c, "en", { zh:"中", jp:"大皿", en:"" }).text, "中");   // jp kanji unknown -> zh
  assert.strictEqual(show(c, "en", { zh:"", jp:"大皿", en:"" }).text, "大皿");
  assert.strictEqual(show(c, "zh", { zh:"", jp:"あ", en:"" }).text, "あ");
  assert.strictEqual(show(c, "jp", { zh:"中", jp:"", en:"" }).text, "中");
  assert.deepStrictEqual({ ...show(c, "zh", { zh:"", jp:"", en:"" }) }, { text:"", sourceLang:null, transformed:false });
  assert.strictEqual(show(c, "zh", null).text, "");
});

test("works before rebuildReadingDict; wrappers follow state.lang", () => {
  const c = fresh("en");
  assert.deepStrictEqual({ ...c.getReadingDict() }, {});
  assert.strictEqual(c.localize({ jp:"とめけん" }), "Tomeken");
  assert.strictEqual(c.resolveTrickTitle({ jp:"とめけん" }).transformed, true);
  assert.strictEqual(c.localize(null), "");
});

test("kanji inference: runs joined by space", () => {
  const c = fresh("en");
  c.rebuildReadingDict([
    { name:{ jp:"大皿", en:"Ozara" } },
    { name:{ jp:"灯台", en:"Toudai" } },
    { name:{ jp:"飛行機", en:"Big cup" } }       // rejected: not romaji
  ]);
  assert.strictEqual(c.localize({ jp:"大皿灯台" }), "Ozara toudai");
  assert.strictEqual(c.localize({ jp:"大皿" }), "Ozara");
  assert.strictEqual(c.localize({ jp:"大皿とめけん" }), "Ozara tomeken");
  assert.strictEqual(c.localize({ zh:"飛", jp:"飛行機" }), "飛");   // unknown kanji -> rule 3
  assert.strictEqual(c.toRomaji("大皿灯台飛"), "");
});

test("kanji run learned from mixed name", () => {
  const c = fresh("en");
  c.rebuildReadingDict([{ name:{ jp:"大皿とめ", en:"Ozara tome" } }]);
  assert.strictEqual(c.getReadingDict()["大皿"], "ozara");
  assert.strictEqual(c.toRomaji("大皿けん"), "Ozara ken");
});

test("looksLikeRomaji", () => {
  const c = fresh();
  ["Ozara", "Toudai", "Tome ken", "Kin-ken", "Shinkansen", "Hakkou", "Kannon"].forEach(s => assert.ok(c.looksLikeRomaji(s), s));
  ["Big cup", "Airplane", "", "大皿", "Cup", "Lighthouse"].forEach(s => assert.ok(!c.looksLikeRomaji(s), s));
});

test("otherNames hides empty and the shown language", () => {
  const c = fresh("zh");
  assert.deepStrictEqual(JSON.parse(JSON.stringify(c.otherNames({ zh:"中", jp:"にほん", en:"" }))), [["JP", "にほん"]]);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(c.otherNames({ zh:"中", jp:"にほん", en:"Jp" }, "en"))), [["TW", "中"], ["JP", "にほん"]]);
  // romaji shown: raw jp still listed
  assert.deepStrictEqual(JSON.parse(JSON.stringify(c.otherNames({ zh:"", jp:"とめ", en:"" }, "en"))), [["JP", "とめ"]]);
  assert.strictEqual(c.otherNames(null).length, 0);
});
