// "Edit this folder" pill target (js/26) and icon image sizing (js/43).
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const { load } = require("./_load");

function setup(){
  const ctx = load(["js/01-data-model.js", "js/01-data-storage.js", "js/02-constants-colors-icons.js", "js/03-i18n.js", "js/04-state.js", "js/05-data-helpers.js", "js/05-data-ops.js", "js/05-data-util.js",
    "js/06-icons-svg.js", "js/07-id.js", "js/20-browse-order.js", "js/26-browse-fab.js", "js/43-modal-category.js"]);
  const nm = (z) => ({ zh: z, jp: "", en: "" });
  ctx.db = ctx.normalizeDB({
    categories: [{ id: "c1", parentId: null, spaceId: "t00", name: nm("c1"), order: 0 }],
    tricks: [{ id: "a000000", name: nm("a"), categoryIds: ["c1"] }],
    infos: [], tags: []
  });
  ctx.invalidateDbIndex();
  return ctx;
}

test("pill: folder column -> that folder when modifiable", () => {
  const c = setup();
  c.getSpace("t00").locked = false;
  const r = c.colEditTarget("c1", "t00", false);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(r)), { kind: "folder", id: "c1", parentId: null });
});

test("pill: locked table folder hidden for non-admin, shown for admin", () => {
  const c = setup();
  assert.strictEqual(c.colEditTarget("c1", "t00", false), null);
  assert.strictEqual(c.colEditTarget("c1", "t00", true).kind, "folder");
});

test("pill: root of custom table edits the table; default/locked/fav roots hidden", () => {
  const c = setup();
  const sp = c.createSpace({ name: { zh: "mine" } });
  assert.deepStrictEqual(JSON.parse(JSON.stringify(c.colEditTarget(null, sp.id, false))), { kind: "space", id: sp.id });
  assert.strictEqual(c.colEditTarget(null, "t00", true), null);
  assert.strictEqual(c.colEditTarget(null, "fav", false), null);
});

test("pill: trick-folder and virtual favorites columns hidden; guest hidden", () => {
  const c = setup();
  assert.strictEqual(c.colEditTarget("a000000", "t00", true), null);
  assert.strictEqual(c.colEditTarget(c.FAV_STARRED_ID, "fav", false), null);
  c.isLoggedIn = () => false;
  assert.strictEqual(c.colEditTarget("c1", "t00", true), null);
});

test("iconImageFit: longer side capped at 128, aspect kept, never upscaled", () => {
  const c = setup();
  assert.deepStrictEqual(JSON.parse(JSON.stringify(c.iconImageFit(512, 256, 128))), { w: 128, h: 64 });
  assert.deepStrictEqual(JSON.parse(JSON.stringify(c.iconImageFit(50, 80, 128))), { w: 50, h: 80 });
  assert.deepStrictEqual(JSON.parse(JSON.stringify(c.iconImageFit(1, 1000, 128))), { w: 1, h: 128 });
});

test("iconImageAllowed: admin only, every target", () => {
  const c = setup();
  c.isAdminAccount = () => false;
  assert.strictEqual(c.iconImageAllowed("category"), false);
  c.isAdminAccount = () => true;
  assert.strictEqual(c.iconImageAllowed("category"), true);
  assert.strictEqual(c.iconImageAllowed("space"), true);
  assert.strictEqual(c.iconImageAllowed("drawer"), true);
});
