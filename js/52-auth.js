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
    if(!newName){ showToast(t("authNicknameEmpty"), "error"); return; }
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
  function closeAuthMenu(){
    document.getElementById("authUserWidget").classList.remove("open");
    closeNicknameEdit();
  }

  function openNicknameEdit(){
    var input = document.getElementById("authMenuNameInput");
    input.placeholder = t("authNicknamePlaceholder");
    input.value = (authCurrentUser && authCurrentUser.displayName) || "";
    document.getElementById("authMenuAccount").hidden = true;
    document.getElementById("authMenuNameEdit").hidden = false;
    input.focus();
    input.select();
  }
  function closeNicknameEdit(){
    document.getElementById("authMenuAccount").hidden = false;
    document.getElementById("authMenuNameEdit").hidden = true;
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

    if(authCurrentUser){
      loginBtn.hidden = true;
      userWidget.hidden = false;
      applyAvatar(document.getElementById("authAvatarImg"), document.getElementById("authAvatarFallback"));
      applyAvatar(document.getElementById("authMenuAvatarImg"), document.getElementById("authMenuAvatarFallback"));
      document.getElementById("authMenuName").textContent = authCurrentUser.displayName || "";
      document.getElementById("authMenuEmail").textContent = authCurrentUser.email || "";
      document.getElementById("authMenuEditBtn").title = t("authEditNickname");
      document.getElementById("authMenuNameSave").textContent = t("authNicknameSave");
      document.getElementById("authMenuNameCancel").textContent = t("authNicknameCancel");
      document.getElementById("authLogoutBtn").textContent = t("authLogout");
    } else {
      loginBtn.hidden = false;
      userWidget.hidden = true;
      closeAuthMenu();
    }

    renderSyncUI();
    document.getElementById("publishUpdateBtn").hidden = !isAdminAccount();
    document.getElementById("publishUpdateBtn").title = t("publishUpdate");
  }

  document.getElementById("authLoginBtn").addEventListener("click", authLogin);
  document.getElementById("authAvatarBtn").addEventListener("click", function(ev){
    ev.stopPropagation();
    document.getElementById("authUserWidget").classList.toggle("open");
    closeNicknameEdit();
  });
  document.getElementById("authLogoutBtn").addEventListener("click", authLogout);
  document.getElementById("authMenuEditBtn").addEventListener("click", function(ev){
    ev.stopPropagation();
    openNicknameEdit();
  });
  document.getElementById("authMenuNameCancel").addEventListener("click", function(ev){
    ev.stopPropagation();
    closeNicknameEdit();
  });
  document.getElementById("authMenuNameSave").addEventListener("click", function(ev){
    ev.stopPropagation();
    authUpdateNickname(document.getElementById("authMenuNameInput").value);
  });
  document.getElementById("authMenuNameInput").addEventListener("keydown", function(ev){
    ev.stopPropagation();
    if(ev.key === "Enter") authUpdateNickname(ev.target.value);
    else if(ev.key === "Escape") closeNicknameEdit();
  });
  document.addEventListener("click", function(ev){
    var widget = document.getElementById("authUserWidget");
    if(widget.classList.contains("open") && !widget.contains(ev.target)) closeAuthMenu();
  });
