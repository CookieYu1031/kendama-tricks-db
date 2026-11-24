"use strict";

  /* ============================================================
     INFO IMAGE (v0.17) — one admin-added picture per info item.
     The record only keeps info.image = { id, w, h, size }; the pixels live in the immutable
     Firestore doc infoImages/{id} = { data: "data:image/...;base64,...", by, createdAt }, fetched only
     when the info is opened (memory LRU -> Cache Storage -> one Firestore get).
     Pure logic first (plan / usage / validation), DOM + Firestore glue below.
  ============================================================ */
  addStrings({
    zh:{ infoImgAdd:"加入圖片", infoImgReplace:"更換圖片", infoImgAlt:"資訊圖片", infoImgFail:"圖片載入失敗，點擊重試",
         infoImgHint:"最長 {px}px，自動壓縮至 {kb} KB 內；全部圖片合計上限 {total} MB（目前 {used} KB）",
         infoImgBusy:"處理中…", infoImgReadFail:"無法讀取這張圖片", infoImgTooBig:"圖片壓縮後仍超過 {kb} KB，請換一張",
         infoImgTotalFull:"全部資訊圖片已達 {total} MB 上限，請先移除舊圖片", infoImgNoPerm:"只有管理員可以加入圖片",
         infoImgUploadFail:"圖片上傳失敗，請稍後再試", infoImgClose:"關閉" },
    jp:{ infoImgAdd:"画像を追加", infoImgReplace:"画像を変更", infoImgAlt:"情報の画像", infoImgFail:"画像を読み込めません。タップで再試行",
         infoImgHint:"最長辺 {px}px、自動で {kb} KB 以内に圧縮。全画像の合計上限 {total} MB（現在 {used} KB）",
         infoImgBusy:"処理中…", infoImgReadFail:"この画像を読み込めません", infoImgTooBig:"圧縮しても {kb} KB を超えます。別の画像にしてください",
         infoImgTotalFull:"全画像の合計が {total} MB の上限です。先に古い画像を削除してください", infoImgNoPerm:"管理者のみ画像を追加できます",
         infoImgUploadFail:"画像のアップロードに失敗しました。後でもう一度お試しください", infoImgClose:"閉じる" },
    en:{ infoImgAdd:"Add image", infoImgReplace:"Change image", infoImgAlt:"Info image", infoImgFail:"Couldn't load the image. Tap to retry",
         infoImgHint:"Longest side {px}px, auto-compressed to under {kb} KB; all images together max {total} MB (now {used} KB)",
         infoImgBusy:"Working…", infoImgReadFail:"Can't read this image", infoImgTooBig:"Still over {kb} KB after compression. Pick another image",
         infoImgTotalFull:"All info images reached the {total} MB limit. Remove an old image first", infoImgNoPerm:"Only admins can add images",
         infoImgUploadFail:"Image upload failed. Try again later", infoImgClose:"Close" }
  });

  var INFO_IMG = {
    MAX_PX: 1000, MIN_PX: 480, SHRINK: 0.85, MAX_BYTES: 102400, TOTAL_MAX: 1048576, MAX_CHARS: 150000,
    QUALITIES: [0.82, 0.7, 0.58, 0.46, 0.36], MEM_MAX: 12, CACHE: "kdb-info-img-v1", URL_PREFIX: "/__info-img/"
  };
  var INFO_IMG_ID_RE = /^[0-9A-Za-z_-]{1,40}$/;
  var INFO_IMG_DATA_RE = /^data:image\/(webp|jpeg|png);base64,[A-Za-z0-9+\/=]+$/;

  /* ---------------- pure ---------------- */
  function infoImageErr(key, msg){ var e = new Error(msg || key); e.key = key; return e; }
  function infoImageAllowed(){
    return typeof isAdminAccount === "function" && isAdminAccount() && typeof authCurrentUser !== "undefined" && !!authCurrentUser;
  }
  // Scaled size keeping aspect so the longer side is at most max (never upscales).
  function infoImageFit(w, h, max){
    var k = Math.min(1, max / Math.max(w, h));
    return { w: Math.max(1, Math.round(w * k)), h: Math.max(1, Math.round(h * k)) };
  }
  // Attempt sequence: sizes (longest side 1000, then x0.85 down to MIN_PX) x qualities (high -> low).
  function infoImagePlan(w, h){
    var first = infoImageFit(w, h, INFO_IMG.MAX_PX);
    var longest = Math.max(first.w, first.h), floor = Math.min(INFO_IMG.MIN_PX, longest);
    var sizes = [first], L = longest;
    while(L > floor){
      var nl = Math.max(floor, Math.floor(L * INFO_IMG.SHRINK));
      if(nl >= L) break;
      L = nl;
      sizes.push(infoImageFit(w, h, L));
    }
    var out = [];
    sizes.forEach(function(s){ INFO_IMG.QUALITIES.forEach(function(q){ out.push({ w: s.w, h: s.h, q: q }); }); });
    return out;
  }
  // Binary size of a base64 data URL.
  function infoImageBytes(dataUrl){
    var i = String(dataUrl).indexOf(",");
    if(i < 0) return 0;
    var b = String(dataUrl).slice(i + 1), pad = b.slice(-2) === "==" ? 2 : b.slice(-1) === "=" ? 1 : 0;
    return Math.floor(b.length * 3 / 4) - pad;
  }
  function infoImageValidData(s){
    return typeof s === "string" && s.length <= INFO_IMG.MAX_CHARS && INFO_IMG_DATA_RE.test(s);
  }
  // Sum of size over distinct image ids in infos; the info `except` (object or id) is left out,
  // so a replaced picture is only counted when another info still uses the same id.
  function infoImageUsage(infos, exceptInfoOrId){
    var ex = exceptInfoOrId && typeof exceptInfoOrId === "object" ? exceptInfoOrId.id : exceptInfoOrId;
    var seen = {}, sum = 0;
    (infos || []).forEach(function(n){
      if(!n || !n.image || n === exceptInfoOrId || (ex != null && n.id === ex)) return;
      if(seen[n.image.id]) return;
      seen[n.image.id] = 1;
      sum += n.image.size || 0;
    });
    return sum;
  }
  function infoImageFits(infos, exceptInfoOrId, addSize){
    return infoImageUsage(infos, exceptInfoOrId) + addSize <= INFO_IMG.TOTAL_MAX;
  }
  function infoImageNewId(){
    var base = typeof newItemId === "function" ? String(newItemId()) : "img";
    var id = (base + Math.random().toString(36).slice(2, 6)).replace(/[^0-9A-Za-z_-]/g, "");
    return id.slice(-40) || ("img" + Date.now().toString(36));
  }
  function infoImageDbInfos(){ return (typeof db !== "undefined" && db && db.infos) || []; }
  function infoImageFmt(key, o){
    var s = t(key);
    Object.keys(o || {}).forEach(function(k){ s = s.replace("{" + k + "}", o[k]); });
    return s;
  }
  function infoImageErrText(e){
    var k = e && e.key;
    if(k === "infoImgTooBig") return infoImageFmt(k, { kb: INFO_IMG.MAX_BYTES / 1024 });
    if(k === "infoImgTotalFull") return infoImageFmt(k, { total: INFO_IMG.TOTAL_MAX / 1048576 });
    return t(k || "infoImgUploadFail");
  }

  /* ---------------- encode ---------------- */
  var infoImageWebp = null; // does this browser's canvas encode webp?
  function infoImageDraw(img, p, jpeg){
    var cv = document.createElement("canvas");
    cv.width = p.w; cv.height = p.h;
    var cx = cv.getContext("2d");
    if(jpeg){ cx.fillStyle = "#fff"; cx.fillRect(0, 0, p.w, p.h); }
    cx.drawImage(img, 0, 0, p.w, p.h);
    return cv;
  }
  // file -> Promise<{ dataUrl, w, h, size }>; rejects with Error whose .key is an i18n key.
  function infoImageEncode(file){
    return new Promise(function(resolve, reject){
      if(!file || typeof URL === "undefined" || !URL.createObjectURL) return reject(infoImageErr("infoImgReadFail"));
      var url = URL.createObjectURL(file), img = new Image();
      function done(){ try{ URL.revokeObjectURL(url); }catch(e){} }
      img.onerror = function(){ done(); reject(infoImageErr("infoImgReadFail")); };
      img.onload = function(){
        try{
          var w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
          if(!w || !h){ done(); return reject(infoImageErr("infoImgReadFail")); }
          if(infoImageWebp === null){
            var probe = document.createElement("canvas"); probe.width = probe.height = 1;
            infoImageWebp = probe.toDataURL("image/webp", 0.8).indexOf("data:image/webp") === 0;
          }
          var plan = infoImagePlan(w, h), cv = null, last = null;
          for(var i = 0; i < plan.length; i++){
            var p = plan[i];
            if(!cv || last.w !== p.w || last.h !== p.h) cv = infoImageDraw(img, p, !infoImageWebp);
            last = p;
            var data = cv.toDataURL(infoImageWebp ? "image/webp" : "image/jpeg", p.q), bytes = infoImageBytes(data);
            if(bytes <= INFO_IMG.MAX_BYTES && infoImageValidData(data)){
              done();
              return resolve({ dataUrl: data, w: p.w, h: p.h, size: bytes });
            }
          }
          done(); reject(infoImageErr("infoImgTooBig"));
        }catch(e){ done(); reject(infoImageErr("infoImgReadFail")); }
      };
      img.src = url;
    });
  }

  /* ---------------- Firestore + cache ---------------- */
  var infoImageMem = new Map();   // id -> dataUrl, insertion order = LRU order
  var infoImagePending = {};      // id -> in-flight Promise
  function infoImageMemGet(id){
    if(!infoImageMem.has(id)) return null;
    var v = infoImageMem.get(id);
    infoImageMem.delete(id); infoImageMem.set(id, v);
    return v;
  }
  function infoImageMemPut(id, v){
    infoImageMem.delete(id); infoImageMem.set(id, v);
    while(infoImageMem.size > INFO_IMG.MEM_MAX) infoImageMem.delete(infoImageMem.keys().next().value);
  }
  function infoImageCacheGet(id){
    try{
      if(typeof caches === "undefined" || !caches) return Promise.resolve(null);
      return caches.open(INFO_IMG.CACHE).then(function(c){ return c.match(INFO_IMG.URL_PREFIX + id); })
        .then(function(r){ return r ? r.text() : null; }).catch(function(){ return null; });
    }catch(e){ return Promise.resolve(null); }
  }
  function infoImageCachePut(id, dataUrl){
    try{
      if(typeof caches === "undefined" || !caches || typeof Response === "undefined") return;
      caches.open(INFO_IMG.CACHE).then(function(c){
        return c.put(INFO_IMG.URL_PREFIX + id, new Response(dataUrl, { headers: { "Content-Type": "text/plain" } }));
      }).catch(function(){});
    }catch(e){}
  }
  // id -> Promise<dataUrl|null>. Failures (offline, missing doc, bad data) resolve null and are not cached.
  function infoImageLoad(id){
    if(typeof id !== "string" || !INFO_IMG_ID_RE.test(id)) return Promise.resolve(null);
    var hit = infoImageMemGet(id);
    if(hit) return Promise.resolve(hit);
    if(infoImagePending[id]) return infoImagePending[id];
    var p = infoImageCacheGet(id).then(function(c){
      if(infoImageValidData(c)){ infoImageMemPut(id, c); return c; }
      if(typeof fbStore === "undefined" || !fbStore) return null;
      return fbStore.collection("infoImages").doc(id).get().then(function(snap){
        var d = snap && snap.exists ? snap.data() : null;
        var s = d && d.data;
        if(!infoImageValidData(s)) return null;
        infoImageMemPut(id, s); infoImageCachePut(id, s);
        return s;
      });
    }).catch(function(){ return null; }).then(function(v){ delete infoImagePending[id]; return v; });
    infoImagePending[id] = p;
    return p;
  }
  // enc from infoImageEncode -> Promise<{ id, w, h, size }>. exceptInfo = the info being edited (its old picture is not counted).
  function infoImageUpload(enc, exceptInfo){
    if(!infoImageAllowed()) return Promise.reject(infoImageErr("infoImgNoPerm"));
    if(!enc || !infoImageValidData(enc.dataUrl)) return Promise.reject(infoImageErr("infoImgReadFail"));
    if(!infoImageFits(infoImageDbInfos(), exceptInfo, enc.size)) return Promise.reject(infoImageErr("infoImgTotalFull"));
    var id = infoImageNewId();
    return fbStore.collection("infoImages").doc(id).set({
      data: enc.dataUrl, by: authCurrentUser.uid, createdAt: firebase.firestore.FieldValue.serverTimestamp()
    }).then(function(){
      infoImageMemPut(id, enc.dataUrl); infoImageCachePut(id, enc.dataUrl);
      return { id: id, w: enc.w, h: enc.h, size: enc.size };
    }, function(){ throw infoImageErr("infoImgUploadFail"); });
  }

  /* ---------------- view + lightbox ---------------- */
  function infoImgEl(tag, cls){ var e = document.createElement(tag); if(cls) e.className = cls; return e; }

  var infoLbOverlay = null, infoLbKey = null;
  function infoImageCloseLightbox(){
    if(infoLbKey){ document.removeEventListener("keydown", infoLbKey, true); infoLbKey = null; }
    var o = infoLbOverlay; infoLbOverlay = null;
    if(!o) return;
    o.classList.remove("show");
    setTimeout(function(){ if(o.parentNode) o.parentNode.removeChild(o); }, 240);
  }
  function infoImageOpenLightbox(dataUrl, alt){
    if(infoLbOverlay) infoImageCloseLightbox();
    var ov = infoImgEl("div", "modal-overlay info-lb");
    var scroll = infoImgEl("div", "info-lb-scroll");
    var im = infoImgEl("img", "info-lb-img");
    im.src = dataUrl; im.alt = alt || "";
    im.addEventListener("click", function(ev){ ev.stopPropagation(); im.classList.toggle("actual"); });
    scroll.appendChild(im);
    var x = infoImgEl("button", "icon-btn info-lb-close");
    x.type = "button"; x.innerHTML = ICON_X; x.setAttribute("aria-label", t("infoImgClose"));
    x.addEventListener("click", function(ev){ ev.stopPropagation(); infoImageCloseLightbox(); });
    ov.addEventListener("click", function(ev){ if(ev.target !== im && ev.target !== x) infoImageCloseLightbox(); });
    ov.appendChild(scroll); ov.appendChild(x);
    document.body.appendChild(ov);
    infoLbOverlay = ov;
    infoLbKey = function(ev){
      if(ev.key !== "Escape") return;
      ev.stopImmediatePropagation(); ev.preventDefault();
      infoImageCloseLightbox();
    };
    document.addEventListener("keydown", infoLbKey, true);
    setTimeout(function(){ ov.classList.add("show"); }, 10);
  }

  // image = { id, w, h, size } -> element; reserves the aspect ratio so nothing jumps when it loads.
  function buildInfoImageView(image){
    var fig = infoImgEl("figure", "info-img is-loading");
    if(!image || !image.id) return fig;
    fig.style.aspectRatio = image.w + " / " + image.h;
    fig.style.maxWidth = image.w + "px";
    function show(){
      fig.className = "info-img is-loading";
      fig.innerHTML = "";
      infoImageLoad(image.id).then(function(url){
        fig.innerHTML = "";
        if(!url){
          fig.className = "info-img is-error";
          var b = infoImgEl("button", "info-img-retry");
          b.type = "button"; b.textContent = t("infoImgFail");
          b.addEventListener("click", show);
          fig.appendChild(b);
          return;
        }
        fig.className = "info-img";
        var im = infoImgEl("img");
        im.src = url; im.alt = t("infoImgAlt"); im.draggable = false;
        im.addEventListener("click", function(){ infoImageOpenLightbox(url, t("infoImgAlt")); });
        fig.appendChild(im);
      }).catch(function(){});
    }
    show();
    return fig;
  }

  /* ---------------- editor ---------------- */
  // opts: { image, deferred, onChange, info }. info (optional) = the info record, so replacing its own
  // picture does not count twice against the total. deferred: choosing only compresses + previews;
  // el.hasDraft() / el.commit() -> Promise<image|null> uploads it later. Otherwise upload right away.
  function buildInfoImageEditor(opts){
    opts = opts || {};
    var image = opts.image || null, draft = null, busy = false, errMsg = "";
    var el = infoImgEl("div", "info-img-editor");
    var input = infoImgEl("input"); input.type = "file"; input.accept = "image/*"; input.hidden = true;
    function exceptInfo(){
      if(opts.info) return opts.info;
      if(!image) return null;
      var users = infoImageDbInfos().filter(function(n){ return n.image && n.image.id === image.id; });
      return users.length === 1 ? users[0] : null;
    }
    function hintText(){
      return infoImageFmt("infoImgHint", { px: INFO_IMG.MAX_PX, kb: INFO_IMG.MAX_BYTES / 1024,
        total: INFO_IMG.TOTAL_MAX / 1048576, used: Math.round(infoImageUsage(infoImageDbInfos(), null) / 1024) });
    }
    function render(){
      el.innerHTML = "";
      if(draft || image){
        var prev = infoImgEl("div", "info-img-prev");
        if(draft){
          var di = infoImgEl("img"); di.src = draft.dataUrl; di.alt = t("infoImgAlt");
          prev.appendChild(di);
        } else prev.appendChild(buildInfoImageView(image));
        el.appendChild(prev);
      }
      var row = infoImgEl("div", "info-img-actions");
      var pick = infoImgEl("button", "btn btn-sm"); pick.type = "button";
      pick.textContent = busy ? t("infoImgBusy") : t(draft || image ? "infoImgReplace" : "infoImgAdd");
      pick.disabled = busy;
      pick.addEventListener("click", function(){ input.value = ""; input.click(); });
      row.appendChild(pick);
      if(draft || image){
        var rm = infoImgEl("button", "col-add-btn col-add-btn-danger col-add-btn-del"); rm.type = "button";
        rm.innerHTML = removeBtnHtml(); rm.disabled = busy;
        rm.addEventListener("click", function(){
          errMsg = "";
          if(draft){ draft = null; render(); return; }
          image = null; render();
          if(opts.onChange) opts.onChange(null);
        });
        row.appendChild(rm);
      }
      el.appendChild(row);
      var err = infoImgEl("div", "form-error info-img-error" + (errMsg ? " show" : ""));
      err.textContent = errMsg;
      el.appendChild(err);
      var hint = infoImgEl("div", "info-img-hint"); hint.textContent = hintText();
      el.appendChild(hint);
      el.appendChild(input);
    }
    function fail(e){ busy = false; errMsg = infoImageErrText(e); render(); }
    input.addEventListener("change", function(){
      var f = input.files && input.files[0];
      if(!f) return;
      errMsg = ""; busy = true; render();
      infoImageEncode(f).then(function(enc){
        if(!infoImageFits(infoImageDbInfos(), exceptInfo(), enc.size)) throw infoImageErr("infoImgTotalFull");
        if(opts.deferred){ draft = enc; busy = false; render(); return; }
        return infoImageUpload(enc, exceptInfo()).then(function(img){
          image = img; busy = false; render();
          if(opts.onChange) opts.onChange(img);
        });
      }).catch(fail);
    });
    el.hasDraft = function(){ return !!draft; };
    el.commit = function(){
      if(!draft) return Promise.resolve(null);
      busy = true; render();
      return infoImageUpload(draft, exceptInfo()).then(function(img){
        draft = null; image = img; busy = false; render();
        return img;
      }, function(e){
        fail(e);
        if(typeof showToast === "function") showToast(infoImageErrText(e), "error");
        throw e;
      });
    };
    render();
    return el;
  }
