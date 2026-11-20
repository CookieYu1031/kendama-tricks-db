"use strict";

  /* ============================================================
     SEARCH — matching + live suggestion dropdown
  ============================================================ */
  // Matches the typed text against every filled name plus the shown (fallback / romaji) name.
  function trickNameMatches(tr, q){
    var shown = typeof resolveDisplayName === "function" ? resolveDisplayName(tr.name).text : localize(tr.name);
    return [tr.name.zh, tr.name.jp, tr.name.en, shown].some(function(n){
      return (n || "").toLowerCase().indexOf(q) !== -1;
    });
  }
  function getSearchMatches(q){
    q = (q||"").trim().toLowerCase();
    if(!q) return [];
    return db.tricks.filter(function(tr){ return trickNameMatches(tr, q); });
  }

  // Inline "N results for X" label removed — the search-results-inline slot next
  // to the search box is now used for the edit toast instead. Kept as a no-op so
  // existing call sites elsewhere don't need to be touched.
  function updateSearchInlineCount(q){}

  // Navigates the miller columns to a trick's real location (its parent
  // container's column) rather than leaving it in the flat search-results
  // grid, then opens its detail drawer — used by the live suggestion dropdown.
  function goToTrickLocation(trickId){
    var tr = getTrick(trickId);
    if(!tr) return;
    var place = tr.categoryIds.length ? tr.categoryIds[0] : null;
    var sid = place ? containerSpaceId(place) : null;
    if(sid && sid !== state.activeSpace){
      state.activeSpace = sid;
      localStorage.setItem(SPACE_KEY, sid);
    }
    state.path = place ? pathToContainer(place) : [];
    state.searchQuery = "";
    document.getElementById("searchInput").value = "";
    document.getElementById("searchClear").classList.remove("show");
    render();
    openDrawerFor(tr.id);
  }

  /* ============================================================
     LIVE SEARCH SUGGESTIONS (Google-style dropdown under the
     search box). Updates on every keystroke, no Enter required.
  ============================================================ */
  var SEARCH_SUGGEST_LIMIT = 8;
  function closeSearchSuggest(){
    var box = document.getElementById("searchSuggest");
    box.classList.remove("show");
    box.innerHTML = "";
  }
  function renderSearchSuggest(q){
    var box = document.getElementById("searchSuggest");
    var trimmed = (q||"").trim();

    var matches = getSearchMatches(q);

    if(!trimmed || matches.length === 0){
      closeSearchSuggest();
      return;
    }

    box.innerHTML = "";
    matches.slice(0, SEARCH_SUGGEST_LIMIT).forEach(function(tr){
      var row = document.createElement("div");
      row.className = "search-suggest-item";
      row.textContent = localize(tr.name);
      row.addEventListener("mousedown", function(ev){
        // mousedown (not click) so it fires before the input's blur hides the dropdown
        ev.preventDefault();
        closeSearchSuggest();
        goToTrickLocation(tr.id);
      });
      box.appendChild(row);
    });

    box.classList.add("show");
  }
