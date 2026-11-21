// Undo + Delete key (js/28-browse-undo.js, hooks in 24/25).
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const { load } = require("./_load");

function setup(){
  const ctx = load(["js/01-data-model.js", "js/02-constants-colors-icons.js", "js/03-i18n.js", "js/04-state.js", "js/05-data-helpers.js",
    "js/06-icons-svg.js", "js/07-id.js", "js/09-names.js", "js/20-browse-order.js", "js/22-browse-drag.js", "js/25-browse-clipboard.js",
    "js/28-browse-undo.js"]);
  ctx.saveDB = () => { ctx._saved = (ctx._saved || 0) + 1; };
  const nm = (z) => ({ zh: z, jp: "", en: "" });
  ctx.db = ctx.normalizeDB({
    categories: [{ id: "c1", parentId: null, spaceId: "t00", name: nm("c1"), order: 0 }],
    tricks: [{ id: "a000000", name: nm("a"), categoryIds: ["c1"] }],
    infos: []
  });
  return ctx;
}
const ctxOk = { editMode: true, guest: false, inField: false, modalOpen: false, ctrl: false };

test("push / undo restores data in place", () => {
  const c = setup(); const ref = c.db;
  c.undoPush();
  c.db.tricks.pop();
  assert.strictEqual(c.db.tricks.length, 0);
  assert.strictEqual(c.undoApply(), true);
  assert.strictEqual(c.db.tricks.length, 1);
  assert.strictEqual(c.db, ref);
  assert.strictEqual(c.undoApply(), false);
});

test("cap 20", () => {
  const c = setup();
  for(let i = 0; i < 30; i++){ c.undoPush(); c.db.tricks[0].name.zh = "v" + i; }
  assert.strictEqual(c.undoStack.length, 20);
});

test("cancelled action (no change) is skipped; stale db cleared", () => {
  const c = setup();
  c.undoPush(); // cancelled delete
  assert.strictEqual(c.undoApply(), false);
  c.undoPush(); c.db = c.normalizeDB({ categories: [], tricks: [], infos: [] });
  assert.strictEqual(c.undoApply(), false);
  assert.strictEqual(c.undoStack.length, 0);
});

test("undoKeyAction", () => {
  const c = setup();
  assert.strictEqual(c.undoKeyAction({ ctrlKey: true, key: "z" }, ctxOk), "undo");
  assert.strictEqual(c.undoKeyAction({ metaKey: true, key: "Z" }, ctxOk), "undo");
  assert.strictEqual(c.undoKeyAction({ ctrlKey: true, shiftKey: true, key: "z" }, ctxOk), null);
  assert.strictEqual(c.undoKeyAction({ key: "z" }, ctxOk), null);
  assert.strictEqual(c.undoKeyAction({ ctrlKey: true, key: "z" }, { ...ctxOk, inField: true }), null);
  assert.strictEqual(c.undoKeyAction({ ctrlKey: true, key: "z" }, { ...ctxOk, guest: true }), null);
});

test("deleteKeyAllowed guards", () => {
  const c = setup();
  c.isGuest = () => false;
  const sel = { type: "trick", id: "a000000", parentId: "c1" };
  assert.strictEqual(c.deleteKeyAllowed(sel, ctxOk, false), false); // t00 locked, non-admin
  assert.strictEqual(c.deleteKeyAllowed(sel, ctxOk, true), true);
  assert.strictEqual(c.deleteKeyAllowed(null, ctxOk, false), false);
  assert.strictEqual(c.deleteKeyAllowed({ type: null, id: null, parentId: "c1" }, ctxOk, false), false);
  assert.strictEqual(c.deleteKeyAllowed(sel, { ...ctxOk, editMode: false }, true), false);
  assert.strictEqual(c.deleteKeyAllowed(sel, { ...ctxOk, inField: true }, true), false);
  assert.strictEqual(c.deleteKeyAllowed(sel, { ...ctxOk, modalOpen: true }, true), false);
  assert.strictEqual(c.deleteKeyAllowed({ type: "trick", id: "zzz", parentId: "c1" }, ctxOk, true), false);
  assert.strictEqual(c.deleteKeyAllowed({ ...sel, parentId: c.FAV_STARRED_ID }, ctxOk, true), false);
  c.isGuest = () => true;
  assert.strictEqual(c.deleteKeyAllowed(sel, ctxOk, true), false);
});
