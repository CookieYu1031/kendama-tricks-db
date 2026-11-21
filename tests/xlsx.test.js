// js/79-xlsx.js: zip + workbook write, read back (STORED and deflated), shared strings, errors.
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const zlib = require("zlib");
const { load } = require("./_load");

function ctx(){
  const c = load(["js/79-xlsx.js"], { TextEncoder, TextDecoder, Uint8Array });
  c.xlsxInflateHook = (data) => Promise.resolve(new Uint8Array(zlib.inflateRawSync(Buffer.from(data))));
  return c;
}
const rows = [
  ["中文名稱", "日文名稱", "英文名稱", "影片1"],
  ["大皿", "おおざら", "Ohzara & <Co>", "https://youtu.be/a?x=1&y=2"],
  ["", "", "gap", ""],
  ["", "", "", "end"]
];
const plain = (a) => JSON.parse(JSON.stringify(a));

test("crc32 known vector", () => {
  const c = ctx();
  assert.strictEqual(c.xlsxCrc32(new TextEncoder().encode("123456789")), 0xCBF43926);
});

test("write -> read round trip (STORED), incl. escapes, gaps and CJK", async () => {
  const c = ctx();
  const bytes = c.xlsxBuild(rows, "tricks");
  assert.strictEqual(bytes[0], 0x50); // "PK"
  const back = await c.xlsxParse(bytes);
  assert.deepStrictEqual(plain(back[0]), rows[0]);
  assert.deepStrictEqual(plain(back[1]), rows[1]);
  assert.deepStrictEqual(plain(back[2]), ["", "", "gap"]);
  assert.deepStrictEqual(plain(back[3]), ["", "", "", "end"]);
});

test("zip written by us is valid for node's zlib-based reader path (deflated entries)", async () => {
  const c = ctx();
  const enc = new TextEncoder();
  const bytes = c.xlsxZip([{ name: "xl/worksheets/sheet1.xml", data: enc.encode(
    '<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="C1"><v>42</v></c></row></sheetData></worksheet>') },
    { name: "xl/sharedStrings.xml", data: enc.encode('<sst><si><t>共有</t></si><si><r><t>x</t></r><rPh><t>ふり</t></rPh></si></sst>') }],
    (raw) => new Uint8Array(zlib.deflateRawSync(Buffer.from(raw))));
  const back = await c.xlsxParse(bytes);
  assert.deepStrictEqual(plain(back), [["共有", "", "42"]]);
});

test("shared strings: rich text runs joined, phonetic runs skipped", async () => {
  const c = ctx();
  const enc = new TextEncoder();
  const bytes = c.xlsxZip([
    { name: "xl/worksheets/sheet1.xml", data: enc.encode('<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c></row></sheetData></worksheet>') },
    { name: "xl/sharedStrings.xml", data: enc.encode('<sst><si><r><t>大</t></r><r><t>皿</t></r><rPh sb="0" eb="1"><t>オオ</t></rPh></si></sst>') }]);
  assert.deepStrictEqual(plain(await c.xlsxParse(bytes)), [["大皿"]]);
});

test("errors: not a zip, too big, no sheet, no DecompressionStream", async () => {
  const c = ctx();
  await assert.rejects(() => c.xlsxParse(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8])), /xlsx-bad/);
  await assert.rejects(() => c.xlsxParse(new Uint8Array(c.XLSX_MAX_FILE + 1)), /xlsx-big/);
  const noSheet = c.xlsxZip([{ name: "a.txt", data: new TextEncoder().encode("x") }]);
  await assert.rejects(() => c.xlsxParse(noSheet), /xlsx-bad/);
  const c2 = load(["js/79-xlsx.js"], { TextEncoder, TextDecoder, Uint8Array });
  const deflated = c2.xlsxZip([{ name: "xl/worksheets/sheet1.xml", data: new TextEncoder().encode("<worksheet/>") }],
    (raw) => new Uint8Array(zlib.deflateRawSync(Buffer.from(raw))));
  await assert.rejects(() => c2.xlsxParse(deflated), /xlsx-unsupported/);
});

test("template round trip via bulk helpers (js/72)", async () => {
  const c = load(["js/01-data-model.js", "js/02-constants-colors-icons.js", "js/03-i18n.js", "js/04-state.js", "js/05-data-helpers.js",
    "js/72-submissions.js", "js/74-forms.js", "js/79-xlsx.js"].map((f) => f), { TextEncoder, TextDecoder, Uint8Array, URL,
    document: { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], addEventListener(){}, createElement: () => ({}) } });
  const tpl = c.xlsxBuild(c.bulkTemplateRows(), "tricks");
  const back = await c.xlsxParse(tpl);
  assert.deepStrictEqual(plain(back[0]), plain(c.BULK_COLUMNS.map((x) => x.label)));
  const res = c.bulkParseSheet(back);
  assert.strictEqual(res.ok, false);
  assert.strictEqual(res.error, "bulkNoRows"); // header + notes row only
});
