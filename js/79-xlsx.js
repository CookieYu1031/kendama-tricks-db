"use strict";

  /* ============================================================
     MINIMAL XLSX (no dependencies) — used by the contributor bulk submission (js/72, js/74).
       xlsxBuild(rows)        -> Uint8Array  single-sheet workbook (STORED zip, inline strings)
       xlsxParse(bytes)       -> Promise<string[][]>  first sheet as rows of strings
       xlsxZip(entries, comp) -> Uint8Array  zip writer (comp(bytes) -> deflate-raw bytes, optional; tests)
     Reading inflates entries with DecompressionStream("deflate-raw"); when it is missing,
     the promise rejects with Error("xlsx-unsupported") (the UI shows a fallback message).
     Cell values are always read as text (numbers keep Excel's stored value).
  ============================================================ */
  var XLSX_MAX_FILE = 2 * 1024 * 1024;      // bytes of the uploaded file
  var XLSX_MAX_ENTRY = 8 * 1024 * 1024;     // uncompressed bytes per entry (zip-bomb guard)

  var _xlsxCrcTable = null;
  function xlsxCrc32(bytes){
    if(!_xlsxCrcTable){
      _xlsxCrcTable = [];
      for(var n = 0; n < 256; n++){
        var c = n;
        for(var k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
        _xlsxCrcTable[n] = c >>> 0;
      }
    }
    var crc = 0xFFFFFFFF;
    for(var i = 0; i < bytes.length; i++) crc = _xlsxCrcTable[(crc ^ bytes[i]) & 0xFF] ^ (crc >>> 8);
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }

  function xlsxUtf8(str){ return new TextEncoder().encode(str); }
  function xlsxFromUtf8(bytes){ return new TextDecoder("utf-8").decode(bytes); }
  function _u16(a, p){ return a[p] | (a[p + 1] << 8); }
  function _u32(a, p){ return (a[p] | (a[p + 1] << 8) | (a[p + 2] << 16) | (a[p + 3] << 24)) >>> 0; }
  function _w16(a, p, v){ a[p] = v & 0xFF; a[p + 1] = (v >>> 8) & 0xFF; }
  function _w32(a, p, v){ a[p] = v & 0xFF; a[p + 1] = (v >>> 8) & 0xFF; a[p + 2] = (v >>> 16) & 0xFF; a[p + 3] = (v >>> 24) & 0xFF; }

  /* ---------------- zip writer ---------------- */
  // entries: [{ name, data:Uint8Array }]. comp: optional compress function (-> method 8), else STORED.
  function xlsxZip(entries, comp){
    var parts = [], central = [], offset = 0;
    entries.forEach(function(e){
      var name = xlsxUtf8(e.name), raw = e.data, crc = xlsxCrc32(raw);
      var stored = comp ? comp(raw) : raw, method = comp ? 8 : 0;
      var lh = new Uint8Array(30 + name.length);
      _w32(lh, 0, 0x04034b50); _w16(lh, 4, 20); _w16(lh, 6, 0x0800); _w16(lh, 8, method);
      _w16(lh, 10, 0); _w16(lh, 12, 0x21); // 1980-01-01 00:00
      _w32(lh, 14, crc); _w32(lh, 18, stored.length); _w32(lh, 22, raw.length); _w16(lh, 26, name.length); _w16(lh, 28, 0);
      lh.set(name, 30);
      var ch = new Uint8Array(46 + name.length);
      _w32(ch, 0, 0x02014b50); _w16(ch, 4, 20); _w16(ch, 6, 20); _w16(ch, 8, 0x0800); _w16(ch, 10, method);
      _w16(ch, 12, 0); _w16(ch, 14, 0x21);
      _w32(ch, 16, crc); _w32(ch, 20, stored.length); _w32(ch, 24, raw.length); _w16(ch, 28, name.length);
      _w32(ch, 42, offset);
      ch.set(name, 46);
      parts.push(lh, stored); central.push(ch);
      offset += lh.length + stored.length;
    });
    var cdSize = central.reduce(function(a, c){ return a + c.length; }, 0);
    var end = new Uint8Array(22);
    _w32(end, 0, 0x06054b50); _w16(end, 8, entries.length); _w16(end, 10, entries.length);
    _w32(end, 12, cdSize); _w32(end, 16, offset);
    var all = parts.concat(central, [end]);
    var total = all.reduce(function(a, p){ return a + p.length; }, 0);
    var out = new Uint8Array(total), pos = 0;
    all.forEach(function(p){ out.set(p, pos); pos += p.length; });
    return out;
  }

  /* ---------------- workbook writer ---------------- */
  function xlsxEsc(s){
    return String(s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function xlsxColName(i){
    var s = "";
    for(i = i + 1; i > 0; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + ((i - 1) % 26)) + s;
    return s;
  }
  // rows: array of arrays of strings. Returns the .xlsx bytes.
  function xlsxBuild(rows, sheetName){
    var sheet = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>';
    rows.forEach(function(row, r){
      sheet += '<row r="' + (r + 1) + '">';
      row.forEach(function(v, c){
        if(v === "" || v == null) return;
        sheet += '<c r="' + xlsxColName(c) + (r + 1) + '" t="inlineStr"><is><t xml:space="preserve">' + xlsxEsc(v) + '</t></is></c>';
      });
      sheet += '</row>';
    });
    sheet += '</sheetData></worksheet>';
    var files = [
      ["[Content_Types].xml", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
        '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>'],
      ["_rels/.rels", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'],
      ["xl/workbook.xml", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
        '<sheets><sheet name="' + xlsxEsc(sheetName || "Sheet1") + '" sheetId="1" r:id="rId1"/></sheets></workbook>'],
      ["xl/_rels/workbook.xml.rels", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>'],
      ["xl/worksheets/sheet1.xml", sheet]
    ];
    return xlsxZip(files.map(function(f){ return { name: f[0], data: xlsxUtf8(f[1]) }; }));
  }

  /* ---------------- zip reader ---------------- */
  // Central directory -> [{ name, method, csize, usize, offset }]
  function xlsxListEntries(bytes){
    var end = -1;
    for(var i = bytes.length - 22; i >= Math.max(0, bytes.length - 22 - 65535); i--){
      if(_u32(bytes, i) === 0x06054b50){ end = i; break; }
    }
    if(end < 0) throw new Error("xlsx-bad");
    var count = _u16(bytes, end + 10), pos = _u32(bytes, end + 16), list = [];
    for(var n = 0; n < count; n++){
      if(pos + 46 > bytes.length || _u32(bytes, pos) !== 0x02014b50) throw new Error("xlsx-bad");
      var nl = _u16(bytes, pos + 28), el = _u16(bytes, pos + 30), cl = _u16(bytes, pos + 32);
      list.push({ name: xlsxFromUtf8(bytes.subarray(pos + 46, pos + 46 + nl)), method: _u16(bytes, pos + 10),
        csize: _u32(bytes, pos + 20), usize: _u32(bytes, pos + 24), offset: _u32(bytes, pos + 42) });
      pos += 46 + nl + el + cl;
    }
    return list;
  }
  function xlsxInflateRaw(data){
    if(typeof DecompressionStream === "undefined" || typeof Blob === "undefined" || typeof Response === "undefined"){
      return Promise.reject(new Error("xlsx-unsupported"));
    }
    var stream = new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
    return new Response(stream).arrayBuffer().then(function(buf){ return new Uint8Array(buf); });
  }
  // Test hook: replace the inflater (Node without DecompressionStream in the vm context).
  var xlsxInflateHook = null;
  function xlsxReadEntry(bytes, e){
    if(e.usize > XLSX_MAX_ENTRY) return Promise.reject(new Error("xlsx-big"));
    var p = e.offset;
    if(p + 30 > bytes.length || _u32(bytes, p) !== 0x04034b50) return Promise.reject(new Error("xlsx-bad"));
    var start = p + 30 + _u16(bytes, p + 26) + _u16(bytes, p + 28);
    var data = bytes.subarray(start, start + e.csize);
    if(e.method === 0) return Promise.resolve(data);
    if(e.method !== 8) return Promise.reject(new Error("xlsx-bad"));
    return (xlsxInflateHook || xlsxInflateRaw)(data);
  }

  /* ---------------- sheet reader ---------------- */
  function xlsxUnescape(s){
    return s.replace(/&(#x[0-9A-Fa-f]+|#[0-9]+|lt|gt|amp|quot|apos);/g, function(m, g){
      if(g === "lt") return "<"; if(g === "gt") return ">"; if(g === "amp") return "&";
      if(g === "quot") return '"'; if(g === "apos") return "'";
      var code = g.charAt(1) === "x" ? parseInt(g.slice(2), 16) : parseInt(g.slice(1), 10);
      return code > 0 && code < 0x110000 ? String.fromCodePoint(code) : "";
    });
  }
  // Text of the <t> runs inside one chunk (phonetic <rPh> runs excluded).
  function xlsxTexts(chunk){
    chunk = chunk.replace(/<(?:\w+:)?rPh\b[\s\S]*?<\/(?:\w+:)?rPh>/g, "");
    var out = "", re = /<(?:\w+:)?t\b[^>]*?(?:\/>|>([\s\S]*?)<\/(?:\w+:)?t>)/g, m;
    while((m = re.exec(chunk))) out += m[1] ? xlsxUnescape(m[1]) : "";
    return out;
  }
  function xlsxSharedStrings(xml){
    var list = [], re = /<(?:\w+:)?si\b[^>]*?(?:\/>|>([\s\S]*?)<\/(?:\w+:)?si>)/g, m;
    while((m = re.exec(xml))) list.push(m[1] ? xlsxTexts(m[1]) : "");
    return list;
  }
  function xlsxColIndex(ref){
    var letters = /^[A-Za-z]+/.exec(ref || "");
    if(!letters) return -1;
    var n = 0;
    for(var i = 0; i < letters[0].length; i++) n = n * 26 + (letters[0].toUpperCase().charCodeAt(i) - 64);
    return n - 1;
  }
  var XLSX_MAX_COLS = 60, XLSX_MAX_ROWS = 2000;
  function xlsxSheetRows(xml, shared){
    var rows = [], rowRe = /<(?:\w+:)?row\b[^>]*?(?:\/>|>([\s\S]*?)<\/(?:\w+:)?row>)/g, rm;
    while((rm = rowRe.exec(xml)) && rows.length < XLSX_MAX_ROWS){
      var row = [], cellRe = /<(?:\w+:)?c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:\w+:)?c>)/g, cm, auto = 0;
      while((cm = cellRe.exec(rm[1] || ""))){
        var attrs = cm[1], body = cm[2] || "";
        var ref = /\br="([^"]*)"/.exec(attrs), ty = /\bt="([^"]*)"/.exec(attrs);
        var col = ref ? xlsxColIndex(ref[1]) : auto;
        if(col < 0 || col >= XLSX_MAX_COLS) continue;
        auto = col + 1;
        var val = "", v = /<(?:\w+:)?v\b[^>]*>([\s\S]*?)<\/(?:\w+:)?v>/.exec(body);
        var kind = ty ? ty[1] : "n";
        if(kind === "s") val = v ? (shared[parseInt(v[1], 10)] || "") : "";
        else if(kind === "inlineStr") val = xlsxTexts(body);
        else val = v ? xlsxUnescape(v[1]) : "";
        while(row.length < col) row.push("");
        row[col] = val;
      }
      rows.push(row);
    }
    return rows;
  }

  // bytes: Uint8Array of a .xlsx. Resolves to rows (arrays of strings) of the first worksheet.
  function xlsxParse(bytes){
    if(!bytes || bytes.length > XLSX_MAX_FILE) return Promise.reject(new Error("xlsx-big"));
    var list;
    try{ list = xlsxListEntries(bytes); }catch(e){ return Promise.reject(e); }
    var byName = {};
    list.forEach(function(e){ byName[e.name] = e; });
    var sheetEntry = byName["xl/worksheets/sheet1.xml"];
    if(!sheetEntry){
      list.map(function(e){ return e.name; }).filter(function(n){ return /^xl\/worksheets\/[^\/]+\.xml$/.test(n); }).sort()
        .slice(0, 1).forEach(function(n){ sheetEntry = byName[n]; });
    }
    if(!sheetEntry) return Promise.reject(new Error("xlsx-bad"));
    var ssP = byName["xl/sharedStrings.xml"]
      ? xlsxReadEntry(bytes, byName["xl/sharedStrings.xml"]).then(function(b){ return xlsxSharedStrings(xlsxFromUtf8(b)); })
      : Promise.resolve([]);
    return ssP.then(function(shared){
      return xlsxReadEntry(bytes, sheetEntry).then(function(b){ return xlsxSheetRows(xlsxFromUtf8(b), shared); });
    });
  }
