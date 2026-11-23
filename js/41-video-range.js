"use strict";

  /* ============================================================
     VIDEO 關鍵段落 input row (edit mode, YouTube only): [clear] [start mm:ss + ◇] [end mm:ss + ◇].
     Digits only (the ":" is inserted automatically). Empty start = 0, empty end = play to the end of the video.
     maskLoopDigits / parseLoopTime / formatMmSs are pure and tested in tests/modals/video-range.test.js.
  ============================================================ */
  addStrings({
    zh:{ loopStart:"起始於", loopEnd:"結束於", loopClear:"清除設定", loopNow:"填入目前時間",
         loopBadTime:"時間格式不正確（例：0105、1:05）", loopBadRange:"結束時間必須大於起始時間，且起始不能超過影片長度" },
    jp:{ loopStart:"開始", loopEnd:"終了", loopClear:"設定をクリア", loopNow:"現在の時間を入力",
         loopBadTime:"時間の形式が正しくありません（例：0105、1:05）", loopBadRange:"終了は開始より後にし、開始は動画の長さ以内にしてください" },
    en:{ loopStart:"From", loopEnd:"To", loopClear:"Clear", loopNow:"Use current time",
         loopBadTime:"Invalid time format (e.g. 0105, 1:05)", loopBadRange:"End must be after start, and start must be within the video length" }
  });

  // Typing helper: keep digits only (max 4) and insert ":" before the last two ("123" -> "1:23").
  function maskLoopDigits(str){
    var d = String(str == null ? "" : str).replace(/\D/g, "").slice(0, 4);
    return d.length >= 3 ? d.slice(0, d.length - 2) + ":" + d.slice(-2) : d;
  }

  // "12" -> 12 s, "123"/"0123" -> 1:23, "1:05" -> 65, "1:02:05" -> 3725; "" -> null (unset); anything else -> NaN.
  function parseLoopTime(str){
    var s = String(str == null ? "" : str).replace(/^\s+|\s+$/g, "");
    if(s === "") return null;
    if(s.indexOf(":") >= 0){
      if(!/^\d+:[0-5]?\d$|^\d+:[0-5]?\d:[0-5]?\d$/.test(s)) return NaN;
      var parts = s.split(":"), total = 0;
      for(var i = 0; i < parts.length; i++) total = total * 60 + parseInt(parts[i], 10);
      return total;
    }
    if(!/^\d{1,4}$/.test(s)) return NaN;
    if(s.length <= 2) return parseInt(s, 10);
    var sec = parseInt(s.slice(-2), 10);
    if(sec > 59) return NaN;
    return parseInt(s.slice(0, s.length - 2), 10) * 60 + sec;
  }

  // Seconds -> "mm:ss" (minutes shown in full from 100 on).
  function formatMmSs(sec){
    var s = Math.max(0, Math.round(Number(sec) || 0)), m = Math.floor(s / 60), r = s % 60;
    return (m < 10 ? "0" : "") + m + ":" + (r < 10 ? "0" : "") + r;
  }

  function buildVideoRange(tr, item, player){
    var wrap = document.createElement("div");
    wrap.className = "video-range-row";
    var clear = document.createElement("button");
    clear.type = "button"; clear.className = "btn"; clear.textContent = t("loopClear");
    wrap.appendChild(clear);
    function mk(labelKey, ph){
      var lab = document.createElement("label");
      lab.className = "video-range-field";
      var sp = document.createElement("span"); sp.textContent = t(labelKey);
      var inp = document.createElement("input");
      inp.type = "text"; inp.className = "video-range-input"; inp.setAttribute("inputmode", "numeric");
      inp.setAttribute("autocomplete", "off"); inp.placeholder = ph;
      var now = document.createElement("button");
      now.type = "button"; now.className = "icon-btn video-range-now"; now.textContent = "◇";
      now.title = t("loopNow"); now.setAttribute("aria-label", t("loopNow"));
      lab.appendChild(sp); lab.appendChild(inp); lab.appendChild(now); wrap.appendChild(lab);
      inp.addEventListener("input", function(){ inp.value = maskLoopDigits(inp.value); });
      inp.addEventListener("change", commit);
      inp.addEventListener("keydown", function(ev){ if(ev.key === "Enter"){ ev.preventDefault(); inp.blur(); } });
      now.addEventListener("click", function(ev){
        ev.preventDefault();
        inp.value = formatMmSs(Math.floor(player && player.nowT ? player.nowT() : 0));
        commit();
      });
      return inp;
    }
    var inA = mk("loopStart", "00:00"), inB = mk("loopEnd", t("loopToEnd"));

    function show(){
      var l = item.loop;
      inA.value = l && Math.round(l.a) > 0 ? formatMmSs(l.a) : "";
      inB.value = l && typeof l.b === "number" ? formatMmSs(l.b) : "";
      clear.disabled = !l;
    }
    function commit(){
      var a = parseLoopTime(inA.value), b = parseLoopTime(inB.value);
      if(a !== a || b !== b){ showToast(t("loopBadTime"), "error"); show(); return; }
      var dur = player && player.duration ? player.duration() : 0;
      if(b != null && dur > 0 && b >= Math.round(dur)) b = null; // at/after the end = play to the end
      var av = a == null ? 0 : a;
      if((b != null && b <= av) || (dur > 0 && av >= dur) || av > LOOP_MAX_SECONDS || (b != null && b > LOOP_MAX_SECONDS)){
        showToast(t("loopBadRange"), "error"); show(); return;
      }
      setItemLoop(item, b == null ? { a: av } : { a: av, b: b });
      saveDB();
      if(typeof render === "function") render();
      show();
    }
    clear.addEventListener("click", function(){
      if(!item.loop) return;
      setItemLoop(item, null);
      saveDB();
      if(typeof render === "function") render();
      show();
    });
    // End placeholder: the video length once known, else "to the end".
    var phNow = inB.placeholder;
    if(player && player.subscribe) player.subscribe(function(){
      var d = player.duration ? player.duration() : 0;
      var ph = d > 0 ? formatMmSs(d) : t("loopToEnd");
      if(ph !== phNow){ phNow = ph; inB.placeholder = ph; }
    });
    show();
    return wrap;
  }
