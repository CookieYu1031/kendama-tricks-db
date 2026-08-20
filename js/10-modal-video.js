"use strict";

  /* ============================================================
     VIDEO MODAL
  ============================================================ */
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
      return { type:"youtube", embedUrl: "https://www.youtube.com/embed/" + vid };
    }
    if(host==="vimeo.com" || host==="player.vimeo.com"){
      var parts = u.pathname.split("/").filter(Boolean);
      var vvid = parts[parts.length-1];
      if(!vvid) return { type:"other", embedUrl:null, originalUrl:url };
      return { type:"vimeo", embedUrl: "https://player.vimeo.com/video/" + vvid };
    }
    if(host==="instagram.com") return { type:"instagram", embedUrl:null, originalUrl:url };
    if(host==="facebook.com" || host==="fb.watch") return { type:"facebook", embedUrl:null, originalUrl:url };
    if(host==="tiktok.com") return { type:"tiktok", embedUrl:null, originalUrl:url };
    if(host==="twitter.com" || host==="x.com") return { type:"twitter", embedUrl:null, originalUrl:url };
    return { type:"other", embedUrl:null, originalUrl:url };
  }

  function openVideoModalForItem(tr, item){
    var overlay = document.getElementById("videoModalOverlay");
    var modal = document.getElementById("videoModal");
    var info = getEmbedInfo(item.url);
    modal.innerHTML = "";

    var titleBar = document.createElement("div");
    titleBar.className = "video-modal-title";
    titleBar.textContent = item.title ? (localize(tr.name) + " · " + item.title) : localize(tr.name);

    var closeBtn = document.createElement("button");
    closeBtn.className = "video-modal-close";
    closeBtn.innerHTML = ICON_X;
    closeBtn.addEventListener("click", closeVideoModal);

    if(info && info.embedUrl){
      var frameWrap = document.createElement("div");
      frameWrap.className = "video-frame-wrap";
      var iframe = document.createElement("iframe");
      iframe.src = info.embedUrl;
      iframe.setAttribute("allow", "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture");
      iframe.setAttribute("allowfullscreen", "true");
      frameWrap.appendChild(iframe);
      modal.appendChild(frameWrap);
    } else {
      var fb = document.createElement("div");
      fb.className = "video-fallback";
      var msg = info && info.type !== "other" ? t("embedNotSupportedNote") : t("noVideo");
      fb.innerHTML = ICON_PLAY.replace("currentColor","var(--paper-faint)") + "<p>" + escapeHtml(msg) + "</p>";
      if(item.url){
        var link = document.createElement("a");
        link.href = item.url; link.target = "_blank"; link.rel = "noopener noreferrer";
        link.className = "btn btn-primary";
        link.textContent = t("openOriginal");
        fb.appendChild(link);
      }
      modal.appendChild(fb);
    }
    modal.appendChild(titleBar);
    modal.appendChild(closeBtn);

    overlay.classList.add("show");
  }
  function closeVideoModal(){
    document.getElementById("videoModalOverlay").classList.remove("show");
    setTimeout(function(){ document.getElementById("videoModal").innerHTML = ""; }, 200);
  }

