"use strict";

  /* ============================================================
     BROWSE — column chain + per-parent item ordering
  ============================================================ */
  // Unsorted items directly inside one container (null = root of the active table):
  // folders, tricks and info items.
  function buildRawColumnItems(parentId){
    var cats = getChildren(parentId).map(function(c){ return { type:"category", id:c.id, name:c.name, ref:c }; });
    var trs = getTricksInCategory(parentId).map(function(tr){ return { type:"trick", id:tr.id, name:tr.name, ref:tr }; });
    var ins = parentId === FAV_STARRED_ID ? [] : getInfosIn(parentId).map(function(n){ return { type:"info", id:n.id, name:n.title, ref:n }; });
    return cats.concat(trs, ins);
  }

  function buildColumnChain(){
    var columns = [];
    var parentId = null;
    for(var i=0; i<=state.path.length; i++){
      var items = buildRawColumnItems(parentId);
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
  // Order key inside tricks' orderByCategory: the table id for the table root
  // (matches the root placement id in categoryIds), else the container id.
  function orderKeyFor(parentId){ return parentId===null ? state.activeSpace : parentId; }

  function getItemOrderValue(it, parentId){
    if(it.type !== "trick") return typeof it.ref.order === "number" ? it.ref.order : 999999;
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
      if(it.type !== "trick"){
        it.ref.order = idx;
      } else {
        it.ref.orderByCategory = it.ref.orderByCategory || {};
        it.ref.orderByCategory[key] = idx;
      }
    });
    saveDB();
  }

  /* ============================================================
     BROWSE — permission / level rules (pure, testable)
  ============================================================ */
  function isAdminNow(){ return typeof isAdminAccount === "function" && !!isAdminAccount(); }

  // Rail zones (E2): top = view-only tables 00/01/02, middle = 收藏 + custom
  // tables (by order), bottom = function buttons (edit toggle; rendered by
  // 12-shell-rail.js). Guests (D8) get only the top zone; the middle and
  // bottom zones are not shown at all.
  function railZones(spaces){
    var byId = {};
    spaces.forEach(function(s){ byId[s.id] = s; });
    var top = [], middle = [];
    ["t00", "t01", "t02"].forEach(function(id){ if(byId[id]) top.push(byId[id]); });
    if(isGuest()) return { top: top, middle: middle, showMiddle: false, showBottom: false };
    if(byId[FAV_TABLE_ID]) middle.push(byId[FAV_TABLE_ID]);
    spaces.filter(function(s){ return !isDefaultSpaceId(s.id); })
      .sort(function(a, b){ return (a.order || 0) - (b.order || 0); })
      .forEach(function(s){ middle.push(s); });
    return { top: top, middle: middle, showMiddle: true, showBottom: true };
  }

  // Flat form: top spaces, "divider", middle spaces (guests: top only).
  function railLayout(spaces){
    var z = railZones(spaces);
    if(!z.showMiddle) return z.top;
    return z.top.concat(["divider"], z.middle);
  }

  // Whether an existing row may be edited / deleted / dragged. Virtual favorites
  // folders and rows inside the starred list never; items of a locked table only
  // for the admin, except custom:true tricks (user-owned).
  function canModifyItem(it, parentId, isAdmin){
    if(isGuest()) return false;
    if(parentId === FAV_STARRED_ID || (it.ref && it.ref.virtual)) return false;
    if(it.type === "trick" && it.ref.custom) return true;
    var sid = it.type === "trick" ? containerSpaceId(it.ref.categoryIds[0]) : it.ref.spaceId;
    var sp = getSpace(sid);
    if(!sp || !sp.locked) return true;
    return !!isAdmin;
  }
  // Row edit button (left of ">"): folders and info items the user may modify,
  // except the fixed 收藏 folders. Tricks are edited in the drawer.
  function canEditRow(it, parentId, isAdmin){
    if(it.type !== "category" && it.type !== "info") return false;
    if(it.type === "category" && isFixedFavFolder(it.id)) return false;
    return canModifyItem(it, parentId, isAdmin);
  }
  // Reorder / reparent drag: same rule, but custom tricks in a locked table stay put for non-admins.
  function canDragItem(it, parentId, isAdmin){
    if(!canModifyItem(it, parentId, isAdmin)) return false;
    return canEditTable(state.activeSpace) || !!isAdmin;
  }

  // Add buttons offered in a column. customTrick = the trick created is a user trick (custom:true).
  function allowedAddButtons(parentId, spaceId, isAdmin){
    var none = { folder:false, trick:false, info:false, customTrick:false };
    var sp = getSpace(spaceId);
    if(!sp || isGuest()) return none;
    if(parentId === FAV_STARRED_ID) return none;
    if(spaceId === FAV_TABLE_ID && parentId === null) return none; // root = two virtual folders
    var locked = !!sp.locked && !isAdmin;
    var res = {
      folder: !locked && canAddChild(parentId, "folder"),
      trick: canAddChild(parentId, "trick"),
      info: !locked && canAddChild(parentId, "info"),
      customTrick: locked || parentId === FAV_CUSTOM_ID
    };
    return res;
  }

  // Would a subtree rooted at (id,type) still respect the level limits if its top sat at `level`?
  function subtreeFits(id, type, level, depth){
    depth = depth || 0;
    if(depth > 60) return false;
    var max = type === "category" ? MAX_FOLDER_LEVEL : MAX_ITEM_LEVEL;
    if(level > max) return false;
    if(type === "info") return true;
    var ok = true;
    getChildren(id).forEach(function(c){ if(ok && !subtreeFits(c.id, "category", level + 1, depth + 1)) ok = false; });
    getTricksInCategory(id).forEach(function(tr){ if(ok && !subtreeFits(tr.id, "trick", level + 1, depth + 1)) ok = false; });
    getInfosIn(id).forEach(function(n){ if(ok && !subtreeFits(n.id, "info", level + 1, depth + 1)) ok = false; });
    return ok;
  }
