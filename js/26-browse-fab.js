"use strict";

  /* ============================================================
     BROWSE — per-column floating controls (edit mode):
     the round "+" (add) and the "edit this folder" pill tucked under its left side
  ============================================================ */
  // One floating "+" per column: opens the unified add modal (js/47-modal-add.js).
  // Shown only when the column accepts at least one type (permissions, level limits).
  function renderColAddRow(col){
    if(!canCreateIn(col.parentId, state.activeSpace)) return null; // 收藏 table: no creation (v0.9.1)
    var allow = allowedAddButtons(col.parentId, state.activeSpace, isAdminNow());
    if(!allow.folder && !allow.trick && !allow.info) return null;
    var b = document.createElement("button");
    b.type = "button";
    b.className = "col-add-fab";
    b.innerHTML = ICON_PLUS;
    b.title = t("addTitleBtn");
    b.setAttribute("aria-label", t("addTitleBtn"));
    b.addEventListener("click", function(){ openAddModal(col.parentId, state.activeSpace); });
    return b;
  }

  // What the pill edits for a column, or null (hidden). Pure given db/state:
  //   { kind:"folder", id, parentId } | { kind:"space", id }
  // Folder column -> that folder when the user may modify it; table root -> only
  // custom (unlocked, non-default) tables. Locked tables, favorites, trick-folders: none.
  function colEditTarget(parentId, spaceId, isAdmin){
    if(isGuest()) return null;
    if(parentId !== null){
      var cat = getCategory(parentId);
      if(!cat || cat.virtual || isFixedFavFolder(cat.id)) return null;
      if(!canModifyItem({ type:"category", id: cat.id, ref: cat }, cat.parentId, isAdmin)) return null;
      return { kind:"folder", id: cat.id, parentId: cat.parentId };
    }
    var sp = getSpace(spaceId);
    if(!sp || sp.locked || isDefaultSpaceId(sp.id) || !canEditTable(spaceId)) return null;
    return { kind:"space", id: sp.id };
  }

  function renderColEditPill(col, hasFab){
    var target = colEditTarget(col.parentId, state.activeSpace, isAdminNow());
    if(!target) return null;
    var b = document.createElement("button");
    b.type = "button";
    b.className = "col-edit-pill" + (hasFab ? "" : " no-fab");
    b.innerHTML = ICON_EDIT + "<span>" + escapeHtml(t("editThisFolder")) + "</span>";
    b.addEventListener("click", function(){
      if(target.kind === "folder") openCategoryModal(target.id, target.parentId);
      else openSpaceModal(target.id);
    });
    return b;
  }

  // What the share button shares for a column, or null. { kind:"folder"|"space", id }.
  // Only the user's own (unlocked) content: custom tables and folders inside unlocked tables
  // (incl. 收藏). Locked shared-base tables are never shared as a subtree.
  function colShareTarget(parentId, spaceId){
    if(isGuest()) return null;
    if(parentId !== null){
      var cat = getCategory(parentId);
      if(!cat || cat.virtual || isFixedFavFolder(cat.id)) return null;
      var sp0 = getSpace(cat.spaceId);
      if(!sp0 || sp0.locked) return null;
      return { kind:"folder", id: cat.id };
    }
    var sp = getSpace(spaceId);
    if(!sp || sp.locked || isDefaultSpaceId(sp.id)) return null;
    return { kind:"space", id: sp.id };
  }

  function renderColShareBtn(col){
    var target = colShareTarget(col.parentId, state.activeSpace);
    if(!target) return null;
    var b = document.createElement("button");
    b.type = "button";
    b.className = "col-share-btn";
    b.innerHTML = ICON_SHARE;
    b.title = t("shareBtn");
    b.setAttribute("aria-label", t("shareBtn"));
    b.addEventListener("click", function(){ if(typeof shareRun === "function") shareRun(target.kind, target.id); });
    return b;
  }

  // Elements to append to a column in edit mode: [ share button, + button, edit pill ] (either may be missing).
  function renderColFab(col){
    var out = [];
    var fab = renderColAddRow(col);
    var pill = renderColEditPill(col, !!fab);
    if(pill) out.push(pill);
    if(fab) out.push(fab);
    return out;
  }
