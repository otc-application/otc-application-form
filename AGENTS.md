# AGENTS.md

給在此 repo 工作的人工與 AI agent。目標是避免踩坑並快速上手。

## 專案目的

活動報名網頁：**React + Vite + Tailwind CSS** 前端 + **Google Apps Script (GAS)** 後端（寫入 Google 試算表），部署至 GitHub Pages。

- 完整需求規格在 `PROMPT.md`（權威來源）。動工前先讀它，不要憑既有程式碼猜需求。
- **語言：全站文案、文件、CHANGELOG、commit message 一律使用繁體中文**（PROMPT.md 明確要求）。程式碼識別字用英文。

## 目錄結構

```
2026-09-26 - 📄 NEW PAGE - Me Time 充充電報名表/
├── feed_prompt/          # 活動內容來源（未經程式碼讀取，供人工改寫用）
├── gas/                  # GAS 後端：Code.gs + appsscript.json
├── web/                  # React + Vite 前端（package.json 在這裡，不在根目錄）
└── doc/                  # 技術文件：architecture / api / schema（含 Mermaid 圖）
```

- 每個活動一個資料夾，命名格式 `YYYY-MM-DD - 📄 NEW PAGE - <活動名>`。
- 資料夾名含 emoji 與中文。Windows PowerShell 預設編碼會顯示成亂碼（如 `?? NEW PAGE`）：用 UTF-8 讀寫，**不要**依亂碼字串重建路徑。
- 換活動 = 複製整個資料夾並改寫 `web/src/data/` 與 `gas/`（見下）。

## 內容來源：改資料不要改元件

`feed_prompt/` 是原始文案，**不會被程式讀取**。要換內容，改這兩個檔案：

| 原始來源 | 對應程式檔 | 影響 |
| --- | --- | --- |
| `feed_prompt/Description.md` | `web/src/data/event.js` | 頂部活動說明區 |
| `feed_prompt/Questions.md` | `web/src/data/formSchema.js` | 整張表單**與**試算表欄位 |

版面元件（`web/src/components/`）是泛用渲染器，正常情況下**不需要修改**。

## 表單 schema 是單一資料來源

`web/src/data/formSchema.js` 同時決定「畫面欄位順序」與「Google 試算表欄位順序」。改欄位請改這裡，不要改元件。

- 每個欄位用 `type` 選擇渲染元件：`text` / `tel` / `radio` / `checkboxGroup` / `childrenByDate`（對應 `components/Field.jsx` 的 switch）。
- **條件式欄位**寫在選項的 `fields` 裡，會在該選項被選中時顯示（見「所屬類別」）。
- 每個欄位的 `column` 是試算表標題列文字。多個欄位可共用同一個 `column`（例如「小組名稱」同時服務新朋友與會友），`buildRow` 會去重並取第一個有值的欄位。
- **改完 schema 必須清空試算表或重建標題列**，否則 `Code.gs` 的 `ensureHeader_` 會逐欄比對發現順序不符而拒絕寫入（這是刻意設計：appendRow 位置錯配不會報錯，只會靜默寫錯欄）。
- 兒童區是 `childrenByDate`，試算表每個日期一欄，值格式為 `姓名（年齡歲），姓名（年齡歲）`。

## 快速開始連結區（README + QUICK_START.md）

`README.md` 開頭的 `## 快速開始` 與根目錄的 `QUICK_START.md` 是**對外交接的入口**，需求定義在 `PROMPT.md`「四、文件與交付要求」。兩者用途不同但**內容必須一致**：

- **`README.md` 的 `## 快速開始`**：給讀 README 的人看，含引言說明與少量排版說明。
- **`QUICK_START.md`**：根目錄的**純連結清單**，供直接複製轉傳（貼群組、傳給同工），不含操作步驟。

維護時遵守：

