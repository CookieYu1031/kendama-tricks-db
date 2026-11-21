# Kendama-Tricks-DB 工作方式

- 回覆用繁體中文，簡短。
- 規格來源：`劍玉招式庫_企劃書.docx`（repo 根目錄）。進度與版本規劃：[TODO.md](TODO.md)。
- 不搬、不參考 `../KendamaDB`（已擱置的重寫版）的程式碼。
- 需要我決策的事：集中一次問，不要邊做邊零散詢問。小細節自行判斷並在回報時說明。
- 完成一段：停下，列出「改了什麼」，用 `preview` skill 開 Chrome 讓我檢查。
- commit / push / merge / `firebase deploy` 都要我確認後才做。

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
- CSS 斷點只用三個：860px（窄版）、600px（小手機）、380px（極窄）（寬版對應 `min-width:861px`）；圓角只用 `--radius-xs`／`--radius-sm`／`--radius`（外加 50%、999px）；字級不低於 12px；介面大小由使用者在設定頁選 x1／x1.1／x1.2（`html[data-ui-zoom]` → `html{zoom}`，`js/15`），用到 vw／vh 的尺寸要除以 `var(--ui-zoom)`。

## 測試（A5）

- 每個新功能和它的關聯項目，都寫一個小型局部測試 `tests/<feature>.test.js`。做法見 `local-test` skill。
- 執行：`node --test "tests/*.test.js"`。CI 部署前會跑，測試失敗就不會部署。
- 畫面檢查：`preview` skill（`scripts/shot.sh` headless 截圖）。

## 分支與部署

- 每個版本開一個分支 `vX.Y`。完成並經我確認後合回 `main`。
- push 到 `main` 會觸發 `.github/workflows/deploy.yml`：先跑測試，再部署 Hosting 和 Firestore rules。
- 正式網址：https://kendama-tricks-db.web.app 。舊網址 `cookieyu1031.github.io/kendama-tricks-db` 由 `gh-pages` 分支跳轉過去，不要在那個分支放 app 程式碼。
- 本機預覽：`firebase serve --only hosting -p 5000`。

## 模型分派與平行工作

