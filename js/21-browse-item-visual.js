"use strict";

  /* ============================================================
     BROWSE — item visual: the icon + name/meta block shared by every row
     (miller-column tree, flat grid, pending ghost rows). Loaded before js/21-browse-columns.js.
  ============================================================ */
  var ICON_INFO_ROW = '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8"/><path d="M12 11v5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="8" r="1.2" fill="currentColor"/></svg>';

  // Info row: a custom icon and / or colour switches to the tinted look (like a list);
  // default colour and no icon keeps the plain row.
  function infoRowTinted(ref){
    return !!(ref && (ref.icon || (ref.color && ref.color !== "default")));
  }
  // Paints a tinted icon: image / text icon from ref.icon, else the fallback svg.
  function fillItemIcon(icon, ref, hex, fallbackSvg){
    icon.style.background = hexToRgba(hex, 0.22);
    icon.style.color = hex;
    if(isImageIcon(ref.icon)){
      icon.classList.add("img-icon");
      icon.innerHTML = iconHtml(ref.icon);
    } else if(ref.icon){
      icon.style.fontSize = "15px";
      icon.innerHTML = iconHtml(ref.icon);
    } else {
      icon.innerHTML = fallbackSvg;
    }
  }

  // parentId (column container, null = table root) enables the prefix; omit it (grid, ghost rows) for none.
  function buildItemVisual(it, parentId){
    var hasChildren = it.type==="trick" && trickHasChildren(it.id);

    var icon = document.createElement("div");
    icon.className = "item-icon" + (it.type==="trick" ? " trick" : "") + (hasChildren ? " has-children" : "");
    if(it.type==="info"){
      if(infoRowTinted(it.ref)) fillItemIcon(icon, it.ref, colorHex(it.ref.color), ICON_INFO_ROW);
      else icon.innerHTML = ICON_INFO_ROW;
    } else if(it.type==="category"){
      fillItemIcon(icon, it.ref, colorHex(it.ref.color), ICON_LIST);
    } else {
      fillItemIcon(icon, it.ref, it.ref.color ? colorHex(it.ref.color) : TRICK_DEFAULT_HEX, ICON_TRICK);
      applyTrickGlow(icon, it.ref);
    }

    var textWrap = document.createElement("div");
    textWrap.className = "item-text";
    var nameEl = document.createElement("div");
    nameEl.className = "item-name";
    var pfx = parentId !== undefined ? itemPrefix(it, parentId) : "";
    if(pfx){
      var pfxEl = document.createElement("span");
      pfxEl.className = "item-prefix"; pfxEl.textContent = pfx;
      nameEl.appendChild(pfxEl);
    }
    if(it.type === "trick" && nameShownUnsure(it.ref, it.name, state.editMode)){
      var nmEl = document.createElement("span");
      nmEl.className = "name-unsure"; nmEl.textContent = localize(it.name);
      nameEl.appendChild(nmEl);
    } else nameEl.appendChild(document.createTextNode(localize(it.name)));
    textWrap.appendChild(nameEl);

    var metaEl = document.createElement("div");
    metaEl.className = "item-meta";
    if(it.type==="category"){
      var subCount = getChildren(it.id).length;
      var trickCount = getTricksInCategory(it.id).length;
      var bits = [];
      if(subCount) bits.push(subCount + " " + t("subCats"));
      if(trickCount) bits.push(trickCount + " " + t("tricksCount"));
      metaEl.textContent = bits.join(" · ");
    } else if(it.type==="trick"){
      var metaBits = [];
      // Being filed into 收藏 is a bucket membership, not a real "this
      // trick also lives under another category" cross-reference — exclude
      // that bucket category from this line so toggling a trick into 收藏
      // doesn't add unrelated-looking text here.
      var realCategoryIds = it.ref.categoryIds.filter(function(cid){
        return !getSpace(cid) && cid !== FAV_CUSTOM_ID && cid !== FAV_STARRED_ID;
      });
      if(realCategoryIds.length > 1){
        metaBits.push(realCategoryIds.map(function(cid){ var cc=getCategory(cid)||getTrick(cid); return cc?localize(cc.name):""; }).filter(Boolean).join(" · "));
      }
      if(hasChildren){
        // A trick-folder's children can now be a mix of sub-categories and
        // extension tricks, so show both counts (whichever are non-zero) the
        // same way a category row shows its subCats/tricksCount split.
        var hcBits = [];
        var subCatCount = getChildren(it.id).length;
        var extTrickCount = getTricksInCategory(it.id).length;
        if(subCatCount) hcBits.push(subCatCount + " " + t("subCats"));
        if(extTrickCount) hcBits.push(extTrickCount + " " + t("extTricks"));
        if(hcBits.length) metaBits.push(hcBits.join(" · "));
      }
      metaEl.textContent = metaBits.join(" · ");
    }
    // Rows have a fixed height (var(--item-h)) and are vertically centered via flex on
    // .item, so an item with no description simply omits the meta line entirely and its
    // single-line name centers naturally — rather than reserving an invisible blank line
    // that pushes the name up off-center.
    if(metaEl.textContent) textWrap.appendChild(metaEl);

    return { icon: icon, textWrap: textWrap, hasChildren: hasChildren };
  }
