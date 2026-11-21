"use strict";

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
  // v0.9.1: nothing may be created (add / paste / drop / link) in the favorites table root,
  // 收藏 (starred), 自訂義 (aggregate view of 總表 custom tricks), 外部匯入 and 單招式.
  // containerId null = table root of spaceId (default: the active table); a table id = its root.
  // Folders inside 外部匯入 (imported copies) and every other table are unaffected.
  function canCreateIn(containerId, spaceId){
    if(containerId == null || getSpace(containerId)){
      var sid = containerId == null ? (spaceId || state.activeSpace) : containerId;
      return sid !== FAV_TABLE_ID;
    }
    return [FAV_STARRED_ID, FAV_CUSTOM_ID, FAV_EXTERNAL_ID, FAV_EXTERNAL_SINGLE_ID].indexOf(containerId) === -1;
  }
  function canAddChild(parentId, type){
    if(!canCreateIn(parentId)) return false;
    if(parentId != null){
      if(getInfo(parentId)) return false;                         // info items hold nothing
      if(parentId === FAV_STARRED_ID) return false;               // computed list
      if(getSpace(parentId)) parentId = null;
    }
    var newLevel = levelOf(parentId) + 1;
    var max = (type === "folder" || type === "category") ? MAX_FOLDER_LEVEL : MAX_ITEM_LEVEL;
    return newLevel <= max;
  }

  // A trick's personal note is a single free-text field (tr.note).
  function getTrickNote(tr){ return typeof tr.note === "string" ? tr.note : ""; }
  // Adds a soft colored halo around a trick's icon element, colored by its
  // landing rate (see RATE_COLORS) — no glow while rate is null. Layered on top of the
  // icon's usual glass highlight rather than replacing it, since setting box-shadow
  // inline overrides the CSS class's own box-shadow declaration. Always assigns
  // (rather than only assigning when there's a glow) so clearing the rate actually
  // clears a previously-applied glow instead of leaving it stale.
  function applyTrickGlow(iconEl, trickRef){
    var rate = trickRef.rate;
    // Glow uses var(--rate-*) via color-mix, so it follows theme changes live.
    var glow = rateGlowShadow(rate);
    iconEl.style.boxShadow = glow ? "var(--glass-highlight), " + glow : "var(--glass-highlight)";
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
