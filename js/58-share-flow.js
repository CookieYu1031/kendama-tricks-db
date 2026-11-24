"use strict";

  /* ============================================================
     SHARE flow (v0.9.2) — DOM + Firestore glue for js/58-share.js (send, receive, pending link).
     Loaded right after js/58-share.js (pure logic, strings, constants).
  ============================================================ */
  /* ---------------- send (DOM + Firestore) ---------------- */
  function shareCopyLink(url, title){
    if(typeof navigator !== "undefined" && navigator.share && /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent || "")){
      return navigator.share({ title: title, url: url }).catch(function(e){
        if(e && e.name === "AbortError") return;
        return shareCopyText(url);
      });
    }
    return shareCopyText(url);
  }
  function shareCopyText(url){
    var done = function(){ showToast(t("shareLinkCopied")); };
    if(navigator.clipboard && navigator.clipboard.writeText){
      return navigator.clipboard.writeText(url).then(done, function(){ window.prompt(t("shareLinkIs"), url); });
    }
    window.prompt(t("shareLinkIs"), url);
    return Promise.resolve();
  }

  // kind: "space" | "folder" | "trick"; id: table / category / trick id (becomes the link's i=).
  // Writes (overwrites) the public snapshot shares/{uid}_{id}, then copies / shares the link.
  function shareRun(kind, id){
    if(isGuest() || !authCurrentUser){ showToast(t("shareNeedLogin"), "error"); return Promise.resolve(false); }
    var docId = shareDocId(authCurrentUser.uid, id);
    var built = null;
    if(docId){
      if(kind === "trick"){
        var btr = getTrick(id);
        built = btr && !btr.virtual && shareIsBaseTrick(btr) ? shareBuildBaseTrickPayload(btr) : shareBuildTrickPayload(id);
      } else built = shareBuildFolderPayload(kind, id);
    }
    var p = built && shareSanitizePayload(built);
    if(!p) { showToast(t("shareEmpty"), "error"); return Promise.resolve(false); }
    var json = shareSerialize(p);
    if(json === null){ showToast(t("shareTooBig"), "error"); return Promise.resolve(false); }
    var title = shareTitleOf(p);
    showToast(t("shareWorking"));
    return fbStore.collection("shares").doc(docId).set({ ownerUid: authCurrentUser.uid, itemId: id,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      kind: kind === "trick" ? "trick" : "folder", title: title, payload: json, v: SHARE_VERSION })
      .then(function(){ return shareCopyLink(shareUrlFor(authCurrentUser.uid, id), title); })
      .then(function(){ return true; })
      .catch(function(err){ console.error("share failed:", err); showToast(t("shareFailed"), "error"); return false; });
  }

  /* ---------------- receive (DOM + Firestore) ---------------- */
  function shareGoTo(nav){
    if(nav.kind === "trick" && typeof goToTrickLocation === "function"){ goToTrickLocation(nav.id); return; }
    state.activeSpace = FAV_TABLE_ID;
    try{ localStorage.setItem(SPACE_KEY, state.activeSpace); }catch(e){ /* ignore */ }
    state.path = pathToContainer(nav.id); clearDrawerState();
    render();
  }

  function shareGetPending(){
    try{
      var o = JSON.parse(sessionStorage.getItem(SHARE_PENDING_KEY));
      return (o && shareDocId(o.s, o.i)) ? { s: o.s, i: o.i } : null;
    }catch(e){ return null; }
  }
  function shareClearPending(){ try{ sessionStorage.removeItem(SHARE_PENDING_KEY); }catch(e){ /* ignore */ } }

  // Runs at load: remember ?s=&i= (survives login) and strip it from the URL.
  function shareCaptureFromUrl(){
    if(typeof location === "undefined") return;
    var link = shareParseLink(location.search);
    if(!link) return;
    try{ sessionStorage.setItem(SHARE_PENDING_KEY, JSON.stringify(link)); }catch(e){ /* ignore */ }
    try{
      var u = new URL(location.href);
      u.searchParams.delete("s"); u.searchParams.delete("i");
      history.replaceState(null, "", u.pathname + (u.search || "") + u.hash);
    }catch(e){ /* ignore */ }
  }

  // js/59 calls this for a guest session: ask to sign in (the pending link stays for after login).
  function shareOnGuest(){ if(shareGetPending()) showToast(t("shareOpenNeedLogin")); }

  // js/59 calls this after login + sync settled: copies the pending share into 收藏 > 外部匯入.
  function shareOnAuth(){
    var link = shareGetPending();
    if(!link || isGuest() || !authCurrentUser) return Promise.resolve(false);
    shareClearPending();
    var key = shareDocId(link.s, link.i);
    return fbStore.collection("shares").doc(key).get().then(function(snap){
      var d = snap.exists ? snap.data() : null;
      var payload = null;
      if(d && d.ownerUid === link.s && typeof d.payload === "string" && d.payload.length <= SHARE_MAX_BYTES){
        try{ payload = JSON.parse(d.payload); }catch(e){ payload = null; }
      }
      var res = payload ? shareApply(payload, key) : { ok: false, err: "shareLoadFailed" };
      if(!res.ok){ showToast(t(res.err), "error"); return false; }
      shareGoTo(res.nav);
      showToast(t(res.dup ? "shareDup" : "shareAdded"));
      if(res.truncated) setTimeout(function(){ showToast(t("shareTruncated"), "error"); }, 2600);
      return true;
    }).catch(function(err){ console.error("share load failed:", err); showToast(t("shareLoadFailed"), "error"); return false; });
  }

  shareCaptureFromUrl();
