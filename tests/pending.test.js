"use strict";
// v0.6: publish scope (t00/t01/t02 + tags), label, version list, pending marks, restore.
const test = require("node:test");
const assert = require("node:assert");
const { load } = require("./_load");

const stubEl = () => ({
  style: {}, classList: { add() {}, remove() {}, toggle() {} }, appendChild() {}, setAttribute() {},
  addEventListener() {}, dataset: {}
});

// Tiny in-memory Firestore: enough for set / get / batch / collection listing.
function fakeFirestore(store) {
  const snap = (path) => ({
    exists: path in store, id: path.split("/").pop(),
    data: () => Object.assign({}, store[path])
  });
  const ref = (path) => ({
    path,
    get: () => Promise.resolve(snap(path)),
    set: (d) => { store[path] = Object.assign({}, d); return Promise.resolve(); },
    doc: (id) => ref(path + "/" + id),
    collection: (id) => coll(path + "/" + id)
  });
  const coll = (path) => ({
    doc: (id) => ref(path + "/" + id),
    get: () => {
      const docs = Object.keys(store)
        .filter((k) => k.startsWith(path + "/") && k.slice(path.length + 1).indexOf("/") === -1)
        .map((k) => snap(k));
      return Promise.resolve({ forEach: (fn) => docs.forEach(fn) });
    }
  });
  return {
    doc: ref,
    collection: coll,
    batch: () => {
      const ops = [];
      return {
        set: (r, d) => ops.push([r.path, d]),
        delete: (r) => ops.push([r.path, null]),
        commit: () => { ops.forEach(([p, d]) => { if (d === null) delete store[p]; else store[p] = d; }); return Promise.resolve(); }
      };
    }
  };
}

function setup(store) {
  let seq = 0;
  const toasts = [];
  const ctx = load(
    ["js/01-data-model.js", "js/02-constants-colors-icons.js", "js/04-state.js", "js/05-data-helpers.js",
      "js/50-sync-core.js", "js/51-shared-base.js", "js/53-sync-chunks.js", "js/56-pending.js"],
    {
      localize: (n) => n && (n.zh || n.en),
      addStrings: () => {},
      t: (k) => k,
      nextId: (taken) => { let id; do { id = "id" + (++seq); } while (taken && taken(id)); return id; },
      showToast: (m, k) => toasts.push(k === "error" ? "ERR:" + m : m),
      render: () => {},
      forceSyncNow: () => Promise.resolve(),
      document: { getElementById: stubEl, querySelector: () => null, querySelectorAll: () => [], addEventListener() {}, createElement: stubEl },
      fbStore: fakeFirestore(store || {}),
      firebase: { firestore: { FieldValue: { serverTimestamp: () => ({ toMillis: () => 1700000000000 }) } } }
    }
  );
  ctx.__toasts = toasts;
  ctx.isLoggedIn = () => true;
  ctx.isAdminAccount = () => true;
  ctx.authCurrentUser = { uid: "admin1" };
  return ctx;
}

const J = (x) => JSON.parse(JSON.stringify(x));
const cat = (id, spaceId, parentId, extra) => Object.assign({ id, spaceId, parentId: parentId || null, name: { zh: id }, order: 0, icon: "", color: "default" }, extra);
const trick = (id, cids, extra) => Object.assign({ id, categoryIds: cids, name: { zh: id } }, extra);

// A published-style snapshot: normalized like a real db (so unchanged items compare equal).
function baseOf(ctx) {
  const d = ctx.normalizeDB({
    categories: [cat("a", "t00"), cat("b", "t00", "a"), cat("f1", "t01")],
    tricks: [trick("k1", ["a"]), trick("k2", ["b"]), trick("k3", ["f1"])],
    infos: [{ id: "n1", spaceId: "t00", parentId: "a", title: { zh: "n1" } }],
    tags: [{ id: "g1", name: { zh: "g1" } }]
  });
  return Object.assign({ version: 3 }, J(ctx.buildPublishSnapshot(d)));
}

