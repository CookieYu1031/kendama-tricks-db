"use strict";

  /* ============================================================
     ITEM PREFIX (v0.16) — a short custom label in front of a trick / list name (e.g. "1-2").
     Lists: cat.prefix (string). Tricks: tr.prefixByCategory = { <containerKey>: string }, one per
     placement, so the same trick can be numbered differently in every list. containerKey = the
     same key as orderByCategory (folder / trick id, or the table id for a table root).
     Both fields exist ONLY when non-empty (records are compared to the base with JSON), and the
     map keys are kept sorted. normalizePrefix / normalizePrefixMap live in js/01-data-storage.js.
  ============================================================ */

  function getTrickPrefix(tr, key){
    var m = tr && tr.prefixByCategory;
    return (m && typeof m[key] === "string") ? m[key] : "";
  }
  function setTrickPrefix(tr, key, val){
    if(!tr || !key) return;
    var m = Object.assign({}, tr.prefixByCategory || {});
    m[key] = val;
    m = normalizePrefixMap(m);
    if(m) tr.prefixByCategory = m; else delete tr.prefixByCategory;
  }
  // Generic: works for lists and info items (both use a plain .prefix string).
  function getCategoryPrefix(cat){ return (cat && typeof cat.prefix === "string") ? cat.prefix : ""; }
  function setCategoryPrefix(cat, val){
    if(!cat) return;
    var p = normalizePrefix(val);
    if(p) cat.prefix = p; else delete cat.prefix;
  }
  // Prefix of a column row: it = { type, ref }; parentId = its column (null = root of the active table).
  // Info items (v0.17) carry info.prefix like lists (the category helpers are generic).
  function itemPrefix(it, parentId){
    if(!it || !it.ref) return "";
    if(it.type === "category" || it.type === "info") return getCategoryPrefix(it.ref);
    if(it.type === "trick") return getTrickPrefix(it.ref, orderKeyFor(parentId));
    return "";
  }
