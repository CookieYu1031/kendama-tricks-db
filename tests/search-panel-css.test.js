// Search panel layout (css/search-panel.css): no part-group divider, ken row 1 / ito+tama row 2, rows wrap.
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const css = fs.readFileSync(path.join(__dirname, "..", "css", "search-panel.css"), "utf8");

test("part groups have no divider in the search panel", () => {
  assert.match(css, /\.search-panel \.part-group \+ \.part-group\{[^}]*border-top:none/);
});
test("ken group takes its own row; ito/tama flow together", () => {
  assert.match(css, /part-group\[data-group="ken"\]\{[^}]*flex:0 0 100%/);
  assert.match(css, /data-group="ito"\][^{]*data-group="tama"\]\{[^}]*display:contents/);
});
test("conditions rows wrap", () => {
  assert.match(css, /\.search-label-row\{[^}]*flex-wrap:wrap/);
  assert.match(css, /\.search-results-bar\{[^}]*flex-wrap:wrap/);
});
