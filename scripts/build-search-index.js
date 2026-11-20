#!/usr/bin/env node
// Builds data/search-index.json from the published shared base (Firestore, public REST read).
// Usage: node scripts/build-search-index.js [--dry-run] [--snapshot file.json] [--out path]
//   --snapshot: read { version, label?, snapshot:{categories,tricks,infos,tags} } instead of Firestore.
// Only Node built-ins. Index logic = js/61-search-index.js, loaded in a vm like tests/_load.js.
"use strict";
const fs = require("fs");
const vm = require("vm");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const DOC_ID = "space-index"; // SHARED_BASE_DOC_ID in js/50-sync-core.js
const LOAD_FILES = ["js/01-data-model.js", "js/02-constants-colors-icons.js", "js/03-i18n.js", "js/04-state.js",
  "js/05-data-helpers.js", "js/07-id.js", "js/09-names.js", "js/61-search-index.js"];

function readConfig(){
  const src = fs.readFileSync(path.join(ROOT, "js/00-firebase-config.js"), "utf8");
  const key = /apiKey:\s*"([^"]+)"/.exec(src), proj = /projectId:\s*"([^"]+)"/.exec(src);
  if(!key || !proj) throw new Error("apiKey/projectId not found in js/00-firebase-config.js");
  return { apiKey: key[1], projectId: proj[1] };
}

// Firestore REST typed value -> plain JS.
function decodeValue(v){
  if(v == null) return null;
  if("stringValue" in v) return v.stringValue;
  if("integerValue" in v) return Number(v.integerValue);
  if("doubleValue" in v) return v.doubleValue;
  if("booleanValue" in v) return v.booleanValue;
  if("nullValue" in v) return null;
  if("timestampValue" in v) return v.timestampValue;
  if("arrayValue" in v) return (v.arrayValue.values || []).map(decodeValue);
  if("mapValue" in v) return decodeFields(v.mapValue.fields);
  return null;
}
function decodeFields(fields){
  const o = {};
  Object.keys(fields || {}).forEach((k) => { o[k] = decodeValue(fields[k]); });
  return o;
}

// getDoc(relPath) -> decoded fields object, or null when the doc does not exist.
// Mirrors fetchSharedBaseVersion (js/51) + readChunkedPayload (js/53).
async function reassembleVersion(getDoc, version){
  const base = "sharedBase/" + DOC_ID + "/versions/" + version;
  const head = await getDoc(base);
  if(!head) throw new Error("version doc missing: " + base);
  let data;
  if(typeof head.chunks === "number"){
    const pieces = [];
    for(let i = 0; i < head.chunks; i++){
      const c = await getDoc(base + "/chunks/" + i);
      if(!c || typeof c.data !== "string") throw new Error("shared base chunk missing: " + i);
      pieces.push(c.data);
    }
    data = JSON.parse(pieces.join(""));
  } else {
    data = head; // old inline layout
  }
  return {
    version: head.version || version,
    snapshot: {
      categories: Array.isArray(data.categories) ? data.categories : [],
      tricks: Array.isArray(data.tricks) ? data.tricks : [],
      infos: Array.isArray(data.infos) ? data.infos : [],
      tags: Array.isArray(data.tags) ? data.tags : []
    }
  };
}

function makeRestGetDoc(cfg){
  return async function(rel){
    const url = "https://firestore.googleapis.com/v1/projects/" + cfg.projectId +
      "/databases/(default)/documents/" + rel + "?key=" + encodeURIComponent(cfg.apiKey);
    const r = await fetch(url);
    if(r.status === 404) return null;
    if(r.status === 401 || r.status === 403){
      throw new Error("Firestore denied read of " + rel + " (HTTP " + r.status + "): sharedBase must be publicly readable");
    }
    if(!r.ok) throw new Error("Firestore HTTP " + r.status + " for " + rel);
    return decodeFields((await r.json()).fields);
  };
}

function buildIndexJson(version, snapshot, label, now){
  const ctx = { console, setTimeout, clearTimeout, Date, Math, JSON,
    localStorage: { getItem: () => null, setItem(){}, removeItem(){}, clear(){} },
    navigator: { language: "zh-TW" } };
  ctx.window = ctx;
  vm.createContext(ctx);
  LOAD_FILES.forEach((f) => vm.runInContext(fs.readFileSync(path.join(ROOT, f), "utf8"), ctx, { filename: f }));
  ctx.isLoggedIn = () => false; // guest scope: public tables only
  ctx.db = ctx.normalizeDB({ categories: snapshot.categories, tricks: snapshot.tricks, infos: snapshot.infos, tags: snapshot.tags });
  ctx.invalidateDbIndex();
  const entries = JSON.parse(JSON.stringify(ctx.buildSearchIndex(ctx.db, { guest: true })));
  const tags = (ctx.db.tags || []).map((g) => ({ id: g.id, name: { zh: g.name.zh || "", jp: g.name.jp || "", en: g.name.en || "" } }));
  const out = { version: version, generatedAt: (now || new Date()).toISOString(), entries: entries, tags: tags };
  if(label) out.label = label;
  return out;
}

async function main(){
  const args = process.argv.slice(2);
  const dry = args.includes("--dry-run");
  const arg = (n) => { const i = args.indexOf(n); return i === -1 ? null : args[i + 1]; };
  const outPath = path.resolve(arg("--out") || path.join(ROOT, "data/search-index.json"));
  let version, label, snapshot;
  const snapFile = arg("--snapshot") || process.env.SEARCH_INDEX_SNAPSHOT;
  if(snapFile){
    const j = JSON.parse(fs.readFileSync(snapFile, "utf8"));
    version = j.version; label = j.label; snapshot = j.snapshot;
  } else {
    const getDoc = makeRestGetDoc(readConfig());
    const ptr = await getDoc("sharedBase/" + DOC_ID);
    if(!ptr || !ptr.latestVersion) throw new Error("no published shared base version yet");
    const r = await reassembleVersion(getDoc, ptr.latestVersion);
    version = r.version; snapshot = r.snapshot;
    label = ptr.latestLabel || undefined;
  }
  const out = buildIndexJson(version, snapshot, label);
  console.log("version " + out.version + ", entries " + out.entries.length + ", tags " + out.tags.length +
    ", tricks in snapshot " + snapshot.tricks.length);
  if(dry){ console.log("dry run: nothing written"); return; }
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(out));
  console.log("wrote " + outPath);
}

module.exports = { decodeValue, decodeFields, reassembleVersion, buildIndexJson };

if(require.main === module){
  main().catch((e) => { console.error("build-search-index failed: " + e.message); process.exitCode = 1; });
}
