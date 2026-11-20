"use strict";

  /* ============================================================
     BROWSE — narrow layout swipe-back handle (v0.8.1)
     Narrow view shows one column level. A thin vertical line sits in the gap
     between the left rail and that column; dragging it right slides the current
     level off to the right while the parent level (already rendered underneath)
     is revealed, like closing a drawer. Tap on the line only shows a hint arrow.
  ============================================================ */
  var SWIPE_BACK_COMMIT_RATIO = 0.35;  // dragged farther than this share of the width = go back
  var SWIPE_BACK_FLICK_V = 0.5;        // px/ms
  var SWIPE_BACK_TAP_PX = 6;           // movement under this = a tap
  var SWIPE_BACK_ANIM_MS = 250;

  // Pure: how far the top layer follows the finger (never left of rest, never past the width).
  function swipeBackClamp(dx, width){
    if(!(dx > 0)) return 0;
    return dx > width ? width : dx;
  }
  // Pure: "commit" (slide out + go up) or "cancel" (spring back).
  function swipeBackDecision(dx, width, velocity){
    if(!(width > 0) || !(dx > 0)) return "cancel";
    if(dx / width > SWIPE_BACK_COMMIT_RATIO) return "commit";
    if(velocity > SWIPE_BACK_FLICK_V) return "commit";
    return "cancel";
  }
  // Pure: is the handle shown? ctx: { narrow, treeView, columnCount }
  function swipeBackAvailable(ctx){
    return !!(ctx.narrow && ctx.treeView && ctx.columnCount > 1);
  }

  var swipeBackEl = null, swipeHintEl = null, swipeHintTimer = null, swipeBackBusy = false;

  function swipeBackWrap(){ return document.getElementById("millerWrap"); }
  function swipeBackTopCol(){
    var w = swipeBackWrap();
    return w && w.querySelector ? w.querySelector(".m-col.mobile-active") : null;
  }
  function swipeBackUnderCol(){
    var w = swipeBackWrap();
    return w && w.querySelector ? w.querySelector(".m-col.mobile-under") : null;
  }
  function swipeBackReduced(){
    return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }

  // Called from renderColumns(): create / place / show or hide the handle.
  function syncSwipeBack(columnCount, treeView){
    var wrap = swipeBackWrap();
    if(!wrap || !wrap.parentNode) return;
    var show = swipeBackAvailable({ narrow: isNarrowViewport(), treeView: treeView, columnCount: columnCount });
    if(!swipeBackEl){
      if(!show) return;
      swipeBackEl = document.createElement("div");
      swipeBackEl.className = "swipe-back-handle";
      swipeBackEl.setAttribute("role", "button");
      swipeBackEl.innerHTML = '<span class="swipe-back-line"></span>';
      bindSwipeBackHandle(swipeBackEl);
      wrap.parentNode.appendChild(swipeBackEl);
    }
    swipeBackEl.setAttribute("aria-label", t("backToList"));
    swipeBackEl.style.display = show ? "" : "none";
    if(show){
      swipeBackEl.style.top = wrap.offsetTop + "px";
      swipeBackEl.style.height = wrap.offsetHeight + "px";
    } else hideSwipeHint();
  }

  function showSwipeHint(){
    if(!swipeBackEl) return;
    if(!swipeHintEl){
      swipeHintEl = document.createElement("div");
      swipeHintEl.className = "swipe-back-hint";
      swipeHintEl.innerHTML = ICON_CHEVRON;
      swipeBackEl.parentNode.appendChild(swipeHintEl);
    }
    swipeHintEl.style.top = (swipeBackEl.offsetTop + swipeBackEl.offsetHeight / 2 - 18) + "px";
    swipeHintEl.classList.remove("show");
    void swipeHintEl.offsetWidth; // restart the nudge animation
    swipeHintEl.classList.add("show");
    clearTimeout(swipeHintTimer);
    swipeHintTimer = setTimeout(hideSwipeHint, 1200);
  }
  function hideSwipeHint(){
    clearTimeout(swipeHintTimer);
    if(swipeHintEl) swipeHintEl.classList.remove("show");
  }

  function swipeBackSetShift(top, px, animate){
    var tr = animate ? "transform " + SWIPE_BACK_ANIM_MS + "ms var(--ease)" : "none";
    var val = px ? "translate3d(" + px + "px,0,0)" : "";
    top.style.transition = tr; top.style.transform = val;
    if(swipeBackEl){ swipeBackEl.style.transition = tr; swipeBackEl.style.transform = val; }
  }
  function swipeBackReset(wrap, top){
    if(wrap) wrap.classList.remove("swipe-live");
    if(top){ top.style.transition = ""; top.style.transform = ""; }
    if(swipeBackEl){ swipeBackEl.style.transition = ""; swipeBackEl.style.transform = ""; swipeBackEl.classList.remove("pressed"); }
    swipeBackBusy = false;
  }
  // Pop one level; keep the revealed parent's scroll position (its rows are rebuilt).
  function swipeBackCommit(wrap, top){
    var under = swipeBackUnderCol(), scroll = 0;
    var itemsEl = under && under.querySelector ? under.querySelector(".col-items") : null;
    if(itemsEl) scroll = itemsEl.scrollTop;
    state.path = state.path.slice(0, state.path.length - 1);
    swipeBackReset(wrap, top);
    render(RENDER_COLUMNS_ONLY);
    var now = wrap.querySelector(".m-col.mobile-active .col-items");
    if(now) now.scrollTop = scroll;
  }

  function bindSwipeBackHandle(h){
    var startX = 0, lastX = 0, lastT = 0, vx = 0, base = 0, restLeft = 0, width = 0;
    var active = false, moved = false, pid = null;

    h.style.touchAction = "none";
    h.addEventListener("pointerdown", function(ev){
      if(swipeBackBusy || (ev.button != null && ev.button > 0)) return;
      var wrap = swipeBackWrap(), top = swipeBackTopCol();
      if(!wrap || !top) return;
      var cs = window.getComputedStyle ? window.getComputedStyle(wrap) : null;
      restLeft = wrap.getBoundingClientRect().left + (cs ? parseFloat(cs.paddingLeft) || 0 : 0);
      width = wrap.clientWidth;
      base = Math.max(0, top.getBoundingClientRect().left - restLeft); // pick up a spring-back mid-flight
      startX = lastX = ev.clientX; lastT = Date.now(); vx = 0;
      active = true; moved = false; pid = ev.pointerId;
      h.classList.add("pressed");
      try { h.setPointerCapture(ev.pointerId); } catch(e){}
      ev.preventDefault();
    });
    h.addEventListener("pointermove", function(ev){
      if(!active || ev.pointerId !== pid) return;
      var dx = ev.clientX - startX;
      if(!moved && Math.abs(dx) < SWIPE_BACK_TAP_PX) return;
      var wrap = swipeBackWrap(), top = swipeBackTopCol();
      if(!wrap || !top) return;
      if(!moved){ moved = true; hideSwipeHint(); wrap.classList.add("swipe-live"); }
      var now = Date.now();
      if(now > lastT) vx = (ev.clientX - lastX) / (now - lastT);
      lastX = ev.clientX; lastT = now;
      swipeBackSetShift(top, swipeBackClamp(base + dx, width), false);
    });
    function finish(ev, cancelled){
      if(!active || (ev && ev.pointerId !== pid)) return;
      active = false;
      var wrap = swipeBackWrap(), top = swipeBackTopCol();
      try { h.releasePointerCapture(pid); } catch(e){}
      if(!moved){ // tap: hint only, never navigates
        h.classList.remove("pressed");
        if(!cancelled) showSwipeHint();
        return;
      }
      if(!wrap || !top){ swipeBackReset(wrap, top); return; }
      var shift = swipeBackClamp(base + (lastX - startX), width);
      var go = !cancelled && swipeBackDecision(shift, width, vx) === "commit";
      if(swipeBackReduced()){
        if(go) swipeBackCommit(wrap, top); else swipeBackReset(wrap, top);
        return;
      }
      swipeBackBusy = go;
      swipeBackSetShift(top, go ? width : 0, true);
      var done = false;
      function after(){
        if(done) return;
        done = true;
        top.removeEventListener("transitionend", onEnd);
        if(go) swipeBackCommit(wrap, top); else swipeBackReset(wrap, top);
      }
      function onEnd(e){ if(e.target === top && e.propertyName === "transform") after(); }
      top.addEventListener("transitionend", onEnd);
      setTimeout(after, SWIPE_BACK_ANIM_MS + 80);
    }
    h.addEventListener("pointerup", function(ev){ finish(ev, false); });
    h.addEventListener("pointercancel", function(ev){ finish(ev, true); });
  }

  window.addEventListener("resize", function(){
    var wrap = swipeBackWrap();
    if(swipeBackEl && wrap){
      swipeBackEl.style.top = wrap.offsetTop + "px";
      swipeBackEl.style.height = wrap.offsetHeight + "px";
      if(!isNarrowViewport()) swipeBackEl.style.display = "none";
    }
  });
