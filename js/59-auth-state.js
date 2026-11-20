"use strict";

  /* ============================================================
     AUTH STATE — login/logout switches the data source (runs last)
  ============================================================ */
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
          maybeShowBaseUpdateBanner();
        });
      }).catch(function(err){
        console.error("Cloud load failed:", err);
        showToast(t("authLoadError"), "error");
      }).then(function(){
        setSyncing(false);
      });
    } else {
      hideBaseUpdateBanner();
      _currentViewingVersion = null; // no per-account pin once logged out
      if(_authFirstStateSeen){
        // Only reload from localStorage on an actual sign-out transition —
        // not on the very first (logged-out) auth check at page load, since
        // `db` already holds the right thing from the synchronous loadDB()
        // call in 01-data-model.js.
        db = loadDB();
        reconcileActiveSpaceAfterSwap();
      }
      // Guests get the published 總表 merged in read-only, straight from
      // whatever's currently latest (see loadGuestSpaceIndexBase above).
      loadGuestSpaceIndexBase().then(function(){
        render();
      });
    }
    _authFirstStateSeen = true;
  });
