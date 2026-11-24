// Batch delete + deleteCategoryTree (js/28-browse-undo.js, js/05-data-ops.js).
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const { load } = require("../_load");

function setup(){
  const ctx = load(["js/01-data-model.js", "js/01-data-storage.js", "js/02-constants-colors-icons.js", "js/03-i18n.js", "js/04-state.js", "js/05-data-helpers.js", "js/05-data-ops.js", "js/05-data-prefix.js", "js/05-data-util.js",
    "js/06-icons-svg.js", "js/07-id.js", "js/09-names.js", "js/20-browse-order.js", "js/22-browse-drag.js", "js/25-browse-clipboard.js", "js/25-browse-multisel.js", "js/28-browse-undo.js"]);
  ctx.saveDB = () => {};
  const nm = (z) => ({ zh: z, jp: "", en: "" });
  ctx.db = ctx.normalizeDB({
    categories: [
      { id: "c1", parentId: null, spaceId: "t00", name: nm("c1"), order: 0 },
      { id: "c2", parentId: "c1", spaceId: "t00", name: nm("c2"), order: 0 },
      { id: "c3", parentId: null, spaceId: "t00", name: nm("c3"), order: 1 }
    ],
    tricks: [
      { id: "a000000", name: nm("a"), categoryIds: ["c3", "c1"], order: 0 },
      { id: "b000000", name: nm("b"), categoryIds: ["c3"], order: 1 },
      { id: "d000000", name: nm("d"), categoryIds: ["c2"], order: 2 },
      { id: "e000000", name: nm("e"), categoryIds: ["c3"], order: 3 }
    ],
    infos: [{ id: "i1", parentId: "c3", spaceId: "t00", title: nm("i"), content: "", order: 0 }, { id: "i2", parentId: "c2", spaceId: "t00", title: nm("j"), content: "", order: 0 }],
    tags: []
  });
  ctx.getSpace("t00").locked = false;
  ctx.invalidateDbIndex();
  ctx.state.activeSpace = "t00";
  return ctx;
}

test("deleteCategoryTree: removes list, sub-lists, infos, placements; trick vanishes with last placement", () => {
  const c = setup();
  const ids = Array.from(c.deleteCategoryTree("c1"));
  assert.deepStrictEqual(ids.sort(), ["c1", "c2"]);
  assert.ok(!c.getCategory("c1") && !c.getCategory("c2") && c.getCategory("c3"));
  assert.ok(!c.getInfo("i2") && c.getInfo("i1"));
  assert.ok(!c.getTrick("d000000"));                       // only lived in c2
  assert.deepStrictEqual(Array.from(c.getTrick("a000000").categoryIds), ["c3"]); // keeps its other place
});

test("batch: mixed types in one column; trick loses only this placement, last placement deletes it", () => {
  const c = setup();
  const items = [{ type: "trick", id: "a000000" }, { type: "trick", id: "b000000" }, { type: "info", id: "i1" }];
  const res = c.deleteItemsBatch(items, "c3", "t00", false);
  assert.deepStrictEqual({ removed: res.removed, skipped: res.skipped }, { removed: 3, skipped: 0 });
  assert.deepStrictEqual(Array.from(c.getTrick("a000000").categoryIds), ["c1"]); // other placement stays
  assert.ok(!c.getTrick("b000000"));                                              // last placement -> gone
  assert.ok(!c.getInfo("i1") && c.getTrick("e000000"));
});

test("batch: lists via deleteCategoryTree; catIds returned for path trimming", () => {
  const c = setup();
  const res = c.deleteItemsBatch([{ type: "category", id: "c1" }, { type: "category", id: "c3" }], null, "t00", false);
  assert.strictEqual(res.removed, 2);
  assert.deepStrictEqual(Array.from(res.catIds).sort(), ["c1", "c2", "c3"]);
  assert.strictEqual(c.db.tricks.length, 0);
});

test("batch: no permission items are skipped and counted; fixed folders never", () => {
  const c = setup();
  c.getSpace("t00").locked = true;
  c.getTrick("e000000").custom = true;
  const res = c.deleteItemsBatch([{ type: "trick", id: "a000000" }, { type: "trick", id: "e000000" }, { type: "trick", id: "nope" }], "c3", "t00", false);
  assert.deepStrictEqual({ removed: res.removed, skipped: res.skipped }, { removed: 1, skipped: 2 });
  assert.ok(c.getTrick("a000000") && !c.getTrick("e000000"));
});

test("batch: virtual placement (not in categoryIds) deletes the trick everywhere", () => {
  const c = setup();
  const res = c.deleteItemsBatch([{ type: "trick", id: "a000000" }], c.FAV_CUSTOM_ID, "t00", true);
  assert.strictEqual(res.removed, 1);
  assert.ok(!c.getTrick("a000000"));
});

test("Delete key guard for the batch path", () => {
  const c = setup();
  const ok = { editMode: true, guest: false, inField: false, modalOpen: false, ctrl: false };
  assert.ok(c.deleteKeyBatchAllowed(ok, 2));
  assert.ok(!c.deleteKeyBatchAllowed(ok, 0));
  assert.ok(!c.deleteKeyBatchAllowed(Object.assign({}, ok, { editMode: false }), 2));
  assert.ok(!c.deleteKeyBatchAllowed(Object.assign({}, ok, { inField: true }), 2));
});
