"use strict";
// v0.9.3: drawer video slots (URL -> source site), section hiding, official note removed.
const test = require("node:test");
const assert = require("node:assert");
const { load } = require("../_load");

const c = load(["js/01-data-model.js", "js/01-data-storage.js", "js/02-constants-colors-icons.js", "js/03-i18n.js", "js/05-data-helpers.js", "js/05-data-ops.js", "js/05-data-util.js",
  "js/07-id.js", "js/08-loc-code.js", "js/09-names.js", "js/30-drawer-logic.js", "js/31-drawer-sections.js",
  "js/32-trick-drawer.js", "js/33-drawer-tags.js", "js/34-drawer-videos.js"], { URL, state: { lang: "zh", activeSpace: "t00" } });

test("videoSourceOf detects the source site", () => {
  const cases = {
    "https://www.youtube.com/watch?v=abc": "youtube", "https://youtu.be/abc": "youtube", "https://m.youtube.com/shorts/x": "youtube",
    "https://www.instagram.com/reel/x/": "instagram", "https://www.facebook.com/watch?v=1": "facebook", "https://fb.watch/x": "facebook",
    "https://www.tiktok.com/@a/video/1": "tiktok", "https://vm.tiktok.com/x": "tiktok",
    "https://x.com/a/status/1": "twitter", "https://twitter.com/a/status/1": "twitter",
    "https://www.threads.net/@a/post/x": "threads", "https://www.threads.com/@a/post/x": "threads",
    "https://drive.google.com/file/d/1/view": "drive", "https://vimeo.com/123": "vimeo",
    "https://example.com/v.mp4": "other", "not a url": "other", "": "other",
    "https://notyoutube.com/x": "other", "https://evilx.com/": "other"
  };
  Object.keys(cases).forEach(u => assert.strictEqual(c.videoSourceOf(u), cases[u], u));
});

test("every source has an svg icon, unknown falls back to the link icon", () => {
  ["youtube", "instagram", "facebook", "tiktok", "twitter", "threads", "drive", "other"].forEach(k =>
    assert.ok(/^<svg/.test(c.VIDEO_SOURCE_ICONS[k]), k));
  assert.strictEqual(c.videoSourceIcon("https://example.com/x"), c.VIDEO_SOURCE_ICONS.other);
  assert.strictEqual(c.videoSourceIcon("https://youtu.be/x"), c.VIDEO_SOURCE_ICONS.youtube);
});

test("setDrawerVideoUrl: validates, appends, edits, caps at MAX_VIDEOS", () => {
  const tr = { id: "a", media: [] };
  assert.strictEqual(c.setDrawerVideoUrl(tr, null, "  "), "empty");
  assert.strictEqual(c.setDrawerVideoUrl(tr, null, "javascript:alert(1)"), "invalid");
  assert.strictEqual(tr.media.length, 0);
  assert.strictEqual(c.setDrawerVideoUrl(tr, null, "https://youtu.be/1"), "ok");
  assert.strictEqual(tr.media[0].platform, "youtube");
  assert.strictEqual(tr.media[0].type, "video");
  assert.strictEqual(c.setDrawerVideoUrl(tr, tr.media[0].id, "https://x.com/a/status/1"), "ok");
  assert.strictEqual(tr.media[0].platform, "twitter");
  assert.strictEqual(c.setDrawerVideoUrl(tr, "nope", "https://x.com/a"), "invalid");
  c.setDrawerVideoUrl(tr, null, "https://youtu.be/2"); c.setDrawerVideoUrl(tr, null, "https://youtu.be/3");
  assert.strictEqual(c.MAX_VIDEOS, 3);
  assert.strictEqual(c.setDrawerVideoUrl(tr, null, "https://youtu.be/4"), "full");
  assert.strictEqual(tr.media.length, 3);
});

test("drawerSections: view mode hides empty sections", () => {
  const empty = { name: { zh: "", jp: "x", en: "" }, media: [], tagIds: [], parts: [], grip: null, note: "" };
  let s = c.drawerSections(empty, false, false);
  assert.deepStrictEqual([s.videos, s.flow, s.note, s.gripParts, s.tags], [false, false, false, false, false]);
  assert.strictEqual(s.names, true);
  const full = { name: { zh: "a", jp: "", en: "" }, media: [{ type: "video" }], tagIds: ["t"], parts: [], grip: null, note: "hi" };
  s = c.drawerSections(full, false, false);
  assert.deepStrictEqual([s.videos, s.flow, s.note], [true, true, true]);
  assert.strictEqual(c.drawerSections({ name: {}, media: [], tagIds: [], parts: ["ana"], note: "  " }, false, false).flow, true);
  assert.strictEqual(c.drawerSections({ name: {}, media: [], tagIds: [], parts: [], note: "  " }, false, false).note, false);
});

test("drawerSections: edit mode shows everything editable; note for everyone", () => {
  const empty = { name: { zh: "a" }, media: [], tagIds: [], parts: [], note: "" };
  let s = c.drawerSections(empty, true, true);
  assert.deepStrictEqual([s.names, s.videos, s.gripParts, s.tags, s.note, s.flow], [true, true, true, true, true, false]);
  s = c.drawerSections(empty, true, false); // edit mode but trick not editable by this account
  assert.deepStrictEqual([s.videos, s.gripParts, s.tags, s.note], [false, false, false, true]);
});

