"use strict";

  /* ============================================================
     SHELL — theme preference (system / dark / light)
     Only sets <html data-theme="dark|light">; the light palette itself
     lives in CSS (later task).
  ============================================================ */
  var THEME_KEY = "kendama-theme-v1";
  var THEME_PREFS = ["system", "dark", "light"];

  function normalizeThemePref(v){
    return THEME_PREFS.indexOf(v) !== -1 ? v : "system";
  }
  function getThemePref(){
    var v = null;
    try{ v = localStorage.getItem(THEME_KEY); }catch(e){}
    return normalizeThemePref(v);
  }
  // pref + whether the OS prefers dark -> the concrete theme to apply.
  function resolveTheme(pref, systemPrefersDark){
    pref = normalizeThemePref(pref);
    if(pref === "system") return systemPrefersDark ? "dark" : "light";
    return pref;
  }
  function systemPrefersDark(){
    try{
      if(typeof window !== "undefined" && typeof window.matchMedia === "function"){
        return !!window.matchMedia("(prefers-color-scheme: dark)").matches;
      }
    }catch(e){}
    return true; // no matchMedia: the app's existing look is dark
  }
  function applyTheme(){
    var theme = resolveTheme(getThemePref(), systemPrefersDark());
    if(typeof document !== "undefined" && document.documentElement){
      document.documentElement.setAttribute("data-theme", theme);
      if(document.documentElement.style) document.documentElement.style.colorScheme = theme;
      var meta = document.querySelector && document.querySelector('meta[name="theme-color"]');
      if(meta) meta.setAttribute("content", theme === "light" ? "#F4F1EA" : "#121212");
    }
    return theme;
  }
  function setThemePref(v){
    v = normalizeThemePref(v);
    try{ localStorage.setItem(THEME_KEY, v); }catch(e){}
    applyTheme();
    if(typeof renderSettingsUI === "function") renderSettingsUI();
  }

  // Follow OS changes while the preference is "system".
  (function(){
    try{
      if(typeof window === "undefined" || typeof window.matchMedia !== "function") return;
      var mq = window.matchMedia("(prefers-color-scheme: dark)");
      var onChange = function(){ if(getThemePref() === "system") applyTheme(); };
      if(mq.addEventListener) mq.addEventListener("change", onChange);
      else if(mq.addListener) mq.addListener(onChange);
    }catch(e){}
  })();

  applyTheme();
