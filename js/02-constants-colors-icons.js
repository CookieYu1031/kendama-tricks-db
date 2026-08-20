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

  // One tint per proficiency level (left-to-right: none/once/rare/sometimes/often/mastered),
  // used both to color the segmented control buttons and as the trick icon's glow color.
  // "none" has no assigned tint since it never renders a glow or a colored button state.
  var PROFICIENCY_COLORS = {
    none:      "#9B9A97", // gray
    once:      "#D6483F", // red
    rare:      "#DFAB01", // yellow
    sometimes: "#4F9768", // green
    often:     "#3E9BE0", // blue
    mastered:  "#9065B0"  // purple
  };

