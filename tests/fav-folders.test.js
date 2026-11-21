// 收藏 table fixed folders (外部匯入 / 單招式) and the creation rule canCreateIn (v0.9.1).
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const { load } = require("./_load");

function setup(){
  const ctx = load(["js/01-data-model.js", "js/01-data-storage.js", "js/02-constants-colors-icons.js", "js/03-i18n.js", "js/04-state.js", "js/05-data-helpers.js", "js/05-data-ops.js", "js/05-data-util.js",
    "js/06-icons-svg.js", "js/07-id.js", "js/20-browse-order.js", "js/22-browse-drag.js", "js/25-browse-clipboard.js", "js/26-browse-fab.js", "js/47-modal-add.js"]);
  ctx.saveDB = () => {};
  const nm = (z) => ({ zh: z, jp: "", en: "" });
  ctx.db = ctx.normalizeDB({
    spaces: [{ id: "u1", code: "0a", name: nm("mine"), order: 5 }],
    categories: [{ id: "c1", parentId: null, spaceId: "u1", name: nm("c1"), order: 0 },
      { id: "imp1", parentId: "fav-external", spaceId: "fav", name: nm("imported"), order: 1 }],
    tricks: [{ id: "cus0001", name: nm("custom"), categoryIds: ["fav-custom"], custom: true }], infos: [], tags: []
  });
  ctx.invalidateDbIndex();
  ctx.state.activeSpace = "fav";
  return ctx;
}
const ids = (l) => JSON.parse(JSON.stringify(l.map((x) => x.id)));

test("fixed folders exist after normalize, named zh/jp/en, in order", () => {
  const c = setup();
  assert.deepStrictEqual(ids(c.getChildren(null)), ["fav-starred", "fav-custom", "fav-external"]);
  const ext = c.getCategory("fav-external"), single = c.getCategory("fav-external-single");
  assert.deepStrictEqual(JSON.parse(JSON.stringify(ext.name)), { zh: "外部匯入", jp: "外部インポート", en: "Imported" });
  assert.deepStrictEqual(JSON.parse(JSON.stringify(single.name)), { zh: "單招式", jp: "単体の技", en: "Single tricks" });
  assert.strictEqual(single.parentId, "fav-external");
  assert.deepStrictEqual(ids(c.getChildren("fav-external")).sort(), ["fav-external-single", "imp1"]);
  assert.strictEqual(c.getTricksInCategory("fav-custom").length, 1); // old direct tricks still shown
});

test("normalize restores a deleted / renamed fixed folder, idempotent", () => {
  const c = setup();
  const raw = JSON.parse(JSON.stringify(c.db));
  raw.categories = raw.categories.filter((x) => x.id !== "fav-external-single");
  raw.categories.find((x) => x.id === "fav-external").name = { zh: "外部招式", jp: "", en: "" };
  const d = c.normalizeDB(raw);
  assert.strictEqual(d.categories.find((x) => x.id === "fav-external").name.zh, "外部匯入");
  assert.ok(d.categories.some((x) => x.id === "fav-external-single"));
  assert.strictEqual(c.normalizeDB(JSON.parse(JSON.stringify(d))).categories.length, d.categories.length);
  assert.ok(c.isFixedFavFolder("fav-external") && c.isFixedFavFolder("fav-external-single") && !c.isFixedFavFolder("imp1"));
});

