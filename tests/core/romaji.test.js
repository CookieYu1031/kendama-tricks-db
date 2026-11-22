// Smoke test: proves the vm loader works against the real browser scripts.
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const { load } = require("../_load");

const ctx = load(["js/03-i18n.js", "js/09-names.js"], { state: { lang: "zh" } });

test("kanaToRomaji converts hiragana and katakana", () => {
  assert.strictEqual(ctx.kanaToRomaji("とめけん"), "tomeken");
  assert.strictEqual(ctx.kanaToRomaji("トメケン"), "tomeken");
});
