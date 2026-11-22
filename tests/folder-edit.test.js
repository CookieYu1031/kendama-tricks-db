// Row edit button rule (js/20 canEditRow), removed column pill (js/26) and icon image sizing (js/43).
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

const row = (c, type, id) => ({ type, id, ref: type === "category" ? c.getCategory(id) : (type === "info" ? c.getInfo(id) : c.getTrick(id)) });

test("row edit: folder in unlocked table editable", () => {
  const c = setup();
  c.getSpace("t00").locked = false;
  assert.strictEqual(c.canEditRow(row(c, "category", "c1"), null, false), true);
});

test("row edit: locked table folder hidden for non-admin, shown for admin", () => {
  const c = setup();
  assert.strictEqual(c.canEditRow(row(c, "category", "c1"), null, false), false);
  assert.strictEqual(c.canEditRow(row(c, "category", "c1"), null, true), true);
});

test("row edit: tricks never get the row button; guests never", () => {
  const c = setup();
  assert.strictEqual(c.canEditRow(row(c, "trick", "a000000"), "c1", true), false);
  c.isLoggedIn = () => false;
  assert.strictEqual(c.canEditRow(row(c, "category", "c1"), null, true), false);
});

test("edit-this-folder pill removed", () => {
  const c = setup();
  assert.strictEqual(typeof c.colEditTarget, "undefined");
  assert.strictEqual(typeof c.renderColEditPill, "undefined");
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
