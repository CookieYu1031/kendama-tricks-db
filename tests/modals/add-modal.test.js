// Unified add modal (js/47-modal-add.js): allowed types, link-by-id validation, record creation.
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const { load } = require("../_load");

function setup(){
  const ctx = load(["js/01-data-model.js", "js/01-data-storage.js", "js/02-constants-colors-icons.js", "js/03-i18n.js", "js/04-state.js", "js/05-data-helpers.js", "js/05-data-ops.js", "js/05-data-util.js", "js/05-data-prefix.js",
    "js/07-id.js", "js/09-names.js", "js/20-browse-order.js", "js/30-drawer-logic.js", "js/31-drawer-sections.js", "js/32-trick-drawer.js", "js/47-modal-add.js"]);
  ctx.saveDB = () => {};
  const nm = (z) => ({ zh: z, jp: "", en: "" });
  ctx.db = ctx.normalizeDB({
    categories: [
      { id: "c1", parentId: null, spaceId: "t00", name: nm("c1"), order: 0 },
      { id: "c2", parentId: "c1", spaceId: "t00", name: nm("c2"), order: 0 },
      { id: "c3", parentId: "c2", spaceId: "t00", name: nm("c3"), order: 0 }
    ],
    tricks: [
      { id: "a000000", name: nm("a"), categoryIds: ["c1"] },
      { id: "v000000", name: nm("variant"), categoryIds: ["a000000"] },
      { id: "d000000", name: nm("deep"), categoryIds: ["c3"] }
    ],
    infos: [], tags: []
  });
  ctx.invalidateDbIndex();
  ctx.state.activeSpace = "t00";
  return ctx;
}
const lock = (ctx, v) => { ctx.getSpace("t00").locked = v; };

test("addModalTypes: default trick, folder/info always offered in unlocked table", () => {
  const c = setup(); lock(c, false);
  const r = c.addModalTypes("c1", "t00", false);
  assert.strictEqual(r.def, "trick");
  assert.ok(r.folder && r.trick && r.info);
  assert.strictEqual(r.customTrick, false);
});

test("addModalTypes: locked table non-admin -> custom trick only; admin -> all", () => {
  const c = setup(); lock(c, true);
  const u = c.addModalTypes("c1", "t00", false);
  assert.deepStrictEqual([u.folder, u.trick, u.info, u.customTrick, u.def], [false, true, false, true, "trick"]);
  const a = c.addModalTypes("c1", "t00", true);
  assert.deepStrictEqual([a.folder, a.trick, a.info, a.customTrick], [true, true, true, false]);
});

test("addModalTypes: level limits (level-3 folder -> no folder; level 4 -> nothing but none)", () => {
  const c = setup(); lock(c, false);
  const r = c.addModalTypes("c3", "t00", false); // c3 is level 3 -> children are level 4
  assert.deepStrictEqual([r.folder, r.trick, r.info, r.def], [false, true, true, "trick"]);
  const r2 = c.addModalTypes("d000000", "t00", false); // trick at level 4 -> no children
  assert.strictEqual(r2.def, null);
});

test("addModalTypes: default falls to folder when trick not allowed", () => {
  const c = setup(); lock(c, false);
  c.getSpace("t00").locked = false;
  assert.strictEqual(c.addModalTypes("d000000", "t00", false).def, null);
  // starred virtual folder offers nothing
  assert.strictEqual(c.addModalTypes(c.FAV_STARRED_ID, "fav", false).def, null);
});

test("validateLinkTrick: missing / duplicate / cycle / level / success", () => {
  const c = setup(); lock(c, false);
  assert.strictEqual(c.validateLinkTrick("zzzzzzz", "c1", "t00", false), "addErrLinkMissing");
  assert.strictEqual(c.validateLinkTrick("a000000", "c1", "t00", false), "addErrLinkDup");
  assert.strictEqual(c.validateLinkTrick("a000000", "a000000", "t00", false), "addErrLinkCycle");
  assert.strictEqual(c.validateLinkTrick("a000000", "v000000", "t00", false), "addErrLinkCycle");
  // a000000 has a variant (level+1); under c3 (level 3) it would be level 4 with a level-5 child
  assert.strictEqual(c.validateLinkTrick("a000000", "c3", "t00", false), "addErrLinkLevel");
  assert.strictEqual(c.validateLinkTrick("d000000", "c2", "t00", false), "");
  assert.strictEqual(c.validateLinkTrick("a000000", "c2", "t00", false), "");
});

