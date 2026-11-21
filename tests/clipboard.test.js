// Clipboard (js/25-browse-clipboard.js): key mapping, paste planning, deep copy, apply.
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const { load } = require("./_load");

function setup(){
  const ctx = load(["js/01-data-model.js", "js/02-constants-colors-icons.js", "js/03-i18n.js", "js/04-state.js", "js/05-data-helpers.js",
    "js/06-icons-svg.js", "js/07-id.js", "js/09-names.js", "js/20-browse-order.js", "js/22-browse-drag.js", "js/25-browse-clipboard.js"]);
  ctx.saveDB = () => {};
  let seq = 0;
  ctx.newItemId = () => "n" + (++seq);
  const nm = (z) => ({ zh: z, jp: "", en: "" });
  ctx.db = ctx.normalizeDB({
    categories: [
      { id: "c1", parentId: null, spaceId: "t00", name: nm("c1"), order: 0 },
      { id: "c2", parentId: "c1", spaceId: "t00", name: nm("c2"), order: 0 },
      { id: "c3", parentId: "c2", spaceId: "t00", name: nm("c3"), order: 0 },
      { id: "e1", parentId: null, spaceId: "t00", name: nm("empty"), order: 1 }
    ],
    tricks: [
      { id: "a000000", name: nm("a"), categoryIds: ["c1"] },
      { id: "b000000", name: nm("b"), categoryIds: ["c2"] }
    ],
    infos: [{ id: "i000000", parentId: "c1", spaceId: "t00", title: nm("inf"), content: "x", order: 0, icon: "", color: "default" }],
    tags: []
  });
  ctx.getSpace("t00").locked = false;
  ctx.invalidateDbIndex();
  ctx.state.activeSpace = "t00";
  return ctx;
}
const env = { admin: false, activeSpace: "t00" };
const clip = (mode, type, id, src) => ({ mode, type, id, srcParent: src === undefined ? null : src, srcSpace: "t00" });

test("clipKeyAction: needs edit mode, ctrl/meta, no field/modal/text selection", () => {
  const c = setup();
  const ctx = { editMode: true, guest: false, inField: false, modalOpen: false, hasTextSelection: false };
  assert.strictEqual(c.clipKeyAction({ key: "c", ctrlKey: true }, ctx), "copy");
  assert.strictEqual(c.clipKeyAction({ key: "X", metaKey: true }, ctx), "cut");
  assert.strictEqual(c.clipKeyAction({ key: "v", ctrlKey: true }, ctx), "paste");
  assert.strictEqual(c.clipKeyAction({ key: "c" }, ctx), null);
  assert.strictEqual(c.clipKeyAction({ key: "c", ctrlKey: true, shiftKey: true }, ctx), null);
  assert.strictEqual(c.clipKeyAction({ key: "c", ctrlKey: true }, Object.assign({}, ctx, { editMode: false })), null);
  assert.strictEqual(c.clipKeyAction({ key: "c", ctrlKey: true }, Object.assign({}, ctx, { inField: true })), null);
  assert.strictEqual(c.clipKeyAction({ key: "c", ctrlKey: true }, Object.assign({}, ctx, { modalOpen: true })), null);
  assert.strictEqual(c.clipKeyAction({ key: "c", ctrlKey: true }, Object.assign({}, ctx, { hasTextSelection: true })), null);
  assert.strictEqual(c.clipKeyAction({ key: "v", ctrlKey: true }, Object.assign({}, ctx, { hasTextSelection: true })), "paste");
});

test("plan: trick copy = reference; already there -> clipAlready", () => {
  const c = setup();
  const p = c.clipPlanPaste(clip("copy", "trick", "a000000", "c1"), "e1", env);
  assert.deepStrictEqual({ ok: p.ok, op: p.op }, { ok: true, op: "ref" });
  const dup = c.clipPlanPaste(clip("copy", "trick", "a000000", "c1"), "c1", env);
  assert.deepStrictEqual({ ok: dup.ok, err: dup.err }, { ok: false, err: "clipAlready" });
});