test("flat fav view includes 外部匯入 / 單招式 / imported subfolder tricks, deduped", () => {
  const c = setup();
  const nm = (z) => ({ zh: z, jp: "", en: "" });
  c.db = c.normalizeDB(Object.assign(JSON.parse(JSON.stringify(c.db)), {
    categories: c.db.categories.concat([{ id: "imp2", parentId: "imp1", spaceId: "fav", name: nm("deep"), order: 0 }]),
    tricks: c.db.tricks.concat([
      { id: "e1", name: nm("e1"), categoryIds: ["fav-external-single"] },
      { id: "e2", name: nm("e2"), categoryIds: ["imp2", "fav-external-single"], favorite: true },
      { id: "e3", name: nm("e3"), categoryIds: ["fav-external"] },
      { id: "x1", name: nm("x1"), categoryIds: ["c1"] }
    ])
  }));
  c.invalidateDbIndex();
  const got = ids(c.getFlatSpaceTricks("fav")).sort();
  assert.deepStrictEqual(got, ["cus0001", "e1", "e2", "e3"]);
});

test("canCreateIn: blocked in the 收藏 table, allowed elsewhere", () => {
  const c = setup();
  [null, "fav", "fav-starred", "fav-custom", "fav-external", "fav-external-single"].forEach((id) => {
    assert.strictEqual(c.canCreateIn(id, "fav"), false, String(id));
    assert.strictEqual(c.canAddChild(id, "folder"), false, "canAddChild " + id);
    assert.strictEqual(c.canAddChild(id, "trick"), false);
  });
  assert.strictEqual(c.canCreateIn("imp1"), true);          // imported folder: free to edit inside
  assert.strictEqual(c.canCreateIn("c1"), true);            // custom table folder
  assert.strictEqual(c.canCreateIn(null, "u1"), true);      // custom table root
  assert.strictEqual(c.canCreateIn("u1"), true);
  assert.strictEqual(c.canCreateIn(null, "t00"), true);
  c.state.activeSpace = "u1";
  assert.strictEqual(c.canAddChild(null, "folder"), true);
});

test("fab / add modal / paste / drop are blocked in blocked containers", () => {
  const c = setup();
  c.isLoggedIn = () => true;
  ["fav-custom", "fav-external", "fav-external-single", "fav-starred", null].forEach((id) => {
    assert.strictEqual(c.renderColAddRow({ parentId: id }), null, "fab " + id);
    assert.strictEqual(c.addModalTypes(id, "fav", false).def, null, "modal " + id);
  });
  const clip = { mode: "copy", type: "trick", id: "cus0001", srcParent: null, srcSpace: "fav" };
  assert.deepStrictEqual(JSON.parse(JSON.stringify(c.clipPlanPaste(clip, "fav-custom", { admin: false, activeSpace: "fav" }))), { ok: false, err: "favNoCreate" });
  assert.strictEqual(c.clipPlanPaste(clip, "fav-external", { admin: false, activeSpace: "fav" }).err, "favNoCreate");
  const it = { type: "trick", id: "cus0001", ref: c.getTrick("cus0001") };
  assert.strictEqual(c.canReparent(it, "imp1", "fav-external"), false);
  assert.strictEqual(c.canReparent(it, "imp1", "fav-custom"), false);
  assert.strictEqual(c.canReparent(it, "imp1", null), false);
  // moving out of 外部匯入 into a custom table folder stays possible
  c.state.activeSpace = "u1";
  assert.strictEqual(c.canReparent(it, "fav-external", "c1"), true);
  // fixed folders never move
  assert.strictEqual(c.canReparent({ type: "category", id: "fav-external", ref: c.getCategory("fav-external") }, null, "c1"), false);
});

test("fixed folders have no edit pill; imported folder does", () => {
  const c = setup();
  c.isLoggedIn = () => true;
  assert.strictEqual(c.colEditTarget("fav-external", "fav", false), null);
  assert.strictEqual(c.colEditTarget("fav-external-single", "fav", false), null);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(c.colEditTarget("imp1", "fav", false))), { kind: "folder", id: "imp1", parentId: "fav-external" });
});

test("favNoCreate i18n exists in zh/jp/en", () => {
  const c = setup();
  ["zh", "jp", "en"].forEach((l) => { c.state.lang = l; assert.ok(c.t("favNoCreate") && c.t("favNoCreate") !== "favNoCreate", l); });
});
