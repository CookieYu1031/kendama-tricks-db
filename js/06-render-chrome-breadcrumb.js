"use strict";

  /* ============================================================
     RENDER: TOPBAR / LANG / EDIT TOGGLE
  ============================================================ */
  function renderChrome(){
    document.getElementById("brandTitle").textContent = t("appTitle");
    document.title = t("appTitle") + " · Kendama Trick DB";
    document.getElementById("searchInput").placeholder = t("searchPlaceholder");
    document.getElementById("iconColorFieldLabel").textContent = t("iconColorLabel");

    Array.prototype.forEach.call(document.querySelectorAll(".lang-btn"), function(btn){
      if(btn.hasAttribute("data-lang")) btn.classList.toggle("active", btn.getAttribute("data-lang")===state.lang);
    });

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
    setText("catParentLabel", t("parentCategory"));
    setPlaceholder("catZh", eg + t("categoryEgZh"));
    setPlaceholder("catJp", eg + t("categoryEgJp"));
    setText("catCancelBtn", t("cancel"));
    setText("catSaveBtn", t("save"));
    setText("catDeleteBtn", t("deleteCategory"));

    setText("trickIconColorFieldLabel", t("iconColorLabel"));
    setText("trickNameZhLabel", t("categoryNameZh"), true);
    setText("trickNameJpLabel", t("categoryNameJp"));
    setText("trickNameEnLabel", t("categoryNameEn"));
    setText("trickModalSub", t("trickModalSub"));
    setPlaceholder("trickZh", eg + t("trickCatEgZh"));
    setPlaceholder("trickJp", eg + t("trickCatEgJp"));
    setText("trickCancelBtn", t("cancel"));
    setText("trickSaveBtn", t("save"));
    setText("trickDeleteBtn", t("deleteTrick"));

    setText("confirmCancelBtn", t("cancel"));
    setText("confirmOkBtn", t("confirm"));

    setText("mediaNameLabel", t("mediaNameLabel"));
    setPlaceholder("mediaName", t("mediaNamePlaceholder"));
    setText("mediaUrlLabel", t("mediaUrlLabel"));
    setText("mediaCancelBtn", t("cancel"));
    setText("mediaSaveBtn", t("save"));
    setText("mediaDeleteBtn", t("delete"));

    setText("spaceIconFieldLabel", t("iconColorLabel"));
    setText("spaceNameZhLabel", t("categoryNameZh"), true);
    setText("spaceNameJpLabel", t("categoryNameJp"));
    setText("spaceNameEnLabel", t("categoryNameEn"));
    setText("spaceCancelBtn", t("cancel"));
    setText("spaceSaveBtn", t("save"));
    setText("spaceDeleteBtn", t("deleteSpace"));

    function setText(id, val, hasReq){
      var el = document.getElementById(id);
      if(!el) return;
      el.innerHTML = escapeHtml(val) + (hasReq ? ' <span class="req">*</span>' : "");
    }
    function setPlaceholder(id, val){
      var el = document.getElementById(id);
      if(el) el.placeholder = val;
    }
  }

