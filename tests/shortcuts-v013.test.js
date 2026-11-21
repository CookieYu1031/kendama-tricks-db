"use strict";
// v0.13: only Ctrl/Cmd+C/X/V/Z, Delete, Esc remain; only swipe-back gesture remains.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const rd = (f) => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

test("removed key handlers are gone", () => {
  const k = strip(rd("js/24-browse-keys.js"));
  assert.ok(!/keyAction\(|kbdMove|kbdOpen|kbdNextIndex|kbdRun|kbdHelp|ArrowLeft|ArrowUp|ArrowDown|ArrowRight|Backspace|"\/"|"\?"|case "e"|case "n"/.test(k));
  assert.ok(!/kbdHelp/.test(rd("js/03-i18n.js")));
});
test("kept: undo, delete, clipboard dispatch", () => {
  const k = rd("js/24-browse-keys.js");
  assert.match(k, /undoKeyAction/);
  assert.match(k, /"Delete"/);
  assert.match(k, /clipKeyAction/);
  assert.match(rd("js/28-browse-undo.js"), /function undoKeyAction/);
  assert.match(rd("js/25-browse-clipboard.js"), /function clipKeyAction/);
});
test("kept: Escape closes overlays", () => {
  const e = rd("js/90-events-and-init.js");
  assert.match(e, /ev\.key !== "Escape"/);
  assert.match(e, /closeDrawer\(\)/);
});
test("only swipe-back gesture remains in browse/drawer", () => {
  assert.match(rd("js/27-browse-swipe-back.js"), /function swipeBackDecision/);
  assert.match(rd("js/23-browse-gestures.js"), /function browseGoUp/);
  assert.ok(!/touchstart|touchmove/.test(rd("js/32-trick-drawer.js")));
});
