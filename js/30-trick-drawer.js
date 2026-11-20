"use strict";

  addStrings({
    zh: { copied:"已複製", copyHint:"點擊複製", tagsLabel:"標籤", addTag:"新增標籤", newTagPlaceholder:"標籤名稱",
      removeTagFromTrick:"從此招式移除標籤", deleteTagGlobal:"刪除此標籤（所有招式）",
      confirmDeleteTagTitle:"確認刪除此標籤？", confirmDeleteTagBody:"此標籤將自所有招式中移除，此動作無法復原。",
      gripLabel:"持法", partsLabel:"部位", rateLabel:"成功率", officialNoteLabel:"官方備註", personalNoteLabel:"我的備註" },
    jp: { copied:"コピーしました", copyHint:"クリックでコピー", tagsLabel:"タグ", addTag:"タグを追加", newTagPlaceholder:"タグ名",
      removeTagFromTrick:"この技からタグを外す", deleteTagGlobal:"このタグを削除（全ての技）",
      confirmDeleteTagTitle:"このタグを削除しますか？", confirmDeleteTagBody:"このタグは全ての技から外れます。この操作は元に戻せません。",
      gripLabel:"持ち方", partsLabel:"部位", rateLabel:"成功率", officialNoteLabel:"公式メモ", personalNoteLabel:"自分のメモ" },
    en: { copied:"Copied", copyHint:"Click to copy", tagsLabel:"Tags", addTag:"Add tag", newTagPlaceholder:"Tag name",
      removeTagFromTrick:"Remove tag from this trick", deleteTagGlobal:"Delete this tag (all tricks)",
      confirmDeleteTagTitle:"Delete this tag?", confirmDeleteTagBody:"This tag will be removed from every trick. This cannot be undone.",
      gripLabel:"Grip", partsLabel:"Parts", rateLabel:"Landing rate", officialNoteLabel:"Official note", personalNoteLabel:"My note" }
  });

  /* ============================================================
     DETAIL DRAWER
  ============================================================ */
  function openDrawerFor(trickId){
    state.detailTrickId = trickId;
    state.detailDrawerExpanded = false; // always reopen collapsed to the mobile peek state
    drawerUi.tagPicker = false; drawerUi.rateHint = false;
    renderColumns();
    renderDrawer();
    document.getElementById("detailDrawer").classList.add("show");
  }
  function closeDrawer(){
    state.detailTrickId = null;
    state.detailDrawerExpanded = false;
    document.getElementById("detailDrawer").classList.remove("show");
    renderColumns();
  }

  // Mobile bottom-sheet has two heights: "peek" (drag handle + head + name
  // table only — set via the .peek-mode class, see detail-drawer.css) and
  // full ("expanded", CSS's 92%). Desktop ignores this entirely since
  // .peek-mode only has an effect inside the mobile media query.
  function setDrawerExpanded(expanded){
    state.detailDrawerExpanded = expanded;
    applyDrawerModeClass(document.getElementById("detailDrawer"));
  }

  // Toggles .peek-mode and (for peek) sets an inline pixel height measured
  // from the actual rendered content, so the sheet is exactly as tall as
  // the drag handle + head + name table and no taller — a fixed vh/px guess
  // would either clip long multi-language names or leave dead space for
  // short ones. Measured via a synchronous height:auto -> scrollHeight ->
  // fixed-px swap: auto is needed to get the content's natural height (any
  // leftover inline height from a previous trick would otherwise constrain
  // the layout during measurement), but the final value must still be a
  // concrete number for the CSS `height` transition to animate between
  // states. Expanded state clears the inline height so CSS's own `height:
  // 92%` (detail-drawer.css) takes back over.
  function applyDrawerModeClass(drawer){
    var peek = isNarrowViewport() && !state.detailDrawerExpanded;
    drawer.classList.toggle("peek-mode", peek);
    if(peek){
      drawer.style.height = "auto";
      drawer.style.height = drawer.scrollHeight + "px";
    } else {
      drawer.style.height = "";
    }
  }

  // Swipe gestures on the drag handle / head, mobile only (checked live at
  // drag-start, not cached). Ignores presses starting on the close button so
  // its normal click still works. A downward swipe always closes the drawer
  // outright, from either the peek or expanded state. An upward swipe from
  // the peek state expands to the full detail view — this always resolves as
  // a discrete class swap on release rather than tracking the drag live,
  // but with an explicit (non-"auto") height on both states plus the
  // `height` transition in detail-drawer.css, the swap itself now animates
  // smoothly instead of snapping.
  function attachDrawerDragToClose(dragZone, drawerEl){
    var dragging = false, startY = 0, currentY = 0;
    dragZone.addEventListener("pointerdown", function(ev){
      if(!isNarrowViewport()) return;
      // Any button in the head (goal quick-toggle, close) needs its own
      // click to fire normally — starting the drag here would call
      // setPointerCapture, which re-targets the eventual click to dragZone
      // itself instead of the button that was actually pressed.
      if(ev.target.closest("button")) return;
      dragging = true; startY = ev.clientY; currentY = 0;
      drawerEl.style.transition = "none";
      try{ dragZone.setPointerCapture(ev.pointerId); }catch(e){}
    });
    dragZone.addEventListener("pointermove", function(ev){
      if(!dragging) return;
      currentY = ev.clientY - startY;
      if(currentY > 0) drawerEl.style.transform = "translateY(" + currentY + "px)";
    });
    function endDrag(){
      if(!dragging) return;
      dragging = false;
      drawerEl.style.transition = "";
      drawerEl.style.transform = "";
      var wasExpanded = !drawerEl.classList.contains("peek-mode");
      var downThreshold = Math.min(140, drawerEl.getBoundingClientRect().height * 0.28);
      var upThreshold = 44;
      if(currentY > downThreshold){
        closeDrawer();
      } else if(currentY < -upThreshold && !wasExpanded){
        setDrawerExpanded(true);
      }
    }
    dragZone.addEventListener("pointerup", endDrag);
    dragZone.addEventListener("pointercancel", endDrag);
  }

  /* ---------- Pure helpers (unit-tested in tests/drawer-logic.test.js) ---------- */
  // Tap an already-active level again to clear it.
  function toggleRate(tr, level){
    tr.rate = (tr.rate === level || RATE_LEVELS.indexOf(level) === -1) ? null : level;
    return tr.rate;
  }
  // Single-select grip chip (tap again clears).
  function toggleGrip(tr, key){
    tr.grip = (tr.grip === key || GRIP_KEYS.indexOf(key) === -1) ? null : key;
    return tr.grip;
  }
  // Multi-select part chip; result keeps the canonical PART_KEYS order.
  function togglePart(tr, key){
    if(PART_KEYS.indexOf(key) === -1) return tr.parts;
    var parts = tr.parts || [];
    if(parts.indexOf(key) === -1) parts = parts.concat([key]);
    else parts = parts.filter(function(p){ return p !== key; });
    tr.parts = PART_KEYS.filter(function(p){ return parts.indexOf(p) !== -1; });
    return tr.parts;
  }
  // [{ id, label }] for the tags on a trick (unknown ids skipped).
  function trickTagChips(tr){
    var out = [];
    (tr.tagIds || []).forEach(function(id){
      var tag = getTag(id);
      if(tag) out.push({ id: id, label: resolveDisplayName(tag.name).text });
    });
    return out;
  }
  // Existing tags not yet on the trick.
  function availableTagChips(tr){
    var have = tr.tagIds || [];
    return (db.tags || []).filter(function(g){ return have.indexOf(g.id) === -1; })
      .map(function(g){ return { id: g.id, label: resolveDisplayName(g.name).text }; });
  }
  // Adds a tag to the trick; creates it (addTag) unless a tag with the same name exists.
  function addTagToTrick(tr, text, lang){
    text = (text || "").trim();
    if(!text) return null;
    var low = text.toLowerCase();
    var tag = (db.tags || []).find(function(g){
      return ["zh", "jp", "en"].some(function(l){ return g.name[l] && g.name[l].toLowerCase() === low; });
    });
    if(!tag){
      var nm = { zh:"", jp:"", en:"" };
      nm[lang || "zh"] = text;
      tag = addTag(nm);
    }
    tr.tagIds = tr.tagIds || [];
    if(tr.tagIds.indexOf(tag.id) === -1) tr.tagIds.push(tag.id);
    saveDB();
    return tag;
  }
  // Location codes of a trick, e.g. ["001a-tr-00"]; one per placement in a table that has a code.
  function trickLocCodes(tr){
    var ix = ensureDbIndex();
    var seenSpace = {}, out = [];
    function catItem(c){ return { type:"fo", id:c.id, name:c.name, ref:c }; }
    function trItem(x){ return { type:"tr", id:x.id, name:x.name, ref:x }; }
    function infoItem(n){ return { type:"in", id:n.id, name:n.name || {}, ref:n }; }
    function sorted(items, parentId){
      return typeof sortColumnItems === "function" ? sortColumnItems(items, parentId) : items;
    }
    function kidsOf(parentId){
      var items = (ix.catsByParent[parentId] || []).map(catItem).concat((ix.tricksByContainer[parentId] || []).map(trItem));
      return sorted(items, parentId).concat((ix.infosByParent[parentId] || []).map(infoItem));
    }
    (tr.categoryIds || []).forEach(function(cid){
      var sid = containerSpaceId(cid);
      var sp = sid && getSpace(sid);
      if(!sp || !sp.code || seenSpace[sid]) return;
      seenSpace[sid] = true;
      var roots = ix.rootCats.filter(function(c){ return c.spaceId === sid; }).map(catItem)
        .concat((ix.tricksByContainer[sid] || []).map(trItem));
      roots = sorted(roots, null).concat(ix.rootInfos.filter(function(n){ return n.spaceId === sid; }).map(infoItem));
      var res = computeLocCodes(sp.code, roots, function(it){ return it.type === "in" ? [] : kidsOf(it.id); });
      locCodeOf(res, tr.id).forEach(function(c){ if(c && out.indexOf(c) === -1) out.push(c); });
    });
    return out;
  }
  function trickTableId(tr){
    return containerSpaceId((tr.categoryIds || [])[0]);
  }

  // Tag-picker / rate-hint open state for the drawer (reset when another trick opens).
  var drawerUi = { tagPicker: false, rateHint: false };

  function copyDrawerText(text){
    try{
      if(navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text);
    }catch(e){ /* ignore */ }
    showToast(t("copied"));
  }

  function makeChip(text, active, onClick){
    var b = document.createElement("button");
    b.type = "button";
    b.className = "drawer-chip" + (active ? " active" : "");
    b.textContent = text;
    if(onClick) b.addEventListener("click", onClick);
    else b.classList.add("static");
    return b;
  }
  function makeLabel(text){
    var l = document.createElement("div");
    l.className = "drawer-cats-label";
    l.textContent = text;
    return l;
  }

  function renderDrawer(){
    var drawer = document.getElementById("detailDrawer");
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

    // Drag zone = handle bar + head. On mobile (bottom-sheet layout) dragging
    // down from here dismisses the drawer, mirroring native pull-down-to-close
    // sheets; on desktop the handle is hidden via CSS and this is inert.
    var dragZone = document.createElement("div");
    dragZone.className = "drawer-drag-zone";
    var dragHandle = document.createElement("div");
    dragHandle.className = "drawer-drag-handle";
    dragHandle.innerHTML = "<span></span>";
    dragZone.appendChild(dragHandle);

    var head = document.createElement("div");
    head.className = "drawer-head" + (tr.custom ? " custom" : "");
    var headLeft = document.createElement("div");
    var title = document.createElement("div");
    title.className = "drawer-title";
    title.textContent = resolveDisplayName(tr.name).text;
    headLeft.appendChild(title);
    var headActions = document.createElement("div");
    headActions.className = "drawer-head-actions";

    // Quick-toggle: star / un-star (tr.favorite, via toggleFavorite).
    var goalBtn = document.createElement("button");
    goalBtn.type = "button";
    goalBtn.className = "drawer-quick-btn" + (isFavorite(tr.id) ? " active" : "");
    goalBtn.innerHTML = "⭐";
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

    headActions.appendChild(goalBtn);
    headActions.appendChild(closeBtn);
    head.appendChild(headLeft); head.appendChild(headActions);
    dragZone.appendChild(head);
    attachDrawerDragToClose(dragZone, drawer);

    var body = document.createElement("div");
    body.className = "drawer-body";

    // Name table. View mode: the other languages (otherNames skips the one the
    // big title shows verbatim; empty languages are hidden). Edit mode: all three
    // languages as inputs.
    var nameTable = document.createElement("div");
    nameTable.className = "name-table";
    if(canEditTrick){
      ["zh", "jp", "en"].forEach(function(l){
        var row = document.createElement("div");
        row.className = "name-row";
        var tag = document.createElement("span");
        tag.className = "lang-tag"; tag.textContent = l.toUpperCase();
        var inp = document.createElement("input");
        inp.type = "text"; inp.className = "drawer-inline-input";
        inp.value = tr.name[l] || "";
        inp.addEventListener("input", function(){
          tr.name[l] = inp.value.trim();
          title.textContent = resolveDisplayName(tr.name).text;
          saveDB();
        });
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

    // Everything below the name table is hidden on the mobile bottom-sheet's
    // "peek" state (see .peek-mode / .drawer-expand-content in
    // detail-drawer.css) — swiping up on the drag handle reveals it. Grouped
    // in one wrapper so the CSS only needs a single selector for the body's
    // share of the expand-only content; the footer blocks get the same
    // class directly since they're siblings of body, not inside it.
    var expandContent = document.createElement("div");
    expandContent.className = "drawer-expand-content";

    // Edit mode: 7-char ID + location code(s), click to copy.
    if(state.editMode){
      var meta = document.createElement("div");
      meta.className = "drawer-meta";
      [tr.id].concat(trickLocCodes(tr)).forEach(function(code){
        var el = document.createElement("button");
        el.type = "button"; el.className = "drawer-meta-code"; el.title = t("copyHint");
        el.textContent = code;
        el.addEventListener("click", function(){ copyDrawerText(code); });
        meta.appendChild(el);
      });
      expandContent.appendChild(meta);
    }

    // Tags
    var tagChips = trickTagChips(tr);
    if(tagChips.length || canEditTrick){
      expandContent.appendChild(makeLabel(t("tagsLabel")));
      var tagWrap = document.createElement("div");
      tagWrap.className = "drawer-chip-row";
      tagChips.forEach(function(c){
        var chip;
        if(canEditTrick){
          chip = makeChip(c.label + " ×", false, function(){
            tr.tagIds = (tr.tagIds || []).filter(function(x){ return x !== c.id; });
            saveDB(); renderDrawer();
          });
          chip.title = t("removeTagFromTrick");
        } else chip = makeChip(c.label, false);
        tagWrap.appendChild(chip);
      });
      if(canEditTrick){
        tagWrap.appendChild(makeChip("+ " + t("addTag"), drawerUi.tagPicker, function(){
          drawerUi.tagPicker = !drawerUi.tagPicker; renderDrawer();
        }));
      }
      expandContent.appendChild(tagWrap);
      if(canEditTrick && drawerUi.tagPicker){
        var picker = document.createElement("div");
        picker.className = "drawer-tag-picker";
        var pickRow = document.createElement("div");
        pickRow.className = "drawer-chip-row";
        var isAdmin = typeof isAdminAccount === "function" && isAdminAccount();
        availableTagChips(tr).forEach(function(c){
          pickRow.appendChild(makeChip("+ " + c.label, false, function(){
            tr.tagIds = (tr.tagIds || []).concat([c.id]);
            saveDB(); renderDrawer();
          }));
          if(isAdmin){
            var delTag = document.createElement("button");
            delTag.type = "button"; delTag.className = "drawer-chip drawer-chip-danger";
            delTag.title = t("deleteTagGlobal"); delTag.innerHTML = ICON_TRASH;
            delTag.addEventListener("click", function(){
              openConfirm(t("confirmDeleteTagTitle"), t("confirmDeleteTagBody"), function(){
                removeTag(c.id); renderColumns(); renderDrawer();
              });
            });
            pickRow.appendChild(delTag);
          }
        });
        picker.appendChild(pickRow);
        var newRow = document.createElement("div");
        newRow.className = "drawer-tag-new";
        var newInp = document.createElement("input");
        newInp.type = "text"; newInp.className = "drawer-inline-input"; newInp.placeholder = t("newTagPlaceholder");
        var newBtn = document.createElement("button");
        newBtn.type = "button"; newBtn.className = "col-add-btn";
        newBtn.innerHTML = ICON_PLUS + "<span>" + escapeHtml(t("addTag")) + "</span>";
        var submitTag = function(){
          if(addTagToTrick(tr, newInp.value, state.lang)) renderDrawer();
        };
        newBtn.addEventListener("click", submitTag);
        newInp.addEventListener("keydown", function(ev){ if(ev.key === "Enter"){ ev.preventDefault(); submitTag(); } });
        newRow.appendChild(newInp); newRow.appendChild(newBtn);
        picker.appendChild(newRow);
        expandContent.appendChild(picker);
      }
    }

    // Grip (single) + parts (multi). View mode: chips for what is set; edit mode: selectors.
    if(canEditTrick || tr.grip){
      expandContent.appendChild(makeLabel(t("gripLabel")));
      var gripRow = document.createElement("div");
      gripRow.className = "drawer-chip-row";
      GRIP_KEYS.forEach(function(k){
        if(!canEditTrick && tr.grip !== k) return;
        gripRow.appendChild(makeChip(t("grip_" + k), tr.grip === k,
          canEditTrick ? function(){ toggleGrip(tr, k); saveDB(); renderDrawer(); } : null));
      });
      expandContent.appendChild(gripRow);
    }
    if(canEditTrick || (tr.parts && tr.parts.length)){
      expandContent.appendChild(makeLabel(t("partsLabel")));
      var partsRow = document.createElement("div");
      partsRow.className = "drawer-chip-row";
      PART_KEYS.forEach(function(k){
        var on = (tr.parts || []).indexOf(k) !== -1;
        if(!canEditTrick && !on) return;
        partsRow.appendChild(makeChip(t("part_" + k), on,
          canEditTrick ? function(){ togglePart(tr, k); saveDB(); renderDrawer(); } : null));
      });
      expandContent.appendChild(partsRow);
    }

    // Videos (max MAX_VIDEOS)
    expandContent.appendChild(makeLabel(t("mediaTypeVideo")));
    var videoWrap = document.createElement("div");
    videoWrap.style.display = "flex"; videoWrap.style.flexDirection = "column"; videoWrap.style.gap = "4px"; videoWrap.style.marginBottom = "16px";
    var videos = (tr.media || []).filter(function(m){ return m.type === "video"; });
    videos.forEach(function(item){ videoWrap.appendChild(renderVideoRow(tr.id, item)); });
    if(canEditTrick && videos.length < MAX_VIDEOS){
      var addVideoBtn = document.createElement("button");
      addVideoBtn.className = "col-add-btn";
      addVideoBtn.innerHTML = ICON_PLUS + "<span>" + escapeHtml(t("addVideoShort")) + "</span>";
      addVideoBtn.addEventListener("click", function(){ openMediaModal(tr.id, null); });
      videoWrap.appendChild(addVideoBtn);
    }
    expandContent.appendChild(videoWrap);

    // Official note first (marked), then the personal note.
    var canEditOfficial = !!trickTableId(tr) && canEditTable(trickTableId(tr));
    if(tr.officialNote || (state.editMode && canEditOfficial)){
      expandContent.appendChild(makeLabel(t("officialNoteLabel")));
      var offWrap = document.createElement("div");
      offWrap.style.marginBottom = "16px";
      if(state.editMode && canEditOfficial){
        var offInput = document.createElement("textarea");
        offInput.className = "note-field-input";
        offInput.rows = 3;
        offInput.placeholder = t("mediaContentPlaceholder");
        offInput.value = tr.officialNote || "";
        offInput.addEventListener("input", function(){ tr.officialNote = offInput.value; saveDB(); });
        offWrap.appendChild(offInput);
      } else {
        var offDisplay = document.createElement("div");
        offDisplay.className = "note-field note-field-official";
        offDisplay.textContent = tr.officialNote;
        offWrap.appendChild(offDisplay);
      }
      expandContent.appendChild(offWrap);
    }

    // Personal note: free text, editable by everyone (it's the user's own data).
    expandContent.appendChild(makeLabel(t("personalNoteLabel")));
    var noteWrap = document.createElement("div");
    noteWrap.style.marginBottom = "20px";
    var noteInput = document.createElement("textarea");
    noteInput.className = "note-field-input";
    noteInput.rows = 4;
    noteInput.placeholder = t("mediaContentPlaceholder");
    noteInput.value = getTrickNote(tr);
    noteInput.addEventListener("input", function(){
      tr.note = noteInput.value;
      saveDB();
    });
    noteWrap.appendChild(noteInput);
    expandContent.appendChild(noteWrap);

    body.appendChild(expandContent);

    drawer.appendChild(dragZone);
    drawer.appendChild(body);

    // Personal progress, pinned to the bottom (sibling of the scrollable body):
    // landed toggle + 4-way landing-rate control. Always interactive, not gated
    // behind edit mode — it tracks personal practice, not the trick's definition.
    var profFoot = document.createElement("div");
    profFoot.className = "drawer-proficiency-foot drawer-expand-content";

    var landedWrap = document.createElement("div");
    landedWrap.className = "proficiency-group";
    landedWrap.style.marginBottom = "12px";
    [[false, "notLanded"], [true, "landed"]].forEach(function(def){
      var lBtn = document.createElement("button");
      lBtn.type = "button";
      lBtn.className = "proficiency-btn" + (!!tr.landed === def[0] ? " active" : "");
      lBtn.textContent = t(def[1]);
      lBtn.addEventListener("click", function(){
        if(!!tr.landed === def[0]) return;
        tr.landed = def[0];
        saveDB();
        renderDrawer();
      });
      landedWrap.appendChild(lBtn);
    });
    profFoot.appendChild(landedWrap);

    var rateHead = document.createElement("div");
    rateHead.className = "drawer-rate-head";
    var infoBtn = document.createElement("button");
    infoBtn.type = "button"; infoBtn.className = "drawer-info-btn" + (drawerUi.rateHint ? " active" : "");
    infoBtn.textContent = "i"; infoBtn.title = t("rateLabel");
    var hint = document.createElement("div");
    hint.className = "drawer-rate-hint"; hint.hidden = !drawerUi.rateHint;
    hint.innerHTML = RATE_LEVELS.map(function(l){
      return '<span style="color:' + RATE_COLORS[l] + '">' + escapeHtml(t("rate_" + l)) + '</span> ' + escapeHtml(t("rateHint_" + l));
    }).join("<br>");
    infoBtn.addEventListener("click", function(){
      drawerUi.rateHint = !drawerUi.rateHint;
      hint.hidden = !drawerUi.rateHint;
      infoBtn.classList.toggle("active", drawerUi.rateHint);
    });
    rateHead.appendChild(makeLabel(t("rateLabel"))); rateHead.appendChild(infoBtn);
    profFoot.appendChild(rateHead);
    profFoot.appendChild(hint);

    var profWrap = document.createElement("div");
    profWrap.className = "proficiency-group";
    RATE_LEVELS.forEach(function(level){
      var pBtn = document.createElement("button");
      pBtn.type = "button";
      pBtn.className = "proficiency-btn" + (tr.rate === level ? " active" : "");
      pBtn.textContent = t("rate_" + level);
      var pfHex = RATE_COLORS[level];
      pBtn.style.setProperty("--pf-bg", hexToRgba(pfHex, 0.16));
      pBtn.style.setProperty("--pf-bg-hover", hexToRgba(pfHex, 0.28));
      pBtn.style.setProperty("--pf-active-a", hexToRgba(pfHex, 0.95));
      pBtn.style.setProperty("--pf-active-b", hexToRgba(pfHex, 0.68));
      pBtn.style.setProperty("--pf-text", pfHex);
      pBtn.addEventListener("click", function(){
        toggleRate(tr, level);
        saveDB();
        // Update the icon glow everywhere it's currently visible right now,
        // instead of waiting for the next full render().
        refreshTrickIconGlow(tr.id);
        renderDrawer();
      });
      profWrap.appendChild(pBtn);
    });
    profFoot.appendChild(profWrap);
    drawer.appendChild(profFoot);

    if(canEditTrick){
      var foot = document.createElement("div");
      foot.className = "drawer-foot drawer-expand-content";
      var addVarB = document.createElement("button");
      addVarB.className = "col-add-btn";
      addVarB.style.flex = "1";
      addVarB.innerHTML = ICON_PLUS + "<span>" + escapeHtml(t("addVariant")) + "</span>";
      addVarB.addEventListener("click", function(){ openTrickModal(null, tr.id); });
      var editB = document.createElement("button");
      editB.className = "col-add-btn";
      editB.style.flex = "1";
      editB.innerHTML = ICON_EDIT + "<span>" + escapeHtml(t("editTrick")) + "</span>";
      editB.addEventListener("click", function(){ openTrickModal(tr.id, null); });
      var delB = document.createElement("button");
      delB.className = "col-add-btn col-add-btn-danger";
      delB.style.flex = "0 0 44px";
      delB.style.padding = "9px 0";
      delB.title = t("delete");
      delB.innerHTML = ICON_TRASH;
      delB.addEventListener("click", function(){ requestDeleteTrick(tr.id); });
      foot.appendChild(addVarB); foot.appendChild(editB); foot.appendChild(delB);
      drawer.appendChild(foot);
    }

    // Reflect the current peek/expanded state on the freshly-rebuilt drawer
    // (innerHTML was cleared above, so nothing here carries over on its own)
    // and, for peek, measure+apply its exact content height. No-op visually
    // outside the mobile media query.
    applyDrawerModeClass(drawer);
  }

  /* ============================================================
     MEDIA ROW (video items shown below the trick name)
  ============================================================ */
  function renderVideoRow(trickId, item){
    var row = document.createElement("div");
    row.className = "item"; row.style.margin = "0";
    var icon = document.createElement("div");
    icon.className = "item-icon trick";
    var pf = item.platform || detectPlatform(item.url);
    icon.innerHTML = PLATFORM_ICONS[pf] || PLATFORM_ICONS.other;
    var text = document.createElement("div");
    text.className = "item-text";
    text.innerHTML = '<div class="item-name">' + escapeHtml(item.title || t("mediaTypeVideo")) + '</div>';
    row.appendChild(icon); row.appendChild(text);

    var vTr = getTrick(trickId);
    if(state.editMode && vTr && canModifyItem({ type:"trick", ref:vTr }, null, typeof isAdminAccount === "function" && isAdminAccount())){
      var actions = document.createElement("div");
      actions.className = "item-edit-actions";
      var editBtn = document.createElement("button");
      editBtn.className = "mini-btn"; editBtn.innerHTML = ICON_EDIT;
      editBtn.addEventListener("click", function(ev){ ev.stopPropagation(); openMediaModal(trickId, item.id); });
      var delBtn = document.createElement("button");
      delBtn.className = "mini-btn danger"; delBtn.innerHTML = ICON_TRASH;
      delBtn.addEventListener("click", function(ev){ ev.stopPropagation(); requestDeleteMedia(trickId, item.id); });
      actions.appendChild(editBtn); actions.appendChild(delBtn);
      row.appendChild(actions);
    }

    row.addEventListener("click", function(){
      if(isSafeHttpUrl(item.url)){ window.open(item.url, "_blank", "noopener,noreferrer"); }
    });
    return row;
  }

