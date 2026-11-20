"use strict";

  /* ============================================================
     TRICK MODAL (Add / Edit)
  ============================================================ */
  addStrings({
    zh:{ confirmRemoveTrickTitle:"從此處移除此招式？", confirmRemoveTrickBody:"只會移除此招式在這個位置的項目，其他位置不受影響。",
         confirmRemoveTrickLastBody:"這是此招式的最後一個位置，移除後招式本身也會被刪除。", tableRootOption:"（表格根層）",
         confirmDeleteTrickBody:"此招式將自資料庫中永久移除，並從所有位置消失。" },
    jp:{ confirmRemoveTrickTitle:"この場所から技を外しますか？", confirmRemoveTrickBody:"この場所への配置だけを外します。他の場所には影響しません。",
         confirmRemoveTrickLastBody:"これが最後の配置のため、技そのものも削除されます。", tableRootOption:"（表のルート）",
         confirmDeleteTrickBody:"この技はデータベースから完全に削除され、すべての場所から消えます。" },
    en:{ confirmRemoveTrickTitle:"Remove this trick from here?", confirmRemoveTrickBody:"Only its placement in this location is removed; other locations are unaffected.",
         confirmRemoveTrickLastBody:"This is its last location, so the trick itself will be deleted too.", tableRootOption:"(Table root)",
         confirmDeleteTrickBody:"This trick will be permanently deleted and disappear from every location." }
  });

  // Ids shown in the picker (placements outside it, e.g. in another table, are kept on save)
  // and whether the trick being created is a user trick (custom:true).
  var trickPickerIds = [];
  var trickModalCustom = false;

  // Rows: the active table's root (not for 收藏), then every folder / trick container.
  // Containers that can't take another trick (level limit) are disabled.
  function renderTrickCatPicker(selectedIds, excludeIds, movingTrickId){
    var picker = document.getElementById("trickCatPicker");
    picker.innerHTML = "";
    trickPickerIds = [];
    var rows = [];
    if(state.activeSpace !== FAV_TABLE_ID){
      rows.push({ id: state.activeSpace, depth:0, name: t("tableRootOption"), type:"root", ref:{} });
    }
    flattenContainersForPicker(excludeIds).forEach(function(row){
      if(row.id === FAV_STARRED_ID) return;
      rows.push(row);
    });
    if(rows.length === 0){
      picker.innerHTML = '<div class="cat-tree-empty">' + escapeHtml(t("noSubItems")) + '</div>';
      return;
    }
    rows.forEach(function(row){
      var label = document.createElement("label");
      label.className = "cat-tree-item";
      var cb = document.createElement("input");
      cb.type = "checkbox";
      cb.value = row.id;
      cb.checked = selectedIds.indexOf(row.id) !== -1;
      var fits = canAddChild(row.id, "trick") && (!movingTrickId || subtreeFits(movingTrickId, "trick", levelOf(row.id) + 1));
      if(!fits && !cb.checked) cb.disabled = true;
      var span = document.createElement("span");
      var prefix = row.depth>0 ? " ".repeat(row.depth) + "└ " : "";
      var marker = row.type==="trick" ? "▶ " : (row.ref.icon ? row.ref.icon + " " : "");
      span.textContent = prefix + marker + row.name;
      label.appendChild(cb); label.appendChild(span);
      picker.appendChild(label);
      trickPickerIds.push(row.id);
    });
  }

  function openTrickModal(trickId, categoryHint, opts){
    state.editingTrickId = trickId;
    trickModalCustom = !!(opts && opts.custom);
    var overlay = document.getElementById("trickModalOverlay");
    document.getElementById("trickFormError").classList.remove("show");
    document.getElementById("trickDeleteBtn").hidden = !trickId;
    document.getElementById("trickCatPickerLabel").innerHTML = escapeHtml(t("belongsToPicker")) + ' <span class="req">*</span>';

    var selectedIds = [];
    var excludeIds = [];
    if(trickId){
      var tr = getTrick(trickId);
      document.getElementById("trickModalTitle").textContent = localize(tr.name) || t("editTrick");
      document.getElementById("trickZh").value = tr.name.zh || "";
      document.getElementById("trickJp").value = tr.name.jp || "";
      document.getElementById("trickEn").value = tr.name.en || "";
      selectedIds = tr.categoryIds.slice();
      excludeIds = getDescendantContainerIds(trickId); // can't nest a trick under itself or its own variants
      state.trickDraftIcon = tr.icon || "";
      state.trickDraftColor = tr.color || "";
    } else {
      document.getElementById("trickModalTitle").textContent = t("newTrick");
      document.getElementById("trickZh").value = "";
      document.getElementById("trickJp").value = "";
      document.getElementById("trickEn").value = "";
      selectedIds = [categoryHint || state.activeSpace];
      state.trickDraftIcon = "";
      state.trickDraftColor = "default";
    }
    updateIconColorPreview("trick");
    renderTrickCatPicker(selectedIds, excludeIds, trickId);

    overlay.classList.add("show");
    setTimeout(function(){ document.getElementById("trickZh").focus(); }, 80);
  }
  function closeTrickModal(){
    document.getElementById("trickModalOverlay").classList.remove("show");
    state.editingTrickId = null;
  }

  function saveTrickFromModal(){
    var zh = document.getElementById("trickZh").value.trim();
    var jp = document.getElementById("trickJp").value.trim();
    var en = document.getElementById("trickEn").value.trim();
    var checked = Array.prototype.slice.call(document.querySelectorAll("#trickCatPicker input:checked")).map(function(cb){ return cb.value; });

    // placements the picker doesn't show (other tables) stay as they are
    var hidden = state.editingTrickId ? getTrick(state.editingTrickId).categoryIds.filter(function(cid){ return trickPickerIds.indexOf(cid) === -1; }) : [];
    checked = checked.concat(hidden);

    if((!zh && !jp && !en) || checked.length===0){
      document.getElementById("trickFormError").textContent = t("trickFormError");
      document.getElementById("trickFormError").classList.add("show");
      return;
    }

    if(state.editingTrickId){
      var tr = getTrick(state.editingTrickId);
      tr.name = { zh:zh, jp:jp, en:en };
      tr.categoryIds = checked;
      tr.icon = state.trickDraftIcon;
      tr.color = state.trickDraftColor;
      // Prune per-category order entries for categories that are no longer assigned;
      // newly assigned categories simply have no entry yet, so they fall to the end
      // of that category's list until manually reordered (see getItemOrderValue).
      var prunedOrder = {};
      checked.forEach(function(cid){
        if(typeof tr.orderByCategory[cid] === "number") prunedOrder[cid] = tr.orderByCategory[cid];
      });
      tr.orderByCategory = prunedOrder;
    } else {
      db.tricks.push(normalizeDB({ categories: [], tricks: [{ id: newItemId(), name:{ zh:zh, jp:jp, en:en }, media: [], categoryIds: checked, orderByCategory: {}, order: db.tricks.length, icon: state.trickDraftIcon, color: state.trickDraftColor, custom: trickModalCustom }] }).tricks[0]);
    }
    saveDB();
    closeTrickModal();
    showToast(t("savedTrick"));
    render();
  }

  // containerId: the column's container (null = table root) -> only that placement is removed;
  // "*" / omitted (edit modal, drawer) -> the trick is deleted from everywhere.
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
      closeTrickModal();
      showToast(t("deletedTrick"));
      render();
    });
  }
