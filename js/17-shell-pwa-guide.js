"use strict";
// PWA install guide: when the browser has no native install prompt, show a
// card next to where that browser keeps its "Add to Home Screen" control.
// Desktop and Chrome: top-right (address bar / ⋮ menu); iPhone Safari: bottom
// center (share button); other browsers: centered text only.
var pwaGuideEl = null;

addStrings({
  zh: {
    pwaGuideTitle: "加到主畫面",
    pwaGuideClose: "關閉",
    pwaG_iosSafari: "點下方工具列的「分享」圖示（iOS 26 先點「⋯」）|往下找到「加入主畫面」|點右上角「新增」",
    pwaG_ipadSafari: "點網址列右側的「分享」圖示|找到「加入主畫面」|點「新增」",
    pwaG_iosChrome: "點網址列右側的「分享」圖示|找到「加入主畫面」|點「新增」",
    pwaG_androidChrome: "點右上角「⋮」選單|選「加到主畫面」或「安裝應用程式」|點「安裝」",
    pwaG_desktopChrome: "點網址列右側的「安裝」圖示|沒看到圖示：開右上角選單，找「安裝」|點「安裝」",
    pwaG_desktopSafari: "點上方選單列的「檔案」|選「加入 Dock」",
    pwaG_other: "開啟瀏覽器選單|找「加到主畫面」或「安裝」|找不到的話，請改用 Safari（iPhone）或 Chrome 開啟"
  },
  jp: {
    pwaGuideTitle: "ホーム画面に追加",
    pwaGuideClose: "閉じる",
    pwaG_iosSafari: "下のツールバーの「共有」アイコンをタップ（iOS 26 は先に「⋯」）|「ホーム画面に追加」を探す|右上の「追加」をタップ",
    pwaG_ipadSafari: "アドレスバー右側の「共有」アイコンをタップ|「ホーム画面に追加」を探す|「追加」をタップ",
    pwaG_iosChrome: "アドレスバー右側の「共有」アイコンをタップ|「ホーム画面に追加」を探す|「追加」をタップ",
    pwaG_androidChrome: "右上の「⋮」メニューをタップ|「ホーム画面に追加」または「アプリをインストール」|「インストール」をタップ",
    pwaG_desktopChrome: "アドレスバー右側の「インストール」アイコンをクリック|見つからない場合：右上のメニューから「インストール」を探す|「インストール」をクリック",
    pwaG_desktopSafari: "メニューバーの「ファイル」をクリック|「Dock に追加」を選ぶ",
    pwaG_other: "ブラウザのメニューを開く|「ホーム画面に追加」または「インストール」を探す|見つからない場合は Safari（iPhone）か Chrome で開いてください"
  },
  en: {
    pwaGuideTitle: "Add to Home Screen",
    pwaGuideClose: "Close",
    pwaG_iosSafari: "Tap the Share icon in the bottom toolbar (iOS 26: tap “⋯” first)|Scroll to “Add to Home Screen”|Tap “Add” at the top right",
    pwaG_ipadSafari: "Tap the Share icon right of the address bar|Find “Add to Home Screen”|Tap “Add”",
    pwaG_iosChrome: "Tap the Share icon right of the address bar|Find “Add to Home Screen”|Tap “Add”",
    pwaG_androidChrome: "Tap the “⋮” menu at the top right|Choose “Add to Home screen” or “Install app”|Tap “Install”",
    pwaG_desktopChrome: "Click the Install icon at the right of the address bar|No icon? Open the top-right menu and look for “Install”|Click “Install”",
    pwaG_desktopSafari: "Click “File” in the menu bar|Choose “Add to Dock”",
    pwaG_other: "Open the browser menu|Look for “Add to Home Screen” or “Install”|Not there? Open this site in Safari (iPhone) or Chrome"
  }
});

// env: { ua, platform, maxTouchPoints } -> browser id used by pwaGuideFor.
function pwaBrowserOf(env){
  env = env || {};
  var ua = env.ua || "";
  var ipadOs = env.platform === "MacIntel" && (env.maxTouchPoints || 0) > 1;
  var inApp = /FBAN|FBAV|Instagram|Line\/|MicroMessenger|KAKAOTALK/i.test(ua);
  if(/iphone|ipod/i.test(ua) || /ipad/i.test(ua) || ipadOs){
    if(inApp) return "other";
    if(/CriOS/.test(ua)) return "iosChrome";
    if(/FxiOS|EdgiOS|OPiOS/.test(ua)) return "other";
    return (/ipad/i.test(ua) || ipadOs) ? "ipadSafari" : "iosSafari";
  }
  if(/android/i.test(ua)){
    if(inApp || /SamsungBrowser|EdgA|OPR|Firefox|UCBrowser|YaBrowser|MiuiBrowser/i.test(ua)) return "other";
    return /Chrome\//.test(ua) ? "androidChrome" : "other";
  }
  if(/Firefox\//.test(ua)) return "other";
  if(/Chrome\/|Edg\//.test(ua)) return "desktopChrome";
  if(/Macintosh/.test(ua) && /Safari\//.test(ua)) return "desktopSafari";
  return "other";
}

// -> { pos: "top-right" | "bottom" | "center", key: i18n key of "step|step|step" }
function pwaGuideFor(browser){
  var known = ["iosSafari", "ipadSafari", "iosChrome", "androidChrome", "desktopChrome", "desktopSafari"];
  if(known.indexOf(browser) === -1) return { pos: "center", key: "pwaG_other" };
  return { pos: browser === "iosSafari" ? "bottom" : "top-right", key: "pwaG_" + browser };
}

function pwaHideGuide(){
  if(pwaGuideEl && pwaGuideEl.parentNode) pwaGuideEl.parentNode.removeChild(pwaGuideEl);
  pwaGuideEl = null;
}

function pwaShowGuide(){
  pwaHideGuide();
  if(typeof document === "undefined" || !document.body) return;
  var g = pwaGuideFor(pwaBrowserOf(pwaEnv()));
  var steps = t(g.key).split("|");
  pwaGuideEl = document.createElement("div");
  pwaGuideEl.className = "pwa-guide-overlay";
  pwaGuideEl.innerHTML =
    '<div class="pwa-guide pwa-guide-' + g.pos + '" role="dialog">' +
      '<div class="pwa-guide-head">' +
        '<div class="pwa-guide-title">' + escapeHtml(t("pwaGuideTitle")) + '</div>' +
        '<button type="button" class="btn btn-ghost btn-sm pwa-banner-x" data-pwa-guide="close" aria-label="' +
          escapeHtml(t("pwaGuideClose")) + '">✕</button>' +
      '</div>' +
      '<ol class="pwa-guide-steps">' + steps.map(function(s){ return '<li>' + escapeHtml(s) + '</li>'; }).join("") + '</ol>' +
    '</div>';
  pwaGuideEl.addEventListener("click", function(e){
    var inCard = e.target && e.target.closest && e.target.closest(".pwa-guide");
    if(!inCard || e.target.closest("[data-pwa-guide]")) pwaHideGuide();
  });
  document.body.appendChild(pwaGuideEl);
}
