"use strict";
const test = require("node:test");
const assert = require("node:assert");
const { load } = require("../_load");

let seq = 0;
function setup(){
  seq = 0;
  // nextId stub: unique, deterministic
  const ctx = load(
    ["js/01-data-model.js", "js/01-data-storage.js", "js/02-constants-colors-icons.js", "js/04-state.js", "js/05-data-helpers.js", "js/05-data-ops.js", "js/05-data-util.js"],
    { localize: (n) => n && n.zh, nextId: (taken) => { let id; do { id = "id" + (++seq); } while(taken && taken(id)); return id; } }
  );
  return ctx;
}
const names = (arr) => Array.from(arr.map((x) => x.id));

test("normalizeDB fills trick defaults", () => {
  const ctx = setup();
  const d = ctx.normalizeDB({ categories: [], tricks: [{ id: "x" }] });
  const t = d.tricks[0];
  assert.deepStrictEqual(JSON.parse(JSON.stringify(t.tagIds)), []);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(t.parts)), []);
  assert.strictEqual(t.grip, null);
  assert.strictEqual(t.rate, null);
  assert.strictEqual(t.landed, false);
  assert.strictEqual(t.favorite, false);
  assert.strictEqual(t.custom, false);
  assert.strictEqual(t.officialNote, undefined);
  assert.strictEqual(t.note, "");
  assert.ok(!("proficiency" in t));
  assert.strictEqual(d.infos.length, 0);
  assert.strictEqual(d.tags.length, 0);
  assert.deepStrictEqual(Array.from(d.spaces.map((s) => s.id)), ["t00", "t01", "t02", "t03", "fav"]);
});

test("normalizeDB validates grip/parts/rate and keeps first 3 videos, drops non-video media", () => {
  const ctx = setup();
  const media = [1, 2, 3, 4, 5].map((n) => ({ id: "m" + n, type: "video", url: "https://e.com/" + n }));
  media.unshift({ id: "n", type: "note", content: "hi" });
  const t = ctx.normalizeDB({ categories: [], tricks: [{ id: "x", media, grip: "bad", rate: "most", parts: ["ana", "zzz", "kensaki"] }] }).tricks[0];
  assert.strictEqual(ctx.MAX_VIDEOS, 3);
  assert.deepStrictEqual(Array.from(t.media.map((m) => m.id)), ["m1", "m2", "m3"]);
  assert.strictEqual(t.note, "");
  assert.strictEqual(t.grip, null);
  assert.strictEqual(t.rate, "most");
  assert.deepStrictEqual(Array.from(t.parts), ["kensaki", "ana"]);
});

test("fav virtual folders list starred / custom", () => {
  const ctx = setup();
  ctx.db = ctx.normalizeDB({ categories: [], tricks: [
    { id: "a", favorite: true, categoryIds: ["t00"] },
    { id: "b", custom: true, categoryIds: ["t01"] },
    { id: "c", categoryIds: [ctx.FAV_CUSTOM_ID] },
    { id: "d", favorite: true, custom: true, categoryIds: [ctx.FAV_CUSTOM_ID] }
  ] });
  ctx.state.activeSpace = "fav";
  const root = ctx.getChildren(null);
  assert.deepStrictEqual(names(root), ["fav-starred", "fav-custom", "fav-external"]); // + fixed real folder (v0.9.1)
  assert.ok(root.slice(0, 2).every((c) => c.virtual === true));
  assert.deepStrictEqual(names(ctx.getTricksInCategory("fav-starred")), ["a", "d"]);
  assert.deepStrictEqual(names(ctx.getTricksInCategory("fav-custom")), ["b", "c", "d"]); // d once
  ctx.toggleFavorite("b");
  assert.ok(ctx.isFavorite("b"));
  assert.deepStrictEqual(names(ctx.getTricksInCategory("fav-starred")), ["a", "b", "d"]);
});

