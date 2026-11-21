"use strict";
const test = require("node:test");
const assert = require("node:assert");
const { load } = require("./_load");

function setup(){
  return load(["js/01-data-model.js", "js/01-data-storage.js", "js/50-sync-core.js", "js/53-sync-chunks.js"], { localize: (n) => n && n.zh });
}

test("split/join round-trips ASCII, CJK and emoji", () => {
  const c = setup();
  const s = "招式🥋ABC日本語".repeat(5000) + "😀";
  for(const size of [7, 1000, 200000]){
    const parts = Array.from(c.splitPayload(s, size));
    assert.strictEqual(c.joinChunks(parts), s);
    parts.forEach((p) => assert.ok(p.length <= size));
  }
});

test("split never cuts a surrogate pair", () => {
  const c = setup();
  const parts = Array.from(c.splitPayload("a😀😀😀😀", 2));
  parts.forEach((p) => {
    const last = p.charCodeAt(p.length - 1);
    assert.ok(!(last >= 0xD800 && last <= 0xDBFF), "lone high surrogate at chunk end");
  });
  assert.strictEqual(parts.join(""), "a😀😀😀😀");
});

test("empty payload still yields one chunk; chunk stays under 1MB in UTF-8", () => {
  const c = setup();
  assert.strictEqual(c.splitPayload("").length, 1);
  assert.ok(c.utf8Bytes("字".repeat(200000)) <= 800000);
  assert.strictEqual(c.splitPayload("字".repeat(450000)).length, 3);
});

test("staleChunkIndexes", () => {
  const c = setup();
  assert.deepStrictEqual(Array.from(c.staleChunkIndexes(4, 2)), ["2", "3"]);
  assert.deepStrictEqual(Array.from(c.staleChunkIndexes(2, 2)), []);
  assert.deepStrictEqual(Array.from(c.staleChunkIndexes(undefined, 1)), []);
});

test("hashString changes with content", () => {
  const c = setup();
  assert.strictEqual(c.hashString("abc"), c.hashString("abc"));
  assert.notStrictEqual(c.hashString("abc"), c.hashString("abd"));
});

test("planBatches keeps order and respects limits", () => {
  const c = setup();
  const ops = [];
  for(let i = 0; i < 7; i++) ops.push({ kind: "set", path: "p" + i, bytes: 400 });
  const b = Array.from(c.planBatches(ops, 1000, 100)).map((x) => Array.from(x));
  assert.deepStrictEqual(b.map((x) => x.length), [2, 2, 2, 1]);
  assert.deepStrictEqual(b.flat().map((o) => o.path), ops.map((o) => o.path));
  assert.strictEqual(Array.from(c.planBatches(ops, 1e9, 3)).length, 3);
});

test("buildChunkedOps: chunks, header with count, stale deletes", () => {
  const c = setup();
  const ops = Array.from(c.buildChunkedOps("users/u/spaceData/t00", "x".repeat(450000), { schema: 3, hash: "h" }, 5));
  const sets = ops.filter((o) => o.kind === "set");
  assert.strictEqual(sets.length, 4); // 3 chunks + header
  assert.strictEqual(sets[3].path, "users/u/spaceData/t00");
  assert.strictEqual(sets[3].data.chunks, 3);
  assert.deepStrictEqual(ops.filter((o) => o.kind === "delete").map((o) => o.path),
    ["users/u/spaceData/t00/chunks/3", "users/u/spaceData/t00/chunks/4"]);
});
