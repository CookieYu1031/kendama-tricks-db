// isSafeHttpUrl gates every stored/opened video link (G3).
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const { load } = require("../_load");

const ctx = load(["js/01-data-model.js", "js/01-data-storage.js", "js/02-constants-colors-icons.js", "js/05-data-helpers.js", "js/05-data-ops.js", "js/05-data-util.js"], { URL });

test("accepts http(s) links", () => {
  assert.ok(ctx.isSafeHttpUrl("https://youtu.be/abc"));
  assert.ok(ctx.isSafeHttpUrl("http://example.com/x?y=1"));
  assert.ok(ctx.isSafeHttpUrl("  https://www.instagram.com/p/x  "));
});

test("rejects script and other schemes", () => {
  assert.ok(!ctx.isSafeHttpUrl("javascript:alert(1)"));
  assert.ok(!ctx.isSafeHttpUrl("JAVASCRIPT:alert(1)"));
  assert.ok(!ctx.isSafeHttpUrl("data:text/html,<script>1</script>"));
  assert.ok(!ctx.isSafeHttpUrl("ftp://x.com"));
});

test("rejects empty and malformed input", () => {
  assert.ok(!ctx.isSafeHttpUrl(""));
  assert.ok(!ctx.isSafeHttpUrl("   "));
  assert.ok(!ctx.isSafeHttpUrl("youtube.com/watch"));
  assert.ok(!ctx.isSafeHttpUrl(null));
});
