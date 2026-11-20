"use strict";

  /* ============================================================
     SHARED BASE — 總表 versions, publish (admin), update banner
  ============================================================ */
  /* ------------------------------------------------------------
     SHARED BASE (總表/招式庫 — space-index): admin-published, live in
     Firestore instead of a static shipped file.

       sharedBase/space-index -> { latestVersion, latestNote, publishedAt }
       sharedBase/space-index/versions/{n} -> { version, note, publishedAt, chunks }
       sharedBase/space-index/versions/{n}/chunks/{i} -> { data }  // JSON of
                                  { categories, tricks, infos, tags } split into pieces
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
  function sharedBaseRef(){ return fbStore.collection("sharedBase").doc(SHARED_BASE_DOC_ID); }

  function fetchSharedBasePointer(){
    return sharedBaseRef().get().then(function(snap){
      var d = snap.exists ? snap.data() : {};
      return {
        latestVersion: d.latestVersion || 0,
        latestNote: d.latestNote || "",
        publishedAt: d.publishedAt || null
      };
    }).catch(function(err){
      console.error("Shared base pointer fetch failed:", err);
      return { latestVersion: 0, latestNote: "", publishedAt: null };
    });
  }

  function normalizeBaseSnapshot(version, d){
    return {
      version: version,
      categories: Array.isArray(d.categories) ? d.categories : [],
      tricks: Array.isArray(d.tricks) ? d.tricks : [],
      infos: Array.isArray(d.infos) ? d.infos : [],
      tags: Array.isArray(d.tags) ? d.tags : []
    };
  }
  function sharedVersionPath(version){ return "sharedBase/" + SHARED_BASE_DOC_ID + "/versions/" + version; }

  function fetchSharedBaseVersion(version){
    var cacheKey = SHARED_BASE_TABLE_ID + "@" + version;
    if(baseDataCache[cacheKey]) return Promise.resolve(baseDataCache[cacheKey]);
    if(!version){
      // Nothing published yet (version 0) — base is just empty, same as any
      // other space that's never had base content.
      var empty = emptyBase(0);
      baseDataCache[cacheKey] = empty;
      return Promise.resolve(empty);
    }
    return fbStore.doc(sharedVersionPath(version)).get()
      .then(function(snap){
        var d = snap.exists ? snap.data() : {};
        if(typeof d.chunks === "number"){
          return readChunkedPayload(sharedVersionPath(version), d.chunks).then(function(str){
            if(str === null) throw new Error("shared base chunks missing");
            return normalizeBaseSnapshot(d.version || version, JSON.parse(str));
          });
        }
        return normalizeBaseSnapshot(d.version || version, d); // old inline layout
      })
      .then(function(normalized){
        baseDataCache[cacheKey] = normalized;
        return normalized;
      })
      .catch(function(err){
        console.error("Shared base version fetch failed:", err);
        // Deliberately not cached, so a transient failure can be retried
        // (e.g. on the next render) instead of getting stuck on "empty".
        return emptyBase(version);
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
      if(!pointer.latestVersion) return;
      return fetchSharedBaseVersion(pointer.latestVersion).then(function(base){
        var otherCats = db.categories.filter(function(c){ return c.spaceId !== SHARED_BASE_TABLE_ID; });
        var priorTrickIds = {};
        tricksForSpace(SHARED_BASE_TABLE_ID).forEach(function(tr){ priorTrickIds[tr.id] = true; });
        var otherTricks = db.tricks.filter(function(tr){ return !priorTrickIds[tr.id]; });
        var otherInfos = (db.infos || []).filter(function(n){ return n.spaceId !== SHARED_BASE_TABLE_ID; });
        db.categories = otherCats.concat(base.categories);
        db.tricks = otherTricks.concat(base.tricks);
        db.infos = otherInfos.concat(base.infos);
        var tagMap = {};
        (db.tags || []).concat(base.tags).forEach(function(g){ tagMap[g.id] = g; });
        db.tags = objVals(tagMap);
        db = normalizeDB(db);
      });
    }).catch(function(err){ console.error("Guest shared-base load failed:", err); });
  }

  /* ------------------------------------------------------------
     Publishing new 總表 versions (admin only) + the update banner
     everyone else sees once they're behind.
  ------------------------------------------------------------ */
  function publishSpaceIndexUpdate(note){
    if(!isAdminAccount()) return Promise.resolve();
    note = (note || "").trim();
    if(!note){ showToast(t("publishNoteRequired"), "error"); return Promise.resolve(); }
    var uid = authCurrentUser.uid;
    setSyncing(true);
    return fetchSharedBasePointer().then(function(pointer){
      var newVersion = (pointer.latestVersion || 0) + 1;
      // The admin's own current, fully-merged space-index content (base +
      // their not-yet-published diff) becomes the new base wholesale —
      // "publishing" is exactly that: promoting the admin's working diff
      // into everyone else's shared base.
      var snapshot = {
        categories: categoriesForSpace(SHARED_BASE_TABLE_ID),
        tricks: tricksForSpace(SHARED_BASE_TABLE_ID),
        infos: infosForSpace(SHARED_BASE_TABLE_ID),
        tags: db.tags
      };
      var ops = buildChunkedOps(sharedVersionPath(newVersion), JSON.stringify(snapshot),
        { version: newVersion, note: note }, 0, "publishedAt");
      ops.push({ kind: "set", path: "sharedBase/" + SHARED_BASE_DOC_ID, ts: "publishedAt", bytes: 500,
        data: { latestVersion: newVersion, latestNote: note } });
      return commitOps(ops).then(function(){
        // Prime the cache with exactly what was just written so the diff
        // save below (which needs this version's base) doesn't need a
        // network round-trip to read back what we just sent.
        baseDataCache[SHARED_BASE_TABLE_ID + "@" + newVersion] = normalizeBaseSnapshot(newVersion, snapshot);
        _lastSeenPointer = { latestVersion: newVersion, latestNote: note, publishedAt: null };
        _currentViewingVersion = newVersion;
        return saveUserViewingVersion(uid, newVersion);
      }).then(function(){
        // The admin's diff against this brand-new base is now empty by
        // construction — push it so the cloud reflects that too.
        return forceSyncNow();
      });
    }).catch(function(err){
      console.error("Publish failed:", err);
      showToast(t("publishError"), "error");
    }).then(function(){
      setSyncing(false);
    });
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
    document.getElementById("baseUpdateBanner").hidden = true;
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
  document.getElementById("publishUpdateBtn").addEventListener("click", function(){
    document.getElementById("publishNoteInput").value = "";
    document.getElementById("publishModalOverlay").classList.add("show");
    document.getElementById("publishNoteInput").focus();
  });
  document.getElementById("publishCancelBtn").addEventListener("click", function(){
    document.getElementById("publishModalOverlay").classList.remove("show");
  });
  document.getElementById("publishConfirmBtn").addEventListener("click", function(){
    var note = document.getElementById("publishNoteInput").value;
    if(!note.trim()){ showToast(t("publishNoteRequired"), "error"); return; }
    publishSpaceIndexUpdate(note).then(function(){
      document.getElementById("publishModalOverlay").classList.remove("show");
      showToast(t("publishSuccess"));
      renderSpaceRail();
      renderColumns();
    });
  });
  document.getElementById("baseUpdateNowBtn").addEventListener("click", applyBaseIndexUpdate);
  document.getElementById("baseUpdateDismissBtn").addEventListener("click", hideBaseUpdateBanner);
