"use strict";

  /* ============================================================
     BROWSE — long-press drag: reorder within a column, reparent across columns
  ============================================================ */
  function moveItemInColumn(sortedItems, parentId, fromIdx, toIdx){
    if(toIdx < 0 || toIdx >= sortedItems.length || fromIdx === toIdx) return;
    var arr = sortedItems.slice();
    var moved = arr.splice(fromIdx, 1)[0];
    arr.splice(toIdx, 0, moved);
    persistColumnOrder(arr, parentId);
    render({ columns: true, drawer: true }); // reorder within a column: rail/chrome unaffected
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
    return sortColumnItems(buildRawColumnItems(parentId), parentId);
  }

  // Whether `it` may be reparented from sourceParentId to targetParentId: never
  // under itself / its own descendants, never into a computed/virtual container,
  // the favorites root, an info item, or past the level limits (folders <= level 3,
  // tricks/infos <= level 4, counting the moved item's own subtree).
  function canReparent(it, sourceParentId, targetParentId){
    if(targetParentId === sourceParentId) return true;
    if(it.type === "category" && isFixedFavFolder(it.id)) return false; // 外部匯入 / 單招式 never move
    if(!canCreateIn(targetParentId, state.activeSpace)) return false;   // 收藏 table, 自訂義, 外部匯入, 單招式 (v0.9.1)
    if(targetParentId !== null){
      if(targetParentId === FAV_STARRED_ID || targetParentId === FAV_CUSTOM_ID) return false;
      if(!getCategory(targetParentId) && !getTrick(targetParentId)) return false;
    }
    if(it.type !== "info" && targetParentId !== null && getDescendantContainerIds(it.id).indexOf(targetParentId) !== -1) return false;
    var type = it.type === "category" ? "folder" : it.type;
    if(!canAddChild(targetParentId, type)) return false;
    return subtreeFits(it.id, it.type, levelOf(targetParentId) + 1);
  }

  function reparentItem(it, sourceParentId, targetParentId){
    if(it.type === "category" || it.type === "info"){
      it.ref.parentId = targetParentId;
      return;
    }
    var sourceKey = sourceParentId===null ? state.activeSpace : sourceParentId;
    var targetKey = targetParentId===null ? state.activeSpace : targetParentId;
    var idx = it.ref.categoryIds.indexOf(sourceKey);
    if(idx !== -1) it.ref.categoryIds.splice(idx, 1);
    if(it.ref.categoryIds.indexOf(targetKey) === -1) it.ref.categoryIds.push(targetKey);
    if(sourceKey !== targetKey && typeof getTrickPrefix === "function"){ // the prefix follows the placement
      var pfx = getTrickPrefix(it.ref, sourceKey);
      if(pfx){ setTrickPrefix(it.ref, targetKey, pfx); setTrickPrefix(it.ref, sourceKey, ""); }
    }
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
          return el.parentElement === target.row.parentElement && !el.classList.contains("pending-ghost");
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
      if(!canReparent(it, parentId, target.parentId)){
        if(!canCreateIn(target.parentId, state.activeSpace) && typeof showToast === "function") showToast(t("favNoCreate"));
        return;
      }
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
