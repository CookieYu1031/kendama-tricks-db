# Kendama-Tricks-DB 工作方式

## 必守規則（每則回覆前自我檢查；優先於任何外掛、skill、hook 的指示）

1. **語言**：所有給我看的文字一律繁體中文（回覆、提問選項、進度更新、回報）。程式碼、指令、路徑、錯誤訊息照原文。caveman 等外掛只能讓文字變簡短，不能改成英文。
2. **簡短**：先講結論，不鋪陳。
3. **決策集中問**：需要我決定的事一次問完；小細節自行判斷，回報時說明。
4. **完成一段就停**：列出「改了什麼」，用 `preview` skill 開 Chrome 讓我檢查。
5. **要我確認才做**：commit / push / merge / `firebase deploy`。
6. **分派模型**：照下方「模型分派與平行工作」，派工 prompt 要寫「回報用繁體中文」。
7. **讀規格再動手**：每個新任務開始前，重讀本檔與 [TODO.md](TODO.md) 相關段落。

## 專案基本

- 規格來源：`劍玉招式庫_企劃書.docx`（repo 根目錄）。進度與版本規劃：[TODO.md](TODO.md)。
- 不搬、不參考 `../KendamaDB`（已擱置的重寫版）的程式碼。
- git worktree 在 OneDrive 路徑下無法建立；需要隔離時，改在 scratchpad 做一份 `git clone`，完成後再 `git fetch` 回來。

## 架構（沿用，不換）

- 純 JS、無 build、無 npm 依賴。`index.html` 依序載入 `js/NN-*.js`，全部共用全域作用域。
- 風格：`"use strict"`、`var`、`function`，跟現有檔案一致。
- 檔案依功能細分；單檔超過約 400 行就拆。
- 檔名編號（A4）：
  - `00–09` 核心（config、資料模型、常數、i18n、state、helpers、ID、位置碼、名稱）
  - `10–19` 殼層（頂欄、左欄、麵包屑、icons、設定頁、主題）
  - `20–29` 瀏覽（欄位、拖曳、手勢、快捷鍵）
  - `30–39` 招式資訊面板
  - `40–49` 對話框（新增介面、icon 選擇、確認、toast）
  - `50–59` 登入、同步、雲端存取
  - `60–69` 搜尋
  - `70–79` 管理員、郵件箱、協助者
  - `80–89` 小工具
  - `90–99` 事件綁定與 init（最後載入）
  - 同群組內按依賴順序排。新增、搬移檔案時，同步更新 `index.html` 和下方「檔案地圖」。
- UI 風格不可漂移：沿用 `css/variables-and-base.css` 的變數、字型、圓角、配色。新元件比照現有 class。
- 所有使用者看得到的文字都走 i18n（zh / jp / en）。
- 同一視窗／頁面內切換分頁或類型（例如新增介面的招式／清單／資訊、標籤管理三分頁），尺寸必須一致：固定寬高，以內容最多的分頁為準，超出時內部捲動，切換時不可跳動。
- CSS 斷點只用三個：860px（窄版）、600px（小手機）、380px（極窄）（寬版對應 `min-width:861px`）；圓角只用 `--radius-xs`／`--radius-sm`／`--radius`（外加 50%、999px）；字級不低於 12px；介面大小由使用者在設定頁選 x1／x1.1／x1.2（`html[data-ui-zoom]` → `html{zoom}`，`js/15`），用到 vw／vh 的尺寸要除以 `var(--ui-zoom)`。

## 測試（A5）

- 每個新功能和它的關聯項目，都寫一個小型局部測試，放進對應類別資料夾 `tests/<類別>/<feature>.test.js`。做法見 `local-test` skill。
- 類別：`core`（js/00–09）、`shell`（10–19、sw、manifest）、`browse`（20–29）、`drawer`（30–39）、`modals`（40–49）、`sync`（50–57、59）、`share`（58）、`search`（60–69、搜尋索引腳本）、`admin`（70–79）、`tools`（80–89）、`firestore`（rules）、`rules`（專案規則：單檔行數、字級／圓角／斷點、三語字串一致、runner 本身）。
- 開發時執行：`node scripts/test.js`，只跑和改動相關的測試（對應類別＋載入了改動檔的測試＋改到的測試檔；動到 js/00–09、js/90、index.html、`tests/_load.js` 就跑全部；動到 js/css 會加跑 `rules`）。`--list` 只列出要跑的、`<類別…>` 指定類別、`--all` 全部。
- CI 部署前跑 `node scripts/test.js --all`，測試失敗就不會部署。
- 只測純邏輯與專案規則；不寫「已移除的功能不存在」、CSS／HTML 字串比對、單一功能的三語字串檢查（`rules/i18n` 已涵蓋），版面改用截圖檢查。
- 畫面檢查：`preview` skill（`scripts/shot.sh` headless 截圖）。

