// Share (js/58-share.js): payload build / sanitize / size cap, remap with fresh ids, base refs, URL param.
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const { load } = require("./_load");

function setup(){
  const ctx = load(["js/01-data-model.js", "js/02-constants-colors-icons.js", "js/03-i18n.js", "js/04-state.js", "js/05-data-helpers.js",
    "js/06-icons-svg.js", "js/07-id.js", "js/20-browse-order.js", "js/26-browse-fab.js", "js/58-share.js"], { URL });
  ctx.saveDB = () => {};
  let seq = 0;
  ctx.newItemId = () => "n" + (++seq);
  const nm = (z) => ({ zh: z, jp: "", en: "" });
  ctx.db = ctx.normalizeDB({
    spaces: [{ id: "u1", code: "0a", name: nm("mine"), order: 5 }],
    categories: [
      { id: "m1", parentId: null, spaceId: "t00", name: nm("base folder"), order: 0 },
      { id: "c1", parentId: null, spaceId: "u1", name: nm("c1"), order: 0, icon: "🔥" },
      { id: "c2", parentId: "c1", spaceId: "u1", name: nm("c2"), order: 0 }
    ],
    tricks: [
      { id: "base001", name: nm("base"), categoryIds: ["m1", "c1"], orderByCategory: { c1: 3 } },
      { id: "own0001", name: nm("own"), categoryIds: ["c2"], media: [{ id: "v1", type: "video", url: "https://youtu.be/abc" }, { id: "v2", type: "video", url: "javascript:alert(1)" }], favorite: true, rate: "most", note: "private", officialNote: "desc" },
      { id: "cus0001", name: nm("custom"), categoryIds: ["fav-custom"], custom: true }
    ],
    infos: [{ id: "i000001", parentId: "c2", spaceId: "u1", title: nm("inf"), content: "hello", order: 0, icon: "", color: "default" }],
    tags: []
  });
  ctx.invalidateDbIndex();
  ctx.state.activeSpace = "u1";
  return ctx;
}
const J = (o) => JSON.parse(JSON.stringify(o));

test("shareParseId: valid / invalid / encoded", () => {
  const c = setup();
  assert.strictEqual(c.shareParseId("?share=Abc12345xyz"), "Abc12345xyz");
  assert.strictEqual(c.shareParseId("?a=1&share=Abc12345"), "Abc12345");
  assert.strictEqual(c.shareParseId("?share=short"), null);
  assert.strictEqual(c.shareParseId("?share=../../etc/passwd1"), null);
  assert.strictEqual(c.shareParseId("?share=%E0%A4%A"), null);
  assert.strictEqual(c.shareParseId(""), null);
  assert.strictEqual(c.shareUrlFor("Abc12345"), "https://kendama-tricks-db.web.app/?share=Abc12345");
});

test("isBaseTrick: placed in locked table = base; own table / custom = not", () => {
  const c = setup();
  assert.strictEqual(c.shareIsBaseTrick(c.getTrick("base001")), true);
  assert.strictEqual(c.shareIsBaseTrick(c.getTrick("own0001")), false);
  assert.strictEqual(c.shareIsBaseTrick(c.getTrick("cus0001")), false);
});

test("build space payload: cats, infos, own trick by value (no personal fields), base as ref", () => {
  const c = setup();
  const p = J(c.shareBuildFolderPayload("space", "u1"));
  assert.strictEqual(p.kind, "space");
  assert.deepStrictEqual(p.cats.map((x) => [x.id, x.parentId]), [["c1", null], ["c2", "c1"]]);
  assert.strictEqual(p.infos.length, 1);
  assert.deepStrictEqual(p.refs, [{ trickId: "base001", c: "c1", o: 3 }]);
  assert.strictEqual(p.tricks.length, 1);
  const tr = p.tricks[0];
  assert.strictEqual(tr.officialNote, "desc");
  assert.deepStrictEqual(tr.media.map((m) => m.url), ["https://youtu.be/abc"]); // unsafe url dropped
  assert.ok(!("favorite" in tr) && !("rate" in tr) && !("note" in tr));
  assert.deepStrictEqual(tr.placements, [{ c: "c2", o: null }]);
});

