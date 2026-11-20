"use strict";

  /* ============================================================
     SYNC QUEUE — local-first (企劃書 §五.3, C1/C2). No timers, no polling.
     saveDB() (01) only writes the per-user cache and marks it dirty. A cloud round
     happens when: the page is hidden/left, the user clicks the sync button, the user
     signs out, or the app opens after auth. Every round packs all pending changes.
  ============================================================ */
  addStrings({
    zh:{ syncLast:"上次同步 {t}", syncNever:"尚未同步", syncPending:"有未同步的變更", syncNow:"立即同步",
      syncDone:"已同步", syncPulled:"已載入雲端最新資料", syncUpToDate:"已是最新" },
    jp:{ syncLast:"最終同期 {t}", syncNever:"未同期", syncPending:"未同期の変更あり", syncNow:"今すぐ同期",
      syncDone:"同期しました", syncPulled:"クラウドの最新データを読み込みました", syncUpToDate:"最新です" },
    en:{ syncLast:"Last synced {t}", syncNever:"Not synced yet", syncPending:"Unsynced changes", syncNow:"Sync now",
      syncDone:"Synced", syncPulled:"Loaded the latest cloud data", syncUpToDate:"Already up to date" }
  });

  var _syncBusy = null; // promise of the round in flight (rounds never overlap)

  // Pure: what to do given the local cache state and the cloud meta.
  // -> "noop" | "push" | "pull" | "conflict"
  function decideSync(cache, mi){
    var hasLocal = !!cache.db || cache.lastSyncAt > 0 || cache.dirty;
    if(!mi.exists) return cache.dirty ? "push" : (hasLocal ? "noop" : "pull");
    var newer = mi.cloudTs > (cache.cloudClientUpdatedAt || 0) || (cache.lastSyncAt === 0 && mi.cloudTs === 0);
    if(newer) return cache.dirty ? "conflict" : "pull";
    return cache.dirty ? "push" : "noop";
  }

  /* ------------------------------------------------------------
     Cache lifecycle (login / logout)
  ------------------------------------------------------------ */
  // Called when auth confirms `user`. Reuses the instant-open cache when it is the same user.
  // Returns true when `db` was swapped (caller re-renders).
  function activateUserCache(user){
    var swapped = false;
    if(!userCache || userCache.uid !== user.uid){
      userCache = readUserCache(user.uid) || emptyUserCache(user.uid);
      db = (userCache.db && userCache.db.categories && userCache.db.tricks) ? normalizeDB(userCache.db) : emptyDB();
      swapped = true;
    }
    _optimisticUid = null; // authCurrentUser now covers isLoggedIn()
    try{ localStorage.setItem(LAST_UID_KEY, user.uid); }catch(e){ /* ignore */ }
    return swapped;
  }
  // Sign-out (cache stays on the device) or auth says nobody is logged in.
  function deactivateUserCache(){
    userCache = null;
    _optimisticUid = null;
    try{ localStorage.removeItem(LAST_UID_KEY); }catch(e){ /* ignore */ }
  }

  // Admin = admins/{uid} exists. Cached so the UI is right instantly next time.
  function refreshAdminFlag(uid){
    return fbStore.doc("admins/" + uid).get().then(function(snap){
      if(!userCache || userCache.uid !== uid) return;
      if(!!snap.exists !== !!userCache.isAdmin){
        userCache.isAdmin = !!snap.exists;
        writeUserCache();
        renderAuthUI();
        if(typeof renderSpaceRail === "function") renderSpaceRail();
      }
    }).catch(function(err){ console.error("Admin check failed:", err); });
  }

  /* ------------------------------------------------------------
     Applying results
  ------------------------------------------------------------ */
  function applyPushResult(r){
    userCache.cloudClientUpdatedAt = r.clientUpdatedAt;
    userCache.hashes = r.hashes;
    userCache.synced = r.snapshot;
    userCache.lastSyncAt = Date.now();
    userCache.dirty = (r.seq !== _mutSeq); // edits made while pushing stay pending
    writeUserCache();
  }
  // Replaces the local db with the cloud one (nothing local is pending, or user chose cloud).
  function applyCloudDb(res){
    db = res.db;
    backfillPlatforms(db);
    userCache.db = db;
    userCache.hashes = res.hashes;
    userCache.synced = JSON.parse(JSON.stringify(db));
    userCache.cloudClientUpdatedAt = res.cloudTs;
    userCache.lastSyncAt = Date.now();
    userCache.dirty = false;
    writeUserCache();
    if(typeof invalidateDbIndex === "function") invalidateDbIndex();
    if(typeof rebuildReadingDict === "function") rebuildReadingDict(db.tricks);
    reconcileActiveSpaceAfterSwap();
    render();
    maybeShowBaseUpdateBanner();
  }

  /* ------------------------------------------------------------
     One sync round
     opts.silent: from page hide / sign-out — never pull, never show UI; a conflict just
     leaves the cache dirty.
  ------------------------------------------------------------ */
  function syncReconcile(opts){
    opts = opts || {};
    if(!authCurrentUser || !userCache) return Promise.resolve({ status: "noop" });
    if(_syncBusy) return _syncBusy;
    var uid = authCurrentUser.uid;
    setSyncing(true);
    _syncBusy = cloudReadMeta(uid).then(function(mi){
      var d = decideSync(userCache, mi);
      if(opts.silent && d === "pull") d = "noop";
      if(d === "noop") return { status: "noop" };
      if(d === "push"){
        return pushToCloud(uid, mi).then(function(r){ applyPushResult(r); return { status: "pushed" }; });
      }
      if(d === "pull"){
        return loadMergedDBFromCloud(uid, mi).then(function(res){ applyCloudDb(res); return { status: "pulled" }; });
      }
      if(opts.silent) return { status: "conflict" };
      return loadMergedDBFromCloud(uid, mi).then(function(res){
        return showConflictModal().then(function(choice){ return resolveConflict(choice, res, mi); });
      });
    }).catch(function(err){
      console.error("Sync failed:", err);
      if(!opts.silent) showToast(t("authSaveError"), "error");
      return { status: "error" };
    }).then(function(result){
      _syncBusy = null;
      setSyncing(false);
      renderSyncUI();
      // Public-table stats for the admin panel (57); own change/daily gate, never blocks sync.
      if(result.status !== "error" && result.status !== "conflict" && typeof writeUserStatsIfNeeded === "function") writeUserStatsIfNeeded();
      return result;
    });
    return _syncBusy;
  }

  // Sends pending changes only; resolves immediately when nothing is pending.
  function flushSync(opts){
    if(!userCache || !userCache.dirty) return Promise.resolve({ status: "noop" });
    return syncReconcile(opts);
  }

  // Marks everything pending and syncs (used after publishing a new shared-base version).
  function forceSyncNow(){
    if(!userCache) return Promise.resolve({ status: "noop" });
    _mutSeq++;
    userCache.dirty = true;
    return syncReconcile({});
  }

  function manualSync(){
    if(!authCurrentUser) return Promise.resolve();
    return syncReconcile({}).then(function(r){
      if(r.status === "pushed") showToast(t("syncDone"));
      else if(r.status === "pulled") showToast(t("syncPulled"));
      else if(r.status === "noop") showToast(t("syncUpToDate"));
    });
  }

  /* ------------------------------------------------------------
     Sync UI (account menu) + triggers
  ------------------------------------------------------------ */
  function formatSyncTime(ms){
    var d = new Date(ms);
    var loc = state.lang === "jp" ? "ja-JP" : (state.lang === "en" ? "en-US" : "zh-TW");
    try{ return d.toLocaleString(loc, { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }); }
    catch(e){ return d.toLocaleString(); }
  }
  function renderSyncUI(){
    var txt = document.getElementById("authMenuSyncText");
    var btn = document.getElementById("authMenuSyncBtn");
    if(!txt || !btn) return;
    btn.title = t("syncNow");
    btn.setAttribute("aria-label", t("syncNow"));
    if(!userCache){ txt.textContent = ""; return; }
    var s = userCache.lastSyncAt ? t("syncLast").replace("{t}", formatSyncTime(userCache.lastSyncAt)) : t("syncNever");
    if(userCache.dirty) s += " · " + t("syncPending");
    txt.textContent = s;
  }

  document.addEventListener("visibilitychange", function(){
    if(document.visibilityState === "hidden") flushSync({ silent: true });
  });
  window.addEventListener("pagehide", function(){ flushSync({ silent: true }); });
  var _syncBtnEl = document.getElementById("authMenuSyncBtn");
  if(_syncBtnEl) _syncBtnEl.addEventListener("click", function(ev){ ev.stopPropagation(); manualSync(); });
