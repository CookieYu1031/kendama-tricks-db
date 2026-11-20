// Loads browser scripts (js/NN-*.js) into an isolated vm context with minimal
// DOM/localStorage stubs, so pure functions can be tested with `node --test`.
// Top-level `var` / `function` declarations become properties of the returned ctx.
"use strict";
const fs = require("fs");
const vm = require("vm");
const path = require("path");

const ROOT = path.join(__dirname, "..");

function makeStorage(){
  const store = {};
  return {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
    clear: () => { Object.keys(store).forEach((k) => delete store[k]); }
  };
}

function load(files, extra){
  const noop = () => {};
  const el = () => null;
  const ctx = {
    console, setTimeout, clearTimeout, Date, Math, JSON,
    localStorage: makeStorage(),
    document: { getElementById: el, querySelector: el, querySelectorAll: () => [], addEventListener: noop, createElement: () => ({ style:{}, classList:{ add:noop, remove:noop, toggle:noop }, appendChild:noop, setAttribute:noop, addEventListener:noop }) },
    navigator: { language: "zh-TW" },
    ...extra
  };
  ctx.window = ctx;
  ctx.window.innerWidth = ctx.window.innerWidth || 1200;
  ctx.window.addEventListener = ctx.window.addEventListener || noop;
  vm.createContext(ctx);
  for (const f of files){
    const code = fs.readFileSync(path.join(ROOT, f), "utf8");
    vm.runInContext(code, ctx, { filename: f });
  }
  return ctx;
}

module.exports = { load };
