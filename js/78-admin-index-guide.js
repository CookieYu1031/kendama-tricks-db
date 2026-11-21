"use strict";

  /* ============================================================
     SEARCH INDEX UPDATE GUIDE (admin only) — sub-modal opened from the admin panel
     (「更新搜尋索引」 link) and from the publish toast. Semi-automates the manual
     GitHub Action (.github/workflows/search-index.yml -> scripts/build-search-index.js):
       1 check  published version vs. data/search-index.json "version"
       2 open the workflow page   3 click Run workflow   4 poll until versions match.
     Pure logic (tests/index-guide.test.js): indexGuideCompare, indexPollStep, indexGuideSteps.
  ============================================================ */
  addStrings({
    zh:{ idxTitle:"更新搜尋索引", idxStep1:"檢查版本", idxStep2:"開啟 GitHub Actions", idxStep3:"執行 Run workflow",
         idxStep4:"等待完成", idxPublished:"已發布版本：{v}", idxLive:"目前搜尋索引版本：{v}", idxUnknown:"讀取不到",
         idxUpToDate:"搜尋索引已是最新，不需要更新。", idxOutdated:"搜尋索引落後，需要更新。", idxChecking:"檢查中…",
         idxRecheck:"重新檢查", idxOpenActions:"開啟 GitHub Actions",
         idxRunHint:"在開啟的頁面點「Run workflow」，再點一次綠色的「Run workflow」。約 1–2 分鐘後完成。",
         idxCheckStatus:"檢查狀態", idxPolling:"等待中…（每 10 秒檢查一次）", idxDone:"完成！搜尋索引已更新到 {v}。",
         idxTimeout:"等了 5 分鐘仍未更新，請到 GitHub Actions 查看執行結果。", idxNoPublished:"尚未發布任何版本" },
    jp:{ idxTitle:"検索インデックスを更新", idxStep1:"バージョン確認", idxStep2:"GitHub Actions を開く", idxStep3:"Run workflow を実行",
         idxStep4:"完了を待つ", idxPublished:"発行済みバージョン：{v}", idxLive:"現在の検索インデックス：{v}", idxUnknown:"取得できません",
         idxUpToDate:"検索インデックスは最新です。更新は不要です。", idxOutdated:"検索インデックスが古いため、更新が必要です。", idxChecking:"確認中…",
         idxRecheck:"再確認", idxOpenActions:"GitHub Actions を開く",
         idxRunHint:"開いたページで「Run workflow」を押し、緑の「Run workflow」をもう一度押します。1〜2分で完了します。",
         idxCheckStatus:"状態を確認", idxPolling:"待機中…（10秒ごとに確認）", idxDone:"完了！検索インデックスが {v} に更新されました。",
         idxTimeout:"5分待っても更新されません。GitHub Actions の実行結果を確認してください。", idxNoPublished:"まだ発行されたバージョンがありません" },
    en:{ idxTitle:"Update search index", idxStep1:"Check versions", idxStep2:"Open GitHub Actions", idxStep3:"Run workflow",
         idxStep4:"Wait for it to finish", idxPublished:"Published version: {v}", idxLive:"Search index version: {v}", idxUnknown:"unavailable",
         idxUpToDate:"The search index is up to date. Nothing to do.", idxOutdated:"The search index is behind and needs updating.", idxChecking:"Checking…",
         idxRecheck:"Check again", idxOpenActions:"Open GitHub Actions",
         idxRunHint:"On the page that opens, click \"Run workflow\", then the green \"Run workflow\" again. Takes about 1–2 minutes.",
         idxCheckStatus:"Check status", idxPolling:"Waiting… (checks every 10 s)", idxDone:"Done! The search index is now at {v}.",
         idxTimeout:"Still not updated after 5 minutes. Check the run in GitHub Actions.", idxNoPublished:"Nothing published yet" }
  });

  var INDEX_POLL_MS = 10000, INDEX_POLL_MAX_MS = 5 * 60 * 1000;

  /* ---------------- Pure logic ---------------- */
  // published: latestVersion from the shared base pointer; live: "version" in data/search-index.json (null if unreadable).
  // -> "none" (nothing published) | "unknown" | "uptodate" | "outdated"
  function indexGuideCompare(published, live){
    if(!published) return "none";
    if(live == null) return "unknown";
    return String(published) === String(live) ? "uptodate" : "outdated";
  }
  // One polling tick. poll: { status: "polling"|"done"|"timeout"|"stopped", startedAt, target }.
  // live: version read this tick (or null). Returns a new poll object; terminal states stay as they are.
  function indexPollStep(poll, live, now){
    if(poll.status !== "polling") return poll;
    var next = { status: "polling", startedAt: poll.startedAt, target: poll.target };
    if(live != null && String(live) === String(poll.target)) next.status = "done";
    else if(now - poll.startedAt >= INDEX_POLL_MAX_MS) next.status = "timeout";
    return next;
  }
  function indexPollStop(poll){ return poll.status === "polling" ? { status: "stopped", startedAt: poll.startedAt, target: poll.target } : poll; }
  // Step states ("done" | "active" | "pending") for the 4 guide steps.
  function indexGuideSteps(cmp, opened, pollStatus){
    if(cmp === "uptodate") return ["done", "done", "done", "done"];
    var s = ["done", opened ? "done" : "active", opened ? "done" : "pending", "pending"];
    if(opened) s[2] = "active";
    if(pollStatus === "polling"){ s[2] = "done"; s[3] = "active"; }
    if(pollStatus === "done") s = ["done", "done", "done", "done"];
    return s;
  }

  /* ---------------- UI ---------------- */
  var idxGuide = { published: 0, live: null, cmp: "", opened: false, poll: { status: "stopped", startedAt: 0, target: 0 }, timer: null, box: null, ov: null };

  function fetchLiveIndexVersion(){
    if(typeof fetch !== "function") return Promise.resolve(null);
    return fetch("data/search-index.json?t=" + Date.now(), { cache: "no-store" }).then(function(r){
      return r.ok ? r.json() : null;
    }).then(function(j){ return j && j.version != null ? j.version : null; }).catch(function(){ return null; });
  }

  function idxStopTimer(){ if(idxGuide.timer){ clearTimeout(idxGuide.timer); idxGuide.timer = null; } }
  function idxIsOpen(){ return !!(idxGuide.ov && idxGuide.ov.classList.contains("show")); }

  function openIndexGuide(){
    if(typeof isAdminAccount === "function" && !isAdminAccount()) return;
    var ov = adminSubModal("adminIndexOverlay", "idxTitle", "admin-sub-modal idx-modal");
    idxStopTimer();
    idxGuide.ov = ov; idxGuide.box = ov.querySelector(".modal-scroll");
    idxGuide.opened = false; idxGuide.cmp = ""; idxGuide.live = null; idxGuide.published = 0;
    idxGuide.poll = { status: "stopped", startedAt: 0, target: 0 };
    ov.classList.add("show");
    renderIndexGuide();
    idxCheckVersions();
  }

  function idxCheckVersions(){
    idxGuide.cmp = ""; renderIndexGuide();
    var pub = typeof getPublishedPointer === "function" ? Promise.resolve(getPublishedPointer()).then(function(p){ return p && p.latestVersion || 0; }).catch(function(){ return 0; }) : Promise.resolve(0);
    return Promise.all([pub, fetchLiveIndexVersion()]).then(function(r){
      if(!idxIsOpen()) return;
      idxGuide.published = r[0]; idxGuide.live = r[1];
      idxGuide.cmp = indexGuideCompare(r[0], r[1]);
      renderIndexGuide();
    });
  }

  function idxStartPolling(){
    idxStopTimer();
    idxGuide.poll = { status: "polling", startedAt: Date.now(), target: idxGuide.published };
    renderIndexGuide();
    function tick(){
      if(!idxIsOpen()){ idxGuide.poll = indexPollStop(idxGuide.poll); return; }
      fetchLiveIndexVersion().then(function(v){
        if(!idxIsOpen()){ idxGuide.poll = indexPollStop(idxGuide.poll); return; }
        if(v != null) idxGuide.live = v;
        idxGuide.poll = indexPollStep(idxGuide.poll, v, Date.now());
        if(idxGuide.poll.status === "done") idxGuide.cmp = "uptodate";
        renderIndexGuide();
        if(idxGuide.poll.status === "polling") idxGuide.timer = setTimeout(tick, INDEX_POLL_MS);
      });
    }
    tick();
  }

  function idxEl(tag, cls, text){
    var e = document.createElement(tag); if(cls) e.className = cls; if(text !== undefined) e.textContent = text; return e;
  }
  function idxFmt(key, v){ return t(key).replace("{v}", v); }

  function renderIndexGuide(){
    var box = idxGuide.box; if(!box) return;
    box.innerHTML = "";
    var g = idxGuide, cmp = g.cmp, checking = !cmp;
    var states = indexGuideSteps(cmp, g.opened, g.poll.status);
    var titles = ["idxStep1", "idxStep2", "idxStep3", "idxStep4"];
    var list = idxEl("ol", "idx-steps");
    titles.forEach(function(k, i){
      var li = idxEl("li", "idx-step idx-" + states[i]);
      li.appendChild(idxEl("span", "idx-mark", states[i] === "done" ? "✓" : String(i + 1)));
      var body = idxEl("div", "idx-body");
      body.appendChild(idxEl("div", "idx-step-title", t(k)));
      if(i === 0){
        if(checking) body.appendChild(idxEl("div", "field-hint", t("idxChecking")));
        else if(cmp === "none") body.appendChild(idxEl("div", "field-hint", t("idxNoPublished")));
        else {
          body.appendChild(idxEl("div", "field-hint", idxFmt("idxPublished", "v" + g.published)));
          body.appendChild(idxEl("div", "field-hint", idxFmt("idxLive", g.live == null ? t("idxUnknown") : "v" + g.live)));
          body.appendChild(idxEl("div", "idx-status " + (cmp === "uptodate" ? "idx-ok" : ""), t(cmp === "uptodate" ? "idxUpToDate" : "idxOutdated")));
        }
        var rb = idxEl("button", "btn btn-ghost btn-sm", t("idxRecheck")); rb.type = "button";
        rb.disabled = checking || g.poll.status === "polling";
        rb.addEventListener("click", idxCheckVersions);
        body.appendChild(rb);
      } else if(cmp !== "uptodate" && cmp !== "none" && !checking){
        if(i === 1){
          var a = idxEl("a", "btn btn-primary btn-sm", t("idxOpenActions"));
          a.href = SEARCH_INDEX_WORKFLOW_URL; a.target = "_blank"; a.rel = "noopener";
          a.addEventListener("click", function(){ g.opened = true; renderIndexGuide(); });
          body.appendChild(a);
        } else if(i === 2){
          body.appendChild(idxEl("div", "field-hint", t("idxRunHint")));
        } else {
          if(g.poll.status === "polling"){
            var w = idxEl("div", "idx-wait"); w.appendChild(idxEl("i", "idx-spinner")); w.appendChild(idxEl("span", "", t("idxPolling")));
            body.appendChild(w);
          } else {
            if(g.poll.status === "timeout") body.appendChild(idxEl("div", "idx-status", t("idxTimeout")));
            var cb = idxEl("button", "btn btn-primary btn-sm", t("idxCheckStatus")); cb.type = "button";
            cb.addEventListener("click", idxStartPolling);
            body.appendChild(cb);
          }
        }
      } else if(i === 3 && g.poll.status === "done"){
        body.appendChild(idxEl("div", "idx-status idx-ok", idxFmt("idxDone", "v" + g.live)));
      }
      li.appendChild(body); list.appendChild(li);
    });
    box.appendChild(list);
  }

  (function(){
    var a = document.getElementById("adminIndexLink");
    if(a) a.addEventListener("click", function(ev){ ev.preventDefault(); openIndexGuide(); });
  })();
