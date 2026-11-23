"use strict";
// PWA: service worker registration, online/offline toasts, install prompt
// (settings row + one-off bottom banner). Non-mandatory feature.
var PWA_LAUNCH_KEY = "kendama-pwa-launches-v1";
var PWA_DISMISS_KEY = "kendama-pwa-banner-dismissed-v1";
var pwaDeferred = null;
var pwaInstalledFlag = false;
var pwaBannerEl = null;

addStrings({
  zh: {
    pwaInstall: "加到主畫面",
    pwaInstallDesktop: "建立桌面捷徑",
    pwaInstalled: "已安裝",
    pwaBannerTitle: "把劍玉招式庫加到主畫面",
    pwaBannerBody: "像 App 一樣開啟，離線也能看。",
    pwaBannerInstall: "加到主畫面",
    pwaBannerDismiss: "關閉",
    pwaOffline: "目前離線，變更會在連線後同步",
    pwaOnline: "已重新連線"
  },
  jp: {
    pwaInstall: "ホーム画面に追加",
    pwaInstallDesktop: "デスクトップにショートカット作成",
    pwaInstalled: "インストール済み",
    pwaBannerTitle: "劍玉招式庫をホーム画面に追加",
    pwaBannerBody: "アプリのように開けて、オフラインでも見られます。",
    pwaBannerInstall: "追加",
    pwaBannerDismiss: "閉じる",
    pwaOffline: "オフラインです。変更は接続後に同期されます",
    pwaOnline: "オンラインに戻りました"
  },
  en: {
    pwaInstall: "Add to Home Screen",
    pwaInstallDesktop: "Create desktop shortcut",
    pwaInstalled: "Installed",
    pwaBannerTitle: "Add Kendama Trick DB to your device",
    pwaBannerBody: "Opens like an app and works offline.",
    pwaBannerInstall: "Add",
    pwaBannerDismiss: "Dismiss",
    pwaOffline: "You are offline. Changes will sync when back online",
    pwaOnline: "Back online"
  }
});

// env: { standalone, deferred, ua, platform, maxTouchPoints }
function pwaInstallState(env){
  env = env || {};
  if(env.standalone) return "installed";
  if(env.deferred) return "available";
  var ua = env.ua || "";
  var ios = /iphone|ipad|ipod/i.test(ua) ||
    (env.platform === "MacIntel" && (env.maxTouchPoints || 0) > 1);
  if(ios) return "ios";
  return "unsupported";
}

function pwaIsTouch(){
  var nav = (typeof navigator !== "undefined" && navigator) || {};
  try {
    if(typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches) return true;
  } catch(e){}
  return (nav.maxTouchPoints || 0) > 0 && /android|iphone|ipad|ipod|mobile/i.test(nav.userAgent || "");
}

function pwaEnv(){
  var nav = (typeof navigator !== "undefined" && navigator) || {};
  var standalone = !!nav.standalone || pwaInstalledFlag;
  try {
    if(typeof matchMedia === "function" && matchMedia("(display-mode: standalone)").matches) standalone = true;
  } catch(e){}
  return {
    standalone: standalone,
    deferred: !!pwaDeferred,
    ua: nav.userAgent || "",
    platform: nav.platform || "",
    maxTouchPoints: nav.maxTouchPoints || 0
  };
}

function shouldShowPwaBanner(state, launches, dismissed, tourActive){
  if(state !== "available" && state !== "ios") return false;
  if(dismissed || tourActive) return false;
  return (launches || 0) >= 2;
}

function pwaGetLaunches(){
  var n = parseInt(localStorage.getItem(PWA_LAUNCH_KEY), 10);
  return isNaN(n) ? 0 : n;
}

function pwaIsDismissed(){
  return localStorage.getItem(PWA_DISMISS_KEY) === "1";
}

function pwaHideBanner(){
  if(pwaBannerEl && pwaBannerEl.parentNode) pwaBannerEl.parentNode.removeChild(pwaBannerEl);
  pwaBannerEl = null;
}

function pwaDismiss(){
  localStorage.setItem(PWA_DISMISS_KEY, "1");
  pwaHideBanner();
}

function pwaPromptInstall(){
  if(!pwaDeferred) return;
  var ev = pwaDeferred;
  pwaDeferred = null;
  ev.prompt();
  if(ev.userChoice && ev.userChoice.then){
    ev.userChoice.then(function(c){
      if(c && c.outcome === "accepted") pwaDismiss();
      renderPwaSettingsRow();
    });
  }
}

