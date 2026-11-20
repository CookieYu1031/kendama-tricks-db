"use strict";

  /* ============================================================
     BROWSE — column chain + per-parent item ordering
  ============================================================ */
  function buildColumnChain(){
    var columns = [];
    var parentId = null;
    for(var i=0; i<=state.path.length; i++){
      var cats = getChildren(parentId).map(function(c){ return { type:"category", id:c.id, name:c.name, ref:c }; });
      var trs = getTricksInCategory(parentId===null? "__none__" : parentId).map(function(tr){ return { type:"trick", id:tr.id, name:tr.name, ref:tr }; });
      var items = cats.concat(trs);
      columns.push({ parentId: parentId, items: items });
      var selId = state.path[i];
      if(selId===undefined) break;
      var found = items.find(function(it){
        if(it.id !== selId) return false;
        if(it.type === "category") return true;
        return trickHasChildren(it.id); // a trick only extends the chain when it acts as a folder
      });
      if(!found){ state.path = state.path.slice(0,i); break; }
      parentId = found.id;
    }
    return columns;
  }

  var ROOT_KEY = "__root__";
  function orderKeyFor(parentId){ return parentId===null ? ROOT_KEY : parentId; }

  function getItemOrderValue(it, parentId){
    if(it.type === "category") return typeof it.ref.order === "number" ? it.ref.order : 999999;
    var ob = it.ref.orderByCategory || {};
    var key = orderKeyFor(parentId);
    if(typeof ob[key] === "number") return ob[key];
    // unordered tricks fall after explicitly ordered siblings, stable by insertion order
    return 500000 + (typeof it.ref.order === "number" ? it.ref.order : 0);
  }

  function sortColumnItems(items, parentId){
    return items.slice().sort(function(a,b){
      var diff = getItemOrderValue(a, parentId) - getItemOrderValue(b, parentId);
      if(diff !== 0) return diff;
      return localize(a.name).localeCompare(localize(b.name));
    });
  }

  // Persist a full custom order for one column: assign sequential 0..n-1 to every item
  // in its new visual sequence. Categories always have a single parent, so category.order
  // is a global value; tricks may sit at different depths under different parents, so their
  // order is tracked per-parent via orderByCategory[parentId].
  function persistColumnOrder(orderedItems, parentId){
    var key = orderKeyFor(parentId);
    orderedItems.forEach(function(it, idx){
      if(it.type === "category"){
        it.ref.order = idx;
      } else {
        it.ref.orderByCategory = it.ref.orderByCategory || {};
        it.ref.orderByCategory[key] = idx;
      }
    });
    saveDB();
  }
