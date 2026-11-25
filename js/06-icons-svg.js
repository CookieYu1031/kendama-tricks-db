"use strict";

  /* ============================================================
     ICONS
  ============================================================ */
  var ICON_LIST = '<svg viewBox="0 0 24 24" fill="none"><path d="M5 7h14M5 12h14M5 17h14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
  var ICON_PLAY = '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8"/><path d="M10 8.5l6 3.5-6 3.5v-7z" fill="currentColor"/></svg>';
  // Default trick icon: 「◉」 (ring + centre dot).
  var ICON_TRICK = '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="8.5" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="12" r="4" fill="currentColor"/></svg>';
  var ICON_CHEVRON = '<svg viewBox="0 0 24 24" fill="none"><path d="M9 6l6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var ICON_EDIT = '<svg viewBox="0 0 24 24" fill="none"><path d="M4 20l.7-3.6L16.3 4.8a1.5 1.5 0 012.1 0l.8.8a1.5 1.5 0 010 2.1L7.6 19.3 4 20z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>';
  /* Rail mode button (js/12): pen = ICON_EDIT; tray-with-arrow = submissions; eye = back to view mode. */
  var ICON_CHECK = '<svg viewBox="0 0 24 24" fill="none"><path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var ICON_TRASH = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M8.6 5.2l.9-1.5a1.4 1.4 0 0 1 1.2-.7h2.6a1.4 1.4 0 0 1 1.2.7l.9 1.5z" fill="currentColor" stroke-width="1"/><path d="M3.6 5.6h16.8" stroke-width="1.9"/><path d="M5.6 5.6l1 13.5a2 2 0 0 0 2 1.9h6.8a2 2 0 0 0 2-1.9l1-13.5" stroke-width="1.9"/><path d="M9.1 9.2l.5 8M12 9.2v8M14.9 9.2l-.5 8" stroke-width="1.4"/></svg>';
  // touch toolbar (js/25-browse-touchbar.js): scissors = cut, two sheets = copy, clipboard = paste
  var ICON_SCISSORS = '<svg viewBox="0 0 24 24" fill="none"><circle cx="6" cy="6.5" r="2.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><circle cx="6" cy="17.5" r="2.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 8l12 9M8 16L20 7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var ICON_COPY = '<svg viewBox="0 0 24 24" fill="none"><rect x="9" y="9" width="11" height="11" rx="2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M5 15V6a2 2 0 012-2h9" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var ICON_PASTE = '<svg viewBox="0 0 24 24" fill="none"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><rect x="9" y="3" width="6" height="4" rx="1" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var ICON_PLUS = '<svg viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
  var ICON_LINK = '<svg viewBox="0 0 24 24" fill="none"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var ICON_EMPTY = '<svg viewBox="0 0 24 24" fill="none"><path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>';
  var ICON_ARROW_LEFT = '<svg viewBox="0 0 24 24" fill="none"><path d="M15 6l-6 6 6 6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var ICON_MIRROR = '<svg viewBox="0 0 24 24" fill="none"><path d="M12 3v18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-dasharray="2 2.6"/><path d="M9 7L3.5 17H9V7z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M15 7l5.5 10H15V7z" fill="currentColor" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>';
  var ICON_X = '<svg viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>';
  var ICON_DROPPER = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20.2 3.8a2 2 0 0 1 0 2.8l-1.6 1.6-2.8-2.8 1.6-1.6a2 2 0 0 1 2.8 0z"/><path d="M16.2 8.1l-9 9a1.6 1.6 0 0 0-.45.9L6.4 20l-.4 1.4 1.4-.4 2-.35a1.6 1.6 0 0 0 .9-.45l9-9"/></svg>';
  var ICON_BRUSH = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20.3 3.7c.6.6.6 1.5 0 2.1l-7.4 7.4-2.1-2.1 7.4-7.4c.6-.6 1.5-.6 2.1 0z"/><path d="M10.8 11.1c-1.9-.3-3.5.8-3.6 2.6-.1 1.4-.7 2.4-2.2 2.9 1.9 1.4 5 1.3 6.3-.3.9-1 .9-2.6-.5-5.2z"/></svg>';
  var ICON_STATS ='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h16"/><path d="M7 20v-7M12 20V5M17 20v-10"/></svg>';
  var ICON_BELL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 16V11a6 6 0 0112 0v5l1.5 2h-15L6 16z"/><path d="M10 21h4"/></svg>';
  var ICON_SHIELD = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3z"/><path d="M9 12l2 2 4-4"/></svg>';
  var ICON_USER = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-6 8-6s8 2 8 6"/></svg>';


  /* Image icons: icon value "img:assets/<file>.<png|jpg|jpeg|webp|gif|svg>" (relative, under
     assets/ only — never an arbitrary URL). Anything else is treated as emoji/text. */
  var IMAGE_ICON_RE = /^img:assets\/[A-Za-z0-9_\-]+(\/[A-Za-z0-9_\-]+)*\.(png|jpe?g|webp|gif|svg)$/i;
  // Admin-picked images are stored inline: "img:data:image/(png|webp|jpeg);base64,<payload>" (<= 64 KB).
  var IMAGE_ICON_DATA_RE = /^img:data:image\/(png|webp|jpeg);base64,[A-Za-z0-9+\/]+={0,2}$/;
  var IMAGE_ICON_DATA_MAX = 65536;
  function isImageIcon(icon){
    if(typeof icon !== "string") return false;
    if(IMAGE_ICON_RE.test(icon)) return true;
    return icon.length <= IMAGE_ICON_DATA_MAX && IMAGE_ICON_DATA_RE.test(icon);
  }
  // Safe src of an image icon (relative assets path or data URL), or "" when invalid.
  function imageIconSrc(icon){ return isImageIcon(icon) ? icon.slice(4) : ""; }
  // Every delete button reads the same: trash icon + 「移除」 (class col-add-btn col-add-btn-danger col-add-btn-del).
  if(typeof addStrings === "function") addStrings({ zh:{ removeBtn:"移除" }, jp:{ removeBtn:"削除" }, en:{ removeBtn:"Remove" } });
  function removeBtnHtml(){ return ICON_TRASH + "<span>" + escapeHtml(t("removeBtn")) + "</span>"; }

  // HTML for an icon box: <img> for image icons, escaped text for emoji, `fallback` (svg) when empty.
  function iconHtml(icon, fallback){
    if(isImageIcon(icon)) return '<img class="icon-img" src="' + escapeHtml(imageIconSrc(icon)) + '" alt="" draggable="false">';
    return icon ? escapeHtml(icon) : (fallback || "");
  }
