"use strict";

  /* ============================================================
     I18N
  ============================================================ */
  var UI = {
    zh:{
      appTitle:"劍玉招式庫", searchPlaceholder:"搜尋招式名稱（中／日／英）…",
      editMode:"編輯模式",
      home:"首頁", addCategory:"新增清單", addTrick:"新增招式", editCategory:"編輯清單",
      categoryNameZh:"中文名稱", categoryNameJp:"日文名稱", categoryNameEn:"英文名稱",
      parentCategory:"上層清單", rootLevel:"— 無（最上層）—", save:"儲存", cancel:"取消", delete:"刪除",
      confirmDeleteCategoryTitle:"確認刪除此清單？", confirmDeleteCategoryBody:"此清單與其所有子清單將被刪除，相關招式將移除此清單標籤（招式本身不會被刪除）。",
      confirmDeleteTrickTitle:"確認刪除此招式？", confirmDeleteTrickBody:"此招式將自資料庫中永久移除，且會同步自所有清單中消失。",
      confirm:"確認", noSubItems:"此清單尚無子項目", clickAddBelow:"點擊下方按鈕新增清單或招式",
      searchResultsFound:"筆結果，關鍵字：", searchNone:"找不到符合的招式，換個關鍵字試試？",
      watchVideo:"播放影片", noVideo:"尚未設定影片連結", openOriginal:"在原網站開啟",
      belongsTo:"所屬清單", categoryNameRequired:"請至少輸入中文名稱",
      categoryDepthLimitReached:"清單最多支援 5 層，請選擇較淺層的上層清單", maxDepthSuffix:"（已達層級上限）",
      selectCategories:"所屬清單",
      savedCategory:"清單已儲存", savedTrick:"招式已儲存",
      deletedCategory:"清單已刪除", deletedTrick:"招式已刪除", newCategory:"新增清單", newTrick:"新增招式",
      emptyTitle:"從左側選擇一個清單開始", emptyBody:"點擊清單逐層展開，或點上方「🔍 搜尋」快速尋找招式。",
      backToList:"返回", editModeSub:"開啟後可新增／編輯／刪除清單與招式", instagramNote:"Instagram 連結無法直接內嵌預覽",
      variant:"項目", tricksCount:"招式", subCats:"清單",
      moveUp:"上移", moveDown:"下移", iconColorLabel:"圖示與顏色", chooseIconColor:"選擇圖示與顏色",
      colorLabel:"顏色", iconLabel:"圖示", noIconOption:"無圖示", doneBtn:"完成", customEmojiPlaceholder:"貼上 Emoji，或 3 個半形字／1 個全形字",
      extTricks:"延伸招式", addVariant:"新增延伸招式", belongsToPicker:"所屬清單／招式",
      addCategoryShort:"清單", addTrickShort:"招式", addVariantShort:"延伸招式",
      egPrefix:"例如：", videoLinkLabel:"影片連結 (YouTube / Vimeo / Instagram)",
      categoryEgZh:"皿系", categoryEgJp:"皿系（さらけい）",
      addMedia:"新增影片", editMedia:"編輯影片", addVideoShort:"新增影片",
      mediaTypeVideo:"影片", mediaTypeNote:"備註",
      mediaNameLabel:"名稱", mediaNamePlaceholder:"例如：正面示範",
      mediaUrlLabel:"影片連結 (YouTube／Instagram／Facebook／TikTok…)",
      mediaContentPlaceholder:"輸入備註內容…",
      mediaUrlRequired:"請輸入影片連結", mediaUrlInvalid:"請輸入 http:// 或 https:// 開頭的連結",
      confirmDeleteMediaTitle:"確認刪除此內容？", confirmDeleteMediaBody:"此影片或備註將自此招式中永久移除。",
      embedNotSupportedNote:"此平台連結無法直接內嵌預覽",
      newSpace:"新增分區", editSpace:"編輯分區",
      confirmDeleteSpaceTitle:"確認刪除此分區？", confirmDeleteSpaceBody:"此分區下的清單將自動移至第一個分區，此動作無法復原。",
      proficiencyLabel:"熟練度",
      proficiency_none:"無", proficiency_once:"一次", proficiency_rare:"少見",
      proficiency_sometimes:"有時", proficiency_often:"多數", proficiency_mastered:"熟練",
      viewModeTree:"分層結構", viewModeColumns:"多欄清單",
      toggleGoal:"加入／移出收藏",
      guestLoginHint:"登入後可記錄成招、成招率，並使用收藏與自訂表",
      removeFromSection:"從此分區移除",
      authLogin:"使用 Gmail 登入", authLogout:"登出", authLoginError:"登入失敗，請再試一次",
      authSyncingLocal:"正在將本機資料同步至雲端…", authSyncedLocal:"已將本機資料同步至雲端",
      authLoadError:"雲端資料讀取失敗", authSaveError:"雲端儲存失敗，請檢查網路連線",
      authLoggingOut:"已登出，切換回本機資料",
      authEditNickname:"編輯暱稱", authNicknamePlaceholder:"輸入暱稱", authNicknameSave:"儲存", authNicknameCancel:"取消",
      authNicknameUpdated:"暱稱已更新", authNicknameError:"暱稱更新失敗，請再試一次", authNicknameEmpty:"暱稱不可為空白",
      publishUpdate:"發布總表更新", publishNoteRequired:"請輸入更新備註", publishError:"發布失敗，請檢查網路連線",
      publishSuccess:"已發布更新", baseUpdateApplied:"已更新總表內容",
      baseUpdateAvailable:"總表有更新", baseUpdateNow:"立即更新", baseUpdateDismiss:"稍後再說",
      searchToggle:"搜尋", backHome:"回到首頁", settings:"設定", settingsClose:"關閉",
      settingsAdminSoon:"管理員面板（即將推出）", comingSoon:"即將推出",
      themeSystem:"跟隨系統", themeDark:"暗色", themeLight:"亮色",
      settingsNotices:"通知與近期更新",
      settingsSubmit:"招式投稿／申請協助者", settingsSubmitNote:"欲大量投稿可申請成為協助者",
      settingsReport:"問題回報"
    },
    jp:{
      appTitle:"けん玉技データベース", searchPlaceholder:"技名を検索（中／日／英）…",
      editMode:"編集モード",
      home:"ホーム", addCategory:"リスト追加", addTrick:"技を追加", editCategory:"リスト編集",
      categoryNameZh:"中国語名", categoryNameJp:"日本語名", categoryNameEn:"英語名",
      parentCategory:"上位リスト", rootLevel:"— なし（ルート）—", save:"保存", cancel:"キャンセル", delete:"削除",
      confirmDeleteCategoryTitle:"このリストを削除しますか？", confirmDeleteCategoryBody:"このリストと全ての子リストが削除されます。関連する技からはタグのみ外れます（技自体は削除されません）。",
      confirmDeleteTrickTitle:"この技を削除しますか？", confirmDeleteTrickBody:"この技はデータベースから完全に削除され、全リストから消えます。",
      confirm:"確認", noSubItems:"このリストにはまだ項目がありません", clickAddBelow:"下のボタンからリストや技を追加できます",
      searchResultsFound:"件ヒット、キーワード：", searchNone:"一致する技が見つかりません。別のキーワードをお試しください。",
      watchVideo:"動画を見る", noVideo:"動画リンク未設定", openOriginal:"元サイトで開く",
      belongsTo:"所属リスト", categoryNameRequired:"中国語名を入力してください",
      categoryDepthLimitReached:"リストは最大5階層までです。より浅い上位リストを選んでください",  maxDepthSuffix:"（上限に到達）",
      selectCategories:"所属リスト",
      savedCategory:"リストを保存しました", savedTrick:"技を保存しました",
      deletedCategory:"リストを削除しました", deletedTrick:"技を削除しました", newCategory:"新規リスト", newTrick:"新規技",
      emptyTitle:"左側からリストを選択してください", emptyBody:"リストをクリックして階層を展開するか、上の「🔍 検索」で技を探せます。",
      backToList:"戻る", editModeSub:"オンにするとリスト・技の追加／編集／削除ができます", instagramNote:"Instagramリンクは直接埋め込みできません",
      variant:"項目", tricksCount:"技", subCats:"リスト",
      moveUp:"上へ移動", moveDown:"下へ移動", iconColorLabel:"アイコンと色", chooseIconColor:"アイコンと色を選択",
      colorLabel:"色", iconLabel:"アイコン", noIconOption:"アイコンなし", doneBtn:"完了", customEmojiPlaceholder:"絵文字、または半角3文字／全角1文字まで",
      extTricks:"派生技", addVariant:"派生技を追加", belongsToPicker:"所属リスト／技",
      addCategoryShort:"リスト", addTrickShort:"技", addVariantShort:"派生技",
      egPrefix:"例：", videoLinkLabel:"動画リンク (YouTube / Vimeo / Instagram)",
      categoryEgZh:"皿系", categoryEgJp:"皿系（さらけい）",
      addMedia:"動画を追加", editMedia:"動画を編集", addVideoShort:"動画を追加",
      mediaTypeVideo:"動画", mediaTypeNote:"メモ",
      mediaNameLabel:"名前", mediaNamePlaceholder:"例：正面デモ",
      mediaUrlLabel:"動画リンク（YouTube／Instagram／Facebook／TikTok…）",
      mediaContentPlaceholder:"メモを入力…",
      mediaUrlRequired:"動画リンクを入力してください", mediaUrlInvalid:"http:// または https:// で始まるリンクを入力してください",
      confirmDeleteMediaTitle:"この項目を削除しますか？", confirmDeleteMediaBody:"この動画またはメモはこの技から完全に削除されます。",
      embedNotSupportedNote:"このプラットフォームのリンクは直接埋め込みできません",
      newSpace:"新規シェルフ", editSpace:"シェルフを編集",
      confirmDeleteSpaceTitle:"このシェルフを削除しますか？", confirmDeleteSpaceBody:"このシェルフ内のリストは自動的に最初のシェルフに移動します。この操作は元に戻せません。",
      proficiencyLabel:"習熟度",
      proficiency_none:"なし", proficiency_once:"一回のみ", proficiency_rare:"稀に",
      proficiency_sometimes:"時々", proficiency_often:"多くの場合", proficiency_mastered:"習得済み",
      viewModeTree:"階層構造", viewModeColumns:"複数列リスト",
      toggleGoal:"お気に入りに追加／解除",
      guestLoginHint:"ログインすると成功記録・成功率・お気に入り・カスタム表が使えます",
      removeFromSection:"このセクションから削除",
      authLogin:"Gmailでログイン", authLogout:"ログアウト", authLoginError:"ログインに失敗しました。もう一度お試しください",
      authSyncingLocal:"ローカルデータをクラウドに同期しています…", authSyncedLocal:"ローカルデータをクラウドに同期しました",
      authLoadError:"クラウドデータの読み込みに失敗しました", authSaveError:"クラウド保存に失敗しました。ネット接続をご確認ください",
      authLoggingOut:"ログアウトしました。ローカルデータに切り替えます",
      authEditNickname:"ニックネームを編集", authNicknamePlaceholder:"ニックネームを入力", authNicknameSave:"保存", authNicknameCancel:"キャンセル",
      authNicknameUpdated:"ニックネームを更新しました", authNicknameError:"更新に失敗しました。もう一度お試しください", authNicknameEmpty:"ニックネームを入力してください",
      publishUpdate:"総表の更新を発行", publishNoteRequired:"更新メモを入力してください", publishError:"発行に失敗しました。ネット接続をご確認ください",
      publishSuccess:"更新を発行しました", baseUpdateApplied:"総表の内容を更新しました",
      baseUpdateAvailable:"総表に更新があります", baseUpdateNow:"今すぐ更新", baseUpdateDismiss:"後で",
      searchToggle:"検索", backHome:"ホームへ", settings:"設定", settingsClose:"閉じる",
      settingsAdminSoon:"管理者パネル（近日公開）", comingSoon:"近日公開",
      themeSystem:"システムに合わせる", themeDark:"ダーク", themeLight:"ライト",
      settingsNotices:"お知らせと最近の更新",
      settingsSubmit:"技の投稿／協力者の申請", settingsSubmitNote:"大量に投稿したい場合は協力者に申請できます",
      settingsReport:"問題を報告"
    },
    en:{
      appTitle:"Kendama Trick Database", searchPlaceholder:"Search trick names (ZH / JP / EN)…",
      editMode:"Edit Mode",
      home:"Home", addCategory:"Add List", addTrick:"Add Trick", editCategory:"Edit List",
      categoryNameZh:"Chinese Name", categoryNameJp:"Japanese Name", categoryNameEn:"English Name",
      parentCategory:"Parent List", rootLevel:"— None (Root) —", save:"Save", cancel:"Cancel", delete:"Delete",
      confirmDeleteCategoryTitle:"Delete this list?", confirmDeleteCategoryBody:"This list and all its sub-lists will be deleted. Linked tricks only lose this tag (tricks themselves are kept).",
      confirmDeleteTrickTitle:"Delete this trick?", confirmDeleteTrickBody:"This trick will be permanently removed from the database and from every list it belongs to.",
      confirm:"Confirm", noSubItems:"Nothing here yet", clickAddBelow:"Use the button below to add a list or trick",
      searchResultsFound:"results for ", searchNone:"No matching tricks. Try a different keyword.",
      watchVideo:"Watch Video", noVideo:"No video link set", openOriginal:"Open Original Link",
      belongsTo:"Lists", categoryNameRequired:"Please enter a Chinese name",
      categoryDepthLimitReached:"Lists can be nested up to 5 levels deep — pick a shallower parent", maxDepthSuffix:"(max depth reached)",
      selectCategories:"Lists",
      savedCategory:"List saved", savedTrick:"Trick saved",
      deletedCategory:"List deleted", deletedTrick:"Trick deleted", newCategory:"New List", newTrick:"New Trick",
      emptyTitle:"Select a list on the left", emptyBody:"Click through lists to drill down, or tap “🔍 Search” above to find a trick.",
      backToList:"Back", editModeSub:"Turn on to add, edit, or delete lists and tricks", instagramNote:"Instagram links can't be embedded directly",
      variant:"item", tricksCount:"tricks", subCats:"sub-lists",
      moveUp:"Move Up", moveDown:"Move Down", iconColorLabel:"Icon & Color", chooseIconColor:"Choose Icon & Color",
      colorLabel:"Color", iconLabel:"Icon", noIconOption:"No Icon", doneBtn:"Done", customEmojiPlaceholder:"Paste an emoji, or up to 3 characters",
      extTricks:"Variants", addVariant:"Add Variant", belongsToPicker:"Lists / Tricks",
      addCategoryShort:"List", addTrickShort:"Trick", addVariantShort:"Variant",
      egPrefix:"e.g. ", videoLinkLabel:"Video Link (YouTube / Vimeo / Instagram)",
      categoryEgZh:"皿系", categoryEgJp:"皿系（さらけい）",
      addMedia:"Add Video", editMedia:"Edit Video", addVideoShort:"Add Video",
      mediaTypeVideo:"Video", mediaTypeNote:"Note",
      mediaNameLabel:"Name", mediaNamePlaceholder:"e.g. Front angle demo",
      mediaUrlLabel:"Video Link (YouTube / Instagram / Facebook / TikTok…)",
      mediaContentPlaceholder:"Write your note…",
      mediaUrlRequired:"Please enter a video link", mediaUrlInvalid:"Link must start with http:// or https://",
      confirmDeleteMediaTitle:"Delete this item?", confirmDeleteMediaBody:"This video or note will be permanently removed from this trick.",
      embedNotSupportedNote:"This platform's link can't be embedded directly",
      newSpace:"New Shelf", editSpace:"Edit Shelf",
      confirmDeleteSpaceTitle:"Delete this shelf?", confirmDeleteSpaceBody:"Lists in this shelf will move to the first shelf automatically. This cannot be undone.",
      proficiencyLabel:"Proficiency",
      proficiency_none:"None", proficiency_once:"Only once", proficiency_rare:"Rarely",
      proficiency_sometimes:"Sometimes", proficiency_often:"Generally", proficiency_mastered:"Always",
      viewModeTree:"Tree", viewModeColumns:"Grid List",
      toggleGoal:"Add / remove from Favorites",
      guestLoginHint:"Sign in to record landings and rates, and to use Favorites and custom tables",
      removeFromSection:"Remove from Section",
      authLogin:"Sign in with Gmail", authLogout:"Sign out", authLoginError:"Sign-in failed, please try again",
      authSyncingLocal:"Syncing local data to the cloud…", authSyncedLocal:"Local data synced to the cloud",
      authLoadError:"Failed to load cloud data", authSaveError:"Cloud save failed — check your connection",
      authLoggingOut:"Signed out — switched back to local data",
      authEditNickname:"Edit nickname", authNicknamePlaceholder:"Enter a nickname", authNicknameSave:"Save", authNicknameCancel:"Cancel",
      authNicknameUpdated:"Nickname updated", authNicknameError:"Failed to update nickname, please try again", authNicknameEmpty:"Nickname can't be empty",
      publishUpdate:"Publish index update", publishNoteRequired:"Please enter a changelog note", publishError:"Publish failed — check your connection",
      publishSuccess:"Update published", baseUpdateApplied:"Index content updated",
      baseUpdateAvailable:"Index update available", baseUpdateNow:"Update now", baseUpdateDismiss:"Later",
      searchToggle:"Search", backHome:"Home", settings:"Settings", settingsClose:"Close",
      settingsAdminSoon:"Admin panel (coming soon)", comingSoon:"Coming soon",
      themeSystem:"Follow system", themeDark:"Dark", themeLight:"Light",
      settingsNotices:"Notices & recent updates",
      settingsSubmit:"Submit tricks / Apply as helper", settingsSubmitNote:"To submit many tricks, apply to become a helper",
      settingsReport:"Report a problem"
    }
  };

  // Built-in text of a key in one language (ignores admin label overrides).
  function defaultText(key, lang){
    return (UI[lang] && UI[lang][key]) || UI.zh[key] || key;
  }
  // Admin-edited names of grips / parts (db.labels, js/01-data-storage.js). db may not exist yet at load.
  function labelOverride(key, lang){
    if(typeof db === "undefined" || !db || !db.labels) return "";
    var e = db.labels[key];
    return (e && typeof e[lang] === "string" && e[lang]) || "";
  }
  function t(key){
    var lang = state.lang;
    var c = typeof key === "string" ? key.charCodeAt(0) : 0; // g(rip) / p(art) only: keep the hot path cheap
    if(c === 103 || c === 112){
      if(key.indexOf("grip_") === 0 || key.indexOf("gripS_") === 0 || key.indexOf("part_") === 0){
        var o = labelOverride(key, lang);
        if(o) return o;
      }
    }
    return defaultText(key, lang);
  }

  // Feature files register their own strings at load time instead of all
  // editing the UI table above: addStrings({ zh:{k:"…"}, jp:{…}, en:{…} }).
  // Later registrations win on key clashes.
  function addStrings(table){
    ["zh","jp","en"].forEach(function(lang){
      if(table && table[lang]) Object.assign(UI[lang], table[lang]);
    });
  }
