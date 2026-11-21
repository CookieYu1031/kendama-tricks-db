"use strict";
const test = require("node:test");
const assert = require("node:assert");
const { load } = require("./_load");

const FILES = ["js/01-data-model.js", "js/01-data-storage.js", "js/02-constants-colors-icons.js", "js/03-i18n.js", "js/04-state.js",
  "js/05-data-helpers.js", "js/05-data-ops.js", "js/05-data-util.js", "js/50-sync-core.js", "js/53-sync-chunks.js", "js/54-sync-queue.js", "js/55-sync-conflict.js"];
let seq = 0;
const stubs = () => ({ nextId: (taken) => { let id; do { id = "id" + (++seq); } while(taken && taken(id)); return id; } });

function fresh(){ return load(FILES, stubs()); }
// loadDB() runs at script load, so storage must be filled before loading.
function loadWith(storage){
  const ls = load(["js/01-data-model.js", "js/01-data-storage.js"], {}).localStorage;
  Object.keys(storage).forEach((k) => ls.setItem(k, storage[k]));
  return load(FILES, { ...stubs(), localStorage: ls });
}

test("guest saveDB writes nothing; old guest keys are removed at load", () => {
  const ctx = loadWith({ "kendama-trick-db-v2": '{"categories":[],"tricks":[]}', "kendama-trick-db-v1": "{}" });
  assert.strictEqual(ctx.localStorage.getItem("kendama-trick-db-v2"), null);
  assert.strictEqual(ctx.localStorage.getItem("kendama-trick-db-v1"), null);
  ctx.saveDB();
  assert.strictEqual(ctx.localStorage.getItem("kendama-trick-db-v2"), null);
  assert.strictEqual(ctx.userCache, null);
});

test("signed-in saveDB marks dirty and writes the per-user cache", () => {
  const ctx = fresh();
  ctx.userCache = ctx.emptyUserCache("u1");
  ctx.db.tricks.push({ id: "tr1", name: { zh: "x", jp: "", en: "" }, categoryIds: ["t00"] });
  ctx.saveDB();
  assert.strictEqual(ctx.userCache.dirty, true);
  const saved = JSON.parse(ctx.localStorage.getItem("kendama-trick-db-v2:u:u1"));
  assert.strictEqual(saved.dirty, true);
  assert.strictEqual(saved.db.tricks.length, 1);
});

test("instant open: last uid cache is loaded before auth", () => {
  const cache = { db: { categories: [], tricks: [{ id: "zz", name: { zh: "招" }, categoryIds: ["t00"] }] },
    dirty: true, lastSyncAt: 5, cloudClientUpdatedAt: 4, hashes: {}, synced: null, isAdmin: true };
  const ctx = loadWith({ "kendama-last-uid": "u9", "kendama-trick-db-v2:u:u9": JSON.stringify(cache) });
  assert.strictEqual(ctx.db.tricks.length, 1);
  assert.strictEqual(ctx.userCache.uid, "u9");
  assert.strictEqual(ctx.isLoggedIn(), true);
  assert.strictEqual(ctx.isAdminAccount(), true);
});

test("quota exceeded drops synced and retries", () => {
  const ctx = fresh();
  ctx.userCache = ctx.emptyUserCache("u1");
  ctx.userCache.synced = { big: "x" };
  const real = ctx.localStorage.setItem;
  let calls = 0;
  ctx.localStorage.setItem = function(k, v){ calls++; if(calls === 1) throw new Error("quota"); return real(k, v); };
  assert.strictEqual(ctx.writeUserCache(), true);
  assert.strictEqual(ctx.userCache.synced, null);
});

test("diff covers infos and custom t00 tricks (round-trip)", () => {
  const ctx = fresh();
  ctx.db = ctx.normalizeDB({
    categories: [{ id: "c1", spaceId: "t00", name: { zh: "分類" } }],
    tricks: [{ id: "k1", name: { zh: "自訂招" }, categoryIds: ["c1"], custom: true }],
    infos: [{ id: "n1", spaceId: "t00", title: { zh: "說明" }, content: "hi" }]
  });
  const diff = JSON.parse(JSON.stringify(ctx.computeSpaceDiff("t00", ctx.emptyBase(0))));
  assert.strictEqual(diff.added.infos.length, 1);
  assert.strictEqual(diff.added.tricks[0].custom, true);
  const merged = ctx.mergeSpaceData(ctx.emptyBase(0), diff);
  assert.strictEqual(merged.tricks.length, 1);
  assert.strictEqual(merged.infos[0].id, "n1");
  ctx.db.infos = [];
  const base = ctx.emptyBase(1); base.infos = [{ id: "n1", spaceId: "t00" }];
  const d2 = JSON.parse(JSON.stringify(ctx.computeSpaceDiff("t00", base)));
  assert.deepStrictEqual(d2.removed.infoIds, ["n1"]);
});

test("decideSync", () => {
  const ctx = fresh();
  const c = (o) => Object.assign({ db: {}, dirty: false, lastSyncAt: 1, cloudClientUpdatedAt: 10 }, o);
  assert.strictEqual(ctx.decideSync(c({}), { exists: true, cloudTs: 10 }), "noop");
  assert.strictEqual(ctx.decideSync(c({ dirty: true }), { exists: true, cloudTs: 10 }), "push");
  assert.strictEqual(ctx.decideSync(c({}), { exists: true, cloudTs: 11 }), "pull");
  assert.strictEqual(ctx.decideSync(c({ dirty: true }), { exists: true, cloudTs: 11 }), "conflict");
  assert.strictEqual(ctx.decideSync(c({ dirty: true }), { exists: false, cloudTs: 0 }), "push");
  assert.strictEqual(ctx.decideSync(c({ db: null, lastSyncAt: 0 }), { exists: false, cloudTs: 0 }), "pull");
});

test("backfillPlatforms fills empty platform of videos", () => {
  const ctx = fresh();
  const d = { tricks: [{ media: [{ url: "https://www.youtube.com/watch?v=abc", platform: "" }] }] };
  assert.strictEqual(ctx.backfillPlatforms(d), 1);
  assert.ok(d.tricks[0].media[0].platform);
});
