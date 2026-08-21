"use strict";

  /* ============================================================
     AUTH + CLOUD SYNC (base data + per-space diff)
     ------------------------------------------------------------
     Data model recap: `db` (see 01-data-model.js) stays exactly the same
     in-memory shape as before — { categories, tricks, spaces } flat
     arrays — every render/modal/etc. function keeps working on it
     unchanged. This file only concerns itself with how that shape gets
     serialized to/from Firestore once someone is logged in.

     BASE DATA — data/base/{spaceId}.json (one file per *built-in* space:
     see DEFAULT_SPACES in 01-data-model.js), each { version, categories,
     tricks }. Ships with the app and updates whenever Cookie edits those
     files — see data/base/README.md. Custom (user-created) spaces have
     no base file; their base is treated as empty.

     USER DIFF — Firestore, split by space (not one big document):
       users/{uid}/spaceData/{spaceId} -> {
         baseVersion,
         added:    { categories:[...], tricks:[...] },
         modified: { categories:[...], tricks:[...] },
         removed:  { categoryIds:[...], trickIds:[...] },
         updatedAt
       }
       users/{uid}/meta/spaces -> { spaces:[...db.spaces...], updatedAt }
         (the shelf list itself — icons/names/order/viewMode, including
         any custom spaces — is small enough to store whole, not diffed)

     Every save recomputes each space's diff from scratch by comparing
     the *current* `db` against that space's base data — nothing is
     patched incrementally, so there's no separate tombstone bookkeeping
     to maintain across sessions: an item merely absent from "current"
     but present in "base" already reads as removed.

     A trick can legitimately belong to categories in more than one space
     at once (e.g. tagged into both 招式庫 and 收藏 via the drawer's
     quick-toggle bucket) — such tricks are simply written into every
     space's diff they currently touch. That's intentional duplication
     (Firestore has no cross-document joins), not a bug; merging back
     just unions by id, and the copies are always identical since they
     all come from the same in-memory trick object.
  ============================================================ */

  var BASE_DATA_DIR = "data/base/";
  var DEFAULT_SPACE_IDS = DEFAULT_SPACES.map(function(s){ return s.id; });

  var authCurrentUser = null;
  var _authFirstStateSeen = false; // avoids reloading local data before we know anything, on the very first (logged-out) check at page load
  var _cloudSaveTimer = null;
  var CLOUD_SAVE_DEBOUNCE_MS = 600;
  var baseDataCache = {}; // spaceId -> {version, categories, tricks}

  function isLoggedIn(){ return !!authCurrentUser; }

  /* ------------------------------------------------------------
     Base data loading (cached per space id for the page's lifetime)
  ------------------------------------------------------------ */
  function fetchBaseSpaceData(spaceId){
    if(baseDataCache[spaceId]) return Promise.resolve(baseDataCache[spaceId]);
    if(DEFAULT_SPACE_IDS.indexOf(spaceId) === -1){
      // Custom space: no shipped base file, base is just empty.
      var empty = { version: 0, categories: [], tricks: [] };
      baseDataCache[spaceId] = empty;
      return Promise.resolve(empty);
    }
    return fetch(BASE_DATA_DIR + spaceId + ".json")
      .then(function(res){ return res.ok ? res.json() : { version: 0, categories: [], tricks: [] }; })
      .catch(function(){ return { version: 0, categories: [], tricks: [] }; })
      .then(function(data){
        var normalized = {
          version: data.version || 0,
          categories: Array.isArray(data.categories) ? data.categories : [],
          tricks: Array.isArray(data.tricks) ? data.tricks : []
        };
        baseDataCache[spaceId] = normalized;
        return normalized;
      });
  }

  /* ------------------------------------------------------------
     Diff computation (current db -> per-space diff vs its base)
  ------------------------------------------------------------ */
  function allKnownSpaceIds(){
    var ids = DEFAULT_SPACE_IDS.slice();
    db.spaces.forEach(function(s){ if(ids.indexOf(s.id) === -1) ids.push(s.id); });
    return ids;
  }
  function categoriesForSpace(spaceId){
    return db.categories.filter(function(c){ return c.spaceId === spaceId; });
  }
  function tricksForSpace(spaceId){
    var catIds = {};
    categoriesForSpace(spaceId).forEach(function(c){ catIds[c.id] = true; });
    return db.tricks.filter(function(t){
      return t.categoryIds.some(function(cid){ return catIds[cid]; });
    });
  }
  function deepEqual(a, b){ return JSON.stringify(a) === JSON.stringify(b); }

  function computeSpaceDiff(spaceId, base){
    var baseCatMap = {}; base.categories.forEach(function(c){ baseCatMap[c.id] = c; });
    var baseTrickMap = {}; base.tricks.forEach(function(t){ baseTrickMap[t.id] = t; });

    var curCats = categoriesForSpace(spaceId);
    var curTricks = tricksForSpace(spaceId);
    var curCatIds = {}; curCats.forEach(function(c){ curCatIds[c.id] = true; });
    var curTrickIds = {}; curTricks.forEach(function(t){ curTrickIds[t.id] = true; });

    var addedCats = [], modifiedCats = [], removedCatIds = [];
    curCats.forEach(function(c){
      if(!baseCatMap[c.id]) addedCats.push(c);
      else if(!deepEqual(c, baseCatMap[c.id])) modifiedCats.push(c);
    });
    Object.keys(baseCatMap).forEach(function(id){ if(!curCatIds[id]) removedCatIds.push(id); });

    var addedTricks = [], modifiedTricks = [], removedTrickIds = [];
    curTricks.forEach(function(t){
      if(!baseTrickMap[t.id]) addedTricks.push(t);
      else if(!deepEqual(t, baseTrickMap[t.id])) modifiedTricks.push(t);
    });
    Object.keys(baseTrickMap).forEach(function(id){ if(!curTrickIds[id]) removedTrickIds.push(id); });

    return {
      baseVersion: base.version,
      added: { categories: addedCats, tricks: addedTricks },
      modified: { categories: modifiedCats, tricks: modifiedTricks },
      removed: { categoryIds: removedCatIds, trickIds: removedTrickIds }
    };
  }

  /* ------------------------------------------------------------
     Merge (base + one space's diff -> that space's live categories/tricks)
  ------------------------------------------------------------ */
  function mergeSpaceData(base, diff){
    var catMap = {}; base.categories.forEach(function(c){ catMap[c.id] = c; });
    var trickMap = {}; base.tricks.forEach(function(t){ trickMap[t.id] = t; });
    if(diff){
      (diff.added && diff.added.categories || []).concat(diff.modified && diff.modified.categories || [])
        .forEach(function(c){ catMap[c.id] = c; });
      (diff.removed && diff.removed.categoryIds || []).forEach(function(id){ delete catMap[id]; });

      (diff.added && diff.added.tricks || []).concat(diff.modified && diff.modified.tricks || [])
        .forEach(function(t){ trickMap[t.id] = t; });
      (diff.removed && diff.removed.trickIds || []).forEach(function(id){ delete trickMap[id]; });
    }
    return { categories: objVals(catMap), tricks: objVals(trickMap) };
  }

  function mergeAllSpaces(spaceIds, baseMap, diffMap){
    var allCats = {}, allTricks = {};
    spaceIds.forEach(function(sid){
      var merged = mergeSpaceData(baseMap[sid], diffMap[sid]);
      merged.categories.forEach(function(c){ allCats[c.id] = c; });
      merged.tricks.forEach(function(t){ allTricks[t.id] = t; });
    });
    return { categories: objVals(allCats), tricks: objVals(allTricks) };
  }

  /* ------------------------------------------------------------
     Save: current db -> per-space diff docs + spaces meta doc
  ------------------------------------------------------------ */
  function saveDiffToCloud(){
    if(!authCurrentUser) return Promise.resolve();
    var uid = authCurrentUser.uid;
    var spaceIds = allKnownSpaceIds();
    var userRef = fbStore.collection("users").doc(uid);
    return Promise.all(spaceIds.map(fetchBaseSpaceData)).then(function(bases){
      var batch = fbStore.batch();
      spaceIds.forEach(function(sid, i){
        var diff = computeSpaceDiff(sid, bases[i]);
        diff.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
        batch.set(userRef.collection("spaceData").doc(sid), diff);
      });
      batch.set(userRef.collection("meta").doc("spaces"), {
        spaces: db.spaces,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      return batch.commit();
    }).catch(function(err){
      console.error("Cloud save failed:", err);
      showToast(t("authSaveError"), "error");
    });
  }

  function queueCloudSave(){
    if(_cloudSaveTimer) clearTimeout(_cloudSaveTimer);
    _cloudSaveTimer = setTimeout(function(){
      _cloudSaveTimer = null;
      saveDiffToCloud();
    }, CLOUD_SAVE_DEBOUNCE_MS);
  }

  /* ------------------------------------------------------------
     Load: per-space diff docs + spaces meta doc -> merged db
  ------------------------------------------------------------ */
  function loadMergedDBFromCloud(uid){
    var userRef = fbStore.collection("users").doc(uid);
    return userRef.collection("spaceData").get().then(function(snap){
      var diffMap = {};
      snap.forEach(function(doc){ diffMap[doc.id] = doc.data(); });
      var spaceIds = Object.keys(diffMap);
      DEFAULT_SPACE_IDS.forEach(function(id){ if(spaceIds.indexOf(id) === -1) spaceIds.push(id); });

      return userRef.collection("meta").doc("spaces").get().then(function(metaSnap){
        var spacesList = (metaSnap.exists && Array.isArray(metaSnap.data().spaces) && metaSnap.data().spaces.length)
          ? metaSnap.data().spaces
          : DEFAULT_SPACES.map(function(s){ return { id:s.id, icon:s.icon, name:s.name, viewMode:s.viewMode }; });

        return Promise.all(spaceIds.map(fetchBaseSpaceData)).then(function(bases){
          var baseMap = {}; spaceIds.forEach(function(id, i){ baseMap[id] = bases[i]; });
          var merged = mergeAllSpaces(spaceIds, baseMap, diffMap);
          return normalizeDB({ categories: merged.categories, tricks: merged.tricks, spaces: spacesList });
        });
      });
    });
  }

  // After swapping `db` for a freshly-loaded object (cloud or local),
  // make sure state.activeSpace still points at a space that exists.
  function reconcileActiveSpaceAfterSwap(){
    if(!db.spaces.some(function(s){ return s.id === state.activeSpace; })){
      state.activeSpace = db.spaces[0].id;
    }
    state.path = [];
    state.detailTrickId = null;
    if(typeof closeDrawer === "function") closeDrawer();
  }

  function setSyncing(on){
    document.getElementById("authWidget").classList.toggle("syncing", !!on);
  }

  /* ------------------------------------------------------------
     Sign-in / sign-out
  ------------------------------------------------------------ */
  function authLogin(){
    var provider = new firebase.auth.GoogleAuthProvider();
    fbAuth.signInWithPopup(provider).catch(function(err){
      console.error("Sign-in failed:", err);
      if(err && err.code === "auth/popup-closed-by-user") return;
      showToast(t("authLoginError"), "error");
    });
  }

  function authLogout(){
    closeAuthMenu();
    fbAuth.signOut().then(function(){
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

  /* ------------------------------------------------------------
     Auth state -> data source switch
  ------------------------------------------------------------ */
  fbAuth.onAuthStateChanged(function(user){
    authCurrentUser = user;
    renderAuthUI();

    if(user){
      setSyncing(true);
      var userRef = fbStore.collection("users").doc(user.uid);
      userRef.collection("spaceData").limit(1).get().then(function(snap){
        if(snap.empty){
          // Brand-new account: nothing in the cloud yet, so treat whatever's
          // currently in `db` (loaded from this browser's localStorage) as
          // the starting point and push it up as the initial diff.
          showToast(t("authSyncingLocal"));
          return saveDiffToCloud().then(function(){
            showToast(t("authSyncedLocal"));
          });
        }
        return loadMergedDBFromCloud(user.uid).then(function(merged){
          db = merged;
          reconcileActiveSpaceAfterSwap();
          render();
        });
      }).catch(function(err){
        console.error("Cloud load failed:", err);
        showToast(t("authLoadError"), "error");
      }).then(function(){
        setSyncing(false);
      });
    } else if(_authFirstStateSeen){
      // Only reload from localStorage on an actual sign-out transition —
      // not on the very first (logged-out) auth check at page load, since
      // `db` already holds the right thing from the synchronous loadDB()
      // call in 01-data-model.js.
      db = loadDB();
      reconcileActiveSpaceAfterSwap();
      render();
    }
    _authFirstStateSeen = true;
  });
