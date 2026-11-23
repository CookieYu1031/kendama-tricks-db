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
      // grip_<key> = full label (view chips, mailbox...); gripS_<key> = short label (picker chips)
      grip_ken:"持劍", grip_ken_ken:"持劍", grip_ken_sara:"持皿", grip_ken_candle:"持蠟燭",
      grip_ken_gun:"持轉劍", grip_ken_space:"持劍尾", grip_ken_stall:"持極意", grip_ken_swivel:"扣皿",
      grip_ken_down:"持殺", grip_tama:"持球", grip_tama_tama:"持球", grip_tama_stunt:"持重力機",
      grip_ito:"持線", grip_ito_hang:"提線", grip_ito_lighthouse:"提燈台", grip_ito_spike:"提收劍",
      grip_ito_tornado:"持龍捲風",
      gripS_ken:"持劍", gripS_ken_ken:"持劍", gripS_ken_sara:"持皿", gripS_ken_candle:"蠟燭",
      gripS_ken_gun:"轉劍", gripS_ken_space:"持劍尾", gripS_ken_stall:"極意", gripS_ken_swivel:"扣皿",
      gripS_ken_down:"殺", gripS_tama:"持球", gripS_tama_tama:"持球", gripS_tama_stunt:"重力機",
      gripS_ito:"持線", gripS_ito_hang:"提線", gripS_ito_lighthouse:"提燈台", gripS_ito_spike:"收劍提線",
      gripS_ito_tornado:"龍捲風",
      rate_rare:"罕見", rate_sometimes:"有時", rate_most:"多數", rate_mastered:"熟練",
      rateHint_rare:"約 1/10", rateHint_sometimes:"約 3/10", rateHint_most:"約 5/10", rateHint_mastered:"約 8/10",
      landed:"成招", notLanded:"無成招",
      iconTextTooLong:"圖示文字過長：最多 1 個全形字或 2 個半形字"
    },
    jp: {
      // grip_<key> = full label (view chips, mailbox...); gripS_<key> = short label (picker chips)
      grip_ken:"けん持ち", grip_ken_ken:"けん持ち", grip_ken_sara:"皿持ち", grip_ken_candle:"キャンドル持ち",
      grip_ken_gun:"ガンスリンガー持ち", grip_ken_space:"スペースウォーク持ち", grip_ken_stall:"ストール持ち", grip_ken_swivel:"スウィベルけん持ち",
      grip_ken_down:"ダウンスパイク持ち", grip_tama:"玉持ち", grip_tama_tama:"玉持ち", grip_tama_stunt:"スタントプレーン持ち",
      grip_ito:"糸持ち", grip_ito_hang:"ハンギング持ち", grip_ito_lighthouse:"ライトハウス持ち", grip_ito_spike:"スパイクハンギング持ち",
      grip_ito_tornado:"トルネード持ち",
      gripS_ken:"けん", gripS_ken_ken:"けん持ち", gripS_ken_sara:"皿持ち", gripS_ken_candle:"キャンドル",
      gripS_ken_gun:"ガンスリンガー", gripS_ken_space:"スペースウォーク", gripS_ken_stall:"ストール", gripS_ken_swivel:"スウィベルけん",
      gripS_ken_down:"ダウンスパイク", gripS_tama:"玉", gripS_tama_tama:"玉持ち", gripS_tama_stunt:"スタントプレーン",
      gripS_ito:"糸", gripS_ito_hang:"ハンギング", gripS_ito_lighthouse:"ライトハウス", gripS_ito_spike:"スパイクハンギング",
      gripS_ito_tornado:"トルネード",
      rate_rare:"たまに", rate_sometimes:"ときどき", rate_most:"だいたい", rate_mastered:"得意",
      rateHint_rare:"約1/10", rateHint_sometimes:"約3/10", rateHint_most:"約5/10", rateHint_mastered:"約8/10",
      landed:"成功", notLanded:"未成功",
      iconTextTooLong:"アイコン文字が長すぎます：全角1文字か半角2文字まで"
    },
    en: {
      // grip_<key> = full label (view chips, mailbox...); gripS_<key> = short label (picker chips)
      grip_ken:"Ken grip", grip_ken_ken:"Ken grip", grip_ken_sara:"Sara grip", grip_ken_candle:"Candle grip",
      grip_ken_gun:"Gunslinger grip", grip_ken_space:"Spacewalk grip", grip_ken_stall:"Stall grip", grip_ken_swivel:"Swivel ken grip",
      grip_ken_down:"Downspike grip", grip_tama:"Tama grip", grip_tama_tama:"Tama grip", grip_tama_stunt:"Stuntplane grip",
      grip_ito:"String grip", grip_ito_hang:"Hanging grip", grip_ito_lighthouse:"Lighthouse hanging grip", grip_ito_spike:"Spike hanging grip",
      grip_ito_tornado:"Tornado grip",
      gripS_ken:"Ken", gripS_ken_ken:"Ken", gripS_ken_sara:"Sara", gripS_ken_candle:"Candle",
      gripS_ken_gun:"Gunslinger", gripS_ken_space:"Spacewalk", gripS_ken_stall:"Stall", gripS_ken_swivel:"Swivel ken",
      gripS_ken_down:"Downspike", gripS_tama:"Tama", gripS_tama_tama:"Tama", gripS_tama_stunt:"Stuntplane",
      gripS_ito:"String", gripS_ito_hang:"Hanging", gripS_ito_lighthouse:"Lighthouse", gripS_ito_spike:"Spike",
      gripS_ito_tornado:"Tornado",
      rate_rare:"Rarely", rate_sometimes:"Sometimes", rate_most:"Mostly", rate_mastered:"Mastered",
      rateHint_rare:"about 1/10", rateHint_sometimes:"about 3/10", rateHint_most:"about 5/10", rateHint_mastered:"about 8/10",
      landed:"Landed", notLanded:"Not landed",
      iconTextTooLong:"Icon text too long: 1 full-width or 2 half-width characters max"
    }
  };
