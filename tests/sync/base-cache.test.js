"use strict";
const test = require("node:test");
const assert = require("node:assert");
const { load } = require("../_load");

const FILES = ["js/01-data-model.js", "js/01-data-storage.js", "js/03-i18n.js", "js/30-drawer-logic.js", "js/50-sync-core.js", "js/53-sync-chunks.js", "js/51-base-cache.js", "js/51-shared-base.js"];

function fakeCaches(opts){
  opts = opts || {};
  const store = {};
  const cache = {
    match: async (u) => (u in store ? { text: async () => store[u] } : undefined),
    put: async (u, r) => { if(opts.putFails) throw new Error("quota"); store[u] = r.body; },
    delete: async (u) => { delete store[u]; return true; },
    keys: async () => Object.keys(store).map((url) => ({ url: "http://x" + url }))
  };
  return { store, api: { open: async () => cache } };
}
class FakeResponse { constructor(body){ this.body = body; } }

function snapshot(n){
  return { tables: ["t00"], categories: [{ id: "c" + n, spaceId: "t00", name: { zh: "c" } }], tricks: [{ id: "k" + n, categoryIds: ["c" + n] }], infos: [], tags: [] };
}
// Firestore stub: versions/{n} header + chunk docs; counts reads.
function fakeStore(versions, reads){
  const docs = {};
  versions.forEach((n) => {
    const str = JSON.stringify(snapshot(n));
    docs["sharedBase/space-index/versions/" + n] = { version: n, chunks: 1 };
    docs["sharedBase/space-index/versions/" + n + "/chunks/0"] = { data: str };
  });
  return {
    doc: (p) => ({ get: async () => { reads.n++; return { exists: p in docs, data: () => docs[p] }; } }),
    collection: (p) => ({ doc: (id) => ({ get: async () => ({ exists: true, data: () => ({ latestVersion: 3 }) }) }), get: async () => {
      reads.n++;
      const out = [];
      Object.keys(docs).forEach((k) => { if(k.indexOf(p + "/") === 0) out.push({ id: k.slice(p.length + 1), data: () => docs[k] }); });
      return { forEach: (fn) => out.forEach(fn) };
    } })
  };
}
function setup(versions, fc, extra){
  const reads = { n: 0 };
  const c = load(FILES, Object.assign({ caches: fc && fc.api, Response: FakeResponse, fbStore: fakeStore(versions || [1, 2, 3, 4], reads), localize: (n) => n && n.zh }, extra || {}));
  return { c, reads };
}
const tick = () => new Promise((r) => setTimeout(r, 5));

test("miss hits network and stores; second context hits device cache", async () => {
  const fc = fakeCaches();
  const a = setup(null, fc);
  const b1 = await a.c.fetchSharedBaseVersion(2);
  assert.strictEqual(b1.tricks[0].id, "k2");
  await tick();
  assert.ok(fc.store["/__kdb-base/space-index/2"]);
  const b = setup(null, fc);
  const b2 = await b.c.fetchSharedBaseVersion(2);
  assert.strictEqual(b2.tricks[0].id, "k2");
  assert.strictEqual(b.reads.n, 0);
});

test("corrupt cached data is deleted and network is used", async () => {
  const fc = fakeCaches();
  fc.store["/__kdb-base/space-index/2"] = JSON.stringify({ schema: 1, version: 2, raw: "{not json" });
  const a = setup(null, fc);
  const b = await a.c.fetchSharedBaseVersion(2);
  assert.strictEqual(b.tricks[0].id, "k2");
  assert.ok(a.reads.n > 0);
  await tick();
  assert.ok(JSON.parse(JSON.parse(fc.store["/__kdb-base/space-index/2"]).raw).tricks);
});

test("wrong schema or shape counts as a miss", async () => {
  const fc = fakeCaches();
  fc.store["/__kdb-base/space-index/2"] = JSON.stringify({ schema: 99, version: 2, raw: JSON.stringify(snapshot(9)) });
  const a = setup(null, fc);
  assert.strictEqual((await a.c.fetchSharedBaseVersion(2)).tricks[0].id, "k2");
  const fc2 = fakeCaches();
  fc2.store["/__kdb-base/space-index/2"] = JSON.stringify({ schema: 1, version: 2, raw: "{}" });
  const b = setup(null, fc2);
  assert.strictEqual((await b.c.fetchSharedBaseVersion(2)).tricks[0].id, "k2");
});

