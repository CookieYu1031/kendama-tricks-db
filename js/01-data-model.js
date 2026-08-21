"use strict";

  /* ============================================================
     DATA
  ============================================================ */
  var STORAGE_KEY = "kendama-trick-db-v1";
  var LANG_KEY = "kendama-lang-v1";
  var SPACE_KEY = "kendama-active-space-v1";

  // Practice-proficiency levels for a trick, shown as a 6-way segmented control
  // in the detail drawer. Ordered left-to-right as displayed; "none" is the default.
  var PROFICIENCY_LEVELS = ["none", "once", "rare", "sometimes", "often", "mastered"];

  // Top-level shelves shown as an icon-only rail on the far left. Each root
  // category (parentId === null) belongs to exactly one of these; sub-categories are
  // unaffected and just inherit their root ancestor's shelf. Persisted in db.spaces so
  // they can be renamed / added to directly from the rail in edit mode.
  // Each space also carries a viewMode controlling how its contents are laid
  // out in the main panel — see renderColumns()/renderFlatTrickView() in
  // 08-render-browse-columns.js:
  //   "tree"     — the existing miller-column folder browser (default)
  //   "columns"  — a flat multi-column grid of tricks only (no categories)
  var DEFAULT_SPACES = [
    { id:"space-index",     icon:"🗂️", name:{ zh:"招式庫",   jp:"トリック一覧", en:"Tricks list" },  viewMode:"tree" },
    { id:"space-kwc",       icon:"🌐", name:{ zh:"KWC",      jp:"KWC",      en:"KWC" },            viewMode:"tree" },
    { id:"space-beginner",  icon:"🔰", name:{ zh:"新手",     jp:"初心者",   en:"Beginner" },        viewMode:"tree" },
    { id:"space-goal",      icon:"🎯", name:{ zh:"目標",     jp:"ゴール",   en:"Goals" },           viewMode:"columns" }
  ];
  var VIEW_MODES = ["tree", "columns"];
  // Fixed-id "bucket" category that the drawer's 🎯 quick-toggle button
  // adds/removes a trick from — always a root category inside space-goal,
  // auto-created on first use (see ensureSpaceBucketCategory in
  // 05-data-helpers.js).
  var GOAL_BUCKET_CAT_ID = "cat-goal-bucket-root";
  // Built-in spaces the person can never delete via the space modal — the
  // rest of the app assumes the total index and goals shelves always exist.
  // Other (custom) spaces remain deletable as before.
  var UNDELETABLE_SPACE_IDS = ["space-index", "space-goal"];
  function getSpace(id){ return db.spaces.find(function(s){ return s.id===id; }); }
  function spaceLabel(id){
    var sp = getSpace(id);
    return sp ? localize(sp.name) : id;
  }

  function uid(prefix){
    return prefix + "-" + Math.random().toString(36).slice(2,9);
  }

  // Starts fully empty — a clean slate the person builds up themselves via edit mode.
  function seedData(){
    return { categories: {}, tricks: {} };
  }

  function loadDB(){
    try{
      var raw = localStorage.getItem(STORAGE_KEY);
      if(raw){
        var parsed = JSON.parse(raw);
        if(parsed && parsed.categories && parsed.tricks) return normalizeDB(parsed);
      }
    }catch(e){ /* fall through to seed */ }
    var seed = seedData();
    return normalizeDB({ categories: objVals(seed.categories), tricks: objVals(seed.tricks) });
  }

  function objVals(o){ return Object.keys(o).map(function(k){ return o[k]; }); }

  // Internal representation kept as arrays (for JSON export/import friendliness)
  function defaultViewModeFor(spaceId){
    var d = DEFAULT_SPACES.find(function(s){ return s.id===spaceId; });
    return d ? d.viewMode : "tree";
  }

  function normalizeDB(raw){
    var spaces = (Array.isArray(raw.spaces) && raw.spaces.length) ? raw.spaces.map(function(s, idx){
      return {
        id:s.id, icon: s.icon || "🗂️",
        name:{ zh:s.name&&s.name.zh||"", jp:s.name&&s.name.jp||"", en:s.name&&s.name.en||"" },
        order: typeof s.order === "number" ? s.order : idx,
        viewMode: VIEW_MODES.indexOf(s.viewMode) !== -1 ? s.viewMode : defaultViewModeFor(s.id)
      };
    }) : DEFAULT_SPACES.map(function(s, idx){
      return { id:s.id, icon:s.icon, name:{ zh:s.name.zh, jp:s.name.jp, en:s.name.en }, order: idx, viewMode: s.viewMode };
    });

    var cats = (raw.categories||[]).map(function(c, idx){
      return {
        id:c.id, parentId: c.parentId===undefined?null:c.parentId,
        name:{ zh:c.name&&c.name.zh||"", jp:c.name&&c.name.jp||"", en:c.name&&c.name.en||"" },
        order: typeof c.order === "number" ? c.order : idx,
        icon: c.icon || "",
        color: c.color || "default",
        spaceId: c.spaceId || spaces[0].id
      };
    });
    var tricks = (raw.tricks||[]).map(function(t, idx){
      var media = Array.isArray(t.media) ? t.media.map(function(m){
        var isNote = m.type === "note";
        var item = { id: m.id || uid("media"), type: isNote ? "note" : "video", title: m.title || "" };
        if(isNote){ item.content = m.content || ""; }
        else { item.url = m.url || ""; item.platform = m.platform || detectPlatform(m.url || ""); }
        return item;
      }) : [];
      // Migrate the legacy single videoUrl field (pre media[] versions) into one video entry.
      if(!media.length && t.videoUrl){
        media = [{ id: uid("media"), type:"video", title:"", url: t.videoUrl, platform: detectPlatform(t.videoUrl) }];
      }
      return {
        id:t.id, name:{ zh:t.name&&t.name.zh||"", jp:t.name&&t.name.jp||"", en:t.name&&t.name.en||"" },
        media: media, categoryIds: Array.isArray(t.categoryIds)? t.categoryIds.slice() : [],
        orderByCategory: (t.orderByCategory && typeof t.orderByCategory === "object") ? Object.assign({}, t.orderByCategory) : {},
        order: typeof t.order === "number" ? t.order : idx,
        icon: t.icon || "",
        color: t.color || "",
        proficiency: PROFICIENCY_LEVELS.indexOf(t.proficiency) !== -1 ? t.proficiency : "none"
      };
    });
    return { categories: cats, tricks: tricks, spaces: spaces };
  }

  // Persistence target depends on login state (see js/19-auth-sync.js):
  //  - logged out -> plain localStorage, exactly as before.
  //  - logged in  -> Firestore only (debounced); the browser is no longer
  //    the source of truth once an account is signed in.
  // isLoggedIn()/queueCloudSave() are defined later (19-auth-sync.js) but
  // that's fine — this function body only runs after all scripts have
  // loaded, so the reference resolves at call time, not at parse time.
  function saveDB(){
    if(typeof isLoggedIn === "function" && isLoggedIn()){
      queueCloudSave();
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
    }
  }

  var db = loadDB();

