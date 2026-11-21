// Search panel layout (css/search-panel.css): no part-group divider, ken row 1 / ito+tama row 2, rows wrap.
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const css = fs.readFileSync(path.join(__dirname, "..", "css", "search-panel.css"), "utf8");

test("conditions: row2 grip+mode, row3 diagram left + class chips right", () => {
  assert.match(css, /\.search-cond-row\{[^}]*display:flex/);
  assert.match(css, /\.search-class-row\{[^}]*max-height:200px;[^}]*overflow-y:auto/);
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  assert.ok(html.indexOf('id="searchGripRow"') < html.indexOf('id="searchPartsRow"'));
  assert.ok(html.indexOf('id="searchPartsRow"') < html.indexOf('id="searchClassRow"'));
  assert.match(css, /\.part-diagram-box\{[^}]*width:200px/);
  assert.doesNotMatch(css, /part-group/);
});
test("conditions rows wrap", () => {
  assert.match(css, /\.search-label-row\{[^}]*flex-wrap:wrap/);
  assert.match(css, /\.search-results-bar\{[^}]*flex-wrap:wrap/);
});
test("open panel stays flex (gap), right-aligned, drops from the top edge like a drawer", () => {
  assert.match(css, /\.search-panel\.show\{[^}]*display:flex/);
  assert.match(css, /right: calc\(var\(--safe-r, 0px\) \+ 12px\)/);
  assert.match(css, /\.search-panel\{[^}]*top:0;/);
  assert.match(css, /\.search-panel\{[^}]*transform: translateY\(calc\(-100% - 24px\)\)/);
  assert.match(css, /transform: translateY\(0\);/);
  assert.doesNotMatch(css, /clip-path/);
  assert.match(css, /prefers-reduced-motion: reduce/);
});
test("search button sits in the right topbar actions, before the avatar", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  assert.ok(html.indexOf('id="searchToggleBtn"') > html.indexOf('class="topbar-actions"'));
  assert.ok(html.indexOf('id="searchToggleBtn"') < html.indexOf('id="settingsBtn"'));
});
