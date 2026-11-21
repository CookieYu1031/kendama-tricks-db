"use strict";

  /* ============================================================
     PRACTICE LIST — pure logic (tests/practice.test.js).
     UI: js/84-practice-panel.js. Storage / cloud: js/85-practice-sync.js.

     data: { lists:[ { id, name, items:[ { trickId, target, count } ], createdAt, updatedAt } ], clientUpdatedAt }
     Mutators edit `data` in place, stamp updatedAt, and return a result (list / true / null / reason string).
     Personal data, not linked to the landing rate.
  ============================================================ */
  var PRACTICE_MAX_LISTS = 20;
  var PRACTICE_MAX_ITEMS = 50;
  var PRACTICE_NAME_MAX = 40;
  var PRACTICE_TARGET_DEFAULT = 10;
  var PRACTICE_TARGET_MAX = 999;
  var PRACTICE_COUNT_MAX = 99999;

  function newPracticeData(){ return { lists: [], clientUpdatedAt: 0 }; }

  function practiceClampTarget(n){
    n = Math.floor(Number(n));
    if(!isFinite(n)) return PRACTICE_TARGET_DEFAULT;
    return Math.max(1, Math.min(PRACTICE_TARGET_MAX, n));
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
    var seen = {};
    (Array.isArray(raw.lists) ? raw.lists : []).forEach(function(l){
      if(out.lists.length >= PRACTICE_MAX_LISTS || !l || typeof l !== "object") return;
      if(typeof l.id !== "string" || !l.id || seen[l.id]) return;
      seen[l.id] = true;
      var ids = {}, items = [];
      (Array.isArray(l.items) ? l.items : []).forEach(function(it){
        if(items.length >= PRACTICE_MAX_ITEMS || !it || typeof it.trickId !== "string" || !it.trickId || ids[it.trickId]) return;
        ids[it.trickId] = true;
        var c = Math.floor(Number(it.count));
        items.push({ trickId: it.trickId, target: practiceClampTarget(it.target == null ? PRACTICE_TARGET_DEFAULT : it.target),
          count: isFinite(c) ? Math.max(0, Math.min(PRACTICE_COUNT_MAX, c)) : 0 });
      });
      var ca = Number(l.createdAt), ua = Number(l.updatedAt);
      out.lists.push({ id: l.id, name: practiceCleanName(l.name), items: items,
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
  function createPracticeList(data, name, now){
    name = practiceCleanName(name);
    if(!name || data.lists.length >= PRACTICE_MAX_LISTS) return null;
    now = now == null ? Date.now() : now;
    var l = { id: practiceNewId(data), name: name, items: [], createdAt: now, updatedAt: now };
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
    list.items.push({ trickId: trickId, target: PRACTICE_TARGET_DEFAULT, count: 0 });
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
    it.target = practiceClampTarget(n);
    practiceTouchList(list, now);
    return it.target;
  }
  function resetPracticeCounts(list, now){
    list.items.forEach(function(it){ it.count = 0; });
    practiceTouchList(list, now);
  }
  function practiceItemDone(it){ return it.count >= it.target; }

  // hasTrick(id) optional: items of deleted tricks are left out of the numbers. -> { done, total }
  function practiceProgress(list, hasTrick){
    var done = 0, total = 0;
    list.items.forEach(function(it){
      if(hasTrick && !hasTrick(it.trickId)) return;
      total++;
      if(practiceItemDone(it)) done++;
    });
    return { done: done, total: total };
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
