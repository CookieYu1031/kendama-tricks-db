"use strict";

  /* ============================================================
     TRICK DELETE / REMOVE-FROM-PLACE CONFIRM
     (The trick edit modal is gone: the detail drawer edits every field in
     edit mode, js/32-trick-drawer.js; creation goes through js/47-modal-add.js.)
  ============================================================ */
  addStrings({
    zh:{ confirmRemoveTrickTitle:"從此處移除此招式？", confirmRemoveTrickBody:"只會移除此招式在這個位置的項目，其他位置不受影響。",
         confirmRemoveTrickLastBody:"這是此招式的最後一個位置，移除後招式本身也會被刪除。",
         confirmDeleteTrickBody:"此招式將自資料庫中永久移除，並從所有位置消失。" },
    jp:{ confirmRemoveTrickTitle:"この場所から技を外しますか？", confirmRemoveTrickBody:"この場所への配置だけを外します。他の場所には影響しません。",
         confirmRemoveTrickLastBody:"これが最後の配置のため、技そのものも削除されます。",
         confirmDeleteTrickBody:"この技はデータベースから完全に削除され、すべての場所から消えます。" },
    en:{ confirmRemoveTrickTitle:"Remove this trick from here?", confirmRemoveTrickBody:"Only its placement in this location is removed; other locations are unaffected.",
         confirmRemoveTrickLastBody:"This is its last location, so the trick itself will be deleted too.",
         confirmDeleteTrickBody:"This trick will be permanently deleted and disappear from every location." }
  });

  // containerId: the column's container (null = table root) -> only that placement is removed;
  // "*" / omitted (drawer) -> the trick is deleted from everywhere.
  function requestDeleteTrick(trickId, containerId){
    var tr = getTrick(trickId);
    if(!tr) return;
    var all = containerId === "*" || containerId === undefined;
    var cid = containerId === null || containerId === undefined ? state.activeSpace : containerId;
    if(!all && tr.categoryIds.indexOf(cid) === -1) all = true; // virtual placement (e.g. 收藏 > 自訂義)
    var last = all || tr.categoryIds.length <= 1;
    var title = all ? t("confirmDeleteTrickTitle") : t("confirmRemoveTrickTitle");
    var body = all ? t("confirmDeleteTrickBody") : t("confirmRemoveTrickBody") + (last ? " " + t("confirmRemoveTrickLastBody") : "");
    openConfirm(title, body, function(){
      if(all){
        tr.categoryIds.slice().forEach(function(c){ removeTrickPlacement(trickId, c); });
        if(getTrick(trickId)){ db.tricks = db.tricks.filter(function(x){ return x.id !== trickId; }); }
      } else {
        removeTrickPlacement(trickId, cid);
      }
      saveDB();
      if(state.detailTrickId && !getTrick(state.detailTrickId)) closeDrawer();
      showToast(t("deletedTrick"));
      render();
    });
  }
