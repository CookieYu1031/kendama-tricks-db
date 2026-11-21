"use strict";

  /* ============================================================
     CATEGORY MODAL (Add / Edit)
  ============================================================ */
  // A folder's position is set by where it is created (the current column) and moved by
  // drag / cut-paste (js/22, js/25) — the modal has no parent field.
  addStrings({
    zh:{ categoryDepthLimitReached:"資料夾最多 3 層，無法在這裡新增資料夾",
         chooseImageBtn:"選擇圖片", iconImageTooBig:"圖片太大（上限 40 KB），請換一張較簡單的圖", iconImageFailed:"無法讀取這張圖片", confirmDeleteCategoryBody:"此分類及其子分類、資訊都會被刪除；其中的招式只會移除在此處的位置，最後一個位置被移除時招式才會刪除。" },
    jp:{ categoryDepthLimitReached:"フォルダは最大3階層までです。ここには追加できません",
         chooseImageBtn:"画像を選択", iconImageTooBig:"画像が大きすぎます（上限 40 KB）", iconImageFailed:"画像を読み込めません", confirmDeleteCategoryBody:"このカテゴリとサブカテゴリ・情報を削除します。中の技はこの場所から外すだけで、最後の配置が消えたときに削除されます。" },
    en:{ categoryDepthLimitReached:"Folders can go up to 3 levels deep. Can't add one here.",
         chooseImageBtn:"Choose image", iconImageTooBig:"Image too large (40 KB max). Try a simpler one.", iconImageFailed:"Couldn't read that image", confirmDeleteCategoryBody:"This folder, its sub-folders and info items are deleted. Tricks inside only lose this location; a trick is deleted when its last location is removed." }
  });

  var TRICK_DEFAULT_HEX = "#5B8AA6"; // matches --string, the default (un-customized) trick tint

  // "drawer" target: an external caller (the trick drawer) owns the draft. Set by
  // openIconPicker("drawer", { icon, color, onDone(icon, color) }); onDone runs once on close.
  var drawerPicker = null;

  function getDraftIcon(target){
    if(target==="drawer") return drawerPicker ? drawerPicker.icon : "";
    if(target==="space") return state.spaceDraftIcon;
    if(target==="add") return state.addDraftIcon;
    return state.categoryDraftIcon;
  }
  function getDraftColor(target){
    if(target==="drawer") return drawerPicker ? drawerPicker.color : "";
    if(target==="space") return state.spaceDraftColor;
    if(target==="add") return state.addDraftColor;
    return state.categoryDraftColor;
  }
  function setDraftIcon(target, val){
    if(target==="drawer"){ if(drawerPicker) drawerPicker.icon = val; }
    else if(target==="space") state.spaceDraftIcon = val;
    else if(target==="add") state.addDraftIcon = val;
    else state.categoryDraftIcon = val;
  }
  function setDraftColor(target, val){
    if(target==="drawer"){ if(drawerPicker) drawerPicker.color = val; }
    else if(target==="space") state.spaceDraftColor = val;
    else if(target==="add") state.addDraftColor = val;
    else state.categoryDraftColor = val;
  }

  var ICON_TARGET_ELS = {
    space:    { swatch:"spaceIconSwatch",        text:"spaceIconPreviewText" },
    category: { swatch:"iconColorSwatch",        text:"iconColorPreviewText" }
  };
  function updateIconColorPreview(target){
    target = target || "category";
    var els = ICON_TARGET_ELS[target] || ICON_TARGET_ELS.category;
    var swatch = document.getElementById(els.swatch);
    var text = document.getElementById(els.text);
    if(!swatch || !text) return;
    var colorKey = getDraftColor(target);
    var hex = colorHex(colorKey);
    swatch.style.background = hexToRgba(hex, 0.22);
    swatch.style.color = hex;
    var icon = getDraftIcon(target);
    swatch.classList.toggle("img-icon", isImageIcon(icon));
    swatch.innerHTML = iconHtml(icon, target==="space" ? ICON_EMPTY : ICON_FOLDER);
    text.textContent = t("chooseIconColor");
  }

  function openCategoryModal(categoryId, parentHint){
    if(categoryId && isFixedFavFolder(categoryId)) return; // fixed 收藏 folders can't be renamed
    state.editingCategoryId = categoryId;
    var overlay = document.getElementById("categoryModalOverlay");
    document.getElementById("categoryFormError").classList.remove("show");
    document.getElementById("categoryModalTitle").textContent = categoryId ? t("editCategory") : t("newCategory");
    document.getElementById("catDeleteBtn").hidden = !categoryId;

    state.editingCategoryParentHint = parentHint === undefined ? null : parentHint;

    if(categoryId){
      var cat = getCategory(categoryId);
      document.getElementById("catZh").value = cat.name.zh || "";
      document.getElementById("catJp").value = cat.name.jp || "";
      document.getElementById("catEn").value = cat.name.en || "";
      state.categoryDraftIcon = cat.icon || "";
      state.categoryDraftColor = cat.color || "default";
    } else {
      document.getElementById("catZh").value = "";
      document.getElementById("catJp").value = "";
      document.getElementById("catEn").value = "";
      state.categoryDraftIcon = "";
      state.categoryDraftColor = "default";
    }
    updateIconColorPreview("category");

    overlay.classList.add("show");
    setTimeout(function(){ document.getElementById("catZh").focus(); }, 80);
  }
  function closeCategoryModal(){
    document.getElementById("categoryModalOverlay").classList.remove("show");
    state.editingCategoryId = null;
  }

  /* ---- Icon & Color Picker ---- */
  // Image icons are admin-only, offered for every icon target (folder, trick, table, add modal,
  // drawer): all renderers print icons through iconHtml.
  var ICON_IMAGE_MAX_PX = 128;
  var ICON_IMAGE_MAX_CHARS = 40 * 1024;
  function iconImageAllowed(target){
    if(typeof isAdminAccount !== "function" || !isAdminAccount()) return false;
    return true;
  }
  // Pure: scaled size keeping aspect so the longer side is at most max (never upscales).
  function iconImageFit(w, h, max){
    var k = Math.min(1, max / Math.max(w, h));
    return { w: Math.max(1, Math.round(w * k)), h: Math.max(1, Math.round(h * k)) };
  }
  // Draws img centered on a transparent square canvas; returns "img:data:image/..." or "" when too big.
  function iconImageEncode(img){
    var fit = iconImageFit(img.naturalWidth || img.width, img.naturalHeight || img.height, ICON_IMAGE_MAX_PX);
    var side = Math.max(fit.w, fit.h);
    var cv = document.createElement("canvas");
    cv.width = side; cv.height = side;
    cv.getContext("2d").drawImage(img, Math.round((side - fit.w) / 2), Math.round((side - fit.h) / 2), fit.w, fit.h);
    var qualities = [0.85, 0.6, 0.4];
    for(var i = 0; i < qualities.length; i++){
      var url = cv.toDataURL("image/webp", qualities[i]);
      if(url.indexOf("data:image/webp") !== 0) url = cv.toDataURL("image/png"); // no webp encoder
      if(url.length <= ICON_IMAGE_MAX_CHARS) return "img:" + url;
    }
    return "";
  }
  function pickIconImage(file){
    if(!file) return;
    var target = state.iconPickerTarget || "category";
    var reader = new FileReader();
    reader.onerror = function(){ showToast(t("iconImageFailed")); };
    reader.onload = function(){
      var img = new Image();
      img.onerror = function(){ showToast(t("iconImageFailed")); };
      img.onload = function(){
        var val = iconImageEncode(img);
        if(!val || !isImageIcon(val)){ showToast(t("iconImageTooBig")); return; }
        setDraftIcon(target, val);
        renderIconPicker();
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  }
  (function bindIconImagePick(){
    var btn = document.getElementById("iconImageBtn");
    var inp = document.getElementById("iconImageFile");
    if(!btn || !inp) return;
    btn.addEventListener("click", function(){ inp.value = ""; inp.click(); });
    inp.addEventListener("change", function(){ pickIconImage(inp.files && inp.files[0]); });
  })();

  function renderIconPicker(){
    document.getElementById("iconPickerTitle").textContent = t("chooseIconColor");
    document.getElementById("colorPickerLabel").textContent = t("colorLabel");
    document.getElementById("emojiPickerLabel").textContent = t("iconLabel");
    document.getElementById("iconPickerNoneBtn").textContent = t("noIconOption");
    document.getElementById("iconPickerDoneBtn").textContent = t("doneBtn");
    document.getElementById("customEmojiInput").placeholder = t("customEmojiPlaceholder");

    var target = state.iconPickerTarget || "category";
    var imgBtn = document.getElementById("iconImageBtn");
    if(imgBtn){ imgBtn.textContent = t("chooseImageBtn"); imgBtn.hidden = !iconImageAllowed(target); }

    var colorRow = document.getElementById("colorSwatchRow");
    colorRow.innerHTML = "";
    COLOR_PALETTE.forEach(function(c){
      var sw = document.createElement("button");
      sw.type = "button";
      sw.className = "color-swatch" + (getDraftColor(target)===c.key ? " selected" : "");
      sw.style.background = c.hex;
      sw.innerHTML = '<svg viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      sw.addEventListener("click", function(){
        setDraftColor(target, c.key);
        renderIconPicker();
      });
      colorRow.appendChild(sw);
    });

    var grid = document.getElementById("emojiGrid");
    grid.innerHTML = "";
    ICON_EMOJI_GROUPS.forEach(function(group){
      var groupEl = document.createElement("div");
      groupEl.className = "emoji-group";
      group.forEach(function(emoji){
        var cell = document.createElement("button");
        cell.type = "button";
        cell.className = "emoji-cell" + (getDraftIcon(target)===emoji ? " selected" : "");
        cell.textContent = emoji;
        cell.addEventListener("click", function(){
          setDraftIcon(target, emoji);
          renderIconPicker();
        });
        groupEl.appendChild(cell);
      });
      grid.appendChild(groupEl);
    });
  }
  // Custom icon text box: never truncates or blocks while typing (IME-safe). The draft is
  // stored as typed; the length limit (iconTextFits) is checked on picker close and on save.
  var customIconBound = false;
  function showIconTextError(on){
    var inp = document.getElementById("customEmojiInput");
    var e = document.getElementById("iconTextError");
    if(!e && inp){
      e = document.createElement("div");
      e.id = "iconTextError"; e.className = "form-error";
      inp.parentNode.parentNode.appendChild(e);
    }
    if(!e) return;
    e.textContent = on ? t("iconTextTooLong") : "";
    e.classList.toggle("show", !!on);
  }
  function applyCustomIconInput(inp){
    var val = inp.value.trim();
    if(!val){ showIconTextError(false); return; }
    var target = state.iconPickerTarget || "category";
    setDraftIcon(target, val);
    showIconTextError(!iconTextFits(val));
    var grid = document.getElementById("emojiGrid");
    Array.prototype.forEach.call(grid.querySelectorAll(".emoji-cell"), function(cell){
      cell.classList.toggle("selected", cell.textContent === val);
    });
  }
  function bindCustomIconInput(){
    if(customIconBound) return;
    customIconBound = true;
    var inp = document.getElementById("customEmojiInput");
    if(!inp) return;
    // Drop the legacy truncating "input" listener bound in js/90 (clones carry no listeners).
    var fresh = inp.cloneNode(true);
    inp.parentNode.replaceChild(fresh, inp);
    var composing = false;
    fresh.addEventListener("compositionstart", function(){ composing = true; });
    fresh.addEventListener("compositionend", function(ev){ composing = false; applyCustomIconInput(ev.target); });
    fresh.addEventListener("input", function(ev){ if(!composing && !ev.isComposing) applyCustomIconInput(ev.target); });
  }
  function openIconPicker(target, opts){
    state.iconPickerTarget = target || "category";
    drawerPicker = target === "drawer" ? { icon: (opts && opts.icon) || "", color: (opts && opts.color) || "", onDone: opts && opts.onDone } : null;
    bindCustomIconInput();
    // Reset the text box only when the picker opens (a color pick re-renders but keeps typing).
    var cur = getDraftIcon(state.iconPickerTarget) || "";
    var box = document.getElementById("customEmojiInput");
    box.value = (cur && ICON_EMOJI_SET.indexOf(cur) === -1 && !isImageIcon(cur)) ? cur : "";
    showIconTextError(false);
    renderIconPicker();
    document.getElementById("iconPickerOverlay").classList.add("show");
  }
  function closeIconPicker(){
    // Block closing while the typed icon text is too long (inline error stays visible).
    if(!iconTextFits(getDraftIcon(state.iconPickerTarget || "category"))){ showIconTextError(true); return; }
    document.getElementById("iconPickerOverlay").classList.remove("show");
    if(state.iconPickerTarget === "drawer"){
      var dp = drawerPicker; drawerPicker = null;
      if(dp && typeof dp.onDone === "function") dp.onDone(dp.icon, dp.color);
    } else if(state.iconPickerTarget === "add") updateAddIconPreview();
    else updateIconColorPreview(state.iconPickerTarget);
  }

  function saveCategoryFromModal(){
    var zh = document.getElementById("catZh").value.trim();
    var jp = document.getElementById("catJp").value.trim();
    var en = document.getElementById("catEn").value.trim();
    var parentVal = state.editingCategoryId ? getCategory(state.editingCategoryId).parentId : (state.editingCategoryParentHint || null);

    if(!zh){
      document.getElementById("categoryFormError").textContent = t("categoryNameRequired");
      document.getElementById("categoryFormError").classList.add("show");
      return;
    }

    if(!iconTextFits(state.categoryDraftIcon)){
      document.getElementById("categoryFormError").textContent = t("iconTextTooLong");
      document.getElementById("categoryFormError").classList.add("show");
      return;
    }

    if(!state.editingCategoryId && !canAddChild(parentVal, "folder")){
      document.getElementById("categoryFormError").textContent = t("categoryDepthLimitReached");
      document.getElementById("categoryFormError").classList.add("show");
      return;
    }

    if(state.editingCategoryId){
      if(isFixedFavFolder(state.editingCategoryId)) return closeCategoryModal();
      var cat = getCategory(state.editingCategoryId);
      cat.name = { zh:zh, jp:jp, en:en };
      cat.icon = state.categoryDraftIcon;
      cat.color = state.categoryDraftColor;
    } else {
      var siblingCount = getChildren(parentVal).length;
      db.categories.push({ id: newItemId(), parentId: parentVal, name:{ zh:zh, jp:jp, en:en }, order: siblingCount, icon: state.categoryDraftIcon, color: state.categoryDraftColor, spaceId: state.activeSpace });
    }
    saveDB();
    closeCategoryModal();
    showToast(t("savedCategory"));
    render();
  }

  function requestDeleteCategory(categoryId){
    var cat = getCategory(categoryId);
    if(!cat || cat.virtual || isFixedFavFolder(categoryId)) return; // fixed 收藏 folders can't be deleted
    openConfirm(t("confirmDeleteCategoryTitle"), t("confirmDeleteCategoryBody"), function(){
      var idsToRemove = getDescendantCategoryIds(categoryId);
      var placements = [];
      db.tricks.forEach(function(tr){
        tr.categoryIds.forEach(function(cid){ if(idsToRemove.indexOf(cid) !== -1) placements.push([tr.id, cid]); });
      });
      db.categories = db.categories.filter(function(c){ return idsToRemove.indexOf(c.id) === -1; });
      db.infos = (db.infos || []).filter(function(n){ return idsToRemove.indexOf(n.parentId) === -1; });
      placements.forEach(function(p){ removeTrickPlacement(p[0], p[1]); });
      // trim path at the first removed ancestor (keeps everything above the deleted branch)
      var cutIdx = state.path.findIndex(function(id){ return idsToRemove.indexOf(id) !== -1; });
      if(cutIdx !== -1) state.path = state.path.slice(0, cutIdx);
      if(state.detailTrickId && !getTrick(state.detailTrickId)) closeDrawer();
      saveDB();
      closeCategoryModal();
      showToast(t("deletedCategory"));
      render();
    });
  }
