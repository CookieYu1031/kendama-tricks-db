"use strict";
// v0.14 新手教學: pure logic (js/19-tutorial-logic.js) + wiring checks.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const { load } = require("./_load");

function ctxWith(tricks){
  const spaceOf = { c0: "t00", c1: "t01", c2: "t02", cf: "fav", cx: "t05" };
  return load(["js/19-tutorial-logic.js"], {
    getTrick: (id) => tricks[id],
    containerSpaceId: (cid) => spaceOf[cid] || null
  });
}
const tricks = {
  aaaaaaa: { id: "aaaaaaa", categoryIds: ["c0"], media: [{ type: "video", url: "https://youtu.be/x" }] },
  bbbbbbb: { id: "bbbbbbb", categoryIds: ["cf", "cx"] },
  ccccccc: { id: "ccccccc", categoryIds: ["cf", "c2"] }
};

test("tracks, flag, page count", () => {
  const c = ctxWith(tricks);
  assert.deepStrictEqual(Array.from(c.TUTORIAL_TRACKS), ["kids", "beginner"]);
  assert.ok(c.isTutorialTrack("kids") && c.isTutorialTrack("beginner") && !c.isTutorialTrack("x"));
  assert.strictEqual(c.TUTORIAL_PAGE_COUNT, 10);
  assert.strictEqual(c.TUTORIAL_PUBLIC, false);
});

test("admin gating follows TUTORIAL_PUBLIC", () => {
  const c = ctxWith(tricks);
  assert.ok(!c.tutorialCanOpen(false) && c.tutorialCanOpen(true));
  const open = ctxWith(tricks);
  open.TUTORIAL_PUBLIC = true;
  assert.ok(open.tutorialCanOpen(false));
});

test("normalize: always 10 pages, bad ids dropped, text capped at 1000", () => {
  const c = ctxWith(tricks);
  const pages = c.tutorialNormalizePages([{ trickId: "aaaaaaa", text: { zh: "x".repeat(1500), jp: 5 } }, { trickId: "bad" }, null]);
  assert.strictEqual(pages.length, 10);
  assert.strictEqual(pages[0].trickId, "aaaaaaa");
  assert.strictEqual(pages[0].text.zh.length, 1000);
  assert.strictEqual(pages[0].text.jp, "");
  assert.strictEqual(pages[1].trickId, "");
  assert.strictEqual(c.tutorialNormalizePages(null).length, 10);
  assert.strictEqual(c.tutorialNormalizePages(new Array(15).fill({})).length, 10);
  assert.strictEqual(c.tutorialPayload([]).pages.length, 10);
});

test("parse + public-table check", () => {
  const c = ctxWith(tricks);
  assert.strictEqual(c.tutorialParseTrickId(" @aaaaaaa "), "aaaaaaa");
  assert.strictEqual(c.tutorialParseTrickId("aaaaaaa"), "aaaaaaa");
  assert.strictEqual(c.tutorialParseTrickId(""), "");
  assert.strictEqual(c.tutorialParseTrickId("abc"), null);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(c.tutorialCheckTrick(""))), { ok: true, id: "", error: "" });
  assert.strictEqual(c.tutorialCheckTrick("zz").error, "format");
  assert.strictEqual(c.tutorialCheckTrick("@zzzzzzz").error, "notfound");
  assert.strictEqual(c.tutorialCheckTrick("bbbbbbb").error, "notpublic");
  assert.ok(c.tutorialCheckTrick("aaaaaaa").ok);
  assert.ok(c.tutorialCheckTrick("ccccccc").ok); // one container in t02 is enough
});

test("text fallback: current lang, then zh -> jp -> en", () => {
  const c = ctxWith(tricks);
  const p = { text: { zh: "", jp: "J", en: "E" } };
  assert.strictEqual(c.tutorialPageText(p, "en"), "E");
  assert.strictEqual(c.tutorialPageText(p, "zh"), "J");
  assert.strictEqual(c.tutorialPageText({ text: { zh: "  ", jp: "", en: "E" } }, "jp"), "E");
  assert.strictEqual(c.tutorialPageText(null, "zh"), "");
});

test("first video url", () => {
  const c = ctxWith(tricks);
  assert.strictEqual(c.tutorialFirstVideoUrl(tricks.aaaaaaa), "https://youtu.be/x");
  assert.strictEqual(c.tutorialFirstVideoUrl(tricks.bbbbbbb), "");
});

test("UI file loads, exposes entry points", () => {
  const src = fs.readFileSync("js/19-shell-tutorial.js", "utf8");
  assert.ok(src.includes("function openTutorial") && src.includes("goToTrickLocation") && src.includes('collection("tutorial")'));
  assert.ok(src.includes("isAdminAccount") && src.includes("getEmbedInfo"));
});
