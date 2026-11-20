"use strict";

  /* ============================================================
     SPACE MODAL (Add / Edit / Delete a leftmost-rail shelf)
  ============================================================ */
  addStrings({
    zh:{ spaceLimitReached:"自訂表格已達 26 個上限", spaceCodeLabel:"表格代碼", confirmDeleteSpaceBody:"此表格內的所有分類、資訊與僅存在於此的招式都會被刪除，此動作無法復原。" },
    jp:{ spaceLimitReached:"カスタム表は26個までです", spaceCodeLabel:"表コード", confirmDeleteSpaceBody:"この表内のカテゴリ・情報・ここにだけある技はすべて削除されます。元に戻せません。" },
    en:{ spaceLimitReached:"Custom tables are limited to 26", spaceCodeLabel:"Table code", confirmDeleteSpaceBody:"Every folder, info item and trick that exists only in this table will be deleted. This cannot be undone." }
  });

  function openSpaceModal(spaceId){
    state.editingSpaceId = spaceId || null;
    document.getElementById("spaceFormError").classList.remove("show");
    document.getElementById("spaceModalTitle").textContent = spaceId ? t("editSpace") : t("newSpace");
    document.getElementById("spaceDeleteBtn").hidden = !spaceId || db.spaces.length <= 1 || isUndeletableSpace(spaceId);
    var codeField = document.getElementById("spaceCodeField");
    var codeInput = document.getElementById("spaceCode");
    var shownSpace = spaceId ? getSpace(spaceId) : null;
    var shownCode = shownSpace ? shownSpace.code : allocSpaceCode();
    codeField.hidden = !shownCode;
    codeInput.value = shownCode || "";
    if(spaceId){
      var sp = shownSpace;
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
      var newSpace = createSpace({ icon: state.spaceDraftIcon || "🗂️", name:{ zh:zh, jp:jp, en:en } });
      if(!newSpace){
        closeSpaceModal();
        showToast(t("spaceLimitReached"), "error");
        return;
      }
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
      var fallbackId = "t00";
      // Everything inside the deleted table goes with it (tricks lose that placement).
      var gone = db.categories.filter(function(c){ return c.spaceId === spaceId; }).map(function(c){ return c.id; });
      db.categories = db.categories.filter(function(c){ return c.spaceId !== spaceId; });
      db.infos = (db.infos || []).filter(function(n){ return n.spaceId !== spaceId; });
      var rootIds = gone.concat([spaceId]);
      db.tricks.slice().forEach(function(tr){
        rootIds.forEach(function(cid){ if(tr.categoryIds.indexOf(cid) !== -1) removeTrickPlacement(tr.id, cid); });
      });
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

