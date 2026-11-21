"use strict";

  /* ============================================================
     SEARCH PANEL UI — text / #tag input, grip + part conditions, live
     results list. Matching logic: js/61-search-index.js.
  ============================================================ */
  addStrings({
    zh:{ searchPlaceholder:"搜尋招式名稱，或輸入 #標籤…", searchGripLabel:"持法", searchPartsLabel:"部位",
         searchModeAny:"其一符合", searchModeAll:"全符合", searchReset:"清除條件", searchMore:"顯示更多",
         searchHint:"輸入招式名稱，或用 #標籤、持法、部位來篩選", searchEmpty:"找不到符合的招式",
         searchCountN:"{n} 個結果", searchNoTag:"（沒有符合的標籤）",
         searchStartGrip:"起始握持", searchClassLabel:"招式類別", searchNoClass:"尚無招式類別" },
    jp:{ searchPlaceholder:"技名、または #タグで検索…", searchGripLabel:"持ち方", searchPartsLabel:"部位",
         searchModeAny:"いずれか一致", searchModeAll:"すべて一致", searchReset:"条件をクリア", searchMore:"もっと見る",
         searchHint:"技名を入力、または #タグ・持ち方・部位で絞り込み", searchEmpty:"該当する技がありません",
         searchCountN:"{n} 件", searchNoTag:"（該当するタグなし）",
         searchStartGrip:"開始時の持ち方", searchClassLabel:"技の分類", searchNoClass:"技の分類はまだありません" },
    en:{ searchPlaceholder:"Search trick names, or type #tag…", searchGripLabel:"Grip", searchPartsLabel:"Parts",
         searchModeAny:"Match any", searchModeAll:"Match all", searchReset:"Clear filters", searchMore:"Show more",
         searchHint:"Type a trick name, or filter by #tag, grip and parts", searchEmpty:"No matching tricks",
         searchCountN:"{n} results", searchNoTag:"(no matching tags)",
         searchStartGrip:"Starting grip", searchClassLabel:"Trick class", searchNoClass:"No trick classes yet" }
  });

  var SEARCH_PAGE = 50;
  var TAG_SUGGEST_MAX = 12;
  var SEARCH_DEFAULT_GRIP = "ken";
  var SEARCH_MODE_SYMBOL = { any: "≈", all: "≅" }; // ≈ any match, ≅ all match
  var searchFilters = { grip: SEARCH_DEFAULT_GRIP, parts: [], partsMode: "any" };
  var searchView = { ids: [], limit: SEARCH_PAGE, active: -1 };
  var searchChromeBuilt = false;
  var searchInteracted = false;  // results stay hidden (hint only) until the user interacts
  var searchDiagram = null;
  var searchClassId = null;      // selected class tag chip (deselect keeps grip / parts)

  function spEl(id){ return document.getElementById(id); }
  function spButton(cls, text, onClick){
    var b = document.createElement("button");
    b.type = "button"; b.className = cls; b.textContent = text;
    b.addEventListener("click", onClick);
    return b;
  }

  function searchTouch(){ searchInteracted = true; syncSearchChips(); runSearchPanel(); }

  // Builds the static conditions UI once; texts are (re)applied by updateSearchPanelTexts().
  function buildSearchPanelChrome(){
    if(searchChromeBuilt) return;
    searchChromeBuilt = true;
    var gripRow = spEl("searchGripRow");
    GRIP_KEYS.forEach(function(k){
      var b = spButton("lang-btn", "", function(){
        searchFilters.grip = searchFilters.grip === k ? null : k;
        searchTouch();
      });
      b.setAttribute("data-grip", k);
      gripRow.appendChild(b);
    });
    var modeRow = spEl("searchPartsMode");
    ["any", "all"].forEach(function(m){
      var b = spButton("lang-btn", "", function(){
        searchFilters.partsMode = m;
        searchTouch();
      });
      b.setAttribute("data-mode", m);
      modeRow.appendChild(b);
    });
    spEl("searchResetBtn").addEventListener("click", resetSearchConditions);
  }

  // Part diagram (js/35) replaces the part chips. Rebuilt on open so region titles follow the language.
  function buildSearchDiagram(){
    var host = spEl("searchPartsRow");
    host.innerHTML = "";
    searchDiagram = createPartDiagram({ selected: searchFilters.parts, interactive: true, onToggle: function(k){
      var i = searchFilters.parts.indexOf(k);
      if(i === -1) searchFilters.parts.push(k); else searchFilters.parts.splice(i, 1);
      searchTouch();
    } });
    host.appendChild(searchDiagram);
  }

  // Class tag chips (db.tags kind "class"). Pick = overwrite grip + parts; pick again = deselect only.
  function buildSearchClassChips(){
    var host = spEl("searchClassRow");
    host.innerHTML = "";
    var list = (db.tags || []).filter(function(g){ return tagKind(g) === "class"; });
    if(searchClassId && !list.some(function(g){ return g.id === searchClassId; })) searchClassId = null;
    if(!list.length){
      var none = document.createElement("span");
      none.className = "search-note"; none.textContent = t("searchNoClass");
      host.appendChild(none);
      return;
    }
    list.forEach(function(g){
      var b = spButton("drawer-chip tag-class", localize(g.name), function(){
        if(searchClassId === g.id){ searchClassId = null; }
        else { searchClassId = g.id; searchApplyClassTag(searchFilters, g); }
        searchTouch();
      });
      b.setAttribute("data-tag", g.id);
      host.appendChild(b);
    });
  }

  function updateSearchPanelTexts(){
    spEl("searchGripLabel").textContent = t("searchStartGrip");
    spEl("searchClassLabel").textContent = t("searchClassLabel");
    buildSearchClassChips();
    spEl("searchResetBtn").textContent = t("searchReset");
    Array.prototype.forEach.call(spEl("searchGripRow").children, function(b){ b.textContent = t("grip_" + b.getAttribute("data-grip")); });
    Array.prototype.forEach.call(spEl("searchPartsMode").children, function(b){
      var m = b.getAttribute("data-mode"), full = t(m === "all" ? "searchModeAll" : "searchModeAny");
      b.textContent = SEARCH_MODE_SYMBOL[m];
      b.title = full; b.setAttribute("aria-label", full);
    });
    spEl("searchInput").placeholder = t("searchPlaceholder");
  }

  function syncSearchChips(){
    Array.prototype.forEach.call(spEl("searchGripRow").children, function(b){
      b.classList.toggle("active", searchFilters.grip === b.getAttribute("data-grip"));
    });
    Array.prototype.forEach.call(spEl("searchPartsMode").children, function(b){
      b.classList.toggle("active", searchFilters.partsMode === b.getAttribute("data-mode"));
    });
    Array.prototype.forEach.call(spEl("searchClassRow").children, function(b){
      b.classList.toggle("active", !!searchClassId && b.getAttribute("data-tag") === searchClassId);
    });
    if(searchDiagram) searchDiagram.update(searchFilters.parts);
  }

  function resetSearchConditions(){
    searchFilters.grip = SEARCH_DEFAULT_GRIP; searchFilters.parts = []; searchFilters.partsMode = "any";
    searchClassId = null;
    searchInteracted = false;
    var input = spEl("searchInput");
    input.value = "";
    spEl("searchClear").classList.remove("show");
    state.searchQuery = "";
    syncSearchChips();
    runSearchPanel();
    input.focus();
  }

  // Lazy one-time fetch of the published index; any failure silently keeps in-memory search.
  var searchJsonRequested = false;
  function loadSearchJson(){
    if(searchJsonRequested || typeof fetch !== "function") return;
    searchJsonRequested = true;
    fetch("data/search-index.json", { cache: "no-cache" }).then(function(r){
      if(!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    }).then(function(j){
      if(!validSearchJson(j)) return;
      searchJson = j;
      searchIndexCache = null;
      if(spEl("searchInput")) runSearchPanel();
    }).catch(function(){ /* keep in-memory */ });
  }

  // Called when the panel opens (language / db may have changed since last time).
  function refreshSearchPanel(){
    loadSearchJson();
    buildSearchPanelChrome();
    buildSearchDiagram();
    updateSearchPanelTexts();
    syncSearchChips();
    runSearchPanel();
  }

  // Input handler (bound in js/90): live search on every keystroke.
  function onSearchInput(){
    var raw = spEl("searchInput").value;
    spEl("searchClear").classList.toggle("show", raw.length > 0);
    state.searchQuery = raw;
    searchInteracted = true;
    runSearchPanel();
  }

  function runSearchPanel(){
    searchView.limit = SEARCH_PAGE;
    searchView.active = -1;
    var raw = spEl("searchInput").value;
    var query = parseSearchQuery(raw);
    var show = searchShouldShowResults(query, searchFilters, searchInteracted);
    searchView.ids = show ? runSearch(getSearchIndex(), raw, searchFilters, searchTagLookup()) : [];
    renderTagSuggest(raw);
    renderSearchList(show);
  }

  // Tag chips while a "#token" is being typed at the end of the input.
  function renderTagSuggest(raw){
    var box = spEl("searchTagSuggest");
    box.innerHTML = "";
    var partial = currentTagToken(raw);
    if(partial === null){ box.classList.remove("show"); return; }
    var q = partial.replace(/_/g, " ").toLowerCase();
    var list = db.tags.filter(function(g){
      return !q || [g.name.zh, g.name.jp, g.name.en].some(function(n){ return (n || "").toLowerCase().indexOf(q) !== -1; });
    }).slice(0, TAG_SUGGEST_MAX);
    if(!list.length){
      var none = document.createElement("span");
      none.className = "search-note"; none.textContent = t("searchNoTag");
      box.appendChild(none);
    }
    list.forEach(function(g){
      var label = localize(g.name);
      var chipEl = spButton("drawer-chip", "#" + label, function(){
        var input = spEl("searchInput");
        input.value = input.value.replace(/#[^\s#]*$/, "#" + label.replace(/\s+/g, "_") + " ");
        searchApplyClassTag(searchFilters, g); // class tag overwrites grip / parts with its combo
        if(tagKind(g) === "class") searchClassId = g.id;
        syncSearchChips();
        input.focus();
        onSearchInput();
      });
      if(tagKind(g) === "class") chipEl.classList.add("tag-class");
      box.appendChild(chipEl);
    });
    box.classList.add("show");
  }

  function searchLocLine(id){
    var e = null, idx = getSearchIndex();
    for(var i = 0; i < idx.length; i++){ if(idx[i].id === id){ e = idx[i]; break; } }
    if(!e) return "";
    var loc = e.locs[0];
    var names = loc.path.map(function(cid){ var c = getCategory(cid) || getTrick(cid); return c ? localize(c.name) : ""; }).filter(Boolean);
    var line = [spaceLabel(loc.spaceId)].concat(names).join(" › ");
    if(e.locs.length > 1) line += "  +" + (e.locs.length - 1);
    return line;
  }

  function buildSearchRow(id){
    var tr = getTrick(id);
    var row = document.createElement("div");
    row.className = "item search-row" + (tr.custom ? " custom" : "");
    row.setAttribute("data-id", id);
    var icon = document.createElement("div");
    icon.className = "item-icon trick";
    var hex = tr.color ? colorHex(tr.color) : TRICK_DEFAULT_HEX;
    icon.style.background = hexToRgba(hex, 0.22);
    icon.style.color = hex;
    if(isImageIcon(tr.icon)){ icon.classList.add("img-icon"); icon.innerHTML = iconHtml(tr.icon); }
    else if(tr.icon){ icon.style.fontSize = "15px"; icon.textContent = tr.icon; } else { icon.innerHTML = ICON_PLAY; }
    applyTrickGlow(icon, tr);
    var wrap = document.createElement("div");
    wrap.className = "item-text";
    var nameEl = document.createElement("div");
    nameEl.className = "item-name"; nameEl.textContent = localize(tr.name);
    var meta = document.createElement("div");
    meta.className = "item-meta"; meta.textContent = searchLocLine(id);
    wrap.appendChild(nameEl); wrap.appendChild(meta);
    row.appendChild(icon); row.appendChild(wrap);
    row.addEventListener("click", function(){ goToTrickLocation(id); });
    return row;
  }

  function renderSearchList(hasCriteria){
    var list = spEl("searchList"), count = spEl("searchCount");
    list.innerHTML = "";
    var ids = searchView.ids;
    if(!hasCriteria){
      count.textContent = "";
      var hint = document.createElement("div");
      hint.className = "search-empty"; hint.textContent = t("searchHint");
      list.appendChild(hint);
      return;
    }
    count.textContent = t("searchCountN").replace("{n}", ids.length);
    if(!ids.length){
      var empty = document.createElement("div");
      empty.className = "search-empty"; empty.textContent = t("searchEmpty");
      list.appendChild(empty);
      return;
    }
    ids.slice(0, searchView.limit).forEach(function(id){ list.appendChild(buildSearchRow(id)); });
    if(ids.length > searchView.limit){
      list.appendChild(spButton("btn search-more", t("searchMore"), function(){
        searchView.limit += SEARCH_PAGE;
        renderSearchList(true);
      }));
    }
  }

  function setSearchActive(i){
    var rows = spEl("searchList").querySelectorAll(".search-row");
    if(!rows.length) return;
    i = Math.max(0, Math.min(rows.length - 1, i));
    Array.prototype.forEach.call(rows, function(r, n){ r.classList.toggle("selected", n === i); });
    searchView.active = i;
    if(rows[i].scrollIntoView) rows[i].scrollIntoView({ block: "nearest" });
  }

  // Keydown on the input (bound in js/90): Up/Down move the highlight, Enter opens it.
  function onSearchKeydown(ev){
    if(ev.key === "ArrowDown"){ ev.preventDefault(); setSearchActive(searchView.active + 1); }
    else if(ev.key === "ArrowUp"){ ev.preventDefault(); setSearchActive(searchView.active < 0 ? 0 : searchView.active - 1); }
    else if(ev.key === "Enter"){
      var rows = spEl("searchList").querySelectorAll(".search-row");
      var row = rows[searchView.active >= 0 ? searchView.active : 0];
      if(row){ ev.preventDefault(); goToTrickLocation(row.getAttribute("data-id")); }
    }
  }