- 主線（Opus）：規劃、架構、拆任務、審查、整合、和我溝通。
- `kdb-builder`（Sonnet）：照 TODO.md 實作單一任務和它的測試。
- `kdb-scout`（Haiku）：定位程式碼、列出影響的檔案。
- `kdb-tester`（Haiku）：跑測試、截圖檢查。
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
| 顏色、icon 常數 | `js/02-constants-colors-icons.js` |
| i18n 字串、假名轉羅拼、名稱顯示 | `js/03-i18n.js` |
| UI state | `js/04-state.js` |
| 資料索引與查詢 helpers（getChildren、getTrick…） | `js/05-data-helpers.js` |
| 收藏、標籤、刪除、層級規則（canAddChild）、雜項 | `js/05-data-ops.js` |
| 影片平台、escapeHtml、isSafeHttpUrl、icon 字寬、容器路徑 | `js/05-data-util.js` |
| SVG icons | `js/06-icons-svg.js` |
| 更新頁（通知與近期更新、未讀紅點） | `js/16-shell-updates.js` |
| 管理員面板（發布、待發布摘要、版本號）| `js/70-admin-panel.js`、`css/admin-panel.css` |
| 協助者（Gmail 名單、顏色、管理面板區塊、isContributorAccount）| `js/71-contributors.js`、`css/contrib.css` |
| 協助者批量投稿（.xlsx 範本／上傳解析／逐列驗證／預覽／送出為單一 reports 文件；管理員端投稿項目轉換） | `js/72-submissions.js`、`css/contrib.css` |
| 極簡 XLSX 讀寫（STORED zip 寫、deflate-raw 讀，無依賴） | `js/79-xlsx.js` |
| rail 底部編輯鈕（編輯／完成編輯 切換） | `js/12-shell-rail.js` |
| 麵包屑、頂欄 | `js/10-shell-breadcrumb.js` |
| 左欄（space rail、長按排序） | `js/12-shell-rail.js` |
| 設定頁（齒輪、帳號列、語言、快速導覽、新手教學入口、隱私說明連結在署名右側、管理員面板入口） | `js/14-shell-settings.js` |
| 主題偏好（system／dark／light） | `js/15-shell-theme.js` |
| PWA：SW 註冊、離線 toast、安裝列與一次性橫幅 | `js/17-shell-pwa.js`、`css/pwa.css`、`sw.js`、`manifest.webmanifest` |
| 新手教學（設定頁入口、兩條路線各 10 頁、管理員逐頁編輯、`tutorial/{track}`、`TUTORIAL_PUBLIC` 旗標） | `js/19-tutorial-logic.js`（純邏輯）、`js/19-shell-tutorial.js`（UI／Firestore）、`css/tutorial.css` |
| 互動式導覽（首次使用／首次登入、設定頁快速導覽） | `js/18-shell-tour.js`、`css/tour.css`（觸發點在 `js/59-auth-state.js`） |
| 欄位鏈、項目排序 | `js/20-browse-order.js` |
| `render()`、欄位瀏覽、平面和格狀檢視、項目列 | `js/21-browse-columns.js` |
| 長按拖曳（排序、換層） | `js/22-browse-drag.js` |
| 剪貼簿（編輯模式 Ctrl+C/X/V：招式引用、資料夾深拷貝、貼上規劃與驗證） | `js/25-browse-clipboard.js` |
| 欄位右下浮動鈕（「+」與「編輯此資料夾」小膠囊） | `js/26-browse-fab.js` |
| 窄版右滑返回（把手線、跟手滑動、箭頭提示）| `js/27-browse-swipe-back.js`；`browseGoUp`、`browseModalOpen` 在 `js/23-browse-gestures.js`（其他手勢已移除） |
| 快捷鍵（只有 Ctrl/Cmd+C／X／V／Z、Delete；Esc 在 `js/90`） | `js/24-browse-keys.js` |
| 復原（Ctrl+Z 快照堆疊）、Delete 刪除選取項目 | `js/28-browse-undo.js` |
| 網站 icon（原圖 `assets/brand/`，`scripts/build-icons.sh` 產生 brand-icon、app-icon） | `scripts/icon-render.html` |
| 社群分享縮圖（OG banner） | `scripts/og-banner.html` → `scripts/build-og-banner.sh` → `assets/og-banner.png` |
| 招式資訊抽屜：開關、手勢、`renderDrawer()` 組裝 | `js/32-trick-drawer.js` |
| 抽屜純邏輯（setRate、toggleGrip/Part、滑動判定、標籤、位置碼） | `js/30-drawer-logic.js` |
| 抽屜各區塊 builder（頭部圖示、持法部位、備註、成功率、編輯底欄、影片列） | `js/31-drawer-sections.js` |
| 抽屜影片欄位（3 格、貼連結、網址偵測來源網站與圖示 `videoSourceOf`） | `js/34-drawer-videos.js` |
| 部位圖（SVG 劍玉、可點部位、與文字 chips 同步；`partDiagramSvg`） | `js/35-part-diagram.js` |
| 抽屜標籤列（招式類別／文字標籤兩列、符合類別建議、套用組合鈕）；標籤種類純邏輯（tagKind、classTagSuggestions、createTag…）在 `js/30-drawer-logic.js` | `js/33-drawer-tags.js`、`css/tags.css` |
| 管理員標籤管理（握持＋部位唯讀／招式類別／文字標籤，admin 子視窗） | `js/77-admin-tags.js`、`css/tags.css`（入口鈕在 `js/70-admin-panel.js`） |
| 初始資料夾（SEED_FOLDERS、seedDefaultFolders）、圖片 icon（`img:assets/…`，isImageIcon/iconHtml） | `js/01-data-model.js`、`js/06-icons-svg.js` |
| 統一新增介面（欄位右下「+」開啟：招式／資料夾／資訊、ID 連結既有招式） | `js/47-modal-add.js` |
| 確認框和 toast、影片、媒體、類別、space、招式刪除確認（`js/45`，招式編輯在抽屜） | `js/40`–`js/45` |
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
| 測試、截圖、console 檢查 | `tests/_load.js`、`tests/*.test.js`、`scripts/shot.sh`、`scripts/console.sh` |

