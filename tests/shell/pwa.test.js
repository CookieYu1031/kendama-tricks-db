"use strict";
// PWA: install state, banner rule, service worker routing, manifest.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const vm = require("vm");
const path = require("path");
const { load } = require("../_load");

const ROOT = path.join(__dirname, "..", "..");
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
  // splash / theme colour = the dark --edge-bg (what iOS 26 Safari tints its bars with)
  assert.strictEqual(m.theme_color, "#1B2A37");
  assert.strictEqual(m.background_color, "#1B2A37");
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

test("install guide: browser detection and placement", () => {
  const c = load(["js/03-i18n.js", "js/17-shell-pwa.js", "js/17-shell-pwa-guide.js"], { state: { lang: "zh" } });
  const UA = {
    iosSafari: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1",
    iosChrome: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 CriOS/130.0 Mobile/15E148 Safari/604.1",
    iosLine: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari Line/14.0",
    android: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36",
    samsung: "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 SamsungBrowser/25.0 Chrome/121.0 Mobile Safari/537.36",
    winChrome: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0 Safari/537.36",
    winEdge: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0 Safari/537.36 Edg/130.0",
    macSafari: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15",
    firefox: "Mozilla/5.0 (Windows NT 10.0; rv:130.0) Gecko/20100101 Firefox/130.0"
  };
  const b = (ua, extra) => c.pwaBrowserOf(Object.assign({ ua: ua }, extra || {}));
  assert.strictEqual(b(UA.iosSafari), "iosSafari");
  assert.strictEqual(b(UA.iosChrome), "iosChrome");
  assert.strictEqual(b(UA.iosLine), "other");
  assert.strictEqual(b(UA.macSafari, { platform: "MacIntel", maxTouchPoints: 5 }), "ipadSafari");
  assert.strictEqual(b(UA.macSafari, { platform: "MacIntel", maxTouchPoints: 0 }), "desktopSafari");
  assert.strictEqual(b(UA.android), "androidChrome");
  assert.strictEqual(b(UA.samsung), "other");
  assert.strictEqual(b(UA.winChrome), "desktopChrome");
  assert.strictEqual(b(UA.winEdge), "desktopChrome");
  assert.strictEqual(b(UA.firefox), "other");
  assert.strictEqual(b(""), "other");
  assert.strictEqual(c.pwaGuideFor("iosSafari").pos, "bottom");
  ["ipadSafari", "iosChrome", "androidChrome", "desktopChrome", "desktopSafari"].forEach((k) => {
    assert.strictEqual(c.pwaGuideFor(k).pos, "top-right", k);
    assert.ok(c.t(c.pwaGuideFor(k).key).split("|").length >= 2, k);
  });
  assert.deepStrictEqual(Object.assign({}, c.pwaGuideFor("nope")), { pos: "center", key: "pwaG_other" });
});
