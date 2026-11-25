"use strict";

  /* ============================================================
     SHARED BASE — 總表 versions, publish (admin), update banner
  ============================================================ */
  /* ------------------------------------------------------------
     SHARED BASE (總表/招式庫 — space-index): admin-published, live in
     Firestore instead of a static shipped file.

       sharedBase/space-index -> { latestVersion, latestNote, latestLabel, publishedAt }
       sharedBase/space-index/versions/{n} -> { version, note, versionLabel, publishedAt, chunks }
       sharedBase/space-index/versions/{n}/chunks/{i} -> { data }  // JSON of
                                  { tables, categories, tricks, infos, tags } split into pieces
                                  (tables = ids covered: t00/t01/t02/t03; absent in old versions = ["t00"])
                                  (older versions stored categories/tricks inline: still read)
       users/{uid}/meta/spaceIndexSync -> { viewingVersion, updatedAt }

     Every account (including guests with no Firestore identity at all) is
     pinned to a specific *version* of this space, not "whatever's newest" —
     that pin only ever advances when the person explicitly clicks the
     update banner's button (or, for the admin, the moment they publish).
     Their own added/modified/removed diff for space-index (same
     spaceData/space-index doc every other space already uses) is always
     computed against that pinned version, so publishing a new version can
     never silently disturb anything they've already added/changed/removed
     — the merge logic in mergeSpaceData/computeSpaceDiff doesn't change at
     all for this space, only where its "base" argument comes from does.
  ------------------------------------------------------------ */
  addStrings({
    zh:{ publishLabelInvalid:"版本名稱最多 32 字", publishNoteTooLong:"更新說明最多 500 字" },
    jp:{ publishLabelInvalid:"バージョン名は32文字までです", publishNoteTooLong:"更新メモは500文字までです" },
    en:{ publishLabelInvalid:"Version label: 32 characters max", publishNoteTooLong:"Changelog note: 500 characters max" }
  });
  var PUBLISH_LABEL_MAX = 32, PUBLISH_NOTE_MAX = 500; // keep in step with firestore.rules
  function sharedBaseRef(){ return fbStore.collection("sharedBase").doc(SHARED_BASE_DOC_ID); }

  function fetchSharedBasePointer(){
    return sharedBaseRef().get().then(function(snap){
      var d = snap.exists ? snap.data() : {};
      return {
        latestVersion: d.latestVersion || 0,
        latestNote: d.latestNote || "",
        latestLabel: d.latestLabel || "",
        publishedAt: d.publishedAt || null
      };
    }).catch(function(err){
      console.error("Shared base pointer fetch failed:", err);
      // failed:true lets the guest loader tell "read failed" from "version 0" (others still see 0).
      return { latestVersion: 0, latestNote: "", latestLabel: "", publishedAt: null, failed: true };
    });
  }

  function normalizeBaseSnapshot(version, d){
    return {
      version: version,
      tables: Array.isArray(d.tables) ? d.tables : ["t00"], // old snapshots: 總表 only
      categories: Array.isArray(d.categories) ? d.categories : [],
      tricks: Array.isArray(d.tricks) ? d.tricks : [],
      infos: Array.isArray(d.infos) ? d.infos : [],
      tags: Array.isArray(d.tags) ? d.tags : [],
      labels: normalizeLabels(d.labels)
    };
  }
  // Labels of the shared-base version fetched last (js/01 normalizeDB falls back to it when the
  // raw data being normalized carries no `labels`, e.g. cloud-merged data).
  var _sharedBaseLabels = {};
  // -> labels object for a raw db that has none of its own: the admin keeps the local (unpublished)
  // edits, everyone else gets the published ones.
  function labelsFallback(){
    if(typeof isAdminAccount === "function" && isAdminAccount() && typeof db !== "undefined" && db && db.labels) return db.labels;
    return _sharedBaseLabels;
  }
  function sharedVersionPath(version){ return "sharedBase/" + SHARED_BASE_DOC_ID + "/versions/" + version; }

  function fetchSharedBaseVersion(version){
    var cacheKey = SHARED_BASE_TABLE_ID + "@" + version;
    if(baseDataCache[cacheKey]){ _sharedBaseLabels = baseDataCache[cacheKey].labels || {}; return Promise.resolve(baseDataCache[cacheKey]); }
    if(!version){
      // Nothing published yet (version 0) — base is just empty, same as any
      // other space that's never had base content.
      var empty = emptyBase(0);
      baseDataCache[cacheKey] = empty;
      _sharedBaseLabels = {};
      return Promise.resolve(empty);
    }
    var done = function(normalized){
      baseDataCache[cacheKey] = normalized;
      _sharedBaseLabels = normalized.labels || {};
      return normalized;
    };
    // 1) device cache (js/51-base-cache.js), bad data is dropped; 2) network, then stored.
    return baseCacheGet(version).then(function(raw){
      if(raw === null) return null;
      try{
        var parsed = JSON.parse(raw);
        if(baseRawLooksValid(parsed)) return normalizeBaseSnapshot(version, parsed);
      }catch(e){ /* fall through */ }
      baseCacheDelete(version);
      return null;
    }).then(function(cached){
      if(cached) return done(cached);
      return fbStore.doc(sharedVersionPath(version)).get()
        .then(function(snap){
          var d = snap.exists ? snap.data() : {};
          if(typeof d.chunks === "number"){
            return readChunkedPayload(sharedVersionPath(version), d.chunks).then(function(str){
              if(str === null) throw new Error("shared base chunks missing");
              return { ver: d.version || version, raw: str, data: JSON.parse(str) };
            });
          }
          return { ver: d.version || version, raw: JSON.stringify(d), data: d }; // old inline layout
        })
        .then(function(got){
          var normalized = normalizeBaseSnapshot(got.ver, got.data);
          if(baseRawLooksValid(got.data)) baseCachePut(version, got.raw);
          return done(normalized);
        })
        .catch(function(err){
          console.error("Shared base version fetch failed:", err);
          // Deliberately not cached, so a transient failure can be retried
          // (e.g. on the next render) instead of getting stuck on "empty".
          return emptyBase(version);
        });
    });
  }

  function fetchUserViewingVersion(uid){
    return fbStore.collection("users").doc(uid).collection("meta").doc("spaceIndexSync").get()
      .then(function(snap){
        // null (not 0) specifically means "never set" — distinguishes a
        // brand-new account (which should start pinned at *today's*
        // latest, not silently at version 0 with a huge backlog of
        // "missed" update notes) from an account genuinely still on v0.
        return (snap.exists && typeof snap.data().viewingVersion === "number") ? snap.data().viewingVersion : null;
      })
      .catch(function(err){
        console.error("Viewing-version fetch failed:", err);
        return null;
      });
  }

  function saveUserViewingVersion(uid, version){
    return fbStore.collection("users").doc(uid).collection("meta").doc("spaceIndexSync").set({
      viewingVersion: version,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  }

  // Resolves (and caches for the rest of this page session) which shared-base
  // version this account's space-index diff should be computed against.
  // First-ever call for an account with no stored pin yet adopts whatever
  // is currently latest (so a new sign-up doesn't immediately see a stack
  // of "missed updates" for versions that predate their account).
  function ensureViewingVersionResolved(uid){
    if(_currentViewingVersion !== null && _lastSeenPointer) return Promise.resolve(_currentViewingVersion);
    return fetchSharedBasePointer().then(function(pointer){
      _lastSeenPointer = pointer;
      return fetchUserViewingVersion(uid).then(function(viewingVersion){
        if(viewingVersion === null){
          _currentViewingVersion = pointer.latestVersion;
          return saveUserViewingVersion(uid, pointer.latestVersion).then(function(){ return _currentViewingVersion; });
        }
        _currentViewingVersion = viewingVersion;
        return _currentViewingVersion;
      });
    });
  }

  // Not-logged-in visitors have no Firestore identity to pin a version
  // against (and per spec, only ever see it read-only) — always show
  // whatever's currently latest, straight into db.categories/db.tricks,
  // replacing only the space-index slice (every other space's content, and
  // any of the guest's own local-only tricks that also happen to live in
  // other spaces, is left untouched).
  function loadGuestSpaceIndexBase(){
    return fetchSharedBasePointer().then(function(pointer){
      _lastSeenPointer = pointer;
      var ver = pointer.latestVersion;
      // Pointer unreadable (offline): fall back to the last version this device saw.
      if(pointer.failed) ver = lastBaseVersion();
      if(!ver) return;
      return fetchSharedBaseVersion(ver).then(function(base){
        if(!baseDataCache[SHARED_BASE_TABLE_ID + "@" + ver]) return; // fetch failed: keep what we have
        if(!pointer.failed) rememberBaseVersion(ver);
        // Replace only the tables this snapshot covers (old versions: t00 only).
        var covered = base.tables || ["t00"];
        var otherCats = db.categories.filter(function(c){ return covered.indexOf(c.spaceId) === -1; });
        var priorTrickIds = {};
        covered.forEach(function(sid){ tricksForSpace(sid).forEach(function(tr){ priorTrickIds[tr.id] = true; }); });
        var otherTricks = db.tricks.filter(function(tr){ return !priorTrickIds[tr.id]; });
        var otherInfos = (db.infos || []).filter(function(n){ return covered.indexOf(n.spaceId) === -1; });
        db.categories = otherCats.concat(base.categories);
        db.tricks = otherTricks.concat(base.tricks);
        db.infos = otherInfos.concat(base.infos);
        // Guest: published base wins for values and order; own-only tags are kept after.
        db.tags = mergeTagLists(db.tags, base.tags, true);
        db.labels = base.labels || {};
        db = normalizeDB(db);
      });
    }).catch(function(err){ console.error("Guest shared-base load failed:", err); });
  }

  /* ------------------------------------------------------------
     Publishing new 總表 versions (admin only) + the update banner
     everyone else sees once they're behind.
  ------------------------------------------------------------ */
  // Pure: the snapshot to publish from a db object — all shared tables + tags.
  function buildPublishSnapshot(data){
    var cats = [], infos = [], tricks = {};
    SHARED_BASE_TABLE_IDS.forEach(function(sid){
      var cont = {}; cont[sid] = true;
      data.categories.forEach(function(c){ if(c.spaceId === sid){ cats.push(c); cont[c.id] = true; } });
      (data.infos || []).forEach(function(n){ if(n.spaceId === sid) infos.push(n); });
      data.tricks.forEach(function(tr){ if((tr.categoryIds || []).some(function(cid){ return cont[cid]; })) tricks[tr.id] = tr; });
    });
    return { tables: SHARED_BASE_TABLE_IDS.slice(), categories: cats, tricks: objVals(tricks), infos: infos, tags: data.tags || [], labels: normalizeLabels(data.labels) };
  }
  // Pure: -> null when ok, else the i18n key of the problem.
  function validatePublishInput(note, label){
    if(!note) return "publishNoteRequired";
    if(note.length > PUBLISH_NOTE_MAX) return "publishNoteTooLong";
    if(label.length > PUBLISH_LABEL_MAX) return "publishLabelInvalid";
    return null;
  }

  // Resolves { ok:true, version, label } | { ok:false }. `label` = free-text version name
  // (e.g. "1.0.3", optional); the integer version still orders everything.
  function publishSpaceIndexUpdate(note, label){
    if(!isAdminAccount()) return Promise.resolve({ ok: false });
    note = (note || "").trim();
    label = (label == null ? "" : String(label)).trim();
    var bad = validatePublishInput(note, label);
    if(bad){ showToast(t(bad), "error"); return Promise.resolve({ ok: false }); }
    var uid = authCurrentUser.uid;
    var result = { ok: false };
    setSyncing(true);
    return fetchSharedBasePointer().then(function(pointer){
      var newVersion = (pointer.latestVersion || 0) + 1;
      // The admin's own current, fully-merged content of 00/01/02 (base + their
      // not-yet-published diff) becomes the new base wholesale.
      var snapshot = buildPublishSnapshot(db);
      var ops = buildChunkedOps(sharedVersionPath(newVersion), JSON.stringify(snapshot),
        { version: newVersion, note: note, versionLabel: label }, 0, "publishedAt");
      ops.push({ kind: "set", path: "sharedBase/" + SHARED_BASE_DOC_ID, ts: "publishedAt", bytes: 500,
        data: { latestVersion: newVersion, latestNote: note, latestLabel: label } });
      return commitOps(ops).then(function(){
        // Prime the cache with exactly what was just written so the diff
        // save below (which needs this version's base) doesn't need a
        // network round-trip to read back what we just sent.
        baseDataCache[SHARED_BASE_TABLE_ID + "@" + newVersion] = normalizeBaseSnapshot(newVersion, snapshot);
        baseCachePut(newVersion, JSON.stringify(snapshot)); // overwrite any stale device copy
        rememberBaseVersion(newVersion);
        _lastSeenPointer = { latestVersion: newVersion, latestNote: note, latestLabel: label, publishedAt: null };
        _currentViewingVersion = newVersion;
        result = { ok: true, version: newVersion, label: label };
        return saveUserViewingVersion(uid, newVersion);
      }).then(function(){
        // The admin's diff against this brand-new base is now empty by
        // construction — push it so the cloud reflects that too.
        return forceSyncNow();
      });
    }).catch(function(err){
      console.error("Publish failed:", err);
      if(!result.ok) showToast(t("publishError"), "error");
    }).then(function(){
      setSyncing(false);
      return result;
    });
  }

  function tsToMs(v){
    if(v && typeof v.toMillis === "function") return v.toMillis();
    return typeof v === "number" ? v : null;
  }
  // -> Promise<{ latestVersion, latestLabel, latestNote, publishedAt (ms or null) }>
  function getPublishedPointer(){
    return fetchSharedBasePointer().then(function(p){
      return { latestVersion: p.latestVersion, latestLabel: p.latestLabel, latestNote: p.latestNote, publishedAt: tsToMs(p.publishedAt) };
    });
  }
  // Newest first, at most `limit` (default 20). Reads version header docs only, never chunks.
  function listPublishedVersions(limit){
    limit = limit > 0 ? Math.floor(limit) : 20;
    return fetchSharedBasePointer().then(function(p){
      var vs = [];
      for(var v = p.latestVersion; v >= 1 && vs.length < limit; v--) vs.push(v);
      return Promise.all(vs.map(function(v){
        return fbStore.doc(sharedVersionPath(v)).get().then(function(snap){
          if(!snap.exists) return null;
          var d = snap.data();
          return { version: v, label: d.versionLabel || "", note: d.note || "", publishedAt: tsToMs(d.publishedAt) };
        }).catch(function(){ return null; });
      }));
    }).then(function(list){ return list.filter(Boolean); });
  }

  function fetchMissedVersionNotes(fromVersionExclusive, toVersionInclusive){
    var versions = [];
    for(var v = fromVersionExclusive + 1; v <= toVersionInclusive; v++) versions.push(v);
    return Promise.all(versions.map(function(v){
      return sharedBaseRef().collection("versions").doc(String(v)).get()
        .then(function(snap){
          var d = snap.exists ? snap.data() : {};
          return { version: v, note: d.note || "" };
        })
        .catch(function(){ return { version: v, note: "" }; });
    }));
  }

  function hideBaseUpdateBanner(){
    var el = document.getElementById("baseUpdateBanner");
    if(el) el.hidden = true;
  }

  function showBaseUpdateBanner(fromVersionExclusive, toVersionInclusive){
    return fetchMissedVersionNotes(fromVersionExclusive, toVersionInclusive).then(function(notes){
      var listEl = document.getElementById("baseUpdateNotes");
      listEl.innerHTML = "";
      notes.forEach(function(item){
        var row = document.createElement("div");
        row.className = "base-update-note-row";
        var v = document.createElement("span");
        v.className = "base-update-version";
        v.textContent = "v" + item.version;
        row.appendChild(v);
        row.appendChild(document.createTextNode(item.note || ""));
        listEl.appendChild(row);
      });
      document.getElementById("baseUpdateBanner").hidden = false;
    });
  }

  // Called after any successful login-triggered load — shows the banner iff
  // this account is genuinely behind the latest published version. A no-op
  // (and safe to call unconditionally) for the admin whenever they haven't
  // published anything newer than what they're already looking at.
  function maybeShowBaseUpdateBanner(){
    if(!authCurrentUser || !_lastSeenPointer || _currentViewingVersion === null){ hideBaseUpdateBanner(); return; }
    if(_lastSeenPointer.latestVersion > _currentViewingVersion){
      showBaseUpdateBanner(_currentViewingVersion, _lastSeenPointer.latestVersion);
    } else {
      hideBaseUpdateBanner();
    }
  }

  // The banner's own "立即更新" button — advances this account's pin to
  // latest and re-merges, all without touching a single item the person
  // added/modified/removed themselves (see the SHARED BASE comment above).
  function applyBaseIndexUpdate(){
    if(!authCurrentUser || !_lastSeenPointer) return;
    var uid = authCurrentUser.uid;
    var newVersion = _lastSeenPointer.latestVersion;
    setSyncing(true);
    // Push pending local changes first, so reloading from the cloud cannot drop them.
    flushSync({}).then(function(){
      if(userCache && userCache.dirty) throw new Error("unsynced local changes");
      return saveUserViewingVersion(uid, newVersion);
    }).then(function(){
      _currentViewingVersion = newVersion;
      return loadMergedDBFromCloud(uid);
    }).then(function(res){
      applyCloudDb(res);
      hideBaseUpdateBanner();
      showToast(t("baseUpdateApplied"));
    }).catch(function(err){
      console.error("Base update apply failed:", err);
      showToast(t("authLoadError"), "error");
    }).then(function(){
      setSyncing(false);
    });
  }

  /* ------------------------------------------------------------
     Publish modal (admin only) + update banner
  ------------------------------------------------------------ */
  function _on(id, fn){ var el = document.getElementById(id); if(el) el.addEventListener("click", fn); }
  _on("baseUpdateNowBtn", applyBaseIndexUpdate);
  _on("baseUpdateDismissBtn", hideBaseUpdateBanner);