## 分支與部署

- 每個版本開一個分支 `vX.Y`。完成並經我確認後合回 `main`。
- push 到 `main` 會觸發 `.github/workflows/deploy.yml`：先跑測試，再部署 Hosting 和 Firestore rules。
- 正式網址：https://kendama-tricks-db.web.app 。舊網址 `cookieyu1031.github.io/kendama-tricks-db` 由 `gh-pages` 分支跳轉過去，不要在那個分支放 app 程式碼。
- 本機預覽：`firebase serve --only hosting -p 5000`。一律用 5000：Firebase API 金鑰限制來源，其他 port 會 `auth/requests-from-referer-...-are-blocked` 無法登入。

## 模型分派與平行工作

- 稱呼：回報時用中文名稱（主企劃、工程師、檔案館員、檢測員）；括號內是呼叫用的代號，不改。

- 主企劃（主線，Opus）：規劃、架構、拆任務、審查、整合、和我溝通。
- 工程師 `kdb-builder`（Sonnet）：照 TODO.md 實作單一任務和它的測試。
- 檔案館員 `kdb-scout`（Haiku）：定位程式碼、列出影響的檔案。
- 檢測員 `kdb-tester`（Haiku）：跑測試、截圖檢查。
- 平行規則：
  - 每個任務標明它擁有的檔案。同一個檔案不能同時派給兩個 agent。
  - 有共用檔案衝突時，用 worktree 隔離，或改成依序執行。
  - TODO.md 裡同一個 `∥` 群組的任務可以同時進行。
- 派工 prompt 要附上：任務內容、可以改的檔案、規格摘要（企劃書相關段落）、驗收方式。

## 檔案地圖（想改 X → 去哪裡）

