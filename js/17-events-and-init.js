"use strict";

  /* ============================================================
     EVENT WIRING
  ============================================================ */
  document.getElementById("brandHome").addEventListener("click", function(){
    state.path = []; state.detailTrickId = null; state.searchQuery = "";
    document.getElementById("searchInput").value = "";
    document.getElementById("searchClear").classList.remove("show");
    updateSearchInlineCount("");
    closeSearchSuggest();
    collapseMobileSearchIfEmpty();
    closeDrawer();
    render();
  });

  // On narrow viewports the switch collapses to just the active language
  // (see .lang-btn / .lang-btn.active in the mobile media query), so a tap
  // cycles zh -> jp -> en -> zh rather than picking the clicked button's own
  // data-lang (there's only ever one visible/clickable button to hit).
  var LANG_CYCLE_ORDER = ["zh", "jp", "en"];
  document.getElementById("langSwitch").addEventListener("click", function(ev){
    var btn = ev.target.closest(".lang-btn");
    if(!btn) return;
    if(isNarrowViewport()){
      var idx = LANG_CYCLE_ORDER.indexOf(state.lang);
      state.lang = LANG_CYCLE_ORDER[(idx + 1) % LANG_CYCLE_ORDER.length];
    } else {
      state.lang = btn.getAttribute("data-lang");
    }
    localStorage.setItem(LANG_KEY, state.lang);
    render();
  });

  // Hidden power-user commands typed straight into the search box — deliberately
  // undocumented in the UI (no placeholder hint, no menu), matched on exact text.
  function resetSearchInputUI(){
    searchInput.value = "";
    searchClear.classList.remove("show");
    state.searchQuery = "";
    updateSearchInlineCount("");
    closeSearchSuggest();
  }
  // Data-driven list of hidden "/" commands. Each entry powers both the
  // execution below AND the live "/" preview dropdown (see renderCommandSuggest
  // in 08-render-browse-columns.js), so the description shown to the user and
  // the actual behavior can never drift apart. Descriptions are looked up via
  // t(descKey) at render time so they follow the current UI language.
  var HIDDEN_COMMANDS = [
    { cmd: "/Export", descKey: "cmdExportDesc", action: function(){
        exportJSON();
      } },
    { cmd: "/Import", descKey: "cmdImportDesc", action: function(){
        document.getElementById("importFileInput").click();
      } },
    { cmd: "/Clear tricks", descKey: "cmdClearTricksDesc", action: function(){
        db.tricks = [];
        saveDB();
        state.detailTrickId = null;
        closeDrawer();
        render();
        showToast(t("deletedTrick"));
      } },
    { cmd: "/Clear all", descKey: "cmdClearAllDesc", action: function(){
        db.categories = []; db.tricks = [];
        saveDB();
        state.path = []; state.detailTrickId = null;
        closeDrawer();
        render();
        showToast(t("deletedCategory"));
      } },
    { cmd: "/Reset", descKey: "cmdResetDesc", action: function(){
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(SPACE_KEY);
        db = loadDB();
        state.activeSpace = db.spaces[0].id;
        state.path = []; state.detailTrickId = null;
        closeDrawer();
        render();
        showToast(t("importSuccess"));
      } }
  ];

  function runHiddenCommand(raw){
    var cmd = raw.trim();
    var match = null;
    for(var i=0; i<HIDDEN_COMMANDS.length; i++){
      if(HIDDEN_COMMANDS[i].cmd === cmd){ match = HIDDEN_COMMANDS[i]; break; }
    }
    if(!match) return false;
    resetSearchInputUI();
    match.action();
    return true;
  }

  var searchInput = document.getElementById("searchInput");
  var searchClear = document.getElementById("searchClear");
  var searchSuggest = document.getElementById("searchSuggest");
  var searchWrap = document.querySelector(".search-wrap");
  var topbarEl = document.querySelector(".topbar");

  // Collapsed mobile search bar: tapping the icon-only bar expands it into a
  // full-width overlay for typing; it collapses back once empty and blurred.
  // A no-op above the mobile breakpoint (the CSS these classes drive only
  // has an effect inside that media query).
  function expandMobileSearch(){
    if(!isNarrowViewport()) return;
    searchWrap.classList.add("search-expanded");
    topbarEl.classList.add("search-mode");
  }
  function collapseMobileSearchIfEmpty(){
    if(!isNarrowViewport()) return;
    if(searchInput.value) return;
    searchWrap.classList.remove("search-expanded");
    topbarEl.classList.remove("search-mode");
  }
  searchWrap.addEventListener("click", function(){
    if(!isNarrowViewport()) return;
    if(searchWrap.classList.contains("search-expanded")) return;
    expandMobileSearch();
    searchInput.focus();
  });

  searchInput.addEventListener("input", function(){
    var raw = searchInput.value;
    searchClear.classList.toggle("show", raw.length>0);

    // Hidden power-user commands only fire on Enter (see keydown handler below);
    // while the user is typing one, don't run a live trick search — but do show
    // the matching command(s) with their descriptions in the suggest dropdown.
    if(raw.trim().charAt(0) === "/"){
      updateSearchInlineCount("");
      renderSearchSuggest(raw);
      return;
    }

    // Everything else searches live, Google-style — no Enter required. The
    // miller-column view underneath is left exactly as it was; only the small
    // result count and the suggestion dropdown update.
    state.searchQuery = raw;
    updateSearchInlineCount(raw);
    renderSearchSuggest(raw);
  });
  searchInput.addEventListener("keydown", function(ev){
    if(ev.key !== "Enter") return;
    if(runHiddenCommand(searchInput.value)) return;
    closeSearchSuggest();
  });
  searchInput.addEventListener("blur", function(){
    // Let mousedown on a suggestion row register before the dropdown disappears.
    setTimeout(function(){
      closeSearchSuggest();
      collapseMobileSearchIfEmpty();
    }, 120);
  });
  searchInput.addEventListener("focus", function(){
    renderSearchSuggest(searchInput.value);
  });
  searchClear.addEventListener("click", function(){
    searchInput.value = "";
    searchClear.classList.remove("show");
    state.searchQuery = "";
    updateSearchInlineCount("");
    closeSearchSuggest();
    searchInput.focus();
  });

  document.getElementById("importFileInput").addEventListener("change", function(ev){
    var file = ev.target.files && ev.target.files[0];
    if(file) importJSONFile(file);
    ev.target.value = "";
  });

  // Category modal
  document.getElementById("catCancelBtn").addEventListener("click", closeCategoryModal);
  document.getElementById("catSaveBtn").addEventListener("click", saveCategoryFromModal);
  document.getElementById("catDeleteBtn").addEventListener("click", function(){ requestDeleteCategory(state.editingCategoryId); });
  // (No overlay-click-to-close here — a stray click outside the modal while
  // filling in a category shouldn't discard the edit in progress. Cancel
  // button / Escape are the deliberate ways out.)
  document.getElementById("iconColorPreviewBtn").addEventListener("click", function(){ openIconPicker("category"); });

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

  // Trick modal
  document.getElementById("trickIconColorPreviewBtn").addEventListener("click", function(){ openIconPicker("trick"); });
  document.getElementById("trickCancelBtn").addEventListener("click", closeTrickModal);
  document.getElementById("trickSaveBtn").addEventListener("click", saveTrickFromModal);
  document.getElementById("trickDeleteBtn").addEventListener("click", function(){ requestDeleteTrick(state.editingTrickId); });
  // (No overlay-click-to-close — see the category modal comment above.)

  // Practice settings modal (target reps / daily reset — the daily-practice
  // row's own "二級介面")
  document.getElementById("practiceSettingsCancelBtn").addEventListener("click", closePracticeSettingsModal);
  document.getElementById("practiceSettingsSaveBtn").addEventListener("click", savePracticeSettingsFromModal);
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
  bindEnterToSave("trickModalOverlay", saveTrickFromModal);
  bindEnterToSave("mediaModalOverlay", saveMediaFromModal);
  bindEnterToSave("spaceModalOverlay", saveSpaceFromModal);
  bindEnterToSave("practiceSettingsOverlay", savePracticeSettingsFromModal);

  // Escape key closes topmost overlay
  document.addEventListener("keydown", function(ev){
    if(ev.key !== "Escape") return;
    if(document.getElementById("searchSuggest").classList.contains("show")) return closeSearchSuggest();
    if(searchWrap.classList.contains("search-expanded")){ searchInput.blur(); return collapseMobileSearchIfEmpty(); }
    if(document.getElementById("videoModalOverlay").classList.contains("show")) return closeVideoModal();
    if(document.getElementById("practiceSettingsOverlay").classList.contains("show")) return closePracticeSettingsModal();
    if(document.getElementById("mediaModalOverlay").classList.contains("show")) return closeMediaModal();
    if(document.getElementById("spaceModalOverlay").classList.contains("show")) return closeSpaceModal();
    if(document.getElementById("confirmOverlay").classList.contains("show")) return closeConfirm();
    if(document.getElementById("iconPickerOverlay").classList.contains("show")) return closeIconPicker();
    if(document.getElementById("trickModalOverlay").classList.contains("show")) return closeTrickModal();
    if(document.getElementById("categoryModalOverlay").classList.contains("show")) return closeCategoryModal();
    if(document.getElementById("detailDrawer").classList.contains("show")) return closeDrawer();
  });

  window.addEventListener("resize", function(){ render(); });

  /* ============================================================
     INIT
  ============================================================ */
  render();
