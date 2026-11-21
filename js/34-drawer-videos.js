"use strict";

  /* ============================================================
     DRAWER VIDEOS — the three video slots of the trick drawer (v0.9.3).
     Each slot is a compact button: empty ("+ 影片" -> paste a link) or filled (source icon + site name; tap opens
     the video modal). The source site is detected from the URL (videoSourceOf, pure,
     tests/drawer-videos.test.js). Edit mode only: remove (x) and change-link buttons.
  ============================================================ */
  addStrings({
    zh:{ videoSrcOther:"連結", videoPasteLink:"貼上影片連結", videoEditLink:"更換連結", videoRemove:"移除影片" },
    jp:{ videoSrcOther:"リンク", videoPasteLink:"動画リンクを貼り付け", videoEditLink:"リンクを変更", videoRemove:"動画を削除" },
    en:{ videoSrcOther:"Link", videoPasteLink:"Paste a video link", videoEditLink:"Change link", videoRemove:"Remove video" }
  });

  function vidSvg(inner){
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' + inner + '</svg>';
  }
  var VIDEO_SOURCE_ICONS = {
    youtube: vidSvg('<rect x="2" y="5" width="20" height="14" rx="4"/><path d="M10 9l6 3-6 3V9z" fill="currentColor"/>'),
    instagram: vidSvg('<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.2" cy="6.8" r="1" fill="currentColor"/>'),
    facebook: vidSvg('<circle cx="12" cy="12" r="9"/><path d="M13.5 20v-7h2.4l.4-2.8h-2.8V8.6c0-.8.3-1.3 1.4-1.3h1.5V4.8c-.3 0-1.1-.1-2.1-.1-2.1 0-3.5 1.3-3.5 3.6v1.9H8.4V13h2.4v7"/>'),
    tiktok: vidSvg('<circle cx="12" cy="12" r="9"/><path d="M13 7v7.2a2.3 2.3 0 11-2-2.28"/><path d="M13 7c.3 1.6 1.5 2.8 3 3"/>'),
    twitter: vidSvg('<circle cx="12" cy="12" r="9"/><path d="M8 8l8 8M16 8l-8 8"/>'),
    threads: vidSvg('<circle cx="12" cy="12" r="9"/><path d="M15.6 10.6c-.4-1.9-1.7-2.9-3.6-2.9-2.2 0-3.6 1.6-3.6 4.3s1.4 4.3 3.6 4.3c1.9 0 3.3-1.1 3.3-2.7 0-1.7-1.6-2.4-3.3-2.4-1.1 0-2 .4-2 1.2"/>'),
    drive: vidSvg('<path d="M9 4h6l6 10.5h-6L9 4zM9 4L3 14.5 6 20h12l3-5.5M6 20l3-5.5h12"/>'),
    vimeo: vidSvg('<circle cx="12" cy="12" r="9"/><path d="M8 11.2l1.2-1c1.5-1.1 2.4-.3 2.7 1.2l.8 4.2c.4 1.6 1.3 1.6 2.4.5l2.2-2.4"/>'),
    other: vidSvg('<path d="M9 15l6-6M10 6l1-1a4 4 0 015.7 5.7l-1.4 1.4M14 18l-1 1A4 4 0 016 13.3l1.4-1.4"/>')
  };

  // URL -> "youtube" | "instagram" | "facebook" | "tiktok" | "twitter" | "threads" | "drive" | "vimeo" | "other".
  function videoSourceOf(url){
    var host;
    try{ host = new URL(String(url || "").trim()).hostname.toLowerCase(); }catch(e){ return "other"; }
    host = host.replace(/^(www|m|mobile|web)\./, "");
    function is(d){ return host === d || host.slice(-(d.length + 1)) === "." + d; }
    if(is("youtube.com") || host === "youtu.be" || is("youtube-nocookie.com")) return "youtube";
    if(is("instagram.com") || host === "instagr.am") return "instagram";
    if(is("facebook.com") || host === "fb.watch" || host === "fb.com") return "facebook";
    if(is("tiktok.com")) return "tiktok";
    if(is("threads.net") || is("threads.com")) return "threads";
    if(host === "x.com" || is("twitter.com") || host === "t.co") return "twitter";
    if(host === "drive.google.com" || host === "docs.google.com") return "drive";
    if(is("vimeo.com")) return "vimeo";
    return "other";
  }
  var VIDEO_SOURCE_NAMES = { youtube:"YouTube", instagram:"Instagram", facebook:"Facebook", tiktok:"TikTok", twitter:"X", threads:"Threads", drive:"Drive", vimeo:"Vimeo" };
  // Short site name for a slot button ("other" -> localized generic 「連結」).
  function videoSourceName(url){
    var k = videoSourceOf(url);
    return VIDEO_SOURCE_NAMES[k] || t("videoSrcOther");
  }
  function videoSourceIcon(url){ return VIDEO_SOURCE_ICONS[videoSourceOf(url)] || VIDEO_SOURCE_ICONS.other; }

  function drawerVideoItems(tr){ return (tr.media || []).filter(function(m){ return m.type === "video"; }); }

  // Saves a pasted link (mediaId edits that item, null appends a new one).
  // Returns "ok" | "empty" | "invalid" | "full".
  function setDrawerVideoUrl(tr, mediaId, raw){
    var url = String(raw || "").trim();
    if(!url) return "empty";
    if(!isSafeHttpUrl(url)) return "invalid";
    tr.media = tr.media || [];
    if(mediaId){
      var ex = tr.media.filter(function(m){ return m.id === mediaId; })[0];
      if(!ex) return "invalid";
      ex.url = url; ex.platform = videoSourceOf(url);
      return "ok";
    }
    if(drawerVideoItems(tr).length >= MAX_VIDEOS) return "full";
    tr.media.push({ id: newItemId(), type: "video", title: "", url: url, platform: videoSourceOf(url) });
    return "ok";
  }

  // Compact BUTTON slot (no embedded video): empty = "+ 影片" (opens the paste input);
  // filled = source icon + short site name (opens the video); edit mode adds small edit / remove buttons.
  function buildVideoSlot(tr, item, canEditTrick){
    var slot = document.createElement("div");
    slot.className = "vid-slot" + (item ? " filled" : " empty");
    var main = document.createElement("button");
    main.type = "button"; main.className = "vid-slot-main";
    slot.appendChild(main);
    if(!item){
      main.title = t("videoPasteLink");
      main.innerHTML = ICON_PLUS + "<span>" + escapeHtml(t("mediaTypeVideo")) + "</span>";
      main.addEventListener("click", function(){ drawerUi.videoEdit = "new"; renderDrawer(); });
      return slot;
    }
    main.title = item.url;
    main.innerHTML = videoSourceIcon(item.url) + "<span>" + escapeHtml(videoSourceName(item.url)) + "</span>";
    main.addEventListener("click", function(){
      if(isSafeHttpUrl(item.url)) openVideoModalForItem(tr, item);
    });
    if(canEditTrick){
      var ed = document.createElement("button");
      ed.type = "button"; ed.className = "vid-slot-tool"; ed.title = t("videoEditLink"); ed.innerHTML = ICON_EDIT;
      ed.addEventListener("click", function(){ drawerUi.videoEdit = item.id; renderDrawer(); });
      var rm = document.createElement("button");
      rm.type = "button"; rm.className = "vid-slot-tool"; rm.title = t("videoRemove"); rm.innerHTML = ICON_X;
      rm.addEventListener("click", function(){ requestDeleteMedia(tr.id, item.id); });
      slot.appendChild(ed); slot.appendChild(rm);
    }
    return slot;
  }

  // Input row under the slots: paste a link (new) or change one (existing item).
  function buildVideoInputRow(tr, editing){
    var row = document.createElement("div");
    row.className = "drawer-tag-new vid-input-row";
    var inp = document.createElement("input");
    inp.type = "url"; inp.className = "drawer-inline-input"; inp.placeholder = t("videoPasteLink");
    inp.value = editing ? editing.url : "";
    var ok = document.createElement("button");
    ok.type = "button"; ok.className = "col-add-btn"; ok.textContent = t("save");
    var cancel = document.createElement("button");
    cancel.type = "button"; cancel.className = "col-add-btn"; cancel.textContent = t("cancel");
    var commit = function(){
      var r = setDrawerVideoUrl(tr, editing ? editing.id : null, inp.value);
      if(r === "ok"){ drawerUi.videoEdit = null; saveDB(); renderDrawer(); }
      else if(r === "empty") showToast(t("mediaUrlRequired"));
      else if(r === "invalid") showToast(t("mediaUrlInvalid"));
      else { drawerUi.videoEdit = null; renderDrawer(); }
    };
    ok.addEventListener("click", commit);
    cancel.addEventListener("click", function(){ drawerUi.videoEdit = null; renderDrawer(); });
    inp.addEventListener("keydown", function(ev){ if(ev.key === "Enter"){ ev.preventDefault(); commit(); } });
    row.appendChild(inp); row.appendChild(ok); row.appendChild(cancel);
    setTimeout(function(){ inp.focus(); }, 30);
    return row;
  }

  // Edit mode: MAX_VIDEOS slots side by side. View mode: only the filled ones (none -> nothing).
  function buildDrawerVideoSlots(tr, canEditTrick, parent){
    var items = drawerVideoItems(tr);
    if(!canEditTrick && !items.length) return;
    parent.appendChild(makeLabel(t("mediaTypeVideo")));
    var grid = document.createElement("div");
    grid.className = "vid-slots";
    var n = canEditTrick ? MAX_VIDEOS : items.length;
    for(var i = 0; i < n; i++) grid.appendChild(buildVideoSlot(tr, items[i] || null, canEditTrick));
    parent.appendChild(grid);
    if(canEditTrick && drawerUi.videoEdit){
      var editing = drawerUi.videoEdit === "new" ? null : items.filter(function(m){ return m.id === drawerUi.videoEdit; })[0];
      if(drawerUi.videoEdit !== "new" && !editing){ drawerUi.videoEdit = null; return; }
      parent.appendChild(buildVideoInputRow(tr, editing));
    }
  }
