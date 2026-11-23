// Video key-section input pure helpers (js/41-video-range.js) + title rule reuse.
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const { load } = require("../_load");

function setup(){
  const c = load(["js/01-data-model.js", "js/01-data-storage.js", "js/02-constants-colors-icons.js", "js/03-i18n.js", "js/04-state.js",
    "js/05-data-helpers.js", "js/05-data-ops.js", "js/05-data-util.js", "js/06-icons-svg.js", "js/34-drawer-videos.js", "js/41-modal-video.js",
    "js/41-video-loop.js", "js/41-video-range.js"]);
  c.URL = URL;
  return c;
}
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, a + " != " + b);

test("maskLoopDigits keeps digits and inserts the colon", () => {
  const c = setup();
  const m = c.maskLoopDigits;
  assert.strictEqual(m(""), "");
  assert.strictEqual(m("1"), "1");
  assert.strictEqual(m("12"), "12");
  assert.strictEqual(m("123"), "1:23");
  assert.strictEqual(m("1234"), "12:34");
  assert.strictEqual(m("12345"), "12:34");
  assert.strictEqual(m("1:2a3"), "1:23");
  assert.strictEqual(m(null), "");
});

test("parseLoopTime formats", () => {
  const c = setup();
  assert.strictEqual(c.parseLoopTime("5"), 5);
  assert.strictEqual(c.parseLoopTime("12"), 12);
  assert.strictEqual(c.parseLoopTime("105"), 65);
  assert.strictEqual(c.parseLoopTime("0105"), 65);
  assert.strictEqual(c.parseLoopTime("1234"), 754);
  assert.strictEqual(c.parseLoopTime("1:05"), 65);
  assert.strictEqual(c.parseLoopTime("12:34"), 754);
  assert.strictEqual(c.parseLoopTime("1:02:05"), 3725);
  assert.strictEqual(c.parseLoopTime(" 0:00 "), 0);
});

test("parseLoopTime empty -> null, bad -> NaN", () => {
  const c = setup();
  assert.strictEqual(c.parseLoopTime(""), null);
  assert.strictEqual(c.parseLoopTime("  "), null);
  assert.strictEqual(c.parseLoopTime(null), null);
  ["abc", "-5", "1:", ":30", "1:75", "1:2:3:4", "1.5", "1,5", "175", "12345"].forEach((x) => assert.ok(Number.isNaN(c.parseLoopTime(x)), x));
});

test("formatMmSs", () => {
  const c = setup();
  assert.strictEqual(c.formatMmSs(0), "00:00");
  assert.strictEqual(c.formatMmSs(5), "00:05");
  assert.strictEqual(c.formatMmSs(83), "01:23");
  assert.strictEqual(c.formatMmSs(83.6), "01:24");
  assert.strictEqual(c.formatMmSs(6000), "100:00");
  assert.strictEqual(c.formatMmSs(-3), "00:00");
});

test("video title rule (12 chars) still applies to inline title", () => {
  const c = setup();
  assert.strictEqual(c.videoTitleFits("一二三四五六七八九十十一"), true);
  assert.strictEqual(c.videoTitleFits("一二三四五六七八九十十一十二"), false);
  assert.strictEqual(c.videoTitleFits(""), true);
});
