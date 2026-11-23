"use strict";

  /* ============================================================
     AUTH — sign-in/out, nickname, account menu UI
  ============================================================ */
  /* ------------------------------------------------------------
     Sign-in / sign-out
  ------------------------------------------------------------ */
  function authLogin(){
    var provider = new firebase.auth.GoogleAuthProvider();
    fbAuth.signInWithPopup(provider).catch(function(err){
      console.error("Sign-in failed:", err);
      if(err && err.code === "auth/popup-closed-by-user") return;
      showToast(t("authLoginError") + (err && err.code ? " (" + err.code + ")" : ""), "error");
    });
  }

  function authLogout(){
    closeAuthMenu();
    // Push pending changes first (never prompts; a conflict just stays pending on this device).
    flushSync({ silent: true }).then(function(){
      return fbAuth.signOut();
    }).then(function(){
      showToast(t("authLoggingOut"));
    }).catch(function(err){ console.error("Sign-out failed:", err); });
  }

  function authUpdateNickname(newName){
    newName = (newName || "").trim();
    if(!newName){
      showNicknameError(t("authNicknameEmpty"));
      showToast(t("authNicknameEmpty"), "error");
      return;
    }
    if(!authCurrentUser) return;
    var editBtn = document.getElementById("authMenuEditBtn");
    editBtn.disabled = true;
    authCurrentUser.updateProfile({ displayName: newName }).then(function(){
      authCurrentUser.displayName = newName; // compat SDK updates this too, but set explicitly to be safe
      closeNicknameEdit();
      renderAuthUI();
      showToast(t("authNicknameUpdated"));
    }).catch(function(err){
      console.error("Nickname update failed:", err);
      showToast(t("authNicknameError"), "error");
    }).then(function(){
      editBtn.disabled = false;
    });
  }

  /* ------------------------------------------------------------
     UI
  ------------------------------------------------------------ */
  // Account UI now lives in the settings page (js/14-shell-settings.js);
  // "closing the menu" just closes the nickname modal if open.
  function closeAuthMenu(){
    closeNicknameEdit();
  }

  // Nickname edit: its own modal (#nicknameOverlay), stacked above settings.
  function isNicknameEditOpen(){
    return document.getElementById("nicknameOverlay").classList.contains("show");
  }
  function showNicknameError(msg){
    var el = document.getElementById("nicknameError");
    el.textContent = msg || "";
    el.classList.toggle("show", !!msg);
  }
  function openNicknameEdit(){
    var input = document.getElementById("nicknameInput");
    input.placeholder = t("authNicknamePlaceholder");
    input.value = (authCurrentUser && authCurrentUser.displayName) || "";
    showNicknameError("");
    document.getElementById("nicknameOverlay").classList.add("show");
    input.focus();
    input.select();
  }
  function closeNicknameEdit(){
    document.getElementById("nicknameOverlay").classList.remove("show", "kb-top");
    document.getElementById("nicknameOverlay").style.height = "";
    showNicknameError("");
  }

  function applyAvatar(imgEl, fallbackEl){
    if(authCurrentUser && authCurrentUser.photoURL){
      imgEl.src = authCurrentUser.photoURL;
      imgEl.hidden = false;
      fallbackEl.textContent = "";
    } else {
      imgEl.hidden = true;
      imgEl.src = "";
      var initial = ((authCurrentUser && (authCurrentUser.displayName || authCurrentUser.email)) || "?").trim().charAt(0).toUpperCase();
      fallbackEl.textContent = initial;
    }
  }

  function renderAuthUI(){
    var loginBtn = document.getElementById("authLoginBtn");
    var userWidget = document.getElementById("authUserWidget");
    loginBtn.title = t("authLogin");
    loginBtn.textContent = t("authLogin");

    if(authCurrentUser){
      loginBtn.hidden = true;
      userWidget.hidden = false;
      applyAvatar(document.getElementById("authMenuAvatarImg"), document.getElementById("authMenuAvatarFallback"));
      document.getElementById("authMenuName").textContent = authCurrentUser.displayName || "";
      document.getElementById("authMenuEmail").textContent = authCurrentUser.email || "";
      document.getElementById("authMenuEditBtn").title = t("authEditNickname");
      document.getElementById("nicknameTitle").textContent = t("authEditNickname");
      document.getElementById("nicknameSaveBtn").textContent = t("authNicknameSave");
      document.getElementById("nicknameCancelBtn").textContent = t("authNicknameCancel");
      var ncb = document.getElementById("nicknameCloseBtn");
      ncb.title = t("settingsClose");
      ncb.setAttribute("aria-label", t("settingsClose"));
      if(!ncb.firstChild) ncb.innerHTML = ICON_X;
      document.getElementById("authLogoutBtn").textContent = t("authLogout");
    } else {
      loginBtn.hidden = false;
      userWidget.hidden = true;
      closeAuthMenu();
    }

    renderSyncUI();
    if(typeof renderSettingsUI === "function") renderSettingsUI(); // admin button visibility
  }

  document.getElementById("authLoginBtn").addEventListener("click", authLogin);
  document.getElementById("authLogoutBtn").addEventListener("click", authLogout);
  document.getElementById("authMenuEditBtn").addEventListener("click", function(ev){
    ev.stopPropagation();
    openNicknameEdit();
  });
  document.getElementById("nicknameCancelBtn").addEventListener("click", closeNicknameEdit);
  document.getElementById("nicknameCloseBtn").addEventListener("click", closeNicknameEdit);
  document.getElementById("nicknameOverlay").addEventListener("click", function(ev){
    if(ev.target.id === "nicknameOverlay") closeNicknameEdit();
  });
  document.getElementById("nicknameSaveBtn").addEventListener("click", function(){
    authUpdateNickname(document.getElementById("nicknameInput").value);
  });
  // Phones: keep the dialog at the top while the input is focused so the keyboard can't cover it.
  document.getElementById("nicknameInput").addEventListener("focus", function(){
    if(window.innerWidth <= 860) document.getElementById("nicknameOverlay").classList.add("kb-top");
  });
  document.getElementById("nicknameInput").addEventListener("blur", function(){
    document.getElementById("nicknameOverlay").classList.remove("kb-top");
  });
  if(window.visualViewport){
    window.visualViewport.addEventListener("resize", function(){
      var ov = document.getElementById("nicknameOverlay");
      if(!ov.classList.contains("show")) return;
      ov.style.height = window.visualViewport.height + "px"; // overlay follows the visible area above the keyboard
      if(document.activeElement !== document.getElementById("nicknameInput")) ov.style.height = "";
    });
  }
  document.getElementById("nicknameInput").addEventListener("keydown", function(ev){
    if(ev.key === "Enter"){ ev.preventDefault(); authUpdateNickname(ev.target.value); }
  });
