// Trick "translation to be checked" flags: normalize, toggle, grey only in edit mode.
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const { load } = require("../_load");

function setup(){
  return load(["js/01-data-model.js", "js/01-data-storage.js", "js/02-constants-colors-icons.js", "js/03-i18n.js", "js/04-state.js",
    "js/05-data-helpers.js", "js/05-data-ops.js", "js/05-data-util.js", "js/05-data-prefix.js", "js/07-id.js", "js/09-names.js", "js/30-drawer-logic.js"]);
}
const norm = (ctx, nu) => ctx.normalizeDB({ categories: [], infos: [], tags: [],
  tricks: [{ id: "a000000", name: { zh: "甲", jp: "", en: "A" }, categoryIds: [], nameUnsure: nu }] }).tricks[0];

test("normalize keeps only true zh/jp/en keys, drops empty", () => {
  const ctx = setup();
  assert.deepStrictEqual(JSON.parse(JSON.stringify(norm(ctx, { zh: true, en: false, fr: true, jp: "x" }).nameUnsure)), { zh: true });
  assert.strictEqual("nameUnsure" in norm(ctx, { zh: false }), false);
  assert.strictEqual("nameUnsure" in norm(ctx, undefined), false);
  assert.strictEqual("nameUnsure" in norm(ctx, "zh"), false);
});

test("toggle adds and removes; field removed when empty", () => {
  const ctx = setup();
  const tr = norm(ctx);
  assert.strictEqual(ctx.toggleNameUnsure(tr, "en"), true);
  assert.strictEqual(ctx.isNameUnsure(tr, "en"), true);
  assert.strictEqual(ctx.isNameUnsure(tr, "zh"), false);
  assert.strictEqual(ctx.toggleNameUnsure(tr, "en"), false);
  assert.strictEqual("nameUnsure" in tr, false);
  assert.strictEqual(ctx.toggleNameUnsure(tr, "xx"), false);
});

test("nameShownUnsure: grey only in edit mode and for the shown language", () => {
  const ctx = setup();
  const tr = norm(ctx);
  ctx.state.lang = "zh";
  ctx.toggleNameUnsure(tr, "zh");
  assert.strictEqual(ctx.nameShownUnsure(tr, tr.name, false), false);
  assert.strictEqual(ctx.nameShownUnsure(tr, tr.name, true), true);
  ctx.state.lang = "en";
  assert.strictEqual(ctx.nameShownUnsure(tr, tr.name, true), false);
  ctx.toggleNameUnsure(tr, "en");
  assert.strictEqual(ctx.nameShownUnsure(tr, tr.name, true), true);
});
