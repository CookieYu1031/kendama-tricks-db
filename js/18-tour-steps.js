"use strict";

  /* ============================================================
     TOUR STEPS — strings and the step table of the site introduction (engine: js/18-shell-tour.js,
     demo toolkit: js/18-tour-demo.js).
     Step: { id, title, body (key or fn(env)), sel (selector or fn(env)), skip?(env), needs?: "trick"|"search"|"video",
             prep?(ctx), demo?(ctx) -> Promise }.
     env = { signedIn, touch, standalone }. Demos stop on the result screen; nothing here writes data.
  ============================================================ */
  addStrings({
    zh:{
      tourPrev:"上一步", tourNext:"下一步", tourDone:"完成", tourSkip:"略過", tourReplay:"重播", tourCounter:"{n} / {total}",
      tourWelcomeTitle:"歡迎來到劍玉招式庫",
      tourWelcomeBody:"查招式、看影片、記錄自己的成招率。接下來會自動示範主要功能，約一分鐘，隨時可以按「略過」。",
      tourBrowseTitle:"分區與清單",
      tourBrowseBody:"左欄切換<b>總表、檢定、賽事</b>；點清單一層一層往下展開，找到想看的招式。",
      tourSearchTitle:"圖示化搜尋",
      tourSearchBody:"不用打字也能找招式：點<b>起始握持</b>、點劍玉<b>部位圖</b>，符合的招式馬上列出。也可以搜尋名稱，或輸入 #標籤。",
      tourDrawerTitle:"招式資訊",
      tourDrawerBody:"點招式打開資訊抽屜：<b>握持手勢、部位、標籤、影片、備註</b>和成招率，往下捲就能看到全部。",
      tourVideoTitle:"影片：鏡像與慢速",
      tourVideoBody:"點影片開啟播放視窗。<b>鏡像</b>把畫面左右翻轉，方便對照慣用手；<b>速度</b>可調成 0.75x、0.5x、0.25x，看清楚每個動作。",
      tourToolsTitle:"小工具",
      tourToolsBody:"<b>隨機抽招</b>依條件抽出招式，<b>練習清單</b>設定次數、點按計數。之後還會有更多工具。",
      tourEditTitle:"編輯模式",
      tourEditBody:"登入後可建立自己的招式表：新增、改名、排序、整理清單，都在編輯模式完成。",
      tourEditBodyIn:"點這顆鈕進入編輯模式，可以新增、改名、排序招式和清單，建立自己的招式表。",
      tourSettingsTitle:"設定",
      tourSettingsBody:"在這裡可以切換<b>主題</b>、調整<b>介面大小</b>、切換<b>語言</b>。",
      tourGuideTitle:"重看導覽",
      tourGuideBody:"想再看一次導覽，點「重播導覽」。",
      tourPwaTitle:"加到主畫面",
      tourPwaBody:"把網站加到主畫面，像 App 一樣開啟，離線也能看。點這一列就能安裝。",
      tourLoginTitle:"登入，保留你的進度",
      tourLoginBody:"可以從這裡登入。登入後就能<b>保留練習紀錄</b>、<b>收藏招式</b>、<b>新增自訂表格</b>。"
    },
    jp:{
      tourPrev:"戻る", tourNext:"次へ", tourDone:"完了", tourSkip:"スキップ", tourReplay:"もう一度", tourCounter:"{n} / {total}",
      tourWelcomeTitle:"けん玉技データベースへようこそ",
      tourWelcomeBody:"技を調べて、動画を見て、自分の成功率を記録できます。主な機能を自動でご紹介します（約1分）。いつでも「スキップ」できます。",
      tourBrowseTitle:"区分とリスト",
      tourBrowseBody:"左のレールで<b>総表・検定・大会</b>を切り替え。リストをタップして階層を開き、見たい技を探します。",
      tourSearchTitle:"アイコン検索",
      tourSearchBody:"入力なしで技を探せます。<b>開始時の持ち方</b>と、けん玉の<b>部位図</b>をタップすると、合う技がすぐに並びます。名前や #タグでの検索もOK。",
      tourDrawerTitle:"技の情報",
      tourDrawerBody:"技をタップすると情報ドロワーが開きます。<b>持ち方・部位・タグ・動画・メモ</b>と成功率。下にスクロールで全部見られます。",
      tourVideoTitle:"動画：反転とスロー",
      tourVideoBody:"動画をタップして再生ウィンドウを開きます。<b>左右反転</b>で利き手に合わせて見比べ、<b>速度</b>は 0.75x・0.5x・0.25x に変更でき、動きをしっかり確認できます。",
      tourToolsTitle:"ツール",
      tourToolsBody:"<b>ランダム出題</b>は条件に合う技を抽選、<b>練習リスト</b>は回数を決めてタップでカウント。今後ツールが増えていきます。",
      tourEditTitle:"編集モード",
      tourEditBody:"ログインすると自分の技表を作れます。追加・名前変更・並べ替え・リストの整理は編集モードで行います。",
      tourEditBodyIn:"このボタンで編集モードに入り、技やリストの追加・名前変更・並べ替えをして、自分の技表を作れます。",
      tourSettingsTitle:"設定",
      tourSettingsBody:"ここで<b>テーマ</b>の切り替え、<b>画面サイズ</b>の調整、<b>言語</b>の切り替えができます。",
      tourGuideTitle:"ガイドをもう一度",
      tourGuideBody:"もう一度ガイドを見たいときは「ガイドを再生」をタップ。",
      tourPwaTitle:"ホーム画面に追加",
      tourPwaBody:"ホーム画面に追加すると、アプリのように開けてオフラインでも見られます。この行をタップしてインストール。",
      tourLoginTitle:"ログインして記録しよう",
      tourLoginBody:"ここからログインできます。ログインすると<b>練習記録の保存</b>、<b>技のお気に入り</b>、<b>カスタム表の追加</b>ができます。"
    },
    en:{
      tourPrev:"Back", tourNext:"Next", tourDone:"Done", tourSkip:"Skip", tourReplay:"Replay", tourCounter:"{n} / {total}",
      tourWelcomeTitle:"Welcome to the Kendama Tricks DB",
      tourWelcomeBody:"Look up tricks, watch videos and track your own landing rate. The main features are shown automatically in about a minute. Skip any time.",
      tourBrowseTitle:"Tables and lists",
      tourBrowseBody:"Switch between the <b>master list, certification and contests</b> on the left rail; tap lists to open them level by level and find a trick.",
      tourSearchTitle:"Search by picture",
      tourSearchBody:"Find tricks without typing: tap a <b>starting grip</b> and a spot on the kendama <b>part diagram</b>, and matching tricks appear at once. Names and #tags work too.",
      tourDrawerTitle:"Trick info",
      tourDrawerBody:"Tap a trick to open its drawer: <b>grip, parts, tags, videos, notes</b> and landing rate. Scroll down to see it all.",
      tourVideoTitle:"Video: mirror and slow motion",
      tourVideoBody:"Tap a video to open the player. <b>Mirror</b> flips the picture so you can compare with your own hand; <b>speed</b> goes down to 0.75x, 0.5x and 0.25x to see every move.",
      tourToolsTitle:"Tools",
      tourToolsBody:"<b>Random Trick</b> draws tricks by your conditions; <b>Practice List</b> sets reps and counts with a tap. More tools are on the way.",
      tourEditTitle:"Edit mode",
      tourEditBody:"Sign in to build your own trick tables: adding, renaming, reordering and organising lists all happen in edit mode.",
      tourEditBodyIn:"Tap this button for edit mode: add, rename and reorder tricks and lists to build your own table.",
      tourSettingsTitle:"Settings",
      tourSettingsBody:"Switch the <b>theme</b>, adjust the <b>interface size</b> and change the <b>language</b> here.",
      tourGuideTitle:"Replay the tour",
      tourGuideBody:"To watch this tour again, tap \"Replay tour\".",
      tourPwaTitle:"Add to Home Screen",
      tourPwaBody:"Add the site to your Home Screen to open it like an app, even offline. Tap this row to install.",
      tourLoginTitle:"Sign in to keep your progress",
      tourLoginBody:"You can sign in here. Signed in, you can <b>keep your practice records</b>, <b>favourite tricks</b> and <b>add your own tables</b>."
    }
  });

  function tourDemoView(){
    var snap = typeof _tour !== "undefined" && _tour ? _tour.snap : null;
    return snap ? { space: snap.activeSpace, path: snap.path } : { space: null, path: [] };
  }
  function tourPrepNeutral(){ var v = tourDemoView(); tourSetView(v.space, v.path); }
  function tourPrepSettings(){ tourPrepNeutral(); tourShowSettings(); }
  function tourRowSel(id){ return "#millerWrap " + tourAttrSel("data-item-id", id); }

  // Step 2: tap the 00 table, then open the lists down to the demo trick's list.
  function tourDemoBrowse(ctx){
    var pick = tourDemoPick();
    ctx.focus("#spaceRail");
    return ctx.seq([
      function(){ return ctx.tap('#spaceRail [data-space-id="' + TOUR_DEMO_SPACE + '"]'); },
      function(){ ctx.focus("#millerWrap"); return ctx.wait(500); },
      function(){ return ctx.each(pick ? pick.path : [], function(id){
        return ctx.tap(tourRowSel(id)).then(function(){ return ctx.wait(500); });
      }); }
    ]);
  }
  // Step 3: open the panel, tap the grip and the first part, show the result list.
  function tourDemoSearch(ctx){
    var pick = tourDemoPick();
    ctx.focus("#searchToggleBtn");
    return ctx.seq([
      function(){ return ctx.tap("#searchToggleBtn"); },
      function(){ ctx.focus("#searchPanel"); return ctx.wait(600); },
      function(){ ctx.focus("#searchGripHost"); return pick.grip ? ctx.tap("#searchGripHost " + tourAttrSel("data-grip", pick.grip)) : null; },
      function(){ ctx.focus("#searchPartsRow"); return pick.part ? ctx.tap("#searchPartsRow " + tourAttrSel("data-part", pick.part)) : null; },
      function(){ ctx.focus("#searchPanel"); return ctx.wait(700); },
      function(){ ctx.focus("#searchList"); return ctx.wait(300); }
    ]);
  }
  // Step 4: tap the trick row, let the drawer slide in, scroll it slowly to the bottom and back.
  function tourDemoDrawer(ctx){
    var pick = tourDemoPick();
    ctx.focus("#millerWrap");
    return ctx.seq([
      function(){ return ctx.tap(tourRowSel(pick.trickId), { focus: true }); },
      function(){ ctx.focus("#detailDrawer"); return ctx.wait(700); },
      function(){ return ctx.scrollSlow("#detailDrawer .drawer-body", 2600, 1400); }
    ]);
  }
  // Step 5: open the video slot, mirror on / off, speed down to 0.5x. Never plays (no playVideo, no loop clips).
  function tourDemoVideo(ctx){
    var pick = tourDemoPick();
    var slots = document.querySelectorAll("#detailDrawer .vid-slot.filled .vid-slot-main");
    return ctx.seq([
      function(){ return ctx.tap(slots[pick.videoIndex] || null, { focus: true }); },
      function(){ ctx.focus("#videoModal"); return ctx.wait(1000); },
      function(){ return ctx.tap("#videoModal .video-tool-btn:not(.video-speed-btn)"); },
      function(){ return ctx.wait(900); },
      function(){ return ctx.tap("#videoModal .video-tool-btn:not(.video-speed-btn)"); },
      function(){ return ctx.wait(500); },
      function(){ return ctx.tap("#videoModal .video-speed-btn"); },
      function(){ return ctx.wait(500); },
      function(){ return ctx.tap("#videoModal .video-speed-btn"); },
      function(){ ctx.focus("#videoModal"); return ctx.wait(300); }
    ]);
  }
  function tourDemoTools(ctx){
    return ctx.seq([
      function(){ return ctx.tap(".rail-tools-btn", { focus: true }); },
      function(){ ctx.focus("#toolsOverlay .tools-list"); return ctx.wait(300); }
    ]);
  }
  function tourDemoSettings(ctx){
    return ctx.seq([
      function(){ return ctx.tap("#settingsBtn", { focus: true }); },
      function(){ ctx.focus("#settingsPrefs"); return ctx.wait(300); }
    ]);
  }

  var TOUR_STEPS = [
    { id:"welcome", title:"tourWelcomeTitle", body:"tourWelcomeBody", sel:null, prep:tourPrepNeutral },
    { id:"browse", title:"tourBrowseTitle", body:"tourBrowseBody", sel:"#spaceRail",
      prep:function(){
        var other = ["t01", "t02", "t03"].filter(function(id){ return !!getSpace(id); })[0];
        tourSetView(other || TOUR_DEMO_SPACE, []);
      }, demo:tourDemoBrowse },
    { id:"search", title:"tourSearchTitle", body:"tourSearchBody", sel:"#searchToggleBtn", needs:"search",
      prep:function(){ tourSetView(TOUR_DEMO_SPACE, []); }, demo:tourDemoSearch },
    { id:"drawer", title:"tourDrawerTitle", body:"tourDrawerBody", sel:"#millerWrap", needs:"trick",
      prep:function(){ tourSetView(TOUR_DEMO_SPACE, tourDemoPick().path); }, demo:tourDemoDrawer },
    { id:"video", title:"tourVideoTitle", body:"tourVideoBody", sel:"#detailDrawer", needs:"video",
      prep:function(){
        var pick = tourDemoPick();
        tourSetView(TOUR_DEMO_SPACE, pick.path);
        openDrawerFor(pick.trickId, pick.containerKey);
      }, demo:tourDemoVideo },
    { id:"tools", title:"tourToolsTitle", body:"tourToolsBody", sel:".rail-tools-btn", prep:tourPrepNeutral, demo:tourDemoTools },
    { id:"edit", title:"tourEditTitle",
      body:function(env){ return env.signedIn ? "tourEditBodyIn" : "tourEditBody"; },
      sel:function(env){ return env.signedIn ? ".rail-edit-toggle" : "#spaceRail"; }, prep:tourPrepNeutral },
    { id:"settings", title:"tourSettingsTitle",
      body:"tourSettingsBody", sel:"#settingsPrefs", prep:tourPrepNeutral, demo:tourDemoSettings },
    { id:"guide", title:"tourGuideTitle", body:"tourGuideBody", sel:"#settingsGuideBtn", prep:tourPrepSettings },
    { id:"pwa", title:"tourPwaTitle", body:"tourPwaBody", sel:"#settingsInstallBtn",
      skip:function(env){ return !env.touch || env.standalone; }, prep:tourPrepSettings },
    { id:"login", title:"tourLoginTitle", body:"tourLoginBody", sel:"#authLoginBtn",
      skip:function(env){ return env.signedIn; }, prep:tourPrepSettings }
  ];
