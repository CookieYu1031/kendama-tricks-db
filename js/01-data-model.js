"use strict";

  /* ============================================================
     DATA
  ============================================================ */
  // v2 (企劃書 v0.2): the old v1 data (incl. static base files) is dropped, not migrated.
  var STORAGE_KEY = "kendama-trick-db-v2";
  // v0.3 local-first: only signed-in users persist data, in a per-uid cache (see saveDB below).
  var USER_CACHE_PREFIX = "kendama-trick-db-v2:u:";
  var LAST_UID_KEY = "kendama-last-uid";
  var LANG_KEY = "kendama-lang-v1";
  var SPACE_KEY = "kendama-active-space-v2";

  // Data-model key lists. Defined here (not in 02) because normalizeDB() runs at
  // load time of this file, before 02 is loaded. Labels / colors live in 02.
  var MAX_VIDEOS = 3;                       // B9: videos per trick
  var MAX_INFO_LINKS = 3, INFO_LINK_TITLE_MAX = 12, INFO_LINK_URL_MAX = 500; // v0.17.2 info.links
  // 握持手勢: two levels, still ONE value per trick. A category key ("ken" / "tama" / "ito", the old
  // flat values) means "category, sub-grip unspecified"; a sub key (ken_sara...) is a specific grip.
  var GRIP_GROUPS = [
    { key:"ken",  grips:["ken_ken","ken_sara","ken_candle","ken_gun","ken_space","ken_stall","ken_swivel","ken_down"] },
    { key:"tama", grips:["tama_tama","tama_stunt","tama_twohand"] },
    { key:"ito",  grips:["ito_hang","ito_lighthouse","ito_spike","ito_tornado"] }
  ];
  // Picker layout (js/36, js/77): sub-grip -> its column (1-4) when it should not just follow the previous chip.
  // 雙手 sits under 殺 (column 4), leaving column 3 of the 持球 row empty.
  var GRIP_COL_AT = { tama_twohand: 4 };
  // Every valid grip value (3 categories + all subs); normalization / share / forms validate against it.
  var GRIP_KEYS = GRIP_GROUPS.reduce(function(a, g){ return a.concat([g.key], g.grips); }, []);
  // "ken" | "tama" | "ito" for any grip value (a category maps to itself); null for unknown.
  function gripCategoryOf(k){
    for(var i = 0; i < GRIP_GROUPS.length; i++){
      if(GRIP_GROUPS[i].key === k || GRIP_GROUPS[i].grips.indexOf(k) !== -1) return GRIP_GROUPS[i].key;
    }
    return null;
  }
  function isGripCategory(k){
    return GRIP_GROUPS.some(function(g){ return g.key === k; });
  }
  // Does a trick with `trickGrip` match a filter on `wanted`? Equal, or wanted is a category the trick's grip is in.
  function gripMatches(trickGrip, wanted){
    if(!wanted) return true;
    if(!trickGrip) return false;
    if(trickGrip === wanted) return true;
    return isGripCategory(wanted) && gripCategoryOf(trickGrip) === wanted;
  }
  // Parts (multi), grouped ken / ito / tama. Unknown keys are filtered by normalization. tamaTop is shown as 球; "junction" (交界) is a pseudo-part.
  var PART_GROUPS = [
    { key:"ken",  parts:["kenchou","kensaki","sara","saraEdge","junction","kenBody","suberidome","chuzara","chuzaraEdge"] },
    { key:"ito",  parts:["string"] },
    { key:"tama", parts:["tamaTop","tamaPoint","ana"] }
  ];
  var PART_KEYS = PART_GROUPS.reduce(function(a, g){ return a.concat(g.parts); }, []);
  // child -> parent: the tip is inside 劍頂, the rim inside 中皿. A child can be lit alone;
  // a lit parent lights its children's area too (diagram), and a filter on the parent matches children.
  var PART_PARENT = { kensaki:"kenchou", chuzaraEdge:"chuzara" };
  // trickParts + every ancestor of each (so a trick tagged 劍尖 also counts as 劍頂).
  function expandParts(parts){
    var out = (parts || []).slice();
    (parts || []).forEach(function(k){
      var p = PART_PARENT[k];
      while(p){ if(out.indexOf(p) === -1) out.push(p); p = PART_PARENT[p]; }
    });
    return out;
  }
  // Does a trick tagged `trickParts` match a filter on `wantedPart`? (parent filter matches child tags)
  function partMatches(trickParts, wantedPart){
    return expandParts(trickParts).indexOf(wantedPart) !== -1;
  }
  // Personal landing-rate levels (B7), shown left-to-right: rare=1/10, sometimes=3/10, most=5/10, mastered=8/10
  var RATE_LEVELS = ["rare", "sometimes", "most", "mastered"];
  // Levels (B3): table root items are level 1, max level 4. Folders only up to level 3.
  var MAX_ITEM_LEVEL = 4;
  var MAX_FOLDER_LEVEL = 3;
  var MAX_CUSTOM_TABLES = 26; // codes "0a".."0z"

  // Tables ("spaces"), shown as an icon-only rail on the far left. Items live in
  // exactly one table. locked: only the admin account may edit (users can still add
  // custom:true tricks). code: shown in location codes ("00","01","02","03", customs "0a".."0z").
  // Each table also carries a viewMode controlling how its contents are laid out:
  //   "tree"     — the miller-column folder browser (default)
  //   "columns"  — a flat multi-column grid of tricks only (no categories)
  var DEFAULT_SPACES = [
    { id:"t00", code:"00", locked:true,  icon:"🗂️", name:{ zh:"總表", jp:"総表", en:"Master list" },    viewMode:"tree" },
    { id:"t01", code:"01", locked:true,  icon:"📜", name:{ zh:"檢定", jp:"検定", en:"Certification" }, viewMode:"tree" },
    { id:"t02", code:"02", locked:true,  icon:"🏆", name:{ zh:"賽事", jp:"大会", en:"Competition" },    viewMode:"tree" },
    { id:"t03", code:"03", locked:true,  icon:"🗄️", name:{ zh:"各式資料", jp:"各種資料", en:"Resources" }, viewMode:"tree" },
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
  // v0.9.1: permanent REAL folders of the favorites table (never deleted / renamed by the user).
  // 外部匯入 sits at the root below the two virtual folders; 單招式 inside it. Share import fills them.
  var FAV_EXTERNAL_ID = "fav-external";
  var FAV_EXTERNAL_SINGLE_ID = "fav-external-single";
  var FAV_FIXED_FOLDERS = [
    { id: FAV_EXTERNAL_ID, parentId: null, order: 2, icon: "📥", name:{ zh:"外部匯入", jp:"外部インポート", en:"Imported" } },
    { id: FAV_EXTERNAL_SINGLE_ID, parentId: FAV_EXTERNAL_ID, order: 0, icon: "🎯", name:{ zh:"單招式", jp:"単体の技", en:"Single tricks" } }
  ];
  function isFixedFavFolder(id){
    return FAV_FIXED_FOLDERS.some(function(f){ return f.id === id; });
  }
  // Adds the missing fixed folders / restores their name, place and table (idempotent, mutates cats).
  function ensureFavFixedFolders(cats){
    FAV_FIXED_FOLDERS.forEach(function(f){
      var c = cats.find(function(x){ return x.id === f.id; });
      if(!c){
        c = { id: f.id, color: "default" };
        cats.push(c);
      }
      c.parentId = f.parentId;
      c.name = nameOf(f.name);
      c.order = f.order;
      c.icon = f.icon;
      c.spaceId = FAV_TABLE_ID;
    });
  }
  // Tables that can never be deleted.
  var UNDELETABLE_SPACE_IDS = ["t00", "t01", "t02", "t03", "fav"];
  function getSpace(id){ return db.spaces.find(function(s){ return s.id===id; }); }
  function spaceLabel(id){
    var sp = getSpace(id);
    return sp ? localize(sp.name) : id;
  }
  function isDefaultSpaceId(id){ return DEFAULT_SPACES.some(function(s){ return s.id === id; }); }

  // Guests (D8): read-only, and only the public tables 00/01/02 are shown.
  // isLoggedIn lives in 50; missing (tests) = treated as signed in.
  var GUEST_SPACE_IDS = ["t00", "t01", "t02", "t03"];
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

