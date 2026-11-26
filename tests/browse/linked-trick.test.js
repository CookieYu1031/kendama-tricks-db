// Official trick linked by @ID into the user's own table (js/20 canPlaceItem): remove / reorder / cut
// that placement, content stays locked (canModifyItem).
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const { load } = require("../_load");

function setup(){
  const ctx = load(["js/01-data-model.js", "js/01-data-storage.js", "js/02-constants-colors-icons.js", "js/03-i18n.js", "js/04-state.js", "js/05-data-helpers.js", "js/05-data-ops.js", "js/05-data-util.js",
    "js/06-icons-svg.js", "js/07-id.js", "js/20-browse-order.js"]);
  const nm = (z) => ({ zh: z, jp: "", en: "" });
  ctx.db = ctx.normalizeDB({
    spaces: [{ id: "t00", code: "00", locked: true, name: nm("00"), order: 0 },
             { id: "u1", code: "0a", locked: false, name: nm("mine"), order: 1 }],
    categories: [{ id: "c1", parentId: null, spaceId: "t00", name: nm("c1"), order: 0 },
                 { id: "m1", parentId: null, spaceId: "u1", name: nm("m1"), order: 0 }],
    tricks: [{ id: "a000000", name: nm("a"), categoryIds: ["c1", "m1", "u1"] }],
    infos: [], tags: []
  });
  ctx.invalidateDbIndex();
  return ctx;
}
const trick = (c) => ({ type: "trick", id: "a000000", ref: c.getTrick("a000000") });

test("linked trick: content locked, placement free in the user's own list", () => {
  const c = setup();
  c.state.activeSpace = "u1";
  assert.strictEqual(c.canModifyItem(trick(c), "m1", false), false);
  assert.strictEqual(c.canPlaceItem(trick(c), "m1", false), true);
  assert.strictEqual(c.canPlaceItem(trick(c), null, false), true); // table root (placement key u1)
  assert.strictEqual(c.canDragItem(trick(c), "m1", false), true);
});

test("linked trick: not in the official locked table, not for guests, not where it isn't placed", () => {
  const c = setup();
  c.state.activeSpace = "t00";
  assert.strictEqual(c.canPlaceItem(trick(c), "c1", false), false);
  c.state.activeSpace = "u1";
  c.getTrick("a000000").categoryIds = ["c1", "m1"];
  assert.strictEqual(c.canPlaceItem(trick(c), null, false), false);
  c.isLoggedIn = () => false;
  assert.strictEqual(c.canPlaceItem(trick(c), "m1", false), false);
});
