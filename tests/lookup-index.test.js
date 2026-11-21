"use strict";
const test = require("node:test");
const assert = require("node:assert");
const { load } = require("./_load");

function setup(){
  // 01-data-model builds db via loadDB(); override after load for determinism.
  const ctx = load(["js/01-data-model.js", "js/01-data-storage.js", "js/02-constants-colors-icons.js", "js/05-data-helpers.js", "js/05-data-ops.js", "js/05-data-util.js"], { state: { activeSpace: "s1" } });
  ctx.db = {
    categories: [
      { id: "a", parentId: null, spaceId: "s1" }, { id: "b", parentId: null, spaceId: "s2" },
      { id: "c", parentId: "a", spaceId: "s1" }, { id: "d", parentId: "a", spaceId: "s1" },
      { id: "e", parentId: "t1", spaceId: "s1" }
    ],
    tricks: [
      { id: "t1", categoryIds: ["c", "d"] }, { id: "t2", categoryIds: ["c"] }, { id: "t3", categoryIds: ["t1", "t1"] }
    ],
    spaces: []
  };
  return ctx;
}
const scanChildren = (db, state, p) => db.categories.filter(c => p === null ? (c.parentId === null && c.spaceId === state.activeSpace) : c.parentId === p);
const scanTricks = (db, id) => db.tricks.filter(t => t.categoryIds.indexOf(id) !== -1);

test("index matches linear scan", () => {
  const ctx = setup();
  const ids = ["a", "b", "c", "d", "e", "t1", "t2", "t3", "zz"].concat([null]);
  ids.forEach(id => {
    assert.deepStrictEqual(Array.from(ctx.getChildren(id).map(x => x.id)), scanChildren(ctx.db, ctx.state, id).map(x => x.id));
    if(id !== null) assert.deepStrictEqual(Array.from(ctx.getTricksInCategory(id).map(x => x.id)), scanTricks(ctx.db, id).map(x => x.id));
    if(id !== null){
      assert.strictEqual(ctx.getCategory(id), ctx.db.categories.find(c => c.id === id));
      assert.strictEqual(ctx.getTrick(id), ctx.db.tricks.find(c => c.id === id));
    }
  });
  assert.deepStrictEqual(Array.from(ctx.getTricksInCategory("t1").map(x => x.id)), ["t3"]); // duplicate id counted once
});

test("root children follow activeSpace", () => {
  const ctx = setup();
  assert.deepStrictEqual(Array.from(ctx.getChildren(null).map(x => x.id)), ["a"]);
  ctx.state.activeSpace = "s2";
  assert.deepStrictEqual(Array.from(ctx.getChildren(null).map(x => x.id)), ["b"]);
});

test("invalidated after mutation + saveDB", () => {
  const ctx = setup();
  assert.deepStrictEqual(Array.from(ctx.getTricksInCategory("d").map(x => x.id)), ["t1"]);
  ctx.db.tricks[1].categoryIds.push("d"); // same lengths, no push to arrays
  ctx.saveDB();
  assert.deepStrictEqual(Array.from(ctx.getTricksInCategory("d").map(x => x.id)), ["t1", "t2"]);
  ctx.db.categories[3].parentId = "b";
  ctx.saveDB();
  assert.deepStrictEqual(Array.from(ctx.getChildren("b").map(x => x.id)), ["d"]);
  assert.deepStrictEqual(Array.from(ctx.getChildren("a").map(x => x.id)), ["c"]);
});

test("invalidated after db reassignment and array growth", () => {
  const ctx = setup();
  ctx.getCategory("a");
  ctx.db.categories.push({ id: "n", parentId: "a", spaceId: "s1" });
  assert.ok(ctx.getCategory("n"));
  ctx.db = { categories: [], tricks: [], spaces: [] };
  assert.strictEqual(ctx.getCategory("a"), undefined);
  assert.strictEqual(ctx.getChildren("a").length, 0);
});
