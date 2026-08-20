"use strict";

  /* ============================================================
     CATEGORY MODAL (Add / Edit)
  ============================================================ */
  // Parent options now include trick-folders alongside categories (via the
  // same generic flattenContainersForPicker() used for the trick "belongs to"
  // picker) — a trick with too many flat extension tricks can now be given
  // sub-categories of its own, so its id needs to be a valid parent choice
  // here too. Trick-folder rows get a "▶" marker (matching the same marker
  // used in the trick modal's own picker) so they read distinctly from plain
  // categories in the dropdown.
  function fillParentSelect(selectEl, excludeIds){
    selectEl.innerHTML = "";
    var rootOpt = document.createElement("option");
    rootOpt.value = ""; rootOpt.textContent = t("rootLevel");
    selectEl.appendChild(rootOpt);
    flattenContainersForPicker(excludeIds).forEach(function(row){
      var opt = document.createElement("option");
      opt.value = row.id;
      var atDepthLimit = row.depth >= MAX_CATEGORY_DEPTH - 1; // this row is already the deepest allowed level
      var prefix = row.depth>0 ? "\u2003".repeat(row.depth) + "\u2514 " : "";
      var marker = row.type === "trick" ? "\u25B6 " : "";
      opt.textContent = prefix + marker + row.name + (atDepthLimit ? " " + t("maxDepthSuffix") : "");
      if(atDepthLimit) opt.disabled = true;
      selectEl.appendChild(opt);
    });
  }

  var TRICK_DEFAULT_HEX = "#5B8AA6"; // matches --string, the default (un-customized) trick tint

  function getDraftIcon(target){
    if(target==="trick") return state.trickDraftIcon;
    if(target==="space") return state.spaceDraftIcon;
    return state.categoryDraftIcon;
  }
  function getDraftColor(target){
    if(target==="trick") return state.trickDraftColor;
    if(target==="space") return state.spaceDraftColor;
    return state.categoryDraftColor;
  }
  function setDraftIcon(target, val){
    if(target==="trick") state.trickDraftIcon = val;
    else if(target==="space") state.spaceDraftIcon = val;
    else state.categoryDraftIcon = val;
  }
  function setDraftColor(target, val){
    if(target==="trick") state.trickDraftColor = val;
    else if(target==="space") state.spaceDraftColor = val;
    else state.categoryDraftColor = val;
  }

  var ICON_TARGET_ELS = {
    trick:    { swatch:"trickIconColorSwatch",   text:"trickIconColorPreviewText" },
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
    var hex = (target==="trick" && !colorKey) ? TRICK_DEFAULT_HEX : colorHex(colorKey);
    swatch.style.background = hexToRgba(hex, 0.22);
    swatch.style.color = hex;
    var icon = getDraftIcon(target);
    swatch.innerHTML = icon ? escapeHtml(icon) : (target==="trick" ? ICON_PLAY : target==="space" ? ICON_EMPTY : ICON_FOLDER);
    text.textContent = t("chooseIconColor");
  }

  function openCategoryModal(categoryId, parentHint){
    state.editingCategoryId = categoryId;
    var overlay = document.getElementById("categoryModalOverlay");
    document.getElementById("categoryFormError").classList.remove("show");
    document.getElementById("categoryModalTitle").textContent = categoryId ? t("editCategory") : t("newCategory");
    document.getElementById("catDeleteBtn").hidden = !categoryId;

    var excludeIds = categoryId ? getDescendantCategoryIds(categoryId) : [];
    fillParentSelect(document.getElementById("catParent"), excludeIds);

    if(categoryId){
      var cat = getCategory(categoryId);
      document.getElementById("catZh").value = cat.name.zh || "";
      document.getElementById("catJp").value = cat.name.jp || "";
      document.getElementById("catEn").value = cat.name.en || "";
      document.getElementById("catParent").value = cat.parentId || "";
      state.categoryDraftIcon = cat.icon || "";
      state.categoryDraftColor = cat.color || "default";
    } else {
      document.getElementById("catZh").value = "";
      document.getElementById("catJp").value = "";
      document.getElementById("catEn").value = "";
      document.getElementById("catParent").value = parentHint || "";
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
  function renderIconPicker(){
    document.getElementById("iconPickerTitle").textContent = t("chooseIconColor");
    document.getElementById("colorPickerLabel").textContent = t("colorLabel");
    document.getElementById("emojiPickerLabel").textContent = t("iconLabel");
    document.getElementById("iconPickerNoneBtn").textContent = t("noIconOption");
    document.getElementById("iconPickerDoneBtn").textContent = t("doneBtn");
    document.getElementById("customEmojiInput").placeholder = t("customEmojiPlaceholder");
    document.getElementById("customEmojiInput").value = "";

    var target = state.iconPickerTarget || "category";

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
  function openIconPicker(target){
    state.iconPickerTarget = target || "category";
    renderIconPicker();
    document.getElementById("iconPickerOverlay").classList.add("show");
  }
  function closeIconPicker(){
    document.getElementById("iconPickerOverlay").classList.remove("show");
    updateIconColorPreview(state.iconPickerTarget);
  }

  function saveCategoryFromModal(){
    var zh = document.getElementById("catZh").value.trim();
    var jp = document.getElementById("catJp").value.trim();
    var en = document.getElementById("catEn").value.trim();
    var parentVal = document.getElementById("catParent").value || null;

    if(!zh){
      document.getElementById("categoryFormError").textContent = t("categoryNameRequired");
      document.getElementById("categoryFormError").classList.add("show");
      return;
    }

    var newDepth = parentVal ? categoryDepth(parentVal) + 1 : 1;
    if(newDepth > MAX_CATEGORY_DEPTH){
      document.getElementById("categoryFormError").textContent = t("categoryDepthLimitReached");
      document.getElementById("categoryFormError").classList.add("show");
      return;
    }

    if(state.editingCategoryId){
      var cat = getCategory(state.editingCategoryId);
      cat.name = { zh:zh, jp:jp, en:en };
      cat.parentId = parentVal;
      cat.icon = state.categoryDraftIcon;
      cat.color = state.categoryDraftColor;
    } else {
      var siblingCount = getChildren(parentVal).length;
      db.categories.push({ id: uid("cat"), parentId: parentVal, name:{ zh:zh, jp:jp, en:en }, order: siblingCount, icon: state.categoryDraftIcon, color: state.categoryDraftColor, spaceId: state.activeSpace });
    }
    saveDB();
    closeCategoryModal();
    showToast(t("savedCategory"));
    render();
  }

  function requestDeleteCategory(categoryId){
    var cat = getCategory(categoryId);
    if(!cat) return;
    openConfirm(t("confirmDeleteCategoryTitle"), t("confirmDeleteCategoryBody"), function(){
      var idsToRemove = getDescendantCategoryIds(categoryId);
      db.categories = db.categories.filter(function(c){ return idsToRemove.indexOf(c.id) === -1; });
      db.tricks.forEach(function(tr){
        tr.categoryIds = tr.categoryIds.filter(function(cid){ return idsToRemove.indexOf(cid) === -1; });
        idsToRemove.forEach(function(cid){ delete tr.orderByCategory[cid]; });
      });
      // trim path at the first removed ancestor (keeps everything above the deleted branch)
      var cutIdx = state.path.findIndex(function(id){ return idsToRemove.indexOf(id) !== -1; });
      if(cutIdx !== -1) state.path = state.path.slice(0, cutIdx);
      saveDB();
      closeCategoryModal();
      showToast(t("deletedCategory"));
      render();
    });
  }