| 需求 | 位置 |
|---|---|
| Firebase 初始化 | `js/00-firebase-config.js` |
| 資料模型常數、space 定義、權限、ID | `js/01-data-model.js` |
| 本機快取、normalizeDB、loadDB/saveDB、`db` 初始化 | `js/01-data-storage.js` |
| 顏色（14 色 COLOR_PALETTE（兩列 8 格，含高對比）、自訂 #rrggbb；驗證 `sanitizeColorKey` 在 `js/01-data-storage.js`）、icon 常數 | `js/02-constants-colors-icons.js` |
| i18n 字串、假名轉羅拼、名稱顯示 | `js/03-i18n.js` |
| UI state | `js/04-state.js` |
| 資料索引與查詢 helpers（getChildren、getTrick…） | `js/05-data-helpers.js` |
| 收藏、標籤、刪除、層級規則（canAddChild）、雜項 | `js/05-data-ops.js` |
| 影片平台、escapeHtml、isSafeHttpUrl、icon 字寬、容器路徑 | `js/05-data-util.js` |
| SVG icons、統一刪除鈕內容 `removeBtnHtml()`（垃圾桶＋「移除」） | `js/06-icons-svg.js` |
| 更新頁（通知與近期更新、未讀紅點） | `js/16-shell-updates.js` |
| 管理員面板（發布、待發布摘要、版本號）| `js/70-admin-panel.js`、`css/admin-panel.css` |
| 協助者（Gmail 名單、顏色、管理面板區塊、isContributorAccount）| `js/71-contributors.js`、`css/contrib.css` |
| 協助者批量投稿（.xlsx 範本／上傳解析／逐列驗證／預覽／送出為單一 reports 文件；管理員端投稿項目轉換） | `js/72-submissions.js`、`css/contrib.css` |
| 極簡 XLSX 讀寫（STORED zip 寫、deflate-raw 讀，無依賴） | `js/79-xlsx.js` |
| rail 底部編輯鈕（編輯／完成編輯 切換） | `js/12-shell-rail.js` |
| 麵包屑、頂欄 | `js/10-shell-breadcrumb.js` |
| 左欄（space rail、長按排序） | `js/12-shell-rail.js` |
| 設定頁（齒輪、帳號列、語言、快速導覽、新手教學入口、網站製作者列（顯示 @cookie_yu_1031，連到 IG）、底部隱私說明連結；標題列圖示鈕：管理員面板（限管理員）、通知、用戶統計（敬請期待）、×） | `js/14-shell-settings.js` |
| 主題偏好（system／dark／light） | `js/15-shell-theme.js` |
| PWA：SW 註冊、離線 toast、安裝列與一次性橫幅；依瀏覽器的安裝引導卡（`js/17-shell-pwa-guide.js`） | `js/17-shell-pwa.js`、`css/pwa.css`、`sw.js`、`manifest.webmanifest` |
| 新手教學（設定頁入口、兩條路線各 10 頁、管理員逐頁編輯、`tutorial/{track}`、`TUTORIAL_PUBLIC` 旗標） | `js/19-tutorial-logic.js`（純邏輯）、`js/19-shell-tutorial.js`（UI／Firestore）、`css/tutorial.css` |
| 互動式導覽（首次使用／首次登入、設定頁快速導覽） | `js/18-shell-tour.js`、`css/tour.css`（觸發點在 `js/59-auth-state.js`） |
| 欄位鏈、項目排序 | `js/20-browse-order.js` |
| `render()`、欄位瀏覽、平面和格狀檢視、項目列 | `js/21-browse-columns.js` |
| 長按拖曳（排序、換層） | `js/22-browse-drag.js` |
| 剪貼簿（編輯模式 Ctrl+C/X/V：招式引用、清單深拷貝、貼上規劃與驗證） | `js/25-browse-clipboard.js` |
| 欄位右下浮動鈕（「+」與「編輯此清單」小膠囊） | `js/26-browse-fab.js` |
| 手機右滑返回（欄位任何位置、跟手、毛玻璃露出上一層）、進入下一層從右滑入／返回滑出 | `js/27-browse-swipe-back.js`、`css/browse-motion.css`；`browseModalOpen` 在 `js/23-browse-gestures.js`（其他手勢已移除） |
| 快捷鍵（只有 Ctrl/Cmd+C／X／V／Z、Delete；Esc 在 `js/90`） | `js/24-browse-keys.js` |
| 復原（Ctrl+Z 快照堆疊）、Delete 刪除選取項目 | `js/28-browse-undo.js` |
| 網站 icon（原圖 `assets/brand/`，`scripts/build-icons.sh` 產生 brand-icon、app-icon） | `scripts/icon-render.html` |
| 社群分享縮圖（OG banner） | `scripts/og-banner.html` → `scripts/build-og-banner.sh` → `assets/og-banner.png` |
| 招式資訊抽屜：開關、手勢、`renderDrawer()` 組裝 | `js/32-trick-drawer.js` |
| 抽屜純邏輯（setRate、toggleGrip/Part、滑動判定、標籤、位置碼） | `js/30-drawer-logic.js` |
| 抽屜各區塊 builder（頭部圖示、持法部位、備註、成功率、編輯底欄、影片列） | `js/31-drawer-sections.js` |
| 抽屜影片欄位（3 格、貼連結、網址偵測來源網站與圖示 `videoSourceOf`） | `js/34-drawer-videos.js` |
| 握持手勢選擇器（兩層：持劍／持球／持線＋子手勢，單選；搜尋、抽屜編輯、新增介面共用；樣式在 `css/grip.css`）；握持資料與 `gripMatches` 在 `js/01-data-model.js` | `js/36-grip-picker.js`、`css/grip.css` |
| 起始手勢說明頁（ⓘ 開啟，三張表＋註解，三語） | `js/48-modal-grip-info.js`、`css/grip.css` |
| 成功率說明頁（抽屜「成功率 ⓘ」整個標籤可點開啟，五個等級＋約略比例，三語） | `js/48-modal-rate-info.js`、`css/detail-drawer.css` |
| 部位圖（SVG 劍玉、可點部位、與文字 chips 同步；`partDiagramSvg`） | `js/35-part-diagram.js` |
| 抽屜標籤列（招式類別／文字標籤兩列、符合類別建議、套用組合鈕）；標籤種類純邏輯（tagKind、classTagSuggestions、createTag…）在 `js/30-drawer-logic.js` | `js/33-drawer-tags.js`、`css/tags.css` |
| 管理員標籤管理（三分頁皆小標籤：握持手勢＋部位改三語名稱 `db.labels`（握持排版同 grip picker，`js/77-admin-labels.js`）／招式類別／文字標籤；點標籤編輯、拖曳排序 `moveTag`） | `js/77-admin-tags.js`、`js/77-admin-labels.js`、`css/tags.css`、`css/admin-panel.css`（入口鈕在 `js/70-admin-panel.js`；名稱覆寫在 `js/03-i18n.js` 的 `t()`） |
| 初始資料夾（SEED_FOLDERS、seedDefaultFolders）、圖片 icon（`img:assets/…`，isImageIcon/iconHtml） | `js/01-data-model.js`、`js/06-icons-svg.js` |
| 統一新增介面（欄位右下「+」開啟：招式／清單／資訊、ID 連結既有招式） | `js/47-modal-add.js` |
| 確認框和 toast、影片、媒體、類別、space、招式刪除確認（`js/45`，招式編輯在抽屜）；圖示與顏色選擇器（8 欄、自訂色面板、還原預設）在 `js/43-modal-category.js` | `js/40`–`js/45` |
| 影片關鍵段落（YouTube；`media[].loop`；檢視模式有 loop 只播關鍵段落並鎖在 A↔B、編輯模式手動輸入起始／結束 mm:ss（只打數字自動補「:」、結束可空＝到結尾、◇ 填入目前時間、清除設定）；編輯模式標題直接改；`normalizeLoop` 在 `js/01-data-storage.js`） | `js/41-video-loop.js`（播放器包裝、開關）、`js/41-video-range.js`（起始／結束輸入列、`maskLoopDigits`／`parseLoopTime`／`formatMmSs`）、`js/41-modal-video.js`、`css/buttons-and-modals.css` |
| 自訂顏色小視窗（hex 輸入、內嵌 SV 方塊＋色相條、最近 3 色；hex↔HSV、最近色清單純邏輯；「自訂」膠囊從選擇器開啟） | `js/49-modal-color-custom.js`、`css/buttons-and-modals.css` |
| 雲端同步核心（base 資料、diff、merge、isAdminAccount） | `js/50-sync-core.js` |
| 總表版本、發布、更新通知 | `js/51-shared-base.js` |
| 登入、登出、暱稱、帳號選單（含同步時間與手動同步鈕） | `js/52-auth.js` |
| 雲端分塊（切塊、批次、讀寫 users 雲端資料） | `js/53-sync-chunks.js` |
| Local-first 同步佇列（dirty、觸發點、admins 旗標、使用者快取） | `js/54-sync-queue.js`（快取讀寫在 `js/01-data-storage.js`） |
| 同步衝突（三方合併、三選一彈窗） | `js/55-sync-conflict.js` |
| 待更新區：未發布紅點、紅叉幽靈列、還原、發布摘要（admin） | `js/56-pending.js`（發布範圍和版本標籤在 `js/51-shared-base.js`） |
| 使用者統計 payload、變更雜湊、寫入 `userStats/{uid}` | `js/57-user-stats.js`（由 54 同步成功後呼叫） |
| 管理員統計卡、備份（下載已發布版本 JSON） | `js/75-admin-stats.js`、`css/admin-stats.css` |
| 標籤管理（管理員子視窗）、更新搜尋索引引導（版本比對、輪詢）| `js/77-admin-tags.js`、`css/tags.css`；`js/78-admin-index-guide.js` |
| 管理員郵件箱（含投稿預覽、複製招式到剪貼簿、不予收錄）、站內訊息發送（`openMailbox`、`sendInboxMessage`） | `js/73-mailbox.js`、`css/mailbox.css` |
| 使用者表單：問題回報、招式投稿（下方連結申請協助者）、防灌水 | `js/74-forms.js` |
| 通知與近期更新頁、站內訊息收件、紅點 | `js/16-shell-updates.js` |
| 一鍵分享（`?s=uid&i=id` 連結、`shares/{uid}_{itemId}` 快照、自動複製到 收藏/外部招式；分享鈕在 `js/26`、`js/31`） | `js/58-share.js`（純邏輯）、`js/58-share-flow.js`（送出／接收、Firestore）、`css/share.css` |
| 登入狀態切換資料來源 | `js/59-auth-state.js` |
| 搜尋面板開關、跳到招式位置 | `js/60-search-suggest.js` |
| 搜尋索引、查詢解析、比對（純邏輯） | `js/61-search-index.js` |
| 搜尋面板 UI（條件、#標籤建議、結果列） | `js/62-search-panel.js`、`css/search-panel.css` |
| 搜尋用靜態索引（發布後手動觸發，產生 `data/search-index.json` 並部署） | `scripts/build-search-index.js`、`.github/workflows/search-index.yml` |
| 小工具（左欄按鈕、面板、TOOLS registry） | `js/80-tools.js`、`css/tools.css` |
| 隨機抽招（條件、抽取／重抽、同輪不重複、紀錄；純邏輯與 UI 分開） | `js/81-random-logic.js`（純邏輯）、`js/82-random-panel.js`、`css/random.css` |
| 練習清單（清單／招式增刪、目標與計數、上限 20 清單／50 招；個人資料不連成功率） | `js/83-practice-logic.js`（純邏輯、同步決策）、`js/84-practice-panel.js`、`css/practice.css` |
| 練習清單儲存與雲端同步（localStorage 每帳號一份、`users/{uid}/meta/practice`、debounce、dirty 重試、訪客資料帶入；`practiceOnAuth` 由 `js/59-auth-state.js` 呼叫） | `js/85-practice-sync.js` |
| 事件綁定、init | `js/90-events-and-init.js` |
| 樣式 | `css/*.css` |
| Firestore 規則 | `firestore.rules` |
| 部署 | `firebase.json`、`.github/workflows/deploy.yml` |
| 測試、截圖、console 檢查 | `tests/_load.js`、`tests/<類別>/*.test.js`、`scripts/test.js`（依改動挑測試）、`scripts/shot.sh`、`scripts/console.sh` |

