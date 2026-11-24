"use strict";

  /* ============================================================
     CLOUD SYNC CORE — base data, per-space diff, merge, admin flag
     ------------------------------------------------------------
     `db` (01-data-storage.js) keeps its flat-array shape; this file only
     defines how it maps to/from the per-space diff. Layout (CLOUD_SCHEMA 3):

       users/{uid}/meta/spaces -> { spaces, tags, schema:3, clientUpdatedAt, updatedAt }
       users/{uid}/spaceData/{sid} -> { schema:3, baseVersion, chunks, hash, updatedAt }
       users/{uid}/spaceData/{sid}/chunks/{i} -> { data }   // JSON of the diff, split
       diff = { baseVersion, added:{categories,tricks,infos}, modified:{...},
                removed:{categoryIds,trickIds,infoIds} }

     Chunking, Firestore reads/writes: 53-sync-chunks.js. Local-first queue and
     triggers: 54-sync-queue.js. Conflicts: 55-sync-conflict.js.

     BASE DATA: every table's base is empty except the shared tables (t00/t01/t02/t03), a live
     versioned snapshot in Firestore published by admins (51-shared-base.js).
     A diff is always computed from scratch against that base, so there is no
     tombstone bookkeeping: an item in base but absent from `db` reads as removed.

     A trick can sit in categories of several spaces; it is written into every
     space diff it touches (intentional duplication; merging unions by id).
  ============================================================ */

  var DEFAULT_SPACE_IDS = DEFAULT_SPACES.map(function(s){ return s.id; });
  // The one table (總表, t00) whose "base" is a live document tree in Firestore that
  // only admins (admins/{uid}) can publish new versions of — see the SHARED BASE section in
  // 51-shared-base.js. The Firestore doc path stays sharedBase/space-index (rules
  // depend on it), but it maps to table t00.
  var SHARED_BASE_DOC_ID = "space-index";
  var SHARED_BASE_TABLE_ID = "t00";
  // Tables whose base comes from the published snapshot (D3): 總表, 檢定, 賽事. Snapshots
  // published before this expansion hold t00 only; they carry no `tables` list, which
  // reads as ["t00"], and tables a snapshot doesn't cover keep their local content.
  var SHARED_BASE_TABLE_IDS = ["t00", "t01", "t02", "t03"];
  function isSharedBaseTable(id){ return SHARED_BASE_TABLE_IDS.indexOf(id) !== -1; }

  var authCurrentUser = null;
  var _authFirstStateSeen = false; // avoids reloading local data before we know anything, on the very first (logged-out) check at page load
  var baseDataCache = {}; // "t00@N" -> {version, categories, tricks, infos, tags} (shared-base versions)
  // Bumped when the cloud layout changes incompatibly; schema 2 stays readable, older is ignored.
  var CLOUD_SCHEMA = 3;
  // This session's resolved view of the shared 總表: which version this
  // account is currently pinned to (its diff is computed against this
  // exact snapshot, not whatever the latest published version happens to
  // be), and the latest pointer doc so the update banner knows if it's
  // behind. Both are populated by ensureViewingVersionResolved()/
  // fetchSharedBasePointer() and read by maybeShowBaseUpdateBanner().
  var _currentViewingVersion = null;
  var _lastSeenPointer = null;

  // "Logged in" also covers the instant-open window: a last-known user's cache is loaded
  // before Firebase Auth resolves (see loadDB in 01). The auth callback confirms or reverts.
  function isLoggedIn(){ return !!(authCurrentUser || _optimisticUid); }
  // Admin flag comes from admins/{uid} (read at login, see 54) and is cached per user.
  function isAdminAccount(){ return !!(userCache && userCache.isAdmin && isLoggedIn()); }

  /* ------------------------------------------------------------
     Base data loading (cached per space id for the page's lifetime)
  ------------------------------------------------------------ */
  function emptyBase(version){ return { version: version || 0, tables: [], categories: [], tricks: [], infos: [], tags: [], labels: {} }; }
  // One table's slice of the shared snapshot (same container rule as tricksForSpace).
  // Tables the snapshot doesn't cover (old versions) and all non-shared tables: empty.
  function baseForSpace(indexBase, spaceId){
    if(!isSharedBaseTable(spaceId) || !indexBase) return emptyBase(0);
    var tables = indexBase.tables || ["t00"];
    if(tables.indexOf(spaceId) === -1) return emptyBase(indexBase.version);
    var cats = (indexBase.categories || []).filter(function(c){ return c.spaceId === spaceId; });
    var cont = {}; cont[spaceId] = true;
    cats.forEach(function(c){ cont[c.id] = true; });
    return {
      version: indexBase.version, tables: [spaceId], categories: cats, tags: [],
      tricks: (indexBase.tricks || []).filter(function(tr){ return (tr.categoryIds || []).some(function(cid){ return cont[cid]; }); }),
      infos: (indexBase.infos || []).filter(function(n){ return n.spaceId === spaceId; })
    };
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

  function infosForSpace(spaceId){
    return (db.infos || []).filter(function(n){ return n.spaceId === spaceId; });
  }

  // Added / modified / removed of one collection vs its base, by id.
  function diffCollection(baseList, curList){
    var baseMap = {}; (baseList || []).forEach(function(x){ baseMap[x.id] = x; });
    var curIds = {}; curList.forEach(function(x){ curIds[x.id] = true; });
    var added = [], modified = [], removed = [];
    curList.forEach(function(x){
      if(!baseMap[x.id]) added.push(x);
      else if(!deepEqual(x, baseMap[x.id])) modified.push(x);
    });
    Object.keys(baseMap).forEach(function(id){ if(!curIds[id]) removed.push(id); });
    return { added: added, modified: modified, removed: removed };
  }

  function computeSpaceDiff(spaceId, base){
    var c = diffCollection(base.categories, categoriesForSpace(spaceId));
    var t = diffCollection(base.tricks, tricksForSpace(spaceId));
    var n = diffCollection(base.infos, infosForSpace(spaceId));
    return {
      baseVersion: base.version,
      added: { categories: c.added, tricks: t.added, infos: n.added },
      modified: { categories: c.modified, tricks: t.modified, infos: n.modified },
      removed: { categoryIds: c.removed, trickIds: t.removed, infoIds: n.removed }
    };
  }
  function isEmptyDiff(d){
    return ["added", "modified"].every(function(k){
      return !d[k].categories.length && !d[k].tricks.length && !d[k].infos.length;
    }) && !d.removed.categoryIds.length && !d.removed.trickIds.length && !d.removed.infoIds.length;
  }

  /* ------------------------------------------------------------
     Merge (base + one space's diff -> that space's live items)
  ------------------------------------------------------------ */
  function applyCollectionDiff(baseList, addedList, modifiedList, removedIds){
    var map = {}; (baseList || []).forEach(function(x){ map[x.id] = x; });
    (addedList || []).concat(modifiedList || []).forEach(function(x){ map[x.id] = x; });
    (removedIds || []).forEach(function(id){ delete map[id]; });
    return objVals(map);
  }
  function mergeSpaceData(base, diff){
    var a = (diff && diff.added) || {}, m = (diff && diff.modified) || {}, r = (diff && diff.removed) || {};
    return {
      categories: applyCollectionDiff(base.categories, a.categories, m.categories, r.categoryIds),
      tricks: applyCollectionDiff(base.tricks, a.tricks, m.tricks, r.trickIds),
      infos: applyCollectionDiff(base.infos, a.infos, m.infos, r.infoIds)
    };
  }

  function mergeAllSpaces(spaceIds, baseMap, diffMap){
    var allCats = {}, allTricks = {}, allInfos = {};
    spaceIds.forEach(function(sid){
      var merged = mergeSpaceData(baseMap[sid] || emptyBase(0), diffMap[sid]);
      merged.categories.forEach(function(c){ allCats[c.id] = c; });
      merged.tricks.forEach(function(t){ allTricks[t.id] = t; });
      merged.infos.forEach(function(n){ allInfos[n.id] = n; });
    });
    return { categories: objVals(allCats), tricks: objVals(allTricks), infos: objVals(allInfos) };
  }

  // After swapping `db` for a freshly-loaded object (cloud or local),
  // make sure state.activeSpace still points at a space that exists.
  function reconcileActiveSpaceAfterSwap(){
    if(!db.spaces.some(function(s){ return s.id === state.activeSpace; })){
      state.activeSpace = db.spaces[0].id;
    }
    state.path = [];
    clearDrawerState();
    if(typeof closeDrawer === "function") closeDrawer();
  }

  function setSyncing(on){
    document.getElementById("authWidget").classList.toggle("syncing", !!on);
  }
