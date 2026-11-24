// Multi-select + batch clipboard + duplicate in place (js/25-browse-multisel.js, js/25-browse-clip-dup.js).
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const { load } = require("../_load");

function setup(){
  const ctx = load(["js/01-data-model.js", "js/01-data-storage.js", "js/02-constants-colors-icons.js", "js/03-i18n.js", "js/04-state.js", "js/05-data-helpers.js", "js/05-data-ops.js", "js/05-data-prefix.js", "js/05-data-util.js",
    "js/06-icons-svg.js", "js/07-id.js", "js/09-names.js", "js/20-browse-order.js", "js/22-browse-drag.js", "js/25-browse-clipboard.js", "js/25-browse-multisel.js", "js/25-browse-clip-dup.js"]);
  ctx.saveDB = () => {};
  let seq = 0;
  ctx.newItemId = () => "n" + (++seq);
  const nm = (z) => ({ zh: z, jp: "", en: "" });
  ctx.db = ctx.normalizeDB({
    categories: [
      { id: "c1", parentId: null, spaceId: "t00", name: nm("c1"), order: 0 },
      { id: "e1", parentId: null, spaceId: "t00", name: nm("empty"), order: 1 }
    ],
    tricks: [
      { id: "a000000", name: nm("a"), categoryIds: ["c1"], order: 0, rate: "most", favorite: true, grip: "ken", parts: ["sara"], note: "nn", icon: "x", color: "red",
        media: [{ id: "m1", type: "video", title: "t", url: "https://youtu.be/a", platform: "youtube", loop: { a: 1, b: 5 } }] },
      { id: "b000000", name: nm("b"), categoryIds: ["c1"], order: 1 },
      { id: "d000000", name: nm("d"), categoryIds: ["c1"], order: 2 }
    ],
    infos: [], tags: []
  });
  ctx.getSpace("t00").locked = false;
  ctx.invalidateDbIndex();
  ctx.state.activeSpace = "t00";
  return ctx;
}
const env = { admin: false, activeSpace: "t00" };
const info = (id, parentId) => ({ type: "trick", id, parentId });

test("multiSelNext: first shift-click brings in last click; toggle; cross-column reset", () => {
  const c = setup();
  let s = c.multiSelNext(null, info("b000000", "c1"), info("a000000", "c1"), "t00");
  assert.deepStrictEqual(Array.from(s.items.map((x) => x.id)), ["a000000", "b000000"]);
  s = c.multiSelNext(s, info("d000000", "c1"), info("a000000", "c1"), "t00");
  assert.strictEqual(s.items.length, 3);
  s = c.multiSelNext(s, info("a000000", "c1"), null, "t00"); // toggle off
  assert.deepStrictEqual(Array.from(s.items.map((x) => x.id)), ["b000000", "d000000"]);
  const other = c.multiSelNext(s, info("x1", "e1"), info("a000000", "c1"), "t00"); // other column: only the new one
  assert.deepStrictEqual(Array.from(other.items.map((x) => x.id)), ["x1"]);
  assert.strictEqual(other.parentId, "e1");
  // last click in a different column is not brought in
  assert.strictEqual(c.multiSelNext(null, info("b000000", "c1"), info("x1", "e1"), "t00").items.length, 1);
  // removing the only member -> null
  assert.strictEqual(c.multiSelNext({ parentId: "c1", space: "t00", items: [{ type: "trick", id: "a000000" }] }, info("a000000", "c1"), null, "t00"), null);
});

test("batch clipboard shape + plans: partial ok counts", () => {
  const c = setup();
  c.state.editMode = true;
  c.clipboardItem = { mode: "copy", items: [{ type: "trick", id: "a000000" }, { type: "trick", id: "gone" }, { type: "trick", id: "b000000" }], srcParent: "c1", srcSpace: "t00" };
  const clips = c.clipClipsOf(c.clipboardItem);
  assert.strictEqual(clips.length, 3);
  assert.strictEqual(clips[0].srcParent, "c1");
  const plans = clips.map((k) => c.clipPlanPaste(k, "e1", env));
  const cnt = c.clipBatchCounts(plans);
  assert.deepStrictEqual({ ok: cnt.ok, skipped: cnt.skipped }, { ok: 2, skipped: 1 });
  assert.strictEqual(plans[1].err, "clipGone");
  const ext = { mode: "copy", type: "extTrick", ext: {} };
  assert.strictEqual(c.clipClipsOf(ext)[0], ext);
});

