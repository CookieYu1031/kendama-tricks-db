// Published search index: snapshot reassembly, output shape, client merge/gating.
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const { load } = require("./_load");
const bsi = require("../scripts/build-search-index.js");

const nm = (zh, jp, en) => ({ zh: zh || "", jp: jp || "", en: en || "" });
const S = (s) => ({ stringValue: s });
const I = (n) => ({ integerValue: String(n) });

const snapshot = {
  categories: [{ id: "c1", parentId: null, spaceId: "t00", name: nm("基本"), order: 0 }],
  tricks: [
    { id: "a000001", name: nm("大皿", "おおざら", "Big cup"), categoryIds: ["c1"], grip: "ken", parts: ["sara"], tagIds: ["g1"] },
    { id: "a000002", name: nm("次"), categoryIds: ["c1"], tagIds: [] }
  ],
  infos: [],
  tags: [{ id: "g1", name: nm("入門", "", "Beginner") }]
};

test("decodeValue: typed REST values", () => {
  assert.deepStrictEqual(bsi.decodeFields({ a: S("x"), n: I(3), m: { mapValue: { fields: { b: { booleanValue: true } } } },
    l: { arrayValue: { values: [I(1), S("y")] } }, e: { arrayValue: {} } }), { a: "x", n: 3, m: { b: true }, l: [1, "y"], e: [] });
});

test("reassembleVersion: chunked layout (as buildChunkedOps writes)", async () => {
  const sync = load(["js/53-sync-chunks.js"]);
  const ops = sync.buildChunkedOps("sharedBase/space-index/versions/7", JSON.stringify(snapshot), { version: 7, note: "n" }, 0, "publishedAt");
  const docs = {};
  ops.forEach((op) => {
    const f = {};
    Object.keys(op.data).forEach((k) => { f[k] = typeof op.data[k] === "number" ? I(op.data[k]) : S(op.data[k]); });
    docs[op.path] = bsi.decodeFields(f);
  });
  assert.ok(ops.length >= 2);
  const r = await bsi.reassembleVersion(async (p) => docs[p] || null, 7);
  assert.strictEqual(r.version, 7);
  assert.deepStrictEqual(r.snapshot, snapshot);
});

test("reassembleVersion: multi-chunk, inline layout, missing chunk", async () => {
  const str = JSON.stringify(snapshot), half = str.length >> 1;
  const docs = {
    "sharedBase/space-index/versions/2": { version: 2, chunks: 2 },
    "sharedBase/space-index/versions/2/chunks/0": { data: str.slice(0, half) },
    "sharedBase/space-index/versions/2/chunks/1": { data: str.slice(half) },
    "sharedBase/space-index/versions/1": { version: 1, tricks: snapshot.tricks, categories: snapshot.categories },
    "sharedBase/space-index/versions/3": { version: 3, chunks: 2 }
  };
  const get = async (p) => docs[p] || null;
  assert.deepStrictEqual((await bsi.reassembleVersion(get, 2)).snapshot, snapshot);
  assert.strictEqual((await bsi.reassembleVersion(get, 1)).snapshot.tricks.length, 2);
  await assert.rejects(bsi.reassembleVersion(get, 3), /chunk missing/);
});

test("buildIndexJson: shape, guest scope", () => {
  const out = bsi.buildIndexJson(5, snapshot, "v5 note", new Date("2026-01-02T03:04:05Z"));
  assert.strictEqual(out.version, 5);
  assert.strictEqual(out.label, "v5 note");
  assert.strictEqual(out.generatedAt, "2026-01-02T03:04:05.000Z");
  assert.strictEqual(out.entries.length, 2);
  const e = out.entries.find((x) => x.id === "a000001");
  assert.deepStrictEqual(e.locs, [{ spaceId: "t00", path: ["c1"] }]);
  assert.ok(e.romaji.length > 0);
  assert.deepStrictEqual(out.tags, [{ id: "g1", kind: "text", name: nm("入門", "", "Beginner") }]);
  assert.ok(!("label" in bsi.buildIndexJson(5, snapshot)));
});

test("placeholder data/search-index.json is valid and unusable", () => {
  const j = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data/search-index.json"), "utf8"));
  const c = load(["js/61-search-index.js"]);
  assert.ok(Array.isArray(j.entries) && Array.isArray(j.tags));
  assert.strictEqual(c.validSearchJson(j), false);
});

test("client: gating + merge", () => {
  const c = load(["js/61-search-index.js"]);
  const j = { version: 5, entries: [{ id: "x" }], tags: [] };
  assert.strictEqual(c.searchJsonUsable(j, 5, false), true);
  assert.strictEqual(c.searchJsonUsable(j, 4, false), true);
  assert.strictEqual(c.searchJsonUsable(j, 6, false), false);    // json older than viewed base
  assert.strictEqual(c.searchJsonUsable(j, null, false), false); // unknown viewing version
  assert.strictEqual(c.searchJsonUsable(j, 5, true), false);     // admin bypass
  assert.strictEqual(c.searchJsonUsable(null, 5, false), false);
  assert.strictEqual(c.searchJsonUsable({ version: 0, entries: [] }, 0, false), false);

  const mem = [{ id: "a", shown: "mem" }, { id: "own", custom: true }];
  const json = [{ id: "a", shown: "json" }, { id: "b" }, { id: "gone" }];
  const m = Array.from(c.mergeSearchIndex(json, mem, (id) => id !== "gone"));
  assert.deepStrictEqual(m.map((e) => e.id), ["a", "own", "b"]);
  assert.strictEqual(m[0].shown, "mem");
});

test("client: getSearchIndex uses json only when usable", () => {
  const c = load(["js/01-data-model.js", "js/02-constants-colors-icons.js", "js/03-i18n.js", "js/04-state.js", "js/05-data-helpers.js",
    "js/07-id.js", "js/09-names.js", "js/61-search-index.js"]);
  c.isLoggedIn = () => false;
  c.db = c.normalizeDB(JSON.parse(JSON.stringify(snapshot)));
  c.invalidateDbIndex();
  const ent = (id, shown) => ({ id, names: nm(), romaji: "", shown, grip: null, parts: [], tagIds: [], locs: [], custom: false });
  c.searchJson = { version: 5, entries: [ent("a000001", "J"), ent("zzz", "Z")], tags: [{ id: "g9", name: nm("九") }] };
  c._lastSeenPointer = { latestVersion: 3 };
  c._currentViewingVersion = 3;
  const idx = c.getSearchIndex();
  assert.deepStrictEqual(Array.from(idx.map((e) => e.id)).sort(), ["a000001", "a000002"]); // zzz dropped (no trick), mem wins
  assert.notStrictEqual(idx.find((e) => e.id === "a000001").shown, "J");
  assert.deepStrictEqual(Array.from(c.searchTagLookup().g9), ["九"]);
  c._currentViewingVersion = 9; // json too old -> in-memory only
  assert.strictEqual(c.getSearchIndex().length, 2);
});
