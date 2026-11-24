// Drawer prefix logic (js/30): which placement a trick's prefix belongs to, and who may edit it.
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const { load } = require("../_load");

function setup(){
  const ctx = load(["js/01-data-model.js", "js/01-data-storage.js", "js/02-constants-colors-icons.js", "js/03-i18n.js", "js/04-state.js",
    "js/05-data-helpers.js", "js/05-data-ops.js", "js/05-data-util.js", "js/05-data-prefix.js", "js/07-id.js", "js/09-names.js", "js/30-drawer-logic.js"]);
  const nm = (z) => ({ zh: z, jp: "", en: "" });
  ctx.db = ctx.normalizeDB({
    categories: [
      { id: "c1", parentId: null, spaceId: "t00", name: nm("c1"), order: 0 },
      { id: "c2", parentId: "c1", spaceId: "t00", name: nm("c2"), order: 0 },
      { id: "f1", parentId: null, spaceId: "fav", name: nm("mine"), order: 0 }
    ],
    tricks: [{ id: "a000000", name: nm("a"), categoryIds: ["c1", "c2"] }, { id: "b000000", name: nm("b"), categoryIds: ["f1"] }],
    infos: [], tags: []
  });
  ctx.invalidateDbIndex();
  ctx.state.activeSpace = "t00"; ctx.state.path = []; ctx.state.detailContainerKey = undefined;
  return ctx;
}

test("resolveDrawerContainer: recorded key wins while it is still a placement", () => {
  const c = setup(), tr = c.getTrick("a000000");
  c.state.detailContainerKey = "c1"; c.state.path = ["c1", "c2"];
  assert.strictEqual(c.resolveDrawerContainer(tr), "c1");
});

test("resolveDrawerContainer: stale recorded key falls back to the deepest path entry", () => {
  const c = setup(), tr = c.getTrick("a000000");
  c.state.detailContainerKey = "gone"; c.state.path = ["c1", "c2"];
  assert.strictEqual(c.resolveDrawerContainer(tr), "c2");
  c.state.detailContainerKey = undefined; c.state.path = ["c1", "zz"];
  assert.strictEqual(c.resolveDrawerContainer(tr), "c1");
});

test("resolveDrawerContainer: active table, then any container in the active table, else null", () => {
  const c = setup(), tr = c.getTrick("a000000");
  tr.categoryIds.push("t00");
  assert.strictEqual(c.resolveDrawerContainer(tr), "t00");
  tr.categoryIds = ["c2", "c1"];
  assert.strictEqual(c.resolveDrawerContainer(tr), "c2");
  c.state.activeSpace = "fav";
  assert.strictEqual(c.resolveDrawerContainer(tr), null);
  assert.strictEqual(c.resolveDrawerContainer(null), null);
});

test("resolveDrawerContainer: virtual favorites lists give null", () => {
  const c = setup(), tr = c.getTrick("a000000");
  c.state.path = ["c1"];
  c.state.detailContainerKey = c.FAV_STARRED_ID;
  assert.strictEqual(c.resolveDrawerContainer(tr), null);
  c.state.detailContainerKey = c.FAV_CUSTOM_ID;
  assert.strictEqual(c.resolveDrawerContainer(tr), null);
});

test("drawerPrefixOnly: needs edit mode, signed in, non-editable trick, unlocked table", () => {
  const c = setup();
  c.getSpace("t00").locked = false; c.getSpace("fav").locked = false;
  assert.strictEqual(c.drawerPrefixOnly("c2", true, false, false), true);
  assert.strictEqual(c.drawerPrefixOnly("c2", false, false, false), false);
  assert.strictEqual(c.drawerPrefixOnly("c2", true, true, false), false);
  assert.strictEqual(c.drawerPrefixOnly("c2", true, false, true), false);
  assert.strictEqual(c.drawerPrefixOnly(null, true, false, false), false);
  c.getSpace("t00").locked = true;
  assert.strictEqual(c.drawerPrefixOnly("c2", true, false, false), false);
  assert.strictEqual(c.drawerPrefixOnly("f1", true, false, false), true);
});
