"use strict";

  /* ============================================================
     ADMIN STATS + BACKUP (企劃書 §三.8, D6 / G5). Mounted by the admin panel:
       renderAdminStats(containerEl)   - reads userStats/*, the published base, trick submissions (reports kind "trick")
       renderAdminBackup(containerEl)  - last 20 published versions, download as JSON
     Spark plan can't schedule exports; every published version is a full snapshot in
     sharedBase/space-index/versions and is never deleted. Download is read-only.
  ============================================================ */
  addStrings({
    zh:{ stRefresh:"重新整理", stLoading:"載入中…", stError:"讀取失敗", stEmpty:"尚無資料",
      stRegistered:"註冊數", stCollected:"總表收錄數", stLang:"使用者語言占比", stActive7:"7 天活躍", stActive30:"30 天活躍",
      stTopFav:"最多收藏 Top 5", stSubs:"投稿數",
      stNoAccess:"無權限",
      stT00:"總表", stT01:"檢定", stT02:"賽事", stT03:"各式資料", stPeople:"{n} 人",
      bkTitle:"備份：下載已發布版本", bkDownload:"下載", bkNone:"尚無已發布版本", bkFail:"下載失敗" },
    jp:{ stRefresh:"更新", stLoading:"読み込み中…", stError:"読み込みに失敗しました", stEmpty:"データなし",
      stRegistered:"登録数", stCollected:"総表の収録数", stLang:"ユーザーの言語割合", stActive7:"7日間アクティブ", stActive30:"30日間アクティブ",
      stTopFav:"お気に入り Top 5", stSubs:"投稿数",
      stNoAccess:"権限なし",
      stT00:"総表", stT01:"検定", stT02:"大会", stT03:"各種資料", stPeople:"{n} 人",
      bkTitle:"バックアップ：公開済みバージョン", bkDownload:"ダウンロード", bkNone:"公開済みバージョンなし", bkFail:"ダウンロードに失敗しました" },
    en:{ stRefresh:"Refresh", stLoading:"Loading…", stError:"Failed to load", stEmpty:"No data yet",
      stRegistered:"Registered users", stCollected:"Tricks in the base", stLang:"User language share", stActive7:"Active (7 days)", stActive30:"Active (30 days)",
      stTopFav:"Most favorited, top 5", stSubs:"Submissions",
      stNoAccess:"No access",
      stT00:"Master", stT01:"Certification", stT02:"Competition", stT03:"Resources", stPeople:"{n}",
      bkTitle:"Backup: published versions", bkDownload:"Download", bkNone:"No published versions yet", bkFail:"Download failed" }
  });

  var STATS_DAY_MS = 24 * 60 * 60 * 1000;

  /* ---------------- Pure logic ---------------- */
  function topCounts(map, n){
    return Object.keys(map).map(function(id){ return { id: id, count: map[id] }; })
      .sort(function(a, b){ return (b.count - a.count) || (a.id < b.id ? -1 : 1); }).slice(0, n);
  }
  // docs: userStats data objects with lastActiveAt already in ms (or null). now: ms.
  function aggregateUserStats(docs, now){
    var out = { registered: docs.length, lang: { zh: 0, jp: 0, en: 0 }, active7: 0, active30: 0,
      topFav: [] };
    var fav = {};
    docs.forEach(function(d){
      if(out.lang[d.lang] !== undefined) out.lang[d.lang]++;
      var at = d.lastActiveAt;
      if(typeof at === "number"){
        if(now - at <= 7 * STATS_DAY_MS) out.active7++;
        if(now - at <= 30 * STATS_DAY_MS) out.active30++;
      }
      (d.favorites || []).forEach(function(id){ fav[id] = (fav[id] || 0) + 1; });
    });
    out.topFav = topCounts(fav, 5);
    return out;
  }
  // Counts base tricks per shared table (a trick counts once in each table whose container it sits in).
  function countBaseTricksBySpace(base){
    var catSpace = {};
    (base.categories || []).forEach(function(c){ catSpace[c.id] = c.spaceId; });
    var out = { t00: 0, t01: 0, t02: 0, t03: 0 };
    (base.tricks || []).forEach(function(tr){
      var seen = {};
      (tr.categoryIds || []).forEach(function(cid){
        var sid = catSpace[cid] || cid;
        if(out[sid] !== undefined && !seen[sid]){ seen[sid] = true; out[sid]++; }
      });
    });
    return out;
  }
  function baseNameMap(base){
    var m = {};
    (base.tricks || []).forEach(function(tr){ m[tr.id] = (typeof localize === "function" && tr.name) ? localize(tr.name) : tr.id; });
    return m;
  }
  function backupFilename(version){ return "kendama-base-v" + version + ".json"; }

  /* ---------------- Backup ---------------- */
  function downloadPublishedVersion(version){
    return fetchSharedBaseVersion(version).then(function(snap){
      var blob = new Blob([JSON.stringify(snap, null, 2)], { type: "application/json" });
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url; a.download = backupFilename(version);
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(function(){ URL.revokeObjectURL(url); }, 2000);
      return true;
    }).catch(function(err){
      console.error("Backup download failed:", err);
      if(typeof showToast === "function") showToast(t("bkFail"), "error");
      return false;
    });
  }

  function renderAdminBackup(el){
    el.innerHTML = "";
    var title = document.createElement("div");
    title.className = "admin-card-subtitle"; title.textContent = t("bkTitle");
    var list = document.createElement("div"); list.className = "stats-backup-list";
    list.textContent = t("stLoading");
    el.appendChild(title); el.appendChild(list);
    listPublishedVersions(20).then(function(vs){
      list.innerHTML = "";
      if(!vs.length){ list.textContent = t("bkNone"); return; }
      vs.forEach(function(v){
        var row = document.createElement("div"); row.className = "stats-row bk-row";
        var info = document.createElement("div"); info.className = "bk-info";
        var lab = document.createElement("div"); lab.className = "bk-label";
        var when = v.publishedAt ? " · " + new Date(v.publishedAt).toLocaleDateString() : "";
        lab.textContent = "v" + v.version + (v.label ? " " + v.label : "") + when;
        info.appendChild(lab);
        if(v.note){ var nt = document.createElement("div"); nt.className = "bk-note"; nt.textContent = v.note; info.appendChild(nt); }
        var btn = document.createElement("button");
        btn.type = "button"; btn.className = "btn"; btn.textContent = t("bkDownload");
        btn.addEventListener("click", function(){ btn.disabled = true; downloadPublishedVersion(v.version).then(function(){ btn.disabled = false; }); });
        row.appendChild(info); row.appendChild(btn); list.appendChild(row);
      });
    }).catch(function(){ list.textContent = t("stError"); });
  }

  /* ---------------- Stats UI ---------------- */
  var _statsCache = null; // session cache: { agg, counts, subs, names }

  function statsFetchAll(){
    var uStats = fbStore.collection("userStats").get().then(function(qs){
      var docs = [];
      qs.forEach(function(d){
        var x = d.data();
        x.lastActiveAt = (typeof tsToMs === "function") ? tsToMs(x.lastActiveAt) : null;
        docs.push(x);
      });
      return docs;
    });
    var subs = fbStore.collection("reports").where("kind", "==", "trick").get().then(function(qs){ return qs.size; }).catch(function(){ return null; });
    var base = fetchSharedBasePointer().then(function(p){ return fetchSharedBaseVersion(p.latestVersion); });
    return Promise.all([uStats, subs, base]).then(function(r){
      return { agg: aggregateUserStats(r[0], Date.now()), subs: r[1], counts: countBaseTricksBySpace(r[2]), names: baseNameMap(r[2]) };
    });
  }

  function statsEl(tag, cls, text){
    var e = document.createElement(tag); if(cls) e.className = cls; if(text !== undefined) e.textContent = text; return e;
  }
  function statsKV(label, value){
    var row = statsEl("div", "stats-row");
    row.appendChild(statsEl("span", "stats-row-label", label));
    row.appendChild(statsEl("span", "stats-row-value", String(value)));
    return row;
  }
  function statsBar(parts, total){
    var bar = statsEl("div", "stats-bar");
    parts.forEach(function(p){
      if(!p.n || !total) return;
      var seg = statsEl("span", "stats-bar-seg");
      seg.style.width = (p.n / total * 100) + "%";
      seg.style.background = p.color;
      seg.title = p.label + ": " + p.n;
      bar.appendChild(seg);
    });
    return bar;
  }
  function statsLegend(parts, total){
    var lg = statsEl("div", "stats-legend");
    parts.forEach(function(p){
      var it = statsEl("span", "stats-legend-item");
      var dot = statsEl("i", "stats-dot"); dot.style.background = p.color;
      var pct = total ? Math.round(p.n / total * 100) + "%" : "0%";
      it.appendChild(dot); it.appendChild(document.createTextNode(p.label + " " + (p.pct ? pct : p.n)));
      lg.appendChild(it);
    });
    return lg;
  }
  function statsTop(title, list, names){
    var box = statsEl("div", "stats-block");
    box.appendChild(statsEl("div", "admin-card-subtitle", title));
    if(!list.length){ box.appendChild(statsEl("div", "stats-empty", t("stEmpty"))); return box; }
    list.forEach(function(it, i){ box.appendChild(statsKV((i + 1) + ". " + (names[it.id] || it.id), t("stPeople").replace("{n}", it.count))); });
    return box;
  }

  function statsBuildView(el, data){
    var a = data.agg, c = data.counts;
    el.appendChild(statsKV(t("stRegistered"), a.registered));
    el.appendChild(statsKV(t("stActive7"), a.active7));
    el.appendChild(statsKV(t("stActive30"), a.active30));
    el.appendChild(statsKV(t("stSubs"), data.subs === null ? t("stNoAccess") : data.subs));
    el.appendChild(statsKV(t("stCollected"), t("stT00") + " " + c.t00 + " / " + t("stT01") + " " + c.t01 + " / " + t("stT02") + " " + c.t02 + " / " + t("stT03") + " " + c.t03));

    var langTotal = a.lang.zh + a.lang.jp + a.lang.en;
    var langParts = [
      { label: "中文", n: a.lang.zh, color: "var(--accent-text)", pct: true },
      { label: "日本語", n: a.lang.jp, color: "var(--lacquer)", pct: true },
      { label: "English", n: a.lang.en, color: "var(--paper-dim)", pct: true }
    ];
    var lb = statsEl("div", "stats-block");
    lb.appendChild(statsEl("div", "admin-card-subtitle", t("stLang")));
    if(!langTotal) lb.appendChild(statsEl("div", "stats-empty", t("stEmpty")));
    else { lb.appendChild(statsBar(langParts, langTotal)); lb.appendChild(statsLegend(langParts, langTotal)); }
    el.appendChild(lb);

    el.appendChild(statsTop(t("stTopFav"), a.topFav, data.names));
  }

  function renderAdminStats(el, force){
    el.innerHTML = "";
    // The ↺ button lives in the card header (index.html #adminStatsRefresh), right of the title.
    var btn = document.getElementById("adminStatsRefresh");
    if(!btn){ btn = statsEl("button", "stats-refresh", "↺"); btn.type = "button"; el.parentNode && el.parentNode.insertBefore(btn, el); }
    btn.title = t("stRefresh"); btn.setAttribute("aria-label", t("stRefresh"));
    btn.onclick = function(){ renderAdminStats(el, true); };
    var body = statsEl("div", "stats-body");
    el.appendChild(body);
    function show(d){ body.innerHTML = ""; statsBuildView(body, d); }
    if(_statsCache && !force){ show(_statsCache); return; }
    body.textContent = t("stLoading"); btn.disabled = true;
    statsFetchAll().then(function(d){ _statsCache = d; btn.disabled = false; show(d); })
      .catch(function(err){
        console.error("Admin stats failed:", err);
        btn.disabled = false;
        body.textContent = t("stError") + (err && err.code === "permission-denied" ? " (" + t("stNoAccess") + ")" : "");
      });
  }
