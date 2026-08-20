"use strict";

  /* ============================================================
     I18N
  ============================================================ */
  var UI = {
    zh:{
      appTitle:"劍玉招式庫", searchPlaceholder:"搜尋招式名稱（中／日／英）…",
      editMode:"編輯模式", exportJson:"匯出 JSON", importJson:"匯入 JSON",
      home:"首頁", addCategory:"新增分類", addTrick:"新增招式", editCategory:"編輯分類",
      editTrick:"編輯招式", categoryNameZh:"中文名稱", categoryNameJp:"日文名稱", categoryNameEn:"英文名稱",
      parentCategory:"父分類", rootLevel:"— 無（根分類）—", save:"儲存", cancel:"取消", delete:"刪除",
      deleteCategory:"刪除分類", deleteTrick:"刪除招式",
      confirmDeleteCategoryTitle:"確認刪除此分類？", confirmDeleteCategoryBody:"此分類與其所有子分類將被刪除，相關招式將移除此分類標籤（招式本身不會被刪除）。",
      confirmDeleteTrickTitle:"確認刪除此招式？", confirmDeleteTrickBody:"此招式將自資料庫中永久移除，且會同步自所有分類中消失。",
      confirm:"確認", noSubItems:"此分類尚無子項目", clickAddBelow:"點擊下方按鈕新增子分類或招式",
      searchResultsFound:"筆結果，關鍵字：", searchNone:"找不到符合的招式，換個關鍵字試試？",
      watchVideo:"播放影片", noVideo:"尚未設定影片連結", openOriginal:"在原網站開啟",
      belongsTo:"所屬分類", categoryNameRequired:"請至少輸入中文名稱", trickFormError:"請至少輸入一種語言的招式名稱，並至少選擇一個分類",
      categoryDepthLimitReached:"分類最多支援 5 層，請選擇較淺層的父分類", maxDepthSuffix:"（已達層級上限）",
      selectCategories:"所屬分類", importSuccess:"匯入成功", importError:"匯入失敗，請確認 JSON 格式",
      exportSuccess:"已下載 JSON 檔案", savedCategory:"分類已儲存", savedTrick:"招式已儲存",
      deletedCategory:"分類已刪除", deletedTrick:"招式已刪除", newCategory:"新增分類", newTrick:"新增招式",
      emptyTitle:"從左側選擇一個分類開始", emptyBody:"點擊分類逐層展開，或使用上方搜尋列快速尋找招式。",
      backToList:"返回", editModeSub:"開啟後可新增／編輯／刪除分類與招式", instagramNote:"Instagram 連結無法直接內嵌預覽",
      variant:"項目", tricksCount:"招式", subCats:"子分類",
      moveUp:"上移", moveDown:"下移", iconColorLabel:"圖示與顏色", chooseIconColor:"選擇圖示與顏色",
      colorLabel:"顏色", iconLabel:"圖示", noIconOption:"無圖示", doneBtn:"完成", customEmojiPlaceholder:"貼上 Emoji，或輸入至多 2 個半形字",
      extTricks:"延伸招式", addVariant:"新增延伸招式", belongsToPicker:"所屬分類／招式",
      addCategoryShort:"分類", addTrickShort:"招式", addVariantShort:"延伸招式",
      egPrefix:"例如：", videoLinkLabel:"影片連結 (YouTube / Vimeo / Instagram)",
      trickModalSub:"招式資料為單一真值來源，可同時歸類於多個分類",
      trickCatEgZh:"大皿", trickCatEgJp:"大皿（おおざら）",
      categoryEgZh:"皿系", categoryEgJp:"皿系（さらけい）",
      addMedia:"新增影片", editMedia:"編輯影片", addVideoShort:"新增影片",
      mediaTypeVideo:"影片", mediaTypeNote:"備註",
      mediaNameLabel:"名稱", mediaNamePlaceholder:"例如：正面示範",
      mediaUrlLabel:"影片連結 (YouTube／Instagram／Facebook／TikTok…)",
      mediaContentPlaceholder:"輸入備註內容…",
      mediaUrlRequired:"請輸入影片連結",
      confirmDeleteMediaTitle:"確認刪除此內容？", confirmDeleteMediaBody:"此影片或備註將自此招式中永久移除。",
      embedNotSupportedNote:"此平台連結無法直接內嵌預覽",
      newSpace:"新增分區", editSpace:"編輯分區", deleteSpace:"刪除分區",
      confirmDeleteSpaceTitle:"確認刪除此分區？", confirmDeleteSpaceBody:"此分區下的分類將自動移至第一個分區，此動作無法復原。",
      proficiencyLabel:"熟練度",
      proficiency_none:"無", proficiency_once:"一次", proficiency_rare:"少見",
      proficiency_sometimes:"有時", proficiency_often:"多數", proficiency_mastered:"熟練",
      cmdExportDesc:"匯出目前資料為 JSON 檔案", cmdImportDesc:"從 JSON 檔案匯入資料",
      cmdClearTricksDesc:"清空所有招式（保留分類）", cmdClearAllDesc:"清空所有分類與招式",
      cmdResetDesc:"重設為預設範例資料",
      viewModeTree:"分層結構", viewModeColumns:"多欄清單", viewModePractice:"練習清單",
      toggleDailyPractice:"加入／移出每日練習", toggleGoal:"加入／移出目標招式",
      practiceTarget:"目標次數", practiceDailyReset:"每日凌晨重置次數",
      removeFromSection:"從此分區移除", practiceSettings:"練習設定", practiceDone:"完成",
      authLogin:"使用 Gmail 登入", authLogout:"登出", authLoginError:"登入失敗，請再試一次",
      authSyncingLocal:"正在將本機資料同步至雲端…", authSyncedLocal:"已將本機資料同步至雲端",
      authLoadError:"雲端資料讀取失敗", authSaveError:"雲端儲存失敗，請檢查網路連線",
      authLoggingOut:"已登出，切換回本機資料",
      authEditNickname:"編輯暱稱", authNicknamePlaceholder:"輸入暱稱", authNicknameSave:"儲存", authNicknameCancel:"取消",
      authNicknameUpdated:"暱稱已更新", authNicknameError:"暱稱更新失敗，請再試一次", authNicknameEmpty:"暱稱不可為空白"
    },
    jp:{
      appTitle:"けん玉技データベース", searchPlaceholder:"技名を検索（中／日／英）…",
      editMode:"編集モード", exportJson:"JSONをエクスポート", importJson:"JSONをインポート",
      home:"ホーム", addCategory:"カテゴリ追加", addTrick:"技を追加", editCategory:"カテゴリ編集",
      editTrick:"技を編集", categoryNameZh:"中国語名", categoryNameJp:"日本語名", categoryNameEn:"英語名",
      parentCategory:"親カテゴリ", rootLevel:"— なし（ルート）—", save:"保存", cancel:"キャンセル", delete:"削除",
      deleteCategory:"カテゴリを削除", deleteTrick:"技を削除",
      confirmDeleteCategoryTitle:"このカテゴリを削除しますか？", confirmDeleteCategoryBody:"このカテゴリと全ての子カテゴリが削除されます。関連する技からはタグのみ外れます（技自体は削除されません）。",
      confirmDeleteTrickTitle:"この技を削除しますか？", confirmDeleteTrickBody:"この技はデータベースから完全に削除され、全カテゴリから消えます。",
      confirm:"確認", noSubItems:"このカテゴリにはまだ項目がありません", clickAddBelow:"下のボタンからカテゴリや技を追加できます",
      searchResultsFound:"件ヒット、キーワード：", searchNone:"一致する技が見つかりません。別のキーワードをお試しください。",
      watchVideo:"動画を見る", noVideo:"動画リンク未設定", openOriginal:"元サイトで開く",
      belongsTo:"所属カテゴリ", categoryNameRequired:"中国語名を入力してください", trickFormError:"少なくとも1つの言語で技名を入力し、カテゴリを1つ以上選択してください",
      categoryDepthLimitReached:"カテゴリは最大5階層までです。より浅い親カテゴリを選んでください",  maxDepthSuffix:"（上限に到達）",
      selectCategories:"所属カテゴリ", importSuccess:"インポート成功", importError:"インポート失敗、JSON形式を確認してください",
      exportSuccess:"JSONファイルをダウンロードしました", savedCategory:"カテゴリを保存しました", savedTrick:"技を保存しました",
      deletedCategory:"カテゴリを削除しました", deletedTrick:"技を削除しました", newCategory:"新規カテゴリ", newTrick:"新規技",
      emptyTitle:"左側からカテゴリを選択してください", emptyBody:"カテゴリをクリックして階層を展開するか、上の検索バーで技を探せます。",
      backToList:"戻る", editModeSub:"オンにするとカテゴリ・技の追加／編集／削除ができます", instagramNote:"Instagramリンクは直接埋め込みできません",
      variant:"項目", tricksCount:"技", subCats:"サブカテゴリ",
      moveUp:"上へ移動", moveDown:"下へ移動", iconColorLabel:"アイコンと色", chooseIconColor:"アイコンと色を選択",
      colorLabel:"色", iconLabel:"アイコン", noIconOption:"アイコンなし", doneBtn:"完了", customEmojiPlaceholder:"絵文字、または半角2文字までのテキスト",
      extTricks:"派生技", addVariant:"派生技を追加", belongsToPicker:"所属カテゴリ／技",
      addCategoryShort:"カテゴリ", addTrickShort:"技", addVariantShort:"派生技",
      egPrefix:"例：", videoLinkLabel:"動画リンク (YouTube / Vimeo / Instagram)",
      trickModalSub:"技データは単一の情報源であり、複数のカテゴリに同時に分類できます",
      trickCatEgZh:"大皿", trickCatEgJp:"大皿（おおざら）",
      categoryEgZh:"皿系", categoryEgJp:"皿系（さらけい）",
      addMedia:"動画を追加", editMedia:"動画を編集", addVideoShort:"動画を追加",
      mediaTypeVideo:"動画", mediaTypeNote:"メモ",
      mediaNameLabel:"名前", mediaNamePlaceholder:"例：正面デモ",
      mediaUrlLabel:"動画リンク（YouTube／Instagram／Facebook／TikTok…）",
      mediaContentPlaceholder:"メモを入力…",
      mediaUrlRequired:"動画リンクを入力してください",
      confirmDeleteMediaTitle:"この項目を削除しますか？", confirmDeleteMediaBody:"この動画またはメモはこの技から完全に削除されます。",
      embedNotSupportedNote:"このプラットフォームのリンクは直接埋め込みできません",
      newSpace:"新規シェルフ", editSpace:"シェルフを編集", deleteSpace:"シェルフを削除",
      confirmDeleteSpaceTitle:"このシェルフを削除しますか？", confirmDeleteSpaceBody:"このシェルフ内のカテゴリは自動的に最初のシェルフに移動します。この操作は元に戻せません。",
      proficiencyLabel:"習熟度",
      proficiency_none:"なし", proficiency_once:"一回のみ", proficiency_rare:"稀に",
      proficiency_sometimes:"時々", proficiency_often:"多くの場合", proficiency_mastered:"習得済み",
      cmdExportDesc:"現在のデータをJSONファイルとしてエクスポート", cmdImportDesc:"JSONファイルからデータをインポート",
      cmdClearTricksDesc:"すべての技を削除（カテゴリは保持）", cmdClearAllDesc:"すべてのカテゴリと技を削除",
      cmdResetDesc:"初期のサンプルデータにリセット",
      viewModeTree:"階層構造", viewModeColumns:"複数列リスト", viewModePractice:"練習リスト",
      toggleDailyPractice:"毎日練習に追加／解除", toggleGoal:"目標の技に追加／解除",
      practiceTarget:"目標回数", practiceDailyReset:"毎日深夜にリセット",
      removeFromSection:"このセクションから削除", practiceSettings:"練習設定", practiceDone:"完了",
      authLogin:"Gmailでログイン", authLogout:"ログアウト", authLoginError:"ログインに失敗しました。もう一度お試しください",
      authSyncingLocal:"ローカルデータをクラウドに同期しています…", authSyncedLocal:"ローカルデータをクラウドに同期しました",
      authLoadError:"クラウドデータの読み込みに失敗しました", authSaveError:"クラウド保存に失敗しました。ネット接続をご確認ください",
      authLoggingOut:"ログアウトしました。ローカルデータに切り替えます",
      authEditNickname:"ニックネームを編集", authNicknamePlaceholder:"ニックネームを入力", authNicknameSave:"保存", authNicknameCancel:"キャンセル",
      authNicknameUpdated:"ニックネームを更新しました", authNicknameError:"更新に失敗しました。もう一度お試しください", authNicknameEmpty:"ニックネームを入力してください"
    },
    en:{
      appTitle:"Kendama Trick Database", searchPlaceholder:"Search trick names (ZH / JP / EN)…",
      editMode:"Edit Mode", exportJson:"Export JSON", importJson:"Import JSON",
      home:"Home", addCategory:"Add Category", addTrick:"Add Trick", editCategory:"Edit Category",
      editTrick:"Edit Trick", categoryNameZh:"Chinese Name", categoryNameJp:"Japanese Name", categoryNameEn:"English Name",
      parentCategory:"Parent Category", rootLevel:"— None (Root) —", save:"Save", cancel:"Cancel", delete:"Delete",
      deleteCategory:"Delete Category", deleteTrick:"Delete Trick",
      confirmDeleteCategoryTitle:"Delete this category?", confirmDeleteCategoryBody:"This category and all its subcategories will be deleted. Linked tricks only lose this tag (tricks themselves are kept).",
      confirmDeleteTrickTitle:"Delete this trick?", confirmDeleteTrickBody:"This trick will be permanently removed from the database and from every category it belongs to.",
      confirm:"Confirm", noSubItems:"Nothing here yet", clickAddBelow:"Use the button below to add a subcategory or trick",
      searchResultsFound:"results for ", searchNone:"No matching tricks. Try a different keyword.",
      watchVideo:"Watch Video", noVideo:"No video link set", openOriginal:"Open Original Link",
      belongsTo:"Categories", categoryNameRequired:"Please enter a Chinese name", trickFormError:"Please enter the trick name in at least one language and select at least one category",
      categoryDepthLimitReached:"Categories can be nested up to 5 levels deep — pick a shallower parent", maxDepthSuffix:"(max depth reached)",
      selectCategories:"Categories", importSuccess:"Import successful", importError:"Import failed — please check the JSON format",
      exportSuccess:"JSON file downloaded", savedCategory:"Category saved", savedTrick:"Trick saved",
      deletedCategory:"Category deleted", deletedTrick:"Trick deleted", newCategory:"New Category", newTrick:"New Trick",
      emptyTitle:"Select a category on the left", emptyBody:"Click through categories to drill down, or use the search bar above to find a trick.",
      backToList:"Back", editModeSub:"Turn on to add, edit, or delete categories and tricks", instagramNote:"Instagram links can't be embedded directly",
      variant:"item", tricksCount:"tricks", subCats:"subcategories",
      moveUp:"Move Up", moveDown:"Move Down", iconColorLabel:"Icon & Color", chooseIconColor:"Choose Icon & Color",
      colorLabel:"Color", iconLabel:"Icon", noIconOption:"No Icon", doneBtn:"Done", customEmojiPlaceholder:"Paste an emoji, or up to 2 characters",
      extTricks:"Variants", addVariant:"Add Variant", belongsToPicker:"Categories / Tricks",
      addCategoryShort:"Category", addTrickShort:"Trick", addVariantShort:"Variant",
      egPrefix:"e.g. ", videoLinkLabel:"Video Link (YouTube / Vimeo / Instagram)",
      trickModalSub:"Trick data is the single source of truth and can belong to multiple categories at once",
      trickCatEgZh:"大皿", trickCatEgJp:"大皿（おおざら）",
      categoryEgZh:"皿系", categoryEgJp:"皿系（さらけい）",
      addMedia:"Add Video", editMedia:"Edit Video", addVideoShort:"Add Video",
      mediaTypeVideo:"Video", mediaTypeNote:"Note",
      mediaNameLabel:"Name", mediaNamePlaceholder:"e.g. Front angle demo",
      mediaUrlLabel:"Video Link (YouTube / Instagram / Facebook / TikTok…)",
      mediaContentPlaceholder:"Write your note…",
      mediaUrlRequired:"Please enter a video link",
      confirmDeleteMediaTitle:"Delete this item?", confirmDeleteMediaBody:"This video or note will be permanently removed from this trick.",
      embedNotSupportedNote:"This platform's link can't be embedded directly",
      newSpace:"New Shelf", editSpace:"Edit Shelf", deleteSpace:"Delete Shelf",
      confirmDeleteSpaceTitle:"Delete this shelf?", confirmDeleteSpaceBody:"Categories in this shelf will move to the first shelf automatically. This cannot be undone.",
      proficiencyLabel:"Proficiency",
      proficiency_none:"None", proficiency_once:"Only once", proficiency_rare:"Rarely",
      proficiency_sometimes:"Sometimes", proficiency_often:"Generally", proficiency_mastered:"Always",
      cmdExportDesc:"Export current data as a JSON file", cmdImportDesc:"Import data from a JSON file",
      cmdClearTricksDesc:"Delete all tricks (keep categories)", cmdClearAllDesc:"Delete all categories and tricks",
      cmdResetDesc:"Reset to default sample data",
      viewModeTree:"Tree", viewModeColumns:"Grid List", viewModePractice:"Practice List",
      toggleDailyPractice:"Add / remove from Daily Practice", toggleGoal:"Add / remove from Goals",
      practiceTarget:"Target reps", practiceDailyReset:"Reset count every midnight",
      removeFromSection:"Remove from Section", practiceSettings:"Practice Settings", practiceDone:"Done",
      authLogin:"Sign in with Gmail", authLogout:"Sign out", authLoginError:"Sign-in failed, please try again",
      authSyncingLocal:"Syncing local data to the cloud…", authSyncedLocal:"Local data synced to the cloud",
      authLoadError:"Failed to load cloud data", authSaveError:"Cloud save failed — check your connection",
      authLoggingOut:"Signed out — switched back to local data",
      authEditNickname:"Edit nickname", authNicknamePlaceholder:"Enter a nickname", authNicknameSave:"Save", authNicknameCancel:"Cancel",
      authNicknameUpdated:"Nickname updated", authNicknameError:"Failed to update nickname, please try again", authNicknameEmpty:"Nickname can't be empty"
    }
  };

  function t(key){
    var lang = state.lang;
    return (UI[lang] && UI[lang][key]) || UI.zh[key] || key;
  }

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
     English -> Katakana (best-effort loanword-style transliteration).
     Used as a display fallback when a trick has no Japanese name but does
     have an English one. Unlike kanaToRomaji above, this direction is
     inherently much less reliable: English spelling doesn't map 1:1 to
     pronunciation (silent letters, "magic e" long vowels, y as a diphthong
     vs. a plain vowel, etc.), and real Japanese loanwords follow historical/
     phonetic convention rather than a pure spelling rule. This produces a
     plausible approximation for straightforward words, not a guaranteed
     match to how a native speaker would actually write it — some words
     (especially ones with a silent trailing "e", like "name" or "time")
     will come out noticeably off. Treat it as a starting point, not an
     authoritative reading.
  ------------------------------------------------------------ */
  var EN_KATA_ROW = {
    k:["カ","キ","ク","ケ","コ"], g:["ガ","ギ","グ","ゲ","ゴ"],
    s:["サ","シ","ス","セ","ソ"], z:["ザ","ジ","ズ","ゼ","ゾ"],
    t:["タ","チ","ツ","テ","ト"], d:["ダ","ヂ","ヅ","デ","ド"],
    n:["ナ","ニ","ヌ","ネ","ノ"], h:["ハ","ヒ","フ","ヘ","ホ"],
    b:["バ","ビ","ブ","ベ","ボ"], p:["パ","ピ","プ","ペ","ポ"],
    m:["マ","ミ","ム","メ","モ"], y:["ヤ","イ","ユ","イェ","ヨ"],
    r:["ラ","リ","ル","レ","ロ"], l:["ラ","リ","ル","レ","ロ"], // JP doesn't distinguish l/r
    w:["ワ","ウィ","ウ","ウェ","ウォ"]
  };
  var EN_KATA_SPECIAL = {
    f:["ファ","フィ","フ","フェ","フォ"], v:["ヴァ","ヴィ","ヴ","ヴェ","ヴォ"],
    j:["ジャ","ジ","ジュ","ジェ","ジョ"], ch:["チャ","チ","チュ","チェ","チョ"],
    sh:["シャ","シ","シュ","シェ","ショ"], th:["サ","シ","ス","セ","ソ"] // approximated as the s-row
  };
  var EN_BARE_VOWEL = { a:"ア", i:"イ", u:"ウ", e:"エ", o:"オ" };
  var EN_VOWEL_IDX = { a:0, i:1, u:2, e:3, o:4 };
  var EN_DIGRAPH_CONSONANT = { ph:"f", wh:"w" };
  function isEnVowel(c){ return c==="a"||c==="i"||c==="u"||c==="e"||c==="o"; }
  function enConsVowelKana(cons, vowel){
    if(EN_KATA_SPECIAL[cons]) return EN_KATA_SPECIAL[cons][EN_VOWEL_IDX[vowel]];
    if(EN_KATA_ROW[cons]) return EN_KATA_ROW[cons][EN_VOWEL_IDX[vowel]];
    return EN_BARE_VOWEL[vowel];
  }
  function englishWordToKatakana(word){
    var w = word.toLowerCase().replace(/[^a-z]/g, "");
    if(!w) return "";
    // String-level cleanup before the letter-by-letter scan below, so the
    // scanner's own lookahead logic can stay simple: "tch"/"ck" collapse to
    // their single-consonant equivalent, "x" expands to its "ks" sound
    // (handled naturally by the scanner from there — e.g. "box" -> bo-kk-s
    // -> ボックス), and "qu" becomes a single "kw" unit.
    w = w.replace(/tch/g, "ch").replace(/ck/g, "kk").replace(/x/g, "kks").replace(/qu/g, "kw");
    var n = w.length;
    var out = "", i = 0, lastVowelDoubled = false, blockGeminate = false;

    while(i < n){
      var ch = w[i];

      if(isEnVowel(ch)){
        var doubled = w[i+1] === ch;
        // English spelling "u" in a closed syllable (cup, jump, stunt) is
        // usually the short /ʌ/ sound, conventionally written with the
        // "a" row in loanwords (カップ, ジャンプ), not the "u" row — but a
        // word-final "u" (menu) or part of a doubled "uu"/"oo"-type run
        // keeps its literal vowel.
        var effCh = (ch === "u" && !doubled && i+1 < n && !isEnVowel(w[i+1])) ? "a" : ch;
        out += EN_BARE_VOWEL[effCh] + (doubled ? "ー" : "");
        lastVowelDoubled = doubled; blockGeminate = false;
        i += doubled ? 2 : 1;
        continue;
      }
      if(ch === "y" && !isEnVowel(w[i+1] || "")){
        // "y" acting as a vowel (not immediately followed by a vowel letter)
        // — approximated as a plain "i" mora. Doesn't distinguish the
        // single-syllable /aɪ/ case ("fly", "sky" -> real convention
        // "furai"/"sukai") from this, which is a known gap.
        out += "イ"; lastVowelDoubled = false; blockGeminate = false; i += 1; continue;
      }

      // Consonant (cluster) starting here — longest match first.
      var two = w.substr(i, 2);
      var consKey, advance, geminate = false;
      if(two === "ch" || two === "sh" || two === "th" || two === "kw"){ consKey = two; advance = 2; }
      else if(EN_DIGRAPH_CONSONANT[two]){ consKey = EN_DIGRAPH_CONSONANT[two]; advance = 2; }
      else if(ch === w[i+1] && !isEnVowel(ch) && ch !== "y"){
        // Doubled consonant letter: collapse to one consonant sound. Only
        // true stops (p/k/t/b/d/g) actually geminate (small tsu) in
        // loanword convention — doubled l/m/n/r/s/f etc. are just spelling
        // (e.g. "grass" -> グラス, not グラッス).
        consKey = ch; advance = 2; geminate = "pktbdg".indexOf(ch) !== -1;
      }
      else if(ch === "c"){ consKey = (w[i+1]==="e"||w[i+1]==="i"||w[i+1]==="y") ? "s" : "k"; advance = 1; }
      else { consKey = ch; advance = 1; }
      i += advance;

      if(consKey === "kw"){
        var qv = (i < n && isEnVowel(w[i]) && w[i] !== "u") ? w[i] : null;
        if(qv){ out += (geminate?"ッ":"") + ["クァ","クィ","","クェ","クォ"][EN_VOWEL_IDX[qv]]; i += 1; }
        else { out += (geminate?"ッ":"") + "ク"; if(w[i]==="u") i += 1; }
        lastVowelDoubled = false; blockGeminate = false;
        continue;
      }

      if(i < n && isEnVowel(w[i])){
        var v = w[i];
        var vDoubled = w[i+1] === v;
        var effV = (v === "u" && !vDoubled && i+1 < n && !isEnVowel(w[i+1])) ? "a" : v;
        out += (geminate?"ッ":"") + enConsVowelKana(consKey, effV) + (vDoubled ? "ー" : "");
        lastVowelDoubled = vDoubled; blockGeminate = false;
        i += vDoubled ? 2 : 1;
        continue;
      }

      // No vowel follows this consonant — cluster boundary or word end.
      var isWordFinal = (i === n);
      var isStop = consKey.length===1 && "ptkgbd".indexOf(consKey) !== -1;
      if(isWordFinal && isStop && !lastVowelDoubled && !blockGeminate){
        // Word-final stop after a short vowel geminates (cat -> キャット).
        // Suppressed after a long/doubled vowel (loop -> ループ, not ロープ)
        // or a preceding nasal (grind -> グリンド, not グリンッド) — the
        // small-tsu convention specifically follows a short vowel directly.
        out += "ッ" + enConsVowelKana(consKey, (consKey==="t"||consKey==="d") ? "o" : "u");
        blockGeminate = false;
      } else if(consKey === "n"){
        out += "ン";
        blockGeminate = true;
      } else {
        out += (geminate?"ッ":"") + enConsVowelKana(consKey, (consKey==="t"||consKey==="d") ? "o" : "u");
        blockGeminate = false;
      }
      lastVowelDoubled = false;
    }
    return out;
  }
  function enPhraseToKatakana(text){
    if(!text) return "";
    return text.split(/(\s+|[-‐]+)/).map(function(part){
      if(/^\s+$/.test(part) || /^[-‐]+$/.test(part)) return part.trim() === "" ? "・" : "";
      return englishWordToKatakana(part);
    }).join("").replace(/・+/g, "・").replace(/^・|・$/g, "");
  }

  /* ------------------------------------------------------------
     Per-interface-language display-name fallback.
     A trick only needs a name in *one* of the three languages (see
     saveTrickFromModal in 14-modal-trick.js) — this resolves what to
     actually show for the other two, per the current UI language:
       zh UI: zh -> en -> jp (as-is)
       jp UI: jp -> en -> zh (as-is)
       en UI: en -> jp (romaji if pure kana, else shown as-is if it has
              kanji — a kanji reading can't be guessed reliably) -> zh (as-is)
     Returns which source field was actually used (so callers like the
     detail drawer's name table can avoid showing that same field again)
     and whether a romaji transform was applied (if so, the raw jp field is
     still worth showing separately, since it's not literally the same text
     as the derived title).
  ------------------------------------------------------------ */
  function resolveTrickTitle(nameObj){
    if(!nameObj) return { text:"", sourceLang:null, transformed:false };
    if(state.lang === "jp"){
      if(nameObj.jp) return { text:nameObj.jp, sourceLang:"jp", transformed:false };
      if(nameObj.en) return { text:enPhraseToKatakana(nameObj.en), sourceLang:"en", transformed:true };
      if(nameObj.zh) return { text:nameObj.zh, sourceLang:"zh", transformed:false };
      return { text:"", sourceLang:null, transformed:false };
    }
    if(state.lang === "en"){
      if(nameObj.en) return { text:nameObj.en, sourceLang:"en", transformed:false };
      if(nameObj.jp){
        if(containsKanji(nameObj.jp)) return { text:nameObj.jp, sourceLang:"jp", transformed:false };
        return { text:capitalizeFirst(kanaToRomaji(nameObj.jp)), sourceLang:"jp", transformed:true };
      }
      if(nameObj.zh) return { text:nameObj.zh, sourceLang:"zh", transformed:false };
      return { text:"", sourceLang:null, transformed:false };
    }
    // zh (default)
    if(nameObj.zh) return { text:nameObj.zh, sourceLang:"zh", transformed:false };
    if(nameObj.en) return { text:nameObj.en, sourceLang:"en", transformed:false };
    if(nameObj.jp) return { text:nameObj.jp, sourceLang:"jp", transformed:false };
    return { text:"", sourceLang:null, transformed:false };
  }

  function localize(nameObj){
    return resolveTrickTitle(nameObj).text;
  }
