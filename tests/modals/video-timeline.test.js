// Video timeline pure helpers (js/41-video-timeline.js) + title rule reuse.
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const { load } = require("../_load");

function setup(){
  const c = load(["js/01-data-model.js", "js/01-data-storage.js", "js/02-constants-colors-icons.js", "js/03-i18n.js", "js/04-state.js",
    "js/05-data-helpers.js", "js/05-data-ops.js", "js/05-data-util.js", "js/06-icons-svg.js", "js/34-drawer-videos.js", "js/41-modal-video.js",
    "js/41-video-loop.js", "js/41-video-timeline.js"]);
  c.URL = URL;
  return c;
}
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, a + " != " + b);

test("tlFrac / tlTimeFromX map px <-> time and clamp", () => {
  const c = setup();
  near(c.tlFrac(25, 100), 0.25);
  near(c.tlFrac(-5, 100), 0);
  near(c.tlFrac(500, 100), 1);
  near(c.tlFrac(5, 0), 0);
  near(c.tlTimeFromX(150, 50, 200, 100), 50);
  near(c.tlTimeFromX(0, 50, 200, 100), 0);
  near(c.tlTimeFromX(999, 50, 200, 100), 100);
  near(c.tlTimeFromX(100, 50, 200, 10.55), 2.6);
  near(c.tlTimeFromX(100, 50, 0, 100), 0);
  near(c.tlTimeFromX(100, 50, 200, 0), 0);
});

test("tlSetHandle clamps, keeps min gap, never swaps", () => {
  const c = setup();
  const d = { a: 10, b: 20 };
  assert.deepStrictEqual({ ...c.tlSetHandle(d, "a", 12, 60) }, { a: 12, b: 20 });
  assert.deepStrictEqual({ ...c.tlSetHandle(d, "a", -5, 60) }, { a: 0, b: 20 });
  assert.deepStrictEqual({ ...c.tlSetHandle(d, "a", 50, 60) }, { a: 19.7, b: 20 });
  assert.deepStrictEqual({ ...c.tlSetHandle(d, "b", 5, 60) }, { a: 10, b: 10.3 });
  assert.deepStrictEqual({ ...c.tlSetHandle(d, "b", 99, 60) }, { a: 10, b: 60 });
  assert.deepStrictEqual({ ...c.tlSetHandle(d, "b", 30.04, 60) }, { a: 10, b: 30 });
  assert.deepStrictEqual({ ...c.tlSetHandle(d, "a", 5, 0) }, { a: 10, b: 20 });
  // result always satisfies normalizeLoop
  [["a", 19.9], ["b", 10.1], ["a", 0], ["b", 60]].forEach(([w, t]) => assert.ok(c.normalizeLoop(c.tlSetHandle(d, w, t, 60)), w + t));
});

test("tlDefaultLoop 25% / 75%", () => {
  const c = setup();
  assert.deepStrictEqual({ ...c.tlDefaultLoop(100) }, { a: 25, b: 75 });
  assert.ok(c.normalizeLoop(c.tlDefaultLoop(2)));
});

test("video title rule (12 chars) still applies to inline title", () => {
  const c = setup();
  assert.strictEqual(c.videoTitleFits("一二三四五六七八九十十一"), true);
  assert.strictEqual(c.videoTitleFits("一二三四五六七八九十十一十二"), false);
  assert.strictEqual(c.videoTitleFits(""), true);
});
