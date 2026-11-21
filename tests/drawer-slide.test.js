"use strict";
// v0.13: drawer swipe-to-close removed.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const rd = (f) => fs.readFileSync(path.join(__dirname, "..", f), "utf8");

test("drawer swipe-to-close is gone", () => {
  for (const f of ["js/30-drawer-logic.js", "js/32-trick-drawer.js"]) {
    assert.ok(!/drawerSwipeDecision|attachDrawerSwipeClose|touchstart|touchmove/.test(rd(f)), f);
  }
});
