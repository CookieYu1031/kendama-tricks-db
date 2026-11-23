"use strict";

  /* ============================================================
     BROWSE — duplicate in place: Ctrl+C then straight Ctrl+V (selection unchanged) puts a copy
     right below the original, in the same column. Lists deep-copy, infos copy, tricks become a
     brand-new trick (new id; no rate / favorite / children). Needs js/25-browse-clipboard.js.
  ============================================================ */

  // Pure: is Ctrl+V a duplicate-in-place? token = current clipSelToken.
  function clipDupValid(cb, token, env){
    return !!(cb && cb.mode === "copy" && cb.items && cb.token === token && cb.srcSpace === env.activeSpace);
  }

  // Plan one in-place duplicate: same rules as a paste into the item's own column.
  function clipPlanDup(clip, env){
    var p = clipPlanPaste(clip, clip.srcParent, env);
    var it = clipItemOf(clip.type, clip.id);
    if(it && it.type === "trick" && (p.ok || p.err === "clipAlready")) return { ok: true, op: "dupTrick" };
    return p;
  }

  // Pure: fresh trick record copied from src, filed only under containerKey.
  function clipDupTrickRaw(src, containerKey, idGen, order){
    return {
      id: idGen(),
      name: { zh: (src.name && src.name.zh) || "", jp: (src.name && src.name.jp) || "", en: (src.name && src.name.en) || "" },
      media: (src.media || []).map(function(m){ var c = JSON.parse(JSON.stringify(m)); c.id = idGen(); return c; }),
      categoryIds: [containerKey], orderByCategory: {}, order: order,
      icon: src.icon || "", color: src.color || "default", custom: !!src.custom,
      grip: src.grip || null, parts: (src.parts || []).slice(), tagIds: (src.tagIds || []).slice(), note: src.note || ""
    };
  }

  // Pure: moves entry (newType,newId) of arr to just after (origType,origId). Returns arr.
  function clipInsertAfter(arr, newType, newId, origType, origId){
    var from = arr.findIndex(function(x){ return x.id === newId && x.type === newType; });
    if(from === -1) return arr;
    var moved = arr.splice(from, 1)[0];
    var at = arr.findIndex(function(x){ return x.id === origId && x.type === origType; });
    arr.splice(at === -1 ? arr.length : at + 1, 0, moved);
    return arr;
  }

  function clipApplyDup(clip, plan, env){
    var parent = clip.srcParent, space = env.activeSpace, newId, newType = clip.type;
    if(plan.op === "dupTrick"){
      var raw = clipDupTrickRaw(getTrick(clip.id), clipKey(parent, space), newItemId, db.tricks.length);
      var rec = normalizeDB({ categories: [], tricks: [raw] }).tricks[0];
      db.tricks.push(rec);
      invalidateDbIndex();
      newId = rec.id;
    } else {
      newId = clipApplyPaste(clip, parent, plan, env);
    }
    invalidateDbIndex();
    var arr = clipInsertAfter(buildColumnItems(parent), newType, newId, clip.type, clip.id);
    persistColumnOrder(arr, parent);
    return newId;
  }

  function clipPasteDup(cb, env){
    var clips = clipClipsOf(cb);
    var plans = clips.map(function(c){ return clipPlanDup(c, env); });
    var cnt = clipBatchCounts(plans);
    clipInvalidate(); // the next Ctrl+V is a normal paste
    if(!cnt.ok) return clipToast(plans[0] ? plans[0].err : "clipEmpty");
    if(typeof undoPush === "function") undoPush();
    clips.forEach(function(c, i){ if(plans[i].ok) clipApplyDup(c, plans[i], env); });
    if(clips.length > 1) clipNToast("clipPastedN", cnt.ok, cnt.skipped); else clipToast("clipPasted");
    render();
  }
