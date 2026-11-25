"use strict";
const test = require("node:test");
const assert = require("node:assert");
const { load } = require("../_load");

function demoCtx(){
  return load(["js/01-data-model.js", "js/01-data-storage.js", "js/02-constants-colors-icons.js", "js/03-i18n.js", "js/04-state.js",
    "js/18-shell-tour.js", "js/18-tour-demo.js", "js/18-tour-steps.js"], { URL });
}
const YT = "https://www.youtube.com/watch?v=abc123";
function cat(id, parentId, spaceId){ return { id, parentId, spaceId: spaceId || "t00" }; }
function trick(id, o){ return Object.assign({ id, custom:false, categoryIds:["c1"], parts:[], media:[], tagIds:[], grip:null }, o || {}); }

test("tour demo: tourCatPath depth and reachability", () => {
  const c = demoCtx();
  const db = { categories: [cat("c1", null), cat("c2", "c1"), cat("c3", "c2"), cat("c4", "c3"), cat("c5", "c4"), cat("x1", null, "t01"), cat("o1", "tr9")] };
  assert.deepStrictEqual(Array.from(c.tourCatPath(db, "t00")), []);
  assert.deepStrictEqual(Array.from(c.tourCatPath(db, "c3")), ["c1", "c2", "c3"]);
  assert.deepStrictEqual(Array.from(c.tourCatPath(db, "c4")), ["c1", "c2", "c3", "c4"]);
  assert.strictEqual(c.tourCatPath(db, "c5"), null);   // 5 levels: too deep
  assert.strictEqual(c.tourCatPath(db, "x1"), null);   // other table
  assert.strictEqual(c.tourCatPath(db, "o1"), null);   // parent is a trick
  assert.strictEqual(c.tourCatPath(db, "nope"), null);
});

test("tour demo: pickTourTrick scoring and filters", () => {
  const c = demoCtx();
  const cats = [cat("c1", null)];
  assert.strictEqual(c.pickTourTrick({ categories: cats, tricks: [] }), null);
  assert.strictEqual(c.pickTourTrick({ categories: cats, tricks: [trick("a", { custom:true, parts:["sara"] })] }), null);
  assert.strictEqual(c.pickTourTrick({ categories: cats, tricks: [trick("a", { categoryIds:["zz"] })] }), null);
  const tricks = [
    trick("plain"),
    trick("parts", { parts:["sara"] }),
    trick("loopOnly", { parts:["sara"], media:[{ id:"m1", type:"video", url:YT, loop:{ a:1, b:5 } }] }),
    trick("full", { parts:["kensaki", "sara"], grip:"ken", tagIds:["g1"], media:[{ id:"m2", type:"video", url:"https://x.com/a" }, { id:"m3", type:"video", url:YT }] }),
    trick("full2", { parts:["sara"], media:[{ id:"m4", type:"video", url:YT }] })
  ];
  const p = c.pickTourTrick({ categories: cats, tricks });
  assert.strictEqual(p.trickId, "full");
  assert.strictEqual(p.videoId, "m3");
  assert.strictEqual(p.videoIndex, 1);
  assert.strictEqual(p.part, "kensaki");
  assert.deepStrictEqual(Array.from(p.path), ["c1"]);
  assert.strictEqual(p.containerKey, "c1");
  // ties keep db order
  const t2 = c.pickTourTrick({ categories: cats, tricks: [trick("first", { parts:["sara"] }), trick("second", { parts:["sara"] })] });
  assert.strictEqual(t2.trickId, "first");
  // a looped video is never the demo video
  const t3 = c.pickTourTrick({ categories: cats, tricks: [tricks[2]] });
  assert.strictEqual(t3.videoId, null);
});

test("tour demo: grip category is not clickable", () => {
  const c = demoCtx();
  const sub = c.GRIP_GROUPS[0].grips[0], catKey = c.GRIP_GROUPS[0].key;
  const db = (g) => ({ categories: [cat("c1", null)], tricks: [trick("a", { grip: g, parts:["sara"] })] });
  assert.strictEqual(c.pickTourTrick(db(sub)).grip, sub);
  assert.strictEqual(c.pickTourTrick(db(catKey)).grip, null);
});

test("tour demo: tourRestorePlan drops what no longer exists", () => {
  const c = demoCtx();
  const snap = { activeSpace:"t01", path:["c1", "gone", "c2"], editMode:true, detailTrickId:"a", detailInfoId:null, detailContainerKey:"c1" };
  const full = { spaces:[{ id:"t01" }], categories:[{ id:"c1" }, { id:"c2" }], tricks:[{ id:"a" }], infos:[] };
  const p = c.tourRestorePlan(snap, full);
  assert.strictEqual(p.activeSpace, "t01");
  assert.deepStrictEqual(Array.from(p.path), ["c1"]);
  assert.strictEqual(p.detailTrickId, "a");
  assert.strictEqual(p.detailContainerKey, "c1");
  assert.strictEqual(p.editMode, true);
  const swapped = c.tourRestorePlan(snap, { spaces:[{ id:"t00" }], categories:[], tricks:[], infos:[] });
  assert.strictEqual(swapped.activeSpace, null);
  assert.strictEqual(swapped.path.length, 0);
  assert.strictEqual(swapped.detailTrickId, null);
  const noTrick = c.tourRestorePlan(Object.assign({}, snap, { detailInfoId:"i1" }), { spaces:[{ id:"t01" }], categories:[], tricks:[], infos:[{ id:"i1" }] });
  assert.strictEqual(noTrick.detailTrickId, null);
  assert.strictEqual(noTrick.detailInfoId, "i1");
});

test("tour demo: run token cancels older runs", () => {
  const c = demoCtx();
  const a = c.tourRunNew(), b = c.tourRunNew();
  assert.ok(b > a);
  assert.strictEqual(c.tourRunAlive(a), false);
  assert.strictEqual(c.tourRunAlive(b), false); // no active tour in this context
  c._tour = {};
  assert.strictEqual(c.tourRunAlive(b), true);
  c.tourRunNew();
  assert.strictEqual(c.tourRunAlive(b), false);
});

test("tour demo: selector helper strips quotes", () => {
  const c = demoCtx();
  assert.strictEqual(c.tourAttrSel("data-item-id", 'a"b\\c'), '[data-item-id="abc"]');
});
