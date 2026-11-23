"use strict";

  /* ============================================================
     DRAWER SECTIONS — builders for the parts of the trick drawer
     (head icon, grip/parts, note, rate footer, edit footer; tags in js/33, video slots in js/34).
     renderDrawer() in js/32-trick-drawer.js assembles them.
  ============================================================ */
  // Tag-picker / rate-hint open state for the drawer (reset when another trick opens).
  var drawerUi = { tagPicker: false, rateHint: false, classPickerFor: null, videoEdit: null, tagsRef: null, gpRef: null }; // buildDrawerTags lives in js/33

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

  // Head icon (v0.9.3, edit mode only): a button = icon swatch + small 「編輯顏色與圖示」 text;
  // clicking either opens the shared picker (target "drawer").
  function buildDrawerHeadIcon(tr){
    var el = document.createElement("button");
    el.type = "button";
    el.className = "drawer-head-edit";
    var sw = document.createElement("span");
    sw.className = "drawer-head-icon icon-color-swatch editable";
    function paintSwatch(){
      var h = tr.color ? colorHex(tr.color) : TRICK_DEFAULT_HEX;
      sw.style.background = hexToRgba(h, 0.22); sw.style.color = h;
      sw.classList.toggle("img-icon", isImageIcon(tr.icon));
      sw.innerHTML = iconHtml(tr.icon, ICON_PLAY);
    }
    paintSwatch();
    var lb = document.createElement("span");
    lb.className = "drawer-head-edit-label";
    lb.textContent = t("editIconColor");
    el.appendChild(sw); el.appendChild(lb);
    el.addEventListener("click", function(){
      openIconPicker("drawer", { icon: tr.icon || "", color: tr.color || "", onDone: function(icon, color){
        tr.icon = icon; tr.color = color;
        saveDB(); renderColumns();
        paintSwatch(); // only the swatch: re-rendering the whole drawer would flicker
      } });
    });
    return el;
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

  // Edit mode: part diagram on top, the shared grip picker (js/36) below it, full width. Toggles update
  // the diagram / picker in place (no whole-drawer re-render, no flicker).
  function buildDrawerGripParts(tr, expandContent){
    var row = document.createElement("div");
    row.className = "drawer-parts-edit";
    var picker = buildGripPicker({ value: tr.grip, onChange: function(v){
      tr.grip = v; saveDB(); refreshDrawerTags();
    } });
    var diagram = createPartDiagram({ selected: tr.parts || [], interactive: true, onToggle: function(k){
      togglePart(tr, k); saveDB(); refreshDrawerGripParts(tr); refreshDrawerTags();
    } });
    row.appendChild(diagram); row.appendChild(picker);
    expandContent.appendChild(row);
    drawerUi.gpRef = { tr: tr, diagram: diagram, picker: picker };
  }
  // Re-sync the edit-mode diagram + grip picker from tr (after a toggle or a class-tag overwrite).
  function refreshDrawerGripParts(tr){
    var r = drawerUi.gpRef;
    if(!r || r.tr !== tr) return;
    r.diagram.update(tr.parts || []);
    r.picker.setValue(tr.grip);
  }

  // The single 備註 (tr.note). Edit mode: textarea (editable by everyone: it is the user's own
  // data). View mode: read-only text, only when not empty.
  function buildDrawerNote(tr, editMode, parent){
    var note = getTrickNote(tr);
    if(!editMode && !note.trim()) return;
    parent.appendChild(makeLabel(t("personalNoteLabel")));
    var noteWrap = document.createElement("div");
    noteWrap.style.marginBottom = "20px";
    if(editMode){
      var noteInput = document.createElement("textarea");
      noteInput.className = "note-field-input";
      noteInput.rows = 4;
      noteInput.placeholder = t("mediaContentPlaceholder");
      noteInput.value = note;
      noteInput.addEventListener("input", function(){ tr.note = noteInput.value; saveDB(); });
      noteWrap.appendChild(noteInput);
    } else {
      var noteView = document.createElement("div");
      noteView.className = "note-field";
      noteView.textContent = note;
      noteWrap.appendChild(noteView);
    }
    parent.appendChild(noteWrap);
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
      return '<span class="rate-swatch" style="background:' + RATE_COLORS[l] + '"></span><span>' + escapeHtml(t("rate_" + l)) + '</span> ' + escapeHtml(t("rateHint_" + l));
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
      // Colors come from CSS: .proficiency-btn[data-rate=…] uses --rate-* / --rate-*-ink.
      pBtn.setAttribute("data-rate", level || "none");
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

  // Bottom row: [share trick] [+ variant] [delete]. Share: any signed-in user (guests: hidden);
  // variant + delete: only when canEdit (edit mode and permitted). Returns null when empty.
  function buildDrawerEditFoot(tr, canEdit){
    var canShare = !isGuest() && typeof shareRun === "function";
    if(!canEdit && !canShare) return null;
    var foot = document.createElement("div");
    foot.className = "drawer-foot";
    if(canShare){
      var shB = document.createElement("button");
      shB.className = "col-add-btn col-add-btn-share";
      shB.innerHTML = ICON_LINK + "<span>" + escapeHtml(t("shareTrickBtn")) + "</span>";
      shB.addEventListener("click", function(){ shareRun("trick", tr.id); });
      foot.appendChild(shB);
    }
    if(canEdit){
      var addVarB = document.createElement("button");
      addVarB.className = "col-add-btn col-add-btn-variant";
      addVarB.innerHTML = ICON_PLUS + "<span>" + escapeHtml(t("addVariantShort")) + "</span>";
      addVarB.addEventListener("click", function(){ openAddModal(tr.id, state.activeSpace); });
      var delB = document.createElement("button");
      delB.className = "col-add-btn col-add-btn-danger col-add-btn-del";
      delB.innerHTML = ICON_TRASH + "<span>" + escapeHtml(t("delete")) + "</span>";
      delB.addEventListener("click", function(){ requestDeleteTrick(tr.id, "*"); });
      foot.appendChild(addVarB);
      foot.appendChild(delB);
    }
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

