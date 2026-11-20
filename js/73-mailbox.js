"use strict";

  /* ============================================================
     ADMIN MAILBOX (📫 郵件箱) + inbox sending.
     openMailbox() is called by the admin panel (js/70). Reports live in
     reports/{autoId} (written by js/74-forms.js, admin-only read).
     sendInboxMessage(uid, msg) writes users/{uid}/inbox/{autoId}.
     The overlay is built from JS and inserted before #confirmOverlay so the
     confirm dialog stacks above it.
  ============================================================ */
  addStrings({
    zh:{ mbTitle:"郵件箱", mbTabAll:"全部", mbTabReport:"回報", mbTabTrick:"投稿", mbTabApply:"申請",
         mbEmpty:"沒有信件", mbLoading:"讀取中…", mbError:"讀取失敗，請檢查網路連線或權限", mbMore:"載入更多",
         mbDone:"標記已處理", mbDoneBadge:"已處理", mbDelete:"刪除", mbReply:"回覆", mbAddHelper:"加入協助者",
         mbDeleteConfirm:"刪除這封信？", mbDeleteSub:"刪除後無法復原。", mbReplyPlaceholder:"回覆內容（最多 1000 字）",
         mbSend:"送出回覆", mbCancel:"取消", mbSent:"已送出回覆", mbMarked:"已標記為已處理", mbDeleted:"已刪除",
         mbHelperAdded:"已加入協助者", mbHelperNA:"加入協助者功能尚未提供", mbActionFail:"操作失敗，請稍後再試",
         mbKind_bug:"錯誤回報", mbKind_erratum:"勘誤", mbKind_suggestion:"建議", mbKind_other:"其他",
         mbKind_trick:"招式投稿", mbKind_apply:"協助者申請", mbRelatedTrick:"相關招式", mbVideo:"影片",
         mbNames:"招式名稱", mbReplyKindDefault:"管理員回覆" },
    jp:{ mbTitle:"受信箱", mbTabAll:"すべて", mbTabReport:"報告", mbTabTrick:"投稿", mbTabApply:"申請",
         mbEmpty:"メッセージはありません", mbLoading:"読み込み中…", mbError:"読み込みに失敗しました。接続や権限をご確認ください", mbMore:"もっと読み込む",
         mbDone:"対応済みにする", mbDoneBadge:"対応済み", mbDelete:"削除", mbReply:"返信", mbAddHelper:"協力者に追加",
         mbDeleteConfirm:"このメッセージを削除しますか？", mbDeleteSub:"削除すると元に戻せません。", mbReplyPlaceholder:"返信内容（1000字まで）",
         mbSend:"返信を送信", mbCancel:"キャンセル", mbSent:"返信を送信しました", mbMarked:"対応済みにしました", mbDeleted:"削除しました",
         mbHelperAdded:"協力者に追加しました", mbHelperNA:"協力者の追加機能はまだ使えません", mbActionFail:"操作に失敗しました。しばらくしてからお試しください",
         mbKind_bug:"不具合報告", mbKind_erratum:"訂正", mbKind_suggestion:"提案", mbKind_other:"その他",
         mbKind_trick:"技の投稿", mbKind_apply:"協力者の申請", mbRelatedTrick:"関連する技", mbVideo:"動画",
         mbNames:"技の名前", mbReplyKindDefault:"管理者からの返信" },
    en:{ mbTitle:"Mailbox", mbTabAll:"All", mbTabReport:"Reports", mbTabTrick:"Tricks", mbTabApply:"Applications",
         mbEmpty:"No messages", mbLoading:"Loading…", mbError:"Failed to load — check your connection or permissions", mbMore:"Load more",
         mbDone:"Mark done", mbDoneBadge:"Done", mbDelete:"Delete", mbReply:"Reply", mbAddHelper:"Add as helper",
         mbDeleteConfirm:"Delete this message?", mbDeleteSub:"This cannot be undone.", mbReplyPlaceholder:"Reply (up to 1000 characters)",
         mbSend:"Send reply", mbCancel:"Cancel", mbSent:"Reply sent", mbMarked:"Marked as done", mbDeleted:"Deleted",
         mbHelperAdded:"Added as helper", mbHelperNA:"Adding helpers is not available yet", mbActionFail:"Action failed — try again later",
         mbKind_bug:"Bug report", mbKind_erratum:"Erratum", mbKind_suggestion:"Suggestion", mbKind_other:"Other",
         mbKind_trick:"Trick submission", mbKind_apply:"Helper application", mbRelatedTrick:"Related trick", mbVideo:"Video",
         mbNames:"Trick names", mbReplyKindDefault:"Reply from admin" }
  });

  var MB_PAGE = 50;
  var MB_INBOX_MAX = 1000;
  var MB_TABS = ["all", "report", "trick", "apply"];
  var MB_TAB_KEYS = { all:"mbTabAll", report:"mbTabReport", trick:"mbTabTrick", apply:"mbTabApply" };

  var mbItems = [];
  var mbLastDoc = null;
  var mbHasMore = false;
  var mbTab = "all";
  var mbReplyOpen = null; // report id with the reply box open

  /* ---------- pure helpers ---------- */
  // Which filter tab a report kind belongs to.
  function mbKindTab(kind){
    if(kind === "trick") return "trick";
    if(kind === "apply") return "apply";
    return "report";
  }
  function mbFilterReports(list, tab){
    if(!tab || tab === "all") return (list || []).slice();
    return (list || []).filter(function(r){ return mbKindTab(r.kind) === tab; });
  }
  // Validates an admin -> user message; returns {ok, doc} (createdAt is added at write time).
  function buildInboxDoc(msg){
    var text = String((msg && msg.text) || "").trim();
    if(!text) return { ok:false, error:"empty" };
    if(text.length > MB_INBOX_MAX) return { ok:false, error:"tooLong" };
    var doc = { kind: String((msg && msg.kind) || "reply").slice(0, 20), text: text, from: "admin", read: false };
    var tn = String((msg && msg.trickName) || "").trim();
    if(tn) doc.trickName = tn.slice(0, 100);
    return { ok:true, doc: doc };
  }

  // Writes users/{uid}/inbox/{autoId}. Admin-only by rules.
  function sendInboxMessage(uid, msg){
    if(!uid) return Promise.reject(new Error("no uid"));
    var b = buildInboxDoc(msg);
    if(!b.ok) return Promise.reject(new Error(b.error));
    b.doc.createdAt = firebase.firestore.FieldValue.serverTimestamp();
    return fbStore.collection("users").doc(uid).collection("inbox").add(b.doc);
  }

  /* ---------- modal shell (shared with js/74) ---------- */
  function mbEnsureModal(id, extraClass){
    var ov = document.getElementById(id);
    if(ov) return ov;
    ov = document.createElement("div");
    ov.className = "modal-overlay";
    ov.id = id;
    ov.innerHTML = '<div class="modal modal-lg ' + (extraClass || "") + '">' +
      '<div class="settings-head"><div class="modal-title"></div>' +
      '<button type="button" class="icon-btn settings-close" data-close="1"></button></div>' +
      '<div class="modal-scroll"></div><div class="modal-footer" hidden></div></div>';
    var ref = document.getElementById("confirmOverlay");
    if(ref && ref.parentNode) ref.parentNode.insertBefore(ov, ref); else document.body.appendChild(ov);
    ov.querySelector("[data-close]").innerHTML = ICON_X;
    ov.addEventListener("click", function(ev){
      if(ev.target === ov || ev.target.closest("[data-close]")) ov.classList.remove("show");
    });
    return ov;
  }

  /* ---------- rendering ---------- */
  function mbDate(ts){
    return typeof formatPublishedDate === "function" ? formatPublishedDate(ts) : "";
  }
  function mbPayloadHtml(r){
    var p = r.payload || {}, rows = [];
    if(p.trickId) rows.push([t("mbRelatedTrick"), "@" + p.trickId]);
    if(p.names){
      var n = [p.names.zh, p.names.jp, p.names.en].filter(Boolean).join(" / ");
      if(n) rows.push([t("mbNames"), n]);
    }
    if(p.url) rows.push([t("mbVideo"), p.url]);
    return rows.map(function(x){
      var val = escapeHtml(x[1]);
      if(x[0] === t("mbVideo") && isSafeHttpUrl(x[1])) val = '<a href="' + escapeHtml(x[1]) + '" target="_blank" rel="noopener noreferrer">' + val + '</a>';
      return '<div class="mb-payload-row"><span class="mb-payload-key">' + escapeHtml(x[0]) + '</span><span>' + val + '</span></div>';
    }).join("");
  }
  function mbItemHtml(r){
    var done = r.status === "done";
    var who = (r.displayName ? escapeHtml(r.displayName) + " " : "") + '<span class="mb-email">' + escapeHtml(r.email || "") + '</span>';
    var html = '<div class="mb-item' + (done ? ' is-done' : '') + '" data-id="' + escapeHtml(r.id) + '">' +
      '<div class="mb-item-head"><span class="mb-kind mb-kind-' + escapeHtml(mbKindTab(r.kind)) + '">' + escapeHtml(t("mbKind_" + r.kind)) + '</span>' +
      (done ? '<span class="mb-done-badge">' + escapeHtml(t("mbDoneBadge")) + '</span>' : '') +
      '<span class="mb-date">' + escapeHtml(mbDate(r.createdAt)) + '</span></div>' +
      '<div class="mb-who">' + who + '</div>' +
      (r.text ? '<div class="mb-text">' + escapeHtml(r.text) + '</div>' : '') +
      '<div class="mb-payload">' + mbPayloadHtml(r) + '</div>' +
      '<div class="mb-actions">';
    if(r.kind === "apply" && !done) html += '<button type="button" class="btn btn-primary btn-sm" data-act="helper">' + escapeHtml(t("mbAddHelper")) + '</button>';
    if(!done) html += '<button type="button" class="btn btn-ghost btn-sm" data-act="done">' + escapeHtml(t("mbDone")) + '</button>';
    html += '<button type="button" class="btn btn-ghost btn-sm" data-act="reply">' + escapeHtml(t("mbReply")) + '</button>' +
      '<button type="button" class="btn btn-danger btn-sm" data-act="delete">' + escapeHtml(t("mbDelete")) + '</button></div>';
    if(mbReplyOpen === r.id){
      html += '<div class="mb-reply field"><textarea maxlength="' + MB_INBOX_MAX + '" placeholder="' + escapeHtml(t("mbReplyPlaceholder")) + '"></textarea>' +
        '<div class="mb-actions"><button type="button" class="btn btn-primary btn-sm" data-act="send">' + escapeHtml(t("mbSend")) + '</button>' +
        '<button type="button" class="btn btn-ghost btn-sm" data-act="cancel">' + escapeHtml(t("mbCancel")) + '</button></div></div>';
    }
    return html + '</div>';
  }
  function mbRender(){
    var ov = document.getElementById("mailboxOverlay");
    if(!ov) return;
    var body = ov.querySelector(".modal-scroll");
    var tabs = '<div class="mb-tabs">' + MB_TABS.map(function(k){
      return '<button type="button" class="chip mb-tab' + (k === mbTab ? ' active' : '') + '" data-tab="' + k + '">' + escapeHtml(t(MB_TAB_KEYS[k])) + '</button>';
    }).join("") + '</div>';
    var list = mbFilterReports(mbItems, mbTab);
    var inner = list.length ? list.map(mbItemHtml).join("") : '<div class="cat-tree-empty">' + escapeHtml(t("mbEmpty")) + '</div>';
    var more = mbHasMore ? '<button type="button" class="btn btn-ghost btn-sm btn-block" data-act="more">' + escapeHtml(t("mbMore")) + '</button>' : '';
    body.innerHTML = tabs + inner + more;
  }

  /* ---------- data ---------- */
  function mbLoad(reset){
    var body = document.querySelector("#mailboxOverlay .modal-scroll");
    if(reset){
      mbItems = []; mbLastDoc = null; mbHasMore = false;
      body.innerHTML = '<div class="cat-tree-empty">' + escapeHtml(t("mbLoading")) + '</div>';
    }
    var q = fbStore.collection("reports").orderBy("createdAt", "desc");
    if(mbLastDoc) q = q.startAfter(mbLastDoc);
    return q.limit(MB_PAGE).get().then(function(snap){
      snap.forEach(function(d){ var o = d.data(); o.id = d.id; mbItems.push(o); mbLastDoc = d; });
      mbHasMore = snap.size >= MB_PAGE;
      mbRender();
    }).catch(function(){
      body.innerHTML = '<div class="cat-tree-empty">' + escapeHtml(t("mbError")) + '</div>';
    });
  }
  function mbFind(id){
    for(var i = 0; i < mbItems.length; i++) if(mbItems[i].id === id) return mbItems[i];
    return null;
  }
  function mbMarkDone(id){
    return fbStore.collection("reports").doc(id).update({ status: "done" }).then(function(){
      var r = mbFind(id); if(r) r.status = "done";
      mbRender();
    });
  }
  function mbRemove(id){
    return fbStore.collection("reports").doc(id).delete().then(function(){
      mbItems = mbItems.filter(function(r){ return r.id !== id; });
      mbRender();
      showToast(t("mbDeleted"));
    });
  }
  function mbFail(){ showToast(t("mbActionFail"), "error"); }

  function mbOnClick(ev){
    var tabBtn = ev.target.closest("[data-tab]");
    if(tabBtn){ mbTab = tabBtn.getAttribute("data-tab"); mbRender(); return; }
    var btn = ev.target.closest("[data-act]");
    if(!btn) return;
    var act = btn.getAttribute("data-act");
    if(act === "more"){ mbLoad(false); return; }
    var itemEl = btn.closest(".mb-item");
    var id = itemEl && itemEl.getAttribute("data-id");
    var r = id && mbFind(id);
    if(!r) return;
    if(act === "done"){
      mbMarkDone(id).then(function(){ showToast(t("mbMarked")); }).catch(mbFail);
    }else if(act === "delete"){
      openConfirm(t("mbDeleteConfirm"), t("mbDeleteSub"), function(){ mbRemove(id).catch(mbFail); });
    }else if(act === "reply"){
      mbReplyOpen = mbReplyOpen === id ? null : id; mbRender();
    }else if(act === "cancel"){
      mbReplyOpen = null; mbRender();
    }else if(act === "send"){
      var ta = itemEl.querySelector("textarea");
      var text = ta ? ta.value : "";
      var m = { kind: "reply", text: text };
      if(r.payload && r.payload.names) m.trickName = r.payload.names.zh || r.payload.names.jp || r.payload.names.en || "";
      sendInboxMessage(r.uid, m).then(function(){
        mbReplyOpen = null; mbRender(); showToast(t("mbSent"));
      }).catch(function(e){
        showToast(e && (e.message === "empty" || e.message === "tooLong") ? t("formErrText") : t("mbActionFail"), "error");
      });
    }else if(act === "helper"){
      if(typeof addContributor !== "function"){ showToast(t("mbHelperNA"), "error"); return; }
      Promise.resolve(addContributor(r.email)).then(function(){
        return mbMarkDone(id);
      }).then(function(){ showToast(t("mbHelperAdded")); }).catch(mbFail);
    }
  }

  function openMailbox(){
    var ov = mbEnsureModal("mailboxOverlay", "mailbox-modal");
    ov.querySelector(".modal-title").textContent = t("mbTitle");
    var closeBtn = ov.querySelector("[data-close]");
    closeBtn.title = t("settingsClose"); closeBtn.setAttribute("aria-label", t("settingsClose"));
    if(!ov._mbBound){ ov.querySelector(".modal-scroll").addEventListener("click", mbOnClick); ov._mbBound = true; }
    mbTab = "all"; mbReplyOpen = null;
    ov.classList.add("show");
    mbLoad(true);
  }