test("computePendingStatus: added / modified / removed / ancestors / tags", () => {
  const c = setup();
  const base = baseOf(c);
  const data = J(base);
  data.tricks.find((x) => x.id === "k2").name = { zh: "changed" };      // modified (in b, under a)
  data.tricks = data.tricks.filter((x) => x.id !== "k3");                // removed (under f1)
  data.categories.push(cat("new", "t02"));                               // added root folder in t02
  data.tags.push({ id: "g2", name: { zh: "g2" } });                      // tag added
  data.tricks.push(trick("mine", ["fav"], { custom: true }));            // not in shared tables: ignored
  const r = J(c.computePendingStatus(base, data));
  assert.deepStrictEqual(r.byId, { k2: "modified", k3: "removed", new: "added" });
  assert.deepStrictEqual(r.summary, { added: 1, modified: 1, removed: 1, tags: 1 });
  assert.deepStrictEqual(r.removedItems.map((x) => [x.type, x.id]), [["trick", "k3"]]);
  assert.deepStrictEqual(Object.keys(r.ancestorsWithChanges).sort(), ["a", "b", "f1"]);
});

test("computePendingStatus: no changes -> empty", () => {
  const c = setup();
  const base = baseOf(c);
  const r = J(c.computePendingStatus(base, J(base)));
  assert.deepStrictEqual(r.byId, {});
  assert.deepStrictEqual(r.ancestorsWithChanges, {});
  assert.deepStrictEqual(r.summary, { added: 0, modified: 0, removed: 0, tags: 0 });
});

test("removed folder and info are ghosts with parent link", () => {
  const c = setup();
  const base = baseOf(c);
  const data = J(base);
  data.infos = [];
  data.categories = data.categories.filter((x) => x.id !== "b");
  data.tricks = data.tricks.filter((x) => x.id !== "k2");
  const r = J(c.computePendingStatus(base, data));
  assert.deepStrictEqual(Object.keys(r.byId).sort(), ["b", "k2", "n1"]);
  assert.ok(r.ancestorsWithChanges.a);
  c._pendingNow = c.computePendingStatus(base, data);
  c.state.activeSpace = "t00";
  assert.deepStrictEqual(Array.from(c.pendingGhostItems("a")).map((x) => x.type + ":" + x.id).sort(), ["category:b", "info:n1"]);
  assert.deepStrictEqual(Array.from(c.pendingGhostItems(null)), []);
});

test("restore re-inserts the base copy (folder brings removed descendants)", () => {
  const c = setup();
  const base = baseOf(c);
  c.baseDataCache["t00@3"] = base;
  c._currentViewingVersion = 3;
  c.db = c.normalizeDB(J(base));
  c.db.categories = c.db.categories.filter((x) => x.id !== "b");
  c.db.tricks = c.db.tricks.filter((x) => x.id !== "k2");
  c.saveDB = () => {};
  assert.equal(c.getTrick("k2"), undefined);
  assert.equal(c.restorePendingRemoved("b"), 2);
  assert.ok(c.db.categories.some((x) => x.id === "b"));
  assert.deepStrictEqual(J(c.getTrick("k2").categoryIds), ["b"]);
  assert.equal(c.restorePendingRemoved("b"), 0); // already there
  const r = c.computePendingStatus(base, c.db);
  assert.deepStrictEqual(J(r.byId), {});
});

