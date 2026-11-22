"use strict";
const test = require("node:test");
const assert = require("node:assert");
const { load } = require("../_load");

function tourCtx(extra){
  return load(["js/01-data-model.js", "js/01-data-storage.js", "js/02-constants-colors-icons.js", "js/03-i18n.js", "js/04-state.js", "js/18-shell-tour.js"], extra || {});
}

test("tour: decideAutoTour guest", () => {
  const ctx = tourCtx();
  const first = ctx.decideAutoTour(null, { basic:false, uids:[] });
  assert.strictEqual(first.kind, "basic");
  assert.strictEqual(first.markBasic, true);
  assert.strictEqual(ctx.decideAutoTour(null, { basic:true, uids:[] }), null);
});

test("tour: decideAutoTour first login", () => {
  const ctx = tourCtx();
  const a = ctx.decideAutoTour({ uid:"u1" }, { basic:true, uids:[] });
  assert.strictEqual(a.kind, "member");
  assert.strictEqual(a.uid, "u1");
  assert.strictEqual(a.markBasic, false);
  const b = ctx.decideAutoTour({ uid:"u1" }, { basic:false, uids:[] });
  assert.strictEqual(b.kind, "full");
  assert.strictEqual(b.markBasic, true);
});

test("tour: decideAutoTour repeat login and multiple uids", () => {
  const ctx = tourCtx();
  assert.strictEqual(ctx.decideAutoTour({ uid:"u1" }, { basic:true, uids:["u1"] }), null);
  const c = ctx.decideAutoTour({ uid:"u2" }, { basic:true, uids:["u1"] });
  assert.strictEqual(c.kind, "member");
  assert.strictEqual(c.uid, "u2");
});

test("tour: tourStepsFor counts and kinds", () => {
  const ctx = tourCtx({ matchMedia: () => ({ matches:false }) });
  const basic = ctx.tourStepsFor("basic");
  assert.strictEqual(basic.length, 6);
  assert.strictEqual(basic[0].sel, null);
  assert.strictEqual(basic[4].id, "keys");
  const member = ctx.tourStepsFor("member");
  assert.strictEqual(member[0].id, "memberIntro");
  assert.strictEqual(member.length, 4);
  assert.strictEqual(ctx.tourStepsFor("full").length, 9);
  const touch = tourCtx({ matchMedia: () => ({ matches:true }) });
  assert.strictEqual(touch.tourStepsFor("basic")[4].id, "gestures");
});

test("tour: isTouchDevice", () => {
  const ctx = tourCtx();
  assert.strictEqual(ctx.isTouchDevice({ matchMedia: () => ({ matches:true }) }), true);
  assert.strictEqual(ctx.isTouchDevice({ matchMedia: () => ({ matches:false }), maxTouchPoints:5 }), true);
  assert.strictEqual(ctx.isTouchDevice({ matchMedia: () => ({ matches:false }), maxTouchPoints:0 }), false);
  assert.strictEqual(ctx.isTouchDevice({}), false);
});

