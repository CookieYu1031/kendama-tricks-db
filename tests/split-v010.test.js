"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const jsFiles = fs.readdirSync(path.join(ROOT, "js")).filter((f) => /\.js$/.test(f));
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const refs = [];
html.replace(/<script src="js\/([^"]+\.js)"><\/script>/g, (m, f) => { refs.push(f); return m; });

test("index.html references every js file exactly once", () => {
  jsFiles.forEach((f) => {
    assert.strictEqual(refs.filter((r) => r === f).length, 1, f);
  });
  assert.strictEqual(refs.length, jsFiles.length);
});

test("load order: 01 before 02, 05 before 06", () => {
  const idx = (f) => refs.indexOf(f);
  const last = (p) => Math.max.apply(null, refs.filter((r) => r.indexOf(p) === 0).map(idx));
  const first = (p) => Math.min.apply(null, refs.filter((r) => r.indexOf(p) === 0).map(idx));
  assert.ok(last("01-") < first("02-"));
  assert.ok(last("05-") < first("06-"));
  assert.ok(idx("01-data-model.js") < idx("01-data-storage.js"));
});

test("no js file exceeds 400 lines", () => {
  jsFiles.forEach((f) => {
    const n = fs.readFileSync(path.join(ROOT, "js", f), "utf8").split("\n").length;
    assert.ok(n <= 400, f + " has " + n + " lines");
  });
});
