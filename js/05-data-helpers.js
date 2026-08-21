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

  function getCategory(id){ return db.categories.find(function(c){ return c.id===id; }); }
  function getTrick(id){ return db.tricks.find(function(t){ return t.id===id; }); }
  function getChildren(parentId){
    if(parentId === null){
      return db.categories.filter(function(c){ return c.parentId===null && c.spaceId===state.activeSpace; });
    }
    return db.categories.filter(function(c){ return c.parentId===parentId; });
  }
  function getTricksInCategory(catId){ return db.tricks.filter(function(t){ return t.categoryIds.indexOf(catId) !== -1; }); }

  // A trick "belongs to" a space if any of its containers' root ancestor
  // (walking up through pathToContainer) is a root category filed under that
  // space. Used by the flat "columns" view mode, which shows every trick in
  // a space regardless of how deep it's nested.
  function trickBelongsToSpace(tr, spaceId){
    if(!tr.categoryIds || !tr.categoryIds.length) return false;
    return tr.categoryIds.some(function(cid){
      var path = pathToContainer(cid);
      if(!path.length) return false;
      var rootCat = getCategory(path[0]);
      return rootCat && rootCat.parentId === null && rootCat.spaceId === spaceId;
    });
  }
  function getAllTricksInSpace(spaceId){
    return db.tricks.filter(function(tr){ return trickBelongsToSpace(tr, spaceId); });
  }

  // Direct-membership version used by the flat "columns" (Grid List) view:
  // a trick counts only when one of its categoryIds is a REAL category (not
  // another trick acting as a folder) whose root ancestor belongs to this
  // space. This intentionally excludes extension/variant tricks that only
  // sit inside a trick-folder — they're variants of their parent trick, not
  // independent members of this list — and the result is a flat list with
  // no category/hierarchy nodes at all.
  function getFlatSpaceTricks(spaceId){
    return db.tricks.filter(function(tr){
      return (tr.categoryIds||[]).some(function(cid){
        var cat = getCategory(cid);
        if(!cat) return false; // cid points at a trick-folder, not a real category — skip
        var path = pathToContainer(cid);
        if(!path.length) return false;
        var rootCat = getCategory(path[0]);
        return rootCat && rootCat.parentId === null && rootCat.spaceId === spaceId;
      });
    });
  }

  // Whether spaceId is one of the built-in shelves that can't be deleted
  // (see UNDELETABLE_SPACE_IDS in 01-data-model.js).
  function isUndeletableSpace(spaceId){
    return UNDELETABLE_SPACE_IDS.indexOf(spaceId) !== -1;
  }

  // Lazily creates (once) the fixed-id root category that the drawer's ⭐
  // quick-toggle button files a trick into for a given space — see
  // GOAL_BUCKET_CAT_ID in 01-data-model.js.
  function ensureSpaceBucketCategory(spaceId, bucketId, icon, name){
    var cat = getCategory(bucketId);
    if(!cat){
      cat = { id: bucketId, parentId: null, name: name, order: 0, icon: icon, color: "default", spaceId: spaceId };
      db.categories.push(cat);
    }
    return cat;
  }
  function spaceBucketFor(spaceId){
    if(spaceId === "space-goal") return { bucketId: GOAL_BUCKET_CAT_ID, icon:"⭐", name:{ zh:"收藏招式", jp:"お気に入りの技", en:"Favorite Tricks" } };
    return null;
  }
  // Whether trickId is currently filed into spaceId's bucket category.
  function trickInSpaceBucket(trickId, spaceId){
    var bucket = spaceBucketFor(spaceId);
    var tr = getTrick(trickId);
    if(!bucket || !tr) return false;
    return tr.categoryIds.indexOf(bucket.bucketId) !== -1;
  }
  // Adds/removes trickId from spaceId's bucket category (creating the bucket
  // the first time it's needed) — this is the single source of truth the
  // drawer's quick-toggle buttons and the space's flat views both read from,
  // so toggling in one place is immediately reflected everywhere else.
  function toggleTrickInSpaceBucket(trickId, spaceId){
    var bucket = spaceBucketFor(spaceId);
    var tr = getTrick(trickId);
    if(!bucket || !tr) return;
    ensureSpaceBucketCategory(spaceId, bucket.bucketId, bucket.icon, bucket.name);
    var idx = tr.categoryIds.indexOf(bucket.bucketId);
    if(idx === -1) tr.categoryIds.push(bucket.bucketId); else tr.categoryIds.splice(idx, 1);
    saveDB();
  }

  // Whenever a trick drops out of spaceId's bucket (⭐ quick-toggle turned
  // off, removed via a list's own remove button, etc.) while that trick's
  // detail drawer is open AND
  // spaceId is the space currently being browsed, the drawer is left
  // pointing at an item no longer in the list behind it — so close it. If
  // that was the bucket's last trick, its space tab disappears from the
  // rail too, so fall back to 總表 rather than leaving the view stuck on a
  // now-empty/hidden section. Callers should call this right after any
  // toggle-off that might remove trickId from spaceId's bucket; it's a
  // no-op whenever the drawer wasn't showing that exact trick in that exact
  // space, or the trick is still in the bucket. Returns true when it closed
  // the drawer, so callers can skip a redundant renderDrawer() call.
  function closeDrawerIfLeftActiveBucket(trickId, spaceId){
    if(state.activeSpace !== spaceId) return false;
    if(state.detailTrickId !== trickId) return false;
    if(trickInSpaceBucket(trickId, spaceId)) return false; // still filed in the bucket
    closeDrawer();
    if(getAllTricksInSpace(spaceId).length === 0){
      var indexSpace = getSpace("space-index");
      if(indexSpace){
        state.activeSpace = indexSpace.id;
        localStorage.setItem(SPACE_KEY, indexSpace.id);
        state.path = [];
        renderSpaceRail();
        renderColumns();
      }
    }
    return true;
  }

  // A trick's note is a single free-text field (tr.note). Older data stored notes
  // as one-or-more items inside tr.media instead — this migrates that legacy shape
  // into tr.note (joining multiple legacy notes) the first time the trick is opened.
  function getTrickNote(tr){
    if(typeof tr.note === "string") return tr.note;
    var legacyNotes = (tr.media||[]).filter(function(m){ return m.type==="note"; });
    tr.note = legacyNotes.map(function(m){ return m.content||""; }).filter(Boolean).join("\n\n");
    if(legacyNotes.length){
      tr.media = tr.media.filter(function(m){ return m.type!=="note"; });
      saveDB();
    }
    return tr.note;
  }
  function getTrickProficiency(tr){
    return PROFICIENCY_LEVELS.indexOf(tr.proficiency) !== -1 ? tr.proficiency : "none";
  }
  // Adds a soft colored halo around a trick's icon element, colored by its
  // practice proficiency (see PROFICIENCY_COLORS) — no glow at all while
  // proficiency is "none". Layered on top of the icon's usual glass highlight
  // rather than replacing it, since setting box-shadow inline overrides the
  // CSS class's own box-shadow declaration. Always assigns (rather than only
  // assigning when there's a glow) so dropping proficiency back to "none"
  // actually clears a previously-applied glow instead of leaving it stale.
  function applyTrickGlow(iconEl, trickRef){
    var prof = getTrickProficiency(trickRef);
    if(prof === "none"){
      iconEl.style.boxShadow = "var(--glass-highlight)";
      return;
    }
    var glowHex = PROFICIENCY_COLORS[prof];
    iconEl.style.boxShadow = "var(--glass-highlight), 0 0 0 1px " + hexToRgba(glowHex, 0.4) + ", 0 0 14px 2px " + hexToRgba(glowHex, 0.55);
  }

  // Re-applies the proficiency glow on every currently-rendered icon for one
  // trick — its row in the miller columns, and its row in a parent trick's
  // "extension tricks" list inside the detail drawer — without a full
  // re-render. Called right after a proficiency change so the glow updates in
  // the same frame as the click, instead of lagging one render behind (the
  // miller-column rows are persistent DOM nodes that otherwise only get
  // touched again on the next full render()).
  function refreshTrickIconGlow(trickId){
    var tr = getTrick(trickId);
    if(!tr) return;
    var rows = document.querySelectorAll('.item[data-item-type="trick"][data-item-id="' + trickId + '"]');
    Array.prototype.forEach.call(rows, function(row){
      var iconEl = row.querySelector(".item-icon");
      if(iconEl) applyTrickGlow(iconEl, tr);
    });
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
    return getChildren(trickId).length > 0 || db.tricks.some(function(tr){ return tr.categoryIds.indexOf(trickId) !== -1; });
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
    var tr = getTrick(containerId);
    if(!tr || !tr.categoryIds.length) return [containerId];
    return pathToContainer(tr.categoryIds[0], depth+1).concat(containerId);
  }
  function pathToCategory(catId){ return pathToContainer(catId); }

  // Categories and trick-folders together may nest at most this many levels deep —
  // keeps the miller-column chain short enough that the detail drawer never has to
  // fight the browse columns for room even when several are expanded at once.
  var MAX_CATEGORY_DEPTH = 5;
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

