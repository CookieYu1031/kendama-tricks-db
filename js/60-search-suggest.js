"use strict";

  /* ============================================================
     SEARCH — panel open/close + jump to a trick
  ============================================================ */
  // Matching / index logic lives in js/61-search-index.js, panel UI in js/62-search-panel.js.

  // Inline "N results for X" label removed — the search-results-inline slot next
  // to the search box is now used for the edit toast instead. Kept as a no-op so
  // existing call sites elsewhere don't need to be touched.
  function updateSearchInlineCount(q){}

  // Navigates the miller columns to a trick's real location (its parent
  // container's column) rather than leaving it in the flat search-results
  // grid, then opens its detail drawer — used by the search panel results.
  function goToTrickLocation(trickId){
    var tr = getTrick(trickId);
    if(!tr) return;
    // First real location (skip the favorites table / its virtual folders when there is another one).
    var real = tr.categoryIds.filter(function(cid){ return cid !== FAV_TABLE_ID && cid !== FAV_STARRED_ID && cid !== FAV_CUSTOM_ID; });
    var place = real.length ? real[0] : (tr.categoryIds.length ? tr.categoryIds[0] : null);
    var sid = place ? containerSpaceId(place) : null;
    if(sid && sid !== state.activeSpace){
      state.activeSpace = sid;
      localStorage.setItem(SPACE_KEY, sid);
    }
    state.path = place ? pathToContainer(place) : [];
    state.searchQuery = "";
    closeSearchPanel();
    render();
    openDrawerFor(tr.id);
  }

  /* ============================================================
     SEARCH PANEL — drops down under the topbar's center button
  ============================================================ */
  function isSearchPanelOpen(){
    return document.getElementById("searchPanel").classList.contains("show");
  }
  function openSearchPanel(){
    if(typeof refreshSearchPanel === "function") refreshSearchPanel();
    document.getElementById("searchPanel").classList.add("show");
    var btn = document.getElementById("searchToggleBtn");
    btn.classList.add("active");
    btn.setAttribute("aria-expanded", "true");
    document.getElementById("searchInput").focus();
  }
  function closeSearchPanel(){
    document.getElementById("searchPanel").classList.remove("show");
    var btn = document.getElementById("searchToggleBtn");
    btn.classList.remove("active");
    btn.setAttribute("aria-expanded", "false");
    document.getElementById("searchInput").blur();
  }
  function toggleSearchPanel(){
    if(isSearchPanelOpen()) closeSearchPanel(); else openSearchPanel();
  }
