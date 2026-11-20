"use strict";

  /* ============================================================
     BROWSE — clipboard: Ctrl/Cmd+C copy, Ctrl/Cmd+X cut, Ctrl/Cmd+V paste (edit mode)
     Semantics: trick copy = reference (same id, extra placement); folder copy = deep copy
     with new ids (tricks inside become references); info copy = new info. Cut = move.
     Pure planning / copying lives at the top; DOM + render glue at the bottom.
  ============================================================ */
  addStrings({
    zh:{ clipCopied:"已複製：", clipCut:"已剪下：", clipPasted:"已貼上", clipMoved:"已移動",
         clipEmpty:"剪貼簿是空的", clipNoSelection:"請先點選一個項目", clipAlready:"此位置已有這個招式",
         clipNoPerm:"沒有權限貼到這裡", clipNoFit:"不能貼到這裡（超過層數上限，或貼進自己／子層）",
         clipGone:"原項目已不存在", clipCannotCopy:"此項目無法複製", clipSame:"已經在這個位置",
         editThisFolder:"編輯此資料夾" },
    jp:{ clipCopied:"コピーしました：", clipCut:"切り取りました：", clipPasted:"貼り付けました", clipMoved:"移動しました",
         clipEmpty:"クリップボードは空です", clipNoSelection:"先に項目をクリックしてください", clipAlready:"この場所には既にこの技があります",
         clipNoPerm:"ここに貼り付ける権限がありません", clipNoFit:"ここには貼り付けられません（階層の上限、または自分／下位への貼り付け）",
         clipGone:"元の項目が存在しません", clipCannotCopy:"この項目はコピーできません", clipSame:"既にこの場所にあります",
         editThisFolder:"このフォルダを編集" },
    en:{ clipCopied:"Copied: ", clipCut:"Cut: ", clipPasted:"Pasted", clipMoved:"Moved",
         clipEmpty:"Clipboard is empty", clipNoSelection:"Click an item first", clipAlready:"This trick is already here",
         clipNoPerm:"No permission to paste here", clipNoFit:"Can't paste here (level limit, or into itself / its sub-folders)",
         clipGone:"The original item no longer exists", clipCannotCopy:"This item can't be copied", clipSame:"Already in this place",
         editThisFolder:"Edit this folder" }
  });

  // { mode:"copy"|"cut", type:"category"|"trick"|"info", id, srcParent (null = table root), srcSpace } | null
  var clipboardItem = null;
  var CLIP_NO_SOURCE = "\u0000none"; // never equals a real parent id (forces canReparent's full checks)

  function clipItemOf(type, id){
    var ref = type === "category" ? getCategory(id) : type === "trick" ? getTrick(id) : type === "info" ? getInfo(id) : null;
    if(!ref) return null;
    var name = type === "info" ? ref.title : ref.name;
    return { type: type, id: id, name: name, ref: ref };
  }
  function clipKey(parentId, spaceId){ return parentId == null ? spaceId : parentId; }

  // Pure: does this key event mean copy/cut/paste? ctx: { inField, modalOpen, editMode, guest, hasTextSelection }
  function clipKeyAction(ev, ctx){
    if(!ctx.editMode || ctx.guest || ctx.inField || ctx.modalOpen) return null;
    if(!(ev.ctrlKey || ev.metaKey) || ev.altKey || ev.shiftKey) return null;
    var k = String(ev.key || "").toLowerCase();
    if(k === "c") return ctx.hasTextSelection ? null : "copy";
    if(k === "x") return ctx.hasTextSelection ? null : "cut";
    if(k === "v") return "paste";
    return null;
  }

  // Validate + classify a paste. clip = clipboardItem shape, targetParentId null = root of env.activeSpace.
  // env: { admin, activeSpace }. Returns { ok:true, op:"ref"|"copyFolder"|"copyInfo"|"move" }
  // or { ok:false, err:<i18n key> }. Reuses canReparent (22) for levels / descendants / virtual targets.
  function clipPlanPaste(clip, targetParentId, env){
    var it = clip ? clipItemOf(clip.type, clip.id) : null;
    if(!it) return { ok:false, err:"clipGone" };
    if(isGuest()) return { ok:false, err:"clipNoPerm" };
    var tSpace = env.activeSpace;
    var sp = getSpace(tSpace);
    if(!sp) return { ok:false, err:"clipNoPerm" };
    if(targetParentId == null && tSpace === FAV_TABLE_ID) return { ok:false, err:"clipNoFit" };
    // locked table: non-admin may only drop their own custom tricks
    if(sp.locked && !env.admin && !(it.type === "trick" && it.ref.custom)) return { ok:false, err:"clipNoPerm" };
    var allow = allowedAddButtons(targetParentId, tSpace, env.admin);
    var addType = it.type === "category" ? "folder" : it.type;
    if(!allow[addType]) return { ok:false, err:(canAddChild(targetParentId, addType) ? "clipNoPerm" : "clipNoFit") };
    if(!canReparent(it, CLIP_NO_SOURCE, targetParentId)) return { ok:false, err:"clipNoFit" };

    var targetKey = clipKey(targetParentId, tSpace);
    if(clip.mode === "cut"){
      if(!canModifyItem(it, clip.srcParent, env.admin) ||
         !(canEditTable(clip.srcSpace) || env.admin)) return { ok:false, err:"clipNoPerm" };
      if(clipKey(clip.srcParent, clip.srcSpace) === targetKey) return { ok:false, err:"clipSame" };
      return { ok:true, op:"move" };
    }
    if(it.type === "trick"){
      if(it.ref.categoryIds.indexOf(targetKey) !== -1) return { ok:false, err:"clipAlready" };
      return { ok:true, op:"ref" };
    }
    return { ok:true, op: it.type === "category" ? "copyFolder" : "copyInfo" };
  }

  // Pure (reads db, does not write): deep copy of a folder with fresh ids from idGen().
  // Returns { rootId, cats:[], infos:[], refs:[{ trickId, containerId }] }.
  function clipDeepCopyFolder(catId, targetParentId, spaceId, idGen){
    var out = { rootId: null, cats: [], infos: [], refs: [] };
    function walk(srcId, newParent){
      var src = getCategory(srcId);
      var nid = idGen();
      out.cats.push({ id: nid, parentId: newParent, name: { zh: src.name.zh || "", jp: src.name.jp || "", en: src.name.en || "" },
        order: typeof src.order === "number" ? src.order : 0, icon: src.icon || "", color: src.color || "default", spaceId: spaceId });
      getInfosIn(srcId).forEach(function(n){
        out.infos.push({ id: idGen(), parentId: nid, spaceId: spaceId, title: { zh: n.title.zh || "", jp: n.title.jp || "", en: n.title.en || "" },
          content: n.content || "", order: typeof n.order === "number" ? n.order : 0, icon: n.icon || "", color: n.color || "default" });
      });
      getTricksInCategory(srcId).forEach(function(tr){
        out.refs.push({ trickId: tr.id, containerId: nid, order: tr.orderByCategory && typeof tr.orderByCategory[srcId] === "number" ? tr.orderByCategory[srcId] : null });
      });
      getChildren(srcId).forEach(function(c){ walk(c.id, nid); });
      return nid;
    }
    out.rootId = walk(catId, targetParentId);
    return out;
  }

  // Moves every category / info below catId (inclusive) into table spaceId (cut across tables).
  function clipRetagSpace(catId, spaceId){
    getDescendantCategoryIds(catId).forEach(function(cid){
      var c = getCategory(cid); if(c) c.spaceId = spaceId;
      getInfosIn(cid).forEach(function(n){ n.spaceId = spaceId; });
    });
  }

  function clipApplyPaste(clip, targetParentId, plan, env){
    var it = clipItemOf(clip.type, clip.id);
    var tSpace = env.activeSpace;
    var targetKey = clipKey(targetParentId, tSpace);
    var newId = it.id, newType = it.type;
    if(plan.op === "ref"){
      it.ref.categoryIds.push(targetKey);
    } else if(plan.op === "copyFolder"){
      var cp = clipDeepCopyFolder(it.id, targetParentId, tSpace, newItemId);
      cp.cats.forEach(function(c){ db.categories.push(c); });
      if(!db.infos) db.infos = [];
      cp.infos.forEach(function(n){ db.infos.push(n); });
      cp.refs.forEach(function(r){
        var tr = getTrick(r.trickId);
        if(!tr) return;
        if(tr.categoryIds.indexOf(r.containerId) === -1) tr.categoryIds.push(r.containerId);
        if(r.order !== null){ tr.orderByCategory = tr.orderByCategory || {}; tr.orderByCategory[r.containerId] = r.order; }
      });
      newId = cp.rootId;
    } else if(plan.op === "copyInfo"){
      if(!db.infos) db.infos = [];
      newId = newItemId();
      db.infos.push({ id: newId, parentId: targetParentId, spaceId: tSpace, title: { zh: it.ref.title.zh || "", jp: it.ref.title.jp || "", en: it.ref.title.en || "" },
        content: it.ref.content || "", order: 0, icon: it.ref.icon || "", color: it.ref.color || "default" });
    } else { // move
      if(it.type === "trick"){
        var srcKey = clipKey(clip.srcParent, clip.srcSpace);
        var idx = it.ref.categoryIds.indexOf(srcKey);
        if(idx !== -1) it.ref.categoryIds.splice(idx, 1);
        if(it.ref.orderByCategory) delete it.ref.orderByCategory[srcKey];
        if(it.ref.categoryIds.indexOf(targetKey) === -1) it.ref.categoryIds.push(targetKey);
      } else if(it.type === "category"){
        it.ref.parentId = targetParentId;
        clipRetagSpace(it.id, tSpace);
      } else {
        it.ref.parentId = targetParentId;
        it.ref.spaceId = tSpace;
      }
    }
    invalidateDbIndex();
    // new / moved item goes to the end of the target column; persistColumnOrder saves (marks dirty)
    var arr = buildColumnItems(targetParentId);
    var at = arr.findIndex(function(x){ return x.id === newId && x.type === newType; });
    if(at !== -1) arr.push(arr.splice(at, 1)[0]);
    persistColumnOrder(arr, targetParentId);
    return newId;
  }

  /* ---------------- selection + paste target (DOM glue) ---------------- */
  var clipLastClick = null; // { type, id, parentId } of the last clicked row; type null = blank column area

  function clipRowInfo(row){
    var col = row.closest ? row.closest(".m-col") : null;
    var key = col && col.dataset ? col.dataset.colKey : null;
    return { type: row.dataset.itemType, id: row.dataset.itemId, parentId: (key == null || key === "__root__") ? null : key };
  }
  // Selected item = row highlighted with the arrow keys, else the last clicked row.
  function clipSelection(){
    var wrap = document.getElementById("millerWrap");
    if(wrap){
      var rows = wrap.querySelectorAll(".item");
      for(var i = 0; i < rows.length; i++) if(rows[i]._kbd) return clipRowInfo(rows[i]);
    }
    return clipLastClick;
  }
  // Paste target: selected folder row -> that folder; else the container of the selection's column;
  // nothing selected -> the deepest open column.
  function clipTargetParent(sel){
    if(!sel) return typeof kbdDeepestParentId === "function" ? kbdDeepestParentId() : null;
    if(sel.type === "category") return sel.id;
    return sel.parentId;
  }

  function clipName(it){ return typeof localize === "function" ? localize(it.name) : ""; }
  function clipToast(key, extra){ if(typeof showToast === "function") showToast(t(key) + (extra || "")); }

  function clipCopyOrCut(mode){
    var sel = clipSelection();
    if(!sel || !sel.type) return clipToast("clipNoSelection");
    var it = clipItemOf(sel.type, sel.id);
    if(!it) return clipToast("clipNoSelection");
    var admin = isAdminNow();
    if(it.ref.virtual || sel.parentId === FAV_STARRED_ID) return clipToast("clipCannotCopy");
    if(mode === "cut" && !(canDragItem(it, sel.parentId, admin))) return clipToast("clipNoPerm");
    clipboardItem = { mode: mode, type: sel.type, id: sel.id, srcParent: sel.parentId, srcSpace: state.activeSpace };
    clipToast(mode === "cut" ? "clipCut" : "clipCopied", clipName(it));
  }

  function clipPaste(){
    if(!clipboardItem) return clipToast("clipEmpty");
    var target = clipTargetParent(clipSelection());
    var env = { admin: isAdminNow(), activeSpace: state.activeSpace };
    var plan = clipPlanPaste(clipboardItem, target, env);
    if(!plan.ok) return clipToast(plan.err);
    clipApplyPaste(clipboardItem, target, plan, env);
    if(plan.op === "move") clipboardItem = null;
    clipToast(plan.op === "move" ? "clipMoved" : "clipPasted");
    render();
  }

  function clipRun(action){
    if(action === "paste") clipPaste(); else clipCopyOrCut(action);
  }

  (function bindClipTracking(){
    var wrap = document.getElementById("millerWrap");
    if(!wrap || !wrap.addEventListener) return;
    // capture: runs before the row's own handler re-renders the column
    wrap.addEventListener("click", function(ev){
      var tg = ev.target;
      var row = tg && tg.closest ? tg.closest(".item") : null;
      var rows = wrap.querySelectorAll(".item");
      for(var i = 0; i < rows.length; i++) if(rows[i]._kbd && typeof kbdClear === "function") kbdClear([rows[i]]);
      if(row && row.dataset.itemType) { clipLastClick = clipRowInfo(row); return; }
      var col = tg && tg.closest ? tg.closest(".m-col") : null;
      if(col && col.dataset && col.dataset.colKey !== undefined){
        clipLastClick = { type: null, id: null, parentId: col.dataset.colKey === "__root__" ? null : col.dataset.colKey };
      }
    }, true);
  })();
