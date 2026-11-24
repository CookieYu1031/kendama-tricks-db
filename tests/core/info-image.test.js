// Info image (js/46-info-image.js pure logic + load cache; js/01-data-storage.js normalizeInfoImage).
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const { load } = require("../_load");

function setup(extra){
  return load(["js/01-data-model.js", "js/01-data-storage.js", "js/02-constants-colors-icons.js", "js/03-i18n.js", "js/04-state.js",
    "js/05-data-helpers.js", "js/05-data-ops.js", "js/05-data-util.js", "js/06-icons-svg.js", "js/46-info-image.js"], extra || {});
}
const J = (o) => JSON.parse(JSON.stringify(o));
const GOOD = "data:image/webp;base64,AAAA";

test("normalizeInfoImage: valid keeps fixed key order, invalid -> null", () => {
  const c = setup();
  assert.strictEqual(JSON.stringify(c.normalizeInfoImage({ size: 5, h: 2, w: 3, id: "ab_-1", extra: 1 })), '{"id":"ab_-1","w":3,"h":2,"size":5}');
  [null, 5, {}, { id: "a b", w: 1, h: 1, size: 1 }, { id: "x".repeat(41), w: 1, h: 1, size: 1 }, { id: "a", w: 0, h: 1, size: 1 },
    { id: "a", w: 4001, h: 1, size: 1 }, { id: "a", w: 1.5, h: 1, size: 1 }, { id: "a", w: 1, h: 1, size: 200001 }, { id: "a", w: 1, h: 1, size: "9" }]
    .forEach((v) => assert.strictEqual(c.normalizeInfoImage(v), null));
});

test("normalizeDB infos: image / prefix kept only when valid", () => {
  const c = setup();
  const nm = { zh: "i", jp: "", en: "" };
  const d = c.normalizeDB({ infos: [
    { id: "i1", title: nm, image: { id: "a", w: 10, h: 20, size: 300 }, prefix: "P" },
    { id: "i2", title: nm, image: { id: "bad id", w: 10, h: 20, size: 300 }, prefix: "" },
    { id: "i3", title: nm }
  ] });
  assert.deepStrictEqual(J(d.infos[0].image), { id: "a", w: 10, h: 20, size: 300 });
  assert.strictEqual(d.infos[0].prefix, "P");
  assert.ok(!("image" in d.infos[1]) && !("prefix" in d.infos[1]) && !("image" in d.infos[2]));
});

test("infoImageUsage: dedupes by id, except info (object or id) left out", () => {
  const c = setup();
  const a = { id: "i1", image: { id: "x", size: 100 } }, b = { id: "i2", image: { id: "x", size: 100 } };
  const d = { id: "i3", image: { id: "y", size: 50 } }, e = { id: "i4" };
  const all = [a, b, d, e];
  assert.strictEqual(c.infoImageUsage(all, null), 150);
  assert.strictEqual(c.infoImageUsage(all, d), 100);
  assert.strictEqual(c.infoImageUsage(all, "i3"), 100);
  assert.strictEqual(c.infoImageUsage(all, a), 150); // b still uses x
  assert.strictEqual(c.infoImageUsage([a], a), 0);
  assert.strictEqual(c.infoImageUsage(null, null), 0);
});

test("infoImageFits: 1 MB total cap incl. replacement", () => {
  const c = setup();
  const max = c.INFO_IMG.TOTAL_MAX;
  assert.strictEqual(max, 1048576);
  const infos = [{ id: "a", image: { id: "p", size: max - 1000 } }];
  assert.strictEqual(c.infoImageFits(infos, null, 1000), true);
  assert.strictEqual(c.infoImageFits(infos, null, 1001), false);
  assert.strictEqual(c.infoImageFits(infos, infos[0], 100000), true); // replacing the only user frees its bytes
  infos.push({ id: "b", image: { id: "p", size: max - 1000 } }); // second user of the same picture
  assert.strictEqual(c.infoImageFits(infos, infos[0], 100000), false);
});

test("infoImageFit never upscales; plan = sizes x qualities, 1000 -> 480 by 85%", () => {
  const c = setup();
  assert.deepStrictEqual(J(c.infoImageFit(500, 250, 1000)), { w: 500, h: 250 });
  assert.deepStrictEqual(J(c.infoImageFit(4000, 2000, 1000)), { w: 1000, h: 500 });
  const plan = J(c.infoImagePlan(4000, 2000));
  assert.deepStrictEqual(plan.slice(0, 5).map((p) => p.q), [0.82, 0.7, 0.58, 0.46, 0.36]);
  assert.deepStrictEqual(plan[0], { w: 1000, h: 500, q: 0.82 });
  const longs = Array.from(new Set(plan.map((p) => Math.max(p.w, p.h))));
  assert.strictEqual(longs[0], 1000);
  assert.strictEqual(longs[1], 850);
  assert.strictEqual(longs[longs.length - 1], 480);
  assert.ok(longs.every((v, i) => i === 0 || v < longs[i - 1]));
  assert.strictEqual(plan.length, longs.length * 5);
  const small = J(c.infoImagePlan(300, 200)); // small source: one size, no upscaling
  assert.ok(small.every((p) => p.w === 300 && p.h === 200));
  assert.strictEqual(small.length, 5);
});

