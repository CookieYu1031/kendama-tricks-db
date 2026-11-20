"use strict";
const test = require("node:test");
const assert = require("node:assert");
const { load } = require("./_load");

function setup(){
  let seq = 0;
  const ctx = load(
    ["js/01-data-model.js", "js/02-constants-colors-icons.js", "js/04-state.js", "js/05-data-helpers.js", "js/20-browse-order.js"],
    { localize: (n) => n && n.zh, nextId: (taken) => { let id; do { id = "id" + (++seq); } while(taken && taken(id)); return id; } }
  );
  return ctx;
}
function mk(ctx, cats, tricks, infos){
  ctx.db = ctx.normalizeDB({ categories: cats || [], tricks: tricks || [], infos: infos || [] });
  ctx.invalidateDbIndex();
}
const plain = (x) => JSON.parse(JSON.stringify(x));

test("rail order: t00 t01 t02 divider fav customs", () => {
  const ctx = setup();
  mk(ctx);
  ctx.createSpace({ name: { zh: "A" } });
  ctx.createSpace({ name: { zh: "B" } });
  const ids = ctx.railLayout(ctx.db.spaces).map((e) => (e === "divider" ? "|" : e.id));
  assert.strictEqual(ids.slice(0, 5).join(","), "t00,t01,t02,|,fav");
  assert.strictEqual(ids.length, 7);
});

test("add buttons: level limits", () => {
  const ctx = setup();
  mk(ctx, [
    { id: "c1", parentId: null, spaceId: "t00" },
    { id: "c2", parentId: "c1", spaceId: "t00" },
    { id: "c3", parentId: "c2", spaceId: "t00" }
  ]);
  const a = ctx.allowedAddButtons("c2", "t00", true);
  assert.deepStrictEqual(plain([a.folder, a.trick, a.info]), [true, true, true]);
  const b = ctx.allowedAddButtons("c3", "t00", true); // level 3 parent: folder would be level 4
  assert.deepStrictEqual(plain([b.folder, b.trick, b.info]), [false, true, true]);
});

test("add buttons: locked table, favorites", () => {
  const ctx = setup();
  mk(ctx);
  const u = ctx.allowedAddButtons(null, "t00", false);
  assert.deepStrictEqual(plain([u.folder, u.trick, u.info, u.customTrick]), [false, true, false, true]);
  const admin = ctx.allowedAddButtons(null, "t00", true);
  assert.deepStrictEqual(plain([admin.folder, admin.trick, admin.info, admin.customTrick]), [true, true, true, false]);
  const favRoot = ctx.allowedAddButtons(null, "fav", false);
  assert.strictEqual(favRoot.trick, false);
  assert.strictEqual(ctx.allowedAddButtons("fav-starred", "fav", false).trick, false);
  const fc = ctx.allowedAddButtons("fav-custom", "fav", false);
  assert.deepStrictEqual(plain([fc.trick, fc.customTrick]), [true, true]);
});

test("canModifyItem: official vs custom vs virtual", () => {
  const ctx = setup();
  mk(ctx, [{ id: "c1", parentId: null, spaceId: "t00" }, { id: "u1", parentId: null, spaceId: "fav" }],
    [{ id: "t1", categoryIds: ["t00"] }, { id: "t2", categoryIds: ["t00"], custom: true }]);
  const tr = (id) => ({ type: "trick", ref: ctx.getTrick(id) });
  assert.strictEqual(ctx.canModifyItem(tr("t1"), null, false), false);
  assert.strictEqual(ctx.canModifyItem(tr("t1"), null, true), true);
  assert.strictEqual(ctx.canModifyItem(tr("t2"), null, false), true);
  assert.strictEqual(ctx.canModifyItem({ type: "category", ref: ctx.getCategory("c1") }, null, false), false);
  assert.strictEqual(ctx.canModifyItem({ type: "category", ref: ctx.getCategory("u1") }, null, false), true);
  assert.strictEqual(ctx.canModifyItem({ type: "category", ref: ctx.getCategory("fav-custom") }, null, true), false);
  assert.strictEqual(ctx.canModifyItem(tr("t2"), "fav-starred", true), false);
});

test("subtreeFits blocks moving a deep folder", () => {
  const ctx = setup();
  mk(ctx, [
    { id: "a", parentId: null, spaceId: "t00" }, { id: "b", parentId: "a", spaceId: "t00" },
    { id: "x", parentId: null, spaceId: "t00" }, { id: "y", parentId: "x", spaceId: "t00" }
  ]);
  assert.strictEqual(ctx.subtreeFits("x", "category", 1), true);
  assert.strictEqual(ctx.subtreeFits("x", "category", 3), false); // x(3) + y(4) folder
  assert.strictEqual(ctx.subtreeFits("y", "category", 3), true);
});
