"use strict";

  /* ============================================================
     BROWSE — desktop keyboard shortcuts
  ============================================================ */
  // Module strings, registered into the UI table like 41/43/45/46/47 do.
  var KBD_STRINGS = {
    zh: { kbdHelp: "快捷鍵：/ 搜尋　↑↓ 選取　→／Enter 開啟　←／Backspace 返回上層　e 編輯模式　n 新增（編輯模式）　? 說明" },
    jp: { kbdHelp: "ショートカット：/ 検索　↑↓ 選択　→／Enter 開く　←／Backspace 前の階層　e 編集モード　n 追加（編集モード）　? ヘルプ" },
    en: { kbdHelp: "Shortcuts: / search  ↑↓ select  →/Enter open  ←/Backspace up a level  e edit mode  n add (edit mode)  ? help" }
  };
  if(typeof addStrings === "function") addStrings(KBD_STRINGS);
  function kbdText(key){
    if(typeof t === "function") return t(key);
    var m = KBD_STRINGS.zh;
    return m[key] || key;
  }

  // Pure: key -> action name or null.
  // ctx: { inField, modalOpen, drawerOpen, editMode, guest, searchOpen, ctrl (ctrl/meta/alt held) }
  function keyAction(key, ctx){
    if(ctx.inField || ctx.modalOpen || ctx.ctrl) return null;
    switch(key){
      case "/": return "search";
      case "?": return "help";
      case "Backspace": case "ArrowLeft": return "up";
      case "ArrowUp": return ctx.drawerOpen ? null : "prev";
      case "ArrowDown": return ctx.drawerOpen ? null : "next";
      case "ArrowRight": case "Enter": return ctx.drawerOpen ? null : "open";
      case "e": case "E": return ctx.guest ? null : "toggleEdit";
      case "n": case "N": return (ctx.editMode && !ctx.guest) ? "add" : null;
    }
    return null;
  }

  // Pure: next focused index in a list of `len` rows. cur -1 = none yet.
  function kbdNextIndex(cur, len, dir){
    if(len <= 0) return -1;
    if(cur < 0 || cur >= len) return dir > 0 ? 0 : len - 1;
    return Math.min(len - 1, Math.max(0, cur + dir));
  }

  function kbdRows(){
    var wrap = document.getElementById("millerWrap");
    if(!wrap) return [];
    var cols = wrap.querySelectorAll(".m-col");
    for(var i = cols.length - 1; i >= 0; i--){
      if(cols[i].classList.contains("collapsed")) continue;
      return Array.prototype.slice.call(cols[i].querySelectorAll(".col-items > .item"));
    }
    return Array.prototype.slice.call(wrap.querySelectorAll(".item"));
  }
  function kbdClear(rows){
    rows.forEach(function(r){ if(r._kbd){ r._kbd = false; r.style.outline = ""; r.style.outlineOffset = ""; } });
  }
  function kbdMove(dir){
    var rows = kbdRows(), cur = -1;
    rows.forEach(function(r, i){ if(r._kbd) cur = i; });
    if(cur < 0) rows.forEach(function(r, i){ if(cur < 0 && r.classList.contains("selected")) cur = i; });
    var nxt = kbdNextIndex(cur, rows.length, dir);
    if(nxt < 0) return;
    kbdClear(rows);
    rows[nxt]._kbd = true;
    rows[nxt].style.outline = "2px solid var(--lacquer-bright)";
    rows[nxt].style.outlineOffset = "-2px";
    if(rows[nxt].scrollIntoView) rows[nxt].scrollIntoView({ block: "nearest" });
  }
  function kbdOpen(){
    var rows = kbdRows(), row = null;
    rows.forEach(function(r){ if(r._kbd) row = r; });
    if(row) row.click();
  }

  function kbdDeepestParentId(){
    var wrap = document.getElementById("millerWrap");
    var cols = wrap ? wrap.querySelectorAll(".m-col") : [];
    var last = cols.length ? cols[cols.length - 1] : null;
    var key = last && last.dataset ? last.dataset.colKey : null;
    return (!key || key === "__root__") ? null : key;
  }

  function kbdContext(ev){
    var tg = ev.target;
    return {
      inField: !!(tg && tg.closest && tg.closest("input, textarea, select, [contenteditable]")),
      modalOpen: browseModalOpen(),
      drawerOpen: !!state.detailTrickId,
      editMode: !!state.editMode,
      guest: typeof isGuest === "function" && isGuest(),
      ctrl: !!(ev.ctrlKey || ev.metaKey || ev.altKey)
    };
  }

  function kbdRun(action){
    switch(action){
      case "search":
        if(typeof openSearchPanel === "function"){
          openSearchPanel();
          var si = document.getElementById("searchInput");
          if(si) si.focus();
        }
        return true;
      case "help": if(typeof showToast === "function") showToast(kbdText("kbdHelp")); return true;
      case "up": browseGoUp(); return true;
      case "prev": kbdMove(-1); return true;
      case "next": kbdMove(1); return true;
      case "open": kbdOpen(); return true;
      case "toggleEdit": state.editMode = !state.editMode; render(); return true;
      case "add":
        if(typeof openAddModal === "function") openAddModal(kbdDeepestParentId());
        return true;
    }
    return false;
  }

  document.addEventListener("keydown", function(ev){
    if(ev.key === "Enter" && ev.target && ev.target.closest && ev.target.closest("button, a")) return;
    var action = keyAction(ev.key, kbdContext(ev));
    if(action && kbdRun(action)) ev.preventDefault();
  });