test("infoImageBytes / infoImageValidData", () => {
  const c = setup();
  assert.strictEqual(c.infoImageBytes("data:image/png;base64,QUJD"), 3);
  assert.strictEqual(c.infoImageBytes("data:image/png;base64,QUI="), 2);
  assert.strictEqual(c.infoImageBytes("data:image/png;base64,QQ=="), 1);
  assert.strictEqual(c.infoImageValidData(GOOD), true);
  assert.strictEqual(c.infoImageValidData("data:image/jpeg;base64,/9j/4AAQ"), true);
  assert.strictEqual(c.infoImageValidData("data:image/gif;base64,AAAA"), false);
  assert.strictEqual(c.infoImageValidData("data:image/svg+xml;base64,AAAA"), false);
  assert.strictEqual(c.infoImageValidData("javascript:alert(1)"), false);
  assert.strictEqual(c.infoImageValidData(null), false);
  assert.strictEqual(c.infoImageValidData("data:image/webp;base64," + "A".repeat(150000)), false);
});

function fakeStore(docs, counter){
  return { collection: (n) => ({ doc: (id) => ({
    get: () => { counter.n++; return Promise.resolve(docs[id] === undefined ? { exists: false } : { exists: true, data: () => docs[id] }); },
    set: (d) => { docs[id] = d; counter.sets.push({ n: n, id: id, d: d }); return Promise.resolve(); } }) }) };
}

test("infoImageLoad: Firestore once, memory hit after, in-flight dedupe, bad data -> null (not cached)", async () => {
  const cnt = { n: 0, sets: [] };
  const docs = { good1: { data: GOOD }, bad1: { data: "data:text/html;base64,AAAA" } };
  const c = setup({ fbStore: fakeStore(docs, cnt) });
  const both = await Promise.all([c.infoImageLoad("good1"), c.infoImageLoad("good1")]);
  assert.strictEqual(both[0], GOOD); assert.strictEqual(both[1], GOOD);
  assert.strictEqual(cnt.n, 1);
  assert.strictEqual(await c.infoImageLoad("good1"), GOOD);
  assert.strictEqual(cnt.n, 1);
  assert.strictEqual(await c.infoImageLoad("bad1"), null);
  assert.strictEqual(await c.infoImageLoad("missing"), null);
  assert.strictEqual(await c.infoImageLoad("bad id!"), null);
  assert.strictEqual(cnt.n, 3);
  docs.bad1 = { data: GOOD }; // failure is not cached: retry now succeeds
  assert.strictEqual(await c.infoImageLoad("bad1"), GOOD);
});

test("infoImageLoad: Firestore error -> null; Cache Storage hit skips Firestore; LRU cap 12", async () => {
  const cnt = { n: 0, sets: [] };
  const bad = { collection: () => ({ doc: () => ({ get: () => Promise.reject(new Error("offline")) }) }) };
  let c = setup({ fbStore: bad });
  assert.strictEqual(await c.infoImageLoad("off1"), null);
  const store = { "/__info-img/cached1": GOOD };
  const caches = { open: () => Promise.resolve({
    match: (k) => Promise.resolve(store[k] ? { text: () => Promise.resolve(store[k]) } : undefined),
    put: (k) => { store[k] = "put"; return Promise.resolve(); } }) };
  c = setup({ fbStore: fakeStore({ n0: { data: GOOD } }, cnt), caches: caches });
  assert.strictEqual(await c.infoImageLoad("cached1"), GOOD);
  assert.strictEqual(cnt.n, 0);
  for (let i = 0; i < 15; i++) c.infoImageMemPut("k" + i, GOOD);
  assert.strictEqual(c.infoImageMem.size, 12);
  assert.strictEqual(c.infoImageMemGet("k0"), null);
  assert.strictEqual(c.infoImageMemGet("k14"), GOOD);
  // a throwing caches object is ignored silently
  c = setup({ fbStore: fakeStore({ n0: { data: GOOD } }, cnt), caches: { open: () => { throw new Error("x"); } } });
  assert.strictEqual(await c.infoImageLoad("n0"), GOOD);
});

test("infoImageUpload: admin only, total cap, writes immutable doc with valid id", async () => {
  const cnt = { n: 0, sets: [] };
  const firebase = { firestore: { FieldValue: { serverTimestamp: () => "TS" } } };
  const c = setup({ fbStore: fakeStore({}, cnt), firebase: firebase });
  const enc = { dataUrl: GOOD, w: 100, h: 50, size: 3000 };
  await assert.rejects(c.infoImageUpload(enc), (e) => e.key === "infoImgNoPerm");
  c.isAdminAccount = () => true; c.authCurrentUser = { uid: "u9" };
  assert.strictEqual(c.infoImageAllowed(), true);
  c.db = { infos: [{ id: "a", image: { id: "old", size: c.INFO_IMG.TOTAL_MAX - 1000 } }] };
  await assert.rejects(c.infoImageUpload(enc), (e) => e.key === "infoImgTotalFull");
  const ok = await c.infoImageUpload(enc, c.db.infos[0]);
  assert.ok(/^[0-9A-Za-z_-]{1,40}$/.test(ok.id));
  assert.deepStrictEqual([ok.w, ok.h, ok.size], [100, 50, 3000]);
  assert.strictEqual(cnt.sets[0].n, "infoImages");
  assert.deepStrictEqual(Object.keys(cnt.sets[0].d), ["data", "by", "createdAt"]);
  assert.strictEqual(cnt.sets[0].d.by, "u9");
  assert.strictEqual(await c.infoImageLoad(ok.id), GOOD); // cached after upload, no Firestore get
  assert.strictEqual(cnt.n, 0);
  await assert.rejects(c.infoImageUpload({ dataUrl: "nope", w: 1, h: 1, size: 1 }), (e) => e.key === "infoImgReadFail");
});
