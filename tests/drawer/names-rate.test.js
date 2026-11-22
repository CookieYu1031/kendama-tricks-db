// v0.5 drawer: rate/landed migration, name rules, id label, no trick edit modal.
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const { load } = require("../_load");

function setup(){
  return load(["js/01-data-model.js", "js/01-data-storage.js", "js/02-constants-colors-icons.js", "js/03-i18n.js", "js/05-data-helpers.js", "js/05-data-ops.js", "js/05-data-util.js",
    "js/07-id.js", "js/08-loc-code.js", "js/09-names.js", "js/30-drawer-logic.js", "js/31-drawer-sections.js", "js/30-drawer-logic.js", "js/31-drawer-sections.js", "js/32-trick-drawer.js"], { state: { lang: "zh", activeSpace: "t00" } });
}
const norm = (c, t) => c.normalizeDB({ categories: [], tricks: [Object.assign({ id: "a000000", name: { zh: "a" } }, t)] }).tricks[0];

test("normalizeDB: rate set -> landed true; none -> landed false", () => {
  const c = setup();
  assert.strictEqual(norm(c, { rate: "most", landed: false }).landed, true);
  const n = norm(c, {});
  assert.strictEqual(n.rate, null);
  assert.strictEqual(n.landed, false);
  assert.strictEqual(norm(c, { rate: "bogus" }).landed, false);
});

test("setTrickName: refuses emptying the last name", () => {
  const c = setup(), t = { name: { zh: "大皿", jp: "", en: "" } };
  assert.strictEqual(c.setTrickName(t, "zh", "  "), false);
  assert.strictEqual(t.name.zh, "大皿");
  assert.strictEqual(c.setTrickName(t, "en", " Big "), true);
  assert.strictEqual(t.name.en, "Big");
  assert.strictEqual(c.setTrickName(t, "zh", ""), true);
  assert.strictEqual(c.setTrickName(t, "en", ""), false);
});

test("nameTableLangs excludes the main language; trickIdLabel adds @", () => {
  const c = setup();
  assert.deepStrictEqual(Array.from(c.nameTableLangs("jp")), ["zh", "en"]);
  assert.deepStrictEqual(Array.from(c.nameTableLangs("zh")), ["jp", "en"]);
  assert.strictEqual(c.trickIdLabel({ id: "0qbk3xY" }), "@0qbk3xY");
});


