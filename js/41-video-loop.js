"use strict";

  /* ============================================================
     VIDEO A-B LOOP (YouTube only). The admin marks A and B on a video slot (media item .loop = {a,b}, seconds);
     everyone sees an 「A–B 重播」 toggle under the player. Current time comes from the IFrame API
     "listening" handshake (infoDelivery messages ~4/s) and is extrapolated between messages.
     Pure helpers (formatLoopTime, shouldLoopBack, loopSetPoint, setItemLoop) are tested in tests/modals/video-loop.test.js;
     normalizeLoop lives in js/01-data-storage.js.
  ============================================================ */
  addStrings({
    zh:{ loopReplay:"A–B 重播", loopSetA:"設為 A", loopSetB:"設為 B", loopClear:"清除", loopDraftHint:"請設定 A 與 B", loopNeedYT:"需要 YouTube 播放器" },
    jp:{ loopReplay:"A–B リピート", loopSetA:"A に設定", loopSetB:"B に設定", loopClear:"クリア", loopDraftHint:"A と B を設定してください", loopNeedYT:"YouTube プレーヤーが必要です" },
    en:{ loopReplay:"A–B loop", loopSetA:"Set A", loopSetB:"Set B", loopClear:"Clear", loopDraftHint:"Set both A and B", loopNeedYT:"YouTube player required" }
  });

  // Seconds -> "m:ss.s" (or "h:mm:ss.s" from one hour).
  function formatLoopTime(s){
    s = Math.max(0, Math.round((Number(s) || 0) * 10) / 10);
    var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s - h * 3600 - m * 60;
    var secTxt = (sec < 10 ? "0" : "") + sec.toFixed(1);
    return h ? (h + ":" + (m < 10 ? "0" : "") + m + ":" + secTxt) : (m + ":" + secTxt);
  }
  function formatLoopRange(l){ return l ? formatLoopTime(l.a) + " – " + formatLoopTime(l.b) : ""; }
  // True when playback has reached B and should jump back to A.
  function shouldLoopBack(t, a, b){ return typeof t === "number" && t >= b; }
  // Draft {a,b} (either may be null) after the admin marks point "a" or "b" at time t.
  // A point that would make the range empty/inverted drops the other end.
  function loopSetPoint(draft, which, t){
    var d = { a: draft ? draft.a : null, b: draft ? draft.b : null };
    t = Math.round((Number(t) || 0) * 10) / 10;
    if(t < 0) t = 0;
    d[which] = t;
    if(d.a !== null && d.b !== null && d.b <= d.a) d[which === "a" ? "b" : "a"] = null;
    return d;
  }
  // Stores (or clears with null) the loop of a media item; returns the normalized value stored.
  function setItemLoop(item, loop){
    var n = normalizeLoop(loop);
    if(n) item.loop = n; else delete item.loop;
    return n;
  }

  var _videoLoopCleanup = null;
  function videoLoopStop(){ if(_videoLoopCleanup){ var f = _videoLoopCleanup; _videoLoopCleanup = null; f(); } }

  // Builds the row under the player; returns null when there is nothing to show.
  function buildVideoLoopRow(tr, item, iframe){
    var admin = typeof isAdminAccount === "function" && isAdminAccount() &&
      canModifyItem({ type:"trick", ref:tr }, null, true);
    if(!item.loop && !admin) return null;
    videoLoopStop();

    var row = document.createElement("div");
    row.className = "video-loop-row";
    var draft = item.loop ? { a: item.loop.a, b: item.loop.b } : { a: null, b: null };
    var looping = false;
    var curT = 0, curAt = 0, playing = false, rate = 1, timer = null;

    var toggle = document.createElement("button");
    toggle.type = "button"; toggle.className = "btn video-loop-toggle";
    toggle.setAttribute("aria-pressed", "false");
    toggle.textContent = t("loopReplay");
    var range = document.createElement("span");
    range.className = "video-loop-range";
    row.appendChild(toggle); row.appendChild(range);

    function post(func, args){
      if(iframe && iframe.contentWindow) iframe.contentWindow.postMessage(ytCommandMessage(func, args), "https://www.youtube.com");
    }
    function nowT(){ return playing ? curT + (Date.now() - curAt) / 1000 * rate : curT; }
    function loopOf(){ return normalizeLoop(draft); }
    function seekTo(s){ curT = s; curAt = Date.now(); post("seekTo", [s, true]); }
    function refresh(){
      var l = loopOf();
      toggle.disabled = !l;
      if(!l && looping){ looping = false; toggle.classList.remove("active"); toggle.setAttribute("aria-pressed", "false"); }
      range.textContent = l ? formatLoopRange(l)
        : ((draft.a !== null ? "A " + formatLoopTime(draft.a) : "A –") + "  " + (draft.b !== null ? "B " + formatLoopTime(draft.b) : "B –"));
    }
    function tick(){
      var l = loopOf();
      if(looping && l && playing && shouldLoopBack(nowT(), l.a, l.b)) seekTo(l.a);
    }
    toggle.addEventListener("click", function(){
      var l = loopOf(); if(!l) return;
      looping = !looping;
      toggle.classList.toggle("active", looping);
      toggle.setAttribute("aria-pressed", looping ? "true" : "false");
      if(looping){ seekTo(l.a); post("playVideo"); playing = true; }
    });

    if(admin){
      var save = function(){
        setItemLoop(item, loopOf());
        saveDB();
        if(typeof render === "function") render();
        refresh();
      };
      var mk = function(label, fn){
        var b = document.createElement("button");
        b.type = "button"; b.className = "btn video-loop-set"; b.textContent = label;
        b.addEventListener("click", fn); row.appendChild(b); return b;
      };
      mk(t("loopSetA"), function(){ draft = loopSetPoint(draft, "a", nowT()); save(); });
      mk(t("loopSetB"), function(){ draft = loopSetPoint(draft, "b", nowT()); save(); });
      mk(t("loopClear"), function(){ draft = { a: null, b: null }; save(); });
    }

    function onMsg(ev){
      if(!iframe || ev.source !== iframe.contentWindow || typeof ev.data !== "string") return;
      var d; try{ d = JSON.parse(ev.data); }catch(e){ return; }
      if(!d || d.event !== "infoDelivery" || !d.info) return;
      if(typeof d.info.currentTime === "number"){ curT = d.info.currentTime; curAt = Date.now(); }
      if(typeof d.info.playbackRate === "number") rate = d.info.playbackRate;
      if(typeof d.info.playerState === "number") playing = d.info.playerState === 1;
    }
    function listen(){ if(iframe && iframe.contentWindow) iframe.contentWindow.postMessage(JSON.stringify({ event:"listening", id:1, channel:"widget" }), "https://www.youtube.com"); }
    window.addEventListener("message", onMsg);
    if(iframe) iframe.addEventListener("load", listen);
    timer = setInterval(tick, 50);
    _videoLoopCleanup = function(){ clearInterval(timer); window.removeEventListener("message", onMsg); };
    refresh();
    return row;
  }
