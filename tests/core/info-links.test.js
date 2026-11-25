// Info links (js/01-data-storage.js normalizeInfoLinks; normalizeDB drops the old image field).
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const { load } = require("../_load");

function setup(){
  return load(["js/01-data-model.js", "js/01-data-storage.js", "js/02-constants-colors-icons.js", "js/03-i18n.js", "js/04-state.js",
    "js/05-data-helpers.js", "js/05-data-ops.js", "js/05-data-util.js", "js/06-icons-svg.js"], {});
}
const J = (o) => JSON.parse(JSON.stringify(o));

test("normalizeInfoLinks: trims, fixed key order, http/https only, max 3, always an array", () => {
  const c = setup();
  assert.strictEqual(JSON.stringify(c.normalizeInfoLinks([{ title: " Doc ", url: " https://a.example/x ", extra: 1 }])), '[{"url":"https://a.example/x","title":"Doc"}]');
  assert.deepStrictEqual(J(c.normalizeInfoLinks([{ url: "http://b.example" }])), [{ url: "http://b.example", title: "" }]);
  [null, undefined, "x", {}, 5].forEach((v) => assert.deepStrictEqual(J(c.normalizeInfoLinks(v)), []));
  const bad = [null, 3, { url: 5 }, { url: "" }, { url: "javascript:alert(1)" }, { url: "data:text/html,x" }, { url: "ftp://a.example" },
    { url: "not a url" }, { url: "https://a.example/" + "x".repeat(500) }];
  assert.deepStrictEqual(J(c.normalizeInfoLinks(bad)), []);
  const many = [1, 2, 3, 4, 5].map((n) => ({ url: "https://e" + n + ".example", title: "t" + n }));
  assert.deepStrictEqual(J(c.normalizeInfoLinks(many).map((l) => l.title)), ["t1", "t2", "t3"]);
  // invalid ones are dropped before the cap counts
  assert.strictEqual(c.normalizeInfoLinks([{ url: "x" }].concat(many)).length, 3);
});

test("normalizeInfoLinks: title loosely capped, never splits a 12-grapheme emoji title, url exactly 500 ok", () => {
  const c = setup();
  assert.strictEqual(c.normalizeInfoLinks([{ url: "https://a.example", title: "x".repeat(500) }])[0].title.length, 96);
  assert.strictEqual(c.normalizeInfoLinks([{ url: "https://a.example", title: "👨‍👩‍👧".repeat(12) }])[0].title, "👨‍👩‍👧".repeat(12));
  assert.strictEqual(c.normalizeInfoLinks([{ url: "https://a.example", title: 7 }])[0].title, "");
  const url = "https://a.example/" + "x".repeat(500 - 18);
  assert.strictEqual(url.length, 500);
  assert.strictEqual(c.normalizeInfoLinks([{ url }]).length, 1);
});

test("normalizeInfoLinks returns a new array (no aliasing)", () => {
  const c = setup();
  const src = [{ url: "https://a.example", title: "A" }];
  const out = c.normalizeInfoLinks(src);
  assert.notStrictEqual(out, src);
  assert.notStrictEqual(out[0], src[0]);
});

test("normalizeDB infos: links kept only when non-empty, old image field dropped", () => {
  const c = setup();
  const nm = { zh: "i", jp: "", en: "" };
  const d = c.normalizeDB({ infos: [
    { id: "i1", title: nm, links: [{ url: "https://a.example", title: "A" }], prefix: "P" },
    { id: "i2", title: nm, links: [{ url: "javascript:1" }], image: { id: "a", w: 10, h: 20, size: 300 } },
    { id: "i3", title: nm, links: [] },
    { id: "i4", title: nm }
  ] });
  assert.deepStrictEqual(J(d.infos[0].links), [{ url: "https://a.example", title: "A" }]);
  assert.strictEqual(d.infos[0].prefix, "P");
  [1, 2, 3].forEach((i) => assert.ok(!("links" in d.infos[i]) && !("image" in d.infos[i])));
  const again = c.normalizeDB({ infos: [J(d.infos[0])] }).infos[0];
  assert.strictEqual(JSON.stringify(again), JSON.stringify(d.infos[0]));
});
