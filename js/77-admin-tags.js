"use strict";

  /* ============================================================
     ADMIN TAG MANAGER (v0.9.2, admin only) — sub-modal opened from the admin panel.
     Three tabs: 握持手勢＋部位 (read-only list of the fixed grip/part fields),
     招式類別 (db.tags kind "class" + combo), 文字標籤 (kind "text").
     Edits go through createTag/updateTag/removeTag (saveDB -> pending -> 發布更新).
     Pure logic: js/30-drawer-logic.js (tests/tags.test.js).
  ============================================================ */
  addStrings({
    zh:{ tagMgrTitle:"標籤管理", tagTabGrip:"握持手勢＋部位", tagTabClass:"招式類別", tagTabText:"文字標籤",
         tagMgrGripHint:"握持手勢與部位的數量和圖上位置是固定的，只能修改三語名稱（發布後所有人看到新名稱）。點圖上部位可標示對應按鈕，點按鈕可編輯名稱。",
         labelMgrFull:"完整名稱", labelMgrShort:"簡稱（選擇鈕上顯示）", labelMgrReset:"還原預設", labelMgrSaved:"名稱已更新",
         labelMgrBlankHint:"留空＝使用預設名稱（灰字）。", tagMgrNew:"新增", tagMgrEmpty:"（尚無項目）",
         tagMgrUsed:"{n} 個招式使用", tagMgrNameRequired:"請至少輸入一個名稱", tagMgrComboLabel:"握持手勢與部位組合",
         tagMgrGripLabel:"握持手勢（單選）", tagMgrPartsLabel:"部位（複選）", tagMgrNoCombo:"（無組合）", tagMgrEdit:"編輯" },
    jp:{ tagMgrTitle:"タグ管理", tagTabGrip:"持ち方＋部位", tagTabClass:"技のカテゴリ", tagTabText:"テキストタグ",
         tagMgrGripHint:"持ち方と部位の数・図上の位置は固定で、3言語の名前のみ編集できます（公開後、全員に反映）。図の部位をタップすると対応ボタンを強調表示、ボタンをタップすると名前を編集できます。",
         labelMgrFull:"正式名称", labelMgrShort:"略称（選択ボタンに表示）", labelMgrReset:"初期値に戻す", labelMgrSaved:"名前を更新しました",
         labelMgrBlankHint:"空欄＝初期名称を使用（グレーの文字）。", tagMgrNew:"追加", tagMgrEmpty:"（項目なし）",
         tagMgrUsed:"{n} 件の技で使用", tagMgrNameRequired:"名前を1つ以上入力してください", tagMgrComboLabel:"持ち方と部位の組み合わせ",
         tagMgrGripLabel:"持ち方（単一選択）", tagMgrPartsLabel:"部位（複数選択）", tagMgrNoCombo:"（組み合わせなし）", tagMgrEdit:"編集" },
    en:{ tagMgrTitle:"Tag manager", tagTabGrip:"Grip + parts", tagTabClass:"Trick classes", tagTabText:"Text tags",
         tagMgrGripHint:"The number of grips and parts and their diagram positions are fixed; only the three-language names can be edited (everyone sees them once published). Tap a part on the diagram to highlight its button; tap a button to edit its name.",
         labelMgrFull:"Full name", labelMgrShort:"Short name (shown on picker buttons)", labelMgrReset:"Reset to default", labelMgrSaved:"Names updated",
         labelMgrBlankHint:"Blank = use the default name (grey text).", tagMgrNew:"Add", tagMgrEmpty:"(Nothing yet)",
         tagMgrUsed:"Used by {n} tricks", tagMgrNameRequired:"Enter at least one name", tagMgrComboLabel:"Grip and parts combo",
         tagMgrGripLabel:"Grip (single)", tagMgrPartsLabel:"Parts (multiple)", tagMgrNoCombo:"(No combo)", tagMgrEdit:"Edit" }
  });

  // tab: "grip" | "class" | "text"; editing: null | "new" | tag id; form: draft for the open form.
  // Tag icon (own copy; js/06 is owned elsewhere). Used in the admin panel button label.
  var ICON_TAG_MGR = '<svg class="tagmgr-btn-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M3.5 12.2V4.5a1 1 0 0 1 1-1h7.7a1 1 0 0 1 .7.3l7.6 7.6a1 1 0 0 1 0 1.4l-7.7 7.7a1 1 0 0 1-1.4 0L3.8 12.9a1 1 0 0 1-.3-.7z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><circle cx="8.2" cy="8.2" r="1.5" fill="currentColor"/></svg>';
  function tagMgrButtonHtml(){ return ICON_TAG_MGR + '<span>' + escapeHtml(t("tagMgrTitle")) + '</span>'; }

  var tagMgr = { tab: "class", editing: null, form: null, box: null, labelEdit: null };

  function openAdminTags(){
    if(typeof isAdminAccount === "function" && !isAdminAccount()) return;
    var ov = adminSubModal("adminTagsOverlay", "tagMgrTitle", "admin-sub-modal tagmgr-modal");
    ov.classList.add("show");
    tagMgr.editing = null; tagMgr.form = null; tagMgr.labelEdit = null;
    renderAdminTags(ov.querySelector(".modal-scroll"));
  }

  function tagMgrRefresh(){
    saveDB();
    if(typeof renderColumns === "function") renderColumns();
    if(typeof refreshAdminPending === "function") refreshAdminPending();
    renderAdminTags(tagMgr.box);
  }

  function tagMgrButton(cls, text, onClick){
    var b = document.createElement("button");
    b.type = "button"; b.className = cls;
    if(cls.indexOf("col-add-btn-del") !== -1){ b.innerHTML = removeBtnHtml(); b.title = text; }
    else b.textContent = text;
    b.addEventListener("click", onClick);
    return b;
  }

  function renderAdminTags(box){
    if(!box) return;
    tagMgr.box = box;
    box.innerHTML = "";
    var wrap = document.createElement("div");
    wrap.className = "tagmgr-body";
    var tabs = document.createElement("div");
    tabs.className = "tagmgr-tabs";
    [["grip", "tagTabGrip"], ["class", "tagTabClass"], ["text", "tagTabText"]].forEach(function(x){
      tabs.appendChild(tagMgrButton("drawer-chip" + (tagMgr.tab === x[0] ? " active" : ""), t(x[1]), function(){
        tagMgr.tab = x[0]; tagMgr.editing = null; tagMgr.form = null; tagMgr.labelEdit = null; renderAdminTags(box);
      }));
    });
    wrap.appendChild(tabs);
    if(tagMgr.tab === "grip") renderTagMgrGrip(wrap);
    else renderTagMgrList(wrap, tagMgr.tab);
    box.appendChild(wrap);
  }

  /* ---- Drag to reorder chips (mouse: press + move >6px; touch: long-press 350ms). Esc / cancel / drop outside cancels. ---- */
  var TAG_DRAG_PX = 6, TAG_LONG_PRESS_MS = 350, TAG_LONG_PRESS_CANCEL = 8;
  function attachTagDrag(chip, list, kind, id){
    var timer = null, sx = 0, sy = 0, pending = false;
    function clearPending(){ clearTimeout(timer); timer = null; pending = false; }
    chip.addEventListener("contextmenu", function(ev){ if(ev.pointerType === "touch" || pending) ev.preventDefault(); });
    chip.addEventListener("pointerdown", function(ev){
      if(ev.pointerType === "mouse" && ev.button !== 0) return;
      if(typeof isAdminAccount === "function" && !isAdminAccount()) return;
      sx = ev.clientX; sy = ev.clientY; pending = true;
      clearTimeout(timer);
      if(ev.pointerType !== "mouse") timer = setTimeout(function(){ if(pending){ pending = false; beginTagDrag(ev, chip, list, kind, id); } }, TAG_LONG_PRESS_MS);
    });
    chip.addEventListener("pointermove", function(ev){
      if(!pending) return;
      var d = Math.max(Math.abs(ev.clientX - sx), Math.abs(ev.clientY - sy));
      if(ev.pointerType === "mouse"){ if(d > TAG_DRAG_PX){ pending = false; beginTagDrag(ev, chip, list, kind, id); } }
      else if(d > TAG_LONG_PRESS_CANCEL) clearPending();
    });
    chip.addEventListener("pointerup", clearPending);
    chip.addEventListener("pointercancel", clearPending);
  }
  // Insertion slot among `rects` (other chips, reading order) for pointer (x, y) in a wrapping row:
  // first chip that is on a later line than the pointer, or on the same line and right of the pointer's x.
  function tagDropSlot(rects, x, y){
    for(var i = 0; i < rects.length; i++){
      var b = rects[i];
      if(y < b.top) return i;
      if(y <= b.bottom && x < b.left + b.width / 2) return i;
    }
    return rects.length;
  }
  function beginTagDrag(ev, chip, list, kind, id){
    try{ chip.setPointerCapture(ev.pointerId); }catch(e){}
    chip.classList.add("dragging");
    chip.dataset.suppressClick = "1";
    var chips = Array.prototype.slice.call(list.querySelectorAll(".tagmgr-chip"));
    var fromIdx = chips.indexOf(chip), toIdx = fromIdx, inside = true;
    function clearMarks(){ chips.forEach(function(r){ r.classList.remove("drop-before", "drop-after"); }); }
    function stopTouch(e){ e.preventDefault(); }
    document.addEventListener("touchmove", stopTouch, { passive: false });
    function onMove(mv){
      mv.preventDefault();
      clearMarks();
      var rc = (tagMgr.box || list).getBoundingClientRect();
      inside = mv.clientX >= rc.left && mv.clientX <= rc.right && mv.clientY >= rc.top && mv.clientY <= rc.bottom;
      if(!inside) return;
      var others = chips.filter(function(r){ return r !== chip; });
      var rects = others.map(function(r){ return r.getBoundingClientRect(); });
      var slot = tagDropSlot(rects, mv.clientX, mv.clientY);
      toIdx = slot;
      if(!others.length) return;
      // At a line break show the bar after the previous chip (end of the pointer's line) instead of before the next line's first chip.
      if(slot > 0 && slot < others.length && rects[slot].top > rects[slot - 1].bottom - 4 && mv.clientY <= rects[slot - 1].bottom && mv.clientY >= rects[slot - 1].top){
        others[slot - 1].classList.add("drop-after");
      }else if(slot < others.length) others[slot].classList.add("drop-before");
      else others[others.length - 1].classList.add("drop-after");
    }
    function finish(commit){
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      document.removeEventListener("pointercancel", onCancel);
      document.removeEventListener("keydown", onKey, true);
      document.removeEventListener("touchmove", stopTouch);
      chip.classList.remove("dragging");
      clearMarks();
      setTimeout(function(){ chip.dataset.suppressClick = ""; }, 30);
      if(commit && inside && toIdx !== fromIdx){
        db.tags = moveTag(db.tags, kind, id, toIdx);
        tagMgrRefresh();
      }
    }
    function onUp(){ finish(true); }
    function onCancel(){ finish(false); }
    function onKey(k){ if(k.key === "Escape"){ k.stopPropagation(); k.preventDefault(); finish(false); } }
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
    document.addEventListener("pointercancel", onCancel);
    document.addEventListener("keydown", onKey, true);
  }

  function tagMgrOpenEdit(g){
    if(tagMgr.editing === g.id){ tagMgr.editing = null; tagMgr.form = null; }
    else{
      tagMgr.editing = g.id;
      tagMgr.form = { zh: g.name.zh || "", jp: g.name.jp || "", en: g.name.en || "",
                      grip: g.combo ? g.combo.grip : null, parts: g.combo ? g.combo.parts.slice() : [] };
    }
    renderAdminTags(tagMgr.box);
    var ed = tagMgr.box && tagMgr.box.querySelector(".tagmgr-form");
    if(ed && ed.scrollIntoView) ed.scrollIntoView({ block: "nearest" });
  }

  // Tabs 2 / 3: tags of one kind as chips (click = edit below, drag = reorder, last chip = add).
  function renderTagMgrList(wrap, kind){
    var tags = (db.tags || []).filter(function(g){ return tagKind(g) === kind; });
    var list = document.createElement("div");
    list.className = "drawer-chip-row tagmgr-list";
    tags.forEach(function(g){
      var chip = makeChip(resolveDisplayName(g.name).text || g.id, tagMgr.editing === g.id, function(){ tagMgrOpenEdit(g); });
      chip.classList.add("tagmgr-chip", kind === "class" ? "tag-class" : "tag-text");
      chip.dataset.tagId = g.id;
      chip.addEventListener("click", function(ev){
        if(chip.dataset.suppressClick === "1"){ ev.stopPropagation(); ev.preventDefault(); }
      }, true);
      attachTagDrag(chip, list, kind, g.id);
      list.appendChild(chip);
    });
    var add = makeChip("+ " + t("tagMgrNew"), tagMgr.editing === "new", function(){
      if(tagMgr.editing === "new"){ tagMgr.editing = null; tagMgr.form = null; }
      else{
        tagMgr.editing = "new";
        tagMgr.form = { zh: "", jp: "", en: "", grip: null, parts: [] };
      }
      renderAdminTags(tagMgr.box);
      var ed = tagMgr.box && tagMgr.box.querySelector(".tagmgr-form");
      if(ed && ed.scrollIntoView) ed.scrollIntoView({ block: "nearest" });
    });
    add.classList.add("tagmgr-add-chip");
    list.appendChild(add);
    wrap.appendChild(list);
    if(!tags.length && !tagMgr.editing){
      var none = document.createElement("div");
      none.className = "field-hint"; none.textContent = t("tagMgrEmpty");
      wrap.appendChild(none);
    }
    if(tagMgr.editing) wrap.appendChild(buildTagMgrForm(kind));
  }

  function buildTagMgrForm(kind){
    var f = tagMgr.form;
    var form = document.createElement("div");
    form.className = "tagmgr-form";
    var cur = tagMgr.editing !== "new" ? getTag(tagMgr.editing) : null;
    if(cur){
      var used = t("tagMgrUsed").replace("{n}", tagUsageCount(cur.id));
      var info = document.createElement("div"); info.className = "field-hint tagmgr-info";
      info.textContent = kind === "class" ? ((comboLabel(cur.combo) || t("tagMgrNoCombo")) + " · " + used) : used;
      form.appendChild(info);
    }
    [["zh", "中文"], ["jp", "日本語"], ["en", "English"]].forEach(function(l){
      var fd = document.createElement("div");
      fd.className = "field";
      var lb = document.createElement("label"); lb.textContent = l[1];
      var inp = document.createElement("input");
      inp.type = "text"; inp.value = f[l[0]]; inp.maxLength = 60; inp.autocomplete = "off";
      inp.addEventListener("input", function(){ f[l[0]] = inp.value; });
      fd.appendChild(lb); fd.appendChild(inp);
      form.appendChild(fd);
    });
    if(kind === "class"){
      var cl = document.createElement("div"); cl.className = "tagmgr-section-title"; cl.textContent = t("tagMgrComboLabel");
      form.appendChild(cl);
      var gt = document.createElement("div"); gt.className = "tagmgr-section-title"; gt.textContent = t("tagMgrGripLabel");
      form.appendChild(gt);
      form.appendChild(buildGripPicker({ value: f.grip, onChange: function(v){ f.grip = v; } }));
      var pt = document.createElement("div"); pt.className = "tagmgr-section-title"; pt.textContent = t("tagMgrPartsLabel");
      form.appendChild(pt);
      var dia = createPartDiagram({ selected: f.parts, interactive: true, onToggle: function(k){
        var i = f.parts.indexOf(k);
        if(i === -1) f.parts.push(k); else f.parts.splice(i, 1);
        dia.update(f.parts);
      } });
      dia.classList.add("tagmgr-diagram");
      form.appendChild(dia);
    }
    var acts = document.createElement("div");
    acts.className = "tagmgr-form-actions";
    if(cur) acts.appendChild(tagMgrButton("col-add-btn col-add-btn-danger col-add-btn-del tagmgr-del", t("delete"), function(){
      openConfirm(t("confirmDeleteTagTitle"), t("confirmDeleteTagBody") + " (" + t("tagMgrUsed").replace("{n}", tagUsageCount(cur.id)) + ")", function(){
        removeTag(cur.id);
        tagMgr.editing = null; tagMgr.form = null;
        tagMgrRefresh();
      });
    }));
    acts.appendChild(tagMgrButton("btn btn-ghost btn-sm", t("cancel"), function(){
      tagMgr.editing = null; tagMgr.form = null; renderAdminTags(tagMgr.box);
    }));
    acts.appendChild(tagMgrButton("btn btn-primary btn-sm", t("save"), function(){ saveTagMgrForm(kind); }));
    form.appendChild(acts);
    return form;
  }

  function saveTagMgrForm(kind){
    var f = tagMgr.form;
    var name = { zh: f.zh, jp: f.jp, en: f.en };
    var combo = { grip: f.grip, parts: f.parts };
    var ok;
    if(tagMgr.editing === "new") ok = createTag(kind, name, combo);
    else ok = updateTag(tagMgr.editing, kind === "class" ? { name: name, combo: combo } : { name: name });
    if(!ok) return showToast(t("tagMgrNameRequired"), "error");
    tagMgr.editing = null; tagMgr.form = null;
    tagMgrRefresh();
  }

  (function(){
    var b = document.getElementById("adminTagsBtn");
    if(b) b.addEventListener("click", openAdminTags);
  })();