test("apply: trick copy adds placement, same id, no new trick; cut moves it", () => {
  const c = setup();
  let k = clip("copy", "trick", "a000000", "c1");
  let p = c.clipPlanPaste(k, "e1", env);
  c.clipApplyPaste(k, "e1", p, env);
  assert.deepStrictEqual(Array.from(c.getTrick("a000000").categoryIds).sort(), ["c1", "e1"]);
  assert.strictEqual(c.db.tricks.length, 2);
  k = clip("cut", "trick", "b000000", "c2");
  p = c.clipPlanPaste(k, "e1", env);
  assert.strictEqual(p.op, "move");
  c.clipApplyPaste(k, "e1", p, env);
  assert.deepStrictEqual(Array.from(c.getTrick("b000000").categoryIds), ["e1"]);
});

test("trick cut to table root uses table id as placement", () => {
  const c = setup();
  const k = clip("cut", "trick", "a000000", "c1");
  const p = c.clipPlanPaste(k, null, env);
  c.clipApplyPaste(k, null, p, env);
  assert.deepStrictEqual(Array.from(c.getTrick("a000000").categoryIds), ["t00"]);
});

test("cut to same place -> clipSame", () => {
  const c = setup();
  const p = c.clipPlanPaste(clip("cut", "trick", "a000000", "c1"), "c1", env);
  assert.strictEqual(p.err, "clipSame");
});

test("folder deep copy: new ids, infos copied, tricks become references", () => {
  const c = setup();
  const k = clip("copy", "category", "c1", null);
  const p = c.clipPlanPaste(k, "e1", env);
  // c1 subtree is 3 deep (c1>c2>c3); under e1 (level 1) it would reach level 4 -> too deep
  assert.strictEqual(p.ok, false);
  assert.strictEqual(p.err, "clipNoFit");
  const k2 = clip("copy", "category", "c2", "c1");
  const p2 = c.clipPlanPaste(k2, "e1", env);
  assert.strictEqual(p2.ok, true);
  const newId = c.clipApplyPaste(k2, "e1", p2, env);
  const copy = c.getCategory(newId);
  assert.strictEqual(copy.parentId, "e1");
  assert.notStrictEqual(newId, "c2");
  assert.strictEqual(c.getChildren(newId).length, 1);
  assert.notStrictEqual(c.getChildren(newId)[0].id, "c3");
  assert.deepStrictEqual(Array.from(c.getTrick("b000000").categoryIds).sort(), ["c2", newId].sort());
  assert.strictEqual(c.db.tricks.length, 2);
  assert.strictEqual(c.getCategory("c2").parentId, "c1"); // original untouched
});

test("clipDeepCopyFolder is pure and remaps every id", () => {
  const c = setup();
  let n = 0;
  const before = c.db.categories.length;
  const out = c.clipDeepCopyFolder("c1", null, "t00", () => "z" + (++n));
  assert.strictEqual(c.db.categories.length, before);
  assert.deepStrictEqual(Array.from(out.cats.map((x) => x.id)), ["z1", "z3", "z4"]);
  assert.strictEqual(out.infos.length, 1);
  assert.strictEqual(out.infos[0].parentId, "z1");
  assert.deepStrictEqual(Array.from(out.refs.map((r) => r.trickId + ">" + r.containerId)).sort(), ["a000000>z1", "b000000>z3"]);
  assert.strictEqual(out.cats[1].parentId, "z1");
});

test("info copy = new info; info cut = move", () => {
  const c = setup();
  let k = clip("copy", "info", "i000000", "c1");
  let p = c.clipPlanPaste(k, "e1", env);
  assert.strictEqual(p.op, "copyInfo");
  const nid = c.clipApplyPaste(k, "e1", p, env);
  assert.strictEqual(c.getInfo(nid).parentId, "e1");
  assert.strictEqual(c.getInfo("i000000").parentId, "c1");
  k = clip("cut", "info", "i000000", "c1");
  p = c.clipPlanPaste(k, "c2", env);
  c.clipApplyPaste(k, "c2", p, env);
  assert.strictEqual(c.getInfo("i000000").parentId, "c2");
});

test("folder cut: cannot go into itself / descendant; into another folder works", () => {
  const c = setup();
  assert.strictEqual(c.clipPlanPaste(clip("cut", "category", "c1", null), "c1", env).err, "clipNoFit");
  assert.strictEqual(c.clipPlanPaste(clip("cut", "category", "c1", null), "c3", env).err, "clipNoFit");
  const k = clip("cut", "category", "c3", "c2");
  const p = c.clipPlanPaste(k, "e1", env);
  assert.strictEqual(p.op, "move");
  c.clipApplyPaste(k, "e1", p, env);
  assert.strictEqual(c.getCategory("c3").parentId, "e1");
});

