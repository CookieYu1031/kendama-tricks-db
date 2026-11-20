"use strict";

  /* ============================================================
     SUBMISSION REVIEW MODE (查看投稿模式) — admin only. 企劃書 §四.1.
     Long-press the rail edit toggle (js/12) or use the admin panel button.
     In 總表 the pending submissions show as rows inside their parentId folder,
     with a dot in the submitter's color; every ancestor folder shows the dots too.
     Clicking a row opens a read-only drawer with 收錄 / 不予收錄.
     Uses: 72 (pure helpers), 71 (colors), 21 (row hooks), 32 (renderDrawer hook).
  ============================================================ */
  addStrings({
    zh:{ subReviewOn:"已開啟查看投稿模式", subReviewOff:"已關閉查看投稿模式", subReviewBadge:"查看投稿模式（長按編輯鈕可離開）",
         subBy:"投稿者", subAccept:"收錄", subReject:"不予收錄", subLoadFail:"讀取投稿失敗", subActionFail:"操作失敗，請檢查網路連線",
         subParentMissing:"投稿的位置已不存在，無法收錄", subAccepted:"已收錄「{name}」", subRejected:"已不予收錄「{name}」",
         subRejectTitle:"不予收錄這個投稿？", subRejectBody:"投稿會被刪除，並通知投稿者。",
         subAcceptedMsg:"你投稿的「{name}」已被收錄。", subRejectedMsg:"你投稿的「{name}」這次不予收錄。" },
    jp:{ subReviewOn:"投稿確認モードをオンにしました", subReviewOff:"投稿確認モードをオフにしました", subReviewBadge:"投稿確認モード（編集ボタン長押しで終了）",
         subBy:"投稿者", subAccept:"収録する", subReject:"収録しない", subLoadFail:"投稿の読み込みに失敗しました", subActionFail:"失敗しました。ネット接続をご確認ください",
         subParentMissing:"投稿先が存在しないため収録できません", subAccepted:"「{name}」を収録しました", subRejected:"「{name}」を収録しませんでした",
         subRejectTitle:"この投稿を収録しませんか？", subRejectBody:"投稿は削除され、投稿者に通知されます。",
         subAcceptedMsg:"投稿した「{name}」が収録されました。", subRejectedMsg:"投稿した「{name}」は今回収録されませんでした。" },
    en:{ subReviewOn:"Review mode on", subReviewOff:"Review mode off", subReviewBadge:"Review mode (long-press the edit button to exit)",
         subBy:"Submitted by", subAccept:"Accept", subReject:"Decline", subLoadFail:"Could not load submissions", subActionFail:"Failed — check your connection",
         subParentMissing:"The target folder no longer exists", subAccepted:"Accepted \"{name}\"", subRejected:"Declined \"{name}\"",
         subRejectTitle:"Decline this submission?", subRejectBody:"The submission is deleted and the submitter is notified.",
         subAcceptedMsg:"Your submission \"{name}\" was accepted.", subRejectedMsg:"Your submission \"{name}\" was not accepted this time." }
  });

  var subReview = { on: false, list: [], marks: { rows: {}, dots: {} } };
  var SUB_MAX_DOTS = 3;

  function isReviewMode(){
    return !!(subReview.on && typeof isAdminAccount === "function" && isAdminAccount());
  }

  // Parent in the tree: category -> parent category (or its table), trick -> first container.
  function subParentOf(id){
    if(getSpace(id)) return null;
    var c = getCategory(id);
    if(c) return c.parentId != null ? c.parentId : c.spaceId;
    var tr = getTrick(id);
    return tr && tr.categoryIds.length ? tr.categoryIds[0] : null;
  }
  function recomputeReviewMarks(){
    subReview.marks = computeReviewMarks(subReview.list, subParentOf, function(email){
      return typeof contributorColorFor === "function" ? contributorColorFor(email) : "#E4572E";
    });
  }

  function loadPendingSubmissions(){
    var p = typeof loadContributors === "function" ? loadContributors().catch(function(){}) : Promise.resolve();
    return p.then(function(){
      return fbStore.collection("submissions").where("status", "==", "pending").limit(200).get();
    }).then(function(qs){
      var list = [];
      qs.forEach(function(d){ var v = d.data() || {}; v.id = d.id; list.push(v); });
      list.sort(function(a, b){
        var x = a.createdAt && a.createdAt.toMillis ? a.createdAt.toMillis() : 0;
        var y = b.createdAt && b.createdAt.toMillis ? b.createdAt.toMillis() : 0;
        return x - y;
      });
      subReview.list = list;
      recomputeReviewMarks();
    });
  }

  function toggleSubmissionReviewMode(force){
    if(typeof isAdminAccount !== "function" || !isAdminAccount()) return;
    subReview.on = typeof force === "boolean" ? force : !subReview.on;
    if(!subReview.on){
      subReview.list = []; subReview.marks = { rows: {}, dots: {} };
      if(state.reviewSubmissionId) closeDrawer();
    } else {
      state.editMode = false;
    }
    showToast(t(subReview.on ? "subReviewOn" : "subReviewOff"));
    render();
    if(subReview.on){
      loadPendingSubmissions().then(function(){ render({ columns: true }); })
        .catch(function(){ showToast(t("subLoadFail"), "error"); });
    }
  }

  /* ---------------- Column hooks (js/21) ---------------- */
  // Pending submissions to list inside one column (parentId null = the table root).
  function submissionRowItems(parentId){
    if(!isReviewMode()) return [];
    var key = parentId === null ? state.activeSpace : parentId;
    return subReview.marks.rows[key] || [];
  }

  function _subDot(color){
    var d = document.createElement("span");
    d.className = "sub-dot"; d.style.background = color;
    return d;
  }
  function _subDotsWrap(colors){
    var w = document.createElement("span");
    w.className = "sub-dots";
    colors.slice(0, SUB_MAX_DOTS).forEach(function(c){ w.appendChild(_subDot(c)); });
    if(colors.length > SUB_MAX_DOTS){
      var more = document.createElement("span");
      more.className = "sub-dots-more"; more.textContent = "+";
      w.appendChild(more);
    }
    return w;
  }

  // Folder rows that hold pending submissions below them.
  function applySubmissionDots(row, it){
    if(!isReviewMode() || it.type === "info") return;
    var colors = subReview.marks.dots[it.id];
    if(!colors || !colors.length) return;
    row.classList.add("has-sub-dots");
    row.appendChild(_subDotsWrap(colors));
  }

  function buildSubmissionRow(sub){
    var tr = acceptTransform(sub, sub.id);
    tr.custom = false;
    var visual = buildItemVisual({ type: "trick", id: "sub-" + sub.id, name: tr.name, ref: tr });
    var row = document.createElement("div");
    row.className = "item sub-row" + (state.reviewSubmissionId === sub.id ? " selected" : "");
    row.title = localize(tr.name);
    row.dataset.itemType = "submission";
    row.dataset.itemId = sub.id;
    row.appendChild(visual.icon);
    row.appendChild(visual.textWrap);
    var by = document.createElement("div");
    by.className = "item-meta";
    by.textContent = sub.name || sub.email || "";
    visual.textWrap.appendChild(by);
    row.appendChild(_subDotsWrap([contributorColorFor(sub.email)]));
    row.addEventListener("click", function(){ openSubmissionDrawer(sub.id); });
    return row;
  }

  /* ---------------- Read-only drawer ---------------- */
  function openSubmissionDrawer(subId){
    state.detailTrickId = null;
    state.reviewSubmissionId = subId;
    drawerUi.tagPicker = false;
    attachDrawerSwipeClose(document.getElementById("detailDrawer"));
    renderColumns();
    renderDrawer();
    document.getElementById("detailDrawer").classList.add("show");
  }

  function findSubmission(id){
    for(var i = 0; i < subReview.list.length; i++) if(subReview.list[i].id === id) return subReview.list[i];
    return null;
  }

  function renderSubmissionDrawer(drawer){
    var sub = findSubmission(state.reviewSubmissionId);
    if(!sub){ closeDrawer(); return; }
    var tr = acceptTransform(sub, sub.id);
    drawer.innerHTML = "";
    drawer.style.transform = ""; drawer.style.transition = "";

    var head = document.createElement("div");
    head.className = "drawer-head";
    var headLeft = document.createElement("div");
    headLeft.className = "drawer-head-left";
    var title = document.createElement("div");
    title.className = "drawer-title";
    title.textContent = resolveDisplayName(tr.name).text;
    headLeft.appendChild(title);
    var actions = document.createElement("div");
    actions.className = "drawer-head-actions";
    var closeBtn = document.createElement("button");
    closeBtn.className = "drawer-close"; closeBtn.innerHTML = ICON_X;
    closeBtn.addEventListener("click", closeDrawer);
    actions.appendChild(closeBtn);
    head.appendChild(headLeft); head.appendChild(actions);

    var body = document.createElement("div");
    body.className = "drawer-body";
    var by = document.createElement("div");
    by.className = "sub-submitter";
    by.appendChild(_subDot(contributorColorFor(sub.email)));
    var byText = document.createElement("span");
    byText.textContent = t("subBy") + "：" + (sub.name || "") + (sub.email ? " <" + sub.email + ">" : "");
    by.appendChild(byText);
    body.appendChild(by);

    var nameTable = document.createElement("div");
    nameTable.className = "name-table";
    otherNames(tr.name).forEach(function(pair){
      var r = document.createElement("div");
      r.className = "name-row";
      r.innerHTML = '<span class="lang-tag">' + pair[0] + '</span><span class="name-val">' + escapeHtml(pair[1]) + '</span>';
      nameTable.appendChild(r);
    });
    body.appendChild(nameTable);

    var content = document.createElement("div");
    buildDrawerGripParts(tr, false, content);
    var videos = tr.media.filter(function(m){ return m.type === "video"; });
    if(videos.length){
      content.appendChild(makeLabel(t("mediaTypeVideo")));
      var vw = document.createElement("div");
      vw.className = "sub-videos";
      videos.forEach(function(m){ vw.appendChild(renderVideoRow(sub.id, m)); });
      content.appendChild(vw);
    }
    if(tr.officialNote){
      content.appendChild(makeLabel(t("officialNoteLabel")));
      var note = document.createElement("div");
      note.className = "note-field note-field-official";
      note.textContent = tr.officialNote;
      content.appendChild(note);
    }
    body.appendChild(content);

    var foot = document.createElement("div");
    foot.className = "drawer-foot sub-foot";
    var rej = document.createElement("button");
    rej.type = "button"; rej.className = "col-add-btn col-add-btn-danger"; rej.style.flex = "1";
    rej.textContent = t("subReject");
    rej.addEventListener("click", function(){
      openConfirm(t("subRejectTitle"), t("subRejectBody"), function(){ resolveSubmission(sub, false); });
    });
    var acc = document.createElement("button");
    acc.type = "button"; acc.className = "col-add-btn sub-accept-btn"; acc.style.flex = "1";
    acc.textContent = t("subAccept");
    acc.addEventListener("click", function(){ resolveSubmission(sub, true); });
    foot.appendChild(rej); foot.appendChild(acc);

    drawer.appendChild(head); drawer.appendChild(body); drawer.appendChild(foot);
  }

  /* ---------------- Accept / reject ---------------- */
  function _subFmt(key, name){ return t(key).replace("{name}", name); }

  // Deletes the submission doc first (so a failure never leaves a duplicate), then files the
  // official trick (accept), then tells the submitter via the inbox contract (V2's sendInboxMessage).
  function resolveSubmission(sub, accept){
    var tr = acceptTransform(sub, sub.id);
    var name = resolveDisplayName(tr.name).text;
    if(accept && !getSpace(sub.parentId) && !getCategory(sub.parentId) && !getTrick(sub.parentId)){
      showToast(t("subParentMissing"), "error"); return Promise.resolve(false);
    }
    return fbStore.collection("submissions").doc(sub.id).delete().then(function(){
      if(accept){
        var raw = acceptTransform(sub, newItemId());
        raw.order = db.tricks.length;
        db.tricks.push(normalizeDB({ categories: [], tricks: [raw] }).tricks[0]);
        saveDB();
      }
      subReview.list = subReview.list.filter(function(x){ return x.id !== sub.id; });
      recomputeReviewMarks();
      if(typeof sendInboxMessage === "function"){
        try { sendInboxMessage(sub.uid, { kind: accept ? "submission-accepted" : "submission-rejected",
          text: _subFmt(accept ? "subAcceptedMsg" : "subRejectedMsg", name), trickName: name }); } catch(e){}
      }
      showToast(_subFmt(accept ? "subAccepted" : "subRejected", name));
      closeDrawer();
      render();
      return true;
    }).catch(function(){ showToast(t("subActionFail"), "error"); return false; });
  }