test("no caches support or failing put never breaks loading", async () => {
  const a = setup(null, null, { caches: undefined });
  assert.strictEqual((await a.c.fetchSharedBaseVersion(3)).tricks[0].id, "k3");
  const b = setup(null, fakeCaches({ putFails: true }));
  assert.strictEqual((await b.c.fetchSharedBaseVersion(3)).tricks[0].id, "k3");
  const c = setup(null, { api: { open: async () => { throw new Error("private mode"); } } });
  assert.strictEqual((await c.c.fetchSharedBaseVersion(3)).tricks[0].id, "k3");
});

test("keeps only the newest 2 versions", async () => {
  const fc = fakeCaches();
  const a = setup(null, fc);
  for(const v of [1, 2, 3, 4]){ await a.c.fetchSharedBaseVersion(v); await tick(); }
  assert.deepStrictEqual(Object.keys(fc.store).sort(), ["/__kdb-base/space-index/3", "/__kdb-base/space-index/4"]);
  assert.deepStrictEqual(Array.from(a.c.baseCacheStaleVersions([5, 1, 9, 3])), [3, 1]);
});

test("guest offline: pointer failure falls back to last version from device cache", async () => {
  const fc = fakeCaches();
  const real = setup(null, fc);
  await real.c.fetchSharedBaseVersion(3); await tick();
  real.c.rememberBaseVersion(3);
  assert.strictEqual(real.c.lastBaseVersion(), 3);
  // offline context: every Firestore read fails
  const off = setup(null, fc);
  off.c.localStorage.setItem("kendama-base-last-v1", "3");
  const dead = { get: async () => { throw new Error("offline"); } };
  off.c.fbStore = { doc: () => dead, collection: () => ({ doc: () => dead, get: dead.get }) };
  const p = await off.c.fetchSharedBasePointer();
  assert.strictEqual(p.failed, true);
  await off.c.loadGuestSpaceIndexBase();
  assert.ok(off.c.db.tricks.some((tr) => tr.id === "k3"));
});

test("pointer failure without remembered version leaves guest empty; success has no failed flag", async () => {
  const off = setup(null, fakeCaches());
  const dead = { get: async () => { throw new Error("offline"); } };
  off.c.fbStore = { doc: () => dead, collection: () => ({ doc: () => dead, get: dead.get }) };
  await off.c.loadGuestSpaceIndexBase();
  assert.strictEqual(off.c.db.tricks.length, 0);
  const ok = setup();
  ok.c.fbStore = { collection: () => ({ doc: () => ({ get: async () => ({ exists: true, data: () => ({ latestVersion: 4 }) }) }) }) };
  const p = await ok.c.fetchSharedBasePointer();
  assert.strictEqual(p.failed, undefined);
  assert.strictEqual(p.latestVersion, 4);
});

test("writeUserCache full: toast once per session", () => {
  const calls = [];
  const c = load(FILES, { state: { lang: "zh" }, showToast: (m, ty) => calls.push([m, ty]), localize: (n) => n && n.zh });
  c.localStorage.setItem = () => { throw new Error("QuotaExceeded"); };
  c.userCache = { uid: "u1", synced: { a: 1 } };
  assert.strictEqual(c.writeUserCache(), false);
  assert.strictEqual(c.writeUserCache(), false);
  assert.strictEqual(calls.length, 1);
  assert.strictEqual(calls[0][1], "error");
  assert.ok(calls[0][0].length > 0 && calls[0][0] !== "localCacheFull");
});

test("writeUserCache: retry success gives no toast", () => {
  const calls = [];
  const c = load(FILES, { showToast: (m) => calls.push(m), localize: (n) => n && n.zh });
  let n = 0;
  const orig = c.localStorage.setItem;
  c.localStorage.setItem = function(k, v){ if(n++ === 0) throw new Error("full"); return orig(k, v); };
  c.userCache = { uid: "u1", synced: { a: 1 } };
  assert.strictEqual(c.writeUserCache(), true);
  assert.strictEqual(calls.length, 0);
});
