"use strict";

  /* ============================================================
     PART INFO PAGE — read-only 部位 explanation, opened by the 「部位 ⓘ」 title above the part diagram
     (createPartDiagram opts.info in js/35). Three worked examples; part names come from t("part_<key>").
  ============================================================ */
  addStrings({
    zh:{ partTitle:"部位", partInfoTitle:"部位說明", partInfoIntro:"是劍與球、劍與線實際接觸的部位，用於表示某些招式的特徵。" },
    jp:{ partTitle:"部位", partInfoTitle:"部位について", partInfoIntro:"けんと玉、けんと糸が実際に触れる部位で、一部の技の特徴を表すために使います。" },
    en:{ partTitle:"Parts", partInfoTitle:"Parts", partInfoIntro:"The spots where the ken touches the ball or the string. They describe the character of certain tricks." }
  });

  // Worked examples: trick name (3 langs) + English name + part keys.
  function partInfoExamples(){
    return [
      { name:{ zh:"月面", jp:"月面（ルナ）", en:"Lunar" }, en:"Lunar", parts:["sara", "tamaTop"] },
      { name:{ zh:"掛線", jp:"フライングV", en:"Flying V" }, en:"Flying V", parts:["string", "junction"] },
      { name:{ zh:"稻草人", jp:"BB（ビービー）", en:"BB" }, en:"BB", parts:["kensaki", "tamaPoint"] }
    ];
  }
  function partInfoHtml(){
    var lang = typeof state !== "undefined" && state.lang ? state.lang : "zh";
    var h = '<div class="rate-info-intro">' + escapeHtml(t("partInfoIntro")) + '</div><div class="rate-info-list">';
    partInfoExamples().forEach(function(ex){
      var nm = ex.name[lang] || ex.name.zh;
      h += '<div class="part-info-row"><span class="part-info-name">' + escapeHtml(nm) +
        (nm !== ex.en ? '<small>' + escapeHtml(ex.en) + '</small>' : "") + '</span><span class="part-info-arrow">→</span>';
      ex.parts.forEach(function(k, i){
        h += (i ? '<span class="part-info-arrow">＋</span>' : "") + '<span class="drawer-chip">' + escapeHtml(t("part_" + k)) + '</span>';
      });
      h += '</div>';
    });
    return h + '<div class="part-info-more">…</div></div>';
  }

  function partInfoOverlay(){
    var ov = document.getElementById("partInfoOverlay");
    if(ov) return ov;
    ov = document.createElement("div");
    ov.className = "modal-overlay";
    ov.id = "partInfoOverlay";
    ov.innerHTML = '<div class="modal rate-info-modal"><div class="modal-scroll">' +
      '<div class="modal-title" id="partInfoTitle"></div><div id="partInfoBody"></div></div>' +
      '<div class="modal-footer"><div class="modal-actions"><button type="button" class="btn btn-ghost" id="partInfoCloseBtn"></button></div></div></div>';
    document.body.appendChild(ov);
    document.getElementById("partInfoCloseBtn").addEventListener("click", closePartInfo);
    ov.addEventListener("click", function(ev){
      ev.stopPropagation();
      if(ev.target === ov) closePartInfo();
    });
    return ov;
  }
  function openPartInfo(){
    var ov = partInfoOverlay();
    document.getElementById("partInfoTitle").textContent = t("partInfoTitle");
    document.getElementById("partInfoCloseBtn").textContent = t("gripInfoClose");
    document.getElementById("partInfoBody").innerHTML = partInfoHtml();
    ov.classList.add("show");
  }
  function closePartInfo(){
    var ov = document.getElementById("partInfoOverlay");
    if(ov) ov.classList.remove("show");
  }
  // Escape closes only this page (before the generic handler in js/90).
  document.addEventListener("keydown", function(ev){
    if(ev.key !== "Escape") return;
    var ov = document.getElementById("partInfoOverlay");
    if(!ov || !ov.classList.contains("show")) return;
    ev.stopImmediatePropagation();
    closePartInfo();
  });
