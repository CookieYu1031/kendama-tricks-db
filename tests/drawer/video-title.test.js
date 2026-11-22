"use strict";
// v0.13: video title (optional, max 12 user-perceived chars, validated on save, default 「影片 N」).
const test = require("node:test");
const assert = require("node:assert");
const { load } = require("../_load");

const FILES = ["js/01-data-model.js", "js/01-data-storage.js", "js/02-constants-colors-icons.js", "js/03-i18n.js", "js/05-data-helpers.js", "js/05-data-ops.js", "js/05-data-util.js",
  "js/07-id.js", "js/08-loc-code.js", "js/09-names.js", "js/30-drawer-logic.js", "js/31-drawer-sections.js",
  "js/32-trick-drawer.js", "js/33-drawer-tags.js", "js/34-drawer-videos.js"];
function mk(lang){ return load(FILES, { URL, Intl, state: { lang: lang || "zh", activeSpace: "t00" } }); }
const c = mk();

test("videoTitleLength counts user-perceived characters", () => {
  assert.strictEqual(c.videoTitleLength("abc"), 3);
  assert.strictEqual(c.videoTitleLength("正面示範"), 4);
  assert.strictEqual(c.videoTitleLength("👨‍👩‍👧"), 1);
  assert.strictEqual(c.videoTitleLength(""), 0);
});

test("saveDrawerVideo: 12 ok, 13 rejected (no truncation), empty title ok", () => {
  const tr = { id: "a", media: [] };
  assert.strictEqual(c.saveDrawerVideo(tr, null, "https://youtu.be/1", "123456789012"), "ok");
  assert.strictEqual(tr.media[0].title, "123456789012");
  assert.strictEqual(c.saveDrawerVideo(tr, null, "https://youtu.be/2", "1234567890123"), "titleTooLong");
  assert.strictEqual(tr.media.length, 1);
  assert.strictEqual(c.saveDrawerVideo(tr, tr.media[0].id, "https://youtu.be/1", "  "), "ok");
  assert.strictEqual(tr.media[0].title, "");
  assert.strictEqual(c.saveDrawerVideo(tr, null, "ftp://x", "t"), "invalid");
  assert.strictEqual(c.saveDrawerVideo(tr, null, "", "t"), "empty");
});

test("setDrawerVideoUrl keeps existing title", () => {
  const tr = { id: "a", media: [] };
  c.saveDrawerVideo(tr, null, "https://youtu.be/1", "keep");
  c.setDrawerVideoUrl(tr, tr.media[0].id, "https://x.com/a/1");
  assert.strictEqual(tr.media[0].title, "keep");
});

test("videoSlotLabel: title or default by slot index (zh/jp/en)", () => {
  assert.strictEqual(c.videoSlotLabel({ title: "示範" }, 0), "示範");
  assert.strictEqual(c.videoSlotLabel({ title: "" }, 1), "影片 2");
  assert.strictEqual(c.videoSlotLabel(null, 2), "影片 3");
  assert.strictEqual(mk("jp").videoSlotLabel({}, 0), "動画 1");
  assert.strictEqual(mk("en").videoSlotLabel({}, 2), "Video 3");
});

test("normalizeDB: media title defaults to empty string, kept when present", () => {
  const db = c.normalizeDB({ version: 1, spaces: [], categories: [], tricks: [{ id: "t1", name: { zh: "a" },
    media: [{ id: "m1", type: "video", url: "https://youtu.be/1" }, { id: "m2", type: "video", url: "https://youtu.be/2", title: "x" }] }] });
  const t = (db.tricks || [])[0];
  if (t){ assert.strictEqual(t.media[0].title, ""); assert.strictEqual(t.media[1].title, "x"); }
});
