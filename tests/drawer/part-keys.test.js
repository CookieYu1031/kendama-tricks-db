"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const { load } = require("../_load");

function setup(){
  return load(
    ["js/01-data-model.js", "js/01-data-storage.js", "js/02-constants-colors-icons.js", "js/03-i18n.js", "js/04-state.js", "js/05-data-helpers.js", "js/05-data-ops.js", "js/05-data-util.js", "js/32-trick-drawer.js"].filter((f) => fs.existsSync(path.join(__dirname, "..", "..", f))),
    { localize: (n) => n && n.zh, nextId: () => "id1" }
  );
}
const arr = (x) => JSON.parse(JSON.stringify(x));

test("PART_GROUPS order and PART_KEYS flatten", () => {
  const c = setup();
  const g = arr(c.PART_GROUPS);
  assert.deepStrictEqual(g.map((x) => x.key), ["ken", "ito", "tama"]);
  assert.deepStrictEqual(g[1].parts, ["string"]);
  assert.deepStrictEqual(arr(c.PART_KEYS), [
    "kenchou", "kensaki", "sara", "saraEdge", "junction", "kenBody", "suberidome", "chuzara", "chuzaraEdge",
    "string", "tamaTop", "tamaPoint", "ana"]);
});