test("validateLinkTrick: root column uses the space id; locked non-admin / fav blocked", () => {
  const c = setup(); lock(c, false);
  assert.strictEqual(c.validateLinkTrick("a000000", null, "t00", false), "");
  c.db.tricks[0].categoryIds.push("t00");
  assert.strictEqual(c.validateLinkTrick("a000000", null, "t00", false), "addErrLinkDup");
  lock(c, true);
  assert.strictEqual(c.validateLinkTrick("d000000", "c2", "t00", false), "addErrLinkPerm");
  assert.strictEqual(c.validateLinkTrick("d000000", "c2", "t00", true), "");
  assert.strictEqual(c.validateLinkTrick("d000000", null, "fav", true), "addErrLinkPerm");
});

test("linkTrickInto adds the parent to categoryIds (multi-reference)", () => {
  const c = setup(); lock(c, false);
  c.linkTrickInto("d000000", "c2", "t00");
  assert.deepStrictEqual(Array.from(c.getTrick("d000000").categoryIds), ["c3", "c2"]);
  c.linkTrickInto("d000000", null, "t00");
  assert.ok(c.getTrick("d000000").categoryIds.indexOf("t00") !== -1);
});

test("createFolderRecord / createInfoRecord", () => {
  const c = setup(); lock(c, false);
  const f = c.createFolderRecord("c1", "t00", { zh: " 新 ", icon: "🔥", color: "red" });
  assert.strictEqual(f.parentId, "c1");
  assert.strictEqual(f.name.zh, "新");
  assert.strictEqual(f.spaceId, "t00");
  assert.strictEqual(f.icon, "🔥");
  assert.ok(c.getCategory(f.id));
  const root = c.createFolderRecord(null, "t00", { en: "Root" });
  assert.strictEqual(root.parentId, null);
  const i = c.createInfoRecord("c1", "t00", { zh: "資訊", content: "body" });
  assert.strictEqual(i.parentId, "c1");
  assert.strictEqual(i.content, "body");
  assert.ok(c.getInfo(i.id));
  assert.strictEqual(i.icon, "");
  assert.strictEqual(i.color, "default");
  assert.strictEqual(i.prefix, undefined);
  assert.strictEqual(i.image, undefined);
  assert.strictEqual(i.links, undefined);
});

test("createInfoRecord: icon, color, prefix and three titles", () => {
  const c = setup(); lock(c, false);
  const i = c.createInfoRecord("c1", "t00", { zh: " 說明 ", jp: "せつめい", en: "Guide", content: "x", icon: "📘", color: "blue", prefix: " 1-2 " });
  assert.deepStrictEqual(JSON.parse(JSON.stringify(i.title)), { zh: "說明", jp: "せつめい", en: "Guide" });
  assert.strictEqual(i.icon, "📘");
  assert.strictEqual(i.color, "blue");
  assert.strictEqual(i.prefix, "1-2");
  // survives a normalize round trip unchanged (same key order -> equal JSON)
  const again = c.normalizeDB({ categories: [], tricks: [], infos: [JSON.parse(JSON.stringify(i))] }).infos[0];
  assert.strictEqual(JSON.stringify(again), JSON.stringify(i));
  // blank prefix absent
  const j = c.createInfoRecord(null, "t00", { zh: "b", prefix: "  " });
  assert.strictEqual(j.prefix, undefined);
  assert.strictEqual(j.parentId, null);
});

