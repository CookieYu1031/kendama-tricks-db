"use strict";

  /* ============================================================
     SHELL — 新手教學 (v0.14). Overlay is built lazily (no index.html markup).
     Logic: js/19-tutorial-logic.js. Data: Firestore tutorial/{kids|beginner},
     public read, admin write. Admin edits pages in place ("編輯此頁").
  ============================================================ */
  addStrings({
    zh:{ tutTitle:"新手教學", tutSub:"選一個入門路線", tutClose:"關閉", tutSoon:"敬請期待",
         tutKidsName:"幼兒入門", tutKidsDesc:"給小朋友的 10 個起步招式",
         tutBeginnerName:"新手入門", tutBeginnerDesc:"新手要先學會的 10 個基本招式",
         tutBack:"返回", tutPrev:"上一頁", tutNext:"下一頁", tutLoading:"載入中…", tutLoadFail:"載入失敗",
         tutEmpty:"此頁尚未設定內容", tutGo:"前往招式位置", tutNoVideo:"此招式沒有影片",
         tutOpenVideo:"開啟影片連結", tutEdit:"編輯此頁", tutEditDone:"結束編輯", tutSave:"儲存", tutSaved:"已儲存",
         tutSaveFail:"儲存失敗", tutTrickLabel:"招式 ID（7 碼或 @ID，可留空）",
         tutErrFormat:"格式錯誤，請輸入 7 碼 ID", tutErrNotFound:"找不到這個招式",
         tutErrNotPublic:"只能連結 00／01／02 公開分區的招式", tutTrickPicked:"招式：",
         tutTextZh:"解說（中文）", tutTextJp:"解說（日本語）", tutTextEn:"解說（English）",
         tutPageOf:"{n} / {m}" },
    jp:{ tutTitle:"はじめてガイド", tutSub:"入門コースを選んでください", tutClose:"閉じる", tutSoon:"近日公開",
         tutKidsName:"キッズ入門", tutKidsDesc:"お子さま向けの最初の10技",
         tutBeginnerName:"初心者入門", tutBeginnerDesc:"まず覚えたい基本の10技",
         tutBack:"戻る", tutPrev:"前のページ", tutNext:"次のページ", tutLoading:"読み込み中…", tutLoadFail:"読み込みに失敗しました",
         tutEmpty:"このページはまだ設定されていません", tutGo:"技の場所へ移動", tutNoVideo:"この技には動画がありません",
         tutOpenVideo:"動画リンクを開く", tutEdit:"このページを編集", tutEditDone:"編集を終了", tutSave:"保存", tutSaved:"保存しました",
         tutSaveFail:"保存に失敗しました", tutTrickLabel:"技 ID（7文字または @ID、空欄可）",
         tutErrFormat:"形式が正しくありません。7文字の ID を入力してください", tutErrNotFound:"この技は見つかりません",
         tutErrNotPublic:"00／01／02 の公開テーブルの技のみリンクできます", tutTrickPicked:"技：",
         tutTextZh:"解説（中文）", tutTextJp:"解説（日本語）", tutTextEn:"解説（English）",
         tutPageOf:"{n} / {m}" },
    en:{ tutTitle:"Beginner Tutorial", tutSub:"Pick a starter track", tutClose:"Close", tutSoon:"Coming soon",
         tutKidsName:"Kids Starter", tutKidsDesc:"10 first tricks for young kids",
         tutBeginnerName:"Beginner Starter", tutBeginnerDesc:"10 basic tricks every beginner should learn",
         tutBack:"Back", tutPrev:"Previous", tutNext:"Next", tutLoading:"Loading...", tutLoadFail:"Failed to load",
         tutEmpty:"This page has no content yet", tutGo:"Go to trick", tutNoVideo:"This trick has no video",
         tutOpenVideo:"Open video link", tutEdit:"Edit this page", tutEditDone:"Done editing", tutSave:"Save", tutSaved:"Saved",
         tutSaveFail:"Save failed", tutTrickLabel:"Trick ID (7 chars or @ID, optional)",
         tutErrFormat:"Invalid format; enter a 7-character ID", tutErrNotFound:"Trick not found",
         tutErrNotPublic:"Only tricks in the public tables 00/01/02 can be linked", tutTrickPicked:"Trick: ",
         tutTextZh:"Explanation (中文)", tutTextJp:"Explanation (日本語)", tutTextEn:"Explanation (English)",
         tutPageOf:"{n} / {m}" }
  });

  var TUT_TRACK_KEYS = { kids: ["tutKidsName", "tutKidsDesc"], beginner: ["tutBeginnerName", "tutBeginnerDesc"] };
  var tutState = { track: null, page: 0, editing: false, pages: {}, status: "" }; // pages[track] = normalized list

  function isTutorialOpen(){
    var ov = document.getElementById("tutorialOverlay");
    return !!ov && ov.classList.contains("show");
  }
  function tutIsAdmin(){ return typeof isAdminAccount === "function" && isAdminAccount(); }

  function ensureTutorialOverlay(){
    var ov = document.getElementById("tutorialOverlay");
    if(ov) return ov;
    ov = document.createElement("div");
    ov.className = "modal-overlay";
    ov.id = "tutorialOverlay";
    ov.innerHTML =
      '<div class="modal modal-lg tut-modal" role="dialog" aria-modal="true">' +
        '<div class="settings-head"><div><div class="modal-title tut-title"></div><div class="modal-sub tut-sub"></div></div>' +
        '<button type="button" class="icon-btn settings-close tut-close">' + ICON_X + '</button></div>' +
        '<div class="modal-scroll tut-body"></div>' +
      '</div>';
    document.body.appendChild(ov);
    ov.addEventListener("click", function(ev){ if(ev.target === ov) closeTutorial(); });
    ov.querySelector(".tut-close").addEventListener("click", closeTutorial);
    return ov;
  }

  function openTutorial(){
    var ov = ensureTutorialOverlay();
    tutState.track = null; tutState.editing = false;
    renderTutorial();
    ov.classList.add("show");
  }
  function closeTutorial(){
    var ov = document.getElementById("tutorialOverlay");
    if(ov) ov.classList.remove("show");
  }

  function tutEl(tag, cls, text){
    var e = document.createElement(tag);
    if(cls) e.className = cls;
    if(text != null) e.textContent = text;
    return e;
  }

  function renderTutorial(){
    var ov = ensureTutorialOverlay();
    var title = ov.querySelector(".tut-title"), sub = ov.querySelector(".tut-sub");
    var closeBtn = ov.querySelector(".tut-close");
    closeBtn.title = t("tutClose"); closeBtn.setAttribute("aria-label", t("tutClose"));
    var body = ov.querySelector(".tut-body");
    body.innerHTML = "";
    if(!tutState.track){
      title.textContent = t("tutTitle"); sub.textContent = t("tutSub");
      renderTutMenu(body);
    } else {
      title.textContent = t(TUT_TRACK_KEYS[tutState.track][0]); sub.textContent = "";
      renderTutTrack(body);
    }
  }

  function renderTutMenu(body){
    var can = tutorialCanOpen(tutIsAdmin());
    var list = tutEl("div", "tools-list tut-menu");
    TUTORIAL_TRACKS.forEach(function(id){
      var card = document.createElement("button");
      card.type = "button";
      card.className = "tool-card" + (can ? "" : " soon");
      card.dataset.tutTrack = id;
      card.disabled = !can;
      card.innerHTML =
        '<span class="tool-card-text"><span class="tool-card-name">' + escapeHtml(t(TUT_TRACK_KEYS[id][0])) + '</span>' +
        '<span class="tool-card-desc">' + escapeHtml(t(TUT_TRACK_KEYS[id][1])) + '</span></span>' +
        (can ? "" : '<span class="tool-card-badge">' + escapeHtml(t("tutSoon")) + '</span>');
      if(can) card.addEventListener("click", function(){ openTutorialTrack(id); });
      list.appendChild(card);
    });
    body.appendChild(list);
  }

  function openTutorialTrack(id){
    if(!isTutorialTrack(id) || !tutorialCanOpen(tutIsAdmin())) return;
    tutState.track = id; tutState.page = 0; tutState.editing = false;
    if(tutState.pages[id]){ tutState.status = ""; renderTutorial(); return; }
    tutState.status = "loading";
    renderTutorial();
    var done = function(pages, failed){
      tutState.pages[id] = tutorialNormalizePages(pages);
      tutState.status = failed ? "fail" : "";
      if(tutState.track === id) renderTutorial();
    };
    if(typeof fbStore === "undefined"){ done([], true); return; }
    fbStore.collection("tutorial").doc(id).get().then(function(snap){
      done(snap && snap.exists ? (snap.data() || {}).pages : [], false);
    }).catch(function(err){ console.error("tutorial load failed:", err); done([], true); });
  }

  function renderTutTrack(body){
    var back = tutEl("button", "btn btn-ghost btn-sm tut-back", "‹ " + t("tutBack"));
    back.type = "button";
    back.addEventListener("click", function(){ tutState.track = null; tutState.editing = false; renderTutorial(); });
    var bar = tutEl("div", "tut-bar");
    bar.appendChild(back);
    body.appendChild(bar);
    if(tutState.status === "loading"){ body.appendChild(tutEl("div", "tut-empty", t("tutLoading"))); return; }
    if(tutState.status === "fail") body.appendChild(tutEl("div", "field-error", t("tutLoadFail")));
    var pages = tutState.pages[tutState.track] || tutorialNormalizePages([]);
    var idx = tutState.page, page = pages[idx];

    if(tutIsAdmin()){
      var ed = tutEl("button", "btn btn-ghost btn-sm tut-edit-toggle", t(tutState.editing ? "tutEditDone" : "tutEdit"));
      ed.type = "button";
      ed.addEventListener("click", function(){ tutState.editing = !tutState.editing; renderTutorial(); });
      bar.appendChild(ed);
    }
    if(tutState.editing && tutIsAdmin()) body.appendChild(buildTutEditor(page));
    else body.appendChild(buildTutPage(page));

    // nav: prev / dots + "n / m" / next
    var nav = tutEl("div", "tut-nav");
    var prev = tutEl("button", "btn btn-sm", "‹ " + t("tutPrev")); prev.type = "button"; prev.disabled = idx <= 0;
    var next = tutEl("button", "btn btn-sm", t("tutNext") + " ›"); next.type = "button"; next.disabled = idx >= pages.length - 1;
    function go(d){ tutState.page = Math.max(0, Math.min(pages.length - 1, idx + d)); tutState.editing = false; renderTutorial(); }
    prev.addEventListener("click", function(){ go(-1); });
    next.addEventListener("click", function(){ go(1); });
    var mid = tutEl("div", "tut-progress");
    var dots = tutEl("div", "tut-dots");
    pages.forEach(function(p, i){
      var d = tutEl("button", "tut-dot" + (i === idx ? " on" : ""));
      d.type = "button"; d.setAttribute("aria-label", String(i + 1));
      d.addEventListener("click", function(){ tutState.page = i; tutState.editing = false; renderTutorial(); });
      dots.appendChild(d);
    });
    mid.appendChild(dots);
    mid.appendChild(tutEl("div", "tut-count", t("tutPageOf").replace("{n}", idx + 1).replace("{m}", pages.length)));
    nav.appendChild(prev); nav.appendChild(mid); nav.appendChild(next);
    body.appendChild(nav);
  }

  function buildTutPage(page){
    var wrap = tutEl("div", "tut-page");
    var tr = page.trickId ? getTrick(page.trickId) : null;
    if(!tr){ wrap.appendChild(tutEl("div", "tut-empty", t("tutEmpty"))); return wrap; }
    wrap.appendChild(tutEl("div", "tut-trick-name", localize(tr.name)));
    var url = tutorialFirstVideoUrl(tr);
    var info = url && typeof getEmbedInfo === "function" ? getEmbedInfo(url) : null;
    if(info && info.embedUrl){
      var fw = tutEl("div", "tut-video");
      var iframe = document.createElement("iframe");
      iframe.src = info.embedUrl;
      iframe.setAttribute("allow", "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture");
      iframe.setAttribute("allowfullscreen", "true");
      fw.appendChild(iframe);
      wrap.appendChild(fw);
    } else {
      var fb = tutEl("div", "tut-video-fallback", url ? "" : t("tutNoVideo"));
      if(url && isSafeHttpUrl(url)){
        var a = tutEl("a", "btn btn-primary btn-sm", t("tutOpenVideo"));
        a.href = url; a.target = "_blank"; a.rel = "noopener noreferrer";
        fb.appendChild(a);
      } else if(url){ fb.textContent = t("tutNoVideo"); }
      wrap.appendChild(fb);
    }
    wrap.appendChild(tutEl("div", "tut-text", tutorialPageText(page, state.lang)));
    var go = tutEl("button", "btn btn-primary tut-go", t("tutGo"));
    go.type = "button";
    go.addEventListener("click", function(){ closeTutorial(); goToTrickLocation(page.trickId); });
    wrap.appendChild(go);
    return wrap;
  }

  function tutCheckMsg(res){
    if(!res.ok) return { err: true, text: t(res.error === "format" ? "tutErrFormat" : (res.error === "notfound" ? "tutErrNotFound" : "tutErrNotPublic")) };
    if(!res.id) return { err: false, text: "" };
    return { err: false, text: t("tutTrickPicked") + localize(getTrick(res.id).name) };
  }

  function buildTutEditor(page){
    var form = tutEl("div", "tut-editor");
    var f1 = tutEl("div", "field");
    f1.appendChild(tutEl("label", "", t("tutTrickLabel")));
    var inp = document.createElement("input");
    inp.type = "text"; inp.className = "tut-id-input"; inp.value = page.trickId; inp.maxLength = 12;
    f1.appendChild(inp);
    var msg = tutEl("div", "tut-id-msg");
    f1.appendChild(msg);
    form.appendChild(f1);
    function refreshMsg(){
      var m = tutCheckMsg(tutorialCheckTrick(inp.value));
      msg.textContent = m.text; msg.className = "tut-id-msg" + (m.err ? " field-error" : "");
    }
    inp.addEventListener("input", refreshMsg);
    refreshMsg();
    var areas = {};
    [["zh", "tutTextZh"], ["jp", "tutTextJp"], ["en", "tutTextEn"]].forEach(function(p){
      var f = tutEl("div", "field");
      f.appendChild(tutEl("label", "", t(p[1])));
      var ta = document.createElement("textarea");
      ta.maxLength = TUTORIAL_TEXT_MAX; ta.rows = 5; ta.value = page.text[p[0]];
      areas[p[0]] = ta;
      f.appendChild(ta);
      form.appendChild(f);
    });
    var save = tutEl("button", "btn btn-primary btn-block", t("tutSave"));
    save.type = "button";
    save.addEventListener("click", function(){
      var res = tutorialCheckTrick(inp.value);
      if(!res.ok){ refreshMsg(); return; }
      var pages = tutState.pages[tutState.track].slice();
      pages[tutState.page] = tutorialNormalizePage({ trickId: res.id, text: { zh: areas.zh.value, jp: areas.jp.value, en: areas.en.value } });
      save.disabled = true;
      saveTutorialTrack(tutState.track, pages).then(function(){
        tutState.pages[tutState.track] = pages; tutState.editing = false;
        showToast(t("tutSaved")); renderTutorial();
      }).catch(function(err){
        console.error("tutorial save failed:", err);
        save.disabled = false; showToast(t("tutSaveFail"), "error");
      });
    });
    form.appendChild(save);
    return form;
  }

  function saveTutorialTrack(track, pages){
    if(typeof fbStore === "undefined" || !isTutorialTrack(track)) return Promise.reject(new Error("no store"));
    var data = tutorialPayload(pages);
    data.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
    return fbStore.collection("tutorial").doc(track).set(data);
  }

  document.addEventListener("keydown", function(ev){
    if(ev.key === "Escape" && isTutorialOpen()){ closeTutorial(); ev.stopPropagation(); }
  }, true);
