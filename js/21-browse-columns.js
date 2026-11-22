"use strict";

  /* ============================================================
     BROWSE — render(), miller columns, flat/grid views, item rows
  ============================================================ */
  // render() with no argument rebuilds everything. Pass { chrome, rail, columns,
  // drawer } (any subset, truthy = rebuild) to refresh only those parts when the
  // caller knows nothing else changed. The lookup index is always invalidated
  // first, so a partial render never reads stale data.
  function render(parts){
    invalidateDbIndex();
    if(isGuest()) enforceGuestView();
    var all = !parts;
    if(all || parts.chrome) renderChrome();
    if(all || parts.rail) renderSpaceRail();
    if(all || parts.columns) renderColumns();
    if(all || parts.drawer) renderDrawer();
  }
  // D8: guests can't edit and can't sit in 收藏 / custom tables (e.g. right after logout).
  function enforceGuestView(){
    state.editMode = false;
    if(!isGuestVisibleSpace(state.activeSpace)){
      state.activeSpace = GUEST_SPACE_IDS[0];
      state.path = []; state.detailTrickId = null;
    }
  }
  // Tree navigation (path change only): rail, chrome and drawer don't depend on it.
  var RENDER_COLUMNS_ONLY = { columns: true };

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
    if(typeof beginPendingRender === "function") beginPendingRender(); // admin red dots / ghost rows (56)

    var activeSpaceObj = getSpace(state.activeSpace);
    var viewMode = activeSpaceObj ? (activeSpaceObj.viewMode || "tree") : "tree";
    if(viewMode !== "tree"){
      renderFlatTrickView(wrap, viewMode);
      if(typeof syncSwipeBack === "function") syncSwipeBack(0, false);
      return;
    }
    wrap.classList.remove("flat-view");
    wrap.classList.remove("search-results");

    var columns = buildColumnChain();
    var isMobile = isPhoneViewport();
    var isTablet = isTabletViewport();
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

      // Tablet: only the last two levels stay open; earlier ones fold to the icon strip (tap to jump up).
      var collapsed = isTablet ? colIndex <= columns.length - 3
        : (!isMobile && focusIdx !== -1 && colIndex <= focusIdx - 2);
      colEl.className = "m-col" + (collapsed ? " collapsed" : "") + (isMobile && colIndex === columns.length-1 ? " mobile-active" : "") + (isMobile && columns.length > 1 && colIndex === columns.length-2 ? " mobile-under" : "");

      // Removed-but-unpublished items stay in place as ghost rows (56); drag/reorder only sees real rows.
      var ghosts = typeof pendingGhostItems === "function" ? pendingGhostItems(col.parentId) : [];
      var items = sortColumnItems(col.items.concat(ghosts), col.parentId);
      var realItems = ghosts.length ? items.filter(function(x){ return !x.ghost; }) : items;

      var itemsWrap = document.createElement("div");
      itemsWrap.className = "col-items";

      if(items.length === 0){
        var empty = document.createElement("div");
        empty.className = "col-empty";
        empty.innerHTML = ICON_EMPTY + "<div>" + escapeHtml(t("noSubItems")) + "</div>" + (state.editMode? "<div>"+escapeHtml(t("clickAddBelow"))+"</div>" : "");
        itemsWrap.appendChild(empty);
      } else {
        var realIdx = 0;
        items.forEach(function(it){
          if(it.ghost){ itemsWrap.appendChild(buildPendingGhostRow(it)); return; }
          itemsWrap.appendChild(renderItemRow(it, col.parentId, colIndex, realIdx++, realItems));
        });
      }
      colEl.appendChild(itemsWrap);

      // Each column keeps its own "add category / add trick" controls, scoped to that
      // column's own level (col.parentId) — not a single global control for whichever
      // column happens to be deepest. Pinned to the bottom of the column via the
      // col-items flex-grow above, regardless of how many rows are in the list.
      if(state.editMode){
        var fabParts = renderColFab(col); // + button and edit-this-folder pill (js/26)
        fabParts.forEach(function(el){ colEl.appendChild(el); });
        if(fabParts.length) colEl.classList.add("has-fab");
      }
    });

    while(wrap.children.length > columns.length) wrap.removeChild(wrap.lastChild);
    if(typeof syncSwipeBack === "function") syncSwipeBack(columns.length, true); // narrow-view swipe-back handle (js/27)

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
    row.className = "item grid-item" + (tr.custom ? " custom" : "") + (isCurrentTrick ? " selected" : "");
    row.title = localize(tr.name);
    row.dataset.itemId = tr.id; row.dataset.itemType = "trick";
    row.appendChild(visual.icon);
    row.appendChild(visual.textWrap);

    if(state.editMode && canModifyItem(it, null, isAdminNow())) appendBucketEditActions(row, tr, spaceId, null);

    if(typeof applyPendingMark === "function") applyPendingMark(row, it);
    row.addEventListener("click", function(){ openDrawerFor(tr.id); });
    return row;
  }

  // Edit-mode row actions for the goal grid: an "edit" button (caller-
  // supplied — the full trick editor) plus a "remove" button. For a
  // bucket-backed space (收藏) removing only takes the trick out of that
  // bucket — the underlying trick is untouched and stays wherever else it's
  // filed; for any other "columns" space (no bucket) it falls back to
  // permanently deleting the trick (confirm dialog).
  function appendBucketEditActions(container, tr, spaceId, onEdit){
    var actions = document.createElement("div");
    actions.className = "item-edit-actions flat-edit-actions";
    var editBtn = null;
    if(onEdit){ // tricks pass null: they are edited in the drawer
      editBtn = document.createElement("button");
      editBtn.className = "mini-btn"; editBtn.innerHTML = ICON_EDIT;
      editBtn.addEventListener("click", function(ev){ ev.stopPropagation(); onEdit(); });
    }
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
        requestDeleteTrick(tr.id, null);
      }
    });
    if(editBtn) actions.appendChild(editBtn);
    actions.appendChild(removeBtn);
    container.appendChild(actions);
  }

  // Builds the icon + name/meta text block shared by every item row —
  // the miller-column tree (renderItemRow) and the flat "columns" grid
  // (renderGridItemRow) both use this, so a trick or category looks
  // exactly the same wherever it's presented.
  var ICON_INFO_ROW = '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8"/><path d="M12 11v5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="8" r="1.2" fill="currentColor"/></svg>';

  function buildItemVisual(it){
    var hasChildren = it.type==="trick" && trickHasChildren(it.id);

    var icon = document.createElement("div");
    icon.className = "item-icon" + (it.type==="trick" ? " trick" : "") + (hasChildren ? " has-children" : "");
    if(it.type==="info"){
      icon.innerHTML = ICON_INFO_ROW;
    } else if(it.type==="category"){
      var cHex = colorHex(it.ref.color);
      icon.style.background = hexToRgba(cHex, 0.22);
      icon.style.color = cHex;
      if(isImageIcon(it.ref.icon)){
        icon.classList.add("img-icon");
        icon.innerHTML = iconHtml(it.ref.icon);
      } else if(it.ref.icon){
        icon.style.fontSize = "15px";
        icon.textContent = it.ref.icon;
      } else {
        icon.innerHTML = ICON_FOLDER;
      }
    } else {
      var tHex = it.ref.color ? colorHex(it.ref.color) : TRICK_DEFAULT_HEX;
      icon.style.background = hexToRgba(tHex, 0.22);
      icon.style.color = tHex;
      if(isImageIcon(it.ref.icon)){
        icon.classList.add("img-icon");
        icon.innerHTML = iconHtml(it.ref.icon);
      } else if(it.ref.icon){
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
    } else if(it.type==="trick"){
      var metaBits = [];
      // Being filed into 收藏 is a bucket membership, not a real "this
      // trick also lives under another category" cross-reference — exclude
      // that bucket category from this line so toggling a trick into 收藏
      // doesn't add unrelated-looking text here.
      var realCategoryIds = it.ref.categoryIds.filter(function(cid){
        return !getSpace(cid) && cid !== FAV_CUSTOM_ID && cid !== FAV_STARRED_ID;
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
    row.className = "item" + (it.type==="trick" && it.ref.custom ? " custom" : "") + ((isDrillable && state.path[colIndex]===it.id) || isCurrentTrick ? " selected" : "");
    row.title = localize(it.name);
    row.dataset.itemId = it.id;
    row.dataset.itemType = it.type;

    row.appendChild(visual.icon);
    row.appendChild(visual.textWrap);

    var admin = isAdminNow();
    if(state.editMode && canModifyItem(it, parentId, admin)){
      // Folders and info items get an edit button left of the chevron; tricks are edited in the drawer.
      if(canEditRow(it, parentId, admin)){
        var actions = document.createElement("div"), editBtn = document.createElement("button");
        actions.className = "item-edit-actions";
        editBtn.type = "button"; editBtn.className = "mini-btn"; editBtn.innerHTML = ICON_EDIT;
        editBtn.title = t("rowEdit"); editBtn.setAttribute("aria-label", t("rowEdit"));
        editBtn.addEventListener("click", function(ev){
          ev.stopPropagation();
          if(it.type === "category") openCategoryModal(it.id, parentId);
          else openInfoModal(it.id, parentId, true);
        });
        actions.appendChild(editBtn);
        row.appendChild(actions);
      }

      // Long-press (0.5s) to pick up and drag-reorder — no dedicated handle button.
      // Supports cross-level moves: dropping on a different column reparents the
      // item onto that column's container instead of just resorting siblings.
      if(canDragItem(it, parentId, admin) && !(it.type === "category" && isFixedFavFolder(it.id))) attachLongPressDrag(row, it, parentId, itemIdx, sortedItems);
    }

    if(typeof applyPendingMark === "function") applyPendingMark(row, it);

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
          render(RENDER_COLUMNS_ONLY);
        });
      }
      row.appendChild(chev);
    }

    if(it.type==="category"){
      row.addEventListener("click", function(){
        state.path = state.path.slice(0, colIndex).concat(it.id);
        render(RENDER_COLUMNS_ONLY);
      });
    } else if(it.type==="info"){
      row.addEventListener("click", function(){
        openInfoModal(it.id, parentId, false);
      });
    } else {
      row.addEventListener("click", function(){
        // Tricks with extension items open their detail drawer and drill into
        // their extension column at the same time, so both views stay in sync.
        // Tricks without extensions still need the path truncated to this level,
        // otherwise a previously-opened sibling's extension column would linger.
        state.path = hasChildren ? state.path.slice(0, colIndex).concat(it.id) : state.path.slice(0, colIndex);
        invalidateDbIndex();
        openDrawerFor(it.id); // re-renders columns + drawer itself
      });
    }

    return row;
  }
