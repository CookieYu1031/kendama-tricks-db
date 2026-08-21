"use strict";

  /* ============================================================
     DETAIL DRAWER
  ============================================================ */
  function openDrawerFor(trickId){
    state.detailTrickId = trickId;
    state.detailDrawerExpanded = false; // always reopen collapsed to the mobile peek state
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

  function renderDrawer(){
    var drawer = document.getElementById("detailDrawer");
    if(!state.detailTrickId){ return; }
    var tr = getTrick(state.detailTrickId);
    if(!tr){ closeDrawer(); return; }

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
    head.className = "drawer-head";
    var headLeft = document.createElement("div");
    var title = document.createElement("div");
    title.className = "drawer-title";
    var titleInfo = resolveTrickTitle(tr.name);
    title.textContent = titleInfo.text;
    headLeft.appendChild(title);
    var headActions = document.createElement("div");
    headActions.className = "drawer-head-actions";

    // Quick-toggle: file this trick into (or out of) the 目標 bucket
    // category — the same categoryIds array used everywhere else, so
    // editing the trick anywhere else stays in sync automatically (single
    // source of truth).
    var goalBtn = document.createElement("button");
    goalBtn.type = "button";
    goalBtn.className = "drawer-quick-btn" + (trickInSpaceBucket(tr.id, "space-goal") ? " active" : "");
    goalBtn.innerHTML = "🎯";
    goalBtn.title = t("toggleGoal");
    goalBtn.addEventListener("click", function(){
      toggleTrickInSpaceBucket(tr.id, "space-goal");
      renderSpaceRail();
      renderColumns();
      if(!closeDrawerIfLeftActiveBucket(tr.id, "space-goal")) renderDrawer();
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

    // Which language field the big title above actually displays verbatim
    // (mirrors resolveTrickTitle's own fallback order) — so the language
    // table below never repeats it. When the title is a *derived* romaji
    // reading (EN UI, kana-only jp name — see resolveTrickTitle), it isn't
    // literally the same text as the raw jp field, so that field is still
    // worth showing below; titleLangKey stays null and nothing gets skipped.
    var titleLangKey = titleInfo.transformed ? null : titleInfo.sourceLang;

    var nameTable = document.createElement("div");
    nameTable.className = "name-table";
    [["zh", tr.name.zh], ["jp", tr.name.jp], ["en", tr.name.en]].forEach(function(pair){
      if(pair[0] === titleLangKey) return; // already shown as the big title above
      if(!pair[1]) return;
      var row = document.createElement("div");
      row.className = "name-row";
      row.innerHTML = '<span class="lang-tag">' + pair[0].toUpperCase() + '</span><span class="name-val">' + escapeHtml(pair[1]) + '</span>';
      nameTable.appendChild(row);
    });
    body.appendChild(nameTable);

    // Everything below the name table is hidden on the mobile bottom-sheet's
    // "peek" state (see .peek-mode / .drawer-expand-content in
    // detail-drawer.css) — swiping up on the drag handle reveals it. Grouped
    // in one wrapper so the CSS only needs a single selector for the body's
    // share of the expand-only content; profFoot/foot below get the same
    // class directly since they're siblings of body, not inside it.
    var expandContent = document.createElement("div");
    expandContent.className = "drawer-expand-content";

    var videoLabel = document.createElement("div");
    videoLabel.className = "drawer-cats-label";
    videoLabel.textContent = t("mediaTypeVideo");
    expandContent.appendChild(videoLabel);

    var videoWrap = document.createElement("div");
    videoWrap.style.display = "flex"; videoWrap.style.flexDirection = "column"; videoWrap.style.gap = "4px"; videoWrap.style.marginBottom = "16px";
    var videos = (tr.media || []).filter(function(m){ return m.type === "video"; });
    videos.forEach(function(item){ videoWrap.appendChild(renderVideoRow(tr.id, item)); });
    if(state.editMode){
      var addVideoBtn = document.createElement("button");
      addVideoBtn.className = "col-add-btn";
      addVideoBtn.innerHTML = ICON_PLUS + "<span>" + escapeHtml(t("addVideoShort")) + "</span>";
      addVideoBtn.addEventListener("click", function(){ openMediaModal(tr.id, null); });
      videoWrap.appendChild(addVideoBtn);
    }
    expandContent.appendChild(videoWrap);

    // A single free-text note per trick — directly typable in edit mode, plain
    // text in view mode. No icon/title row, no field background.
    var noteLabel = document.createElement("div");
    noteLabel.className = "drawer-cats-label";
    noteLabel.textContent = t("mediaTypeNote");
    expandContent.appendChild(noteLabel);

    var noteWrap = document.createElement("div");
    noteWrap.style.marginBottom = "20px";
    var noteValue = getTrickNote(tr);
    if(state.editMode){
      var noteInput = document.createElement("textarea");
      noteInput.className = "note-field-input";
      noteInput.rows = 4;
      noteInput.placeholder = t("mediaContentPlaceholder");
      noteInput.value = noteValue;
      noteInput.addEventListener("input", function(){
        tr.note = noteInput.value;
        saveDB();
      });
      noteWrap.appendChild(noteInput);
    } else if(noteValue){
      var noteDisplay = document.createElement("div");
      noteDisplay.className = "note-field";
      noteDisplay.textContent = noteValue;
      noteWrap.appendChild(noteDisplay);
    }
    expandContent.appendChild(noteWrap);

    body.appendChild(expandContent);

    drawer.appendChild(dragZone);
    drawer.appendChild(body);

    // Practice-proficiency: a 6-way segmented control, pinned to the bottom of
    // the drawer (a sibling of the scrollable body, not inside it) so it stays
    // visible regardless of scroll position — always interactive, not gated
    // behind edit mode, since it tracks personal practice progress rather than
    // editing the trick's own definitional data.
    var profFoot = document.createElement("div");
    profFoot.className = "drawer-proficiency-foot drawer-expand-content";

    var profLabel = document.createElement("div");
    profLabel.className = "drawer-cats-label";
    profLabel.textContent = t("proficiencyLabel");
    profFoot.appendChild(profLabel);

    var profWrap = document.createElement("div");
    profWrap.className = "proficiency-group";
    var currentProficiency = getTrickProficiency(tr);
    PROFICIENCY_LEVELS.forEach(function(level){
      var pBtn = document.createElement("button");
      pBtn.type = "button";
      pBtn.className = "proficiency-btn" + (currentProficiency === level ? " active" : "");
      pBtn.textContent = t("proficiency_" + level);
      var pfHex = PROFICIENCY_COLORS[level];
      pBtn.style.setProperty("--pf-bg", hexToRgba(pfHex, 0.16));
      pBtn.style.setProperty("--pf-bg-hover", hexToRgba(pfHex, 0.28));
      pBtn.style.setProperty("--pf-active-a", hexToRgba(pfHex, 0.95));
      pBtn.style.setProperty("--pf-active-b", hexToRgba(pfHex, 0.68));
      pBtn.style.setProperty("--pf-text", pfHex);
      pBtn.addEventListener("click", function(){
        tr.proficiency = level;
        saveDB();
        // Update the icon glow everywhere it's currently visible (miller-column
        // row, and any parent trick's extension-list row in this drawer) right
        // now, instead of waiting for the next full render() to touch those
        // persistent DOM nodes — that's what caused the one-render lag.
        refreshTrickIconGlow(tr.id);
        // A trick marked with any real proficiency (anything but "無"/none) is
        // no longer just an aspirational goal, so drop it out of 目標
        // automatically — the goal shelf only ever holds tricks still at "無".
        var droppedFromGoal = false;
        if(level !== "none" && trickInSpaceBucket(tr.id, "space-goal")){
          toggleTrickInSpaceBucket(tr.id, "space-goal");
          droppedFromGoal = true;
        }
        if(droppedFromGoal){
          renderSpaceRail();
          renderColumns();
        }
        if(!droppedFromGoal || !closeDrawerIfLeftActiveBucket(tr.id, "space-goal")) renderDrawer();
      });
      profWrap.appendChild(pBtn);
    });
    profFoot.appendChild(profWrap);
    drawer.appendChild(profFoot);

    if(state.editMode){
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
  var PLATFORM_ICONS = {
    youtube: '<svg viewBox="0 0 24 24" fill="none"><rect x="2" y="5" width="20" height="14" rx="4" stroke="currentColor" stroke-width="1.7"/><path d="M10 9l6 3-6 3V9z" fill="currentColor"/></svg>',
    instagram: '<svg viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="18" rx="5" stroke="currentColor" stroke-width="1.7"/><circle cx="12" cy="12" r="4" stroke="currentColor" stroke-width="1.7"/><circle cx="17.2" cy="6.8" r="1" fill="currentColor"/></svg>',
    facebook: '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.7"/><text x="12" y="16.2" text-anchor="middle" font-size="11" font-weight="700" fill="currentColor" font-family="sans-serif">f</text></svg>',
    tiktok: '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.7"/><path d="M13 7v7.2a2.3 2.3 0 11-2-2.28" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M13 7c.3 1.6 1.5 2.8 3 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
    vimeo: '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.7"/><text x="12" y="16.2" text-anchor="middle" font-size="10" font-weight="700" fill="currentColor" font-family="sans-serif">V</text></svg>',
    twitter: '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.7"/><text x="12" y="16" text-anchor="middle" font-size="10" font-weight="700" fill="currentColor" font-family="sans-serif">X</text></svg>',
    other: '<svg viewBox="0 0 24 24" fill="none"><path d="M9 15l6-6M10 6l1-1a4 4 0 015.7 5.7l-1.4 1.4M14 18l-1 1A4 4 0 016 13.3l1.4-1.4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>'
  };
  function detectPlatform(url){
    if(!url) return "other";
    var host;
    try{ host = new URL(url).hostname.replace(/^www\./,"").replace(/^m\./,""); }catch(e){ return "other"; }
    if(host==="youtube.com" || host==="youtu.be") return "youtube";
    if(host==="instagram.com") return "instagram";
    if(host==="facebook.com" || host==="fb.watch") return "facebook";
    if(host==="tiktok.com") return "tiktok";
    if(host==="vimeo.com" || host==="player.vimeo.com") return "vimeo";
    if(host==="twitter.com" || host==="x.com") return "twitter";
    return "other";
  }
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

    if(state.editMode){
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
      if(item.url){ window.open(item.url, "_blank", "noopener,noreferrer"); }
    });
    return row;
  }

