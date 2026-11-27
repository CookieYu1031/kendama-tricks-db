"use strict";

  /* ============================================================
     TOUR DEMO — what the scripted demos stand on (engine: js/18-shell-tour.js, steps: js/18-tour-steps.js).
     - pickTourTrick(db): pure, picks the demo trick from the 00 table
     - tourSnapshot / tourRestorePlan / tourRestoreUi: the tour never changes data; the view is put back on exit
     - tourResetUi / tourSetView: instant, animation-free scene changes between steps
     - tourMakeCtx(runId): the cursor / wait / click toolkit handed to every step's demo
     A demo run is cancelled by bumping the run id: every pending wait then simply never resumes.
  ============================================================ */
  var TOUR_DEMO_SPACE = "t00";
  var TOUR_MAX_DEPTH = 4;

  /* ---------- demo trick (pure) ---------- */
  // Category ids from the table root down to containerId, [] for the table itself; null = not reachable inside t00.
  function tourCatPath(db, containerId){
    if(containerId === TOUR_DEMO_SPACE) return [];
    var byId = {}, path = [], id = containerId, guard = 0;
    (db.categories || []).forEach(function(c){ byId[c.id] = c; });
    while(id != null && guard++ < 12){
      var c = byId[id];
      if(!c || c.spaceId !== TOUR_DEMO_SPACE) return null;
      path.unshift(id);
      id = c.parentId == null ? null : c.parentId;
    }
    return id == null && path.length <= TOUR_MAX_DEPTH ? path : null;
  }
  function tourIsYoutube(url){
    var u;
    try{ u = new URL(String(url || "").trim()); }catch(e){ return false; }
    var h = u.hostname.toLowerCase().replace(/^(www|m)\./, "");
    if(h === "youtu.be") return u.pathname.length > 1;
    return h === "youtube.com" && (!!u.searchParams.get("v") || /^\/(shorts|embed|live)\/./.test(u.pathname));
  }
  function tourGripClickable(k){
    return typeof GRIP_KEYS !== "undefined" && GRIP_KEYS.indexOf(k) !== -1 && !(typeof isGripCategory === "function" && isGripCategory(k));
  }
  // Score: parts, a YouTube video without a key section (a looped one would autoplay), grip, tags. Ties: db order.
  // Returns { trickId, containerKey, path, grip, part, videoId, videoIndex, score } or null.
  function pickTourTrick(db){
    var best = null;
    ((db && db.tricks) || []).forEach(function(tr){
      if(!tr || tr.custom || !Array.isArray(tr.categoryIds)) return;
      var path = null, key = null;
      tr.categoryIds.forEach(function(cid){
        var p = tourCatPath(db, cid);
        if(p && (!path || p.length > path.length)){ path = p; key = cid; }
      });
      if(!path) return;
      var vids = (tr.media || []).filter(function(m){ return m && m.type === "video"; });
      var plain = -1, looped = false;
      vids.forEach(function(m, i){
        if(!tourIsYoutube(m.url)) return;
        if(m.loop){ looped = true; } else if(plain < 0){ plain = i; }
      });
      var parts = Array.isArray(tr.parts) ? tr.parts : [];
      var score = path.length * 0.1;
      if(parts.length) score += 8;
      if(plain >= 0) score += 8; else if(looped) score += 2;
      if(tr.grip) score += tourGripClickable(tr.grip) ? 4 : 2;
      if(tr.tagIds && tr.tagIds.length) score += 1;
      if(!best || score > best.score){
        best = { trickId: tr.id, containerKey: key, path: path, grip: tourGripClickable(tr.grip) ? tr.grip : null,
                 part: parts[0] || null, videoId: plain >= 0 ? vids[plain].id : null, videoIndex: plain, score: score };
      }
    });
    return best;
  }
  var _tourPick = null;
  // Picked when a step starts (guest data may load late); re-picked when the cached trick is gone.
  function tourDemoPick(){
    if(_tourPick && getTrick(_tourPick.trickId)) return _tourPick;
    _tourPick = pickTourTrick(db);
    return _tourPick;
  }

  /* ---------- run token ---------- */
  var _tourRunId = 0;
  function tourRunNew(){ return ++_tourRunId; }
  function tourRunAlive(id){ return id === _tourRunId && typeof _tour !== "undefined" && !!_tour; }

  /* ---------- snapshot / restore ---------- */
  function tourSnapshot(){
    var f = typeof searchFilters !== "undefined" ? searchFilters : null, inp = document.getElementById("searchInput");
    return {
      activeSpace: state.activeSpace, path: (state.path || []).slice(), editMode: !!state.editMode,
      detailTrickId: state.detailTrickId, detailInfoId: state.detailInfoId, detailContainerKey: state.detailContainerKey,
      colSort: Object.assign({}, state.colSort), colSortSpace: state.colSortSpace, // copy: render() prunes the live object
      spaceKey: localStorage.getItem(SPACE_KEY),
      searchOpen: typeof isSearchPanelOpen === "function" && isSearchPanelOpen(),
      search: f ? { grip: f.grip, parts: f.parts.slice(), classId: searchClassId, interacted: searchInteracted,
                    query: state.searchQuery, input: inp ? inp.value : "" } : null,
      clip: typeof clipLastClick !== "undefined" ? clipLastClick : null,
      multi: typeof multiSel !== "undefined" ? multiSel : null
    };
  }
  // Pure: what is still valid in db (login may swap the data mid-tour). activeSpace null = leave the current one.
  function tourRestorePlan(snap, d){
    var spaces = d.spaces || [], cats = d.categories || [], tricks = d.tricks || [], infos = d.infos || [];
    var spaceOk = spaces.some(function(s){ return s.id === snap.activeSpace; });
    var has = function(id){ return cats.some(function(c){ return c.id === id; }) || tricks.some(function(x){ return x.id === id; }); };
    var path = [];
    if(spaceOk) for(var i = 0; i < snap.path.length; i++){ if(!has(snap.path[i])) break; path.push(snap.path[i]); }
    var trick = spaceOk && snap.detailTrickId && tricks.some(function(x){ return x.id === snap.detailTrickId; }) ? snap.detailTrickId : null;
    var info = spaceOk && !trick && snap.detailInfoId && infos.some(function(x){ return x.id === snap.detailInfoId; }) ? snap.detailInfoId : null;
    return { activeSpace: spaceOk ? snap.activeSpace : null, path: path, detailTrickId: trick, detailInfoId: info,
             detailContainerKey: trick ? snap.detailContainerKey : undefined, editMode: !!snap.editMode };
  }

  /* ---------- instant scene changes ---------- */
  function tourNoAnim(el, fn){
    if(!el){ fn(); return; }
    var prev = el.style.transition;
    el.style.transition = "none";
    fn();
    void el.offsetWidth;
    el.style.transition = prev;
  }
  function tourShowOverlay(id){
    var ov = document.getElementById(id);
    if(!ov) return;
    var modal = ov.querySelector(".modal");
    tourNoAnim(modal, function(){ tourNoAnim(ov, function(){ ov.classList.add("show"); }); });
  }
  function tourHideOverlay(id, fn){
    var ov = document.getElementById(id);
    if(ov && ov.classList.contains("show")) tourNoAnim(ov, fn || function(){ ov.classList.remove("show"); });
    else if(fn && ov) fn();
  }
  // Closes search panel, drawer, video, tools, settings at once (no slide / fade left on screen).
  function tourResetUi(){
    var panel = document.getElementById("searchPanel");
    if(panel && typeof isSearchPanelOpen === "function" && isSearchPanelOpen()) tourNoAnim(panel, closeSearchPanel);
    if(typeof videoLoopStop === "function") videoLoopStop();
    var vm = document.getElementById("videoModal");
    tourHideOverlay("videoModalOverlay", function(){ document.getElementById("videoModalOverlay").classList.remove("show"); if(vm) vm.innerHTML = ""; });
    if(typeof closeTools === "function") tourHideOverlay("toolsOverlay", closeTools);
    tourHideOverlay("settingsOverlay", closeSettings);
    var dr = document.getElementById("detailDrawer");
    if(typeof drawerCloseTimer !== "undefined" && drawerCloseTimer){ clearTimeout(drawerCloseTimer); drawerCloseTimer = null; }
    clearDrawerState();
    state.detailContainerKey = undefined;
    if(dr) tourNoAnim(dr, function(){ dr.classList.remove("show"); dr.classList.remove("closing"); });
  }
  function tourSearchClean(){
    if(typeof searchFilters === "undefined") return;
    searchFilters.grip = null; searchFilters.parts = [];
    searchClassId = null; searchInteracted = false; state.searchQuery = "";
    var inp = document.getElementById("searchInput"), clr = document.getElementById("searchClear");
    if(inp) inp.value = "";
    if(clr) clr.classList.remove("show");
    if(searchChromeBuilt){ syncSearchChips(); runSearchPanel(); }
  }
  // No localStorage write: the space shown during the tour is never remembered.
  function tourSetView(spaceId, path){
    if(spaceId && getSpace(spaceId)) state.activeSpace = spaceId;
    state.path = (path || []).slice();
    state.editMode = false;
    tourSearchClean();
    render();
  }
  function tourShowSettings(){
    if(typeof renderSettingsUI === "function") renderSettingsUI();
    tourShowOverlay("settingsOverlay");
  }

  function tourRestoreUi(snap){
    if(!snap) return;
    var plan = tourRestorePlan(snap, db);
    tourResetUi();
    if(plan.activeSpace) state.activeSpace = plan.activeSpace;
    try{ if(snap.spaceKey === null) localStorage.removeItem(SPACE_KEY); else localStorage.setItem(SPACE_KEY, snap.spaceKey); }catch(e){}
    state.path = plan.path;
    state.colSort = snap.colSort; state.colSortSpace = snap.colSortSpace;
    state.editMode = plan.editMode;
    tourSearchClean();
    if(snap.search && typeof searchFilters !== "undefined"){
      var s = snap.search, inp = document.getElementById("searchInput");
      searchFilters.grip = s.grip; searchFilters.parts = s.parts.slice();
      searchClassId = s.classId; searchInteracted = s.interacted; state.searchQuery = s.query;
      if(inp) inp.value = s.input;
      var clr = document.getElementById("searchClear");
      if(clr) clr.classList.toggle("show", s.input.length > 0);
      if(searchChromeBuilt){ syncSearchChips(); runSearchPanel(); }
    }
    render();
    if(snap.searchOpen && typeof openSearchPanel === "function") openSearchPanel();
    if(plan.detailTrickId) openDrawerFor(plan.detailTrickId, plan.detailContainerKey);
    else if(plan.detailInfoId && typeof openInfoDrawer === "function") openInfoDrawer(plan.detailInfoId);
    if(typeof clipLastClick !== "undefined") clipLastClick = snap.clip;
    if(typeof multiSel !== "undefined" && multiSel !== snap.multi){
      multiSel = snap.multi;
      if(typeof multiSelSyncRows === "function") multiSelSyncRows();
    }
  }

  /* ---------- demo toolkit ---------- */
  function tourReducedMotion(){
    try{ return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches); }catch(e){ return false; }
  }
  function tourAttrSel(attr, val){ return "[" + attr + '="' + String(val).replace(/["\\]/g, "") + '"]'; }
  function tourFindEl(x){
    var el = typeof x === "string" ? document.querySelector(x) : x;
    if(!el || (el.isConnected === false)) return null;
    var r = el.getBoundingClientRect();
    return r && r.width > 0 && r.height > 0 ? el : null;
  }
  function tourFireClick(el){
    if(typeof el.click === "function") el.click();   // SVG parts have no click(): dispatch instead
    else el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  }

  function tourMakeCtx(runId){
    var reduced = tourReducedMotion();
    var ctx = { reduced: reduced };
    ctx.alive = function(){ return tourRunAlive(runId); };
    ctx.wait = function(ms){
      return new Promise(function(resolve){
        setTimeout(function(){ if(ctx.alive()) resolve(); }, reduced ? Math.min(ms, 60) : ms);
      });
    };
    // One layout frame; the timer backs it up when rAF is paused (background tab).
    ctx.frame = function(){
      return new Promise(function(resolve){
        var done = false;
        function fin(){ if(done) return; done = true; if(ctx.alive()) resolve(); }
        requestAnimationFrame(fin);
        setTimeout(fin, 80);
      });
    };
    ctx.seq = function(fns){
      return fns.reduce(function(p, fn){ return p.then(function(){ return ctx.alive() ? fn() : undefined; }); }, Promise.resolve());
    };
    ctx.each = function(list, fn){ return ctx.seq(list.map(function(x){ return function(){ return fn(x); }; })); };
    ctx.focus = function(x){ tourSetFocus(x); };
    ctx.q = tourFindEl;
    ctx.moveTo = function(el){
      if(!el) return Promise.resolve(false);
      try{ el.scrollIntoView({ block: "nearest", inline: "nearest" }); }catch(e){}
      return ctx.frame().then(function(){
        var r = tourRectOf(el);
        if(!r) return false;
        tourCursorMove(r.left + r.width / 2, r.top + r.height / 2, reduced);
        return ctx.wait(620).then(function(){ return true; });
      });
    };
    ctx.click = function(el){
      tourCursorClick();
      try{ tourFireClick(el); }catch(e){}
      tourRefocus();
      return ctx.wait(260);
    };
    // Spotlight (opts.focus) + glide to the element + click. A missing target is skipped quietly.
    ctx.tap = function(x, opts){
      var el = tourFindEl(x);
      if(!el) return Promise.resolve(false);
      if(opts && opts.focus) tourSetFocus(el);
      return ctx.moveTo(el).then(function(ok){
        if(!ok || !ctx.alive()) return false;
        return ctx.click(el).then(function(){ return true; });
      });
    };
    // Slow scroll down and back up (nothing in reduced-motion mode).
    ctx.scrollSlow = function(el, downMs, upMs){
      el = tourFindEl(el);
      var max = el ? el.scrollHeight - el.clientHeight : 0;
      if(reduced || max < 8) return Promise.resolve();
      function run(from, to, ms){
        return new Promise(function(resolve){
          var t0 = null;
          (function step(now){
            if(!ctx.alive()) return;
            if(t0 === null) t0 = now;
            var p = Math.min(1, (now - t0) / ms), e = p < .5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
            el.scrollTop = from + (to - from) * e;
            if(p < 1) requestAnimationFrame(step); else resolve();
          })(performance.now());
        });
      }
      return run(0, max, downMs).then(function(){ return ctx.wait(500); }).then(function(){ return run(max, 0, upMs); });
    };
    return ctx;
  }
