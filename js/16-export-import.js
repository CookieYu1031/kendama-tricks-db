"use strict";

  /* ============================================================
     EXPORT / IMPORT
  ============================================================ */
  function exportJSON(){
    var payload = JSON.stringify(db, null, 2);
    var blob = new Blob([payload], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    var d = new Date();
    var stamp = d.getFullYear() + String(d.getMonth()+1).padStart(2,"0") + String(d.getDate()).padStart(2,"0");
    a.href = url;
    a.download = "kendama-tricks-" + stamp + ".json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function(){ URL.revokeObjectURL(url); }, 500);
    showToast(t("exportSuccess"));
  }

  function importJSONFile(file){
    var reader = new FileReader();
    reader.onload = function(){
      try{
        var parsed = JSON.parse(reader.result);
        if(!parsed || !Array.isArray(parsed.categories) || !Array.isArray(parsed.tricks)) throw new Error("bad shape");
        db = normalizeDB(parsed);
        saveDB();
        state.path = [];
        state.detailTrickId = null;
        state.searchQuery = "";
        document.getElementById("searchInput").value = "";
        document.getElementById("searchClear").classList.remove("show");
        updateSearchInlineCount("");
        closeSearchSuggest();
        closeDrawer();
        render();
        showToast(t("importSuccess"));
      }catch(e){
        showToast(t("importError"), "error");
      }
    };
    reader.onerror = function(){ showToast(t("importError"), "error"); };
    reader.readAsText(file);
  }

