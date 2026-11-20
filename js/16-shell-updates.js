"use strict";

  /* ============================================================
     SHELL — updates page (通知與近期更新) + unread red dot.
     Reads published versions via T1's listPublishedVersions /
     getPublishedPointer (js/51); both guarded with typeof.
  ============================================================ */
  addStrings({
    zh:{ updatesTitle:"通知與近期更新", updatesEmpty:"還沒有發布過的更新", updatesError:"讀取更新失敗，請檢查網路連線", updatesLoading:"讀取中…", updatesNoNote:"（沒有備註）" },
    jp:{ updatesTitle:"お知らせと最近の更新", updatesEmpty:"発行された更新はまだありません", updatesError:"更新の読み込みに失敗しました。ネット接続をご確認ください", updatesLoading:"読み込み中…", updatesNoNote:"（メモなし）" },
    en:{ updatesTitle:"Notices & recent updates", updatesEmpty:"No updates published yet", updatesError:"Failed to load updates — check your connection", updatesLoading:"Loading…", updatesNoNote:"(no note)" }
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

  var updatesLatest = 0;
  function applyUpdatesBadge(){
    var unread = updatesHasUnread(updatesLatest, getUpdatesSeen());
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
    var box = document.getElementById("updatesList");
    if(!list || !list.length){
      box.innerHTML = '<div class="cat-tree-empty">' + escapeHtml(t("updatesEmpty")) + '</div>';
      return;
    }
    box.innerHTML = list.map(function(v){
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
    document.getElementById("updatesList").innerHTML = '<div class="cat-tree-empty">' + escapeHtml(t("updatesLoading")) + '</div>';
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
      document.getElementById("updatesList").innerHTML = '<div class="cat-tree-empty">' + escapeHtml(t("updatesError")) + '</div>';
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
  document.getElementById("updatesOverlay").addEventListener("click", function(ev){
    if(ev.target.id === "updatesOverlay") closeUpdates();
  });
