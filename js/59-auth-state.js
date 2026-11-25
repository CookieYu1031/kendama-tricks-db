"use strict";

  /* ============================================================
     AUTH STATE — login/logout switches the data source (runs last)
  ============================================================ */
  /* ------------------------------------------------------------
     Auth state -> data source switch
  ------------------------------------------------------------ */
  // Local-first: the app already opened from the last user's cache (see loadDB in 01).
  // Here auth confirms that user (then syncs once, no polling) or falls back to guest.
  fbAuth.onAuthStateChanged(function(user){
    authCurrentUser = user;

    if(user){
      var swapped = activateUserCache(user);
      renderAuthUI();
      if(swapped){ reconcileActiveSpaceAfterSwap(); render(); }
      refreshAdminFlag(user.uid);
      // Reconciles with the cloud: pushes pending edits, loads newer cloud data, asks on conflict.
      syncReconcile({}).then(function(){
        renderAuthUI();
        maybeShowBaseUpdateBanner();
        if(typeof shareOnAuth === "function") shareOnAuth();
      }).then(bootSplashDone, bootSplashDone); // new device: nothing cached to show before this
    } else {
      hideBaseUpdateBanner();
      _currentViewingVersion = null; // no per-account pin once logged out
      var wasUser = !!userCache;
      deactivateUserCache();
      renderAuthUI();
      if(wasUser || _authFirstStateSeen){
        // Guests hold no saved data of their own (read-only): back to the empty view.
        db = emptyDB();
        reconcileActiveSpaceAfterSwap();
      }
      // Guests get the published 總表 merged in read-only, straight from
      // whatever's currently latest (see loadGuestSpaceIndexBase above).
      loadGuestSpaceIndexBase().then(function(){
        render();
      }).then(bootSplashDone, bootSplashDone);
      if(typeof shareOnGuest === "function") shareOnGuest(); // pending ?s=&i= share link: ask to sign in
    }
    if(typeof practiceOnAuth === "function") practiceOnAuth(user);
    if(typeof maybeStartTour==="function") maybeStartTour(user);
    _authFirstStateSeen = true;
  });
