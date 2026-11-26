"use strict";

  /* ============================================================
     GRIP INFO PAGE — read-only 起始手勢 explanation (opened by the ⓘ link of the grip picker, js/36).
     One scrollable window: intro + three tables (ken / tama / ito) + footnotes, in zh / jp / en.
  ============================================================ */
  addStrings({
    zh:{ gripInfoTitle:"起始手勢說明", gripInfoClose:"關閉", gripInfoLinkText:"Kendama Trick Notation 1.2（PDF）",
         gripInfoIntro:"本分類參考 Davidrusca 的劍玉招式記譜：",
         gripInfoH_ken:"持劍手勢", gripInfoH_tama:"持球手勢", gripInfoH_ito:"持線手勢" },
    jp:{ gripInfoTitle:"開始時の持ち方の説明", gripInfoClose:"閉じる", gripInfoLinkText:"Kendama Trick Notation 1.2（PDF）",
         gripInfoIntro:"この分類は Davidrusca のけん玉技表記を参考にしています：",
         gripInfoH_ken:"けん持ち", gripInfoH_tama:"玉持ち", gripInfoH_ito:"糸持ち" },
    en:{ gripInfoTitle:"Starting grips", gripInfoClose:"Close", gripInfoLinkText:"Kendama Trick Notation 1.2 (PDF)",
         gripInfoIntro:"These categories follow Davidrusca's kendama trick notation: ",
         gripInfoH_ken:"Ken grips", gripInfoH_tama:"Tama grips", gripInfoH_ito:"String grips" }
  });

  var GRIP_INFO_URL = "https://www.davidrusca.com/static/pdf/KendamaTrickNotation1.2.pdf";

  // Table rows per group: [enName, [footnote numbers], { lang: [name, description, secondary note] }].
  var GRIP_INFO_ROWS = {
    ken: [
      ["Ken grip", [], {
        zh:["持劍", "食指拇指捏住劍身，其餘手指自然環繞放置", "有些玩家會將拇指扣於大皿上，增加穩定度"],
        jp:["けん持ち", "人差し指と親指でけん身をつまみ、残りの指は自然に添える", "安定させるため、親指を大皿にかける人もいる"],
        en:["Ken grip", "Pinch the ken body with index finger and thumb; the other fingers rest naturally around it", "Some players hook the thumb over the large cup for stability"] }],
      ["Sara grip", [], {
        zh:["持皿", "比ok手勢，用食指與拇指環繞劍身，其餘三指托住小皿", "以右手握持的話，此握法會使大皿朝上、中皿朝右"],
        jp:["皿持ち", "OKサインの形で、人差し指と親指でけん身を囲み、残り3本の指で小皿を支える", "右手で持つと、大皿が上、中皿が右を向く"],
        en:["Sara grip", "Make an OK sign: index finger and thumb circle the ken body, the other three fingers support the small cup", "In the right hand, the large cup faces up and the middle cup faces right"] }],
      ["Candle grip", [], {
        zh:["持蠟燭", "以食指與拇指為主其餘為輔，捏住劍尖的部分", "因接觸面積較小，握持力道需較持劍大"],
        jp:["キャンドル持ち", "人差し指と親指を中心に、他の指で補助しながらけん先をつまむ", "接触面積が小さいため、けん持ちより強く握る必要がある"],
        en:["Candle grip", "Pinch the ken tip, mainly with index finger and thumb, the other fingers assisting", "The contact area is small, so it needs a firmer grip than the ken grip"] }],
      ["Gunslinger grip", [], {
        zh:["持轉劍", "食指放於小皿與劍身交界處，其餘手指輔助穩定", "有些玩家會將拇指放於對側皿或皿與劍尖的交界處"],
        jp:["ガンスリンガー持ち", "人差し指を小皿とけん身の境目に置き、残りの指で安定させる", "反対側の皿や、皿とけん先の境目に親指を置く人もいる"],
        en:["Gunslinger grip", "Index finger on the junction of the small cup and the ken body, the other fingers steady it", "Some players put the thumb on the opposite cup or on the junction of cup and tip"] }],
      ["Spacewalk grip", [1], {
        zh:["持劍尾", "所有手指輕握於劍尾(止滑與中皿的區域)", "側握常用於線技，直握常用於拋接技"],
        jp:["けん尻持ち", "すべての指で、けん尻（すべり止めと中皿のあたり）を軽く握る", "横持ちは糸技、縦持ちは投げ技によく使われる"],
        en:["Spacewalk grip", "All fingers lightly hold the ken end (around the slip stopper and the middle cup)", "The side hold is common for string tricks, the straight hold for toss tricks"] }],
      ["Stall grip", [2], {
        zh:["持極意", "拇指扣小皿，其餘扣大皿，線洞朝下，劍尖頂掌", "以右手握持的話，此握法會使中皿朝左"],
        jp:["極意持ち", "親指を小皿に、残りの指を大皿にかけ、糸穴を下に、けん先を手のひらに当てる", "右手で持つと、中皿が左を向く"],
        en:["Stall grip", "Thumb on the small cup, the other fingers on the large cup, string hole down, ken tip against the palm", "In the right hand, the middle cup faces left"] }],
      ["Swivel ken grip", [3], {
        zh:["扣皿", "拇指扣大皿，食指與中指扣小皿，劍尖朝上", "劍如同持劍，但抓握位置在大小皿"],
        jp:["扣皿（かぶせ皿）", "親指を大皿に、人差し指と中指を小皿にかけ、けん先を上に向ける", "けんの向きはけん持ちと同じで、握る位置が大小の皿"],
        en:["Swivel ken grip", "Thumb on the large cup, index and middle fingers on the small cup, ken tip up", "The ken points as in the ken grip, but it is held at the cups"] }],
      ["Downspike grip", [4], {
        zh:["持殺", "劍尖朝下的「持皿手勢」不同銜接招式有數種握法", "天中殺、轉劍天中殺等數個招式都可能使用到"],
        jp:["殺持ち", "けん先を下に向けた「皿持ち」。つなぐ技によって握り方がいくつかある", "天中殺、ガンスリンガー天中殺などの技で使われることがある"],
        en:["Downspike grip", "The sara grip with the ken tip pointing down; there are several variations depending on the trick it links to", "Used by tricks such as Tenchusatsu and Gunslinger Tenchusatsu"] }]
    ],
    tama: [
      ["Tama grip", [], {
        zh:["持球手勢", "手指握住球體兩側，球洞朝上(球洞在拇指與食指之間)", "部分玩家會使用無名指指腹觸碰線與球的交界，增加線的穩定"],
        jp:["玉持ち", "指で玉の両側を握り、玉の穴を上に向ける（穴は親指と人差し指の間）", "糸を安定させるため、薬指の腹を糸と玉の境目に当てる人もいる"],
        en:["Tama grip", "Fingers hold both sides of the ball, ball hole up (between thumb and index finger)", "Some players touch the junction of string and ball with the ring finger pad for string stability"] }],
      ["Stuntplane grip", [5], {
        zh:["重力機手勢", "反向持球，球洞朝下", "部分玩家會將線放在大拇指指甲底部的位置，增加線的穩定"],
        jp:["スタントプレーン持ち", "玉を逆向きに持ち、玉の穴を下に向ける", "糸を安定させるため、糸を親指の爪の付け根に置く人もいる"],
        en:["Stuntplane grip", "Hold the ball the other way round, ball hole down", "Some players rest the string at the base of the thumbnail for stability"] }],
      ["Two-hand grip", [], {
        zh:["雙手持", "一手持劍、一手持球，兩手分別抓住", "少數招式才會用到"],
        jp:["両手持ち", "片手でけん、もう片方の手で玉を持つ", "一部の技でのみ使う"],
        en:["Two-hand grip", "One hand holds the ken, the other holds the ball", "Only a few tricks start this way"] }]
    ],
    ito: [
      ["Hanging grip", [], {
        zh:["提線手勢", "從線的中段提起劍玉，球劍垂落，球靠在大小皿間的弧型區域", "球與劍的左右位置，可以依據接續招式的不同進行調換"],
        jp:["ハンギング（糸持ち）", "糸の中ほどを持って吊り下げ、玉は大小の皿の間の弧の部分に当てる", "玉とけんの左右は、続く技によって入れ替えてよい"],
        en:["Hanging grip", "Lift the kendama by the middle of the string; ken and ball hang down, the ball resting in the curve between the cups", "Which side the ball and ken are on can be swapped depending on the next trick"] }],
      ["Lighthouse hanging grip", [], {
        zh:["燈台提線手勢", "如同提線手勢，但中皿需貼於球上(如同燈台)", ""],
        jp:["ライトハウス", "ハンギングと同じだが、中皿を玉の上に乗せる（灯台のような形）", ""],
        en:["Lighthouse hanging grip", "Like the hanging grip, but the middle cup sits on top of the ball (like a lighthouse)", ""] }],
      ["Spike hanging grip", [], {
        zh:["收劍提線手勢", "如同提線手勢，但處於收劍狀態", ""],
        jp:["スパイクハンギング", "ハンギングと同じだが、玉がけん先に刺さった状態", ""],
        en:["Spike hanging grip", "Like the hanging grip, but with the ball spiked on the ken", ""] }],
      ["Tornado grip", [], {
        zh:["龍捲風手勢", "用手指環繞握住繩子的中間，拇指將繩子壓向食指一側", "是做龍捲風時的起手"],
        jp:["トルネード", "指で糸の中ほどを囲んで握り、親指で糸を人差し指側に押さえる", "トルネードを行うときの構え"],
        en:["Tornado grip", "Fingers wrap around the middle of the string, the thumb presses it toward the index finger side", "The starting grip for the Tornado"] }]
    ]
  };
  // Footnotes per language: [marks, text].
  var GRIP_INFO_NOTES = {
    zh:[["*1", "直譯為「宇宙遊泳手勢」，但因拋接技握持亦類似，因此暫譯為「持劍尾」"],
        ["*2", "直譯為「旋轉手勢」，改採中文圈命名「極意手勢」標示之"],
        ["*3*4", "原文件中將兩者視為Swivel grip的變體，但實際上是「持劍」與「持皿」的變體，因此Swivel ken grip以其直觀招式之樣態，暫譯為「扣皿」；而Swivel sara grip則因其長銜接之代表性招式「天中殺」，而命名為「持殺」"],
        ["*4*5", "將手腕外翻，手勢不變使劍尖/球洞朝上，則為「企鵝持劍/持球」"]],
    jp:[["*1", "直訳は「宇宙遊泳の持ち方」ですが、投げ技の持ち方にも似ているため、仮に「けん尻持ち」と訳しました"],
        ["*2", "直訳は「旋回の持ち方」ですが、中国語圏の呼び名「極意持ち」を採用しました"],
        ["*3*4", "原文ではどちらも Swivel grip の変形とされていますが、実際には「けん持ち」と「皿持ち」の変形です。そのため Swivel ken grip は見た目どおり「扣皿」、Swivel sara grip は代表技「天中殺」につながることから「殺持ち」と仮に呼んでいます"],
        ["*4*5", "手首を外側に返し、握りは変えずにけん先／玉の穴を上に向けると「ペンギンけん持ち／玉持ち」になります"]],
    en:[["*1", "Literally \"Spacewalk\"; since the hold for toss tricks is similar, it is tentatively called 「持劍尾」 (ken-end grip) in Chinese"],
        ["*2", "Literally \"Stall\" (a spin-style hold); the Chinese-speaking community name 「極意」 (Gokui) is used instead"],
        ["*3*4", "The source treats both as variants of the swivel grip, but they are really variants of the ken grip and the sara grip. So the Swivel ken grip is tentatively called 「扣皿」 after how it looks, and the Swivel sara grip 「持殺」 after its signature linked trick, Tenchusatsu"],
        ["*4*5", "Turn the wrist outward while keeping the hold, so that the ken tip / ball hole faces up: this is the Penguin ken / tama grip"]]
  };

  function gripInfoMarks(marks){
    return marks.map(function(n){ return "<sup>*" + n + "</sup>"; }).join("");
  }
  function gripInfoHtml(){
    var lang = GRIP_INFO_NOTES[state.lang] ? state.lang : "zh";
    var h = '<div class="grip-info-intro">' + escapeHtml(t("gripInfoIntro"));
    if(isSafeHttpUrl(GRIP_INFO_URL)){
      h += '<a href="' + escapeHtml(GRIP_INFO_URL) + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(t("gripInfoLinkText")) + '</a>';
    }
    h += '</div>';
    GRIP_GROUPS.forEach(function(g){
      h += '<div class="grip-info-h">' + escapeHtml(t("gripInfoH_" + g.key)) + '</div><div class="grip-info-table">';
      GRIP_INFO_ROWS[g.key].forEach(function(r){
        var d = r[2][lang] || r[2].zh;
        h += '<div class="grip-info-row"><div class="grip-info-name">' + escapeHtml(d[0]) + gripInfoMarks(r[1]) +
          (lang === "en" ? "" : '<small>' + escapeHtml(r[0]) + '</small>') + '</div>' +
          '<div class="grip-info-desc">' + escapeHtml(d[1]) + (d[2] ? '<small>' + escapeHtml(d[2]) + '</small>' : "") + '</div></div>';
      });
      h += '</div>';
    });
    h += '<div class="grip-info-notes">';
    GRIP_INFO_NOTES[lang].forEach(function(n){ h += '<p>' + escapeHtml(n[0]) + "：" + escapeHtml(n[1]) + '</p>'; });
    return h + '</div>';
  }

  function gripInfoOverlay(){
    var ov = document.getElementById("gripInfoOverlay");
    if(ov) return ov;
    ov = document.createElement("div");
    ov.className = "modal-overlay";
    ov.id = "gripInfoOverlay";
    ov.innerHTML = '<div class="modal modal-lg grip-info-modal"><div class="modal-scroll">' +
      '<div class="modal-title" id="gripInfoTitle"></div><div id="gripInfoBody"></div></div>' +
      '<div class="modal-footer"><div class="modal-actions"><button type="button" class="btn btn-ghost" id="gripInfoCloseBtn"></button></div></div></div>';
    document.body.appendChild(ov);
    document.getElementById("gripInfoCloseBtn").addEventListener("click", closeGripInfo);
    // Backdrop closes it (read-only page). Stop the click so the search panel's outside-click handler ignores it.
    ov.addEventListener("click", function(ev){
      ev.stopPropagation();
      if(ev.target === ov) closeGripInfo();
    });
    return ov;
  }
  function openGripInfo(){
    var ov = gripInfoOverlay();
    document.getElementById("gripInfoTitle").textContent = t("gripInfoTitle");
    document.getElementById("gripInfoCloseBtn").textContent = t("gripInfoClose");
    document.getElementById("gripInfoBody").innerHTML = gripInfoHtml();
    ov.classList.add("show");
  }
  function closeGripInfo(){
    var ov = document.getElementById("gripInfoOverlay");
    if(ov) ov.classList.remove("show");
  }
  // Escape closes only this page (runs before the generic handler in js/90, which stays untouched).
  document.addEventListener("keydown", function(ev){
    if(ev.key !== "Escape") return;
    var ov = document.getElementById("gripInfoOverlay");
    if(!ov || !ov.classList.contains("show")) return;
    ev.stopImmediatePropagation();
    closeGripInfo();
  });
