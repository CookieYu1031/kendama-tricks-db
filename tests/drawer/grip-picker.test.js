// Grip picker (js/36) + grip info page (js/48): every grip key has labels in all languages, info rows cover the sub-grips.
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const { load } = require("../_load");

function setup(){
  return load(["js/01-data-model.js", "js/01-data-storage.js", "js/02-constants-colors-icons.js", "js/03-i18n.js", "js/04-state.js",
    "js/05-data-helpers.js", "js/05-data-ops.js", "js/05-data-util.js", "js/36-grip-picker.js", "js/48-modal-grip-info.js"], { URL });
}

test("every grip key has a full and a short label in zh / jp / en", () => {
  const c = setup();
  ["zh", "jp", "en"].forEach((l) => c.GRIP_KEYS.forEach((k) => {
    assert.ok(c.UI[l]["grip_" + k], l + " grip_" + k);
    assert.ok(c.UI[l]["gripS_" + k], l + " gripS_" + k);
  }));
});

test("info page: one row per sub-grip (tama category row counts as tama_tama), three languages each", () => {
  const c = setup();
  const n = (g) => c.GRIP_INFO_ROWS[g.key].length;
  c.GRIP_GROUPS.forEach((g) => assert.strictEqual(n(g), g.grips.length, g.key));
  c.GRIP_GROUPS.forEach((g) => c.GRIP_INFO_ROWS[g.key].forEach((r) => ["zh", "jp", "en"].forEach((l) => {
    assert.strictEqual(r[2][l].length, 3, g.key + " " + l);
    assert.ok(r[2][l][0] && r[2][l][1]);
  })));
  ["zh", "jp", "en"].forEach((l) => assert.strictEqual(c.GRIP_INFO_NOTES[l].length, 4));
});

test("info page html: link is a safe https url with noopener, text is escaped", () => {
  const c = setup();
  c.state.lang = "zh";
  const h = c.gripInfoHtml();
  assert.ok(h.indexOf('href="https://www.davidrusca.com/static/pdf/KendamaTrickNotation1.2.pdf"') !== -1);
  assert.ok(h.indexOf('rel="noopener noreferrer"') !== -1);
  assert.ok(h.indexOf("持劍尾") !== -1);
});

test("picker source: category cells are headers (no click handler), only subs are chips; default search grip is null", () => {
  const fs = require("fs"), path = require("path");
  const src = fs.readFileSync(path.join(__dirname, "../../js/36-grip-picker.js"), "utf8");
  assert.ok(/function isGripSub\(k\)\{ return GRIP_KEYS\.indexOf\(k\) !== -1 && !isGripCategory\(k\)/.test(src));
  assert.ok(src.indexOf('cat.addEventListener') === -1);
  const c = setup();
  assert.ok(c.isGripCategory("ken") && !c.isGripCategory("ken_ken"));
  assert.ok(c.gripMatches("ken_sara", "ken") && c.gripMatches("ken", "ken"));
});
