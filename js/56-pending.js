"use strict";

  /* ============================================================
     PENDING CHANGES (待更新區) — admin only. 企劃書 §四.1: until published, an
     added/modified item shows a red dot at its icon's top-right, a removed one stays as a
     faded ghost row with a red ✕. Compared against the shared base this account is
     currently pinned to (all of t00/t01/t02). The diff itself lives in the admin's
     user data as always (50/53); this file only reads it for display + restore.
     Pure logic first (unit tested), DOM helpers last.
  ============================================================ */
  addStrings({
    zh:{ pendingChanged:"尚未發布的變動", pendingRemoved:"尚未發布的刪除，點擊還原", pendingRestore:"還原" },
    jp:{ pendingChanged:"未発行の変更", pendingRemoved:"未発行の削除。クリックで元に戻す", pendingRestore:"元に戻す" },
    en:{ pendingChanged:"Unpublished change", pendingRemoved:"Unpublished removal. Click to restore", pendingRestore:"Restore" }
  });

  function _pendJson(x){ return JSON.stringify(x); }

  // The three kinds of record of `data` that live in the shared tables, as id -> record maps.
  // A trick belongs when one of its containers is a shared table root or a folder in one
  // (same rule as tricksForSpace / buildPublishSnapshot).
  function pendingSlice(data){
    var out = { categories: {}, tricks: {}, infos: {} };
    if(!data) return out;
    var cont = {};
    SHARED_BASE_TABLE_IDS.forEach(function(sid){ cont[sid] = true; });
    (data.categories || []).forEach(function(c){
      if(isSharedBaseTable(c.spaceId)){ out.categories[c.id] = c; cont[c.id] = true; }
    });
    (data.infos || []).forEach(function(n){ if(isSharedBaseTable(n.spaceId)) out.infos[n.id] = n; });
    (data.tricks || []).forEach(function(tr){
      if((tr.categoryIds || []).some(function(cid){ return cont[cid]; })) out.tricks[tr.id] = tr;
    });
    return out;
  }

  function _pendName(it){ return it ? (it.name || it.title) : null; }

  // base / data: { categories, tricks, infos, tags }. -> see CLAUDE.md 檔案地圖 (56).
  //   byId: id -> "added" | "modified" | "removed"
  //   removedItems: [{ type, id, ref }]  (ref = the base copy)
  //   ancestorsWithChanges: id -> true   (folders that contain any pending change)
  function computePendingStatus(base, data){
    var b = pendingSlice(base), d = pendingSlice(data);
    var byId = {}, removedItems = [], sum = { added: 0, modified: 0, removed: 0, tags: 0 };
    var changed = [];
    // Order is not content: a trick/info/folder whose only difference is its position is NOT
    // marked itself. The ordering shows on the container instead (see below).
    function content(rec){
      var c = JSON.parse(_pendJson(rec));
      delete c.order; delete c.orderByCategory;
      return _pendJson(c);
    }
    var orderTouched = {}; // container id (folder, or table id) -> true
    function ordKey(rec, cid){
      var ob = rec.orderByCategory;
      return ob && typeof ob[cid] === "number" ? ob[cid] : null;
    }
    [["categories", "category"], ["tricks", "trick"], ["infos", "info"]].forEach(function(k){
      var kind = k[0], type = k[1];
      Object.keys(d[kind]).forEach(function(id){
        var dr = d[kind][id], br = b[kind][id];
        if(!br){
          byId[id] = "added"; sum.added++; changed.push(dr);
          return;
        }
        if(content(dr) !== content(br)){ byId[id] = "modified"; sum.modified++; changed.push(dr); }
        if(kind === "tricks"){
          var cids = {};
          (dr.categoryIds || []).concat(br.categoryIds || []).forEach(function(c){ cids[c] = true; });
          Object.keys(cids).forEach(function(cid){
            // Only containers the trick sits in on both sides: a membership change is a
            // content change of the trick itself (categoryIds), already marked above.
            if((dr.categoryIds || []).indexOf(cid) !== -1 && (br.categoryIds || []).indexOf(cid) !== -1 &&
              ordKey(dr, cid) !== ordKey(br, cid)) orderTouched[cid] = true;
          });
        } else {
          var pd = dr.parentId == null ? dr.spaceId : dr.parentId, pb = br.parentId == null ? br.spaceId : br.parentId;
          if(pd === pb && dr.order !== br.order) orderTouched[pd] = true; // a move is a content change (parentId)
        }
      });
      Object.keys(b[kind]).forEach(function(id){
        if(d[kind][id]) return;
        byId[id] = "removed"; sum.removed++;
        removedItems.push({ type: type, id: id, ref: b[kind][id] });
        changed.push(b[kind][id]);
      });
    });
    // Folder whose children's order changed counts as one modification.
    // A table root has no row: still counted once so the publish summary is not empty.
    Object.keys(orderTouched).forEach(function(cid){
      if(d.categories[cid] && b.categories[cid]){
        if(!byId[cid]){ byId[cid] = "modified"; sum.modified++; changed.push(d.categories[cid]); }
      } else if(!d.categories[cid] && !b.categories[cid] && SHARED_BASE_TABLE_IDS.indexOf(cid) !== -1){
        sum.modified++;
      }
    });
    // Ancestors: walk up through folders (category.parentId, trick/info containers).
    var parents = {};
    [b, d].forEach(function(s){
      Object.keys(s.categories).forEach(function(id){ parents[id] = [s.categories[id].parentId]; });
    });
    var anc = {};
    function up(ids, depth){
      if(depth > 60) return;
      (ids || []).forEach(function(pid){
        if(pid == null || !parents[pid] || anc[pid]) return;
        anc[pid] = true;
        up(parents[pid], depth + 1);
      });
    }
    changed.forEach(function(it){
      up(it.categoryIds ? it.categoryIds : [it.parentId], 0);
    });
    // Tags have no row: count by id.
    var bt = {}, dt = {};
    ((base && base.tags) || []).forEach(function(g){ bt[g.id] = g; });
    ((data && data.tags) || []).forEach(function(g){ dt[g.id] = g; });
    Object.keys(dt).forEach(function(id){ if(!bt[id] || _pendJson(bt[id]) !== _pendJson(dt[id])) sum.tags++; });
    Object.keys(bt).forEach(function(id){ if(!dt[id]) sum.tags++; });
    // Reordered tags (relative order of ids present on both sides) count as one pending change.
    var bOrder = ((base && base.tags) || []).map(function(g){ return g.id; }).filter(function(id){ return dt[id]; });
    var dOrder = ((data && data.tags) || []).map(function(g){ return g.id; }).filter(function(id){ return bt[id]; });
    if(bOrder.join("|") !== dOrder.join("|")) sum.tags++;
    // Admin-edited grip / part names (db.labels): one per changed key, counted with the tags.
    var bl = (base && base.labels) || {}, dl = (data && data.labels) || {};
    Object.keys(dl).forEach(function(k){ if(!bl[k] || _pendJson(bl[k]) !== _pendJson(dl[k])) sum.tags++; });
    Object.keys(bl).forEach(function(k){ if(!dl[k]) sum.tags++; });
    return { byId: byId, removedItems: removedItems, ancestorsWithChanges: anc, summary: sum };
  }

  // The base snapshot this account is currently pinned to (sync read of the cache), or null.
  function currentPendingBase(){
    if(typeof _currentViewingVersion === "undefined" || _currentViewingVersion === null) return null;
    return baseDataCache[SHARED_BASE_TABLE_ID + "@" + _currentViewingVersion] || null;
  }

  // Admin only; null when marks must not show (non-admin / base not loaded yet).
  function getPendingState(){
    if(!isAdminAccount()) return null;
    var base = currentPendingBase();
    if(!base) return null;
    return computePendingStatus(base, db);
  }

  // For the publish panel. Names are display names, at most `maxNames` per status (default 10).
  // -> { ready, added, modified, removed, tags, total, names:{ added:[], modified:[], removed:[] } }
  function getPendingSummary(maxNames){
    maxNames = maxNames > 0 ? maxNames : 10;
    var res = { ready: false, added: 0, modified: 0, removed: 0, tags: 0, total: 0, names: { added: [], modified: [], removed: [] } };
    var st = getPendingState();
    if(!st) return res;
    res.ready = true;
    res.added = st.summary.added; res.modified = st.summary.modified;
    res.removed = st.summary.removed; res.tags = st.summary.tags;
    res.total = res.added + res.modified + res.removed + res.tags;
    var d = pendingSlice(db), b = pendingSlice(currentPendingBase());
    Object.keys(st.byId).forEach(function(id){
      var s = st.byId[id];
      var it = (s === "removed" ? null : (d.categories[id] || d.tricks[id] || d.infos[id])) ||
        b.categories[id] || b.tricks[id] || b.infos[id];
      var arr = res.names[s];
      if(arr.length < maxNames) arr.push(localize(_pendName(it)) || id);
    });
    return res;
  }

  function _pendExists(id){
    return !!(getSpace(id) || getCategory(id) || getTrick(id) || (db.infos || []).some(function(n){ return n.id === id; }));
  }

  // Re-inserts the base copy of a removed item (a folder brings its removed descendants
  // too). Does not save/render. -> number of items restored.
  function restoreFromBaseData(base, id, depth){
    depth = depth || 0;
    if(depth > 60 || !base) return 0;
    var b = pendingSlice(base);
    var n = 0;
    var kind = b.categories[id] ? "categories" : (b.tricks[id] ? "tricks" : (b.infos[id] ? "infos" : null));
    if(!kind || _pendExists(id)) return 0;
    var copy = JSON.parse(_pendJson(b[kind][id]));
    if(kind === "tricks"){
      var live = copy.categoryIds.filter(_pendExists);
      if(live.length) copy.categoryIds = live;
      db.tricks.push(copy);
    } else if(kind === "categories"){
      db.categories.push(copy);
    } else {
      (db.infos = db.infos || []).push(copy);
    }
    n++;
    if(kind === "categories"){
      Object.keys(b.categories).forEach(function(cid){
        if(b.categories[cid].parentId === id) n += restoreFromBaseData(base, cid, depth + 1);
      });
      Object.keys(b.infos).forEach(function(nid){
        if(b.infos[nid].parentId === id) n += restoreFromBaseData(base, nid, depth + 1);
      });
      Object.keys(b.tricks).forEach(function(tid){
        if(b.tricks[tid].categoryIds.indexOf(id) !== -1) n += restoreFromBaseData(base, tid, depth + 1);
      });
    }
    return n;
  }

  function restorePendingRemoved(id){
    var n = restoreFromBaseData(currentPendingBase(), id, 0);
    if(n){ saveDB(); render(); }
    return n;
  }

  /* ------------------------------------------------------------
     Column integration (called from 21-browse-columns.js)
  ------------------------------------------------------------ */
  var _pendingNow = null; // state of the render in progress; null = no marks

  function beginPendingRender(){ _pendingNow = getPendingState(); return _pendingNow; }

  // Ghost items to splice into one column: removed base items whose parent is `parentId`
  // (null = active table root) and whose parent still exists. -> [{type,id,name,ref,ghost:true}]
  function pendingGhostItems(parentId){
    if(!_pendingNow || !_pendingNow.removedItems.length) return [];
    var key = parentId === null ? state.activeSpace : parentId;
    var out = [];
    _pendingNow.removedItems.forEach(function(r){
      var ref = r.ref, inCol;
      if(r.type === "trick") inCol = (ref.categoryIds || []).indexOf(key) !== -1;
      else inCol = parentId === null ? ref.spaceId === state.activeSpace && ref.parentId == null : ref.parentId === parentId;
      if(!inCol) return;
      out.push({ type: r.type, id: r.id, name: r.type === "info" ? ref.title : ref.name, ref: ref, ghost: true });
    });
    return out;
  }

  function pendingStatusOf(id){ return _pendingNow ? (_pendingNow.byId[id] || null) : null; }
  // Folder (or trick-folder) row that holds changes below it.
  function pendingHasChangeBelow(id){ return !!(_pendingNow && _pendingNow.ancestorsWithChanges[id]); }

  // Adds the red dot to a normal row when it (or something inside it) has an unpublished change.
  function applyPendingMark(row, it){
    if(!_pendingNow || it.ghost) return;
    if(pendingStatusOf(it.id) === "removed") return;
    if(!pendingStatusOf(it.id) && !pendingHasChangeBelow(it.id)) return;
    var dot = document.createElement("span");
    dot.className = "pending-dot";
    dot.title = t("pendingChanged");
    // Dot sits on the icon top-right corner (not the row).
    var icon = row.querySelector(".item-icon");
    if(icon){ icon.classList.add("pending-host"); icon.appendChild(dot); }
    else row.appendChild(dot);
  }

  // A faded, non-interactive-except-restore row for an item removed since the base.
  function buildPendingGhostRow(it){
    var visual = buildItemVisual(it);
    var row = document.createElement("div");
    row.className = "item pending-ghost";
    row.title = t("pendingRemoved");
    row.dataset.itemId = it.id;
    row.dataset.itemType = it.type;
    row.dataset.ghost = "1";
    row.appendChild(visual.icon);
    row.appendChild(visual.textWrap);
    var x = document.createElement("button");
    x.type = "button";
    x.className = "pending-x";
    x.innerHTML = ICON_X;
    x.title = t("pendingRestore");
    x.setAttribute("aria-label", t("pendingRestore"));
    row.appendChild(x);
    function restore(ev){ ev.stopPropagation(); restorePendingRemoved(it.id); }
    x.addEventListener("click", restore);
    row.addEventListener("click", restore);
    return row;
  }
