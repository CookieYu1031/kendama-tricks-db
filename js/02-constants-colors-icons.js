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
  var ICON_EMOJI_SET = ICON_EMOJI_GROUPS.reduce(function(a,b){ return a.concat(b); }, []);

  // One tint per landing-rate level (see RATE_LEVELS in 01-data-model.js), used both to
  // color the rate buttons and as the trick icon's glow color. rate:null has no glow.
  var RATE_COLORS = {
    rare:      "#DFAB01", // yellow
    sometimes: "#4F9768", // green
    most:      "#3E9BE0", // blue
    mastered:  "#9065B0"  // purple
  };

  // i18n strings for the data model (parts, grips, rates, landed). Registered via
  // addStrings() in 04-state.js, because 03-i18n.js loads after this file.
  var DATA_MODEL_STRINGS = {
    zh: {
      grip_ken:"持劍", grip_tama:"持球", grip_ito:"持線",
      rate_rare:"罕見", rate_sometimes:"有時", rate_most:"多數", rate_mastered:"熟練",
      rateHint_rare:"約 1/10", rateHint_sometimes:"約 3/10", rateHint_most:"約 5/10", rateHint_mastered:"約 8/10",
      landed:"成招", notLanded:"無成招"
    },
    jp: {
      grip_ken:"けん持ち", grip_tama:"玉持ち", grip_ito:"糸持ち",
      rate_rare:"たまに", rate_sometimes:"ときどき", rate_most:"だいたい", rate_mastered:"得意",
      rateHint_rare:"約1/10", rateHint_sometimes:"約3/10", rateHint_most:"約5/10", rateHint_mastered:"約8/10",
      landed:"成功", notLanded:"未成功"
    },
    en: {
      grip_ken:"Hold ken", grip_tama:"Hold ball", grip_ito:"Hold string",
      rate_rare:"Rarely", rate_sometimes:"Sometimes", rate_most:"Mostly", rate_mastered:"Mastered",
      rateHint_rare:"about 1/10", rateHint_sometimes:"about 3/10", rateHint_most:"about 5/10", rateHint_mastered:"about 8/10",
      landed:"Landed", notLanded:"Not landed"
    }
  };
