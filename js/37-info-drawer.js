"use strict";

  /* ============================================================
     INFO DRAWER (v0.17) — an info item opens in the same #detailDrawer card as a trick
     (same slide animation / close button). View: prefix + title, content, links.
     Edit mode (when allowed): icon / prefix / three titles, content, links, remove.
     Links come from js/38-info-links.js; the title grid builders from js/31.
  ============================================================ */
  addStrings({
    zh: { infoContentLabel:"內容", noInfoContent:"（沒有內容）", savedInfo:"資訊已儲存", deletedInfo:"資訊已刪除",
      confirmDeleteInfoTitle:"確認刪除此資訊？", confirmDeleteInfoBody:"此資訊將被永久刪除。" },
    jp: { infoContentLabel:"内容", noInfoContent:"（内容なし）", savedInfo:"情報を保存しました", deletedInfo:"情報を削除しました",
      confirmDeleteInfoTitle:"この情報を削除しますか？", confirmDeleteInfoBody:"この情報は完全に削除されます。" },
    en: { infoContentLabel:"Content", noInfoContent:"(No content)", savedInfo:"Info saved", deletedInfo:"Info deleted",
      confirmDeleteInfoTitle:"Delete this info?", confirmDeleteInfoBody:"This info item will be permanently deleted." }
  });

  // Opens the drawer on an info item (closes any trick view: the two are exclusive).
  function openInfoDrawer(infoId){
    if(!getInfo(infoId)) return;
    var el = drawerPrepareOpen();
    state.detailTrickId = null;
    state.detailInfoId = infoId;
    state.detailContainerKey = undefined;
    renderColumns();
    renderDrawer();
    el.classList.add("show");
  }

  // May this account edit the open info item right now (edit mode + permission)?
  function infoDrawerCanEdit(info){
    return !!(info && state.editMode && canModifyItem({ type:"info", ref:info }, info.parentId, isAdminNow()));
  }

  function renderInfoDrawer(){
    var drawer = document.getElementById("detailDrawer");
    var info = getInfo(state.detailInfoId);
    if(!info){ closeDrawer(); return; }
    var canEdit = infoDrawerCanEdit(info);

    drawer.innerHTML = "";
    drawer.style.transform = "";
    drawer.style.transition = "";

    var head = document.createElement("div");
    head.className = "drawer-head";
    var headLeft = document.createElement("div");
    headLeft.className = "drawer-head-left";
    var title = document.createElement("div");
    title.className = "drawer-title" + (canEdit ? " single" : "");
    function paintTitle(){ fillDrawerTitle(title, info.title, getCategoryPrefix(info)); }
    paintTitle();
    headLeft.appendChild(title);
    var headActions = document.createElement("div");
    headActions.className = "drawer-head-actions";
    var closeBtn = document.createElement("button");
    closeBtn.className = "drawer-close"; closeBtn.innerHTML = ICON_X;
    closeBtn.addEventListener("click", closeDrawer);
    headActions.appendChild(closeBtn);
    head.appendChild(headLeft); head.appendChild(headActions);

    var body = document.createElement("div");
    body.className = "drawer-body";
    if(canEdit) buildInfoEditBody(info, body, paintTitle);
    else buildInfoViewBody(info, body);

    drawer.appendChild(head);
    drawer.appendChild(body);
    if(canEdit) drawer.appendChild(buildInfoEditFoot(info));
  }

  function buildInfoViewBody(info, body){
    var hasLinks = !!(typeof buildInfoLinkSlots === "function" && (info.links || []).some(function(l){ return l && isSafeHttpUrl(l.url); }));
    if(info.content || !hasLinks){
      var c = document.createElement("div");
      c.className = "info-content";
      c.textContent = info.content || t("noInfoContent");
      body.appendChild(c);
    }
    if(hasLinks) buildInfoLinkSlots(info, false, body);
  }

  function buildInfoEditBody(info, body, paintTitle){
    body.appendChild(buildDrawerNameGrid(info, null, paintTitle, true));
    body.appendChild(makeLabel(t("infoContentLabel")));
    var ta = document.createElement("textarea");
    ta.className = "note-field-input info-content-input";
    ta.rows = 8;
    ta.placeholder = t("mediaContentPlaceholder");
    ta.value = info.content || "";
    ta.addEventListener("input", function(){ info.content = ta.value; saveDB(); });
    body.appendChild(ta);
    if(typeof buildInfoLinkSlots === "function") buildInfoLinkSlots(info, true, body);
  }

  // Edit mode footer: just the remove button (same look as the trick drawer's).
  function buildInfoEditFoot(info){
    var foot = document.createElement("div");
    foot.className = "drawer-foot";
    var delB = document.createElement("button");
    delB.className = "col-add-btn col-add-btn-danger col-add-btn-del";
    delB.innerHTML = removeBtnHtml();
    delB.addEventListener("click", function(){
      if(typeof undoPush === "function") undoPush();
      requestDeleteInfo(info.id);
    });
    foot.appendChild(delB);
    return foot;
  }

  // Confirm, delete, close the drawer if it shows this item, refresh.
  function requestDeleteInfo(infoId){
    if(!getInfo(infoId)) return;
    openConfirm(t("confirmDeleteInfoTitle"), t("confirmDeleteInfoBody"), function(){
      db.infos = (db.infos || []).filter(function(n){ return n.id !== infoId; });
      saveDB();
      if(state.detailInfoId === infoId) closeDrawer();
      showToast(t("deletedInfo"));
      render();
    });
  }
