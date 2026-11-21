"use strict";

  /* ============================================================
     MEDIA MODAL (Add / Edit a video under a trick — notes are edited
     directly in the drawer, this modal is video-only; max MAX_VIDEOS per trick)
  ============================================================ */
  function openMediaModal(trickId, mediaId){
    state.editingMediaTrickId = trickId;
    state.editingMediaId = mediaId || null;
    var tr = getTrick(trickId);
    if(!tr) return;
    document.getElementById("mediaFormError").classList.remove("show");
    document.getElementById("mediaDeleteBtn").hidden = !mediaId;
    if(!mediaId && (tr.media||[]).length >= MAX_VIDEOS) return; // B9: at most MAX_VIDEOS videos
    var item = mediaId ? (tr.media||[]).find(function(m){ return m.id===mediaId; }) : null;
    document.getElementById("mediaModalTitle").textContent = mediaId ? t("editMedia") : t("addMedia");
    // Title label/placeholder set here (the language pass in js/10 only knows the old "name" strings).
    document.getElementById("mediaNameLabel").textContent = t("videoTitleLabel");
    document.getElementById("mediaName").placeholder = t("videoTitlePlaceholder");
    document.getElementById("mediaName").value = item ? (item.title||"") : "";
    document.getElementById("mediaUrl").value = item ? (item.url||"") : "";
    document.getElementById("mediaModalOverlay").classList.add("show");
    setTimeout(function(){ document.getElementById("mediaUrl").focus(); }, 80);
  }
  function closeMediaModal(){
    document.getElementById("mediaModalOverlay").classList.remove("show");
    state.editingMediaId = null;
    state.editingMediaTrickId = null;
  }
  function saveMediaFromModal(){
    var tr = getTrick(state.editingMediaTrickId);
    if(!tr) return closeMediaModal();
    var name = document.getElementById("mediaName").value.trim();
    var url = document.getElementById("mediaUrl").value.trim();
    var r = saveDrawerVideo(tr, state.editingMediaId, url, name); // validates URL + title length (never truncates)
    if(r === "full") return closeMediaModal();
    if(r !== "ok"){
      var key = r === "empty" ? "mediaUrlRequired" : r === "titleTooLong" ? "videoTitleTooLong" : "mediaUrlInvalid";
      document.getElementById("mediaFormError").textContent = t(key);
      document.getElementById("mediaFormError").classList.add("show");
      return;
    }
    saveDB();
    closeMediaModal();
    showToast(t("savedTrick"));
    renderDrawer();
  }
  function requestDeleteMedia(trickId, mediaId){
    openConfirm(t("confirmDeleteMediaTitle"), t("confirmDeleteMediaBody"), function(){
      var tr = getTrick(trickId);
      if(tr){ tr.media = (tr.media||[]).filter(function(m){ return m.id !== mediaId; }); saveDB(); }
      closeMediaModal();
      renderDrawer();
      showToast(t("deletedTrick"));
    });
  }