function renderPwaBanner(){
  if(!pwaBannerEl) return;
  pwaBannerEl.innerHTML =
    '<div class="pwa-banner-text">' +
      '<div class="pwa-banner-title">' + escapeHtml(t("pwaBannerTitle")) + '</div>' +
      '<div class="pwa-banner-body">' + escapeHtml(t("pwaBannerBody")) + '</div>' +
    '</div>' +
    '<button type="button" class="btn btn-primary btn-sm" data-pwa="install">' + escapeHtml(t("pwaBannerInstall")) + '</button>' +
    '<button type="button" class="btn btn-ghost btn-sm pwa-banner-x" data-pwa="dismiss" aria-label="' + escapeHtml(t("pwaBannerDismiss")) + '">✕</button>';
}

function pwaShowBanner(){
  if(pwaBannerEl || typeof document === "undefined" || !document.body) return;
  pwaBannerEl = document.createElement("div");
  pwaBannerEl.className = "pwa-banner";
  pwaBannerEl.setAttribute("role", "dialog");
  pwaBannerEl.addEventListener("click", function(e){
    var b = e.target && e.target.closest ? e.target.closest("[data-pwa]") : null;
    if(!b) return;
    var act = b.getAttribute("data-pwa");
    if(act === "install") pwaInstallAction();
    pwaDismiss();
  });
  document.body.appendChild(pwaBannerEl);
  renderPwaBanner();
}

function pwaMaybeShowBanner(tries){
  if(pwaBannerEl) return;
  tries = tries || 0;
  if(typeof isTourActive === "function" && isTourActive()){
    if(tries < 5) setTimeout(function(){ pwaMaybeShowBanner(tries + 1); }, 8000);
    return;
  }
  if(shouldShowPwaBanner(pwaInstallState(pwaEnv()), pwaGetLaunches(), pwaIsDismissed(), false)) pwaShowBanner();
}

// Settings row: label only (no note under it); disabled once installed.
function renderPwaSettingsRow(){
  var btn = document.getElementById("settingsInstallBtn");
  if(!btn) return;
  var label = document.getElementById("settingsInstallLabel");
  var installed = pwaInstallState(pwaEnv()) === "installed";
  if(label) label.textContent = installed ? t("pwaInstalled") : t(pwaIsTouch() ? "pwaInstall" : "pwaInstallDesktop");
  btn.disabled = installed;
  renderPwaBanner();
}

// Native prompt when the browser offers one; otherwise the per-browser guide (js/17-shell-pwa-guide.js).
function pwaInstallAction(){
  var state = pwaInstallState(pwaEnv());
  if(state === "installed") return;
  if(state === "available") pwaPromptInstall();
  else pwaShowGuide();
}

function pwaCanRegister(){
  if(typeof navigator === "undefined" || !navigator.serviceWorker || typeof location === "undefined") return false;
  return location.protocol === "https:" || location.hostname === "localhost" || location.hostname === "127.0.0.1";
}

function pwaInit(){
  if(typeof window.addEventListener !== "function") return;
  window.addEventListener("beforeinstallprompt", function(e){
    e.preventDefault();
    pwaDeferred = e;
    renderPwaSettingsRow();
    pwaMaybeShowBanner();
  });
  window.addEventListener("appinstalled", function(){
    pwaInstalledFlag = true;
    pwaDeferred = null;
    pwaDismiss();
    renderPwaSettingsRow();
  });
  window.addEventListener("offline", function(){ showToast(t("pwaOffline")); });
  window.addEventListener("online", function(){ showToast(t("pwaOnline")); });
  window.addEventListener("load", function(){
    if(pwaCanRegister()) navigator.serviceWorker.register("sw.js").catch(function(){});
    renderPwaSettingsRow();
    setTimeout(function(){ pwaMaybeShowBanner(); }, 4000);
  });
  localStorage.setItem(PWA_LAUNCH_KEY, String(pwaGetLaunches() + 1));
  var btn = document.getElementById("settingsInstallBtn");
  if(btn) btn.addEventListener("click", pwaInstallAction);
}

function pwaMarkStandalone(){
  try{
    if(pwaEnv().standalone && document.documentElement) document.documentElement.classList.add("is-standalone");
  }catch(e){}
}

pwaInit();
pwaMarkStandalone();
