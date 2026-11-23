"use strict";

  /* ============================================================
     VIDEO 關鍵段落 (key section, YouTube only). A media item may carry .loop = {a,b} (seconds).
     View mode: a video with a loop plays only A<->B (no toggle). Edit mode: the timeline (js/41-video-timeline.js) sets A/B.
     createYtPlayer wraps the IFrame API "listening" handshake (infoDelivery ~4/s, extrapolated between messages).
     Pure helpers (formatLoopTime, shouldLoopBack, setItemLoop) are tested in tests/modals/video-loop.test.js;
     normalizeLoop lives in js/01-data-storage.js.
  ============================================================ */
  addStrings({
    zh:{ loopClear:"清除" },
    jp:{ loopClear:"クリア" },
    en:{ loopClear:"Clear" }
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
  // View mode plays only [A,B]: where to seek now (A), or null when t is inside the section.
  // Past B, or before A by more than `tol` seconds (the user seeked with the YouTube controls), snaps to A.
  function loopSnapTarget(t, a, b, tol){
    if(typeof t !== "number") return null;
    tol = tol == null ? 0.5 : tol;
    return (t >= b || t < a - tol) ? a : null;
  }
  // Stores (or clears with null) the loop of a media item; returns the normalized value stored.
  function setItemLoop(item, loop){
    var n = normalizeLoop(loop);
    if(n) item.loop = n; else delete item.loop;
    return n;
  }

  var _videoLoopCleanup = null;
  function videoLoopStop(){ if(_videoLoopCleanup){ var f = _videoLoopCleanup; _videoLoopCleanup = null; f(); } }

  // YouTube player wrapper. p.nowT(), p.duration(), p.seekTo(s), p.post(fn,args), p.setLoop({a,b}|null) (view mode: enforced always, snaps back into [A,B]),
  // p.subscribe(fn) (called on every message and every 50ms tick), p.stop().
  function createYtPlayer(iframe){
    videoLoopStop();
    var curT = 0, curAt = 0, playing = false, rate = 1, dur = 0, loop = null, subs = [];
    function post(func, args){
      if(iframe && iframe.contentWindow) iframe.contentWindow.postMessage(ytCommandMessage(func, args), "https://www.youtube.com");
    }
    function nowT(){ return playing ? curT + (Date.now() - curAt) / 1000 * rate : curT; }
    function seekTo(s){ curT = s; curAt = Date.now(); post("seekTo", [s, true]); }
    function notify(){ for(var i = 0; i < subs.length; i++) subs[i](); }
    function onMsg(ev){
      if(!iframe || ev.source !== iframe.contentWindow || typeof ev.data !== "string") return;
      var d; try{ d = JSON.parse(ev.data); }catch(e){ return; }
      if(!d || d.event !== "infoDelivery" || !d.info) return;
      if(typeof d.info.currentTime === "number"){ curT = d.info.currentTime; curAt = Date.now(); }
      if(typeof d.info.playbackRate === "number") rate = d.info.playbackRate;
      if(typeof d.info.playerState === "number") playing = d.info.playerState === 1;
      if(typeof d.info.duration === "number" && d.info.duration > 0) dur = d.info.duration;
      notify();
    }
    function listen(){ if(iframe && iframe.contentWindow) iframe.contentWindow.postMessage(JSON.stringify({ event:"listening", id:1, channel:"widget" }), "https://www.youtube.com"); }
    function tick(){
      if(loop){ var snap = loopSnapTarget(nowT(), loop.a, loop.b); if(snap !== null) seekTo(snap); }
      notify();
    }
    window.addEventListener("message", onMsg);
    if(iframe) iframe.addEventListener("load", listen);
    var timer = setInterval(tick, 50);
    var p = {
      post: post, nowT: nowT, seekTo: seekTo,
      duration: function(){ return dur; },
      setLoop: function(l){ loop = l || null; },
      subscribe: function(fn){ subs.push(fn); },
      stop: function(){ clearInterval(timer); window.removeEventListener("message", onMsg); subs = []; }
    };
    _videoLoopCleanup = p.stop;
    return p;
  }
