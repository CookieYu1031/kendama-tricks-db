"use strict";

  /* ============================================================
     AUTH + CLOUD SYNC (base data + per-space diff)
     ------------------------------------------------------------
     Data model recap: `db` (see 01-data-model.js) stays exactly the same
     in-memory shape as before — { categories, tricks, spaces } flat
     arrays — every render/modal/etc. function keeps working on it
     unchanged. This file only concerns itself with how that shape gets
     serialized to/from Firestore once someone is logged in.

     BASE DATA — there are no static base files any more (data/base/ was removed
     in v0.2). Every table's base is empty except the shared 總表 (t00), whose base
     is a live, versioned document tree in Firestore that only ADMIN_UID can publish
     new versions of — see the SHARED BASE section in 51-shared-base.js. Official
     publishing for 01/02 comes in v0.6.

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

  var DEFAULT_SPACE_IDS = DEFAULT_SPACES.map(function(s){ return s.id; });
  // The one table (總表, t00) whose "base" is a live document tree in Firestore that
  // only ADMIN_UID can publish new versions of — see the SHARED BASE section in
  // 51-shared-base.js. The Firestore doc path stays sharedBase/space-index (rules
  // depend on it), but it maps to table t00.
  var SHARED_BASE_DOC_ID = "space-index";
  var SHARED_BASE_TABLE_ID = "t00";

  var authCurrentUser = null;
  var _authFirstStateSeen = false; // avoids reloading local data before we know anything, on the very first (logged-out) check at page load
  var _cloudSaveTimer = null;
  var CLOUD_SAVE_DEBOUNCE_MS = 600;
  var baseDataCache = {}; // spaceId -> empty base; "t00@N" -> {version, categories, tricks} (shared-base versions)
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
    // No static base files: every table except the shared 總表 (served by
    // fetchSharedBaseVersion) has an empty base.
    return Promise.resolve({ version: 0, categories: [], tricks: [] });
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
    catIds[spaceId] = true; // tricks placed directly at the table root
    if(spaceId === FAV_TABLE_ID) catIds[FAV_CUSTOM_ID] = true;
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
      var otherSpaceIds = spaceIds.filter(function(id){ return id !== SHARED_BASE_TABLE_ID; });
      return Promise.all(otherSpaceIds.map(fetchBaseSpaceData)).then(function(otherBases){
        return fetchSharedBaseVersion(viewingVersion).then(function(indexBase){
          var baseMap = {}; otherSpaceIds.forEach(function(id, i){ baseMap[id] = otherBases[i]; });
          baseMap[SHARED_BASE_TABLE_ID] = indexBase;
          var batch = fbStore.batch();
          spaceIds.forEach(function(sid){
            var diff = computeSpaceDiff(sid, baseMap[sid]);
            diff.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
            batch.set(userRef.collection("spaceData").doc(sid), diff);
          });
          batch.set(userRef.collection("meta").doc("spaces"), {
            spaces: db.spaces,
            schema: CLOUD_SCHEMA,
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
  // Bumped when the cloud layout changes incompatibly; older docs are ignored.
  var CLOUD_SCHEMA = 2;
  function loadMergedDBFromCloud(uid){
    var userRef = fbStore.collection("users").doc(uid);
    return userRef.collection("spaceData").get().then(function(snap){
      var diffMap = {};
      snap.forEach(function(doc){ diffMap[doc.id] = doc.data(); });
      var spaceIds = Object.keys(diffMap);
      DEFAULT_SPACE_IDS.forEach(function(id){ if(spaceIds.indexOf(id) === -1) spaceIds.push(id); });

      return userRef.collection("meta").doc("spaces").get().then(function(metaSnap){
        var meta = metaSnap.exists ? metaSnap.data() : null;
        // Pre-v0.2 cloud data (no schema marker) is dropped on purpose (B6/B7):
        // start this account from empty tables; the next save writes schema 2.
        if(!meta || meta.schema !== CLOUD_SCHEMA){ diffMap = {}; meta = null; }
        var spacesList = (meta && Array.isArray(meta.spaces) && meta.spaces.length)
          ? meta.spaces
          : null; // normalizeDB fills in the default tables
        // Only diffs of tables that still exist (old space-* docs are ignored).
        var liveIds = DEFAULT_SPACE_IDS.concat((spacesList || []).map(function(sp){ return sp && sp.id; }));
        Object.keys(diffMap).forEach(function(id){ if(liveIds.indexOf(id) === -1) delete diffMap[id]; });
        spaceIds = Object.keys(diffMap);
        DEFAULT_SPACE_IDS.forEach(function(id){ if(spaceIds.indexOf(id) === -1) spaceIds.push(id); });

        return ensureViewingVersionResolved(uid).then(function(viewingVersion){
          var otherSpaceIds = spaceIds.filter(function(id){ return id !== SHARED_BASE_TABLE_ID; });
          return Promise.all(otherSpaceIds.map(fetchBaseSpaceData)).then(function(otherBases){
            return fetchSharedBaseVersion(viewingVersion).then(function(indexBase){
              var baseMap = {}; otherSpaceIds.forEach(function(id, i){ baseMap[id] = otherBases[i]; });
              baseMap[SHARED_BASE_TABLE_ID] = indexBase;
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
