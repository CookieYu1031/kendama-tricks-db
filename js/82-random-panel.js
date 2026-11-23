"use strict";

  /* ============================================================
     RANDOM TRICK — modal UI (opened from the tools sheet, js/80-tools.js).
     Logic: js/81-random-logic.js.
  ============================================================ */
  addStrings({
    zh:{ rndTitle:"隨機抽招", rndScope:"範圍", rndWholeTable:"整個表", rndGrip:"握持手勢", rndAny:"不限", rndParts:"部位",
         rndModeAny:"其一符合", rndModeAll:"全符合", rndClass:"招式類別", rndRate:"成功率", rndCount:"抽取數量",
         rndPool:"符合 {n} 招", rndPoolLeft:"符合 {n} 招（本輪剩 {m}）", rndDraw:"抽招", rndNewRound:"新一輪",
         rndExhausted:"這一輪的招式都抽完了，按「新一輪」重新開始", rndEmptyPool:"沒有符合條件的招式",
         rndReroll:"重抽這張", rndHistory:"紀錄", rndClearHistory:"清除紀錄", rndNoHistory:"還沒有抽招紀錄",
         rndRerollNone:"沒有其他可抽的招式", rndClose:"關閉", rndRoundReset:"已開始新一輪" },
    jp:{ rndTitle:"ランダム出題", rndScope:"範囲", rndWholeTable:"表全体", rndGrip:"持ち方", rndAny:"指定なし", rndParts:"部位",
         rndModeAny:"いずれか一致", rndModeAll:"すべて一致", rndClass:"技の分類", rndRate:"成功率", rndCount:"出題数",
         rndPool:"該当 {n} 件", rndPoolLeft:"該当 {n} 件（今回の残り {m}）", rndDraw:"抽選", rndNewRound:"新ラウンド",
         rndExhausted:"このラウンドの技は出尽くしました。「新ラウンド」で再開します", rndEmptyPool:"条件に合う技がありません",
         rndReroll:"この技を引き直す", rndHistory:"履歴", rndClearHistory:"履歴を消去", rndNoHistory:"履歴はまだありません",
         rndRerollNone:"他に引ける技がありません", rndClose:"閉じる", rndRoundReset:"新しいラウンドを開始しました" },
    en:{ rndTitle:"Random Trick", rndScope:"Scope", rndWholeTable:"Whole table", rndGrip:"Grip", rndAny:"Any", rndParts:"Parts",
         rndModeAny:"Match any", rndModeAll:"Match all", rndClass:"Trick class", rndRate:"Landing rate", rndCount:"Number of tricks",
         rndPool:"{n} tricks match", rndPoolLeft:"{n} tricks match ({m} left this round)", rndDraw:"Draw", rndNewRound:"New round",
         rndExhausted:"Every trick this round is drawn. Press \"New round\" to start over", rndEmptyPool:"No tricks match",
         rndReroll:"Reroll this card", rndHistory:"History", rndClearHistory:"Clear history", rndNoHistory:"No draws yet",
         rndRerollNone:"No other trick to draw", rndClose:"Close", rndRoundReset:"New round started" }
  });

  var rnd = { conds: null, round: newRandomRound(), shown: [], pool: [], history: [], histOpen: false, diagram: null };

  function rndEl(id){ return document.getElementById(id); }
  function rndIsOpen(){ var o = rndEl("randomOverlay"); return !!o && o.classList.contains("show"); }
  function rndSpaces(){
    return db.spaces.filter(function(s){ return !isGuest() || isGuestVisibleSpace(s.id); });
  }
  function rndChip(text, active, onClick, cls){
    var b = document.createElement("button");
    b.type = "button"; b.className = "drawer-chip" + (cls ? " " + cls : "") + (active ? " active" : "");
    b.textContent = text;
    b.addEventListener("click", onClick);
    return b;
  }
  function rndRow(label, node){
    var f = document.createElement("div");
    f.className = "field";
    var l = document.createElement("label"); l.textContent = label;
    f.appendChild(l); f.appendChild(node);
    return f;
  }
  function rndChipRow(){ var r = document.createElement("div"); r.className = "drawer-chip-row rnd-chips"; return r; }

  // Folders of a table, depth-first with indentation.
  function rndFolderOptions(spaceId){
    var cats = db.categories.filter(function(c){ return c.spaceId === spaceId; }), out = [];
    function walk(pid, depth){
      cats.filter(function(c){ return (c.parentId || null) === pid; })
        .sort(function(a, b){ return (a.order || 0) - (b.order || 0); })
        .forEach(function(c){ out.push({ id: c.id, label: new Array(depth + 1).join("　") + localize(c.name) }); walk(c.id, depth + 1); });
    }
    walk(null, 0);
    return out;
  }

  // Full locations (incl. favorites) so the favorites table scope finds duplicated tricks.
  function rndLocsFor(e){
    var tr = getTrick(e.id), locs = [];
    if(!tr) return e.locs;
    tr.categoryIds.forEach(function(cid){
      if(cid === FAV_STARRED_ID || cid === FAV_CUSTOM_ID) return;
      var sid = containerSpaceId(cid);
      if(sid) locs.push({ spaceId: sid, path: pathToContainer(cid) });
    });
    return locs.length ? locs : e.locs;
  }
  function rndRecomputePool(){
    var c = rnd.conds;
    rnd.pool = buildRandomPool(getSearchIndex(), c, { ignoreRate: isGuest(), locsFor: rndLocsFor,
      rateOf: function(id){ var tr = getTrick(id); return tr ? tr.rate || null : null; } });
    var left = randomRemaining(rnd.pool, rnd.round).length;
    rndEl("rndPoolNote").textContent = Object.keys(rnd.round.used).length
      ? t("rndPoolLeft").replace("{n}", rnd.pool.length).replace("{m}", left)
      : t("rndPool").replace("{n}", rnd.pool.length);
  }
  function rndChanged(){ saveRandomConds(rnd.conds); rndBuildConds(); rndRecomputePool(); }

  function rndToggle(list, k){ var i = list.indexOf(k); if(i === -1) list.push(k); else list.splice(i, 1); }

  function rndBuildConds(){
    var c = rnd.conds, host = rndEl("rndConds");
    host.innerHTML = "";
    var sel = document.createElement("select"), fsel = document.createElement("select");
    rndSpaces().forEach(function(s){
      var o = document.createElement("option"); o.value = s.id; o.textContent = spaceLabel(s.id); sel.appendChild(o);
    });
    sel.value = c.space;
    sel.addEventListener("change", function(){ c.space = sel.value; c.folder = null; rndChanged(); });
    var o0 = document.createElement("option"); o0.value = ""; o0.textContent = t("rndWholeTable"); fsel.appendChild(o0);
    rndFolderOptions(c.space).forEach(function(f){
      var o = document.createElement("option"); o.value = f.id; o.textContent = f.label; fsel.appendChild(o);
    });
    fsel.value = c.folder || "";
    if(fsel.value !== (c.folder || "")) c.folder = null;
    fsel.addEventListener("change", function(){ c.folder = fsel.value || null; rndChanged(); });
    var scope = document.createElement("div"); scope.className = "field-row rnd-scope";
    var f1 = document.createElement("div"); f1.className = "field"; f1.appendChild(sel);
    var f2 = document.createElement("div"); f2.className = "field"; f2.appendChild(fsel);
    scope.appendChild(f1); scope.appendChild(f2);
    host.appendChild(rndRow(t("rndScope"), scope));

    // 不限 chip + the shared grip picker (js/36, sub-grips only).
    var grip = document.createElement("div"); grip.className = "rnd-grip";
    var anyRow = rndChipRow();
    anyRow.appendChild(rndChip(t("rndAny"), !c.grip, function(){ c.grip = null; rndChanged(); }));
    grip.appendChild(anyRow);
    grip.appendChild(buildGripPicker({ value: c.grip, onChange: function(v){ c.grip = v; rndChanged(); } }));
    host.appendChild(rndRow(t("rndGrip"), grip));

    var partsBox = document.createElement("div"); partsBox.className = "rnd-parts";
    rnd.diagram = createPartDiagram({ selected: c.parts, interactive: true, onToggle: function(k){ rndToggle(c.parts, k); rndChanged(); } });
    var mode = rndChipRow();
    ["any", "all"].forEach(function(m){
      var b = rndChip((m === "all" ? "≅ " : "≈ ") + t(m === "all" ? "rndModeAll" : "rndModeAny"), c.partsMode === m, function(){ c.partsMode = m; rndChanged(); });
      mode.appendChild(b);
    });
    partsBox.appendChild(rnd.diagram); partsBox.appendChild(mode);
    var condRow = document.createElement("div"); condRow.className = "rnd-cond-row";
    condRow.appendChild(rndRow(t("rndParts"), partsBox));
    host.appendChild(condRow);

    var classes = (db.tags || []).filter(function(g){ return tagKind(g) === "class"; });
    if(c.classId && !classes.some(function(g){ return g.id === c.classId; })) c.classId = null;
    if(classes.length){
      var cr = rndChipRow();
      classes.forEach(function(g){
        cr.appendChild(rndChip(localize(g.name), c.classId === g.id, function(){
          if(c.classId === g.id) c.classId = null;
          else { c.classId = g.id; searchApplyClassTag(c, g); }
          rndChanged();
        }, "tag-class"));
      });
      var classField = rndRow(t("rndClass"), cr); classField.className += " rnd-class-field";
      condRow.appendChild(classField);
    }

    if(!isGuest()){
      var rr = rndChipRow();
      RANDOM_RATE_KEYS.forEach(function(k){
        var on = c.rates.indexOf(k) !== -1;
        var b = rndChip(t("rate_" + k), on, function(){ rndToggle(c.rates, k); rndChanged(); }, "rnd-rate");
        if(on){ b.style.background = RATE_COLORS[k]; b.style.color = "var(--rate-" + k + "-ink)"; b.style.borderColor = "transparent"; }
        rr.appendChild(b);
      });
      host.appendChild(rndRow(t("rndRate"), rr));
    }

    var step = document.createElement("div"); step.className = "rnd-stepper";
    var minus = rndChip("−", false, function(){ c.count = Math.max(1, c.count - 1); rndChanged(); }, "rnd-step-btn");
    var plus = rndChip("+", false, function(){ c.count = Math.min(RANDOM_COUNT_MAX, c.count + 1); rndChanged(); }, "rnd-step-btn");
    var num = document.createElement("span"); num.className = "rnd-step-num"; num.textContent = c.count;
    step.appendChild(minus); step.appendChild(num); step.appendChild(plus);
    host.appendChild(rndRow(t("rndCount"), step));
  }

  /* ---------- cards ---------- */
  function rndTrickMeta(tr){
    var bits = [];
    if(tr.grip) bits.push(t("grip_" + tr.grip));
    (tr.parts || []).forEach(function(k){ bits.push(t("part_" + k)); });
    return bits.join(" · ");
  }
  function rndBuildCard(id, idx){
    var tr = getTrick(id);
    if(!tr) return null;
    var card = document.createElement("div");
    card.className = "rnd-card";
    var icon = document.createElement("div");
    icon.className = "item-icon trick";
    var hex = tr.color ? colorHex(tr.color) : TRICK_DEFAULT_HEX;
    icon.style.background = hexToRgba(hex, 0.22); icon.style.color = hex;
    if(isImageIcon(tr.icon)){ icon.classList.add("img-icon"); icon.innerHTML = iconHtml(tr.icon); }
    else if(tr.icon){ icon.style.fontSize = "15px"; icon.textContent = tr.icon; } else { icon.innerHTML = ICON_PLAY; }
    var text = document.createElement("div"); text.className = "rnd-card-text";
    var nm = document.createElement("div"); nm.className = "rnd-card-name"; nm.textContent = localize(tr.name);
    var meta = document.createElement("div"); meta.className = "rnd-card-meta"; meta.textContent = rndTrickMeta(tr);
    text.appendChild(nm); text.appendChild(meta);
    if(!isGuest() && tr.rate){
      var badge = document.createElement("span");
      badge.className = "rnd-rate-badge"; badge.textContent = t("rate_" + tr.rate);
      badge.style.background = RATE_COLORS[tr.rate]; badge.style.color = "var(--rate-" + tr.rate + "-ink)";
      text.appendChild(badge);
    }
    var re = document.createElement("button");
    re.type = "button"; re.className = "icon-btn rnd-reroll";
    re.title = t("rndReroll"); re.setAttribute("aria-label", t("rndReroll"));
    re.innerHTML = TOOL_ICON_DICE;
    re.addEventListener("click", function(ev){ ev.stopPropagation(); rndRerollAt(idx); });
    card.appendChild(icon); card.appendChild(text); card.appendChild(re);
    card.addEventListener("click", function(){ closeRandomTool(); goToTrickLocation(id); });
    return card;
  }
  function rndRenderCards(){
    var host = rndEl("rndResults");
    host.innerHTML = "";
    rnd.shown.forEach(function(id, i){ var c = rndBuildCard(id, i); if(c) host.appendChild(c); });
  }
  function rndMsg(key){
    var host = rndEl("rndResults");
    host.innerHTML = "";
    var d = document.createElement("div"); d.className = "search-empty"; d.textContent = t(key);
    host.appendChild(d);
  }

  function rndDraw(){
    rndRecomputePool();
    if(!rnd.pool.length){ rnd.shown = []; rndMsg("rndEmptyPool"); return; }
    var r = drawRandom(rnd.pool, rnd.conds.count, rnd.round);
    if(r.exhausted){ rnd.shown = []; rndMsg("rndExhausted"); return; }
    rnd.shown = r.ids;
    rnd.history = pushRandomHistory(rnd.history, r.ids);
    saveRandomHistory(rnd.history);
    rndRenderCards(); rndRecomputePool(); rndBuildHistory();
    var res = rndEl("rndResults");
    if(res && res.scrollIntoView) res.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }
  function rndRerollAt(i){
    var next = rerollRandom(rnd.pool, rnd.round, rnd.shown[i]);
    if(!next){ showToast(t("rndRerollNone")); return; }
    rnd.shown[i] = next;
    rndRenderCards(); rndRecomputePool();
  }
  function rndNewRound(){
    rnd.round = newRandomRound();
    rndRecomputePool();
    showToast(t("rndRoundReset"));
  }

  /* ---------- history ---------- */
  function rndBuildHistory(){
    var box = rndEl("rndHistory");
    box.innerHTML = "";
    rndEl("rndHistToggle").textContent = t("rndHistory") + " (" + rnd.history.length + ")";
    rndEl("rndHistToggle").classList.toggle("active", rnd.histOpen);
    box.style.display = rnd.histOpen ? "" : "none";
    if(!rnd.histOpen) return;
    if(!rnd.history.length){
      var e = document.createElement("div"); e.className = "search-note"; e.textContent = t("rndNoHistory"); box.appendChild(e);
      return;
    }
    rnd.history.forEach(function(h){
      var ids = h.ids.filter(function(id){ return !!getTrick(id); });
      if(!ids.length) return;
      var row = document.createElement("button");
      row.type = "button"; row.className = "rnd-hist-row";
      var d = new Date(h.at);
      var tm = document.createElement("span"); tm.className = "rnd-hist-time";
      tm.textContent = (d.getMonth() + 1) + "/" + d.getDate() + " " + ("0" + d.getHours()).slice(-2) + ":" + ("0" + d.getMinutes()).slice(-2);
      var nm = document.createElement("span"); nm.className = "rnd-hist-names";
      nm.textContent = ids.map(function(id){ return localize(getTrick(id).name); }).join("、");
      row.appendChild(tm); row.appendChild(nm);
      row.addEventListener("click", function(){ rnd.shown = ids.slice(); rndRenderCards(); });
      box.appendChild(row);
    });
    var clr = document.createElement("button");
    clr.type = "button"; clr.className = "btn rnd-clear"; clr.textContent = t("rndClearHistory");
    clr.addEventListener("click", function(){ rnd.history = []; saveRandomHistory([]); rndBuildHistory(); });
    box.appendChild(clr);
  }

  /* ---------- open / close ---------- */
  function rndEnsureOverlay(){
    var ov = rndEl("randomOverlay");
    if(ov) return ov;
    ov = document.createElement("div");
    ov.className = "modal-overlay"; ov.id = "randomOverlay";
    ov.innerHTML =
      '<div class="modal modal-lg random-modal" role="dialog" aria-modal="true">' +
        '<div class="settings-head"><div class="modal-title" id="rndTitle"></div>' +
        '<button type="button" class="icon-btn settings-close" id="rndClose">' + ICON_X + '</button></div>' +
        '<div class="modal-scroll">' +
          '<div id="rndConds"></div><div class="field-hint" id="rndPoolNote"></div>' +
          '<div class="modal-actions rnd-actions"><button type="button" class="btn btn-primary" id="rndDrawBtn"></button>' +
          '<button type="button" class="btn" id="rndRoundBtn"></button></div>' +
          '<div class="rnd-results" id="rndResults"></div>' +
          '<button type="button" class="drawer-chip rnd-hist-toggle" id="rndHistToggle"></button>' +
          '<div class="rnd-history" id="rndHistory"></div>' +
        '</div></div>';
    document.body.appendChild(ov);
    ov.addEventListener("click", function(ev){ if(ev.target === ov) closeRandomTool(); });
    rndEl("rndClose").addEventListener("click", closeRandomTool);
    rndEl("rndDrawBtn").addEventListener("click", rndDraw);
    rndEl("rndRoundBtn").addEventListener("click", rndNewRound);
    rndEl("rndHistToggle").addEventListener("click", function(){ rnd.histOpen = !rnd.histOpen; rndBuildHistory(); });
    return ov;
  }

  function openRandomTool(){
    var ov = rndEnsureOverlay();
    rnd.conds = loadRandomConds(rndSpaces().map(function(s){ return s.id; }));
    if(isGuest()) rnd.conds.rates = RANDOM_RATE_KEYS.slice();
    rnd.history = loadRandomHistory();
    rnd.shown = [];
    rndEl("rndTitle").textContent = t("rndTitle");
    rndEl("rndClose").title = t("rndClose"); rndEl("rndClose").setAttribute("aria-label", t("rndClose"));
    rndEl("rndDrawBtn").textContent = t("rndDraw");
    rndEl("rndRoundBtn").textContent = t("rndNewRound");
    rndEl("rndResults").innerHTML = "";
    rndBuildConds(); rndRecomputePool(); rndBuildHistory();
    ov.classList.add("show");
  }
  function closeRandomTool(){
    var ov = rndEl("randomOverlay");
    if(ov) ov.classList.remove("show");
  }

  getToolById("random").open = openRandomTool;

  window.addEventListener("keydown", function(ev){
    if(ev.key !== "Escape" || !rndIsOpen()) return;
    ev.stopPropagation();
    closeRandomTool();
  }, true);
