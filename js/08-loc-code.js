"use strict";
// Position/location codes: [table][level chain]-[type]-[serial], e.g. "001a2b-tr-00".
// Pure module, data-shape-agnostic: caller supplies items and a childrenOf(item) accessor.
// Spec: 企劃書 §五.2 (decision B2).

var LAYER_CHARS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
var TABLE_CODES_LOCKED = ["00", "01", "02"];
var LOC_MAX_LEVEL = 4;
var LOC_MAX_SERIAL = 1296; // 36*36

// Custom table code: 0 -> "0a" ... 25 -> "0z"; null beyond.
function customTableCode(n){
  if (typeof n !== "number" || n !== Math.floor(n) || n < 0 || n > 25) return null;
  return "0" + LAYER_CHARS.charAt(n);
}

function locSerial(n){
  if (n >= LOC_MAX_SERIAL) return null;
  var s = n.toString(36);
  return s.length < 2 ? "0" + s : s;
}

// Returns [{ id, type, code, parentId }], depth-first in display order.
// tableCode falsy (e.g. favorites) -> [].
function computeLocCodes(tableCode, rootItems, childrenOf){
  var out = [];
  if (!tableCode) return out;
  function walk(items, level, chain, parentId){
    var counts = {};
    for (var i = 0; i < items.length; i++){
      var it = items[i];
      var n = counts[it.type] || 0;
      counts[it.type] = n + 1;
      var serial = locSerial(n);
      var code = (chain === null || serial === null) ? null
        : tableCode + chain + "-" + it.type + "-" + serial;
      out.push({ id: it.id, type: it.type, code: code, parentId: parentId });
      if (level < LOC_MAX_LEVEL){
        var kids = childrenOf(it);
        if (kids && kids.length){
          var sub = (chain === null || i >= LAYER_CHARS.length) ? null
            : chain + level + LAYER_CHARS.charAt(i);
          walk(kids, level + 1, sub, it.id);
        }
      }
    }
  }
  walk(rootItems || [], 1, "", null);
  return out;
}

// All codes (non-null or null entries as computed) for an id; a trick may have several.
function locCodeOf(results, id){
  var r = [];
  for (var i = 0; i < results.length; i++){
    if (results[i].id === id) r.push(results[i].code);
  }
  return r;
}
