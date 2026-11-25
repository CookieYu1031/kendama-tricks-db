"use strict";

  /* ============================================================
     CUSTOM COLOUR MODAL (opened by the 自訂 pill in the icon/colour picker, js/43)
     Hex box + inline saturation/value square + hue slider + 3 recent colours.
     Pure helpers first (hex <-> HSV, recent list), UI below.
  ============================================================ */
  addStrings({
    zh:{ customColorTitle:"自訂顏色", customColorConfirm:"確認", customColorRecent:"最近使用", customColorClose:"關閉" },
    jp:{ customColorTitle:"カスタムカラー", customColorConfirm:"決定", customColorRecent:"最近使った色", customColorClose:"閉じる" },
    en:{ customColorTitle:"Custom colour", customColorConfirm:"OK", customColorRecent:"Recent", customColorClose:"Close" }
  });

  var RECENT_COLORS_KEY = "kendama-recent-colors-v1";
  var RECENT_COLORS_MAX = 3;

  // "#rrggbb" -> { h:0-360, s:0-1, v:0-1 }; invalid -> null.
  function hexToHsv(hex){
    hex = normalizeHexColor(hex);
    if(!hex) return null;
    var r = parseInt(hex.slice(1,3),16)/255, g = parseInt(hex.slice(3,5),16)/255, b = parseInt(hex.slice(5,7),16)/255;
    var max = Math.max(r,g,b), min = Math.min(r,g,b), d = max - min, h = 0;
    if(d){
      if(max === r) h = ((g - b) / d) % 6;
      else if(max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h *= 60; if(h < 0) h += 360;
    }
    return { h:h, s: max ? d / max : 0, v:max };
  }
  // h 0-360, s/v 0-1 (clamped) -> "#rrggbb".
  function hsvToHex(h, s, v){
    h = ((Number(h) || 0) % 360 + 360) % 360;
    s = Math.min(1, Math.max(0, Number(s) || 0));
    v = Math.min(1, Math.max(0, Number(v) || 0));
    var c = v * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = v - c, r = 0, g = 0, b = 0;
    if(h < 60){ r = c; g = x; }
    else if(h < 120){ r = x; g = c; }
    else if(h < 180){ g = c; b = x; }
    else if(h < 240){ g = x; b = c; }
    else if(h < 300){ r = x; b = c; }
    else { r = c; b = x; }
    function p(n){ var k = Math.round((n + m) * 255).toString(16); return k.length < 2 ? "0" + k : k; }
    return "#" + p(r) + p(g) + p(b);
  }
  // Most-recent-first, de-duplicated, capped list; invalid hex leaves the list unchanged.
  function addRecentColor(list, hex){
    hex = normalizeHexColor(hex);
    var out = (list || []).map(normalizeHexColor).filter(function(h){ return h; });
    if(!hex) return out.slice(0, RECENT_COLORS_MAX);
    out = out.filter(function(h){ return h !== hex; });
    out.unshift(hex);
    return out.slice(0, RECENT_COLORS_MAX);
  }
  function loadRecentColors(){
    try{ return addRecentColor(JSON.parse(localStorage.getItem(RECENT_COLORS_KEY) || "[]"), ""); }
    catch(e){ return []; }
  }
  function saveRecentColors(list){
    try{ localStorage.setItem(RECENT_COLORS_KEY, JSON.stringify(list)); }catch(e){}
  }

  /* ---- UI ---- */
  var ccm = { hsv:{ h:0, s:0, v:1 }, hex:"#ffffff", onDone:null, open:false, bound:false };
  function ccmEl(id){ return document.getElementById(id); }

  function ccmPaint(skipText){
    var hex = hsvToHex(ccm.hsv.h, ccm.hsv.s, ccm.hsv.v);
    // keep the typed hex when it is the exact colour (HSV round-trip may differ by 1 unit)
    if(!skipText) ccmEl("ccmHex").value = hex;
    ccm.hex = skipText ? (normalizeHexColor(ccmEl("ccmHex").value) || ccm.hex) : hex;
    ccmEl("ccmPreview").style.background = ccm.hex;
    ccmEl("ccmSV").style.backgroundColor = hsvToHex(ccm.hsv.h, 1, 1);
    var k = ccmEl("ccmSVKnob");
    k.style.left = (ccm.hsv.s * 100) + "%"; k.style.top = ((1 - ccm.hsv.v) * 100) + "%";
    k.style.background = ccm.hex;
    var hk = ccmEl("ccmHueKnob");
    hk.style.left = (ccm.hsv.h / 360 * 100) + "%";
    hk.style.background = hsvToHex(ccm.hsv.h, 1, 1);
    Array.prototype.forEach.call(ccmEl("ccmSlots").children, function(b){
      b.classList.toggle("selected", b.getAttribute("data-hex") === ccm.hex);
    });
  }
  function ccmSetHex(hex){
    var hsv = hexToHsv(hex);
    if(!hsv) return;
    // grey / black have no meaningful hue: keep the current one so the slider doesn't jump
    if(hsv.s === 0 || hsv.v === 0) hsv.h = ccm.hsv.h;
    ccm.hsv = hsv;
    ccmEl("ccmHex").classList.remove("invalid"); ccmEl("ccmError").classList.remove("show");
    ccmPaint(false);
    ccmEl("ccmHex").value = normalizeHexColor(hex);
    ccm.hex = normalizeHexColor(hex);
    ccmEl("ccmPreview").style.background = ccm.hex;
  }
  function ccmRenderSlots(){
    var box = ccmEl("ccmSlots");
    box.innerHTML = "";
    var list = loadRecentColors();
    for(var i = 0; i < RECENT_COLORS_MAX; i++){
      var b = document.createElement("button");
      b.type = "button";
      if(list[i]){
        b.className = "ccm-slot"; b.style.background = list[i]; b.setAttribute("data-hex", list[i]);
        b.title = list[i]; b.setAttribute("aria-label", list[i]);
        (function(h){ b.addEventListener("click", function(){ ccmSetHex(h); }); })(list[i]);
      } else {
        b.className = "ccm-slot empty"; b.disabled = true; b.setAttribute("aria-hidden", "true");
      }
      box.appendChild(b);
    }
  }
  // Pointer drag on a track: cb(x 0-1, y 0-1). Works with mouse, touch and pen.
  function ccmDrag(el, cb){
    function at(ev){
      var r = el.getBoundingClientRect();
      cb(Math.min(1, Math.max(0, (ev.clientX - r.left) / (r.width || 1))), Math.min(1, Math.max(0, (ev.clientY - r.top) / (r.height || 1))));
    }
    el.addEventListener("pointerdown", function(ev){
      ev.preventDefault();
      try{ el.setPointerCapture(ev.pointerId); }catch(e){}
      el._ccmDown = true; at(ev);
    });
    el.addEventListener("pointermove", function(ev){ if(el._ccmDown) at(ev); });
    function up(){ el._ccmDown = false; }
    el.addEventListener("pointerup", up); el.addEventListener("pointercancel", up);
  }
  function ccmBind(){
    if(ccm.bound) return;
    ccm.bound = true;
    ccmDrag(ccmEl("ccmSV"), function(x, y){ ccm.hsv.s = x; ccm.hsv.v = 1 - y; ccmEl("ccmHex").classList.remove("invalid"); ccmEl("ccmError").classList.remove("show"); ccmPaint(false); });
    ccmDrag(ccmEl("ccmHue"), function(x){ ccm.hsv.h = Math.min(359.99, x * 360); ccmEl("ccmHex").classList.remove("invalid"); ccmEl("ccmError").classList.remove("show"); ccmPaint(false); });
    var inp = ccmEl("ccmHex");
    // Entering the field selects the whole code; a later click places the caret as usual (a drag keeps its own selection).
    var ccmFresh = false;
    inp.addEventListener("focus", function(){ ccmFresh = true; inp.select(); });
    inp.addEventListener("blur", function(){ ccmFresh = false; });
    inp.addEventListener("click", function(){
      if(ccmFresh && inp.selectionStart === inp.selectionEnd) inp.select(); // the click itself collapsed it
      ccmFresh = false;
    });
    inp.addEventListener("input", function(){
      var v = inp.value.trim();
      if(!v){ inp.classList.remove("invalid"); ccmEl("ccmError").classList.remove("show"); return; }
      var h = normalizeHexColor(v.charAt(0) === "#" ? v : "#" + v);
      if(h){
        var hsv = hexToHsv(h);
        if(hsv.s === 0 || hsv.v === 0) hsv.h = ccm.hsv.h;
        ccm.hsv = hsv;
        inp.classList.remove("invalid"); ccmEl("ccmError").classList.remove("show");
        ccmPaint(true); // keep what the player is typing
        ccm.hex = h; ccmEl("ccmPreview").style.background = h;
      } else { inp.classList.add("invalid"); ccmEl("ccmError").classList.add("show"); }
    });
    ccmEl("ccmOkBtn").addEventListener("click", confirmCustomColor);
    ccmEl("ccmCloseBtn").addEventListener("click", closeCustomColor);
    ccmEl("customColorOverlay").addEventListener("click", function(ev){ if(ev.target.id === "customColorOverlay") closeCustomColor(); });
    // Esc closes only this modal (capture phase, before the picker's handler in js/90).
    document.addEventListener("keydown", function(ev){
      if(ev.key === "Escape" && ccm.open){ ev.stopImmediatePropagation(); ev.preventDefault(); closeCustomColor(); }
    }, true);
  }
  // startHex: current colour (any CSS hex or ""); onDone(hex) runs only on 確認.
  function openCustomColor(startHex, onDone){
    ccmBind();
    ccm.onDone = onDone;
    ccmEl("ccmTitle").textContent = t("customColorTitle");
    ccmEl("ccmOkBtn").textContent = t("customColorConfirm");
    ccmEl("ccmCloseBtn").setAttribute("aria-label", t("customColorClose"));
    ccmEl("ccmCloseBtn").innerHTML = typeof ICON_X === "string" ? ICON_X : "&times;";
    ccmEl("ccmError").textContent = t("colorHexInvalid");
    ccmEl("ccmRecentLabel").textContent = t("customColorRecent");
    ccmRenderSlots();
    ccm.hsv = { h:0, s:0, v:1 };
    ccmSetHex(normalizeHexColor(startHex) || "#8b8a86");
    ccm.open = true;
    ccmEl("customColorOverlay").classList.add("show");
  }
  function closeCustomColor(){
    ccm.open = false; ccm.onDone = null;
    ccmEl("customColorOverlay").classList.remove("show");
  }
  function confirmCustomColor(){
    var hex = normalizeHexColor(ccmEl("ccmHex").value);
    if(!hex){ ccmEl("ccmHex").classList.add("invalid"); ccmEl("ccmError").classList.add("show"); return; }
    saveRecentColors(addRecentColor(loadRecentColors(), hex));
    var cb = ccm.onDone;
    closeCustomColor();
    if(typeof cb === "function") cb(hex);
  }
