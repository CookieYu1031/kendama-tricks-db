"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const { load } = require("../_load");

const ctx = load(["js/02-constants-colors-icons.js"]);
const css = fs.readFileSync(path.join(__dirname, "..", "..", "css", "variables-and-base.css"), "utf8");
const STEPS = ["none", "rare", "sometimes", "most", "mastered"];

function block(startMarker){
  const i = css.indexOf(startMarker);
  return css.slice(i, css.indexOf("}", i));
}
function pal(b){
  const o = {};
  STEPS.forEach((s) => {
    o[s] = new RegExp("--rate-" + s + ":(#[0-9A-Fa-f]{6})").exec(b)[1];
    o[s + "-ink"] = new RegExp("--rate-" + s + "-ink:(#[0-9A-Fa-f]{6})").exec(b)[1];
  });
  return o;
}
function lum(hex){
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
function ratio(a, b){ const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }

const dark = pal(block(":root{"));
const light = pal(block(':root[data-theme="light"]{'));

test("rateColor returns var refs, none for unknown", () => {
  assert.strictEqual(ctx.rateColor("most"), "var(--rate-most)");
  assert.strictEqual(ctx.rateColor(null), "var(--rate-none)");
});
test("rateGlowShadow: empty for no rate, color-mix for levels", () => {
  assert.strictEqual(ctx.rateGlowShadow(null), "");
  assert.strictEqual(ctx.rateGlowShadow("none"), "");
  assert.ok(ctx.rateGlowShadow("rare").indexOf("var(--rate-rare)") > 0);
});
test("dark: contrast vs bg rises monotonically", () => {
  const bg = "#212121";
  const r = STEPS.map((s) => ratio(dark[s], bg));
  for (let i = 1; i < r.length; i++) assert.ok(r[i] > r[i - 1], "dark step " + i);
});
test("light: contrast vs bg rises monotonically", () => {
  const bg = "#D9DCE1";
  const r = STEPS.map((s) => ratio(light[s], bg));
  for (let i = 1; i < r.length; i++) assert.ok(r[i] > r[i - 1], "light step " + i);
});
test("ink readable on fill (>=4.5)", () => {
  [dark, light].forEach((p) => STEPS.forEach((s) => assert.ok(ratio(p[s], p[s + "-ink"]) >= 4.5, s)));
});
