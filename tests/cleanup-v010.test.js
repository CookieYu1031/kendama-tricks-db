"use strict";
var test = require("node:test");
var assert = require("node:assert");
var fs = require("fs");
var path = require("path");

var dir = path.join(__dirname, "..", "js");
var files = fs.readdirSync(dir).filter(function(f){ return /\.js$/.test(f); });
var dead = ["ICON_EYE", "reviewSubmissionId", "submissionRowItems", "buildSubmissionRow",
  "renderSubmissionDrawer", "applySubmissionDots", "isReviewMode", "sub-dots"];

test("dead review-mode identifiers are gone from js/", function(){
  files.forEach(function(f){
    var src = fs.readFileSync(path.join(dir, f), "utf8");
    dead.forEach(function(id){
      assert.ok(src.indexOf(id) < 0, f + " still contains " + id);
    });
  });
});
