"use strict";

  /* ============================================================
     VIDEO TIMELINE (edit mode, YouTube only): a track 0..duration with draggable A / B handles that mark the
     關鍵段落, a playhead, tap-to-seek. Pure mapping helpers (tlFrac, tlTimeFromX, tlSetHandle, tlDefaultLoop)
     are tested in tests/modals/video-timeline.test.js.
  ============================================================ */
  var TL_MIN_GAP = 0.3;
  function tlRound(x){ return Math.round(x * 10) / 10; }
  // Fraction 0..1 of time t on a track of duration dur.
  function tlFrac(t, dur){ return dur > 0 ? Math.min(1, Math.max(0, t / dur)) : 0; }
  // Pointer x -> time (0.1s steps, clamped to [0,dur]) for a track starting at `left` with `width` px.
  function tlTimeFromX(x, left, width, dur){
    if(!(dur > 0) || !(width > 0)) return 0;
    var f = Math.min(1, Math.max(0, (x - left) / width));
    return Math.min(dur, tlRound(f * dur));
  }
  // New {a,b} after dragging handle `which` to time t: clamped to [0,dur], never crossing the other handle (min gap).
  function tlSetHandle(draft, which, t, dur, gap){
    var d = { a: draft.a, b: draft.b };
    if(!(dur > 0)) return d;
    gap = gap == null ? TL_MIN_GAP : gap;
    t = Number(t) || 0;
    if(which === "a") t = Math.min(Math.max(0, t), d.b - gap);
    else t = Math.max(Math.min(dur, t), d.a + gap);
    t = tlRound(t);
    d[which] = which === "a" ? Math.max(0, Math.min(t, d.b - gap)) : Math.min(dur, Math.max(t, d.a + gap));
    return d;
  }
  // Initial handles when no loop exists yet (25% / 75%).
  function tlDefaultLoop(dur){ return { a: tlRound(dur * 0.25), b: tlRound(dur * 0.75) }; }

  function buildVideoTimeline(tr, item, player){
    var wrap = document.createElement("div");
    wrap.className = "video-tl disabled";
    var track = document.createElement("div");
    track.className = "video-tl-track";
    var bar = document.createElement("div"); bar.className = "video-tl-bar";
    var range = document.createElement("div"); range.className = "video-tl-range";
    var head = document.createElement("div"); head.className = "video-tl-playhead";
    track.appendChild(bar); track.appendChild(range); track.appendChild(head);
    function mkHandle(which){
      var h = document.createElement("button");
      h.type = "button"; h.className = "video-tl-handle";
      h.textContent = which.toUpperCase();
      h.setAttribute("aria-label", which.toUpperCase());
      track.appendChild(h);
      return h;
    }
    var hA = mkHandle("a"), hB = mkHandle("b");

    var info = document.createElement("div");
    info.className = "video-tl-info";
    var times = document.createElement("span");
    times.className = "video-loop-range";
    var clear = document.createElement("button");
    clear.type = "button"; clear.className = "btn";
    clear.textContent = t("loopClear");
    info.appendChild(times); info.appendChild(clear);
    wrap.appendChild(track); wrap.appendChild(info);

    var draft = item.loop ? { a: item.loop.a, b: item.loop.b } : null;
    var dragging = null, lastSeek = 0;

    function layout(){
      var dur = player.duration();
      wrap.classList.toggle("disabled", !(dur > 0));
      clear.disabled = !item.loop;
      if(!(dur > 0)) return;
      if(!draft) draft = tlDefaultLoop(dur);
      var fa = tlFrac(draft.a, dur) * 100, fb = tlFrac(draft.b, dur) * 100;
      hA.style.left = fa + "%"; hB.style.left = fb + "%";
      range.style.left = fa + "%"; range.style.width = (fb - fa) + "%";
      range.classList.toggle("unset", !item.loop && !dragging);
      head.style.left = (tlFrac(player.nowT(), dur) * 100) + "%";
      times.textContent = "A " + formatLoopTime(draft.a) + "   B " + formatLoopTime(draft.b);
    }
    function persist(){
      setItemLoop(item, draft);
      saveDB();
      if(typeof render === "function") render();
      layout();
    }
    function timeAt(ev){
      var r = track.getBoundingClientRect();
      return tlTimeFromX(ev.clientX, r.left, r.width, player.duration());
    }
    function bindHandle(h, which){
      h.addEventListener("pointerdown", function(ev){
        if(!(player.duration() > 0)) return;
        ev.preventDefault();
        dragging = which;
        try{ h.setPointerCapture(ev.pointerId); }catch(e){}
        h.classList.add("dragging");
      });
      h.addEventListener("pointermove", function(ev){
        if(dragging !== which) return;
        draft = tlSetHandle(draft, which, timeAt(ev), player.duration());
        layout();
        var now = Date.now();
        if(now - lastSeek > 120){ lastSeek = now; player.seekTo(draft[which]); }
      });
      function end(){
        if(dragging !== which) return;
        dragging = null;
        h.classList.remove("dragging");
        player.seekTo(draft[which]);
        persist();
      }
      h.addEventListener("pointerup", end);
      h.addEventListener("pointercancel", end);
    }
    bindHandle(hA, "a"); bindHandle(hB, "b");

    // Tap on the track (not on a handle) seeks the video.
    track.addEventListener("pointerdown", function(ev){
      if(ev.target === hA || ev.target === hB || !(player.duration() > 0)) return;
      player.seekTo(timeAt(ev));
      layout();
    });
    clear.addEventListener("click", function(){
      if(!item.loop) return;
      setItemLoop(item, null);
      draft = player.duration() > 0 ? tlDefaultLoop(player.duration()) : null;
      saveDB();
      if(typeof render === "function") render();
      layout();
    });

    player.subscribe(layout);
    layout();
    return wrap;
  }
