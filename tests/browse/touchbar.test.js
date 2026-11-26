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
  assert.strictEqual(c.touchbarState(Object.assign({}, base, { items: [], editMode: false })).visible, false);
  assert.strictEqual(c.touchbarState(Object.assign({}, base, { items: [], touchClip: true })).visible, true);
});

test("hint mode: edit mode, nothing picked -> visible with the select hint (touch / mouse wording)", () => {
  const c = setup();
  const h = (x) => c.touchbarState(Object.assign({}, base, { items: [] }, x));
  assert.deepStrictEqual({ v: h({}).visible, m: h({}).mode, k: h({}).hint }, { v: true, m: "hint", k: "tbHintMouse" });
  assert.strictEqual(h({ touch: true }).hint, "tbHintTouch");
  assert.strictEqual(h({ guest: true }).visible, false);
  assert.strictEqual(h({ touchClip: true }).mode, "clip");
  assert.strictEqual(h({ styleClip: { icon: "x" } }).mode, "style");
  assert.strictEqual(c.touchbarState(Object.assign({}, base, { items: sel("u000000") })).mode, "sel");
  for (const k of ["tbHintTouch", "tbHintMouse"]) assert.ok(c.t(k) && c.t(k) !== k);
});

test("touchbarModKey: Mac / iOS = ⌘, others Ctrl", () => {
  const c = setup();
  assert.deepStrictEqual(["MacIntel", "iPhone", "iPad", "Win32", "Linux x86_64", ""].map(c.touchbarModKey), ["⌘", "⌘", "⌘", "Ctrl", "Ctrl", "Ctrl"]);
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

test("style clip alone shows the bar with count 0; dropper / paint follow js/25-browse-style", () => {
  const c = setup();
  const st0 = c.touchbarState(Object.assign({}, base, { items: [], styleClip: { icon: "x", color: "red", type: "trick" } }));
  assert.deepStrictEqual({ v: st0.visible, m: st0.mode, d: st0.drop, p: st0.paint }, { v: true, m: "style", d: false, p: false });
  assert.strictEqual(c.touchbarCount(st0, null), 0);
  assert.strictEqual(c.touchbarState(Object.assign({}, base, { items: [], styleClip: null })).mode, "hint");
  assert.strictEqual(c.touchbarState(Object.assign({}, base, { items: [], styleClip: {}, guest: true })).visible, false);
  // without the style module (typeof guard) the buttons stay off; with it they follow its answers
  assert.strictEqual(c.touchbarState(Object.assign({}, base, { items: sel("a000000") })).drop, false);
  c.styleCanCopy = () => true; c.styleCanApply = (items, pid, adm) => items.length === 1 && adm === true;
  const on = c.touchbarState(Object.assign({}, base, { items: sel("a000000"), admin: true }));
  assert.deepStrictEqual({ d: on.drop, p: on.paint }, { d: true, p: true });
  const off = c.touchbarState(Object.assign({}, base, { items: sel("a000000"), admin: false }));
  assert.deepStrictEqual({ d: off.drop, p: off.paint }, { d: true, p: false });
  assert.strictEqual(c.touchbarState(Object.assign({}, base, { items: sel("a000000"), styleClip: {} })).mode, "sel");
});

test("Shift+click multi-selection (mouse) shows the bar; mouse paste target = always valid", () => {
  const c = setup();
  const st = c.touchbarState(Object.assign({}, base, { items: sel("u000000"), hasClip: true, hasTarget: true }));
  assert.ok(st.visible && st.mode === "sel" && st.paste);
  // tbContext: Shift selection (swipeSelActive false) -> mouse -> hasTarget true without any long-press target
  c.state.editMode = true;
  c.isGuest = () => false; c.isAdminNow = () => false;
  c.multiSel = { parentId: "c1", space: "t00", items: sel("u000000") };
  c.swipeSelActive = false;
  const cx = c.tbContext();
  assert.strictEqual(cx.hasTarget, true);
  assert.strictEqual(cx.items.length, 1);
  c.swipeSelActive = true;
  assert.strictEqual(c.tbContext().hasTarget, false); // touch: needs a long-pressed level
});

test("tooltip shortcut labels: Mac shows ⌘ for C/X/V only", () => {
  const c = setup();
  assert.deepStrictEqual(["cut", "copy", "paste", "del", "drop", "paint", "close"].map((a) => c.touchbarKeyLabel(a, "Win32")),
    ["Ctrl+X", "Ctrl+C", "Ctrl+V", "Delete", "Ctrl+Alt+C", "Ctrl+Alt+V", "Esc"]);
  assert.deepStrictEqual(["cut", "paste", "drop"].map((a) => c.touchbarKeyLabel(a, "MacIntel")), ["⌘X", "⌘V", "Ctrl+Alt+C"]);
});

test("握有樣式時，單點的項目也能用工具列的滴管／油漆，並計入已選(n)", () => {
  const c = setup();
  c.styleCanCopy = (items) => items.length === 1;
  c.styleCanApply = (items) => items.length > 0;
  const base = { items: [], parentId: null, admin: true, editMode: true, guest: false, styleClip: { icon: "x", color: "red" } };
  const none = c.touchbarState(Object.assign({}, base, { styleBar: { items: [], parentId: null } }));
  assert.strictEqual(none.paint, false);
  assert.strictEqual(c.touchbarCount(none, null), 0);
  const one = c.touchbarState(Object.assign({}, base, { styleBar: { items: [{ type: "trick", id: "a" }], parentId: "c1" } }));
  assert.strictEqual(one.paint && one.drop, true);
  assert.strictEqual(one.cut || one.copy || one.del, false);
  assert.strictEqual(c.touchbarCount(one, null), 1);
});