test("dup validity: token must match, copy only, same table", () => {
  const c = setup();
  const cb = { mode: "copy", items: [{ type: "trick", id: "a000000" }], srcParent: "c1", srcSpace: "t00", token: 5 };
  assert.ok(c.clipDupValid(cb, 5, env));
  assert.ok(!c.clipDupValid(cb, 6, env));
  assert.ok(!c.clipDupValid(Object.assign({}, cb, { mode: "cut" }), 5, env));
  assert.ok(!c.clipDupValid(cb, 5, { admin: false, activeSpace: "t01" }));
  const t0 = c.clipSelToken; c.clipInvalidate();
  assert.strictEqual(c.clipSelToken, t0 + 1);
});

test("dup trick: new id, new media ids, loop kept, no rate/favorite, only this container", () => {
  const c = setup();
  const clip = { mode: "copy", type: "trick", id: "a000000", srcParent: "c1", srcSpace: "t00" };
  const plan = c.clipPlanDup(clip, env);
  assert.deepStrictEqual({ ok: plan.ok, op: plan.op }, { ok: true, op: "dupTrick" });
  const before = c.db.tricks.length;
  const nid = c.clipApplyDup(clip, plan, env);
  assert.strictEqual(c.db.tricks.length, before + 1);
  const tr = c.getTrick(nid);
  assert.notStrictEqual(nid, "a000000");
  assert.strictEqual(tr.name.zh, "a");
  assert.strictEqual(tr.media.length, 1);
  assert.notStrictEqual(tr.media[0].id, "m1");
  assert.strictEqual(tr.media[0].loop.b, 5);
  assert.strictEqual(tr.media[0].url, "https://youtu.be/a");
  assert.strictEqual(tr.grip, "ken");
  assert.strictEqual(tr.note, "nn");
  assert.notStrictEqual(tr.favorite, true);
  assert.ok(!tr.rate);
  assert.deepStrictEqual(Array.from(tr.categoryIds), ["c1"]);
  assert.strictEqual(c.getTrick("a000000").rate, "most"); // original untouched
  // placed right below the original
  const ids = c.buildColumnItems("c1").map((x) => x.id);
  assert.strictEqual(ids.indexOf(nid), ids.indexOf("a000000") + 1);
});

test("dup list / info go to same level below the original", () => {
  const c = setup();
  const clip = { mode: "copy", type: "category", id: "c1", srcParent: null, srcSpace: "t00" };
  const plan = c.clipPlanDup(clip, env);
  assert.strictEqual(plan.op, "copyFolder");
  const nid = c.clipApplyDup(clip, plan, env);
  assert.strictEqual(c.getCategory(nid).parentId, null);
  const ids = c.buildColumnItems(null).map((x) => x.id);
  assert.strictEqual(ids.indexOf(nid), ids.indexOf("c1") + 1);
});

test("dup respects permissions (locked table, non-admin)", () => {
  const c = setup();
  c.getSpace("t00").locked = true;
  const clip = { mode: "copy", type: "trick", id: "a000000", srcParent: "c1", srcSpace: "t00" };
  assert.strictEqual(c.clipPlanDup(clip, env).err, "clipNoPerm");
  assert.strictEqual(c.clipPlanDup(clip, { admin: true, activeSpace: "t00" }).ok, true);
});

test("clipInsertAfter moves new entry right after the original", () => {
  const c = setup();
  const arr = [{ type: "trick", id: "a" }, { type: "trick", id: "b" }, { type: "trick", id: "n" }];
  const out = c.clipInsertAfter(arr, "trick", "n", "trick", "a");
  assert.deepStrictEqual(Array.from(out.map((x) => x.id)), ["a", "n", "b"]);
});

// ---- prefix follows the placement (v0.16) ----
function withPrefixes(c){
  const tr = c.getTrick("a000000");
  c.setTrickPrefix(tr, "c1", "1-2");
  c.getCategory("c1").prefix = "A";
  c.invalidateDbIndex();
  return tr;
}

test("prefix: ref copy carries the source placement prefix to the target key", () => {
  const c = setup(); const tr = withPrefixes(c);
  const clip = { mode: "copy", type: "trick", id: "a000000", srcParent: "c1", srcSpace: "t00" };
  const plan = c.clipPlanPaste(clip, "e1", env);
  assert.strictEqual(plan.op, "ref");
  c.clipApplyPaste(clip, "e1", plan, env);
  assert.strictEqual(c.getTrickPrefix(tr, "e1"), "1-2");
  assert.strictEqual(c.getTrickPrefix(tr, "c1"), "1-2"); // source keeps it
});

