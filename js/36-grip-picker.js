"use strict";

  /* ============================================================
     GRIP PICKER — shared 握持手勢 widget (two levels, ONE value).
     Rows = GRIP_GROUPS (js/01): left a category HEADER (not clickable), right its sub-grip chips.
     Only sub-grips are selectable; category values stay valid data (gripMatches) but are never picked here.
     Tapping the selected chip clears. One layout: category header + 4 columns (css/grip.css).
     Used by the search panel (js/62), drawer edit mode (js/31) and the add modal (js/47).
     The ⓘ link opens the grip info page (js/48).
  ============================================================ */
  addStrings({
    zh:{ gripTitle:"起始握持" },
    jp:{ gripTitle:"開始時の持ち方" },
    en:{ gripTitle:"Starting grip" }
  });

  var GRIP_COLS = 4;  // sub-chips per row (4 equal columns)

  // opts: { value, onChange(value|null), allowNone (default true) }. The element has
  // .setValue(v) to re-sync from outside (class-tag overwrite) and .getValue(); onChange is NOT fired by setValue.
  function isGripSub(k){ return GRIP_KEYS.indexOf(k) !== -1 && !isGripCategory(k); }
  function buildGripPicker(opts){
    opts = opts || {};
    var value = isGripSub(opts.value) ? opts.value : null;
    var allowNone = opts.allowNone !== false;
    var box = document.createElement("div");
    box.className = "grip-picker";
    var btns = {};
    function mk(k){
      var b = document.createElement("button");
      b.type = "button";
      b.className = "drawer-chip";
      b.textContent = t("gripS_" + k);
      b.title = t("grip_" + k);
      b.setAttribute("data-grip", k);
      b.addEventListener("click", function(){
        var next = value === k ? (allowNone ? null : k) : k;
        if(next === value) return;
        value = next;
        sync();
        if(opts.onChange) opts.onChange(value);
      });
      btns[k] = b;
      return b;
    }
    function mkInfo(){
      var info = document.createElement("button");
      info.type = "button";
      info.className = "grip-info-link grip-info-title";
      info.textContent = t("gripTitle") + " ⓘ";
      info.addEventListener("click", function(ev){
        ev.stopPropagation();
        if(typeof openGripInfo === "function") openGripInfo();
      });
      return info;
    }
    box.appendChild(mkInfo()); // "起始握持 ⓘ" above the frame
    var frame = document.createElement("div");
    frame.className = "grip-frame";
    GRIP_GROUPS.forEach(function(g){
      var grp = document.createElement("div");
      grp.className = "grip-group";
      grp.setAttribute("data-group", g.key);
      var cat = document.createElement("span");   // header only: not clickable, never selected
      cat.className = "grip-cat";
      cat.textContent = t("gripS_" + g.key);
      cat.title = t("grip_" + g.key);
      cat.style.gridRow = "span " + Math.ceil(g.grips.length / GRIP_COLS);
      grp.appendChild(cat);
      var subs = document.createElement("div");
      subs.className = "grip-subs";
      g.grips.forEach(function(k){ subs.appendChild(mk(k)); });
      grp.appendChild(subs);
      frame.appendChild(grp);
    });
    box.appendChild(frame);
    function sync(){
      Object.keys(btns).forEach(function(k){ btns[k].classList.toggle("active", value === k); });
    }
    box.setValue = function(v){ value = isGripSub(v) ? v : null; sync(); };
    box.getValue = function(){ return value; };
    sync();
    return box;
  }
