"use strict";

  /* ============================================================
     BROWSE — render(), miller columns, flat/grid views, item rows
  ============================================================ */
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
