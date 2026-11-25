"use strict";

  /* ============================================================
     SHARE — one-click share by link (v0.9.1)
     Send: pressing 分享 sanitizes a folder / custom table / own trick into a JSON payload and writes the
     public snapshot shares/{ownerUid}_{itemId} (overwritten on every press); the link is
     ?s=<ownerUid>&i=<itemId>.
     Receive: a signed-in user opening the link gets the snapshot copied (fresh ids) into
     收藏 > 外部匯入 (folder shares: the folder subtree; trick shares: 外部匯入 > 單招式 > trick).
     Both fixed folders always exist (ensureFavFixedFolders in js/01).
     The copied root carries sharedFrom:"<ownerUid>_<itemId>" (kept by normalizeDB, synced with the
     record) so opening the same link twice only navigates. Guests: the link is kept in sessionStorage
     and finished after sign-in + sync (shareOnAuth, called from js/59).
     Base (shared 總表) tricks are kept as references by id; custom tricks are copied by value.
     Pure logic here; DOM + Firestore glue lives in js/58-share-flow.js.
  ============================================================ */
  addStrings({
    zh:{ shareBtn:"分享", shareTrickBtn:"分享招式", shareNeedLogin:"請先登入才能分享", shareTooBig:"內容太大，無法分享（上限約 200 KB）",
         shareEmpty:"沒有可分享的內容", shareFailed:"分享失敗，請稍後再試", shareLinkCopied:"分享連結已複製",
         shareLinkIs:"分享連結（請複製）：", shareWorking:"建立分享連結…", shareLoadFailed:"找不到這個分享，或連結已失效",
         shareAdded:"已加入「收藏 › 外部匯入」", shareDup:"已加入過", shareTruncated:"部分內容超過層數上限，已略過",
         shareOpenNeedLogin:"請先登入，登入後會自動加入分享的內容" },
    jp:{ shareBtn:"共有", shareTrickBtn:"技を共有", shareNeedLogin:"共有するにはログインしてください", shareTooBig:"内容が大きすぎて共有できません（上限約200KB）",
         shareEmpty:"共有できる内容がありません", shareFailed:"共有に失敗しました。後でもう一度お試しください", shareLinkCopied:"共有リンクをコピーしました",
         shareLinkIs:"共有リンク（コピーしてください）：", shareWorking:"共有リンクを作成中…", shareLoadFailed:"この共有が見つからないか、リンクが無効です",
         shareAdded:"「お気に入り › 外部インポート」に追加しました", shareDup:"すでに追加済みです", shareTruncated:"階層の上限を超える内容は省略しました",
         shareOpenNeedLogin:"ログインしてください。ログイン後に共有内容を自動で追加します" },
    en:{ shareBtn:"Share", shareTrickBtn:"Share trick", shareNeedLogin:"Sign in to share", shareTooBig:"Too large to share (limit about 200 KB)",
         shareEmpty:"Nothing to share", shareFailed:"Sharing failed, please try again later", shareLinkCopied:"Share link copied",
         shareLinkIs:"Share link (copy it): ", shareWorking:"Creating share link…", shareLoadFailed:"This share was not found or the link is no longer valid",
         shareAdded:"Added to Favorites > Imported", shareDup:"Already added", shareTruncated:"Some content was too deep and was skipped",
         shareOpenNeedLogin:"Sign in and the shared content will be added automatically" }
  });

  var SHARE_VERSION = 1;
  var SHARE_MAX_BYTES = 200 * 1024;
  var SHARE_UID_RE = /^[0-9A-Za-z]{6,40}$/;
  var SHARE_ITEM_RE = /^[0-9A-Za-z_-]{1,40}$/; // same rule as firestore.rules
  var SHARE_PENDING_KEY = "kendama-share-pending";
  var SHARE_EXT_ID = FAV_EXTERNAL_ID;
  var SHARE_EXT_SINGLE_ID = FAV_EXTERNAL_SINGLE_ID;
  var SHARE_LIMITS = { cats: 300, infos: 300, tricks: 600, refs: 1000, media: MAX_VIDEOS, name: 80, text: 2000, url: 500 };

  /* ---------------- pure: link / doc id ---------------- */
  // "?a=1&s=<uid>&i=<item>" -> { s, i } | null (either part invalid = null)
  function shareParseLink(search){
    function get(k){
      var m = new RegExp("[?&]" + k + "=([^&#]*)").exec(search || "");
      if(!m) return null;
      try{ return decodeURIComponent(m[1]); }catch(e){ return null; }
    }
    var s = get("s"), i = get("i");
    return (s && i && SHARE_UID_RE.test(s) && SHARE_ITEM_RE.test(i)) ? { s: s, i: i } : null;
  }
  function shareUrlFor(ownerUid, itemId){ return "https://kendama-tricks-db.web.app/?s=" + ownerUid + "&i=" + itemId; }
  // Firestore doc id == <ownerUid>_<itemId> (the rules check this); also the dedup source key.
  function shareDocId(ownerUid, itemId){
    return (SHARE_UID_RE.test(ownerUid || "") && SHARE_ITEM_RE.test(itemId || "")) ? ownerUid + "_" + itemId : null;
  }

  /* ---------------- pure: build payload ---------------- */
  function _sStr(v, max){ return typeof v === "string" ? v.slice(0, max) : ""; }
  function _sName(n){ n = n || {}; return { zh: _sStr(n.zh, SHARE_LIMITS.name), jp: _sStr(n.jp, SHARE_LIMITS.name), en: _sStr(n.en, SHARE_LIMITS.name) }; }
  function _sIcon(v){ return typeof v === "string" && (v.length <= 16 || IMAGE_ICON_RE.test(v)) ? v : ""; }
  function _sColor(v){ return typeof v === "string" ? sanitizeColorKey(v, "") : ""; }
  function _sNum(v){ return typeof v === "number" && isFinite(v) ? v : 0; }
  function _sSafeUrl(u){
    u = _sStr(u, SHARE_LIMITS.url);
    return (u && typeof isSafeHttpUrl === "function" && isSafeHttpUrl(u)) ? u : "";
  }

  // Base trick = official 總表 content (exists for everyone): kept as a reference by id.
  // Everything else (custom flag, or only placed in the user's own unlocked tables) is the user's own.
  function shareIsBaseTrick(tr){
    if(!tr || tr.custom) return false;
    return (tr.categoryIds || []).some(function(cid){
      var sid = containerSpaceId(cid);
      var sp = sid ? getSpace(sid) : null;
      return !!(sp && sp.locked);
    });
  }

  function shareTrickOut(tr){
    var media = [];
    (tr.media || []).forEach(function(m){
      var url = _sSafeUrl(m && m.url);
      if(!url || media.length >= SHARE_LIMITS.media) return;
      media.push({ title: _sStr(m.title, SHARE_LIMITS.name), url: url });
    });
    return { id: _sStr(tr.id, 40), name: _sName(tr.name), media: media, icon: _sIcon(tr.icon), color: _sColor(tr.color),
      grip: typeof tr.grip === "string" ? tr.grip : null,
      parts: Array.isArray(tr.parts) ? tr.parts.filter(function(p){ return typeof p === "string"; }).slice(0, 20) : [],
      order: _sNum(tr.order), placements: [] };
  }

  function shareBuildTrickPayload(trickId){
    var tr = getTrick(trickId);
    if(!tr || tr.virtual || shareIsBaseTrick(tr)) return null;
    var o = shareTrickOut(tr);
    return { v: SHARE_VERSION, kind: "trick", name: o.name, icon: o.icon, color: o.color, cats: [], infos: [], tricks: [o], refs: [] };
  }
  // Base trick: no copy, just a reference by id (receiver gets it placed in 單招式).
  function shareBuildBaseTrickPayload(tr){
    return { v: SHARE_VERSION, kind: "trick", name: _sName(tr.name), icon: _sIcon(tr.icon), color: _sColor(tr.color),
      cats: [], infos: [], tricks: [], refs: [{ trickId: _sStr(tr.id, 40), c: null, o: null }] };
  }

  // rootKind "space" (custom table id) | "folder" (category id). Returns payload or null.
  function shareBuildFolderPayload(rootKind, id){
    var ix = ensureDbIndex();
    var out = { v: SHARE_VERSION, kind: rootKind, name: null, icon: "", color: "default", cats: [], infos: [], tricks: [], refs: [] };
    var byId = {};
    function catOut(c, parentKey){
      var o = { id: _sStr(c.id, 40), parentId: parentKey, name: _sName(c.name), order: _sNum(c.order), icon: _sIcon(c.icon), color: _sColor(c.color) };
      var pf = normalizePrefix(c.prefix);
      if(pf) o.prefix = pf;
      return o;
    }
    function pObj(base, pf){ if(pf) base.p = pf; return base; } // prefix only when non-empty
    function walk(containerId, outKey, spaceId, depth){
      if(depth > 12) return;
      var kids = containerId === spaceId ? ix.rootCats.filter(function(c){ return c.spaceId === spaceId; }) : (ix.catsByParent[containerId] || []);
      kids.forEach(function(c){ out.cats.push(catOut(c, outKey)); walk(c.id, c.id, spaceId, depth + 1); });
      var infos = containerId === spaceId ? ix.rootInfos.filter(function(n){ return n.spaceId === spaceId; }) : (ix.infosByParent[containerId] || []);
      infos.forEach(function(n){
        var io = { id: _sStr(n.id, 40), parentId: outKey, title: _sName(n.title), content: _sStr(n.content, SHARE_LIMITS.text),
          order: _sNum(n.order), icon: _sIcon(n.icon), color: _sColor(n.color) };
        var ipf = normalizePrefix(n.prefix);
        if(ipf) io.prefix = ipf;
        var ilk = normalizeInfoLinks(n.links);
        if(ilk.length) io.links = ilk;
        out.infos.push(io);
      });
      (ix.tricksByContainer[containerId] || []).forEach(function(tr){
        var ord = tr.orderByCategory && typeof tr.orderByCategory[containerId] === "number" ? tr.orderByCategory[containerId] : null;
        var tp = normalizePrefix(getTrickPrefix(tr, containerId));
        if(shareIsBaseTrick(tr)){ out.refs.push(pObj({ trickId: tr.id, c: outKey, o: ord }, tp)); return; }
        var first = !byId[tr.id];
        if(first){ byId[tr.id] = shareTrickOut(tr); out.tricks.push(byId[tr.id]); }
        byId[tr.id].placements.push(pObj({ c: outKey, o: ord }, tp));
        if(first) walk(tr.id, tr.id, spaceId, depth + 1);
      });
    }
    if(rootKind === "space"){
      var sp = getSpace(id);
      if(!sp || sp.locked || isDefaultSpaceId(sp.id)) return null;
      out.name = _sName(sp.name); out.icon = _sIcon(sp.icon);
      walk(sp.id, null, sp.id, 0);
    } else {
      var cat = ix.catById[id];
      if(!cat || cat.virtual) return null;
      var sp2 = getSpace(cat.spaceId);
      if(!sp2 || sp2.locked) return null;
      out.name = _sName(cat.name); out.icon = _sIcon(cat.icon); out.color = _sColor(cat.color) || "default";
      out.cats.push(catOut(cat, null));
      walk(cat.id, cat.id, cat.spaceId, 1);
    }
    return out;
  }

  /* ---------------- pure: sanitize (used on send and on receive) ---------------- */
  // Returns { p, dropped } : p = clean payload or null (bad shape); dropped = nodes cut by the level limits.
  // levelOffset: levels already used above the payload root (receive: 外部匯入 = 1, so a copied folder sits at 2).
  function shareSanitizeEx(raw, levelOffset){
    levelOffset = levelOffset || 0;
    if(!raw || typeof raw !== "object" || raw.v !== SHARE_VERSION) return { p: null, dropped: 0 };
    if(["space", "folder", "trick"].indexOf(raw.kind) === -1) return { p: null, dropped: 0 };
    var L = SHARE_LIMITS, seen = {};
    function uniq(id){ id = _sStr(id, 40); if(!id || seen[id]) return null; seen[id] = true; return id; }
    function arr(a, max){ return Array.isArray(a) ? a.slice(0, max) : []; }
    var cats = [], infos = [], tricks = [], refs = [];
    arr(raw.cats, L.cats).forEach(function(c){
      var id = c && uniq(c.id); if(!id) return;
      var co = { id: id, parentId: c.parentId == null ? null : _sStr(c.parentId, 40), name: _sName(c.name),
        order: _sNum(c.order), icon: _sIcon(c.icon), color: _sColor(c.color) || "default" };
      var cp = normalizePrefix(c.prefix);
      if(cp) co.prefix = cp;
      cats.push(co);
    });
    arr(raw.tricks, L.tricks).forEach(function(tr){
      var id = tr && uniq(tr.id); if(!id) return;
      var o = shareTrickOut(Object.assign({}, tr, { id: id }));
      o.placements = arr(tr.placements, 20).filter(function(p){ return p && typeof p === "object"; })
        .map(function(p){
          var po = { c: p.c == null ? null : _sStr(p.c, 40), o: typeof p.o === "number" && isFinite(p.o) ? p.o : null };
          var pp = normalizePrefix(p.p);
          if(pp) po.p = pp;
          return po;
        });
      tricks.push(o);
    });
    arr(raw.infos, L.infos).forEach(function(n){
      var id = n && uniq(n.id); if(!id) return;
      var inf = { id: id, parentId: n.parentId == null ? null : _sStr(n.parentId, 40), title: _sName(n.title), content: _sStr(n.content, L.text),
        order: _sNum(n.order), icon: _sIcon(n.icon), color: _sColor(n.color) || "default" };
      var inp = normalizePrefix(n.prefix);
      if(inp) inf.prefix = inp;
      var inl = normalizeInfoLinks(n.links); // the receiver never trusts the payload
      if(inl.length) inf.links = inl;
      infos.push(inf);
    });
    arr(raw.refs, L.refs).forEach(function(r){
      if(!r || typeof r.trickId !== "string") return;
      var ro = { trickId: _sStr(r.trickId, 40), c: r.c == null ? null : _sStr(r.c, 40), o: typeof r.o === "number" && isFinite(r.o) ? r.o : null };
      var rp = normalizePrefix(r.p);
      if(rp) ro.p = rp;
      refs.push(ro);
    });
    var out = { v: SHARE_VERSION, kind: raw.kind, name: _sName(raw.name), icon: _sIcon(raw.icon), color: _sColor(raw.color) || "default",
      cats: cats, infos: infos, tricks: tricks, refs: refs };
    if(raw.kind === "trick"){
      out.cats = []; out.infos = [];
      out.tricks = tricks.slice(0, 1).map(function(o){ o.placements = []; return o; });
      out.refs = out.tricks.length ? [] : refs.slice(0, 1).map(function(r){ return { trickId: r.trickId, c: null, o: null }; });
      return { p: (out.tricks.length || out.refs.length) ? out : null, dropped: 0 };
    }
    // levels: container id -> level (0 = payload root); -1 = unresolvable / cyclic
    var parentOf = {};
    cats.forEach(function(c){ parentOf[c.id] = c.parentId; });
    tricks.forEach(function(tr){ parentOf[tr.id] = tr.placements.length ? tr.placements[0].c : null; });
    var memo = {};
    function lv(id, depth){
      if(id == null) return 0;
      if(!(id in parentOf) || depth > 20) return -1;
      if(id in memo) return memo[id];
      memo[id] = -1; // cycle guard
      var p = lv(parentOf[id], depth + 1);
      return (memo[id] = p < 0 ? -1 : p + 1);
    }
    function fits(parent, maxLevel){ var p = lv(parent, 0); return p >= 0 && p + levelOffset + 1 <= maxLevel; }
    out.cats = cats.filter(function(c){ return fits(c.parentId, MAX_FOLDER_LEVEL); });
    out.infos = infos.filter(function(n){ return fits(n.parentId, MAX_ITEM_LEVEL); });
    out.tricks = tricks.filter(function(tr){
      tr.placements = tr.placements.filter(function(p){ return fits(p.c, MAX_ITEM_LEVEL); });
      return tr.placements.length > 0;
    });
    out.refs = refs.filter(function(r){ return fits(r.c, MAX_ITEM_LEVEL); });
    var dropped = (cats.length - out.cats.length) + (infos.length - out.infos.length) +
      (tricks.length - out.tricks.length) + (refs.length - out.refs.length);
    return { p: out, dropped: dropped };
  }
  function shareSanitizePayload(raw, levelOffset){ return shareSanitizeEx(raw, levelOffset).p; }

  // JSON string for the doc, or null when over the size cap.
  function shareSerialize(payload){
    var s = JSON.stringify(payload);
    return s.length > SHARE_MAX_BYTES ? null : s;
  }
  function shareTitleOf(payload){
    var n = payload && payload.name || {};
    var lang = state.lang;
    return (n[lang] || n.zh || n.jp || n.en || "").slice(0, 120);
  }

  // A shared custom table (kind "space") becomes one wrapper folder named after the table, so it
  // lands in 外部匯入 like any folder share. Items without a parent move into the wrapper.
  function shareSpaceToFolder(p){
    if(!p || p.kind !== "space" || !Array.isArray(p.cats)) return p;
    var W = "__root";
    function par(x){ return x == null ? W : x; }
    var out = Object.assign({}, p, { kind: "folder" });
    out.cats = [{ id: W, parentId: null, name: p.name, order: 0, icon: p.icon, color: "default" }].concat(p.cats.map(function(c){
      return Object.assign({}, c, { parentId: par(c && c.parentId) });
    }));
    out.infos = (p.infos || []).map(function(n){ return Object.assign({}, n, { parentId: par(n && n.parentId) }); });
    out.tricks = (p.tricks || []).map(function(tr){
      return Object.assign({}, tr, { placements: (Array.isArray(tr.placements) ? tr.placements : []).map(function(pl){ return { c: par(pl && pl.c), o: pl && pl.o, p: pl && pl.p }; }) });
    });
    out.refs = (p.refs || []).map(function(r){ return { trickId: r && r.trickId, c: par(r && r.c), o: r && r.o, p: r && r.p }; });
    return out;
  }

  /* ---------------- pure: remap to fresh ids ---------------- */
  // Returns records ready to push + the id of the copied root. hasTrick(id): is the referenced base trick known locally.
  // targetSpaceId: table receiving the items; rootParentId: container that holds the payload root
  // (folder kinds: 外部匯入; trick kind: 單招式).
  function shareRemap(p, idGen, targetSpaceId, hasTrick, rootParentId){
    var map = {};
    p.cats.forEach(function(c){ map[c.id] = idGen(); });
    p.tricks.forEach(function(tr){ map[tr.id] = idGen(); });
    function dest(c){ return c == null ? rootParentId : map[c]; }
    var cats = p.cats.map(function(c){
      var o = { id: map[c.id], parentId: dest(c.parentId), name: c.name, order: c.order, icon: c.icon, color: c.color, spaceId: targetSpaceId };
      var cp = normalizePrefix(c.prefix);
      if(cp) o.prefix = cp;
      return o;
    });
    var infos = p.infos.map(function(n){
      var ro = { id: idGen(), parentId: dest(n.parentId), spaceId: targetSpaceId, title: n.title, content: n.content,
        order: n.order, icon: n.icon, color: n.color };
      var rp2 = normalizePrefix(n.prefix);
      if(rp2) ro.prefix = rp2;
      var rl = normalizeInfoLinks(n.links);
      if(rl.length) ro.links = rl;
      return ro;
    });
    var isTrick = p.kind === "trick";
    var tricks = p.tricks.map(function(tr){
      var ids = [], obc = {}, pbc = {};
      if(isTrick) ids.push(rootParentId);
      tr.placements.forEach(function(pl){
        var d = dest(pl.c);
        if(!d || ids.indexOf(d) !== -1) return;
        ids.push(d);
        if(pl.o !== null) obc[d] = pl.o;
        if(pl.p) pbc[d] = pl.p;
      });
      var rt = { id: map[tr.id], name: tr.name, media: tr.media.map(function(m){ return { id: idGen(), type: "video", title: m.title, url: m.url }; }),
        categoryIds: ids, orderByCategory: obc, order: tr.order, icon: tr.icon, color: tr.color, grip: tr.grip, parts: tr.parts, custom: false };
      var pm = normalizePrefixMap(pbc);
      if(pm) rt.prefixByCategory = pm;
      return rt;
    });
    var refs = p.refs.filter(function(r){ return hasTrick(r.trickId) && dest(r.c); })
      .map(function(r){ return { trickId: r.trickId, containerId: dest(r.c), order: r.o, prefix: normalizePrefix(r.p) }; });
    var rootId = null;
    if(isTrick) rootId = tricks.length ? tricks[0].id : (refs.length ? refs[0].trickId : null);
    else p.cats.some(function(c){ if(c.parentId == null){ rootId = map[c.id]; return true; } return false; });
    return { cats: cats, infos: infos, tricks: tricks, refs: refs, rootId: rootId };
  }

  /* ---------------- add to db ---------------- */
  // Finds an earlier copy of a share (dedup). Returns { kind:"folder"|"trick", id } or null.
  function shareFindCopy(key){
    var c = (db.categories || []).find(function(x){ return x.sharedFrom === key; });
    if(c) return { kind: "folder", id: c.id };
    var tr = (db.tricks || []).find(function(x){ return x.sharedFrom === key; });
    return tr ? { kind: "trick", id: tr.id } : null;
  }

  // The fixed folders are permanent (normalizeDB ensures them); this only re-adds them if a live db
  // somehow lacks them, then returns the record.
  function shareEnsureFixed(id){
    var ex = (db.categories || []).find(function(c){ return c.id === id; });
    if(ex) return ex;
    ensureFavFixedFolders(db.categories);
    invalidateDbIndex();
    return db.categories.find(function(c){ return c.id === id; });
  }
  function shareEnsureExternal(){ return shareEnsureFixed(SHARE_EXT_ID); }
  function shareEnsureSingle(){ return shareEnsureFixed(SHARE_EXT_SINGLE_ID); }

  // key = "<ownerUid>_<itemId>". Returns { ok:true, dup, truncated, nav:{kind,id} } or { ok:false, err:<i18n key> }.
  function shareApply(payload, key){
    var old = shareFindCopy(key);
    if(old) return { ok: true, dup: true, truncated: false, nav: old };
    var shaped = shareSpaceToFolder(payload);
    var isTrick = !!shaped && shaped.kind === "trick";
    var sx = shareSanitizeEx(shaped, isTrick ? 0 : 1); // 外部匯入 is level 1, the copied folder level 2 (單招式 = 2, its trick 3)
    var p = sx.p;
    if(!p) return { ok: false, err: "shareLoadFailed" };
    // Base-trick reference share: dedup = already placed in 單招式; unknown trick = invalid.
    if(isTrick && !p.tricks.length){
      var bt = getTrick(p.refs[0].trickId);
      if(!bt) return { ok: false, err: "shareLoadFailed" };
      if(bt.categoryIds.indexOf(SHARE_EXT_SINGLE_ID) !== -1) return { ok: true, dup: true, truncated: false, nav: { kind: "trick", id: bt.id } };
    }
    if(typeof undoPush === "function") undoPush();
    var parent = isTrick ? shareEnsureSingle() : shareEnsureExternal();
    var rec = shareRemap(p, newItemId, FAV_TABLE_ID, function(id){ return !!getTrick(id); }, parent.id);
    if(!rec.rootId) return { ok: false, err: "shareLoadFailed" };
    rec.cats.forEach(function(c){ if(c.id === rec.rootId) c.sharedFrom = key; db.categories.push(c); });
    if(!db.infos) db.infos = [];
    rec.infos.forEach(function(n){ db.infos.push(n); });
    rec.tricks.forEach(function(tr){ if(tr.id === rec.rootId) tr.sharedFrom = key; });
    normalizeDB({ categories: [], tricks: rec.tricks }).tricks.forEach(function(tr){ db.tricks.push(tr); });
    rec.refs.forEach(function(r){
      var tr = getTrick(r.trickId);
      if(!tr) return;
      if(tr.categoryIds.indexOf(r.containerId) === -1) tr.categoryIds.push(r.containerId);
      if(r.order !== null){ tr.orderByCategory = tr.orderByCategory || {}; tr.orderByCategory[r.containerId] = r.order; }
      if(r.prefix) setTrickPrefix(tr, r.containerId, r.prefix);
    });
    saveDB();
    return { ok: true, dup: false, truncated: sx.dropped > 0, nav: { kind: isTrick ? "trick" : "folder", id: rec.rootId } };
  }
