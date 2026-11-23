"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const { load } = require("../_load");

const ROOT = path.join(__dirname, "..", "..");
const ctx = load(["js/15-shell-theme.js"]);

test("theme-color follows theme and equals --ink of that theme", () => {
  const css = fs.readFileSync(path.join(ROOT, "css/variables-and-base.css"), "utf8");
  const dark = css.match(/--ink:(#[0-9A-Fa-f]{6})/)[1].toUpperCase();
  const light = css.match(/data-theme="light"\]\{[^}]*?--ink:(#[0-9A-Fa-f]{6})/)[1].toUpperCase();
  assert.strictEqual(ctx.themeColorFor("dark").toUpperCase(), dark);
  assert.strictEqual(ctx.themeColorFor("light").toUpperCase(), light);
});

test("resolveTheme: explicit pref wins, system follows OS", () => {
  assert.strictEqual(ctx.resolveTheme("system", true), "dark");
  assert.strictEqual(ctx.resolveTheme("system", false), "light");
  assert.strictEqual(ctx.resolveTheme("light", true), "light");
});
