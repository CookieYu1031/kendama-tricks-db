"use strict";

  /* ---------------- Video platforms ---------------- */
  function detectPlatform(url){
    if(!url) return "other";
    var host;
    try{ host = new URL(url).hostname.replace(/^www\./,"").replace(/^m\./,""); }catch(e){ return "other"; }
    if(host==="youtube.com" || host==="youtu.be") return "youtube";
    if(host==="instagram.com") return "instagram";
    if(host==="facebook.com" || host==="fb.watch") return "facebook";
    if(host==="tiktok.com") return "tiktok";
    if(host==="vimeo.com" || host==="player.vimeo.com") return "vimeo";
    if(host==="twitter.com" || host==="x.com") return "twitter";
    return "other";
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


