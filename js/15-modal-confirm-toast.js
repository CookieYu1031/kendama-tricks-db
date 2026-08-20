"use strict";

  /* ============================================================
     CONFIRM MODAL
  ============================================================ */
  function openConfirm(title, body, onConfirm){
    document.getElementById("confirmTitle").textContent = title;
    document.getElementById("confirmSub").textContent = body;
    state.confirmAction = onConfirm;
    document.getElementById("confirmOverlay").classList.add("show");
  }
  function closeConfirm(){
    document.getElementById("confirmOverlay").classList.remove("show");
    state.confirmAction = null;
  }

  /* ============================================================
     TOAST
  ============================================================ */
  function showToast(msg, type){
    var container = document.getElementById("toastContainer");
    // Only one line of space next to the search box now, so a new toast
    // replaces whatever is currently showing instead of stacking underneath it.
    container.innerHTML = "";
    var toast = document.createElement("div");
    toast.className = "toast" + (type==="error" ? " error" : "");
    toast.innerHTML = '<span class="tdot"></span><span>' + escapeHtml(msg) + '</span>';
    container.appendChild(toast);
    setTimeout(function(){
      toast.classList.add("out");
      setTimeout(function(){ toast.remove(); }, 220);
    }, 2400);
  }

