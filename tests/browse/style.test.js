// 滴管／油漆（js/25-browse-style.js）：複製、套用、權限、復原、快捷鍵判斷。
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const { load } = require("../_load");

function setup(){
  const ctx = load(["js/01-data-model.js", "js/01-data-storage.js", "js/02-constants-colors-icons.js", "js/03-i18n.js", "js/04-state.js", "js/05-data-helpers.js", "js/05-data-ops.js", "js/05-data-prefix.js", "js/05-data-util.js",
    "js/06-icons-svg.js", "js/07-id.js", "js/09-names.js", "js/20-browse-order.js", "js/22-browse-drag.js", "js/25-browse-clipboard.js", "js/25-browse-multisel.js", "js/28-browse-undo.js", "js/25-browse-style.js"]);
  let saves = 0, renders = 0; const toasts = [];
  ctx.saveDB = () => { saves++; };
  ctx.render = () => { renders++; };
  ctx.showToast = (m) => { toasts.push(m); };
  ctx.isAdminNow = () => false;
  const nm = (z) => ({ zh: z, jp: "", en: "" });
  ctx.db = ctx.normalizeDB({
    categories: [
      { id: "c1", parentId: null, spaceId: "t00", name: nm("c1"), order: 0, icon: "🔥", color: "red" },
      { id: "c2", parentId: null, spaceId: "t00", name: nm("c2"), order: 1 },
      { id: "c3", parentId: null, spaceId: "t00", name: nm("c3"), order: 2, icon: "img:assets/x.png", color: "blue" }
    ],
    tricks: [
      { id: "a000000", name: nm("a"), categoryIds: ["c1"], order: 0, icon: "⭐", color: "green" },
      { id: "b000000", name: nm("b"), categoryIds: ["c1"], order: 1 },
      { id: "d000000", name: nm("d"), categoryIds: ["c1"], order: 2, icon: "x", color: "red" }
    ],
    infos: [], tags: []
  });
  ctx.getSpace("t00").locked = false;
  ctx.invalidateDbIndex();
  ctx.state.activeSpace = "t00";
  ctx.state.editMode = true;
  return Object.assign(ctx, { _n: () => ({ saves, renders, toasts }) });
}
const pick = (c, type, id, parentId) => { c.clipLastClick = { type, id, parentId }; };

test("styleCanCopy：剛好一項且存在", () => {
  const c = setup();
  assert.strictEqual(c.styleCanCopy([{ type: "trick", id: "a000000" }], "c1"), true);
  assert.strictEqual(c.styleCanCopy([], "c1"), false);
  assert.strictEqual(c.styleCanCopy([{ type: "trick", id: "a000000" }, { type: "trick", id: "b000000" }], "c1"), false);
  assert.strictEqual(c.styleCanCopy([{ type: "trick", id: "nope" }], "c1"), false);
});

test("styleCopy：記下圖示與顏色，圖片來源只帶顏色", () => {
  const c = setup();
  pick(c, "category", "c1", null);
  assert.strictEqual(c.styleCopy(), true);
  assert.strictEqual(c.styleClip.icon, "🔥");
  assert.strictEqual(c.styleClip.color, "red");
  pick(c, "category", "c3", null);
  assert.strictEqual(c.styleCopy(), true);
  assert.strictEqual(c.styleClip.icon, null);
  assert.strictEqual(c.styleClip.color, "blue");
  assert.ok(c._n().toasts.some((m) => m === c.t("styleCopiedImg")));
});

test("styleApply：沒有樣式提示、不動資料", () => {
  const c = setup();
  pick(c, "trick", "b000000", "c1");
  assert.strictEqual(c.styleApply(), false);
  assert.strictEqual(c._n().saves, 0);
  assert.strictEqual(c._n().toasts[0], c.t("styleNone"));
});

test("styleApply：套用多項、跨類型、保留樣式、一次復原", () => {
  const c = setup();
  pick(c, "trick", "a000000", "c1");
  c.styleCopy();
  c.multiSel = { parentId: null, space: "t00", items: [{ type: "category", id: "c2" }, { type: "category", id: "c1" }] };
  assert.strictEqual(c.styleApply(), true);
  assert.strictEqual(c.getCategory("c2").icon, "⭐");
  assert.strictEqual(c.getCategory("c2").color, "green");
  assert.strictEqual(c.getCategory("c1").icon, "⭐");
  assert.ok(c.styleClip);
  assert.strictEqual(c._n().saves, 1);
  assert.strictEqual(c.undoStack.length, 1);
  assert.ok(c.undoApply());
  c.invalidateDbIndex();
  assert.strictEqual(c.getCategory("c2").icon || "", "");
  assert.strictEqual(c.getCategory("c1").icon, "🔥");
});

test("預設色：招式預設（空）與清單預設（default）互相對應；同類型一模一樣", () => {
  const c = setup();
  pick(c, "trick", "b000000", "c1"); c.styleCopy();
  assert.strictEqual(c.styleClip.color, "");
  pick(c, "category", "c1", null); c.styleApply();
  assert.strictEqual(c.getCategory("c1").color, "default");
  pick(c, "trick", "d000000", "c1"); c.styleApply();
  assert.strictEqual(c.getTrick("d000000").color, "");
  assert.strictEqual(c.getTrick("d000000").icon, "");
  pick(c, "category", "c2", null); c.styleCopy();
  pick(c, "trick", "a000000", "c1"); c.styleApply();
  assert.strictEqual(c.getTrick("a000000").color, "");
});

