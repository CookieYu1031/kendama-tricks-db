// 視窗防呆（js/40-modal-guard.js）：點背景關閉的判定、Enter＝完成的對象。
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const { load } = require("../_load");
const c = load(["js/40-modal-guard.js"]);

test("點背景：按下與放開都在背景才放行", () => {
  const ov = {}, inp = {};
  assert.strictEqual(c.modalGuardBlocks(ov, ov, ov, true, null), false);
  assert.strictEqual(c.modalGuardBlocks(inp, ov, ov, true, null), true); // 選字拖到外面放開
  assert.strictEqual(c.modalGuardBlocks(ov, inp, ov, true, null), true);
});

test("搜尋面板：面板內按下、外面放開不關；一般點外面放行", () => {
  const inP = {}, out = {}, inside = (el) => el === inP;
  assert.strictEqual(c.modalGuardBlocks(inP, out, out, false, inside), true);
  assert.strictEqual(c.modalGuardBlocks(out, out, out, false, inside), false);
  assert.strictEqual(c.modalGuardBlocks(inP, inP, inP, false, inside), false);
  assert.strictEqual(c.modalGuardBlocks(inP, out, out, false, null), false);
});

test("Enter：最上層的編輯視窗接手；輸入法組字、組合鍵、多行、取消／移除鈕、確認框不攔", () => {
  const k = (x) => Object.assign({ key: "Enter", tag: "BUTTON" }, x);
  assert.strictEqual(c.modalEnterTarget(k(), { icon: true, category: true }), "icon");
  assert.strictEqual(c.modalEnterTarget(k(), { color: true, icon: true }), "color");
  assert.strictEqual(c.modalEnterTarget(k(), { category: true }), "category");
  assert.strictEqual(c.modalEnterTarget(k(), { space: true }), "space");
  assert.strictEqual(c.modalEnterTarget(k(), {}), null);
  [{ composing: true }, { mod: true }, { tag: "TEXTAREA" }, { native: true }, { key: "a" }].forEach((x) =>
    assert.strictEqual(c.modalEnterTarget(k(x), { category: true }), null));
  assert.strictEqual(c.modalEnterTarget(k(), { confirm: true, category: true }), null);
});