test("build folder payload: folder is root; refuses locked / default / virtual", () => {
  const c = setup();
  const p = J(c.shareBuildFolderPayload("folder", "c1"));
  assert.strictEqual(p.cats[0].parentId, null);
  assert.strictEqual(p.cats.length, 2);
  assert.strictEqual(c.shareBuildFolderPayload("folder", "m1"), null);
  assert.strictEqual(c.shareBuildFolderPayload("space", "t00"), null);
  assert.strictEqual(c.shareBuildFolderPayload("folder", "fav-custom"), null);
  assert.strictEqual(c.shareBuildTrickPayload("base001"), null);
  const tp = J(c.shareBuildTrickPayload("cus0001"));
  assert.strictEqual(tp.kind, "trick");
  assert.strictEqual(tp.tricks.length, 1);
});

test("sanitize: roundtrip ok, bad shape / version null, caps, orphans and depth dropped", () => {
  const c = setup();
  const p = c.shareBuildFolderPayload("space", "u1");
  const s = J(c.shareSanitizePayload(J(p)));
  assert.strictEqual(s.cats.length, 2);
  assert.strictEqual(c.shareSanitizePayload(null), null);
  assert.strictEqual(c.shareSanitizePayload({ v: 2, kind: "space" }), null);
  assert.strictEqual(c.shareSanitizePayload({ v: 1, kind: "evil" }), null);
  const bad = J(p);
  bad.cats.push({ id: "orph", parentId: "nope", name: {}, order: 0 });
  bad.cats.push({ id: "c1", parentId: null, name: {}, order: 0 }); // duplicate id
  bad.cats[0].name.zh = "x".repeat(500);
  bad.cats[0].icon = "javascript:alert(1)";
  const s2 = J(c.shareSanitizePayload(bad));
  assert.strictEqual(s2.cats.length, 2);
  assert.strictEqual(s2.cats[0].name.zh.length, 80);
  assert.strictEqual(s2.cats[0].icon, "");
  // chain deeper than the folder level limit (3) is cut
  const deep = { v: 1, kind: "space", name: {}, cats: [1, 2, 3, 4, 5].map((n) => ({ id: "d" + n, parentId: n === 1 ? null : "d" + (n - 1), name: {}, order: 0 })), infos: [], tricks: [], refs: [] };
  assert.deepStrictEqual(J(c.shareSanitizePayload(deep)).cats.map((x) => x.id), ["d1", "d2", "d3"]);
});

test("sanitize trick kind keeps exactly one trick, no placements", () => {
  const c = setup();
  const p = J(c.shareBuildTrickPayload("cus0001"));
  p.tricks.push(J(p.tricks[0])); p.tricks[1].id = "other";
  p.cats = [{ id: "x", parentId: null, name: {}, order: 0 }];
  const s = J(c.shareSanitizePayload(p));
  assert.strictEqual(s.tricks.length, 1);
  assert.strictEqual(s.cats.length, 0);
});

test("size cap: serialize null when over 200 KB", () => {
  const c = setup();
  const p = J(c.shareBuildFolderPayload("space", "u1"));
  assert.ok(c.shareSerialize(p));
  p.infos[0].content = "y".repeat(1000);
  for (let i = 0; i < 300; i++) p.infos.push(J(p.infos[0]));
  assert.strictEqual(c.shareSerialize(p), null);
});

test("remap: all ids fresh, parents remapped, base refs kept by id, missing base dropped", () => {
  const c = setup();
  const p = J(c.shareSanitizePayload(J(c.shareBuildFolderPayload("space", "u1"))));
  let n = 0;
  const r = c.shareRemap(p, () => "f" + (++n), "NEW", (id) => id === "base001");
  const ids = r.cats.map((x) => x.id).concat(r.infos.map((x) => x.id), r.tricks.map((x) => x.id));
  assert.strictEqual(new Set(ids).size, ids.length);
  ids.forEach((id) => assert.match(id, /^f\d+$/));
  assert.strictEqual(r.cats[0].parentId, null);
  assert.strictEqual(r.cats[1].parentId, r.cats[0].id);
  assert.ok(r.cats.every((x) => x.spaceId === "NEW"));
  assert.strictEqual(r.infos[0].parentId, r.cats[1].id);
  assert.deepStrictEqual(J(r.tricks[0].categoryIds), [r.cats[1].id]);
  assert.strictEqual(r.refs.length, 1);
  assert.strictEqual(r.refs[0].trickId, "base001");
  assert.strictEqual(r.refs[0].containerId, r.cats[0].id);
  assert.strictEqual(r.refs[0].order, 3);
  assert.strictEqual(c.shareRemap(p, () => "z" + (++n), "NEW", () => false).refs.length, 0);
});

