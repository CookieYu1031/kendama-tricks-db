// Trick drawer pure helpers: rate/grip/part toggles, tag chips, location codes.
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const { load } = require("./_load");

function setup(){
  const ctx = load(["js/01-data-model.js", "js/02-constants-colors-icons.js", "js/03-i18n.js", "js/05-data-helpers.js",
    "js/07-id.js", "js/08-loc-code.js", "js/09-names.js", "js/30-drawer-logic.js", "js/31-drawer-sections.js", "js/32-trick-drawer.js"], { state: { lang: "zh", activeSpace: "t00" } });
  ctx.saveDB = () => {};
  const tr = (id, cats, extra) => Object.assign({ id, name: { zh: id, jp: "", en: "" }, categoryIds: cats, orderByCategory: {}, tagIds: [], parts: [], grip: null, rate: null }, extra);
  ctx.db = {
    spaces: ctx.db.spaces,
    categories: [{ id: "c1", parentId: null, spaceId: "t00", name: { zh: "c1", jp: "", en: "" }, order: 0 }],
    tricks: [tr("a000000", ["c1"]), tr("b000000", ["c1"]), tr("favonly", ["fav"])],
    tags: [{ id: "g1", name: { zh: "標籤", jp: "", en: "Tag" } }, { id: "g2", name: { zh: "二", jp: "", en: "" } }],
    infos: []
  };
  ctx.invalidateDbIndex();
  return ctx;
}

test("setRate: set, switch, null/unknown clears", () => {
  const c = setup(), t = {};
  assert.strictEqual(c.setRate(t, "rare"), "rare");
  assert.strictEqual(c.setRate(t, "most"), "most");
  assert.strictEqual(c.setRate(t, null), null);
  assert.strictEqual(c.setRate(t, "rare"), "rare");
  assert.strictEqual(c.setRate(t, "bogus"), null);
});

test("setRate: landed follows rate (level sets, none clears)", () => {
  const c = setup(), t = { landed: false, rate: null };
  c.setRate(t, "sometimes");
  assert.strictEqual(t.landed, true);
  c.setRate(t, null);
  assert.strictEqual(t.rate, null);
  assert.strictEqual(t.landed, false);
});

test("toggleGrip single / togglePart multi in canonical order", () => {
  const c = setup(), t = { grip: null, parts: [] };
  assert.strictEqual(c.toggleGrip(t, "ken"), "ken");
  assert.strictEqual(c.toggleGrip(t, "ito"), "ito");
  assert.strictEqual(c.toggleGrip(t, "ito"), null);
  c.togglePart(t, "ana"); c.togglePart(t, "kensaki");
  assert.deepStrictEqual(Array.from(t.parts), ["kensaki", "ana"]);
  c.togglePart(t, "ana");
  assert.deepStrictEqual(Array.from(t.parts), ["kensaki"]);
});

test("tag chips: localized labels, missing ids skipped, available excludes own", () => {
  const c = setup(), t = { tagIds: ["g1", "gone"] };
  assert.deepStrictEqual(JSON.parse(JSON.stringify(c.trickTagChips(t))), [{ id: "g1", label: "標籤", kind: "text" }]);
  assert.deepStrictEqual(Array.from(c.availableTagChips(t)).map(x => x.id), ["g2"]);
  c.state.lang = "en";
  assert.strictEqual(c.trickTagChips(t)[0].label, "Tag");
});

test("addTagToTrick reuses same-named tag, creates new otherwise", () => {
  const c = setup(), t = { tagIds: [] };
  assert.strictEqual(c.addTagToTrick(t, " tag ", "zh").id, "g1");
  assert.strictEqual(c.db.tags.length, 2);
  const n = c.addTagToTrick(t, "New", "en");
  assert.strictEqual(c.db.tags.length, 3);
  assert.strictEqual(n.name.en, "New");
  assert.deepStrictEqual(Array.from(t.tagIds), ["g1", n.id]);
  assert.strictEqual(c.addTagToTrick(t, "  ", "zh"), null);
});

test("trickLocCodes: code for table-placed trick, none for favorites-only", () => {
  const c = setup();
  const a = c.getTrick("a000000"), b = c.getTrick("b000000");
  assert.deepStrictEqual(Array.from(c.trickLocCodes(a)), ["001a-tr-00"]);
  assert.deepStrictEqual(Array.from(c.trickLocCodes(b)), ["001a-tr-01"]);
  assert.deepStrictEqual(Array.from(c.trickLocCodes(c.getTrick("favonly"))), []);
});

test("drawer strings registered in zh/jp/en", () => {
  const c = setup();
  ["tagsLabel", "gripLabel", "partsLabel", "rateLabel", "officialNoteLabel", "personalNoteLabel", "confirmDeleteTagBody"].forEach(k => {
    ["zh", "jp", "en"].forEach(l => { c.state.lang = l; assert.notStrictEqual(c.t(k), k); });
  });
});
