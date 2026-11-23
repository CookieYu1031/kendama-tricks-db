"use strict";

  /* ============================================================
     DRAWER VIDEOS — the three video slots of the trick drawer (v0.9.3).
     Each slot is a compact button: empty ("+ 影片" -> paste a link) or filled (source icon + site name; tap opens
     the video modal). The source site is detected from the URL (videoSourceOf, pure,
     tests/drawer-videos.test.js). Edit mode only: remove (x) and change-link buttons.
  ============================================================ */
  addStrings({
    zh:{ videoSrcOther:"連結", videoPasteLink:"貼上影片連結", videoEditLink:"更換連結",
         videoDefaultTitle:"影片 {n}", videoTitleLabel:"標題（選填，最多 12 字）", videoTitlePlaceholder:"例如：正面示範", videoTitleTooLong:"標題過長：最多 12 個字" },
    jp:{ videoSrcOther:"リンク", videoPasteLink:"動画リンクを貼り付け", videoEditLink:"リンクを変更",
         videoDefaultTitle:"動画 {n}", videoTitleLabel:"タイトル（任意・12文字まで）", videoTitlePlaceholder:"例：正面デモ", videoTitleTooLong:"タイトルが長すぎます：12文字まで" },
    en:{ videoSrcOther:"Link", videoPasteLink:"Paste a video link", videoEditLink:"Change link",
         videoDefaultTitle:"Video {n}", videoTitleLabel:"Title (optional, max 12 characters)", videoTitlePlaceholder:"e.g. Front angle", videoTitleTooLong:"Title too long: 12 characters max" }
  });

  // New links are limited to YouTube and Instagram (older stored links of other sites keep rendering).
  addStrings({
    zh:{ mediaUrlInvalid:"僅接受 YouTube 或 Instagram Reels 連結" },
    jp:{ mediaUrlInvalid:"YouTube または Instagram Reels のリンクのみ使えます" },
    en:{ mediaUrlInvalid:"Only YouTube or Instagram Reels links are accepted" }
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
  // Accepted link classifier: "youtube" | "instagram" | "" (not accepted). Pure.
  //  YouTube: youtube.com/watch?v=, /shorts/<id>, /embed/<id>, /live/<id>, youtu.be/<id> (www., m. ok)
  //  Instagram: instagram.com/reel/<id>, /reels/<id>, /p/<id>, instagr.am/(same)
  function videoLinkKind(url){
    var u;
    try{ u = new URL(String(url || "").trim()); }catch(e){ return ""; }
    if(u.protocol !== "http:" && u.protocol !== "https:") return "";
    var host = u.hostname.toLowerCase().replace(/^(www|m)\./, "");
    var seg = u.pathname.split("/").filter(Boolean);
    if(host === "youtu.be") return seg.length >= 1 ? "youtube" : "";
    if(host === "youtube.com"){
      if(seg[0] === "watch") return u.searchParams.get("v") ? "youtube" : "";
      return (seg[0] === "shorts" || seg[0] === "embed" || seg[0] === "live") && seg[1] ? "youtube" : "";
    }
    if(host === "instagram.com" || host === "instagr.am"){
      return (seg[0] === "reel" || seg[0] === "reels" || seg[0] === "p") && seg[1] ? "instagram" : "";
    }
    return "";
  }
  function isAcceptedVideoUrl(url){ return videoLinkKind(url) !== ""; }
  // Instagram embed URL for a reel / post link ("" if not an Instagram reel/post).
  function instagramEmbedUrl(url){
    if(videoLinkKind(url) !== "instagram") return "";
    var seg = new URL(String(url).trim()).pathname.split("/").filter(Boolean);
    var kind = seg[0] === "p" ? "p" : "reel";
    return "https://www.instagram.com/" + kind + "/" + encodeURIComponent(seg[1]) + "/embed";
  }
  // Stable reorder: YouTube videos first, everything else after (loops live on the items, so they move with them).
  function orderVideosYoutubeFirst(media){
    var yt = [], rest = [];
    (media || []).forEach(function(m){ (m && m.type === "video" && videoSourceOf(m.url) === "youtube" ? yt : rest).push(m); });
    return yt.concat(rest);
  }

  var VIDEO_SOURCE_NAMES = { youtube:"YouTube", instagram:"Instagram", facebook:"Facebook", tiktok:"TikTok", twitter:"X", threads:"Threads", drive:"Drive", vimeo:"Vimeo" };
  // Short site name for a slot button ("other" -> localized generic 「連結」).
  function videoSourceName(url){
    var k = videoSourceOf(url);
    return VIDEO_SOURCE_NAMES[k] || t("videoSrcOther");
  }
  function videoSourceIcon(url){ return VIDEO_SOURCE_ICONS[videoSourceOf(url)] || VIDEO_SOURCE_ICONS.other; }

  function drawerVideoItems(tr){ return (tr.media || []).filter(function(m){ return m.type === "video"; }); }

  // Title length in user-perceived characters (grapheme clusters; falls back to code points).
  var VIDEO_TITLE_MAX = 12;
  function videoTitleLength(s){
    s = String(s == null ? "" : s);
    if(typeof Intl !== "undefined" && Intl.Segmenter){
      var n = 0, it = new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(s)[Symbol.iterator](), r;
      while(!(r = it.next()).done) n++;
      return n;
    }
    return Array.from(s).length;
  }
  function videoTitleFits(s){ return videoTitleLength(String(s == null ? "" : s).trim()) <= VIDEO_TITLE_MAX; }
  // Slot label: the title, or 「影片 N」 by slot index (0-based).
  function videoSlotLabel(item, idx){
    var ti = item && item.title ? String(item.title).trim() : "";
    return ti || t("videoDefaultTitle").replace("{n}", String(idx + 1));
  }

  // Saves a video from the modal (mediaId edits that item, null appends a new one).
  // title undefined = keep the existing one. Returns "ok" | "empty" | "invalid" | "titleTooLong" | "full".
  function saveDrawerVideo(tr, mediaId, raw, title){
    var url = String(raw || "").trim();
    if(!url) return "empty";
    if(!isSafeHttpUrl(url)) return "invalid";
    var existing = mediaId ? (tr.media || []).filter(function(m){ return m.id === mediaId; })[0] : null;
    if(!isAcceptedVideoUrl(url) && !(existing && existing.url === url)) return "invalid"; // legacy links may stay as they are
    var ti = title === undefined ? undefined : String(title == null ? "" : title).trim();
    if(ti !== undefined && !videoTitleFits(ti)) return "titleTooLong";
    tr.media = tr.media || [];
    if(mediaId){
      var ex = tr.media.filter(function(m){ return m.id === mediaId; })[0];
      if(!ex) return "invalid";
      if(ex.url !== url) delete ex.loop; // loop belongs to the old video
      ex.url = url; ex.platform = videoSourceOf(url);
      if(ti !== undefined) ex.title = ti;
      tr.media = orderVideosYoutubeFirst(tr.media);
      return "ok";
    }
    if(drawerVideoItems(tr).length >= MAX_VIDEOS) return "full";
    tr.media.push({ id: newItemId(), type: "video", title: ti || "", url: url, platform: videoSourceOf(url) });
    tr.media = orderVideosYoutubeFirst(tr.media);
    return "ok";
  }
  function setDrawerVideoUrl(tr, mediaId, raw){ return saveDrawerVideo(tr, mediaId, raw, undefined); }

  // Compact BUTTON slot: empty = "+ 影片"; filled = source icon + title (or 「影片 N」).
  // Filled slot opens the player (edit mode: title / timeline / change link / delete live there); empty slot adds a link.
  function buildVideoSlot(tr, item, canEditTrick, idx){
    var slot = document.createElement("div");
    slot.className = "vid-slot" + (item ? " filled" : " empty");
    var main = document.createElement("button");
    main.type = "button"; main.className = "vid-slot-main";
    slot.appendChild(main);
    if(!item){
      main.title = t("videoPasteLink");
      main.innerHTML = ICON_PLUS + "<span>" + escapeHtml(t("mediaTypeVideo")) + "</span>";
      main.addEventListener("click", function(){ openMediaModal(tr.id, null); });
      return slot;
    }
    main.title = item.url;
    main.innerHTML = videoSourceIcon(item.url) + "<span>" + escapeHtml(videoSlotLabel(item, idx)) + "</span>";
    main.addEventListener("click", function(){
      if(isSafeHttpUrl(item.url)) openVideoModalForItem(tr, item, !!canEditTrick);
      else if(canEditTrick) openMediaModal(tr.id, item.id); // unsafe link: only the link dialog can fix it
    });
    return slot;
  }

  // Edit mode: MAX_VIDEOS slots side by side. View mode: only the filled ones (none -> nothing).
  function buildDrawerVideoSlots(tr, canEditTrick, parent){
    var items = drawerVideoItems(tr);
    if(!canEditTrick && !items.length) return;
    parent.appendChild(makeLabel(t("mediaTypeVideo")));
    var grid = document.createElement("div");
    grid.className = "vid-slots";
    var n = canEditTrick ? MAX_VIDEOS : items.length;
    for(var i = 0; i < n; i++) grid.appendChild(buildVideoSlot(tr, items[i] || null, canEditTrick, i));
    parent.appendChild(grid);
  }
