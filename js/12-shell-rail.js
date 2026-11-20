"use strict";

  /* ============================================================
     SHELL — left space rail (render + long-press reorder)
  ============================================================ */
  // Long-press-then-drag reordering for the space rail's "other spaces"
  // section — same 0.5s-hold gesture and mechanics as attachLongPressDrag
  // above, simplified to a single flat vertical list (no cross-column
  // reparenting): dropping before/after a sibling reorders the whole group,
  // persisted via each space's own `order` field.
  function persistSpaceOrder(orderedSpaces){
    orderedSpaces.forEach(function(sp, idx){ sp.order = idx; });
    saveDB();
  }

  function attachSpaceLongPressDrag(btn, sp, otherSpaces){
    var pressTimer = null;
    var longPressFired = false;
    var startX = 0, startY = 0;

    function clearPress(){ clearTimeout(pressTimer); pressTimer = null; }

    btn.addEventListener("pointerdown", function(ev){
      if(ev.target.closest(".space-edit-badge")) return;
      if(ev.pointerType === "mouse" && ev.button !== 0) return;
      startX = ev.clientX; startY = ev.clientY;
      longPressFired = false;
      clearPress();
      pressTimer = setTimeout(function(){
        longPressFired = true;
        beginSpaceManualDrag(ev, btn, sp, otherSpaces);
      }, LONG_PRESS_MS);
    });
    btn.addEventListener("pointermove", function(ev){
      if(!pressTimer) return;
      var dx = Math.abs(ev.clientX - startX), dy = Math.abs(ev.clientY - startY);
      if(dx > LONG_PRESS_MOVE_CANCEL || dy > LONG_PRESS_MOVE_CANCEL) clearPress();
    });
    btn.addEventListener("pointerup", clearPress);
    btn.addEventListener("pointercancel", clearPress);
    btn.addEventListener("pointerleave", function(){ if(!longPressFired) clearPress(); });
    btn.addEventListener("click", function(ev){
      if(btn.dataset.suppressClick === "1"){
        btn.dataset.suppressClick = "";
        ev.stopPropagation();
        ev.preventDefault();
      }
    }, true);
  }

  function beginSpaceManualDrag(ev, btn, sp, otherSpaces){
    if(!btn.parentElement) return;
    try{ btn.setPointerCapture(ev.pointerId); }catch(e){}
    btn.classList.add("dragging");
    btn.dataset.suppressClick = "1";
    var prevTouchAction = btn.style.touchAction;
    btn.style.touchAction = "none";
    var itemIdx = otherSpaces.indexOf(sp);

    function resolveTargetBtn(x, y){
      var elAt = document.elementFromPoint(x, y);
      var targetBtn = elAt ? elAt.closest(".space-btn") : null;
      if(!targetBtn || targetBtn === btn || targetBtn.dataset.pinned === "1") return null;
      return targetBtn;
    }
    function clearIndicators(){
      Array.prototype.forEach.call(document.querySelectorAll(".space-btn.drop-before, .space-btn.drop-after"), function(el){
        el.classList.remove("drop-before", "drop-after");
      });
    }
    function onMove(mv){
      mv.preventDefault();
      clearIndicators();
      var target = resolveTargetBtn(mv.clientX, mv.clientY);
      if(!target) return;
      var rect = target.getBoundingClientRect();
      var before = (mv.clientY - rect.top) < rect.height / 2;
      target.classList.toggle("drop-before", before);
      target.classList.toggle("drop-after", !before);
    }
    function onUp(uv){
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      document.removeEventListener("pointercancel", onUp);
      btn.classList.remove("dragging");
      btn.style.touchAction = prevTouchAction;
      clearIndicators();
      setTimeout(function(){ btn.dataset.suppressClick = ""; }, 30);

      var target = resolveTargetBtn(uv.clientX, uv.clientY);
      if(!target) return;
      var targetId = target.dataset.spaceId;
      var toIdxRaw = otherSpaces.findIndex(function(s){ return s.id === targetId; });
      if(toIdxRaw === -1) return;
      var rect = target.getBoundingClientRect();
      var before = (uv.clientY - rect.top) < rect.height / 2;
      var toIdx = before
        ? (itemIdx < toIdxRaw ? toIdxRaw - 1 : toIdxRaw)
        : (itemIdx < toIdxRaw ? toIdxRaw : toIdxRaw + 1);
      if(toIdx === itemIdx) return;
      var arr = otherSpaces.slice();
      var moved = arr.splice(itemIdx, 1)[0];
      arr.splice(toIdx, 0, moved);
      persistSpaceOrder(arr);
      render();
    }
    document.addEventListener("pointermove", onMove, { passive:false });
    document.addEventListener("pointerup", onUp);
    document.addEventListener("pointercancel", onUp);
  }

  // Builds one rail button (icon + edit badge) — deliberately without a
  // navigate-click listener yet. Drag support (attachSpaceLongPressDrag)
  // registers a capturing click-suppressor that must exist before the plain
  // navigate listener is attached (see bindSpaceNavigate + call order in
  // renderSpaceRail), otherwise a completed drag would still fire a click.
  function buildSpaceBtn(sp, pinned){
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "space-btn" + (state.activeSpace===sp.id ? " active" : "");
    btn.dataset.spaceId = sp.id;
    if(pinned) btn.dataset.pinned = "1";
    btn.textContent = sp.icon || "🗂️";
    btn.title = spaceLabel(sp.id);
    if(state.editMode){
      var badge = document.createElement("span");
      badge.className = "space-edit-badge";
      badge.innerHTML = ICON_EDIT;
      badge.title = t("editSpace");
      badge.addEventListener("click", function(ev){
        ev.stopPropagation();
        openSpaceModal(sp.id);
      });
      btn.appendChild(badge);
    }
    return btn;
  }
  function bindSpaceNavigate(btn, sp){
    btn.addEventListener("click", function(){
      if(state.activeSpace === sp.id) return;
      state.activeSpace = sp.id;
      localStorage.setItem(SPACE_KEY, sp.id);
      state.path = []; state.detailTrickId = null; state.searchQuery = "";
      document.getElementById("searchInput").value = "";
      document.getElementById("searchClear").classList.remove("show");
      updateSearchInlineCount("");
      closeSearchSuggest();
      closeDrawer();
      render();
    });
  }

  // Thin horizontal rule separating the rail's sections (總表 / 收藏 /
  // other spaces) — see renderSpaceRail for when each divider is actually
  // inserted (a divider bordering an empty, hidden section is skipped
  // rather than shown floating next to its neighbor).
  function buildRailDivider(){
    var hr = document.createElement("div");
    hr.className = "space-rail-divider";
    return hr;
  }

  function renderSpaceRail(){
    var rail = document.getElementById("spaceRail");
    rail.innerHTML = "";

    var indexSpace = db.spaces.find(function(s){ return s.id === "space-index"; });
    var goalSpace = db.spaces.find(function(s){ return s.id === "space-goal"; });
    var otherSpaces = db.spaces.filter(function(s){
      return s.id !== "space-index" && s.id !== "space-goal";
    }).sort(function(a,b){ return (a.order||0)-(b.order||0); });
    var section2Spaces = [goalSpace].filter(function(sp){
      return sp && getAllTricksInSpace(sp.id).length > 0;
    });

    // Section 1: 招式總表, pinned to the very top.
    if(indexSpace){
      var indexBtn = buildSpaceBtn(indexSpace, true);
      bindSpaceNavigate(indexBtn, indexSpace);
      rail.appendChild(indexBtn);
    }

    // A divider only ever separates two sections that both actually have
    // something in them — if 收藏 is currently empty (and thus hidden), the
    // divider that would normally sit right above it is dropped too,
    // leaving a single line between 總表 and the next visible section
    // instead of two lines with nothing between them.
    if(section2Spaces.length || otherSpaces.length) rail.appendChild(buildRailDivider());

    // Section 2: 收藏 — fixed position right under 總表, and only shown
    // once it actually holds at least one trick.
    section2Spaces.forEach(function(sp){
      var btn = buildSpaceBtn(sp, true);
      bindSpaceNavigate(btn, sp);
      rail.appendChild(btn);
    });
    if(section2Spaces.length && otherSpaces.length) rail.appendChild(buildRailDivider());

    // Section 3: every other (custom) space — freely reorderable via the
    // same long-press-then-drag gesture tricks/categories already use.
    otherSpaces.forEach(function(sp){
      var btn = buildSpaceBtn(sp, false);
      if(state.editMode) attachSpaceLongPressDrag(btn, sp, otherSpaces);
      bindSpaceNavigate(btn, sp);
      rail.appendChild(btn);
    });

    // If the space currently being viewed just dropped out of the rail
    // (its last trick was removed from 收藏), fall back to the total index
    // rather than leaving the view stuck on a hidden tab.
    if(state.activeSpace === "space-goal"
       && getAllTricksInSpace(state.activeSpace).length === 0
       && indexSpace){
      state.activeSpace = indexSpace.id;
      localStorage.setItem(SPACE_KEY, indexSpace.id);
      state.path = [];
      if(state.detailTrickId) closeDrawer(); // also hides the drawer's DOM, not just the state
      var activeBtn = rail.querySelector('[data-space-id="' + indexSpace.id + '"]');
      if(activeBtn) activeBtn.classList.add("active");
    }

    if(state.editMode){
      var addBtn = document.createElement("button");
      addBtn.type = "button";
      addBtn.className = "space-btn space-add-btn";
      addBtn.innerHTML = ICON_PLUS;
      addBtn.title = t("newSpace");
      addBtn.addEventListener("click", function(){ openSpaceModal(null); });
      rail.appendChild(addBtn);
    }

    var toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "rail-edit-toggle" + (state.editMode ? " on" : "");
    toggle.title = t("editMode");
    toggle.innerHTML = ICON_EDIT;
    toggle.addEventListener("click", function(){
      state.editMode = !state.editMode;
      render();
    });
    rail.appendChild(toggle);
  }
