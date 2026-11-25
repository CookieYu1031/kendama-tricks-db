"use strict";

  /* ============================================================
     BASE CACHE — published 總表 versions stored on the device (Cache Storage)
  ============================================================ */
  /* ------------------------------------------------------------
     Why it is safe to cache by version number:
       - publishSpaceIndexUpdate (js/51-shared-base.js) always writes version
         latestVersion+1 and nothing in the app rewrites, rolls back or deletes
         a published version, so version N is immutable for the app.
       - Only a manual edit in the Firebase console could change it; if that ever
         happens, bump BASE_CACHE_NAME / BASE_CACHE_SCHEMA to drop every copy.
     Only public data lives here (sharedBase is readable by guests); users/{uid}
     data is never stored here. Every function swallows errors and resolves
     (null / undefined) so a missing/blocked/full Cache Storage never breaks loading.
     NOTE: sw.js activate must not delete BASE_CACHE_NAME.
  ------------------------------------------------------------ */
  addStrings({
    zh:{ localCacheFull:"本機空間已滿，變更無法存在這台裝置，請保持連線讓雲端同步" },
    jp:{ localCacheFull:"この端末の保存容量がいっぱいです。変更を端末に保存できません。オンラインのままクラウド同期してください" },
    en:{ localCacheFull:"Device storage is full, so changes can't be saved on this device. Stay online so they sync to the cloud." }
  });
  var BASE_CACHE_NAME = "kdb-base-v1";
  var BASE_CACHE_SCHEMA = 1;
  var BASE_CACHE_KEEP = 2;                 // newest versions kept (admin may view an older one)
  var BASE_LAST_KEY = "kendama-base-last-v1";

  function baseCacheUrl(version){ return "/__kdb-base/" + SHARED_BASE_DOC_ID + "/" + version; }
  function baseCacheOpen(){
    if(typeof caches === "undefined" || !caches || typeof Response === "undefined") return Promise.reject(new Error("no caches"));
    return caches.open(BASE_CACHE_NAME);
  }
  // Raw payload string must at least look like a published snapshot.
  function baseRawLooksValid(parsed){
    return !!parsed && typeof parsed === "object" && Array.isArray(parsed.categories) && Array.isArray(parsed.tricks);
  }

  // -> Promise<string|null>: the raw JSON string stored for this version.
  function baseCacheGet(version){
    var url = baseCacheUrl(version);
    return Promise.resolve().then(baseCacheOpen).then(function(cache){
      return cache.match(url);
    }).then(function(res){
      if(!res) return null;
      return res.text().then(function(txt){
        var rec = JSON.parse(txt);
        if(!rec || rec.schema !== BASE_CACHE_SCHEMA || rec.version !== version || typeof rec.raw !== "string") return null;
        return rec.raw;
      });
    }).catch(function(){ return null; });
  }

  function baseCacheDelete(version){
    return Promise.resolve().then(baseCacheOpen).then(function(cache){
      return cache.delete(baseCacheUrl(version));
    }).catch(function(){});
  }

  // Version numbers present in a list of cache keys (Request-like objects with .url).
  function baseCacheVersionsOf(keys){
    var prefix = "/__kdb-base/" + SHARED_BASE_DOC_ID + "/", out = [];
    (keys || []).forEach(function(k){
      var u = String(k && k.url || "");
      var i = u.indexOf(prefix);
      if(i < 0) return;
      var n = parseInt(u.slice(i + prefix.length), 10);
      if(n > 0) out.push(n);
    });
    return out;
  }
  // Pure: versions to drop so that only the newest `keep` remain.
  function baseCacheStaleVersions(versions, keep){
    return versions.slice().sort(function(a, b){ return b - a; }).slice(keep == null ? BASE_CACHE_KEEP : keep);
  }

  // Stores the raw JSON string of a version, then prunes older ones.
  function baseCachePut(version, raw){
    var url = baseCacheUrl(version);
    return Promise.resolve().then(baseCacheOpen).then(function(cache){
      var body = JSON.stringify({ schema: BASE_CACHE_SCHEMA, version: version, raw: raw });
      return cache.put(url, new Response(body)).then(function(){
        return cache.keys();
      }).then(function(keys){
        return Promise.all(baseCacheStaleVersions(baseCacheVersionsOf(keys)).map(function(v){
          return cache.delete(baseCacheUrl(v));
        }));
      });
    }).catch(function(){});
  }

  // Last published version this device saw (guest offline fallback).
  function rememberBaseVersion(version){
    try{ if(version > 0) localStorage.setItem(BASE_LAST_KEY, String(version)); }catch(e){ /* ignore */ }
  }
  function lastBaseVersion(){
    try{
      var n = parseInt(localStorage.getItem(BASE_LAST_KEY), 10);
      return n > 0 ? n : 0;
    }catch(e){ return 0; }
  }