test("getPendingSummary: names + counts; not admin / no base -> not ready", () => {
  const c = setup();
  const base = baseOf(c);
  c.baseDataCache["t00@3"] = base;
  c._currentViewingVersion = 3;
  c.db = c.normalizeDB(J(base));
  c.db.tricks.find((x) => x.id === "k1").name = { zh: "renamed" };
  c.db.tricks = c.db.tricks.filter((x) => x.id !== "k3");
  const s = J(c.getPendingSummary());
  assert.equal(s.ready, true);
  assert.equal(s.modified, 1); assert.equal(s.removed, 1);
  assert.deepStrictEqual(s.names.modified, ["renamed"]);
  assert.deepStrictEqual(s.names.removed, ["k3"]);
  c.isAdminAccount = () => false;
  assert.equal(c.getPendingSummary().ready, false);
  assert.equal(c.getPendingState(), null);
  c.isAdminAccount = () => true;
  c._currentViewingVersion = 9;
  assert.equal(c.getPendingSummary().ready, false);
});

test("old snapshot (no tables list) = t00 only; t01/t02 keep local", () => {
  const c = setup();
  const old = c.normalizeBaseSnapshot(1, { categories: [cat("a", "t00")], tricks: [trick("k1", ["a"])] });
  assert.deepStrictEqual(J(old.tables), ["t00"]);
  assert.equal(c.baseForSpace(old, "t00").categories.length, 1);
  assert.equal(c.baseForSpace(old, "t01").categories.length, 0);
  assert.equal(c.baseForSpace(old, "fav").categories.length, 0);
  // merge: user's t01 content survives an old base
  c.db = c.normalizeDB({ categories: [cat("a", "t00"), cat("f1", "t01")], tricks: [trick("k1", ["a"])] });
  const diff = c.computeSpaceDiff("t01", c.baseForSpace(old, "t01"));
  const merged = c.mergeSpaceData(c.baseForSpace(old, "t01"), J(diff));
  assert.ok(merged.categories.some((x) => x.id === "f1"));
});

test("new snapshot splits per table; diff vs slice is empty when unchanged", () => {
  const c = setup();
  const base = c.normalizeBaseSnapshot(3, baseOf(c));
  assert.deepStrictEqual(J(c.baseForSpace(base, "t01").tricks.map((x) => x.id)), ["k3"]);
  assert.deepStrictEqual(J(c.baseForSpace(base, "t00").tricks.map((x) => x.id)).sort(), ["k1", "k2"]);
  c.db = c.normalizeDB(J(base));
  ["t00", "t01"].forEach((sid) => {
    assert.equal(c.isEmptyDiff(c.computeSpaceDiff(sid, c.baseForSpace(base, sid))), true, sid);
  });
});

test("publish snapshot: 00/01/02 + tags, seeded folders once", () => {
  const c = setup();
  c.db = c.normalizeDB({
    categories: [cat("a", "t00")], tricks: [trick("k1", ["a"]), trick("k9", ["t02"]), trick("mine", ["fav"])],
    infos: [], tags: [{ id: "g1", name: { zh: "g1" } }]
  });
  const snap = J(c.buildPublishSnapshot(c.db));
  assert.deepStrictEqual(snap.tables, ["t00", "t01", "t02"]);
  assert.deepStrictEqual(snap.tricks.map((x) => x.id).sort(), ["k1", "k9"]);
  const ids = snap.categories.map((x) => x.id);
  assert.equal(ids.length, new Set(ids).size);
  ["a", "s01jka", "s01glk", "s02kwc", "s02nak", "s02btb", "s02ekc"].forEach((id) => assert.ok(ids.indexOf(id) !== -1, id));
  assert.equal(snap.tags.length, 1);
});

test("label / note validation", () => {
  const c = setup();
  assert.equal(c.validatePublishInput("n", ""), null);
  assert.equal(c.validatePublishInput("n", "1.0.3"), null);
  assert.equal(c.validatePublishInput("", "x"), "publishNoteRequired");
  assert.equal(c.validatePublishInput("n", "x".repeat(33)), "publishLabelInvalid");
  assert.equal(c.validatePublishInput("n", "x".repeat(32)), null);
  assert.equal(c.validatePublishInput("x".repeat(501), ""), "publishNoteTooLong");
});

