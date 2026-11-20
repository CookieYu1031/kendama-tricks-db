"use strict";

  /* ============================================================
     CONTRIBUTORS (協助者) — 企劃書 §三.8 / §四.2.
     Admin adds helpers by Gmail in the admin panel; Firestore doc
     contributors/{emailLowercase} = { email, addedAt, color }.
     A signed-in user is a contributor when their own doc exists
     (cached after login). Pure helpers first (tests/contrib.test.js).
  ============================================================ */
  addStrings({
    zh:{ contribEmailPlaceholder:"協助者的 Gmail", contribAdd:"新增", contribEmpty:"還沒有協助者", contribRemove:"移除協助者",
         contribEmailBad:"請輸入有效的 Email", contribExists:"這個 Email 已經是協助者", contribAdded:"已新增協助者", contribRemoved:"已移除協助者",
         contribFail:"操作失敗，請檢查網路連線", contribLoading:"載入中…", contribReviewBtn:"查看投稿模式",
         contribRemoveTitle:"移除協助者？", contribRemoveBody:"{email} 之後無法再投稿，已送出的投稿不受影響。" },
    jp:{ contribEmailPlaceholder:"協力者の Gmail", contribAdd:"追加", contribEmpty:"協力者はまだいません", contribRemove:"協力者を外す",
         contribEmailBad:"有効なメールアドレスを入力してください", contribExists:"このメールは既に協力者です", contribAdded:"協力者を追加しました", contribRemoved:"協力者を外しました",
         contribFail:"失敗しました。ネット接続をご確認ください", contribLoading:"読み込み中…", contribReviewBtn:"投稿確認モード",
         contribRemoveTitle:"協力者を外しますか？", contribRemoveBody:"{email} は今後投稿できません。送信済みの投稿は残ります。" },
    en:{ contribEmailPlaceholder:"Helper's Gmail", contribAdd:"Add", contribEmpty:"No helpers yet", contribRemove:"Remove helper",
         contribEmailBad:"Enter a valid email", contribExists:"This email is already a helper", contribAdded:"Helper added", contribRemoved:"Helper removed",
         contribFail:"Failed — check your connection", contribLoading:"Loading…", contribReviewBtn:"Review submissions",
         contribRemoveTitle:"Remove helper?", contribRemoveBody:"{email} can no longer submit. Existing submissions are kept." }
  });

  // Fixed, theme-independent palette (like rate colors).
  var CONTRIB_COLORS = ["#E4572E", "#F3A712", "#7BB661", "#17BEBB", "#2E86DE", "#8E6BDB", "#E056A0", "#9A7B4F"];

  function normalizeEmail(s){ return String(s == null ? "" : s).trim().toLowerCase(); }
  function isValidContribEmail(s){ return s.length <= 254 && /^[^\s@\/]+@[^\s@\/]+\.[^\s@\/]+$/.test(s); }
  function isContribColor(c){ return typeof c === "string" && /^#[0-9A-Fa-f]{6}$/.test(c); }

  // Least-used palette color (first one on ties). `used` = list of colors already assigned.
  function pickContributorColor(used){
    var count = {};
    CONTRIB_COLORS.forEach(function(c){ count[c] = 0; });
    (used || []).forEach(function(c){ if(count[c] !== undefined) count[c]++; });
    var best = CONTRIB_COLORS[0];
    CONTRIB_COLORS.forEach(function(c){ if(count[c] < count[best]) best = c; });
    return best;
  }

  var contribState = { isContributor: false, list: [], loaded: false, busy: false };

  function isContributorAccount(){
    return !!(contribState.isContributor && typeof isLoggedIn === "function" && isLoggedIn());
  }
  // email -> color for the loaded helpers (lowercase keys).
  function contributorColorFor(email){
    var e = normalizeEmail(email), hit = null;
    contribState.list.forEach(function(c){ if(c.email === e) hit = c.color; });
    return hit || CONTRIB_COLORS[0];
  }

  // Reads contributors/{my email}. Called by the auth listener below, and callable by 59.
  function refreshContributorFlag(user){
    user = user || (typeof authCurrentUser !== "undefined" ? authCurrentUser : null);
    contribState.isContributor = false;
    if(!user || !user.email || typeof fbStore === "undefined"){
      if(typeof refreshSubmissionUi === "function") refreshSubmissionUi();
      return Promise.resolve(false);
    }
    return fbStore.collection("contributors").doc(normalizeEmail(user.email)).get().then(function(snap){
      contribState.isContributor = !!snap.exists;
      if(typeof loadOwnSubmissions === "function" && contribState.isContributor) return loadOwnSubmissions();
    }).catch(function(){ contribState.isContributor = false; }).then(function(){
      if(typeof refreshSubmissionUi === "function") refreshSubmissionUi();
      return contribState.isContributor;
    });
  }

  // Admin: loads the full list (needed for colors + the panel).
  function loadContributors(){
    if(typeof fbStore === "undefined") return Promise.resolve([]);
    return fbStore.collection("contributors").get().then(function(qs){
      var list = [];
      qs.forEach(function(d){
        var v = d.data() || {};
        list.push({ email: normalizeEmail(v.email || d.id), color: isContribColor(v.color) ? v.color : CONTRIB_COLORS[0],
          addedAt: v.addedAt && v.addedAt.toMillis ? v.addedAt.toMillis() : 0 });
      });
      list.sort(function(a, b){ return a.addedAt - b.addedAt; });
      contribState.list = list; contribState.loaded = true;
      return list;
    });
  }

  function addContributor(rawEmail){
    var email = normalizeEmail(rawEmail);
    if(!isValidContribEmail(email)) return Promise.resolve({ ok: false, error: "contribEmailBad" });
    if(contribState.list.some(function(c){ return c.email === email; })) return Promise.resolve({ ok: false, error: "contribExists" });
    var color = pickContributorColor(contribState.list.map(function(c){ return c.color; }));
    return fbStore.collection("contributors").doc(email).set({
      email: email, addedAt: firebase.firestore.FieldValue.serverTimestamp(), color: color
    }).then(function(){
      contribState.list.push({ email: email, color: color, addedAt: Date.now() });
      return { ok: true };
    }).catch(function(){ return { ok: false, error: "contribFail" }; });
  }
  // Does not touch submissions the helper already sent.
  function removeContributor(email){
    email = normalizeEmail(email);
    return fbStore.collection("contributors").doc(email).delete().then(function(){
      contribState.list = contribState.list.filter(function(c){ return c.email !== email; });
      return { ok: true };
    }).catch(function(){ return { ok: false, error: "contribFail" }; });
  }

  /* ---------------- Admin panel section (管理協助者) ---------------- */
  function renderContribList(){
    var box = document.getElementById("contribList");
    if(!box) return;
    if(!contribState.loaded){ box.innerHTML = '<div class="field-hint">' + escapeHtml(t("contribLoading")) + '</div>'; return; }
    if(!contribState.list.length){ box.innerHTML = '<div class="field-hint">' + escapeHtml(t("contribEmpty")) + '</div>'; return; }
    box.innerHTML = "";
    contribState.list.forEach(function(c){
      var row = document.createElement("div");
      row.className = "contrib-row";
      var dot = document.createElement("span");
      dot.className = "contrib-dot"; dot.style.background = c.color;
      var em = document.createElement("span");
      em.className = "contrib-email"; em.textContent = c.email; em.title = c.email;
      var rm = document.createElement("button");
      rm.type = "button"; rm.className = "mini-btn danger"; rm.innerHTML = ICON_X;
      rm.title = t("contribRemove"); rm.setAttribute("aria-label", t("contribRemove"));
      rm.addEventListener("click", function(){
        openConfirm(t("contribRemoveTitle"), t("contribRemoveBody").replace("{email}", c.email), function(){
          removeContributor(c.email).then(function(r){
            if(r.ok){ showToast(t("contribRemoved")); renderContribList(); }
            else showToast(t(r.error), "error");
          });
        });
      });
      row.appendChild(dot); row.appendChild(em); row.appendChild(rm);
      box.appendChild(row);
    });
  }

  function submitContribForm(){
    var inp = document.getElementById("contribEmailInput");
    if(contribState.busy || !inp) return;
    contribState.busy = true;
    addContributor(inp.value).then(function(r){
      contribState.busy = false;
      if(r.ok){ inp.value = ""; showToast(t("contribAdded")); renderContribList(); }
      else showToast(t(r.error), "error");
    });
  }

  // Fills the helpers sub-modal body (container from js/70 openAdminHelpers); idempotent.
  function renderAdminHelpers(card){
    if(!card) return;
    var body = document.getElementById("contribBody");
    if(!body){
      body = document.createElement("div");
      body.id = "contribBody";
      body.innerHTML =
        '<div class="contrib-form"><input type="email" id="contribEmailInput" autocomplete="off" maxlength="254">' +
        '<button type="button" class="btn btn-primary btn-sm" id="contribAddBtn"></button></div>' +
        '<div class="contrib-list" id="contribList"></div>' +
        '<button type="button" class="btn btn-ghost btn-sm btn-block contrib-review-btn" id="contribReviewBtn"></button>';
      card.appendChild(body);
      document.getElementById("contribAddBtn").addEventListener("click", submitContribForm);
      document.getElementById("contribEmailInput").addEventListener("keydown", function(ev){
        if(ev.key === "Enter"){ ev.preventDefault(); submitContribForm(); }
      });
      document.getElementById("contribReviewBtn").addEventListener("click", function(){
        if(typeof closeAdminPanel === "function") closeAdminPanel(); // also closes this sub-modal
        if(typeof toggleSubmissionReviewMode === "function") toggleSubmissionReviewMode(true);
      });
    }
    document.getElementById("contribEmailInput").placeholder = t("contribEmailPlaceholder");
    document.getElementById("contribAddBtn").textContent = t("contribAdd");
    document.getElementById("contribReviewBtn").textContent = t("contribReviewBtn");
    renderContribList();
    loadContributors().then(renderContribList).catch(function(){ showToast(t("contribFail"), "error"); });
  }

  if(typeof fbAuth !== "undefined" && fbAuth.onAuthStateChanged){
    fbAuth.onAuthStateChanged(function(user){ refreshContributorFlag(user); });
  }
