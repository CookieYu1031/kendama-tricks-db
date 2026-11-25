"use strict";
// 導覽與快捷鍵：操作一覽資料、修飾鍵、三語字串。
const test = require("node:test");
const assert = require("node:assert");
const { load } = require("../_load");

function ctx(){ return load(["js/03-i18n.js", "js/19-shell-guide.js"], { state: { lang: "zh" } }); }

test("guideModKey: Mac 用 ⌘，其餘 Ctrl", () => {
  const c = ctx();
  assert.strictEqual(c.guideModKey("MacIntel"), "⌘");
  assert.strictEqual(c.guideModKey("iPhone"), "⌘");
  assert.strictEqual(c.guideModKey("Win32"), "Ctrl");
  assert.strictEqual(c.guideModKey(""), "Ctrl");
  assert.strictEqual(c.guideModKey(undefined), "Ctrl");
});

test("guideNeedsLogin: 訪客需登入", () => {
  const c = ctx();
  assert.strictEqual(c.guideNeedsLogin(false), true);
  assert.strictEqual(c.guideNeedsLogin(true), false);
});

test("guideItems: 電腦只有編輯組（Shift 在最上面），觸控有瀏覽與編輯", () => {
  const c = ctx();
  [false, true].forEach((touch) => {
    const g = c.guideItems(touch);
    assert.deepStrictEqual(Array.from(g, (x) => x.group), touch ? ["browse", "edit"] : ["edit"]);
    g.forEach((grp) => {
      assert.ok(grp.items.length > 0);
      grp.items.forEach((it) => assert.ok(it.textKey && (it.keys || it.gesture)));
    });
  });
});

test("guideItems: 電腦為鍵盤、觸控為手勢", () => {
  const c = ctx();
  const desk = c.guideItems(false);
  const ids = desk[0].items.filter((i) => i.keys).map((i) => i.keys.join("+"));
  ["Mod+C", "Mod+X", "Mod+V", "Mod+Z", "Delete", "Shift"].forEach((k) => assert.ok(ids.includes(k), k));
  assert.strictEqual(ids[0], "Shift");
  c.guideItems(true).forEach((grp) => grp.items.forEach((i) => assert.ok(i.gesture && !i.keys)));
});

test("guideItems：電腦有滴管／油漆快捷鍵（Ctrl 不隨平台變 ⌘），觸控有滴管／油漆列", () => {
  const c = ctx();
  const ids = c.guideItems(false)[0].items.filter((i) => i.keys).map((i) => i.keys.join("+"));
  assert.ok(ids.includes("Ctrl+Alt+C") && ids.includes("Ctrl+Alt+V"));
  assert.ok(c.guideItems(true)[1].items.some((i) => i.textKey === "guideTouchStyle"));
});

test("每個 textKey / gesture 三語皆有字串", () => {
  const c = ctx();
  const keys = new Set(["guideTitle", "guideSub", "guideClose", "guideBack", "guideTourName", "guideTourDesc",
    "guideKeysName", "guideKeysDesc", "guideTouchName", "guideTouchDesc", "guideGroupBrowse", "guideGroupEdit",
    "guideNeedEdit", "guideNeedLogin"]);
  [false, true].forEach((touch) => c.guideItems(touch).forEach((g) => g.items.forEach((i) => {
    keys.add(i.textKey); if (i.gesture) keys.add(i.gesture);
  })));
  ["zh", "jp", "en"].forEach((lang) => {
    keys.forEach((k) => assert.ok(c.UI[lang][k] && String(c.UI[lang][k]).trim(), lang + ":" + k));
  });
});
