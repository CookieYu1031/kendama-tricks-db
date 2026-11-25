// Info links (v0.17.2): input normalisation, labels, set / remove, limits, dangerous schemes.
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const { load } = require("../_load");

const FILES = ["js/01-data-model.js", "js/01-data-storage.js", "js/02-constants-colors-icons.js", "js/03-i18n.js", "js/05-data-util.js",
  "js/34-drawer-videos.js", "js/38-info-links.js"];
const c = load(FILES, { URL, Intl });

test("normalizeInfoLinkInput: adds https, never legitimises other schemes", () => {
  assert.strictEqual(c.normalizeInfoLinkInput("  example.com/a "), "https://example.com/a");
  assert.strictEqual(c.normalizeInfoLinkInput("//example.com"), "https://example.com");
  assert.strictEqual(c.normalizeInfoLinkInput("localhost:8080/x"), "https://localhost:8080/x");
  assert.strictEqual(c.normalizeInfoLinkInput("http://a.com"), "http://a.com");
  assert.strictEqual(c.normalizeInfoLinkInput("HTTPS://a.com"), "HTTPS://a.com");
  assert.strictEqual(c.normalizeInfoLinkInput(""), "");
  ["javascript:alert(1)", "data:text/html,x", "mailto:a@b.c", "ftp://a.com", "a b.com"].forEach((u) => {
    assert.ok(!c.isSafeHttpUrl(c.normalizeInfoLinkInput(u)), u);
  });
});

test("infoLinkLabel: title, else domain without www", () => {
  assert.strictEqual(c.infoLinkLabel({ url: "https://www.example.com/a?b=1", title: "" }), "example.com");
  assert.strictEqual(c.infoLinkLabel({ url: "https://sub.example.com", title: "  我的站 " }), "我的站");
  assert.strictEqual(c.infoLinkLabel({ url: "not a url", title: "" }), "not a url");
});

test("setInfoLink: add, replace, errors, limit", () => {
  const info = {};
  assert.strictEqual(c.setInfoLink(info, null, "", ""), "empty");
  assert.strictEqual(c.setInfoLink(info, null, "javascript:alert(1)", ""), "invalid");
  assert.strictEqual(c.setInfoLink(info, null, "https://a.com/" + "x".repeat(500), ""), "tooLong");
  assert.strictEqual(c.setInfoLink(info, null, "a.com", "1234567890123"), "titleTooLong");
  assert.strictEqual(info.links, undefined);
  assert.strictEqual(c.setInfoLink(info, null, "a.com", "123456789012"), "ok");
  assert.deepStrictEqual(Object.keys(info.links[0]), ["url", "title"]);
  assert.strictEqual(info.links[0].url, "https://a.com");
  assert.strictEqual(c.setInfoLink(info, 0, "https://b.com", ""), "ok");
  assert.strictEqual(info.links[0].url, "https://b.com");
  assert.strictEqual(c.setInfoLink(info, 5, "https://b.com", ""), "invalid");
  assert.strictEqual(c.setInfoLink(info, null, "c.com", ""), "ok");
  assert.strictEqual(c.setInfoLink(info, null, "d.com", ""), "ok");
  assert.strictEqual(c.setInfoLink(info, null, "e.com", ""), "full");
  assert.strictEqual(info.links.length, 3);
});

test("removeInfoLink: last removal deletes the field", () => {
  const info = { links: [{ url: "https://a.com", title: "" }, { url: "https://b.com", title: "" }] };
  assert.strictEqual(c.removeInfoLink(info, 0), true);
  assert.strictEqual(info.links[0].url, "https://b.com");
  assert.strictEqual(c.removeInfoLink(info, 3), false);
  assert.strictEqual(c.removeInfoLink(info, 0), true);
  assert.ok(!("links" in info));
});
