"use strict";

  /* ============================================================
     USER FORMS — 問題回報 / 招式投稿／申請協助者 (settings row 4).
     Both write reports/{autoId} + rateLimits/{uid} in ONE batch; the
     Firestore rules require the rateLimits write (lastReportAt ==
     request.time) and reject a second report within 60s (D5).
     Modal shell comes from mbEnsureModal() in js/73-mailbox.js.
  ============================================================ */
  addStrings({
    zh:{ formNeedLogin:"請先登入再使用", formReportTitle:"問題回報", formSubmitTitle:"招式投稿／申請協助者",
         formCategory:"類別", formKind_bug:"錯誤回報", formKind_erratum:"勘誤", formKind_suggestion:"建議", formKind_other:"其他",
         formText:"內容", formTrickId:"相關招式 ID（選填）", formTrickIdHint:"可填 @ID 或 ID，例如 @a1b2c3",
         formChoose:"類型", formChooseTrick:"投稿招式", formChooseApply:"申請成為協助者",
         formNameZh:"招式名稱（中文）", formNameJp:"招式名稱（日文）", formNameEn:"招式名稱（英文）",
         formDesc:"說明／備註", formReason:"申請原因", formVideo:"影片網址（選填）",
         formSubmitNote:"欲大量投稿可申請成為協助者。",
         formSend:"送出", formCancel:"取消", formWait:"請稍候 {n} 秒", formSending:"送出中…", formThanks:"已送出，謝謝你！",
         formErrText:"請填寫內容（最多 1000 字）", formErrNames:"請至少填寫一個招式名稱（各最多 60 字）",
         formErrUrl:"影片網址必須是 http(s) 連結", formErrTrickId:"招式 ID 格式不正確", formErrFail:"送出失敗，請稍後再試",
         formErrWait:"送出太頻繁，請稍候再試" },
    jp:{ formNeedLogin:"ご利用にはログインが必要です", formReportTitle:"問題を報告", formSubmitTitle:"技の投稿／協力者の申請",
         formCategory:"カテゴリ", formKind_bug:"不具合報告", formKind_erratum:"訂正", formKind_suggestion:"提案", formKind_other:"その他",
         formText:"内容", formTrickId:"関連する技のID（任意）", formTrickIdHint:"@ID または ID を入力（例：@a1b2c3）",
         formChoose:"種類", formChooseTrick:"技を投稿", formChooseApply:"協力者に申請",
         formNameZh:"技の名前（中国語）", formNameJp:"技の名前（日本語）", formNameEn:"技の名前（英語）",
         formDesc:"説明／メモ", formReason:"申請の理由", formVideo:"動画URL（任意）",
         formSubmitNote:"大量に投稿したい場合は協力者に申請できます。",
         formSend:"送信", formCancel:"キャンセル", formWait:"あと {n} 秒お待ちください", formSending:"送信中…", formThanks:"送信しました。ありがとうございます！",
         formErrText:"内容を入力してください（1000字まで）", formErrNames:"技の名前を1つ以上入力してください（各60字まで）",
         formErrUrl:"動画URLは http(s) のリンクにしてください", formErrTrickId:"技IDの形式が正しくありません", formErrFail:"送信に失敗しました。しばらくしてからお試しください",
         formErrWait:"送信が頻繁すぎます。しばらくお待ちください" },
    en:{ formNeedLogin:"Please sign in first", formReportTitle:"Report a problem", formSubmitTitle:"Submit tricks / Apply as helper",
         formCategory:"Category", formKind_bug:"Bug report", formKind_erratum:"Erratum", formKind_suggestion:"Suggestion", formKind_other:"Other",
         formText:"Details", formTrickId:"Related trick ID (optional)", formTrickIdHint:"Enter @ID or ID, e.g. @a1b2c3",
         formChoose:"Type", formChooseTrick:"Submit a trick", formChooseApply:"Apply to be a helper",
         formNameZh:"Trick name (Chinese)", formNameJp:"Trick name (Japanese)", formNameEn:"Trick name (English)",
         formDesc:"Description / notes", formReason:"Reason for applying", formVideo:"Video URL (optional)",
         formSubmitNote:"To submit many tricks, apply to become a helper.",
         formSend:"Send", formCancel:"Cancel", formWait:"Wait {n}s", formSending:"Sending…", formThanks:"Sent — thank you!",
         formErrText:"Please enter some text (up to 1000 characters)", formErrNames:"Enter at least one trick name (max 60 characters each)",
         formErrUrl:"Video URL must be an http(s) link", formErrTrickId:"Trick ID format is invalid", formErrFail:"Failed to send — try again later",
         formErrWait:"Sending too often — please wait a moment" }
  });

  var FORM_TEXT_MAX = 1000;
  var FORM_NAME_MAX = 60;
  var FORM_URL_MAX = 500;
  var FORM_COOLDOWN_MS = 60000;
  var FORM_LAST_KEY = "kendama-report-last-v1";
  var REPORT_KINDS = ["bug", "erratum", "suggestion", "other", "trick", "apply"];

  /* ---------- pure logic ---------- */
  // Accepts "@id" or "id"; "" is fine (field is optional). Returns {ok, id}.
  function parseTrickRef(s){
    var v = String(s == null ? "" : s).trim().replace(/^@/, "").trim();
    if(!v) return { ok:true, id:"" };
    if(!/^[0-9A-Za-z_-]{1,40}$/.test(v)) return { ok:false, id:"" };
    return { ok:true, id:v };
  }
  // Validates one form and builds the report doc (createdAt is added at write time).
  // fields: { text, trickRef, nameZh, nameJp, nameEn, url }. Returns {ok, doc} or {ok:false, error:i18nKey}.
  function buildReportDoc(user, kind, fields){
    fields = fields || {};
    if(REPORT_KINDS.indexOf(kind) === -1) return { ok:false, error:"formErrFail" };
    if(!user || !user.uid) return { ok:false, error:"formNeedLogin" };
    var text = String(fields.text || "").trim();
    var payload = {};
    if(text.length > FORM_TEXT_MAX) return { ok:false, error:"formErrText" };
    if(kind === "trick"){
      var names = {};
      var any = false;
      var map = { zh:fields.nameZh, jp:fields.nameJp, en:fields.nameEn };
      for(var k in map){
        var n = String(map[k] || "").trim();
        if(n.length > FORM_NAME_MAX) return { ok:false, error:"formErrNames" };
        if(n){ names[k] = n; any = true; }
      }
      if(!any) return { ok:false, error:"formErrNames" };
      payload.names = names;
      var url = String(fields.url || "").trim();
      if(url){
        if(url.length > FORM_URL_MAX || !isSafeHttpUrl(url)) return { ok:false, error:"formErrUrl" };
        payload.url = url;
      }
    }else{
      if(!text) return { ok:false, error:"formErrText" };
      if(kind !== "apply"){
        var ref = parseTrickRef(fields.trickRef);
        if(!ref.ok) return { ok:false, error:"formErrTrickId" };
        if(ref.id) payload.trickId = ref.id;
      }
    }
    return { ok:true, doc:{
      uid: user.uid,
      email: String(user.email || "").slice(0, 200),
      displayName: String(user.displayName || "").slice(0, 60),
      kind: kind, text: text, payload: payload, status: "open"
    } };
  }
  // ms left before the next report is allowed (0 = ready).
  function reportCooldownLeft(lastMs, nowMs){
    var last = Number(lastMs) || 0;
    var left = last + FORM_COOLDOWN_MS - nowMs;
    return left > 0 ? Math.min(left, FORM_COOLDOWN_MS) : 0;
  }
  function getReportLast(uid){
    try{ return parseInt(localStorage.getItem(FORM_LAST_KEY + ":" + uid), 10) || 0; }catch(e){ return 0; }
  }
  function setReportLast(uid, ms){
    try{ localStorage.setItem(FORM_LAST_KEY + ":" + uid, String(ms)); }catch(e){}
  }

  // reports/{autoId} + rateLimits/{uid} in one atomic batch (rules check both).
  function submitReport(doc){
    var ts = firebase.firestore.FieldValue.serverTimestamp();
    var d = Object.assign({}, doc, { createdAt: ts });
    var batch = fbStore.batch();
    batch.set(fbStore.collection("reports").doc(), d);
    batch.set(fbStore.collection("rateLimits").doc(doc.uid), { lastReportAt: ts });
    return batch.commit();
  }

  /* ---------- UI ---------- */
  function formNeedLogin(){
    showToast(t("formNeedLogin"), "error");
    var b = document.getElementById("authLoginBtn");
    if(b && b.focus) b.focus();
  }
  function formRequireUser(){
    var u = typeof authCurrentUser !== "undefined" ? authCurrentUser : null;
    if(!u){ formNeedLogin(); return null; }
    return u;
  }
  function formField(label, inner, hint){
    return '<div class="field"><label>' + escapeHtml(label) + '</label>' + inner +
      (hint ? '<div class="field-hint">' + escapeHtml(hint) + '</div>' : '') + '</div>';
  }
  function formTextarea(id, ph){
    return '<textarea id="' + id + '" maxlength="' + FORM_TEXT_MAX + '"' + (ph ? ' placeholder="' + escapeHtml(ph) + '"' : '') + '></textarea>';
  }

  // Shared modal opener: builds body + footer, wires submit with cooldown.
  function formOpen(user, title, bodyHtml, kindGetter, fieldsGetter){
    var ov = mbEnsureModal("formOverlay", "form-modal");
    ov.querySelector(".modal-title").textContent = title;
    var cb = ov.querySelector("[data-close]");
    cb.title = t("settingsClose"); cb.setAttribute("aria-label", t("settingsClose"));
    ov.querySelector(".modal-scroll").innerHTML = bodyHtml;
    var foot = ov.querySelector(".modal-footer");
    foot.hidden = false;
    foot.innerHTML = '<div class="modal-actions"><button type="button" class="btn btn-ghost" data-close="1">' + escapeHtml(t("formCancel")) +
      '</button><button type="button" class="btn btn-primary" id="formSendBtn">' + escapeHtml(t("formSend")) + '</button></div>';
    var send = foot.querySelector("#formSendBtn");
    var timer = null;
    function tick(){
      var left = reportCooldownLeft(getReportLast(user.uid), Date.now());
      if(left > 0){
        send.disabled = true;
        send.textContent = t("formWait").replace("{n}", String(Math.ceil(left / 1000)));
        timer = setTimeout(tick, 1000);
      }else{
        send.disabled = false; send.textContent = t("formSend"); timer = null;
      }
    }
    if(ov._formTimer) clearTimeout(ov._formTimer);
    tick();
    send.onclick = function(){
      if(send.disabled) return;
      var r = buildReportDoc(user, kindGetter(ov), fieldsGetter(ov));
      if(!r.ok){ showToast(t(r.error), "error"); return; }
      if(reportCooldownLeft(getReportLast(user.uid), Date.now()) > 0){ showToast(t("formErrWait"), "error"); tick(); return; }
      send.disabled = true; send.textContent = t("formSending");
      submitReport(r.doc).then(function(){
        setReportLast(user.uid, Date.now());
        ov.classList.remove("show");
        showToast(t("formThanks"));
      }).catch(function(e){
        var denied = e && e.code === "permission-denied";
        showToast(t(denied ? "formErrWait" : "formErrFail"), "error");
        send.disabled = false; send.textContent = t("formSend");
      });
    };
    ov.classList.add("show");
  }
  function formVal(ov, id){ var el = ov.querySelector("#" + id); return el ? el.value : ""; }

  function openReportForm(){
    var user = formRequireUser(); if(!user) return;
    var opts = ["bug", "erratum", "suggestion", "other"].map(function(k){
      return '<option value="' + k + '">' + escapeHtml(t("formKind_" + k)) + '</option>';
    }).join("");
    var body = formField(t("formCategory"), '<select id="formKind">' + opts + '</select>') +
      formField(t("formText"), formTextarea("formText")) +
      formField(t("formTrickId"), '<input type="text" id="formTrickRef" maxlength="42" autocomplete="off">', t("formTrickIdHint"));
    formOpen(user, t("formReportTitle"), body,
      function(ov){ return formVal(ov, "formKind"); },
      function(ov){ return { text: formVal(ov, "formText"), trickRef: formVal(ov, "formTrickRef") }; });
  }

  function openSubmitForm(){
    var user = formRequireUser(); if(!user) return;
    var body = '<div class="field-hint form-note">' + escapeHtml(t("formSubmitNote")) + '</div>' +
      '<div class="field"><label>' + escapeHtml(t("formChoose")) + '</label>' +
      '<label class="cat-tree-item"><input type="radio" name="formMode" value="trick" checked> ' + escapeHtml(t("formChooseTrick")) + '</label>' +
      '<label class="cat-tree-item"><input type="radio" name="formMode" value="apply"> ' + escapeHtml(t("formChooseApply")) + '</label></div>' +
      '<div id="formTrickPart">' +
        formField(t("formNameZh"), '<input type="text" id="formNameZh" maxlength="' + FORM_NAME_MAX + '" autocomplete="off">') +
        formField(t("formNameJp"), '<input type="text" id="formNameJp" maxlength="' + FORM_NAME_MAX + '" autocomplete="off">') +
        formField(t("formNameEn"), '<input type="text" id="formNameEn" maxlength="' + FORM_NAME_MAX + '" autocomplete="off">') +
        formField(t("formDesc"), formTextarea("formText")) +
        formField(t("formVideo"), '<input type="url" id="formUrl" maxlength="' + FORM_URL_MAX + '" autocomplete="off">') +
      '</div>' +
      '<div id="formApplyPart" hidden>' + formField(t("formReason"), formTextarea("formReason")) + '</div>';
    formOpen(user, t("formSubmitTitle"), body,
      function(ov){ var r = ov.querySelector('input[name="formMode"]:checked'); return r ? r.value : "trick"; },
      function(ov){
        var apply = ov.querySelector('input[name="formMode"]:checked').value === "apply";
        return apply ? { text: formVal(ov, "formReason") } :
          { text: formVal(ov, "formText"), nameZh: formVal(ov, "formNameZh"), nameJp: formVal(ov, "formNameJp"),
            nameEn: formVal(ov, "formNameEn"), url: formVal(ov, "formUrl") };
      });
    var ov = document.getElementById("formOverlay");
    Array.prototype.forEach.call(ov.querySelectorAll('input[name="formMode"]'), function(r){
      r.addEventListener("change", function(){
        var apply = ov.querySelector('input[name="formMode"]:checked').value === "apply";
        ov.querySelector("#formTrickPart").hidden = apply;
        ov.querySelector("#formApplyPart").hidden = !apply;
      });
    });
  }
