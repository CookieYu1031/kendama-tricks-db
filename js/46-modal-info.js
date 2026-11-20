"use strict";

  /* ============================================================
     INFO MODAL (read view for info items; add / edit / delete in edit mode)
  ============================================================ */
  addStrings({
    zh:{ addInfoShort:"資訊", newInfo:"新增資訊", editInfo:"編輯資訊", infoContentLabel:"內容",
         infoTitleRequired:"請至少輸入一個標題", savedInfo:"資訊已儲存", deletedInfo:"資訊已刪除", deleteInfo:"刪除資訊", closeBtn:"關閉",
         confirmDeleteInfoTitle:"確認刪除此資訊？", confirmDeleteInfoBody:"此資訊將被永久刪除。", noInfoContent:"（沒有內容）" },
    jp:{ addInfoShort:"情報", newInfo:"情報を追加", editInfo:"情報を編集", infoContentLabel:"内容",
         infoTitleRequired:"タイトルを1つ以上入力してください", savedInfo:"情報を保存しました", deletedInfo:"情報を削除しました", deleteInfo:"情報を削除", closeBtn:"閉じる",
         confirmDeleteInfoTitle:"この情報を削除しますか？", confirmDeleteInfoBody:"この情報は完全に削除されます。", noInfoContent:"（内容なし）" },
    en:{ addInfoShort:"Info", newInfo:"New info", editInfo:"Edit info", infoContentLabel:"Content",
         infoTitleRequired:"Enter at least one title", savedInfo:"Info saved", deletedInfo:"Info deleted", deleteInfo:"Delete info", closeBtn:"Close",
         confirmDeleteInfoTitle:"Delete this info?", confirmDeleteInfoBody:"This info item will be permanently deleted.", noInfoContent:"(No content)" }
  });

  var infoModalState = { id: null, parentId: null };

  function setInfoModalMode(edit){
    document.getElementById("infoViewBody").hidden = edit;
    document.getElementById("infoEditBody").hidden = !edit;
    document.getElementById("infoSaveBtn").hidden = !edit;
    document.getElementById("infoEditBtn").hidden = edit || !infoModalState.canEdit;
    document.getElementById("infoDeleteBtn").hidden = !infoModalState.id || !infoModalState.canEdit;
    document.getElementById("infoCancelBtn").textContent = edit ? t("cancel") : t("closeBtn");
  }

  // infoId null = new item under parentHint (null = table root). edit=false -> read view.
  function openInfoModal(infoId, parentHint, edit){
    var info = infoId ? getInfo(infoId) : null;
    if(infoId && !info) return;
    infoModalState.id = infoId || null;
    infoModalState.parentId = parentHint === undefined ? null : parentHint;
    infoModalState.canEdit = !!(info && state.editMode && canModifyItem({ type:"info", ref: info }, infoModalState.parentId, isAdminNow()));
    document.getElementById("infoFormError").classList.remove("show");
    document.getElementById("infoEditBtn").textContent = t("editInfo");
    document.getElementById("infoSaveBtn").textContent = t("save");
    document.getElementById("infoDeleteBtn").textContent = t("deleteInfo");
    document.getElementById("infoNameZhLabel").textContent = t("categoryNameZh");
    document.getElementById("infoNameJpLabel").textContent = t("categoryNameJp");
    document.getElementById("infoNameEnLabel").textContent = t("categoryNameEn");
    document.getElementById("infoContentLabel").textContent = t("infoContentLabel");
    var isEdit = !info || !!edit;
    if(info){
      document.getElementById("infoModalTitle").textContent = localize(info.title) || t("editInfo");
      var contentEl = document.getElementById("infoViewContent");
      contentEl.textContent = info.content || t("noInfoContent");
      document.getElementById("infoZh").value = info.title.zh || "";
      document.getElementById("infoJp").value = info.title.jp || "";
      document.getElementById("infoEn").value = info.title.en || "";
      document.getElementById("infoContent").value = info.content || "";
    } else {
      document.getElementById("infoModalTitle").textContent = t("newInfo");
      document.getElementById("infoZh").value = "";
      document.getElementById("infoJp").value = "";
      document.getElementById("infoEn").value = "";
      document.getElementById("infoContent").value = "";
    }
    if(info && edit){ infoModalState.canEdit = true; document.getElementById("infoModalTitle").textContent = t("editInfo"); }
    setInfoModalMode(isEdit);
    document.getElementById("infoModalOverlay").classList.add("show");
    if(isEdit) setTimeout(function(){ document.getElementById("infoZh").focus(); }, 80);
  }
  function closeInfoModal(){
    document.getElementById("infoModalOverlay").classList.remove("show");
    infoModalState.id = null;
  }

  function saveInfoFromModal(){
    var title = {
      zh: document.getElementById("infoZh").value.trim(),
      jp: document.getElementById("infoJp").value.trim(),
      en: document.getElementById("infoEn").value.trim()
    };
    var content = document.getElementById("infoContent").value;
    if(!title.zh && !title.jp && !title.en){
      document.getElementById("infoFormError").textContent = t("infoTitleRequired");
      document.getElementById("infoFormError").classList.add("show");
      return;
    }
    if(infoModalState.id){
      var info = getInfo(infoModalState.id);
      if(!info) return closeInfoModal();
      info.title = title; info.content = content;
    } else {
      if(!canAddChild(infoModalState.parentId, "info")) return closeInfoModal();
      if(!db.infos) db.infos = [];
      db.infos.push({ id: newItemId(), parentId: infoModalState.parentId, spaceId: state.activeSpace, title: title, content: content,
        order: getInfosIn(infoModalState.parentId).length, icon: "", color: "default" });
    }
    saveDB();
    closeInfoModal();
    showToast(t("savedInfo"));
    render();
  }

  function requestDeleteInfo(infoId){
    if(!getInfo(infoId)) return;
    openConfirm(t("confirmDeleteInfoTitle"), t("confirmDeleteInfoBody"), function(){
      db.infos = (db.infos || []).filter(function(n){ return n.id !== infoId; });
      saveDB();
      closeInfoModal();
      showToast(t("deletedInfo"));
      render();
    });
  }