test("publishSpaceIndexUpdate: writes label to version doc + pointer, lists versions", async () => {
  const store = {};
  const c = setup(store);
  c.db = c.normalizeDB({ categories: [cat("a", "t00")], tricks: [trick("k1", ["a"])] });
  const r1 = await c.publishSpaceIndexUpdate(" first ", " 1.0.0 ");
  assert.deepStrictEqual(J(r1), { ok: true, version: 1, label: "1.0.0" });
  const r2 = await c.publishSpaceIndexUpdate("second", "");
  assert.deepStrictEqual(J(r2), { ok: true, version: 2, label: "" });
  assert.equal(store["sharedBase/space-index"].latestVersion, 2);
  assert.equal(store["sharedBase/space-index/versions/1"].versionLabel, "1.0.0");
  assert.equal(store["sharedBase/space-index/versions/1"].note, "first");
  const payload = JSON.parse(store["sharedBase/space-index/versions/1/chunks/0"].data);
  assert.deepStrictEqual(payload.tables, ["t00", "t01", "t02"]);
  const p = J(await c.getPublishedPointer());
  assert.deepStrictEqual(p, { latestVersion: 2, latestLabel: "", latestNote: "second", publishedAt: 1700000000000 });
  const list = J(await c.listPublishedVersions(10));
  assert.deepStrictEqual(list.map((x) => [x.version, x.label, x.note]), [[2, "", "second"], [1, "1.0.0", "first"]]);
  assert.equal(J(await c.listPublishedVersions(1)).length, 1);
  // bad input -> {ok:false}, nothing written
  assert.deepStrictEqual(J(await c.publishSpaceIndexUpdate("n", "x".repeat(40))), { ok: false });
  assert.equal(store["sharedBase/space-index"].latestVersion, 2);
  // non-admin
  c.isAdminAccount = () => false;
  assert.deepStrictEqual(J(await c.publishSpaceIndexUpdate("n", "")), { ok: false });
});

test("guest load replaces covered tables only (old snapshot keeps t01/t02)", async () => {
  const store = {
    "sharedBase/space-index": { latestVersion: 1, latestNote: "x" },
    "sharedBase/space-index/versions/1": { version: 1, note: "x", chunks: 1 },
    "sharedBase/space-index/versions/1/chunks/0": { data: JSON.stringify({ categories: [cat("a", "t00")], tricks: [trick("k1", ["a"])], infos: [], tags: [] }) }
  };
  const c = setup(store);
  c.db = c.normalizeDB({ categories: [cat("zz", "t00")] }); // seeds t01/t02 folders
  await c.loadGuestSpaceIndexBase();
  const ids = c.db.categories.map((x) => x.id);
  assert.ok(ids.indexOf("a") !== -1 && ids.indexOf("zz") === -1);
  assert.ok(ids.indexOf("s01jka") !== -1 && ids.indexOf("s02kwc") !== -1);
});

test("computePendingStatus v0.8.2: order-only change flags the folder, not the siblings", () => {
  const c = setup();
  const base = baseOf(c);
  const data = J(base);
  // reorder inside folder "a": sub-folder b gets a new order, trick k1 a new orderByCategory
  data.categories.find((x) => x.id === "b").order = 5;
  data.tricks.find((x) => x.id === "k1").orderByCategory = { a: 7 };
  const r = J(c.computePendingStatus(base, data));
  assert.deepStrictEqual(r.byId, { a: "modified" });
  assert.strictEqual(r.summary.modified, 1);
});

test("computePendingStatus v0.8.2: content change still flags the item; order alone never does", () => {
  const c = setup();
  const base = baseOf(c);
  const data = J(base);
  data.tricks.find((x) => x.id === "k2").name = { zh: "changed" };
  data.tricks.find((x) => x.id === "k2").orderByCategory = { b: 3 };
  const r = J(c.computePendingStatus(base, data));
  assert.strictEqual(r.byId.k2, "modified");
  assert.strictEqual(r.byId.b, "modified");   // its order changed inside b
  assert.strictEqual(r.byId.k1, undefined);
});
