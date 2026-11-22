// v0.13 visual consistency: min font size, radius tokens, breakpoints.
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const dir = path.join(__dirname, "..", "..", "css");
const files = fs.readdirSync(dir).filter((f) => f.endsWith(".css"));
const read = (f) => fs.readFileSync(path.join(dir, f), "utf8");

test("no font-size below 12px", () => {
  files.forEach((f) => {
    const re = /font-size:\s*([0-9.]+)px/g; let m;
    const src = read(f);
    while ((m = re.exec(src))) assert.ok(parseFloat(m[1]) >= 12, f + ": font-size " + m[1] + "px");
  });
});

test("border-radius only tokens or allowed literals", () => {
  files.forEach((f) => {
    const re = /border-radius:\s*([^;}]+)/g; let m;
    const src = read(f);
    while ((m = re.exec(src))) {
      const v = m[1].trim();
      const ok = /^(50%|999px|2px|inherit|0|0 0 var\(--radius\) var\(--radius\)|var\(--radius(-sm|-xs)?\))$/.test(v);
      assert.ok(ok, f + ": border-radius " + v);
    }
  });
});

test("breakpoints limited to 860/861/600/601/380", () => {
  files.forEach((f) => {
    const re = /@media\s*\(\s*(max|min)-width:\s*(\d+)px/g; let m;
    const src = read(f);
    while ((m = re.exec(src))) {
      const n = +m[2];
      if (m[1] === "max") assert.ok([860, 600, 380].includes(n), f + ": max-width " + n);
      else assert.ok([861, 601, 1280, 1680].includes(n), f + ": min-width " + n);
    }
  });
});

test("tokens and fonts", () => {
  const v = read("variables-and-base.css");
  assert.match(v, /--radius-xs:\s*10px/);
  assert.match(v, /--font-body:\s*'Noto Sans TC'/);
  assert.match(v, /--font-display:\s*'Zen Maru Gothic'/);
  assert.match(v, /--ui-zoom/);
  assert.match(fs.readFileSync(path.join(__dirname, "..", "..", "index.html"), "utf8"), /Noto\+Sans\+TC/);
});
