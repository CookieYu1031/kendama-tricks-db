// Unified add modal (js/47-modal-add.js): allowed types, link-by-id validation, record creation.
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const { load } = require("./_load");

function setup(){
  const ctx = load(["js/01-data-model.js", "js/02-constants-colors-icons.js", "js/03-i18n.js", "js/04-state.js", "js/05-data-helpers.js",
    "js/07-id.js", "js/09-names.js", "js/20-browse-order.js", "js/30-trick-drawer.js", "js/47-modal-add.js"]);
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
});

test("createTrickRecord: fields, video, custom flag, root placement", () => {
  const c = setup(); lock(c, false);
  const tr = c.createTrickRecord("c1", "t00", { jp: "技", url: "https://youtu.be/x", grip: "ken", parts: ["sara", "ana", "bogus"], tagIds: ["g"], note: "n", officialNote: "o" }, true);
  assert.strictEqual(tr.name.jp, "技");
  assert.strictEqual(tr.custom, true);
  assert.deepStrictEqual(Array.from(tr.categoryIds), ["c1"]);
  assert.strictEqual(tr.media.length, 1);
  assert.strictEqual(tr.media[0].url, "https://youtu.be/x");
  assert.strictEqual(tr.grip, "ken");
  assert.deepStrictEqual(Array.from(tr.parts), ["sara", "ana"]);
  assert.strictEqual(tr.note, "n");
  assert.strictEqual(tr.officialNote, "o");
  assert.ok(c.getTrick(tr.id));
  const plainTr = c.createTrickRecord(null, "t00", { zh: "根" }, false);
  assert.strictEqual(plainTr.custom, false);
  assert.deepStrictEqual(Array.from(plainTr.categoryIds), ["t00"]);
  assert.strictEqual(plainTr.media.length, 0);
});

test("addNameEmpty", () => {
  const c = setup();
  assert.ok(c.addNameEmpty(c.addNameObj({ zh: "  " })));
  assert.ok(!c.addNameEmpty(c.addNameObj({ en: "x" })));
});
