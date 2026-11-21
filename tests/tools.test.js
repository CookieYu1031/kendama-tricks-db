"use strict";
const test = require("node:test");
const assert = require("node:assert");
const { load } = require("./_load");

function ctxLoad(){
  return load(["js/01-data-model.js","js/02-constants-colors-icons.js","js/03-i18n.js","js/04-state.js","js/05-data-helpers.js","js/06-icons-svg.js","js/80-tools.js"]);
}

test("registry shape", () => {
  const c = ctxLoad();
  assert.deepStrictEqual(Array.from(c.TOOLS, (x) => x.id), ["random", "practice", "kwc"]);
  c.TOOLS.forEach((x) => {
    assert.ok(x.icon.indexOf("<svg") === 0);
    assert.ok(x.nameKey && x.descKey);
    assert.strictEqual(x.open, null);
    assert.strictEqual(c.isToolAvailable(x), false);
  });
  assert.strictEqual(c.getToolById("kwc").id, "kwc");
  assert.strictEqual(c.getToolById("nope"), null);
});

test("i18n keys exist in zh/jp/en", () => {
  const c = ctxLoad();
  const keys = ["toolsTitle","toolsSub","toolsClose","toolSoon"];
  c.TOOLS.forEach((x) => keys.push(x.nameKey, x.descKey));
  ["zh","jp","en"].forEach((l) => keys.forEach((k) => {
    assert.ok(c.UI[l][k] && c.UI[l][k].length, l + "." + k);
  }));
});

test("isToolAvailable true once open is a function", () => {
  const c = ctxLoad();
  assert.strictEqual(c.isToolAvailable({ open: function(){} }), true);
});
