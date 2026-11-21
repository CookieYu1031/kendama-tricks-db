"use strict";

  /* ============================================================
     USER STATS (企劃書 §三.8, D6) — one small public-table summary per signed-in user:
     userStats/{uid}. Feeds the admin stats card (js/75-admin-stats.js). Written after a
     successful cloud sync (hook in 54), only when it changed or once per day, so
     lastActiveAt stays fresh for the 7/30-day active counts.
     Holds only favorite trick ids from t00/t01/t02 (no landed/rates since v0.10); no names, no personal notes.
  ============================================================ */
  var USER_STATS_MAX = 2000;
  var USER_STATS_TABLES = ["t00", "t01", "t02"];
  var USER_STATS_KEY_PREFIX = "kdb-userstats-";
  var USER_STATS_DAY_MS = 24 * 60 * 60 * 1000;

  // Pure. tricks: db.tricks; belongsFn(trick, spaceId) -> bool; lang: "zh"|"jp"|"en".
  function buildUserStatsPayload(tricks, belongsFn, lang){
    var favorites = [];
    (tricks || []).forEach(function(tr){
      if(!tr || !tr.id) return;
      var pub = USER_STATS_TABLES.some(function(sid){ return belongsFn(tr, sid); });
      if(!pub) return;
      if(tr.favorite && favorites.length < USER_STATS_MAX) favorites.push(tr.id);
    });
    favorites.sort();
    return { lang: (lang === "jp" || lang === "en") ? lang : "zh", favorites: favorites };
  }
  // Pure, order-stable string hash of a payload.
  function userStatsHash(p){
    var s = p.lang + "|" + p.favorites.join(",");
    var h = 5381;
    for(var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
    return String(h >>> 0) + ":" + s.length;
  }
  // Pure. prev = { hash, at } or null.
  function userStatsShouldWrite(hash, prev, now){
    if(!prev || prev.hash !== hash) return true;
    return !(prev.at > 0) || (now - prev.at) >= USER_STATS_DAY_MS;
  }

  function readUserStatsMark(uid){
    try{ var m = JSON.parse(localStorage.getItem(USER_STATS_KEY_PREFIX + uid)); return (m && typeof m === "object") ? m : null; }
    catch(e){ return null; }
  }
  function writeUserStatsMark(uid, mark){
    try{ localStorage.setItem(USER_STATS_KEY_PREFIX + uid, JSON.stringify(mark)); }catch(e){ /* ignore */ }
  }

  var _userStatsBusy = false;
  // Fire-and-forget; never throws, never blocks sync. Resolves to "written" | "skipped" | "error".
  function writeUserStatsIfNeeded(){
    if(_userStatsBusy || !authCurrentUser || !userCache || typeof fbStore === "undefined") return Promise.resolve("skipped");
    var uid = authCurrentUser.uid;
    var payload = buildUserStatsPayload(db.tricks, trickBelongsToSpace, state.lang);
    var hash = userStatsHash(payload);
    var prev = readUserStatsMark(uid);
    var now = Date.now();
    if(!userStatsShouldWrite(hash, prev, now)) return Promise.resolve("skipped");
    _userStatsBusy = true;
    var ref = fbStore.doc("userStats/" + uid);
    var needCreated = !(prev && prev.created);
    var pre = needCreated ? ref.get().then(function(s){ return !s.exists; }) : Promise.resolve(false);
    return pre.then(function(isNew){
      var data = {
        lang: payload.lang, favorites: payload.favorites,
        lastActiveAt: firebase.firestore.FieldValue.serverTimestamp()
      };
      if(isNew) data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
      // Full set (no merge): drops legacy landed/rates keys so the hasOnly rule accepts old docs.
      // createdAt is preserved by re-reading it when the doc exists (rule requires it unchanged).
      if(isNew) return ref.set(data);
      return ref.get().then(function(s){
        var old = s.exists ? s.data() : null;
        if(old && old.createdAt) data.createdAt = old.createdAt;
        return ref.set(data);
      });
    }).then(function(){
      writeUserStatsMark(uid, { hash: hash, at: now, created: true });
      _userStatsBusy = false;
      return "written";
    }).catch(function(err){
      _userStatsBusy = false;
      console.error("userStats write failed:", err);
      return "error";
    });
  }
