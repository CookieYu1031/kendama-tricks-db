"use strict";

  /* ============================================================
     TUTORIAL (v0.14) — pure logic: tracks, page normalize/validate, text fallback.
     UI is in js/19-shell-tutorial.js. Storage: Firestore tutorial/{track}.
  ============================================================ */
  // Flip to true to open the tracks to everyone (until then non-admins see "coming soon").
  var TUTORIAL_PUBLIC = false;
  var TUTORIAL_TRACKS = ["kids", "beginner"];
  var TUTORIAL_PAGE_COUNT = 10;
  var TUTORIAL_TEXT_MAX = 1000;
  var TUTORIAL_PUBLIC_SPACES = ["t00", "t01", "t02", "t03"];
  var TUTORIAL_VIDEO_MAX = 500;

  function isTutorialTrack(id){ return TUTORIAL_TRACKS.indexOf(id) !== -1; }
  function tutorialCanOpen(isAdmin){ return !!(TUTORIAL_PUBLIC || isAdmin); }

  function tutorialBlankPage(){ return { trickId: "", videoUrl: "", text: { zh: "", jp: "", en: "" } }; }

  function tutorialNormalizePage(p){
    var out = tutorialBlankPage();
    if(!p || typeof p !== "object") return out;
    if(typeof p.trickId === "string" && /^[0-9A-Za-z]{7}$/.test(p.trickId)) out.trickId = p.trickId;
    if(tutorialVideoUrlOk(p.videoUrl) && p.videoUrl) out.videoUrl = p.videoUrl.trim();
    var tx = p.text && typeof p.text === "object" ? p.text : {};
    ["zh", "jp", "en"].forEach(function(l){
      out.text[l] = typeof tx[l] === "string" ? tx[l].slice(0, TUTORIAL_TEXT_MAX) : "";
    });
    return out;
  }
  // Always exactly TUTORIAL_PAGE_COUNT pages (missing -> blank, extra dropped).
  function tutorialNormalizePages(list){
    var src = Array.isArray(list) ? list : [];
    var out = [];
    for(var i = 0; i < TUTORIAL_PAGE_COUNT; i++) out.push(tutorialNormalizePage(src[i]));
    return out;
  }

  // "abc1234" or "@abc1234" -> id; "" -> ""; anything else -> null.
  function tutorialParseTrickId(raw){
    var s = (typeof raw === "string" ? raw : "").trim();
    if(!s) return "";
    var m = /^@?\s*([0-9A-Za-z]{7})$/.exec(s);
    return m ? m[1] : null;
  }
  // Trick must exist and sit in a public table (t00/t01/t02/t03).
  function tutorialTrickInPublic(id){
    var tr = typeof getTrick === "function" ? getTrick(id) : null;
    if(!tr) return false;
    return (tr.categoryIds || []).some(function(cid){
      return TUTORIAL_PUBLIC_SPACES.indexOf(containerSpaceId(cid)) !== -1;
    });
  }
  // -> { ok, id, error: ""|"format"|"notfound"|"notpublic" }; empty input is ok with id "".
  function tutorialCheckTrick(raw){
    var id = tutorialParseTrickId(raw);
    if(id === null) return { ok: false, id: "", error: "format" };
    if(id === "") return { ok: true, id: "", error: "" };
    if(!getTrick(id)) return { ok: false, id: id, error: "notfound" };
    if(!tutorialTrickInPublic(id)) return { ok: false, id: id, error: "notpublic" };
    return { ok: true, id: id, error: "" };
  }

  // Current language first, then zh -> jp -> en.
  function tutorialPageText(page, lang){
    var tx = page && page.text ? page.text : {};
    var order = [lang, "zh", "jp", "en"];
    for(var i = 0; i < order.length; i++){
      var s = tx[order[i]];
      if(typeof s === "string" && s.trim()) return s;
    }
    return "";
  }
  function tutorialFirstVideoUrl(tr){
    var m = tr && tr.media ? tr.media : [];
    for(var i = 0; i < m.length; i++) if(m[i] && m[i].type === "video" && m[i].url) return m[i].url;
    for(var j = 0; j < m.length; j++) if(m[j] && m[j].url) return m[j].url;
    return "";
  }
  // Page's own video link (v0.14.2): "" or an http(s) URL up to TUTORIAL_VIDEO_MAX chars.
  function tutorialVideoUrlOk(raw){
    if(raw === "" || raw == null) return true;
    if(typeof raw !== "string") return false;
    var s = raw.trim();
    if(!s) return true;
    return s.length <= TUTORIAL_VIDEO_MAX && typeof isSafeHttpUrl === "function" && isSafeHttpUrl(s);
  }
  // The page's own link wins over the linked trick's first video.
  function tutorialPageVideoUrl(page, tr){
    return (page && page.videoUrl) || tutorialFirstVideoUrl(tr);
  }
  // Firestore payload (minus updatedAt, added by the writer).
  function tutorialPayload(pages){ return { pages: tutorialNormalizePages(pages) }; }
