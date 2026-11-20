"use strict";

  /* ============================================================
     UNIFIED ADD MODAL (folder / trick / info) — opened by the floating "+"
     of a column in edit mode. Pure logic first (unit-tested in
     tests/add-modal.test.js), UI below.
  ============================================================ */
  addStrings({
    zh:{ addTypeTrick:"招式", addTypeFolder:"資料夾", addTypeInfo:"資訊", addTitleBtn:"新增",
         addNameLabel:"名稱", addLinkLabel:"填入既有招式 ID（選填，填寫後改為連結該招式）", addLinkPlaceholder:"7 碼 ID",
         addVideoLabel:"影片連結（選填）", addTagsLabel:"標籤", addNoTags:"（尚無標籤）",
         addContentLabel:"內容", addOfficialNoteLabel:"官方備註",
         addErrName:"請至少輸入一種語言的名稱", addErrVideo:"影片連結必須以 http:// 或 https:// 開頭",
         addErrLinkMissing:"找不到這個招式 ID", addErrLinkDup:"此招式已在這個位置", addErrLinkCycle:"不能把招式放進它自己或它的延伸招式底下",
         addErrLinkLevel:"超過層級上限，無法放到這裡", addErrLinkPerm:"此分區不能使用 ID 連結", addErrNotAllowed:"這裡不能新增此類型",
         addLinkedToast:"已連結招式" },
    jp:{ addTypeTrick:"技", addTypeFolder:"フォルダ", addTypeInfo:"情報", addTitleBtn:"追加",
         addNameLabel:"名前", addLinkLabel:"既存の技ID（任意。入力するとその技を配置します）", addLinkPlaceholder:"7文字のID",
         addVideoLabel:"動画リンク（任意）", addTagsLabel:"タグ", addNoTags:"（タグなし）",
         addContentLabel:"内容", addOfficialNoteLabel:"公式メモ",
         addErrName:"少なくとも1つの言語で名前を入力してください", addErrVideo:"動画リンクは http:// または https:// で始めてください",
         addErrLinkMissing:"この技IDは見つかりません", addErrLinkDup:"この技はすでにここにあります", addErrLinkCycle:"技を自分自身や派生技の下には置けません",
         addErrLinkLevel:"階層の上限を超えるため、ここには置けません", addErrLinkPerm:"この区画ではIDリンクを使えません", addErrNotAllowed:"ここではこの種類を追加できません",
         addLinkedToast:"技をリンクしました" },
    en:{ addTypeTrick:"Trick", addTypeFolder:"Folder", addTypeInfo:"Info", addTitleBtn:"Add",
         addNameLabel:"Name", addLinkLabel:"Existing trick ID (optional; links that trick here)", addLinkPlaceholder:"7-char ID",
         addVideoLabel:"Video link (optional)", addTagsLabel:"Tags", addNoTags:"(No tags yet)",
         addContentLabel:"Content", addOfficialNoteLabel:"Official note",
         addErrName:"Enter a name in at least one language", addErrVideo:"Video link must start with http:// or https://",
         addErrLinkMissing:"No trick with this ID", addErrLinkDup:"This trick is already here", addErrLinkCycle:"A trick can't go under itself or its own variants",
         addErrLinkLevel:"Level limit exceeded; it can't go here", addErrLinkPerm:"ID linking isn't available in this table", addErrNotAllowed:"This type can't be added here",
         addLinkedToast:"Trick linked" }
  });

  /* ---------------- Pure logic ---------------- */
  // Which types the "+" of a column may create; def = default type (trick first).
  function addModalTypes(parentId, spaceId, isAdmin){
    var al = allowedAddButtons(parentId, spaceId, isAdmin);
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
  function linkTrickInto(id, parentId, spaceId){
    var tr = getTrick(id);
    tr.categoryIds.push(addEffectiveParent(parentId, spaceId));
    return tr;
  }

  function addNameObj(f){ return { zh: (f.zh || "").trim(), jp: (f.jp || "").trim(), en: (f.en || "").trim() }; }
  function addNameEmpty(n){ return !n.zh && !n.jp && !n.en; }

  function createFolderRecord(parentId, spaceId, f){
    var pid = getSpace(parentId) ? null : (parentId == null ? null : parentId);
    var rec = { id: newItemId(), parentId: pid, name: addNameObj(f), order: getChildren(pid).length,
      icon: f.icon || "", color: f.color || "default", spaceId: spaceId };
    db.categories.push(rec);
    return rec;
  }
  function createInfoRecord(parentId, spaceId, f){
    var pid = getSpace(parentId) ? null : (parentId == null ? null : parentId);
    if(!db.infos) db.infos = [];
    var rec = { id: newItemId(), parentId: pid, spaceId: spaceId, title: addNameObj(f), content: f.content || "",
      order: getInfosIn(pid).length, icon: "", color: "default" };
    db.infos.push(rec);
    return rec;
  }
  // f: { zh, jp, en, icon, color, url, grip, parts, tagIds, note, officialNote }
  function createTrickRecord(parentId, spaceId, f, custom){
    var media = [];
    if(f.url) media.push({ id: newItemId(), type: "video", title: "", url: f.url, platform: detectPlatform(f.url) });
    var rec = normalizeDB({ categories: [], tricks: [{ id: newItemId(), name: addNameObj(f), media: media.slice(0, MAX_VIDEOS),
      categoryIds: [addEffectiveParent(parentId, spaceId)], orderByCategory: {}, order: db.tricks.length,
      icon: f.icon || "", color: f.color || "default", custom: !!custom, grip: f.grip || null, parts: f.parts || [],
      tagIds: f.tagIds || [], note: f.note || "", officialNote: f.officialNote || "" }] }).tricks[0];
    db.tricks.push(rec);
    return rec;
  }

  /* ---------------- UI ---------------- */
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
    sw.innerHTML = state.addDraftIcon ? escapeHtml(state.addDraftIcon) : (isTrick ? ICON_PLAY : ICON_FOLDER);
  }

  function addIsLinking(){
    return addForm.type === "trick" && addEl("addLinkId").value.trim() !== "";
  }

  function renderAddChips(){
    var gripRow = addEl("addGripRow"), partsRow = addEl("addPartsRow"), tagsRow = addEl("addTagsRow");
    var fake = { grip: addForm.grip, parts: addForm.parts };
    function chip(text, on, fn){
      var b = makeChip(text, on, fn);
      return b;
    }
    gripRow.innerHTML = ""; partsRow.innerHTML = ""; tagsRow.innerHTML = "";
    GRIP_KEYS.forEach(function(k){
      gripRow.appendChild(chip(t("grip_" + k), fake.grip === k, function(){ addForm.grip = toggleGrip(fake, k); renderAddChips(); }));
    });
    PART_KEYS.forEach(function(k){
      partsRow.appendChild(chip(t("part_" + k), fake.parts.indexOf(k) !== -1, function(){ addForm.parts = togglePart(fake, k).slice(); renderAddChips(); }));
    });
    if(!(db.tags || []).length){
      var none = document.createElement("span");
      none.className = "field-hint"; none.textContent = t("addNoTags");
      tagsRow.appendChild(none);
    }
    (db.tags || []).forEach(function(g){
      var on = addForm.tagIds.indexOf(g.id) !== -1;
      tagsRow.appendChild(chip(resolveDisplayName(g.name).text, on, function(){
        addForm.tagIds = on ? addForm.tagIds.filter(function(x){ return x !== g.id; }) : addForm.tagIds.concat([g.id]);
        renderAddChips();
      }));
    });
  }

  function applyAddType(type){
    addForm.type = type;
    var isTrick = type === "trick";
    addEl("addInfoSection").hidden = type !== "info";
    addEl("addTrickSection").hidden = !isTrick;
    addEl("addIconBtn").hidden = type === "info";
    Array.prototype.forEach.call(addEl("addTypeSwitch").children, function(b){
      b.classList.toggle("active", b.dataset.type === type);
    });
    if(isTrick){
      var linkOk = addLinkAllowed(addForm.spaceId, isAdminNow());
      addEl("addLinkId").disabled = !linkOk;
      addEl("addLinkId").closest(".field").hidden = !linkOk;
      var admOfficial = !addForm.types.customTrick && !!(getSpace(addForm.spaceId) || {}).locked && isAdminNow();
      addEl("addOfficialField").hidden = !admOfficial;
    }
    // Row 3: folder / trick = the other two language names; info = the content box instead.
    addEl("addAltRow").hidden = type === "info";
    updateAddIconPreview();
    syncAddLinking();
    addShowError("");
  }

  // While an ID is typed the other trick fields are ignored (disabled).
  function syncAddLinking(){
    var link = addIsLinking();
    ["addMainName", "addAlt1", "addAlt2", "addVideoUrl", "addNote", "addOfficialNote"].forEach(function(id){
      if(addForm.type === "trick") addEl(id).disabled = link;
      else addEl(id).disabled = false;
    });
    addEl("addTrickFields").classList.toggle("add-disabled", link && addForm.type === "trick");
    addEl("addIconBtn").disabled = link && addForm.type === "trick";
  }

  function openAddModal(parentId, spaceId){
    spaceId = spaceId || state.activeSpace;
    var types = addModalTypes(parentId, spaceId, isAdminNow());
    if(!types.def) return;
    addForm = { type: types.def, parentId: parentId == null ? null : parentId, spaceId: spaceId, types: types, grip: null, parts: [], tagIds: [] };
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
    addEl("addMainLabel").textContent = names[state.lang];
    addEl("addAlt1Label").textContent = names[alts[0]];
    addEl("addAlt2Label").textContent = names[alts[1]];
    ["addMainName", "addAlt1", "addAlt2", "addVideoUrl", "addLinkId", "addNote", "addOfficialNote", "addContent"].forEach(function(id){ addEl(id).value = ""; });
    addEl("addLinkLabel").textContent = t("addLinkLabel");
    addEl("addLinkId").placeholder = t("addLinkPlaceholder");
    addEl("addVideoLabel").textContent = t("addVideoLabel");
    addEl("addGripLabel").textContent = t("gripLabel");
    addEl("addPartsLabel").textContent = t("partsLabel");
    addEl("addTagsLabel").textContent = t("addTagsLabel");
    addEl("addOfficialLabel").textContent = t("addOfficialNoteLabel");
    addEl("addNoteLabel").textContent = t("personalNoteLabel");
    addEl("addContentLabel").textContent = t("addContentLabel");
    addEl("addNote").placeholder = t("mediaContentPlaceholder");
    addEl("addOfficialNote").placeholder = t("mediaContentPlaceholder");
    addEl("addCancelBtn").textContent = t("cancel");
    addEl("addSaveBtn").textContent = t("save");
    addEl("addCloseBtn").innerHTML = ICON_X;
    renderAddChips();
    applyAddType(types.def);
    addEl("addModalOverlay").classList.add("show");
    setTimeout(function(){ addEl("addMainName").focus(); }, 80);
  }
  function closeAddModal(){
    addEl("addModalOverlay").classList.remove("show");
    addForm = null;
  }

  function saveAddModal(){
    if(!addForm) return;
    var admin = isAdminNow();
    var type = addForm.type, parentId = addForm.parentId, spaceId = addForm.spaceId;
    if(!addForm.types[type]) return addShowError("addErrNotAllowed");

    if(addIsLinking()){
      var key = validateLinkTrick(addEl("addLinkId").value, parentId, spaceId, admin);
      if(key) return addShowError(key);
      linkTrickInto(addEl("addLinkId").value.trim(), parentId, spaceId);
      saveDB(); closeAddModal(); showToast(t("addLinkedToast")); render();
      return;
    }

    var f = {};
    f[addForm.mainLang] = addEl("addMainName").value;
    f[addForm.alt1Lang] = addEl("addAlt1").value;
    f[addForm.alt2Lang] = addEl("addAlt2").value;
    if(addNameEmpty(addNameObj(f))) return addShowError("addErrName");
    f.icon = state.addDraftIcon; f.color = state.addDraftColor;

    if(type === "folder"){
      if(!canAddChild(parentId, "folder")) return addShowError("addErrNotAllowed");
      createFolderRecord(parentId, spaceId, f);
      showToast(t("savedCategory"));
    } else if(type === "info"){
      f.content = addEl("addContent").value;
      createInfoRecord(parentId, spaceId, f);
      showToast(t("savedInfo"));
    } else {
      var url = addEl("addVideoUrl").value.trim();
      if(url && !isSafeHttpUrl(url)) return addShowError("addErrVideo");
      f.url = url; f.grip = addForm.grip; f.parts = addForm.parts; f.tagIds = addForm.tagIds;
      f.note = addEl("addNote").value;
      f.officialNote = addEl("addOfficialField").hidden ? "" : addEl("addOfficialNote").value;
      createTrickRecord(parentId, spaceId, f, addForm.types.customTrick);
      showToast(t("savedTrick"));
    }
    saveDB(); closeAddModal(); render();
  }
