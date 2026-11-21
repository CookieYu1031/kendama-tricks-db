"use strict";

  /* ============================================================
     SHARE — one-click share of user-made content (v0.9)
     Send: a custom table / a folder inside one (deep subtree) or one custom trick is sanitized into a
     JSON payload and written to shares/{shareId}; the link ?share=<id> is copied.
     Receive: ?share=<id> opens a preview modal; "add" copies everything under fresh ids into a NEW
     custom table (folder / table shares) or into 收藏 > 自訂義 (trick shares).
     Base (shared 總表) tricks are kept as references by id; custom tricks are copied by value.
     Pure logic first (payload build / sanitize / remap), DOM + Firestore glue at the bottom.
  ============================================================ */
  addStrings({
    zh:{ shareBtn:"分享", shareNeedLogin:"請先登入才能分享", shareTooBig:"內容太大，無法分享（上限約 200 KB）",
         shareEmpty:"沒有可分享的內容", shareFailed:"分享失敗，請稍後再試", shareLinkCopied:"分享連結已複製",
         shareLinkIs:"分享連結（請複製）：", shareWorking:"建立分享連結…", shareTitleFolder:"分享資料夾",
         shareTitleTrick:"分享招式", shareLoadFailed:"找不到這個分享，或連結已失效",
         shareModalTitle:"有人與你分享了內容", shareCountFolders:"個資料夾", shareCountTricks:"個招式", shareCountInfos:"則資訊",
         shareKindFolder:"將加入為新的自訂表格", shareKindTrick:"將加入「收藏 › 自訂義」",
         shareAdd:"加入", shareAddLogin:"登入後加入", shareCancel:"取消", shareAdded:"已加入",
         shareTableLimit:"自訂表格已達 26 個上限", shareMore:"…還有更多", shareSigningIn:"登入後可再按「加入」" },
    jp:{ shareBtn:"共有", shareNeedLogin:"共有するにはログインしてください", shareTooBig:"内容が大きすぎて共有できません（上限約200KB）",
         shareEmpty:"共有できる内容がありません", shareFailed:"共有に失敗しました。後でもう一度お試しください", shareLinkCopied:"共有リンクをコピーしました",
         shareLinkIs:"共有リンク（コピーしてください）：", shareWorking:"共有リンクを作成中…", shareTitleFolder:"フォルダを共有",
         shareTitleTrick:"技を共有", shareLoadFailed:"この共有が見つからないか、リンクが無効です",
         shareModalTitle:"共有された内容があります", shareCountFolders:"フォルダ", shareCountTricks:"技", shareCountInfos:"情報",
         shareKindFolder:"新しいカスタム表として追加されます", shareKindTrick:"「お気に入り › カスタム」に追加されます",
         shareAdd:"追加", shareAddLogin:"ログインして追加", shareCancel:"キャンセル", shareAdded:"追加しました",
         shareTableLimit:"カスタム表は26個までです", shareMore:"…ほかにもあります", shareSigningIn:"ログイン後にもう一度「追加」を押してください" },
    en:{ shareBtn:"Share", shareNeedLogin:"Sign in to share", shareTooBig:"Too large to share (limit about 200 KB)",
         shareEmpty:"Nothing to share", shareFailed:"Sharing failed, please try again later", shareLinkCopied:"Share link copied",
         shareLinkIs:"Share link (copy it): ", shareWorking:"Creating share link…", shareTitleFolder:"Share folder",
         shareTitleTrick:"Share trick", shareLoadFailed:"This share was not found or the link is no longer valid",
         shareModalTitle:"Someone shared something with you", shareCountFolders:"folders", shareCountTricks:"tricks", shareCountInfos:"info",
         shareKindFolder:"Will be added as a new custom table", shareKindTrick:"Will be added to Favorites > Custom",
         shareAdd:"Add", shareAddLogin:"Sign in to add", shareCancel:"Cancel", shareAdded:"Added",
         shareTableLimit:"Custom tables are limited to 26", shareMore:"…and more", shareSigningIn:"Tap Add again after signing in" }
  });

  var SHARE_VERSION = 1;
  var SHARE_MAX_BYTES = 200 * 1024;
  var SHARE_ID_RE = /^[0-9A-Za-z]{8,40}$/;
  var SHARE_LIMITS = { cats: 300, infos: 300, tricks: 600, refs: 1000, media: MAX_VIDEOS, name: 80, text: 2000, url: 500 };

  /* ---------------- pure: url param ---------------- */
  // "?a=1&share=abc12345" -> "abc12345" | null (invalid ids are rejected)
  function shareParseId(search){
    var m = /[?&]share=([^&#]*)/.exec(search || "");
    if(!m) return null;
    var id;
    try{ id = decodeURIComponent(m[1]); }catch(e){ return null; }
    return SHARE_ID_RE.test(id) ? id : null;
  }
  function shareUrlFor(id){ return "https://kendama-tricks-db.web.app/?share=" + id; }

  /* ---------------- pure: build payload ---------------- */
  function _sStr(v, max){ return typeof v === "string" ? v.slice(0, max) : ""; }
  function _sName(n){ n = n || {}; return { zh: _sStr(n.zh, SHARE_LIMITS.name), jp: _sStr(n.jp, SHARE_LIMITS.name), en: _sStr(n.en, SHARE_LIMITS.name) }; }
  function _sIcon(v){ return typeof v === "string" && (v.length <= 16 || IMAGE_ICON_RE.test(v)) ? v : ""; }
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
    return { id: _sStr(tr.id, 40), name: _sName(tr.name), media: media, icon: _sIcon(tr.icon), color: _sStr(tr.color, 24),
      grip: typeof tr.grip === "string" ? tr.grip : null,
      parts: Array.isArray(tr.parts) ? tr.parts.filter(function(p){ return typeof p === "string"; }).slice(0, 20) : [],
      officialNote: _sStr(tr.officialNote, SHARE_LIMITS.text), order: _sNum(tr.order), placements: [] };
  }

  function shareBuildTrickPayload(trickId){
    var tr = getTrick(trickId);
    if(!tr || tr.virtual || shareIsBaseTrick(tr)) return null;
    var o = shareTrickOut(tr);
    return { v: SHARE_VERSION, kind: "trick", name: o.name, icon: o.icon, color: o.color, cats: [], infos: [], tricks: [o], refs: [] };
  }

  // rootKind "space" (custom table id) | "folder" (category id). Returns payload or null.
  function shareBuildFolderPayload(rootKind, id){
    var ix = ensureDbIndex();
    var out = { v: SHARE_VERSION, kind: rootKind, name: null, icon: "", color: "default", cats: [], infos: [], tricks: [], refs: [] };
    var byId = {};
    function catOut(c, parentKey){
      return { id: _sStr(c.id, 40), parentId: parentKey, name: _sName(c.name), order: _sNum(c.order), icon: _sIcon(c.icon), color: _sStr(c.color, 24) };
    }
    function walk(containerId, outKey, spaceId, depth){
      if(depth > 12) return;
      var kids = containerId === spaceId ? ix.rootCats.filter(function(c){ return c.spaceId === spaceId; }) : (ix.catsByParent[containerId] || []);
      kids.forEach(function(c){ out.cats.push(catOut(c, outKey)); walk(c.id, c.id, spaceId, depth + 1); });
      var infos = containerId === spaceId ? ix.rootInfos.filter(function(n){ return n.spaceId === spaceId; }) : (ix.infosByParent[containerId] || []);
      infos.forEach(function(n){
        out.infos.push({ id: _sStr(n.id, 40), parentId: outKey, title: _sName(n.title), content: _sStr(n.content, SHARE_LIMITS.text),
          order: _sNum(n.order), icon: _sIcon(n.icon), color: _sStr(n.color, 24) });
      });
      (ix.tricksByContainer[containerId] || []).forEach(function(tr){
        var ord = tr.orderByCategory && typeof tr.orderByCategory[containerId] === "number" ? tr.orderByCategory[containerId] : null;
        if(shareIsBaseTrick(tr)){ out.refs.push({ trickId: tr.id, c: outKey, o: ord }); return; }
        var first = !byId[tr.id];
        if(first){ byId[tr.id] = shareTrickOut(tr); out.tricks.push(byId[tr.id]); }
        byId[tr.id].placements.push({ c: outKey, o: ord });
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
      out.name = _sName(cat.name); out.icon = _sIcon(cat.icon); out.color = _sStr(cat.color, 24) || "default";
      out.cats.push(catOut(cat, null));
      walk(cat.id, cat.id, cat.spaceId, 1);
    }
    return out;
  }

  /* ---------------- pure: sanitize (used on send and on receive) ---------------- */
  // Returns a clean payload or null (bad shape / too big). Drops duplicate ids, orphans and nodes past the level limits.
  function shareSanitizePayload(raw){
    if(!raw || typeof raw !== "object" || raw.v !== SHARE_VERSION) return null;
    if(["space", "folder", "trick"].indexOf(raw.kind) === -1) return null;
    var L = SHARE_LIMITS, seen = {};
    function uniq(id){ id = _sStr(id, 40); if(!id || seen[id]) return null; seen[id] = true; return id; }
    function arr(a, max){ return Array.isArray(a) ? a.slice(0, max) : []; }
    var cats = [], infos = [], tricks = [], refs = [];
    arr(raw.cats, L.cats).forEach(function(c){
      var id = c && uniq(c.id); if(!id) return;
      cats.push({ id: id, parentId: c.parentId == null ? null : _sStr(c.parentId, 40), name: _sName(c.name),
        order: _sNum(c.order), icon: _sIcon(c.icon), color: _sStr(c.color, 24) || "default" });
    });
    arr(raw.tricks, L.tricks).forEach(function(tr){
      var id = tr && uniq(tr.id); if(!id) return;
      var o = shareTrickOut(Object.assign({}, tr, { id: id }));
      o.placements = arr(tr.placements, 20).filter(function(p){ return p && typeof p === "object"; })
        .map(function(p){ return { c: p.c == null ? null : _sStr(p.c, 40), o: typeof p.o === "number" && isFinite(p.o) ? p.o : null }; });
      tricks.push(o);
    });
    arr(raw.infos, L.infos).forEach(function(n){
      var id = n && uniq(n.id); if(!id) return;
      infos.push({ id: id, parentId: n.parentId == null ? null : _sStr(n.parentId, 40), title: _sName(n.title), content: _sStr(n.content, L.text),
        order: _sNum(n.order), icon: _sIcon(n.icon), color: _sStr(n.color, 24) || "default" });
    });
    arr(raw.refs, L.refs).forEach(function(r){
      if(!r || typeof r.trickId !== "string") return;
      refs.push({ trickId: _sStr(r.trickId, 40), c: r.c == null ? null : _sStr(r.c, 40), o: typeof r.o === "number" && isFinite(r.o) ? r.o : null });
    });
    var out = { v: SHARE_VERSION, kind: raw.kind, name: _sName(raw.name), icon: _sIcon(raw.icon), color: _sStr(raw.color, 24) || "default",
      cats: cats, infos: infos, tricks: tricks, refs: refs };
    if(raw.kind === "trick"){
      out.cats = []; out.infos = []; out.refs = [];
      out.tricks = tricks.slice(0, 1).map(function(o){ o.placements = []; return o; });
      return out.tricks.length ? out : null;
    }
    // levels: container id -> level (0 = table root); -1 = unresolvable / cyclic
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
    function fits(parent, maxLevel){ var p = lv(parent, 0); return p >= 0 && p + 1 <= maxLevel; }
    out.cats = cats.filter(function(c){ return fits(c.parentId, MAX_FOLDER_LEVEL); });
    out.infos = infos.filter(function(n){ return fits(n.parentId, MAX_ITEM_LEVEL); });
    out.tricks = tricks.filter(function(tr){
      tr.placements = tr.placements.filter(function(p){ return fits(p.c, MAX_ITEM_LEVEL); });
      return tr.placements.length > 0;
    });
    out.refs = refs.filter(function(r){ return fits(r.c, MAX_ITEM_LEVEL); });
    return out;
  }

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
  function shareCounts(p){
    var folders = p.cats.length;
    return { folders: folders, tricks: p.tricks.length + p.refs.length, infos: p.infos.length };
  }

  /* ---------------- pure: remap to fresh ids ---------------- */
  // Returns records ready to push. hasTrick(id) says whether a referenced base trick exists locally.
  // targetSpaceId: table that receives the root-level items (folder/space kinds).
  function shareRemap(p, idGen, targetSpaceId, hasTrick){
    var map = {};
    p.cats.forEach(function(c){ map[c.id] = idGen(); });
    p.tricks.forEach(function(tr){ map[tr.id] = idGen(); });
    function dest(c){ return c == null ? targetSpaceId : map[c]; }
    var cats = p.cats.map(function(c){
      return { id: map[c.id], parentId: c.parentId == null ? null : map[c.parentId], name: c.name, order: c.order, icon: c.icon, color: c.color, spaceId: targetSpaceId };
    });
    var infos = p.infos.map(function(n){
      return { id: idGen(), parentId: n.parentId == null ? null : map[n.parentId], spaceId: targetSpaceId, title: n.title, content: n.content,
        order: n.order, icon: n.icon, color: n.color };
    });
    var isTrick = p.kind === "trick";
    var tricks = p.tricks.map(function(tr){
      var ids = [], obc = {};
      if(isTrick) ids.push(FAV_CUSTOM_ID);
      tr.placements.forEach(function(pl){
        var d = dest(pl.c);
        if(!d || ids.indexOf(d) !== -1) return;
        ids.push(d);
        if(pl.o !== null) obc[d] = pl.o;
      });
      return { id: map[tr.id], name: tr.name, media: tr.media.map(function(m){ return { id: idGen(), type: "video", title: m.title, url: m.url }; }),
        categoryIds: ids, orderByCategory: obc, order: tr.order, icon: tr.icon, color: tr.color, grip: tr.grip, parts: tr.parts,
        officialNote: tr.officialNote, custom: isTrick };
    });
    var refs = p.refs.filter(function(r){ return hasTrick(r.trickId) && dest(r.c); })
      .map(function(r){ return { trickId: r.trickId, containerId: dest(r.c), order: r.o }; });
    return { cats: cats, infos: infos, tricks: tricks, refs: refs };
  }

  /* ---------------- add to db ---------------- */
  // Returns { ok:true, spaceId|null } or { ok:false, err:<i18n key> }.
  function shareApply(payload){
    var p = shareSanitizePayload(payload);
    if(!p) return { ok: false, err: "shareLoadFailed" };
    if(typeof undoPush === "function") undoPush();
    var spaceId = null, rec;
    if(p.kind === "trick"){
      rec = shareRemap(p, newItemId, FAV_TABLE_ID, function(){ return false; });
    } else {
      if(!canAddCustomSpace()) return { ok: false, err: "shareTableLimit" };
      var sp = createSpace({ icon: p.icon || "🗂️", name: p.name });
      if(!sp) return { ok: false, err: "shareTableLimit" };
      spaceId = sp.id;
      rec = shareRemap(p, newItemId, spaceId, function(id){ return !!getTrick(id); });
    }
    rec.cats.forEach(function(c){ db.categories.push(c); });
    if(!db.infos) db.infos = [];
    rec.infos.forEach(function(n){ db.infos.push(n); });
    normalizeDB({ categories: [], tricks: rec.tricks }).tricks.forEach(function(tr){ db.tricks.push(tr); });
    rec.refs.forEach(function(r){
      var tr = getTrick(r.trickId);
      if(!tr) return;
      if(tr.categoryIds.indexOf(r.containerId) === -1) tr.categoryIds.push(r.containerId);
      if(r.order !== null){ tr.orderByCategory = tr.orderByCategory || {}; tr.orderByCategory[r.containerId] = r.order; }
    });
    saveDB();
    return { ok: true, spaceId: spaceId };
  }

  /* ---------------- send (DOM + Firestore) ---------------- */
  function shareCopyLink(url, title){
    if(typeof navigator !== "undefined" && navigator.share && /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent || "")){
      return navigator.share({ title: title, url: url }).catch(function(e){
        if(e && e.name === "AbortError") return;
        return shareCopyText(url);
      });
    }
    return shareCopyText(url);
  }
  function shareCopyText(url){
    var done = function(){ showToast(t("shareLinkCopied")); };
    if(navigator.clipboard && navigator.clipboard.writeText){
      return navigator.clipboard.writeText(url).then(done, function(){ window.prompt(t("shareLinkIs"), url); });
    }
    window.prompt(t("shareLinkIs"), url);
    return Promise.resolve();
  }

  // kind: "space" | "folder" | "trick"; id: table / category / trick id.
  function shareRun(kind, id){
    if(isGuest() || !authCurrentUser){ showToast(t("shareNeedLogin"), "error"); return Promise.resolve(false); }
    var built = kind === "trick" ? shareBuildTrickPayload(id) : shareBuildFolderPayload(kind, id);
    var p = built && shareSanitizePayload(built);
    if(!p) { showToast(t("shareEmpty"), "error"); return Promise.resolve(false); }
    var json = shareSerialize(p);
    if(json === null){ showToast(t("shareTooBig"), "error"); return Promise.resolve(false); }
    var title = shareTitleOf(p);
    var ref = fbStore.collection("shares").doc();
    showToast(t("shareWorking"));
    return ref.set({ ownerUid: authCurrentUser.uid, createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      kind: kind === "trick" ? "trick" : "folder", title: title, payload: json, v: SHARE_VERSION })
      .then(function(){ return shareCopyLink(shareUrlFor(ref.id), title); })
      .then(function(){ return true; })
      .catch(function(err){ console.error("share failed:", err); showToast(t("shareFailed"), "error"); return false; });
  }

  /* ---------------- receive: preview modal ---------------- */
  var _shareDoc = null; // { id, payload } while the preview is open

  function shareEnsureModal(){
    var ov = document.getElementById("shareOverlay");
    if(ov) return ov;
    ov = document.createElement("div");
    ov.className = "modal-overlay";
    ov.id = "shareOverlay";
    ov.innerHTML = '<div class="modal modal-lg share-modal"><div class="settings-head"><div class="modal-title"></div>' +
      '<button type="button" class="icon-btn settings-close" data-close="1"></button></div>' +
      '<div class="modal-scroll"></div><div class="modal-footer"><div class="modal-actions">' +
      '<button type="button" class="btn btn-ghost" data-close="1"></button>' +
      '<button type="button" class="btn btn-primary" id="shareAddBtn"></button></div></div></div>';
    var ref = document.getElementById("confirmOverlay");
    if(ref && ref.parentNode) ref.parentNode.insertBefore(ov, ref); else document.body.appendChild(ov);
    ov.querySelector(".settings-close").innerHTML = ICON_X;
    ov.addEventListener("click", function(ev){
      if(ev.target === ov || ev.target.closest("[data-close]")) shareCloseModal();
    });
    ov.querySelector("#shareAddBtn").addEventListener("click", shareOnAddClick);
    return ov;
  }
  function shareCloseModal(){
    var ov = document.getElementById("shareOverlay");
    if(ov) ov.classList.remove("show");
    _shareDoc = null;
  }
  function shareRefreshAddBtn(){
    var b = document.getElementById("shareAddBtn");
    if(b) b.textContent = t(isGuest() ? "shareAddLogin" : "shareAdd");
  }
  // Called by js/59 once the login has settled (so the pending add lands on the synced data).
  function shareOnAuth(){ if(_shareDoc) shareRefreshAddBtn(); }

  function shareOnAddClick(){
    if(!_shareDoc) return;
    if(isGuest() || !authCurrentUser){
      showToast(t("shareSigningIn"));
      if(typeof authLogin === "function") authLogin();
      return;
    }
    var res = shareApply(_shareDoc.payload);
    if(!res.ok){ showToast(t(res.err), "error"); return; }
    shareCloseModal();
    state.activeSpace = res.spaceId || FAV_TABLE_ID;
    try{ localStorage.setItem(SPACE_KEY, state.activeSpace); }catch(e){ /* ignore */ }
    state.path = []; state.detailTrickId = null;
    showToast(t("shareAdded"));
    render();
  }

  function shareOpenPreview(id, payload){
    _shareDoc = { id: id, payload: payload };
    var ov = shareEnsureModal();
    var c = shareCounts(payload);
    var nm = shareTitleOf(payload) || (payload.tricks[0] ? localize(payload.tricks[0].name) : "");
    var rows = [];
    payload.cats.filter(function(x){ return x.parentId == null; }).forEach(function(x){ rows.push(ICON_FOLDER + "<span>" + escapeHtml(localize(x.name)) + "</span>"); });
    payload.tricks.forEach(function(x){ rows.push("<span>" + escapeHtml(localize(x.name)) + "</span>"); });
    var shown = rows.slice(0, 12).map(function(r){ return '<div class="share-row">' + r + "</div>"; }).join("");
    if(rows.length > 12) shown += '<div class="share-row share-more">' + escapeHtml(t("shareMore")) + "</div>";
    var counts = payload.kind === "trick" ? "" :
      c.folders + " " + t("shareCountFolders") + " · " + c.tricks + " " + t("shareCountTricks") + " · " + c.infos + " " + t("shareCountInfos");
    ov.querySelector(".modal-title").textContent = t("shareModalTitle");
    ov.querySelector(".modal-scroll").innerHTML = '<div class="share-name">' + escapeHtml(nm) + '</div>' +
      '<div class="modal-sub">' + escapeHtml(t(payload.kind === "trick" ? "shareKindTrick" : "shareKindFolder")) +
      (counts ? " · " + escapeHtml(counts) : "") + '</div><div class="share-list">' + shown + "</div>";
    ov.querySelector(".btn-ghost").textContent = t("shareCancel");
    shareRefreshAddBtn();
    ov.classList.add("show");
  }

  // Fetches shares/{id} and opens the preview. Always strips ?share from the URL.
  function shareOpenFromUrl(){
    if(typeof location === "undefined") return;
    var id = shareParseId(location.search);
    if(!id) return;
    try{
      var u = new URL(location.href);
      u.searchParams.delete("share");
      history.replaceState(null, "", u.pathname + (u.search || "") + u.hash);
    }catch(e){ /* ignore */ }
    fbStore.collection("shares").doc(id).get().then(function(snap){
      var d = snap.exists ? snap.data() : null;
      var payload = null;
      if(d && typeof d.payload === "string" && d.payload.length <= SHARE_MAX_BYTES){
        try{ payload = shareSanitizePayload(JSON.parse(d.payload)); }catch(e){ payload = null; }
      }
      if(!payload) return showToast(t("shareLoadFailed"), "error");
      shareOpenPreview(id, payload);
    }).catch(function(err){ console.error("share load failed:", err); showToast(t("shareLoadFailed"), "error"); });
  }
  // After all scripts ran (init in 90 renders first).
  if(typeof location !== "undefined" && typeof setTimeout === "function") setTimeout(shareOpenFromUrl, 0);
