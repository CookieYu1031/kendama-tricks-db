"use strict";
// Static checks on firestore.rules (no emulator needed).
var test = require("node:test");
var assert = require("node:assert");
var fs = require("fs");
var path = require("path");

var src = fs.readFileSync(path.join(__dirname, "..", "..", "firestore.rules"), "utf8");

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
    "spaces,tags,labels,schema,clientUpdatedAt,updatedAt",
    "viewingVersion,updatedAt",
    "schema,baseVersion,chunks,hash,updatedAt",
    "data",
    "latestVersion,latestNote,latestLabel,publishedAt",
    "version,note,versionLabel,publishedAt,chunks",
    "email,addedAt,color",
    "uid,email,displayName,kind,text,payload,createdAt,status",
    "lastReportAt",
    "kind,text,trickName,from,createdAt,read",
    "read",
    "lang,favorites,lastActiveAt,createdAt",
    "ownerUid,itemId,createdAt,kind,title,payload,v",
    "lists,dailyResetHour,clientUpdatedAt,updatedAt",
    "pages,updatedAt"
  ].forEach(function (e) {
    assert.ok(l.indexOf(e) >= 0, e);
  });
  assert.equal(l.length, 16); // data appears twice (user + shared chunks)
});

test("limits", function () {
  assert.match(src, /spaces\.size\(\) <= 40/);
  assert.match(src, /tags\.size\(\) <= 2000/);
  assert.match(src, /schema == 3/);
  assert.match(src, /chunks <= 50/);
  assert.match(src, /hash\.size\(\) <= 128/);
  assert.match(src, /data\.size\(\) <= 1000000/);
  assert.match(src, /latestLabel\.size\(\) <= 32/);
  assert.match(src, /versionLabel\.size\(\) <= 32/);
  assert.match(src, /latestNote\.size\(\) <= 500/);
  assert.match(src, /note\.size\(\) <= 500/);
  assert.ok(src.indexOf("^[0-9A-Za-z_-]{1,40}$") >= 0);
  assert.ok(src.indexOf("^[0-9]{1,2}$") >= 0);
  assert.ok(src.indexOf("^[0-9]{1,6}$") >= 0);
});

test("shared base writes are admin only", function () {
  var start = src.indexOf("match /sharedBase/space-index");
  var s = src.slice(start, src.indexOf("match /contributors/"));
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

test("v0.7 collections present with admin-gated reads", function () {
  ["contributors/{emailId}", "reports/{rid}", "rateLimits/{uid}", "users/{uid}/inbox/{mid}", "userStats/{uid}"].forEach(function (p) {
    assert.ok(src.indexOf("match /" + p) !== -1, p);
  });
  assert.match(src, /function isContributor\(\)/);
  assert.match(src, /match \/reports\/\{rid\}[\s\S]*?allow read, update, delete: if isAdmin\(\);/);
  assert.match(src, /match \/userStats\/\{uid\}[\s\S]*?allow list: if isAdmin\(\);/);
  assert.match(src, /duration\.value\(60, 's'\)/);
});

test("catch-all deny stays last", function () {
  var last = src.lastIndexOf("match /{document=**}");
  ["match /userStats/", "match /reports/"].forEach(function (p) {
    assert.ok(src.indexOf(p) < last, p);
  });
});

test("spaceData: list rule has no doc-id condition (collection query must pass)", function () {
  var block = src.slice(src.indexOf("match /spaceData/{sid}"));
  assert.match(block, /allow list: if isOwner\(uid\);/);
  assert.ok(!/allow read, delete: if isOwner\(uid\) && sid\.matches/.test(block));
});

test("shares: public read, owner-only write (re-share overwrites), size caps, before catch-all", function () {
  var i = src.indexOf("match /shares/{shareId}");
  assert.ok(i > 0 && i < src.lastIndexOf("match /{document=**}"));
  var b = src.slice(i, src.indexOf("match /{document=**}"));
  assert.match(b, /allow read: if true;/);
  assert.match(b, /allow create, update: if signedIn\(\)/);
  assert.match(b, /ownerUid == request\.auth\.uid/);
  assert.match(b, /shareId == request\.auth\.uid \+ '_' \+ request\.resource\.data\.itemId/);
  assert.match(b, /createdAt == request\.time/);
  assert.match(b, /payload\.size\(\) <= 204800/);
  assert.match(b, /title\.size\(\) <= 120/);
  assert.match(b, /allow delete: if isOwner\(resource\.data\.ownerUid\);/);
});

test("meta/spaces accepts labels only as a map", function () {
  assert.match(src, /labels' in request\.resource\.data\) \|\| request\.resource\.data\.labels is map/);
});
