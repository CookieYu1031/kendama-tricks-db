"use strict";

  /* ============================================================
     BROWSE — per-column display order: the custom order (default) or the same order reversed ("desc")
     In-memory only (state.colSort); never written back to the data.
  ============================================================ */
  addStrings({
    zh:{ colSortDefault:"排序↓", colSortDesc:"排序↑", colSortTip:"切換此層排序" },
    jp:{ colSortDefault:"並び順↓", colSortDesc:"並び順↑", colSortTip:"この階層の並び順を切り替え" },
    en:{ colSortDefault:"Order ↓", colSortDesc:"Order ↑", colSortTip:"Change sort order of this level" }
  });

  function colSortMode(key){
    return state.colSort && state.colSort[key] === "desc" ? "desc" : "default";
  }
  function nextColSortMode(mode){ return mode === "desc" ? "default" : "desc"; }
  // Returns a new array: the custom order (sortColumnItems), or that order reversed.
  function applyColSort(items, mode, parentId){
    var base = sortColumnItems(items, parentId);
    return mode === "desc" ? base.reverse() : base;
  }
  // Drops sort entries for columns no longer in the chain; a space change clears all.
  function pruneColSort(keys){
    if(!state.colSort || state.colSortSpace !== state.activeSpace){
      state.colSort = {}; state.colSortSpace = state.activeSpace;
    }
    Object.keys(state.colSort).forEach(function(k){
      if(keys.indexOf(k) === -1) delete state.colSort[k];
    });
  }
  function colSortLabel(mode){
    return t(mode === "desc" ? "colSortDesc" : "colSortDefault");
  }
  // Pure: "on" (2+ items), "fixed" (1 item: label only, can't change), "blank" (empty / collapsed: placeholder).
  function colSortBarKind(count, collapsed){
    if(collapsed || count < 1) return "blank";
    return count > 1 ? "on" : "fixed";
  }
  // Always the same height, so first rows align across levels.
  function buildColSortBar(colKey, kind){
    var bar = document.createElement("div");
    bar.className = "col-sort-bar";
    if(kind === "blank"){ bar.setAttribute("aria-hidden", "true"); return bar; }
    if(kind === "fixed"){
      var lb = document.createElement("span");
      lb.className = "col-sort-btn fixed"; lb.textContent = colSortLabel("default");
      bar.appendChild(lb);
      return bar;
    }
    var btn = document.createElement("button");
    btn.type = "button"; btn.className = "col-sort-btn";
    btn.textContent = colSortLabel(colSortMode(colKey));
    btn.title = t("colSortTip"); btn.setAttribute("aria-label", t("colSortTip"));
    btn.addEventListener("click", function(ev){
      ev.stopPropagation();
      var next = nextColSortMode(colSortMode(colKey));
      if(next === "default") delete state.colSort[colKey]; else state.colSort[colKey] = next;
      render(RENDER_COLUMNS_ONLY);
    });
    bar.appendChild(btn);
    return bar;
  }

  // Finds which column currently displays the trick whose drawer is open — the
  // "focus" column that the collapse rule below measures distance from. Merely
  // drilling into categories or a trick-folder's own extension list doesn't move
  // this (those actions never touch state.detailTrickId), only actually opening
  // a trick's detail does.
  function findFocusColumnIndex(columns){
    if(!drawerIsOpen()) return -1;
    for(var i=0;i<columns.length;i++){
      var items = columns[i].items;
      for(var j=0;j<items.length;j++){
        if((items[j].type==="trick" && items[j].id===state.detailTrickId) || (items[j].type==="info" && items[j].id===state.detailInfoId)) return i;
      }
    }
    return -1;
  }
