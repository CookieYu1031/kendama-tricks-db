"use strict";

  /* ============================================================
     RATE INFO PAGE — read-only 成功率 explanation, opened by the 「成功率 ⓘ」 label in the drawer (js/31).
     Lists the five levels (none + RATE_LEVELS) with their colour and rough success ratio.
  ============================================================ */
  addStrings({
    zh:{ rateInfoTitle:"成功率說明", rateInfoIntro:"依照你最近練習這招大約的成功比例選一個等級。招式圖示的光暈顏色會跟著等級改變。" },
    jp:{ rateInfoTitle:"成功率について", rateInfoIntro:"最近の練習でのおおよその成功率に合わせてレベルを選んでください。技アイコンの光の色がレベルに合わせて変わります。" },
    en:{ rateInfoTitle:"Success rate", rateInfoIntro:"Pick the level that matches roughly how often you land this trick in recent practice. The trick icon's glow changes colour with the level." }
  });

  // Rows for the page: [{ level, name, hint }], "none" first.
  function rateInfoRows(){
    return [null].concat(RATE_LEVELS).map(function(l){
      var key = l || "none";
      return { level: key, name: t("rate_" + key), hint: t("rateHint_" + key) };
    });
  }
  function rateInfoHtml(){
    var h = '<div class="rate-info-intro">' + escapeHtml(t("rateInfoIntro")) + '</div><div class="rate-info-list">';
    rateInfoRows().forEach(function(r){
      h += '<div class="rate-info-row"><span class="proficiency-btn active rate-info-chip" data-rate="' + r.level + '">' + escapeHtml(r.name) + '</span>' +
        '<span class="rate-info-hint">' + escapeHtml(r.hint) + '</span></div>';
    });
    return h + '</div>';
  }

  function rateInfoOverlay(){
    var ov = document.getElementById("rateInfoOverlay");
    if(ov) return ov;
    ov = document.createElement("div");
    ov.className = "modal-overlay";
    ov.id = "rateInfoOverlay";
    ov.innerHTML = '<div class="modal rate-info-modal"><div class="modal-scroll">' +
      '<div class="modal-title" id="rateInfoTitle"></div><div id="rateInfoBody"></div></div>' +
      '<div class="modal-footer"><div class="modal-actions"><button type="button" class="btn btn-ghost" id="rateInfoCloseBtn"></button></div></div></div>';
    document.body.appendChild(ov);
    document.getElementById("rateInfoCloseBtn").addEventListener("click", closeRateInfo);
    ov.addEventListener("click", function(ev){
      ev.stopPropagation();
      if(ev.target === ov) closeRateInfo();
    });
    return ov;
  }
  function openRateInfo(){
    var ov = rateInfoOverlay();
    document.getElementById("rateInfoTitle").textContent = t("rateInfoTitle");
    document.getElementById("rateInfoCloseBtn").textContent = t("gripInfoClose");
    document.getElementById("rateInfoBody").innerHTML = rateInfoHtml();
    ov.classList.add("show");
  }
  function closeRateInfo(){
    var ov = document.getElementById("rateInfoOverlay");
    if(ov) ov.classList.remove("show");
  }
  // Escape closes only this page (before the generic handler in js/90).
  document.addEventListener("keydown", function(ev){
    if(ev.key !== "Escape") return;
    var ov = document.getElementById("rateInfoOverlay");
    if(!ov || !ov.classList.contains("show")) return;
    ev.stopImmediatePropagation();
    closeRateInfo();
  });
