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
