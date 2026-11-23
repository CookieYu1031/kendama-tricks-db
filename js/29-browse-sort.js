"use strict";

  /* ============================================================
     BROWSE — per-column display sort (A~Z default / asc / desc)
     In-memory only (state.colSort); never written back to the data.
  ============================================================ */
  addStrings({
    zh:{ colSortDefault:"A~Z 預設", colSortAsc:"A~Z ↓", colSortDesc:"A~Z ↑", colSortTip:"切換此層排序" },
    jp:{ colSortDefault:"A~Z 既定", colSortAsc:"A~Z ↓", colSortDesc:"A~Z ↑", colSortTip:"この階層の並び順を切り替え" },
    en:{ colSortDefault:"A~Z Default", colSortAsc:"A~Z ↓", colSortDesc:"A~Z ↑", colSortTip:"Change sort order of this level" }
  });

  function colSortMode(key){
    var m = state.colSort && state.colSort[key];
    return m === "asc" || m === "desc" ? m : "default";
  }
  function nextColSortMode(mode){
    return mode === "default" ? "asc" : mode === "asc" ? "desc" : "default";
  }
  function colSortLocale(){
    return state.lang === "jp" ? "ja" : state.lang === "en" ? "en" : "zh-Hant";
  }
  // Returns a new array; "default" = the custom order (sortColumnItems).
  function applyColSort(items, mode, parentId){
    var base = sortColumnItems(items, parentId);
    if(mode !== "asc" && mode !== "desc") return base;
    var coll = new Intl.Collator(colSortLocale(), { numeric:true, sensitivity:"base" });
    var dir = mode === "asc" ? 1 : -1;
    var withIdx = base.map(function(it, i){ return { it:it, i:i, n:localize(it.name) || "" }; });
    withIdx.sort(function(a, b){
      var c = coll.compare(a.n, b.n);
      return c !== 0 ? c * dir : a.i - b.i;
    });
    return withIdx.map(function(x){ return x.it; });
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
    return t(mode === "asc" ? "colSortAsc" : mode === "desc" ? "colSortDesc" : "colSortDefault");
  }
  function buildColSortBar(colKey){
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
    var bar = document.createElement("div");
    bar.className = "col-sort-bar";
    bar.appendChild(btn);
    return bar;
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
