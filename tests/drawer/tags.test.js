// v0.9.2: tag kinds (text / class + combo): normalize, suggestions both ways, cleanup, publish + pending.
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const { load } = require("../_load");

function stubEl(){
  return { addEventListener(){}, classList: { add(){}, remove(){}, toggle(){}, contains(){ return false; } }, setAttribute(){}, style: {} };
}
function setup(){
  const ctx = load(["js/01-data-model.js", "js/01-data-storage.js", "js/02-constants-colors-icons.js", "js/03-i18n.js", "js/04-state.js", "js/05-data-helpers.js", "js/05-data-ops.js", "js/05-data-util.js",
    "js/07-id.js", "js/08-loc-code.js", "js/09-names.js", "js/30-drawer-logic.js", "js/50-sync-core.js", "js/51-shared-base.js",
    "js/53-sync-chunks.js", "js/56-pending.js", "js/32-trick-drawer.js", "js/33-drawer-tags.js", "js/77-admin-tags.js"], {
    document: { getElementById: stubEl, querySelector: () => null, querySelectorAll: () => [], addEventListener(){}, createElement: stubEl },
    fbStore: {}, firebase: { firestore: { FieldValue: { serverTimestamp: () => ({}) } } }
  });
  ctx.state.lang = "zh";
  ctx.saveDB = () => {};
  return ctx;
}
const J = (x) => JSON.parse(JSON.stringify(x));
const nm = (zh) => ({ zh, jp: "", en: "" });

test("normalizeDB: kind defaults to text, class keeps combo, invalid ids dropped", () => {
  const c = setup();
  const d = c.normalizeDB({ categories: [], tricks: [], tags: [
    { id: "g1", name: nm("KWC") },
    { id: "g2", name: nm("月面"), kind: "class", combo: { grip: "tama", parts: ["tamaTop", "bogus", "sara", "sara"] } },
    { id: "g3", name: nm("戰斧"), kind: "class", combo: { grip: "nope", parts: "x" } },
    { id: "g4", name: nm("無"), kind: "class" },
    { id: "g5", name: nm("文"), kind: "weird", combo: { grip: "ken", parts: [] } },
    { name: nm("noid") }
  ] });
  const by = {}; d.tags.forEach((g) => { by[g.id] = J(g); });
  assert.strictEqual(d.tags.length, 5);
  assert.strictEqual(by.g1.kind, "text");
  assert.strictEqual(by.g1.combo, undefined);
  assert.deepStrictEqual(by.g2.combo, { grip: "tama", parts: ["sara", "tamaTop"] }); // canonical PART_KEYS order
  assert.deepStrictEqual(by.g3.combo, { grip: null, parts: [] });
  assert.deepStrictEqual(by.g4.combo, { grip: null, parts: [] });
  assert.strictEqual(by.g5.kind, "text");
  assert.strictEqual(by.g5.combo, undefined);
});

function seedTags(c){
  c.db.tags = [
    { id: "moon", name: nm("月面"), kind: "class", combo: { grip: "tama", parts: ["sara", "tamaTop"] } },
    { id: "axe", name: nm("戰斧"), kind: "class", combo: { grip: "tama", parts: ["saraEdge", "ana"] } },
    { id: "nogrip", name: nm("皿"), kind: "class", combo: { grip: null, parts: ["sara"] } },
    { id: "empty", name: nm("空"), kind: "class", combo: { grip: null, parts: [] } },
    { id: "kwc", name: nm("KWC2026") },
    { id: "old", name: nm("舊"), kind: "text" }
  ];
}

test("tagKind / trickTagChips / availableTagChips split by kind", () => {
  const c = setup(); seedTags(c);
  const tr = { tagIds: ["moon", "kwc", "ghost"] };
  assert.strictEqual(c.tagKind(c.db.tags[4]), "text");
  assert.deepStrictEqual(Array.from(c.trickTagChips(tr, "class")).map((x) => x.id), ["moon"]);
  assert.deepStrictEqual(Array.from(c.trickTagChips(tr, "text")).map((x) => x.id), ["kwc"]);
  assert.deepStrictEqual(Array.from(c.trickTagChips(tr)).map((x) => x.id), ["moon", "kwc"]);
  assert.deepStrictEqual(Array.from(c.availableTagChips(tr, "class")).map((x) => x.id), ["axe", "nogrip", "empty"]);
  assert.deepStrictEqual(Array.from(c.availableTagChips(tr, "text")).map((x) => x.id), ["old"]);
});

