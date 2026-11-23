"use strict";

  /* ============================================================
     BROWSE — undo: Ctrl/Cmd+Z restores a data snapshot taken before a paste or a Delete-key
     deletion. Snapshots are JSON copies of db (cap UNDO_CAP). A Delete snapshot is taken before
     the confirm dialog; if the user cancelled, the snapshot equals the current db and is skipped.
  ============================================================ */
  addStrings({
    zh:{ undone:"已復原", undoNothing:"沒有可復原的動作" },
    jp:{ undone:"元に戻しました", undoNothing:"元に戻す操作がありません" },
    en:{ undone:"Undone", undoNothing:"Nothing to undo" }
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
      if(typeof state !== "undefined" && state.detailTrickId && !getTrick(state.detailTrickId)){
        if(typeof closeDrawer === "function") closeDrawer();
      }
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
    return !!canModifyItem(it, sel.parentId, admin);
  }

  // Opens the usual confirm dialog for the selected row. Returns true if it handled the key.
  function deleteSelected(ctx){
    var sel = typeof clipSelection === "function" ? clipSelection() : null;
    if(!deleteKeyAllowed(sel, ctx, isAdminNow())) return false;
    undoPush();
    if(sel.type === "category") requestDeleteCategory(sel.id);
    else if(sel.type === "info") requestDeleteInfo(sel.id);
    else requestDeleteTrick(sel.id, sel.parentId);
    return true;
  }
