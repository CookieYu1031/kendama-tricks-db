"use strict";

  /* ============================================================
     BROWSE — floating toolbar (edit mode, signed in): 「已選(n)｜剪下 複製 貼上 移除｜滴管 油漆｜×」
     Shown for: a left-swipe selection (touch, js/25-browse-swipe-select.js), a Shift+click multi-selection
     (mouse), the touch/mouse clipboard in progress, or a copied style (js/25-browse-style.js, "已選(0)").
     Touch flow: cut / copy -> long-press a blank spot of a column to choose where -> paste.
     Mouse flow (tbMouse): same actions as Ctrl+X / C / V (selection stays, so copy + paste = duplicate in
     place like the keyboard; paste target = last clicked list, see clipPaste). Source = how the selection was made
     (swipe = touch, Shift = mouse), never device detection. The paste target (.paste-target on a column)
     is re-applied after every render() (js/21 rebuilds column classNames), see touchbarSync.
     Hover tooltips (name + shortcut) are in the second half of this file; hover:hover + mouse pointer only.
  ============================================================ */
  addStrings({
    zh:{ tbCut:"剪下", tbCopy:"複製", tbPaste:"貼上", tbClose:"關閉",
         tbDropper:"滴管：複製圖示與顏色", tbPaint:"油漆：套用圖示與顏色",
         tbSelected:"已選({n})", tbCutHint:"已剪下 {n} 項，長按空白處選擇貼上位置", tbCopyHint:"已複製 {n} 項，長按空白處選擇貼上位置",
         tbMouseHint:"點選要貼上的清單，再按貼上或 Ctrl+V" },
    jp:{ tbCut:"切り取り", tbCopy:"コピー", tbPaste:"貼り付け", tbClose:"閉じる",
         tbDropper:"スポイト：アイコンと色をコピー", tbPaint:"ペンキ：アイコンと色を適用",
         tbSelected:"選択({n})", tbCutHint:"{n} 件を切り取りました。余白を長押しして貼り付け先を選択", tbCopyHint:"{n} 件をコピーしました。余白を長押しして貼り付け先を選択",
         tbMouseHint:"貼り付け先のリストをクリックして、貼り付けまたは Ctrl+V" },
    en:{ tbCut:"Cut", tbCopy:"Copy", tbPaste:"Paste", tbClose:"Close",
         tbDropper:"Dropper: copy icon and color", tbPaint:"Paint: apply icon and color",
         tbSelected:"Picked({n})", tbCutHint:"Cut {n}. Long-press a blank spot to choose where", tbCopyHint:"Copied {n}. Long-press a blank spot to choose where",
         tbMouseHint:"Click the list to paste into, then press Paste or Ctrl+V" }
  });

  var TB_PRESS_MS = 500;
  var TB_PRESS_MOVE = 8;
  var tbClip = false;          // clipboard flow in progress (toolbar stays up)
  var tbMouse = false;         // the current selection / clipboard flow came from the mouse (Shift+click)
  var tbTarget;                // touch paste target column key (ROOT_KEY or container id), undefined = none
  var tbTargetSpace = null;    // table the target was chosen in
  var tbEl = null, tbShown = false;
  var tbBlockClickUntil = 0;   // swallow the click that follows a blank-spot long-press

  // Pure: what the toolbar shows. ctx: { items:[{type,id}], parentId, admin, hasClip, hasTarget, touchClip, editMode, guest, styleClip }.
  // Cut / delete need permission on EVERY selected item; copy needs a selection; paste needs a clipboard + a target
  // (touch: a chosen level; mouse: always, like Ctrl+V); dropper / paint ask js/25-browse-style.js.
  function touchbarState(ctx){
    var items = ctx.items || [], n = items.length;
    var out = { visible: false, mode: "none", count: n, cut: false, copy: false, del: false, paste: false, drop: false, paint: false, styled: false };
    if(!ctx.editMode || ctx.guest) return out;
    out.styled = !!ctx.styleClip;
    out.visible = n > 0 || !!ctx.touchClip || out.styled;
    out.mode = n > 0 ? "sel" : (ctx.touchClip ? "clip" : (out.styled ? "style" : "none"));
    if(n > 0){
      var cp = true, ct = true, dl = true;
      items.forEach(function(x){
        var it = clipItemOf(x.type, x.id);
        if(!it || it.ref.virtual || ctx.parentId === FAV_STARRED_ID){ cp = ct = dl = false; return; }
        if(!canDragItem(it, ctx.parentId, ctx.admin) || (it.type === "category" && isFixedFavFolder(it.id))) ct = false;
        if(!batchDeleteAllowed(it, ctx.parentId, ctx.admin)) dl = false;
      });
      if(items.some(function(x){ return x.hasOwnProperty("parentId"); })) cp = ct = dl = false; // cross-column: paint only
      out.copy = cp; out.cut = ct; out.del = dl;
      out.drop = typeof styleCanCopy === "function" && !!styleCanCopy(items, ctx.parentId);
      out.paint = typeof styleCanApply === "function" && !!styleCanApply(items, ctx.parentId, ctx.admin);
    }
    out.paste = !!ctx.hasClip && !!ctx.hasTarget;
    return out;
  }
  // Pure: number shown as 「已選(n)」: the selection, else what is on the clipboard; a style-only bar shows 0.
  function touchbarCount(st, cb){
    if(st.mode === "sel") return st.count;
    if(st.mode === "style") return 0;
    return cb && cb.items ? cb.items.length : 1;
  }
  // Pure: did a held press move far enough to cancel the long-press?
  function touchbarPressMoved(dx, dy){
    return Math.abs(dx) > TB_PRESS_MOVE || Math.abs(dy) > TB_PRESS_MOVE;
  }

  function tbStyleClip(){ return typeof styleClip !== "undefined" ? styleClip : null; }
  function tbContext(){
    var items = [];
    if(typeof multiSelItems === "function") items = multiSelItems();
    if(!items.length) swipeSelActive = false;
    else tbMouse = !swipeSelActive; // swipe = touch; Shift+click = mouse
    return { items: items, parentId: items.length && multiSel ? multiSel.parentId : null, admin: isAdminNow(),
      hasClip: !!clipboardItem, hasTarget: tbMouse || tbTarget !== undefined, touchClip: tbClip,
      editMode: !!state.editMode, guest: isGuest(), styleClip: tbStyleClip() };
  }

  // act, icon, class, group
  var TB_BTNS = [
    ["cut", "ICON_SCISSORS"], ["copy", "ICON_COPY"], ["paste", "ICON_PASTE"], ["del", "ICON_TRASH", "tb-danger"], null,
    ["drop", "ICON_DROPPER"], ["paint", "ICON_BRUSH"], null, ["close", "ICON_X", "tb-close"]
  ];
  function tbIconOf(name){
    return name === "ICON_SCISSORS" ? ICON_SCISSORS : name === "ICON_COPY" ? ICON_COPY : name === "ICON_PASTE" ? ICON_PASTE :
      name === "ICON_TRASH" ? ICON_TRASH : name === "ICON_DROPPER" ? ICON_DROPPER : name === "ICON_BRUSH" ? ICON_BRUSH : ICON_X;
  }
  function tbEnsure(){
    if(tbEl || !document.body) return tbEl;
    tbEl = document.createElement("div");
    tbEl.id = "touchbar"; tbEl.className = "touchbar"; tbEl.setAttribute("role", "toolbar");
    var html = '<div class="tb-text"></div><div class="tb-group">';
    TB_BTNS.forEach(function(b){
      if(!b){ html += '</div><div class="tb-group">'; return; }
      html += '<button type="button" class="tb-btn ' + (b[2] || "") + '" data-act="' + b[0] + '">' + tbIconOf(b[1]) +
        (b[0] === "drop" ? '<i class="tb-dot"></i>' : "") + '</button>';
    });
    tbEl.innerHTML = html + '</div><div class="tb-tip" role="tooltip" aria-hidden="true"></div>';
    // the last group holds only the close button; the tooltip is the toolbar's own child
    tbEl.addEventListener("click", function(ev){
      var b = ev.target.closest ? ev.target.closest(".tb-btn") : null;
      if(b && b.getAttribute("aria-disabled") !== "true") touchbarAction(b.dataset.act);
    });
    tbBindTip(tbEl);
    document.body.appendChild(tbEl);
    void tbEl.offsetWidth; // commit the hidden position so the first show animates
    return tbEl;
  }
  function tbLabels(){
    return { cut: t("tbCut"), copy: t("tbCopy"), paste: t("tbPaste"), del: t("removeBtn"), drop: t("tbDropper"), paint: t("tbPaint"), close: t("tbClose") };
  }
  function tbPaint(st){
    var el = tbEnsure();
    if(!el) return;
    var labels = tbLabels(), sc = tbStyleClip();
    Array.prototype.forEach.call(el.querySelectorAll(".tb-btn"), function(b){
      var a = b.dataset.act;
      b.setAttribute("aria-label", labels[a]); b.removeAttribute("title");
      var off = a === "close" ? false : !st[a];
      b.setAttribute("aria-disabled", off ? "true" : "false");
      b.classList.toggle("tb-off", off);
      if(a === "drop"){
        b.classList.toggle("tb-active", !!sc);
        var dot = b.querySelector(".tb-dot");
        if(dot){ dot.hidden = !(sc && sc.color); if(sc && sc.color) dot.style.background = colorHex(sc.color); }
      }
    });
    el.querySelector(".tb-text").textContent = t("tbSelected").replace("{n}", touchbarCount(st, clipboardItem));
  }
  function tbSetShown(on){
    tbShown = on;
    if(!tbEl) return;
    tbEl.classList.toggle("show", on);
    tbEl.setAttribute("aria-hidden", on ? "false" : "true");
    if(!on) tbTipHide();
    if(document.body) document.body.classList.toggle("touchbar-on", on);
  }

  // Keeps everything in step with state: call after any change (render() calls it, see bottom).
  function touchbarSync(){
    var edit = !!(state.editMode && !isGuest());
    if(document.body) document.body.classList.toggle("edit-touch", edit);
    if(!edit){
      tbClip = false; tbMouse = false; tbTarget = undefined; swipeSelActive = false;
      if(typeof styleClip !== "undefined") styleClip = null; // not styleClear(): that calls back into here
    }
    if(tbClip && !clipboardItem) tbClip = false;
    if(!tbClip){ tbTarget = undefined; tbMouse = false; }
    var wrap = document.getElementById("millerWrap");
    var cols = wrap && wrap.querySelectorAll ? wrap.querySelectorAll(".m-col") : [];
    var found = false;
    if(tbTarget !== undefined && tbTargetSpace === state.activeSpace){
      for(var i = 0; i < cols.length; i++) if(cols[i].dataset && cols[i].dataset.colKey === tbTarget && !cols[i].classList.contains("collapsed")) found = true;
    }
    if(!found) tbTarget = undefined;
    for(var j = 0; j < cols.length; j++){
      cols[j].classList.toggle("paste-target", tbTarget !== undefined && !!cols[j].dataset && cols[j].dataset.colKey === tbTarget);
    }
    var st = touchbarState(tbContext());
    if(st.visible) tbPaint(st);
    if(st.visible !== tbShown) tbSetShown(st.visible);
  }

  function tbReset(){
    if(typeof multiSelClear === "function") multiSelClear();
    swipeSelActive = false; tbClip = false; tbMouse = false; tbTarget = undefined;
    if(typeof styleClear === "function") styleClear();
    touchbarSync();
  }
  function tbCopyCut(mode){
    var before = clipboardItem;
    clipCopyOrCut(mode);
    if(clipboardItem === before) return; // refused (toast already shown)
    if(tbMouse){ // mouse: like Ctrl+C / X; the selection stays so an immediate paste still duplicates in place
      tbClip = true;
      showToast(t("tbMouseHint"));
      touchbarSync();
      return;
    }
    multiSelClear(); swipeSelActive = false;
    tbClip = true; tbTarget = undefined;
    showToast(t(mode === "cut" ? "tbCutHint" : "tbCopyHint").replace("{n}", clipboardItem.items.length)); // what to do next
    touchbarSync();
  }
  function tbPaste(){
    if(tbMouse) clipPaste(); // same rules as Ctrl+V (last clicked list, duplicate in place)
    else if(tbTarget !== undefined){
      var ok = clipPasteInto(decodeColKey(tbTarget), true);
      if(ok) tbTarget = undefined;
    } else return;
    if(!clipboardItem) tbClip = false; // cut / external trick: consumed; a copy stays for more pastes
    touchbarSync();
  }
  function touchbarAction(act){
    if(act === "cut" || act === "copy") tbCopyCut(act);
    else if(act === "paste") tbPaste();
    else if(act === "del"){
      var items = multiSelItems();
      if(items.length) requestDeleteBatch(items, multiSel.parentId, function(){ touchbarSync(); });
    } else if(act === "drop"){ if(typeof styleCopy === "function") styleCopy(); touchbarSync(); }
    else if(act === "paint"){ if(typeof styleApply === "function") styleApply(); touchbarSync(); }
    else if(act === "close") tbReset();
  }

  // Long-press on a blank spot of an open column = choose it as the paste level.
  function tbPickTarget(col){
    tbTarget = col.dataset.colKey; tbTargetSpace = state.activeSpace; tbClip = true; tbMouse = false;
    tbBlockClickUntil = Date.now() + 700;
    try { if(navigator.vibrate) navigator.vibrate(10); } catch(e){}
    touchbarSync();
  }
  function bindTouchbarPress(wrap){
    var timer = null, sx = 0, sy = 0, pid = null, col = null;
    function cancel(){ clearTimeout(timer); timer = null; }
    wrap.addEventListener("pointerdown", function(ev){
      cancel();
      if(ev.pointerType === "mouse" || ev.isPrimary === false) return;
      if(!state.editMode || isGuest() || browseModalOpen() || !clipboardItem) return;
      if(wrap.classList.contains("flat-view") || wrap.classList.contains("search-results")) return;
      var tg = ev.target;
      if(!tg || !tg.closest) return;
      var c = tg.closest(".m-col");
      if(!c || c.classList.contains("collapsed") || !c.dataset || c.dataset.colKey === undefined) return;
      if(tg.closest(".item, button, a, input, select, textarea, [role=button]")) return;
      col = c; sx = ev.clientX; sy = ev.clientY; pid = ev.pointerId;
      timer = setTimeout(function(){ timer = null; if(col && col.parentNode) tbPickTarget(col); }, TB_PRESS_MS);
    });
    wrap.addEventListener("pointermove", function(ev){
      if(timer && ev.pointerId === pid && touchbarPressMoved(ev.clientX - sx, ev.clientY - sy)) cancel();
    });
    wrap.addEventListener("pointerup", cancel);
    wrap.addEventListener("pointercancel", cancel);
    wrap.addEventListener("pointerleave", cancel);
    wrap.addEventListener("scroll", cancel, true);
    wrap.addEventListener("contextmenu", function(ev){
      if(Date.now() < tbBlockClickUntil || timer) ev.preventDefault();
    });
  }

  /* ---------------- hover / focus tooltip (name + shortcut), mouse only ---------------- */
  // Pure: shortcut label for a button. plat = navigator.platform. Mac shows ⌘ for the plain C/X/V keys.
  function touchbarKeyLabel(act, plat){
    var mod = typeof guideModKey === "function" ? guideModKey(plat) : "Ctrl";
    var base = { cut: "X", copy: "C", paste: "V" };
    if(base[act]) return mod === "Ctrl" ? "Ctrl+" + base[act] : mod + base[act];
    return { del: "Delete", drop: "Ctrl+Alt+C", paint: "Ctrl+Alt+V", close: "Esc" }[act] || "";
  }
  function tbHoverOk(){
    return !!(window.matchMedia && window.matchMedia("(hover:hover)").matches);
  }
  function tbTipHide(){
    if(!tbEl) return;
    var tip = tbEl.querySelector(".tb-tip");
    if(tip){ tip.classList.remove("on"); tip.setAttribute("aria-hidden", "true"); }
  }
  function tbTipShow(b){
    if(!tbEl || !tbHoverOk()) return;
    var tip = tbEl.querySelector(".tb-tip");
    if(!tip) return;
    var act = b.dataset.act, key = touchbarKeyLabel(act, navigator.platform);
    tip.innerHTML = '<span>' + escapeHtml(tbLabels()[act]) + '</span>' + (key ? '<kbd>' + escapeHtml(key) + '</kbd>' : "");
    tip.style.left = "0px";
    tip.classList.add("on"); tip.setAttribute("aria-hidden", "false");
    // centered under the button, kept inside the window (toolbar coordinates are css px; k = screen px per css px incl. ui zoom)
    var r = tbEl.getBoundingClientRect(), k = tbEl.offsetWidth ? r.width / tbEl.offsetWidth : 1, tw = tip.offsetWidth;
    var x = b.offsetLeft + (b.offsetParent && b.offsetParent !== tbEl ? b.offsetParent.offsetLeft : 0) + b.offsetWidth / 2 - tw / 2;
    var minX = (4 - r.left) / k, maxX = (window.innerWidth - 4 - r.left) / k - tw;
    tip.style.left = Math.round(Math.max(minX, Math.min(maxX, x))) + "px";
  }
  function tbBindTip(el){
    el.addEventListener("pointerover", function(ev){
      var b = ev.target.closest ? ev.target.closest(".tb-btn") : null;
      if(b && ev.pointerType === "mouse") tbTipShow(b);
    });
    el.addEventListener("pointerout", function(ev){
      if(ev.pointerType === "mouse") tbTipHide();
    });
    el.addEventListener("focusin", function(ev){
      var b = ev.target.closest ? ev.target.closest(".tb-btn") : null, vis = false;
      try { vis = !!(b && b.matches(":focus-visible")); } catch(e){}
      if(vis) tbTipShow(b);
    });
    el.addEventListener("focusout", tbTipHide);
  }

  (function initTouchbar(){
    var wrap = document.getElementById("millerWrap");
    if(wrap && wrap.addEventListener) bindTouchbarPress(wrap);
    document.addEventListener("click", function(ev){
      // only clicks on the columns: a quick tap on the toolbar must get through
      if(Date.now() < tbBlockClickUntil && wrap && wrap.contains(ev.target)){ tbBlockClickUntil = 0; ev.stopPropagation(); ev.preventDefault(); return; }
      setTimeout(touchbarSync, 0); // a plain click may have cleared multiSel without a render
    }, true);
    document.addEventListener("keydown", function(ev){
      if(ev.key === "Escape" && tbShown && !browseModalOpen()) tbReset();
    });
    // js/21 rebuilds the column classNames on every render: re-apply the paste target / toolbar after it.
    if(typeof render === "function"){
      var tbRenderOrig = render;
      render = function(){
        var r = tbRenderOrig.apply(this, arguments);
        touchbarSync();
        return r;
      };
    }
  })();
