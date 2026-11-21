"use strict";

  /* ============================================================
     SHELL — settings page (modal opened from the topbar settings button)
     Account / publish row logic stays in 52-auth.js (renderAuthUI);
     this file owns open/close, the static labels and the theme switch.
  ============================================================ */
  function isSettingsOpen(){
    return document.getElementById("settingsOverlay").classList.contains("show");
  }
  function openSettings(){
    renderSettingsUI();
    document.getElementById("settingsOverlay").classList.add("show");
  }
  function closeSettings(){
    document.getElementById("settingsOverlay").classList.remove("show");
    if(typeof closeNicknameEdit === "function") closeNicknameEdit();
  }

  // Privacy notice: its own modal, stacked above the settings page (z-index in settings css).
  function isPrivacyOpen(){
    return document.getElementById("privacyOverlay").classList.contains("show");
  }
  function openPrivacy(){
    renderSettingsUI();
    document.getElementById("privacyOverlay").classList.add("show");
  }
  function closePrivacy(){
    document.getElementById("privacyOverlay").classList.remove("show");
  }

  // Topbar settings button face: signed-out -> person icon; signed-in -> photo (or initial letter).
  function settingsBtnState(user){
    if(!user) return { kind: "icon", photoURL: "", initial: "" };
    var initial = ((user.displayName || user.email) || "?").trim().charAt(0).toUpperCase();
    return { kind: "avatar", photoURL: user.photoURL || "", initial: initial };
  }
  function renderSettingsBtnFace(btn){
    var st = settingsBtnState(typeof authCurrentUser !== "undefined" ? authCurrentUser : null);
    var key = st.kind + "|" + st.photoURL + "|" + st.initial;
    if(btn.getAttribute("data-face") === key && btn.firstChild) return;
    btn.setAttribute("data-face", key);
    btn.classList.toggle("has-avatar", st.kind === "avatar");
    btn.innerHTML = "";
    if(st.kind === "icon"){ btn.innerHTML = ICON_USER; return; }
    function letter(){
      btn.innerHTML = "";
      var sp = document.createElement("span");
      sp.className = "settings-btn-initial"; sp.textContent = st.initial;
      btn.appendChild(sp);
    }
    if(!st.photoURL){ letter(); return; }
    var img = document.createElement("img");
    img.className = "settings-btn-avatar"; img.alt = "";
    img.referrerPolicy = "no-referrer";
    img.onerror = letter;
    img.src = st.photoURL;
    btn.appendChild(img);
  }

  // Row 4 buttons ship disabled in index.html ("coming soon"); wire them up here
  // (forms live in js/74-forms.js, both require sign-in and check it themselves).
  function enableFormItems(){
    [["settingsSubmitLabel", "openSubmitForm"], ["settingsReportLabel", "openReportForm"]].forEach(function(p){
      var label = document.getElementById(p[0]);
      var btn = label && label.closest ? label.closest("button") : null;
      if(!btn) return;
      var soon = btn.querySelector("[data-soon]");
      if(soon && soon.parentNode) soon.parentNode.removeChild(soon);
      if(btn.getAttribute("data-form-ready")) return;
      btn.setAttribute("data-form-ready", "1");
      btn.disabled = false;
      btn.addEventListener("click", function(){
        if(typeof window[p[1]] === "function") window[p[1]]();
      });
    });
  }

  // Privacy notice (v0.8, D6 follow-up): what the site stores, shown in its own modal (openPrivacy).
  if(typeof addStrings === "function") addStrings({
    zh: {
      settingsGuide: "快速導覽",
      settingsPrivacy: "隱私說明",
      privacyBody: "・登入使用 Google 帳號，只用來辨識你的資料，名稱和信箱不會公開。\n" +
        "・你的成招、成招率、收藏、自訂表和備註存在你自己的雲端資料，只有你能讀寫。\n" +
        "・為了統計（最多收藏、最多成招、成招率分布、語言占比、活躍人數），會另存一份摘要：總表／檢定／賽事中你收藏與成招的招式編號、成招率、介面語言和最後活躍時間。不含名稱、備註或自訂表，只有管理員看得到，只以統計數字呈現。\n" +
        "・問題回報和投稿的內容會連同你的帳號名稱送給管理員。\n" +
        "・不販售、不提供第三方。想刪除資料，請用「問題回報」告訴我們。"
    },
    jp: {
      settingsGuide: "クイックガイド",
      settingsPrivacy: "プライバシー",
      privacyBody: "・ログインには Google アカウントを使い、データの識別のみに使用します。名前とメールは公開されません。\n" +
        "・成功記録、成功率、お気に入り、カスタム表、メモはあなた専用のクラウドデータに保存され、あなただけが読み書きできます。\n" +
        "・統計（お気に入り数、成功数、成功率の分布、言語の割合、アクティブ人数）のため、要約を別に保存します：総表・検定・大会でお気に入り／成功した技の ID、成功率、表示言語、最終アクティブ日時。名前・メモ・カスタム表は含まず、管理者のみが閲覧でき、統計値としてのみ表示します。\n" +
        "・問題の報告と投稿の内容は、アカウント名とともに管理者に送られます。\n" +
        "・販売や第三者への提供はしません。データの削除は「問題を報告」からご連絡ください。"
    },
    en: {
      settingsGuide: "Quick tour",
      settingsPrivacy: "Privacy",
      privacyBody: "- Sign-in uses your Google account, only to identify your data. Your name and email are never shown publicly.\n" +
        "- Your landed tricks, rates, favourites, custom tables and notes are stored in your own cloud data; only you can read or write them.\n" +
        "- For statistics (most favourited, most landed, rate distribution, languages, active users) a summary is kept separately: IDs of tricks you favourited or landed in the main / certification / contest tables, their rates, your UI language and last active time. It holds no names, notes or custom tables, is visible to admins only, and is shown only as totals.\n" +
        "- Problem reports and submissions are sent to admins with your account name.\n" +
        "- Nothing is sold or shared with third parties. To delete your data, tell us via \"Report a problem\"."
    }
  });

  function renderSettingsUI(){
    function setText(id, val){ var el = document.getElementById(id); if(el) el.textContent = val; }
    var gear = document.getElementById("settingsBtn");
    gear.title = t("settings");
    gear.setAttribute("aria-label", t("settings"));
    renderSettingsBtnFace(gear);

    setText("settingsTitle", t("settings"));
    var closeBtn = document.getElementById("settingsCloseBtn");
    closeBtn.title = t("settingsClose");
    closeBtn.setAttribute("aria-label", t("settingsClose"));
    if(!closeBtn.firstChild) closeBtn.innerHTML = ICON_X;

    // Admin panel button: admin-only (panel itself lives in 70-admin-panel.js).
    var adminBtn = document.getElementById("settingsAdminBtn");
    adminBtn.hidden = !(typeof isAdminAccount === "function" && isAdminAccount());
    adminBtn.textContent = t("adminOpen");
    adminBtn.title = t("adminOpen");

    setText("settingsGuideLabel", t("settingsGuide"));
    setText("settingsNoticesLabel", t("settingsNotices"));
    setText("settingsSubmitLabel", t("settingsSubmit"));
    setText("settingsSubmitNote", t("settingsSubmitNote"));
    setText("settingsReportLabel", t("settingsReport"));
    setText("settingsPrivacyLabel", t("settingsPrivacy"));
    setText("privacyTitle", t("settingsPrivacy"));
    setText("privacyText", t("privacyBody"));
    var pcb = document.getElementById("privacyCloseBtn");
    pcb.title = t("settingsClose");
    pcb.setAttribute("aria-label", t("settingsClose"));
    if(!pcb.firstChild) pcb.innerHTML = ICON_X;
    if(typeof renderPwaSettingsRow === "function") renderPwaSettingsRow();
    enableFormItems();
    Array.prototype.forEach.call(document.querySelectorAll("[data-soon]"), function(el){
      el.textContent = t("comingSoon");
    });

    var pref = typeof getThemePref === "function" ? getThemePref() : "system";
    var titles = { system: t("themeSystem"), dark: t("themeDark"), light: t("themeLight") };
    Array.prototype.forEach.call(document.querySelectorAll(".theme-btn"), function(btn){
      var p = btn.getAttribute("data-theme-pref");
      btn.classList.toggle("active", p === pref);
      btn.title = titles[p];
      btn.setAttribute("aria-label", titles[p]);
    });
  }

  document.getElementById("settingsBtn").addEventListener("click", openSettings);
  document.getElementById("settingsCloseBtn").addEventListener("click", closeSettings);
  document.getElementById("settingsOverlay").addEventListener("click", function(ev){
    if(ev.target.id === "settingsOverlay") closeSettings();
  });
  document.getElementById("settingsGuideBtn").addEventListener("click", function(){
    closeSettings();
    if(typeof startTour === "function") startTour("full");
  });
  document.getElementById("settingsPrivacyBtn").addEventListener("click", openPrivacy);
  document.getElementById("privacyCloseBtn").addEventListener("click", closePrivacy);
  document.getElementById("privacyOverlay").addEventListener("click", function(ev){
    if(ev.target.id === "privacyOverlay") closePrivacy();
  });
  document.getElementById("themeSwitch").addEventListener("click", function(ev){
    var btn = ev.target.closest(".theme-btn");
    if(btn) setThemePref(btn.getAttribute("data-theme-pref"));
  });
