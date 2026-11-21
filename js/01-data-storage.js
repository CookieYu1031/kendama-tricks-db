"use strict";

  // Per-user local cache (v0.3 C1/C2): { db, dirty, lastSyncAt, cloudClientUpdatedAt,
  // hashes:{sid:hash}, synced:<db at last sync>, isAdmin, localUpdatedAt }.
  // `userCache` is the live object for the signed-in (or last-known) user, null for guests.
  var userCache = null;
  var _optimisticUid = null; // last-known uid used to open instantly before auth resolves

  function emptyUserCache(uid){
    return { uid: uid, db: null, dirty: false, lastSyncAt: 0, cloudClientUpdatedAt: 0,
      hashes: {}, synced: null, isAdmin: false, localUpdatedAt: 0 };
  }
  function readUserCache(uid){
    try{
      var raw = localStorage.getItem(USER_CACHE_PREFIX + uid);
      if(!raw) return null;
      var c = JSON.parse(raw);
      if(!c || typeof c !== "object") return null;
      var out = emptyUserCache(uid);
      Object.keys(out).forEach(function(k){ if(c[k] !== undefined) out[k] = c[k]; });
      out.uid = uid;
      if(!out.hashes || typeof out.hashes !== "object") out.hashes = {};
      return out;
    }catch(e){ return null; }
  }
  // Writes the live cache (+ current db). When storage is full, drops `synced` and retries.
  function writeUserCache(){
    if(!userCache) return false;
    var payload = Object.assign({}, userCache, { db: db });
    try{
      localStorage.setItem(USER_CACHE_PREFIX + userCache.uid, JSON.stringify(payload));
      return true;
    }catch(e){
      userCache.synced = null;
      payload.synced = null;
      try{
        localStorage.setItem(USER_CACHE_PREFIX + userCache.uid, JSON.stringify(payload));
        return true;
      }catch(e2){ return false; }
    }
  }
  function emptyDB(){
    return normalizeDB({ categories: [], tricks: [] });
  }

  function loadDB(){
    // Old guest data is discarded on purpose (guests are read-only since v0.3).
    try{ localStorage.removeItem(OLD_STORAGE_KEY); }catch(e){ /* ignore */ }
    try{ localStorage.removeItem(STORAGE_KEY); }catch(e){ /* ignore */ }
    userCache = null;
    _optimisticUid = null;
    try{
      var lastUid = localStorage.getItem(LAST_UID_KEY);
      if(lastUid){
        var c = readUserCache(lastUid);
        if(c){
          userCache = c;
          _optimisticUid = lastUid;
          if(c.db && c.db.categories && c.db.tricks) return normalizeDB(c.db);
        }
      }
    }catch(e){ /* fall through to empty */ }
    return emptyDB();
  }

  // Video platform is detected from the URL; detectPlatform (05) loads after this file,
  // so videos normalized at load time may have an empty platform. Fills them in place.
  function backfillPlatforms(database){
    if(typeof detectPlatform !== "function") return 0;
    var n = 0;
    ((database && database.tricks) || []).forEach(function(tr){
      (tr.media || []).forEach(function(m){
        if(m && !m.platform && m.url){ m.platform = detectPlatform(m.url); n++; }
      });
    });
    return n;
  }

  function objVals(o){ return Object.keys(o).map(function(k){ return o[k]; }); }

  function nameOf(n){ return { zh:n&&n.zh||"", jp:n&&n.jp||"", en:n&&n.en||"" }; }

  // Default tables always exist (fixed code/locked/name); saved viewMode/icon/order are kept.
  // Custom tables keep their saved fields; codes are (re)assigned when missing or duplicated.
  function normalizeSpaces(rawSpaces){
    var saved = Array.isArray(rawSpaces) ? rawSpaces : [];
    var out = DEFAULT_SPACES.map(function(d, idx){
      var s = saved.find(function(x){ return x && x.id === d.id; }) || {};
      return {
        id:d.id, code:d.code, locked:d.locked, icon: d.icon, name: nameOf(d.name), seeded: !!s.seeded,
        order: typeof s.order === "number" ? s.order : idx,
        viewMode: VIEW_MODES.indexOf(s.viewMode) !== -1 ? s.viewMode : d.viewMode
      };
    });
    var savedCodes = {};
    saved.forEach(function(s, idx){
      if(!s || !s.id || isDefaultSpaceId(s.id)) return;
      savedCodes[s.id] = s.code;
      out.push({
        id:s.id, code:null, locked:false, icon: s.icon || "🗂️", name: nameOf(s.name),
        order: typeof s.order === "number" ? s.order : DEFAULT_SPACES.length + idx,
        viewMode: VIEW_MODES.indexOf(s.viewMode) !== -1 ? s.viewMode : "tree"
      });
    });
    // custom codes: keep valid unique saved codes, allocate the rest
    var used = {};
    out.forEach(function(s){ if(s.code) used[s.code] = true; });
    out.forEach(function(s){
      var c = savedCodes[s.id];
      if(!isDefaultSpaceId(s.id) && typeof c === "string" && /^0[a-z]$/.test(c) && !used[c]){ s.code = c; used[c] = true; }
    });
    out.forEach(function(s){
      if(isDefaultSpaceId(s.id) || s.code) return;
      s.code = allocSpaceCode(out);
    });
    return out.sort(function(a, b){ return a.order - b.order; });
  }

  // v0.9.2 tag kinds: "text" (default, also for old tags) or "class" (招式類別, carries a
  // combo { grip, parts } of a grip id + part ids; invalid ids are dropped).
  function normalizeCombo(c){
    c = c || {};
    return {
      grip: GRIP_KEYS.indexOf(c.grip) !== -1 ? c.grip : null,
      parts: Array.isArray(c.parts) ? PART_KEYS.filter(function(k){ return c.parts.indexOf(k) !== -1; }) : []
    };
  }
  function normalizeTag(g){
    var tag = { id:g.id, name: nameOf(g.name), kind: g.kind === "class" ? "class" : "text" };
    if(tag.kind === "class") tag.combo = normalizeCombo(g.combo);
    return tag;
  }

  function normalizeDB(raw){
    var spaces = normalizeSpaces(raw.spaces);

    var cats = (raw.categories||[]).map(function(c, idx){
      var oc = {
        id:c.id, parentId: c.parentId===undefined?null:c.parentId,
        name: nameOf(c.name),
        order: typeof c.order === "number" ? c.order : idx,
        icon: c.icon || "",
        color: c.color || "default",
        spaceId: c.spaceId || spaces[0].id
      };
      // v0.9.1: source key of a one-click share copy ("<ownerUid>_<itemId>"), used for dedup.
      if(typeof c.sharedFrom === "string" && c.sharedFrom) oc.sharedFrom = c.sharedFrom.slice(0, 120);
      return oc;
    });
    seedDefaultFolders(spaces, cats);
    ensureFavFixedFolders(cats);
    var infos = (raw.infos||[]).map(function(n, idx){
      return {
        id:n.id, parentId: n.parentId===undefined?null:n.parentId,
        spaceId: n.spaceId || spaces[0].id,
        title: nameOf(n.title),
        content: typeof n.content === "string" ? n.content : "",
        order: typeof n.order === "number" ? n.order : idx,
        icon: n.icon || "",
        color: n.color || "default"
      };
    });
    var tags = (raw.tags||[]).filter(function(g){ return g && g.id; }).map(normalizeTag);
    var tricks = (raw.tricks||[]).map(function(t, idx){
      // Videos only (note-type media dropped), at most MAX_VIDEOS — the first ones are kept.
      var legacyNotes = [];
      var media = [];
      (Array.isArray(t.media) ? t.media : []).forEach(function(m){
        if(m.type === "note"){ if(m.content) legacyNotes.push(m.content); return; }
        media.push({ id: m.id || newItemId(), type:"video", title: m.title || "", url: m.url || "",
          platform: m.platform || (typeof detectPlatform === "function" ? detectPlatform(m.url || "") : "") });
      });
      // Migrate the legacy single videoUrl field (pre media[] versions) into one video entry.
      if(!media.length && t.videoUrl){
        media = [{ id: newItemId(), type:"video", title:"", url: t.videoUrl, platform: typeof detectPlatform === "function" ? detectPlatform(t.videoUrl) : "" }];
      }
      media = media.slice(0, MAX_VIDEOS);
      // landed is derived from rate (drawer has no separate toggle): legacy landed w/o rate -> "rare".
      var rateVal = RATE_LEVELS.indexOf(t.rate) !== -1 ? t.rate : (t.landed ? "rare" : null);
      var ot = {
        id:t.id, name: nameOf(t.name),
        media: media, categoryIds: Array.isArray(t.categoryIds)? t.categoryIds.slice() : [],
        orderByCategory: (t.orderByCategory && typeof t.orderByCategory === "object") ? Object.assign({}, t.orderByCategory) : {},
        order: typeof t.order === "number" ? t.order : idx,
        icon: t.icon || "",
        color: t.color || "",
        tagIds: Array.isArray(t.tagIds) ? t.tagIds.slice() : [],
        grip: GRIP_KEYS.indexOf(t.grip) !== -1 ? t.grip : null,
        parts: Array.isArray(t.parts) ? PART_KEYS.filter(function(k){ return t.parts.indexOf(k) !== -1; }) : [],
        note: typeof t.note === "string" ? t.note : legacyNotes.join("\n\n"),
        landed: !!rateVal,
        rate: rateVal,
        favorite: !!t.favorite,
        custom: !!t.custom
      };
      if(typeof t.sharedFrom === "string" && t.sharedFrom) ot.sharedFrom = t.sharedFrom.slice(0, 120);
      return ot;
    });
    return { categories: cats, tricks: tricks, infos: infos, tags: tags, spaces: spaces };
  }

  // Local-first persistence (企劃書 §五.3): only a signed-in user (or the last-known user
  // before auth resolves) persists anything — to the per-uid cache, flagged dirty. The
  // cloud push happens later (js/54-sync-queue.js). Guests are read-only: nothing is saved.
  var _mutSeq = 0; // bumped on every mutation; lets a running sync detect edits made meanwhile
  function saveDB(){
    if(typeof invalidateDbIndex === "function") invalidateDbIndex();
    if(typeof rebuildReadingDict === "function") rebuildReadingDict(db.tricks);
    if(!userCache) return;
    _mutSeq++;
    userCache.dirty = true;
    userCache.localUpdatedAt = Date.now();
    writeUserCache();
    if(typeof renderSyncUI === "function") renderSyncUI();
  }

  var db = loadDB();
