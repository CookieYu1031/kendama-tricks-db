"use strict";

  /* ============================================================
     BROWSE — 滴管／油漆 (v0.18.1): copy the icon + color of one item, paint it onto others
     (edit mode; Ctrl+Alt+C / Ctrl+Alt+V, or the touch / desktop toolbar in js/25-browse-touchbar.js).
     Independent of the item clipboard (clipboardItem). Image icons are never copied: only the color
     (styleClip.icon = null -> the target icon stays). Items of any type can paint each other.
     styleClip = { icon: string|null, color: raw color of the source, type } | null.
     Default colors: a trick stores "" (tint TRICK_DEFAULT_HEX), lists / info store "default".
     Same type -> exact copy; across types a default color becomes the target type's default.
  ============================================================ */
  addStrings({
    zh:{ styleCopied:"已複製圖示與顏色", styleCopiedImg:"圖片不會複製，只複製顏色",
         styleNone:"先用滴管選一個項目", styleNeedOne:"滴管一次只能複製一個項目", styleAppliedN:"已套用 {n} 項" },
    jp:{ styleCopied:"アイコンと色をコピーしました", styleCopiedImg:"画像はコピーされず、色だけコピーします",
         styleNone:"先にスポイトで項目を選んでください", styleNeedOne:"スポイトで一度にコピーできるのは1件です", styleAppliedN:"{n} 件に適用しました" },
    en:{ styleCopied:"Copied icon and color", styleCopiedImg:"Images aren't copied, only the color",
         styleNone:"Pick an item with the eyedropper first", styleNeedOne:"The eyedropper copies one item at a time", styleAppliedN:"Applied to {n}" }
  });

  var styleClip = null;

  function styleToast(msg, kind){ if(typeof showToast === "function") showToast(msg, kind); }
  function styleSync(){ if(typeof touchbarSync === "function") touchbarSync(); }

  // Current selection (same meaning as Ctrl+C): multi-select, else the last clicked item.
  function styleItems(){
    var multi = typeof multiSelItems === "function" ? multiSelItems() : [];
    if(multi.length) return { items: multi.map(function(x){ return { type: x.type, id: x.id }; }), parentId: multiSel.parentId };
    var sel = typeof clipSelection === "function" ? clipSelection() : null;
    if(sel && sel.type) return { items: [{ type: sel.type, id: sel.id }], parentId: sel.parentId };
    return { items: [], parentId: null };
  }

  // Pure: exactly one existing, non-virtual item. No edit permission needed to copy.
  function styleCanCopy(items, parentId){
    if(!items || items.length !== 1) return false;
    var it = clipItemOf(items[0].type, items[0].id);
    return !!(it && !it.ref.virtual && parentId !== FAV_STARRED_ID);
  }
  // Pure: may this one item be painted? Same rule as editing its icon / color.
  function styleAllowed(it, parentId, admin){
    if(!it || !it.ref || it.ref.virtual) return false;
    if(it.type === "category" && isFixedFavFolder(it.id)) return false;
    return !!canModifyItem(it, parentId, admin);
  }
  // Pure: a style is held and at least one selected item may be painted.
  function styleCanApply(items, parentId, admin){
    if(!styleClip || !items || !items.length) return false;
    for(var i = 0; i < items.length; i++){
      var it = clipItemOf(items[i].type, items[i].id);
      if(it && styleAllowed(it, parentId, admin)) return true;
    }
    return false;
  }

  // Pure: the { icon, color } to write into a target of type toType (icon null = leave as is).
  function styleResolve(clip, toType){
    var raw = typeof clip.color === "string" ? clip.color : "";
    var color = raw;
    if(clip.type !== toType){
      var isDef = raw === "" || raw === "default";
      color = isDef ? (toType === "trick" ? "" : "default") : raw;
    } else if(toType !== "trick" && raw === "") color = "default";
    if(toType !== "trick") color = sanitizeColorKey(color, "default");
    else color = color === "" ? "" : sanitizeColorKey(color, "");
    return { icon: clip.icon, color: color };
  }
  // Writes the style into one record; true when something really changed.
  function styleWrite(ref, res){
    var changed = false;
    if(res.icon !== null && (ref.icon || "") !== res.icon){ ref.icon = res.icon; changed = true; }
    if((ref.color || "") !== res.color){ ref.color = res.color; changed = true; }
    return changed;
  }

  function styleCopy(){
    var s = styleItems();
    if(!styleCanCopy(s.items, s.parentId)){
      styleToast(t(s.items.length > 1 ? "styleNeedOne" : "clipNoSelection"), "error");
      return false;
    }
    var it = clipItemOf(s.items[0].type, s.items[0].id);
    var img = isImageIcon(it.ref.icon);
    styleClip = { icon: img ? null : (it.ref.icon || ""), color: it.ref.color || "", type: it.type };
    if(typeof multiSelClear === "function") multiSelClear();
    styleSync();
    styleToast(t(img ? "styleCopiedImg" : "styleCopied"));
    return true;
  }

  function styleApply(){
    if(!styleClip){ styleToast(t("styleNone"), "error"); return false; }
    var s = styleItems();
    if(!s.items.length){ styleToast(t("clipNoSelection"), "error"); return false; }
    var admin = isAdminNow(), ok = [], skipped = 0;
    s.items.forEach(function(x){
      var it = clipItemOf(x.type, x.id);
      if(it && styleAllowed(it, s.parentId, admin)) ok.push(it); else skipped++;
    });
    if(!ok.length){ styleToast(t("clipNoPerm"), "error"); return false; }
    // Nothing would change: no undo step, no save (no pending dots).
    var changed = ok.some(function(it){ return styleWrite({ icon: it.ref.icon, color: it.ref.color }, styleResolve(styleClip, it.type)); });
    if(changed && typeof undoPush === "function") undoPush();
    if(changed) ok.forEach(function(it){ styleWrite(it.ref, styleResolve(styleClip, it.type)); });
    if(changed) saveDB();
    if(typeof multiSelClear === "function") multiSelClear();
    styleSync();
    render();
    var msg = t("styleAppliedN").replace("{n}", ok.length);
    if(skipped) msg += t("clipSkippedN").replace("{m}", skipped);
    styleToast(msg);
    return true;
  }

  function styleClear(){
    styleClip = null;
    styleSync();
  }

  // Pure: Ctrl+Alt+C / Ctrl+Alt+V on every platform (ev.code: Option+C types "ç" on a Mac).
  // ctx: { inField, modalOpen, editMode, guest }
  function styleKeyAction(ev, ctx){
    if(!ctx.editMode || ctx.guest || ctx.inField || ctx.modalOpen) return null;
    if(!ev.ctrlKey || !ev.altKey || ev.metaKey || ev.shiftKey) return null;
    if(ev.code === "KeyC") return "copy";
    if(ev.code === "KeyV") return "apply";
    return null;
  }
