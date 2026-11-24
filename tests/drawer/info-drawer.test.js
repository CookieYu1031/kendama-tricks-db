// Info drawer (v0.17): exclusive trick/info drawer state, close helpers, title setter, info row icon look.
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const { load } = require("../_load");

const FILES = ["js/01-data-model.js", "js/01-data-storage.js", "js/02-constants-colors-icons.js", "js/03-i18n.js", "js/04-state.js", "js/05-data-helpers.js", "js/05-data-ops.js", "js/05-data-util.js",
  "js/05-data-prefix.js", "js/06-icons-svg.js", "js/07-id.js", "js/09-names.js", "js/20-browse-order.js", "js/21-browse-item-visual.js", "js/29-browse-sort.js", "js/30-drawer-logic.js", "js/31-drawer-sections.js", "js/32-trick-drawer.js", "js/37-info-drawer.js"];

function setup(){
  const c = load(FILES);
  const nm = (z) => ({ zh: z, jp: "", en: "" });
  c.db = c.normalizeDB({
    categories: [{ id: "c1", parentId: null, spaceId: "t00", name: nm("c1"), order: 0 }],
    tricks: [{ id: "a000000", name: nm("a"), categoryIds: ["c1"] }],
    infos: [{ id: "i000001", parentId: "c1", spaceId: "t00", title: nm("info"), content: "hi", order: 0 }], tags: []
  });
  c.invalidateDbIndex();
  c.closed = 0;
  c.closeDrawer = () => { c.closed++; c.clearDrawerState(); }; // no DOM in the test context
  return c;
}

test("drawerIsOpen / clearDrawerState cover both kinds", () => {
  const c = setup();
  assert.strictEqual(c.drawerIsOpen(), false);
  c.state.detailTrickId = "a000000";
  assert.strictEqual(c.drawerIsOpen(), true);
  c.clearDrawerState();
  assert.strictEqual(c.drawerIsOpen(), false);
  c.state.detailInfoId = "i000001";
  assert.strictEqual(c.drawerIsOpen(), true);
  c.clearDrawerState();
  assert.strictEqual(c.state.detailInfoId, null);
  assert.strictEqual(c.state.detailTrickId, null);
});

test("closeDrawerIfGone: closes only when the shown trick / info no longer exists", () => {
  const c = setup();
  c.state.detailInfoId = "i000001";
  c.closeDrawerIfGone();
  assert.strictEqual(c.closed, 0);
  c.db.infos = [];
  c.invalidateDbIndex();
  c.closeDrawerIfGone();
  assert.strictEqual(c.closed, 1);
  c.state.detailTrickId = "a000000";
  c.closeDrawerIfGone();
  assert.strictEqual(c.closed, 1);
  c.db.tricks = [];
  c.invalidateDbIndex();
  c.closeDrawerIfGone();
  assert.strictEqual(c.closed, 2);
});

test("findFocusColumnIndex: finds the column of the open info item", () => {
  const c = setup();
  const cols = [{ items: [{ type: "category", id: "c1" }] }, { items: [{ type: "info", id: "i000001" }] }];
  assert.strictEqual(c.findFocusColumnIndex(cols), -1);
  c.state.detailInfoId = "i000001";
  assert.strictEqual(c.findFocusColumnIndex(cols), 1);
  c.state.detailInfoId = null; c.state.detailTrickId = "zzz";
  assert.strictEqual(c.findFocusColumnIndex(cols), -1);
});

test("setInfoTitle / setRecordName: refuses emptying the last title", () => {
  const c = setup();
  const info = { title: { zh: "資訊", jp: "", en: "" } };
  assert.strictEqual(c.setInfoTitle(info, "zh", "  "), false);
  assert.strictEqual(info.title.zh, "資訊");
  assert.strictEqual(c.setInfoTitle(info, "en", " Info "), true);
  assert.strictEqual(info.title.en, "Info");
  assert.strictEqual(c.setInfoTitle(info, "zh", ""), true);
  assert.strictEqual(c.setInfoTitle(info, "en", ""), false);
});

test("infoRowTinted: plain only when no icon and default colour", () => {
  const c = setup();
  assert.strictEqual(c.infoRowTinted({ icon: "", color: "default" }), false);
  assert.strictEqual(c.infoRowTinted({ icon: "", color: "" }), false);
  assert.strictEqual(c.infoRowTinted({ icon: "📘", color: "default" }), true);
  assert.strictEqual(c.infoRowTinted({ icon: "", color: "red" }), true);
});

// Minimal element stub: enough for buildItemVisual.
function fakeEl(){
  const el = { style: {}, className: "", textContent: "", innerHTML: "", children: [],
    classList: { add(n){ el.className += " " + n; } },
    appendChild(ch){ el.children.push(ch); return ch; } };
  return el;
}

test("buildItemVisual info: default look keeps the ⓘ svg untinted; icon / colour tint like a list; prefix shown", () => {
  const c = setup();
  c.document.createElement = fakeEl;
  c.document.createTextNode = (s) => ({ text: s });
  const info = c.getInfo("i000001");
  let v = c.buildItemVisual({ type: "info", id: info.id, name: info.title, ref: info }, "c1");
  assert.strictEqual(v.icon.innerHTML, c.ICON_INFO_ROW);
  assert.strictEqual(v.icon.style.background, undefined);
  info.icon = "📘"; info.color = "blue"; info.prefix = "A1";
  v = c.buildItemVisual({ type: "info", id: info.id, name: info.title, ref: info }, "c1");
  assert.strictEqual(v.icon.textContent, "📘");
  assert.ok(v.icon.style.background);
  const nameEl = v.textWrap.children[0];
  assert.strictEqual(nameEl.children[0].textContent, "A1");
  info.icon = "";
  v = c.buildItemVisual({ type: "info", id: info.id, name: info.title, ref: info }, "c1");
  assert.strictEqual(v.icon.innerHTML, c.ICON_INFO_ROW);
  assert.ok(v.icon.style.background);
});
