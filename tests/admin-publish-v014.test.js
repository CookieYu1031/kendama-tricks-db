"use strict";
// v0.14: pending changes become a button + popup; publish area scrolls.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { load } = require("./_load");

function mk(){ const o = { innerHTML: "", disabled: false, listeners: {}, classList: { add(){}, remove(){}, toggle(){}, contains(){ return false; } }, setAttribute(){}, style: {}, addEventListener(){} }; return o; }
function ctx(box){
  return load(["js/01-data-model.js", "js/01-data-storage.js","js/02-constants-colors-icons.js","js/03-i18n.js","js/04-state.js","js/05-data-helpers.js", "js/05-data-ops.js", "js/05-data-util.js","js/16-shell-updates.js","js/70-admin-panel.js"], {
    document: { getElementById: (id) => id === "adminPending" ? box : mk(), querySelector(){ return null; }, querySelectorAll: () => [], addEventListener(){}, createElement: mk, documentElement: mk() }
  });
}

test("pending renders a button with count; disabled at 0", () => {
  const box = mk(); const c = ctx(box);
  vm.runInContext("adminPending = normalizePending({added:['a','b'],modified:1,removed:0,tags:0}); renderAdminPending();", c);
  assert.match(box.innerHTML, /<button[^>]*id="adminPendingBtn"/);
  assert.match(box.innerHTML, /\uff083\uff09/);
  assert.doesNotMatch(box.innerHTML, /disabled/);
  vm.runInContext("adminPending = normalizePending({}); renderAdminPending();", c);
  assert.match(box.innerHTML, /disabled/);
  assert.match(box.innerHTML, /\uff080\uff09/);
});

test("popup detail html groups and escapes", () => {
  const c = ctx(mk());
  const h = vm.runInContext("pendingDetailHtml(normalizePending({added:['<x>'],modified:['m'],removed:[],tags:0}))", c);
  assert.match(h, /&lt;x&gt;/);
  assert.doesNotMatch(h, /<x>/);
  assert.match(h, /admin-pending-list/);
});

test("pending overlay is a registered sub-modal; i18n in 3 langs", () => {
  const src = fs.readFileSync(path.join(__dirname, "..", "js/70-admin-panel.js"), "utf8");
  assert.match(src, /ADMIN_SUB_IDS = \[[^\]]*adminPendingOverlay/);
  assert.strictEqual((src.match(/adminPendingBtn:/g) || []).length, 3);
});

test("css: publish card scrolls on wide, grid scrolls on narrow", () => {
  const css = fs.readFileSync(path.join(__dirname, "..", "css/admin-panel.css"), "utf8");
  assert.match(css, /\.admin-area-publish\{[^}]*overflow-y:auto/);
  assert.match(css, /\.admin-area-publish > \*\{ flex-shrink:0/);
  assert.match(css, /max-width: 860px\)\{[\s\S]*\.admin-grid\{[^}]*overflow-y:auto/);
});
