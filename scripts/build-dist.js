#!/usr/bin/env node
"use strict";
// Deploy-time build: repo root -> dist/. Development stays build-free.
//   node scripts/build-dist.js            copy + content-hash only (local check, no downloads)
//   node scripts/build-dist.js --minify   also minify each js file with esbuild (CI)
// JS files are NOT concatenated: each stays a classic script (same order, same top-level globals).
// All stylesheet links are merged into one css file placed at the first link's position.
// Output: dist/ and firebase.deploy.json (both git-ignored).
var fs = require("fs");
var path = require("path");
var os = require("os");
var crypto = require("crypto");
var vm = require("vm");
var cp = require("child_process");

var ROOT = path.join(__dirname, "..");
var DIST = path.join(ROOT, "dist");
var ASSET_DIR = "a"; // dist/a/ holds hashed files (served immutable)
var ESBUILD_VERSION = "0.25.0";
// es2019: lowers ?. ?? ||= etc. so minify never emits syntax older browsers lack; esnext would let
// esbuild turn `a = a || b` into `a ||= b`. Lowering is semantics-preserving and never errors here.
var ESBUILD_TARGET = "es2019";
// js / css (unhashed): a page cached before v0.19 still asks for the old paths. Safe to drop after a while.
var COPY_DIRS = ["assets", "data", "js", "css"];
var COPY_FILES = ["manifest.webmanifest", "sw.js", "404.html"];

function hash10(content){
  return crypto.createHash("sha256").update(content).digest("hex").slice(0, 10);
}

function hashedName(file, content){
  var base = path.posix.basename(String(file).replace(/\\/g, "/"));
  var m = /^(.*)\.([^.]+)$/.exec(base);
  var stem = m ? m[1] : base, ext = m ? m[2] : "";
  return stem + "." + hash10(content) + (ext ? "." + ext : "");
}

// Rewrite relative url(...) in css (located at cssRel, e.g. "css/x.css") so it resolves from dist/a/.
function rewriteCssUrls(css, cssRel, existsFn){
  var dir = path.posix.dirname(cssRel);
  return css.replace(/url\(\s*(["']?)([^"')]*?)\1\s*\)/g, function(m, q, u){
    if(!u || /^(data:|https?:|\/\/|\/|#)/i.test(u)) return m;
    var mm = /^([^?#]*)([?#].*)?$/.exec(u);
    var resolved = path.posix.normalize(path.posix.join(dir, mm[1]));
    if(existsFn && !existsFn(resolved)) throw new Error("css url not found: " + u + " (in " + cssRel + ")");
    var rel = path.posix.relative(ASSET_DIR, resolved) + (mm[2] || "");
    return "url(" + q + rel + q + ")";
  });
}

function checkCss(css, file){
  if(/@import\b/.test(css)) throw new Error("@import is not supported: " + file);
}

function mergeCss(files, readFn, existsFn){
  var parts = files.map(function(f){
    var src = readFn(f);
    checkCss(src, f);
    src = src.replace(/^﻿/, "").replace(/@charset\s+[^;]+;/g, "");
    return "/* " + f + " */\n" + rewriteCssUrls(src, f, existsFn);
  });
  return parts.join("\n");
}

// Rewrite html: scripts -> jsMap[src], stylesheet links -> one link (cssHref) at the first position.
function rewriteHtml(html, jsMap, cssHref){
  var firstCss = true;
  html = html.replace(/<link\s+rel="stylesheet"\s+href="(css\/[^"]+)"\s*\/?>[ \t]*(\r?\n)?/g, function(m, href, nl){
    if(!firstCss) return "";
    firstCss = false;
    return '<link rel="stylesheet" href="' + cssHref + '">' + (nl || "");
  });
  html = html.replace(/<script\s+src="(js\/[^"]+)"><\/script>/g, function(m, src){
    if(!jsMap[src]) throw new Error("script not built: " + src);
    return '<script src="' + jsMap[src] + '"></script>';
  });
  return html;
}

function listScripts(html){
  var out = [];
  html.replace(/<script\s+src="(js\/[^"]+)"><\/script>/g, function(m, s){ out.push(s); return m; });
  return out;
}
function listStyles(html){
  var out = [];
  html.replace(/<link\s+rel="stylesheet"\s+href="(css\/[^"]+)"\s*\/?>/g, function(m, s){ out.push(s); return m; });
  return out;
}

