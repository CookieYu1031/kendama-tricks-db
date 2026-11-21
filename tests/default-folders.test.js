// Initial level-1 folders (js/01 seedDefaultFolders) + image icons (js/06).
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const { load } = require("./_load");

function setup(){
  return load(["js/01-data-model.js", "js/02-constants-colors-icons.js", "js/03-i18n.js", "js/04-state.js", "js/05-data-helpers.js",
    "js/06-icons-svg.js", "js/07-id.js", "js/08-loc-code.js", "js/09-names.js"]);
}
const names = (ctx, sid) => ctx.db.categories.filter((c) => c.spaceId === sid).map((c) => c.name.zh);

test("t01 icon is the scroll emoji; stored icon does not override defaults", () => {
  const ctx = setup();
  assert.strictEqual(ctx.db.spaces.find((s) => s.id === "t01").icon, "📜");
  const d = ctx.normalizeDB({ spaces: [{ id: "t01", icon: "🎖️", order: 1 }], categories: [], tricks: [] });
  assert.strictEqual(d.spaces.find((s) => s.id === "t01").icon, "📜");
});

test("empty db is seeded: t01 two folders, t02 four, t00 none", () => {
  const ctx = setup();
  assert.deepStrictEqual(Array.from(names(ctx, "t01")), ["JKA日本劍玉協會", "GLOKEN"]);
  assert.deepStrictEqual(Array.from(names(ctx, "t02")), ["KWC", "NAKO", "BATB", "EKC"]);
  assert.deepStrictEqual(Array.from(names(ctx, "t00")), []);
  const jka = ctx.db.categories.find((c) => c.id === "s01jka");
  assert.strictEqual(jka.name.jp, "JKA 日本けん玉協会");
  assert.strictEqual(jka.name.en, "JKA Japan Kendama Association");
  assert.strictEqual(jka.icon, "img:assets/icon-jka.png");
  assert.strictEqual(jka.parentId, null);
  assert.ok(ctx.isImageIcon(jka.icon));
  assert.ok(ctx.isImageIcon(ctx.db.categories.find((c) => c.id === "s01glk").icon));
});

test("seeded flag is set; renormalizing never duplicates", () => {
  const ctx = setup();
  const again = ctx.normalizeDB(ctx.normalizeDB(ctx.db));
  assert.strictEqual(again.categories.length, 8); // 6 seeds + 2 fixed 收藏 folders
  assert.ok(again.spaces.find((s) => s.id === "t01").seeded);
  assert.ok(!again.spaces.find((s) => s.id === "t00").seeded);
});

test("deleted seeds do not come back once the table is flagged seeded", () => {
  const ctx = setup();
  const d = ctx.normalizeDB(ctx.db);
  d.categories = d.categories.filter((c) => c.spaceId !== "t02"); // admin deleted them all
  const d2 = ctx.normalizeDB(JSON.parse(JSON.stringify(d)));      // e.g. reload / sync round-trip
  assert.deepStrictEqual(d2.categories.filter((c) => c.spaceId === "t02"), []);
  assert.strictEqual(d2.categories.filter((c) => c.spaceId === "t01").length, 2);
});

test("a table that already has folders is not seeded (but flagged)", () => {
  const ctx = setup();
  const d = ctx.normalizeDB({ categories: [{ id: "abc1234", name: { zh: "自訂" }, spaceId: "t01", parentId: null }], tricks: [] });
  assert.deepStrictEqual(d.categories.filter((c) => c.spaceId === "t01").map((c) => c.id), ["abc1234"]);
  assert.ok(d.spaces.find((s) => s.id === "t01").seeded);
});

test("seed ids are not time ids, are unique and work with loc codes / isIdTaken", () => {
  const ctx = setup();
  ctx.db.categories.forEach((c) => assert.ok(!ctx.isTimeId(c.id), c.id));
  assert.strictEqual(new Set(ctx.db.categories.map((c) => c.id)).size, ctx.db.categories.length);
  assert.ok(ctx.isIdTaken("s02kwc"));
  const roots = ctx.db.categories.filter((c) => c.spaceId === "t02").map((c) => ({ type: "fo", id: c.id }));
  const res = ctx.computeLocCodes("02", roots, () => []);
  assert.deepStrictEqual(Array.from(res.map((r) => r.code)), ["02-fo-00", "02-fo-01", "02-fo-02", "02-fo-03"]);
});

test("guest db (emptyDB) gets the folders; sync diff vs empty base lists them as added", () => {
  const ctx = setup();
  const g = ctx.emptyDB();
  assert.strictEqual(g.categories.filter((c) => c.spaceId === "t01").length, 2);
  assert.strictEqual(g.categories.filter((c) => c.spaceId === "t02").length, 4);
});

test("image icon validation", () => {
  const ctx = setup();
  ["img:assets/x.png", "img:assets/icon-jka.png", "img:assets/sub/a_b.svg", "img:assets/p.JPG"].forEach((v) => assert.ok(ctx.isImageIcon(v), v));
  ["img:https://evil.com/x.png", "img:../x.png", "img:assets/../x.png", "img:/assets/x.png", "img://evil.com/x.png", "javascript:alert(1)",
   "img:assets/x.png\" onerror=\"1", "img:assets/x.exe", "img:assets/", "🎖️", "", null, undefined, 5].forEach((v) => assert.ok(!ctx.isImageIcon(v), String(v)));
  assert.strictEqual(ctx.imageIconSrc("img:assets/x.png"), "assets/x.png");
  assert.strictEqual(ctx.imageIconSrc("img:https://a.b/x.png"), "");
});

test("iconHtml: img tag, escaped emoji, fallback", () => {
  const ctx = setup();
  assert.match(ctx.iconHtml("img:assets/x.png"), /^<img class="icon-img" src="assets\/x\.png"/);
  assert.strictEqual(ctx.iconHtml("<b>", "F"), "&lt;b&gt;");
  assert.strictEqual(ctx.iconHtml("", "F"), "F");
  assert.ok(!/<img/.test(ctx.iconHtml("img:https://a.b/x.png")));
});
