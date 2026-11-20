"use strict";

  /* ============================================================
     BROWSE — touch gesture: swipe right on the browse area to go up one level
  ============================================================ */
  var BROWSE_SWIPE_EDGE_PX = 20;     // touches starting nearer the left edge belong to the browser's own back gesture
  var BROWSE_SWIPE_MIN_DX = 60;      // commit distance
  var BROWSE_SWIPE_FLICK_V = 0.5;    // px/ms
  var BROWSE_SWIPE_FLICK_MIN_DX = 30;
  var BROWSE_SWIPE_MAX_SHIFT = 40;   // visual follow cap

  // Pure: "ignore" (vertical / leftward), "back" (go up one level), "cancel" (snap back).
  function browseSwipeDecision(dx, dy, velocityX){
    if(!(dx > 0) || Math.abs(dy) > Math.abs(dx)) return "ignore";
    if(dx >= BROWSE_SWIPE_MIN_DX) return "back";
    if(velocityX >= BROWSE_SWIPE_FLICK_V && dx >= BROWSE_SWIPE_FLICK_MIN_DX) return "back";
    return "cancel";
  }

  // Pure: may a swipe-back start here? ctx: { startX, inField, inBlocked, drawerOpen, modalOpen, dragging, pathLen }
  function browseSwipeAllowed(ctx){
    if(ctx.startX < BROWSE_SWIPE_EDGE_PX) return false;
    if(ctx.inField || ctx.inBlocked || ctx.drawerOpen || ctx.modalOpen || ctx.dragging) return false;
    return ctx.pathLen > 0;
  }

  // Shared "up one level" used by swipe and keyboard. Returns true if it did something.
  function browseGoUp(){
    if(state.detailTrickId && typeof closeDrawer === "function"){ closeDrawer(); return true; }
    if(!state.path.length) return false;
    state.path = state.path.slice(0, state.path.length - 1);
    render(RENDER_COLUMNS_ONLY);
    return true;
  }

  function browseModalOpen(){
    return !!document.querySelector(".modal-overlay.show");
  }

  (function bindBrowseSwipe(){
    var wrap = document.getElementById("millerWrap");
    if(!wrap || !wrap.addEventListener) return;
    var startX = 0, startY = 0, lastX = 0, lastT = 0, vx = 0, mode = null; // null | pending | drag | skip
    var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    function colEl(){ return wrap.querySelector ? wrap.querySelector(".m-col.mobile-active") || wrap.lastElementChild : null; }
    function snap(){
      var c = colEl();
      if(c){ c.style.transition = ""; c.style.transform = ""; }
    }

    wrap.addEventListener("touchstart", function(ev){
      mode = null;
      if(ev.touches.length !== 1) return;
      var tg = ev.target, t0 = ev.touches[0];
      var ok = browseSwipeAllowed({
        startX: t0.clientX,
        inField: !!(tg && tg.closest && tg.closest("input, textarea, select, [contenteditable]")),
        inBlocked: !!(tg && tg.closest && tg.closest("#searchPanel, .space-rail, .modal-overlay")),
        drawerOpen: !!state.detailTrickId,
        modalOpen: browseModalOpen(),
        dragging: !!document.querySelector(".dragging"),
        pathLen: state.path.length
      });
      if(!ok){ mode = "skip"; return; }
      startX = lastX = t0.clientX; startY = t0.clientY; lastT = Date.now(); vx = 0;
      mode = "pending";
    }, { passive: true });

    wrap.addEventListener("touchmove", function(ev){
      if(mode !== "pending" && mode !== "drag") return;
      if(document.querySelector(".dragging")){ mode = "skip"; snap(); return; }
      var t1 = ev.touches[0], dx = t1.clientX - startX, dy = t1.clientY - startY;
      if(mode === "pending"){
        if(Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
        if(browseSwipeDecision(dx, dy, 0) === "ignore"){ mode = "skip"; return; }
        mode = "drag";
      }
      var now = Date.now();
      if(now > lastT) vx = (t1.clientX - lastX) / (now - lastT);
      lastX = t1.clientX; lastT = now;
      if(!reduce){
        var c = colEl();
        if(c){ c.style.transition = "none"; c.style.transform = "translateX(" + Math.min(Math.max(0, dx), BROWSE_SWIPE_MAX_SHIFT) + "px)"; }
      }
    }, { passive: true });

    function end(cancelled){
      var wasDrag = mode === "drag", dx = lastX - startX;
      mode = null;
      if(!wasDrag) return;
      snap();
      if(!cancelled && browseSwipeDecision(dx, 0, vx) === "back") browseGoUp();
    }
    wrap.addEventListener("touchend", function(){ end(false); });
    wrap.addEventListener("touchcancel", function(){ end(true); });
  })();
