"use strict";

  /* ============================================================
     ADMIN TAG MANAGER (v0.9.2, admin only) — sub-modal opened from the admin panel.
     Three tabs: 握持＋部位 (read-only list of the fixed grip/part fields),
     招式類別 (db.tags kind "class" + combo), 文字標籤 (kind "text").
     Edits go through createTag/updateTag/removeTag (saveDB -> pending -> 發布更新).
     Pure logic: js/30-drawer-logic.js (tests/tags.test.js).
  ============================================================ */
  addStrings({
    zh:{ tagMgrTitle:"標籤管理", tagTabGrip:"握持＋部位", tagTabClass:"招式類別", tagTabText:"文字標籤",
         tagMgrGripHint:"握持與部位是固定欄位，目前僅供檢視（之後會對應圖示）。", tagMgrNew:"新增", tagMgrEmpty:"（尚無項目）",
         tagMgrUsed:"{n} 個招式使用", tagMgrNameRequired:"請至少輸入一個名稱", tagMgrComboLabel:"持法與部位組合",
         tagMgrGripLabel:"握持（單選）", tagMgrPartsLabel:"部位（複選）", tagMgrNoCombo:"（無組合）", tagMgrEdit:"編輯" },
    jp:{ tagMgrTitle:"タグ管理", tagTabGrip:"持ち方＋部位", tagTabClass:"技のカテゴリ", tagTabText:"テキストタグ",
         tagMgrGripHint:"持ち方と部位は固定項目で、現在は閲覧のみです（今後アイコンと対応予定）。", tagMgrNew:"追加", tagMgrEmpty:"（項目なし）",
         tagMgrUsed:"{n} 件の技で使用", tagMgrNameRequired:"名前を1つ以上入力してください", tagMgrComboLabel:"持ち方と部位の組み合わせ",
         tagMgrGripLabel:"持ち方（単一選択）", tagMgrPartsLabel:"部位（複数選択）", tagMgrNoCombo:"（組み合わせなし）", tagMgrEdit:"編集" },
    en:{ tagMgrTitle:"Tag manager", tagTabGrip:"Grip + parts", tagTabClass:"Trick classes", tagTabText:"Text tags",
         tagMgrGripHint:"Grip and parts are fixed fields, view-only for now (to be tied to icons later).", tagMgrNew:"Add", tagMgrEmpty:"(Nothing yet)",
         tagMgrUsed:"Used by {n} tricks", tagMgrNameRequired:"Enter at least one name", tagMgrComboLabel:"Grip and parts combo",
         tagMgrGripLabel:"Grip (single)", tagMgrPartsLabel:"Parts (multiple)", tagMgrNoCombo:"(No combo)", tagMgrEdit:"Edit" }
  });

  // tab: "grip" | "class" | "text"; editing: null | "new" | tag id; form: draft for the open form.
  var tagMgr = { tab: "class", editing: null, form: null, box: null };

  function openAdminTags(){
    if(typeof isAdminAccount === "function" && !isAdminAccount()) return;
    var ov = adminSubModal("adminTagsOverlay", "tagMgrTitle", "admin-sub-modal");
    ov.classList.add("show");
    tagMgr.editing = null; tagMgr.form = null;
    renderAdminTags(ov.querySelector(".modal-scroll"));
  }

  function tagMgrRefresh(){
    saveDB();
    if(typeof renderColumns === "function") renderColumns();
    if(typeof refreshAdminPending === "function") refreshAdminPending();
    renderAdminTags(tagMgr.box);
  }

  function tagMgrButton(cls, text, onClick){
    var b = document.createElement("button");
    b.type = "button"; b.className = cls; b.textContent = text;
    b.addEventListener("click", onClick);
    return b;
  }

  function renderAdminTags(box){
    if(!box) return;
    tagMgr.box = box;
    box.innerHTML = "";
    var wrap = document.createElement("div");
    wrap.className = "tagmgr-body";
    var tabs = document.createElement("div");
    tabs.className = "tagmgr-tabs";
    [["grip", "tagTabGrip"], ["class", "tagTabClass"], ["text", "tagTabText"]].forEach(function(x){
      tabs.appendChild(tagMgrButton("drawer-chip" + (tagMgr.tab === x[0] ? " active" : ""), t(x[1]), function(){
        tagMgr.tab = x[0]; tagMgr.editing = null; tagMgr.form = null; renderAdminTags(box);
      }));
    });
    wrap.appendChild(tabs);
    if(tagMgr.tab === "grip") renderTagMgrGrip(wrap);
    else renderTagMgrList(wrap, tagMgr.tab);
    box.appendChild(wrap);
  }

  // Tab 1: read-only grips + parts.
  function renderTagMgrGrip(wrap){
    var hint = document.createElement("div");
    hint.className = "field-hint";
    hint.textContent = t("tagMgrGripHint");
    wrap.appendChild(hint);
    var gt = document.createElement("div"); gt.className = "tagmgr-section-title"; gt.textContent = t("tagMgrGripLabel");
    wrap.appendChild(gt);
    var gr = document.createElement("div"); gr.className = "drawer-chip-row";
    GRIP_KEYS.forEach(function(k){ gr.appendChild(makeChip(t("grip_" + k), false)); });
    wrap.appendChild(gr);
    var pt = document.createElement("div"); pt.className = "tagmgr-section-title"; pt.textContent = t("tagMgrPartsLabel");
    wrap.appendChild(pt);
    var pr = document.createElement("div"); pr.className = "drawer-chip-row";
    fillPartGroups(pr, function(k){ return makeChip(t("part_" + k), false); });
    wrap.appendChild(pr);
  }

  // Tabs 2 / 3: list of tags of one kind + add / edit form.
  function renderTagMgrList(wrap, kind){
    var tags = (db.tags || []).filter(function(g){ return tagKind(g) === kind; });
    var list = document.createElement("div");
    list.className = "tagmgr-list";
    if(!tags.length){
      var none = document.createElement("div");
      none.className = "field-hint"; none.textContent = t("tagMgrEmpty");
      list.appendChild(none);
    }
    tags.forEach(function(g){
      var row = document.createElement("div");
      row.className = "tagmgr-row";
      var main = document.createElement("div");
      main.className = "tagmgr-row-main";
      var nm = document.createElement("div");
      nm.className = "tagmgr-row-name";
      nm.textContent = [g.name.zh, g.name.jp, g.name.en].filter(Boolean).join(" / ");
      var sub = document.createElement("div");
      sub.className = "tagmgr-row-sub";
      var used = t("tagMgrUsed").replace("{n}", tagUsageCount(g.id));
      sub.textContent = kind === "class" ? ((comboLabel(g.combo) || t("tagMgrNoCombo")) + " · " + used) : used;
      main.appendChild(nm); main.appendChild(sub);
      var acts = document.createElement("div");
      acts.className = "tagmgr-row-actions";
      var ed = document.createElement("button");
      ed.type = "button"; ed.className = "mini-btn"; ed.title = t("tagMgrEdit"); ed.innerHTML = ICON_EDIT;
      ed.addEventListener("click", function(){
        tagMgr.editing = g.id;
        tagMgr.form = { zh: g.name.zh || "", jp: g.name.jp || "", en: g.name.en || "",
                        grip: g.combo ? g.combo.grip : null, parts: g.combo ? g.combo.parts.slice() : [] };
        renderAdminTags(tagMgr.box);
      });
      var del = document.createElement("button");
      del.type = "button"; del.className = "mini-btn danger"; del.title = t("delete"); del.innerHTML = ICON_TRASH;
      del.addEventListener("click", function(){
        openConfirm(t("confirmDeleteTagTitle"), t("confirmDeleteTagBody") + " (" + t("tagMgrUsed").replace("{n}", tagUsageCount(g.id)) + ")", function(){
          removeTag(g.id);
          if(tagMgr.editing === g.id){ tagMgr.editing = null; tagMgr.form = null; }
          tagMgrRefresh();
        });
      });
      acts.appendChild(ed); acts.appendChild(del);
      row.appendChild(main); row.appendChild(acts);
      list.appendChild(row);
    });
    wrap.appendChild(list);
    if(tagMgr.editing){ wrap.appendChild(buildTagMgrForm(kind)); return; }
    wrap.appendChild(tagMgrButton("col-add-btn", "+ " + t("tagMgrNew"), function(){
      tagMgr.editing = "new";
      tagMgr.form = { zh: "", jp: "", en: "", grip: null, parts: [] };
      renderAdminTags(tagMgr.box);
    }));
  }

  function buildTagMgrForm(kind){
    var f = tagMgr.form;
    var form = document.createElement("div");
    form.className = "tagmgr-form";
    [["zh", "中文"], ["jp", "日本語"], ["en", "English"]].forEach(function(l){
      var fd = document.createElement("div");
      fd.className = "field";
      var lb = document.createElement("label"); lb.textContent = l[1];
      var inp = document.createElement("input");
      inp.type = "text"; inp.value = f[l[0]]; inp.maxLength = 60; inp.autocomplete = "off";
      inp.addEventListener("input", function(){ f[l[0]] = inp.value; });
      fd.appendChild(lb); fd.appendChild(inp);
      form.appendChild(fd);
    });
    if(kind === "class"){
      var cl = document.createElement("div"); cl.className = "tagmgr-section-title"; cl.textContent = t("tagMgrComboLabel");
      form.appendChild(cl);
      var gt = document.createElement("div"); gt.className = "tagmgr-section-title"; gt.textContent = t("tagMgrGripLabel");
      form.appendChild(gt);
      var gr = document.createElement("div"); gr.className = "drawer-chip-row tagmgr-chips";
      GRIP_KEYS.forEach(function(k){
        gr.appendChild(makeChip(t("grip_" + k), f.grip === k, function(){ f.grip = f.grip === k ? null : k; renderAdminTags(tagMgr.box); }));
      });
      form.appendChild(gr);
      var pt = document.createElement("div"); pt.className = "tagmgr-section-title"; pt.textContent = t("tagMgrPartsLabel");
      form.appendChild(pt);
      var pr = document.createElement("div"); pr.className = "drawer-chip-row tagmgr-chips";
      fillPartGroups(pr, function(k){
        return makeChip(t("part_" + k), f.parts.indexOf(k) !== -1, function(){
          var i = f.parts.indexOf(k);
          if(i === -1) f.parts.push(k); else f.parts.splice(i, 1);
          renderAdminTags(tagMgr.box);
        });
      });
      form.appendChild(pr);
    }
    var acts = document.createElement("div");
    acts.className = "tagmgr-form-actions";
    acts.appendChild(tagMgrButton("btn btn-ghost btn-sm", t("cancel"), function(){
      tagMgr.editing = null; tagMgr.form = null; renderAdminTags(tagMgr.box);
    }));
    acts.appendChild(tagMgrButton("btn btn-primary btn-sm", t("save"), function(){ saveTagMgrForm(kind); }));
    form.appendChild(acts);
    return form;
  }

  function saveTagMgrForm(kind){
    var f = tagMgr.form;
    var name = { zh: f.zh, jp: f.jp, en: f.en };
    var combo = { grip: f.grip, parts: f.parts };
    var ok;
    if(tagMgr.editing === "new") ok = createTag(kind, name, combo);
    else ok = updateTag(tagMgr.editing, kind === "class" ? { name: name, combo: combo } : { name: name });
    if(!ok) return showToast(t("tagMgrNameRequired"), "error");
    tagMgr.editing = null; tagMgr.form = null;
    tagMgrRefresh();
  }

  (function(){
    var b = document.getElementById("adminTagsBtn");
    if(b) b.addEventListener("click", openAdminTags);
  })();
