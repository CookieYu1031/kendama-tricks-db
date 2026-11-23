"use strict";

  /* ============================================================
     BROWSE — modal-open check (swipe-back handle lives in js/27)
  ============================================================ */
  function browseModalOpen(){
    return !!document.querySelector(".modal-overlay.show");
  }
