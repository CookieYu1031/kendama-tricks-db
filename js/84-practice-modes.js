"use strict";

  /* ============================================================
     PRACTICE LIST — mode switch (count / daily), daily reset hour.
     Logic: js/83-practice-logic.js. Panel: js/84-practice-panel.js (calls these builders).
  ============================================================ */
  addStrings({
    zh:{ pracModeCount:"計次練習", pracModeDaily:"每日練習", pracTimes:"次數", pracNoGoal:"無",
         pracResetHour:"每日刷新時間", pracResetHourHint:"到這個時間，每日練習的次數會歸零（以裝置時區計算）",
         pracGoalReached:"已達成，已移出清單", pracItemsN:"{n} 招" },
    jp:{ pracModeCount:"回数練習", pracModeDaily:"毎日練習", pracTimes:"回数", pracNoGoal:"なし",
         pracResetHour:"毎日のリセット時刻", pracResetHourHint:"この時刻に毎日練習の回数が 0 に戻ります（端末のタイムゾーン）",
         pracGoalReached:"達成しました。リストから外しました", pracItemsN:"{n} 技" },
    en:{ pracModeCount:"Count", pracModeDaily:"Daily", pracTimes:"Times", pracNoGoal:"None",
         pracResetHour:"Daily reset time", pracResetHourHint:"Daily counts go back to 0 at this time (device time zone)",
         pracGoalReached:"Goal reached, removed from the list", pracItemsN:"{n} tricks" }
  });

  // dayKey for daily lists, null for count lists (see practiceItemCount).
  function pracDayKeyFor(list){
    return list && list.mode === "daily" ? practiceDayKey(Date.now(), practiceGet().dailyResetHour) : null;
  }

  function pracBuildModeBar(){
    var bar = pracMk("div", "prac-modes"); bar.setAttribute("role", "tablist");
    [["count", "pracModeCount"], ["daily", "pracModeDaily"]].forEach(function(m){
      var b = pracMk("button", "prac-mode" + (prac.mode === m[0] ? " active" : ""), t(m[1])); b.type = "button";
      b.setAttribute("role", "tab"); b.setAttribute("aria-selected", prac.mode === m[0] ? "true" : "false");
      b.addEventListener("click", function(){ if(prac.mode === m[0]) return; prac.mode = m[0]; practiceRender(); });
      bar.appendChild(b);
    });
    return bar;
  }

  function pracBuildResetHour(){
    var data = practiceGet();
    var box = pracMk("div", "prac-reset-hour");
    var lab = pracMk("label", null); lab.appendChild(pracMk("span", null, t("pracResetHour")));
    var sel = pracMk("select");
    for(var h = 0; h < 24; h++){
      var o = pracMk("option", null, (h < 10 ? "0" : "") + h + ":00"); o.value = String(h);
      if(h === data.dailyResetHour) o.selected = true;
      sel.appendChild(o);
    }
    sel.addEventListener("change", function(){ setPracticeResetHour(practiceGet(), sel.value); practiceChanged(); practiceRender(); });
    lab.appendChild(sel); box.appendChild(lab);
    box.appendChild(pracMk("div", "field-hint", t("pracResetHourHint")));
    return box;
  }
