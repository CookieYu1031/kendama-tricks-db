"use strict";

  /* ============================================================
     BROWSE — edit mode: a click on a row's icon opens the icon & color picker for that item directly
     (tree columns only; a folded column's icons keep navigating). Same permission as painting (styleAllowed).
  ============================================================ */
  // Pure: writes the picked icon / color; true when something really changed.
  function iconEditWrite(ref, type, icon, color){
    var col = type === "trick" ? (color || "") : (color || "default");
    if((ref.icon || "") === icon && (ref.color || (type === "trick" ? "" : "default")) === col) return false;
    ref.icon = icon; ref.color = col;
    return true;
  }
  function openRowIconPicker(type, id){
    var it = clipItemOf(type, id);
    if(!it) return;
    openIconPicker("drawer", { icon: it.ref.icon || "", color: it.ref.color || "", onDone: function(icon, color){
      var cur = clipItemOf(type, id); // undo / sync may have swapped the record meanwhile
      if(!cur) return;
      if(!iconEditWrite({ icon: cur.ref.icon, color: cur.ref.color }, type, icon, color)) return;
      if(typeof undoPush === "function") undoPush();
      iconEditWrite(cur.ref, type, icon, color);
      saveDB();
      render();
    } });
  }
  // Called by renderItemRow (js/21) in edit mode.
  function attachRowIconEdit(row, icon, it, parentId, admin){
    if(!styleAllowed(it, parentId, admin)) return;
    icon.classList.add("icon-edit");
    icon.title = t("editIconColor");
    icon.addEventListener("click", function(ev){
      if(ev.shiftKey || (row.closest && row.closest(".m-col.collapsed"))) return;
      ev.stopPropagation();
      openRowIconPicker(it.type, it.id);
    });
  }
