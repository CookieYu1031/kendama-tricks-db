"use strict";

  addStrings({
    zh: { copied:"已複製", copyHint:"點擊複製", tagsLabel:"標籤", addTag:"新增標籤", newTagPlaceholder:"標籤名稱",
      removeTagFromTrick:"從此招式移除標籤", deleteTagGlobal:"刪除此標籤（所有招式）",
      confirmDeleteTagTitle:"確認刪除此標籤？", confirmDeleteTagBody:"此標籤將自所有招式中移除，此動作無法復原。",
      gripLabel:"持法", partsLabel:"部位", rateLabel:"成功率", officialNoteLabel:"官方備註", personalNoteLabel:"我的備註",
      rate_none:"無", rateHint_none:"尚未成功", nameRequiredToast:"至少要保留一個名稱" },
    jp: { copied:"コピーしました", copyHint:"クリックでコピー", tagsLabel:"タグ", addTag:"タグを追加", newTagPlaceholder:"タグ名",
      removeTagFromTrick:"この技からタグを外す", deleteTagGlobal:"このタグを削除（全ての技）",
      confirmDeleteTagTitle:"このタグを削除しますか？", confirmDeleteTagBody:"このタグは全ての技から外れます。この操作は元に戻せません。",
      gripLabel:"持ち方", partsLabel:"部位", rateLabel:"成功率", officialNoteLabel:"公式メモ", personalNoteLabel:"自分のメモ",
      rate_none:"なし", rateHint_none:"まだ成功していない", nameRequiredToast:"名前は最低1つ必要です" },
    en: { copied:"Copied", copyHint:"Click to copy", tagsLabel:"Tags", addTag:"Add tag", newTagPlaceholder:"Tag name",
      removeTagFromTrick:"Remove tag from this trick", deleteTagGlobal:"Delete this tag (all tricks)",
      confirmDeleteTagTitle:"Delete this tag?", confirmDeleteTagBody:"This tag will be removed from every trick. This cannot be undone.",
      gripLabel:"Grip", partsLabel:"Parts", rateLabel:"Landing rate", officialNoteLabel:"Official note", personalNoteLabel:"My note",
      rate_none:"None", rateHint_none:"not landed yet", nameRequiredToast:"At least one name is required" }
  });

  /* ============================================================
     DETAIL DRAWER
  ============================================================ */
  function openDrawerFor(trickId){
    state.detailTrickId = trickId;
    state.reviewSubmissionId = null;
    drawerUi.tagPicker = false; drawerUi.rateHint = false;
    attachDrawerSwipeClose(document.getElementById("detailDrawer"));
    renderColumns();
    renderDrawer();
    document.getElementById("detailDrawer").classList.add("show");
  }
  function closeDrawer(){
    state.detailTrickId = null;
    state.reviewSubmissionId = null;
    document.getElementById("detailDrawer").classList.remove("show");
    renderColumns();
  }

  // Mobile only (checked live per gesture). The panel follows the finger
  // horizontally (rightward only) once the gesture is clearly horizontal;
  // vertical motion is left to the scrolling body. Attached once per element.
  function attachDrawerSwipeClose(drawerEl){
    if(!drawerEl || drawerEl._swipeAttached) return;
    drawerEl._swipeAttached = true;
    var startX = 0, startY = 0, lastX = 0, lastT = 0, vx = 0, mode = null; // mode: null | "pending" | "drag" | "skip"
    function reset(){ mode = null; }
    drawerEl.addEventListener("touchstart", function(ev){
      mode = null;
      if(!isNarrowViewport() || ev.touches.length !== 1) return;
      var tg = ev.target;
      if(tg && tg.closest && tg.closest("input, textarea, select, [contenteditable]")){ mode = "skip"; return; }
      var t0 = ev.touches[0];
      startX = lastX = t0.clientX; startY = t0.clientY; lastT = Date.now(); vx = 0;
      mode = "pending";
    }, { passive: true });
    drawerEl.addEventListener("touchmove", function(ev){
      if(mode !== "pending" && mode !== "drag") return;
      var t1 = ev.touches[0];
      var dx = t1.clientX - startX, dy = t1.clientY - startY;
      if(mode === "pending"){
        if(Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
        if(drawerSwipeDecision(dx, dy, 0, 1) === "ignore"){ mode = "skip"; return; }
        mode = "drag";
        drawerEl.style.transition = "none";
      }
      var now = Date.now();
      if(now > lastT) vx = (t1.clientX - lastX) / (now - lastT);
      lastX = t1.clientX; lastT = now;
      drawerEl.style.transform = "translateX(" + Math.max(0, dx) + "px)";
      if(ev.cancelable) ev.preventDefault();
    }, { passive: false });
    function end(cancelled){
      if(mode !== "drag"){ reset(); return; }
      reset();
      var w = drawerEl.getBoundingClientRect().width;
      var m = /translateX\(([\d.]+)px\)/.exec(drawerEl.style.transform || "");
      var dx = m ? parseFloat(m[1]) : 0;
      drawerEl.style.transition = "";
      if(!cancelled && drawerSwipeDecision(dx, 0, vx, w) === "close"){
        drawerEl.style.transform = "translateX(100%)";
        closeDrawer();
        setTimeout(function(){
          if(!drawerEl.classList.contains("show")) drawerEl.style.transform = "";
        }, 400);
      } else {
        drawerEl.style.transform = "";
      }
    }
    drawerEl.addEventListener("touchend", function(){ end(false); });
    drawerEl.addEventListener("touchcancel", function(){ end(true); });
  }

  function renderDrawer(){
    var drawer = document.getElementById("detailDrawer");
    if(state.reviewSubmissionId && typeof renderSubmissionDrawer === "function"){ renderSubmissionDrawer(drawer); return; } // admin review (76)
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

    var head = document.createElement("div");
    head.className = "drawer-head" + (tr.custom ? " custom" : "");
    var headLeft = document.createElement("div");
    headLeft.className = "drawer-head-left";
    var title;
    var mainLang = state.lang;
    if(canEditTrick){
      // Edit mode: the big title is the input for the main-language name.
      title = document.createElement("input");
      title.type = "text"; title.className = "drawer-title drawer-title-input";
      title.value = tr.name[mainLang] || "";
      title.placeholder = t(mainLang === "jp" ? "categoryNameJp" : mainLang === "en" ? "categoryNameEn" : "categoryNameZh");
      title.addEventListener("input", function(){ if(setTrickName(tr, mainLang, title.value)) saveDB(); });
      title.addEventListener("blur", function(){ commitNameInput(tr, mainLang, title); });
    } else {
      title = document.createElement("div");
      title.className = "drawer-title";
      title.textContent = resolveDisplayName(tr.name).text;
    }
    headLeft.appendChild(title);
    var headActions = document.createElement("div");
    headActions.className = "drawer-head-actions";

    // Edit mode: 7-char unique ID, click copies "@id".
    if(state.editMode){
      var idBtn = document.createElement("button");
      idBtn.type = "button"; idBtn.className = "drawer-id-btn"; idBtn.title = t("copyHint");
      idBtn.textContent = trickIdLabel(tr);
      idBtn.addEventListener("click", function(){ copyDrawerText(trickIdLabel(tr)); });
      headActions.appendChild(idBtn);
    }
    // Contributors: 投稿 button on their own custom tricks in 總表 (72).
    var submitBtn = typeof buildSubmitButton === "function" ? buildSubmitButton(tr) : null;
    if(submitBtn) headActions.appendChild(submitBtn);

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

    // Name table. View mode: the other languages (otherNames skips the one the
    // big title shows verbatim; empty languages are hidden). Edit mode: all three
    // languages as inputs.
    var nameTable = document.createElement("div");
    nameTable.className = "name-table";
    if(canEditTrick){
      nameTableLangs(mainLang).forEach(function(l){
        var row = document.createElement("div");
        row.className = "name-row";
        var tag = document.createElement("span");
        tag.className = "lang-tag"; tag.textContent = l.toUpperCase();
        var inp = document.createElement("input");
        inp.type = "text"; inp.className = "drawer-inline-input";
        inp.value = tr.name[l] || "";
        inp.addEventListener("input", function(){ if(setTrickName(tr, l, inp.value)) saveDB(); });
        inp.addEventListener("blur", function(){ commitNameInput(tr, l, inp); });
        row.appendChild(tag); row.appendChild(inp);
        nameTable.appendChild(row);
      });
    } else {
      otherNames(tr.name).forEach(function(pair){
        var row = document.createElement("div");
        row.className = "name-row";
        row.innerHTML = '<span class="lang-tag">' + pair[0] + '</span><span class="name-val">' + escapeHtml(pair[1]) + '</span>';
        nameTable.appendChild(row);
      });
    }
    body.appendChild(nameTable);

    // Everything below the name table (plain wrapper; always fully shown).
    var expandContent = document.createElement("div");

    // Edit mode: icon + color.
    if(canEditTrick) buildDrawerIconSection(tr, expandContent);

    if(trickTagChips(tr).length || canEditTrick) buildDrawerTags(tr, canEditTrick, expandContent);
    if(canEditTrick || tr.grip || (tr.parts && tr.parts.length)) buildDrawerGripParts(tr, canEditTrick, expandContent);
    buildDrawerVideosNotes(tr, canEditTrick, expandContent);

    body.appendChild(expandContent);

    drawer.appendChild(head);
    drawer.appendChild(body);
    drawer.appendChild(buildDrawerRateFoot(tr));
    if(canEditTrick) drawer.appendChild(buildDrawerEditFoot(tr));
  }
