"use strict";

  /* ============================================================
     SHELL — updates page (通知與近期更新) + unread red dot.
     Reads published versions via T1's listPublishedVersions /
     getPublishedPointer (js/51); both guarded with typeof.
  ============================================================ */
  addStrings({
    zh:{ updatesTitle:"通知與近期更新", updatesEmpty:"還沒有發布過的更新", updatesError:"讀取更新失敗，請檢查網路連線", updatesLoading:"讀取中…", updatesNoNote:"（沒有備註）",
         inboxTitle:"通知", inboxEmpty:"沒有通知",inboxFromAdmin:"管理員", inboxRelated:"相關招式：", versionsTitle:"近期更新" },
    jp:{ updatesTitle:"お知らせと最近の更新", updatesEmpty:"発行された更新はまだありません", updatesError:"更新の読み込みに失敗しました。ネット接続をご確認ください", updatesLoading:"読み込み中…", updatesNoNote:"（メモなし）",
         inboxTitle:"お知らせ", inboxEmpty:"お知らせはありません",inboxFromAdmin:"管理者", inboxRelated:"関連する技：", versionsTitle:"最近の更新" },
    en:{ updatesTitle:"Notices & recent updates", updatesEmpty:"No updates published yet", updatesError:"Failed to load updates — check your connection", updatesLoading:"Loading…", updatesNoNote:"(no note)",
         inboxTitle:"Notifications", inboxEmpty:"No notifications",inboxFromAdmin:"Admin", inboxRelated:"Related trick: ", versionsTitle:"Recent updates" }
  });

  var UPDATES_SEEN_KEY = "kendama-updates-seen-v1";

  function getUpdatesSeen(){
    var n = parseInt(localStorage.getItem(UPDATES_SEEN_KEY), 10);
    return isNaN(n) ? 0 : n;
  }
  function setUpdatesSeen(v){
    var n = parseInt(v, 10);
    if(isNaN(n) || n < getUpdatesSeen()) return;
    try{ localStorage.setItem(UPDATES_SEEN_KEY, String(n)); }catch(e){}
  }
  function updatesHasUnread(latestVersion, seen){
    var l = parseInt(latestVersion, 10);
    if(isNaN(l)) return false;
    return l > (isNaN(parseInt(seen, 10)) ? 0 : parseInt(seen, 10));
  }

  // Firestore Timestamp / Date / ms number / null -> "YYYY-MM-DD" ("" if unknown).
  function formatPublishedDate(ts){
    if(!ts) return "";
    var d = typeof ts.toDate === "function" ? ts.toDate()
          : (ts.seconds != null ? new Date(ts.seconds * 1000) : new Date(ts));
    if(!d || isNaN(d.getTime())) return "";
    function p(n){ return (n < 10 ? "0" : "") + n; }
    return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
  }
  function versionDisplayLabel(v){
    if(!v) return "";
    return v.label || (v.version != null ? "v" + v.version : "");
  }

  /* ---------- inbox (users/{uid}/inbox, written by admin via sendInboxMessage in js/73) ---------- */
  var inboxItems = [];
  function inboxUnreadCount(items){
    var n = 0;
    (items || []).forEach(function(m){ if(m && m.read === false) n++; });
    return n;
  }
  // Red dot = new published version OR unread inbox message.
  function combinedUnread(latestVersion, seen, items){
    return updatesHasUnread(latestVersion, seen) || inboxUnreadCount(items) > 0;
  }
  function fetchInbox(user){
    user = user || (typeof authCurrentUser !== "undefined" ? authCurrentUser : null);
    if(!user || typeof fbStore === "undefined"){ inboxItems = []; applyUpdatesBadge(); return Promise.resolve([]); }
    return fbStore.collection("users").doc(user.uid).collection("inbox")
      .orderBy("createdAt", "desc").limit(30).get().then(function(snap){
        var list = [];
        snap.forEach(function(d){ var o = d.data(); o.id = d.id; list.push(o); });
        inboxItems = list;
        applyUpdatesBadge();
        return list;
      }).catch(function(){ return inboxItems; });
  }
  function inboxDocRef(id){
    var u = typeof authCurrentUser !== "undefined" ? authCurrentUser : null;
    return u ? fbStore.collection("users").doc(u.uid).collection("inbox").doc(id) : null;
  }
  function renderInbox(){
    var box = document.getElementById("updatesInbox");
    if(!box) return;
    var head = '<div class="inbox-title">' + escapeHtml(t("inboxTitle")) + '</div>';
    if(!inboxItems.length){
      box.innerHTML = head + '<div class="cat-tree-empty">' + escapeHtml(t("inboxEmpty")) + '</div>';
      return;
    }
    box.innerHTML = head + inboxItems.map(function(m){
      var date = formatPublishedDate(m.createdAt);
      return '<div class="updates-item inbox-item' + (m.read === false ? ' is-unread' : '') + '" data-id="' + escapeHtml(m.id) + '">' +
        '<div class="updates-item-head"><span class="inbox-from">' + escapeHtml(t("inboxFromAdmin")) + '</span>' +
        (date ? '<span class="updates-item-date">' + escapeHtml(date) + '</span>' : '') + '</div>' +
        (m.trickName ? '<div class="inbox-trick">' + escapeHtml(t("inboxRelated") + m.trickName) + '</div>' : '') +
        '<div class="updates-item-note">' + escapeHtml(m.text || "") + '</div>' +
        '<button type="button" class="col-add-btn col-add-btn-danger col-add-btn-del inbox-del" data-id="' + escapeHtml(m.id) + '">' + removeBtnHtml() + '</button></div>';
    }).join("");
  }
  // Marks unread messages read in Firestore (fire and forget); the page keeps showing them highlighted until closed.
  function markInboxRead(){
    inboxItems.forEach(function(m){
      if(m.read !== false) return;
      var ref = inboxDocRef(m.id);
      m.read = true;
      if(ref) ref.update({ read: true }).catch(function(){ m.read = false; });
    });
    applyUpdatesBadge();
  }
  function deleteInboxItem(id){
    var ref = inboxDocRef(id);
    if(!ref) return;
    ref.delete().then(function(){
      inboxItems = inboxItems.filter(function(m){ return m.id !== id; });
      renderInbox(); applyUpdatesBadge();
    }).catch(function(){});
  }

  var updatesLatest = 0;
  function applyUpdatesBadge(){
    var unread = combinedUnread(updatesLatest, getUpdatesSeen(), inboxItems);
    var gear = document.getElementById("settingsBtn");
    var item = document.getElementById("settingsNoticesBtn");
    if(gear) gear.classList.toggle("has-dot", unread);
    if(item) item.classList.toggle("has-dot", unread);
  }
  // Fetches the published pointer (read-only) and refreshes the red dots.
  function refreshUpdatesBadge(){
    if(typeof getPublishedPointer !== "function") return Promise.resolve();
    return Promise.resolve(getPublishedPointer()).then(function(p){
      updatesLatest = (p && p.latestVersion) || 0;
      applyUpdatesBadge();
    }).catch(function(){});
  }

  function renderUpdatesList(list){
    var box = document.getElementById("updatesVersions") || document.getElementById("updatesList");
    if(!list || !list.length){
      box.innerHTML = '<div class="cat-tree-empty">' + escapeHtml(t("updatesEmpty")) + '</div>';
      return;
    }
    box.innerHTML = '<div class="inbox-title">' + escapeHtml(t("versionsTitle")) + '</div>' + list.map(function(v){
      var date = formatPublishedDate(v.publishedAt);
      return '<div class="updates-item">' +
        '<div class="updates-item-head"><span class="updates-item-label">' + escapeHtml(versionDisplayLabel(v)) + '</span>' +
        (date ? '<span class="updates-item-date">' + escapeHtml(date) + '</span>' : '') + '</div>' +
        '<div class="updates-item-note">' + escapeHtml(v.note || t("updatesNoNote")) + '</div></div>';
    }).join("");
  }

  function openUpdates(){
    var overlay = document.getElementById("updatesOverlay");
    setText16("updatesTitle", t("updatesTitle"));
    var cb = document.getElementById("updatesCloseBtn");
    cb.title = t("settingsClose"); cb.setAttribute("aria-label", t("settingsClose"));
    if(!cb.firstChild) cb.innerHTML = ICON_X;
    document.getElementById("updatesList").innerHTML = '<div id="updatesInbox"></div><div id="updatesVersions"><div class="cat-tree-empty">' + escapeHtml(t("updatesLoading")) + '</div></div>';
    var loggedIn = typeof authCurrentUser !== "undefined" && authCurrentUser;
    if(loggedIn){
      renderInbox();
      fetchInbox().then(function(){ renderInbox(); markInboxRead(); });
      markInboxRead();
    }
    overlay.classList.add("show");
    if(typeof listPublishedVersions !== "function"){ renderUpdatesList([]); return; }
    Promise.resolve(listPublishedVersions(30)).then(function(list){
      list = list || [];
      renderUpdatesList(list);
      var max = updatesLatest;
      list.forEach(function(v){ if(v.version > max) max = v.version; });
      updatesLatest = max;
      setUpdatesSeen(max);
      applyUpdatesBadge();
    }).catch(function(){
      var vb = document.getElementById("updatesVersions");
      if(vb) vb.innerHTML = '<div class="cat-tree-empty">' + escapeHtml(t("updatesError")) + '</div>';
    });
  }
  function closeUpdates(){
    document.getElementById("updatesOverlay").classList.remove("show");
  }
  function isUpdatesOpen(){
    return document.getElementById("updatesOverlay").classList.contains("show");
  }
  function setText16(id, val){ var el = document.getElementById(id); if(el) el.textContent = val; }

  document.getElementById("settingsNoticesBtn").addEventListener("click", openUpdates);
  document.getElementById("updatesCloseBtn").addEventListener("click", closeUpdates);
  document.getElementById("updatesList").addEventListener("click", function(ev){
    var b = ev.target.closest(".inbox-del");
    if(b) deleteInboxItem(b.getAttribute("data-id"));
  });
  // Fetch the inbox once per sign-in (no polling); the dot lights if anything is unread.
  if(typeof fbAuth !== "undefined"){
    fbAuth.onAuthStateChanged(function(user){
      if(user) fetchInbox(user); else { inboxItems = []; applyUpdatesBadge(); }
    });
  }
  document.getElementById("updatesOverlay").addEventListener("click", function(ev){
    if(ev.target.id === "updatesOverlay") closeUpdates();
  });
