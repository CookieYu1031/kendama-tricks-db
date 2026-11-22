// Video modal tools (js/41): mirror toggle, YouTube playback speed.
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const { load } = require("../_load");

function setup(){
  const c = load(["js/01-data-model.js", "js/01-data-storage.js", "js/02-constants-colors-icons.js", "js/03-i18n.js", "js/04-state.js",
    "js/05-data-helpers.js", "js/05-data-ops.js", "js/05-data-util.js", "js/06-icons-svg.js", "js/41-modal-video.js"]);
  c.URL = URL; // vm context has no URL global
  return c;
}

test("speed cycles 1 -> 0.75 -> 0.5 -> 0.25 -> 1", () => {
  const c = setup();
  assert.strictEqual(c.nextVideoRate(1), 0.75);
  assert.strictEqual(c.nextVideoRate(0.75), 0.5);
  assert.strictEqual(c.nextVideoRate(0.5), 0.25);
  assert.strictEqual(c.nextVideoRate(0.25), 1);
  assert.strictEqual(c.nextVideoRate(2), 1);
  assert.strictEqual(c.videoRateLabel(0.25), "0.25x");
});

test("YouTube embed enables the IFrame API; tools: mirror + speed", () => {
  const c = setup();
  const info = c.getEmbedInfo("https://youtu.be/abc123");
  assert.strictEqual(info.embedUrl, "https://www.youtube.com/embed/abc123?enablejsapi=1&playsinline=1");
  assert.deepStrictEqual(JSON.parse(JSON.stringify(c.videoToolsFor(info))), { mirror: true, speed: true });
});

test("Vimeo: mirror only; non-embeddable: no tools", () => {
  const c = setup();
  assert.deepStrictEqual(JSON.parse(JSON.stringify(c.videoToolsFor(c.getEmbedInfo("https://vimeo.com/123")))), { mirror: true, speed: false });
  assert.deepStrictEqual(JSON.parse(JSON.stringify(c.videoToolsFor(c.getEmbedInfo("https://www.instagram.com/p/x/")))), { mirror: false, speed: false });
  assert.deepStrictEqual(JSON.parse(JSON.stringify(c.videoToolsFor(null))), { mirror: false, speed: false });
});

test("setPlaybackRate command message shape", () => {
  const c = setup();
  assert.deepStrictEqual(JSON.parse(c.ytCommandMessage("setPlaybackRate", [0.5])), { event: "command", func: "setPlaybackRate", args: [0.5] });
});

