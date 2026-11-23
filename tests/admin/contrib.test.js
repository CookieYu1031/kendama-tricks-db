"use strict";
// v0.7 D2 contributors + v0.9.3 bulk submission (js/72): template columns, row validation, payload, admin conversion.
const test = require("node:test");
const assert = require("node:assert");
const { load } = require("../_load");
const eq = (a, b) => assert.strictEqual(JSON.stringify(a), JSON.stringify(b));

const dummyEl = { addEventListener(){}, classList:{ add(){}, remove(){}, toggle(){}, contains(){ return false; } }, closest(){ return null; } };
const doc = { getElementById: () => dummyEl, querySelector: () => null, querySelectorAll: () => [], addEventListener(){}, createElement: () => ({ style:{}, classList:{ add(){}, remove(){}, toggle(){} }, appendChild(){}, setAttribute(){}, addEventListener(){} }) };
function ctx(){
  return load(["js/01-data-model.js", "js/01-data-storage.js","js/02-constants-colors-icons.js","js/03-i18n.js","js/04-state.js","js/05-data-helpers.js", "js/05-data-ops.js", "js/05-data-util.js",
    "js/16-shell-updates.js","js/71-contributors.js","js/72-submissions.js","js/73-mailbox.js","js/74-forms.js","js/79-xlsx.js"], { URL, document: doc, TextEncoder, TextDecoder });
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

const HEAD = ["中文名稱","日文名稱","英文名稱","影片1","影片2","影片3","握持","部位","招式類別","標籤","備註","建議位置"];
const row = (o) => HEAD.map((h) => o[h] || "");
const good = { "中文名稱": "大皿", "英文名稱": "Ohzara", "影片1": "https://youtu.be/abc", "握持": "持劍", "部位": "sara、kensaki", "標籤": "基礎、入門", "備註": "n", "建議位置": "基礎/大皿" };

test("bulk: valid row -> item; lists split on 、; grip/part keys", () => {
  const c = ctx();
  const r = c.bulkParseSheet([HEAD, row(good)]);
  assert.ok(r.ok);
  assert.strictEqual(r.bad.length, 0);
  const it = r.items[0];
  assert.strictEqual(it.names.zh, "大皿");
  assert.strictEqual(it.grip, "ken");
  eq(it.parts, ["sara", "kensaki"]);
  eq(it.tags, ["基礎", "入門"]);
  assert.strictEqual(it.location, "基礎/大皿");
  eq(it.urls, ["https://youtu.be/abc"]);
});

test("bulk: per-row errors (name, video required, host whitelist, grip, part)", () => {
  const c = ctx();
  const rows = [HEAD,
    row({ "影片1": "https://youtu.be/a" }),                                   // 2: no name
    row({ "中文名稱": "x" }),                                                  // 3: no video
    row({ "中文名稱": "x", "影片1": "https://evil.com/a" }),                   // 4: bad host
    row({ "中文名稱": "x", "影片1": "https://youtu.be/a", "握持": "手" }),     // 5: grip
    row({ "中文名稱": "x", "影片1": "https://youtu.be/a", "部位": "zzz" }),    // 6: part
    row({ "中文名稱": "x", "影片1": "https://youtu.be/a", "影片2": "https://evil.com/b" }), // 7: second url bad
    row(good)];
  const r = c.bulkParseSheet(rows);
  eq(r.bad.map((b) => b.row), [2, 3, 4, 5, 6, 7]);
  eq(r.bad.map((b) => b.errors[0].key), ["formErrNames", "formErrUrlReq", "formErrUrlHost", "bulkErrGrip", "bulkErrPart", "formErrUrlHost"]);
  assert.strictEqual(r.items.length, 1);
});

test("bulk: header search, notes row and blank rows skipped, no header -> error", () => {
  const c = ctx();
  const r = c.bulkParseSheet([[], HEAD, ["※ 說明"], [], row(good)]);
  assert.ok(r.ok);
  assert.strictEqual(r.items.length, 1);
  assert.strictEqual(c.bulkParseSheet([["a", "b"], ["x", "y"]]).error, "bulkNoHeader");
  assert.strictEqual(c.bulkParseSheet([HEAD, ["※ x"]]).error, "bulkNoRows");
});

test("bulk: columns mapped by header text, any order", () => {
  const c = ctx();
  const r = c.bulkParseSheet([["影片1", "中文名稱"], ["https://youtu.be/a", "甲"]]);
  assert.strictEqual(r.items[0].names.zh, "甲");
});

test("bulk: row cap 200", () => {
  const c = ctx();
  const rows = [HEAD];
  for (let i = 0; i < 205; i++) rows.push(row(good));
  const r = c.bulkParseSheet(rows);
  assert.strictEqual(r.items.length, 200);
  assert.strictEqual(r.truncated, true);
});

test("bulk report doc: kind trick, payload keys <= 4, size cap", () => {
  const c = ctx();
  const user = { uid: "u1", email: "A@x.com", displayName: "A" };
  const items = c.bulkParseSheet([HEAD, row(good)]).items;
  const r = c.buildBulkReportDoc(user, items);
  assert.ok(r.ok);
  assert.strictEqual(r.doc.kind, "trick");
  assert.strictEqual(r.doc.status, "open");
  assert.strictEqual(r.doc.text, "");
  assert.ok(Object.keys(r.doc.payload).length <= 4);
  assert.strictEqual(r.doc.payload.bulk, true);
  assert.strictEqual(c.buildBulkReportDoc(null, items).error, "formNeedLogin");
  assert.strictEqual(c.buildBulkReportDoc(user, []).error, "bulkNeedOk");
  const fat = { names: { zh: "x" }, urls: [], note: "漢".repeat(1000), location: "漢".repeat(200), tags: Array(12).fill("漢".repeat(60)) };
  assert.strictEqual(c.buildBulkReportDoc(user, Array(200).fill(fat)).error, "bulkPayloadBig");
});

test("admin side: single + bulk reports -> items; item -> clipboard trick data (tags matched by name)", () => {
  const c = ctx();
  const single = c.submissionItemsOf({ kind: "trick", text: "desc", payload: { names: { zh: "甲" }, url: "https://youtu.be/a" } });
  assert.strictEqual(single.length, 1);
  assert.strictEqual(single[0].note, "desc");
  eq(single[0].urls, ["https://youtu.be/a"]);
  assert.strictEqual(c.submissionItemsOf({ payload: { bulk: true, items: [{}, {}] } }).length, 2);
  const d = c.submissionItemToTrickData({ names: { zh: "甲" }, urls: ["https://youtu.be/a"], grip: "ken", parts: ["sara"], classes: ["基礎"], tags: ["nope"], note: "n" },
    [{ id: "t1", name: { zh: "基礎", jp: "", en: "" } }]);
  eq(d.tagIds, ["t1"]);
  assert.strictEqual(d.name.zh, "甲");
  assert.strictEqual(d.grip, "ken");
});

test("template rows: header = column labels + notes row", () => {
  const c = ctx();
  const rows = c.bulkTemplateRows();
  eq(rows[0], HEAD.map((h) => (h === "握持" ? "握持手勢" : h)));
  assert.ok(rows[1][0].charAt(0) === "※");
});



test("bulk: grip column accepts categories and subs in zh/jp/en (full + short), plus the old 握持 header", () => {
  const c = ctx();
  const one = (g, head) => c.bulkParseSheet([head || HEAD, row(Object.assign({}, good, { "握持": g }))]);
  const grip = (g) => one(g).items[0].grip;
  assert.strictEqual(grip("持皿"), "ken_sara");
  assert.strictEqual(grip("蠟燭"), "ken_candle");
  assert.strictEqual(grip("提燈台"), "ito_lighthouse");
  assert.strictEqual(grip("持線"), "ito");
  assert.strictEqual(grip("ken_sara"), "ken_sara");
  assert.strictEqual(grip("皿持ち"), "ken_sara");
  assert.strictEqual(grip("ライトハウス持ち"), "ito_lighthouse");
  assert.strictEqual(grip("玉持ち"), "tama");
  assert.strictEqual(one("不明").bad.length, 1);
  const newHead = HEAD.map((h) => (h === "握持" ? "握持手勢" : h));
  assert.strictEqual(one("持皿", newHead).items[0].grip, "ken_sara");
  assert.ok(c.bulkTemplateRows()[0].indexOf("握持手勢") !== -1);
});
