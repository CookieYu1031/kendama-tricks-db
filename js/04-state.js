"use strict";

  /* ============================================================
     STATE
  ============================================================ */
  var state = {
    lang: localStorage.getItem(LANG_KEY) || "zh",
    activeSpace: localStorage.getItem(SPACE_KEY) || db.spaces[0].id,
    editMode: false,
    path: [],            // array of category ids (drill-down chain)
    searchQuery: "",
    detailTrickId: null,
    detailDrawerExpanded: false, // mobile bottom-sheet: false = peek (name only), true = swiped up to full detail
    editingCategoryId: null,   // set when category modal is in "edit" mode
    editingCategoryParentHint: null, // parent to preselect when adding new
    editingTrickId: null,
    confirmAction: null,
    categoryDraftIcon: "",
    categoryDraftColor: "default",
    trickDraftIcon: "",
    trickDraftColor: "",
    iconPickerTarget: "category",
    editingSpaceId: null,
    spaceDraftIcon: "",
    spaceDraftColor: "default",
    editingMediaId: null,
    editingMediaTrickId: null
  };