test("prefix: move (cut) trick moves the prefix and clears the source key", () => {
  const c = setup(); const tr = withPrefixes(c);
  const clip = { mode: "cut", type: "trick", id: "a000000", srcParent: "c1", srcSpace: "t00" };
  const plan = c.clipPlanPaste(clip, "e1", { admin: true, activeSpace: "t00" });
  assert.strictEqual(plan.op, "move");
  c.clipApplyPaste(clip, "e1", plan, { admin: true, activeSpace: "t00" });
  assert.strictEqual(c.getTrickPrefix(tr, "e1"), "1-2");
  assert.strictEqual(c.getTrickPrefix(tr, "c1"), "");
});

test("prefix: list copy keeps the list prefix and each inner trick prefix; move keeps list prefix", () => {
  const c = setup(); withPrefixes(c);
  const clip = { mode: "copy", type: "category", id: "c1", srcParent: null, srcSpace: "t00" };
  const plan = c.clipPlanPaste(clip, "e1", env);
  assert.strictEqual(plan.op, "copyFolder");
  const nid = c.clipApplyPaste(clip, "e1", plan, env);
  assert.strictEqual(c.getCategory(nid).prefix, "A");
  assert.strictEqual(c.getTrickPrefix(c.getTrick("a000000"), nid), "1-2");
  assert.strictEqual(c.getTrickPrefix(c.getTrick("b000000"), nid), "");
  assert.ok(!("prefix" in c.getCategory("e1")));
  const mv = { mode: "cut", type: "category", id: "c1", srcParent: null, srcSpace: "t00" };
  const a = { admin: true, activeSpace: "t00" };
  c.clipApplyPaste(mv, "e1", c.clipPlanPaste(mv, "e1", a), a);
  assert.strictEqual(c.getCategory("c1").prefix, "A");
});

test("prefix: in-place duplicate keeps the same-level prefix", () => {
  const c = setup(); withPrefixes(c);
  const clip = { mode: "copy", type: "trick", id: "a000000", srcParent: "c1", srcSpace: "t00" };
  const nid = c.clipApplyDup(clip, c.clipPlanDup(clip, env), env);
  assert.strictEqual(c.getTrickPrefix(c.getTrick(nid), "c1"), "1-2");
  const cc = { mode: "copy", type: "category", id: "c1", srcParent: null, srcSpace: "t00" };
  const cid = c.clipApplyDup(cc, c.clipPlanDup(cc, env), env);
  assert.strictEqual(c.getCategory(cid).prefix, "A");
});

test("prefix: drag reparent carries it; removing a placement drops it", () => {
  const c = setup(); const tr = withPrefixes(c);
  c.reparentItem({ type: "trick", id: "a000000", ref: tr }, "c1", "e1");
  assert.strictEqual(c.getTrickPrefix(tr, "e1"), "1-2");
  assert.strictEqual(c.getTrickPrefix(tr, "c1"), "");
  assert.ok(!tr.prefixByCategory || !("c1" in tr.prefixByCategory));
  c.setTrickPrefix(tr, "c1", "9"); tr.categoryIds.push("c1");
  c.removeTrickPlacement("a000000", "c1");
  assert.strictEqual(c.getTrickPrefix(tr, "c1"), "");
  assert.strictEqual(c.getTrickPrefix(tr, "e1"), "1-2");
});

test("clipPasteIsDup: copy back to the source column of the same table only", () => {
  const c = setup();
  const cb = { mode: "copy", items: [{ type: "trick", id: "a000000" }], srcParent: "c1", srcSpace: "t00" };
  assert.ok(c.clipPasteIsDup(cb, "c1", "t00"));
  assert.ok(!c.clipPasteIsDup(cb, "e1", "t00"));
  assert.ok(!c.clipPasteIsDup(cb, "c1", "t01"));
  assert.ok(!c.clipPasteIsDup(Object.assign({}, cb, { mode: "cut" }), "c1", "t00"));
  assert.ok(!c.clipPasteIsDup({ mode: "copy", type: "extTrick", ext: {} }, null, "t00"));
  const root = { mode: "copy", items: [{ type: "category", id: "c1" }], srcParent: null, srcSpace: "t00" };
  assert.ok(c.clipPasteIsDup(root, null, "t00"));
});
