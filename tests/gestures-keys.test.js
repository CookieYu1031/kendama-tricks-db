"use strict";
const test = require("node:test");
const assert = require("node:assert");
const { load } = require("./_load");

const c = load(["js/23-browse-gestures.js", "js/24-browse-keys.js"]);
const base = { inField:false, modalOpen:false, drawerOpen:false, editMode:false, guest:false, ctrl:false };
const ctx = (o) => Object.assign({}, base, o);

test("keyAction mapping", () => {
  assert.strictEqual(c.keyAction("/", ctx()), "search");
  assert.strictEqual(c.keyAction("?", ctx()), "help");
  assert.strictEqual(c.keyAction("Backspace", ctx()), "up");
  assert.strictEqual(c.keyAction("ArrowLeft", ctx()), "up");
  assert.strictEqual(c.keyAction("ArrowDown", ctx()), "next");
  assert.strictEqual(c.keyAction("ArrowUp", ctx()), "prev");
  assert.strictEqual(c.keyAction("Enter", ctx()), "open");
  assert.strictEqual(c.keyAction("ArrowRight", ctx()), "open");
  assert.strictEqual(c.keyAction("e", ctx()), "toggleEdit");
  assert.strictEqual(c.keyAction("e", ctx({ guest:true })), null);
  assert.strictEqual(c.keyAction("n", ctx()), null);
  assert.strictEqual(c.keyAction("n", ctx({ editMode:true })), "add");
  assert.strictEqual(c.keyAction("n", ctx({ editMode:true, guest:true })), null);
  assert.strictEqual(c.keyAction("x", ctx()), null);
});

test("keyAction suppression", () => {
  assert.strictEqual(c.keyAction("/", ctx({ inField:true })), null);
  assert.strictEqual(c.keyAction("Backspace", ctx({ inField:true })), null);
  assert.strictEqual(c.keyAction("e", ctx({ modalOpen:true })), null);
  assert.strictEqual(c.keyAction("e", ctx({ ctrl:true })), null);
  assert.strictEqual(c.keyAction("ArrowDown", ctx({ drawerOpen:true })), null);
  assert.strictEqual(c.keyAction("ArrowLeft", ctx({ drawerOpen:true })), "up");
});

test("kbdNextIndex", () => {
  assert.strictEqual(c.kbdNextIndex(-1, 3, 1), 0);
  assert.strictEqual(c.kbdNextIndex(-1, 3, -1), 2);
  assert.strictEqual(c.kbdNextIndex(0, 3, -1), 0);
  assert.strictEqual(c.kbdNextIndex(2, 3, 1), 2);
  assert.strictEqual(c.kbdNextIndex(1, 3, 1), 2);
  assert.strictEqual(c.kbdNextIndex(0, 0, 1), -1);
});

test("kbdText falls back", () => {
  assert.ok(c.kbdText("kbdHelp").length > 5);
});
