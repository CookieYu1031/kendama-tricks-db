// scripts/test.js: changed file -> test categories / files.
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const { categoryOf, plan } = require("../../scripts/test.js");

test("categoryOf: core and shared files run everything", () => {
  ["js/01-data-model.js", "js/05-data-ops.js", "js/90-events-and-init.js", "index.html", "tests/_load.js"].forEach((f) => assert.strictEqual(categoryOf(f), "ALL", f));
});

test("categoryOf: numbered groups map to categories", () => {
  assert.strictEqual(categoryOf("js/14-shell-settings.js"), "shell");
  assert.strictEqual(categoryOf("js/21-browse-columns.js"), "browse");
  assert.strictEqual(categoryOf("js/35-part-diagram.js"), "drawer");
  assert.strictEqual(categoryOf("js/47-modal-add.js"), "modals");
  assert.strictEqual(categoryOf("js/54-sync-queue.js"), "sync");
  assert.strictEqual(categoryOf("js/58-share-flow.js"), "share");
  assert.strictEqual(categoryOf("js/62-search-panel.js"), "search");
  assert.strictEqual(categoryOf("js/73-mailbox.js"), "admin");
  assert.strictEqual(categoryOf("js/84-practice-panel.js"), "tools");
  assert.strictEqual(categoryOf("firestore.rules"), "firestore");
  assert.strictEqual(categoryOf("tests/drawer/tags.test.js"), "drawer");
  assert.strictEqual(categoryOf("TODO.md"), null);
});

test("plan: a feature file pulls its category, tests that load it, and the project rules", () => {
  const p = plan(["js/47-modal-add.js"]);
  assert.ok(p.files.indexOf("tests/modals/add-modal.test.js") !== -1);
  assert.ok(p.files.indexOf("tests/browse/fav-folders.test.js") !== -1, "fav-folders loads js/47");
  assert.ok(p.files.indexOf("tests/rules/style.test.js") !== -1);
  assert.strictEqual(p.files.indexOf("tests/sync/merge.test.js"), -1);
});

test("plan: docs only -> nothing; core file -> everything", () => {
  assert.deepStrictEqual(plan(["TODO.md", "CLAUDE.md"]).files, []);
  assert.ok(plan(["js/03-i18n.js"]).files.length > 50);
});
