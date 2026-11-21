"use strict";
// v0.9.1: submission validation (names, video host whitelist), helper application fields.
const test = require("node:test");
const assert = require("node:assert");
const { load } = require("./_load");

const dummyEl = { addEventListener(){}, classList:{ add(){}, remove(){}, toggle(){}, contains(){ return false; } }, closest(){ return null; } };
const doc = { getElementById: () => dummyEl, querySelector: () => null, querySelectorAll: () => [], addEventListener(){}, createElement: () => ({ style:{}, classList:{ add(){}, remove(){}, toggle(){} }, appendChild(){}, setAttribute(){}, addEventListener(){} }) };
const ctx = load([
  "js/01-data-model.js", "js/01-data-storage.js", "js/02-constants-colors-icons.js", "js/03-i18n.js", "js/04-state.js", "js/05-data-helpers.js", "js/05-data-ops.js", "js/05-data-util.js",
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
  assert.deepStrictEqual([...r.doc.payload.trick.urls], ["https://youtu.be/x"]);
  assert.strictEqual(ctx.buildReportDoc(user, "trick", { url: "https://youtu.be/x" }).field, "formNameZh");
  assert.strictEqual(ctx.buildReportDoc(user, "trick", { nameZh: "a" }).field, "formUrl");
});

test("trick submission payload: grip, parts, tags, up to 3 videos nested in payload.trick", () => {
  const r = ctx.buildReportDoc(user, "trick", {
    nameZh: "大皿", urls: ["https://youtu.be/a", "", "https://x.com/b", "https://youtu.be/c", "https://youtu.be/d"],
    grip: "ken", parts: ["tamaTop", "bogus", "sara"], text: "memo",
    tagList: [{ id: "c1", kind: "class", label: "基礎" }, { id: "t1", kind: "text", label: "入門" }]
  });
  assert.ok(r.ok);
  assert.strictEqual(r.doc.text, "memo");
  assert.deepStrictEqual(Object.keys(r.doc.payload), ["trick"]);
  const p = r.doc.payload.trick;
  assert.strictEqual(p.urls.length, 3);
  assert.strictEqual(p.grip, "ken");
  assert.deepStrictEqual([...p.parts], ["sara", "tamaTop"]);
  assert.deepStrictEqual([...p.tagIds], ["c1", "t1"]);
  assert.deepStrictEqual([...p.classes], ["基礎"]);
  assert.deepStrictEqual([...p.tags], ["入門"]);
  assert.strictEqual(ctx.buildReportDoc(user, "trick", { nameZh: "a", urls: ["https://youtu.be/a", "https://evil.com/x"] }).error, "formErrUrlHost");
  assert.strictEqual(ctx.buildReportDoc(user, "trick", { nameZh: "a", urls: ["", ""] }).error, "formErrUrlReq");
  assert.strictEqual(ctx.buildReportDoc(user, "trick", { nameZh: "a", url: "https://youtu.be/a", grip: "bad" }).doc.payload.trick.grip, undefined);
  // single form -> mailbox item
  const it = ctx.submissionItemsOf({ kind: "trick", text: "memo", payload: r.doc.payload });
  assert.strictEqual(it.length, 1);
  assert.strictEqual(it[0].note, "memo");
  assert.strictEqual(it[0].grip, "ken");
  assert.deepStrictEqual([...it[0].tagIds], ["c1", "t1"]);
  const d = ctx.submissionItemToTrickData(it[0], [{ id: "t1", name: { zh: "入門" } }]);
  assert.deepStrictEqual([...d.tagIds], ["t1"]);
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

test("招式投稿 entry: single form only; apply form + link exist", () => {
  assert.strictEqual(typeof ctx.openApplyForm, "function");
  const src = require("fs").readFileSync(require("path").join(__dirname, "..", "js", "74-forms.js"), "utf8");
  assert.ok(!/name="formMode"/.test(src));
  assert.match(src, /form-head-link/);
  assert.ok(!/form-below/.test(src));
  ["zh", "jp", "en"].forEach((l) => { ctx.state.lang = l; assert.notStrictEqual(ctx.t("formApplyLink"), "formApplyLink"); });
  ctx.state.lang = "zh";
  assert.strictEqual(ctx.t("formApplyLink"), "欲大量投稿者，可申請成為協助者");
  assert.strictEqual(ctx.t("formSubmitTitle"), "招式投稿");
});

test("i18n keys exist in all langs", () => {
  ["formVideoHint", "formErrUrlReq", "formErrUrlHost", "formErrApplyName", "formErrGmail", "formErrReason", "formApplyName", "formApplyGmail", "mbApplicant", "mbGmail"]
    .forEach((k) => ["zh", "jp", "en"].forEach((l) => {
      ctx.state.lang = l;
      assert.notStrictEqual(ctx.t(k), k, k + "/" + l);
    }));
});
