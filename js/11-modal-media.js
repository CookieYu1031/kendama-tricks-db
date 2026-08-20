"use strict";

  /* ============================================================
     MEDIA MODAL (Add / Edit a video under a trick — notes are edited
     directly in the drawer now, this modal is video-only)
  ============================================================ */
  function openMediaModal(trickId, mediaId){
    state.editingMediaTrickId = trickId;
    state.editingMediaId = mediaId || null;
    var tr = getTrick(trickId);
    if(!tr) return;
    document.getElementById("mediaFormError").classList.remove("show");
    document.getElementById("mediaDeleteBtn").hidden = !mediaId;
    var item = mediaId ? (tr.media||[]).find(function(m){ return m.id===mediaId; }) : null;
    document.getElementById("mediaModalTitle").textContent = mediaId ? t("editMedia") : t("addMedia");
    document.getElementById("mediaName").value = item ? (item.title||"") : "";
    document.getElementById("mediaUrl").value = item ? (item.url||"") : "";
    document.getElementById("mediaModalOverlay").classList.add("show");
    setTimeout(function(){ document.getElementById("mediaName").focus(); }, 80);
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

    if(!url){
      document.getElementById("mediaFormError").textContent = t("mediaUrlRequired");
      document.getElementById("mediaFormError").classList.add("show");
      return;
    }

    tr.media = tr.media || [];
    if(state.editingMediaId){
      var existing = tr.media.find(function(m){ return m.id===state.editingMediaId; });
      if(existing){
        existing.title = name;
        existing.type = "video";
        existing.url = url; existing.platform = detectPlatform(url);
        delete existing.content;
      }
    } else {
      tr.media.push({ id: uid("media"), type: "video", title: name, url: url, platform: detectPlatform(url) });
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