- **改動任何連結就必須同步兩個檔案。** 觸發條件：換活動（複製整個活動資料夾）、換 GitHub repo 或網域、換試算表、改活動名稱。兩個檔案不一致時，以 `QUICK_START.md` 為轉傳用的可信版本。改完後確認三組連結與 QR Code 都指向新活動的值。
- **依角色分三組**：👥 一般用家 / 🔧 系統管理員 / 💻 程式開發員。分組是為了讓不同使用者不必自己找連結。
- **每個標題與項目都要有 emoji**，這是刻意的排版要求，不是裝飾。
- **維持精簡，不要塞說明。** 兩個檔案都只放連結與必要的一句話。維護注意事項寫在 `AGENTS.md`（本節）與 `QUICK_START.md` 的「維護說明」，不要塞進 `## 快速開始` 本體。
- **受眾分離是硬規則**：一般用家段落**不得出現技術術語或設定步驟**。不可寫「請複製 `.env.example` 為 `.env.local`」這種只有維護者能做的事（這個錯誤實際發生過，見 `web/src/components/RegistrationForm.jsx` 的未設定提示已改為致電報名）。要給維護者看的技術細節一律 `console.warn` 或寫在文件裡。
- **報名網頁連結必須帶 `#registration` 錨點**，點擊後直接跳到表單。QR Code 的 `data=` 參數也要用同一個帶錨點的網址。
- **QR Code 的 `data=` 必須百分比編碼**（`:` → `%3A`、`/` → `%2F`、`#` → `%23`）。未編碼的 `#` 會被當成 URL fragment 截斷，QR 內編入的網址會**缺少錨點**，掃描只會開到頁面頂端。**這個錯誤不會讓圖片壞掉，所以肉眼看不出來** —— 實測過：未編碼版本解碼出來是 `https://otc-application.github.io/otc-application-form/`（無錨點），編碼後才是 `.../#registration`。修改 QR Code 後請實際解碼驗一次，不要只看圖片有沒有顯示。
- **QR Code 用 `api.qrserver.com` 產生**：README 內嵌圖片，`QUICK_START.md` 用可點的文字網址。兩者的 `data=` 必須是同一個編碼後的值。
- **試算表連結是動態的，不可假設，任何時候都要先問。** 換試算表（新建、搬移、改設定、換帳號）不會留下 repo 內的線索，`README.md` 與 `QUICK_START.md` 裡的連結會靜悄悄變成過期值。**不要從舊檔案、記憶或推測取得試算表 ID —— 一律先向使用者確認。** 實際發生過：文件裡的連結指向的是一份舊試算表，與 GAS 實際綁定的試算表早已不是同一份，錯誤不會讓任何程式報錯。
  - 取得途徑：GAS 的 `getActiveSpreadsheet().getId()`（在編輯器內執行），或直接問使用者。
  - 拿到新連結後，除了替換 `README.md` 與 `QUICK_START.md`，**務必驗證**新試算表的標題列確實是 `buildColumns()` 的輸出。可用不需要登入的方式比對：
    ```bash
    curl -sL "https://docs.google.com/spreadsheets/d/<ID>/export?format=csv&gid=0"
    ```
    確認欄數與每欄文字都與 schema 一致（注意回應是 UTF-8，Windows 上要明確以 UTF-8 解碼，否則會看到亂碼而誤判）。
- **試算表連結含報名者姓名與電話（PII）**。repo 是公開的，因此該連結等同公開可被搜尋。真正的保護只能靠試算表權限（例如指定 Google 帳號可編輯，而非「知道連結的任何人均可」），不要靠「文件沒放連結」。
  - 連結外流時 **PII 是會被自動讀走的**，不必有人逐格點開。上述 CSV 匯出網址在「知道連結的任何人均可」權限下**不需登入就能下載整份報名資料**（實測過）。因此試算表權限應設為「指定 Google 帳號」，不要設為「知道連結的任何人均可」。
- **錨點會跟著標題改變**：README 標題是中文 `## 快速開始`，因此 GitHub 錨點是 `#快速開始`，不是 `#quick-start`。改標題就要同步改 `QUICK_START.md` 內指向該錨點的連結。

## 指令

