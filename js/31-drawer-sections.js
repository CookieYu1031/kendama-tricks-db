"use strict";

  /* ============================================================
     DRAWER SECTIONS — builders for the parts of the trick drawer
     (icon, tags, grip/parts, videos, notes, rate footer, edit footer).
     renderDrawer() in js/32-trick-drawer.js assembles them.
  ============================================================ */
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

  // D8: guests can't record landed / rate / favorites; the foot asks them to sign in instead.
  function buildGuestFoot(){
    var foot = document.createElement("div");
    foot.className = "drawer-proficiency-foot drawer-guest-foot";
    var msg = document.createElement("div");
    msg.className = "drawer-guest-hint";
    msg.textContent = t("guestLoginHint");
    var btn = document.createElement("button");
    btn.type = "button"; btn.className = "col-add-btn";
    btn.textContent = t("authLogin");
    btn.addEventListener("click", function(){ if(typeof authLogin === "function") authLogin(); });
    foot.appendChild(msg); foot.appendChild(btn);
    return foot;
  }

  // Blur check for a name input: refuse emptying the last name (restore + toast).
  function commitNameInput(tr, lang, inp){
    if(setTrickName(tr, lang, inp.value)){ saveDB(); return; }
    inp.value = tr.name[lang] || "";
    showToast(t("nameRequiredToast"));
  }

  var ICON_STAR_OUTLINE = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"><path d="M12 3.2l2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 17l-5.4 2.9 1.1-6.1-4.5-4.2 6.1-.8z"/></svg>';
  var ICON_STAR_SOLID = '<svg viewBox="0 0 24 24" width="18" height="18" fill="var(--star)" stroke="var(--star)" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"><path d="M12 3.2l2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 17l-5.4 2.9 1.1-6.1-4.5-4.2 6.1-.8z"/></svg>';

  // Edit mode: icon + color (reuses the shared picker via the "drawer" target).
  function buildDrawerIconSection(tr, expandContent){
    expandContent.appendChild(makeLabel(t("iconColorLabel")));
    var icWrap = document.createElement("div");
    icWrap.style.marginBottom = "16px";
    var icBtn = document.createElement("button");
    icBtn.type = "button"; icBtn.className = "icon-color-preview";
    var icSw = document.createElement("span");
    icSw.className = "icon-color-swatch";
    var icHex = tr.color ? colorHex(tr.color) : TRICK_DEFAULT_HEX;
    icSw.style.background = hexToRgba(icHex, 0.22); icSw.style.color = icHex;
    icSw.classList.toggle("img-icon", isImageIcon(tr.icon));
    icSw.innerHTML = iconHtml(tr.icon, ICON_PLAY);
    var icTx = document.createElement("span");
    icTx.textContent = t("chooseIconColor");
    icBtn.appendChild(icSw); icBtn.appendChild(icTx);
    icBtn.addEventListener("click", function(){
      openIconPicker("drawer", { icon: tr.icon || "", color: tr.color || "", onDone: function(icon, color){
        tr.icon = icon; tr.color = color;
        saveDB(); renderColumns(); renderDrawer();
      } });
    });
    icWrap.appendChild(icBtn);
    expandContent.appendChild(icWrap);
  }

  // Tags: chips on the trick, plus (edit mode) the add-tag picker.
  function buildDrawerTags(tr, canEditTrick, expandContent){
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
  }

  // Fills `box` with one .part-group per PART_GROUPS entry; makeBtn(key) returns a chip or null.
  // Empty groups are skipped. Returns how many chips were added.
  function fillPartGroups(box, makeBtn){
    var n = 0;
    box.innerHTML = "";
    box.classList.add("part-groups");
    PART_GROUPS.forEach(function(g){
      var grp = document.createElement("div");
      grp.className = "part-group";
      grp.setAttribute("data-group", g.key);
      g.parts.forEach(function(k){
        var b = makeBtn(k);
        if(b){ grp.appendChild(b); n++; }
      });
      if(grp.children.length) box.appendChild(grp);
    });
    return n;
  }

  // Grip (single) + parts (multi). View mode: chips for what is set; edit mode: selectors.
  function buildDrawerGripParts(tr, canEditTrick, expandContent){
    if(canEditTrick || tr.grip){
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
      var partsRow = document.createElement("div");
      partsRow.className = "drawer-chip-row";
      fillPartGroups(partsRow, function(k){
        var on = (tr.parts || []).indexOf(k) !== -1;
        if(!canEditTrick && !on) return null;
        return makeChip(t("part_" + k), on,
          canEditTrick ? function(){ togglePart(tr, k); saveDB(); renderDrawer(); } : null);
      });
      expandContent.appendChild(partsRow);
    }
  }

  // Videos (max MAX_VIDEOS), then official note, then the personal note.
  function buildDrawerVideosNotes(tr, canEditTrick, expandContent){
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
  }

  // Personal progress, pinned to the bottom (sibling of the scrollable body):
  // 5-way landing-rate control (none + 4 levels; landed is derived). Always interactive, not gated
  // behind edit mode — it tracks personal practice, not the trick's definition. Guests get a login hint.
  function buildDrawerRateFoot(tr){
    var profFoot = document.createElement("div");
    profFoot.className = "drawer-proficiency-foot";

    var rateHead = document.createElement("div");
    rateHead.className = "drawer-rate-head";
    var infoBtn = document.createElement("button");
    infoBtn.type = "button"; infoBtn.className = "drawer-info-btn" + (drawerUi.rateHint ? " active" : "");
    infoBtn.textContent = "i"; infoBtn.title = t("rateLabel");
    var hint = document.createElement("div");
    hint.className = "drawer-rate-hint"; hint.hidden = !drawerUi.rateHint;
    hint.innerHTML = ['<span>' + escapeHtml(t("rate_none")) + '</span> ' + escapeHtml(t("rateHint_none"))].concat(RATE_LEVELS.map(function(l){
      return '<span style="color:' + RATE_COLORS[l] + '">' + escapeHtml(t("rate_" + l)) + '</span> ' + escapeHtml(t("rateHint_" + l));
    })).join("<br>");
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
    [null].concat(RATE_LEVELS).forEach(function(level){
      var pBtn = document.createElement("button");
      pBtn.type = "button";
      pBtn.className = "proficiency-btn" + ((tr.rate || null) === level ? " active" : "");
      pBtn.textContent = t("rate_" + (level || "none"));
      if(level){
        var pfHex = RATE_COLORS[level];
        pBtn.style.setProperty("--pf-bg", hexToRgba(pfHex, 0.16));
        pBtn.style.setProperty("--pf-bg-hover", hexToRgba(pfHex, 0.28));
        pBtn.style.setProperty("--pf-active-a", hexToRgba(pfHex, 0.95));
        pBtn.style.setProperty("--pf-active-b", hexToRgba(pfHex, 0.68));
        pBtn.style.setProperty("--pf-text", pfHex);
      }
      pBtn.addEventListener("click", function(){
        if((tr.rate || null) === level) return; // active option: no-op (none clears)
        setRate(tr, level);
        saveDB();
        // Update the icon glow everywhere it's currently visible right now,
        // instead of waiting for the next full render().
        refreshTrickIconGlow(tr.id);
        renderDrawer();
      });
      profWrap.appendChild(pBtn);
    });
    profFoot.appendChild(profWrap);
    return isGuest() ? buildGuestFoot() : profFoot;
  }

  // Edit mode footer: add variant + delete trick.
  function buildDrawerEditFoot(tr){
    var foot = document.createElement("div");
    foot.className = "drawer-foot";
    var addVarB = document.createElement("button");
    addVarB.className = "col-add-btn";
    addVarB.style.flex = "1";
    addVarB.innerHTML = ICON_PLUS + "<span>" + escapeHtml(t("addVariant")) + "</span>";
    addVarB.addEventListener("click", function(){ openAddModal(tr.id, state.activeSpace); });
    var delB = document.createElement("button");
    delB.className = "col-add-btn col-add-btn-danger";
    delB.style.flex = "0 0 44px";
    delB.style.padding = "9px 0";
    delB.title = t("delete");
    delB.innerHTML = ICON_TRASH;
    delB.addEventListener("click", function(){ requestDeleteTrick(tr.id, "*"); });
    foot.appendChild(addVarB); foot.appendChild(delB);
    return foot;
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

