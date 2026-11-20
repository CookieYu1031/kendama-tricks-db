"use strict";

  /* ============================================================
     SEARCH — matching + live suggestion dropdown
  ============================================================ */
  function getSearchMatches(q){
    q = (q||"").trim().toLowerCase();
    if(!q) return [];
    return db.tricks.filter(function(tr){
      return (tr.name.zh||"").toLowerCase().indexOf(q) !== -1 ||
             (tr.name.jp||"").toLowerCase().indexOf(q) !== -1 ||
             (tr.name.en||"").toLowerCase().indexOf(q) !== -1;
    });
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
    state.path = tr.categoryIds.length ? pathToContainer(tr.categoryIds[0]) : [];
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
