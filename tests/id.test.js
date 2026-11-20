"use strict";
const test = require("node:test");
const assert = require("node:assert");
const { load } = require("./_load");

const FIXED = new Date(2026, 5, 15, 12, 30, 10).getTime();
function FakeDate(...a){ return a.length ? new Date(...a) : new Date(FIXED); }
FakeDate.now = () => FIXED;

function fresh(extra){ return load(["js/07-id.js"], { Date: FakeDate, ...extra }); }

test("known examples", () => {
  const c = fresh();
  assert.strictEqual(c.encodeTimeId(new Date(2026, 0, 1, 0, 0, 0)), "0q11000");
  assert.strictEqual(c.encodeTimeId(new Date(2026, 11, 31, 23, 59, 59)), "0qcvnXX");
});

test("round-trip and validation", () => {
  const c = fresh();
  const d = new Date(2031, 8, 9, 7, 36, 45);
  const id = c.encodeTimeId(d);
  assert.strictEqual(id.length, 7);
  assert.strictEqual(c.decodeTimeId(id).getTime(), d.getTime());
  assert.ok(c.isTimeId("0qcvnXX"));
  assert.ok(!c.isTimeId("0q1100"));
  assert.ok(!c.isTimeId("0q101000"));
  assert.ok(!c.isTimeId("0q01000"));  // month 0
  assert.ok(!c.isTimeId("0q1w000"));  // day w (32)
  assert.ok(!c.isTimeId("0q11Y00"));  // minute Y (60)
  assert.ok(!c.isTimeId("0q1100!"));
  assert.ok(!c.isTimeId(null));
  assert.strictEqual(c.decodeTimeId("bad"), null);
});

test("burst of 5 gives consecutive seconds", () => {
  const c = fresh();
  const ids = [1, 2, 3, 4, 5].map(() => c.nextId());
  assert.strictEqual(new Set(ids).size, 5);
  const t = ids.map((i) => c.decodeTimeId(i).getTime());
  for (let i = 1; i < 5; i++) assert.strictEqual(t[i] - t[i - 1], 1000);
});

test("isTaken skips", () => {
  const c = fresh();
  const first = c.nextId();
  c.localStorage.clear();
  c.idLastIssued = null;
  const skipped = c.nextId((id) => id === first);
  assert.notStrictEqual(skipped, first);
  assert.strictEqual(c.decodeTimeId(skipped).getTime() - c.decodeTimeId(first).getTime(), 1000);
});

test("clock persisted across reload", () => {
  const a = fresh();
  const ids = [a.nextId(), a.nextId()];
  const b = fresh({ localStorage: a.localStorage });
  const id3 = b.nextId();
  assert.ok(!ids.includes(id3));
  assert.strictEqual(b.decodeTimeId(id3).getTime() - a.decodeTimeId(ids[1]).getTime(), 1000);
});
