"use strict";

  /* ============================================================
     BROWSE — keyboard shortcuts (v0.13: only these remain)
       Ctrl/Cmd+C / X / V  clipboard (js/25)
       Ctrl/Cmd+Z          undo (js/28)
       Delete              delete selection, edit mode (js/28)
       Esc                 close top overlay (js/90, plus capture handlers in 70/80/82/84)
  ============================================================ */
  function kbdContext(ev){
    var tg = ev.target;
    return {
      inField: !!(tg && tg.closest && tg.closest("input, textarea, select, [contenteditable]")),
      modalOpen: browseModalOpen(),
      drawerOpen: !!state.detailTrickId,
      editMode: !!state.editMode,
      guest: typeof isGuest === "function" && isGuest(),
      ctrl: !!(ev.ctrlKey || ev.metaKey || ev.altKey)
    };
  }

  document.addEventListener("keydown", function(ev){
    if(typeof undoKeyAction === "function"){
      if(undoKeyAction(ev, kbdContext(ev))){ undoRun(); ev.preventDefault(); return; }
      if(ev.key === "Delete" && typeof deleteSelected === "function" && deleteSelected(kbdContext(ev))){ ev.preventDefault(); return; }
    }
    if(typeof clipKeyAction === "function"){
      var sel = window.getSelection ? window.getSelection() : null;
      var ctx = kbdContext(ev);
      ctx.hasTextSelection = !!(sel && !sel.isCollapsed && String(sel).length);
      var clipAct = clipKeyAction(ev, ctx);
      if(clipAct){ clipRun(clipAct); ev.preventDefault(); return; }
    }
  });
