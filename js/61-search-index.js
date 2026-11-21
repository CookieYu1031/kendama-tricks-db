"use strict";

  /* ============================================================
     SEARCH INDEX + MATCHING (pure logic, unit-tested in tests/search.test.js)

     Index format (array of entries; v0.6 will publish the same shape as a
     static .json for guests):
       {
         id:     "a000000",                         trick id
         names:  { zh:"", jp:"", en:"" },           raw names (any may be empty)
         romaji: "rainbou",                         lowercase romaji derived from names.jp ("" if none)
         shown:  "Rainbow",                         display / fallback name at build time
         grip:   null | "ken" | "tama" | "ito",
         parts:  ["kensaki", ...],                  subset of PART_KEYS
         tagIds: ["g1", ...],                       global tag ids
         locs:   [ { spaceId:"t00", path:["c1","c2"] }, ... ],
                                                    path = folder ids from table root down to the
                                                    containing folder (may include trick-folder ids);
                                                    [] = directly in the table root. First = primary.
         custom: false                              user-made trick
       }
     Tag names live in db.tags ({id, name:{zh,jp,en}}); matchEntry takes a
     tagLookup: { tagId: [lowercase name, ...] } (see buildTagLookup).
  ============================================================ */

  // Raw query -> { text, tags }. "#word" tokens are tag filters (AND); "_" inside
  // a tag token stands for a space. Everything else is the name query.
  function parseSearchQuery(raw){
    var tags = [], words = [];
    String(raw == null ? "" : raw).split(/\s+/).forEach(function(tok){
      if(!tok) return;
      if(tok.charAt(0) === "#"){
        var name = tok.slice(1).replace(/_/g, " ").trim().toLowerCase();
        if(name) tags.push(name);
        return;
      }
      words.push(tok.toLowerCase());
    });
    return { text: words.join(" "), tags: tags };
  }

  function buildTagLookup(tags){
    var map = {};
    (tags || []).forEach(function(g){
      map[g.id] = [g.name && g.name.zh, g.name && g.name.jp, g.name && g.name.en]
        .filter(Boolean).map(function(s){ return String(s).toLowerCase(); });
    });
    return map;
  }

  // Index of every trick visible to the current user. Guests keep only tricks
  // living in the public tables (locs outside them are dropped).
  function buildSearchIndex(database, opts){
    var d = database || db;
    var guest = !!(opts && opts.guest);
    var out = [];
    d.tricks.forEach(function(tr){
      var locs = [];
      (tr.categoryIds || []).forEach(function(cid){
        if(cid === FAV_STARRED_ID || cid === FAV_CUSTOM_ID) return; // virtual folders, not real places
        var sid = containerSpaceId(cid);
        if(!sid) return;
        locs.push({ spaceId: sid, path: pathToContainer(cid) });
      });
      // The favorites table only duplicates a real location; keep it when it is the only one.
      var real = locs.filter(function(l){ return l.spaceId !== FAV_TABLE_ID; });
      if(real.length) locs = real;
      if(guest) locs = locs.filter(function(l){ return isGuestVisibleSpace(l.spaceId); });
      if(!locs.length) return;
      var nm = tr.name || {};
      out.push({
        id: tr.id,
        names: { zh: nm.zh || "", jp: nm.jp || "", en: nm.en || "" },
        romaji: typeof toRomaji === "function" ? String(toRomaji(nm.jp) || "").toLowerCase() : "",
        shown: typeof resolveDisplayName === "function" ? resolveDisplayName(nm).text : (nm.zh || nm.jp || nm.en || ""),
        grip: tr.grip || null,
        parts: (tr.parts || []).slice(),
        tagIds: (tr.tagIds || []).slice(),
        locs: locs,
        custom: !!tr.custom
      });
    });
    return out;
  }

  function entryNameFields(e){
    return [e.names.zh, e.names.jp, e.names.en, e.shown, e.romaji].map(function(s){ return (s || "").toLowerCase(); });
  }

  // query: parseSearchQuery result. filters: { grip:null|key, parts:[], partsMode:"any"|"all" }.
  function matchEntry(e, query, filters, tagLookup){
    filters = filters || {};
    if(filters.grip && e.grip !== filters.grip) return false;
    var parts = filters.parts || [];
    if(parts.length){
      // partMatches (js/01): a 劍頂 filter also matches 劍尖 tags, 中皿 matches 中皿邊.
      var has = function(p){ return typeof partMatches === "function" ? partMatches(e.parts, p) : e.parts.indexOf(p) !== -1; };
      if(filters.partsMode === "all" ? !parts.every(has) : !parts.some(has)) return false;
    }
    var qtags = (query && query.tags) || [];
    for(var i = 0; i < qtags.length; i++){
      var q = qtags[i];
      var ok = e.tagIds.some(function(id){
        return ((tagLookup && tagLookup[id]) || []).some(function(n){ return n.indexOf(q) !== -1; });
      });
      if(!ok) return false;
    }
    var text = (query && query.text) || "";
    if(text){
      var fields = entryNameFields(e);
      var words = text.split(" ");
      for(var w = 0; w < words.length; w++){
        var word = words[w];
        if(!fields.some(function(f){ return f.indexOf(word) !== -1; })) return false;
      }
    }
    return true;
  }

  function searchHasCriteria(query, filters){
    filters = filters || {};
    return !!(query.text || query.tags.length || filters.grip || (filters.parts && filters.parts.length));
  }

  // Results list shows only after the user interacted (typed / clicked a chip, tag, diagram region, grip, mode);
  // the default grip alone must not trigger a listing.
  function searchShouldShowResults(query, filters, interacted){
    return !!interacted && searchHasCriteria(query, filters);
  }

  // Class tag (kind "class", combo {grip, parts}) picked in the search: OVERWRITES the grip / parts
  // filters, each only when the combo specifies it. Mutates + returns filters; false-y tag = no-op.
  function searchApplyClassTag(filters, tag){
    if(!tag || tag.kind !== "class" || !tag.combo) return filters;
    if(tag.combo.grip) filters.grip = tag.combo.grip;
    if(tag.combo.parts && tag.combo.parts.length) filters.parts = tag.combo.parts.slice();
    return filters;
  }

  // -> matching ids; name-prefix hits first, otherwise index order. No criteria = [].
  function runSearch(index, raw, filters, tagLookup){
    var query = parseSearchQuery(raw);
    if(!searchHasCriteria(query, filters)) return [];
    if(!tagLookup && typeof db !== "undefined") tagLookup = buildTagLookup(db.tags);
    var first = query.text.split(" ")[0];
    var hits = [], rest = [];
    index.forEach(function(e){
      if(!matchEntry(e, query, filters, tagLookup)) return;
      if(first && entryNameFields(e).some(function(f){ return f.indexOf(first) === 0; })) hits.push(e.id);
      else rest.push(e.id);
    });
    return hits.concat(rest);
  }

  // Tag token being typed at the end of the input ("#ab" -> "ab"; "#" -> ""), else null.
  function currentTagToken(raw){
    var m = /(?:^|\s)#([^\s#]*)$/.exec(String(raw || ""));
    return m ? m[1] : null;
  }

  /* ------------------------------------------------------------
     Published static index (data/search-index.json, built by scripts/build-search-index.js)
     { version, label?, generatedAt, entries:[...], tags:[...] }. Public tables only.
  ------------------------------------------------------------ */
  var searchJson = null;   // loaded + validated json, or null (not loaded / unusable / placeholder)

  function validSearchJson(j){
    return !!(j && typeof j === "object" && typeof j.version === "number" && j.version > 0 &&
      Array.isArray(j.entries) && j.entries.length > 0);
  }

  // The json may stand in for the public part only when it is at least as new as the
  // base version being viewed, and the user is not an admin (admins see working data).
  function searchJsonUsable(j, viewingVersion, admin){
    if(admin || !validSearchJson(j)) return false;
    if(typeof viewingVersion !== "number") return false;
    return j.version >= viewingVersion;
  }

  // json public entries + in-memory entries; same id -> in-memory wins. hasTrick(id) drops
  // json entries whose trick is gone from the user's data.
  function mergeSearchIndex(jsonEntries, memEntries, hasTrick){
    var seen = {}, out = [];
    (memEntries || []).forEach(function(e){ seen[e.id] = true; out.push(e); });
    (jsonEntries || []).forEach(function(e){
      if(seen[e.id] || (hasTrick && !hasTrick(e.id))) return;
      seen[e.id] = true; out.push(e);
    });
    return out;
  }

  function searchViewingVersion(){
    if(typeof _currentViewingVersion !== "undefined" && _currentViewingVersion !== null) return _currentViewingVersion;
    if(typeof _lastSeenPointer !== "undefined" && _lastSeenPointer && _lastSeenPointer.latestVersion) return _lastSeenPointer.latestVersion;
    return null;
  }

  function searchTagLookup(){
    var tags = (searchJson && Array.isArray(searchJson.tags) ? searchJson.tags : []).concat(db.tags || []);
    return buildTagLookup(tags);
  }

  // Cached index; rebuilt when db, guest-ness, language, the db index version or the json changes.
  var searchIndexCache = null;
  function getSearchIndex(){
    var guest = isGuest();
    var useJson = searchJsonUsable(searchJson, searchViewingVersion(), typeof isAdminAccount === "function" && isAdminAccount());
    var c = searchIndexCache;
    if(c && c.db === db && c.version === dbIndexVersion && c.guest === guest && c.lang === state.lang &&
       c.useJson === useJson && c.nTricks === db.tricks.length && c.nCats === db.categories.length) return c.index;
    var index = buildSearchIndex(db, { guest: guest });
    if(useJson) index = mergeSearchIndex(searchJson.entries, index, function(id){ return !!getTrick(id); });
    searchIndexCache = { db: db, version: dbIndexVersion, guest: guest, lang: state.lang, useJson: useJson,
      nTricks: db.tricks.length, nCats: db.categories.length, index: index };
    return searchIndexCache.index;
  }
