"use strict";

  /* ============================================================
     STATE
  ============================================================ */
  // 03-i18n.js loads after 02, so the data-model strings (02) are registered here.
  if(typeof addStrings === "function" && typeof DATA_MODEL_STRINGS !== "undefined") addStrings(DATA_MODEL_STRINGS);

  var state = {
    lang: localStorage.getItem(LANG_KEY) || "zh",
    activeSpace: (function(){
      var saved = localStorage.getItem(SPACE_KEY);
      return db.spaces.some(function(s){ return s.id === saved; }) ? saved : "t00";
    })(),
    editMode: false,
    path: [],            // array of category ids (drill-down chain)
    searchQuery: "",
    detailTrickId: null,
    editingCategoryId: null,   // set when category modal is in "edit" mode
    editingCategoryParentHint: null, // parent of a new folder (the column it is created in)
    confirmAction: null,
    categoryDraftIcon: "",
    categoryDraftColor: "default",
    iconPickerTarget: "category",
    editingSpaceId: null,
    spaceDraftIcon: "",
    spaceDraftColor: "default",
    editingMediaId: null,
    editingMediaTrickId: null
  };