// Local (non-http, non-data) src/href values in html.
function localRefs(html){
  var out = [], re = /<(?:script|link|img|source)\b[^>]*?\b(?:src|href)="([^"]+)"/g, m;
  while((m = re.exec(html))){
    var u = m[1];
    if(/^(https?:|\/\/|data:|#|mailto:)/i.test(u)) continue;
    out.push(u.replace(/[?#].*$/, ""));
  }
  return out;
}

// Top-level `function name` / `var name` declarations at column 0 (sample for the post-minify check).
function topLevelNames(src){
  var names = [], m, re = /^(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)/gm;
  while((m = re.exec(src))) names.push({ kind: "function", name: m[1] });
  re = /^var\s+([A-Za-z_$][\w$]*)/gm;
  while((m = re.exec(src))) names.push({ kind: "var", name: m[1] });
  return names;
}
function missingNames(orig, out){
  return topLevelNames(orig).filter(function(n){
    var esc = n.name.replace(/\$/g, "\\$");
    var re = n.kind === "function"
      ? new RegExp("function\\s*\\*?\\s*" + esc + "(?![\\w$])")
      : new RegExp("(?:^|[^\\w$.])" + esc + "(?![\\w$])");
    return !re.test(out);
  });
}

// Firebase headers: later rules win for the same key, so the immutable /a/ rule goes last.
function buildDeployConfig(base){
  var cfg = JSON.parse(JSON.stringify(base));
  cfg.hosting = cfg.hosting || {};
  cfg.hosting.public = "dist";
  cfg.hosting.ignore = (cfg.hosting.ignore || []).filter(function(p){ return !/^dist(\/|$)/.test(p); });
  var headers = (cfg.hosting.headers || []).slice();
  headers.push({
    source: "/" + ASSET_DIR + "/**",
    headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }]
  });
  cfg.hosting.headers = headers;
  return cfg;
}

function minifyJs(files){
  var tmp = fs.mkdtempSync(path.join(os.tmpdir(), "kdb-esbuild-"));
  try{
    var args = ["--yes", "esbuild@" + ESBUILD_VERSION].concat(files, [
      "--minify", "--target=" + ESBUILD_TARGET, "--charset=utf8", "--legal-comments=none",
      "--outbase=js", "--outdir=" + tmp, "--log-level=error"
    ]);
    var r = cp.spawnSync("npx", args, { cwd: ROOT, stdio: ["ignore", "inherit", "inherit"], shell: process.platform === "win32" });
    if(r.status !== 0) throw new Error("esbuild failed (status " + r.status + ")");
    var out = {};
    files.forEach(function(f){
      var p = path.join(tmp, path.basename(f));
      if(!fs.existsSync(p)) throw new Error("esbuild produced no output for " + f);
      out[f] = fs.readFileSync(p, "utf8");
    });
    return out;
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

function copyDir(src, dst){
  fs.mkdirSync(dst, { recursive: true });
  fs.readdirSync(src, { withFileTypes: true }).forEach(function(d){
    if(d.name.charAt(0) === "." || d.name.charAt(0) === "_") return;
    var s = path.join(src, d.name), t = path.join(dst, d.name);
    if(d.isDirectory()) copyDir(s, t); else fs.copyFileSync(s, t);
  });
}

function main(){
  var minify = process.argv.indexOf("--minify") >= 0;
  if(path.resolve(DIST) !== path.join(path.resolve(ROOT), "dist")) throw new Error("bad dist path");
  fs.rmSync(DIST, { recursive: true, force: true });
  fs.mkdirSync(path.join(DIST, ASSET_DIR), { recursive: true });

  var html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  var scripts = listScripts(html), styles = listStyles(html);
  if(!scripts.length || !styles.length) throw new Error("no scripts or stylesheets found in index.html");

  var originals = {};
  scripts.forEach(function(s){ originals[s] = fs.readFileSync(path.join(ROOT, s), "utf8"); });
  var built = minify ? minifyJs(scripts) : originals;

  var jsMap = {};
  scripts.forEach(function(s){
    var code = built[s];
    try{ new vm.Script(code, { filename: s }); }
    catch(e){ throw new Error("syntax check failed for " + s + ": " + e.message); }
    var miss = missingNames(originals[s], code);
    if(miss.length) throw new Error("top-level names lost in " + s + ": " + miss.map(function(n){ return n.name; }).join(", "));
    var name = hashedName(s, code);
    fs.writeFileSync(path.join(DIST, ASSET_DIR, name), code);
    jsMap[s] = ASSET_DIR + "/" + name;
  });

  var css = mergeCss(styles, function(f){ return fs.readFileSync(path.join(ROOT, f), "utf8"); },
    function(rel){ return fs.existsSync(path.join(ROOT, rel)); });
  var cssName = hashedName("app.css", css);
  fs.writeFileSync(path.join(DIST, ASSET_DIR, cssName), css);
  var cssHref = ASSET_DIR + "/" + cssName;

  var outHtml = rewriteHtml(html, jsMap, cssHref);
  fs.writeFileSync(path.join(DIST, "index.html"), outHtml);

  COPY_DIRS.forEach(function(d){ copyDir(path.join(ROOT, d), path.join(DIST, d)); });
  COPY_FILES.forEach(function(f){
    var p = path.join(ROOT, f);
    if(!fs.existsSync(p)) return;
    if(f === "404.html"){
      var h = fs.readFileSync(p, "utf8");
      var s2 = listScripts(h), c2 = listStyles(h);
      if(s2.length || c2.length) h = rewriteHtml(h, jsMap, cssHref);
      fs.writeFileSync(path.join(DIST, f), h);
    } else fs.copyFileSync(p, path.join(DIST, f));
  });

  // every local reference in the shipped html must exist in dist
  ["index.html", "404.html"].forEach(function(f){
    var p = path.join(DIST, f);
    if(!fs.existsSync(p)) return;
    localRefs(fs.readFileSync(p, "utf8")).forEach(function(ref){
      if(!fs.existsSync(path.join(DIST, ref))) throw new Error(f + " references missing file: " + ref);
    });
  });

  var base = JSON.parse(fs.readFileSync(path.join(ROOT, "firebase.json"), "utf8"));
  fs.writeFileSync(path.join(ROOT, "firebase.deploy.json"), JSON.stringify(buildDeployConfig(base), null, 2) + "\n");

  console.log("dist ok: " + scripts.length + " js, 1 css (" + cssName + ")" + (minify ? ", minified" : ", not minified"));
}

module.exports = {
  hash10: hash10, hashedName: hashedName, rewriteCssUrls: rewriteCssUrls, mergeCss: mergeCss,
  rewriteHtml: rewriteHtml, listScripts: listScripts, listStyles: listStyles, localRefs: localRefs,
  topLevelNames: topLevelNames, missingNames: missingNames, buildDeployConfig: buildDeployConfig
};

if(require.main === module){
  try{ main(); }
  catch(e){ console.error("build-dist failed: " + e.message); process.exit(1); }
}
