"use strict";

  /* ============================================================
     SUBMISSIONS (投稿) — 企劃書 §四.2. A contributor submits one of their own
     custom tricks in 總表 (t00); the admin reviews it (js/76-submission-review.js).
     Firestore: submissions/{autoId} = { uid, email, name, trick, parentId,
     status:"pending", createdAt }. Pure helpers first (tests/contrib.test.js).
  ============================================================ */
  addStrings({
    zh:{ subSubmit:"投稿", subSubmitted:"已投稿", subSubmitTitle:"投稿到總表", subSent:"已投稿，等待管理員審核", subFail:"投稿失敗，請檢查網路連線" },
    jp:{ subSubmit:"投稿", subSubmitted:"投稿済み", subSubmitTitle:"総表に投稿", subSent:"投稿しました。管理者の確認をお待ちください", subFail:"投稿に失敗しました。ネット接続をご確認ください" },
    en:{ subSubmit:"Submit", subSubmitted:"Submitted", subSubmitTitle:"Submit to the master table", subSent:"Submitted — waiting for admin review", subFail:"Submit failed — check your connection" }
  });

  var SUB_MAX_NAME = 80, SUB_MAX_TEXT = 2000, SUB_MAX_URL = 500, SUB_ROOT_SPACE = "t00";

  function _subStr(v, max){ return typeof v === "string" ? v.slice(0, max) : ""; }

  // The shareable part of a trick: no personal fields (landed / rate / favorite / personal note),
  // no placement (parentId travels separately), no tags (ids are per-user).
  function sanitizeSubmissionTrick(tr){
    var name = tr.name || {};
    var out = {
      id: _subStr(tr.id, 40),
      name: { zh: _subStr(name.zh, SUB_MAX_NAME), jp: _subStr(name.jp, SUB_MAX_NAME), en: _subStr(name.en, SUB_MAX_NAME) },
      media: [],
      icon: _subStr(tr.icon, 16),
      color: _subStr(tr.color, 24),
      grip: typeof tr.grip === "string" ? tr.grip : null,
      parts: Array.isArray(tr.parts) ? tr.parts.filter(function(p){ return typeof p === "string"; }).slice(0, 20) : [],
      officialNote: _subStr(tr.officialNote, SUB_MAX_TEXT),
      tagIds: []
    };
    (Array.isArray(tr.media) ? tr.media : []).forEach(function(m){
      if(!m || m.type !== "video" || out.media.length >= 10) return;
      out.media.push({ id: _subStr(m.id, 40), type: "video", title: _subStr(m.title, SUB_MAX_NAME),
        url: _subStr(m.url, SUB_MAX_URL), platform: _subStr(m.platform, 24) });
    });
    return out;
  }

  // First placement of the trick that sits inside 總表 (t00); null when none.
  // spaceOf(containerId) -> space id (containerSpaceId).
  function submissionParentId(tr, spaceOf){
    var ids = tr.categoryIds || [];
    for(var i = 0; i < ids.length; i++){
      if(spaceOf(ids[i]) === SUB_ROOT_SPACE) return ids[i];
    }
    return null;
  }

  function buildSubmissionPayload(tr, user, parentId){
    var email = user && user.email ? String(user.email).toLowerCase() : "";
    return {
      uid: user.uid, email: email, name: _subStr((user.displayName || email), 60),
      trick: sanitizeSubmissionTrick(tr), parentId: parentId, status: "pending"
    };
  }

  // Accepted submission -> raw official trick (new id, not custom, filed under parentId).
  // Personal fields start empty; feed through normalizeDB before pushing to db.tricks.
  function acceptTransform(sub, newId){
    var s = sanitizeSubmissionTrick(sub.trick || {});
    return {
      id: newId, name: s.name, media: s.media, categoryIds: [sub.parentId], orderByCategory: {}, order: 0,
      icon: s.icon, color: s.color || "default", tagIds: [], grip: s.grip, parts: s.parts,
      officialNote: s.officialNote, note: "", landed: false, rate: null, favorite: false, custom: false
    };
  }

  // Review-mode marks. subs: [{ id, parentId, email }]; parentOf(id) -> container/parent id or null;
  // colorOf(email) -> color. Returns
  //   rows: parentKey -> [sub]           (rows to show inside that folder / table root)
  //   dots: folderId  -> [color, ...]    (distinct colors of pending submissions below it)
  function computeReviewMarks(subs, parentOf, colorOf){
    var rows = {}, dots = {};
    subs.forEach(function(sub){
      var color = colorOf(sub.email);
      (rows[sub.parentId] = rows[sub.parentId] || []).push(sub);
      var id = sub.parentId, guard = 0;
      while(id != null && guard++ < 60){
        var arr = (dots[id] = dots[id] || []);
        if(arr.indexOf(color) === -1) arr.push(color);
        id = parentOf(id);
      }
    });
    return { rows: rows, dots: dots };
  }

  /* ---------------- Contributor side ---------------- */
  var subOwn = {}; // trick id -> true for tricks this account has a submission for

  function loadOwnSubmissions(){
    var u = typeof authCurrentUser !== "undefined" ? authCurrentUser : null;
    if(!u || typeof fbStore === "undefined") return Promise.resolve();
    return fbStore.collection("submissions").where("uid", "==", u.uid).get().then(function(qs){
      subOwn = {};
      qs.forEach(function(d){ var v = d.data() || {}; if(v.trick && v.trick.id) subOwn[v.trick.id] = true; });
    }).catch(function(){});
  }

  function canSubmitTrick(tr){
    return !!(tr && tr.custom && typeof isContributorAccount === "function" && isContributorAccount() &&
      submissionParentId(tr, containerSpaceId));
  }

  function submitTrickToAdmin(tr){
    var u = authCurrentUser;
    var parentId = submissionParentId(tr, containerSpaceId);
    if(!u || !parentId || subOwn[tr.id]) return Promise.resolve(false);
    var payload = buildSubmissionPayload(tr, u, parentId);
    payload.createdAt = firebase.firestore.FieldValue.serverTimestamp();
    return fbStore.collection("submissions").add(payload).then(function(){
      subOwn[tr.id] = true;
      showToast(t("subSent"));
      return true;
    }).catch(function(){ showToast(t("subFail"), "error"); return false; });
  }

  // Drawer head button (edit mode, own custom trick in t00). null when not applicable.
  function buildSubmitButton(tr){
    if(!state.editMode || !canSubmitTrick(tr)) return null;
    var done = !!subOwn[tr.id];
    var b = document.createElement("button");
    b.type = "button";
    b.className = "drawer-submit-btn" + (done ? " done" : "");
    b.textContent = done ? t("subSubmitted") : t("subSubmit");
    b.title = t("subSubmitTitle");
    b.disabled = done;
    b.addEventListener("click", function(){
      b.disabled = true;
      submitTrickToAdmin(tr).then(function(){ if(state.detailTrickId === tr.id) renderDrawer(); });
    });
    return b;
  }

  function refreshSubmissionUi(){
    if(typeof renderDrawer === "function" && state.detailTrickId) renderDrawer();
  }
