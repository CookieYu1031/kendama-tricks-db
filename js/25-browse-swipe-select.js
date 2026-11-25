"use strict";

  /* ============================================================
     BROWSE — left-swipe select (touch / pen, edit mode)
     A leftward swipe on a row drags it 1:1 (max ~72px, rubber band beyond), a check shows on the
     right; release past 48px (or a fast flick) toggles the row in multiSel (js/25-browse-multisel.js).
     Rightward = the phone swipe-back (js/27, untouched). Selection feeds the touch toolbar
     (js/25-browse-touchbar.js). Pure decisions first, DOM glue below.
  ============================================================ */
  var SWIPE_SEL_LOCK_PX = 10;    // leftward travel before the gesture may lock
  var SWIPE_SEL_RATIO = 1.5;     // |dx| must exceed this * |dy| to lock
  var SWIPE_SEL_VERT_PX = 10;    // vertical travel (no lock yet) that gives the gesture up
  var SWIPE_SEL_MAX_PX = 72;     // row follows the finger 1:1 up to here
  var SWIPE_SEL_CAP_PX = 96;     // rubber band never passes this
  var SWIPE_SEL_COMMIT_PX = 48;  // released past this = toggle
  var SWIPE_SEL_FLICK_V = 0.5;   // px/ms
  var SWIPE_SEL_ANIM_MS = 220;

  // Pure: "lock" = leftward horizontal swipe, "abort" = rightward (swipe-back's) or vertical scroll.
  function swipeSelIntent(dx, dy){
    var ax = Math.abs(dx), ay = Math.abs(dy);
    if(dx < -SWIPE_SEL_LOCK_PX && ax > SWIPE_SEL_RATIO * ay) return "lock";
    if(dx > SWIPE_SEL_LOCK_PX) return "abort";
    if(ay > SWIPE_SEL_VERT_PX && ay >= ax / SWIPE_SEL_RATIO) return "abort";
    return "pending";
  }
  // Pure: how far (px, >= 0) the row shifts left for a finger travel of `travel` px: 1:1, then damped.
  function swipeSelShift(travel){
    if(!(travel > 0)) return 0;
    if(travel <= SWIPE_SEL_MAX_PX) return travel;
    var extra = (travel - SWIPE_SEL_MAX_PX) * 0.25;
    return Math.min(SWIPE_SEL_CAP_PX, SWIPE_SEL_MAX_PX + extra);
  }
  // Pure: "toggle" or "cancel" on release (travel measured from the lock point).
  function swipeSelDecision(travel, velocity){
    if(!(travel > 0)) return "cancel";
    if(travel >= SWIPE_SEL_COMMIT_PX) return "toggle";
    if(velocity > SWIPE_SEL_FLICK_V && travel >= 16) return "toggle";
    return "cancel";
  }

  var swipeSelActive = false;     // current multiSel came from a swipe (the touch toolbar shows only then)
  var swipeSelBlockUntil = 0;     // swallow the click that follows a locked swipe until this time

  function swipeSelReduced(){
    return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }

  // May this row start a swipe? (edit mode, signed in, tree view, plain row, open column, selectable)
  function swipeSelRowOk(row, wrap){
    if(!row || !row.dataset || !row.dataset.itemType || row.dataset.ghost || !wrap.contains(row)) return false;
    if(row.classList.contains("pending-ghost") || row.classList.contains("dragging")) return false;
    var col = row.closest(".m-col");
    if(!col || col.classList.contains("collapsed")) return false;
    var info = clipRowInfo(row);
    return multiSelAllowed(info.type, info.id, info.parentId);
  }

  // Toggle one row in multiSel (restarting when it sits in another column); left=null: no auto last-click.
  function swipeSelToggle(row){
    var info = clipRowInfo(row);
    multiSelValid();
    multiSel = multiSelNext(multiSel, info, null, state.activeSpace, multiSelWide());
    if(typeof clipInvalidate === "function") clipInvalidate();
    multiSelSyncRows();
    swipeSelActive = !!multiSel;
    if(typeof touchbarSync === "function") touchbarSync();
  }

  function swipeSelPaint(row, shift, armed, animate){
    row.classList.add("swipe-live");
    row.classList.toggle("swipe-armed", !!armed);
    if(swipeSelReduced()) return;
    row.style.transition = animate ? "transform " + SWIPE_SEL_ANIM_MS + "ms var(--ease)" : "none";
    row.style.transform = shift ? "translate3d(" + (-shift) + "px,0,0)" : "";
  }
  function swipeSelRest(row){
    row.style.transition = ""; row.style.transform = "";
    row.classList.remove("swipe-live", "swipe-armed");
  }

  function bindSwipeSelect(wrap){
    var startX = 0, startY = 0, lastX = 0, lastT = 0, vx = 0, lockDx = 0;
    var tracking = false, locked = false, pid = null, row = null;

    function stop(){ tracking = false; locked = false; }
    function abortLocked(){
      if(locked && row){ try { wrap.releasePointerCapture(pid); } catch(e){} swipeSelRest(row); }
      stop();
    }

    wrap.addEventListener("pointerdown", function(ev){
      stop();
      if(ev.pointerType === "mouse" || ev.isPrimary === false) return;
      if(!state.editMode || isGuest() || browseModalOpen()) return;
      if(wrap.classList.contains("flat-view") || wrap.classList.contains("search-results")) return;
      if(document.querySelector(".item.dragging")) return;
      var r = ev.target && ev.target.closest ? ev.target.closest(".item") : null;
      if(!swipeSelRowOk(r, wrap)) return;
      row = r; startX = lastX = ev.clientX; startY = ev.clientY; lastT = Date.now(); vx = 0; lockDx = 0;
      pid = ev.pointerId; tracking = true;
    });
    wrap.addEventListener("pointermove", function(ev){
      if(!tracking || ev.pointerId !== pid) return;
      if(document.querySelector(".item.dragging") || !row.parentNode){ abortLocked(); return; } // long-press drag took over
      var dx = ev.clientX - startX, dy = ev.clientY - startY;
      if(!locked){
        var intent = swipeSelIntent(dx, dy);
        if(intent === "abort"){ stop(); return; }
        if(intent !== "lock") return;
        locked = true; lockDx = dx;
        try { wrap.setPointerCapture(ev.pointerId); } catch(e){}
      }
      var now = Date.now();
      if(now > lastT) vx = (lastX - ev.clientX) / (now - lastT); // leftward speed
      lastX = ev.clientX; lastT = now;
      var travel = -(dx - lockDx);
      swipeSelPaint(row, swipeSelShift(travel), travel >= SWIPE_SEL_COMMIT_PX, false);
    });
    function finish(ev, cancelled){
      if(!tracking || ev.pointerId !== pid) return;
      var wasLocked = locked, r = row;
      stop();
      if(!wasLocked) return;
      try { wrap.releasePointerCapture(pid); } catch(e){}
      swipeSelBlockUntil = Date.now() + 400; // the click that follows must not open the row
      var travel = -(lastX - startX - lockDx);
      var go = !cancelled && swipeSelDecision(travel, vx) === "toggle";
      if(go && r.parentNode) swipeSelToggle(r);
      if(swipeSelReduced() || !r.parentNode){ swipeSelRest(r); return; }
      swipeSelPaint(r, 0, false, true); // spring back
      setTimeout(function(){ swipeSelRest(r); }, SWIPE_SEL_ANIM_MS + 30);
    }
    wrap.addEventListener("pointerup", function(ev){ finish(ev, false); });
    wrap.addEventListener("pointercancel", function(ev){ finish(ev, true); });
  }

  (function initSwipeSelect(){
    var wrap = document.getElementById("millerWrap");
    if(!wrap || !wrap.addEventListener) return;
    bindSwipeSelect(wrap);
    // document capture: runs before the clipboard / row click handlers
    document.addEventListener("click", function(ev){
      if(Date.now() < swipeSelBlockUntil && wrap.contains(ev.target)){ swipeSelBlockUntil = 0; ev.stopPropagation(); ev.preventDefault(); }
    }, true);
  })();
