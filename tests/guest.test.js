"use strict";
// D8: guests (not signed in) see only 00/01/02, read-only.
const test = require("node:test");
const assert = require("node:assert");
const { load } = require("./_load");

function setup(loggedIn){
  let seq = 0;
  const ctx = load(
    ["js/01-data-model.js", "js/02-constants-colors-icons.js", "js/04-state.js", "js/05-data-helpers.js", "js/20-browse-order.js"],
    {
      localize: (n) => n && n.zh,
      nextId: (taken) => { let id; do { id = "id" + (++seq); } while(taken && taken(id)); return id; },
      isAdminAccount: () => false
    }
  );
  ctx.__loggedIn = loggedIn;
  ctx.isLoggedIn = () => ctx.__loggedIn;
  ctx.db = ctx.normalizeDB({
    categories: [{ id: "c1", parentId: null, spaceId: "t00" }, { id: "f1", parentId: null, spaceId: "fav" }],
    tricks: [{ id: "k1", categoryIds: ["c1"], custom: true }, { id: "k2", categoryIds: ["f1"] }]
  });
  ctx.invalidateDbIndex();
  return ctx;
}
const ids = (ctx) => ctx.railLayout(ctx.db.spaces).map((e) => (e === "divider" ? "|" : e.id));

test("guest rail: only t00 t01 t02, no divider/fav/custom", () => {
  const ctx = setup(false);
  ctx.__loggedIn = true; ctx.createSpace({ name: { zh: "A" } }); ctx.__loggedIn = false;
  assert.strictEqual(ids(ctx).join(","), "t00,t01,t02");
  assert.ok(ctx.isGuestVisibleSpace("t01"));
  assert.ok(!ctx.isGuestVisibleSpace("fav"));
});

test("signed-in rail unchanged", () => {
  const ctx = setup(true);
  assert.strictEqual(ids(ctx).slice(0, 5).join(","), "t00,t01,t02,|,fav");
});

test("guest: no table edit, no custom trick, no add buttons, no item modify/drag", () => {
  const ctx = setup(false);
  assert.strictEqual(ctx.isGuest(), true);
  assert.strictEqual(ctx.canEditTable("fav"), false);
  assert.strictEqual(ctx.canAddCustomTrick("t00"), false);
  const a = ctx.allowedAddButtons("c1", "t00", false);
  assert.deepStrictEqual([a.folder, a.trick, a.info, a.customTrick], [false, false, false, false]);
  const k1 = ctx.db.tricks.find((t) => t.id === "k1");
  assert.strictEqual(ctx.canModifyItem({ type: "trick", ref: k1 }, "c1", false), false);
  assert.strictEqual(ctx.canDragItem({ type: "trick", ref: k1 }, "c1", false), false);
});

test("signed-in user keeps custom-trick rights in locked table", () => {
  const ctx = setup(true);
  assert.strictEqual(ctx.isGuest(), false);
  assert.strictEqual(ctx.canEditTable("fav"), true);
  assert.strictEqual(ctx.canAddCustomTrick("t00"), true);
  const k1 = ctx.db.tricks.find((t) => t.id === "k1");
  assert.strictEqual(ctx.canModifyItem({ type: "trick", ref: k1 }, "c1", false), true);
  assert.strictEqual(ctx.allowedAddButtons("c1", "t00", false).customTrick, true);
});

test("no isLoggedIn (unit tests w/o 50) = not guest", () => {
  const ctx = setup(true);
  delete ctx.isLoggedIn;
  assert.strictEqual(ctx.isGuest(), false);
});
