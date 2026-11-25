"use strict";

  /* ============================================================
     MODAL GUARD (v0.18.4)
     1) Outside click: an overlay gets the click only when BOTH press and release happened on the backdrop.
        (The browser sends the click to the common ancestor, so selecting text and letting go outside the
        window used to close it.) Same rule for the search panel.
     2) Enter = done in the windows that edit a list / table / icon / color, wherever the focus is.
  ============================================================ */
  // Pure: should this click be swallowed? insideOf(el) -> is el inside the search panel?
  function modalGuardBlocks(down, up, clickTarget, isOverlay, insidePanel){
    if(isOverlay) return down !== clickTarget || up !== clickTarget;
    return !!insidePanel && insidePanel(down) !== insidePanel(clickTarget) && insidePanel(down);
  }
  // Pure: which window takes Enter. open = { confirm, color, icon, category, space } (booleans, topmost first).
  // f: { key, repeat, composing, mod, tag, native } (native = a cancel / remove / close button has the focus).
  function modalEnterTarget(f, open){
    if(f.key !== "Enter" || f.composing || f.mod || f.tag === "TEXTAREA" || f.native || open.confirm) return null;
    return open.color ? "color" : open.icon ? "icon" : open.category ? "category" : open.space ? "space" : null;
  }

  (function bindModalGuard(){
    if(typeof window === "undefined" || !window.addEventListener || !document.addEventListener) return;
    var down = null, up = null;
    window.addEventListener("pointerdown", function(ev){ down = ev.target; up = null; }, true);
    window.addEventListener("pointerup", function(ev){ up = ev.target; }, true);
    window.addEventListener("click", function(ev){
      var tg = ev.target;
      if(!down || !tg || !tg.classList || !ev.detail) return; // keyboard / scripted clicks have detail 0
      var panel = document.getElementById("searchPanel");
      var open = panel && panel.classList.contains("show");
      var d = down, u = up;
      down = up = null;
      if(!modalGuardBlocks(d, u, tg, tg.classList.contains("modal-overlay"),
        open ? function(el){ return !!el && panel.contains(el); } : null)) return;
      ev.stopPropagation(); ev.preventDefault();
    }, true);

    function shown(id){ var o = document.getElementById(id); return !!o && o.classList.contains("show"); }
    document.addEventListener("keydown", function(ev){
      if(ev.key !== "Enter") return;
      var tg = ev.target || {};
      var native = !!(tg.closest && tg.closest(".col-add-btn-danger, .icon-btn, a, #catCancelBtn, #spaceCancelBtn"));
      var which = modalEnterTarget({ key: ev.key, composing: ev.isComposing || ev.keyCode === 229,
        mod: ev.ctrlKey || ev.metaKey || ev.altKey || ev.shiftKey, tag: tg.tagName, native: native },
        { confirm: shown("confirmOverlay"), color: shown("customColorOverlay"), icon: shown("iconPickerOverlay"),
          category: shown("categoryModalOverlay"), space: shown("spaceModalOverlay") });
      if(!which) return;
      ev.preventDefault(); ev.stopPropagation();
      if(ev.repeat) return; // holding Enter must not run through stacked windows
      if(which === "color") confirmCustomColor();
      else if(which === "icon") document.getElementById("iconPickerDoneBtn").click();
      else if(which === "category") saveCategoryFromModal();
      else saveSpaceFromModal();
    }, true);
  })();
