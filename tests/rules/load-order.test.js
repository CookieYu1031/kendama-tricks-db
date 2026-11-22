"use strict";
// v0.8.2: social share meta tags + banner, and undo script loaded after the clipboard.
var test = require("node:test");
var assert = require("node:assert");
var fs = require("fs");
var path = require("path");
var root = path.join(__dirname, "..", "..");
var html = fs.readFileSync(path.join(root, "index.html"), "utf8");



test("js/28-browse-undo.js loads after js/25-browse-clipboard.js", function(){
  var a = html.indexOf("js/25-browse-clipboard.js"), b = html.indexOf("js/28-browse-undo.js");
  assert.ok(a > 0 && b > a);
});
