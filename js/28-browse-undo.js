"use strict";

  /* ============================================================
     BROWSE — undo: Ctrl/Cmd+Z restores a data snapshot taken before a paste or a Delete-key
     deletion. Snapshots are JSON copies of db (cap UNDO_CAP). A Delete snapshot is taken before
     the confirm dialog; if the user cancelled, the snapshot equals the current db and is skipped.
  ============================================================ */
  addStrings({
    zh:{ undone:"已復原", undoNothing:"沒有可復原的動作",
         batchDelTitle:"移除 {n} 個項目？", batchDelBody:"清單會連同內容一起移除；招式只移除在此處的位置，最後一個位置被移除時招式才會刪除。",
         batchDelSkipNote:"（{m} 個沒有權限的項目會略過）", batchDeletedN:"已移除 {n} 個項目", batchDelNone:"沒有可移除的項目" },
    jp:{ undone:"元に戻しました", undoNothing:"元に戻す操作がありません",
         batchDelTitle:"{n} 件の項目を削除しますか？", batchDelBody:"リストは中身ごと削除されます。技はこの場所への配置だけを外し、最後の配置を外したときに技そのものが削除されます。",
         batchDelSkipNote:"（権限のない {m} 件はスキップします）", batchDeletedN:"{n} 件を削除しました", batchDelNone:"削除できる項目がありません" },
    en:{ undone:"Undone", undoNothing:"Nothing to undo",
         batchDelTitle:"Remove {n} items?", batchDelBody:"Lists are removed with their contents; a trick is only removed from this place, and is deleted once its last place is gone.",
         batchDelSkipNote:" ({m} items without permission will be skipped)", batchDeletedN:"Removed {n} items", batchDelNone:"Nothing can be removed" }
  });

  var UNDO_CAP = 20;
  var undoStack = []; // [{ ref: db object at capture time, json: string }]

  // Call right before an undoable mutation.
  function undoPush(){
    if(typeof db === "undefined" || !db) return;
    undoStack.push({ ref: db, json: JSON.stringify(db) });
    while(undoStack.length > UNDO_CAP) undoStack.shift();
  }

  // Pops the newest entry that really differs from the current db. Returns true if restored.
  function undoApply(){
    while(undoStack.length){
      var e = undoStack.pop();
      if(e.ref !== db) { undoStack = []; return false; } // db was swapped (login / sync): stale
      if(e.json === JSON.stringify(db)) continue;          // cancelled action: nothing changed
      var snap = JSON.parse(e.json);
      Object.keys(db).forEach(function(k){ delete db[k]; });
      Object.keys(snap).forEach(function(k){ db[k] = snap[k]; });
      if(typeof state !== "undefined" && state.path){
        var cut = state.path.findIndex(function(id){ return !getCategory(id); });
        if(cut !== -1) state.path = state.path.slice(0, cut);
      }
      if(typeof state !== "undefined" && typeof closeDrawerIfGone === "function") closeDrawerIfGone();
      saveDB();
      return true;
    }
    return false;
  }

  function undoRun(){
    var ok = undoApply();
    if(typeof showToast === "function") showToast(t(ok ? "undone" : "undoNothing"));
    if(ok && typeof render === "function") render();
  }

  // Pure: Ctrl/Cmd+Z (no shift/alt) outside inputs and dialogs, signed-in users only.
  function undoKeyAction(ev, ctx){
    if(ctx.guest || ctx.inField || ctx.modalOpen) return null;
    if(!(ev.ctrlKey || ev.metaKey) || ev.altKey || ev.shiftKey) return null;
    return String(ev.key || "").toLowerCase() === "z" ? "undo" : null;
  }

  // Pure: may the Delete key delete this selection? sel = { type, id, parentId }.
  function deleteKeyAllowed(sel, ctx, admin){
    if(!sel || !sel.type || !sel.id) return false;
    if(!ctx.editMode || ctx.guest || ctx.inField || ctx.modalOpen || ctx.ctrl) return false;
    var it = typeof clipItemOf === "function" ? clipItemOf(sel.type, sel.id) : null;
    if(!it) return false;
    return !!canPlaceItem(it, sel.parentId, admin);
  }

  // ---- batch delete (multi-select, touch toolbar, Delete key) ----
  // Pure-ish: may this row be removed? Same rule as the single Delete key; fixed 收藏 folders and virtual rows never.
  function batchDeleteAllowed(it, parentId, admin){
    if(!it || it.ref.virtual) return false;
    if(it.type === "category" && isFixedFavFolder(it.id)) return false;
    return !!canPlaceItem(it, parentId, admin);
  }
  // Splits items ([{type,id}]) into the removable ones and a skipped count.
  function batchDeletePlan(items, parentId, admin){
    var ok = [], skipped = 0;
    (items || []).forEach(function(x){
      var it = clipItemOf(x.type, x.id);
      if(it && batchDeleteAllowed(it, parentId, admin)) ok.push({ type: x.type, id: x.id }); else skipped++;
    });
    return { ok: ok, skipped: skipped };
  }
  // Data part: lists -> deleteCategoryTree, tricks -> only the placement in this column (all placements
  // when it is not really there, e.g. a virtual 收藏 > 自訂義 row), infos -> removed.
  // Returns { removed, skipped, catIds (every removed list id) }.
  function deleteItemsBatch(items, parentId, spaceId, admin){
    var plan = batchDeletePlan(items, parentId, admin);
    var cid = parentId == null ? spaceId : parentId, catIds = [], removed = 0;
    plan.ok.forEach(function(x){
      if(x.type === "category"){
        if(!getCategory(x.id)) return; // already gone with an earlier item
        catIds = catIds.concat(deleteCategoryTree(x.id)); removed++;
      } else if(x.type === "info"){
        if(!getInfo(x.id)) return;
        db.infos = (db.infos || []).filter(function(n){ return n.id !== x.id; }); removed++;
      } else {
        var tr = getTrick(x.id);
        if(!tr) return;
        if(tr.categoryIds.indexOf(cid) === -1){
          tr.categoryIds.slice().forEach(function(c){ removeTrickPlacement(x.id, c); });
          if(getTrick(x.id)) db.tricks = db.tricks.filter(function(v){ return v.id !== x.id; });
        } else {
          removeTrickPlacement(x.id, cid);
        }
        removed++;
      }
    });
    saveDB();
    return { removed: removed, skipped: plan.skipped, catIds: catIds };
  }

  // Pure: Delete key with a multi-selection (same guards as the single delete).
  function deleteKeyBatchAllowed(ctx, count){
    return !!(count > 0 && ctx.editMode && !ctx.guest && !ctx.inField && !ctx.modalOpen && !ctx.ctrl);
  }

  // UI: one confirm for the whole batch; undo snapshot first (Ctrl+Z restores). onDone runs after the render.
  function requestDeleteBatch(items, parentId, onDone){
    var admin = isAdminNow(), plan = batchDeletePlan(items, parentId, admin);
    if(!plan.ok.length){ showToast(t("batchDelNone"), "error"); return; }
    var body = t("batchDelBody") + (plan.skipped ? t("batchDelSkipNote").replace("{m}", plan.skipped) : "");
    undoPush();
    openConfirm(t("batchDelTitle").replace("{n}", plan.ok.length), body, function(){
      var res = deleteItemsBatch(plan.ok, parentId, state.activeSpace, admin);
      if(typeof multiSelClear === "function") multiSelClear();
      var cutIdx = state.path.findIndex(function(id){ return res.catIds.indexOf(id) !== -1; });
      if(cutIdx !== -1) state.path = state.path.slice(0, cutIdx);
      if(typeof closeDrawerIfGone === "function") closeDrawerIfGone();
      var msg = t("batchDeletedN").replace("{n}", res.removed);
      if(plan.skipped) msg += t("clipSkippedN").replace("{m}", plan.skipped);
      showToast(msg);
      render();
      if(typeof onDone === "function") onDone(res);
    });
  }

  // Opens the usual confirm dialog for the selected row(s). Returns true if it handled the key.
  function deleteSelected(ctx){
    var multi = typeof multiSelItems === "function" ? multiSelItems() : [];
    if(multi.length){
      if(!deleteKeyBatchAllowed(ctx, multi.length)) return false;
      if(multiSelMixed()) showToast(t("styleOnlyMixed"), "error");
      else requestDeleteBatch(multi, multiSel.parentId);
      return true;
    }
    var sel = typeof clipSelection === "function" ? clipSelection() : null;
    if(!deleteKeyAllowed(sel, ctx, isAdminNow())) return false;
    undoPush();
    if(sel.type === "category") requestDeleteCategory(sel.id);
    else if(sel.type === "info") requestDeleteInfo(sel.id);
    else requestDeleteTrick(sel.id, sel.parentId);
    return true;
  }