test("apply space share: new custom table, base trick gains placement, items pushed", () => {
  const c = setup();
  const payload = J(c.shareBuildFolderPayload("space", "u1"));
  const nSpaces = c.db.spaces.length, nCats = c.db.categories.length, nTricks = c.db.tricks.length;
  const res = c.shareApply(payload);
  assert.strictEqual(res.ok, true);
  assert.strictEqual(c.db.spaces.length, nSpaces + 1);
  assert.strictEqual(c.db.categories.length, nCats + 2);
  assert.strictEqual(c.db.tricks.length, nTricks + 1); // own trick copied, base trick referenced
  const sp = c.getSpace(res.spaceId);
  assert.ok(sp && !sp.locked);
  const base = c.getTrick("base001");
  assert.strictEqual(base.categoryIds.length, 3);
  const copy = c.db.tricks[c.db.tricks.length - 1];
  assert.notStrictEqual(copy.id, "own0001");
  assert.strictEqual(copy.favorite, false);
  assert.strictEqual(copy.note, "");
  assert.strictEqual(copy.custom, false);
});

test("apply trick share: lands in 收藏 > 自訂義 as custom trick, no new table", () => {
  const c = setup();
  const payload = J(c.shareBuildTrickPayload("cus0001"));
  const nSpaces = c.db.spaces.length;
  const res = c.shareApply(payload);
  assert.strictEqual(res.ok, true);
  assert.strictEqual(res.spaceId, null);
  assert.strictEqual(c.db.spaces.length, nSpaces);
  const copy = c.db.tricks[c.db.tricks.length - 1];
  assert.strictEqual(copy.custom, true);
  assert.deepStrictEqual(J(copy.categoryIds), ["fav-custom"]);
  assert.notStrictEqual(copy.id, "cus0001");
});

test("apply refuses garbage and the 26-table cap", () => {
  const c = setup();
  assert.strictEqual(c.shareApply({ v: 9 }).ok, false);
  const payload = J(c.shareBuildFolderPayload("space", "u1"));
  c.canAddCustomSpace = () => false;
  assert.strictEqual(c.shareApply(payload).err, "shareTableLimit");
});

test("colShareTarget: own folders / custom tables yes; locked / default / guest no", () => {
  const c = setup();
  assert.deepStrictEqual(J(c.colShareTarget("c1", "u1")), { kind: "folder", id: "c1" });
  assert.deepStrictEqual(J(c.colShareTarget(null, "u1")), { kind: "space", id: "u1" });
  assert.strictEqual(c.colShareTarget("m1", "t00"), null);
  assert.strictEqual(c.colShareTarget(null, "t00"), null);
  assert.strictEqual(c.colShareTarget("fav-custom", "fav"), null);
  c.isLoggedIn = () => false;
  assert.strictEqual(c.colShareTarget("c1", "u1"), null);
});

test("i18n: every share string exists in zh/jp/en", () => {
  const c = setup();
  const src = require("fs").readFileSync(require("path").join(__dirname, "..", "js", "58-share.js"), "utf8");
  const keys = Array.from(new Set((src.match(/\bt\("(share[A-Za-z]+)"\)/g) || []).map((m) => m.slice(3, -2)))).concat(["shareBtn", "shareKindTrick", "shareKindFolder"]);
  ["zh", "jp", "en"].forEach((lang) => {
    c.state.lang = lang;
    keys.forEach((k) => assert.notStrictEqual(c.t(k), k, lang + ":" + k));
  });
});
