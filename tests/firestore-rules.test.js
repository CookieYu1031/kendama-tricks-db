"use strict";
// Static checks on firestore.rules (no emulator needed).
var test = require("node:test");
var assert = require("node:assert");
var fs = require("fs");
var path = require("path");

var src = fs.readFileSync(path.join(__dirname, "..", "firestore.rules"), "utf8");

function hasOnlyLists() {
  var out = [];
  var re = /hasOnly\(\[([^\]]*)\]\)/g, m;
  while ((m = re.exec(src))) {
    out.push(m[1].split(",").map(function (s) { return s.trim().replace(/'/g, ""); }).join(","));
  }
  return out;
}

test("no hardcoded uid", function () {
  assert.ok(!/2PFyyWWV/.test(src));
  assert.ok(!/auth\.uid\s*==\s*["']/.test(src));
});

test("helpers present", function () {
  assert.match(src, /function signedIn\(\)/);
  assert.match(src, /function isOwner\(uid\)/);
  assert.match(src, /function isAdmin\(\)[\s\S]*exists\(\/databases\/\$\(database\)\/documents\/admins\/\$\(request\.auth\.uid\)\)/);
});

test("every match block present", function () {
  [
    "/admins/{uid}", "/users/{uid}", "/meta/{metaId}", "/spaceData/{sid}",
    "/chunks/{i}", "/sharedBase/space-index", "/versions/{v}"
  ].forEach(function (p) {
    assert.ok(src.indexOf("match " + p) >= 0, p);
  });
  assert.equal((src.match(/match \/chunks\/\{i\}/g) || []).length, 2);
});

test("admins: owner read, no write", function () {
  var b = src.slice(src.indexOf("match /admins/{uid}"));
  b = b.slice(0, b.indexOf("match /users"));
  assert.match(b, /allow read: if isOwner\(uid\)/);
  assert.match(b, /allow write: if false/);
});

test("hasOnly field lists exact", function () {
  var l = hasOnlyLists();
  [
    "spaces,tags,schema,clientUpdatedAt,updatedAt",
    "viewingVersion,updatedAt",
    "schema,baseVersion,chunks,hash,updatedAt",
    "data",
    "latestVersion,latestNote,publishedAt",
    "version,note,publishedAt,chunks"
  ].forEach(function (e) {
    assert.ok(l.indexOf(e) >= 0, e);
  });
  assert.equal(l.length, 7); // data appears twice (user + shared chunks)
});

test("limits", function () {
  assert.match(src, /spaces\.size\(\) <= 40/);
  assert.match(src, /tags\.size\(\) <= 2000/);
  assert.match(src, /schema == 3/);
  assert.match(src, /chunks <= 50/);
  assert.match(src, /hash\.size\(\) <= 128/);
  assert.match(src, /data\.size\(\) <= 1000000/);
  assert.ok(src.indexOf("^[0-9A-Za-z_-]{1,40}$") >= 0);
  assert.ok(src.indexOf("^[0-9]{1,2}$") >= 0);
  assert.ok(src.indexOf("^[0-9]{1,6}$") >= 0);
});

test("shared base writes are admin only", function () {
  var s = src.slice(src.indexOf("match /sharedBase/space-index"));
  var writes = s.match(/allow (create, update|delete): if [^\n]*/g);
  writes.forEach(function (w) { assert.match(w, /isAdmin\(\)/); });
});

test("default deny is last", function () {
  var i = src.lastIndexOf("match /{document=**}");
  assert.ok(i > 0);
  assert.match(src.slice(i), /allow read, write: if false;/);
  assert.equal(src.slice(src.lastIndexOf("match /"), i).length >= 0, true);
  assert.ok(src.indexOf("match /sharedBase") < i && src.indexOf("match /users/{uid}") < i);
});
