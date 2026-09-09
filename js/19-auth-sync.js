"use strict";

  /* ============================================================
     AUTH + CLOUD SYNC (base data + per-space diff)
     ------------------------------------------------------------
     Data model recap: `db` (see 01-data-model.js) stays exactly the same
     in-memory shape as before — { categories, tricks, spaces } flat
     arrays — every render/modal/etc. function keeps working on it
     unchanged. This file only concerns itself with how that shape gets
     serialized to/from Firestore once someone is logged in.

     BASE DATA — data/base/{spaceId}.json (one file per *built-in* space
     other than space-index — see DEFAULT_SPACES in 01-data-model.js), each
     { version, categories, tricks }. Ships with the app and updates
     whenever Cookie edits those files — see data/base/README.md.
     space-index (總表/招式庫) is the one exception: its base isn't a static
     file at all, but a live, versioned document tree in Firestore that only
     ADMIN_UID can publish new versions of — see the SHARED BASE section
     further down. Custom (user-created) spaces have no base at all; their
     base is treated as empty. Custom (user-created) spaces have
     no base file; their base is treated as empty.

     USER DIFF — Firestore, split by space (not one big document):
       users/{uid}/spaceData/{spaceId} -> {
         baseVersion,
         added:    { categories:[...], tricks:[...] },
         modified: { categories:[...], tricks:[...] },
         removed:  { categoryIds:[...], trickIds:[...] },
         updatedAt
       }
       users/{uid}/meta/spaces -> { spaces:[...db.spaces...], updatedAt }
         (the shelf list itself — icons/names/order/viewMode, including
         any custom spaces — is small enough to store whole, not diffed)

     Every save recomputes each space's diff from scratch by comparing
     the *current* `db` against that space's base data — nothing is
     patched incrementally, so there's no separate tombstone bookkeeping
     to maintain across sessions: an item merely absent from "current"
     but present in "base" already reads as removed.

     A trick can legitimately belong to categories in more than one space
     at once (e.g. tagged into both 招式庫 and 收藏 via the drawer's
     quick-toggle bucket) — such tricks are simply written into every
     space's diff they currently touch. That's intentional duplication
     (Firestore has no cross-document joins), not a bug; merging back
     just unions by id, and the copies are always identical since they
     all come from the same in-memory trick object.
  ============================================================ */

  var BASE_DATA_DIR = "data/base/";
  var DEFAULT_SPACE_IDS = DEFAULT_SPACES.map(function(s){ return s.id; });
  // The one built-in space (招式庫/總表) whose "base" isn't a static file
  // shipped with the app, but a live document tree in Firestore that only
  // ADMIN_UID can publish new versions of — see the SHARED BASE section
  // further down for the full design.
  var SHARED_BASE_SPACE_ID = "space-index";

  var authCurrentUser = null;
  var _authFirstStateSeen = false; // avoids reloading local data before we know anything, on the very first (logged-out) check at page load
  var _cloudSaveTimer = null;
  var CLOUD_SAVE_DEBOUNCE_MS = 600;
  var baseDataCache = {}; // spaceId -> {version, categories, tricks} (static-file spaces); "space-index@N" -> same shape (shared-base versions)
  // This session's resolved view of the shared 總表: which version this
  // account is currently pinned to (its diff is computed against this
  // exact snapshot, not whatever the latest published version happens to
  // be), and the latest pointer doc so the update banner knows if it's
  // behind. Both are populated by ensureViewingVersionResolved()/
  // fetchSharedBasePointer() and read by maybeShowBaseUpdateBanner().
  var _currentViewingVersion = null;
  var _lastSeenPointer = null;

  function isLoggedIn(){ return !!authCurrentUser; }
  function isAdminAccount(){ return !!(authCurrentUser && authCurrentUser.uid === ADMIN_UID); }

  /* ------------------------------------------------------------
     Base data loading (cached per space id for the page's lifetime)
  ------------------------------------------------------------ */
  function fetchBaseSpaceData(spaceId){
    if(baseDataCache[spaceId]) return Promise.resolve(baseDataCache[spaceId]);
    if(DEFAULT_SPACE_IDS.indexOf(spaceId) === -1 || spaceId === SHARED_BASE_SPACE_ID){
      // Custom space (no shipped base file) OR the shared-base space, which
      // is fetched through fetchSharedBaseVersion()/ensureViewingVersionResolved()
      // instead — this function only ever serves the *other* built-in spaces.
      var empty = { version: 0, categories: [], tricks: [] };
      if(spaceId !== SHARED_BASE_SPACE_ID) baseDataCache[spaceId] = empty;
      return Promise.resolve(empty);
    }
    return fetch(BASE_DATA_DIR + spaceId + ".json")
      .then(function(res){ return res.ok ? res.json() : { version: 0, categories: [], tricks: [] }; })
      .catch(function(){ return { version: 0, categories: [], tricks: [] }; })
      .then(function(data){
        var normalized = {
          version: data.version || 0,
          categories: Array.isArray(data.categories) ? data.categories : [],
          tricks: Array.isArray(data.tricks) ? data.tricks : []
        };
        baseDataCache[spaceId] = normalized;
        return normalized;
      });
  }

  /* ------------------------------------------------------------
     SHARED BASE (總表/招式庫 — space-index): admin-published, live in
     Firestore instead of a static shipped file.

       sharedBase/space-index -> { latestVersion, latestNote, publishedAt }
       sharedBase/space-index/versions/{n} -> { version, categories, tricks,
                                                 note, publishedAt }
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
  function sharedBaseRef(){ return fbStore.collection("sharedBase").doc(SHARED_BASE_SPACE_ID); }

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

  function fetchSharedBaseVersion(version){
    var cacheKey = SHARED_BASE_SPACE_ID + "@" + version;
    if(baseDataCache[cacheKey]) return Promise.resolve(baseDataCache[cacheKey]);
    if(!version){
      // Nothing published yet (version 0) — base is just empty, same as any
      // other space that's never had base content.
      var empty = { version: 0, categories: [], tricks: [] };
      baseDataCache[cacheKey] = empty;
      return Promise.resolve(empty);
    }
    return sharedBaseRef().collection("versions").doc(String(version)).get()
      .then(function(snap){
        var d = snap.exists ? snap.data() : {};
        var normalized = {
          version: d.version || version,
          categories: Array.isArray(d.categories) ? d.categories : [],
          tricks: Array.isArray(d.tricks) ? d.tricks : []
        };
        baseDataCache[cacheKey] = normalized;
        return normalized;
      })
      .catch(function(err){
        console.error("Shared base version fetch failed:", err);
        // Deliberately not cached, so a transient failure can be retried
        // (e.g. on the next render) instead of getting stuck on "empty".
        return { version: version, categories: [], tricks: [] };
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
        var otherCats = db.categories.filter(function(c){ return c.spaceId !== SHARED_BASE_SPACE_ID; });
        var priorTrickIds = {};
        tricksForSpace(SHARED_BASE_SPACE_ID).forEach(function(tr){ priorTrickIds[tr.id] = true; });
        var otherTricks = db.tricks.filter(function(tr){ return !priorTrickIds[tr.id]; });
        db.categories = otherCats.concat(base.categories);
        db.tricks = otherTricks.concat(base.tricks);
        db = normalizeDB(db);
      });
    }).catch(function(err){ console.error("Guest shared-base load failed:", err); });
  }

  /* ------------------------------------------------------------
     Diff computation (current db -> per-space diff vs its base)
  ------------------------------------------------------------ */
  function allKnownSpaceIds(){
    var ids = DEFAULT_SPACE_IDS.slice();
    db.spaces.forEach(function(s){ if(ids.indexOf(s.id) === -1) ids.push(s.id); });
    return ids;
  }
  function categoriesForSpace(spaceId){
    return db.categories.filter(function(c){ return c.spaceId === spaceId; });
  }
  function tricksForSpace(spaceId){
    var catIds = {};
    categoriesForSpace(spaceId).forEach(function(c){ catIds[c.id] = true; });
    return db.tricks.filter(function(t){
      return t.categoryIds.some(function(cid){ return catIds[cid]; });
    });
  }
  function deepEqual(a, b){ return JSON.stringify(a) === JSON.stringify(b); }

  function computeSpaceDiff(spaceId, base){
    var baseCatMap = {}; base.categories.forEach(function(c){ baseCatMap[c.id] = c; });
    var baseTrickMap = {}; base.tricks.forEach(function(t){ baseTrickMap[t.id] = t; });

    var curCats = categoriesForSpace(spaceId);
    var curTricks = tricksForSpace(spaceId);
    var curCatIds = {}; curCats.forEach(function(c){ curCatIds[c.id] = true; });
    var curTrickIds = {}; curTricks.forEach(function(t){ curTrickIds[t.id] = true; });

    var addedCats = [], modifiedCats = [], removedCatIds = [];
    curCats.forEach(function(c){
      if(!baseCatMap[c.id]) addedCats.push(c);
      else if(!deepEqual(c, baseCatMap[c.id])) modifiedCats.push(c);
    });
    Object.keys(baseCatMap).forEach(function(id){ if(!curCatIds[id]) removedCatIds.push(id); });

    var addedTricks = [], modifiedTricks = [], removedTrickIds = [];
    curTricks.forEach(function(t){
      if(!baseTrickMap[t.id]) addedTricks.push(t);
      else if(!deepEqual(t, baseTrickMap[t.id])) modifiedTricks.push(t);
    });
    Object.keys(baseTrickMap).forEach(function(id){ if(!curTrickIds[id]) removedTrickIds.push(id); });

    return {
      baseVersion: base.version,
      added: { categories: addedCats, tricks: addedTricks },
      modified: { categories: modifiedCats, tricks: modifiedTricks },
      removed: { categoryIds: removedCatIds, trickIds: removedTrickIds }
    };
  }

  /* ------------------------------------------------------------
     Merge (base + one space's diff -> that space's live categories/tricks)
  ------------------------------------------------------------ */
  function mergeSpaceData(base, diff){
    var catMap = {}; base.categories.forEach(function(c){ catMap[c.id] = c; });
    var trickMap = {}; base.tricks.forEach(function(t){ trickMap[t.id] = t; });
    if(diff){
      (diff.added && diff.added.categories || []).concat(diff.modified && diff.modified.categories || [])
        .forEach(function(c){ catMap[c.id] = c; });
      (diff.removed && diff.removed.categoryIds || []).forEach(function(id){ delete catMap[id]; });

      (diff.added && diff.added.tricks || []).concat(diff.modified && diff.modified.tricks || [])
        .forEach(function(t){ trickMap[t.id] = t; });
      (diff.removed && diff.removed.trickIds || []).forEach(function(id){ delete trickMap[id]; });
    }
    return { categories: objVals(catMap), tricks: objVals(trickMap) };
  }

  function mergeAllSpaces(spaceIds, baseMap, diffMap){
    var allCats = {}, allTricks = {};
    spaceIds.forEach(function(sid){
      var merged = mergeSpaceData(baseMap[sid], diffMap[sid]);
      merged.categories.forEach(function(c){ allCats[c.id] = c; });
      merged.tricks.forEach(function(t){ allTricks[t.id] = t; });
    });
    return { categories: objVals(allCats), tricks: objVals(allTricks) };
  }

  /* ------------------------------------------------------------
     Save: current db -> per-space diff docs + spaces meta doc
  ------------------------------------------------------------ */
  function saveDiffToCloud(){
    if(!authCurrentUser) return Promise.resolve();
    var uid = authCurrentUser.uid;
    var spaceIds = allKnownSpaceIds();
    var userRef = fbStore.collection("users").doc(uid);
    return ensureViewingVersionResolved(uid).then(function(viewingVersion){
      var otherSpaceIds = spaceIds.filter(function(id){ return id !== SHARED_BASE_SPACE_ID; });
      return Promise.all(otherSpaceIds.map(fetchBaseSpaceData)).then(function(otherBases){
        return fetchSharedBaseVersion(viewingVersion).then(function(indexBase){
          var baseMap = {}; otherSpaceIds.forEach(function(id, i){ baseMap[id] = otherBases[i]; });
          baseMap[SHARED_BASE_SPACE_ID] = indexBase;
          var batch = fbStore.batch();
          spaceIds.forEach(function(sid){
            var diff = computeSpaceDiff(sid, baseMap[sid]);
            diff.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
            batch.set(userRef.collection("spaceData").doc(sid), diff);
          });
          batch.set(userRef.collection("meta").doc("spaces"), {
            spaces: db.spaces,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
          });
          return batch.commit();
        });
      });
    }).catch(function(err){
      console.error("Cloud save failed:", err);
      showToast(t("authSaveError"), "error");
    });
  }

  function queueCloudSave(){
    if(_cloudSaveTimer) clearTimeout(_cloudSaveTimer);
    _cloudSaveTimer = setTimeout(function(){
      _cloudSaveTimer = null;
      saveDiffToCloud();
    }, CLOUD_SAVE_DEBOUNCE_MS);
  }

  /* ------------------------------------------------------------
     Load: per-space diff docs + spaces meta doc -> merged db
  ------------------------------------------------------------ */
  function loadMergedDBFromCloud(uid){
    var userRef = fbStore.collection("users").doc(uid);
    return userRef.collection("spaceData").get().then(function(snap){
      var diffMap = {};
      snap.forEach(function(doc){ diffMap[doc.id] = doc.data(); });
      var spaceIds = Object.keys(diffMap);
      DEFAULT_SPACE_IDS.forEach(function(id){ if(spaceIds.indexOf(id) === -1) spaceIds.push(id); });

      return userRef.collection("meta").doc("spaces").get().then(function(metaSnap){
        var spacesList = (metaSnap.exists && Array.isArray(metaSnap.data().spaces) && metaSnap.data().spaces.length)
          ? metaSnap.data().spaces
          : DEFAULT_SPACES.map(function(s){ return { id:s.id, icon:s.icon, name:s.name, viewMode:s.viewMode }; });

        return ensureViewingVersionResolved(uid).then(function(viewingVersion){
          var otherSpaceIds = spaceIds.filter(function(id){ return id !== SHARED_BASE_SPACE_ID; });
          return Promise.all(otherSpaceIds.map(fetchBaseSpaceData)).then(function(otherBases){
            return fetchSharedBaseVersion(viewingVersion).then(function(indexBase){
              var baseMap = {}; otherSpaceIds.forEach(function(id, i){ baseMap[id] = otherBases[i]; });
              baseMap[SHARED_BASE_SPACE_ID] = indexBase;
              var merged = mergeAllSpaces(spaceIds, baseMap, diffMap);
              return normalizeDB({ categories: merged.categories, tricks: merged.tricks, spaces: spacesList });
            });
          });
        });
      });
    });
  }

  // After swapping `db` for a freshly-loaded object (cloud or local),
  // make sure state.activeSpace still points at a space that exists.
  function reconcileActiveSpaceAfterSwap(){
    if(!db.spaces.some(function(s){ return s.id === state.activeSpace; })){
      state.activeSpace = db.spaces[0].id;
    }
    state.path = [];
    state.detailTrickId = null;
    if(typeof closeDrawer === "function") closeDrawer();
  }

  function setSyncing(on){
    document.getElementById("authWidget").classList.toggle("syncing", !!on);
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
        version: newVersion,
        categories: categoriesForSpace(SHARED_BASE_SPACE_ID),
        tricks: tricksForSpace(SHARED_BASE_SPACE_ID),
        note: note,
        publishedAt: firebase.firestore.FieldValue.serverTimestamp()
      };
      var batch = fbStore.batch();
      batch.set(sharedBaseRef().collection("versions").doc(String(newVersion)), snapshot);
      batch.set(sharedBaseRef(), {
        latestVersion: newVersion,
        latestNote: note,
        publishedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      return batch.commit().then(function(){
        // Prime the cache with exactly what was just written so the diff
        // save below (which needs this version's base) doesn't need a
        // network round-trip to read back what we just sent.
        baseDataCache[SHARED_BASE_SPACE_ID + "@" + newVersion] = {
          version: newVersion, categories: snapshot.categories, tricks: snapshot.tricks
        };
        _lastSeenPointer = { latestVersion: newVersion, latestNote: note, publishedAt: null };
        _currentViewingVersion = newVersion;
        return saveUserViewingVersion(uid, newVersion);
      }).then(function(){
        // The admin's diff against this brand-new base is now empty by
        // construction (the base literally *is* what they just had) — this
        // save just makes that explicit in Firestore too.
        return saveDiffToCloud();
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
    saveUserViewingVersion(uid, newVersion).then(function(){
      _currentViewingVersion = newVersion;
      return loadMergedDBFromCloud(uid);
    }).then(function(merged){
      db = merged;
      reconcileActiveSpaceAfterSwap();
      hideBaseUpdateBanner();
      render();
      showToast(t("baseUpdateApplied"));
    }).catch(function(err){
      console.error("Base update apply failed:", err);
      showToast(t("authLoadError"), "error");
    }).then(function(){
      setSyncing(false);
    });
  }

  /* ------------------------------------------------------------
     Sign-in / sign-out
  ------------------------------------------------------------ */
  function authLogin(){
    var provider = new firebase.auth.GoogleAuthProvider();
    fbAuth.signInWithPopup(provider).catch(function(err){
      console.error("Sign-in failed:", err);
      if(err && err.code === "auth/popup-closed-by-user") return;
      showToast(t("authLoginError"), "error");
    });
  }

  function authLogout(){
    closeAuthMenu();
    fbAuth.signOut().then(function(){
      showToast(t("authLoggingOut"));
    }).catch(function(err){ console.error("Sign-out failed:", err); });
  }

  function authUpdateNickname(newName){
    newName = (newName || "").trim();
    if(!newName){ showToast(t("authNicknameEmpty"), "error"); return; }
    if(!authCurrentUser) return;
    var editBtn = document.getElementById("authMenuEditBtn");
    editBtn.disabled = true;
    authCurrentUser.updateProfile({ displayName: newName }).then(function(){
      authCurrentUser.displayName = newName; // compat SDK updates this too, but set explicitly to be safe
      closeNicknameEdit();
      renderAuthUI();
      showToast(t("authNicknameUpdated"));
    }).catch(function(err){
      console.error("Nickname update failed:", err);
      showToast(t("authNicknameError"), "error");
    }).then(function(){
      editBtn.disabled = false;
    });
  }

  /* ------------------------------------------------------------
     UI
  ------------------------------------------------------------ */
  function closeAuthMenu(){
    document.getElementById("authUserWidget").classList.remove("open");
    closeNicknameEdit();
  }

  function openNicknameEdit(){
    var input = document.getElementById("authMenuNameInput");
    input.placeholder = t("authNicknamePlaceholder");
    input.value = (authCurrentUser && authCurrentUser.displayName) || "";
    document.getElementById("authMenuAccount").hidden = true;
    document.getElementById("authMenuNameEdit").hidden = false;
    input.focus();
    input.select();
  }
  function closeNicknameEdit(){
    document.getElementById("authMenuAccount").hidden = false;
    document.getElementById("authMenuNameEdit").hidden = true;
  }

  function applyAvatar(imgEl, fallbackEl){
    if(authCurrentUser && authCurrentUser.photoURL){
      imgEl.src = authCurrentUser.photoURL;
      imgEl.hidden = false;
      fallbackEl.textContent = "";
    } else {
      imgEl.hidden = true;
      imgEl.src = "";
      var initial = ((authCurrentUser && (authCurrentUser.displayName || authCurrentUser.email)) || "?").trim().charAt(0).toUpperCase();
      fallbackEl.textContent = initial;
    }
  }

  function renderAuthUI(){
    var loginBtn = document.getElementById("authLoginBtn");
    var userWidget = document.getElementById("authUserWidget");
    loginBtn.title = t("authLogin");

    if(authCurrentUser){
      loginBtn.hidden = true;
      userWidget.hidden = false;
      applyAvatar(document.getElementById("authAvatarImg"), document.getElementById("authAvatarFallback"));
      applyAvatar(document.getElementById("authMenuAvatarImg"), document.getElementById("authMenuAvatarFallback"));
      document.getElementById("authMenuName").textContent = authCurrentUser.displayName || "";
      document.getElementById("authMenuEmail").textContent = authCurrentUser.email || "";
      document.getElementById("authMenuEditBtn").title = t("authEditNickname");
      document.getElementById("authMenuNameSave").textContent = t("authNicknameSave");
      document.getElementById("authMenuNameCancel").textContent = t("authNicknameCancel");
      document.getElementById("authLogoutBtn").textContent = t("authLogout");
    } else {
      loginBtn.hidden = false;
      userWidget.hidden = true;
      closeAuthMenu();
    }

    document.getElementById("publishUpdateBtn").hidden = !isAdminAccount();
    document.getElementById("publishUpdateBtn").title = t("publishUpdate");
  }

  document.getElementById("authLoginBtn").addEventListener("click", authLogin);
  document.getElementById("authAvatarBtn").addEventListener("click", function(ev){
    ev.stopPropagation();
    document.getElementById("authUserWidget").classList.toggle("open");
    closeNicknameEdit();
  });
  document.getElementById("authLogoutBtn").addEventListener("click", authLogout);
  document.getElementById("authMenuEditBtn").addEventListener("click", function(ev){
    ev.stopPropagation();
    openNicknameEdit();
  });
  document.getElementById("authMenuNameCancel").addEventListener("click", function(ev){
    ev.stopPropagation();
    closeNicknameEdit();
  });
  document.getElementById("authMenuNameSave").addEventListener("click", function(ev){
    ev.stopPropagation();
    authUpdateNickname(document.getElementById("authMenuNameInput").value);
  });
  document.getElementById("authMenuNameInput").addEventListener("keydown", function(ev){
    ev.stopPropagation();
    if(ev.key === "Enter") authUpdateNickname(ev.target.value);
    else if(ev.key === "Escape") closeNicknameEdit();
  });
  document.addEventListener("click", function(ev){
    var widget = document.getElementById("authUserWidget");
    if(widget.classList.contains("open") && !widget.contains(ev.target)) closeAuthMenu();
  });

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

  /* ------------------------------------------------------------
     Auth state -> data source switch
  ------------------------------------------------------------ */
  fbAuth.onAuthStateChanged(function(user){
    authCurrentUser = user;
    renderAuthUI();

    if(user){
      setSyncing(true);
      var userRef = fbStore.collection("users").doc(user.uid);
      userRef.collection("spaceData").limit(1).get().then(function(snap){
        if(snap.empty){
          // Brand-new account: nothing in the cloud yet, so treat whatever's
          // currently in `db` (loaded from this browser's localStorage) as
          // the starting point and push it up as the initial diff.
          showToast(t("authSyncingLocal"));
          return saveDiffToCloud().then(function(){
            showToast(t("authSyncedLocal"));
          });
        }
        return loadMergedDBFromCloud(user.uid).then(function(merged){
          db = merged;
          reconcileActiveSpaceAfterSwap();
          render();
          maybeShowBaseUpdateBanner();
        });
      }).catch(function(err){
        console.error("Cloud load failed:", err);
        showToast(t("authLoadError"), "error");
      }).then(function(){
        setSyncing(false);
      });
    } else {
      hideBaseUpdateBanner();
      _currentViewingVersion = null; // no per-account pin once logged out
      if(_authFirstStateSeen){
        // Only reload from localStorage on an actual sign-out transition —
        // not on the very first (logged-out) auth check at page load, since
        // `db` already holds the right thing from the synchronous loadDB()
        // call in 01-data-model.js.
        db = loadDB();
        reconcileActiveSpaceAfterSwap();
      }
      // Guests get the published 總表 merged in read-only, straight from
      // whatever's currently latest (see loadGuestSpaceIndexBase above).
      loadGuestSpaceIndexBase().then(function(){
        render();
      });
    }
    _authFirstStateSeen = true;
  });
