"use strict";

  /* ============================================================
     SHELL — settings page (modal opened from the topbar gear)
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

  function renderSettingsUI(){
    function setText(id, val){ var el = document.getElementById(id); if(el) el.textContent = val; }
    var gear = document.getElementById("settingsBtn");
    gear.title = t("settings");
    gear.setAttribute("aria-label", t("settings"));
    if(typeof ICON_SETTINGS !== "undefined" && !gear.firstChild) gear.innerHTML = ICON_SETTINGS;

    setText("settingsTitle", t("settings"));
    var closeBtn = document.getElementById("settingsCloseBtn");
    closeBtn.title = t("settingsClose");
    closeBtn.setAttribute("aria-label", t("settingsClose"));
    if(!closeBtn.firstChild) closeBtn.innerHTML = ICON_X;

    // Admin panel button: admin-only, disabled until v0.6.
    var adminBtn = document.getElementById("settingsAdminBtn");
    adminBtn.hidden = !(typeof isAdminAccount === "function" && isAdminAccount());
    adminBtn.textContent = t("comingSoon");
    adminBtn.title = t("settingsAdminSoon");

    setText("settingsGuideLabel", t("settingsGuide"));
    setText("settingsNoticesLabel", t("settingsNotices"));
    setText("settingsSubmitLabel", t("settingsSubmit"));
    setText("settingsSubmitNote", t("settingsSubmitNote"));
    setText("settingsReportLabel", t("settingsReport"));
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
  document.getElementById("themeSwitch").addEventListener("click", function(ev){
    var btn = ev.target.closest(".theme-btn");
    if(btn) setThemePref(btn.getAttribute("data-theme-pref"));
  });
