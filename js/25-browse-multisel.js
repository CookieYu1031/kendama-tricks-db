"use strict";

  /* ============================================================
     BROWSE — admin multi-select (edit mode, Shift+click) for batch Ctrl+C / X / V (js/25-browse-clipboard.js)
     multiSel = { parentId, space, items:[{ type, id }] } | null. One column (one parentId) only.
     Cleared by: a plain click, Esc, leaving edit mode, switching table.
     Pure logic first (multiSelNext), DOM glue below.
  ============================================================ */
  var multiSel = null;

  // Pure: next selection after a Shift+click on info = { type, id, parentId }.
  // cur = current multiSel (or null), last = last plainly clicked row ({ type, id, parentId } or null).
  // Different column / table -> restart with only the new item. First Shift+click -> bring in `last`
  // when it sits in the same column. Clicking a member removes it; an empty result is null.
  function multiSelNext(cur, info, last, space){
    var base = cur && cur.space === space && cur.parentId === info.parentId ? cur : null;
    var items = base ? base.items.slice() : [];
    if(!cur && last && last.type && last.id && last.parentId === info.parentId &&
       !(last.type === info.type && last.id === info.id)) items.push({ type: last.type, id: last.id });
    var at = -1;
    for(var i = 0; i < items.length; i++) if(items[i].type === info.type && items[i].id === info.id) at = i;
    if(at !== -1) items.splice(at, 1); else items.push({ type: info.type, id: info.id });
    return items.length ? { parentId: info.parentId, space: space, items: items } : null;
  }

  // Drops the selection when it no longer applies (edit mode off / other table).
  function multiSelValid(){
    if(multiSel && (!state.editMode || multiSel.space !== state.activeSpace)) multiSelClear();
    return multiSel;
  }
  // Existing members only, in the order they were picked.
  function multiSelItems(){
    if(!multiSelValid()) return [];
    return multiSel.items.filter(function(x){ return !!clipItemOf(x.type, x.id); });
  }
  function isMultiSelected(it, parentId){
    if(!multiSelValid() || multiSel.parentId !== parentId) return false;
    for(var i = 0; i < multiSel.items.length; i++) if(multiSel.items[i].type === it.type && multiSel.items[i].id === it.id) return true;
    return false;
  }
  function multiSelClear(){
    var had = !!multiSel;
    multiSel = null;
    if(had && typeof clipInvalidate === "function") clipInvalidate();
    var wrap = typeof document !== "undefined" ? document.getElementById("millerWrap") : null;
    if(wrap && wrap.querySelectorAll){
      var rows = wrap.querySelectorAll(".item.multi-sel");
      for(var i = 0; i < rows.length; i++) rows[i].classList.remove("multi-sel");
    }
  }

  // Pure: may this item be multi-selected? (same limits as clipCopyOrCut)
  function multiSelAllowed(type, id, parentId){
    var it = clipItemOf(type, id);
    return !!(it && !it.ref.virtual && parentId !== FAV_STARRED_ID);
  }

  // Called from the capture click handler in js/25. Returns true when it consumed the click.
  function multiSelHandleClick(ev, row){
    if(!ev.shiftKey || !state.editMode || !isAdminNow() || !row || !row.dataset || !row.dataset.itemType) return false;
    ev.stopPropagation(); ev.preventDefault();
    if(row.dataset.ghost) return true;
    var info = clipRowInfo(row);
    if(!multiSelAllowed(info.type, info.id, info.parentId)) return true;
    multiSelValid();
    var hadCur = !!multiSel;
    multiSel = multiSelNext(multiSel, info, hadCur ? null : clipLastClick, state.activeSpace);
    if(typeof clipInvalidate === "function") clipInvalidate();
    multiSelSyncRows();
    return true;
  }
  // Mirrors multiSel onto the rendered rows' .multi-sel class (shared by Shift+click and the left swipe, js/25-browse-swipe-select.js).
  function multiSelSyncRows(){
    var wrap = document.getElementById("millerWrap");
    if(!wrap || !wrap.querySelectorAll) return;
    var rows = wrap.querySelectorAll(".item");
    for(var i = 0; i < rows.length; i++){
      var r = rows[i];
      if(!r.dataset || !r.dataset.itemType) continue;
      var ri = clipRowInfo(r);
      r.classList.toggle("multi-sel", !!multiSel && ri.parentId === multiSel.parentId &&
        multiSel.items.some(function(x){ return x.type === ri.type && x.id === ri.id; }));
    }
  }

  (function bindMultiSel(){
    var wrap = document.getElementById("millerWrap");
    if(wrap && wrap.addEventListener){
      // stop the browser's Shift+click text highlight
      wrap.addEventListener("mousedown", function(ev){
        if(ev.shiftKey && state.editMode && isAdminNow()) ev.preventDefault();
      }, true);
    }
    document.addEventListener("keydown", function(ev){
      if(ev.key === "Escape" && multiSel) multiSelClear();
    }, true);
  })();
