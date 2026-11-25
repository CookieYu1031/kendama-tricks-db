"use strict";

  /* ============================================================
     SHELL TOUR — "site introduction": a spotlight card plus a scripted cursor that really operates the page.
     This file: pure decisions, card / spotlight / cursor, step navigation, auto trigger.
     Strings and step table: js/18-tour-steps.js. Demo trick, snapshot / restore, cursor toolkit: js/18-tour-demo.js.
     Exports: startTour(), maybeStartTour(user), isTourActive(), endTour(), tourGo(d),
              tourStepsFor(env), decideAutoTour(user, seen), isTouchDevice(env), tourEnv()
  ============================================================ */
  var TOUR_SEEN_KEY = "kendama-tour-seen-v1";
  var TOUR_SEEN_UID_KEY = "kendama-tour-seen-uid-v1"; // legacy (first-login tour): read only

  /* ---------- pure logic ---------- */
  // Coarse primary pointer = touch device; only without matchMedia fall back to maxTouchPoints.
  function isTouchDevice(env){
    env = env || {};
    if(typeof env.matchMedia === "function"){
      try{ return !!env.matchMedia("(pointer: coarse)").matches; }catch(e){}
    }
    return (env.maxTouchPoints || 0) > 0;
  }

  var _tourWin = (typeof window !== "undefined" && window) || {};
  function tourEnv(){
    return {
      matchMedia: typeof _tourWin.matchMedia === "function" ? function(q){ return _tourWin.matchMedia(q); } : null,
      maxTouchPoints: (typeof navigator !== "undefined" && navigator.maxTouchPoints) || 0
    };
  }
  function tourStandalone(){
    try{ if(typeof pwaEnv === "function") return !!pwaEnv().standalone; }catch(e){}
    try{ if(_tourWin.matchMedia && _tourWin.matchMedia("(display-mode: standalone)").matches) return true; }catch(e){}
    return !!(typeof navigator !== "undefined" && navigator.standalone);
  }
  function tourStepEnv(){
    return {
      signedIn: typeof isGuest === "function" ? !isGuest() : false,
      touch: isTouchDevice(tourEnv()),
      standalone: tourStandalone()
    };
  }

  // Steps that apply to this visitor. env = { signedIn, touch, standalone }.
  function tourStepsFor(env){
    env = env || {};
    return (typeof TOUR_STEPS !== "undefined" ? TOUR_STEPS : []).filter(function(s){ return !(s.skip && s.skip(env)); });
  }

  // seen: { basic:boolean, uids:string[] }. First visit only: any earlier tour record (either key) = never again.
  function decideAutoTour(user, seen){
    seen = seen || {};
    if(seen.basic || (seen.uids && seen.uids.length)) return null;
    return { kind: "intro", markBasic: true };
  }
  function readTourSeen(){
    var uids = [], basic = false;
    try{
      var a = JSON.parse(localStorage.getItem(TOUR_SEEN_UID_KEY) || "[]");
      if(Array.isArray(a)) uids = a;
    }catch(e){}
    try{ basic = !!localStorage.getItem(TOUR_SEEN_KEY); }catch(e){}
    return { basic: basic, uids: uids };
  }
  function writeTourSeen(decision){
    try{ if(decision && decision.markBasic) localStorage.setItem(TOUR_SEEN_KEY, "1"); }catch(e){}
  }

  // A step offers a demo (and the replay button) only when the demo trick has what it needs.
  function tourStepHasDemo(s){
    if(!s || !s.demo) return false;
    if(!s.needs) return true;
    var p = tourDemoPick();
    if(!p) return false;
    if(s.needs === "video") return !!p.videoId;
    if(s.needs === "search") return !!(p.grip || p.part);
    return true;
  }

  /* ---------- geometry (CSS px: html{zoom} makes rects come back scaled) ---------- */
  var _tour = null; // { steps, i, env, snap, root, hole, cursor, card, ..., focus, layoutKey }

  function isTourActive(){ return !!_tour; }
  function tourZoom(){
    var z = parseFloat(window.getComputedStyle(document.documentElement).zoom);
    return z > 0 ? z : 1;
  }
  function tourRectOf(el){
    var r = el.getBoundingClientRect();
    if(!r || r.width < 1 || r.height < 1) return null;
    var z = tourZoom();
    return { left: r.left / z, top: r.top / z, right: r.right / z, bottom: r.bottom / z, width: r.width / z, height: r.height / z };
  }
  function tourTargetRect(x){
    if(!x) return null;
    var el = typeof x === "string" ? document.querySelector(x) : x;
    if(!el || el.isConnected === false) return null;
    var cs = window.getComputedStyle(el);
    if(cs.display === "none" || cs.visibility === "hidden") return null;
    var r = tourRectOf(el), z = tourZoom(); // off-screen (a closed drawer) = no spotlight
    return r && r.right > 4 && r.bottom > 4 && r.left < window.innerWidth / z - 4 && r.top < window.innerHeight / z - 4 ? r : null;
  }

  // The card never follows the spotlight: docked bottom-centre for the whole tour (anchored by its bottom
  // edge, so the buttons stay put) and compact on phones. Only the hole and the cursor move.
  function tourPlaceCard(card){
    var z = tourZoom(), vw = window.innerWidth / z, G = vw < 600 ? 10 : 20;
    var cw = Math.min(vw < 600 ? 420 : 460, vw - G * 2);
    card.classList.toggle("tour-compact", vw < 600);
    card.style.width = cw + "px";
    card.style.left = Math.round((vw - cw) / 2) + "px";
  }

  function tourLayout(force){
    if(!_tour) return;
    var rect = tourTargetRect(_tour.focus);
    var key = (rect ? [rect.left, rect.top, rect.width, rect.height].map(Math.round).join(",") : "-") + "|" +
      window.innerWidth + "x" + window.innerHeight + "|" + tourZoom() + "|" + _tour.cardVer;
    if(force !== true && key === _tour.layoutKey) return;
    _tour.layoutKey = key;
    var hole = _tour.hole;
    if(rect){
      var pad = 6;
      hole.style.display = "block";
      hole.style.left = Math.round(rect.left - pad) + "px";
      hole.style.top = Math.round(rect.top - pad) + "px";
      hole.style.width = Math.round(rect.width + pad * 2) + "px";
      hole.style.height = Math.round(rect.height + pad * 2) + "px";
      _tour.root.classList.remove("tour-nohole");
    } else {
      hole.style.display = "none";
      _tour.root.classList.add("tour-nohole");
    }
    tourPlaceCard(_tour.card);
  }
  // Follows slide-in animations and viewport changes (also across the 860px breakpoint).
  function tourTick(){
    if(!_tour) return;
    _tour.raf = requestAnimationFrame(tourTick);
    tourLayout();
  }
  function tourOnResize(){ tourLayout(true); }

  // Spotlight target (selector or element); scrolled into view once.
  function tourSetFocus(x){
    if(!_tour) return;
    _tour.focus = x || null;
    var el = typeof x === "string" ? document.querySelector(x) : x;
    if(el && el.scrollIntoView){ try{ el.scrollIntoView({ block: "nearest", inline: "nearest" }); }catch(e){} }
    tourLayout();
  }
  // The demo may leave focus in the search box: hand it back to the card (no keyboard on touch, no typing into search).
  function tourRefocus(){
    if(_tour && _tour.next){ try{ _tour.next.focus({ preventScroll: true }); }catch(e){} }
  }

  /* ---------- cursor ---------- */
  function tourCursorMove(x, y, jump){
    var c = _tour && _tour.cursor;
    if(!c) return;
    var first = !c.classList.contains("show");
    c.classList.add("jump");
    c.style.transform = "translate(" + Math.round(x) + "px," + Math.round(y) + "px)";
    c.classList.add("show");
    if(!(first || jump)){ c.classList.remove("jump"); return; }
    void c.offsetWidth;
    if(!jump) c.classList.remove("jump");
  }
  function tourCursorClick(){
    var c = _tour && _tour.cursor;
    if(!c) return;
    c.classList.remove("click");
    void c.offsetWidth;
    c.classList.add("click");
  }

  /* ---------- card ---------- */
  function tourMake(tag, cls, parent, text){
    var el = document.createElement(tag);
    if(cls) el.className = cls;
    if(text) el.textContent = text;
    if(parent) parent.appendChild(el);
    return el;
  }
  function tourRender(){
    var s = _tour.steps[_tour.i], last = _tour.i === _tour.steps.length - 1, env = _tour.env;
    _tour.titleEl.textContent = t(s.title);
    _tour.bodyEl.innerHTML = t(typeof s.body === "function" ? s.body(env) : s.body); // trusted constants (<b>/<kbd>)
    _tour.counter.textContent = t("tourCounter").replace("{n}", _tour.i + 1).replace("{total}", _tour.steps.length);
    _tour.replay.style.display = tourStepHasDemo(s) ? "" : "none";
    _tour.skip.style.display = last ? "none" : "";
    _tour.prev.style.visibility = _tour.i === 0 ? "hidden" : "visible";
    _tour.next.textContent = t(last ? "tourDone" : "tourNext");
    var login = !!s.login;
    _tour.login.style.display = login ? "" : "none";
    _tour.next.className = "btn btn-sm " + (login ? "btn-ghost" : "btn-primary");
    _tour.cardVer++;
    tourLayout(true);
    _tour.card.classList.remove("tour-in");
    void _tour.card.offsetWidth;
    _tour.card.classList.add("tour-in");
  }

  // Enter (or replay) the current step: cancel the previous demo, clear the scene, prepare, play.
  function tourEnterStep(){
    var runId = tourRunNew(), s = _tour.steps[_tour.i], ctx = tourMakeCtx(runId), has = tourStepHasDemo(s);
    _tour.cursor.classList.remove("show");
    tourResetUi();
    _tour.focus = typeof s.sel === "function" ? s.sel(_tour.env) : (s.sel || null);
    tourRender();
    try{
      if(s.prep && (has || !s.needs)) s.prep(ctx); else tourPrepNeutral();
    }catch(e){ if(typeof console !== "undefined") console.warn("tour prep", e); }
    if(!_tour) return;
    tourSetFocus(_tour.focus);
    tourRefocus();
    if(!has) return;
    var p;
    try{ p = s.demo(ctx); }catch(e){ return; }
    Promise.resolve(p).then(function(){
      if(!tourRunAlive(runId)) return;
      _tour.cursor.classList.remove("show");
      tourRefocus();
    }, function(){});
  }

  function tourGo(d){
    if(!_tour) return;
    var n = _tour.i + d;
    if(n >= _tour.steps.length){ endTour(); return; }
    if(n < 0) return;
    _tour.i = n;
    tourEnterStep();
  }
  function tourReplay(){ if(_tour) tourEnterStep(); }

  function tourKey(e){
    if(!_tour) return;
    var k = e.key;
    e.stopPropagation();
    if(k === "Escape" || k === "ArrowLeft" || k === "ArrowRight") e.preventDefault();
    if(k === "Enter"){
      var a = document.activeElement;
      if(a && a !== _tour.next && _tour.card.contains(a)) return; // a focused card button takes its own Enter
      e.preventDefault();
    }
    if(k === "Escape") endTour();
    else if(k === "ArrowLeft") tourGo(-1);
    else if(k === "ArrowRight" || k === "Enter") tourGo(1);
  }

  function endTour(){
    if(!_tour) return;
    var tour = _tour;
    _tour = null;          // running demos stop here: tourRunAlive() is false from now on
    tourRunNew();
    document.removeEventListener("keydown", tourKey, true);
    window.removeEventListener("resize", tourOnResize);
    if(tour.raf) cancelAnimationFrame(tour.raf);
    if(tour.root.parentNode) tour.root.parentNode.removeChild(tour.root);
    try{ tourRestoreUi(tour.snap); }catch(e){ if(typeof console !== "undefined") console.warn("tour restore", e); }
  }

  // Not a parameter-driven tour any more: always the site introduction (old callers may still pass a kind).
  function startTour(){
    if(_tour) endTour();
    var env = tourStepEnv(), steps = tourStepsFor(env);
    if(!steps.length) return;
    var snap = tourSnapshot();
    var root = tourMake("div", "tour-root", document.body);
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-modal", "true");
    tourMake("div", "tour-dim", root);
    var hole = tourMake("div", "tour-hole", root);
    var cursor = tourMake("div", "tour-cursor", root);
    var card = tourMake("div", "tour-card", root);
    var titleEl = tourMake("div", "tour-title", card);
    var bodyEl = tourMake("div", "tour-body", card);
    var foot = tourMake("div", "tour-foot", card);
    var meta = tourMake("span", "tour-meta", foot);
    var counter = tourMake("span", "tour-counter", meta);
    var replay = tourMake("button", "btn btn-ghost btn-sm tour-replay", meta, "↻ " + t("tourReplay"));
    var btns = tourMake("span", "tour-btns", foot);
    var skip = tourMake("button", "btn btn-ghost btn-sm tour-skip", btns, t("tourSkip"));
    var prev = tourMake("button", "btn btn-ghost btn-sm", btns, t("tourPrev"));
    var next = tourMake("button", "btn btn-primary btn-sm", btns);
    var login = tourMake("button", "btn btn-primary btn-sm tour-login", btns, t("tourLogin"));
    [replay, skip, prev, next, login].forEach(function(b){ b.type = "button"; });
    _tour = { steps: steps, i: 0, env: env, snap: snap, root: root, hole: hole, cursor: cursor, card: card, titleEl: titleEl, bodyEl: bodyEl,
              counter: counter, replay: replay, prev: prev, next: next, skip: skip, login: login, focus: null, layoutKey: "", cardVer: 0, raf: 0 };
    skip.addEventListener("click", endTour);
    prev.addEventListener("click", function(){ tourGo(-1); });
    next.addEventListener("click", function(){ tourGo(1); });
    replay.addEventListener("click", tourReplay);
    login.addEventListener("click", function(){ // sign-in popup must start inside this click (popup blockers)
      endTour();
      if(typeof authLogin === "function") authLogin();
    });
    document.addEventListener("keydown", tourKey, true);
    window.addEventListener("resize", tourOnResize);
    tourEnterStep();
    _tour.raf = requestAnimationFrame(tourTick);
    next.focus();
  }

  /* ---------- auto trigger (first visit only) ---------- */
  var _tourAutoDone = { guest: false, user: false };

  function maybeStartTour(user){
    var key = user ? "user" : "guest";
    if(_tourAutoDone[key]) return;
    _tourAutoDone[key] = true;
    var attempt = function(retry){
      if(_tour) return;
      var decision = decideAutoTour(user, readTourSeen());
      if(!decision) return;
      if(document.querySelector(".modal-overlay.show")){
        if(retry) setTimeout(function(){ attempt(false); }, 2500);
        return;
      }
      writeTourSeen(decision);
      startTour();
    };
    setTimeout(function(){ attempt(true); }, 600);
  }
