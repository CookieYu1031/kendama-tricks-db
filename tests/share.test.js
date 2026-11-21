// Share (js/58-share.js): link parse / doc id, payload build / sanitize / size cap, remap, apply into 收藏/外部匯入, dedup, depth.
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const { load } = require("./_load");

function setup(){
  const ctx = load(["js/01-data-model.js", "js/01-data-storage.js", "js/02-constants-colors-icons.js", "js/03-i18n.js", "js/04-state.js", "js/05-data-helpers.js", "js/05-data-ops.js", "js/05-data-util.js",
    "js/06-icons-svg.js", "js/07-id.js", "js/20-browse-order.js", "js/26-browse-fab.js", "js/58-share.js", "js/58-share-flow.js"], { URL });
  ctx.saveDB = () => {};
  ctx.undoPush = () => {};
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
      { id: "own0001", name: nm("own"), categoryIds: ["c2"], media: [{ id: "v1", type: "video", url: "https://youtu.be/abc" }, { id: "v2", type: "video", url: "javascript:alert(1)" }], favorite: true, rate: "most", note: "private" },
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
const U = "AbCdEf0123456789xyzABCDEFGH1";
const KEY = U + "_c1";

test("link parse / build / doc id", () => {
  const c = setup();
  assert.deepStrictEqual(J(c.shareParseLink("?s=" + U + "&i=abc1234")), { s: U, i: "abc1234" });
  assert.deepStrictEqual(J(c.shareParseLink("?x=1&i=t00&s=" + U)), { s: U, i: "t00" });
  assert.deepStrictEqual(J(c.shareParseLink("?s=" + U + "&i=fav-external_1")), { s: U, i: "fav-external_1" });
  assert.strictEqual(c.shareParseLink("?s=" + U), null);
  assert.strictEqual(c.shareParseLink("?i=abc1234"), null);
  assert.strictEqual(c.shareParseLink("?s=bad&i=abc1234"), null);
  assert.strictEqual(c.shareParseLink("?s=" + U + "&i=../x"), null);
  assert.strictEqual(c.shareParseLink("?s=" + U + "&i=%E0%A4%A"), null);
  assert.strictEqual(c.shareParseLink(""), null);
  assert.strictEqual(c.shareUrlFor(U, "abc1234"), "https://kendama-tricks-db.web.app/?s=" + U + "&i=abc1234");
  assert.strictEqual(c.shareDocId(U, "abc1234"), U + "_abc1234");
  assert.strictEqual(c.shareDocId(U, "a/b"), null);
  assert.strictEqual(c.shareDocId("x", "abc1234"), null);
  assert.strictEqual(c.shareDocId(U, "x".repeat(41)), null);
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
  assert.ok(!tr.officialNote); // v0.9.3: official note feature removed
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

function folderPayload(c){ return J(c.shareBuildFolderPayload("folder", "c1")); }

test("remap: fresh ids, root under the external folder, base refs kept, missing base dropped", () => {
  const c = setup();
  const p = J(c.shareSanitizePayload(folderPayload(c), 1));
  let n = 0;
  const r = c.shareRemap(p, () => "f" + (++n), "fav", (id) => id === "base001", "EXT");
  const ids = r.cats.map((x) => x.id).concat(r.infos.map((x) => x.id), r.tricks.map((x) => x.id));
  assert.strictEqual(new Set(ids).size, ids.length);
  ids.forEach((id) => assert.match(id, /^f\d+$/));
  assert.strictEqual(r.cats[0].parentId, "EXT");
  assert.strictEqual(r.cats[1].parentId, r.cats[0].id);
  assert.strictEqual(r.rootId, r.cats[0].id);
  assert.ok(r.cats.every((x) => x.spaceId === "fav"));
  assert.strictEqual(r.refs.length, 1);
  assert.strictEqual(r.refs[0].trickId, "base001");
  assert.strictEqual(r.refs[0].containerId, r.cats[0].id);
  assert.strictEqual(c.shareRemap(p, () => "z" + (++n), "fav", () => false, "EXT").refs.length, 0);
});

test("apply folder: lands in 收藏/外部匯入/<folder>, fresh ids, tagged, personal fields not copied", () => {
  const c = setup();
  const nCats = c.db.categories.length, nTricks = c.db.tricks.length;
  const res = c.shareApply(folderPayload(c), KEY);
  assert.strictEqual(res.ok, true);
  assert.strictEqual(res.dup, false);
  assert.strictEqual(res.nav.kind, "folder");
  const ext = c.db.categories.find((x) => x.id === "fav-external");
  assert.ok(ext && ext.parentId === null && ext.spaceId === "fav");
  assert.ok(ext.name.zh === "外部匯入" && ext.name.jp && ext.name.en);
  assert.strictEqual(c.db.categories.length, nCats + 2); // c1 + c2 copies (external folders are permanent)
  const root = c.db.categories.find((x) => x.id === res.nav.id);
  assert.strictEqual(root.parentId, "fav-external");
  assert.strictEqual(root.sharedFrom, KEY);
  assert.notStrictEqual(root.id, "c1");
  assert.strictEqual(c.db.tricks.length, nTricks + 1);
  const copy = c.db.tricks[c.db.tricks.length - 1];
  assert.notStrictEqual(copy.id, "own0001");
  assert.strictEqual(copy.favorite, false);
  assert.strictEqual(copy.note, "");
  assert.strictEqual(copy.rate, null);
  assert.strictEqual(c.getTrick("base001").categoryIds.length, 3); // base ref gained a placement
  // sharedFrom survives normalizeDB (sync / reload)
  assert.strictEqual(c.normalizeDB(J(c.db)).categories.find((x) => x.id === root.id).sharedFrom, KEY);
});

test("apply trick: 收藏/外部匯入/單招式/<trick>, tagged on the trick", () => {
  const c = setup();
  const k = U + "_cus0001";
  const res = c.shareApply(J(c.shareBuildTrickPayload("cus0001")), k);
  assert.strictEqual(res.ok, true);
  assert.strictEqual(res.nav.kind, "trick");
  const single = c.db.categories.find((x) => x.id === "fav-external-single");
  assert.strictEqual(single.parentId, "fav-external");
  assert.strictEqual(single.name.zh, "單招式");
  assert.ok(c.db.categories.find((x) => x.id === "fav-external"));
  const tr = c.getTrick(res.nav.id);
  assert.deepStrictEqual(J(tr.categoryIds), ["fav-external-single"]);
  assert.strictEqual(tr.custom, false);
  assert.strictEqual(tr.sharedFrom, k);
  assert.notStrictEqual(tr.id, "cus0001");
  assert.strictEqual(c.normalizeDB(J(c.db)).tricks.find((x) => x.id === tr.id).sharedFrom, k);
});

test("base trick share: reference payload, applied into 單招式, dedup by placement", () => {
  const c = setup();
  const p = J(c.shareBuildBaseTrickPayload(c.getTrick("base001")));
  assert.strictEqual(p.kind, "trick");
  assert.deepStrictEqual(p.refs, [{ trickId: "base001", c: null, o: null }]);
  assert.strictEqual(p.tricks.length, 0);
  assert.ok(c.shareSanitizePayload(p));
  const n0 = c.db.tricks.length;
  const r = c.shareApply(p, U + "_base001");
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.dup, false);
  assert.deepStrictEqual(J(r.nav), { kind: "trick", id: "base001" });
  assert.strictEqual(c.db.tricks.length, n0); // reference, no copy
  assert.ok(c.getTrick("base001").categoryIds.indexOf("fav-external-single") !== -1);
  const snap = JSON.stringify(c.db);
  const r2 = c.shareApply(J(p), U + "_base001");
  assert.strictEqual(r2.dup, true);
  assert.strictEqual(JSON.stringify(c.db), snap);
  p.refs[0].trickId = "nope0000";
  assert.strictEqual(c.shareApply(p, U + "_nope").ok, false);
});

test("drawer foot: share (link) + variant + delete; guest has no share", () => {
  const c = setup();
  const mk = () => ({ className: "", children: [], innerHTML: "", style: {}, appendChild(x){ this.children.push(x); }, addEventListener(){}, setAttribute(){} });
  c.document = { createElement: mk };
  c.escapeHtml = (s) => s;
  const files = require("fs").readFileSync(require("path").join(__dirname, "..", "js/31-drawer-sections.js"), "utf8");
  assert.ok(/ICON_LINK/.test(files) && !/ICON_SHARE/.test(files));
  c.isGuest = () => false;
  c.openAddModal = () => {}; c.requestDeleteTrick = () => {};
  const vm = require("vm");
  vm.runInContext(files, c);
  const f = c.buildDrawerEditFoot(c.getTrick("own0001"), true);
  assert.strictEqual(f.children.length, 3);
  assert.ok(/col-add-btn-share/.test(f.children[0].className));
  assert.ok(/col-add-btn-variant/.test(f.children[1].className));
  assert.ok(/col-add-btn-del/.test(f.children[2].className));
  assert.strictEqual(c.buildDrawerEditFoot(c.getTrick("base001"), false).children.length, 1);
  c.isGuest = () => true;
  assert.strictEqual(c.buildDrawerEditFoot(c.getTrick("base001"), false), null);
  assert.strictEqual(c.buildDrawerEditFoot(c.getTrick("own0001"), true).children.length, 2);
});

test("dedup: second apply changes nothing and points at the first copy", () => {
  const c = setup();
  const r1 = c.shareApply(folderPayload(c), KEY);
  const snap = JSON.stringify(c.db);
  const r2 = c.shareApply(folderPayload(c), KEY);
  assert.strictEqual(r2.ok, true);
  assert.strictEqual(r2.dup, true);
  assert.deepStrictEqual(J(r2.nav), { kind: "folder", id: r1.nav.id });
  assert.strictEqual(JSON.stringify(c.db), snap);
  const t1 = c.shareApply(J(c.shareBuildTrickPayload("cus0001")), "U_cus0001");
  const snap2 = JSON.stringify(c.db);
  const t2 = c.shareApply(J(c.shareBuildTrickPayload("cus0001")), "U_cus0001");
  assert.strictEqual(t2.dup, true);
  assert.strictEqual(t2.nav.id, t1.nav.id);
  assert.strictEqual(JSON.stringify(c.db), snap2);
});

test("depth: copied folder is level 2, so deeper nodes are cut and reported", () => {
  const c = setup();
  const cat = (n, par) => ({ id: "d" + n, parentId: par, name: { zh: "d" + n }, order: 0 });
  const deep = { v: 1, kind: "folder", name: { zh: "deep" }, cats: [cat(1, null), cat(2, "d1"), cat(3, "d2"), cat(4, "d3")],
    infos: [{ id: "n1", parentId: "d2", title: {}, content: "", order: 0 }, { id: "n2", parentId: "d3", title: {}, content: "", order: 0 }],
    tricks: [{ id: "t1", name: { zh: "t" }, media: [], placements: [{ c: "d2", o: null }] }, { id: "t2", name: { zh: "t" }, media: [], placements: [{ c: "d3", o: null }] }], refs: [] };
  // d1 = level 2, d2 = 3; d3 would be 4 (folders max 3) -> cut with d4; items in d2 = level 4 ok; items in d3 cut
  const sx = c.shareSanitizeEx(J(deep), 1);
  assert.deepStrictEqual(J(sx.p.cats.map((x) => x.id)), ["d1", "d2"]);
  assert.deepStrictEqual(J(sx.p.infos.map((x) => x.id)), ["n1"]);
  assert.deepStrictEqual(J(sx.p.tricks.map((x) => x.id)), ["t1"]);
  assert.strictEqual(sx.dropped, 4);
  const res = c.shareApply(J(deep), "U_deep");
  assert.strictEqual(res.ok, true);
  assert.strictEqual(res.truncated, true);
  assert.strictEqual(c.shareApply(folderPayload(c), KEY).truncated, false);
});

test("space share becomes a wrapper folder named after the table", () => {
  const c = setup();
  const res = c.shareApply(J(c.shareBuildFolderPayload("space", "u1")), "U_u1");
  assert.strictEqual(res.ok, true);
  const root = c.db.categories.find((x) => x.id === res.nav.id);
  assert.strictEqual(root.name.zh, "mine");
  assert.strictEqual(root.parentId, "fav-external");
  assert.ok(c.db.categories.some((x) => x.parentId === root.id && x.name.zh === "c1"));
});

test("apply refuses garbage and creates nothing", () => {
  const c = setup();
  const n0 = c.db.categories.length;
  assert.strictEqual(c.shareApply({ v: 9 }, "U_x").ok, false);
  assert.strictEqual(c.shareApply(null, "U_x").ok, false);
  assert.ok(c.db.categories.some((x) => x.id === "fav-external")); // permanent, but nothing new added
  assert.strictEqual(c.db.categories.length, n0);
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
  const rd = (f) => require("fs").readFileSync(require("path").join(__dirname, "..", "js", f), "utf8");
  const src = rd("58-share.js") + rd("58-share-flow.js");
  const keys = Array.from(new Set((src.match(/\b(?:t|res\.err)\("(share[A-Za-z]+)"\)|"(share[A-Z][A-Za-z]+)"/g) || []).map((m) => m.replace(/^.*?"(share\w+)".*$/, "$1")))).filter((k) => !/^share(Ex|Sanitize)/.test(k));
  assert.ok(keys.indexOf("shareDup") !== -1 && keys.indexOf("shareAdded") !== -1);
  ["zh", "jp", "en"].forEach((lang) => {
    c.state.lang = lang;
    keys.forEach((k) => assert.notStrictEqual(c.t(k), k, lang + ":" + k));
  });
});
