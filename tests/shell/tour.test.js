"use strict";
const test = require("node:test");
const assert = require("node:assert");
const { load } = require("../_load");

function tourCtx(extra){
  return load(["js/01-data-model.js", "js/01-data-storage.js", "js/02-constants-colors-icons.js", "js/03-i18n.js", "js/04-state.js",
    "js/18-shell-tour.js", "js/18-tour-demo.js", "js/18-tour-steps.js"], extra || {});
}

test("tour: decideAutoTour only on first visit", () => {
  const ctx = tourCtx();
  const first = ctx.decideAutoTour(null, { basic:false, uids:[] });
  assert.strictEqual(first.kind, "intro");
  assert.strictEqual(first.markBasic, true);
  assert.deepStrictEqual(Object.assign({}, ctx.decideAutoTour({ uid:"u1" }, { basic:false, uids:[] })), { kind:"intro", markBasic:true });
  assert.strictEqual(ctx.decideAutoTour(null, { basic:true, uids:[] }), null);
  assert.strictEqual(ctx.decideAutoTour({ uid:"u1" }, { basic:true, uids:[] }), null);   // first login: no tour any more
  assert.strictEqual(ctx.decideAutoTour({ uid:"u1" }, { basic:false, uids:["u9"] }), null); // legacy uid record counts as seen
});

test("tour: seen flag read / write", () => {
  const ctx = tourCtx();
  assert.deepStrictEqual(JSON.parse(JSON.stringify(ctx.readTourSeen())), { basic:false, uids:[] });
  ctx.writeTourSeen({ kind:"intro", markBasic:true });
  assert.strictEqual(ctx.localStorage.getItem("kendama-tour-seen-v1"), "1");
  assert.strictEqual(ctx.readTourSeen().basic, true);
  assert.strictEqual(ctx.localStorage.getItem("kendama-tour-seen-uid-v1"), null); // uid key is never written
});

test("tour: steps by visitor kind", () => {
  const ctx = tourCtx();
  const ids = (env) => Array.from(ctx.tourStepsFor(env).map((s) => s.id));
  const base = ["welcome", "browse", "search", "drawer", "video", "tools", "edit", "settings"];
  assert.deepStrictEqual(ids({ signedIn:false, touch:false, standalone:false }), base.concat(["login"]));
  assert.deepStrictEqual(ids({ signedIn:true, touch:false, standalone:false }), base);
  assert.deepStrictEqual(ids({ signedIn:true, touch:true, standalone:false }), base.concat(["pwa"]));
  assert.deepStrictEqual(ids({ signedIn:true, touch:true, standalone:true }), base);
  assert.deepStrictEqual(ids({ signedIn:false, touch:true, standalone:false }), base.concat(["pwa", "login"]));
  assert.deepStrictEqual(ids({ signedIn:false, touch:false, standalone:true }), base.concat(["login"]));
  assert.strictEqual(ids({}).includes("login"), true);
});

test("tour: every step has strings in the table", () => {
  const ctx = tourCtx();
  ctx.tourStepsFor({}).forEach((s) => {
    [s.title, typeof s.body === "function" ? s.body({ signedIn:true, touch:true }) : s.body, typeof s.body === "function" ? s.body({}) : s.body].forEach((k) => {
      assert.ok(ctx.UI.en[k] && ctx.UI.zh[k] && ctx.UI.jp[k], s.id + " " + k);
    });
  });
});

test("tour: isTouchDevice", () => {
  const ctx = tourCtx();
  assert.strictEqual(ctx.isTouchDevice({ matchMedia: () => ({ matches:true }) }), true);
  assert.strictEqual(ctx.isTouchDevice({ matchMedia: () => ({ matches:false }), maxTouchPoints:5 }), false); // pointer media wins
  assert.strictEqual(ctx.isTouchDevice({ matchMedia: () => ({ matches:false }), maxTouchPoints:0 }), false);
  assert.strictEqual(ctx.isTouchDevice({ maxTouchPoints:2 }), true);
  assert.strictEqual(ctx.isTouchDevice({ matchMedia: null, maxTouchPoints:0 }), false);
  assert.strictEqual(ctx.isTouchDevice({}), false);
  assert.strictEqual(ctx.isTouchDevice(), false);
});
