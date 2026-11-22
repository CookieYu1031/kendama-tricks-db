"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const { load } = require("../_load");

const ROOT = path.join(__dirname, "..", "..");
function ctxLoad(){
  return load(["js/01-data-model.js","js/01-data-storage.js","js/02-constants-colors-icons.js","js/03-i18n.js","js/04-state.js","js/05-data-helpers.js","js/05-data-ops.js","js/05-data-util.js","js/15-shell-theme.js"]);
}

test("ui zoom pref: default x1, only 1 / 1.1 / 1.2 accepted", () => {
  const c = ctxLoad();
  assert.strictEqual(c.getUiZoomPref(), "1");
  assert.strictEqual(c.normalizeUiZoom("1.1"), "1.1");
  assert.strictEqual(c.normalizeUiZoom("1.2"), "1.2");
  assert.strictEqual(c.normalizeUiZoom("2"), "1");
  assert.strictEqual(c.normalizeUiZoom(null), "1");
  c.setUiZoomPref("1.2");
  assert.strictEqual(c.getUiZoomPref(), "1.2");
  c.setUiZoomPref("bogus");
  assert.strictEqual(c.getUiZoomPref(), "1");
});

test("css scales by html[data-ui-zoom], no viewport-width zoom media queries", () => {
  const css = fs.readFileSync(path.join(ROOT, "css/variables-and-base.css"), "utf8");
  assert.match(css, /html\[data-ui-zoom="1\.1"\]\{[^}]*zoom:1\.1/);
  assert.match(css, /html\[data-ui-zoom="1\.2"\]\{[^}]*zoom:1\.2/);
  assert.doesNotMatch(css, /min-width:\s*1280px/);
});

test("settings has the x1 / x1.1 / x1.2 switch next to the theme switch", () => {
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const i = html.indexOf('id="themeSwitch"'), j = html.indexOf('id="zoomSwitch"'), k = html.indexOf('id="langSwitch"');
  assert.ok(i > 0 && j > i && k > j);
  ["1", "1.1", "1.2"].forEach((z) => assert.ok(html.includes('data-ui-zoom="' + z + '"'), z));
});
