"use strict";
// E1/E2/E7: theme preference logic + rail zone layout.
const test = require("node:test");
const assert = require("node:assert");
const { load } = require("./_load");

function themeCtx(extra){
  return load(["js/15-shell-theme.js"], extra || {});
}

test("theme: default pref is system, invalid values fall back", () => {
  const ctx = themeCtx();
  assert.strictEqual(ctx.getThemePref(), "system");
  ctx.localStorage.setItem("kendama-theme-v1", "bogus");
  assert.strictEqual(ctx.getThemePref(), "system");
});

test("theme: resolveTheme", () => {
  const ctx = themeCtx();
  assert.strictEqual(ctx.resolveTheme("system", true), "dark");
  assert.strictEqual(ctx.resolveTheme("system", false), "light");
  assert.strictEqual(ctx.resolveTheme("dark", false), "dark");
  assert.strictEqual(ctx.resolveTheme("light", true), "light");
  assert.strictEqual(ctx.resolveTheme("nope", true), "dark");
});

test("theme: setThemePref stores and sets data-theme on <html>", () => {
  const attrs = {};
  const doc = { documentElement: { setAttribute: (k, v) => { attrs[k] = v; } }, getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], addEventListener() {} };
  const ctx = themeCtx({ document: doc, matchMedia: () => ({ matches: false, addEventListener() {} }) });
  assert.strictEqual(attrs["data-theme"], "light"); // system + OS light, applied at load
  ctx.setThemePref("dark");
  assert.strictEqual(ctx.localStorage.getItem("kendama-theme-v1"), "dark");
  assert.strictEqual(attrs["data-theme"], "dark");
  ctx.setThemePref("system");
  assert.strictEqual(attrs["data-theme"], "light");
  ctx.setThemePref("garbage");
  assert.strictEqual(ctx.getThemePref(), "system");
});

function railCtx(loggedIn){
  let seq = 0;
  const ctx = load(
    ["js/01-data-model.js", "js/02-constants-colors-icons.js", "js/04-state.js", "js/05-data-helpers.js", "js/20-browse-order.js"],
    { localize: (n) => n && n.zh, nextId: (taken) => { let id; do { id = "id" + (++seq); } while(taken && taken(id)); return id; } }
  );
  ctx.isLoggedIn = () => loggedIn;
  ctx.db = ctx.normalizeDB({ categories: [], tricks: [], infos: [] });
  ctx.invalidateDbIndex();
  return ctx;
}
const ids = (arr) => arr.map((s) => s.id).join(",");

test("rail zones: signed-in = top 00/01/02, middle fav + customs, bottom shown", () => {
  const ctx = railCtx(true);
  ctx.createSpace({ name: { zh: "A" } });
  ctx.createSpace({ name: { zh: "B" } });
  const z = ctx.railZones(ctx.db.spaces);
  assert.strictEqual(ids(z.top), "t00,t01,t02");
  assert.strictEqual(z.middle[0].id, "fav");
  assert.strictEqual(z.middle.length, 3);
  assert.ok(z.showMiddle && z.showBottom);
});

test("rail zones: guest sees only the top zone", () => {
  const ctx = railCtx(false);
  const z = ctx.railZones(ctx.db.spaces);
  assert.strictEqual(ids(z.top), "t00,t01,t02");
  assert.strictEqual(z.middle.length, 0);
  assert.ok(!z.showMiddle && !z.showBottom);
  assert.strictEqual(ctx.railLayout(ctx.db.spaces).length, 3);
});

test("settingsBtnState: signed out -> icon; signed in -> avatar with photo / initial", () => {
  const ctx = load(["js/14-shell-settings.js"], { document: { getElementById: () => ({ addEventListener() {} }) } });
  assert.strictEqual(ctx.settingsBtnState(null).kind, "icon");
  const a = ctx.settingsBtnState({ displayName: "kenji", photoURL: "http://x/p.png" });
  assert.deepStrictEqual([a.kind, a.photoURL, a.initial], ["avatar", "http://x/p.png", "K"]);
  const b = ctx.settingsBtnState({ email: "zed@x.com" });
  assert.deepStrictEqual([b.photoURL, b.initial], ["", "Z"]);
  assert.strictEqual(ctx.settingsBtnState({}).initial, "?");
});
