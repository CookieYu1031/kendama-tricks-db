"use strict";

  /* ============================================================
     BOOT SPLASH (v0.18.4) — loading screen shown from the very first paint.
     Markup, styles and the no-JS-yet text / failure timer live inline at the top of <body> in index.html
     (they must paint before the stylesheets and scripts arrive). This file only decides when it goes away:
     cached data -> right after the first render (js/90); else when the first cloud / guest load settles
     (js/59); BOOT_SPLASH_MAX at the latest.
  ============================================================ */
  var BOOT_SPLASH_MAX = 9000;
  var BOOT_SPLASH_FADE = 280;

  // Pure: is there something to show without waiting for the network?
  function bootHasCache(hasUserCache, d){
    return !!hasUserCache && !!d && ((d.tricks || []).length > 0 || (d.categories || []).length > 0);
  }
  function bootSplashActive(){
    var el = document.getElementById("bootSplash");
    return !!el && !el.classList.contains("done");
  }
  function bootSplashDone(){
    var el = document.getElementById("bootSplash");
    if(!el || el.classList.contains("done")) return;
    el.classList.add("done");
    document.documentElement.style.background = "";
    if(window.__bootTimers) window.__bootTimers.forEach(clearTimeout);
    setTimeout(function(){ if(el.parentNode) el.parentNode.removeChild(el); }, BOOT_SPLASH_FADE + 40);
  }
