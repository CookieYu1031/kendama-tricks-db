"use strict";

  /* ============================================================
     TAG MANAGER tab 1 (握持手勢＋部位): the fixed grips and parts. Counts and diagram positions can't change;
     only the three-language names (db.labels) are editable. Split from js/77-admin-tags.js (tagMgr state,
     strings and the other tabs live there).
  ============================================================ */
  /* ---- Label (name) overrides: pure helpers (tests/admin/labels.test.js) ---- */
  var LABEL_LANGS = ["zh", "jp", "en"];
  // New labels object after setting `key` to vals {zh,jp,en}. A language equal to its built-in
  // name (or empty) is stored as "" (= use built-in); an all-empty entry is removed.
  function applyLabelEdit(labels, key, vals){
    var out = JSON.parse(JSON.stringify(labels || {}));
    if(!isLabelKey(key)) return out;
    var e = {}, any = false;
    LABEL_LANGS.forEach(function(l){
      var s = String((vals && vals[l]) || "").trim().slice(0, LABEL_NAME_MAX);
      if(s === defaultText(key, l)) s = "";
      e[l] = s; if(s) any = true;
    });
    if(any) out[key] = e; else delete out[key];
    return normalizeLabels(out);
  }

  // Draft edit state: tagMgr.labelEdit = { id, keys, vals: { full:{zh,jp,en}, short:{...} } }.
  function openLabelEdit(kind, base){
    var keys = kind === "grip" ? { full: "grip_" + base, short: "gripS_" + base } : { full: "part_" + base };
    var vals = { full: {} };
    LABEL_LANGS.forEach(function(l){ vals.full[l] = labelOverride(keys.full, l); });
    if(keys.short){ vals.short = {}; LABEL_LANGS.forEach(function(l){ vals.short[l] = labelOverride(keys.short, l); }); }
    tagMgr.labelEdit = { id: kind + ":" + base, keys: keys, vals: vals };
    renderAdminTags(tagMgr.box);
    var ed = tagMgr.box && tagMgr.box.querySelector(".labelmgr-form");
    if(ed && ed.scrollIntoView) ed.scrollIntoView({ block: "nearest" });
  }
  // short: show the grip's short name (gripS_) with the full name as tooltip, like the grip picker.
  function labelChip(kind, base, cls, short){
    var id = kind + ":" + base;
    var b = makeChip(t((short ? "gripS_" : kind + "_") + base), !!(tagMgr.labelEdit && tagMgr.labelEdit.id === id), function(){ openLabelEdit(kind, base); });
    if(short) b.title = t(kind + "_" + base);
    if(cls) cls.split(" ").forEach(function(c){ b.classList.add(c); });
    return b;
  }

  function buildLabelForm(){
    var le = tagMgr.labelEdit;
    var form = document.createElement("div");
    form.className = "tagmgr-form labelmgr-form";
    [["full", "labelMgrFull"], ["short", "labelMgrShort"]].forEach(function(grp){
      if(!le.keys[grp[0]]) return;
      if(le.keys.short){
        var tt = document.createElement("div"); tt.className = "tagmgr-section-title"; tt.textContent = t(grp[1]);
        form.appendChild(tt);
      }
      [["zh", "中文"], ["jp", "日本語"], ["en", "English"]].forEach(function(l){
        var fd = document.createElement("div"); fd.className = "field";
        var lb = document.createElement("label"); lb.textContent = l[1];
        var inp = document.createElement("input");
        inp.type = "text"; inp.maxLength = LABEL_NAME_MAX; inp.autocomplete = "off";
        inp.value = le.vals[grp[0]][l[0]];
        inp.placeholder = defaultText(le.keys[grp[0]], l[0]);
        inp.addEventListener("input", function(){ le.vals[grp[0]][l[0]] = inp.value; });
        fd.appendChild(lb); fd.appendChild(inp);
        form.appendChild(fd);
      });
    });
    var hint = document.createElement("div"); hint.className = "field-hint"; hint.textContent = t("labelMgrBlankHint");
    form.appendChild(hint);
    var acts = document.createElement("div"); acts.className = "tagmgr-form-actions";
    acts.appendChild(tagMgrButton("btn btn-ghost btn-sm", t("cancel"), function(){ tagMgr.labelEdit = null; renderAdminTags(tagMgr.box); }));
    acts.appendChild(tagMgrButton("btn btn-ghost btn-sm", t("labelMgrReset"), function(){
      saveLabelEdit({ full: { zh: "", jp: "", en: "" }, short: { zh: "", jp: "", en: "" } });
    }));
    acts.appendChild(tagMgrButton("btn btn-primary btn-sm", t("save"), function(){ saveLabelEdit(le.vals); }));
    form.appendChild(acts);
    return form;
  }

  function saveLabelEdit(vals){
    if(typeof isAdminAccount === "function" && !isAdminAccount()) return;
    var le = tagMgr.labelEdit;
    if(!le) return;
    var labels = db.labels || {};
    ["full", "short"].forEach(function(g){
      if(le.keys[g]) labels = applyLabelEdit(labels, le.keys[g], vals[g]);
    });
    db.labels = labels;
    tagMgr.labelEdit = null;
    tagMgrRefresh();
    showToast(t("labelMgrSaved"));
  }

  // Tab 1: the fixed grips + parts (counts and diagram positions can't change); names are editable.
  // Diagram: tap a region to highlight its part chip (one at a time). Chips open the name editor.
  function renderTagMgrGrip(wrap){
    var hint = document.createElement("div");
    hint.className = "field-hint";
    hint.textContent = t("tagMgrGripHint");
    wrap.appendChild(hint);
    var cur = null, partChips = {};
    var dia = createPartDiagram({ selected: [], interactive: true, onToggle: function(k){
      cur = cur === k ? null : k;
      dia.update(cur ? [cur] : []);
      Object.keys(partChips).forEach(function(x){ partChips[x].classList.toggle("hi", x === cur); });
    } });
    dia.classList.add("tagmgr-diagram");
    wrap.appendChild(dia);
    var gt = document.createElement("div"); gt.className = "tagmgr-section-title"; gt.textContent = t("tagMgrGripLabel");
    wrap.appendChild(gt);
    // Same layout as the shared grip picker (js/36, css/grip.css): header pill + sub-grip chips per group, short names.
    // Here the header is clickable too (its names are editable).
    var gr = document.createElement("div"); gr.className = "grip-picker labelmgr-grips";
    var frame = document.createElement("div"); frame.className = "grip-frame";
    GRIP_GROUPS.forEach(function(g){
      var grp = document.createElement("div"); grp.className = "grip-group";
      var cat = labelChip("grip", g.key, "grip-cat labelmgr-cat", true);
      cat.style.gridRow = "span " + Math.ceil(g.grips.length / GRIP_COLS);
      grp.appendChild(cat);
      var subs = document.createElement("div"); subs.className = "grip-subs";
      g.grips.forEach(function(k){ subs.appendChild(gripPlaceChip(labelChip("grip", k, "", true), k)); });
      grp.appendChild(subs);
      frame.appendChild(grp);
    });
    gr.appendChild(frame);
    wrap.appendChild(gr);
    var pt = document.createElement("div"); pt.className = "tagmgr-section-title"; pt.textContent = t("tagMgrPartsLabel");
    wrap.appendChild(pt);
    var pr = document.createElement("div"); pr.className = "drawer-chip-row";
    fillPartGroups(pr, function(k){ return (partChips[k] = labelChip("part", k, "")); });
    wrap.appendChild(pr);
    if(tagMgr.labelEdit) wrap.appendChild(buildLabelForm());
  }
