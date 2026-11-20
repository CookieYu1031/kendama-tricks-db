"use strict";

  /* ============================================================
     SPACE MODAL (Add / Edit / Delete a leftmost-rail shelf)
  ============================================================ */
  function openSpaceModal(spaceId){
    state.editingSpaceId = spaceId || null;
    document.getElementById("spaceFormError").classList.remove("show");
    document.getElementById("spaceModalTitle").textContent = spaceId ? t("editSpace") : t("newSpace");
    document.getElementById("spaceDeleteBtn").hidden = !spaceId || db.spaces.length <= 1 || isUndeletableSpace(spaceId);
    if(spaceId){
      var sp = getSpace(spaceId);
      document.getElementById("spaceZh").value = sp.name.zh || "";
      document.getElementById("spaceJp").value = sp.name.jp || "";
      document.getElementById("spaceEn").value = sp.name.en || "";
      state.spaceDraftIcon = sp.icon || "";
    } else {
      document.getElementById("spaceZh").value = "";
      document.getElementById("spaceJp").value = "";
      document.getElementById("spaceEn").value = "";
      state.spaceDraftIcon = "🗂️";
    }
    state.spaceDraftColor = "default";
    updateIconColorPreview("space");
    document.getElementById("spaceModalOverlay").classList.add("show");
    setTimeout(function(){ document.getElementById("spaceZh").focus(); }, 80);
  }
  function closeSpaceModal(){
    document.getElementById("spaceModalOverlay").classList.remove("show");
    state.editingSpaceId = null;
  }
  function saveSpaceFromModal(){
    var zh = document.getElementById("spaceZh").value.trim();
    var jp = document.getElementById("spaceJp").value.trim();
    var en = document.getElementById("spaceEn").value.trim();
    if(!zh){
      document.getElementById("spaceFormError").textContent = t("categoryNameRequired");
      document.getElementById("spaceFormError").classList.add("show");
      return;
    }
    if(state.editingSpaceId){
      var sp = getSpace(state.editingSpaceId);
      sp.name = { zh:zh, jp:jp, en:en };
      sp.icon = state.spaceDraftIcon || "🗂️";
    } else {
      var newSpace = { id: uid("space"), icon: state.spaceDraftIcon || "🗂️", name:{ zh:zh, jp:jp, en:en }, order: db.spaces.length, viewMode: "tree" };
      db.spaces.push(newSpace);
      state.activeSpace = newSpace.id;
      localStorage.setItem(SPACE_KEY, newSpace.id);
    }
    saveDB();
    closeSpaceModal();
    showToast(t("savedCategory"));
    render();
  }
  function requestDeleteSpace(spaceId){
    if(db.spaces.length <= 1 || isUndeletableSpace(spaceId)) return;
    openConfirm(t("confirmDeleteSpaceTitle"), t("confirmDeleteSpaceBody"), function(){
      db.spaces = db.spaces.filter(function(s){ return s.id !== spaceId; });
      var fallbackId = db.spaces[0].id;
      db.categories.forEach(function(c){ if(c.spaceId === spaceId) c.spaceId = fallbackId; });
      if(state.activeSpace === spaceId){
        state.activeSpace = fallbackId;
        localStorage.setItem(SPACE_KEY, fallbackId);
        state.path = []; state.detailTrickId = null;
        closeDrawer();
      }
      saveDB();
      closeSpaceModal();
      showToast(t("deletedCategory"));
      render();
    });
  }