test("info cannot be a paste target; folder at layer 4 refused; favorites root refused", () => {
  const c = setup();
  assert.strictEqual(c.clipPlanPaste(clip("copy", "trick", "a000000", "c1"), "i000000", env).ok, false);
  assert.strictEqual(c.clipPlanPaste(clip("copy", "category", "e1", null), "c3", env).ok, false); // c3 is level 3 -> folder would be 4
  assert.strictEqual(c.clipPlanPaste(clip("copy", "trick", "a000000", "c1"), null, { admin: false, activeSpace: "fav" }).ok, false);
});

test("permissions: locked table refuses non-admin (except custom tricks); guest refused", () => {
  const c = setup();
  c.getSpace("t00").locked = true;
  assert.strictEqual(c.clipPlanPaste(clip("copy", "trick", "a000000", "c1"), "e1", env).err, "clipNoPerm");
  assert.strictEqual(c.clipPlanPaste(clip("copy", "category", "c2", "c1"), "e1", env).err, "clipNoPerm");
  assert.strictEqual(c.clipPlanPaste(clip("copy", "trick", "a000000", "c1"), "e1", { admin: true, activeSpace: "t00" }).ok, true);
  c.getTrick("a000000").custom = true;
  assert.strictEqual(c.clipPlanPaste(clip("copy", "trick", "a000000", "c1"), "e1", env).ok, true);
  c.getSpace("t00").locked = false;
  c.isLoggedIn = () => false;
  assert.strictEqual(c.clipPlanPaste(clip("copy", "trick", "a000000", "c1"), "e1", env).err, "clipNoPerm");
});

test("missing source -> clipGone; paste target choice", () => {
  const c = setup();
  assert.strictEqual(c.clipPlanPaste(clip("copy", "trick", "nope", "c1"), "e1", env).err, "clipGone");
  assert.strictEqual(c.clipTargetParent({ type: "category", id: "c2", parentId: "c1" }), "c2");
  assert.strictEqual(c.clipTargetParent({ type: "trick", id: "a000000", parentId: "c1" }), "c1");
  assert.strictEqual(c.clipTargetParent({ type: null, id: null, parentId: null }), null);
});

test("image icon data URLs: only png/webp/jpeg base64, size capped", () => {
  const c = setup();
  assert.ok(c.isImageIcon("img:data:image/webp;base64,AAAA"));
  assert.ok(c.isImageIcon("img:data:image/png;base64,iVBOR+/=="));
  assert.ok(!c.isImageIcon("img:data:image/svg+xml;base64,AAAA"));
  assert.ok(!c.isImageIcon("img:data:text/html;base64,AAAA"));
  assert.ok(!c.isImageIcon('img:data:image/png;base64,AA" onerror="x'));
  assert.ok(!c.isImageIcon("img:data:image/png;base64," + "A".repeat(70000)));
  assert.strictEqual(c.imageIconSrc("img:data:image/webp;base64,AAAA"), "data:image/webp;base64,AAAA");
});

test("external trick (mailbox 複製招式): plan newTrick, paste creates a fresh trick once", () => {
  const c = setup();
  c.invalidateDbIndex();
  const data = { name: { zh: "新招", jp: "", en: "New" }, urls: ["https://youtu.be/a", "https://youtu.be/b"], grip: "ken", parts: ["sara"], tagIds: ["gone"], note: "n" };
  const k = c.clipSetExternalTrick(data);
  assert.strictEqual(c.clipboardItem, k);
  assert.strictEqual(k.type, "extTrick");
  const p = c.clipPlanPaste(k, "e1", env);
  assert.deepStrictEqual({ ok: p.ok, op: p.op }, { ok: true, op: "newTrick" });
  const before = c.db.tricks.length;
  c.clipApplyPaste(k, "e1", p, env);
  assert.strictEqual(c.db.tricks.length, before + 1);
  const tr = c.db.tricks[c.db.tricks.length - 1];
  assert.strictEqual(tr.name.zh, "新招");
  assert.strictEqual(tr.media.length, 2);
  assert.strictEqual(tr.grip, "ken");
  assert.deepStrictEqual(Array.from(tr.categoryIds), ["e1"]);
  assert.strictEqual(tr.tagIds.length, 0); // unknown tag id dropped
  assert.strictEqual(tr.landed, false);
  // guest cannot paste
  assert.strictEqual(c.clipPlanPaste({ type: "extTrick" }, "e1", env).ok, false);
});
