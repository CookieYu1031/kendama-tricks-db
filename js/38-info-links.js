"use strict";

  /* ============================================================
     INFO LINKS (v0.17.2) — up to 3 http(s) links on an info item (info.links = [{url,title}]).
     View: real <a target=_blank> slots. Edit: same slot look as the video slots; a slot opens
     a small dialog (url + optional title <= 12 chars). Pure logic first (tests/drawer/info-links.test.js).
  ============================================================ */
  addStrings({
    zh: { infoLinkSection:"連結", infoLinkAdd:"連結", infoLinkDialogAdd:"新增連結", infoLinkDialogEdit:"編輯連結",
      infoLinkUrlLabel:"網址", infoLinkTitleLabel:"名稱（選填，最多 12 字）", infoLinkTitlePlaceholder:"沒填會顯示網站網域",
      infoLinkEmpty:"請輸入網址", infoLinkInvalid:"網址無效：只接受 http／https 連結", infoLinkTooLong:"網址過長：最多 500 字",
      infoLinkTitleTooLong:"名稱過長：最多 12 個字", infoLinkFull:"最多 3 個連結" },
    jp: { infoLinkSection:"リンク", infoLinkAdd:"リンク", infoLinkDialogAdd:"リンクを追加", infoLinkDialogEdit:"リンクを編集",
      infoLinkUrlLabel:"URL", infoLinkTitleLabel:"名前（任意・12文字まで）", infoLinkTitlePlaceholder:"空欄ならドメインを表示",
      infoLinkEmpty:"URL を入力してください", infoLinkInvalid:"URL が無効です：http／https のみ使えます", infoLinkTooLong:"URL が長すぎます：500文字まで",
      infoLinkTitleTooLong:"名前が長すぎます：12文字まで", infoLinkFull:"リンクは3つまで" },
    en: { infoLinkSection:"Links", infoLinkAdd:"Link", infoLinkDialogAdd:"Add link", infoLinkDialogEdit:"Edit link",
      infoLinkUrlLabel:"URL", infoLinkTitleLabel:"Name (optional, max 12 characters)", infoLinkTitlePlaceholder:"Shows the site domain if empty",
      infoLinkEmpty:"Enter a URL", infoLinkInvalid:"Invalid URL: only http / https links are accepted", infoLinkTooLong:"URL too long: 500 characters max",
      infoLinkTitleTooLong:"Name too long: 12 characters max", infoLinkFull:"Up to 3 links" }
  });

  // Limits come from js/01 (MAX_INFO_LINKS etc.); fall back so this file stays loadable alone.
  function infoLinkMax(){ return typeof MAX_INFO_LINKS === "number" ? MAX_INFO_LINKS : 3; }
  function infoLinkTitleMax(){ return typeof INFO_LINK_TITLE_MAX === "number" ? INFO_LINK_TITLE_MAX : 12; }
  function infoLinkUrlMax(){ return typeof INFO_LINK_URL_MAX === "number" ? INFO_LINK_URL_MAX : 500; }

  // Pasted text -> URL candidate. Adds https:// to scheme-less input (example.com/a); never turns
  // javascript: / data: / mailto: ... into something usable (they are returned as typed, so validation rejects them).
  function normalizeInfoLinkInput(raw){
    var s = String(raw == null ? "" : raw).trim();
    if(!s) return "";
    if(/^https?:\/\//i.test(s)) return s;
    if(/\s/.test(s)) return s;
    if(/^[a-z][a-z0-9+.\-]*:/i.test(s) && !/^[^\/?#:]+:\d+([\/?#]|$)/.test(s)) return s; // other scheme (host:port is not one)
    return "https://" + s.replace(/^\/\//, "");
  }

  // Slot text: the title, else the domain without "www.", else the raw url.
  function infoLinkLabel(link){
    var ti = link && link.title ? String(link.title).trim() : "";
    if(ti) return ti;
    var url = link && link.url ? String(link.url).trim() : "";
    try{ return new URL(url).hostname.replace(/^www\./i, "") || url; }catch(e){ return url; }
  }

  // Adds (idx null) or replaces (idx number) a link. Returns "ok" | "empty" | "invalid" | "tooLong" | "titleTooLong" | "full".
  function setInfoLink(info, idx, raw, title){
    var url = normalizeInfoLinkInput(raw);
    if(!url) return "empty";
    if(url.length > infoLinkUrlMax()) return "tooLong";
    if(!isSafeHttpUrl(url) || !normalizeInfoLinks([{ url: url, title: "" }]).length) return "invalid"; // must survive a reload
    var ti = String(title == null ? "" : title).trim();
    if(videoTitleLength(ti) > infoLinkTitleMax()) return "titleTooLong";
    var links = Array.isArray(info.links) ? info.links : [];
    if(idx === null || idx === undefined){
      if(links.length >= infoLinkMax()) return "full";
      links.push({ url: url, title: ti });
    } else {
      if(!links[idx]) return "invalid";
      links[idx] = { url: url, title: ti };
    }
    info.links = links;
    return "ok";
  }

  function removeInfoLink(info, idx){
    var links = Array.isArray(info.links) ? info.links : [];
    if(!links[idx]) return false;
    links.splice(idx, 1);
    if(links.length) info.links = links; else delete info.links;
    return true;
  }

  /* ---------- slots in the drawer ---------- */
  function buildInfoLinkSlot(info, link, idx, canEdit){
    var slot = document.createElement("div");
    slot.className = "vid-slot" + (link ? " filled" : " empty");
    if(link && !canEdit){
      var a = document.createElement("a");
      a.className = "vid-slot-main info-link-a";
      a.href = link.url; a.target = "_blank"; a.rel = "noopener noreferrer"; a.title = link.url;
      a.innerHTML = videoSourceIcon(link.url) + "<span>" + escapeHtml(infoLinkLabel(link)) + "</span>";
      slot.appendChild(a);
      return slot;
    }
    var main = document.createElement("button");
    main.type = "button"; main.className = "vid-slot-main";
    if(link){
      main.title = link.url;
      main.innerHTML = videoSourceIcon(link.url) + "<span>" + escapeHtml(infoLinkLabel(link)) + "</span>";
      main.addEventListener("click", function(){ openInfoLinkDialog(info.id, idx); });
    } else {
      main.innerHTML = ICON_PLUS + "<span>" + escapeHtml(t("infoLinkAdd")) + "</span>";
      main.addEventListener("click", function(){ openInfoLinkDialog(info.id, null); });
    }
    slot.appendChild(main);
    return slot;
  }

  // View: only filled, safe links (none -> nothing). Edit: fixed slots.
  function buildInfoLinkSlots(info, canEdit, parent){
    var links = (Array.isArray(info.links) ? info.links : []).filter(function(l){ return l && isSafeHttpUrl(l.url); });
    if(!canEdit && !links.length) return;
    parent.appendChild(makeLabel(t("infoLinkSection")));
    var grid = document.createElement("div");
    grid.className = "vid-slots info-link-slots";
    var all = Array.isArray(info.links) ? info.links : [];
    var n = canEdit ? infoLinkMax() : links.length;
    for(var i = 0; i < n; i++){
      var l = canEdit ? (all[i] || null) : links[i];
      grid.appendChild(buildInfoLinkSlot(info, l, i, canEdit));
    }
    parent.appendChild(grid);
  }

  /* ---------- edit dialog ---------- */
  var infoLinkCtx = { infoId: null, idx: null };

  function ensureInfoLinkOverlay(){
    var ov = document.getElementById("infoLinkOverlay");
    if(ov) return ov;
    ov = document.createElement("div");
    ov.className = "modal-overlay";
    ov.id = "infoLinkOverlay";
    ov.innerHTML =
      '<div class="modal" role="dialog" aria-modal="true">' +
        '<div class="modal-scroll">' +
          '<div class="modal-title"></div>' +
          '<div class="field"><label class="il-url-label"></label><input type="url" class="il-url" placeholder="https://..." autocomplete="off" /></div>' +
          '<div class="field"><label class="il-title-label"></label><input type="text" class="il-title" autocomplete="off" /></div>' +
          '<div class="form-error il-error"></div>' +
        '</div>' +
        '<div class="modal-footer"><div class="modal-actions-split">' +
          '<button type="button" class="col-add-btn col-add-btn-danger col-add-btn-del il-del" hidden></button>' +
          '<div style="display:flex; gap:10px; flex:1; justify-content:flex-end;">' +
            '<button type="button" class="btn btn-ghost il-cancel"></button>' +
            '<button type="button" class="btn btn-primary il-save"></button>' +
          '</div>' +
        '</div></div>' +
      '</div>';
    document.body.appendChild(ov);
    ov.addEventListener("click", function(ev){ if(ev.target === ov) closeInfoLinkDialog(); });
    ov.querySelector(".il-cancel").addEventListener("click", closeInfoLinkDialog);
    ov.querySelector(".il-save").addEventListener("click", saveInfoLinkDialog);
    ov.querySelector(".il-del").addEventListener("click", removeInfoLinkFromDialog);
    ov.addEventListener("keydown", function(ev){
      if(ev.key !== "Enter" || ev.isComposing || ev.keyCode === 229) return;
      if(ev.target.tagName !== "INPUT") return;
      ev.preventDefault();
      saveInfoLinkDialog();
    });
    // Esc closes just this dialog (capture + stop so js/90's handler does not also close the drawer).
    document.addEventListener("keydown", function(ev){
      if(ev.key !== "Escape" || !ov.classList.contains("show")) return;
      ev.stopImmediatePropagation();
      closeInfoLinkDialog();
    }, true);
    return ov;
  }

  function infoLinkIsOpen(){
    var ov = document.getElementById("infoLinkOverlay");
    return !!(ov && ov.classList.contains("show"));
  }

  function openInfoLinkDialog(infoId, idx){
    var info = getInfo(infoId);
    if(!infoDrawerCanEdit(info)) return;
    var link = idx !== null && info.links ? info.links[idx] : null;
    infoLinkCtx.infoId = infoId; infoLinkCtx.idx = link ? idx : null;
    var ov = ensureInfoLinkOverlay();
    ov.querySelector(".modal-title").textContent = t(link ? "infoLinkDialogEdit" : "infoLinkDialogAdd");
    ov.querySelector(".il-url-label").textContent = t("infoLinkUrlLabel");
    ov.querySelector(".il-title-label").textContent = t("infoLinkTitleLabel");
    var urlIn = ov.querySelector(".il-url"), tiIn = ov.querySelector(".il-title");
    urlIn.value = link ? link.url : "";
    tiIn.value = link ? (link.title || "") : "";
    tiIn.placeholder = t("infoLinkTitlePlaceholder");
    ov.querySelector(".il-cancel").textContent = t("cancel");
    ov.querySelector(".il-save").textContent = t("save");
    var del = ov.querySelector(".il-del");
    del.innerHTML = removeBtnHtml();
    del.hidden = !link;
    var err = ov.querySelector(".il-error");
    err.classList.remove("show"); err.textContent = "";
    ov.classList.add("show");
    setTimeout(function(){ urlIn.focus(); }, 0);
  }

  function closeInfoLinkDialog(){
    var ov = document.getElementById("infoLinkOverlay");
    if(ov) ov.classList.remove("show");
    infoLinkCtx.infoId = null; infoLinkCtx.idx = null;
  }

  function infoLinkErrorKey(code){
    return { empty:"infoLinkEmpty", invalid:"infoLinkInvalid", tooLong:"infoLinkTooLong", titleTooLong:"infoLinkTitleTooLong", full:"infoLinkFull" }[code] || "infoLinkInvalid";
  }

  function afterInfoLinkChange(){
    saveDB();
    if(typeof render === "function") render();
  }

  function saveInfoLinkDialog(){
    var ov = document.getElementById("infoLinkOverlay");
    if(!ov) return;
    var info = getInfo(infoLinkCtx.infoId); // re-read: undo / sync may have swapped the record
    if(!infoDrawerCanEdit(info)){ closeInfoLinkDialog(); return; }
    var raw = ov.querySelector(".il-url").value, ti = ov.querySelector(".il-title").value;
    var idx = infoLinkCtx.idx;
    var probe = { links: JSON.parse(JSON.stringify(info.links || [])) };
    var code = setInfoLink(probe, idx, raw, ti);
    if(code !== "ok"){
      var err = ov.querySelector(".il-error");
      err.textContent = t(infoLinkErrorKey(code)); err.classList.add("show");
      return;
    }
    if(typeof undoPush === "function") undoPush();
    setInfoLink(info, idx, raw, ti);
    closeInfoLinkDialog();
    afterInfoLinkChange();
  }

  function removeInfoLinkFromDialog(){
    var info = getInfo(infoLinkCtx.infoId);
    var idx = infoLinkCtx.idx;
    if(!infoDrawerCanEdit(info) || idx === null || !info.links || !info.links[idx]){ closeInfoLinkDialog(); return; }
    if(typeof undoPush === "function") undoPush();
    removeInfoLink(info, idx);
    closeInfoLinkDialog();
    afterInfoLinkChange();
  }