test("createTrickRecord: fields, video, custom flag, root placement", () => {
  const c = setup(); lock(c, false);
  const tr = c.createTrickRecord("c1", "t00", { jp: "技", url: "https://youtu.be/x", grip: "ken", parts: ["sara", "ana", "bogus"], tagIds: ["g"], note: "n" }, true);
  assert.strictEqual(tr.name.jp, "技");
  assert.strictEqual(tr.custom, true);
  assert.deepStrictEqual(Array.from(tr.categoryIds), ["c1"]);
  assert.strictEqual(tr.media.length, 1);
  assert.strictEqual(tr.media[0].url, "https://youtu.be/x");
  assert.strictEqual(tr.grip, "ken");
  assert.deepStrictEqual(Array.from(tr.parts), ["sara", "ana"]);
  assert.strictEqual(tr.note, "n");
  assert.strictEqual(tr.officialNote, undefined);
  assert.ok(c.getTrick(tr.id));
  const plainTr = c.createTrickRecord(null, "t00", { zh: "根" }, false);
  assert.strictEqual(plainTr.custom, false);
  assert.deepStrictEqual(Array.from(plainTr.categoryIds), ["t00"]);
  assert.strictEqual(plainTr.media.length, 0);
});

test("parseAtId: @ + 7 chars, spaces around allowed, else null", () => {
  const c = setup();
  assert.strictEqual(c.parseAtId("@0qbk3xY"), "0qbk3xY");
  assert.strictEqual(c.parseAtId("  @0qbk3xY  "), "0qbk3xY");
  assert.strictEqual(c.parseAtId("0qbk3xY"), null);
  assert.strictEqual(c.parseAtId("@0qbk3x"), null);
  assert.strictEqual(c.parseAtId("@0qbk3xYZ"), null);
  assert.strictEqual(c.parseAtId("abc @0qbk3xY"), null);
  assert.strictEqual(c.parseAtId(""), null);
  assert.strictEqual(c.parseAtId(null), null);
});

test("findLinkTarget: any name field (array or object)", () => {
  const c = setup();
  assert.strictEqual(c.findLinkTarget(["", "x", "@a000000"]), "a000000");
  assert.strictEqual(c.findLinkTarget({ zh: "名", jp: "@d000000", en: "" }), "d000000");
  assert.strictEqual(c.findLinkTarget(["a", "b", ""]), null);
  assert.strictEqual(c.findLinkTarget(null), null);
});

test("link by @id: validate then link (save path logic)", () => {
  const c = setup(); lock(c, false);
  const id = c.findLinkTarget(["", "@d000000", ""]);
  assert.strictEqual(c.validateLinkTrick(id, "c2", "t00", false), "");
  c.linkTrickInto(id, "c2", "t00");
  assert.deepStrictEqual(Array.from(c.getTrick("d000000").categoryIds), ["c3", "c2"]);
  assert.strictEqual(c.validateLinkTrick(id, "c2", "t00", false), "addErrLinkDup");
  lock(c, true);
  assert.strictEqual(c.validateLinkTrick("a000000", "c2", "t00", false), "addErrLinkPerm");
  assert.strictEqual(c.validateLinkTrick("@x", "c2", "t00", true), "addErrLinkMissing");
});

test("addNameEmpty", () => {
  const c = setup();
  assert.ok(c.addNameEmpty(c.addNameObj({ zh: "  " })));
  assert.ok(!c.addNameEmpty(c.addNameObj({ en: "x" })));
});

