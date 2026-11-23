"use strict";

  /* ============================================================
     TOOLS — 小工具 registry, rail button and tools sheet (F7)
     Slot reserved now; each tool ships later by setting its `open`
     function (null = coming soon, card disabled). The overlay is built
     lazily here so index.html needs no markup.
  ============================================================ */
  var TOOLS_ICON_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="6.5" height="6.5" rx="1.6"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.6"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.6"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.6"/></svg>';
  var TOOL_ICON_DICE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="3.5"/><circle cx="9" cy="9" r="1.1" fill="currentColor"/><circle cx="15" cy="15" r="1.1" fill="currentColor"/><circle cx="15" cy="9" r="1.1" fill="currentColor"/><circle cx="9" cy="15" r="1.1" fill="currentColor"/></svg>';
  var TOOL_ICON_LIST = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 6.5l1.5 1.5 2.5-3M4.5 12.5l1.5 1.5 2.5-3M4.5 18.5l1.5 1.5 2.5-3"/><path d="M12 7h8M12 13h8M12 19h8"/></svg>';
  var TOOL_ICON_TIMER = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="13.5" r="7.5"/><path d="M12 9.5v4l2.5 1.5M9.5 3h5"/></svg>';

  var TOOL_ICON_COMBO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="9" height="9" rx="2"/><circle cx="6.5" cy="7.5" r="0.9" fill="currentColor"/><circle cx="8.5" cy="9.5" r="0.9" fill="currentColor"/><rect x="12" y="11" width="9" height="9" rx="2"/><circle cx="15.5" cy="14.5" r="0.9" fill="currentColor"/><circle cx="17.5" cy="16.5" r="0.9" fill="currentColor"/><circle cx="15.5" cy="16.5" r="0.9" fill="currentColor"/><circle cx="17.5" cy="14.5" r="0.9" fill="currentColor"/></svg>';
  var TOOL_ICON_GAME = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="7" cy="7" r="2.5"/><circle cx="17" cy="7" r="2.5"/><path d="M3 19v-1.5a4 4 0 0 1 4-4h0a4 4 0 0 1 4 4V19M13 19v-1.5a4 4 0 0 1 4-4h0a4 4 0 0 1 4 4V19"/></svg>';
  var TOOL_ICON_MATCH = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v16M7 20h10M5 7h14"/><path d="M5 7l-2.5 6a2.8 2.8 0 0 0 5 0L5 7zM19 7l-2.5 6a2.8 2.8 0 0 0 5 0L19 7z"/></svg>';

  // Registry: add a tool by adding an entry; set `open` to a function to enable it.
  var TOOLS = [
    { id:"random",   icon:TOOL_ICON_DICE,  nameKey:"toolRandomName",   descKey:"toolRandomDesc",   open:null },
    { id:"practice", icon:TOOL_ICON_LIST,  nameKey:"toolPracticeName", descKey:"toolPracticeDesc", open:null },
    { id:"kwc",      icon:TOOL_ICON_TIMER, nameKey:"toolKwcName",      descKey:"toolKwcDesc",      open:null },
    { id:"combo",    icon:TOOL_ICON_COMBO, nameKey:"toolComboName",    descKey:"toolComboDesc",    open:null },
    { id:"kengame",  icon:TOOL_ICON_GAME,  nameKey:"toolKengameName",  descKey:"toolKengameDesc",  open:null },
    { id:"match",    icon:TOOL_ICON_MATCH, nameKey:"toolMatchName",    descKey:"toolMatchDesc",    open:null }
  ];

  addStrings({
    zh:{ toolsTitle:"小工具", toolsSub:"練習與比賽用的小幫手", toolsClose:"關閉", toolSoon:"即將推出",
         toolRandomName:"隨機抽招", toolRandomDesc:"依條件隨機抽出招式（可設定抽取條件）",
         toolPracticeName:"練習清單", toolPracticeDesc:"選招建立清單、設定次數、點按計數",
         toolKwcName:"KWC 工具", toolKwcDesc:"快速配初賽／決賽招式，附計時器，可請人幫忙記錄",
         toolComboName:"擲骰串招", toolComboDesc:"擲骰子隨機串出連續招式",
         toolKengameName:"KenGame", toolKengameDesc:"和朋友輪流出招的對戰遊戲",
         toolMatchName:"指定賽", toolMatchDesc:"比對兩人的招式庫，配出題目池再抽題" },
    jp:{ toolsTitle:"ツール", toolsSub:"練習や大会に使える便利ツール", toolsClose:"閉じる", toolSoon:"近日公開",
         toolRandomName:"ランダム出題", toolRandomDesc:"条件を指定して技をランダムに抽選",
         toolPracticeName:"練習リスト", toolPracticeDesc:"技を選んでリスト化、回数を設定してタップでカウント",
         toolKwcName:"KWC ツール", toolKwcDesc:"予選／決勝の技を素早く構成。タイマー付きで、記録を他の人に頼むことも可能",
         toolComboName:"サイコロ連続技", toolComboDesc:"サイコロで技をランダムにつなげる",
         toolKengameName:"KenGame", toolKengameDesc:"友達と交互に技を出し合う対戦ゲーム",
         toolMatchName:"指定技バトル", toolMatchDesc:"二人の技リストから出題プールを作って抽選" },
    en:{ toolsTitle:"Tools", toolsSub:"Handy helpers for practice and contests", toolsClose:"Close", toolSoon:"Coming soon",
         toolRandomName:"Random Trick", toolRandomDesc:"Draw random tricks by your own conditions",
         toolPracticeName:"Practice List", toolPracticeDesc:"Pick tricks, set reps, and tap to count",
         toolKwcName:"KWC Tools", toolKwcDesc:"Build prelim/final trick sets fast, with a timer and a helper to log for you",
         toolComboName:"Dice Combo", toolComboDesc:"Roll dice to chain random tricks into a combo",
         toolKengameName:"KenGame", toolKengameDesc:"Take turns calling tricks with friends",
         toolMatchName:"Set Trick Match", toolMatchDesc:"Match two players' trick lists into a pool, then draw" }
  });

  function getToolById(id){
    for(var i = 0; i < TOOLS.length; i++) if(TOOLS[i].id === id) return TOOLS[i];
    return null;
  }
  function isToolAvailable(tool){ return !!tool && typeof tool.open === "function"; }

  function isToolsOpen(){
    var ov = document.getElementById("toolsOverlay");
    return !!ov && ov.classList.contains("show");
  }

  function renderToolsSheet(){
    var ov = document.getElementById("toolsOverlay");
    if(!ov) return;
    ov.querySelector(".tools-title").textContent = t("toolsTitle");
    ov.querySelector(".tools-sub").textContent = t("toolsSub");
    var closeBtn = ov.querySelector(".tools-close");
    closeBtn.title = t("toolsClose");
    closeBtn.setAttribute("aria-label", t("toolsClose"));
    var list = ov.querySelector(".tools-list");
    list.innerHTML = "";
    TOOLS.forEach(function(tool){
      var ok = isToolAvailable(tool);
      var card = document.createElement("button");
      card.type = "button";
      card.className = "tool-card" + (ok ? "" : " soon");
      card.dataset.toolId = tool.id;
      card.disabled = !ok;
      card.innerHTML =
        '<span class="tool-card-icon">' + tool.icon + '</span>' +
        '<span class="tool-card-text"><span class="tool-card-name">' + escapeHtml(t(tool.nameKey)) + '</span>' +
        '<span class="tool-card-desc">' + escapeHtml(t(tool.descKey)) + '</span></span>' +
        (ok ? "" : '<span class="tool-card-badge">' + escapeHtml(t("toolSoon")) + '</span>');
      if(ok) card.addEventListener("click", function(){ closeTools(); tool.open(); });
      list.appendChild(card);
    });
  }

  function ensureToolsOverlay(){
    var ov = document.getElementById("toolsOverlay");
    if(ov) return ov;
    ov = document.createElement("div");
    ov.className = "modal-overlay";
    ov.id = "toolsOverlay";
    ov.innerHTML =
      '<div class="modal modal-lg tools-modal" role="dialog" aria-modal="true">' +
        '<div class="settings-head"><div><div class="modal-title tools-title"></div><div class="modal-sub tools-sub"></div></div>' +
        '<button type="button" class="icon-btn settings-close tools-close">' + ICON_X + '</button></div>' +
        '<div class="modal-scroll tools-list"></div>' +
      '</div>';
    document.body.appendChild(ov);
    ov.addEventListener("click", function(ev){ if(ev.target === ov) closeTools(); });
    ov.querySelector(".tools-close").addEventListener("click", closeTools);
    return ov;
  }

  function openTools(){
    var ov = ensureToolsOverlay();
    renderToolsSheet();
    ov.classList.add("show");
    syncToolsRailBtn();
  }
  function closeTools(){
    var ov = document.getElementById("toolsOverlay");
    if(ov) ov.classList.remove("show");
    syncToolsRailBtn();
  }
  function syncToolsRailBtn(){
    var b = document.querySelector(".rail-tools-btn");
    if(b) b.classList.toggle("on", isToolsOpen());
  }

  // Rail button (called from js/12-shell-rail.js; own class so the tour's
  // ".rail-edit-toggle" selector keeps pointing at the edit button).
  function buildToolsRailBtn(){
    var b = document.createElement("button");
    b.type = "button";
    b.className = "rail-tools-btn" + (isToolsOpen() ? " on" : "");
    b.title = t("toolsTitle");
    b.setAttribute("aria-label", t("toolsTitle"));
    b.innerHTML = TOOLS_ICON_SVG;
    b.addEventListener("click", openTools);
    return b;
  }

  // Capture-phase Esc so the generic handler in 90-events-and-init.js
  // (which would also close the drawer) does not run while the sheet is open.
  window.addEventListener("keydown", function(ev){
    if(ev.key !== "Escape" || !isToolsOpen()) return;
    ev.stopPropagation();
    closeTools();
  }, true);
