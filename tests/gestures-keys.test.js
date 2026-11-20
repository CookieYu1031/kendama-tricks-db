"use strict";
const test = require("node:test");
const assert = require("node:assert");
const { load } = require("./_load");

const c = load(["js/23-browse-gestures.js", "js/24-browse-keys.js"]);
const base = { inField:false, modalOpen:false, drawerOpen:false, editMode:false, guest:false, ctrl:false };
const ctx = (o) => Object.assign({}, base, o);

test("browseSwipeDecision", () => {
  assert.strictEqual(c.browseSwipeDecision(80, 5, 0), "back");
  assert.strictEqual(c.browseSwipeDecision(40, 5, 0), "cancel");
  assert.strictEqual(c.browseSwipeDecision(40, 5, 0.8), "back");
  assert.strictEqual(c.browseSwipeDecision(10, 5, 0.8), "cancel");
  assert.strictEqual(c.browseSwipeDecision(-80, 0, 1), "ignore");
  assert.strictEqual(c.browseSwipeDecision(30, 60, 1), "ignore");
});

test("browseSwipeAllowed", () => {
  const ok = { startX:100, inField:false, inBlocked:false, drawerOpen:false, modalOpen:false, dragging:false, pathLen:1 };
  assert.strictEqual(c.browseSwipeAllowed(ok), true);
  assert.strictEqual(c.browseSwipeAllowed(Object.assign({}, ok, { startX:10 })), false);
  assert.strictEqual(c.browseSwipeAllowed(Object.assign({}, ok, { pathLen:0 })), false);
  ["inField","inBlocked","drawerOpen","modalOpen","dragging"].forEach((k) => {
    const o = Object.assign({}, ok); o[k] = true;
    assert.strictEqual(c.browseSwipeAllowed(o), false, k);
  });
});

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
