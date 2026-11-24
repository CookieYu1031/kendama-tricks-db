"use strict";

  /* ============================================================
     BROWSE — touch toolbar (edit mode): floating bar over the topbar for left-swipe selections
     (js/25-browse-swipe-select.js) and the touch clipboard flow:
       cut / copy -> "long-press a blank spot of a column to choose where" -> paste.
     Shown only when a swipe selection exists or a touch clipboard is in progress; Shift+click
     multi-select with a mouse never shows it. The paste target (.paste-target on a column) is
     re-applied after every render() (js/21 rebuilds column classNames), see touchbarSync.
  ============================================================ */
  addStrings({
    zh:{ tbCut:"剪下", tbCopy:"複製", tbPaste:"貼上", tbClose:"關閉",
         tbSelected:"已選 {n} 項", tbCutHint:"已剪下 {n} 項，長按空白處選擇貼上位置", tbCopyHint:"已複製 {n} 項，長按空白處選擇貼上位置",
         tbTargetSet:"已選定貼上位置，點「貼上」" },
    jp:{ tbCut:"切り取り", tbCopy:"コピー", tbPaste:"貼り付け", tbClose:"閉じる",
         tbSelected:"{n} 件を選択中", tbCutHint:"{n} 件を切り取りました。余白を長押しして貼り付け先を選択", tbCopyHint:"{n} 件をコピーしました。余白を長押しして貼り付け先を選択",
         tbTargetSet:"貼り付け先を選択しました。「貼り付け」をタップ" },
    en:{ tbCut:"Cut", tbCopy:"Copy", tbPaste:"Paste", tbClose:"Close",
         tbSelected:"{n} selected", tbCutHint:"Cut {n}. Long-press a blank spot to choose where", tbCopyHint:"Copied {n}. Long-press a blank spot to choose where",
         tbTargetSet:"Place chosen. Tap Paste" }
  });

  var TB_PRESS_MS = 500;
  var TB_PRESS_MOVE = 8;
  var tbClip = false;          // touch clipboard in progress (toolbar stays up with the hint)
  var tbTarget;                // paste target column key (ROOT_KEY or container id), undefined = none
  var tbTargetSpace = null;    // table the target was chosen in
  var tbEl = null, tbShown = false;
  var tbBlockClickUntil = 0;   // swallow the click that follows a blank-spot long-press

  // Pure: what the toolbar shows. ctx: { items:[{type,id}], parentId, admin, hasClip, hasTarget, touchClip, editMode, guest }.
  // Cut / delete need permission on EVERY selected item; copy needs a selection; paste needs a clipboard + a chosen level.
  function touchbarState(ctx){
    var items = ctx.items || [], n = items.length;
    var out = { visible: false, mode: "none", count: n, cut: false, copy: false, del: false, paste: false };
    if(!ctx.editMode || ctx.guest) return out;
    out.visible = n > 0 || !!ctx.touchClip;
    out.mode = n > 0 ? "sel" : (ctx.touchClip ? "clip" : "none");
    if(n > 0){
      var cp = true, ct = true, dl = true;
      items.forEach(function(x){
        var it = clipItemOf(x.type, x.id);
        if(!it || it.ref.virtual || ctx.parentId === FAV_STARRED_ID){ cp = ct = dl = false; return; }
        if(!canDragItem(it, ctx.parentId, ctx.admin) || (it.type === "category" && isFixedFavFolder(it.id))) ct = false;
        if(!batchDeleteAllowed(it, ctx.parentId, ctx.admin)) dl = false;
      });
      out.copy = cp; out.cut = ct; out.del = dl;
    }
    out.paste = !!ctx.hasClip && !!ctx.hasTarget;
    return out;
  }
  // Pure: which hint to show -> { key, n }. cb = clipboardItem.
  function touchbarHint(st, cb, hasTarget){
    if(st.mode === "sel") return { key: "tbSelected", n: st.count };
    var n = cb && cb.items ? cb.items.length : 1;
    if(hasTarget) return { key: "tbTargetSet", n: n };
    return { key: cb && cb.mode === "cut" ? "tbCutHint" : "tbCopyHint", n: n };
  }
  // Pure: did a held press move far enough to cancel the long-press?
  function touchbarPressMoved(dx, dy){
    return Math.abs(dx) > TB_PRESS_MOVE || Math.abs(dy) > TB_PRESS_MOVE;
  }

  function tbContext(){
    var items = [];
    if(swipeSelActive && typeof multiSelItems === "function") items = multiSelItems();
    if(!items.length) swipeSelActive = false;
    return { items: items, parentId: items.length && multiSel ? multiSel.parentId : null, admin: isAdminNow(),
      hasClip: !!clipboardItem, hasTarget: tbTarget !== undefined, touchClip: tbClip,
      editMode: !!state.editMode, guest: isGuest() };
  }

  function tbEnsure(){
    if(tbEl || !document.body) return tbEl;
    tbEl = document.createElement("div");
    tbEl.id = "touchbar"; tbEl.className = "touchbar"; tbEl.setAttribute("role", "toolbar");
    function btn(act, icon, cls){
      return '<button type="button" class="tb-btn ' + (cls || "") + '" data-act="' + act + '">' + icon + '<span class="tb-lbl"></span></button>';
    }
    tbEl.innerHTML = '<div class="tb-text"></div>' + btn("cut", ICON_SCISSORS) + btn("copy", ICON_COPY) + btn("paste", ICON_PASTE) +
      btn("del", ICON_TRASH, "tb-danger") + btn("close", ICON_X, "tb-close");
    tbEl.addEventListener("click", function(ev){
      var b = ev.target.closest ? ev.target.closest(".tb-btn") : null;
      if(b && !b.disabled) touchbarAction(b.dataset.act);
    });
    document.body.appendChild(tbEl);
    void tbEl.offsetWidth; // commit the hidden position so the first show animates
    return tbEl;
  }
  function tbPaint(st){
    var el = tbEnsure();
    if(!el) return;
    var labels = { cut: t("tbCut"), copy: t("tbCopy"), paste: t("tbPaste"), del: t("removeBtn"), close: t("tbClose") };
    Array.prototype.forEach.call(el.querySelectorAll(".tb-btn"), function(b){
      var a = b.dataset.act;
      b.setAttribute("aria-label", labels[a]); b.title = labels[a];
      var lbl = b.querySelector(".tb-lbl"); if(lbl) lbl.textContent = a === "close" ? "" : labels[a];
      b.disabled = a === "close" ? false : !st[a];
    });
    var h = touchbarHint(st, clipboardItem, tbTarget !== undefined);
    el.querySelector(".tb-text").textContent = t(h.key).replace("{n}", h.n);
  }
  function tbSetShown(on){
    tbShown = on;
    if(!tbEl) return;
    tbEl.classList.toggle("show", on);
    tbEl.setAttribute("aria-hidden", on ? "false" : "true");
    if(document.body) document.body.classList.toggle("touchbar-on", on);
  }

  // Keeps everything in step with state: call after any change (render() calls it, see bottom).
  function touchbarSync(){
    var edit = !!(state.editMode && !isGuest());
    if(document.body) document.body.classList.toggle("edit-touch", edit);
    if(!edit){ tbClip = false; tbTarget = undefined; swipeSelActive = false; }
    if(tbClip && !clipboardItem) tbClip = false;
    if(!tbClip) tbTarget = undefined;
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
    swipeSelActive = false; tbClip = false; tbTarget = undefined;
    touchbarSync();
  }
  function tbCopyCut(mode){
    var before = clipboardItem;
    clipCopyOrCut(mode);
    if(clipboardItem === before) return; // refused (toast already shown)
    multiSelClear(); swipeSelActive = false;
    tbClip = true; tbTarget = undefined;
    touchbarSync();
  }
  function tbPaste(){
    if(tbTarget === undefined) return;
    var ok = clipPasteInto(decodeColKey(tbTarget), true);
    if(ok){
      tbTarget = undefined;
      if(!clipboardItem) tbClip = false; // cut / external trick: consumed; a copy stays for more pastes
    }
    touchbarSync();
  }
  function touchbarAction(act){
    if(act === "cut" || act === "copy") tbCopyCut(act);
    else if(act === "paste") tbPaste();
    else if(act === "del"){
      var items = multiSelItems();
      if(items.length) requestDeleteBatch(items, multiSel.parentId, function(){ touchbarSync(); });
    } else if(act === "close") tbReset();
  }

  // Long-press on a blank spot of an open column = choose it as the paste level.
  function tbPickTarget(col){
    tbTarget = col.dataset.colKey; tbTargetSpace = state.activeSpace; tbClip = true;
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
