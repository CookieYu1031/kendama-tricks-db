"use strict";

  /* ============================================================
     BROWSE — "up one level" helper (swipe-back handle lives in js/27)
  ============================================================ */
  // Shared "up one level" used by the swipe-back handle (js/27). Returns true if it did something.
  function browseGoUp(){
    if(state.detailTrickId && typeof closeDrawer === "function"){ closeDrawer(); return true; }
    if(!state.path.length) return false;
    state.path = state.path.slice(0, state.path.length - 1);
    render(RENDER_COLUMNS_ONLY);
    return true;
  }

  function browseModalOpen(){
    return !!document.querySelector(".modal-overlay.show");
  }