test("grip+parts -> class suggestions", () => {
  const c = setup(); seedTags(c);
  const ids = (tr) => Array.from(c.classTagSuggestions(tr)).map((x) => x.id);
  assert.deepStrictEqual(ids({ grip: "tama", parts: ["sara", "tamaTop", "ana"], tagIds: [] }), ["moon", "nogrip"]);
  assert.deepStrictEqual(ids({ grip: "ken", parts: ["sara", "tamaTop"], tagIds: [] }), ["nogrip"]);   // grip mismatch
  assert.deepStrictEqual(ids({ grip: "tama", parts: ["sara"], tagIds: [] }), ["nogrip"]);            // missing part
  assert.deepStrictEqual(ids({ grip: "tama", parts: ["sara", "tamaTop"], tagIds: ["moon"] }), ["nogrip"]); // already on trick
  assert.deepStrictEqual(ids({ grip: null, parts: [], tagIds: [] }), []);                             // empty combo never suggested
});

test("class tag -> apply combo sets grip and adds missing parts only", () => {
  const c = setup(); seedTags(c);
  const moon = c.getTag("moon");
  const tr = { grip: "ken", parts: ["ana"], tagIds: ["moon"] };
  assert.deepStrictEqual(J(c.classComboGap(tr, moon)), { grip: "tama", parts: ["sara", "tamaTop"] });
  assert.strictEqual(c.comboLabel(moon.combo), "持球＋大小皿＋球面");
  assert.strictEqual(c.applyClassCombo(tr, moon), true);
  assert.strictEqual(tr.grip, "tama");
  assert.deepStrictEqual(Array.from(tr.parts), ["sara", "tamaTop", "ana"]);
  assert.strictEqual(c.classComboGap(tr, moon), null);
  assert.strictEqual(c.applyClassCombo(tr, moon), false);
  assert.strictEqual(c.classComboGap(tr, c.getTag("kwc")), null);
  assert.strictEqual(c.classComboGap(tr, c.getTag("empty")), null);
});

test("adding a class tag overwrites grip + parts; removing leaves them", () => {
  const c = setup(); seedTags(c);
  const tr = { grip: "ken", parts: ["ana", "kenchou"], tagIds: [] };
  assert.strictEqual(c.putTagOnTrick(tr, "moon"), true);
  assert.deepStrictEqual(Array.from(tr.tagIds), ["moon"]);
  assert.strictEqual(tr.grip, "tama");
  assert.deepStrictEqual(Array.from(tr.parts), ["sara", "tamaTop"]);   // overwritten, not merged
  c.putTagOnTrick(tr, "moon");
  assert.deepStrictEqual(Array.from(tr.tagIds), ["moon"]);             // no duplicate
  const keep = { grip: "ken", parts: ["ana"], tagIds: [] };
  c.putTagOnTrick(keep, "kwc");                                       // text tag: no combo, untouched
  assert.strictEqual(keep.grip, "ken");
  assert.deepStrictEqual(Array.from(keep.parts), ["ana"]);
});

