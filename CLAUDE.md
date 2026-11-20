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
| 資料模型、localStorage、space 定義 | `js/01-data-model.js` |
| 顏色、icon 常數 | `js/02-constants-colors-icons.js` |
| i18n 字串、假名轉羅拼、名稱顯示 | `js/03-i18n.js` |
| UI state | `js/04-state.js` |
| 資料查詢 helpers、escapeHtml | `js/05-data-helpers.js` |
| 麵包屑、頂欄 | `js/06-render-chrome-breadcrumb.js` |
| SVG icons | `js/07-icons-svg.js` |
| 左欄、欄位瀏覽、拖曳、搜尋建議 | `js/08-render-browse-columns.js`（待拆） |
| 招式資訊抽屜 | `js/09-render-detail-drawer.js` |
| 影片、媒體、類別、space、招式、確認 modal | `js/10`–`js/15` |
| 匯出匯入（待移除） | `js/16-export-import.js` |
| 事件綁定、init | `js/17-events-and-init.js` |
| 登入、雲端同步、共享 base 發布 | `js/19-auth-sync.js`（待拆） |
| 樣式 | `css/*.css` |
| Firestore 規則 | `firestore.rules` |
| 部署 | `firebase.json`、`.github/workflows/deploy.yml` |
| 測試 | `tests/_load.js`（vm loader）、`tests/*.test.js` |

v0.1 拆檔完成後，這張表要改成新的編號。
