// Video A-B loop (js/41-video-loop.js, normalizeLoop in js/01-data-storage.js).
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const { load } = require("../_load");

function setup(){
  const c = load(["js/01-data-model.js", "js/01-data-storage.js", "js/02-constants-colors-icons.js", "js/03-i18n.js", "js/04-state.js",
    "js/05-data-helpers.js", "js/05-data-ops.js", "js/05-data-util.js", "js/06-icons-svg.js", "js/34-drawer-videos.js", "js/41-modal-video.js", "js/41-video-loop.js"]);
  c.URL = URL;
  return c;
}

test("normalizeLoop validates and rounds to 0.1s", () => {
  const c = setup();
  assert.deepStrictEqual({ ...c.normalizeLoop({ a: 12.34, b: 15.86 }) }, { a: 12.3, b: 15.9 });
  assert.strictEqual(c.normalizeLoop({ a: 5, b: 5 }), null);
  assert.strictEqual(c.normalizeLoop({ a: 6, b: 5 }), null);
  assert.strictEqual(c.normalizeLoop({ a: -1, b: 5 }), null);
  assert.strictEqual(c.normalizeLoop({ a: 0, b: 21601 }), null);
  assert.strictEqual(c.normalizeLoop({ a: "1", b: 5 }), null);
  assert.strictEqual(c.normalizeLoop(null), null);
  assert.ok(c.normalizeLoop({ a: 0, b: 21600 }));
});

test("normalizeDB keeps valid loop on its video, drops invalid", () => {
  const c = setup();
  const db = c.normalizeDB({ categories: [], tricks: [{ id: "t1", name: { zh: "x" }, media: [
    { id: "m1", type: "video", url: "https://youtu.be/abc", loop: { a: 1, b: 2 } },
    { id: "m2", type: "video", url: "https://youtu.be/def", loop: { a: 3, b: 2 } },
    { id: "m3", type: "video", url: "https://youtu.be/ghi" }] }] });
  const m = db.tricks[0].media;
  assert.deepStrictEqual({ ...m[0].loop }, { a: 1, b: 2 });
  assert.strictEqual("loop" in m[1], false);
  assert.strictEqual("loop" in m[2], false);
});

test("formatLoopTime / range", () => {
  const c = setup();
  assert.strictEqual(c.formatLoopTime(12.3), "0:12.3");
  assert.strictEqual(c.formatLoopTime(75.04), "1:15.0");
  assert.strictEqual(c.formatLoopTime(3725.5), "1:02:05.5");
  assert.strictEqual(c.formatLoopRange({ a: 12.3, b: 15.8 }), "0:12.3 – 0:15.8");
});

test("shouldLoopBack at or after B", () => {
  const c = setup();
  assert.strictEqual(c.shouldLoopBack(15.7, 12, 15.8), false);
  assert.strictEqual(c.shouldLoopBack(15.8, 12, 15.8), true);
  assert.strictEqual(c.shouldLoopBack(20, 12, 15.8), true);
});

test("loopSetPoint drops the other end when range inverts", () => {
  const c = setup();
  let d = c.loopSetPoint(null, "a", 5.04);
  assert.deepStrictEqual({ ...d }, { a: 5, b: null });
  d = c.loopSetPoint(d, "b", 9);
  assert.deepStrictEqual({ ...d }, { a: 5, b: 9 });
  d = c.loopSetPoint(d, "a", 10);
  assert.deepStrictEqual({ ...d }, { a: 10, b: null });
  d = c.loopSetPoint({ a: 5, b: 9 }, "b", 3);
  assert.deepStrictEqual({ ...d }, { a: null, b: 3 });
});

test("setItemLoop stores / clears; changing the url clears the loop", () => {
  const c = setup();
  const it = { id: "m1", type: "video", url: "https://youtu.be/abc" };
  c.setItemLoop(it, { a: 1, b: 2 });
  assert.deepStrictEqual({ ...it.loop }, { a: 1, b: 2 });
  c.setItemLoop(it, { a: 2, b: 1 });
  assert.strictEqual("loop" in it, false);
});

test("videoLinkKind: only YouTube and Instagram reels/posts", () => {
  const c = setup();
  const yt = ["https://www.youtube.com/watch?v=x", "https://m.youtube.com/watch?v=x", "https://youtu.be/x", "https://www.youtube.com/shorts/x"];
  const ig = ["https://www.instagram.com/reel/x/", "https://instagram.com/reels/x", "https://www.instagram.com/p/x/", "https://instagr.am/p/x"];
  yt.forEach((u) => assert.strictEqual(c.videoLinkKind(u), "youtube", u));
  ig.forEach((u) => assert.strictEqual(c.videoLinkKind(u), "instagram", u));
  ["https://www.tiktok.com/@a/video/1", "https://x.com/a/status/1", "https://www.facebook.com/x", "https://vimeo.com/1", "https://evil.com/youtube.com",
    "https://youtube.com.evil.io/watch?v=x", "https://www.youtube.com/", "https://www.instagram.com/someuser/", "javascript:alert(1)", "nope", ""]
    .forEach((u) => assert.strictEqual(c.videoLinkKind(u), "", u));
});

test("instagramEmbedUrl", () => {
  const c = setup();
  assert.strictEqual(c.instagramEmbedUrl("https://www.instagram.com/reel/AbC/?igsh=1"), "https://www.instagram.com/reel/AbC/embed");
  assert.strictEqual(c.instagramEmbedUrl("https://instagram.com/reels/AbC"), "https://www.instagram.com/reel/AbC/embed");
  assert.strictEqual(c.instagramEmbedUrl("https://www.instagram.com/p/AbC/"), "https://www.instagram.com/p/AbC/embed");
  assert.strictEqual(c.instagramEmbedUrl("https://youtu.be/x"), "");
});

test("YouTube-first ordering keeps loops with their videos; legacy links stay editable but not addable", () => {
  const c = setup();
  const tr = { id: "a", media: [{ id: "m0", type: "video", url: "https://www.tiktok.com/@a/video/1", title: "" }] };
  assert.strictEqual(c.setDrawerVideoUrl(tr, null, "https://www.instagram.com/reel/x/"), "ok");
  assert.strictEqual(c.setDrawerVideoUrl(tr, null, "https://youtu.be/y"), "ok");
  assert.deepStrictEqual([...tr.media.map((m) => c.videoSourceOf(m.url))], ["youtube", "tiktok", "instagram"]);
  tr.media[0].loop = { a: 1, b: 2 };
  assert.strictEqual(c.setDrawerVideoUrl(tr, null, "https://youtu.be/z"), "full");
  tr.media.pop();
  assert.strictEqual(c.setDrawerVideoUrl(tr, null, "https://youtu.be/z"), "ok");
  assert.strictEqual(tr.media[0].url, "https://youtu.be/y");
  assert.deepStrictEqual({ ...tr.media[0].loop }, { a: 1, b: 2 });
  assert.strictEqual(c.setDrawerVideoUrl(tr, "m0", "https://www.tiktok.com/@b/video/2"), "invalid");
  assert.strictEqual(c.setDrawerVideoUrl(tr, "m0", "https://www.tiktok.com/@a/video/1"), "ok");
  // changing the url drops the old loop
  c.setDrawerVideoUrl(tr, tr.media[0].id, "https://youtu.be/new");
  assert.strictEqual("loop" in tr.media[0], false);
});
