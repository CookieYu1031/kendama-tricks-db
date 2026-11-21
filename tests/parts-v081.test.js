"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const { load } = require("./_load");

function setup(){
  return load(
    ["js/01-data-model.js", "js/02-constants-colors-icons.js", "js/03-i18n.js", "js/04-state.js", "js/05-data-helpers.js", "js/32-trick-drawer.js"].filter((f) => fs.existsSync(path.join(__dirname, "..", f))),
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

test("normalizeDB drops old kensakiSide, keeps surviving keys in canonical order", () => {
  const c = setup();
  const t = c.normalizeDB({ categories: [], tricks: [{ id: "x", parts: ["ana", "kensakiSide", "kensaki", "stringHole", "tamaPoint"] }] }).tricks[0];
  assert.deepStrictEqual(arr(t.parts), ["kensaki", "tamaPoint", "ana"]);
});

test("part labels exist for every key in zh/jp/en", () => {
  const c = setup();
  ["zh", "jp", "en"].forEach((lang) => {
    c.PART_KEYS.forEach((k) => {
      const v = c.UI[lang]["part_" + k];
      assert.ok(v && typeof v === "string", lang + " part_" + k);
    });
  });
  assert.strictEqual(c.UI.zh.part_kenchou, "劍頂");
  assert.strictEqual(c.UI.en.part_stringHole, undefined);
  assert.strictEqual(c.UI.zh.part_tamaTop, "球面");
  assert.strictEqual(c.UI.jp.part_tamaTop, "玉の面");
  assert.strictEqual(c.UI.en.part_tamaTop, "Ball surface");
  assert.strictEqual(c.UI.zh.part_tamaPoint, "球上一點");
  assert.strictEqual(c.UI.zh.part_junction, "交界");
});

test("search mode labels relabelled", () => {
  const src = fs.readFileSync(path.join(__dirname, "..", "js/62-search-panel.js"), "utf8");
  assert.ok(src.includes('searchModeAny:"其一符合", searchModeAll:"全符合"'));
  assert.ok(src.includes('searchModeAny:"Match any", searchModeAll:"Match all"'));
});
