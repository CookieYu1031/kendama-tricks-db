"use strict";
// v0.9.1: submission validation (names, video host whitelist), helper application fields.
const test = require("node:test");
const assert = require("node:assert");
const { load } = require("./_load");

const dummyEl = { addEventListener(){}, classList:{ add(){}, remove(){}, toggle(){}, contains(){ return false; } }, closest(){ return null; } };
const doc = { getElementById: () => dummyEl, querySelector: () => null, querySelectorAll: () => [], addEventListener(){}, createElement: () => ({ style:{}, classList:{ add(){}, remove(){}, toggle(){} }, appendChild(){}, setAttribute(){}, addEventListener(){} }) };
const ctx = load([
  "js/01-data-model.js", "js/02-constants-colors-icons.js", "js/03-i18n.js", "js/04-state.js", "js/05-data-helpers.js",
  "js/16-shell-updates.js", "js/72-submissions.js", "js/73-mailbox.js", "js/74-forms.js"
], { URL, document: doc });
const user = { uid: "u1", email: "a@gmail.com", displayName: "Ann" };

test("video url: required, whitelisted hosts only", () => {
  const v = ctx.validateSubmissionVideoUrl;
  assert.strictEqual(v(""), "formErrUrlReq");
  assert.strictEqual(v("   "), "formErrUrlReq");
  assert.strictEqual(v("javascript:alert(1)"), "formErrUrl");
  assert.strictEqual(v("not a url"), "formErrUrl");
  [
    "https://www.youtube.com/watch?v=x", "https://youtu.be/x", "https://m.youtube.com/watch?v=x",
    "https://instagram.com/p/x", "https://www.facebook.com/x", "https://fb.watch/x", "https://www.tiktok.com/@a/video/1",
    "https://x.com/a/status/1", "https://twitter.com/a/status/1", "https://www.threads.net/@a/post/x",
    "https://drive.google.com/file/d/x/view"
  ].forEach((u) => assert.strictEqual(v(u), "", u));
  ["https://evil.com/youtube.com", "https://notyoutube.com/x", "https://youtube.com.evil.io/x", "https://google.com/x", "https://docs.google.com/x"]
    .forEach((u) => assert.strictEqual(v(u), "formErrUrlHost", u));
});

test("trick submission: name + video required", () => {
  assert.strictEqual(ctx.buildReportDoc(user, "trick", { url: "https://youtu.be/x" }).error, "formErrNames");
  assert.strictEqual(ctx.buildReportDoc(user, "trick", { nameJp: "大皿" }).error, "formErrUrlReq");
  assert.strictEqual(ctx.buildReportDoc(user, "trick", { nameEn: "x", url: "https://evil.com/a" }).error, "formErrUrlHost");
  const r = ctx.buildReportDoc(user, "trick", { nameEn: "Ohzara", url: "https://youtu.be/x" });
  assert.ok(r.ok);
  assert.strictEqual(r.doc.payload.url, "https://youtu.be/x");
  assert.strictEqual(ctx.buildReportDoc(user, "trick", { url: "https://youtu.be/x" }).field, "formNameZh");
  assert.strictEqual(ctx.buildReportDoc(user, "trick", { nameZh: "a" }).field, "formUrl");
});

test("hasSubmissionName", () => {
  assert.strictEqual(ctx.hasSubmissionName({ zh: " ", jp: "", en: "" }), false);
  assert.strictEqual(ctx.hasSubmissionName({ zh: "", jp: "", en: "x" }), true);
  assert.strictEqual(ctx.hasSubmissionName(null), false);
});

test("gmail check", () => {
  assert.strictEqual(ctx.isGmailAddress("Ann.B+x@Gmail.com"), true);
  assert.strictEqual(ctx.isGmailAddress("ann@gmail.co"), false);
  assert.strictEqual(ctx.isGmailAddress("ann@yahoo.com"), false);
  assert.strictEqual(ctx.isGmailAddress("@gmail.com"), false);
  assert.strictEqual(ctx.isGmailAddress("a b@gmail.com"), false);
  assert.strictEqual(ctx.isGmailAddress(""), false);
});

test("apply: name, gmail, reason required", () => {
  const b = ctx.buildReportDoc;
  assert.strictEqual(b(user, "apply", { text: "r", gmail: "a@gmail.com" }).error, "formErrApplyName");
  assert.strictEqual(b(user, "apply", { text: "r", applyName: "Ann", gmail: "a@x.com" }).error, "formErrGmail");
  assert.strictEqual(b(user, "apply", { applyName: "Ann", gmail: "a@gmail.com" }).error, "formErrReason");
  const r = b(user, "apply", { text: "help", applyName: " Ann ", gmail: "A@Gmail.com" });
  assert.ok(r.ok);
  assert.strictEqual(r.doc.text, "help");
  assert.strictEqual(r.doc.payload.name, "Ann");
  assert.strictEqual(r.doc.payload.gmail, "a@gmail.com");
  assert.ok(Object.keys(r.doc.payload).length <= 4);
});

test("contributor trick validation", () => {
  const v = ctx.validateSubmissionTrick;
  const ok = { name: { zh: "x" }, media: [{ type: "video", url: "https://youtu.be/a" }] };
  assert.strictEqual(v(ok), "");
  assert.strictEqual(v({ name: {}, media: ok.media }), "formErrNames");
  assert.strictEqual(v({ name: { zh: "x" }, media: [] }), "formErrUrlReq");
  assert.strictEqual(v({ name: { zh: "x" }, media: [{ type: "video", url: "https://evil.com/a" }] }), "formErrUrlHost");
  assert.strictEqual(v({ name: { zh: "x" }, media: [{ type: "video", url: "https://evil.com/a" }, { type: "video", url: "https://youtu.be/a" }] }), "");
});

test("i18n keys exist in all langs", () => {
  ["formVideoHint", "formErrUrlReq", "formErrUrlHost", "formErrApplyName", "formErrGmail", "formErrReason", "formApplyName", "formApplyGmail", "mbApplicant", "mbGmail"]
    .forEach((k) => ["zh", "jp", "en"].forEach((l) => {
      ctx.state.lang = l;
      assert.notStrictEqual(ctx.t(k), k, k + "/" + l);
    }));
});
