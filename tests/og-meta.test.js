"use strict";
// v0.8.2: social share meta tags + banner, and undo script loaded after the clipboard.
var test = require("node:test");
var assert = require("node:assert");
var fs = require("fs");
var path = require("path");
var root = path.join(__dirname, "..");
var html = fs.readFileSync(path.join(root, "index.html"), "utf8");

test("index.html has Open Graph and Twitter card tags", function(){
  ["og:title", "og:description", "og:image", "og:url", "og:type"].forEach(function(p){
    assert.ok(html.indexOf('property="' + p + '"') >= 0, p);
  });
  assert.ok(/name="twitter:card" content="summary_large_image"/.test(html));
  assert.ok(/og:image" content="https:\/\/kendama-tricks-db\.web\.app\/assets\/og-banner\.png"/.test(html));
});

test("og banner exists and is 1200x630 PNG", function(){
  var buf = fs.readFileSync(path.join(root, "assets", "og-banner.png"));
  assert.strictEqual(buf.toString("ascii", 1, 4), "PNG");
  assert.strictEqual(buf.readUInt32BE(16), 1200);
  assert.strictEqual(buf.readUInt32BE(20), 630);
});

test("js/28-browse-undo.js loads after js/25-browse-clipboard.js", function(){
  var a = html.indexOf("js/25-browse-clipboard.js"), b = html.indexOf("js/28-browse-undo.js");
  assert.ok(a > 0 && b > a);
});
