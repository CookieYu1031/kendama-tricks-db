"use strict";

  /* ============================================================
     SYNC CONFLICT (C4/C5) — shown only when BOTH this device and the cloud changed since
     the last sync (manual sync, or on open). Three choices: use cloud / use local / merge.
  ============================================================ */
  addStrings({
    zh:{ conflictTitle:"本機與雲端的資料不同", conflictBody:"自上次同步後，本機與雲端都有變更。要怎麼處理？",
      conflictUseCloud:"用雲端", conflictUseLocal:"用本機", conflictMerge:"合併", conflictLater:"稍後",
      conflictMerged:"已合併並同步" },
    jp:{ conflictTitle:"この端末とクラウドのデータが異なります", conflictBody:"前回の同期以降、この端末とクラウドの両方で変更がありました。どうしますか？",
      conflictUseCloud:"クラウドを使う", conflictUseLocal:"この端末を使う", conflictMerge:"マージ", conflictLater:"あとで",
      conflictMerged:"マージして同期しました" },
    en:{ conflictTitle:"This device and the cloud differ", conflictBody:"Both this device and the cloud changed since the last sync. What should happen?",
      conflictUseCloud:"Use cloud", conflictUseLocal:"Use this device", conflictMerge:"Merge", conflictLater:"Later",
      conflictMerged:"Merged and synced" }
  });

  // Pure 3-way merge of two dbs against their last common state, per collection by id.
  // Missing on one side = deleted on that side. Both changed -> newer side wins.
  function mergeCollection(baseList, localList, cloudList, localIsNewer){
    function toMap(list){ var m = {}; (list || []).forEach(function(x){ m[x.id] = x; }); return m; }
    var bm = toMap(baseList), lm = toMap(localList), cm = toMap(cloudList);
    var ids = [], seen = {};
    [localList, cloudList].forEach(function(list){
      (list || []).forEach(function(x){ if(!seen[x.id]){ seen[x.id] = true; ids.push(x.id); } });
    });
    var out = [];
    ids.forEach(function(id){
      var l = lm[id], c = cm[id], b = bm[id], pick;
      if(deepEqual(l, c)) pick = l;
      else if(deepEqual(l, b)) pick = c;
      else if(deepEqual(c, b)) pick = l;
      else pick = localIsNewer ? l : c;
      if(pick !== undefined) out.push(pick);
    });
    return out;
  }
  // Order of a merged list (tags): follows whichever side re-ordered since base (both -> newer side);
  // ids not in the chosen order go last.
  function mergeOrder(merged, baseList, localList, cloudList, localIsNewer){
    var have = {}; merged.forEach(function(x){ have[x.id] = x; });
    function ids(list){ return (list || []).map(function(x){ return x.id; }).filter(function(id){ return have[id]; }); }
    var bi = ids(baseList), li = ids(localList), ci = ids(cloudList);
    function moved(side){ var inSide = {}; side.forEach(function(id){ inSide[id] = true; });
      var inBase = {}; bi.forEach(function(id){ inBase[id] = true; });
      return side.filter(function(id){ return inBase[id]; }).join("|") !== bi.filter(function(id){ return inSide[id]; }).join("|"); }
    var localMoved = moved(li), cloudMoved = moved(ci);
    var pref = localMoved && (!cloudMoved || localIsNewer) ? li : (cloudMoved ? ci : li);
    var seen = {}, out = [];
    pref.concat(li, ci).forEach(function(id){ if(!seen[id]){ seen[id] = true; out.push(have[id]); } });
    return out;
  }
  // Same rule for a { key: value } map (db.labels), per key.
  function mergeMap(baseMap, localMap, cloudMap, localIsNewer){
    baseMap = baseMap || {}; localMap = localMap || {}; cloudMap = cloudMap || {};
    var keys = [], seen = {}, out = {};
    [localMap, cloudMap].forEach(function(m){
      Object.keys(m).forEach(function(k){ if(!seen[k]){ seen[k] = true; keys.push(k); } });
    });
    keys.forEach(function(k){
      var l = localMap[k], c = cloudMap[k], b = baseMap[k], pick;
      if(deepEqual(l, c)) pick = l;
      else if(deepEqual(l, b)) pick = c;
      else if(deepEqual(c, b)) pick = l;
      else pick = localIsNewer ? l : c;
      if(pick !== undefined) out[k] = pick;
    });
    return out;
  }
  function threeWayMerge(base, local, cloud, localIsNewer){
    base = base || {};
    var out = {};
    ["spaces", "categories", "tricks", "infos", "tags"].forEach(function(k){
      out[k] = mergeCollection(base[k], local[k], cloud[k], !!localIsNewer);
    });
    out.tags = mergeOrder(out.tags, base.tags, local.tags || [], cloud.tags || [], !!localIsNewer);
    out.labels = mergeMap(base.labels, local.labels, cloud.labels, !!localIsNewer);
    return out;
  }

  /* ------------------------------------------------------------
     Modal (markup copies #confirmOverlay in index.html)
  ------------------------------------------------------------ */
  var _conflictResolver = null;
  function showConflictModal(){
    document.getElementById("conflictTitle").textContent = t("conflictTitle");
    document.getElementById("conflictSub").textContent = t("conflictBody");
    document.getElementById("conflictCloudBtn").textContent = t("conflictUseCloud");
    document.getElementById("conflictLocalBtn").textContent = t("conflictUseLocal");
    document.getElementById("conflictMergeBtn").textContent = t("conflictMerge");
    document.getElementById("conflictLaterBtn").textContent = t("conflictLater");
    document.getElementById("conflictOverlay").classList.add("show");
    return new Promise(function(resolve){ _conflictResolver = resolve; });
  }
  function closeConflictModal(choice){
    document.getElementById("conflictOverlay").classList.remove("show");
    if(_conflictResolver){ var r = _conflictResolver; _conflictResolver = null; r(choice); }
  }
  [["conflictCloudBtn", "cloud"], ["conflictLocalBtn", "local"], ["conflictMergeBtn", "merge"], ["conflictLaterBtn", "later"]]
    .forEach(function(p){
      var el = document.getElementById(p[0]);
      if(el) el.addEventListener("click", function(){ closeConflictModal(p[1]); });
    });

  // Applies the chosen side, then pushes if local content is kept.
  // res = loadMergedDBFromCloud() result, mi = cloudReadMeta() result.
  function resolveConflict(choice, res, mi){
    if(choice === "cloud"){ applyCloudDb(res); return Promise.resolve({ status: "pulled" }); }
    if(choice !== "local" && choice !== "merge") return Promise.resolve({ status: "conflict" });
    if(choice === "merge"){
      var merged = threeWayMerge(userCache.synced, db, res.db, userCache.localUpdatedAt > res.cloudTs);
      db = normalizeDB(merged);
      backfillPlatforms(db);
      if(typeof invalidateDbIndex === "function") invalidateDbIndex();
      if(typeof rebuildReadingDict === "function") rebuildReadingDict(db.tricks);
      _mutSeq++;
      userCache.dirty = true;
    }
    // Acknowledge the cloud state so the push overwrites it (every space differing from the
    // cloud hashes gets rewritten; cloud-only spaces get deleted).
    userCache.hashes = res.hashes;
    userCache.cloudClientUpdatedAt = res.cloudTs;
    return pushToCloud(authCurrentUser.uid, mi).then(function(r){
      applyPushResult(r);
      if(choice === "merge"){
        reconcileActiveSpaceAfterSwap();
        render();
        showToast(t("conflictMerged"));
      }
      return { status: "pushed" };
    });
  }
