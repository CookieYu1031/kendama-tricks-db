"use strict";

  /* ============================================================
     BROWSE — phone swipe-back (v0.14.8)
     Phone view shows one column level. A right-swipe starting anywhere on the
     column area drags the current level 1:1 to the right, revealing the parent
     level (rendered underneath, clipped to the strip the moving card does not cover). Release
     past ~30% of the width or with a fast flick = go up one level, else spring back.
  ============================================================ */
  var SWIPE_BACK_COMMIT_RATIO = 0.3;   // dragged farther than this share of the width = go back
  var SWIPE_BACK_FLICK_V = 0.5;        // px/ms
  var SWIPE_BACK_LOCK_PX = 10;         // horizontal travel before the gesture may lock
  var SWIPE_BACK_RATIO = 1.5;          // |dx| must exceed this * |dy| to lock as horizontal
  var SWIPE_BACK_VERT_PX = 10;         // vertical travel (with no lock) that gives the gesture up
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
  // Pure: is swipe-back possible? ctx: { narrow, treeView, columnCount }
  function swipeBackAvailable(ctx){
    return !!(ctx.narrow && ctx.treeView && ctx.columnCount > 1);
  }
  // Pure: classify the movement so far. "lock" = rightward horizontal swipe,
  // "abort" = vertical scroll or leftward (not ours), "pending" = keep watching.
  function swipeBackIntent(dx, dy){
    var ax = Math.abs(dx), ay = Math.abs(dy);
    if(dx > SWIPE_BACK_LOCK_PX && ax > SWIPE_BACK_RATIO * ay) return "lock";
    if(dx < -SWIPE_BACK_LOCK_PX) return "abort";
    if(ay > SWIPE_BACK_VERT_PX && ay >= ax / SWIPE_BACK_RATIO) return "abort";
    return "pending";
  }

  var swipeBackReady = false, swipeBackBound = false, swipeBackBusy = false;
  var browseSkipLeaveAnim = false; // set while a swipe already animated the slide-out

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

  // Called from renderColumns(): remember whether a swipe is possible; bind once.
  function syncSwipeBack(columnCount, treeView){
    swipeBackReady = swipeBackAvailable({ narrow: isPhoneViewport(), treeView: treeView, columnCount: columnCount });
    var wrap = swipeBackWrap();
    if(!swipeBackBound && wrap){ swipeBackBound = true; bindSwipeBack(wrap); }
  }

  function swipeBackSetShift(top, px, animate){
    top.style.transition = animate ? "transform " + SWIPE_BACK_ANIM_MS + "ms var(--ease)" : "none";
    top.style.transform = px ? "translate3d(" + px + "px,0,0)" : "";
    // --swipe-x drives the clip of the revealed parent (css/browse-motion.css); registered via @property so it can transition.
    var w = top.parentNode;
    if(w && w.style){
      w.style.transition = animate ? "--swipe-x " + SWIPE_BACK_ANIM_MS + "ms var(--ease)" : "none";
      w.style.setProperty("--swipe-x", (px || 0) + "px");
    }
  }
  function swipeBackReset(wrap, top){
    if(wrap){ wrap.classList.remove("swipe-live"); wrap.style.transition = ""; wrap.style.removeProperty("--swipe-x"); }
    if(top){ top.style.transition = ""; top.style.transform = ""; }
    swipeBackBusy = false;
  }
  // Pop one level; keep the revealed parent's scroll position (its rows are rebuilt).
  function swipeBackCommit(wrap, top){
    var under = swipeBackUnderCol(), scroll = 0;
    var itemsEl = under && under.querySelector ? under.querySelector(".col-items") : null;
    if(itemsEl) scroll = itemsEl.scrollTop;
    state.path = state.path.slice(0, state.path.length - 1);
    swipeBackReset(wrap, top);
    browseSkipLeaveAnim = true;
    render(RENDER_COLUMNS_ONLY);
    browseSkipLeaveAnim = false;
    var now = wrap.querySelector(".m-col.mobile-active .col-items");
    if(now) now.scrollTop = scroll;
  }

  function bindSwipeBack(wrap){
    var startX = 0, startY = 0, lastX = 0, lastT = 0, vx = 0, lockDx = 0, width = 0;
    var tracking = false, locked = false, pid = null;

    function stop(){ tracking = false; locked = false; }

    wrap.addEventListener("pointerdown", function(ev){
      tracking = false; locked = false;
      if(!swipeBackReady || swipeBackBusy || !isPhoneViewport()) return;
      if(ev.pointerType === "mouse") return;
      if(typeof browseModalOpen === "function" && browseModalOpen()) return;
      if(state.detailTrickId || !state.path.length) return;
      if(ev.target.closest && ev.target.closest("input,textarea,select")) return;
      if(!swipeBackTopCol()) return;
      width = wrap.clientWidth;
      startX = lastX = ev.clientX; startY = ev.clientY; lastT = Date.now(); vx = 0; lockDx = 0;
      pid = ev.pointerId; tracking = true;
    });
    wrap.addEventListener("pointermove", function(ev){
      if(!tracking || ev.pointerId !== pid) return;
      var top = swipeBackTopCol();
      if(!top || document.querySelector(".item.dragging")){ // long-press drag took over
        if(locked) swipeBackReset(wrap, top);
        stop(); return;
      }
      var dx = ev.clientX - startX, dy = ev.clientY - startY;
      if(!locked){
        var intent = swipeBackIntent(dx, dy);
        if(intent === "abort"){ stop(); return; }
        if(intent !== "lock") return;
        locked = true; lockDx = dx;
        wrap.classList.add("swipe-live");
        try { wrap.setPointerCapture(ev.pointerId); } catch(e){}
      }
      var now = Date.now();
      if(now > lastT) vx = (ev.clientX - lastX) / (now - lastT);
      lastX = ev.clientX; lastT = now;
      swipeBackSetShift(top, swipeBackClamp(dx - lockDx, width), false);
    });
    function finish(ev, cancelled){
      if(!tracking || ev.pointerId !== pid) return;
      var wasLocked = locked;
      stop();
      if(!wasLocked) return;
      try { wrap.releasePointerCapture(pid); } catch(e){}
      var top = swipeBackTopCol();
      if(!top){ swipeBackReset(wrap, top); return; }
      var shift = swipeBackClamp(lastX - startX - lockDx, width);
      var go = !cancelled && swipeBackDecision(shift, width, vx) === "commit";
      if(swipeBackReduced()){
        if(go) swipeBackCommit(wrap, top); else swipeBackReset(wrap, top);
        return;
      }
      swipeBackBusy = true;
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
    wrap.addEventListener("pointerup", function(ev){ finish(ev, false); });
    wrap.addEventListener("pointercancel", function(ev){ finish(ev, true); });
  }

  // Phone drill-down motion (css/browse-motion.css): a new level slides in from the right;
  // going up slides a copy of the old level out to the right over the parent.
  function browseMotionReduced(){
    return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }
  function browseSlideIn(wrap, el){
    if(!el) return;
    wrap.classList.add("m-anim", "m-anim-in");
    el.classList.add("m-enter");
    setTimeout(function(){ el.classList.remove("m-enter"); wrap.classList.remove("m-anim", "m-anim-in"); }, 300);
  }
  function browseSlideOut(wrap, clone){
    clone.className = "m-col m-leaving";
    clone.removeAttribute("data-col-key");
    wrap.classList.add("m-anim", "m-anim-out");
    wrap.appendChild(clone);
    setTimeout(function(){ if(clone.parentNode) clone.parentNode.removeChild(clone); wrap.classList.remove("m-anim", "m-anim-out"); }, 300);
  }

  // Before columns are rebuilt: decide slide-in (one level deeper) or slide-out (one level up).
  function browseMotionPlan(wrap, newCount, isMobile){
    var prev = wrap.children.length, last = wrap.lastElementChild;
    var stale = wrap.querySelector(".m-leaving");
    if(stale){ wrap.removeChild(stale); prev--; last = wrap.lastElementChild; }
    if(!isMobile || browseMotionReduced()) return null;
    if(prev >= 1 && newCount === prev + 1) return { inn: true };
    if(!browseSkipLeaveAnim && prev >= 2 && newCount === prev - 1 && last) return { clone: last.cloneNode(true) };
    return null;
  }
  function browseMotionRun(wrap, plan){
    if(!plan) return;
    if(plan.inn) browseSlideIn(wrap, wrap.lastElementChild);
    else browseSlideOut(wrap, plan.clone);
  }
