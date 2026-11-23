"use strict";

  /* ============================================================
     RENDER: TOPBAR / LANG / EDIT TOGGLE
  ============================================================ */
  function renderChrome(){
    document.getElementById("brandTitle").textContent = t("appTitle");
    document.title = t("appTitle") + " · Kendama Trick DB";
    document.getElementById("searchInput").placeholder = t("searchPlaceholder");
    document.getElementById("searchToggleLabel").textContent = t("searchToggle");
    document.getElementById("brandHome").title = t("backHome");
    document.getElementById("iconColorFieldLabel").textContent = t("iconColorLabel");

    Array.prototype.forEach.call(document.querySelectorAll(".lang-btn"), function(btn){
      if(btn.hasAttribute("data-lang")) btn.classList.toggle("active", btn.getAttribute("data-lang")===state.lang);
    });
    if(typeof renderSettingsUI === "function") renderSettingsUI();

    localizeModalStatics();
  }

  // Static labels, placeholders and button captions inside the add/edit modals — these
  // elements live permanently in the DOM (not rebuilt per-render), so they're refreshed
  // here whenever the chrome re-renders (including on every language switch).
  function localizeModalStatics(){
    var eg = t("egPrefix");
    setText("categoryNameZhLabel", t("categoryNameZh"), true);
    setText("categoryNameJpLabel", t("categoryNameJp"));
    setText("categoryNameEnLabel", t("categoryNameEn"));
    setPlaceholder("catZh", eg + t("categoryEgZh"));
    setPlaceholder("catJp", eg + t("categoryEgJp"));
    setText("catCancelBtn", t("cancel"));
    setText("catSaveBtn", t("save"));
    setDel("catDeleteBtn");


    setText("confirmCancelBtn", t("cancel"));
    setText("confirmOkBtn", t("confirm"));

    setText("mediaNameLabel", t("mediaNameLabel"));
    setPlaceholder("mediaName", t("mediaNamePlaceholder"));
    setText("mediaUrlLabel", t("mediaUrlLabel"));
    setText("mediaCancelBtn", t("cancel"));
    setText("mediaSaveBtn", t("save"));
    setDel("mediaDeleteBtn");

    setText("spaceIconFieldLabel", t("iconColorLabel"));
    setText("spaceNameZhLabel", t("categoryNameZh"), true);
    setText("spaceNameJpLabel", t("categoryNameJp"));
    setText("spaceNameEnLabel", t("categoryNameEn"));
    setText("spaceCodeLabel", t("spaceCodeLabel"));
    setText("spaceCancelBtn", t("cancel"));
    setText("spaceSaveBtn", t("save"));
    setDel("spaceDeleteBtn");
    setText("baseUpdateBannerTitle", t("baseUpdateAvailable"));
    setText("baseUpdateNowBtn", t("baseUpdateNow"));
    setText("baseUpdateDismissBtn", t("baseUpdateDismiss"));

    function setText(id, val, hasReq){
      var el = document.getElementById(id);
      if(!el) return;
      el.innerHTML = escapeHtml(val) + (hasReq ? ' <span class="req">*</span>' : "");
    }
    function setDel(id){
      var el = document.getElementById(id);
      if(el) el.innerHTML = removeBtnHtml();
    }
    function setPlaceholder(id, val){
      var el = document.getElementById(id);
      if(el) el.placeholder = val;
    }
  }

