"use strict";

  /* ============================================================
     NAMES: display-name fallback + derived romaji (spec 企劃書 §一, §三.4, B11)
     Name object: { zh, jp, en } (strings, may be empty). Rules:
       1. name in the current language exists -> show it
       2. else en -> romaji derived from jp; zh -> en; jp -> en
       3. else the first existing name (zh, jp, en)
     Romaji is never stored. Kana is converted directly; kanji runs use a
     reading map learned from the site's own tricks (rebuildReadingDict).
     Loads after 03-i18n; nothing here runs at load time except table setup.
  ============================================================ */

  /* ------------------------------------------------------------
     Kana -> Romaji (best-effort Hepburn-style romanization).
     Used as a last-resort display name when a trick has neither a
     Chinese nor an English name, only a Japanese (kana) one.
  ------------------------------------------------------------ */
  var KANA_YOUON = {
    "きゃ":"kya","きゅ":"kyu","きょ":"kyo","ぎゃ":"gya","ぎゅ":"gyu","ぎょ":"gyo",
    "しゃ":"sha","しゅ":"shu","しょ":"sho","じゃ":"ja","じゅ":"ju","じょ":"jo",
    "ちゃ":"cha","ちゅ":"chu","ちょ":"cho","ぢゃ":"ja","ぢゅ":"ju","ぢょ":"jo",
    "にゃ":"nya","にゅ":"nyu","にょ":"nyo","ひゃ":"hya","ひゅ":"hyu","ひょ":"hyo",
    "びゃ":"bya","びゅ":"byu","びょ":"byo","ぴゃ":"pya","ぴゅ":"pyu","ぴょ":"pyo",
    "みゃ":"mya","みゅ":"myu","みょ":"myo","りゃ":"rya","りゅ":"ryu","りょ":"ryo"
  };
  var KANA_MONO = {
    "あ":"a","い":"i","う":"u","え":"e","お":"o",
    "か":"ka","き":"ki","く":"ku","け":"ke","こ":"ko",
    "が":"ga","ぎ":"gi","ぐ":"gu","げ":"ge","ご":"go",
    "さ":"sa","し":"shi","す":"su","せ":"se","そ":"so",
    "ざ":"za","じ":"ji","ず":"zu","ぜ":"ze","ぞ":"zo",
    "た":"ta","ち":"chi","つ":"tsu","て":"te","と":"to",
    "だ":"da","ぢ":"ji","づ":"zu","で":"de","ど":"do",
    "な":"na","に":"ni","ぬ":"nu","ね":"ne","の":"no",
    "は":"ha","ひ":"hi","ふ":"fu","へ":"he","ほ":"ho",
    "ば":"ba","び":"bi","ぶ":"bu","べ":"be","ぼ":"bo",
    "ぱ":"pa","ぴ":"pi","ぷ":"pu","ぺ":"pe","ぽ":"po",
    "ま":"ma","み":"mi","む":"mu","め":"me","も":"mo",
    "や":"ya","ゆ":"yu","よ":"yo",
    "ら":"ra","り":"ri","る":"ru","れ":"re","ろ":"ro",
    "わ":"wa","ゐ":"i","ゑ":"e","を":"o","ん":"n",
    "ぁ":"a","ぃ":"i","ぅ":"u","ぇ":"e","ぉ":"o","ゃ":"ya","ゅ":"yu","ょ":"yo"
  };
  function kanaToRomaji(input){
    if(!input) return "";
    // Fold katakana down to hiragana codepoints (standard block offset of 0x60)
    // so a single table covers both scripts; anything outside that range
    // (kanji, ー, punctuation, ascii) is left untouched.
    var s = input.replace(/[\u30A1-\u30F6]/g, function(ch){
      return String.fromCharCode(ch.charCodeAt(0) - 0x60);
    });
    var out = "", lastVowel = "", i = 0, n = s.length;
    while(i < n){
      var two = s.substr(i, 2);
      if(KANA_YOUON[two]){
        out += KANA_YOUON[two];
        lastVowel = KANA_YOUON[two].slice(-1);
        i += 2;
        continue;
      }
      var c = s[i];
      if(c === "っ"){
        var rest = s.slice(i+1);
        var nr = KANA_YOUON[rest.substr(0,2)] || KANA_MONO[rest[0]] || "";
        if(nr && /^[bcdfghjklmnpqrstvwxyz]/.test(nr)) out += nr[0];
        i += 1;
        continue;
      }
      if(c === "ー"){
        out += lastVowel;
        i += 1;
        continue;
      }
      if(KANA_MONO[c]){
        out += KANA_MONO[c];
        lastVowel = KANA_MONO[c].slice(-1);
        i += 1;
        continue;
      }
      out += c;
      lastVowel = "";
      i += 1;
    }
    return out;
  }
  function capitalizeFirst(str){
    return str ? str.charAt(0).toUpperCase() + str.slice(1) : str;
  }
  // CJK Unified Ideographs (+ Extension A) — used to tell "this Japanese
  // text is kanji" apart from pure kana, which is the only case romaji
  // conversion can be trusted to be accurate (see resolveTrickTitle below).
  function containsKanji(str){
    return !!(str && /[\u4E00-\u9FFF\u3400-\u4DBF]/.test(str));
  }

  /* ------------------------------------------------------------
     Romaji detection + kanji reading dictionary
  ------------------------------------------------------------ */
  var KANJI_RUN_RE = /[\u4E00-\u9FFF\u3400-\u4DBF\u3005]+/g;
  var ROMAJI_SYL = "(?:sh|ch|ts|j|[kgsztdnhbpmrwf]y?|y)?[aiueo]";
  var ROMAJI_RE = new RegExp("^(?:" + ROMAJI_SYL + "|([kgsztdhbpmrwfc])\\1(?:" + ROMAJI_SYL + ")|n(?![aiueoy]))+$");
  // True when text is only letters/spaces/hyphens/apostrophes AND fully parses
  // as Japanese syllables (CV, long vowels, sokuon doubling, moraic n).
  // Lenient: English words that happen to be syllable-shaped ("banana",
  // "kendama") pass; "Big cup" fails ("g", "c" without a vowel).
  function looksLikeRomaji(text){
    if(!text || !/^[A-Za-z][A-Za-z '\u2019-]*$/.test(text)) return false;
    var s = text.toLowerCase().replace(/[ '\u2019-]/g, "");
    return !!s && ROMAJI_RE.test(s);
  }

  var readingDict = {};
  function getReadingDict(){ return readingDict; }

  // Learn kanji -> romaji from tricks whose jp has kanji and en looks like romaji.
  // Stores whole-name pairs, plus the kanji run itself when the name has exactly
  // one run (kana around it is peeled off the romaji when it matches).
  function rebuildReadingDict(tricks){
    var dict = {};
    (tricks || []).forEach(function(tr){
      var nm = tr && tr.name;
      if(!nm || !nm.jp || !nm.en || !containsKanji(nm.jp)) return;
      var jp = nm.jp.trim(), en = nm.en.trim();
      if(!looksLikeRomaji(en)) return;
      var enLow = en.toLowerCase().replace(/\s+/g, " ");
      if(!dict[jp]) dict[jp] = enLow;
      var runs = jp.match(KANJI_RUN_RE);
      if(runs && runs.length === 1){
        var run = runs[0], at = jp.indexOf(run);
        var pre = kanaToRomaji(jp.slice(0, at)), post = kanaToRomaji(jp.slice(at + run.length));
        var flat = enLow.replace(/[ '\u2019-]/g, "");
        if(/^[a-z]*$/.test(pre) && /^[a-z]*$/.test(post) &&
           flat.length > pre.length + post.length &&
           flat.indexOf(pre) === 0 && flat.slice(flat.length - post.length) === post){
          var core = flat.slice(pre.length, flat.length - post.length);
          if(core && !dict[run]) dict[run] = core;
        }
      }
    });
    readingDict = dict;
    return dict;
  }

  // Split a kanji run into known dictionary entries (fewest pieces, then
  // longest-first); returns array of romaji pieces or null if not coverable.
  function segmentKanji(run){
    if(readingDict[run]) return [readingDict[run]];
    var n = run.length, best = [];
    best[n] = [];
    for(var i = n - 1; i >= 0; i--){
      for(var j = n; j > i; j--){
        var k = run.slice(i, j);
        if(readingDict[k] && best[j]){
          var cand = [readingDict[k]].concat(best[j]);
          if(!best[i] || cand.length < best[i].length) best[i] = cand;
        }
      }
    }
    return best[0] || null;
  }

  // jp -> romaji ("" when any kanji run is unknown or other chars are unconvertible).
  // Whole-name dictionary hit wins; else runs are romanized separately and joined
  // with a single space (kana run via kanaToRomaji, kanji run via learned map).
  function toRomaji(jpText){
    if(!jpText) return "";
    var jp = String(jpText).trim();
    if(!jp) return "";
    var out;
    if(readingDict[jp]) out = readingDict[jp];
    else {
      var parts = jp.split(/([\u4E00-\u9FFF\u3400-\u4DBF\u3005]+)/), res = [];
      for(var i = 0; i < parts.length; i++){
        var p = parts[i];
        if(!p) continue;
        if(i % 2 === 1){
          var seg = segmentKanji(p);
          if(!seg) return "";
          res = res.concat(seg);
        } else {
          var r = kanaToRomaji(p.replace(/[\u30FB\u3000]/g, " ")).trim();
          if(r) res.push(r);
        }
      }
      out = res.join(" ");
    }
    out = out.replace(/\s+/g, " ").trim();
    if(!out || !/^[A-Za-z][A-Za-z '\u2019-]*$/.test(out)) return "";
    return capitalizeFirst(out);
  }

  /* ------------------------------------------------------------
     Display name resolution
  ------------------------------------------------------------ */
  function resolveDisplayName(nameObj, lang){
    var none = { text:"", sourceLang:null, transformed:false };
    if(!nameObj) return none;
    lang = lang || state.lang;
    if(lang !== "zh" && lang !== "jp" && lang !== "en") lang = "zh";
    if(nameObj[lang]) return { text:nameObj[lang], sourceLang:lang, transformed:false };
    if(lang === "en"){
      var ro = toRomaji(nameObj.jp);
      if(ro) return { text:ro, sourceLang:"jp", transformed:true };
    } else if(nameObj.en){
      return { text:nameObj.en, sourceLang:"en", transformed:false };
    }
    var order = ["zh", "jp", "en"];
    for(var i = 0; i < order.length; i++){
      if(nameObj[order[i]]) return { text:nameObj[order[i]], sourceLang:order[i], transformed:false };
    }
    return none;
  }
  function resolveTrickTitle(nameObj){ return resolveDisplayName(nameObj); }
  function localize(nameObj){ return resolveDisplayName(nameObj).text; }

  // Drawer "other names": filled languages except the one shown, [tag, text].
  // When the shown text is derived romaji, the raw jp is still listed.
  function otherNames(nameObj, lang){
    if(!nameObj) return [];
    var r = resolveDisplayName(nameObj, lang);
    var skip = r.transformed ? null : r.sourceLang;
    var tags = { zh:"ZH", jp:"JP", en:"EN" }, out = [];
    ["zh", "jp", "en"].forEach(function(l){
      if(nameObj[l] && l !== skip) out.push([tags[l], nameObj[l]]);
    });
    return out;
  }