test("createTag / updateTag / usage / removeTag cleanup", () => {
  const c = setup();
  c.db.tags = []; c.db.tricks = [{ id: "a", tagIds: [] }, { id: "b", tagIds: [] }];
  const cls = c.createTag("class", nm(" 月面 "), { grip: "tama", parts: ["tamaTop", "x"] });
  const txt = c.createTag("text", nm("KWC"), { grip: "tama", parts: ["sara"] });
  assert.strictEqual(cls.name.zh, "月面");
  assert.strictEqual(cls.kind, "class");
  assert.deepStrictEqual(J(cls.combo), { grip: "tama", parts: ["tamaTop"] });
  assert.strictEqual(txt.kind, "text");
  assert.strictEqual(txt.combo, undefined);
  assert.strictEqual(c.createTag("text", nm("  ")), null);
  c.updateTag(cls.id, { name: { zh: "月", jp: "ムーン", en: "" }, combo: { grip: null, parts: ["sara"] } });
  assert.strictEqual(c.getTag(cls.id).name.jp, "ムーン");
  assert.deepStrictEqual(J(c.getTag(cls.id).combo), { grip: null, parts: ["sara"] });
  assert.strictEqual(c.updateTag(cls.id, { name: nm("") }), null);
  c.updateTag(txt.id, { combo: { grip: "ken", parts: [] } });
  assert.strictEqual(c.getTag(txt.id).combo, undefined);
  c.db.tricks[0].tagIds = [cls.id, txt.id]; c.db.tricks[1].tagIds = [txt.id];
  assert.strictEqual(c.tagUsageCount(txt.id), 2);
  c.removeTag(txt.id);
  assert.deepStrictEqual(c.db.tricks.map((t) => Array.from(t.tagIds)), [[cls.id], []]);
  assert.strictEqual(c.getTag(txt.id), undefined);
});

test("publish snapshot keeps kind/combo; pending counts a combo change", () => {
  const c = setup(); seedTags(c);
  const base = J(c.buildPublishSnapshot({ categories: [], tricks: [], infos: [], tags: c.db.tags }));
  const moon = base.tags.find((g) => g.id === "moon");
  assert.strictEqual(moon.kind, "class");
  assert.deepStrictEqual(moon.combo, { grip: "tama", parts: ["sara", "tamaTop"] });
  assert.notStrictEqual(base.tags.find((g) => g.id === "kwc").kind, "class");
});

test("pending: combo / kind edits count as a modified tag", () => {
  const c = setup(); seedTags(c);
  const base = { categories: [], tricks: [], infos: [], tags: J(c.db.tags) };
  const data = J(base);
  data.tags.find((g) => g.id === "moon").combo.parts = ["sara"];
  const st = c.computePendingStatus(base, data);
  assert.strictEqual(st.summary.tags, 1);
});

test("normalizeDB round-trips a published class tag", () => {
  const c = setup(); seedTags(c);
  const d = c.normalizeDB({ categories: [], tricks: [], tags: J(c.db.tags) });
  assert.deepStrictEqual(J(d.tags.find((g) => g.id === "axe")), J(c.db.tags[1]));
});

test("class tag with a category grip: suggested for any sub, overwrites only outside that category", () => {
  const c = setup();
  c.db.tags = [
    { id: "kcat", name: nm("劍類"), kind: "class", combo: { grip: "ken", parts: ["sara"] } },
    { id: "ksub", name: nm("持皿類"), kind: "class", combo: { grip: "ken_sara", parts: ["sara"] } }
  ];
  const ids = (tr) => Array.from(c.classTagSuggestions(tr)).map((x) => x.id);
  assert.deepStrictEqual(ids({ grip: "ken_gun", parts: ["sara"], tagIds: [] }), ["kcat"]);
  assert.deepStrictEqual(ids({ grip: "ken_sara", parts: ["sara"], tagIds: [] }), ["kcat", "ksub"]);
  assert.deepStrictEqual(ids({ grip: "tama", parts: ["sara"], tagIds: [] }), []);
  const keep = { grip: "ken_gun", parts: [], tagIds: [] };
  c.putTagOnTrick(keep, "kcat");
  assert.strictEqual(keep.grip, "ken_gun");                 // already inside the category: kept
  const move = { grip: "tama_stunt", parts: [], tagIds: [] };
  c.putTagOnTrick(move, "kcat");
  assert.strictEqual(move.grip, "ken");                     // other category: overwritten
  c.putTagOnTrick(keep, "ksub");
  assert.strictEqual(keep.grip, "ken_sara");                // sub overwrites
});
