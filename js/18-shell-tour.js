"use strict";

  /* ============================================================
     SHELL TOUR — first-run / first-login interactive spotlight guide.
     Exports: startTour(kind), maybeStartTour(user), isTourActive(),
              tourStepsFor(kind), decideAutoTour(user, seen), isTouchDevice(env)
  ============================================================ */
  var TOUR_SEEN_KEY = "kendama-tour-seen-v1";
  var TOUR_SEEN_UID_KEY = "kendama-tour-seen-uid-v1";

  if(typeof addStrings === "function") addStrings({
    zh:{
      tourPrev:"上一步", tourNext:"下一步", tourDone:"完成", tourSkip:"略過", tourCounter:"{n} / {total}",
      tourWelcomeTitle:"歡迎來到劍玉招式庫",
      tourWelcomeBody:"瀏覽各種劍玉招式、查看影片與標籤，並記錄自己的成招率。花一分鐘看看主要功能吧。",
      tourRailTitle:"左欄分區",
      tourRailBody:"總表、檢定、賽事，以及收藏與自訂表。點選即可切換分區。",
      tourMillerTitle:"逐層瀏覽",
      tourMillerBody:"點資料夾逐層展開，點招式會打開右側資訊抽屜：影片、標籤、握持部位、成招率。",
      tourSearchTitle:"搜尋",
      tourSearchBody:"可搜尋中日英名稱與羅馬拼音；輸入 #標籤 篩選；還能加上握持、部位條件。",
      tourTouchTitle:"手勢",
      tourTouchBody:"<b>右滑</b>返回上一層。<br>編輯模式下<b>長按拖曳</b>可排序或換層。",
      tourKeysTitle:"快捷鍵",
      tourKeysBody:"<kbd>/</kbd> 搜尋<br><kbd>↑</kbd><kbd>↓</kbd> 選取<br><kbd>→</kbd> 或 <kbd>Enter</kbd> 開啟<br><kbd>←</kbd> 或 <kbd>Backspace</kbd> 返回<br><kbd>e</kbd> 編輯　<kbd>n</kbd> 新增　<kbd>?</kbd> 說明",
      tourSettingsTitle:"設定",
      tourSettingsBody:"在這裡登入、切換主題與語言。想再看一次導覽，可在設定裡點「快速導覽」；也能安裝 App。",
      tourMemberIntroTitle:"登入後的功能",
      tourMemberIntroBody:"登入之後，你可以記錄自己的成招率、收藏招式、建立自訂表。接下來快速介紹。",
      tourRateTitle:"成招率與收藏",
      tourRateBody:"在招式抽屜裡點 ★ 收藏招式；成招率分 4 個等級，另有「無」代表尚未記錄。",
      tourEditTitle:"編輯模式",
      tourEditBody:"點這顆按鈕進入編輯模式，可新增、改名、排序與刪除自己的項目。",
      tourCustomTitle:"自訂表",
      tourCustomBody:"開啟編輯模式後，可以在左欄中間建立自訂表，整理自己的招式清單。"
    },
    jp:{
      tourPrev:"戻る", tourNext:"次へ", tourDone:"完了", tourSkip:"スキップ", tourCounter:"{n} / {total}",
      tourWelcomeTitle:"けん玉技データベースへようこそ",
      tourWelcomeBody:"けん玉の技を閲覧し、動画やタグを確認し、自分の成功率を記録できます。主な機能を1分で見てみましょう。",
      tourRailTitle:"左のレール",
      tourRailBody:"総表、検定、大会、そしてお気に入りとカスタム表。タップで切り替えます。",
      tourMillerTitle:"階層ブラウズ",
      tourMillerBody:"フォルダをタップして階層を開き、技をタップすると右の情報ドロワーが開きます：動画、タグ、持ち方、成功率。",
      tourSearchTitle:"検索",
      tourSearchBody:"中日英の名前とローマ字で検索。#タグで絞り込み、持ち方や部位の条件も追加できます。",
      tourTouchTitle:"ジェスチャー",
      tourTouchBody:"<b>右スワイプ</b>で一つ前の階層へ。<br>編集モードでは<b>長押しドラッグ</b>で並べ替えや階層移動ができます。",
      tourKeysTitle:"ショートカット",
      tourKeysBody:"<kbd>/</kbd> 検索<br><kbd>↑</kbd><kbd>↓</kbd> 選択<br><kbd>→</kbd> または <kbd>Enter</kbd> 開く<br><kbd>←</kbd> または <kbd>Backspace</kbd> 戻る<br><kbd>e</kbd> 編集　<kbd>n</kbd> 追加　<kbd>?</kbd> ヘルプ",
      tourSettingsTitle:"設定",
      tourSettingsBody:"ここでログイン、テーマと言語の切り替えができます。もう一度見たいときは設定の「クイックツアー」から。アプリのインストールも可能です。",
      tourMemberIntroTitle:"ログイン後の機能",
      tourMemberIntroBody:"ログインすると、成功率の記録、お気に入り、カスタム表の作成ができます。簡単に紹介します。",
      tourRateTitle:"成功率とお気に入り",
      tourRateBody:"技のドロワーで ★ を押してお気に入りに。成功率は4段階＋「なし」（未記録）です。",
      tourEditTitle:"編集モード",
      tourEditBody:"このボタンで編集モードに入り、自分の項目の追加・名前変更・並べ替え・削除ができます。",
      tourCustomTitle:"カスタム表",
      tourCustomBody:"編集モードにすると、左レールの中央でカスタム表を作成し、自分の技リストを整理できます。"
    },
    en:{
      tourPrev:"Back", tourNext:"Next", tourDone:"Done", tourSkip:"Skip", tourCounter:"{n} / {total}",
      tourWelcomeTitle:"Welcome to the Kendama Tricks DB",
      tourWelcomeBody:"Browse kendama tricks, watch videos and tags, and track your own success rates. Take a minute to see the main features.",
      tourRailTitle:"Left rail",
      tourRailBody:"Master list, Certification, Competitions, plus favourites and your own tables. Tap to switch.",
      tourMillerTitle:"Browse level by level",
      tourMillerBody:"Tap a folder to open the next level. Tap a trick to open the info drawer: video, tags, grips, success rate.",
      tourSearchTitle:"Search",
      tourSearchBody:"Search Chinese, Japanese and English names and romaji. Type #tag to filter, and add grip or part conditions.",
      tourTouchTitle:"Gestures",
      tourTouchBody:"<b>Swipe right</b> to go up a level.<br>In edit mode, <b>long-press and drag</b> to reorder or move between levels.",
      tourKeysTitle:"Shortcuts",
      tourKeysBody:"<kbd>/</kbd> search<br><kbd>↑</kbd><kbd>↓</kbd> select<br><kbd>→</kbd> or <kbd>Enter</kbd> open<br><kbd>←</kbd> or <kbd>Backspace</kbd> back<br><kbd>e</kbd> edit &nbsp;<kbd>n</kbd> add &nbsp;<kbd>?</kbd> help",
      tourSettingsTitle:"Settings",
      tourSettingsBody:"Sign in, change theme and language here. Replay this tour any time from Settings (Quick tour). You can also install the app.",
      tourMemberIntroTitle:"When you sign in",
      tourMemberIntroBody:"Signed in, you can track success rates, favourite tricks and build your own tables. A quick look follows.",
      tourRateTitle:"Success rate and favourites",
      tourRateBody:"In a trick's drawer, tap ★ to favourite it. Success rate has 4 levels, plus \"none\" for not recorded.",
      tourEditTitle:"Edit mode",
      tourEditBody:"Tap this button for edit mode: add, rename, reorder and delete your own items.",
      tourCustomTitle:"Custom tables",
      tourCustomBody:"In edit mode, create your own tables in the middle of the left rail to organise your trick lists."
    }
  });

  /* ---------- pure logic ---------- */
  function isTouchDevice(env){
    env = env || {};
    if(typeof env.matchMedia === "function"){
      try{ if(env.matchMedia("(pointer: coarse)").matches) return true; }catch(e){}
    }
    return (env.maxTouchPoints || 0) > 0;
  }

  var _tourEnv = (typeof window !== "undefined" && window) || {};
  function tourEnv(){
    return {
      matchMedia: typeof _tourEnv.matchMedia === "function" ? function(q){ return _tourEnv.matchMedia(q); } : null,
      maxTouchPoints: (typeof navigator !== "undefined" && navigator.maxTouchPoints) || 0
    };
  }

  function tourBasicSteps(){
    return [
      { id:"welcome", sel:null, title:"tourWelcomeTitle", body:"tourWelcomeBody" },
      { id:"rail", sel:"#spaceRail", title:"tourRailTitle", body:"tourRailBody" },
      { id:"miller", sel:"#millerWrap", title:"tourMillerTitle", body:"tourMillerBody" },
      { id:"search", sel:"#searchToggleBtn", title:"tourSearchTitle", body:"tourSearchBody" },
      isTouchDevice(tourEnv())
        ? { id:"gestures", sel:null, title:"tourTouchTitle", body:"tourTouchBody" }
        : { id:"keys", sel:null, title:"tourKeysTitle", body:"tourKeysBody" },
      { id:"settings", sel:"#settingsBtn", title:"tourSettingsTitle", body:"tourSettingsBody" }
    ];
  }
  function tourMemberSteps(withIntro){
    var s = [];
    if(withIntro) s.push({ id:"memberIntro", sel:null, title:"tourMemberIntroTitle", body:"tourMemberIntroBody" });
    s.push({ id:"rate", sel:null, title:"tourRateTitle", body:"tourRateBody" });
    s.push({ id:"edit", sel:".rail-edit-toggle", title:"tourEditTitle", body:"tourEditBody" });
    s.push({ id:"custom", sel:"#spaceRail", title:"tourCustomTitle", body:"tourCustomBody" });
    return s;
  }
  // kind: "basic" | "member" (intro + member steps) | "full" (basic + member, no intro)
  function tourStepsFor(kind){
    if(kind === "member") return tourMemberSteps(true);
    if(kind === "full") return tourBasicSteps().concat(tourMemberSteps(false));
    return tourBasicSteps();
  }

  // seen: { basic:boolean, uids:string[] }. Returns { kind, markBasic, uid } or null.
  function decideAutoTour(user, seen){
    seen = seen || {};
    var uids = seen.uids || [];
    if(!user){
      return seen.basic ? null : { kind:"basic", markBasic:true, uid:null };
    }
    if(uids.indexOf(user.uid) >= 0) return null;
    if(seen.basic) return { kind:"member", markBasic:false, uid:user.uid };
    return { kind:"full", markBasic:true, uid:user.uid };
  }

  function readTourSeen(){
    var uids = [];
    try{
      var a = JSON.parse(localStorage.getItem(TOUR_SEEN_UID_KEY) || "[]");
      if(Array.isArray(a)) uids = a;
    }catch(e){}
    var basic = false;
    try{ basic = !!localStorage.getItem(TOUR_SEEN_KEY); }catch(e){}
    return { basic:basic, uids:uids };
  }
  function writeTourSeen(decision){
    try{
      if(decision.markBasic) localStorage.setItem(TOUR_SEEN_KEY, "1");
      if(decision.uid){
        var uids = readTourSeen().uids;
        if(uids.indexOf(decision.uid) < 0) uids.push(decision.uid);
        localStorage.setItem(TOUR_SEEN_UID_KEY, JSON.stringify(uids));
      }
    }catch(e){}
  }

  /* ---------- UI ---------- */
  var _tour = null; // { steps, i, root, dim, hole, card, ... }

  function isTourActive(){ return !!_tour; }

  function tourTargetRect(sel){
    if(!sel) return null;
    var el = document.querySelector(sel);
    if(!el) return null;
    var r = el.getBoundingClientRect();
    if(!r || r.width < 1 || r.height < 1) return null;
    var cs = window.getComputedStyle(el);
    if(cs.display === "none" || cs.visibility === "hidden") return null;
    return r;
  }

  function tourPlaceCard(rect, card){
    var vw = window.innerWidth, vh = window.innerHeight, G = 16;
    var cw = Math.min(360, vw - G * 2);
    card.style.width = cw + "px";
    var ch = card.offsetHeight;
    var x, y;
    if(!rect){
      x = (vw - cw) / 2; y = (vh - ch) / 2;
    } else {
      var gap = 12, below = vh - rect.bottom - gap - G, above = rect.top - gap - G;
      var cx = rect.left + rect.width / 2 - cw / 2;
      if(below >= ch){ y = rect.bottom + gap; x = cx; }
      else if(above >= ch){ y = rect.top - gap - ch; x = cx; }
      else if(vw - rect.right - gap - G >= cw){ x = rect.right + gap; y = rect.top + rect.height / 2 - ch / 2; }
      else if(rect.left - gap - G >= cw){ x = rect.left - gap - cw; y = rect.top + rect.height / 2 - ch / 2; }
      else { x = (vw - cw) / 2; y = vh - ch - G; }
    }
    x = Math.max(G, Math.min(x, vw - cw - G));
    y = Math.max(G, Math.min(y, vh - ch - G));
    card.style.left = Math.round(x) + "px";
    card.style.top = Math.round(y) + "px";
  }

  function tourLayout(){
    if(!_tour) return;
    var step = _tour.steps[_tour.i];
    var rect = tourTargetRect(step.sel);
    var hole = _tour.hole;
    if(rect){
      var pad = 6;
      hole.style.display = "block";
      hole.style.left = Math.round(rect.left - pad) + "px";
      hole.style.top = Math.round(rect.top - pad) + "px";
      hole.style.width = Math.round(rect.width + pad * 2) + "px";
      hole.style.height = Math.round(rect.height + pad * 2) + "px";
      _tour.root.classList.remove("tour-nohole");
    } else {
      hole.style.display = "none";
      _tour.root.classList.add("tour-nohole");
    }
    tourPlaceCard(rect, _tour.card);
  }

  function tourRender(){
    var s = _tour.steps[_tour.i], last = _tour.i === _tour.steps.length - 1;
    _tour.titleEl.textContent = t(s.title);
    _tour.bodyEl.innerHTML = t(s.body); // trusted constant strings (may contain <kbd>/<b>)
    _tour.counter.textContent = t("tourCounter").replace("{n}", _tour.i + 1).replace("{total}", _tour.steps.length);
    _tour.prev.style.visibility = _tour.i === 0 ? "hidden" : "visible";
    _tour.next.textContent = t(last ? "tourDone" : "tourNext");
    _tour.skip.style.display = last ? "none" : "";
    tourLayout();
    _tour.card.classList.remove("tour-in");
    void _tour.card.offsetWidth;
    _tour.card.classList.add("tour-in");
  }

  function tourGo(d){
    if(!_tour) return;
    var n = _tour.i + d;
    if(n >= _tour.steps.length){ endTour(); return; }
    if(n < 0) return;
    _tour.i = n;
    tourRender();
  }

  function tourKey(e){
    if(!_tour) return;
    var k = e.key;
    if(k === "Escape" || k === "ArrowLeft" || k === "ArrowRight" || k === "Enter"){
      e.preventDefault();
    }
    e.stopPropagation();
    if(k === "Escape") endTour();
    else if(k === "ArrowLeft") tourGo(-1);
    else if(k === "ArrowRight" || k === "Enter") tourGo(1);
  }

  function endTour(){
    if(!_tour) return;
    document.removeEventListener("keydown", tourKey, true);
    window.removeEventListener("resize", tourLayout);
    window.removeEventListener("scroll", tourLayout, true);
    if(_tour.root.parentNode) _tour.root.parentNode.removeChild(_tour.root);
    _tour = null;
  }

  function tourMake(tag, cls, parent){
    var el = document.createElement(tag);
    if(cls) el.className = cls;
    if(parent) parent.appendChild(el);
    return el;
  }

  function startTour(kind){
    if(_tour) endTour();
    var signedIn = typeof authCurrentUser !== "undefined" && !!authCurrentUser;
    if(kind === "full" && !signedIn) kind = "basic";
    var steps = tourStepsFor(kind || "basic");
    var root = tourMake("div", "tour-root", document.body);
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-modal", "true");
    var dim = tourMake("div", "tour-dim", root);
    var hole = tourMake("div", "tour-hole", root);
    var card = tourMake("div", "tour-card", root);
    var titleEl = tourMake("div", "tour-title", card);
    var bodyEl = tourMake("div", "tour-body", card);
    var foot = tourMake("div", "tour-foot", card);
    var counter = tourMake("span", "tour-counter", foot);
    var btns = tourMake("span", "tour-btns", foot);
    var skip = tourMake("button", "btn btn-ghost btn-sm tour-skip", btns);
    var prev = tourMake("button", "btn btn-ghost btn-sm", btns);
    var next = tourMake("button", "btn btn-primary btn-sm", btns);
    [skip, prev, next].forEach(function(b){ b.type = "button"; });
    skip.textContent = t("tourSkip");
    prev.textContent = t("tourPrev");
    _tour = { steps:steps, i:0, root:root, dim:dim, hole:hole, card:card, titleEl:titleEl, bodyEl:bodyEl,
              counter:counter, prev:prev, next:next, skip:skip };
    skip.addEventListener("click", endTour);
    prev.addEventListener("click", function(){ tourGo(-1); });
    next.addEventListener("click", function(){ tourGo(1); });
    document.addEventListener("keydown", tourKey, true);
    window.addEventListener("resize", tourLayout);
    window.addEventListener("scroll", tourLayout, true);
    tourRender();
    next.focus();
  }

  /* ---------- auto trigger ---------- */
  var _tourAutoDone = { guest:false, user:false };

  function maybeStartTour(user){
    var key = user ? "user" : "guest";
    if(_tourAutoDone[key]) return;
    _tourAutoDone[key] = true;
    var attempt = function(retry){
      if(_tour) return;
      var decision = decideAutoTour(user, readTourSeen());
      if(!decision) return;
      if(document.querySelector(".modal-overlay.show")){
        if(retry) setTimeout(function(){ attempt(false); }, 2500);
        return;
      }
      writeTourSeen(decision);
      startTour(decision.kind);
    };
    setTimeout(function(){ attempt(true); }, 600);
  }
