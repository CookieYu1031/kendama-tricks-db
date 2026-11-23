"use strict";

  /* ============================================================
     BULK SUBMISSIONS (批量投稿) — contributors only (js/71 isContributorAccount).
     Section at the bottom of the 招式投稿 modal (js/74): download an .xlsx template, upload the filled
     sheet (parsed in the browser by js/79-xlsx.js), see a preview with row errors, then send.
     Storage: ONE reports/{autoId} doc, kind "trick", payload { bulk:true, items:[…] } (the existing
     reports rules already allow it: payload is a map with <= 4 keys). The admin mailbox (js/73)
     lists each item with a 複製招式 button. Pure helpers first (tests/contrib.test.js, tests/xlsx.test.js).
  ============================================================ */
  addStrings({
    zh:{ bulkTitle:"協助者：批量投稿", bulkTplBtn:"下載批量投稿格式", bulkUploadBtn:"上傳 .xlsx 批量投稿",
         bulkTplNote:"※ 說明列（上傳時會略過）：中／日／英名稱至少填一個；影片至少一個，限 YouTube、Instagram、Facebook、TikTok、X、Threads、Google Drive；握持手勢填 持劍／持球／持線，或子手勢名稱（如 持皿、蠟燭、提燈台，可用中／日／英名稱）；部位、招式類別、標籤以「、」分隔。",
         bulkReading:"讀取中…", bulkUnsupported:"此瀏覽器不支援讀取 .xlsx，請改用較新的瀏覽器", bulkBadFile:"無法讀取這個檔案，請使用下載的格式 (.xlsx)",
         bulkTooBig:"檔案太大（上限 2 MB）", bulkNoHeader:"找不到標題列，請使用下載的格式", bulkNoRows:"沒有可投稿的資料列",
         bulkTooMany:"最多 {n} 列，超出的列已略過", bulkPayloadBig:"內容太大，請分批上傳",
         bulkSummary:"共 {ok} 列可送出，{bad} 列有錯誤", bulkRow:"第 {n} 列", bulkSend:"送出批量投稿",
         bulkErrGrip:"握持手勢不認得（可填 持劍／持球／持線，或子手勢名稱）", bulkErrPart:"部位不認得：{v}", bulkErrLong:"欄位內容太長",
         bulkSent:"已送出 {n} 個招式投稿，謝謝你！", bulkNeedOk:"沒有可送出的資料列" },
    jp:{ bulkTitle:"協力者：一括投稿", bulkTplBtn:"一括投稿のフォーマットをダウンロード", bulkUploadBtn:".xlsx をアップロードして一括投稿",
         bulkTplNote:"※ 説明行（アップロード時は無視されます）：中・日・英の名前のいずれか1つ以上。動画は1つ以上（YouTube、Instagram、Facebook、TikTok、X、Threads、Google Drive のみ）。握持手勢は「持劍」「持球」「持線」、またはサブの持ち方の名前（皿持ち、キャンドル、ライトハウス等。中・日・英いずれも可）。部位・招式類別・標籤は「、」で区切ってください。",
         bulkReading:"読み込み中…", bulkUnsupported:"このブラウザでは .xlsx を読み込めません。新しいブラウザをお試しください", bulkBadFile:"ファイルを読み込めません。ダウンロードしたフォーマット (.xlsx) をご使用ください",
         bulkTooBig:"ファイルが大きすぎます（上限 2 MB）", bulkNoHeader:"見出し行が見つかりません。ダウンロードしたフォーマットをご使用ください", bulkNoRows:"投稿できる行がありません",
         bulkTooMany:"最大 {n} 行です。超えた行は無視しました", bulkPayloadBig:"内容が大きすぎます。分けてアップロードしてください",
         bulkSummary:"送信可能 {ok} 行、エラー {bad} 行", bulkRow:"{n} 行目", bulkSend:"一括投稿を送信",
         bulkErrGrip:"握持手勢が不明です（持劍／持球／持線、またはサブの持ち方の名前）", bulkErrPart:"部位が不明です：{v}", bulkErrLong:"内容が長すぎます",
         bulkSent:"{n} 件の技を投稿しました。ありがとうございます！", bulkNeedOk:"送信できる行がありません" },
    en:{ bulkTitle:"Helper: bulk submission", bulkTplBtn:"Download bulk submission template", bulkUploadBtn:"Upload .xlsx for bulk submission",
         bulkTplNote:"* Notes row (skipped on upload): at least one of the zh/jp/en names; at least one video (YouTube, Instagram, Facebook, TikTok, X, Threads or Google Drive only); grip = 持劍 / 持球 / 持線, or a sub-grip name (e.g. sara, candle, lighthouse; zh/jp/en names accepted); parts, classes and tags separated by 「、」.",
         bulkReading:"Reading…", bulkUnsupported:"This browser can't read .xlsx — please use a newer browser", bulkBadFile:"Can't read this file — use the downloaded template (.xlsx)",
         bulkTooBig:"File too large (max 2 MB)", bulkNoHeader:"Header row not found — use the downloaded template", bulkNoRows:"No rows to submit",
         bulkTooMany:"At most {n} rows; the rest were skipped", bulkPayloadBig:"Too much data — upload in smaller batches",
         bulkSummary:"{ok} rows ready, {bad} rows with errors", bulkRow:"Row {n}", bulkSend:"Send bulk submission",
         bulkErrGrip:"Unknown grip (use 持劍 / 持球 / 持線 or a sub-grip name)", bulkErrPart:"Unknown part: {v}", bulkErrLong:"A cell is too long",
         bulkSent:"Submitted {n} tricks — thank you!", bulkNeedOk:"No rows to send" }
  });

  var BULK_MAX_ROWS = 200;
  var BULK_MAX_BYTES = 700000;    // payload JSON in UTF-8 bytes; a Firestore doc is 1 MiB
  var BULK_MAX_NOTE = 1000, BULK_MAX_LOC = 200, BULK_MAX_ITEM = 60, BULK_MAX_LIST = 12;
  // Template columns: key + zh header label (rows are matched by header text; the key is also accepted).
  var BULK_COLUMNS = [
    { key:"nameZh", label:"中文名稱" }, { key:"nameJp", label:"日文名稱" }, { key:"nameEn", label:"英文名稱" },
    { key:"url1", label:"影片1" }, { key:"url2", label:"影片2" }, { key:"url3", label:"影片3" },
    { key:"grip", label:"握持手勢", alias:"握持" }, { key:"parts", label:"部位" }, { key:"classes", label:"招式類別" },
    { key:"tags", label:"標籤" }, { key:"note", label:"備註" }, { key:"location", label:"建議位置" }
  ];

  function bulkTemplateRows(){
    return [BULK_COLUMNS.map(function(c){ return c.label; }), [t("bulkTplNote")]];
  }
  function bulkDownloadName(){ return "kendama-bulk-submission.xlsx"; }

  // Splits a cell on 、 (also , ， ; ； and newlines), trims, drops empties/duplicates.
  function bulkSplitList(s){
    var seen = {}, out = [];
    String(s == null ? "" : s).split(/[、,，;；\n\r]+/).forEach(function(x){
      x = x.trim();
      if(x && !seen[x]){ seen[x] = true; out.push(x); }
    });
    return out;
  }

  // Grip token (key, or full / short label in any language; categories and subs) -> grip key, or "".
  function bulkGripKey(token){
    var tk = String(token).trim().toLowerCase();
    if(!tk) return "";
    var langs = ["zh", "jp", "en"];
    for(var i = 0; i < GRIP_KEYS.length; i++){
      var k = GRIP_KEYS[i];
      if(k.toLowerCase() === tk) return k;
    }
    // categories first, so a shared name ("持劍" = ken and ken_ken) resolves to the category
    for(var i2 = 0; i2 < GRIP_KEYS.length; i2++){
      var k2 = GRIP_KEYS[i2];
      for(var j = 0; j < langs.length; j++){
        var tab = typeof UI !== "undefined" && UI[langs[j]] ? UI[langs[j]] : {};
        var a = tab["grip_" + k2], b = tab["gripS_" + k2];
        if((a && String(a).toLowerCase() === tk) || (b && String(b).toLowerCase() === tk)) return k2;
      }
    }
    return "";
  }

  // Part token (key or label in any language) -> part key, or "".
  function bulkPartKey(token){
    var tk = String(token).trim().toLowerCase();
    if(!tk) return "";
    var keys = typeof PART_KEYS !== "undefined" ? PART_KEYS : [];
    var langs = ["zh", "jp", "en"];
    for(var i = 0; i < keys.length; i++){
      var k = keys[i];
      if(k.toLowerCase() === tk) return k;
      for(var j = 0; j < langs.length; j++){
        var lab = typeof UI !== "undefined" && UI[langs[j]] ? UI[langs[j]]["part_" + k] : "";
        if(lab && String(lab).toLowerCase() === tk) return k;
      }
    }
    return "";
  }

  // Header row -> { colKey: columnIndex }; null when no known header is found in this row.
  function bulkMapHeader(row){
    var map = {}, hits = 0;
    (row || []).forEach(function(cell, i){
      var c = String(cell == null ? "" : cell).trim().toLowerCase();
      if(!c) return;
      BULK_COLUMNS.forEach(function(col){
        if((c === col.label.toLowerCase() || c === col.key.toLowerCase() || (col.alias && c === col.alias.toLowerCase())) && map[col.key] === undefined){ map[col.key] = i; hits++; }
      });
    });
    return hits >= 2 ? map : null;
  }

  // One data row -> { item, errors:[{ key, v? }] }. Item is the compact payload shape.
  function bulkBuildItem(row, map){
    function cell(k){ return map[k] === undefined ? "" : String(row[map[k]] == null ? "" : row[map[k]]).trim(); }
    var errors = [];
    var names = {}, tooLong = false;
    [["zh", "nameZh"], ["jp", "nameJp"], ["en", "nameEn"]].forEach(function(p){
      var v = cell(p[1]);
      if(v.length > BULK_MAX_ITEM) tooLong = true;
      if(v) names[p[0]] = v;
    });
    if(tooLong || !hasSubmissionName(names)) errors.push({ key:"formErrNames" });
    var urls = ["url1", "url2", "url3"].map(cell).filter(Boolean);
    if(!urls.length) errors.push({ key:"formErrUrlReq" });
    else {
      var uerr = "";
      urls.forEach(function(u){ if(!uerr) uerr = validateSubmissionVideoUrl(u); });
      if(uerr) errors.push({ key:uerr });
    }
    var grip = null, g = cell("grip");
    if(g){
      grip = bulkGripKey(g) || null;
      if(!grip) errors.push({ key:"bulkErrGrip" });
    }
    var parts = [];
    bulkSplitList(cell("parts")).forEach(function(tok){
      var k = bulkPartKey(tok);
      if(k){ if(parts.indexOf(k) === -1) parts.push(k); } else errors.push({ key:"bulkErrPart", v:tok });
    });
    var classes = bulkSplitList(cell("classes")), tags = bulkSplitList(cell("tags"));
    var note = cell("note"), loc = cell("location");
    if(note.length > BULK_MAX_NOTE || loc.length > BULK_MAX_LOC || classes.length > BULK_MAX_LIST || tags.length > BULK_MAX_LIST ||
       classes.concat(tags).some(function(x){ return x.length > BULK_MAX_ITEM; })) errors.push({ key:"bulkErrLong" });
    var item = { names: names, urls: urls.slice(0, 3), grip: grip, parts: parts, classes: classes.slice(0, BULK_MAX_LIST),
      tags: tags.slice(0, BULK_MAX_LIST), note: note.slice(0, BULK_MAX_NOTE), location: loc.slice(0, BULK_MAX_LOC) };
    return { item: item, errors: errors };
  }

  // rows: string[][] from xlsxParse. Returns { ok, error?, items:[], bad:[{ row (1-based sheet row), errors }], truncated }.
  function bulkParseSheet(rows){
    var map = null, start = 0;
    for(var i = 0; i < rows.length && i < 10; i++){
      map = bulkMapHeader(rows[i]);
      if(map){ start = i + 1; break; }
    }
    if(!map) return { ok:false, error:"bulkNoHeader", items:[], bad:[], truncated:false };
    var items = [], bad = [], seen = 0, truncated = false;
    for(var r = start; r < rows.length; r++){
      var row = rows[r] || [];
      var filled = row.filter(function(c){ return String(c == null ? "" : c).trim() !== ""; });
      if(!filled.length) continue;
      if(String(filled[0]).trim().charAt(0) === "※") continue; // ※ notes row
      if(seen >= BULK_MAX_ROWS){ truncated = true; break; }
      seen++;
      var b = bulkBuildItem(row, map);
      if(b.errors.length) bad.push({ row: r + 1, errors: b.errors });
      else items.push(b.item);
    }
    if(!items.length && !bad.length) return { ok:false, error:"bulkNoRows", items:[], bad:[], truncated:false };
    return { ok:true, items: items, bad: bad, truncated: truncated };
  }

  function bulkUtf8Len(s){
    var n = 0;
    for(var i = 0; i < s.length; i++){
      var c = s.charCodeAt(i);
      if(c < 0x80) n += 1;
      else if(c < 0x800) n += 2;
      else if(c >= 0xD800 && c < 0xDC00){ n += 4; i++; }
      else n += 3;
    }
    return n;
  }
  // Builds the report doc (createdAt added at write time by submitReport in js/74). {ok,doc} | {ok:false,error}.
  function buildBulkReportDoc(user, items){
    if(!user || !user.uid) return { ok:false, error:"formNeedLogin" };
    if(!items || !items.length) return { ok:false, error:"bulkNeedOk" };
    if(items.length > BULK_MAX_ROWS) return { ok:false, error:"bulkTooMany" };
    if(bulkUtf8Len(JSON.stringify(items)) > BULK_MAX_BYTES) return { ok:false, error:"bulkPayloadBig" };
    return { ok:true, doc:{
      uid: user.uid, email: String(user.email || "").slice(0, 200), displayName: String(user.displayName || "").slice(0, 60),
      kind: "trick", text: "", payload: { bulk: true, items: items }, status: "open"
    } };
  }

  // Admin side (js/73): a report doc -> [{ names, urls, grip, parts, classes, tags, note, location }].
  // Single form submissions (payload { names, url } + text as description) are normalised to the same shape.
  function submissionItemsOf(r){
    var p = (r && r.payload) || {};
    if(Array.isArray(p.items)) return p.items;
    if(p.trick && typeof p.trick === "object"){ // v0.9.3 form: payload.trick = { names, urls, grip, parts, tagIds, classes, tags }
      var q = p.trick;
      return [{ names: q.names || {}, urls: q.urls || [], grip: q.grip || null, parts: q.parts || [], classes: q.classes || [],
        tags: q.tags || [], tagIds: q.tagIds || [], note: (r && r.text) || "", location: "" }];
    }
    if(p.names || p.url) return [{ names: p.names || {}, urls: p.url ? [p.url] : [], grip: null, parts: [], classes: [], tags: [],
      note: (r && r.text) || "", location: "" }];
    return [];
  }
  // Admin side: item -> trick data for the app clipboard (js/25 clipSetExternalTrick). Tag names that
  // match an existing tag (tags = db.tags, any name language) are attached; the rest are dropped.
  function submissionItemToTrickData(item, tags){
    var ids = [];
    (item.tagIds || []).forEach(function(id){
      if((tags || []).some(function(g){ return g.id === id; }) && ids.indexOf(id) === -1) ids.push(id);
    });
    (item.classes || []).concat(item.tags || []).forEach(function(nm){
      var low = String(nm).trim().toLowerCase();
      (tags || []).forEach(function(g){
        var n = g.name || {};
        var hit = [n.zh, n.jp, n.en].some(function(x){ return x && String(x).trim().toLowerCase() === low; });
        if(hit && ids.indexOf(g.id) === -1) ids.push(g.id);
      });
    });
    var nm = item.names || {};
    return {
      name: { zh: nm.zh || "", jp: nm.jp || "", en: nm.en || "" },
      urls: (item.urls || []).slice(0, 3), grip: item.grip || null, parts: (item.parts || []).slice(), tagIds: ids, note: item.note || ""
    };
  }

  /* ---------------- UI (appended into the 招式投稿 modal by js/74) ---------------- */
  var bulkBusy = false;

  function bulkDownloadTemplate(){
    var bytes = xlsxBuild(bulkTemplateRows(), "tricks");
    var blob = new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = bulkDownloadName();
    document.body.appendChild(a); a.click();
    setTimeout(function(){ URL.revokeObjectURL(a.href); if(a.parentNode) a.parentNode.removeChild(a); }, 1000);
  }

  function bulkErrText(e){
    var s = t(e.key);
    return e.v ? s.replace("{v}", e.v) : s;
  }

  function bulkRenderPreview(box, res, user, ov){
    var html = '<div class="field-hint">' + escapeHtml(t("bulkSummary").replace("{ok}", String(res.items.length)).replace("{bad}", String(res.bad.length))) + '</div>';
    if(res.truncated) html += '<div class="field-hint">' + escapeHtml(t("bulkTooMany").replace("{n}", String(BULK_MAX_ROWS))) + '</div>';
    if(res.bad.length){
      html += '<div class="bulk-errors">' + res.bad.slice(0, 50).map(function(b){
        return '<div class="bulk-err-row"><span class="bulk-err-n">' + escapeHtml(t("bulkRow").replace("{n}", String(b.row))) + '</span> ' +
          escapeHtml(b.errors.map(bulkErrText).join("；")) + '</div>';
      }).join("") + '</div>';
    }
    if(res.items.length){
      html += '<div class="bulk-preview">' + res.items.slice(0, 50).map(function(it){
        var nm = [it.names.zh, it.names.jp, it.names.en].filter(Boolean).join(" / ");
        return '<div class="bulk-prev-row">' + escapeHtml(nm) + '</div>';
      }).join("") + (res.items.length > 50 ? '<div class="bulk-prev-row">…</div>' : '') + '</div>';
      html += '<button type="button" class="btn btn-primary btn-sm btn-block" id="bulkSendBtn">' + escapeHtml(t("bulkSend")) + '</button>';
    }
    box.innerHTML = html;
    var send = box.querySelector("#bulkSendBtn");
    if(!send) return;
    send.onclick = function(){
      if(bulkBusy) return;
      var r = buildBulkReportDoc(user, res.items);
      if(!r.ok){ showToast(t(r.error), "error"); return; }
      if(reportCooldownLeft(getReportLast(user.uid), Date.now()) > 0){ showToast(t("formErrWait"), "error"); return; }
      bulkBusy = true; send.disabled = true; send.textContent = t("formSending");
      submitReport(r.doc).then(function(){
        setReportLast(user.uid, Date.now());
        bulkBusy = false;
        ov.classList.remove("show");
        showToast(t("bulkSent").replace("{n}", String(res.items.length)));
      }).catch(function(e){
        bulkBusy = false;
        showToast(t(e && e.code === "permission-denied" ? "formErrWait" : "formErrFail"), "error");
        send.disabled = false; send.textContent = t("bulkSend");
      });
    };
  }

  function bulkShowError(box, key){
    box.innerHTML = '<div class="field-error">' + escapeHtml(t(key)) + '</div>';
  }
  function bulkHandleFile(file, box, user, ov){
    if(!file) return;
    if(file.size > XLSX_MAX_FILE){ bulkShowError(box, "bulkTooBig"); return; }
    box.innerHTML = '<div class="field-hint">' + escapeHtml(t("bulkReading")) + '</div>';
    file.arrayBuffer().then(function(buf){ return xlsxParse(new Uint8Array(buf)); }).then(function(rows){
      var res = bulkParseSheet(rows);
      if(!res.ok){ bulkShowError(box, res.error); return; }
      bulkRenderPreview(box, res, user, ov);
    }).catch(function(e){
      var m = e && e.message;
      bulkShowError(box, m === "xlsx-unsupported" ? "bulkUnsupported" : m === "xlsx-big" ? "bulkTooBig" : "bulkBadFile");
    });
  }

  // Appends the contributor section to the modal body (.modal-scroll). No-op for non-contributors.
  function bulkAppendSection(ov, user){
    if(typeof isContributorAccount !== "function" || !isContributorAccount()) return;
    var scroll = ov.querySelector(".modal-scroll");
    var sec = document.createElement("div");
    sec.className = "bulk-section";
    sec.innerHTML = '<div class="bulk-btns"><span class="bulk-title">' + escapeHtml(t("bulkTitle")) + '</span><button type="button" class="btn btn-ghost btn-sm" id="bulkTplBtn">' + escapeHtml(t("bulkTplBtn")) + '</button>' +
      '<button type="button" class="btn btn-ghost btn-sm" id="bulkUploadBtn">' + escapeHtml(t("bulkUploadBtn")) + '</button></div>' +
      '<input type="file" id="bulkFile" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hidden>' +
      '<div class="bulk-result" id="bulkResult"></div>';
    scroll.appendChild(sec);
    var file = sec.querySelector("#bulkFile"), box = sec.querySelector("#bulkResult");
    sec.querySelector("#bulkTplBtn").addEventListener("click", bulkDownloadTemplate);
    sec.querySelector("#bulkUploadBtn").addEventListener("click", function(){ file.value = ""; file.click(); });
    file.addEventListener("change", function(){ bulkHandleFile(file.files && file.files[0], box, user, ov); });
  }
