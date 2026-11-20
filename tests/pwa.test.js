"use strict";
// PWA: install state, banner rule, service worker routing, manifest.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const vm = require("vm");
const path = require("path");
const { load } = require("./_load");

const ROOT = path.join(__dirname, "..");
const IOS_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari";

function pwaCtx(){
  return load(["js/03-i18n.js", "js/17-shell-pwa.js"], { state: { lang: "zh" } });
}

test("pwaInstallState cases", () => {
  const c = pwaCtx();
  assert.strictEqual(c.pwaInstallState({ standalone: true, deferred: true }), "installed");
  assert.strictEqual(c.pwaInstallState({ deferred: true }), "available");
  assert.strictEqual(c.pwaInstallState({ ua: IOS_UA }), "ios");
  assert.strictEqual(c.pwaInstallState({ platform: "MacIntel", maxTouchPoints: 5, ua: "Macintosh" }), "ios");
  assert.strictEqual(c.pwaInstallState({ platform: "MacIntel", maxTouchPoints: 0, ua: "Macintosh" }), "unsupported");
  assert.strictEqual(c.pwaInstallState({ ua: IOS_UA, standalone: true }), "installed");
  assert.strictEqual(c.pwaInstallState({}), "unsupported");
});

test("shouldShowPwaBanner rules", () => {
  const c = pwaCtx();
  assert.strictEqual(c.shouldShowPwaBanner("available", 2, false, false), true);
  assert.strictEqual(c.shouldShowPwaBanner("ios", 5, false, false), true);
  assert.strictEqual(c.shouldShowPwaBanner("available", 1, false, false), false);
  assert.strictEqual(c.shouldShowPwaBanner("available", 3, true, false), false);
  assert.strictEqual(c.shouldShowPwaBanner("available", 3, false, true), false);
  assert.strictEqual(c.shouldShowPwaBanner("installed", 3, false, false), false);
  assert.strictEqual(c.shouldShowPwaBanner("unsupported", 3, false, false), false);
});

test("i18n keys exist in all languages", () => {
  const c = pwaCtx();
  const keys = ["pwaInstall", "pwaInstalled", "pwaUnsupported", "pwaIosHint", "pwaBannerTitle", "pwaBannerBody", "pwaBannerInstall", "pwaBannerDismiss", "pwaOffline", "pwaOnline"];
  ["zh", "jp", "en"].forEach((l) => {
    c.state.lang = l;
    keys.forEach((k) => assert.notStrictEqual(c.t(k), k, l + ":" + k));
  });
});

test("launch counter increments on load", () => {
  const c = pwaCtx();
  assert.strictEqual(c.localStorage.getItem("kendama-pwa-launches-v1"), "1");
});

function swCtx(){
  const ctx = { self: { location: { host: "kendama-tricks-db.web.app" } }, setTimeout, clearTimeout };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, "sw.js"), "utf8"), ctx, { filename: "sw.js" });
  return ctx;
}

test("swRouteFor routes", () => {
  const c = swCtx();
  const o = "https://kendama-tricks-db.web.app";
  assert.strictEqual(c.swRouteFor(o + "/js/04-state.js", "GET", "no-cors"), "network-first");
  assert.strictEqual(c.swRouteFor(o + "/", "GET", "navigate"), "network-first");
  assert.strictEqual(c.swRouteFor(o + "/__/auth/handler", "GET", "navigate"), "bypass");
  assert.strictEqual(c.swRouteFor(o + "/x", "POST", "cors"), "bypass");
  assert.strictEqual(c.swRouteFor("https://firestore.googleapis.com/v1/x", "GET"), "bypass");
  assert.strictEqual(c.swRouteFor("https://identitytoolkit.googleapis.com/v1/x", "GET"), "bypass");
  assert.strictEqual(c.swRouteFor("https://securetoken.googleapis.com/v1/x", "GET"), "bypass");
  assert.strictEqual(c.swRouteFor("https://accounts.google.com/o", "GET"), "bypass");
  assert.strictEqual(c.swRouteFor("https://www.google-analytics.com/c", "GET"), "bypass");
  assert.strictEqual(c.swRouteFor("https://www.gstatic.com/firebasejs/10.0.0/firebase-app.js", "GET"), "cache-first");
  assert.strictEqual(c.swRouteFor("https://fonts.googleapis.com/css2?family=X", "GET"), "cache-first");
  assert.strictEqual(c.swRouteFor("https://fonts.gstatic.com/s/x.woff2", "GET"), "cache-first");
});

test("manifest valid and icons exist", () => {
  const m = JSON.parse(fs.readFileSync(path.join(ROOT, "manifest.webmanifest"), "utf8"));
  assert.strictEqual(m.display, "standalone");
  assert.strictEqual(m.start_url, "./");
  assert.strictEqual(m.scope, "./");
  assert.strictEqual(m.theme_color, "#121212");
  assert.strictEqual(m.background_color, "#121212");
  assert.ok(m.name && m.short_name);
  const sizes = m.icons.map((i) => i.sizes);
  assert.ok(sizes.includes("192x192") && sizes.includes("512x512"));
  m.icons.forEach((i) => assert.ok(fs.existsSync(path.join(ROOT, i.src)), i.src));
});

test("sw precache files exist", () => {
  const c = swCtx();
  c.SW_PRECACHE.forEach((p) => {
    if(p === "./") return;
    assert.ok(fs.existsSync(path.join(ROOT, p)), p);
  });
});