前端指令都要在 `<活動資料夾>/web/` 底下執行：

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # 產出 dist/，這是唯一的自動化驗證
npm run preview  # 預覽 dist/
```

- **本 repo 沒有測試框架**。改動後至少跑 `npm run build`；要驗證 payload 欄位順序，可臨時寫一支腳本 `import` `src/lib/submission.js` 的 `buildColumns()` / `buildRow()` 印出結果（該模組刻意用 `import.meta.env?.` 讓純 Node 可以 import）。
- 本機 Node v24、CI Node 20 — 依賴版本要挑兩者都跑得過的。
- `npm install` 會因 npm 11 的 `allow-scripts` 擋下 esbuild 的 postinstall，需 `npm approve-scripts esbuild`，否則 vite 無法啟動。

## 文案與內容的踩雷點

- **`pricing[].deadline` 只放純日期**（`10 月 18 日`），**絕對不要塞整句**。這兩句會被接在「…截止 {deadline}」後面組句子，一旦裡面自帶「前報名」或「截止報名日期」，就會組出「一般收費截止 截止報名日期 10 月 25 日」這種重複詞。這個錯誤實際上線過，畫面上的收費提示就是錯的。
- **收費提示有三個地方要顯示**（成功畫面、報名成功彈窗、確認信），所以由 `web/src/data/event.js` 的 `paymentNotice` 統一組出，不要各寫各的。
- ⚠️ **`event.js` 的 `paymentNotice` 與 `gas/Code.gs` 的 `PAYMENT_NOTICE` 是兩份獨立副本** —— Apps Script 讀不到前端的檔案。改收費日期／文案時**兩個檔案都要改**，這個不一致不會讓任何程式報錯，只是信上與畫面上的日期不同。
- 「報名資料」清單由 `web/src/lib/summary.js` 的 `buildSummaryRows()` 組出，成功畫面、彈窗、列印區三處共用。不要在某個元件裡自己從 `values` 拼一份，會漂移。

## 報名成功彈窗與 PDF 匯出

- **PDF 匯出走 `window.print()`，不要在前端用 jsPDF 生檔。** jsPDF 內建字型只含 Latin-1，**中文字會全部變成空白方塊**；要修就得內嵌 CJK 字型檔（5～10 MB base64，會把 bundle 撐大一個數量級）。瀏覽器「另存為 PDF」本來就用系統 CJK 字型排版，結果正確、代價只是多按一下。`PrintableSummary.jsx` 檔頭有說明，不要「順手」換成 jsPDF。
- ⚠️ **`PrintableSummary` 必須用 `createPortal` 掛在 `document.body` 直屬層。** 列印規則是 `body > *:not(#print-area) { display: none !important }`，而 App 的 root 是 body 的直接子層 —— root 被藏掉時，放在 root 裡的列印區會跟著消失，**結果是「按了匯出，PDF 全白」且沒有任何錯誤**。不要為了「整理結構」把它移回 App 裡。
- 列印樣式要連 **SweetAlert2 的容器一起藏**：它是動態 append 到 `body` 的，用 `body > *:not(#print-area)` 才蓋得住。直接印彈窗會印出一張被置中縮小的對話框。
- **SweetAlert2 的 `htmlContent` 不會消毒**，等於 `innerHTML`。使用者輸入（姓名、電話、電郵）必須經 `escapeHtml_()`（GAS）/`escapeHtml()`（`summary.js`）才插進去。雖然是自己填自己看，危害有限，但漏掉就是個真實的 XSS sink。
- SweetAlert2 內容裡用的 Tailwind class 必須是**完整字面值**，不能是字串拼出來的 —— Tailwind v4 是掃描原始碼字串來產生 CSS，拼出來的 class 不會被生成，結果就是彈窗沒樣式。
- `web/src/lib/summary.js` 的 `escapeHtml()` 與 `gas/Code.gs` 的 `escapeHtml_()` 是兩份實作（前後端無法共用模組），改一邊時記得看另一邊。

## GAS 部署（clasp）

- **`/exec` 網址裡的是「部署 ID」，不是「指令碼 ID」。** 兩者不同，不能互換。
  `https://script.google.com/macros/s/AKfycb…/exec` 中間那段是部署 ID；
  指令碼 ID 在編輯器「專案設定」裡，或編輯器網址
  `https://script.google.com/d/<scriptId>/edit`。**`.clasp.json` 的 `scriptId`
  要填指令碼 ID** —— 填錯會指向另一個專案，`clasp push` 會直接覆寫它。
- **`.clasp.json` 要放在 `gas/` 裡，不要放 repo 根目錄。** 活動資料夾名含
  空格與 emoji，根目錄版的 `rootDir` 得帶整條含 emoji 的路徑，是已知會出問題
  的組合。放在 `gas/` 內則 `rootDir` 可省略，換活動 = 換一份設定。
- ⚠️ **`clasp show-file-status` 的輸出必須在 push 之前讀。** 曾經它列出第三個
  檔案 `程式碼.js`（Apps Script 中文介面的預設檔名「程式碼」＝ Code，內容與
  `Code.gs` 完全相同），`clasp push` 把兩份都送上去 →
  `SyntaxError: Identifier 'SERVICE_NAME' has already been declared`，
  整個專案編譯失敗，`doGet` 與 `doPost` 一起死掉，**畫面照常顯示報名成功
  但後端什麼都沒寫入**。`deploy.ps1` 與 `gas/.claspignore` 現在都會擋下這種情況。
  若真的發生了，在**本機**刪掉重複檔再 push，不要在編輯器手動刪。
- ⚠️ **絕對不要用 `clasp deploy -V <版本> -i <部署ID>`。** `clasp deploy` 是
  `create-deployment` 的別名，帶 `-i` 去更新既有部署是未經文件支援的組合，
  **實測永久刪掉了原本的部署**（之後 `clasp redeploy` 回
  `Requested entity was not found`，`/exec` 回 404）。
  要更新既有部署請用 `clasp redeploy <部署ID>`。
- **絕對不要用 `-V` 部署到固定版本**（含 `clasp redeploy <id> -V <版本>`）。
  會把部署釘死在該版本，之後 push 的新碼永遠不會上線，且沒有任何錯誤。
  實測：部署在 `@6`、最新版本 `@10`，下 `-V 6` 就永久停在舊碼。
  `clasp redeploy <id>` **不帶 `-V`** 才是部署最新版本。
- **`clasp push` 需要 `-f`。** 沒有它，clasp 會拒絕覆寫 manifest，而
  `oauthScopes` 正是我們的關鍵設定 —— 少了 `-f` 就等於沒推上去。
- **日常部署一律執行 `gas/deploy.ps1 -Message "<說明>"`。** 它依序做前置檢查
  （`gas/` 只能有 `Code.gs` 一個程式檔、`scriptId` 相符、部署仍存在、
  `.env.production` 網址相符）→ `clasp push -f` →
  `clasp redeploy <固定部署ID> -d <說明>` → 驗證部署版本是最新、description
  確實寫上去、且 `curl` 回 `ok:true`。任何一步不符就 `exit 1`，不會繼續往下部署。
  順序是 **改後端程式碼 → 部署並驗證 → 再 commit**，不要先 commit。
- ⚠️ **`deploy.ps1` 的 `-Message` 是必填**，會成為 clasp deployment 的
  `description`，也就是 **GAS 側的 commit 訊息**：格式比照 git 的 Conventional
  Commits，但**只描述後端改動**（純前端改動不需要部署，也不需要寫在這裡）。
  Apps Script 的 HTML 編輯畫面沒有版控，`Code.gs` 也沒有 git 歷史可查，這則
  description 是日後唯一能回溯「這次部署改了什麼、為什麼」的線索。腳本會在部署
  後把 description 讀回來比對，寫不上去就 `exit 1`。
  順帶一提，Clasp 網頁版在中文介面下**完全不顯示 description**，
  只有 `clasp list-deployments` 看得到。
- ⚠️ **改 `deploy.ps1` 時：含中文必須存成 UTF-8 with BOM，且必須保留
  `[Console]::OutputEncoding = [Text.Encoding]::UTF8`。** 兩個都是
  PowerShell 5.1 的坑：
  - 沒有 BOM 時 5.1 會用 ANSI 解讀整個檔案，中文變亂碼；若落在 here-string 裡
    會直接變成**語法錯誤**（`相鄰字串沒有終止字元`），整支腳本跑不起來。
  - 沒有設 `OutputEncoding` 時，`clasp`（Node CLI）的 UTF-8 stdout 會被主控台
    碼頁解成替代字元，`ConvertFrom-Json` 隨即失敗。症狀極具欺騙性：
    **部署其實成功了，卻在驗證步驟報錯**，看起來像部署壞掉。
- **本專案的部署 ID 已固定，不再新增部署。** 見「後端網址」一節。
  `deploy.ps1` 把它寫成常數且永不自行建立部署；部署若消失，腳本會報錯停止，
  需在 Apps Script 編輯器手動重建後同步更新 `web/.env.production` 與腳本常數。
- **`deploy.ps1` 只在本機跑**，不能放進 CI：`clasp` 的 OAuth 需要瀏覽器授權，
  GitHub Actions 拿不到。Pages workflow 只負責前端。
- **`clasp push` 是單向覆寫：遠端有、本機沒有的檔案會被刪除。** 在
  Apps Script 編輯器手動改過 `Code.gs`（例如把 `TEST_RECIPIENT` 換成自己的
  電郵）之後再 push，**那個改動會被本機版本蓋掉**。後端改動一律改 repo 裡的
  `gas/Code.gs`，不要在編輯器直接改。
- **OAuth 授權綁在「專案 + 帳號」，不綁部署。** 授權過一次之後，之後的
  `clasp push` / `clasp deploy` 都不需要再授權；但改程式碼仍需重新部署才生效。
- `clasp login` 需要瀏覽器授權，**只能由專案擁有者操作**，agent 無法代勞。
- 換活動 = 複製活動資料夾，並改 `gas/.clasp.json` 的 `scriptId` 指向新的
  Apps Script 專案。**部署 ID 也會變**，要同步更新 `deploy.ps1` 的常數與
  `web/.env.production`。`.clasp.json` 已 gitignore，範本 `.clasp.json.example`
  仍進版控。

## 後端網址（VITE_GAS_API_URL）

- **本專案的 GAS 部署 ID 已固定，永遠使用這一個**：

  ```
  https://script.google.com/macros/s/AKfycbxeTyNNKooo3xmG3CsdpBhULnMiduMz8ozAdwQ1glai7XnBGGlN82DPwBDwbv-i1PmX/exec
  ```

  改後端程式碼時**不需要**動 `web/.env.production`；`deploy.ps1` 會檢查兩者
  一致，不一致就中止。`@4 - Good`（`AKfycbwLzq…`）保留為不更動的備援部署。
- 後端網址在**建置時**由 Vite 內嵌，沒有 runtime 設定。改了網址必須讓新的建置跑一次。
- 兩層來源（Vite 載入順序，後者優先）：`web/.env.production`（**已 commit**，正式建置用）→ `web/.env.local`（gitignored，本機覆寫用）。`npm run dev` 只讀 `.env` / `.env.local`，**不讀** `.env.production`。
- 漏掉 `.env.production` 的後果：CI 建置出來的 bundle 沒有網址 → 線上表單顯示「網上報名暫未開放」且送出鈕停用。症狀不會出現在本機，因為本機通常有 `.env.local`。
- `web/.env.production` 內含 GAS `/exec` 網址，**可以 commit**：該網址不是密碼，瀏覽器必須知道才能呼叫，本來就會出現在公開的 bundle 中。不可放真正的憑證或金鑰。
- ⚠️ **試算表是動態的、部署 ID 不是。** 換試算表仍要問使用者（見快速開始一節）；
  但部署 ID 已固定，不要因為換試算表就改 `web/.env.production`。

## GAS 後端踩雷點

- **前端 `Content-Type` 必須是 `text/plain;charset=utf-8`，不能是 `application/json`。** JSON 的 POST 屬於 CORS 非簡單請求，瀏覽器會先送 OPTIONS 預檢，而 GAS 只把 GET/POST 派發給 `doGet`/`doPost`（寫了 `doOptions()` 也不會被呼叫），預檢拿到 405，**報名會完全送不出去且沒有錯誤訊息**。純文字內容型態屬於簡單請求，不需要預檢，後端照樣 `JSON.parse`。
- Google 不允許從 `ContentService` 自訂 `Access-Control-Allow-Origin`，也讀不到 `Origin` 標頭 → **無法限制呼叫來源**。`/exec` 網址等同公開寫入端點，試算表不要放敏感資料。
- `Code.gs` 必須以「附加在試算表上」的方式建立，才能用 `getActiveSpreadsheet()`。部署設定：執行身分「我」、誰可以存取「任何人」，網址要拿 `/exec` 不是 `/dev`。
- `doPost` 失敗時回 **200 + `{ok:false,error}`**，不要改成非 2xx —— Google 會把非 2xx 轉成 HTML 錯誤頁，前端就讀不到錯誤訊息了。前端 `submitApplication()` 同時檢查 `response.ok` 與 `payload.ok`。
- ⚠️ **確認信不要放任何圖片。** `MailApp.sendEmail()` **不支援 `inlineImages`**
  —— 那是 Gmail API `users.messages.send` 的欄位。傳進去不會被忽略，而是直接
  拋錯：`下列引數無效：inlineImages`，**每一封信都寄不出去**。曾經用
  `inlineImages` + `<img src="cid:...">` 內嵌成功圖示，就是這樣全滅的。
  這個錯很難察覺：寄信失敗被刻意降級成不影響報名，所以報名照樣成功、畫面照樣
  跳彈窗，只有當事人的信箱裡什麼都沒有。`inlineImages` 不在這個檔案裡，連同
  base64 常數都已移除，只留下說明「為什麼不要加回來」的註解。

## GitHub Pages 部署

`.github/workflows/deploy_github_pages.yml` 在 **push 到 `main`** 時自動建置並發布（`npm ci` → `npm run build` → 上傳 `dist`）。

- **前端不在 repo 根目錄**，workflow 會用 `find` 自動搜尋 `package.json` 定位前端目錄，所以換活動資料夾不需要改 workflow。
- **定位目錄的 script 不可用 `xargs`**：活動資料夾名含空格與 emoji，`xargs` 會依空白把路徑切成多個參數，`dirname` 對每個片段各輸出一行，寫進 `$GITHUB_OUTPUT` 就變成多行 → workflow 報 `Invalid format '.'`。正確做法是 `dir=${path%/*}`。
- `setup-node` 的 `cache-dependency-path` 用 glob `'**/package-lock.json'`，不要展開成含空格的路徑。
- `package-lock.json` 務必 commit（`npm ci` 沒有 lockfile 無法執行），`.gitignore` 只擋 `node_modules/` 與 `dist/`。
- 輸出目錄必須是 `dist`（Vite 預設）；換建置工具要同步改 workflow 的 `path`。
- **repo 設定必須把 Pages Source 選「GitHub Actions」**，否則 workflow 綠燈但沒有部署。
- 目前 `find` 只取第一個找到的 `package.json`，等同**只支援一個活動資料夾**。要同時部署多個活動需改 workflow 或拆 repo。
- Agent 不會直接推 `main`，但 `main` 由 auto-merge 推進，所以**每次 auto-merge 都會觸發一次部署**。

## Git 流程

- 工作分支是 `dev-001`。**一律 commit 並 push 到 `dev-001`**，不要直接推 `dev` 或 `main`。
- `.github/workflows/auto_merge.yml` 會在 push 到 `dev-001` 後自動合併到 `dev`，再自動合併到 `main`。**不需手動合併，也不要手動推 `dev`/`main`。**
- 該 workflow 需要 repo secret `GIT_PUSH_TOKEN`（fine-grained PAT，Contents: Read and write）。`GITHUB_TOKEN` 無法觸發後續 workflow，所以必須用 PAT；缺少此 secret 則自動合併失敗。

### 每次變更都要做的三件事

1. **更新 `CHANGELOG.md`**：在 `## [Unreleased]` 下新增條目，並開新的版本標題 `## [X.Y.Z] - YYYY-MM-DD`（SemVer；新功能 bump minor、修 bug/文件 bump patch）。
2. **Commit**：格式化 subject + body。
3. **Push 到 `dev-001`**。

### Commit 訊息格式

統一採用 Conventional Commits + 繁體中文：

```
<type>(<scope>): <subject>

<body：說明「為什麼」改，而不是改了什麼；每行不超過 72 字元>

<footer：BREAKING CHANGE / 相關 issue>
```

- `type`：`feat` `fix` `docs` `style` `refactor` `chore` `build` `ci`
- `scope`：`web` `gas` `content` `docs` `ci`
- subject 使用繁體中文、祈使句、不加句號；`feat`/`fix` 的 body 需說明動機與影響範圍。
- 範例：`feat(web): 依 Questions.md 建立動態報名表單欄位` / `fix(gas): 修正表頭重複建立導致欄位錯位`
