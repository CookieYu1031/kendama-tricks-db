"use strict";

  /* ============================================================
     SHELL — 導覽與快捷鍵 (v0.18). Opened from the settings row.
     Two pages in one fixed-size modal (built lazily, like js/19-shell-tutorial.js):
       menu  : 網站介紹 (-> startTour, js/18) | 快捷鍵 (desktop) / 手勢操作 (touch)
       keys  : the operation list for the current device only.
     Pure: guideItems(touch), guideModKey(platform), guideNeedsLogin(loggedIn).
     Item = { keys:["Mod","C"] | gesture:"guideG…", textKey }. Key tokens: "Mod" = Ctrl / ⌘,
     anything else = one <kbd>.
  ============================================================ */
  addStrings({
    zh:{ guideTitle:"導覽與快捷鍵", guideSub:"認識網站與操作方式", guideClose:"關閉", guideBack:"返回",
         guideTourName:"網站介紹", guideTourDesc:"約一分鐘，實際示範主要功能",
         guideKeysName:"快捷鍵", guideKeysDesc:"電腦鍵盤與滑鼠的操作",
         guideTouchName:"手勢操作", guideTouchDesc:"手機與平板的手勢",
         guideGroupBrowse:"瀏覽", guideGroupEdit:"編輯", guideNeedEdit:"編輯模式", guideNeedLogin:"需登入＋編輯模式",
         guideGHold:"長按", guideGSwipeR:"右滑", guideGSwipeL:"左滑項目", guideGBar:"頂端工具列", guideGStyle:"滴管／油漆", guideGBlank:"長按空白處", guideGPaste:"貼回同層",
         guideKeyCopy:"複製選取的項目（招式、清單、資訊）", guideKeyCut:"剪下選取的項目", guideKeyPaste:"貼到目前選取的清單",
         guideKeyUndo:"復原上一個編輯動作", guideKeyDel:"移除選取的項目",
         guideKeyShift:"按住 Shift 點選項目＝多選（同一欄），上方會出現工具列", guideKeyDropper:"滴管：複製選取項目的圖示與顏色（圖片不複製）", guideKeyPaint:"油漆：套用到選取的項目", guideKeyDrag:"長按項目拖曳，排序或移到其他清單",
         guideTouchBack:"手機上，右滑回上一層", guideTouchSwipeSel:"左滑項目＝選取，再左滑取消；可選多個",
         guideTouchBar:"選取後，頂端工具列可剪下、複製、貼上、移除、滴管、油漆", guideTouchStyle:"選一項按滴管（複製圖示與顏色，圖片不複製），再選一或多項按油漆套用", guideTouchBlank:"剪下或複製後，長按欄位空白處選擇貼上層級，再按工具列貼上",
         guideTouchDrag:"長按項目拖曳，排序或移到其他清單", guideTouchDup:"複製後貼回同一層＝在原地複製一份" },
    jp:{ guideTitle:"ガイドとショートカット", guideSub:"サイトの使い方を知る", guideClose:"閉じる", guideBack:"戻る",
         guideTourName:"サイト紹介", guideTourDesc:"約1分で、主な機能を実際に紹介します",
         guideKeysName:"ショートカット", guideKeysDesc:"パソコンのキーボードとマウス操作",
         guideTouchName:"ジェスチャー操作", guideTouchDesc:"スマホ・タブレットのジェスチャー",
         guideGroupBrowse:"閲覧", guideGroupEdit:"編集", guideNeedEdit:"編集モード", guideNeedLogin:"ログイン＋編集モード",
         guideGHold:"長押し", guideGSwipeR:"右スワイプ", guideGSwipeL:"項目を左スワイプ", guideGBar:"上部ツールバー", guideGStyle:"スポイト／ペイント", guideGBlank:"余白を長押し", guideGPaste:"同じ階層に貼り付け",
         guideKeyCopy:"選択した項目（技・リスト・情報）をコピー", guideKeyCut:"選択した項目を切り取り", guideKeyPaste:"選択中のリストに貼り付け",
         guideKeyUndo:"直前の編集を元に戻す", guideKeyDel:"選択した項目を削除",
         guideKeyShift:"Shift を押しながら項目をクリック＝複数選択（同じ列）、上部にツールバーが出ます", guideKeyDropper:"スポイト：選択した項目のアイコンと色をコピー（画像はコピーしません）", guideKeyPaint:"ペイント：選択した項目に適用", guideKeyDrag:"項目を長押ししてドラッグ。並べ替え・別のリストへ移動",
         guideTouchBack:"スマホで、右スワイプで一つ上の階層へ", guideTouchSwipeSel:"項目を左スワイプ＝選択、もう一度で解除。複数選択可",
         guideTouchBar:"選択後、上部ツールバーで切り取り・コピー・貼り付け・削除・スポイト・ペイント", guideTouchStyle:"1件を選んでスポイト（アイコンと色をコピー、画像は除く）、次に1件以上を選んでペイントで適用", guideTouchBlank:"切り取り／コピー後、列の余白を長押しして貼り付け階層を選び、ツールバーで貼り付け",
         guideTouchDrag:"項目を長押ししてドラッグ。並べ替え・別のリストへ移動", guideTouchDup:"コピー後に同じ階層へ貼り付け＝その場で複製" },
    en:{ guideTitle:"Tour & shortcuts", guideSub:"Learn the site and how to use it", guideClose:"Close", guideBack:"Back",
         guideTourName:"Site tour", guideTourDesc:"About a minute, with a live demo of the main features",
         guideKeysName:"Shortcuts", guideKeysDesc:"Keyboard and mouse controls",
         guideTouchName:"Gestures", guideTouchDesc:"Touch gestures for phones and tablets",
         guideGroupBrowse:"Browsing", guideGroupEdit:"Editing", guideNeedEdit:"Edit mode", guideNeedLogin:"Sign-in + edit mode",
         guideGHold:"Long-press", guideGSwipeR:"Swipe right", guideGSwipeL:"Swipe item left", guideGBar:"Top toolbar", guideGStyle:"Eyedropper / Paint", guideGBlank:"Long-press blank area", guideGPaste:"Paste in same list",
         guideKeyCopy:"Copy the selected items (tricks, lists, info)", guideKeyCut:"Cut the selected items", guideKeyPaste:"Paste into the selected list",
         guideKeyUndo:"Undo the last edit", guideKeyDel:"Remove the selected items",
         guideKeyShift:"Hold Shift and click items = multi-select (same column); a toolbar appears at the top", guideKeyDropper:"Eyedropper: copy the icon and color of the selected item (images are not copied)", guideKeyPaint:"Paint: apply it to the selected items", guideKeyDrag:"Long-press an item and drag to reorder or move to another list",
         guideTouchBack:"On phones, swipe right to go up one level", guideTouchSwipeSel:"Swipe an item left = select, again to deselect; pick several",
         guideTouchBar:"Once selected, the top toolbar cuts, copies, pastes, removes, eyedrops or paints", guideTouchStyle:"Select one item and tap Eyedropper (copies icon and color, not images), then select one or more and tap Paint", guideTouchBlank:"After cut or copy, long-press a blank area of a column to pick the paste level, then tap Paste",
         guideTouchDrag:"Long-press an item and drag to reorder or move to another list", guideTouchDup:"Copy, then paste back into the same list = duplicate in place" }
  });

  // Pure: the modifier key label. Mac-like platforms use ⌘, everything else Ctrl.
  function guideModKey(platform){
    return /mac|iphone|ipad|ipod/i.test(String(platform || "")) ? "⌘" : "Ctrl";
  }
  // Pure: the edit group needs sign-in only for guests.
  function guideNeedsLogin(loggedIn){ return !loggedIn; }

  // Pure: grouped operation list for one device kind.
  function guideItems(touch){
    if(touch) return [
      { group: "browse", items: [
        { gesture: "guideGSwipeR", textKey: "guideTouchBack" }
      ] },
      { group: "edit", items: [
        { gesture: "guideGSwipeL", textKey: "guideTouchSwipeSel" },
        { gesture: "guideGBar", textKey: "guideTouchBar" },
        { gesture: "guideGStyle", textKey: "guideTouchStyle" },
        { gesture: "guideGBlank", textKey: "guideTouchBlank" },
        { gesture: "guideGHold", textKey: "guideTouchDrag" },
        { gesture: "guideGPaste", textKey: "guideTouchDup" }
      ] }
    ];
    return [
      { group: "edit", items: [
        { keys: ["Shift"], textKey: "guideKeyShift" },
        { keys: ["Mod", "C"], textKey: "guideKeyCopy" },
        { keys: ["Mod", "X"], textKey: "guideKeyCut" },
        { keys: ["Mod", "V"], textKey: "guideKeyPaste" },
        { keys: ["Ctrl", "Alt", "C"], textKey: "guideKeyDropper" },
        { keys: ["Ctrl", "Alt", "V"], textKey: "guideKeyPaint" },
        { keys: ["Mod", "Z"], textKey: "guideKeyUndo" },
        { keys: ["Delete"], textKey: "guideKeyDel" },
        { gesture: "guideGHold", textKey: "guideKeyDrag" }
      ] }
    ];
  }

  var guideState = { page: "menu" };

  function guideIsOpen(){
    var ov = document.getElementById("guideOverlay");
    return !!ov && ov.classList.contains("show");
  }
  function guideIsTouch(){
    return typeof isTouchDevice === "function" && typeof tourEnv === "function" && isTouchDevice(tourEnv());
  }
  function guideEl(tag, cls, text){
    var e = document.createElement(tag);
    if(cls) e.className = cls;
    if(text != null) e.textContent = text;
    return e;
  }

  function ensureGuideOverlay(){
    var ov = document.getElementById("guideOverlay");
    if(ov) return ov;
    ov = document.createElement("div");
    ov.className = "modal-overlay";
    ov.id = "guideOverlay";
    ov.innerHTML =
      '<div class="modal modal-lg tut-modal guide-modal" role="dialog" aria-modal="true">' +
        '<div class="settings-head"><div><div class="modal-title guide-title"></div><div class="modal-sub guide-sub"></div></div>' +
        '<button type="button" class="icon-btn settings-close guide-close">' + ICON_X + '</button></div>' +
        '<div class="modal-scroll guide-body"></div>' +
      '</div>';
    document.body.appendChild(ov);
    ov.addEventListener("click", function(ev){ if(ev.target === ov) closeGuide(); });
    ov.querySelector(".guide-close").addEventListener("click", closeGuide);
    return ov;
  }

  function openGuide(){
    var ov = ensureGuideOverlay();
    guideState.page = "menu";
    renderGuide();
    ov.classList.add("show");
  }
  function closeGuide(){
    var ov = document.getElementById("guideOverlay");
    if(ov) ov.classList.remove("show");
  }

  function guideCard(name, desc, onClick, id){
    var card = document.createElement("button");
    card.type = "button";
    card.className = "tool-card";
    card.dataset.guideCard = id;
    card.innerHTML =
      '<span class="tool-card-text"><span class="tool-card-name">' + escapeHtml(name) + '</span>' +
      '<span class="tool-card-desc">' + escapeHtml(desc) + '</span></span>';
    card.addEventListener("click", onClick);
    return card;
  }

  function renderGuide(){
    var ov = ensureGuideOverlay();
    var touch = guideIsTouch();
    var title = ov.querySelector(".guide-title"), sub = ov.querySelector(".guide-sub");
    var closeBtn = ov.querySelector(".guide-close");
    closeBtn.title = t("guideClose"); closeBtn.setAttribute("aria-label", t("guideClose"));
    var body = ov.querySelector(".guide-body");
    body.innerHTML = "";
    body.scrollTop = 0;
    if(guideState.page === "keys"){
      title.textContent = t(touch ? "guideTouchName" : "guideKeysName"); sub.textContent = "";
      renderGuideKeys(body, touch);
      return;
    }
    title.textContent = t("guideTitle"); sub.textContent = t("guideSub");
    var list = guideEl("div", "tools-list tut-menu");
    list.appendChild(guideCard(t("guideTourName"), t("guideTourDesc"), function(){
      closeGuide();
      if(typeof startTour === "function") startTour("full");
    }, "tour"));
    list.appendChild(guideCard(t(touch ? "guideTouchName" : "guideKeysName"), t(touch ? "guideTouchDesc" : "guideKeysDesc"), function(){
      guideState.page = "keys"; renderGuide();
    }, "keys"));
    body.appendChild(list);
  }

  function guideKeysHtml(keys){
    var mod = guideModKey(typeof navigator !== "undefined" ? navigator.platform : "");
    var out = [], prevKey = false;
    keys.forEach(function(k){
      if(prevKey) out.push('<span class="guide-plus">+</span>');
      out.push('<kbd>' + escapeHtml(k === "Mod" ? mod : k) + '</kbd>');
      prevKey = true;
    });
    return out.join("");
  }

  function renderGuideKeys(body, touch){
    var bar = guideEl("div", "tut-bar");
    var back = guideEl("button", "btn btn-ghost btn-sm tut-back", "‹ " + t("guideBack"));
    back.type = "button";
    back.addEventListener("click", function(){ guideState.page = "menu"; renderGuide(); });
    bar.appendChild(back);
    body.appendChild(bar);
    var loggedIn = !(typeof isGuest === "function" && isGuest());
    guideItems(touch).forEach(function(g){
      var head = guideEl("div", "guide-group-head");
      head.appendChild(guideEl("div", "guide-group-title", t(g.group === "edit" ? "guideGroupEdit" : "guideGroupBrowse")));
      if(g.group === "edit") head.appendChild(guideEl("span", "guide-tag", t(guideNeedsLogin(loggedIn) ? "guideNeedLogin" : "guideNeedEdit")));
      body.appendChild(head);
      var list = guideEl("div", "guide-list");
      g.items.forEach(function(it){
        var row = guideEl("div", "guide-row");
        var k = guideEl("div", "guide-keys");
        if(it.keys) k.innerHTML = guideKeysHtml(it.keys);
        else k.appendChild(guideEl("span", "guide-gesture", t(it.gesture)));
        row.appendChild(k);
        row.appendChild(guideEl("div", "guide-text", t(it.textKey)));
        list.appendChild(row);
      });
      body.appendChild(list);
    });
  }

  // Capture-phase Esc: close only this window, not the drawer behind it (same idea as js/80-tools.js).
  window.addEventListener("keydown", function(ev){
    if(ev.key !== "Escape" || !guideIsOpen()) return;
    ev.stopPropagation();
    closeGuide();
  }, true);
