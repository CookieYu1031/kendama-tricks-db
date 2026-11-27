"use strict";

  /* ============================================================
     PRACTICE LIST — pure logic (tests/practice.test.js).
     UI: js/84-practice-panel.js. Storage / cloud: js/85-practice-sync.js.

     data: { lists:[ { id, name, mode:"count"|"daily", items:[ { trickId, target, count, day? } ], createdAt, updatedAt } ],
             dailyResetHour:0-23 (default 3), clientUpdatedAt }
     count lists: target may be null (unlimited); tapping up to the target removes the item (practiceTap).
     daily lists: target = per-day times; item.day = dayKey of the last count, a different dayKey reads as 0.
     Mutators edit `data` in place, stamp updatedAt, and return a result (list / true / null / reason string).
     Personal data, not linked to the landing rate.
  ============================================================ */
  var PRACTICE_MAX_LISTS = 20;        // per mode
  var PRACTICE_RESET_HOUR_DEFAULT = 3;
  var PRACTICE_MAX_ITEMS = 50;
  var PRACTICE_NAME_MAX = 40;
  var PRACTICE_TARGET_DEFAULT = 10;
  var PRACTICE_TARGET_MAX = 999;
  var PRACTICE_COUNT_MAX = 99999;

  function newPracticeData(){ return { lists: [], dailyResetHour: PRACTICE_RESET_HOUR_DEFAULT, clientUpdatedAt: 0 }; }

  function practiceCleanMode(m){ return m === "daily" ? "daily" : "count"; }
  function practiceCleanHour(h){
    h = Math.floor(Number(h));
    return isFinite(h) && h >= 0 && h <= 23 ? h : PRACTICE_RESET_HOUR_DEFAULT;
  }
  function practiceListsOfMode(data, mode){
    mode = practiceCleanMode(mode);
    return data.lists.filter(function(l){ return l.mode === mode; });
  }
  // Local date string of (nowMs - resetHour hours): the day a count belongs to.
  function practiceDayKey(nowMs, resetHour){
    var d = new Date(Number(nowMs) - practiceCleanHour(resetHour) * 3600000);
    function p2(n){ return (n < 10 ? "0" : "") + n; }
    return d.getFullYear() + "-" + p2(d.getMonth() + 1) + "-" + p2(d.getDate());
  }
  // Count shown for an item: daily items from another day read as 0. key = dayKey for daily lists, null otherwise.
  function practiceItemCount(it, key){
    if(key == null) return it.count;
    return it.day === key ? it.count : 0;
  }
  function setPracticeResetHour(data, h){
    data.dailyResetHour = practiceCleanHour(h);
    return data.dailyResetHour;
  }

  function practiceClampTarget(n){
    n = Math.floor(Number(n));
    if(!isFinite(n)) return PRACTICE_TARGET_DEFAULT;
    return Math.max(1, Math.min(PRACTICE_TARGET_MAX, n));
  }
  // count lists: empty / invalid = null (unlimited); daily lists always have a target.
  function practiceCleanTarget(n, mode){
    if(n == null || n === "" || !isFinite(Number(n))) return mode === "daily" ? PRACTICE_TARGET_DEFAULT : null;
    return practiceClampTarget(n);
  }
  function practiceCleanName(s){
    return String(s == null ? "" : s).replace(/\s+/g, " ").trim().slice(0, PRACTICE_NAME_MAX);
  }
  function practiceNewId(data){
    var id;
    do { id = "p" + Date.now().toString(36) + Math.floor(Math.random() * 1296).toString(36); }
    while(data.lists.some(function(l){ return l.id === id; }));
    return id;
  }

  // Any stored / cloud / garbage value -> valid data (never throws, enforces every limit).
  function normalizePracticeData(raw){
    var out = newPracticeData();
    if(!raw || typeof raw !== "object") return out;
    var cu = Number(raw.clientUpdatedAt);
    out.clientUpdatedAt = isFinite(cu) && cu > 0 ? cu : 0;
    out.dailyResetHour = practiceCleanHour(raw.dailyResetHour);
    var seen = {}, perMode = { count: 0, daily: 0 };
    (Array.isArray(raw.lists) ? raw.lists : []).forEach(function(l){
      if(!l || typeof l !== "object") return;
      var mode = practiceCleanMode(l.mode);
      if(perMode[mode] >= PRACTICE_MAX_LISTS) return;
      if(typeof l.id !== "string" || !l.id || seen[l.id]) return;
      seen[l.id] = true; perMode[mode]++;
      var ids = {}, items = [];
      (Array.isArray(l.items) ? l.items : []).forEach(function(it){
        if(items.length >= PRACTICE_MAX_ITEMS || !it || typeof it.trickId !== "string" || !it.trickId || ids[it.trickId]) return;
        ids[it.trickId] = true;
        var c = Math.floor(Number(it.count));
        var item = { trickId: it.trickId, target: practiceCleanTarget(it.target, mode),
          count: isFinite(c) ? Math.max(0, Math.min(PRACTICE_COUNT_MAX, c)) : 0 };
        if(mode === "daily") item.day = typeof it.day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(it.day) ? it.day : "";
        items.push(item);
      });
      var ca = Number(l.createdAt), ua = Number(l.updatedAt);
      out.lists.push({ id: l.id, name: practiceCleanName(l.name), mode: mode, items: items,
        createdAt: isFinite(ca) ? ca : 0, updatedAt: isFinite(ua) ? ua : 0 });
    });
    return out;
  }

  function findPracticeList(data, id){
    for(var i = 0; i < data.lists.length; i++) if(data.lists[i].id === id) return data.lists[i];
    return null;
  }
  function practiceTouchList(l, now){ l.updatedAt = now == null ? Date.now() : now; }

  // -> new list, or null (empty name / limit reached).
  function createPracticeList(data, name, now, mode){
    name = practiceCleanName(name); mode = practiceCleanMode(mode);
    if(!name || practiceListsOfMode(data, mode).length >= PRACTICE_MAX_LISTS) return null;
    now = now == null ? Date.now() : now;
    var l = { id: practiceNewId(data), name: name, mode: mode, items: [], createdAt: now, updatedAt: now };
    data.lists.push(l);
    return l;
  }
  function renamePracticeList(data, id, name, now){
    var l = findPracticeList(data, id); name = practiceCleanName(name);
    if(!l || !name) return false;
    l.name = name; practiceTouchList(l, now);
    return true;
  }
  function deletePracticeList(data, id){
    var n = data.lists.length;
    data.lists = data.lists.filter(function(l){ return l.id !== id; });
    return data.lists.length < n;
  }

  function findPracticeItem(list, trickId){
    for(var i = 0; i < list.items.length; i++) if(list.items[i].trickId === trickId) return list.items[i];
    return null;
  }
  // -> true | "dup" | "full" | "bad"
  function addPracticeTrick(list, trickId, now){
    if(!list || typeof trickId !== "string" || !trickId) return "bad";
    if(findPracticeItem(list, trickId)) return "dup";
    if(list.items.length >= PRACTICE_MAX_ITEMS) return "full";
    if(list.mode === "daily") list.items.push({ trickId: trickId, target: PRACTICE_TARGET_DEFAULT, count: 0, day: "" });
    else list.items.push({ trickId: trickId, target: null, count: 0 });
    practiceTouchList(list, now);
    return true;
  }
  function removePracticeTrick(list, trickId, now){
    var n = list.items.length;
    list.items = list.items.filter(function(it){ return it.trickId !== trickId; });
    if(list.items.length === n) return false;
    practiceTouchList(list, now);
    return true;
  }
  // delta +1 / -1 (any integer); never below 0. -> new count or null.
  function bumpPracticeCount(list, trickId, delta, now){
    var it = findPracticeItem(list, trickId);
    if(!it) return null;
    it.count = Math.max(0, Math.min(PRACTICE_COUNT_MAX, it.count + Math.floor(Number(delta) || 0)));
    practiceTouchList(list, now);
    return it.count;
  }
  function setPracticeTarget(list, trickId, n, now){
    var it = findPracticeItem(list, trickId);
    if(!it) return null;
    it.target = practiceCleanTarget(n, list.mode);
    practiceTouchList(list, now);
    return it.target;
  }
  // Tap with a day-aware / goal-aware rule. -> { count, removed } or null.
  // daily: a stale day resets to 0 first. count: the tap that reaches the target removes the item
  // (an item already at / past the target is never removed, so old data is safe).
  function practiceTap(list, trickId, delta, now, resetHour, nowMs){
    var it = findPracticeItem(list, trickId);
    if(!it) return null;
    delta = Math.floor(Number(delta) || 0);
    if(list.mode === "daily"){
      var key = practiceDayKey(nowMs == null ? Date.now() : nowMs, resetHour);
      if(it.day !== key){ it.count = 0; it.day = key; }
      it.count = Math.max(0, Math.min(PRACTICE_COUNT_MAX, it.count + delta));
      practiceTouchList(list, now);
      return { count: it.count, removed: false };
    }
    var old = it.count;
    it.count = Math.max(0, Math.min(PRACTICE_COUNT_MAX, old + delta));
    var removed = delta > 0 && it.target != null && old < it.target && it.count >= it.target;
    if(removed) list.items = list.items.filter(function(x){ return x !== it; });
    practiceTouchList(list, now);
    return { count: it.count, removed: removed };
  }
  function resetPracticeCounts(list, now){
    list.items.forEach(function(it){ it.count = 0; if(list.mode === "daily") it.day = ""; });
    practiceTouchList(list, now);
  }
  // key = dayKey for daily lists (omit for count lists). No target = never done.
  function practiceItemDone(it, key){
    return it.target != null && practiceItemCount(it, key) >= it.target;
  }

  // hasTrick(id) optional: items of deleted tricks are left out of the numbers. -> { done, total }
  function practiceProgress(list, hasTrick, key){
    var done = 0, total = 0, items = 0;
    list.items.forEach(function(it){
      if(hasTrick && !hasTrick(it.trickId)) return;
      items++;
      if(it.target == null) return; // count mode without a goal: never "done", not in the ratio
      total++;
      if(practiceItemDone(it, key)) done++;
    });
    return { done: done, total: total, items: items };
  }

  // Sign-in reconcile. local / cloud: normalized data or null (= none). guest: normalized guest data or null.
  // -> { action: "none" | "useCloud" | "pushLocal" | "copyGuest", data }
  function practiceDecideSync(local, cloud, guest){
    var hasLocal = !!local && (local.lists.length > 0 || local.clientUpdatedAt > 0);
    if(!cloud){
      if(hasLocal) return { action: "pushLocal", data: local };
      if(guest && guest.lists.length) return { action: "copyGuest", data: guest };
      return { action: "none", data: local || newPracticeData() };
    }
    if(!hasLocal) return { action: "useCloud", data: cloud };
    if(cloud.clientUpdatedAt > local.clientUpdatedAt) return { action: "useCloud", data: cloud };
    if(local.clientUpdatedAt > cloud.clientUpdatedAt) return { action: "pushLocal", data: local };
    return { action: "none", data: local };
  }
