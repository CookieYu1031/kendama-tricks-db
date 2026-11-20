"use strict";
// v0.7 D2: contributors, submissions, review-mode marks.
const test = require("node:test");
const assert = require("node:assert");
const { load } = require("./_load");
const eq = (a, b) => assert.strictEqual(JSON.stringify(a), JSON.stringify(b));

function ctx(){
  return load(["js/01-data-model.js","js/02-constants-colors-icons.js","js/03-i18n.js","js/04-state.js","js/05-data-helpers.js",
    "js/71-contributors.js","js/72-submissions.js","js/76-submission-review.js"]);
}

test("email normalization + validation", () => {
  const c = ctx();
  assert.strictEqual(c.normalizeEmail("  Foo.Bar@Gmail.COM "), "foo.bar@gmail.com");
  assert.strictEqual(c.normalizeEmail(null), "");
  assert.ok(c.isValidContribEmail("a@b.co"));
  assert.ok(!c.isValidContribEmail("a@b"));
  assert.ok(!c.isValidContribEmail("a b@c.com"));
  assert.ok(!c.isValidContribEmail("a/b@c.com"));
});

test("color assignment: fixed palette, least-used first", () => {
  const c = ctx();
  assert.ok(c.CONTRIB_COLORS.length >= 8);
  c.CONTRIB_COLORS.forEach((x) => assert.ok(c.isContribColor(x)));
  assert.strictEqual(new Set(c.CONTRIB_COLORS).size, c.CONTRIB_COLORS.length);
  assert.strictEqual(c.pickContributorColor([]), c.CONTRIB_COLORS[0]);
  assert.strictEqual(c.pickContributorColor([c.CONTRIB_COLORS[0]]), c.CONTRIB_COLORS[1]);
  const all = c.CONTRIB_COLORS.slice();
  assert.strictEqual(c.pickContributorColor(all.concat([all[0]])), all[1]);
  assert.ok(!c.isContribColor("red"));
});

const trick = () => ({
  id: "abc1234", name: { zh: "測試", jp: "", en: "Test" }, categoryIds: ["catA"], order: 3, custom: true,
  landed: true, rate: "most", favorite: true, note: "private note", officialNote: "official", tagIds: ["x"],
  grip: "ken", parts: ["ken"], icon: "", color: "red",
  media: [{ id: "m1", type: "video", title: "v", url: "https://y.t/1", platform: "youtube" }, { id: "m2", type: "note", content: "n" }]
});

test("submission payload has no personal fields", () => {
  const c = ctx();
  const p = c.buildSubmissionPayload(trick(), { uid: "u1", email: "Me@Gmail.com", displayName: "Me" }, "catA");
  eq(Object.keys(p).sort(), ["email", "name", "parentId", "status", "trick", "uid"]);
  assert.strictEqual(p.email, "me@gmail.com");
  assert.strictEqual(p.status, "pending");
  ["landed", "rate", "favorite", "note", "categoryIds", "custom", "order"].forEach((k) => assert.ok(!(k in p.trick), k));
  eq(p.trick.tagIds, []);
  assert.strictEqual(p.trick.media.length, 1);
  assert.strictEqual(p.trick.officialNote, "official");
});

test("submission text is length capped", () => {
  const c = ctx();
  const t = trick(); t.name.zh = "x".repeat(500); t.officialNote = "y".repeat(5000);
  const s = c.sanitizeSubmissionTrick(t);
  assert.strictEqual(s.name.zh.length, 80);
  assert.strictEqual(s.officialNote.length, 2000);
});

test("submissionParentId picks first placement inside t00", () => {
  const c = ctx();
  const spaceOf = (id) => ({ fav: "fav", catA: "t00", catB: "t00" }[id] || null);
  assert.strictEqual(c.submissionParentId({ categoryIds: ["fav", "catB", "catA"] }, spaceOf), "catB");
  assert.strictEqual(c.submissionParentId({ categoryIds: ["fav"] }, spaceOf), null);
});

test("review marks: rows by parent, ancestor dots, distinct colors", () => {
  const c = ctx();
  const parents = { leaf: "mid", mid: "top", top: "t00" };
  const subs = [
    { id: "s1", parentId: "leaf", email: "a@x.com" },
    { id: "s2", parentId: "leaf", email: "b@x.com" },
    { id: "s3", parentId: "top", email: "a@x.com" },
    { id: "s4", parentId: "t00", email: "c@x.com" }
  ];
  const col = { "a@x.com": "#111111", "b@x.com": "#222222", "c@x.com": "#333333" };
  const m = c.computeReviewMarks(subs, (id) => parents[id] || null, (e) => col[e]);
  eq(m.rows.leaf.map((s) => s.id), ["s1", "s2"]);
  eq(m.rows.t00.map((s) => s.id), ["s4"]);
  eq(m.dots.leaf, ["#111111", "#222222"]);
  eq(m.dots.mid, ["#111111", "#222222"]);
  eq(m.dots.top, ["#111111", "#222222"]);
  eq(m.dots.t00, ["#111111", "#222222", "#333333"]);
});

test("accept transform: new id, official, filed under parentId, personal fields empty", () => {
  const c = ctx();
  const sub = { uid: "u1", email: "a@x.com", parentId: "catA", trick: c.sanitizeSubmissionTrick(trick()) };
  const raw = c.acceptTransform(sub, "NEWID01");
  assert.strictEqual(raw.id, "NEWID01");
  assert.strictEqual(raw.custom, false);
  eq(raw.categoryIds, ["catA"]);
  assert.strictEqual(raw.rate, null);
  assert.strictEqual(raw.favorite, false);
  assert.strictEqual(raw.note, "");
  const rec = c.normalizeDB({ categories: [], tricks: [raw] }).tricks[0];
  assert.strictEqual(rec.custom, false);
  assert.strictEqual(rec.name.en, "Test");
  assert.strictEqual(rec.media.length, 1);
});

test("contributor gating without login", () => {
  const c = ctx();
  assert.strictEqual(c.isContributorAccount(), false);
  assert.strictEqual(c.isReviewMode(), false);
});