test("圖片來源：只改顏色，目標圖示不動", () => {
  const c = setup();
  pick(c, "category", "c3", null); c.styleCopy();
  pick(c, "trick", "a000000", "c1"); c.styleApply();
  assert.strictEqual(c.getTrick("a000000").icon, "⭐");
  assert.strictEqual(c.getTrick("a000000").color, "blue");
});

test("無權限項目略過；全部無權限不寫入也不 undoPush", () => {
  const c = setup();
  pick(c, "trick", "a000000", "c1"); c.styleCopy();
  c.getSpace("t00").locked = true;
  const before = JSON.stringify(c.db);
  pick(c, "category", "c2", null);
  assert.strictEqual(c.styleApply(), false);
  assert.strictEqual(JSON.stringify(c.db), before);
  assert.strictEqual(c._n().saves, 0);
  assert.strictEqual(c.undoStack.length, 0);
  assert.strictEqual(c.styleCanApply([{ type: "category", id: "c2" }], null, false), false);
  assert.strictEqual(c.styleCanApply([{ type: "category", id: "c2" }], null, true), true);
  c.isAdminNow = () => true;
  c.multiSel = { parentId: null, space: "t00", items: [{ type: "category", id: "c2" }, { type: "category", id: "c1" }] };
  assert.strictEqual(c.styleApply(), true);
  assert.ok(c._n().toasts[c._n().toasts.length - 1].includes("2"));
});

test("套用後沒有變更：不寫資料，但仍算成功", () => {
  const c = setup();
  pick(c, "trick", "a000000", "c1"); c.styleCopy();
  pick(c, "trick", "a000000", "c1");
  assert.strictEqual(c.styleApply(), true);
  assert.strictEqual(c._n().saves, 0);
});

test("styleClear 清掉樣式", () => {
  const c = setup();
  pick(c, "trick", "a000000", "c1"); c.styleCopy();
  c.styleClear();
  assert.strictEqual(c.styleClip, null);
});

test("styleKeyAction：Ctrl+Alt+C/V；不含一般 Ctrl+C", () => {
  const c = setup();
  const ctx = { editMode: true, guest: false, inField: false, modalOpen: false };
  const ev = (o) => Object.assign({ ctrlKey: true, altKey: true, metaKey: false, shiftKey: false, code: "KeyC", key: "c" }, o);
  assert.strictEqual(c.styleKeyAction(ev({}), ctx), "copy");
  assert.strictEqual(c.styleKeyAction(ev({ code: "KeyV", key: "√" }), ctx), "apply");
  assert.strictEqual(c.styleKeyAction(ev({ altKey: false }), ctx), null);
  assert.strictEqual(c.styleKeyAction(ev({ ctrlKey: false, metaKey: true }), ctx), null);
  assert.strictEqual(c.styleKeyAction(ev({ code: "KeyX" }), ctx), null);
  assert.strictEqual(c.styleKeyAction(ev({}), Object.assign({}, ctx, { editMode: false })), null);
  assert.strictEqual(c.styleKeyAction(ev({}), Object.assign({}, ctx, { guest: true })), null);
  assert.strictEqual(c.styleKeyAction(ev({}), Object.assign({}, ctx, { inField: true })), null);
  assert.strictEqual(c.styleKeyAction(ev({}), Object.assign({}, ctx, { modalOpen: true })), null);
  assert.strictEqual(c.clipKeyAction(ev({}), Object.assign({ hasTextSelection: false }, ctx)), null);
});

test("握有樣式時可跨欄、跨類型選取並一次套用；跨欄不可剪下", () => {
  const c = setup();
  c.styleClip = { icon: "🔥", color: "red", type: "category" };
  const info = (type, id, parentId) => ({ type, id, parentId });
  let s = c.multiSelNext(null, info("category", "c2", null), null, "t00", true);
  s = c.multiSelNext(s, info("trick", "b000000", "c1"), null, "t00", true);
  assert.strictEqual(s.parentId, null);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(s.items)), [{ type: "category", id: "c2" }, { type: "trick", id: "b000000", parentId: "c1" }]);
  const only = c.multiSelNext(s, info("category", "c2", null), null, "t00", true); // first one off: home column moves
  assert.strictEqual(only.parentId, "c1");
  assert.strictEqual(c.multiSelIsMixed(only), false);
  c.multiSel = s;
  assert.strictEqual(c.multiSelMixed(), true);
  c.clipboardItem = null;
  c.clipCopyOrCut("cut");
  assert.strictEqual(c.clipboardItem, null);
  assert.strictEqual(c.styleApply(), true);
  assert.strictEqual(c.getTrick("b000000").icon, "🔥");
  assert.strictEqual(c.db.categories.find((x) => x.id === "c2").color, "red");
  assert.strictEqual(c.multiSelNext(s, info("trick", "a000000", "c9"), null, "t00").items.length, 1); // no style: restarts
});

test("styleBarItems: 滴管／油漆用過的點擊不再算，之後新點的項目才算", () => {
  const c = setup();
  c.clipLastClick = { type: "category", id: "c1", parentId: null };
  assert.strictEqual(c.styleBarItems().items.length, 0); // no style held
  assert.strictEqual(c.styleCopy(), true);
  assert.strictEqual(c.styleBarItems().items.length, 0); // the source itself
  c.clipLastClick = { type: "trick", id: "b000000", parentId: "c1" };
  assert.deepStrictEqual(JSON.parse(JSON.stringify(c.styleBarItems().items)), [{ type: "trick", id: "b000000" }]);
  assert.strictEqual(c.styleApply(), true);
  assert.strictEqual(c.getTrick("b000000").icon, "🔥");
  assert.strictEqual(c.styleBarItems().items.length, 0);
});
