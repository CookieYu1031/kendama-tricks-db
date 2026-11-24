// Touch toolbar pure logic (js/25-browse-touchbar.js).
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const { load } = require("../_load");

function setup(){
  const ctx = load(["js/01-data-model.js", "js/01-data-storage.js", "js/02-constants-colors-icons.js", "js/03-i18n.js", "js/04-state.js", "js/05-data-helpers.js", "js/05-data-ops.js", "js/05-data-prefix.js", "js/05-data-util.js",
    "js/06-icons-svg.js", "js/07-id.js", "js/09-names.js", "js/20-browse-order.js", "js/22-browse-drag.js", "js/25-browse-clipboard.js", "js/25-browse-multisel.js", "js/25-browse-clip-dup.js",
    "js/25-browse-swipe-select.js", "js/28-browse-undo.js", "js/25-browse-touchbar.js"]);
  ctx.saveDB = () => {};
  const nm = (z) => ({ zh: z, jp: "", en: "" });
  ctx.db = ctx.normalizeDB({
    categories: [{ id: "c1", parentId: null, spaceId: "t00", name: nm("c1"), order: 0 }],
    tricks: [
      { id: "a000000", name: nm("a"), categoryIds: ["c1"], order: 0 },
      { id: "u000000", name: nm("u"), categoryIds: ["c1"], order: 1, custom: true }
    ],
    infos: [], tags: []
  });
  ctx.getSpace("t00").locked = true;
  ctx.invalidateDbIndex();
  ctx.state.activeSpace = "t00";
  return ctx;
}
const sel = (...ids) => ids.map((id) => ({ type: "trick", id }));
const base = { parentId: "c1", admin: false, hasClip: false, hasTarget: false, touchClip: false, editMode: true, guest: false };

test("hidden outside edit mode / for guests, or with nothing selected and no touch clipboard", () => {
  const c = setup();
  assert.strictEqual(c.touchbarState(Object.assign({}, base, { items: sel("a000000"), editMode: false })).visible, false);
  assert.strictEqual(c.touchbarState(Object.assign({}, base, { items: sel("a000000"), guest: true })).visible, false);
  assert.strictEqual(c.touchbarState(Object.assign({}, base, { items: [] })).visible, false);
  assert.strictEqual(c.touchbarState(Object.assign({}, base, { items: [], touchClip: true })).visible, true);
});

test("locked table: non-admin cannot cut / delete official tricks, but may copy; admin can do all", () => {
  const c = setup();
  const st = c.touchbarState(Object.assign({}, base, { items: sel("a000000") }));
  assert.deepStrictEqual({ copy: st.copy, cut: st.cut, del: st.del }, { copy: true, cut: false, del: false });
  const adm = c.touchbarState(Object.assign({}, base, { items: sel("a000000", "u000000"), admin: true }));
  assert.deepStrictEqual({ copy: adm.copy, cut: adm.cut, del: adm.del, count: adm.count }, { copy: true, cut: true, del: true, count: 2 });
});

test("one forbidden item disables delete for the whole selection", () => {
  const c = setup();
  c.getSpace("t00").locked = false;
  const ok = c.touchbarState(Object.assign({}, base, { items: sel("a000000", "u000000") }));
  assert.ok(ok.cut && ok.del);
  c.getSpace("t00").locked = true;
  const mix = c.touchbarState(Object.assign({}, base, { items: sel("u000000", "a000000") }));
  assert.ok(mix.copy && !mix.del);
});

test("starred list items: nothing enabled", () => {
  const c = setup();
  const st = c.touchbarState(Object.assign({}, base, { items: sel("a000000"), parentId: c.FAV_STARRED_ID, admin: true }));
  assert.deepStrictEqual({ copy: st.copy, cut: st.cut, del: st.del }, { copy: false, cut: false, del: false });
});

test("paste needs a clipboard AND a chosen level", () => {
  const c = setup();
  const s = (hasClip, hasTarget) => c.touchbarState(Object.assign({}, base, { items: [], touchClip: true, hasClip, hasTarget })).paste;
  assert.deepStrictEqual([s(false, false), s(true, false), s(false, true), s(true, true)], [false, false, false, true]);
});

test("count: selection, else clipboard; press-move cancel", () => {
  const c = setup();
  assert.strictEqual(c.touchbarCount({ mode: "sel", count: 3 }, null), 3);
  assert.strictEqual(c.touchbarCount({ mode: "clip", count: 0 }, { mode: "cut", items: [{}, {}] }), 2);
  assert.strictEqual(c.touchbarCount({ mode: "clip", count: 0 }, { mode: "copy", type: "extTrick" }), 1);
  assert.ok(!c.touchbarPressMoved(5, -7));
  assert.ok(c.touchbarPressMoved(9, 0));
  assert.ok(c.touchbarPressMoved(0, -9));
});
