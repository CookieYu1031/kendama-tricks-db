"use strict";

  /* ============================================================
     RANDOM TRICK — pure logic (tests/random-pick.test.js). UI: js/82-random-panel.js.

     conditions: { space, folder|null, grip|null, parts:[] (every part must match),
                   classId|null, rates:[RATE_LEVELS... and/or "none"], count:1..10 }
     Class tag choice: when classId is set the pool is "tricks carrying that tag id OR (when grip /
     parts filters are non-empty) tricks matching the grip / parts filters". The UI also copies the
     tag's combo into grip / parts (like the search panel), so the combo is what the OR side tests.
     Rate filter is personal data: callers pass opts.ignoreRate for guests.
  ============================================================ */
  var RANDOM_COND_KEY = "kendama-random-cond-v1";
  var RANDOM_HIST_KEY = "kendama-random-hist-v1";
  var RANDOM_HIST_MAX = 10;
  var RANDOM_COUNT_MAX = 10;
  var RANDOM_RATE_KEYS = ["none"].concat(RATE_LEVELS);

  function defaultRandomConds(){
    return { space: "t00", folder: null, grip: null, parts: [], classId: null,
             rates: RANDOM_RATE_KEYS.slice(), count: 3 };
  }

  // Any stored / partial object -> a valid conditions object. validSpaceIds: ids the user may pick.
  function normalizeRandomConds(raw, validSpaceIds){
    var d = defaultRandomConds();
    raw = raw && typeof raw === "object" ? raw : {};
    var spaces = validSpaceIds && validSpaceIds.length ? validSpaceIds : [d.space];
    d.space = spaces.indexOf(raw.space) !== -1 ? raw.space : spaces[0];
    d.folder = typeof raw.folder === "string" && raw.folder ? raw.folder : null;
    d.grip = GRIP_KEYS.indexOf(raw.grip) !== -1 ? raw.grip : null;
    d.parts = Array.isArray(raw.parts) ? raw.parts.filter(function(p, i, a){ return PART_KEYS.indexOf(p) !== -1 && a.indexOf(p) === i; }) : [];
    d.classId = typeof raw.classId === "string" && raw.classId ? raw.classId : null;
    if(Array.isArray(raw.rates)) d.rates = RANDOM_RATE_KEYS.filter(function(k){ return raw.rates.indexOf(k) !== -1; });
    var n = Math.floor(Number(raw.count));
    d.count = isFinite(n) ? Math.max(1, Math.min(RANDOM_COUNT_MAX, n)) : d.count;
    return d;
  }

  function loadRandomConds(validSpaceIds){
    var raw = null;
    try { raw = JSON.parse(localStorage.getItem(RANDOM_COND_KEY) || "null"); } catch(e){ raw = null; }
    return normalizeRandomConds(raw, validSpaceIds);
  }
  function saveRandomConds(c){
    try { localStorage.setItem(RANDOM_COND_KEY, JSON.stringify(c)); } catch(e){}
  }

  // Is the entry inside the chosen table / folder (any depth below the folder)? locs: [{spaceId, path}].
  function randomInScope(locs, conds){
    return (locs || []).some(function(l){
      if(l.spaceId !== conds.space) return false;
      return !conds.folder || l.path.indexOf(conds.folder) !== -1;
    });
  }

  // index: buildSearchIndex entries. opts: { rateOf(id)->level|null, ignoreRate, tagIds?:ignored,
  // locsFor(entry)->locs (default entry.locs; the UI passes full locs for the favorites table) }.
  // -> array of trick ids (index order).
  function buildRandomPool(index, conds, opts){
    opts = opts || {};
    var filters = { grip: conds.grip, parts: conds.parts };
    var hasFilter = !!(conds.grip || conds.parts.length);
    var useRate = !opts.ignoreRate && conds.rates.length < RANDOM_RATE_KEYS.length;
    var out = [];
    (index || []).forEach(function(e){
      if(!randomInScope(opts.locsFor ? opts.locsFor(e) : e.locs, conds)) return;
      var fOk = matchEntry(e, { text: "", tags: [] }, filters, null);
      if(conds.classId){
        var tagged = e.tagIds.indexOf(conds.classId) !== -1;
        if(!(tagged || (hasFilter && fOk))) return;
      } else if(!fOk) return;
      if(useRate){
        var r = opts.rateOf ? opts.rateOf(e.id) : null;
        if(conds.rates.indexOf(r || "none") === -1) return;
      }
      out.push(e.id);
    });
    return out;
  }

  /* ---------- draw ---------- */
  function newRandomRound(){ return { used: {} }; }
  function randomRemaining(pool, round){
    return pool.filter(function(id){ return !round.used[id]; });
  }

  // Picks up to `count` distinct ids not yet used this round and marks them used.
  // -> { ids, exhausted } ; exhausted = nothing left to draw before this call (ids empty).
  function drawRandom(pool, count, round, rng){
    rng = rng || Math.random;
    var avail = randomRemaining(pool, round);
    if(!avail.length) return { ids: [], exhausted: true };
    var n = Math.min(Math.max(1, count), avail.length), ids = [];
    for(var i = 0; i < n; i++){
      var j = i + Math.floor(rng() * (avail.length - i));
      var tmp = avail[i]; avail[i] = avail[j]; avail[j] = tmp;
      ids.push(avail[i]);
      round.used[avail[i]] = true;
    }
    return { ids: ids, exhausted: false };
  }

  // One replacement for a single card: unused trick from the pool, marked used. null = none left.
  function rerollRandom(pool, round, currentId, rng){
    rng = rng || Math.random;
    var avail = randomRemaining(pool, round).filter(function(id){ return id !== currentId; });
    if(!avail.length) return null;
    var pick = avail[Math.floor(rng() * avail.length)];
    round.used[pick] = true;
    return pick;
  }

  /* ---------- history: newest first, {at, ids} ---------- */
  function pushRandomHistory(list, ids, now){
    var out = [{ at: now == null ? Date.now() : now, ids: ids.slice() }].concat(list || []);
    return out.slice(0, RANDOM_HIST_MAX);
  }
  function normalizeRandomHistory(raw){
    if(!Array.isArray(raw)) return [];
    return raw.filter(function(h){ return h && typeof h.at === "number" && Array.isArray(h.ids); })
      .map(function(h){ return { at: h.at, ids: h.ids.filter(function(x){ return typeof x === "string"; }) }; })
      .slice(0, RANDOM_HIST_MAX);
  }
  function loadRandomHistory(){
    try { return normalizeRandomHistory(JSON.parse(localStorage.getItem(RANDOM_HIST_KEY) || "[]")); } catch(e){ return []; }
  }
  function saveRandomHistory(list){
    try { localStorage.setItem(RANDOM_HIST_KEY, JSON.stringify(list)); } catch(e){}
  }
