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
         rowEdit:"編輯",
         clipCopiedN:"已複製 {n} 個項目", clipCutN:"已剪下 {n} 個項目", clipPastedN:"已貼上 {n} 個", clipSkippedN:"，略過 {m} 個",
         favNoCreate:"收藏區不能直接新增內容。要建立自己的招式清單，請先新增自訂義區域" },
    jp:{ clipCopied:"コピーしました：", clipCut:"切り取りました：", clipPasted:"貼り付けました", clipMoved:"移動しました",
         clipEmpty:"クリップボードは空です", clipNoSelection:"先に項目をクリックしてください", clipAlready:"この場所には既にこの技があります",
         clipNoPerm:"ここに貼り付ける権限がありません", clipNoFit:"ここには貼り付けられません（階層の上限、または自分／下位への貼り付け）",
         clipGone:"元の項目が存在しません", clipCannotCopy:"この項目はコピーできません", clipSame:"既にこの場所にあります",
         rowEdit:"編集",
         clipCopiedN:"{n} 件をコピーしました", clipCutN:"{n} 件を切り取りました", clipPastedN:"{n} 件を貼り付けました", clipSkippedN:"（{m} 件はスキップ）",
         favNoCreate:"お気に入りには直接追加できません。自分の技のリストを作るには、先にカスタム区画を追加してください" },
    en:{ clipCopied:"Copied: ", clipCut:"Cut: ", clipPasted:"Pasted", clipMoved:"Moved",
         clipEmpty:"Clipboard is empty", clipNoSelection:"Click an item first", clipAlready:"This trick is already here",
         clipNoPerm:"No permission to paste here", clipNoFit:"Can't paste here (level limit, or into itself / its sub-lists)",
         clipGone:"The original item no longer exists", clipCannotCopy:"This item can't be copied", clipSame:"Already in this place",
         rowEdit:"Edit",
         clipCopiedN:"Copied {n} items", clipCutN:"Cut {n} items", clipPastedN:"Pasted {n}", clipSkippedN:", skipped {m}",
         favNoCreate:"You can't add content directly in Favorites. To make your own trick lists, add a custom area first" }
  });

  // { mode:"copy"|"cut", type:"category"|"trick"|"info", id, srcParent (null = table root), srcSpace } | null
  // External new trick (admin mailbox 複製招式): { mode:"copy", type:"extTrick", ext:{ name, urls, grip, parts, tagIds, note } }.
  var clipboardItem = null;
  var CLIP_NO_SOURCE = "\u0000none"; // never equals a real parent id (forces canReparent's full checks)

  function clipItemOf(type, id){
    var ref = type === "category" ? getCategory(id) : type === "trick" ? getTrick(id) : type === "info" ? getInfo(id) : null;
    if(!ref) return null;
    var name = type === "info" ? ref.title : ref.name;
    return { type: type, id: id, name: name, ref: ref };
  }
  function clipKey(parentId, spaceId){ return parentId == null ? spaceId : parentId; }
  // Prefix of a trick placement moves / copies with it (js/05-data-prefix.js).
  function clipPfxGet(tr, key){ return typeof getTrickPrefix === "function" ? getTrickPrefix(tr, key) : ""; }
  function clipPfxSet(tr, key, val){ if(typeof setTrickPrefix === "function") setTrickPrefix(tr, key, val); }

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
    if(clip && clip.type === "extTrick") return clipPlanExtTrick(clip, targetParentId, env);
    var it = clip ? clipItemOf(clip.type, clip.id) : null;
    if(!it) return { ok:false, err:"clipGone" };
    if(isGuest()) return { ok:false, err:"clipNoPerm" };
    var tSpace = env.activeSpace;
    var sp = getSpace(tSpace);
    if(!sp) return { ok:false, err:"clipNoPerm" };
    if(!canCreateIn(targetParentId, tSpace)) return { ok:false, err:"favNoCreate" }; // v0.9.1 收藏 table is not a paste target
    if(it.type === "category" && isFixedFavFolder(it.id) && clip.mode === "cut") return { ok:false, err:"clipNoPerm" };
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

  // A trick that exists only in the clipboard (from a submission): pasted as a brand-new trick.
  function clipPlanExtTrick(clip, targetParentId, env){
    if(!clip.ext) return { ok:false, err:"clipGone" };
    if(isGuest()) return { ok:false, err:"clipNoPerm" };
    var tSpace = env.activeSpace;
    var sp = getSpace(tSpace);
    if(!sp) return { ok:false, err:"clipNoPerm" };
    if(!canCreateIn(targetParentId, tSpace)) return { ok:false, err:"favNoCreate" };
    var allow = allowedAddButtons(targetParentId, tSpace, env.admin);
    if(!allow.trick) return { ok:false, err:(canAddChild(targetParentId, "trick") ? "clipNoPerm" : "clipNoFit") };
    return { ok:true, op:"newTrick" };
  }
  // Puts a new trick (data from submissionItemToTrickData, js/72) on the app clipboard so it can be
  // pasted with Ctrl+V in edit mode. Returns the clipboard item.
  function clipSetExternalTrick(data){
    var ext = {
      name: { zh: (data.name && data.name.zh) || "", jp: (data.name && data.name.jp) || "", en: (data.name && data.name.en) || "" },
      urls: (data.urls || []).slice(0, MAX_VIDEOS), grip: data.grip || null, parts: (data.parts || []).slice(),
      tagIds: (data.tagIds || []).slice(), note: data.note || ""
    };
    clipboardItem = { mode: "copy", type: "extTrick", id: null, ext: ext, srcParent: null, srcSpace: null };
    return clipboardItem;
  }
  // Brand-new trick record from clipboard data, filed under containerKey.
  function clipNewTrickRaw(ext, containerKey, custom){
    var media = (ext.urls || []).map(function(u){
      return { id: newItemId(), type: "video", title: "", url: u, platform: typeof detectPlatform === "function" ? detectPlatform(u) : "" };
    });
    return { id: newItemId(), name: ext.name, media: media.slice(0, MAX_VIDEOS), categoryIds: [containerKey], orderByCategory: {},
      order: db.tricks.length, icon: "", color: "default", custom: !!custom, grip: ext.grip || null, parts: ext.parts || [],
      tagIds: (ext.tagIds || []).filter(function(id){ return !!getTag(id); }), note: ext.note || "" };
  }

  // Pure: copy of info record src with the placement fields from pl ({ id, parentId, spaceId, order }).
  // prefix / image (v0.17) are carried only when present (records are compared to the base with JSON).
  function clipCopyInfoRec(src, pl){
    var o = { id: pl.id, parentId: pl.parentId, spaceId: pl.spaceId,
      title: { zh: src.title.zh || "", jp: src.title.jp || "", en: src.title.en || "" },
      content: src.content || "", order: pl.order, icon: src.icon || "", color: src.color || "default" };
    if(src.prefix) o.prefix = src.prefix;
    if(src.image) o.image = { id: src.image.id, w: src.image.w, h: src.image.h, size: src.image.size };
    return o;
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
      if(src.prefix) out.cats[out.cats.length - 1].prefix = src.prefix;
      getInfosIn(srcId).forEach(function(n){
        out.infos.push(clipCopyInfoRec(n, { id: idGen(), parentId: nid, spaceId: spaceId, order: typeof n.order === "number" ? n.order : 0 }));
      });
      getTricksInCategory(srcId).forEach(function(tr){
        out.refs.push({ trickId: tr.id, containerId: nid, order: tr.orderByCategory && typeof tr.orderByCategory[srcId] === "number" ? tr.orderByCategory[srcId] : null,
          prefix: clipPfxGet(tr, srcId) });
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
    var it = plan.op === "newTrick" ? null : clipItemOf(clip.type, clip.id);
    var tSpace = env.activeSpace;
    var targetKey = clipKey(targetParentId, tSpace);
    var newId = it ? it.id : null, newType = it ? it.type : "trick";
    if(plan.op === "newTrick"){
      var spc = getSpace(tSpace);
      var rec = normalizeDB({ categories: [], tricks: [clipNewTrickRaw(clip.ext, targetKey, !(env.admin && spc && spc.locked))] }).tricks[0];
      db.tricks.push(rec);
      newId = rec.id;
    } else if(plan.op === "ref"){
      it.ref.categoryIds.push(targetKey);
      var refPfx = clipPfxGet(it.ref, clipKey(clip.srcParent, clip.srcSpace));
      if(refPfx) clipPfxSet(it.ref, targetKey, refPfx);
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
        if(r.prefix) clipPfxSet(tr, r.containerId, r.prefix);
      });
      newId = cp.rootId;
    } else if(plan.op === "copyInfo"){
      if(!db.infos) db.infos = [];
      newId = newItemId();
      db.infos.push(clipCopyInfoRec(it.ref, { id: newId, parentId: targetParentId, spaceId: tSpace, order: 0 }));
    } else { // move
      if(it.type === "trick"){
        var srcKey = clipKey(clip.srcParent, clip.srcSpace);
        var idx = it.ref.categoryIds.indexOf(srcKey);
        if(idx !== -1) it.ref.categoryIds.splice(idx, 1);
        if(it.ref.orderByCategory) delete it.ref.orderByCategory[srcKey];
        if(it.ref.categoryIds.indexOf(targetKey) === -1) it.ref.categoryIds.push(targetKey);
        var mvPfx = clipPfxGet(it.ref, srcKey);
        if(mvPfx && srcKey !== targetKey){ clipPfxSet(it.ref, targetKey, mvPfx); clipPfxSet(it.ref, srcKey, ""); }
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

  // Selection token: bumped by any click / multi-select change. Ctrl+C stores the current value;
  // Ctrl+V with the same value (nothing changed since) duplicates in place (js/25-browse-clip-dup.js).
  var clipSelToken = 0;
  function clipInvalidate(){ clipSelToken++; }

  // Pure: per-item clip objects (clipPlanPaste shape) from a clipboardItem.
  function clipClipsOf(cb){
    if(!cb) return [];
    if(cb.type === "extTrick" || !cb.items) return [cb];
    return cb.items.map(function(x){ return { mode: cb.mode, type: x.type, id: x.id, srcParent: cb.srcParent, srcSpace: cb.srcSpace }; });
  }
  // Pure: counts for the batch toast. plans = clipPlanPaste results.
  function clipBatchCounts(plans){
    var ok = plans.filter(function(p){ return p.ok; }).length;
    return { ok: ok, skipped: plans.length - ok };
  }
  function clipNToast(key, n, skipped){
    if(typeof showToast !== "function") return;
    var s = t(key).replace("{n}", n);
    if(skipped) s += t("clipSkippedN").replace("{m}", skipped);
    showToast(s);
  }

  function clipCopyOrCut(mode){
    var multi = typeof multiSelItems === "function" ? multiSelItems() : [];
    var sel = multi.length ? { type: multi[0].type, id: multi[0].id, parentId: multiSel.parentId } : clipSelection();
    if(!sel || !sel.type) return clipToast("clipNoSelection");
    var list = multi.length ? multi : [{ type: sel.type, id: sel.id }];
    var admin = isAdminNow();
    for(var i = 0; i < list.length; i++){
      var it = clipItemOf(list[i].type, list[i].id);
      if(!it) return clipToast("clipNoSelection");
      if(it.ref.virtual || sel.parentId === FAV_STARRED_ID) return clipToast("clipCannotCopy");
      if(mode === "cut" && it.type === "category" && isFixedFavFolder(it.id)) return clipToast("clipNoPerm");
      if(mode === "cut" && !(canDragItem(it, sel.parentId, admin))) return clipToast("clipNoPerm");
    }
    clipboardItem = { mode: mode, items: list, srcParent: sel.parentId, srcSpace: state.activeSpace, token: clipSelToken };
    if(list.length > 1) return clipNToast(mode === "cut" ? "clipCutN" : "clipCopiedN", list.length, 0);
    clipToast(mode === "cut" ? "clipCut" : "clipCopied", clipName(clipItemOf(list[0].type, list[0].id)));
  }

  // Pure: does pasting cb into target (touch toolbar) mean "duplicate in place"? A copy back into the
  // source column of the same table (not an external trick); a cut there stays "already here".
  function clipPasteIsDup(cb, target, activeSpace){
    return !!(cb && cb.mode === "copy" && cb.items && cb.type !== "extTrick" &&
      cb.srcSpace === activeSpace && (cb.srcParent == null ? null : cb.srcParent) === (target == null ? null : target));
  }

  function clipPaste(){
    if(!clipboardItem) return clipToast("clipEmpty");
    var env = { admin: isAdminNow(), activeSpace: state.activeSpace };
    if(typeof clipDupValid === "function" && clipDupValid(clipboardItem, clipSelToken, env)) return clipPasteDup(clipboardItem, env);
    clipPasteInto(clipTargetParent(clipSelection()), false);
  }

  // Paste into an explicit container (null = table root). Returns true when something was pasted.
  function clipPasteInto(target, allowDup){
    if(!clipboardItem){ clipToast("clipEmpty"); return false; }
    var env = { admin: isAdminNow(), activeSpace: state.activeSpace };
    if(allowDup && typeof clipPasteDup === "function" && clipPasteIsDup(clipboardItem, target, env.activeSpace)) return clipPasteDup(clipboardItem, env);
    var clips = clipClipsOf(clipboardItem);
    var plans = clips.map(function(c){ return clipPlanPaste(c, target, env); });
    var cnt = clipBatchCounts(plans);
    if(!cnt.ok){ clipToast(plans[0] ? plans[0].err : "clipEmpty"); return false; }
    if(typeof undoPush === "function") undoPush();
    var moved = false;
    clips.forEach(function(c, i){
      if(!plans[i].ok) return;
      clipApplyPaste(c, target, plans[i], env);
      if(plans[i].op === "move") moved = true;
    });
    if(moved || clips[0].type === "extTrick"){ // a new trick is pasted once; a cut is consumed
      clipboardItem = null;
      if(typeof multiSelClear === "function") multiSelClear();
    }
    if(clips.length > 1) clipNToast("clipPastedN", cnt.ok, cnt.skipped);
    else clipToast(moved ? "clipMoved" : "clipPasted");
    render();
    return true;
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
      if(ev.shiftKey && typeof multiSelHandleClick === "function" && multiSelHandleClick(ev, row)) return;
      clipInvalidate();
      if(typeof multiSelClear === "function") multiSelClear();
      var rows = wrap.querySelectorAll(".item");
      for(var i = 0; i < rows.length; i++) if(rows[i]._kbd && typeof kbdClear === "function") kbdClear([rows[i]]);
      if(row && row.dataset.itemType) { clipLastClick = clipRowInfo(row); return; }
      var col = tg && tg.closest ? tg.closest(".m-col") : null;
      if(col && col.dataset && col.dataset.colKey !== undefined){
        clipLastClick = { type: null, id: null, parentId: col.dataset.colKey === "__root__" ? null : col.dataset.colKey };
      }
    }, true);
  })();
