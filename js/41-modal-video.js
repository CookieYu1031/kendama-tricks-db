"use strict";

  /* ============================================================
     VIDEO MODAL — header: title, mirror toggle, speed (YouTube only), close
  ============================================================ */
  addStrings({
    zh:{ videoMirror:"鏡像", videoSpeed:"播放速度", openInInstagram:"在 Instagram 開啟" },
    jp:{ videoMirror:"左右反転", videoSpeed:"再生速度", openInInstagram:"Instagram で開く" },
    en:{ videoMirror:"Mirror", videoSpeed:"Playback speed", openInInstagram:"Open in Instagram" }
  });

  var VIDEO_RATES = [1, 0.75, 0.5, 0.25];
  // Next rate in the 1 -> 0.75 -> 0.5 -> 0.25 -> 1 cycle (unknown rate restarts at 1).
  function nextVideoRate(r){
    var i = VIDEO_RATES.indexOf(r);
    return VIDEO_RATES[(i + 1) % VIDEO_RATES.length];
  }
  function videoRateLabel(r){ return r + "x"; }
  // Which header tools a video gets: mirror for any embedded player (CSS flip),
  // speed only for YouTube (IFrame API over postMessage; needs enablejsapi=1).
  function videoToolsFor(info){
    var embedded = !!(info && info.embedUrl);
    return { mirror: embedded, speed: embedded && info.type === "youtube" };
  }
  // YouTube IFrame API command message (sent to the iframe's contentWindow).
  function ytCommandMessage(func, args){
    return JSON.stringify({ event:"command", func: func, args: args || [] });
  }

  function getEmbedInfo(url){
    if(!url) return null;
    var u;
    try{ u = new URL(url); }catch(e){ return { type:"other", embedUrl:null, originalUrl:url }; }
    var host = u.hostname.replace(/^www\./,"").replace(/^m\./,"");
    if(host==="youtube.com" || host==="youtu.be"){
      var vid = "";
      if(host==="youtu.be") vid = u.pathname.slice(1);
      else vid = u.searchParams.get("v") || u.pathname.split("/").filter(Boolean).pop();
      if(!vid) return { type:"other", embedUrl:null, originalUrl:url };
      return { type:"youtube", embedUrl: "https://www.youtube.com/embed/" + encodeURIComponent(vid) + "?enablejsapi=1&playsinline=1&cc_load_policy=0" };
    }
    if(host==="vimeo.com" || host==="player.vimeo.com"){
      var parts = u.pathname.split("/").filter(Boolean);
      var vvid = parts[parts.length-1];
      if(!vvid) return { type:"other", embedUrl:null, originalUrl:url };
      return { type:"vimeo", embedUrl: "https://player.vimeo.com/video/" + vvid + "?texttrack=false" };
    }
    if(host==="instagram.com" || host==="instagr.am"){
      var igEmbed = typeof instagramEmbedUrl === "function" ? instagramEmbedUrl(url) : "";
      return { type:"instagram", embedUrl: igEmbed || null, originalUrl:url };
    }
    if(host==="facebook.com" || host==="fb.watch") return { type:"facebook", embedUrl:null, originalUrl:url };
    if(host==="tiktok.com") return { type:"tiktok", embedUrl:null, originalUrl:url };
    if(host==="twitter.com" || host==="x.com") return { type:"twitter", embedUrl:null, originalUrl:url };
    return { type:"other", embedUrl:null, originalUrl:url };
  }

  function openVideoModalForItem(tr, item){
    var overlay = document.getElementById("videoModalOverlay");
    var modal = document.getElementById("videoModal");
    var info = getEmbedInfo(item.url);
    if(typeof videoLoopStop === "function") videoLoopStop();
    modal.innerHTML = "";

    var titleBar = document.createElement("div");
    titleBar.className = "video-modal-title";
    titleBar.textContent = item.title ? (localize(tr.name) + " · " + item.title) : localize(tr.name);

    var closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "icon-btn video-modal-close";
    closeBtn.title = t("settingsClose"); closeBtn.setAttribute("aria-label", t("settingsClose"));
    closeBtn.innerHTML = ICON_X;
    closeBtn.addEventListener("click", closeVideoModal);

    // Header bar above the video (title + tools + close never cover the player).
    var head = document.createElement("div");
    head.className = "video-modal-head";
    head.appendChild(titleBar);
    modal.appendChild(head);

    var tools = videoToolsFor(info);
    var frameWrap = null, iframe = null;
    if(tools.mirror){
      var mirrorBtn = document.createElement("button");
      mirrorBtn.type = "button";
      mirrorBtn.className = "icon-btn video-tool-btn";
      mirrorBtn.title = t("videoMirror"); mirrorBtn.setAttribute("aria-label", t("videoMirror"));
      mirrorBtn.setAttribute("aria-pressed", "false");
      mirrorBtn.innerHTML = ICON_MIRROR;
      mirrorBtn.addEventListener("click", function(){
        var on = !frameWrap.classList.contains("mirrored");
        frameWrap.classList.toggle("mirrored", on);
        mirrorBtn.classList.toggle("active", on);
        mirrorBtn.setAttribute("aria-pressed", on ? "true" : "false");
      });
      head.appendChild(mirrorBtn);
    }
    if(tools.speed){
      var rate = 1;
      var speedBtn = document.createElement("button");
      speedBtn.type = "button";
      speedBtn.className = "icon-btn video-tool-btn video-speed-btn";
      speedBtn.title = t("videoSpeed"); speedBtn.setAttribute("aria-label", t("videoSpeed"));
      speedBtn.textContent = videoRateLabel(rate);
      speedBtn.addEventListener("click", function(){
        rate = nextVideoRate(rate);
        speedBtn.textContent = videoRateLabel(rate);
        speedBtn.classList.toggle("active", rate !== 1);
        if(iframe && iframe.contentWindow) iframe.contentWindow.postMessage(ytCommandMessage("setPlaybackRate", [rate]), "https://www.youtube.com");
      });
      head.appendChild(speedBtn);
    }
    head.appendChild(closeBtn);

    if(info && info.embedUrl){
      frameWrap = document.createElement("div");
      frameWrap.className = "video-frame-wrap";
      iframe = document.createElement("iframe");
      iframe.src = info.embedUrl;
      iframe.setAttribute("allow", "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture");
      iframe.setAttribute("allowfullscreen", "true");
      frameWrap.appendChild(iframe);
      modal.appendChild(frameWrap);
      if(info.type === "instagram" && isSafeHttpUrl(item.url)){
        var igRow = document.createElement("div");
        igRow.className = "video-loop-row";
        var igLink = document.createElement("a");
        igLink.href = item.url; igLink.target = "_blank"; igLink.rel = "noopener noreferrer";
        igLink.className = "btn"; igLink.textContent = t("openInInstagram");
        igRow.appendChild(igLink); modal.appendChild(igRow);
      }
      if(info.type === "youtube" && typeof buildVideoLoopRow === "function"){
        var loopRow = buildVideoLoopRow(tr, item, iframe);
        if(loopRow) modal.appendChild(loopRow);
      }
    } else {
      var fb = document.createElement("div");
      fb.className = "video-fallback";
      var msg = info && info.type !== "other" ? t("embedNotSupportedNote") : t("noVideo");
      fb.innerHTML = ICON_PLAY.replace("currentColor","var(--paper-faint)") + "<p>" + escapeHtml(msg) + "</p>";
      if(isSafeHttpUrl(item.url)){
        var link = document.createElement("a");
        link.href = item.url; link.target = "_blank"; link.rel = "noopener noreferrer";
        link.className = "btn btn-primary";
        link.textContent = t("openOriginal");
        fb.appendChild(link);
      }
      modal.appendChild(fb);
    }


    overlay.classList.add("show");
  }
  function closeVideoModal(){
    if(typeof videoLoopStop === "function") videoLoopStop();
    document.getElementById("videoModalOverlay").classList.remove("show");
    setTimeout(function(){ document.getElementById("videoModal").innerHTML = ""; }, 200);
  }

