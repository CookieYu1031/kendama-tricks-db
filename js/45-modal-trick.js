"use strict";

  /* ============================================================
     TRICK MODAL (Add / Edit)
  ============================================================ */
  function renderTrickCatPicker(selectedIds, excludeIds){
    var picker = document.getElementById("trickCatPicker");
    picker.innerHTML = "";
    var flat = flattenContainersForPicker(excludeIds);
    if(flat.length === 0){
      picker.innerHTML = '<div class="cat-tree-empty">' + escapeHtml(t("noSubItems")) + '</div>';
      return;
    }
    flat.forEach(function(row){
      var label = document.createElement("label");
      label.className = "cat-tree-item";
      var cb = document.createElement("input");
      cb.type = "checkbox";
      cb.value = row.id;
      cb.checked = selectedIds.indexOf(row.id) !== -1;
      var span = document.createElement("span");
      var prefix = row.depth>0 ? "\u2003".repeat(row.depth) + "\u2514 " : "";
      var marker = row.type==="trick" ? "\u25B6 " : (row.ref.icon ? row.ref.icon + " " : "");
      span.textContent = prefix + marker + row.name;
      label.appendChild(cb); label.appendChild(span);
      picker.appendChild(label);
    });
  }

  function openTrickModal(trickId, categoryHint){
    state.editingTrickId = trickId;
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
      selectedIds = categoryHint ? [categoryHint] : [];
      state.trickDraftIcon = "";
      state.trickDraftColor = "default";
    }
    updateIconColorPreview("trick");
    renderTrickCatPicker(selectedIds, excludeIds);

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
      db.tricks.push({ id: uid("trick"), name:{ zh:zh, jp:jp, en:en }, media: [], categoryIds: checked, orderByCategory: {}, order: db.tricks.length, icon: state.trickDraftIcon, color: state.trickDraftColor });
    }
    saveDB();
    closeTrickModal();
    showToast(t("savedTrick"));
    render();
  }

  function requestDeleteTrick(trickId){
    openConfirm(t("confirmDeleteTrickTitle"), t("confirmDeleteTrickBody"), function(){
      // A trick-folder can hold sub-categories directly now, so deleting it must
      // also remove any sub-categories nested under it (and their own
      // descendants) — otherwise they're left with a parentId pointing at
      // nothing and become permanently unreachable clutter in storage. This
      // mirrors the same cleanup requestDeleteCategory() already does for its
      // own subtree; extension *tricks* inside that subtree are only detached
      // (not deleted), consistent with how deleting a category already treats
      // the tricks inside it.
      var orphanedCatIds = getChildren(trickId).reduce(function(acc, c){
        return acc.concat(getDescendantCategoryIds(c.id));
      }, []);
      if(orphanedCatIds.length){
        db.categories = db.categories.filter(function(c){ return orphanedCatIds.indexOf(c.id) === -1; });
        db.tricks.forEach(function(tr){
          tr.categoryIds = tr.categoryIds.filter(function(cid){ return orphanedCatIds.indexOf(cid) === -1; });
          orphanedCatIds.forEach(function(cid){ delete tr.orderByCategory[cid]; });
        });
        var cutIdx = state.path.findIndex(function(id){ return orphanedCatIds.indexOf(id) !== -1; });
        if(cutIdx !== -1) state.path = state.path.slice(0, cutIdx);
      }
      db.tricks = db.tricks.filter(function(t){ return t.id !== trickId; });
      if(state.detailTrickId === trickId) closeDrawer();
      saveDB();
      closeTrickModal();
      showToast(t("deletedTrick"));
      render();
    });
  }

