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

test("guideItems: 兩種裝置都有瀏覽與編輯兩組", () => {
  const c = ctx();
  [false, true].forEach((touch) => {
    const g = c.guideItems(touch);
    assert.deepStrictEqual(Array.from(g, (x) => x.group), ["browse", "edit"]);
    g.forEach((grp) => {
      assert.ok(grp.items.length > 0);
      grp.items.forEach((it) => assert.ok(it.textKey && (it.keys || it.gesture)));
    });
  });
});

test("guideItems: 電腦為鍵盤、觸控為手勢", () => {
  const c = ctx();
  const desk = c.guideItems(false);
  const ids = desk[1].items.filter((i) => i.keys).map((i) => i.keys.join("+"));
  ["Mod+C", "Mod+X", "Mod+V", "Mod+C+then+Mod+V", "Mod+Z", "Delete", "Shift"].forEach((k) => assert.ok(ids.includes(k), k));
  assert.ok(desk[0].items.some((i) => i.keys.join() === "Esc"));
  c.guideItems(true).forEach((grp) => grp.items.forEach((i) => assert.ok(i.gesture && !i.keys)));
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
