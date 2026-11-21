"use strict";

  /* ============================================================
     ADMIN PANEL (admin only) — opened from the settings page.
     v0.6: 更新與發布. Stats / helpers / mailbox are v0.7 placeholders.
     Depends on T1 globals (guarded): getPublishedPointer,
     getPendingSummary, publishSpaceIndexUpdate.
  ============================================================ */
  addStrings({
    zh:{ adminTitle:"管理員面板", adminOpen:"管理員面板", adminMailbox:"📫 郵件箱", adminStats:"網站統計", adminHelpers:"管理協助者", adminBackup:"過往版本與備份",
         adminPublishTitle:"更新與發布", adminLastVersion:"上次版本", adminNoVersion:"尚未發布", adminVersionLabel:"版本號", adminNoteLabel:"更新備註",
         adminNotePlaceholder:"這次更新了什麼？（所有使用者都會看到）", adminPendingTitle:"待發布的變更", adminPendingNone:"沒有待發布的變更",
         adminPendingLoading:"計算中…", adminAdded:"新增", adminModified:"變動", adminRemoved:"移除", adminTags:"標籤",
         adminPublishBtn:"發布更新", adminPublishing:"發布中…", adminConfirmTitle:"發布更新？", adminConfirmBody:"版本 {label}：{counts}",
         adminLabelEmpty:"請輸入版本號", adminLabelBad:"版本號只能用英數字、. - _ 和空格，最多 32 字", adminNoteEmpty:"請輸入更新備註",
         adminPublished:"已發布 {label}", adminPublishFail:"發布失敗，請檢查網路連線", adminIndexLink:"更新搜尋索引",
         adminIndexHint:"發布後，請手動執行搜尋索引更新：" },
    jp:{ adminTitle:"管理者パネル", adminOpen:"管理者パネル", adminMailbox:"📫 受信箱", adminStats:"サイト統計", adminHelpers:"協力者の管理", adminBackup:"過去のバージョンとバックアップ",
         adminPublishTitle:"更新と発行", adminLastVersion:"前回のバージョン", adminNoVersion:"未発行", adminVersionLabel:"バージョン", adminNoteLabel:"更新メモ",
         adminNotePlaceholder:"今回の更新内容は？（全ユーザーに表示されます）", adminPendingTitle:"未発行の変更", adminPendingNone:"未発行の変更はありません",
         adminPendingLoading:"集計中…", adminAdded:"追加", adminModified:"変更", adminRemoved:"削除", adminTags:"タグ",
         adminPublishBtn:"更新を発行", adminPublishing:"発行中…", adminConfirmTitle:"更新を発行しますか？", adminConfirmBody:"バージョン {label}：{counts}",
         adminLabelEmpty:"バージョンを入力してください", adminLabelBad:"英数字・. - _・空白のみ、32文字以内", adminNoteEmpty:"更新メモを入力してください",
         adminPublished:"{label} を発行しました", adminPublishFail:"発行に失敗しました。ネット接続をご確認ください", adminIndexLink:"検索インデックスを更新",
         adminIndexHint:"発行後、検索インデックスを手動で更新してください：" },
    en:{ adminTitle:"Admin panel", adminOpen:"Admin panel", adminMailbox:"📫 Mailbox", adminStats:"Site stats", adminHelpers:"Manage helpers", adminBackup:"Past versions & backup",
         adminPublishTitle:"Updates & publishing", adminLastVersion:"Last version", adminNoVersion:"Nothing published yet", adminVersionLabel:"Version", adminNoteLabel:"Changelog note",
         adminNotePlaceholder:"What changed? (visible to everyone)", adminPendingTitle:"Pending changes", adminPendingNone:"No pending changes",
         adminPendingLoading:"Calculating…", adminAdded:"Added", adminModified:"Modified", adminRemoved:"Removed", adminTags:"Tags",
         adminPublishBtn:"Publish update", adminPublishing:"Publishing…", adminConfirmTitle:"Publish update?", adminConfirmBody:"Version {label}: {counts}",
         adminLabelEmpty:"Enter a version label", adminLabelBad:"Letters, digits, . - _ and spaces only, max 32 chars", adminNoteEmpty:"Please enter a changelog note",
         adminPublished:"Published {label}", adminPublishFail:"Publish failed — check your connection", adminIndexLink:"Update search index",
         adminIndexHint:"After publishing, run the search index update manually: " }
  });

  var SEARCH_INDEX_WORKFLOW_URL = "https://github.com/CookieYu1031/kendama-tricks-db/actions/workflows/search-index.yml";

  // "1.0.3" -> "1.0.4"; "v1.2" -> "v1.3"; none/no digits -> "0.1.0".
  function nextVersionLabel(prev){
    prev = String(prev == null ? "" : prev).trim();
    var m = /^([\s\S]*?)(\d+)(\D*)$/.exec(prev);
    if(!m) return "0.1.0";
    return m[1] + (parseInt(m[2], 10) + 1) + m[3];
  }
  // Returns "" when valid, else an i18n key.
  function validateVersionLabel(label){
    label = String(label == null ? "" : label).trim();
    if(!label) return "adminLabelEmpty";
    if(label.length > 32 || !/^[0-9A-Za-z.\-_ ]+$/.test(label)) return "adminLabelBad";
    return "";
  }

  // Tolerant: each of added/modified/removed/tags may be a number or an array;
  // name lists come from s.lists or from the arrays themselves.
  function normalizePending(s){
    s = s || {};
    var lists = s.lists || s.names || {};
    function count(x){ return typeof x === "number" ? x : (Array.isArray(x) ? x.length : 0); }
    function names(k){
      if(Array.isArray(lists[k])) return lists[k].map(String);
      return Array.isArray(s[k]) ? s[k].map(String) : [];
    }
    var out = { added: count(s.added), modified: count(s.modified), removed: count(s.removed), tags: count(s.tags),
                lists: { added: names("added"), modified: names("modified"), removed: names("removed") } };
    out.total = out.added + out.modified + out.removed + out.tags;
    return out;
  }
  function formatPendingCounts(p){
    return t("adminAdded") + " " + p.added + " · " + t("adminModified") + " " + p.modified + " · " +
           t("adminRemoved") + " " + p.removed + " · " + t("adminTags") + " " + p.tags;
  }
  function lastVersionLabel(ptr){
    if(!ptr || !ptr.latestVersion) return "";
    return ptr.latestLabel || ("v" + ptr.latestVersion);
  }

  var adminPtr = null, adminPending = null, adminBusy = false;
  function adminEl(id){ return document.getElementById(id); }
  function adminFmt(s, vars){
    return String(s).replace(/\{(\w+)\}/g, function(_, k){ return vars[k] != null ? vars[k] : ""; });
  }

  function renderAdminPending(){
    var box = adminEl("adminPending");
    var p = adminPending;
    if(!p){ box.innerHTML = '<div class="field-hint">' + escapeHtml(t("adminPendingLoading")) + '</div>'; return; }
    if(!p.total){ box.innerHTML = '<div class="field-hint">' + escapeHtml(t("adminPendingNone")) + '</div>'; return; }
    var html = '<div class="admin-counts">' + escapeHtml(formatPendingCounts(p)) + '</div>';
    [["added","adminAdded"],["modified","adminModified"],["removed","adminRemoved"]].forEach(function(k){
      var list = p.lists[k[0]];
      if(!list.length) return;
      html += '<details class="admin-details"><summary>' + escapeHtml(t(k[1])) + ' (' + list.length + ')</summary><ul>' +
        list.map(function(n){ return '<li>' + escapeHtml(n) + '</li>'; }).join("") + '</ul></details>';
    });
    box.innerHTML = html;
  }

  function updateAdminPublishState(){
    adminEl("adminPublishBtn").disabled = adminBusy || !adminPending || !adminPending.total;
    adminEl("adminPublishBtn").textContent = adminBusy ? t("adminPublishing") : t("adminPublishBtn");
  }

  function renderAdminStatic(){
    var map = { adminTitle:"adminTitle", adminStatsTitle:"adminStats", adminPublishTitle:"adminPublishTitle",
                adminLastLabel:"adminLastVersion", adminVersionLbl:"adminVersionLabel", adminNoteLbl:"adminNoteLabel", adminPendingTitle:"adminPendingTitle",
                adminIndexHint:"adminIndexHint", adminIndexLink:"adminIndexLink" };
    Object.keys(map).forEach(function(id){ var el = adminEl(id); if(el) el.textContent = t(map[id]); });
    adminEl("adminMailboxBtn").textContent = t("adminMailbox");
    adminEl("adminMailboxBtn").title = t("adminMailbox");
    adminEl("adminBackupBtn").textContent = t("adminBackup"); adminEl("adminBackupBtn").title = t("adminBackup");
    adminEl("adminHelpersBtn").textContent = t("adminHelpers"); adminEl("adminHelpersBtn").title = t("adminHelpers");
    if(typeof tagMgrButtonHtml === "function") adminEl("adminTagsBtn").innerHTML = tagMgrButtonHtml(); else adminEl("adminTagsBtn").textContent = t("tagMgrTitle"); adminEl("adminTagsBtn").title = t("tagMgrTitle"); // 77
    adminEl("adminNote").placeholder = t("adminNotePlaceholder");
    var cb = adminEl("adminCloseBtn");
    cb.title = t("settingsClose"); cb.setAttribute("aria-label", t("settingsClose"));
    if(!cb.firstChild) cb.innerHTML = ICON_X;
    adminEl("adminIndexLink").href = SEARCH_INDEX_WORKFLOW_URL;
  }

  function renderAdminLast(){
    var lbl = lastVersionLabel(adminPtr);
    var date = adminPtr ? formatPublishedDate(adminPtr.publishedAt) : "";
    adminEl("adminLastValue").textContent = lbl ? (lbl + (date ? " · " + date : "")) : t("adminNoVersion");
  }

  function openAdminPanel(){
    if(typeof isAdminAccount !== "function" || !isAdminAccount()) return;
    renderAdminStatic();
    if(typeof renderAdminStats === "function") renderAdminStats(adminEl("adminStatsBody")); // 75
    adminPtr = null; adminPending = null; adminBusy = false;
    adminEl("adminNote").value = "";
    adminEl("adminVersion").value = "";
    adminEl("adminLastValue").textContent = "…";
    renderAdminPending(); updateAdminPublishState();
    adminEl("adminOverlay").classList.add("show");
    if(typeof getPublishedPointer === "function"){
      Promise.resolve(getPublishedPointer()).then(function(p){
        adminPtr = p || {};
        renderAdminLast();
        adminEl("adminVersion").value = nextVersionLabel(lastVersionLabel(adminPtr));
      }).catch(function(){ renderAdminLast(); adminEl("adminVersion").value = nextVersionLabel(""); });
    } else { renderAdminLast(); adminEl("adminVersion").value = nextVersionLabel(""); }
    refreshAdminPending();
  }
  function refreshAdminPending(){
    var s = typeof getPendingSummary === "function" ? getPendingSummary() : null;
    adminPending = normalizePending(s);
    renderAdminPending(); updateAdminPublishState();
  }
  function closeAdminPanel(){ closeAdminSubModals(); adminEl("adminOverlay").classList.remove("show"); }
  function isAdminPanelOpen(){ return adminEl("adminOverlay").classList.contains("show"); }

  // Success toast with a clickable 「更新搜尋索引」 link (showToast escapes HTML, so append the node afterwards).
  function showPublishedToast(label){
    showToast(adminFmt(t("adminPublished"), { label: label }));
    var toast = document.querySelector("#toastContainer .toast");
    if(!toast) return;
    var a = document.createElement("a");
    a.href = SEARCH_INDEX_WORKFLOW_URL; a.target = "_blank"; a.rel = "noopener";
    a.className = "toast-link"; a.textContent = t("adminIndexLink");
    a.addEventListener("click", function(ev){ if(typeof openIndexGuide === "function"){ ev.preventDefault(); openIndexGuide(); } }); // 78
    toast.appendChild(a);
  }

  function publishFromAdminPanel(){
    if(adminBusy || !adminPending || !adminPending.total) return;
    var label = adminEl("adminVersion").value.trim();
    var note = adminEl("adminNote").value.trim();
    var err = validateVersionLabel(label);
    if(err) return showToast(t(err), "error");
    if(!note) return showToast(t("adminNoteEmpty"), "error");
    if(typeof publishSpaceIndexUpdate !== "function") return showToast(t("adminPublishFail"), "error");
    openConfirm(t("adminConfirmTitle"), adminFmt(t("adminConfirmBody"), { label: label, counts: formatPendingCounts(adminPending) }), function(){
      adminBusy = true; updateAdminPublishState();
      Promise.resolve(publishSpaceIndexUpdate(note, label)).then(function(r){
        adminBusy = false;
        if(r && r.ok){
          showPublishedToast(r.label || label);
          adminEl("adminNote").value = "";
          adminPtr = { latestVersion: r.version, latestLabel: r.label || label, publishedAt: new Date() };
          renderAdminLast();
          adminEl("adminVersion").value = nextVersionLabel(adminPtr.latestLabel);
          refreshAdminPending();
          if(typeof refreshUpdatesBadge === "function") refreshUpdatesBadge();
        } else {
          showToast(t("adminPublishFail"), "error");
          updateAdminPublishState();
        }
      }).catch(function(){
        adminBusy = false; updateAdminPublishState();
        showToast(t("adminPublishFail"), "error");
      });
    });
  }

  /* ---------------- Sub-modals (opened from the admin panel's button row) ----------------
     Own overlays inserted before #confirmOverlay (so confirms stack above). The Esc chain in 90 is
     not touched: a capture-phase listener below closes the topmost sub-modal first. */
  var ADMIN_SUB_IDS = ["mailboxOverlay", "adminBackupOverlay", "adminHelpersOverlay", "adminTagsOverlay", "adminIndexOverlay"];
  function adminSubModal(id, titleKey, extraClass){
    var ov = document.getElementById(id);
    if(!ov){
      ov = document.createElement("div");
      ov.className = "modal-overlay"; ov.id = id;
      ov.innerHTML = '<div class="modal modal-lg ' + (extraClass || "") + '"><div class="settings-head"><div class="modal-title"></div>' +
        '<button type="button" class="icon-btn settings-close" data-close="1"></button></div><div class="modal-scroll"></div></div>';
      var ref = document.getElementById("confirmOverlay");
      if(ref && ref.parentNode) ref.parentNode.insertBefore(ov, ref); else document.body.appendChild(ov);
      ov.querySelector("[data-close]").innerHTML = ICON_X;
      ov.addEventListener("click", function(ev){
        if(ev.target === ov || ev.target.closest("[data-close]")) ov.classList.remove("show");
      });
    }
    ov.querySelector(".modal-title").textContent = t(titleKey);
    var cb = ov.querySelector("[data-close]");
    cb.title = t("settingsClose"); cb.setAttribute("aria-label", t("settingsClose"));
    return ov;
  }
  // Returns the topmost open sub-modal element, or null.
  function topAdminSubModal(){
    for(var i = ADMIN_SUB_IDS.length - 1; i >= 0; i--){
      var el = document.getElementById(ADMIN_SUB_IDS[i]);
      if(el && el.classList.contains("show")) return el;
    }
    return null;
  }
  function closeAdminSubModals(){
    ADMIN_SUB_IDS.forEach(function(id){
      var el = document.getElementById(id);
      if(el) el.classList.remove("show");
    });
  }
  function openAdminBackup(){
    var ov = adminSubModal("adminBackupOverlay", "adminBackup", "admin-sub-modal");
    ov.classList.add("show");
    if(typeof renderAdminBackup === "function") renderAdminBackup(ov.querySelector(".modal-scroll")); // 75
  }
  function openAdminHelpers(){
    var ov = adminSubModal("adminHelpersOverlay", "adminHelpers", "admin-sub-modal");
    ov.classList.add("show");
    if(typeof renderAdminHelpers === "function") renderAdminHelpers(ov.querySelector(".modal-scroll")); // 71
  }
  // Esc closes a sub-modal first (a confirm dialog on top keeps its own Esc handling in 90).
  document.addEventListener("keydown", function(ev){
    if(ev.key !== "Escape") return;
    var c = document.getElementById("confirmOverlay");
    if(c && c.classList.contains("show")) return;
    var ov = topAdminSubModal();
    if(!ov) return;
    ov.classList.remove("show");
    ev.stopPropagation();
  }, true);

  adminEl("adminMailboxBtn").addEventListener("click", function(){ if(typeof openMailbox === "function") openMailbox(); }); // 73
  adminEl("adminBackupBtn").addEventListener("click", openAdminBackup);
  adminEl("adminHelpersBtn").addEventListener("click", openAdminHelpers);
  adminEl("adminCloseBtn").addEventListener("click", closeAdminPanel);
  adminEl("adminOverlay").addEventListener("click", function(ev){ if(ev.target.id === "adminOverlay") closeAdminPanel(); });
  adminEl("adminPublishBtn").addEventListener("click", publishFromAdminPanel);
  adminEl("settingsAdminBtn").addEventListener("click", openAdminPanel);
