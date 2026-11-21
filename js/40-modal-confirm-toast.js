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
    // Toast sits centered in the topbar. The topbar is its own stacking context (z 45, below
    // modals at 60/75), so lift the container to <body> (z 80) to stay visible over modals.
    if(container.parentNode !== document.body) document.body.appendChild(container);
    // One line only: a new toast replaces whatever is currently showing.
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

