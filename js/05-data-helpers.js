"use strict";

  /* ============================================================
     DATA HELPERS
  ============================================================ */
  // Shared narrow-viewport check — mirrors the `@media (max-width: 860px)`
  // breakpoint used throughout the stylesheets, so JS-side layout branches
  // (mobile column view, drawer bottom-sheet peek/expand, collapsed search
  // bar, cycling language switch) all agree with the CSS.
  var MOBILE_BREAKPOINT = 860;
  function isNarrowViewport(){ return window.innerWidth <= MOBILE_BREAKPOINT; }

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
      if(state.activeSpace === FAV_TABLE_ID) return FAV_VIRTUAL_FOLDERS.slice();
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
  function getAllTricksInSpace(spaceId){
    return db.tricks.filter(function(tr){ return trickBelongsToSpace(tr, spaceId); });
  }

  // Direct-membership version used by the flat "columns" (Grid List) view:
  // a trick counts only when one of its categoryIds is the table itself or a folder
  // (not another trick acting as a folder) of this table. Variants are excluded.
  function getFlatSpaceTricks(spaceId){
    if(spaceId === FAV_TABLE_ID){
      return db.tricks.filter(function(tr){ return tr.favorite || tr.custom || tr.categoryIds.indexOf(FAV_CUSTOM_ID) !== -1; });
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

  /* ---------------- Favorites ---------------- */
  function isFavorite(trickId){
    var tr = getTrick(trickId);
    return !!(tr && tr.favorite);
  }
  function toggleFavorite(trickId){
    var tr = getTrick(trickId);
    if(!tr) return false;
    tr.favorite = !tr.favorite;
    saveDB();
    return tr.favorite;
  }
  // --- Compat wrappers for the old GOAL bucket API (UI still calls these; maps to favorite).
  // The spaceId arguments are ignored.
  var GOAL_BUCKET_CAT_ID = FAV_STARRED_ID;
  function spaceBucketFor(spaceId){ return spaceId === FAV_TABLE_ID ? { bucketId: FAV_STARRED_ID } : null; }
  function trickInSpaceBucket(trickId){ return isFavorite(trickId); }
  function toggleTrickInSpaceBucket(trickId){ toggleFavorite(trickId); }
  // Closes the drawer when the open trick was just un-starred while browsing the favorites table.
  // Returns true when it closed the drawer.
  function closeDrawerIfLeftActiveBucket(trickId){
    if(state.activeSpace !== FAV_TABLE_ID) return false;
    if(state.detailTrickId !== trickId) return false;
    if(isFavorite(trickId)) return false;
    if(typeof closeDrawer === "function") closeDrawer();
    return true;
  }

  /* ---------------- Global tags (B8) ---------------- */
  function getTag(id){ return (db.tags || []).find(function(g){ return g.id === id; }); }
  function addTag(name){
    if(!db.tags) db.tags = [];
    var nm = name || {};
    var tag = { id: newItemId(), name:{ zh:nm.zh||"", jp:nm.jp||"", en:nm.en||"" } };
    db.tags.push(tag);
    saveDB();
    return tag;
  }
  function removeTag(id){
    db.tags = (db.tags || []).filter(function(g){ return g.id !== id; });
    db.tricks.forEach(function(tr){
      if(tr.tagIds && tr.tagIds.indexOf(id) !== -1) tr.tagIds = tr.tagIds.filter(function(x){ return x !== id; });
    });
    saveDB();
  }

  /* ---------------- Delete semantics (B5-a) ---------------- */
  // Removes only the placement of a trick in one container; the trick entity is deleted
  // when its last placement is gone. Virtual folder "fav-starred" just un-stars.
  // Deleting a trick cascades to its variants' placement in it and to its info items.
  function removeTrickPlacement(trickId, containerId){
    var tr = getTrick(trickId);
    if(!tr) return;
    if(containerId === FAV_STARRED_ID){
      tr.favorite = false;
      saveDB();
      return;
    }
    var idx = tr.categoryIds.indexOf(containerId);
    if(idx !== -1) tr.categoryIds.splice(idx, 1);
    delete tr.orderByCategory[containerId];
    if(tr.categoryIds.length){ saveDB(); return; }
    // last placement gone -> delete the entity
    var pos = db.tricks.indexOf(tr);
    if(pos !== -1) db.tricks.splice(pos, 1);
    saveDB(); // refresh the index before cascading
    db.tricks.filter(function(v){ return v.categoryIds.indexOf(trickId) !== -1; }).forEach(function(v){
      removeTrickPlacement(v.id, trickId);
    });
    if(db.infos) db.infos = db.infos.filter(function(n){ return n.parentId !== trickId; });
    saveDB();
  }

  /* ---------------- Levels (B3) ---------------- */
  // Table root items are level 1. levelOf(container) = the container's own level
  // (0 for null / a table id, i.e. "the root").
  function levelOf(containerId){
    if(containerId == null) return 0;
    return pathToContainer(containerId).length;
  }
  // type: "folder"/"category" -> new item's level must be <= 3; "trick"/"info" -> <= 4.
  // A trick used as a folder (variants) counts as a level like any other container.
  function canAddChild(parentId, type){
    if(parentId != null){
      if(getInfo(parentId)) return false;                         // info items hold nothing
      if(parentId === FAV_STARRED_ID) return false;               // computed list
      if(getSpace(parentId)) parentId = null;
    }
    var newLevel = levelOf(parentId) + 1;
    var max = (type === "folder" || type === "category") ? MAX_FOLDER_LEVEL : MAX_ITEM_LEVEL;
    return newLevel <= max;
  }

  // A trick's personal note is a single free-text field (tr.note); officialNote is the
  // admin's text shown before it.
  function getTrickNote(tr){ return typeof tr.note === "string" ? tr.note : ""; }
  // Adds a soft colored halo around a trick's icon element, colored by its
  // landing rate (see RATE_COLORS) — no glow while rate is null. Layered on top of the
  // icon's usual glass highlight rather than replacing it, since setting box-shadow
  // inline overrides the CSS class's own box-shadow declaration. Always assigns
  // (rather than only assigning when there's a glow) so clearing the rate actually
  // clears a previously-applied glow instead of leaving it stale.
  function applyTrickGlow(iconEl, trickRef){
    var rate = trickRef.rate;
    if(!rate || !RATE_COLORS[rate]){
      iconEl.style.boxShadow = "var(--glass-highlight)";
      return;
    }
    var glowHex = RATE_COLORS[rate];
    iconEl.style.boxShadow = "var(--glass-highlight), 0 0 0 1px " + hexToRgba(glowHex, 0.4) + ", 0 0 14px 2px " + hexToRgba(glowHex, 0.55);
  }

  // Re-applies the rate glow on every currently-rendered icon for one trick without a
  // full re-render (the miller-column rows are persistent DOM nodes that otherwise
  // only get touched again on the next full render()).
  function refreshTrickIconGlow(trickId){
    var tr = getTrick(trickId);
    if(!tr) return;
    var rows = document.querySelectorAll('.item[data-item-type="trick"][data-item-id="' + trickId + '"]');
    Array.prototype.forEach.call(rows, function(row){
      var iconEl = row.querySelector(".item-icon");
      if(iconEl) applyTrickGlow(iconEl, tr);
    });
  }
  // Only plain web links may be stored/opened as video URLs — blocks
  // javascript:, data: and other schemes that could run code on click.
  function isSafeHttpUrl(url){
    if(typeof url !== "string" || !url.trim()) return false;
    try{
      var u = new URL(url.trim());
      return u.protocol === "https:" || u.protocol === "http:";
    }catch(e){ return false; }
  }
  function escapeHtml(str){
    return String(str==null?"":str).replace(/[&<>"']/g, function(ch){
      return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch];
    });
  }

  // Icon field accepts either a pasted emoji (kept as-is) or short plain text — capped at
  // two halfwidth characters (e.g. "V2") or one fullwidth character (e.g. "招"). Emoji
  // (including multi-codepoint sequences like flags or ZWJ combos) are detected and left
  // untouched so they still render as a single glyph.
  function isLikelyEmojiIcon(str){
    return /[\u{1F000}-\u{1FFFF}\u{2190}-\u{2BFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/u.test(str);
  }
  function charDisplayWidth(ch){
    var code = ch.codePointAt(0);
    if(
      (code >= 0x1100 && code <= 0x115F) ||   // Hangul Jamo
      (code >= 0x2E80 && code <= 0xA4CF) ||   // CJK Radicals .. Yi
      (code >= 0xAC00 && code <= 0xD7A3) ||   // Hangul syllables
      (code >= 0xF900 && code <= 0xFAFF) ||   // CJK compatibility ideographs
      (code >= 0xFF00 && code <= 0xFF60) ||   // Fullwidth forms
      (code >= 0xFFE0 && code <= 0xFFE6)
    ) return 2;
    return 1;
  }
  function clampIconInput(str){
    str = String(str==null?"":str);
    if(isLikelyEmojiIcon(str)) return str;
    var chars = Array.from(str);
    var width = 0, out = "";
    for(var i=0;i<chars.length;i++){
      var w = charDisplayWidth(chars[i]);
      if(width + w > 2) break;
      width += w; out += chars[i];
    }
    return out;
  }

  // A trick's `categoryIds` array holds "container ids" — these can reference either a
  // real category OR another trick's id. The latter lets a trick simultaneously act as a
  // folder holding variant/extension tricks (a trick can be a trick AND a folder at once).
  // getTricksInCategory() is intentionally generic: it just resolves "which tricks list
  // this id as one of their containers", so it works unchanged whether the id belongs to
  // a category or to a trick-folder.
  //
  // A trick-folder can now ALSO hold sub-categories directly (a category's parentId may
  // point at a trick id, same as it points at another category), so a trick has children
  // whenever either it owns extension tricks OR it owns sub-categories — checked via the
  // already-generic getChildren(), which doesn't care whether parentId is a category or
  // a trick id.
  function trickHasChildren(trickId){
    return getChildren(trickId).length > 0 || getInfosIn(trickId).length > 0 || db.tricks.some(function(tr){ return tr.categoryIds.indexOf(trickId) !== -1; });
  }

  // Cycle-safe: walks category-children (always a clean tree) and trick-children
  // (can theoretically cycle in corrupted/imported data) to collect an id plus every
  // descendant id, used to prevent picking a node as its own ancestor.
  function getDescendantContainerIds(containerId, visited, depth){
    visited = visited || {};
    depth = depth || 0;
    if(visited[containerId] || depth > 60) return [];
    visited[containerId] = true;
    var out = [containerId];
    getChildren(containerId).forEach(function(ch){ out = out.concat(getDescendantContainerIds(ch.id, visited, depth+1)); });
    getTricksInCategory(containerId).forEach(function(tr){ out = out.concat(getDescendantContainerIds(tr.id, visited, depth+1)); });
    return out;
  }
  function getDescendantCategoryIds(catId){ return getDescendantContainerIds(catId); }

  // Full ancestor chain (mixing category and/or trick-folder ids) ending at
  // containerId. Walks upward through category.parentId — which may now point at
  // either another category OR a trick-folder, since a trick can hold sub-categories
  // directly — and, once the chain reaches a trick, continues through that trick's own
  // first listed container (a trick-folder can itself be nested, and can itself be
  // multi-assigned, so this just follows its first container as a reasonable default).
  // Replaces the old category-only pathToCategory + trick-aware pathToContainer split,
  // which broke as soon as a category's ancestor chain could pass through a trick.
  function pathToContainer(containerId, depth){
    depth = depth || 0;
    if(containerId == null || depth > 60) return containerId == null ? [] : [containerId];
    var cat = getCategory(containerId);
    if(cat){
      var upstream = cat.parentId == null ? [] : pathToContainer(cat.parentId, depth+1);
      return upstream.concat(containerId);
    }
    if(getSpace(containerId)) return []; // a table id = the root (items directly in a table are level 1)
    var tr = getTrick(containerId);
    if(!tr || !tr.categoryIds.length) return [containerId];
    return pathToContainer(tr.categoryIds[0], depth+1).concat(containerId);
  }
  function pathToCategory(catId){ return pathToContainer(catId); }

  // Compat: folders may sit at level <= MAX_CATEGORY_DEPTH (see MAX_FOLDER_LEVEL / canAddChild);
  // categoryDepth() is the container's level (see levelOf).
  var MAX_CATEGORY_DEPTH = MAX_FOLDER_LEVEL;
  function categoryDepth(catId){ return pathToContainer(catId).length; }

  // Combined categories + tricks tree, flattened with depth, for the trick modal's
  // "belongs to" picker — lets a trick be nested directly under another trick.
  function flattenContainersForPicker(excludeIds){
    var out = [];
    function walk(parentId, depth, visited){
      if(depth > 60) return;
      getChildren(parentId).slice().sort(function(a,b){ return (a.order-b.order) || localize(a.name).localeCompare(localize(b.name)); }).forEach(function(c){
        if(excludeIds && excludeIds.indexOf(c.id) !== -1) return;
        if(visited[c.id]) return;
        visited[c.id] = true;
        out.push({ id:c.id, depth:depth, name: localize(c.name), type:"category", ref:c });
        walk(c.id, depth+1, visited);
      });
      var trs = getTricksInCategory(parentId===null ? "__none__" : parentId).slice().sort(function(a,b){ return localize(a.name).localeCompare(localize(b.name)); });
      trs.forEach(function(tr){
        if(excludeIds && excludeIds.indexOf(tr.id) !== -1) return;
        if(visited[tr.id]) return;
        visited[tr.id] = true;
        out.push({ id:tr.id, depth:depth, name: localize(tr.name), type:"trick", ref:tr });
        walk(tr.id, depth+1, visited);
      });
    }
    walk(null, 0, {});
    return out;
  }

