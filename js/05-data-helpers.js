"use strict";

  /* ============================================================
     DATA HELPERS
  ============================================================ */
  // Shared narrow-viewport check — mirrors the `@media (max-width: 860px)`
  // breakpoint used throughout the stylesheets, so JS-side layout branches
  // (mobile column view, drawer slide-in panel, collapsed search
  // bar, cycling language switch) all agree with the CSS.
  var MOBILE_BREAKPOINT = 860;
  function isNarrowViewport(){ return window.innerWidth <= MOBILE_BREAKPOINT; }
  // One column + swipe-back: <=600px, or a portrait screen up to 860px (portrait tablets).
  // Tablet (601-860px landscape): last two columns side by side. Wider: full miller chain.
  // Mirrors css/browse-columns.css / browse-motion.css: (max-width:600px), (max-width:860px) and (orientation:portrait).
  var PHONE_BREAKPOINT = 600;
  function singleColumnFor(w, h){ return w <= PHONE_BREAKPOINT || (w <= MOBILE_BREAKPOINT && h >= w); }
  function isPhoneViewport(){ return singleColumnFor(window.innerWidth, window.innerHeight); }
  function isTabletViewport(){ return window.innerWidth <= MOBILE_BREAKPOINT && !isPhoneViewport(); }
  function visibleColumnCount(){ return isPhoneViewport() ? 1 : (isTabletViewport() ? 2 : 0); } // 0 = all

  // Lazily-built lookup index (id -> record, parentId -> categories/infos,
  // containerId -> tricks) so lookups don't linearly scan db on every call.
  // Stale when db was reassigned, its arrays changed length, or dbIndexVersion
  // was bumped (saveDB() and render() both bump it).
  // The two virtual folders of the favorites table (FAV_STARRED_ID / FAV_CUSTOM_ID)
  // are fixed records, indexed in catById like real categories (virtual:true).
  var FAV_VIRTUAL_FOLDERS = [
    { id: FAV_STARRED_ID, parentId: null, name:{ zh:"收藏", jp:"お気に入り", en:"Starred" }, order: 0, icon:"⭐", color:"default", spaceId: FAV_TABLE_ID, virtual: true },
    { id: FAV_CUSTOM_ID,  parentId: null, name:{ zh:"自訂義", jp:"カスタム", en:"Custom" }, order: 1, icon:"✏️", color:"default", spaceId: FAV_TABLE_ID, virtual: true }
  ];
  var dbIndexVersion = 0;
  var dbIndex = null;
  function invalidateDbIndex(){ dbIndexVersion++; }
  function ensureDbIndex(){
    var nInfos = (db.infos || []).length;
    if(dbIndex && dbIndex.db === db && dbIndex.version === dbIndexVersion &&
       dbIndex.nCats === db.categories.length && dbIndex.nTricks === db.tricks.length && dbIndex.nInfos === nInfos) return dbIndex;
    var ix = { db: db, version: dbIndexVersion, nCats: db.categories.length, nTricks: db.tricks.length, nInfos: nInfos,
      catById: Object.create(null), trickById: Object.create(null), infoById: Object.create(null),
      catsByParent: Object.create(null), rootCats: [], tricksByContainer: Object.create(null),
      infosByParent: Object.create(null), rootInfos: [] };
    FAV_VIRTUAL_FOLDERS.forEach(function(c){ ix.catById[c.id] = c; });
    db.categories.forEach(function(c){
      if(!(c.id in ix.catById)) ix.catById[c.id] = c;
      if(c.parentId === null) ix.rootCats.push(c);
      else (ix.catsByParent[c.parentId] || (ix.catsByParent[c.parentId] = [])).push(c);
    });
    (db.infos || []).forEach(function(n){
      if(!(n.id in ix.infoById)) ix.infoById[n.id] = n;
      if(n.parentId === null) ix.rootInfos.push(n);
      else (ix.infosByParent[n.parentId] || (ix.infosByParent[n.parentId] = [])).push(n);
    });
    function put(cid, t){ (ix.tricksByContainer[cid] || (ix.tricksByContainer[cid] = [])).push(t); }
    db.tricks.forEach(function(t){
      if(!(t.id in ix.trickById)) ix.trickById[t.id] = t;
      var seen = {};
      t.categoryIds.forEach(function(cid){
        if(seen[cid]) return;
        seen[cid] = true;
        put(cid, t);
      });
      // virtual favorites folders are computed from flags
      if(t.favorite) put(FAV_STARRED_ID, t);
      if(t.custom && !seen[FAV_CUSTOM_ID]) put(FAV_CUSTOM_ID, t);
    });
    dbIndex = ix;
    return ix;
  }

  function getCategory(id){ return ensureDbIndex().catById[id]; }
  function getTrick(id){ return ensureDbIndex().trickById[id]; }
  function getInfo(id){ return ensureDbIndex().infoById[id]; }
  // parentId null = root of the active table. The favorites table root is its two virtual folders.
  function getChildren(parentId){
    var ix = ensureDbIndex();
    if(parentId === null){
      // favorites root: the two virtual folders, then the real root folders (外部匯入 ...)
      if(state.activeSpace === FAV_TABLE_ID){
        return FAV_VIRTUAL_FOLDERS.concat(ix.rootCats.filter(function(c){ return c.spaceId === FAV_TABLE_ID; }));
      }
      return ix.rootCats.filter(function(c){ return c.spaceId===state.activeSpace; });
    }
    var l = ix.catsByParent[parentId];
    return l ? l.slice() : [];
  }
  // Tricks directly inside a container. null = tricks placed at the active table root
  // (their categoryIds holds the table id).
  function getTricksInCategory(catId){
    var l = ensureDbIndex().tricksByContainer[catId === null ? state.activeSpace : catId];
    return l ? l.slice() : [];
  }
  // Info items directly inside a container (null = root of the active table).
  function getInfosIn(parentId){
    var ix = ensureDbIndex();
    if(parentId === null) return ix.rootInfos.filter(function(n){ return n.spaceId === state.activeSpace; });
    var l = ix.infosByParent[parentId];
    return l ? l.slice() : [];
  }

  // Which table a container id (table id / folder / trick-as-folder) lives in.
  function containerSpaceId(cid, depth){
    depth = depth || 0;
    if(cid == null || depth > 60) return null;
    if(getSpace(cid)) return cid;
    var cat = getCategory(cid);
    if(cat) return cat.spaceId;
    var tr = getTrick(cid);
    if(tr && tr.categoryIds.length) return containerSpaceId(tr.categoryIds[0], depth + 1);
    return null;
  }
  // A trick "belongs to" a table if any of its containers resolves to it. Favorites
  // additionally holds every starred / custom trick.
  function trickBelongsToSpace(tr, spaceId){
    if(spaceId === FAV_TABLE_ID && (tr.favorite || tr.custom)) return true;
    return (tr.categoryIds || []).some(function(cid){ return containerSpaceId(cid) === spaceId; });
  }

  // Direct-membership version used by the flat "columns" (Grid List) view:
  // a trick counts only when one of its categoryIds is the table itself or a folder
  // (not another trick acting as a folder) of this table. Variants are excluded.
  function getFlatSpaceTricks(spaceId){
    if(spaceId === FAV_TABLE_ID){
      // 外部匯入 subtree: folders below the real fixed folder (外部匯入, 單招式, imported subfolders).
      var extCats = {};
      extCats[FAV_EXTERNAL_ID] = true;
      var grew = true;
      while(grew){
        grew = false;
        (db.categories || []).forEach(function(c){
          if(!extCats[c.id] && c.parentId && extCats[c.parentId]){ extCats[c.id] = true; grew = true; }
        });
      }
      return db.tricks.filter(function(tr){
        return tr.favorite || tr.custom || (tr.categoryIds || []).some(function(cid){ return cid === FAV_CUSTOM_ID || extCats[cid] === true; });
      });
    }
    return db.tricks.filter(function(tr){
      return (tr.categoryIds||[]).some(function(cid){
        if(cid === spaceId) return true;
        var cat = getCategory(cid);
        return !!cat && cat.spaceId === spaceId;
      });
    });
  }

  // Whether spaceId is one of the built-in tables that can't be deleted
  // (see UNDELETABLE_SPACE_IDS in 01-data-model.js).
  function isUndeletableSpace(spaceId){
    return UNDELETABLE_SPACE_IDS.indexOf(spaceId) !== -1;
  }
