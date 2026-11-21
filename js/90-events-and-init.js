"use strict";

  /* ============================================================
     EVENT WIRING
  ============================================================ */
  document.getElementById("brandHome").addEventListener("click", function(){
    state.path = []; state.detailTrickId = null; state.searchQuery = "";
    document.getElementById("searchInput").value = "";
    document.getElementById("searchClear").classList.remove("show");
    updateSearchInlineCount("");
    closeSearchPanel();
    closeDrawer();
    render();
  if(typeof refreshUpdatesBadge === "function") refreshUpdatesBadge();
  });

  // Language switch (lives in the settings page).
  document.getElementById("langSwitch").addEventListener("click", function(ev){
    var btn = ev.target.closest(".lang-btn");
    if(!btn) return;
    state.lang = btn.getAttribute("data-lang");
    localStorage.setItem(LANG_KEY, state.lang);
    render();
  });

  var searchInput = document.getElementById("searchInput");
  var searchClear = document.getElementById("searchClear");
  var searchToggleBtn = document.getElementById("searchToggleBtn");
  var searchPanel = document.getElementById("searchPanel");

  // Search panel: opens from the topbar's center button; closes via Escape,
  // the button again, or a click outside the panel.
  searchToggleBtn.addEventListener("click", function(ev){
    ev.stopPropagation();
    toggleSearchPanel();
  });
  document.addEventListener("click", function(ev){
    if(!isSearchPanelOpen()) return;
    // composedPath: result chips re-render on click, so ev.target may already be detached.
    var path = ev.composedPath ? ev.composedPath() : [];
    if(path.indexOf(searchPanel) !== -1 || searchPanel.contains(ev.target) || searchToggleBtn.contains(ev.target)) return;
    closeSearchPanel();
  });

  searchInput.addEventListener("input", onSearchInput);
  searchInput.addEventListener("keydown", onSearchKeydown);
  searchClear.addEventListener("click", function(){
    searchInput.value = "";
    searchClear.classList.remove("show");
    state.searchQuery = "";
    runSearchPanel();
    searchInput.focus();
  });

  // Category modal
  document.getElementById("catCancelBtn").addEventListener("click", closeCategoryModal);
  document.getElementById("catSaveBtn").addEventListener("click", saveCategoryFromModal);
  document.getElementById("catDeleteBtn").addEventListener("click", function(){ requestDeleteCategory(state.editingCategoryId); });
  // (No overlay-click-to-close here — a stray click outside the modal while
  // filling in a category shouldn't discard the edit in progress. Cancel
  // button / Escape are the deliberate ways out.)
  document.getElementById("iconColorPreviewBtn").addEventListener("click", function(){ openIconPicker("category"); });

  // Unified add modal (js/47-modal-add.js)
  document.getElementById("addCancelBtn").addEventListener("click", closeAddModal);
  document.getElementById("addCloseBtn").addEventListener("click", closeAddModal);
  document.getElementById("addSaveBtn").addEventListener("click", saveAddModal);
  document.getElementById("addIconBtn").addEventListener("click", function(){ openIconPicker("add"); });

  // Icon & color picker modal
  document.getElementById("iconPickerNoneBtn").addEventListener("click", function(){
    setDraftIcon(state.iconPickerTarget, "");
    closeIconPicker();
  });
  document.getElementById("iconPickerDoneBtn").addEventListener("click", closeIconPicker);
  document.getElementById("iconPickerOverlay").addEventListener("click", function(ev){ if(ev.target.id==="iconPickerOverlay") closeIconPicker(); });
  document.getElementById("customEmojiInput").addEventListener("input", function(ev){
    var clamped = clampIconInput(ev.target.value);
    if(clamped !== ev.target.value) ev.target.value = clamped;
    var val = clamped.trim();
    if(val){
      setDraftIcon(state.iconPickerTarget, val);
      var grid = document.getElementById("emojiGrid");
      Array.prototype.forEach.call(grid.querySelectorAll(".emoji-cell"), function(cell){
        cell.classList.toggle("selected", cell.textContent === val);
      });
    }
  });

  // Info modal
  document.getElementById("infoCancelBtn").addEventListener("click", closeInfoModal);
  document.getElementById("infoSaveBtn").addEventListener("click", saveInfoFromModal);
  document.getElementById("infoEditBtn").addEventListener("click", function(){
    if(infoModalState.id) openInfoModal(infoModalState.id, infoModalState.parentId, true);
  });
  document.getElementById("infoDeleteBtn").addEventListener("click", function(){ requestDeleteInfo(infoModalState.id); });
  // (No overlay-click-to-close — see the category modal comment above.)

  // Confirm modal
  document.getElementById("confirmCancelBtn").addEventListener("click", closeConfirm);
  document.getElementById("confirmOkBtn").addEventListener("click", function(){
    var action = state.confirmAction;
    closeConfirm();
    if(action) action();
  });
  document.getElementById("confirmOverlay").addEventListener("click", function(ev){ if(ev.target.id==="confirmOverlay") closeConfirm(); });

  // Video modal
  document.getElementById("videoModalOverlay").addEventListener("click", function(ev){ if(ev.target.id==="videoModalOverlay") closeVideoModal(); });

  // Media modal (video only — notes are edited inline in the drawer)
  document.getElementById("mediaCancelBtn").addEventListener("click", closeMediaModal);
  document.getElementById("mediaSaveBtn").addEventListener("click", saveMediaFromModal);
  document.getElementById("mediaDeleteBtn").addEventListener("click", function(){ requestDeleteMedia(state.editingMediaTrickId, state.editingMediaId); });
  // (No overlay-click-to-close — see the category modal comment above.)

  // Space modal (leftmost rail shelves)
  document.getElementById("spaceIconPreviewBtn").addEventListener("click", function(){ openIconPicker("space"); });
  document.getElementById("spaceCancelBtn").addEventListener("click", closeSpaceModal);
  document.getElementById("spaceSaveBtn").addEventListener("click", saveSpaceFromModal);
  document.getElementById("spaceDeleteBtn").addEventListener("click", function(){ requestDeleteSpace(state.editingSpaceId); });
  // (No overlay-click-to-close — see the category modal comment above.)

  // (Detail drawer now lives inline in the layout, like the space rail —
  // it closes only via its own close button / Escape, not an overlay click.)

  // Pressing Enter while filling in a form field is equivalent to clicking
  // that modal's Save button. Only fires for text/url inputs and <select>
  // elements (not buttons), so it never hijacks Enter on a focused Cancel/
  // Delete button or a multi-line <textarea>.
  function bindEnterToSave(overlayId, saveFn){
    document.getElementById(overlayId).addEventListener("keydown", function(ev){
      if(ev.key !== "Enter") return;
      var tag = ev.target.tagName;
      if(tag !== "INPUT" && tag !== "SELECT") return;
      ev.preventDefault();
      saveFn();
    });
  }
  bindEnterToSave("categoryModalOverlay", saveCategoryFromModal);
  bindEnterToSave("mediaModalOverlay", saveMediaFromModal);
  bindEnterToSave("spaceModalOverlay", saveSpaceFromModal);
  bindEnterToSave("addModalOverlay", saveAddModal);
  bindEnterToSave("infoModalOverlay", function(){
    if(!document.getElementById("infoEditBody").hidden) saveInfoFromModal();
  });
  // Escape key closes topmost overlay
  document.addEventListener("keydown", function(ev){
    if(ev.key !== "Escape") return;
    if(isSearchPanelOpen()) return closeSearchPanel();
    if(document.getElementById("videoModalOverlay").classList.contains("show")) return closeVideoModal();
    if(document.getElementById("mediaModalOverlay").classList.contains("show")) return closeMediaModal();
    if(document.getElementById("spaceModalOverlay").classList.contains("show")) return closeSpaceModal();
    if(document.getElementById("confirmOverlay").classList.contains("show")) return closeConfirm();
    var shareOv = document.getElementById("shareOverlay");
    if(shareOv && shareOv.classList.contains("show")) return shareCloseModal();
    if(document.getElementById("infoModalOverlay").classList.contains("show")) return closeInfoModal();
    if(document.getElementById("iconPickerOverlay").classList.contains("show")) return closeIconPicker();
    if(document.getElementById("addModalOverlay").classList.contains("show")) return closeAddModal();
    if(document.getElementById("categoryModalOverlay").classList.contains("show")) return closeCategoryModal();
    if(isAdminPanelOpen()) return closeAdminPanel();
    if(isUpdatesOpen()) return closeUpdates();
    if(isSettingsOpen()) return closeSettings();
    if(document.getElementById("detailDrawer").classList.contains("show")) return closeDrawer();
  });

  window.addEventListener("resize", function(){ render(); });

  /* ============================================================
     INIT
  ============================================================ */
  // detectPlatform (05) did not exist when `db` was first normalized in 01: fill video platforms now.
  backfillPlatforms(db);
  if(typeof rebuildReadingDict === "function") rebuildReadingDict(db.tricks);
  render();
