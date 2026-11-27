"use strict";

  /* ============================================================
     UNIFIED ADD MODAL (folder / trick / info) — opened by the floating "+"
     of a column in edit mode. Pure logic first (unit-tested in
     tests/add-modal.test.js), UI below.
  ============================================================ */
  addStrings({
    zh:{ addTypeTrick:"招式", addTypeFolder:"清單", addTypeInfo:"資訊", addTitleBtn:"新增",
         addNameLabel:"名稱", addLinkNote:"將連結既有招式：",
         addVideoLabel:"影片連結（選填）", addTagsLabel:"標籤", addNoTags:"（尚無標籤）",
         addErrName:"請至少輸入一種語言的名稱", addErrVideo:"影片連結必須以 http:// 或 https:// 開頭",
         addErrLinkMissing:"找不到這個招式 ID", addErrLinkDup:"此招式已在這個位置", addErrLinkCycle:"不能把招式放進它自己或它的延伸招式底下",
         addErrLinkLevel:"超過層級上限，無法放到這裡", addErrLinkPerm:"此分區不能使用 ID 連結", addErrNotAllowed:"這裡不能新增此類型",
         addLinkedToast:"已連結招式",
         addNamePh:"(亦可輸入@ID連結已有招式)", prefixLabel:"前綴" },
    jp:{ addTypeTrick:"技", addTypeFolder:"リスト", addTypeInfo:"情報", addTitleBtn:"追加",
         addNameLabel:"名前", addLinkNote:"既存の技をリンクします：",
         addVideoLabel:"動画リンク（任意）", addTagsLabel:"タグ", addNoTags:"（タグなし）",
         addErrName:"少なくとも1つの言語で名前を入力してください", addErrVideo:"動画リンクは http:// または https:// で始めてください",
         addErrLinkMissing:"この技IDは見つかりません", addErrLinkDup:"この技はすでにここにあります", addErrLinkCycle:"技を自分自身や派生技の下には置けません",
         addErrLinkLevel:"階層の上限を超えるため、ここには置けません", addErrLinkPerm:"この区画ではIDリンクを使えません", addErrNotAllowed:"ここではこの種類を追加できません",
         addLinkedToast:"技をリンクしました",
         addNamePh:"(@IDで既存の技をリンクも可)", prefixLabel:"接頭辞" },
    en:{ addTypeTrick:"Trick", addTypeFolder:"List", addTypeInfo:"Info", addTitleBtn:"Add",
         addNameLabel:"Name", addLinkNote:"Will link existing trick: ",
         addVideoLabel:"Video link (optional)", addTagsLabel:"Tags", addNoTags:"(No tags yet)",
         addErrName:"Enter a name in at least one language", addErrVideo:"Video link must start with http:// or https://",
         addErrLinkMissing:"No trick with this ID", addErrLinkDup:"This trick is already here", addErrLinkCycle:"A trick can't go under itself or its own variants",
         addErrLinkLevel:"Level limit exceeded; it can't go here", addErrLinkPerm:"ID linking isn't available in this table", addErrNotAllowed:"This type can't be added here",
         addLinkedToast:"Trick linked",
         addNamePh:"(or @ID to link a trick)", prefixLabel:"Prefix" }
  });

  /* ---------------- Pure logic ---------------- */
  // Which types the "+" of a column may create; def = default type (trick first).
  function addModalTypes(parentId, spaceId, isAdmin){
    var al = canCreateIn(parentId, spaceId) ? allowedAddButtons(parentId, spaceId, isAdmin)
      : { folder:false, trick:false, info:false, customTrick:false };
    var order = ["trick", "folder", "info"];
    var def = null;
    order.forEach(function(k){ if(def === null && al[k]) def = k; });
    return { folder: !!al.folder, trick: !!al.trick, info: !!al.info, customTrick: !!al.customTrick, def: def };
  }

  // Container id a trick placement uses for a column (table root -> the space id).
  function addEffectiveParent(parentId, spaceId){
    return (parentId == null || getSpace(parentId)) ? spaceId : parentId;
  }

  // Link-by-id is off for 收藏 and for non-admins in locked tables.
  function addLinkAllowed(spaceId, isAdmin){
    var sp = getSpace(spaceId);
    if(!sp || spaceId === FAV_TABLE_ID) return false;
    return !sp.locked || !!isAdmin;
  }

  // Returns "" when trick `id` may be linked under the column, else an i18n key.
  function validateLinkTrick(id, parentId, spaceId, isAdmin){
    if(!addLinkAllowed(spaceId, isAdmin)) return "addErrLinkPerm";
    var tr = getTrick((id || "").trim());
    if(!tr) return "addErrLinkMissing";
    var eff = addEffectiveParent(parentId, spaceId);
    if(tr.categoryIds.indexOf(eff) !== -1) return "addErrLinkDup";
    if(eff === tr.id || getDescendantContainerIds(tr.id).indexOf(eff) !== -1) return "addErrLinkCycle";
    var cp = getSpace(eff) ? null : eff;
    if(!canAddChild(cp, "trick") || !subtreeFits(tr.id, "trick", levelOf(cp) + 1)) return "addErrLinkLevel";
    return "";
  }
  // prefix (optional): label of the new placement.
  function linkTrickInto(id, parentId, spaceId, prefix){
    var tr = getTrick(id), key = addEffectiveParent(parentId, spaceId);
    tr.categoryIds.push(key);
    if(prefix) setTrickPrefix(tr, key, prefix);
    return tr;
  }

  // "@0qbk3xY" (7-char id, surrounding spaces allowed) -> "0qbk3xY", else null.
  function parseAtId(str){
    var m = /^\s*@\s*([0-9A-Za-z]{7})\s*$/.exec(typeof str === "string" ? str : "");
    return m ? m[1] : null;
  }
  // fields: array or object of name strings; first one that is an @id wins.
  function findLinkTarget(fields){
    var list = Array.isArray(fields) ? fields : Object.keys(fields || {}).map(function(k){ return fields[k]; });
    for(var i = 0; i < list.length; i++){
      var id = parseAtId(list[i]);
      if(id) return id;
    }
    return null;
  }

  // Trick name box: classify what the user typed.
  // -> { kind:"empty" } | { kind:"link", id, explicit } | { kind:"name", lang:"zh"|"jp"|"en" }
  // A bare 7-char id links only when that trick exists; "@id" always tries to link.
  function detectAddName(raw){
    var str = (typeof raw === "string" ? raw : "").trim();
    if(!str) return { kind: "empty" };
    var at = parseAtId(str);
    if(at) return { kind: "link", id: at, explicit: true };
    if(/^[0-9A-Za-z]{7}$/.test(str) && getTrick(str)) return { kind: "link", id: str, explicit: false };
    if(/[\u3040-\u309F\u30A0-\u30FF\u31F0-\u31FF\uFF66-\uFF9F]/.test(str)) return { kind: "name", lang: "jp" };
    if(/[\u2E80-\u9FFF\uF900-\uFAFF\uFF00-\uFF65]/.test(str)) return { kind: "name", lang: "zh" };
    if(/[^\x00-\u024F\u2000-\u206F]/.test(str)) return { kind: "name", lang: "zh" };
    return { kind: "name", lang: "en" };
  }

  // Trick name boxes -> trick id to link, or null. "@id" in any box links;
  // a bare 7-char id links only when typed alone in the main box and that trick exists.
  function addTrickLinkTarget(main, alt1, alt2){
    var at = findLinkTarget([main, alt1, alt2]);
    if(at) return at;
    var d = detectAddName(main);
    return (d.kind === "link" && !(alt1 || "").trim() && !(alt2 || "").trim()) ? d.id : null;
  }

  // Arrow keys between text fields: Down / Right = next, Up / Left = previous.
  // Returns the target index, or -1 to leave the key alone.
  // f: { key, multiline, value, selStart, selEnd, idx, count, composing }
  // Right / Left only hand focus over when the caret sits at the very end / start (no selection);
  // textareas hand Up / Down over only from the first / last line.
  function addArrowTarget(f){
    var k = f.key;
    if(f.composing || ["ArrowDown", "ArrowUp", "ArrowRight", "ArrowLeft"].indexOf(k) === -1) return -1;
    var down = k === "ArrowDown" || k === "ArrowRight";
    var v = String(f.value || "");
    if(k === "ArrowRight" || k === "ArrowLeft"){
      if(f.selStart !== f.selEnd) return -1;
      if(down ? f.selEnd < v.length : f.selStart > 0) return -1;
    } else if(f.multiline){
      if(f.selStart !== f.selEnd) return -1;
      if(down && v.indexOf("\n", f.selEnd) !== -1) return -1;
      if(!down && v.slice(0, f.selStart).indexOf("\n") !== -1) return -1;
    }
    var n = f.idx + (down ? 1 : -1);
    return (n < 0 || n >= f.count) ? -1 : n;
  }

  function addNameObj(f){ return { zh: (f.zh || "").trim(), jp: (f.jp || "").trim(), en: (f.en || "").trim() }; }
  function addNameEmpty(n){ return !n.zh && !n.jp && !n.en; }

  function createFolderRecord(parentId, spaceId, f){
    var pid = getSpace(parentId) ? null : (parentId == null ? null : parentId);
    var rec = { id: newItemId(), parentId: pid, name: addNameObj(f), order: getChildren(pid).length,
      icon: f.icon || "", color: f.color || "default", spaceId: spaceId };
    setCategoryPrefix(rec, f.prefix);
    db.categories.push(rec);
    return rec;
  }
  // f: { zh, jp, en, content, icon, color, prefix }
  function createInfoRecord(parentId, spaceId, f){
    var pid = getSpace(parentId) ? null : (parentId == null ? null : parentId);
    if(!db.infos) db.infos = [];
    var rec = { id: newItemId(), parentId: pid, spaceId: spaceId, title: addNameObj(f), content: f.content || "",
      order: getInfosIn(pid).length, icon: f.icon || "", color: f.color || "default" };
    setCategoryPrefix(rec, f.prefix);
    db.infos.push(rec);
    return rec;
  }
  // f: { zh, jp, en, icon, color, url, grip, parts, tagIds, note, prefix }
  function createTrickRecord(parentId, spaceId, f, custom){
    var media = [];
    if(f.url) media.push({ id: newItemId(), type: "video", title: "", url: f.url, platform: detectPlatform(f.url) });
    var rec = normalizeDB({ categories: [], tricks: [{ id: newItemId(), name: addNameObj(f), media: media.slice(0, MAX_VIDEOS),
      categoryIds: [addEffectiveParent(parentId, spaceId)], orderByCategory: {}, order: db.tricks.length,
      icon: f.icon || "", color: f.color || "default", custom: !!custom, grip: f.grip || null, parts: f.parts || [],
      tagIds: f.tagIds || [], note: f.note || "", nameUnsure: f.nameUnsure }] }).tricks[0];
    setTrickPrefix(rec, addEffectiveParent(parentId, spaceId), f.prefix);
    db.tricks.push(rec);
    return rec;
  }

  /* ---------------- UI ---------------- */
  var addInputsBound = false;
  var addForm = null; // { type, parentId, spaceId, types, grip, parts, tagIds }

  function addEl(id){ return document.getElementById(id); }
  function addShowError(key){
    var e = addEl("addFormError");
    e.textContent = key ? t(key) : "";
    e.classList.toggle("show", !!key);
  }

  function updateAddIconPreview(){
    var sw = addEl("addIconSwatch");
    if(!sw || !addForm) return;
    var isTrick = addForm.type === "trick";
    var hex = (isTrick && !state.addDraftColor) ? TRICK_DEFAULT_HEX : colorHex(state.addDraftColor || "default");
    sw.style.background = hexToRgba(hex, 0.22);
    sw.style.color = hex;
    sw.classList.toggle("img-icon", isImageIcon(state.addDraftIcon));
    sw.innerHTML = iconHtml(state.addDraftIcon, isTrick ? ICON_TRICK : addForm.type === "info" ? ICON_INFO_ROW : ICON_LIST);
  }

  // Link target id (trick type only), else null.
  function addLinkTarget(){
    if(!addForm || addForm.type !== "trick") return null;
    return addTrickLinkTarget(addEl("addMainName").value, addEl("addAlt1").value, addEl("addAlt2").value);
  }
  function addIsLinking(){ return !!addLinkTarget(); }
  function addNoteEl(){ return addEl("addNameHint"); }

  // Translation-to-be-checked dots on the three name boxes (trick type only; flags in addForm.unsure by language).
  var ADD_NAME_IDS = ["addMainName", "addAlt1", "addAlt2"], ADD_NAME_LANG_KEYS = ["mainLang", "alt1Lang", "alt2Lang"];
  function addUnsureSync(){
    ADD_NAME_IDS.forEach(function(id){
      var w = addEl(id).parentNode;
      if(w.classList.contains("name-unsure-wrap")){ w.lastChild.hidden = addForm.type !== "trick"; w.lastChild.refresh(); }
    });
  }
  function addBindUnsureDots(){
    ADD_NAME_IDS.forEach(function(id, i){
      var inp = addEl(id);
      if(inp.parentNode.classList.contains("name-unsure-wrap")) return;
      wrapNameUnsureInput(inp, buildNameUnsureDot(function(){ return !!(addForm && addForm.unsure && addForm.unsure[addForm[ADD_NAME_LANG_KEYS[i]]]); }, function(){
        if(addForm){ var l = addForm[ADD_NAME_LANG_KEYS[i]]; addForm.unsure[l] = !addForm.unsure[l]; }
      }));
    });
  }

  function applyAddType(type){
    addForm.type = type;
    var isTrick = type === "trick";
    addEl("addInfoSection").hidden = type !== "info";
    Array.prototype.forEach.call(addEl("addTypeSwitch").children, function(b){
      b.classList.toggle("active", b.dataset.type === type);
    });
    // Every type: icon + prefix and three names (same grid). Trick adds grip + parts, info adds content + image.
    addEl("addPartsSection").hidden = !isTrick;
    addEl("addMainLabel").textContent = addForm.mainLabel;
    addUnsureSync();
    addEl("addMainName").placeholder = isTrick ? t("addNamePh") : "";
    updateAddIconPreview();
    syncAddLinking();
    addShowError("");
  }

  // While a name field holds "@id": show which trick will be linked (or why it can't be).
  function syncAddLinking(){
    var note = addNoteEl();
    var id = addLinkTarget();
    var key = "";
    note.classList.remove("form-error", "show");
    note.hidden = addForm.type !== "trick";
    if(addForm.type !== "trick"){ note.textContent = ""; return; }
    if(!id){ note.textContent = ""; return; }
    key = validateLinkTrick(id, addForm.parentId, addForm.spaceId, isAdminNow());
    if(key){
      note.textContent = t(key);
      note.classList.add("form-error", "show");
    } else {
      note.textContent = t("addLinkNote") + resolveDisplayName(getTrick(id).name).text;
    }
  }

  // Visible text fields of the modal, in DOM order (for arrow-key navigation).
  function addFieldList(){
    var all = addEl("addModal").querySelectorAll("input, textarea");
    return Array.prototype.filter.call(all, function(el){
      return el.type !== "hidden" && !el.closest("[hidden]");
    });
  }
  function onAddArrowKey(ev){
    var list = addFieldList();
    var idx = list.indexOf(ev.target);
    if(idx < 0) return;
    var n = addArrowTarget({ key: ev.key, multiline: ev.target.tagName === "TEXTAREA", value: ev.target.value,
      selStart: ev.target.selectionStart, selEnd: ev.target.selectionEnd, idx: idx, count: list.length,
      composing: !!ev.isComposing || ev.keyCode === 229 });
    if(n < 0) return;
    ev.preventDefault();
    list[n].focus();
  }

  // Shared grip picker (js/36) + clickable part diagram (same diagram as the 投稿 form, js/74).
  function buildAddParts(){
    var tr = addForm.tr = { grip: null, parts: [] };
    addEl("addPartsLabel").textContent = t("formPartsGrip");
    var diagHost = addEl("addDiagramHost"), gripHost = addEl("addGrips");
    diagHost.innerHTML = ""; gripHost.innerHTML = "";
    var diagram = createPartDiagram({ selected: tr.parts, interactive: true, onToggle: function(key){
      togglePart(tr, key); diagram.update(tr.parts);
    } });
    diagHost.appendChild(diagram);
    gripHost.appendChild(buildGripPicker({ value: tr.grip, onChange: function(v){ tr.grip = v; } }));
  }

  function openAddModal(parentId, spaceId){
    // Already open (e.g. the "n" shortcut or a second call): keep what was typed.
    if(addForm && addEl("addModalOverlay").classList.contains("show")) return;
    spaceId = spaceId || state.activeSpace;
    var types = addModalTypes(parentId, spaceId, isAdminNow());
    if(!types.def){
      if(!canCreateIn(parentId, spaceId)) showToast(t("favNoCreate"));
      return;
    }
    addForm = { type: types.def, parentId: parentId == null ? null : parentId, spaceId: spaceId, types: types };
    state.addDraftIcon = "";
    state.addDraftColor = "default";

    var parentIsTrick = !!(parentId && getTrick(parentId));
    var sw = addEl("addTypeSwitch");
    sw.innerHTML = "";
    [["trick", parentIsTrick ? t("addVariantShort") : t("addTypeTrick")], ["folder", t("addTypeFolder")], ["info", t("addTypeInfo")]].forEach(function(p){
      var b = document.createElement("button");
      b.type = "button"; b.className = "lang-btn"; b.dataset.type = p[0]; b.textContent = p[1];
      b.disabled = !types[p[0]];
      b.addEventListener("click", function(){ if(!b.disabled){ applyAddType(p[0]); } });
      sw.appendChild(b);
    });

    var langs = ["zh", "jp", "en"];
    var names = { zh: t("categoryNameZh"), jp: t("categoryNameJp"), en: t("categoryNameEn") };
    var alts = langs.filter(function(l){ return l !== state.lang; });
    addForm.mainLang = state.lang; addForm.alt1Lang = alts[0]; addForm.alt2Lang = alts[1];
    addForm.mainLabel = names[state.lang];
    addForm.unsure = {};
    addEl("addAlt1Label").textContent = names[alts[0]];
    addEl("addAlt2Label").textContent = names[alts[1]];
    ["addMainName", "addAlt1", "addAlt2", "addContent", "addPrefix"].forEach(function(id){ addEl(id).value = ""; });
    addEl("addPrefix").maxLength = PREFIX_MAX;
    addEl("addPrefixLabel").textContent = t("prefixLabel");
    addEl("addIconBtn").title = t("editIconColor");
    addEl("addIconBtn").setAttribute("aria-label", t("editIconColor"));
    if(!addInputsBound){
      addInputsBound = true;
      addEl("addModal").addEventListener("keydown", onAddArrowKey);
      // Name boxes: live ID-link detection.
      ["addMainName", "addAlt1", "addAlt2"].forEach(function(id){
        addEl(id).addEventListener("input", function(){ if(addForm) syncAddLinking(); });
      });
    }
    addBindUnsureDots();
    buildAddParts();
    addEl("addContentLabel").textContent = t("infoContentLabel");
    addEl("addCancelBtn").textContent = t("cancel");
    addEl("addSaveBtn").textContent = t("save");
    addEl("addSaveBtn").disabled = false;
    addEl("addCloseBtn").innerHTML = ICON_X;
    applyAddType(types.def);
    addEl("addModalOverlay").classList.add("show");
    setTimeout(function(){ addEl("addMainName").focus(); }, 80);
  }
  function closeAddModal(){
    addEl("addModalOverlay").classList.remove("show");
    addForm = null;
  }

  // Info: create the record and continue in its drawer (edit mode).
  function saveAddInfo(f){
    var rec = createInfoRecord(addForm.parentId, addForm.spaceId, f);
    showToast(t("savedInfo"));
    saveDB(); closeAddModal(); state.editMode = true; render(); openInfoDrawer(rec.id);
  }

  function saveAddModal(){
    if(!addForm || addEl("addSaveBtn").disabled) return;
    var admin = isAdminNow();
    var type = addForm.type, parentId = addForm.parentId, spaceId = addForm.spaceId;
    if(!addForm.types[type]) return addShowError("addErrNotAllowed");

    if(addIsLinking()){
      var lid = addLinkTarget();
      var key = validateLinkTrick(lid, parentId, spaceId, admin);
      if(key) return addShowError(key);
      linkTrickInto(lid, parentId, spaceId, addEl("addPrefix").value);
      saveDB(); closeAddModal(); showToast(t("addLinkedToast")); render();
      return;
    }

    var f = {};
    f[addForm.mainLang] = addEl("addMainName").value;
    f[addForm.alt1Lang] = addEl("addAlt1").value;
    f[addForm.alt2Lang] = addEl("addAlt2").value;
    if(addNameEmpty(addNameObj(f))) return addShowError("addErrName");
    if(!iconTextFits(state.addDraftIcon)) return addShowError("iconTextTooLong");
    f.icon = state.addDraftIcon; f.color = state.addDraftColor;
    f.prefix = addEl("addPrefix").value;

    if(type === "folder"){
      if(!canAddChild(parentId, "folder")) return addShowError("addErrNotAllowed");
      createFolderRecord(parentId, spaceId, f);
      showToast(t("savedCategory"));
    } else if(type === "info"){
      if(!canAddChild(parentId, "info")) return addShowError("addErrNotAllowed");
      f.content = addEl("addContent").value;
      saveAddInfo(f);
      return;
    } else {
      f.nameUnsure = addForm.unsure;
      f.grip = addForm.tr.grip; f.parts = addForm.tr.parts.slice();
      var rec = createTrickRecord(parentId, spaceId, f, addForm.types.customTrick);
      showToast(t("savedTrick"));
      // Continue in the drawer (edit mode): tags, videos, note live there.
      saveDB(); closeAddModal(); state.editMode = true; render(); openDrawerFor(rec.id, addEffectiveParent(parentId, spaceId));
      return;
    }
    saveDB(); closeAddModal(); render();
  }
