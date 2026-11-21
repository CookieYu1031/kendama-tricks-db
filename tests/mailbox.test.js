"use strict";
// v0.7 D5: report forms, rate limit, inbox, mailbox filter.
const test = require("node:test");
const assert = require("node:assert");
const { load } = require("./_load");

const dummyEl = { addEventListener(){}, classList:{ add(){}, remove(){}, toggle(){}, contains(){ return false; } }, closest(){ return null; } };
const doc = { getElementById: () => dummyEl, querySelector: () => null, querySelectorAll: () => [], addEventListener(){}, createElement: () => ({ style:{}, classList:{ add(){}, remove(){}, toggle(){} }, appendChild(){}, setAttribute(){}, addEventListener(){} }) };
const ctx = load([
  "js/01-data-model.js", "js/02-constants-colors-icons.js", "js/03-i18n.js", "js/04-state.js", "js/05-data-helpers.js",
  "js/16-shell-updates.js", "js/73-mailbox.js", "js/74-forms.js"
], { URL, document: doc });
const user = { uid: "u1", email: "a@b.c", displayName: "Ann" };

test("parseTrickRef accepts @id and id", () => {
  assert.deepStrictEqual({ ...ctx.parseTrickRef("@abc_1") }, { ok:true, id:"abc_1" });
  assert.strictEqual(ctx.parseTrickRef(" abc ").id, "abc");
  assert.strictEqual(ctx.parseTrickRef("").ok, true);
  assert.strictEqual(ctx.parseTrickRef("").id, "");
  assert.strictEqual(ctx.parseTrickRef("a b").ok, false);
  assert.strictEqual(ctx.parseTrickRef("@<x>").ok, false);
});

test("bug report: text required, <=1000, payload trickId", () => {
  assert.strictEqual(ctx.buildReportDoc(user, "bug", { text: "  " }).error, "formErrText");
  assert.strictEqual(ctx.buildReportDoc(user, "bug", { text: "x".repeat(1001) }).error, "formErrText");
  const r = ctx.buildReportDoc(user, "erratum", { text: "typo", trickRef: "@t9" });
  assert.ok(r.ok);
  assert.strictEqual(r.doc.kind, "erratum");
  assert.strictEqual(r.doc.status, "open");
  assert.strictEqual(r.doc.uid, "u1");
  assert.strictEqual(r.doc.payload.trickId, "t9");
  assert.strictEqual(ctx.buildReportDoc(user, "bug", { text: "x", trickRef: "bad id" }).error, "formErrTrickId");
  assert.ok(ctx.buildReportDoc(user, "x".repeat(2), { text: "x" }).ok === false);
});

test("trick submission: names, url safety", () => {
  assert.strictEqual(ctx.buildReportDoc(user, "trick", { text: "d" }).error, "formErrNames");
  assert.strictEqual(ctx.buildReportDoc(user, "trick", { nameZh: "a".repeat(61) }).error, "formErrNames");
  assert.strictEqual(ctx.buildReportDoc(user, "trick", { nameZh: "x", url: "javascript:alert(1)" }).error, "formErrUrl");
  const r = ctx.buildReportDoc(user, "trick", { nameZh: "大皿", nameEn: "Ohzara", text: "", url: "https://youtu.be/x" });
  assert.ok(r.ok);
  assert.deepStrictEqual({ ...r.doc.payload.names }, { zh: "大皿", en: "Ohzara" });
  assert.strictEqual(r.doc.payload.url, "https://youtu.be/x");
  assert.strictEqual(r.doc.text, "");
});

test("apply: reason required; guest rejected", () => {
  assert.strictEqual(ctx.buildReportDoc(user, "apply", { text: "" }).error, "formErrApplyName");
  assert.ok(ctx.buildReportDoc(user, "apply", { text: "I want to help", applyName: "Ann", gmail: "ann@gmail.com" }).ok);
  assert.strictEqual(ctx.buildReportDoc(null, "bug", { text: "x" }).error, "formNeedLogin");
});

test("rate limit client logic (60s)", () => {
  assert.strictEqual(ctx.reportCooldownLeft(0, 1000000), 0);
  assert.strictEqual(ctx.reportCooldownLeft(1000000, 1010000), 50000);
  assert.strictEqual(ctx.reportCooldownLeft(1000000, 1060000), 0);
  assert.strictEqual(ctx.reportCooldownLeft(5000000, 1000000), 60000); // clock went back: capped
  ctx.setReportLast("u1", 123);
  assert.strictEqual(ctx.getReportLast("u1"), 123);
  assert.strictEqual(ctx.getReportLast("u2"), 0);
});

test("inbox doc building", () => {
  assert.strictEqual(ctx.buildInboxDoc({ text: " " }).ok, false);
  assert.strictEqual(ctx.buildInboxDoc({ text: "x".repeat(1001) }).ok, false);
  const r = ctx.buildInboxDoc({ kind: "reply", text: "hi", trickName: "大皿" });
  assert.ok(r.ok);
  assert.strictEqual(r.doc.from, "admin");
  assert.strictEqual(r.doc.read, false);
  assert.strictEqual(r.doc.trickName, "大皿");
  assert.ok(!("trickName" in ctx.buildInboxDoc({ text: "a" }).doc));
});

test("unread count combines versions + inbox", () => {
  assert.strictEqual(ctx.inboxUnreadCount([{ read:false }, { read:true }, { read:false }]), 2);
  assert.strictEqual(ctx.inboxUnreadCount(null), 0);
  assert.strictEqual(ctx.combinedUnread(3, 3, []), false);
  assert.strictEqual(ctx.combinedUnread(4, 3, []), true);
  assert.strictEqual(ctx.combinedUnread(3, 3, [{ read:false }]), true);
  assert.strictEqual(ctx.combinedUnread(0, 0, [{ read:true }]), false);
});

test("mailbox filter tabs", () => {
  const list = [{ kind:"bug" }, { kind:"erratum" }, { kind:"suggestion" }, { kind:"other" }, { kind:"trick" }, { kind:"apply" }];
  assert.strictEqual(ctx.mbFilterReports(list, "all").length, 6);
  assert.strictEqual(ctx.mbFilterReports(list, "report").length, 4);
  assert.strictEqual(ctx.mbFilterReports(list, "trick").length, 1);
  assert.strictEqual(ctx.mbFilterReports(list, "apply")[0].kind, "apply");
});

test("i18n keys exist in all languages", () => {
  ["zh", "jp", "en"].forEach((l) => {
    ["formNeedLogin", "formReportTitle", "mbTitle", "mbKind_apply", "inboxTitle", "formSubmitNote"].forEach((k) => {
      assert.ok(ctx.UI[l][k], l + ":" + k);
    });
  });
});
