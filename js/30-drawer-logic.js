"use strict";

  /* ============================================================
     DRAWER LOGIC — pure helpers for the trick drawer (js/31, js/32).
     Unit-tested in tests/drawer-logic.test.js, tests/drawer-slide.test.js.
  ============================================================ */
  // Swipe-right-to-close decision (mobile slide-in panel). Pure, unit-tested in
  // tests/drawer-slide.test.js.
  //   dx / dy: finger travel since touchstart (px, +dx = rightward)
  //   velocityX: rightward speed at release (px/ms)
  //   width: panel width (px)
  // "ignore": mostly vertical or leftward (let the body scroll / nothing to do)
  // "close": dragged past 30% of the width, or a fast rightward flick
  // "back": otherwise, spring back to open
  var DRAWER_SWIPE_RATIO = 0.3, DRAWER_FLICK_VELOCITY = 0.5, DRAWER_FLICK_MIN_DX = 24;
  function drawerSwipeDecision(dx, dy, velocityX, width){
    if(!(dx > 0) || Math.abs(dy) > Math.abs(dx)) return "ignore";
    if(width > 0 && dx >= width * DRAWER_SWIPE_RATIO) return "close";
    if(velocityX >= DRAWER_FLICK_VELOCITY && dx >= DRAWER_FLICK_MIN_DX) return "close";
    return "back";
  }

  /* ---------- Pure helpers (unit-tested in tests/drawer-logic.test.js) ---------- */
  // Landing rate: a level, or null (「無」). `landed` is derived from it.
  // Re-selecting the active option is a no-op; 無 is the way to clear.
  function setRate(tr, level){
    tr.rate = RATE_LEVELS.indexOf(level) === -1 ? null : level;
    tr.landed = !!tr.rate;
    return tr.rate;
  }
  // Set one language of the name. Refuses (false) if all three would be empty.
  function setTrickName(tr, lang, value){
    var next = { zh: tr.name.zh || "", jp: tr.name.jp || "", en: tr.name.en || "" };
    next[lang] = (value || "").trim();
    if(!next.zh && !next.jp && !next.en) return false;
    tr.name = next;
    return true;
  }
  // The two languages shown in the edit-mode name table (the title edits `main`).
  function nameTableLangs(main){
    return ["zh", "jp", "en"].filter(function(l){ return l !== main; });
  }
  function trickIdLabel(tr){ return "@" + tr.id; }
  // Single-select grip chip (tap again clears).
  function toggleGrip(tr, key){
    tr.grip = (tr.grip === key || GRIP_KEYS.indexOf(key) === -1) ? null : key;
    return tr.grip;
  }
  // Multi-select part chip; result keeps the canonical PART_KEYS order.
  function togglePart(tr, key){
    if(PART_KEYS.indexOf(key) === -1) return tr.parts;
    var parts = tr.parts || [];
    if(parts.indexOf(key) === -1) parts = parts.concat([key]);
    else parts = parts.filter(function(p){ return p !== key; });
    tr.parts = PART_KEYS.filter(function(p){ return parts.indexOf(p) !== -1; });
    return tr.parts;
  }
  // [{ id, label }] for the tags on a trick (unknown ids skipped).
  function trickTagChips(tr){
    var out = [];
    (tr.tagIds || []).forEach(function(id){
      var tag = getTag(id);
      if(tag) out.push({ id: id, label: resolveDisplayName(tag.name).text });
    });
    return out;
  }
  // Existing tags not yet on the trick.
  function availableTagChips(tr){
    var have = tr.tagIds || [];
    return (db.tags || []).filter(function(g){ return have.indexOf(g.id) === -1; })
      .map(function(g){ return { id: g.id, label: resolveDisplayName(g.name).text }; });
  }
  // Adds a tag to the trick; creates it (addTag) unless a tag with the same name exists.
  function addTagToTrick(tr, text, lang){
    text = (text || "").trim();
    if(!text) return null;
    var low = text.toLowerCase();
    var tag = (db.tags || []).find(function(g){
      return ["zh", "jp", "en"].some(function(l){ return g.name[l] && g.name[l].toLowerCase() === low; });
    });
    if(!tag){
      var nm = { zh:"", jp:"", en:"" };
      nm[lang || "zh"] = text;
      tag = addTag(nm);
    }
    tr.tagIds = tr.tagIds || [];
    if(tr.tagIds.indexOf(tag.id) === -1) tr.tagIds.push(tag.id);
    saveDB();
    return tag;
  }
  // Location codes of a trick, e.g. ["001a-tr-00"]; one per placement in a table that has a code.
  function trickLocCodes(tr){
    var ix = ensureDbIndex();
    var seenSpace = {}, out = [];
    function catItem(c){ return { type:"fo", id:c.id, name:c.name, ref:c }; }
    function trItem(x){ return { type:"tr", id:x.id, name:x.name, ref:x }; }
    function infoItem(n){ return { type:"in", id:n.id, name:n.name || {}, ref:n }; }
    function sorted(items, parentId){
      return typeof sortColumnItems === "function" ? sortColumnItems(items, parentId) : items;
    }
    function kidsOf(parentId){
      var items = (ix.catsByParent[parentId] || []).map(catItem).concat((ix.tricksByContainer[parentId] || []).map(trItem));
      return sorted(items, parentId).concat((ix.infosByParent[parentId] || []).map(infoItem));
    }
    (tr.categoryIds || []).forEach(function(cid){
      var sid = containerSpaceId(cid);
      var sp = sid && getSpace(sid);
      if(!sp || !sp.code || seenSpace[sid]) return;
      seenSpace[sid] = true;
      var roots = ix.rootCats.filter(function(c){ return c.spaceId === sid; }).map(catItem)
        .concat((ix.tricksByContainer[sid] || []).map(trItem));
      roots = sorted(roots, null).concat(ix.rootInfos.filter(function(n){ return n.spaceId === sid; }).map(infoItem));
      var res = computeLocCodes(sp.code, roots, function(it){ return it.type === "in" ? [] : kidsOf(it.id); });
      locCodeOf(res, tr.id).forEach(function(c){ if(c && out.indexOf(c) === -1) out.push(c); });
    });
    return out;
  }
  function trickTableId(tr){
    return containerSpaceId((tr.categoryIds || [])[0]);
  }
