"use strict";

  /* ============================================================
     COLOR PALETTE & ICON SET (Notion-like)
  ============================================================ */
  var COLOR_PALETTE = [
    { key:"default", hex:"#9B9A97" },
    { key:"gray",    hex:"#8B8A86" },
    { key:"brown",   hex:"#A87A56" },
    { key:"orange",  hex:"#D9822B" },
    { key:"yellow",  hex:"#DFAB01" },
    { key:"green",   hex:"#4F9768" },
    { key:"teal",    hex:"#2F9E8F" },
    { key:"blue",    hex:"#3B82C4" },
    { key:"purple",  hex:"#9065B0" },
    { key:"pink",    hex:"#C14C8A" },
    { key:"red",     hex:"#D44C47" }
  ];
  function colorHex(key){
    var found = COLOR_PALETTE.find(function(c){ return c.key===key; });
    return found ? found.hex : COLOR_PALETTE[0].hex;
  }
  function hexToRgba(hex, alpha){
    var r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
    return "rgba(" + r + "," + g + "," + b + "," + alpha + ")";
  }
  var ICON_EMOJI_GROUPS = [
    ["📌","✨","❤️","🔥","👍","💡","🔰","💎"],
    ["📆","🎯","🎲","⚔️","🏆","🥇","🥈","🥉"],
    ["🗂️","📓","📕","📗","📘","📙","📄","📖"],
    ["✈️","🌍","🕯️","🕊️","🌙","🪓","🪝","🛸"],
    ["🌀","☁️","🌪️","⚡","🦵","💪","🤹","🍞"]
  ];
  // Icon text limit: 2 width units (full-width = 2, half-width = 1), counted per code point.
  // Emoji (any sequence), image icons ("img:...") and empty always fit. Checked on save /
  // picker close, never while typing (truncating mid-input breaks IME composition).
  // Needs isLikelyEmojiIcon / charDisplayWidth from 05-data-util.js (resolved at call time).
  var ICON_TEXT_MAX_UNITS = 2;
  function iconTextFits(str){
    str = String(str == null ? "" : str).trim();
    if(!str) return true;
    if(str.indexOf("img:") === 0 || isLikelyEmojiIcon(str)) return true;
    var chars = Array.from(str), w = 0;
    for(var i = 0; i < chars.length; i++) w += charDisplayWidth(chars[i]);
    return w <= ICON_TEXT_MAX_UNITS;
  }
  var ICON_EMOJI_SET = ICON_EMOJI_GROUPS.reduce(function(a,b){ return a.concat(b); }, []);

  // Landing-rate colors: one blue family, stronger as the rate rises. The real hex values
  // live in css/variables-and-base.css (--rate-none/rare/sometimes/most/mastered, plus
  // matching -ink text colors) per theme, so a theme switch restyles without JS.
  // RATE_COLORS holds var() refs usable in style.background / color / box-shadow.
  var RATE_COLORS = {
    none:      "var(--rate-none)",
    rare:      "var(--rate-rare)",
    sometimes: "var(--rate-sometimes)",
    most:      "var(--rate-most)",
    mastered:  "var(--rate-mastered)"
  };
  // Color ref for a rate level (null/unknown -> the "none" step).
  function rateColor(level){ return RATE_COLORS[level] || RATE_COLORS.none; }
  // Glow box-shadow layers for a level; "" for null/none (no rate = no glow).
  function rateGlowShadow(level){
    if(!level || level === "none" || !RATE_COLORS[level]) return "";
    var c = RATE_COLORS[level];
    return "0 0 0 1px color-mix(in srgb, " + c + " 55%, transparent), 0 0 14px 2px color-mix(in srgb, " + c + " 65%, transparent)";
  }

  // i18n strings for the data model (parts, grips, rates, landed). Registered via
  // addStrings() in 04-state.js, because 03-i18n.js loads after this file.
  var DATA_MODEL_STRINGS = {
    zh: {
      grip_ken:"持劍", grip_tama:"持球", grip_ito:"持線",
      rate_rare:"罕見", rate_sometimes:"有時", rate_most:"多數", rate_mastered:"熟練",
      rateHint_rare:"約 1/10", rateHint_sometimes:"約 3/10", rateHint_most:"約 5/10", rateHint_mastered:"約 8/10",
      landed:"成招", notLanded:"無成招",
      iconTextTooLong:"圖示文字過長：最多 1 個全形字或 2 個半形字"
    },
    jp: {
      grip_ken:"けん持ち", grip_tama:"玉持ち", grip_ito:"糸持ち",
      rate_rare:"たまに", rate_sometimes:"ときどき", rate_most:"だいたい", rate_mastered:"得意",
      rateHint_rare:"約1/10", rateHint_sometimes:"約3/10", rateHint_most:"約5/10", rateHint_mastered:"約8/10",
      landed:"成功", notLanded:"未成功",
      iconTextTooLong:"アイコン文字が長すぎます：全角1文字か半角2文字まで"
    },
    en: {
      grip_ken:"Hold ken", grip_tama:"Hold ball", grip_ito:"Hold string",
      rate_rare:"Rarely", rate_sometimes:"Sometimes", rate_most:"Mostly", rate_mastered:"Mastered",
      rateHint_rare:"about 1/10", rateHint_sometimes:"about 3/10", rateHint_most:"about 5/10", rateHint_mastered:"about 8/10",
      landed:"Landed", notLanded:"Not landed",
      iconTextTooLong:"Icon text too long: 1 full-width or 2 half-width characters max"
    }
  };
