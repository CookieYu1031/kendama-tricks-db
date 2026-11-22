#!/usr/bin/env node
// Runs only the tests related to what changed.
//
//   node scripts/test.js            changed files vs main (committed on this branch + uncommitted + untracked)
//   node scripts/test.js --all      every test (CI uses this before deploy)
//   node scripts/test.js drawer sync   just these categories (folder names under tests/)
//   node scripts/test.js --list     print the plan, run nothing
//
// A test file runs when
//   1. its category (tests/<category>/) is mapped from a changed file (CATEGORY_OF below), or
//   2. its source names a changed file (e.g. a load([...]) list containing "js/47-modal-add.js"), or
//   3. the test file itself changed.
// Core files (js/00–09), js/90, index.html, tests/_load.js and this script run everything.
// tests/rules (file size, style tokens, i18n parity) runs whenever js/, css/ or index.html changed.
"use strict";
const fs = require("fs");
const path = require("path");
const { execSync, spawnSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const TESTS = path.join(ROOT, "tests");

function categories(){
  return fs.readdirSync(TESTS, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort();
}
function testFiles(cat){
  const dir = path.join(TESTS, cat);
  return fs.readdirSync(dir).filter((f) => f.endsWith(".test.js")).sort().map((f) => "tests/" + cat + "/" + f);
}
function allTestFiles(){
  return categories().reduce((acc, c) => acc.concat(testFiles(c)), []);
}

// Changed file -> "ALL" | category name | null (no category; rule 2 may still pick tests up).
function categoryOf(file){
  if(/^js\/0\d-/.test(file) || /^js\/9\d-/.test(file)) return "ALL";
  if(file === "index.html" || file === "tests/_load.js" || file === "scripts/test.js") return "ALL";
  const m = /^js\/(\d)(\d)-/.exec(file);
  if(m){
    const n = Number(m[1] + m[2]);
    if(n === 58) return "share";
    return { 1: "shell", 2: "browse", 3: "drawer", 4: "modals", 5: "sync", 6: "search", 7: "admin", 8: "tools" }[m[1]] || null;
  }
  if(file === "firestore.rules") return "firestore";
  if(file === "scripts/build-search-index.js" || file === "data/search-index.json") return "search";
  if(file === "sw.js" || file === "manifest.webmanifest") return "shell";
  const t = /^tests\/([^/]+)\//.exec(file);
  if(t) return t[1];
  return null;
}

function git(cmd){
  try{ return execSync("git " + cmd, { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }); }
  catch(e){ return ""; }
}
function changedFiles(){
  const lines = [];
  const branch = git("rev-parse --abbrev-ref HEAD").trim();
  if(branch && branch !== "main") lines.push(git("diff --name-only main...HEAD"));
  lines.push(git("diff --name-only HEAD"));
  lines.push(git("ls-files --others --exclude-standard"));
  const set = new Set();
  lines.join("\n").split(/\r?\n/).map((s) => s.trim()).filter(Boolean).forEach((f) => set.add(f.replace(/\\/g, "/")));
  return Array.from(set).sort();
}

// -> { files: [...test files], reasons: { file: why } }
function plan(changed){
  const cats = categories();
  const reasons = {};
  const add = (f, why) => { if(!reasons[f]) reasons[f] = why; };
  const all = allTestFiles();
  if(changed.some((f) => categoryOf(f) === "ALL")){
    all.forEach((f) => add(f, "core / shared file changed"));
    return { files: all, reasons: reasons };
  }
  changed.forEach((f) => {
    const c = categoryOf(f);
    if(c && cats.indexOf(c) !== -1) testFiles(c).forEach((t) => add(t, "category " + c + " <- " + f));
  });
  if(changed.some((f) => /^(js|css)\//.test(f))) testFiles("rules").forEach((t) => add(t, "project rules (js/css changed)"));
  const sources = {};
  all.forEach((t) => { sources[t] = fs.readFileSync(path.join(ROOT, t), "utf8"); });
  changed.forEach((f) => {
    if(!/^(js|css|scripts)\//.test(f) && f !== "firestore.rules") return;
    const base = path.basename(f);
    all.forEach((t) => { if(sources[t].indexOf(base) !== -1) add(t, "uses " + f); });
  });
  changed.filter((f) => /^tests\/.+\.test\.js$/.test(f) && all.indexOf(f) !== -1).forEach((f) => add(f, "test changed"));
  return { files: all.filter((f) => reasons[f]), reasons: reasons };
}

function main(argv){
  const args = argv.slice(2);
  const listOnly = args.indexOf("--list") !== -1;
  const named = args.filter((a) => !a.startsWith("--"));
  let p;
  if(args.indexOf("--all") !== -1){
    p = { files: allTestFiles(), reasons: {} };
  } else if(named.length){
    const bad = named.filter((c) => categories().indexOf(c) === -1);
    if(bad.length){ console.error("unknown category: " + bad.join(", ") + " (have: " + categories().join(", ") + ")"); return 2; }
    p = { files: named.reduce((acc, c) => acc.concat(testFiles(c)), []), reasons: {} };
  } else {
    const changed = changedFiles();
    p = plan(changed);
    console.log("changed: " + (changed.length ? changed.join(", ") : "(none)"));
  }
  if(!p.files.length){ console.log("no related tests"); return 0; }
  console.log("running " + p.files.length + " test file(s)" + (listOnly ? ":" : ""));
  if(listOnly){ p.files.forEach((f) => console.log("  " + f + (p.reasons[f] ? "   (" + p.reasons[f] + ")" : ""))); return 0; }
  const r = spawnSync(process.execPath, ["--test"].concat(p.files), { cwd: ROOT, stdio: "inherit" });
  return r.status === null ? 1 : r.status;
}

if(require.main === module) process.exit(main(process.argv));
module.exports = { categoryOf: categoryOf, plan: plan };