test("detectAddName: zh / jp / en / id / mixed / empty", () => {
  const c = setup();
  const d = (s) => JSON.parse(JSON.stringify(c.detectAddName(s)));
  assert.deepStrictEqual(d(""), { kind: "empty" });
  assert.deepStrictEqual(d("   "), { kind: "empty" });
  assert.deepStrictEqual(d("大皿"), { kind: "name", lang: "zh" });
  assert.deepStrictEqual(d("飛機 3 次"), { kind: "name", lang: "zh" });
  assert.deepStrictEqual(d("けん玉"), { kind: "name", lang: "jp" });
  assert.deepStrictEqual(d("トリック"), { kind: "name", lang: "jp" });
  assert.deepStrictEqual(d("Around the World"), { kind: "name", lang: "en" });
  assert.deepStrictEqual(d("Lunar-1, 2!"), { kind: "name", lang: "en" });
  assert.deepStrictEqual(d("Spinner"), { kind: "name", lang: "en" }); // 7 chars but no such trick id
  assert.deepStrictEqual(d("Tricks 大皿"), { kind: "name", lang: "zh" }); // mixed Latin + CJK
  assert.deepStrictEqual(d("Lunar 大皿 かな"), { kind: "name", lang: "jp" }); // kana wins
  assert.deepStrictEqual(d("a000000"), { kind: "link", id: "a000000", explicit: false });
  assert.deepStrictEqual(d(" @d000000 "), { kind: "link", id: "d000000", explicit: true });
  assert.deepStrictEqual(d("@zzzzzzz"), { kind: "link", id: "zzzzzzz", explicit: true });
});

test("createTrickRecord from a detected single name: only that language is filled", () => {
  const c = setup();
  const det = c.detectAddName("けん玉");
  const f = {}; f[det.lang] = "けん玉";
  const rec = c.createTrickRecord("c1", "t00", f, false);
  assert.strictEqual(rec.name.jp, "けん玉");
  assert.strictEqual(rec.name.zh, "");
  assert.strictEqual(rec.name.en, "");
});


test("addTrickLinkTarget: @id in any box; bare id only alone in main box and existing", () => {
  const c = setup();
  assert.strictEqual(c.addTrickLinkTarget("", "@a000000", ""), "a000000");
  assert.strictEqual(c.addTrickLinkTarget("a000000", "", ""), "a000000");
  assert.strictEqual(c.addTrickLinkTarget("a000000", "Ama", ""), null);
  assert.strictEqual(c.addTrickLinkTarget("zzzzzzz", "", ""), null);
  assert.strictEqual(c.addTrickLinkTarget("飛行機", "ひこうき", "Airplane"), null);
});

test("createTrickRecord keeps all three names plus grip and parts", () => {
  const c = setup();
  const rec = c.createTrickRecord("c1", "t00", { zh: "飛行機", jp: "ひこうき", en: "Airplane", grip: c.GRIP_KEYS[0], parts: ["oozara"] }, false);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(rec.name)), { zh: "飛行機", jp: "ひこうき", en: "Airplane" });
  assert.strictEqual(rec.grip, c.GRIP_KEYS[0]);
  assert.ok(Array.isArray(rec.parts));
});


test("prefix: folder, trick and linked placement get their prefix (normalized)", () => {
  const c = setup(); lock(c, false);
  const f = c.createFolderRecord("c1", "t00", { zh: "新", prefix: "  1-2  " });
  assert.strictEqual(c.getCategoryPrefix(f), "1-2");
  assert.strictEqual(c.getCategoryPrefix(c.createFolderRecord("c1", "t00", { zh: "無" })), "");
  const tr = c.createTrickRecord("c2", "t00", { zh: "招", prefix: "A" + "b".repeat(20) }, false);
  assert.strictEqual(c.getTrickPrefix(tr, "c2").length, c.PREFIX_MAX);
  const root = c.createTrickRecord(null, "t00", { zh: "根", prefix: "7" }, false);
  assert.strictEqual(c.getTrickPrefix(root, "t00"), "7");
  assert.strictEqual(c.createTrickRecord("c2", "t00", { zh: "x" }, false).prefixByCategory, undefined);
  c.linkTrickInto("d000000", "c2", "t00", "9");
  assert.strictEqual(c.getTrickPrefix(c.getTrick("d000000"), "c2"), "9");
  assert.strictEqual(c.getTrickPrefix(c.getTrick("d000000"), "c3"), "");
  c.linkTrickInto("a000000", "c2", "t00", "");
  assert.strictEqual(c.getTrick("a000000").prefixByCategory, undefined);
});