test("canAddChild level limits", () => {
  const ctx = setup();
  ctx.db = ctx.normalizeDB({
    categories: [
      { id: "f1", parentId: null, spaceId: "t00" }, { id: "f2", parentId: "f1", spaceId: "t00" },
      { id: "f3", parentId: "f2", spaceId: "t00" }
    ],
    tricks: [
      { id: "v3", categoryIds: ["f3"] },       // level 4
      { id: "r", categoryIds: ["t00"] },        // root trick, level 1
      { id: "rv", categoryIds: ["r"] }          // variant, level 2
    ],
    infos: [{ id: "i1", parentId: "f1", spaceId: "t00" }]
  });
  assert.strictEqual(ctx.levelOf(null), 0);
  assert.strictEqual(ctx.levelOf("f1"), 1);
  assert.strictEqual(ctx.levelOf("f3"), 3);
  assert.strictEqual(ctx.levelOf("v3"), 4);
  assert.strictEqual(ctx.levelOf("rv"), 2);
  assert.strictEqual(ctx.canAddChild(null, "folder"), true);
  assert.strictEqual(ctx.canAddChild("f2", "folder"), true);   // level 3
  assert.strictEqual(ctx.canAddChild("f3", "folder"), false);  // would be level 4
  assert.strictEqual(ctx.canAddChild("f3", "trick"), true);    // level 4
  assert.strictEqual(ctx.canAddChild("f3", "info"), true);
  assert.strictEqual(ctx.canAddChild("v3", "trick"), false);   // level 5 (variant of level-4 trick)
  assert.strictEqual(ctx.canAddChild("r", "trick"), true);     // variant at level 2
  assert.strictEqual(ctx.canAddChild("i1", "trick"), false);
  assert.strictEqual(ctx.getInfosIn("f1").length, 1);
});

test("custom table codes: 0a.., reuse, cap 26", () => {
  const ctx = setup();
  const a = ctx.createSpace({ name: { zh: "A" } });
  const b = ctx.createSpace({ name: { zh: "B" } });
  assert.deepStrictEqual([a.code, b.code], ["0a", "0b"]);
  assert.strictEqual(a.locked, false);
  ctx.db.spaces = ctx.db.spaces.filter((s) => s.id !== a.id);
  assert.strictEqual(ctx.createSpace({}).code, "0a"); // reused
  while(ctx.db.spaces.length - 5 < 26) assert.ok(ctx.createSpace({}));
  assert.strictEqual(ctx.createSpace({}), null);
  assert.strictEqual(ctx.canAddCustomSpace(), false);
  const codes = ctx.db.spaces.filter((s) => s.code && /^0[a-z]$/.test(s.code)).map((s) => s.code);
  assert.strictEqual(new Set(codes).size, 26);
  // normalize keeps codes stable
  const re = ctx.normalizeDB({ categories: [], tricks: [], spaces: ctx.db.spaces });
  assert.deepStrictEqual(Array.from(re.spaces.map((s) => s.code)).sort(), Array.from(ctx.db.spaces.map((s) => s.code)).sort());
});

test("table permissions and undeletable", () => {
  const ctx = setup();
  assert.strictEqual(ctx.canEditTable("fav"), true);
  assert.strictEqual(ctx.canEditTable("t01"), false);
  ctx.isAdminAccount = () => true;
  assert.strictEqual(ctx.canEditTable("t01"), true);
  assert.strictEqual(ctx.canAddCustomTrick("t02"), true);
  assert.strictEqual(ctx.canAddCustomTrick("fav"), false);
  ["t00", "t01", "t02", "t03", "fav"].forEach((id) => assert.ok(ctx.isUndeletableSpace(id)));
});

