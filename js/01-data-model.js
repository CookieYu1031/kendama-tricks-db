"use strict";

  /* ============================================================
     DATA
  ============================================================ */
  // v2 (企劃書 v0.2): the old v1 data (incl. static base files) is dropped, not migrated.
  var STORAGE_KEY = "kendama-trick-db-v2";
  var OLD_STORAGE_KEY = "kendama-trick-db-v1";
  // v0.3 local-first: only signed-in users persist data, in a per-uid cache (see saveDB below).
  var USER_CACHE_PREFIX = "kendama-trick-db-v2:u:";
  var LAST_UID_KEY = "kendama-last-uid";
  var LANG_KEY = "kendama-lang-v1";
  var SPACE_KEY = "kendama-active-space-v2";

  // Data-model key lists. Defined here (not in 02) because normalizeDB() runs at
  // load time of this file, before 02 is loaded. Labels / colors live in 02.
  var MAX_VIDEOS = 3;                       // B9: videos per trick
  var GRIP_KEYS = ["ken", "tama", "ito"];  // 持劍 / 持球 / 持線 (single choice)
  // Parts (multi), grouped ken / ito / tama. Old key "kensakiSide" was dropped (normalization filters unknown keys).
  var PART_GROUPS = [
    { key:"ken",  parts:["kensaki","kenchou","saraDo","sara","saraEdge","kenBody","suberidome","chuzara","chuzaraEdge"] },
    { key:"ito",  parts:["string"] },
    { key:"tama", parts:["tamaTop","ana","stringHole"] }
  ];
  var PART_KEYS = PART_GROUPS.reduce(function(a, g){ return a.concat(g.parts); }, []);
  // Personal landing-rate levels (B7), shown left-to-right: rare=1/10, sometimes=3/10, most=5/10, mastered=8/10
  var RATE_LEVELS = ["rare", "sometimes", "most", "mastered"];
  // Levels (B3): table root items are level 1, max level 4. Folders only up to level 3.
  var MAX_ITEM_LEVEL = 4;
  var MAX_FOLDER_LEVEL = 3;
  var MAX_CUSTOM_TABLES = 26; // codes "0a".."0z"

  // Tables ("spaces"), shown as an icon-only rail on the far left. Items live in
  // exactly one table. locked: only the admin account may edit (users can still add
  // custom:true tricks). code: shown in location codes ("00","01","02", customs "0a".."0z").
  // Each table also carries a viewMode controlling how its contents are laid out:
  //   "tree"     — the miller-column folder browser (default)
  //   "columns"  — a flat multi-column grid of tricks only (no categories)
  var DEFAULT_SPACES = [
    { id:"t00", code:"00", locked:true,  icon:"🗂️", name:{ zh:"總表", jp:"総表", en:"Master list" },    viewMode:"tree" },
    { id:"t01", code:"01", locked:true,  icon:"📜", name:{ zh:"檢定", jp:"検定", en:"Certification" }, viewMode:"tree" },
    { id:"t02", code:"02", locked:true,  icon:"🏆", name:{ zh:"賽事", jp:"大会", en:"Competition" },    viewMode:"tree" },
    { id:"fav", code:null, locked:false, icon:"⭐", name:{ zh:"收藏", jp:"お気に入り", en:"Favorites" }, viewMode:"tree" }
  ];
  // Initial level-1 folders (admin may rename / delete / reorder them like any folder). Fixed
  // 6-char ids (time ids are 7 chars, so no collision). Seeded once per table: a table whose
  // `seeded` flag is set (it lives on the space record, so it syncs) is never re-seeded.
  var SEED_FOLDERS = {
    t01: [
      { id:"s01jka", name:{ zh:"JKA日本劍玉協會", jp:"JKA 日本けん玉協会", en:"JKA Japan Kendama Association" }, icon:"img:assets/icon-jka.png" },
      { id:"s01glk", name:{ zh:"GLOKEN", jp:"GLOKEN", en:"GLOKEN" }, icon:"img:assets/icon-gloken.png" }
    ],
    t02: [
      { id:"s02kwc", name:{ zh:"KWC", jp:"KWC", en:"KWC" }, icon:"" },
      { id:"s02nak", name:{ zh:"NAKO", jp:"NAKO", en:"NAKO" }, icon:"" },
      { id:"s02btb", name:{ zh:"BATB", jp:"BATB", en:"BATB" }, icon:"" },
      { id:"s02ekc", name:{ zh:"EKC", jp:"EKC", en:"EKC" }, icon:"" }
    ]
  };
  // Adds the initial folders to every table that is empty and not yet seeded; marks it seeded.
  function seedDefaultFolders(spaces, cats){
    spaces.forEach(function(sp){
      var list = SEED_FOLDERS[sp.id];
      if(!list || sp.seeded) return;
      sp.seeded = true;
      var has = cats.some(function(c){ return c.spaceId === sp.id; });
      if(has) return;
      list.forEach(function(f, i){
        if(cats.some(function(c){ return c.id === f.id; })) return;
        cats.push({ id:f.id, parentId:null, name:nameOf(f.name), order:i, icon:f.icon, color:"default", spaceId:sp.id });
      });
    });
  }
  var VIEW_MODES = ["tree", "columns"];
  var FAV_TABLE_ID = "fav";
  var FAV_STARRED_ID = "fav-starred"; // virtual folder: tricks with favorite:true
  var FAV_CUSTOM_ID = "fav-custom";   // virtual folder: tricks with custom:true + tricks added directly
  // Tables that can never be deleted.
  var UNDELETABLE_SPACE_IDS = ["t00", "t01", "t02", "fav"];
  function getSpace(id){ return db.spaces.find(function(s){ return s.id===id; }); }
  function spaceLabel(id){
    var sp = getSpace(id);
    return sp ? localize(sp.name) : id;
  }
  function isDefaultSpaceId(id){ return DEFAULT_SPACES.some(function(s){ return s.id === id; }); }

  // Guests (D8): read-only, and only the public tables 00/01/02 are shown.
  // isLoggedIn lives in 50; missing (tests) = treated as signed in.
  var GUEST_SPACE_IDS = ["t00", "t01", "t02"];
  function isGuest(){ return typeof isLoggedIn === "function" && !isLoggedIn(); }
  function isGuestVisibleSpace(id){ return GUEST_SPACE_IDS.indexOf(id) !== -1; }

  // Locked tables: only the admin account edits official content.
  function canEditTable(spaceId){
    if(isGuest()) return false;
    var sp = getSpace(spaceId);
    if(!sp) return false;
    if(!sp.locked) return true;
    return typeof isAdminAccount === "function" && !!isAdminAccount();
  }
  // Non-admins may still add custom:true tricks into locked tables.
  function canAddCustomTrick(spaceId){
    if(isGuest()) return false;
    var sp = getSpace(spaceId);
    return !!(sp && sp.locked);
  }

  // Custom table codes: "0a".."0z", lowest free first (freed codes are reused).
  function allocSpaceCode(spaces){
    var used = {};
    (spaces || db.spaces).forEach(function(s){ if(s.code) used[s.code] = true; });
    for(var i = 0; i < MAX_CUSTOM_TABLES; i++){
      var code = "0" + String.fromCharCode(97 + i);
      if(!used[code]) return code;
    }
    return null;
  }
  function canAddCustomSpace(){
    return db.spaces.filter(function(s){ return !isDefaultSpaceId(s.id); }).length < MAX_CUSTOM_TABLES;
  }
  // Creates a custom table (unlocked) and returns it, or null when the 26-table cap is reached.
  function createSpace(fields){
    if(!canAddCustomSpace()) return null;
    fields = fields || {};
    var nm = fields.name || {};
    var sp = {
      id: newItemId(), code: allocSpaceCode(), locked: false, icon: fields.icon || "🗂️",
      name:{ zh:nm.zh||"", jp:nm.jp||"", en:nm.en||"" },
      order: db.spaces.length, viewMode: "tree"
    };
    db.spaces.push(sp);
    saveDB();
    return sp;
  }

  // Legacy random id; only used as a fallback when nextId() (07-id.js) is missing.
  function uid(prefix){
    return prefix + "-" + Math.random().toString(36).slice(2,9);
  }
  function isIdTaken(id){
    if(!db) return false;
    return (db.spaces||[]).some(function(x){ return x.id === id; }) ||
      (db.categories||[]).some(function(x){ return x.id === id; }) ||
      (db.infos||[]).some(function(x){ return x.id === id; }) ||
      (db.tags||[]).some(function(x){ return x.id === id; }) ||
      (db.tricks||[]).some(function(x){
        return x.id === id || (x.media||[]).some(function(m){ return m.id === id; });
      });
  }
  // Unique id for every new record (categories, tricks, infos, tags, media, tables).
  function newItemId(){
    if(typeof nextId === "function") return nextId(isIdTaken);
    var id;
    do { id = uid("id"); } while(isIdTaken(id));
    return id;
  }

  // Starts fully empty — a clean slate the person builds up themselves via edit mode.
  function seedData(){
    return { categories: {}, tricks: {} };
  }

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

  function normalizeDB(raw){
    var spaces = normalizeSpaces(raw.spaces);

    var cats = (raw.categories||[]).map(function(c, idx){
      return {
        id:c.id, parentId: c.parentId===undefined?null:c.parentId,
        name: nameOf(c.name),
        order: typeof c.order === "number" ? c.order : idx,
        icon: c.icon || "",
        color: c.color || "default",
        spaceId: c.spaceId || spaces[0].id
      };
    });
    seedDefaultFolders(spaces, cats);
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
    var tags = (raw.tags||[]).map(function(g){ return { id:g.id, name: nameOf(g.name) }; });
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
      return {
        id:t.id, name: nameOf(t.name),
        media: media, categoryIds: Array.isArray(t.categoryIds)? t.categoryIds.slice() : [],
        orderByCategory: (t.orderByCategory && typeof t.orderByCategory === "object") ? Object.assign({}, t.orderByCategory) : {},
        order: typeof t.order === "number" ? t.order : idx,
        icon: t.icon || "",
        color: t.color || "",
        tagIds: Array.isArray(t.tagIds) ? t.tagIds.slice() : [],
        grip: GRIP_KEYS.indexOf(t.grip) !== -1 ? t.grip : null,
        parts: Array.isArray(t.parts) ? PART_KEYS.filter(function(k){ return t.parts.indexOf(k) !== -1; }) : [],
        officialNote: typeof t.officialNote === "string" ? t.officialNote : "",
        note: typeof t.note === "string" ? t.note : legacyNotes.join("\n\n"),
        landed: !!rateVal,
        rate: rateVal,
        favorite: !!t.favorite,
        custom: !!t.custom
      };
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
