"use strict";

  /* ============================================================
     PRACTICE LIST — modal UI (opened from the tools sheet, js/80-tools.js).
     Logic: js/83-practice-logic.js. Storage / cloud: js/85-practice-sync.js.
     Two views in one modal: overview (all lists) and detail (one list).
  ============================================================ */
  addStrings({
    zh:{ pracTitle:"練習清單", pracClose:"關閉", pracBack:"返回", pracNew:"新增清單", pracDefaultName:"練習清單",
         pracListsFull:"已達 20 個清單上限", pracEmpty:"還沒有清單，按「新增清單」開始", pracProgress:"{d} / {n} 招達標",
         pracRenameHint:"點名稱可改名", pracNamePh:"清單名稱（最多 40 字）", pracReset:"重設次數", pracDelete:"刪除清單",
         pracResetTitle:"重設所有次數？", pracResetBody:"這份清單的所有招式次數會歸零（目標不變）。",
         pracDeleteTitle:"刪除這份清單？", pracDeleteBody:"清單與次數會一併刪除，無法復原。",
         pracAddTrick:"新增招式", pracSearchPh:"輸入招式名稱搜尋", pracNoResult:"找不到符合的招式",
         pracItemsFull:"每份清單最多 50 招", pracAdded:"已加入", pracNoTricks:"清單還是空的，用「新增招式」加入",
         pracTarget:"目標", pracMinus:"減 1", pracPlus:"加 1", pracRemove:"移出清單", pracGoTrick:"開啟招式", pracDone:"達標" },
    jp:{ pracTitle:"練習リスト", pracClose:"閉じる", pracBack:"戻る", pracNew:"リストを追加", pracDefaultName:"練習リスト",
         pracListsFull:"リストは最大 20 件です", pracEmpty:"リストがありません。「リストを追加」で始めましょう", pracProgress:"{d} / {n} 技 達成",
         pracRenameHint:"名前をタップで変更", pracNamePh:"リスト名（40 文字まで）", pracReset:"回数をリセット", pracDelete:"リストを削除",
         pracResetTitle:"回数をすべてリセットしますか？", pracResetBody:"このリストのすべての回数が 0 に戻ります（目標は変わりません）。",
         pracDeleteTitle:"このリストを削除しますか？", pracDeleteBody:"リストと回数が削除され、元に戻せません。",
         pracAddTrick:"技を追加", pracSearchPh:"技の名前で検索", pracNoResult:"該当する技がありません",
         pracItemsFull:"1 つのリストには最大 50 技までです", pracAdded:"追加済み", pracNoTricks:"リストは空です。「技を追加」で加えましょう",
         pracTarget:"目標", pracMinus:"1 減らす", pracPlus:"1 増やす", pracRemove:"リストから外す", pracGoTrick:"技を開く", pracDone:"達成" },
    en:{ pracTitle:"Practice List", pracClose:"Close", pracBack:"Back", pracNew:"New list", pracDefaultName:"Practice list",
         pracListsFull:"Limit of 20 lists reached", pracEmpty:"No lists yet. Press \"New list\" to start", pracProgress:"{d} / {n} tricks done",
         pracRenameHint:"Tap the name to rename", pracNamePh:"List name (max 40 chars)", pracReset:"Reset counts", pracDelete:"Delete list",
         pracResetTitle:"Reset all counts?", pracResetBody:"Every count in this list goes back to 0 (targets stay).",
         pracDeleteTitle:"Delete this list?", pracDeleteBody:"The list and its counts will be deleted. This cannot be undone.",
         pracAddTrick:"Add tricks", pracSearchPh:"Search by trick name", pracNoResult:"No matching tricks",
         pracItemsFull:"A list holds at most 50 tricks", pracAdded:"Added", pracNoTricks:"This list is empty. Use \"Add tricks\"",
         pracTarget:"Target", pracMinus:"Minus 1", pracPlus:"Plus 1", pracRemove:"Remove from list", pracGoTrick:"Open trick", pracDone:"Done" }
  });

  var prac = { view: "list", listId: null, renaming: false, adding: false, query: "" };

  function pracEl(id){ return document.getElementById(id); }
  function practiceIsOpen(){ var o = pracEl("practiceOverlay"); return !!o && o.classList.contains("show"); }
  function pracHas(id){ return !!getTrick(id); }
  function pracList(){ return prac.listId ? findPracticeList(practiceGet(), prac.listId) : null; }
  function pracMk(tag, cls, text){
    var e = document.createElement(tag);
    if(cls) e.className = cls;
    if(text != null) e.textContent = text;
    return e;
  }
  function pracBtn(cls, label, html, onClick){
    var b = pracMk("button", cls); b.type = "button";
    b.title = label; b.setAttribute("aria-label", label);
    if(html) b.innerHTML = html;
    b.addEventListener("click", onClick);
    return b;
  }
  function pracIcon(tr){
    var icon = pracMk("div", "item-icon trick");
    var hex = tr.color ? colorHex(tr.color) : TRICK_DEFAULT_HEX;
    icon.style.background = hexToRgba(hex, 0.22); icon.style.color = hex;
    if(isImageIcon(tr.icon)){ icon.classList.add("img-icon"); icon.innerHTML = iconHtml(tr.icon); }
    else if(tr.icon){ icon.style.fontSize = "15px"; icon.textContent = tr.icon; } else { icon.innerHTML = ICON_PLAY; }
    return icon;
  }

  /* ---------- overview ---------- */
  function pracRenderOverview(){
    var data = practiceGet(), body = pracEl("pracBody");
    body.innerHTML = "";
    var full = data.lists.length >= PRACTICE_MAX_LISTS;
    var add = pracMk("button", "btn btn-primary prac-new", t("pracNew")); add.type = "button";
    add.disabled = full;
    add.addEventListener("click", function(){
      var l = createPracticeList(data, t("pracDefaultName") + " " + (data.lists.length + 1));
      if(!l) return;
      practiceChanged();
      prac.view = "detail"; prac.listId = l.id; prac.renaming = true; prac.adding = false; prac.query = "";
      practiceRender();
    });
    body.appendChild(add);
    if(full) body.appendChild(pracMk("div", "field-hint", t("pracListsFull")));
    if(!data.lists.length){ body.appendChild(pracMk("div", "search-empty", t("pracEmpty"))); return; }
    var host = pracMk("div", "prac-lists");
    data.lists.forEach(function(l){
      var p = practiceProgress(l, pracHas);
      var row = pracMk("button", "prac-list-row" + (p.total && p.done === p.total ? " done" : "")); row.type = "button";
      var txt = pracMk("div", "prac-list-text");
      txt.appendChild(pracMk("div", "prac-list-name", l.name));
      txt.appendChild(pracMk("div", "prac-list-meta", t("pracProgress").replace("{d}", p.done).replace("{n}", p.total)));
      row.appendChild(txt);
      var chev = pracMk("span", "prac-chev"); chev.innerHTML = ICON_CHEVRON; row.appendChild(chev);
      row.addEventListener("click", function(){ prac.view = "detail"; prac.listId = l.id; prac.renaming = false; prac.adding = false; prac.query = ""; practiceRender(); });
      host.appendChild(row);
    });
    body.appendChild(host);
  }

  /* ---------- detail ---------- */
  function pracBuildRow(list, it){
    var tr = getTrick(it.trickId);
    if(!tr) return null;
    var row = pracMk("div", "prac-row" + (practiceItemDone(it) ? " done" : ""));
    row.dataset.trickId = it.trickId;
    var icon = pracIcon(tr); icon.classList.add("prac-icon");
    icon.title = t("pracGoTrick");
    icon.addEventListener("click", function(){ closePracticeTool(); goToTrickLocation(it.trickId); });
    var top = pracMk("div", "prac-row-top");
    top.appendChild(icon);
    top.appendChild(pracMk("div", "prac-row-name", localize(tr.name)));
    var chk = pracMk("span", "prac-check"); chk.innerHTML = ICON_CHECK; chk.title = t("pracDone"); top.appendChild(chk);
    top.appendChild(pracBtn("icon-btn prac-remove", t("pracRemove"), ICON_X, function(){
      removePracticeTrick(list, it.trickId); practiceChanged(); pracRenderDetail();
    }));
    var ctl = pracMk("div", "prac-row-ctl");
    function refresh(){ var n = pracBuildRow(list, it); if(n && row.parentNode) row.parentNode.replaceChild(n, row); }
    ctl.appendChild(pracBtn("btn prac-minus", t("pracMinus"), "−1", function(){ bumpPracticeCount(list, it.trickId, -1); practiceChanged(); refresh(); }));
    var cnt = pracMk("div", "prac-count");
    cnt.appendChild(pracMk("span", "prac-count-n", String(it.count)));
    cnt.appendChild(pracMk("span", "prac-count-t", " / " + it.target));
    ctl.appendChild(cnt);
    var tg = pracMk("label", "prac-target"); tg.appendChild(pracMk("span", null, t("pracTarget")));
    var inp = pracMk("input"); inp.type = "number"; inp.min = "1"; inp.max = String(PRACTICE_TARGET_MAX); inp.value = it.target;
    inp.setAttribute("inputmode", "numeric");
    inp.addEventListener("change", function(){ setPracticeTarget(list, it.trickId, inp.value); practiceChanged(); refresh(); });
    tg.appendChild(inp); ctl.appendChild(tg);
    ctl.appendChild(pracBtn("btn btn-primary prac-plus", t("pracPlus"), "+1", function(){ bumpPracticeCount(list, it.trickId, 1); practiceChanged(); refresh(); }));
    row.appendChild(top); row.appendChild(ctl);
    return row;
  }

  function pracRenderRows(list){
    var host = pracEl("pracRows");
    if(!host) return;
    host.innerHTML = "";
    var shown = 0;
    list.items.forEach(function(it){ var r = pracBuildRow(list, it); if(r){ host.appendChild(r); shown++; } });
    if(!shown) host.appendChild(pracMk("div", "search-empty", t("pracNoTricks")));
  }

  function pracRenderResults(list){
    var host = pracEl("pracResults");
    if(!host) return;
    host.innerHTML = "";
    var q = prac.query.trim();
    if(!q) return;
    var ids = runSearch(getSearchIndex(), q, {}).filter(pracHas).slice(0, 20);
    if(!ids.length){ host.appendChild(pracMk("div", "search-note", t("pracNoResult"))); return; }
    ids.forEach(function(id){
      var tr = getTrick(id), inList = !!findPracticeItem(list, id);
      var r = pracMk("button", "prac-result" + (inList ? " in" : "")); r.type = "button";
      r.appendChild(pracIcon(tr));
      r.appendChild(pracMk("span", "prac-result-name", localize(tr.name)));
      var tag = pracMk("span", "prac-result-tag"); if(inList) tag.textContent = t("pracAdded"); else tag.innerHTML = ICON_PLUS; r.appendChild(tag);
      r.addEventListener("click", function(){
        if(findPracticeItem(list, id)) return;
        var res = addPracticeTrick(list, id);
        if(res === "full"){ showToast(t("pracItemsFull")); return; }
        if(res !== true) return;
        practiceChanged(); pracRenderRows(list); pracRenderResults(list);
      });
      host.appendChild(r);
    });
  }

  function pracRenderTitle(list){
    var host = pracEl("pracTitleBox");
    host.innerHTML = "";
    if(prac.view === "list"){ host.appendChild(pracMk("div", "modal-title", t("pracTitle"))); return; }
    if(prac.renaming){
      var inp = pracMk("input", "prac-name-input"); inp.type = "text"; inp.maxLength = PRACTICE_NAME_MAX;
      inp.value = list.name; inp.placeholder = t("pracNamePh");
      var done = false;
      function finish(save){
        if(done) return; done = true; prac.renaming = false;
        if(save && renamePracticeList(practiceGet(), list.id, inp.value)) practiceChanged();
        var cur = pracList();
        if(cur || prac.view === "list") pracRenderTitle(cur);
      }
      inp.addEventListener("keydown", function(ev){
        if(ev.key === "Enter"){ ev.preventDefault(); finish(true); }
        else if(ev.key === "Escape"){ ev.stopPropagation(); finish(false); }
      });
      inp.addEventListener("blur", function(){ finish(true); });
      host.appendChild(inp);
      setTimeout(function(){ inp.focus(); inp.select(); }, 0);
      return;
    }
    var nm = pracMk("button", "modal-title prac-name", list.name); nm.type = "button"; nm.title = t("pracRenameHint");
    nm.addEventListener("click", function(){ prac.renaming = true; pracRenderTitle(list); });
    host.appendChild(nm);
  }

  function pracRenderDetail(){
    var list = pracList(), body = pracEl("pracBody");
    if(!list){ prac.view = "list"; practiceRender(); return; }
    pracRenderTitle(list);
    body.innerHTML = "";
    var acts = pracMk("div", "prac-actions");
    acts.appendChild(pracBtn("btn btn-sm", t("pracReset"), null, function(){
      openConfirm(t("pracResetTitle"), t("pracResetBody"), function(){ resetPracticeCounts(list); practiceChanged(); pracRenderDetail(); });
    }));
    acts.lastChild.textContent = t("pracReset");
    var del = pracBtn("btn btn-sm btn-danger", t("pracDelete"), null, function(){
      openConfirm(t("pracDeleteTitle"), t("pracDeleteBody"), function(){
        deletePracticeList(practiceGet(), list.id); practiceChanged(); prac.view = "list"; prac.listId = null; practiceRender();
      });
    });
    del.textContent = t("pracDelete"); acts.appendChild(del);
    // Add-trick button sits first in the action row so it stays reachable on long lists.
    var add = pracMk("button", "btn btn-sm btn-primary prac-add-btn" + (prac.adding ? " active" : ""), t("pracAddTrick")); add.type = "button";
    add.addEventListener("click", function(){ prac.adding = !prac.adding; if(!prac.adding) prac.query = ""; pracRenderDetail(); });
    acts.insertBefore(add, acts.firstChild);
    body.appendChild(acts);
    if(prac.adding){
      var box = pracMk("div", "prac-add field");
      var inp = pracMk("input"); inp.type = "text"; inp.placeholder = t("pracSearchPh"); inp.value = prac.query;
      inp.addEventListener("input", function(){ prac.query = inp.value; pracRenderResults(list); });
      box.appendChild(inp);
      var res = pracMk("div", "prac-results"); res.id = "pracResults"; box.appendChild(res);
      body.appendChild(box);
      pracRenderResults(list);
      setTimeout(function(){ inp.focus(); }, 0);
    }
    body.appendChild(pracMk("div", "prac-rows", null)).id = "pracRows";
    pracRenderRows(list);
  }

  function practiceRender(){
    if(!pracEl("practiceOverlay")) return;
    var back = pracEl("pracBack");
    back.style.display = prac.view === "detail" ? "" : "none";
    back.title = t("pracBack"); back.setAttribute("aria-label", t("pracBack"));
    pracEl("pracClose").title = t("pracClose"); pracEl("pracClose").setAttribute("aria-label", t("pracClose"));
    if(prac.view === "detail") pracRenderDetail();
    else { pracRenderTitle(null); pracRenderOverview(); }
  }

  /* ---------- open / close ---------- */
  function pracEnsureOverlay(){
    var ov = pracEl("practiceOverlay");
    if(ov) return ov;
    ov = document.createElement("div");
    ov.className = "modal-overlay"; ov.id = "practiceOverlay";
    ov.innerHTML =
      '<div class="modal modal-lg practice-modal" role="dialog" aria-modal="true">' +
        '<div class="settings-head"><button type="button" class="icon-btn" id="pracBack">' + ICON_ARROW_LEFT + '</button>' +
        '<div class="prac-title-box" id="pracTitleBox"></div>' +
        '<button type="button" class="icon-btn settings-close" id="pracClose">' + ICON_X + '</button></div>' +
        '<div class="modal-scroll" id="pracBody"></div></div>';
    document.body.appendChild(ov);
    ov.addEventListener("click", function(ev){ if(ev.target === ov) closePracticeTool(); });
    pracEl("pracClose").addEventListener("click", closePracticeTool);
    pracEl("pracBack").addEventListener("click", function(){ prac.view = "list"; prac.listId = null; prac.renaming = false; prac.adding = false; prac.query = ""; practiceRender(); });
    return ov;
  }
  function openPracticeTool(){
    var ov = pracEnsureOverlay();
    prac.view = "list"; prac.listId = null; prac.renaming = false; prac.adding = false; prac.query = "";
    practiceRender();
    ov.classList.add("show");
  }
  function closePracticeTool(){
    var ov = pracEl("practiceOverlay");
    if(ov) ov.classList.remove("show");
  }

  getToolById("practice").open = openPracticeTool;

  window.addEventListener("keydown", function(ev){
    if(ev.key !== "Escape" || !practiceIsOpen()) return;
    var c = pracEl("confirmOverlay");
    if(c && c.classList.contains("show")) return; // let the confirm dialog handle Esc
    if(prac.renaming) return; // the rename input cancels itself
    ev.stopPropagation();
    closePracticeTool();
  }, true);
