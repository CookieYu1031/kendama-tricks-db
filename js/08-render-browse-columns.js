"use strict";

  /* ============================================================
     RENDER: MILLER COLUMNS / MOBILE / SEARCH
  ============================================================ */
  function buildColumnChain(){
    var columns = [];
    var parentId = null;
    for(var i=0; i<=state.path.length; i++){
      var cats = getChildren(parentId).map(function(c){ return { type:"category", id:c.id, name:c.name, ref:c }; });
      var trs = getTricksInCategory(parentId===null? "__none__" : parentId).map(function(tr){ return { type:"trick", id:tr.id, name:tr.name, ref:tr }; });
      var items = cats.concat(trs);
      columns.push({ parentId: parentId, items: items });
      var selId = state.path[i];
      if(selId===undefined) break;
      var found = items.find(function(it){
        if(it.id !== selId) return false;
        if(it.type === "category") return true;
        return trickHasChildren(it.id); // a trick only extends the chain when it acts as a folder
      });
      if(!found){ state.path = state.path.slice(0,i); break; }
      parentId = found.id;
    }
    return columns;
  }

  var ROOT_KEY = "__root__";
  function orderKeyFor(parentId){ return parentId===null ? ROOT_KEY : parentId; }

  function getItemOrderValue(it, parentId){
    if(it.type === "category") return typeof it.ref.order === "number" ? it.ref.order : 999999;
    var ob = it.ref.orderByCategory || {};
    var key = orderKeyFor(parentId);
    if(typeof ob[key] === "number") return ob[key];
    // unordered tricks fall after explicitly ordered siblings, stable by insertion order
    return 500000 + (typeof it.ref.order === "number" ? it.ref.order : 0);
  }

  function sortColumnItems(items, parentId){
    return items.slice().sort(function(a,b){
      var diff = getItemOrderValue(a, parentId) - getItemOrderValue(b, parentId);
      if(diff !== 0) return diff;
      return localize(a.name).localeCompare(localize(b.name));
    });
  }

  // Persist a full custom order for one column: assign sequential 0..n-1 to every item
  // in its new visual sequence. Categories always have a single parent, so category.order
  // is a global value; tricks may sit at different depths under different parents, so their
  // order is tracked per-parent via orderByCategory[parentId].
  function persistColumnOrder(orderedItems, parentId){
    var key = orderKeyFor(parentId);
    orderedItems.forEach(function(it, idx){
      if(it.type === "category"){
        it.ref.order = idx;
      } else {
        it.ref.orderByCategory = it.ref.orderByCategory || {};
        it.ref.orderByCategory[key] = idx;
      }
    });
    saveDB();
  }

  function moveItemInColumn(sortedItems, parentId, fromIdx, toIdx){
    if(toIdx < 0 || toIdx >= sortedItems.length || fromIdx === toIdx) return;
    var arr = sortedItems.slice();
    var moved = arr.splice(fromIdx, 1)[0];
    arr.splice(toIdx, 0, moved);
    persistColumnOrder(arr, parentId);
    render();
  }

  // Long-press-to-drag reordering: holding a row still for LONG_PRESS_MS picks it up;
  // moving the pointer before that fires cancels the press (so scrolling/tapping still
  // work normally). No dedicated drag-handle button is needed.
  var LONG_PRESS_MS = 500;
  var LONG_PRESS_MOVE_CANCEL = 8;
  function attachLongPressDrag(row, it, parentId, itemIdx, sortedItems){
    var pressTimer = null;
    var longPressFired = false;
    var startX = 0, startY = 0;

    function clearPress(){
      clearTimeout(pressTimer);
      pressTimer = null;
    }

    row.addEventListener("pointerdown", function(ev){
      if(ev.target.closest(".mini-btn")) return;
      if(ev.pointerType === "mouse" && ev.button !== 0) return;
      startX = ev.clientX; startY = ev.clientY;
      longPressFired = false;
      clearPress();
      pressTimer = setTimeout(function(){
        longPressFired = true;
        beginManualDrag(ev, row, it, parentId, itemIdx, sortedItems);
      }, LONG_PRESS_MS);
    });
    row.addEventListener("pointermove", function(ev){
      if(!pressTimer) return;
      var dx = Math.abs(ev.clientX - startX), dy = Math.abs(ev.clientY - startY);
      if(dx > LONG_PRESS_MOVE_CANCEL || dy > LONG_PRESS_MOVE_CANCEL) clearPress();
    });
    row.addEventListener("pointerup", clearPress);
    row.addEventListener("pointercancel", clearPress);
    row.addEventListener("pointerleave", function(){ if(!longPressFired) clearPress(); });
    // A drag that actually moved the item shouldn't also trigger the row's normal
    // click-to-navigate behavior once the pointer is released.
    row.addEventListener("click", function(ev){
      if(row.dataset.suppressClick === "1"){
        row.dataset.suppressClick = "";
        ev.stopPropagation();
        ev.preventDefault();
      }
    }, true);
  }

  // ---- Cross-level drag support ----------------------------------------
  // A column's DOM key (set in renderColumns as dataset.colKey) is either
  // ROOT_KEY or a container id; this reverses that back into a parentId
  // usable by getChildren/getTricksInCategory/etc.
  function decodeColKey(key){ return key === ROOT_KEY ? null : key; }

  // Same cats+tricks construction as buildColumnChain's per-level step, but
  // sorted and directly addressable by parentId — used to recompute a target
  // column's live contents mid-drag, since drag can land on a column that
  // isn't the one the drag started in.
  function buildColumnItems(parentId){
    var cats = getChildren(parentId).map(function(c){ return { type:"category", id:c.id, name:c.name, ref:c }; });
    var trs = getTricksInCategory(parentId===null ? "__none__" : parentId).map(function(tr){ return { type:"trick", id:tr.id, name:tr.name, ref:tr }; });
    return sortColumnItems(cats.concat(trs), parentId);
  }

  // Whether `it` may be reparented from sourceParentId to targetParentId:
  // categories can nest under another category OR a trick-folder (a trick-folder
  // can hold sub-categories directly, same as it can hold extension tricks), never
  // under themselves or their own descendants, and never past the depth limit;
  // tricks just can't nest under themselves or their own variants.
  function canReparent(it, sourceParentId, targetParentId){
    if(targetParentId === sourceParentId) return true;
    if(it.type === "category"){
      if(targetParentId !== null && !getCategory(targetParentId) && !getTrick(targetParentId)) return false;
      if(getDescendantCategoryIds(it.id).indexOf(targetParentId) !== -1) return false;
      var newDepth = targetParentId ? categoryDepth(targetParentId) + 1 : 1;
      if(newDepth > MAX_CATEGORY_DEPTH) return false;
      return true;
    }
    if(targetParentId !== null && getDescendantContainerIds(it.id).indexOf(targetParentId) !== -1) return false;
    return true;
  }

  function reparentItem(it, sourceParentId, targetParentId){
    if(it.type === "category"){
      it.ref.parentId = targetParentId;
      return;
    }
    var sourceKey = sourceParentId===null ? "__none__" : sourceParentId;
    var targetKey = targetParentId===null ? "__none__" : targetParentId;
    var idx = it.ref.categoryIds.indexOf(sourceKey);
    if(idx !== -1) it.ref.categoryIds.splice(idx, 1);
    if(it.ref.categoryIds.indexOf(targetKey) === -1) it.ref.categoryIds.push(targetKey);
  }

  function clearAllDragIndicators(){
    Array.prototype.forEach.call(document.querySelectorAll(".item.drop-before, .item.drop-after"), function(el){
      el.classList.remove("drop-before", "drop-after");
    });
    Array.prototype.forEach.call(document.querySelectorAll(".m-col.drop-target-col"), function(el){
      el.classList.remove("drop-target-col");
    });
  }

  function beginManualDrag(ev, row, it, parentId, itemIdx, sortedItems){
    if(!row.parentElement) return;
    try{ row.setPointerCapture(ev.pointerId); }catch(e){}
    row.classList.add("dragging");
    row.dataset.suppressClick = "1";
    var prevTouchAction = row.style.touchAction;
    row.style.touchAction = "none";

    // Resolves what's under the pointer to a (column, row-or-null) pair, only
    // counting a row if it belongs to that same column and isn't the dragged row.
    function resolveTarget(x, y){
      var elAt = document.elementFromPoint(x, y);
      var colEl = elAt ? elAt.closest(".m-col") : null;
      if(!colEl || colEl.dataset.colKey === undefined) return null;
      var targetRow = elAt.closest(".item");
      if(targetRow && (!colEl.contains(targetRow) || targetRow === row)) targetRow = null;
      return { colEl: colEl, row: targetRow, parentId: decodeColKey(colEl.dataset.colKey) };
    }

    function onMove(mv){
      mv.preventDefault();
      clearAllDragIndicators();
      var target = resolveTarget(mv.clientX, mv.clientY);
      if(!target) return;
      if(target.row){
        var rect = target.row.getBoundingClientRect();
        var before = (mv.clientY - rect.top) < rect.height / 2;
        target.row.classList.toggle("drop-before", before);
        target.row.classList.toggle("drop-after", !before);
      } else {
        target.colEl.classList.add("drop-target-col");
      }
    }
    function onUp(uv){
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      document.removeEventListener("pointercancel", onUp);
      row.classList.remove("dragging");
      row.style.touchAction = prevTouchAction;
      clearAllDragIndicators();
      setTimeout(function(){ row.dataset.suppressClick = ""; }, 30);

      var target = resolveTarget(uv.clientX, uv.clientY);
      if(!target) return;

      // Same column as the drag started in: plain reorder among siblings,
      // exactly as before.
      if(target.parentId === parentId){
        if(!target.row) return;
        var siblings = Array.prototype.filter.call(target.colEl.querySelectorAll(".item"), function(el){
          return el.parentElement === target.row.parentElement;
        });
        var toIdxRaw = siblings.indexOf(target.row);
        if(toIdxRaw === -1) return;
        var rect = target.row.getBoundingClientRect();
        var before = (uv.clientY - rect.top) < rect.height / 2;
        var toIdx = before
          ? (itemIdx < toIdxRaw ? toIdxRaw - 1 : toIdxRaw)
          : (itemIdx < toIdxRaw ? toIdxRaw : toIdxRaw + 1);
        if(toIdx !== itemIdx) moveItemInColumn(sortedItems, parentId, itemIdx, toIdx);
        return;
      }

      // Different column: cross-level move — reparent `it` onto target.parentId,
      // then drop it into position among that column's (now-updated) items.
      if(!canReparent(it, parentId, target.parentId)) return;
      reparentItem(it, parentId, target.parentId);

      var arr = buildColumnItems(target.parentId).filter(function(x){ return !(x.id===it.id && x.type===it.type); });
      var insertAt = arr.length;
      if(target.row){
        var tId = target.row.dataset.itemId, tType = target.row.dataset.itemType;
        var tIdx = arr.findIndex(function(x){ return x.id===tId && x.type===tType; });
        if(tIdx !== -1){
          var rect2 = target.row.getBoundingClientRect();
          var before2 = (uv.clientY - rect2.top) < rect2.height / 2;
          insertAt = before2 ? tIdx : tIdx + 1;
        }
      }
      arr.splice(insertAt, 0, it);
      persistColumnOrder(arr, target.parentId);
      render();
    }
    document.addEventListener("pointermove", onMove, { passive:false });
    document.addEventListener("pointerup", onUp);
    document.addEventListener("pointercancel", onUp);
  }

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

  function render(){
    renderChrome();
    renderSpaceRail();
    renderColumns();
    renderDrawer();
  }

  // Finds which column currently displays the trick whose drawer is open — the
  // "focus" column that the collapse rule below measures distance from. Merely
  // drilling into categories or a trick-folder's own extension list doesn't move
  // this (those actions never touch state.detailTrickId), only actually opening
  // a trick's detail does.
  function findFocusColumnIndex(columns){
    if(!state.detailTrickId) return -1;
    for(var i=0;i<columns.length;i++){
      var items = columns[i].items;
      for(var j=0;j<items.length;j++){
        if(items[j].type==="trick" && items[j].id===state.detailTrickId) return i;
      }
    }
    return -1;
  }

  function renderColumns(){
    var wrap = document.getElementById("millerWrap");

    var activeSpaceObj = getSpace(state.activeSpace);
    var viewMode = activeSpaceObj ? (activeSpaceObj.viewMode || "tree") : "tree";
    if(viewMode !== "tree"){
      renderFlatTrickView(wrap, viewMode);
      return;
    }
    wrap.classList.remove("flat-view");
    wrap.classList.remove("search-results");

    var columns = buildColumnChain();
    var isMobile = isNarrowViewport();
    var focusIdx = findFocusColumnIndex(columns);

    // Reuse existing column DOM nodes (matched by position + parentId) instead of
    // tearing everything down every render. This is what lets the collapse/expand
    // width change actually transition — a brand-new element can't animate from a
    // state it was never in.
    columns.forEach(function(col, colIndex){
      var key = col.parentId===null ? "__root__" : col.parentId;
      var existing = wrap.children[colIndex];
      if(!existing || existing.dataset.colKey !== key){
        while(wrap.children.length > colIndex) wrap.removeChild(wrap.lastChild);
        var fresh = document.createElement("div");
        fresh.dataset.colKey = key;
        wrap.appendChild(fresh);
      }
      var colEl = wrap.children[colIndex];
      colEl.innerHTML = "";

      var collapsed = !isMobile && focusIdx !== -1 && colIndex <= focusIdx - 2;
      colEl.className = "m-col" + (collapsed ? " collapsed" : "") + (isMobile && colIndex === columns.length-1 ? " mobile-active" : "");

      var items = sortColumnItems(col.items, col.parentId);

      if(isMobile && colIndex > 0){
        var backBtn = document.createElement("button");
        backBtn.className = "col-add-btn col-back-btn";
        backBtn.innerHTML = ICON_ARROW_LEFT + "<span>" + escapeHtml(t("backToList")) + "</span>";
        backBtn.addEventListener("click", function(){ state.path = state.path.slice(0, colIndex-1); render(); });
        colEl.appendChild(backBtn);
      }

      var itemsWrap = document.createElement("div");
      itemsWrap.className = "col-items";

      if(items.length === 0){
        var empty = document.createElement("div");
        empty.className = "col-empty";
        empty.innerHTML = ICON_EMPTY + "<div>" + escapeHtml(t("noSubItems")) + "</div>" + (state.editMode? "<div>"+escapeHtml(t("clickAddBelow"))+"</div>" : "");
        itemsWrap.appendChild(empty);
      } else {
        items.forEach(function(it, itemIdx){
          itemsWrap.appendChild(renderItemRow(it, col.parentId, colIndex, itemIdx, items));
        });
      }
      colEl.appendChild(itemsWrap);

      // Each column keeps its own "add category / add trick" controls, scoped to that
      // column's own level (col.parentId) — not a single global control for whichever
      // column happens to be deepest. Pinned to the bottom of the column via the
      // col-items flex-grow above, regardless of how many rows are in the list.
      if(state.editMode){
        colEl.appendChild(renderColAddRow(col));
      }
    });

    while(wrap.children.length > columns.length) wrap.removeChild(wrap.lastChild);

    if(columns.length === 1 && columns[0].items.length === 0 && !state.editMode){
      wrap.innerHTML = "";
      var es = document.createElement("div");
      es.className = "empty-state"; es.style.width = "100%";
      es.innerHTML = ICON_EMPTY + "<h3>" + escapeHtml(t("emptyTitle")) + "</h3><p>" + escapeHtml(t("emptyBody")) + "</p>";
      wrap.appendChild(es);
    }
  }

  /* ============================================================
     FLAT TRICK VIEWS ("columns" viewMode)
     Shown instead of the miller-column tree for spaces whose viewMode
     isn't "tree".
  ============================================================ */
  function renderFlatTrickView(wrap, mode){
    wrap.classList.remove("search-results");
    wrap.classList.add("flat-view");
    wrap.innerHTML = "";

    if(mode === "columns"){
      renderGridTrickList(wrap, state.activeSpace);
      return;
    }
  }

  // "columns" viewMode ("多欄清單" / Grid List): a flat grid of trick cards
  // only — no categories, no depth/hierarchy, and no extension/variant
  // tricks pulled in from inside a trick-folder (see getFlatSpaceTricks).
  // Every card reuses the exact same .item visual (buildItemVisual) as the
  // tree browser, so it's identical in height/width to a regular
  // hierarchical row — just wrapped into a multi-column grid instead of
  // stacked one-per-row down a single tall list.
  function renderGridTrickList(wrap, spaceId){
    var tricks = getFlatSpaceTricks(spaceId).slice().sort(function(a,b){
      return localize(a.name).localeCompare(localize(b.name));
    });

    if(!tricks.length && !state.editMode){
      var es = document.createElement("div");
      es.className = "empty-state"; es.style.width = "100%";
      es.innerHTML = ICON_EMPTY + "<h3>" + escapeHtml(t("emptyTitle")) + "</h3><p>" + escapeHtml(t("emptyBody")) + "</p>";
      wrap.appendChild(es);
      return;
    }

    if(tricks.length){
      var list = document.createElement("div");
      list.className = "grid-list-view";
      tricks.forEach(function(tr){ list.appendChild(renderGridItemRow(tr, spaceId)); });
      wrap.appendChild(list);
    }
  }

  function renderGridItemRow(tr, spaceId){
    var it = { type:"trick", id:tr.id, name:tr.name, ref:tr };
    var visual = buildItemVisual(it);
    var isCurrentTrick = state.detailTrickId === tr.id;

    var row = document.createElement("div");
    row.className = "item grid-item" + (isCurrentTrick ? " selected" : "");
    row.title = localize(tr.name);
    row.dataset.itemId = tr.id; row.dataset.itemType = "trick";
    row.appendChild(visual.icon);
    row.appendChild(visual.textWrap);

    if(state.editMode) appendBucketEditActions(row, tr, spaceId, function(){ openTrickModal(tr.id, null); });

    row.addEventListener("click", function(){ openDrawerFor(tr.id); });
    return row;
  }

  // Edit-mode row actions for the goal grid: an "edit" button (caller-
  // supplied — the full trick editor) plus a "remove" button. For a
  // bucket-backed space (收藏) removing only takes the trick out of that
  // bucket — the underlying trick is untouched and stays wherever else it's
  // filed; for any other "columns" space (no bucket) it falls back to
  // permanently deleting the trick, same as the tree browser's own delete
  // button.
  function appendBucketEditActions(container, tr, spaceId, onEdit){
    var actions = document.createElement("div");
    actions.className = "item-edit-actions flat-edit-actions";
    var editBtn = document.createElement("button");
    editBtn.className = "mini-btn"; editBtn.innerHTML = ICON_EDIT;
    editBtn.addEventListener("click", function(ev){ ev.stopPropagation(); onEdit(); });
    var removeBtn = document.createElement("button");
    removeBtn.className = "mini-btn"; removeBtn.innerHTML = ICON_X;
    removeBtn.title = t("removeFromSection");
    removeBtn.addEventListener("click", function(ev){
      ev.stopPropagation();
      if(spaceBucketFor(spaceId)){
        toggleTrickInSpaceBucket(tr.id, spaceId);
        renderSpaceRail();
        renderColumns();
        closeDrawerIfLeftActiveBucket(tr.id, spaceId);
      } else {
        requestDeleteTrick(tr.id);
      }
    });
    actions.appendChild(editBtn); actions.appendChild(removeBtn);
    container.appendChild(actions);
  }

  function renderColAddRow(col){
    var row = document.createElement("div");
    row.className = "col-add-row";
    var parentIsTrick = col.parentId && !!getTrick(col.parentId);

    // A trick-folder can hold sub-categories directly now (same as any other
    // container), so "add category" is always offered here, not just under
    // plain categories — this is how a trick with too many flat extension
    // tricks gets to group them into sub-categories of their own.
    var addCat = document.createElement("button");
    addCat.className = "col-add-btn";
    addCat.innerHTML = ICON_PLUS + "<span>" + escapeHtml(t("addCategoryShort")) + "</span>";
    addCat.addEventListener("click", function(){ openCategoryModal(null, col.parentId); });
    row.appendChild(addCat);

    var addTrick = document.createElement("button");
    addTrick.className = "col-add-btn";
    addTrick.innerHTML = ICON_PLUS + "<span>" + escapeHtml(parentIsTrick ? t("addVariantShort") : t("addTrickShort")) + "</span>";
    addTrick.addEventListener("click", function(){ openTrickModal(null, col.parentId); });
    row.appendChild(addTrick);

    return row;
  }

  // Builds the icon + name/meta text block shared by every item row —
  // the miller-column tree (renderItemRow) and the flat "columns" grid
  // (renderGridItemRow) both use this, so a trick or category looks
  // exactly the same wherever it's presented.
  function buildItemVisual(it){
    var hasChildren = it.type==="trick" && trickHasChildren(it.id);

    var icon = document.createElement("div");
    icon.className = "item-icon" + (it.type==="trick" ? " trick" : "") + (hasChildren ? " has-children" : "");
    if(it.type==="category"){
      var cHex = colorHex(it.ref.color);
      icon.style.background = hexToRgba(cHex, 0.22);
      icon.style.color = cHex;
      if(it.ref.icon){
        icon.style.fontSize = "15px";
        icon.textContent = it.ref.icon;
      } else {
        icon.innerHTML = ICON_FOLDER;
      }
    } else {
      var tHex = it.ref.color ? colorHex(it.ref.color) : TRICK_DEFAULT_HEX;
      icon.style.background = hexToRgba(tHex, 0.22);
      icon.style.color = tHex;
      if(it.ref.icon){
        icon.style.fontSize = "15px";
        icon.textContent = it.ref.icon;
      } else {
        icon.innerHTML = ICON_PLAY;
      }
      applyTrickGlow(icon, it.ref);
    }

    var textWrap = document.createElement("div");
    textWrap.className = "item-text";
    var nameEl = document.createElement("div");
    nameEl.className = "item-name";
    nameEl.textContent = localize(it.name);
    textWrap.appendChild(nameEl);

    var metaEl = document.createElement("div");
    metaEl.className = "item-meta";
    if(it.type==="category"){
      var subCount = getChildren(it.id).length;
      var trickCount = getTricksInCategory(it.id).length;
      var bits = [];
      if(subCount) bits.push(subCount + " " + t("subCats"));
      if(trickCount) bits.push(trickCount + " " + t("tricksCount"));
      metaEl.textContent = bits.join(" · ");
    } else {
      var metaBits = [];
      // Being filed into 收藏 is a bucket membership, not a real "this
      // trick also lives under another category" cross-reference — exclude
      // that bucket category from this line so toggling a trick into 收藏
      // doesn't add unrelated-looking text here.
      var realCategoryIds = it.ref.categoryIds.filter(function(cid){
        return cid !== GOAL_BUCKET_CAT_ID;
      });
      if(realCategoryIds.length > 1){
        metaBits.push(realCategoryIds.map(function(cid){ var cc=getCategory(cid)||getTrick(cid); return cc?localize(cc.name):""; }).filter(Boolean).join(" · "));
      }
      if(hasChildren){
        // A trick-folder's children can now be a mix of sub-categories and
        // extension tricks, so show both counts (whichever are non-zero) the
        // same way a category row shows its subCats/tricksCount split.
        var hcBits = [];
        var subCatCount = getChildren(it.id).length;
        var extTrickCount = getTricksInCategory(it.id).length;
        if(subCatCount) hcBits.push(subCatCount + " " + t("subCats"));
        if(extTrickCount) hcBits.push(extTrickCount + " " + t("extTricks"));
        if(hcBits.length) metaBits.push(hcBits.join(" · "));
      }
      metaEl.textContent = metaBits.join(" · ");
    }
    // Rows have a fixed height (var(--item-h)) and are vertically centered via flex on
    // .item, so an item with no description simply omits the meta line entirely and its
    // single-line name centers naturally — rather than reserving an invisible blank line
    // that pushes the name up off-center.
    if(metaEl.textContent) textWrap.appendChild(metaEl);

    return { icon: icon, textWrap: textWrap, hasChildren: hasChildren };
  }

  function renderItemRow(it, parentId, colIndex, itemIdx, sortedItems){
    var visual = buildItemVisual(it);
    var hasChildren = visual.hasChildren;
    var isDrillable = it.type==="category" || hasChildren;

    var row = document.createElement("div");
    var isCurrentTrick = it.type==="trick" && state.detailTrickId===it.id;
    row.className = "item" + ((isDrillable && state.path[colIndex]===it.id) || isCurrentTrick ? " selected" : "");
    row.title = localize(it.name);
    row.dataset.itemId = it.id;
    row.dataset.itemType = it.type;

    row.appendChild(visual.icon);
    row.appendChild(visual.textWrap);

    if(state.editMode){
      var actions = document.createElement("div");
      actions.className = "item-edit-actions";
      var editBtn = document.createElement("button");
      editBtn.className = "mini-btn"; editBtn.innerHTML = ICON_EDIT;
      editBtn.addEventListener("click", function(ev){
        ev.stopPropagation();
        if(it.type==="category") openCategoryModal(it.id, parentId); else openTrickModal(it.id, null);
      });
      var delBtn = document.createElement("button");
      delBtn.className = "mini-btn danger"; delBtn.innerHTML = ICON_TRASH;
      delBtn.addEventListener("click", function(ev){
        ev.stopPropagation();
        if(it.type==="category") requestDeleteCategory(it.id); else requestDeleteTrick(it.id);
      });
      actions.appendChild(editBtn); actions.appendChild(delBtn);
      row.appendChild(actions);

      // Long-press (0.5s) to pick up and drag-reorder — no dedicated handle button.
      // Supports cross-level moves: dropping on a different column reparents the
      // item onto that column's container instead of just resorting siblings.
      attachLongPressDrag(row, it, parentId, itemIdx, sortedItems);
    }

    if(isDrillable){
      var chev = document.createElement("div");
      chev.className = "item-chevron";
      chev.innerHTML = ICON_CHEVRON;
      if(hasChildren){
        // For a folder-trick, the chevron drills into its variants; the rest of the row
        // still opens its own detail drawer, since the trick is both a trick and a folder.
        chev.addEventListener("click", function(ev){
          ev.stopPropagation();
          state.path = state.path.slice(0, colIndex).concat(it.id);
          render();
        });
      }
      row.appendChild(chev);
    }

    if(it.type==="category"){
      row.addEventListener("click", function(){
        state.path = state.path.slice(0, colIndex).concat(it.id);
        render();
      });
    } else {
      row.addEventListener("click", function(){
        // Tricks with extension items open their detail drawer and drill into
        // their extension column at the same time, so both views stay in sync.
        // Tricks without extensions still need the path truncated to this level,
        // otherwise a previously-opened sibling's extension column would linger.
        state.path = hasChildren ? state.path.slice(0, colIndex).concat(it.id) : state.path.slice(0, colIndex);
        render();
        openDrawerFor(it.id);
      });
    }

    return row;
  }

  function getSearchMatches(q){
    q = (q||"").trim().toLowerCase();
    if(!q) return [];
    return db.tricks.filter(function(tr){
      return (tr.name.zh||"").toLowerCase().indexOf(q) !== -1 ||
             (tr.name.jp||"").toLowerCase().indexOf(q) !== -1 ||
             (tr.name.en||"").toLowerCase().indexOf(q) !== -1;
    });
  }

  // Inline "N results for X" label removed — the search-results-inline slot next
  // to the search box is now used for the edit toast instead. Kept as a no-op so
  // existing call sites elsewhere don't need to be touched.
  function updateSearchInlineCount(q){}

  // Navigates the miller columns to a trick's real location (its parent
  // container's column) rather than leaving it in the flat search-results
  // grid, then opens its detail drawer — used by the live suggestion dropdown.
  function goToTrickLocation(trickId){
    var tr = getTrick(trickId);
    if(!tr) return;
    state.path = tr.categoryIds.length ? pathToContainer(tr.categoryIds[0]) : [];
    state.searchQuery = "";
    document.getElementById("searchInput").value = "";
    document.getElementById("searchClear").classList.remove("show");
    render();
    openDrawerFor(tr.id);
  }

  /* ============================================================
     LIVE SEARCH SUGGESTIONS (Google-style dropdown under the
     search box). Updates on every keystroke, no Enter required.
  ============================================================ */
  var SEARCH_SUGGEST_LIMIT = 8;
  function closeSearchSuggest(){
    var box = document.getElementById("searchSuggest");
    box.classList.remove("show");
    box.innerHTML = "";
  }
  function renderSearchSuggest(q){
    var box = document.getElementById("searchSuggest");
    var trimmed = (q||"").trim();

    // Typing "/" previews the hidden power-user commands instead of trick matches.
    if(trimmed.charAt(0) === "/"){
      renderCommandSuggest(box, trimmed);
      return;
    }

    var matches = getSearchMatches(q);

    if(!trimmed || matches.length === 0){
      closeSearchSuggest();
      return;
    }

    box.innerHTML = "";
    matches.slice(0, SEARCH_SUGGEST_LIMIT).forEach(function(tr){
      var row = document.createElement("div");
      row.className = "search-suggest-item";
      row.textContent = localize(tr.name);
      row.addEventListener("mousedown", function(ev){
        // mousedown (not click) so it fires before the input's blur hides the dropdown
        ev.preventDefault();
        closeSearchSuggest();
        goToTrickLocation(tr.id);
      });
      box.appendChild(row);
    });

    box.classList.add("show");
  }

  // Shows the list of available "/" commands (see HIDDEN_COMMANDS), each
  // annotated with a description in the current UI language. Selecting a
  // row fills the search box with that command; Enter still runs it.
  function renderCommandSuggest(box, query){
    var lower = query.toLowerCase();
    var matches = HIDDEN_COMMANDS.filter(function(c){
      return c.cmd.toLowerCase().indexOf(lower) === 0;
    });

    if(matches.length === 0){
      closeSearchSuggest();
      return;
    }

    box.innerHTML = "";
    matches.forEach(function(c){
      var row = document.createElement("div");
      row.className = "search-suggest-item search-suggest-command";
      var cmdSpan = document.createElement("span");
      cmdSpan.className = "search-suggest-cmd";
      cmdSpan.textContent = c.cmd;
      var descSpan = document.createElement("span");
      descSpan.className = "search-suggest-desc";
      descSpan.textContent = t(c.descKey);
      row.appendChild(cmdSpan);
      row.appendChild(descSpan);
      row.addEventListener("mousedown", function(ev){
        ev.preventDefault();
        var input = document.getElementById("searchInput");
        input.value = c.cmd;
        closeSearchSuggest();
        input.focus();
      });
      box.appendChild(row);
    });

    box.classList.add("show");
  }