test("removeTrickPlacement keeps entity until last placement", () => {
  const ctx = setup();
  ctx.db = ctx.normalizeDB({
    categories: [{ id: "c1", parentId: null, spaceId: "t00" }, { id: "c2", parentId: null, spaceId: "t00" }],
    tricks: [{ id: "t", categoryIds: ["c1", "c2"] }, { id: "v", categoryIds: ["t"] }],
    infos: [{ id: "i", parentId: "t", spaceId: "t00" }]
  });
  ctx.removeTrickPlacement("t", "c1");
  assert.ok(ctx.getTrick("t"));
  assert.deepStrictEqual(Array.from(ctx.getTrick("t").categoryIds), ["c2"]);
  ctx.removeTrickPlacement("t", "c2");
  assert.strictEqual(ctx.getTrick("t"), undefined);
  assert.strictEqual(ctx.getTrick("v"), undefined); // variant had only that placement
  assert.strictEqual(ctx.db.infos.length, 0);
});

test("removeTag strips tagIds", () => {
  const ctx = setup();
  const g1 = ctx.addTag({ zh: "x" }), g2 = ctx.addTag({ zh: "y" });
  assert.notStrictEqual(g1.id, g2.id);
  ctx.db.tricks = ctx.normalizeDB({ categories: [], tricks: [{ id: "a", tagIds: [g1.id, g2.id] }, { id: "b", tagIds: [g1.id] }] }).tricks;
  ctx.removeTag(g1.id);
  assert.strictEqual(ctx.getTag(g1.id), undefined);
  assert.deepStrictEqual(Array.from(ctx.db.tricks[0].tagIds), [g2.id]);
  assert.deepStrictEqual(Array.from(ctx.db.tricks[1].tagIds), []);
});

test("grip groups: categories + subs are valid, helpers map sub -> category", () => {
  const ctx = setup();
  assert.strictEqual(ctx.GRIP_KEYS.length, 3 + 8 + 2 + 4);
  ["ken", "tama", "ito", "ken_sara", "tama_stunt", "ito_tornado"].forEach((k) => assert.ok(ctx.GRIP_KEYS.indexOf(k) !== -1, k));
  assert.strictEqual(ctx.gripCategoryOf("ken_down"), "ken");
  assert.strictEqual(ctx.gripCategoryOf("tama_stunt"), "tama");
  assert.strictEqual(ctx.gripCategoryOf("ito"), "ito");
  assert.strictEqual(ctx.gripCategoryOf("nope"), null);
  assert.strictEqual(ctx.isGripCategory("tama"), true);
  assert.strictEqual(ctx.isGripCategory("tama_tama"), false);
});

test("gripMatches: equal, or category filter matches its subs", () => {
  const ctx = setup();
  assert.strictEqual(ctx.gripMatches("ken_sara", "ken_sara"), true);
  assert.strictEqual(ctx.gripMatches("ken_sara", "ken"), true);
  assert.strictEqual(ctx.gripMatches("ken", "ken"), true);
  assert.strictEqual(ctx.gripMatches("ken_sara", "ken_gun"), false);   // sub filter is exact
  assert.strictEqual(ctx.gripMatches("ken", "ken_sara"), false);       // unspecified trick does not match a sub filter
  assert.strictEqual(ctx.gripMatches("tama_tama", "ken"), false);
  assert.strictEqual(ctx.gripMatches(null, "ken"), false);
  assert.strictEqual(ctx.gripMatches(null, null), true);
});

test("normalizeDB keeps sub-grips and old category values, drops unknown", () => {
  const ctx = setup();
  const g = (grip) => ctx.normalizeDB({ categories: [], tricks: [{ id: "x", grip }] }).tricks[0].grip;
  assert.strictEqual(g("ken_stall"), "ken_stall");
  assert.strictEqual(g("ito"), "ito");
  assert.strictEqual(g("ken_bogus"), null);
});

test("t03 (各式資料): public, locked, undeletable, code 03", () => {
  const ctx = setup();
  const s = ctx.db.spaces.find((x) => x.id === "t03");
  assert.ok(s && s.locked && s.code === "03");
  assert.ok(ctx.isUndeletableSpace("t03"));
  assert.ok(ctx.GUEST_SPACE_IDS.indexOf("t03") >= 0);
  assert.ok(ctx.SHARED_BASE_TABLE_IDS === undefined || ctx.SHARED_BASE_TABLE_IDS.indexOf("t03") >= 0);
});
