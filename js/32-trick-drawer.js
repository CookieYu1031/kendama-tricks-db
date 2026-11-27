"use strict";

  addStrings({
    zh: { editIconColor:"編輯顏色與圖示", copied:"已複製", copyHint:"點擊複製", tagsLabel:"標籤", addTag:"加入標籤",
      removeTagFromTrick:"從此招式移除標籤",
      confirmDeleteTagTitle:"確認刪除此標籤？", confirmDeleteTagBody:"此標籤將自所有招式中移除，此動作無法復原。",
      gripLabel:"握持手勢", partsLabel:"部位", rateLabel:"成功率", personalNoteLabel:"備註",
      rate_none:"無", rateHint_none:"尚未成功", nameRequiredToast:"至少要保留一個名稱",
      part_kensaki:"劍尖", part_kenchou:"劍頂", part_sara:"大小皿", part_saraEdge:"皿邊",
      part_kenBody:"劍身", part_suberidome:"止滑", part_chuzara:"中皿", part_chuzaraEdge:"中皿邊",
      part_string:"線", part_tamaTop:"球", part_ana:"球洞", part_tamaPoint:"球上一點", part_junction:"交界" },
    jp: { editIconColor:"色とアイコンを編集", copied:"コピーしました", copyHint:"クリックでコピー", tagsLabel:"タグ", addTag:"タグを選ぶ",
      removeTagFromTrick:"この技からタグを外す",
      confirmDeleteTagTitle:"このタグを削除しますか？", confirmDeleteTagBody:"このタグは全ての技から外れます。この操作は元に戻せません。",
      gripLabel:"持ち方", partsLabel:"部位", rateLabel:"成功率", personalNoteLabel:"メモ",
      rate_none:"なし", rateHint_none:"まだ成功していない", nameRequiredToast:"名前は最低1つ必要です",
      part_kensaki:"けん先", part_kenchou:"剣頂", part_sara:"大皿・小皿", part_saraEdge:"皿の縁",
      part_kenBody:"剣身", part_suberidome:"滑り止め", part_chuzara:"中皿", part_chuzaraEdge:"中皿の縁",
      part_string:"糸", part_tamaTop:"玉", part_ana:"穴", part_tamaPoint:"玉の一点", part_junction:"境目" },
    en: { editIconColor:"Edit color & icon", copied:"Copied", copyHint:"Click to copy", tagsLabel:"Tags", addTag:"Pick tag",
      removeTagFromTrick:"Remove tag from this trick",
      confirmDeleteTagTitle:"Delete this tag?", confirmDeleteTagBody:"This tag will be removed from every trick. This cannot be undone.",
      gripLabel:"Grip", partsLabel:"Parts", rateLabel:"Landing rate", personalNoteLabel:"Note",
      rate_none:"None", rateHint_none:"not landed yet", nameRequiredToast:"At least one name is required",
      part_kensaki:"Spike top", part_kenchou:"Spike", part_sara:"Cup", part_saraEdge:"CupSide",
      part_kenBody:"Body", part_suberidome:"Slide", part_chuzara:"BaseCup", part_chuzaraEdge:"Stilt",
      part_string:"String", part_tamaTop:"Ball", part_ana:"Hole", part_tamaPoint:"Ball top point", part_junction:"Junction" }
  });

  /* ============================================================
     DETAIL DRAWER
  ============================================================ */
  // Desktop: the card slides in from / out to the right edge (CSS animation on .show /
  // .closing); closing keeps .show for DRAWER_CLOSE_MS so the slide-out is visible.
  var DRAWER_CLOSE_MS = 260, drawerCloseTimer = null;
  // Shared by the trick and info drawers: cancels a pending slide-out, resets picker state, returns the card.
  function drawerPrepareOpen(){
    var el = document.getElementById("detailDrawer");
    if(drawerCloseTimer){ clearTimeout(drawerCloseTimer); drawerCloseTimer = null; }
    el.classList.remove("closing");
    drawerUi.tagPicker = false; drawerUi.videoEdit = null;
    return el;
  }
  // containerKey (optional): the list the trick was opened from; the prefix belongs to that placement.
  function openDrawerFor(trickId, containerKey){
    var el = drawerPrepareOpen();
    state.detailInfoId = null; // trick and info drawers are exclusive
    state.detailTrickId = trickId;
    state.detailContainerKey = containerKey; // never carried over from the previous trick
    var opened = getTrick(trickId);
    if(opened && containerKey !== FAV_STARRED_ID && containerKey !== FAV_CUSTOM_ID){
      // Freeze the placement now, so browsing columns while the drawer is open doesn't change it.
      var resolved = resolveDrawerContainer(opened);
      state.detailContainerKey = resolved === null ? undefined : resolved;
    }
    renderColumns();
    renderDrawer();
    el.classList.add("show");
  }
  function closeDrawer(){
    var el = document.getElementById("detailDrawer");
    clearDrawerState();
    state.detailContainerKey = undefined;
    if(el.classList.contains("show") && !el.classList.contains("closing") && !isNarrowViewport()){
      el.classList.add("closing");
      drawerCloseTimer = setTimeout(function(){
        drawerCloseTimer = null;
        el.classList.remove("show"); el.classList.remove("closing");
      }, DRAWER_CLOSE_MS);
    } else if(!el.classList.contains("closing")){
      el.classList.remove("show");
    }
    renderColumns();
  }

  // Closes the drawer when the trick / info item it shows was deleted.
  function closeDrawerIfGone(){
    if((state.detailTrickId && !getTrick(state.detailTrickId)) || (state.detailInfoId && !getInfo(state.detailInfoId))) closeDrawer();
  }

  function renderDrawer(){
    var drawer = document.getElementById("detailDrawer");
    if(state.detailInfoId){ renderInfoDrawer(); return; } // js/37
    if(!state.detailTrickId){ return; }
    var tr = getTrick(state.detailTrickId);
    if(!tr){ closeDrawer(); return; }
    // Edit-mode controls only when this account may modify the trick: official
    // tricks in locked tables are admin-only, custom tricks are always the user's.
    var canEditTrick = state.editMode && canModifyItem({ type:"trick", ref:tr }, null,
      typeof isAdminAccount === "function" && isAdminAccount());

    drawer.innerHTML = "";
    drawer.style.transform = "";
    drawer.style.transition = "";

    var sec = drawerSections(tr, state.editMode, canEditTrick);

    var key = resolveDrawerContainer(tr);
    var prefixOnly = drawerPrefixOnly(key, state.editMode, isGuest(), canEditTrick);

    var head = document.createElement("div");
    head.className = "drawer-head" + (tr.custom ? " custom" : "");
    var headLeft = document.createElement("div");
    headLeft.className = "drawer-head-left";
    // Title: [prefix] name. Edit mode keeps it on one line (the icon, prefix and names are edited in the body).
    var title = document.createElement("div");
    title.className = "drawer-title" + (canEditTrick ? " single" : "");
    function paintTitle(){ fillDrawerTitle(title, tr.name, key ? getTrickPrefix(tr, key) : "", tr); }
    paintTitle();
    headLeft.appendChild(title);
    var headActions = document.createElement("div");
    headActions.className = "drawer-head-actions";

    // Edit mode: 7-char unique ID chip, click copies "@id".
    if(state.editMode){
      var idBtn = document.createElement("button");
      idBtn.type = "button"; idBtn.className = "drawer-id-btn"; idBtn.title = t("copyHint");
      idBtn.textContent = trickIdLabel(tr);
      idBtn.addEventListener("click", function(){ copyDrawerText(trickIdLabel(tr)); });
      headActions.appendChild(idBtn);
    }

    // Quick-toggle: star / un-star (tr.favorite, via toggleFavorite).
    var goalBtn = document.createElement("button");
    goalBtn.type = "button";
    var starOn = isFavorite(tr.id);
    goalBtn.className = "drawer-quick-btn drawer-star-btn" + (starOn ? " active" : "");
    goalBtn.innerHTML = starOn ? ICON_STAR_SOLID : ICON_STAR_OUTLINE;
    goalBtn.title = t("toggleGoal");
    goalBtn.addEventListener("click", function(){
      toggleFavorite(tr.id);
      if(typeof renderSpaceRail === "function") renderSpaceRail();
      renderColumns();
      if(!closeDrawerIfLeftActiveBucket(tr.id)) renderDrawer();
    });

    var closeBtn = document.createElement("button");
    closeBtn.className = "drawer-close"; closeBtn.innerHTML = ICON_X;
    closeBtn.addEventListener("click", closeDrawer);

    if(!isGuest()) headActions.appendChild(goalBtn); // D8: guests can't favorite
    headActions.appendChild(closeBtn);
    head.appendChild(headLeft); head.appendChild(headActions);

    var body = document.createElement("div");
    body.className = "drawer-body";

    // Names. Edit mode: icon + prefix + three names in two columns. View mode: the other
    // languages (otherNames skips the one the title shows verbatim; empty ones hidden).
    var nameTable = document.createElement("div");
    nameTable.className = "name-table";
    if(canEditTrick){
      body.appendChild(buildDrawerNameGrid(tr, key, paintTitle));
    } else {
      if(prefixOnly) body.appendChild(buildDrawerPrefixLine(tr, key, paintTitle));
      var others = otherNames(tr.name);
      // Two short names sit side by side (half width each); long ones keep one per row.
      if(namesFitSideBySide(others)) nameTable.classList.add("pair");
      others.forEach(function(pair){
        var row = document.createElement("div");
        row.className = "name-row";
        row.innerHTML = '<span class="lang-tag">' + pair[0] + '</span><span class="name-val">' + escapeHtml(pair[1]) + '</span>';
        nameTable.appendChild(row);
      });
    }
    if(nameTable.children.length) body.appendChild(nameTable);

    // Sections below the names; view mode renders only those with data (drawerSections).
    var expandContent = document.createElement("div");
    // Order: diagram / grip picker, tags, videos, note. View mode puts the diagram and the chip
    // flow in one .drawer-viz box (side by side when the drawer body is wide, see detail-drawer.css).
    if(sec.gripParts) buildDrawerGripParts(tr, expandContent);
    if(sec.tags) buildDrawerTags(tr, canEditTrick, expandContent);
    if(sec.diagram || sec.flow){
      var viz = document.createElement("div");
      viz.className = "drawer-viz" + (sec.diagram ? " has-diagram" : "");
      if(sec.diagram) viz.appendChild(buildPartDiagram(tr, false, null, true)); // view mode (edit mode embeds it in buildDrawerGripParts)
      if(sec.flow) buildDrawerFlowChips(tr, viz);
      if(viz.children.length) expandContent.appendChild(viz);
    }
    if(sec.videos) buildDrawerVideoSlots(tr, canEditTrick, expandContent);
    if(sec.note) buildDrawerNote(tr, state.editMode, expandContent);
    body.appendChild(expandContent);

    drawer.appendChild(head);
    drawer.appendChild(body);
    drawer.appendChild(buildDrawerRateFoot(tr));
    var editFoot = buildDrawerEditFoot(tr, canEditTrick, prefixOnly ? key : null);
    if(editFoot) drawer.appendChild(editFoot);
  }
