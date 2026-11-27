"use strict";

  /* ============================================================
     PRACTICE LIST — local storage + cloud sync (users/{uid}/meta/practice).
     Guests: local only. Signed in: local-first, debounced push, dirty flag for retry.
     Logic: js/83-practice-logic.js. UI: js/84-practice-panel.js.
  ============================================================ */
  var PRACTICE_GUEST_KEY = "kendama-practice-guest-v1";
  var PRACTICE_PUSH_DELAY = 1500;
  var practiceData = null;      // data of the active account (lazy)
  var practiceUid = null;       // account practiceData belongs to (null = guest)
  var practiceTimer = null;

  function practiceKeyFor(uid){ return uid ? "kendama-practice-" + uid + "-v1" : PRACTICE_GUEST_KEY; }
  function practiceCurrentUid(){
    return typeof authCurrentUser !== "undefined" && authCurrentUser && authCurrentUser.uid ? authCurrentUser.uid : null;
  }
  // -> normalized data, or null when nothing is stored.
  function practiceLoadLocal(uid){
    var s = null;
    try { s = localStorage.getItem(practiceKeyFor(uid)); } catch(e){ s = null; }
    if(s == null) return null;
    try { return normalizePracticeData(JSON.parse(s)); } catch(e){ return normalizePracticeData(null); }
  }
  function practiceSaveLocal(uid, data){
    try { localStorage.setItem(practiceKeyFor(uid), JSON.stringify(data)); } catch(e){}
  }
  function practiceIsDirty(uid){
    try { return localStorage.getItem(practiceKeyFor(uid) + "-dirty") === "1"; } catch(e){ return false; }
  }
  function practiceSetDirty(uid, on){
    try {
      if(on) localStorage.setItem(practiceKeyFor(uid) + "-dirty", "1");
      else localStorage.removeItem(practiceKeyFor(uid) + "-dirty");
    } catch(e){}
  }

  // Data of the current account (loaded on first use / after an account switch).
  function practiceGet(){
    var uid = practiceCurrentUid();
    if(!practiceData || practiceUid !== uid){
      practiceUid = uid;
      practiceData = practiceLoadLocal(uid) || newPracticeData();
    }
    return practiceData;
  }

  // The UI calls this after every edit.
  function practiceChanged(){
    var data = practiceGet();
    data.clientUpdatedAt = Math.max(Date.now(), data.clientUpdatedAt + 1);
    practiceSaveLocal(practiceUid, data);
    if(practiceUid){ practiceSetDirty(practiceUid, true); practiceSchedulePush(); }
  }

  function practiceSchedulePush(){
    if(practiceTimer) clearTimeout(practiceTimer);
    practiceTimer = setTimeout(function(){ practiceTimer = null; practicePush(); }, PRACTICE_PUSH_DELAY);
  }
  function practiceDocRef(uid){ return fbStore.doc("users/" + uid + "/meta/practice"); }

  // Writes the current data when dirty. Never throws; failure leaves the dirty flag for a retry.
  function practicePush(){
    var uid = practiceUid;
    if(!uid || uid !== practiceCurrentUid() || !practiceIsDirty(uid)) return Promise.resolve(false);
    var data = practiceData, stamp = data.clientUpdatedAt;
    return practiceDocRef(uid).set({ lists: data.lists, dailyResetHour: data.dailyResetHour, clientUpdatedAt: stamp,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp() }).then(function(){
      if(practiceData && practiceData.clientUpdatedAt === stamp && practiceUid === uid) practiceSetDirty(uid, false);
      return true;
    }, function(){ return false; });
  }
  function practiceFlush(){
    if(practiceTimer){ clearTimeout(practiceTimer); practiceTimer = null; }
    return practicePush();
  }
  document.addEventListener("visibilitychange", function(){
    if(document.visibilityState === "hidden") practiceFlush();
  });

  // Called from js/59-auth-state.js with the user or null.
  function practiceOnAuth(user){
    if(practiceTimer){ clearTimeout(practiceTimer); practiceTimer = null; }
    practiceData = null; practiceUid = null;
    if(!user){ practiceRefreshUi(); return Promise.resolve(); }
    var uid = user.uid;
    practiceGet();
    practiceRefreshUi();
    return practiceDocRef(uid).get().then(function(snap){
      if(practiceCurrentUid() !== uid) return;
      var cloud = snap.exists ? normalizePracticeData(snap.data()) : null;
      var local = practiceLoadLocal(uid), guest = practiceLoadLocal(null);
      var r = practiceDecideSync(local, cloud, guest);
      if(r.action === "useCloud"){
        practiceData = r.data; practiceUid = uid;
        practiceSaveLocal(uid, r.data); practiceSetDirty(uid, false);
      } else if(r.action === "copyGuest"){
        practiceData = r.data; practiceUid = uid;
        practiceData.clientUpdatedAt = Math.max(Date.now(), practiceData.clientUpdatedAt + 1);
        practiceSaveLocal(uid, practiceData); practiceSetDirty(uid, true);
      } else if(r.action === "pushLocal"){
        practiceData = r.data; practiceUid = uid;
        practiceSetDirty(uid, true);
      } else if(practiceIsDirty(uid)){
        practiceSetDirty(uid, true); // equal stamps but an earlier push failed: retry
      }
      practiceRefreshUi();
      return practicePush();
    }).catch(function(){ /* offline / denied: keep local, retry on the next change or sign-in */ });
  }

  // Re-render the panel if it is open (defined in js/84-practice-panel.js).
  function practiceRefreshUi(){
    if(typeof practiceRender === "function" && typeof practiceIsOpen === "function" && practiceIsOpen()) practiceRender();
  }
