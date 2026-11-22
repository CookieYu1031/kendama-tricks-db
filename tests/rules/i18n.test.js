// Project rule: every user-visible string exists in zh / jp / en.
// Collects the base UI table (js/03) plus every addStrings({...}) call in js/, then checks
// that the three languages hold the same keys, each a non-empty string.
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { load } = require("../_load");

const ROOT = path.join(__dirname, "..", "..");

// Source text of each addStrings( ... ) argument; skips quoted strings and comments while matching parens.
function addStringsArgs(src){
  const out = [];
  let from = 0;
  for(;;){
    const at = src.indexOf("addStrings(", from);
    if(at === -1) return out;
    let i = at + "addStrings(".length, depth = 1, q = null;
    const start = i;
    for(; i < src.length && depth > 0; i++){
      const ch = src[i];
      if(q){ if(ch === "\\") i++; else if(ch === q) q = null; continue; }
      if(ch === '"' || ch === "'" || ch === "`"){ q = ch; continue; }
      if(ch === "/" && src[i + 1] === "/"){ i = src.indexOf("\n", i); continue; }
      if(ch === "(") depth++;
      else if(ch === ")") depth--;
    }
    const arg = src.slice(start, i - 1).trim();
    if(arg.startsWith("{")) out.push(arg); // skip the function definition itself
    from = i;
  }
}

test("i18n: zh / jp / en hold the same keys, all non-empty", () => {
  const c = load(["js/01-data-model.js", "js/01-data-storage.js", "js/02-constants-colors-icons.js", "js/03-i18n.js"]);
  const files = fs.readdirSync(path.join(ROOT, "js")).filter((f) => f.endsWith(".js") && f !== "03-i18n.js");
  for(const f of files){
    for(const arg of addStringsArgs(fs.readFileSync(path.join(ROOT, "js", f), "utf8"))){
      vm.runInContext("addStrings(" + arg + ")", c, { filename: f });
    }
  }
  const langs = ["zh", "jp", "en"];
  const all = new Set();
  langs.forEach((l) => Object.keys(c.UI[l]).forEach((k) => all.add(k)));
  const problems = [];
  all.forEach((k) => langs.forEach((l) => {
    const v = c.UI[l][k];
    if(typeof v !== "string" || !v.length) problems.push(l + "." + k);
  }));
  assert.deepStrictEqual(problems, []);
  assert.ok(all.size > 500, "collected " + all.size + " keys");
});
