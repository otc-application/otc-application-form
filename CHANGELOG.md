# Changelog

本檔案記錄本專案所有重要變更。

格式參考 [Keep a Changelog](https://keepachangelog.com/zh-TW/1.1.0/)，
版本號遵循 [Semantic Versioning](https://semver.org/lang/zh-TW/)（X.Y.Z）。

## [Unreleased]

## [0.5.0] - 2026-09-27

### Added

- **報名成功彈窗（SweetAlert2）**：送出成功時跳出，內容與成功畫面同源 ——
  報名成功標題、感謝詞、**報名資料逐欄明細**、收費截止提示。底部兩個按鈕：
  「匯出報名資料（PDF）」與「完成」。設 `reverseButtons`，讓確認鈕（匯出 PDF）
  排在左側、取消鈕（完成）排在右側 —— 與 SweetAlert2 預設的左右相反。
- 彈窗可按「匯出報名資料（PDF）」或空白處關閉；**只有按匯出鈕才跳列印**，
  關閉彈窗不會誤觸發列印視窗。
- `PrintableSummary`：專供列印／存檔的區塊，含報名成功訊息、報名資料
  表格、收費提示與主辦單位聯絡方式。平常不顯示，僅在 `@media print`
  生效，因此不會干擾畫面。

### Fixed

- **修正收費截止提示的「截止截止報名日期」重複詞**。原本把
  `pricing[].deadline` 寫成整句（「10 月 18 日前報名」與
  「截止報名日期 10 月 25 日」），再接在「…截止 {deadline}」後面組句子，
  線上實際顯示的是 `一般收費截止 截止報名日期 10 月 25 日`。現在
  `deadline` 只放**純日期**，句子改由 `event.js` 的 `paymentNotice`
  統一組出，並在三處（成功畫面、彈窗、確認信）共用同一句。
  描述區的收費卡片副標改為「截止 {deadline}」，同樣只出現一次「截止」。
- 列印樣式原本會把整頁輸出成空白：列印規則是
  `body > *:not(#print-area) { display: none }`，而 `PrintableSummary`
  當時掛在 App 的 root 底下，root 被藏掉時列印區也跟著消失。現在改用
  `createPortal` 把列印區掛到 `document.body` 直屬層，並加註說明原因，
  避免日後有人把它「整理」回 App 裡。

### Changed

- `web/src/lib/summary.js`：抽出 `buildSummaryRows()`，讓成功畫面、彈窗、
  列印區三個地方的「報名資料」資料來源單一化。兒童區以多行呈現
  （原本 `SuccessScreen` 內嵌一份，彈窗與列印區會各自漂移）。
- 引入 `sweetalert2`（唯一新增的 runtime 依賴）。
- 確認信內容改為與畫面「報名成功」一致：加上成功圖示、報名資料逐欄明細、
  收費截止提示，並改用 `【活動名】報名成功` 為主旨。
- 確認信改為 CID 內嵌成功圖示（base64 PNG）。不用外部圖片網址，因為郵件
  客戶端預設會擋掉遠端圖片，會顯示破圖。
- 確認信同時提供 `htmlBody` 與純文字 `body`（降級備援）。
- `gas/Code.gs`：寄信明細改為走訪標題列產生（`buildEmailDetails_()`），
  schema 加欄位時確認信自動跟著多一列；略過欄位集中列在
  `EMAIL_DETAIL_EXCLUDE`。新增 `escapeHtml_()`，使用者輸入不再未經逸出就
  插進 HTML（一個 `<img src=x onerror=...>` 的姓名會變成惡意郵件）。
- 移除因改寫內文而變成死碼的 `ATTENDEE_NAME_COLUMN`、`SESSIONS_COLUMN`。
- **新增以 `clasp` 部署後端的流程**（`doc/api.md` 新章節、`AGENTS.md` 新章節、
  `gas/.clasp.json.example`）。目的：取代「手動把程式碼貼進 Apps Script
  編輯器」——那個流程容易貼漏 `appsscript.json` 的 `oauthScopes`，而漏了
  就正好是 0.4.1 寄不出確認信的原因。文件特別記錄三個坑：
  `/exec` 網址裡是**部署 ID** 不是指令碼 ID（填錯 `scriptId` 會覆寫另一個
  專案）、`clasp push` 需要 `-f` 才會覆寫 manifest、以及 `clasp push` 是
  單向覆寫會刪掉遠端多餘的檔案（所以編輯器手改的 `TEST_RECIPIENT` 會被
  蓋回 placeholder）。
- 日常部署建議用 `clasp deploy -i <部署ID>` 而非 `clasp deploy -V`：前者更新
  既有部署、`/exec` 網址不變，前端不必跟著改；後者會建立新部署、網址換掉，
  必須再改 `.env.production` 並再部署一次 Pages。

## [0.4.2] - 2026-09-27

### Fixed

- **更新 `README.md` 與 `QUICK_START.md` 的 Google 試算表連結**。兩個檔案
  指向的都是一份舊試算表，與 GAS 實際綁定的並非同一份，因此文件提供的
  報名資料連結是錯的，而且**不會有任何程式因此報錯**。已換成實際綁定的
  試算表，並以 CSV 匯出比對確認標題列 16 欄與 `buildColumns()` 的輸出
  完全一致（欄數、順序、每欄文字皆相符）。
- `AGENTS.md` 新增規則：**試算表連結是動態的，不可假設，任何時候都要先問**
  ——換試算表不會留下 repo 內的線索，文件裡的連結會靜悄悄變成過期值，
  不得從舊檔案、記憶或推測取得 ID。並附上免登入的驗證指令
  （`/export?format=csv`）與 UTF-8 解碼提醒。
- 補充 PII 風險的實測證據：試算表若設為「知道連結的任何人均可」，
  上述 CSV 匯出網址**不需登入即可下載整份報名資料**，不必有人逐格點開。
  因此權限應設為「指定 Google 帳號可編輯」。
- **補上 `script.send_mail` 授權設定，確認信才寄得出去**。0.4.1 的部署
  上線後報名可以正常寫入，但每一封確認信都失敗，執行紀錄顯示
  「你沒有呼叫 MailApp.sendEmail 的權限。必要權限：
  https://www.googleapis.com/auth/script.send_mail」。
  原因是 `gas/appsscript.json` **完全沒有宣告 `oauthScopes`**，寄信權限
  只能靠 Apps Script 推斷，且無論如何都要由專案擁有者親自同意一次。
  現在明確宣告兩個最小權限（`spreadsheets.currentonly` 與
  `script.send_mail`），讓所需權限在畫面上可見、可預期。
- `Code.gs` 新增 `testEmail()`：從編輯器手動執行一次即可完成授權並確認
  寄信正常，並在註解中寫明「授權後**必須重新部署**」。此函式不會被
  `/exec` 呼叫到（GAS 只把 GET / POST 派發給 `doGet` / `doPost`），
  因此不會變成公開的寄信入口。`TEST_RECIPIENT` 留有 placeholder 與
  自我保護：未改成自己的地址前會直接拋錯，不會寄給無效收件人。

### Changed

- `web/.env.production` 的 `VITE_GAS_API_URL` 同步換成帶有上述
  `oauthScopes` 的重新部署網址。**但僅換網址不足以寄信**：授權必須由專案
  擁有者在 Apps Script 編輯器手動執行一次 `testEmail()` 並同意權限，
  授權後還要再重新部署，Web App 才會以新的權限身分執行 `doPost`。
- `doc/api.md` 更正先前記錄錯誤的權限名稱：`MailApp` 需要的是
  `script.send_mail`，**不是** `gmail.send`。並補上授權章節，說明這個
  失敗模式為何危險 —— 寄信失敗被刻意降級成不影響報名，因此報名正常、
  畫面顯示成功、只有收不到信，沒有主動測試就會一直沒人察覺。

## [0.4.1] - 2026-09-27

### Changed

- **更新正式環境的 GAS 後端網址**：`web/.env.production` 的
  `VITE_GAS_API_URL` 換成重新部署後的 `/exec` 網址，這次部署才真正帶上
  `0.4.0` 的電郵確認信功能。`0.4.0` 當時指向的部署是修正後的可用部署，
  但不含 `sendConfirmationEmail_()`，因此報名可正常寫入、只是不會寄信。
  後端功能必須重新部署才會生效，前端網址不換就永遠收不到確認信。
- 已確認新部署的試算表為 16 欄且可正常寫入（`lastColumn: 16`），標題列
  由第一筆報名自動建立，無須手動清空。

## [0.4.0] - 2026-09-27

### Added

- **報名者可選擇是否接收電郵通知**。表單最後新增必填題「你是否需要電郵
  通知？」（`需要` / `不需要`），選「需要」時展開必填的電郵地址欄位，
  選「不需要」則不顯示地址。報名資料寫入試算表後，GAS 會用 `MailApp`
  寄一封報名確認信給報名者本人。新增 `email` 欄位型別（`Field.jsx` 的
  `INPUT_ATTRS` 對照表）與 `EMAIL_CONSENT` 常數，`SuccessScreen` 亦顯示
  勾選結果與地址供報名者核對。
- **條件式子欄位新增 `dependsOn`**。子欄位原本永遠存在於狀態樹中，改選
  其他選項後先前的輸入仍會送出；電郵地址若照這樣處理，使用者勾「需要」、
  輸入地址、再改選「不需要」，試算表就會留下一個沒人同意接收的地址。
  `dependsOn` 讓「父欄位必須是某個值才有意義」這條規則寫在欄位自己身上，
  由 `buildRow()` 負責略過，不需在 `submission.js` 硬編欄位名稱。
- `validateForm()` 會檢查被選中選項底下的條件式子欄位，並新增電郵格式
  檢查（`請填寫有效的電郵地址`）。未選中的選項其子欄位一律不檢查。

### Changed

- **寄信失敗不影響報名結果**。`sendConfirmationEmail_()` 刻意放在
  `appendRow()` 之後：資料已落表，寄信只是附加動作，失敗僅記錄於 Apps
  Script 執行紀錄並回 `ok: true`，前端只 `console.warn`。若讓寄信失敗回傳
  失敗，使用者看到錯誤很可能重填一張表單，造成重複報名。
- **試算表欄位順序改為與畫面欄位順序完全一致**。`childrenByDate` 的每個
  日期欄原本由 `buildColumns()` 的第二段迴圈附加在最後，因此新增的
  「電郵通知」「電郵地址」會被擠到兒童區欄位之前。改為在主迴圈內就地展開。
  **欄位總數由 14 欄變成 16 欄，若目標試算表已有資料就必須清空或重建標題列**，
  否則 `ensureHeader_()` 會逐欄比對發現順序不符而拒絕寫入。目前綁定的
  試算表（`表單回覆 1`）經查為空（`lastRow: 0`），因此第一筆報名會自動
  建立 16 欄標題列，無須手動清空。
- 確認信的活動資訊（活動名稱、主辦單位、查詢電話、聯絡人）寫死在
  `Code.gs` 的常數中，不從 payload 取得 —— 否則任何能打到 `/exec` 的人
  都能改寫寄給報名者的信件內容。代價是換活動時要一併修改 `Code.gs`。
- `Code.gs` 與 `doc/api.md`、`doc/schema.md` 補充寄信權限、每日額度、
  寄件人身分，以及欄名與後端常數不同步會導致**靜默不寄信**的說明。

### Fixed

- **修正線上表單無法送出報名**。`web/.env.production` 的 `VITE_GAS_API_URL`
  指向一個**未附加在任何試算表上**的部署：對該 `/exec` 網址發 GET 會回
  `{"ok":true, ... "sheet":{"error":"找不到綁定的試算表…"}}`，因此線上表單
  一旦送出就會失敗。換成實際綁定試算表的部署網址。
  這是 `0.3.7` 更新網址時留下的問題，**與本版的電郵功能無關**：症狀完全
  不會出現在本機，因為本機的 `.env.local` 有自己的覆寫值，只有線上建置
  才會讀到 `.env.production`。診斷方式見 `doc/api.md`「診斷端點」。
- 修正 `event.js` 四處沿用原始 `feed_prompt` 文案的用字問題：
  「你有多**夠**沒有」→「多**久**沒有」、「製作過程**極度**療癒感」
  →「**極具**療癒感」、「跟著導師簡單步驟」→「跟著導師**的**簡單步驟」、
  「色彩**斑爛**」→「色彩**斑斕**」。

## [0.3.7] - 2026-09-27

### Changed

- **更新正式環境的 GAS 後端網址**：`web/.env.production` 的
  `VITE_GAS_API_URL` 換成重新部署後的 `/exec` 網址。該檔是 GitHub Pages
  正式建置唯一的後端設定來源，不更新則線上表單會寫進舊的部署（甚至在舊
  部署失效時直接失敗），而本機因有 `.env.local` 覆寫看不出問題。

## [0.3.6] - 2026-09-26

### Added

- 新增根目錄 `QUICK_START.md`：重要連結的**純連結清單**，供直接複製轉傳
  （貼群組、傳給同工），不含排版說明與操作步驟。內含「維護說明」記錄
  同步維護、QR 編碼與 PII 風險三項注意事項。
- `PROMPT.md`「四、文件與交付要求」新增第 2 項 `QUICK_START.md` 交付需求：
  根目錄需提供純連結清單，任何影響連結的變更都必須同時更新 `README.md`
  與 `QUICK_START.md`，兩者內容必須一致。
- `AGENTS.md` 的對應章節改為「快速開始連結區（README + QUICK_START.md）」，
  說明兩個檔案的用途差異與「改動任何連結就必須同步兩個檔案」的硬規則。
  新增提醒：README 標題為中文 `## 快速開始`，GitHub 錨點是 `#快速開始`
  而非 `#quick-start`，改標題時須同步修正錨點。
- `README.md` 文件索引加入 `QUICK_START.md` 連結。

### Changed

- **專案遷移至新 GitHub repo** `otc-application/otc-application-form`，
  `origin` remote 已指向新 repo。`README.md`、`QUICK_START.md`、
  `AGENTS.md` 與 `doc/architecture.md` 中的網域與 repo 路徑全部更新為
  `otc-application.github.io` 與 `github.com/otc-application`，
  QR Code 的 `data=` 亦重新編碼為新網域。
- 本 repo 首次提交完整 app 原始碼：活動資料夾（`web/`、`gas/`、`feed_prompt/`、
  `doc/`）與 `.github/workflows/`（Pages 部署與自動合併）一併納入版控，
  新 repo 才具備自動部署能力。
- `README.md` 的 `## 快速開始` 精簡為純連結列表：連結改用 `[**標籤**](網址)`
  格式，移除查詢電話、報名須知、試算表權限與標題列說明、本機開發指令與
  換活動提醒。維護注意事項改置於 `AGENTS.md` 與 `QUICK_START.md`，
  符合「維持精簡，不要塞說明」原則。
- `PROMPT.md` 第 1 項「一般用家」連結清單移除上一版加入的「查詢電話」
  （該項為先前實作自行加入，非原始需求），與 README 的精簡格式對齊。
  原有「受眾分離」條文中的「致電查詢方式」維持不變。

### Verified

- `README.md` 與 `QUICK_START.md` 的三組連結與 QR `data=` 值逐一比對一致。
- 以 `jsqr` 解碼 `QUICK_START.md` 的 QR 網址，確認編入的網址帶有
  `#registration` 錨點。
- 一般用家段落移除網址後不含任何技術術語或設定步驟；6 個項目皆以 emoji 起頭。

### Deployment Notes

- 新 repo 需設定兩項才能自動部署，見 `README.md`「4. 啟用 GitHub Pages 部署」：
  secret `GIT_PUSH_TOKEN`（自動合併 `dev-001` → `dev` → `main` 所需），
  以及 Settings → Pages 的 Source 設為 GitHub Actions。

## [0.3.5] - 2026-09-26

### Fixed

- **修正 QR Code 缺少錨點**：原本 `data=` 參數使用未編碼的 `#`，
  `.../otc-application-form/#registration` 中的 `#` 被當成 URL 的 fragment 截斷，
  QR 內實際編入的網址變成 `.../otc-application-form/`，掃描後只會開到頁面頂端而
  跳不到報名表。改為百分比編碼（`:` → `%3A`、`/` → `%2F`、`#` → `%23`）。
  以 `jsqr` 實際解碼圖片確認：編碼前解碼為無錨點網址，編碼後才正確帶上
  `#registration`。此錯誤不會讓圖片顯示異常，肉眼無法察覺。

### Added

- `README.md` 新增 `## Quick Start` 連結區（位於文件開頭），依角色分三組並以
  emoji 標示每個標題與項目：
  - 👥 一般用家：報名網頁（含 `#registration` 錨點）、直接嵌入的 QR Code 圖片、
    查詢電話與報名須知。
  - 🔧 系統管理員：報名網頁、收集報名資料的 Google 試算表、試算表權限提醒、
    標題列自動建立與 14 欄的說明、查詢電話。
  - 💻 程式開發員：GitHub 專案、README 文件、架構／API／Schema 技術文件、
    本機開發指令，以及換活動時必須同步更新本節的提醒。
- QR Code 以 `api.qrserver.com` 依帶錨點的報名網址產生並嵌入圖片，
  方便列印或轉貼到群組宣傳，不再只提供文字連結。
- 「一般用家」與「系統管理員」段落加入查詢電話 24114170（劉姑娘），
  符合 `PROMPT.md`「只提供報名入口與致電查詢方式」的要求。

### Documentation

- `PROMPT.md` 新增「四、文件與交付要求」，把 `## Quick Start` 連結區列為
  **交付需求**（含三個角色分組、emoji 排版、`#registration` 錨點、
  受眾分離規則與換活動時的同步維護要求），使此實踐有權威需求來源。
- `PROMPT.md` 補上 QR Code `data=` 必須百分比編碼的規範。此為規格缺口：
  原文只要求「依報名網址產生」並要求連結帶錨點，未說明編碼需求，
  正是本次缺陷的成因。
- `AGENTS.md` 新增「README 的 Quick Start 連結區」，記錄**維護慣例**與
  踩過的坑，包含「一般用家段落不得出現設定步驟」、「QR `data=` 需百分比編碼
  並附實測結果」、「查詢電話須與 `event.js` 一致」與「試算表連結含 PII，
  真正的保護只能靠試算表權限」。

## [0.3.4] - 2026-09-26

### Fixed

- **修正線上表單無法報名**：GitHub Pages 的建置環境沒有 `VITE_GAS_API_URL`，
  導致線上表單顯示「報名功能尚未啟用」且送出鈕停用，而本機因為有 `.env.local`
  完全看不出問題。新增並提交 `web/.env.production` 作為正式建置的設定來源。
  該檔不含真正的憑證：`/exec` 網址必然會出現在公開的 bundle 中，本來就不是密碼。
- **修正缺少後端設定時的提示文案**：原提示要求使用者「複製 `.env.example` 為
  `.env.local`」，這是維護者的操作，對來報名的會眾毫無意義。改為直接告知致電
  報名（附上電話與聯絡人），技術細節改由 `main.jsx` 以 `console.warn` 輸出。
- 更新 `README.md`、`AGENTS.md` 與 `doc/architecture.md`，說明後端網址的
  兩層設定來源（`.env.production` 已提交 / `.env.local` 本機覆寫）。
- 還原 `.gitignore`：先前為了 commit `.env.local` 而註解掉的忽略規則已恢復，
  改以 `.env.production` 承載正式環境設定，不必放寬忽略規則。

### Verified

- 以「暫時移走 `.env.local`」模擬 CI 環境執行 `npm run build`，確認 bundle
  仍會內嵌 `/exec` 網址，證明 GitHub Actions 的建置能取得設定。

## [0.3.3] - 2026-09-26

### Added

- 新增活動資料夾內的 `doc/` 技術文件，共 21 張 Mermaid 圖：
  - `doc/README.md` — 文件索引，以及「一個活動一個資料夾」的結構說明。
  - `doc/architecture.md` — 高層次視圖、前端模組地圖、「一份 schema 兩個用途」的資料流、
    App 狀態機、GAS 後端結構、建置與部署流程、技術選型理由。
  - `doc/api.md` — API 契約（`POST` 寫入 / `GET` 診斷）、請求格式、
    `Content-Type` 為何必須是 `text/plain` 的完整因果、錯誤語意與安全限制。
  - `doc/schema.md` — schema 節點結構、欄位型別、條件式欄位、FormState 形狀、
    值的序列化規則、14 欄試算表對應、驗證規則與修改 schema 的注意事項。
- 文件內容對照實際程式碼驗證：`buildColumns()` 確實產出 14 欄且順序與文件表格一致，
  `validateForm()` 的訊息與文件一致。21 張 Mermaid 圖皆以 mermaid 解析器驗證可正常解析。
- 於根目錄 `README.md` 與 `AGENTS.md` 加入 `doc/` 的說明與連結。

### Known Issues

- `web/src/data/formSchema.js` 匯出的 `requiredMessage()` 目前沒有任何呼叫者，
  `validateForm()` 內以樣板字串各自產生相同文字（`請填寫「${label}」`），
  等於有兩份相同字串。已記錄於 `doc/schema.md` 的「已知問題」。

## [0.3.2] - 2026-09-26

### Fixed

- 修正 `README.md` 的 GAS 部署步驟：先前指示要貼上 `appsscript.json`，
  但該資訊清單在 Apps Script 編輯器中預設隱藏，使用者找不到。改為說明
  只需貼上 `Code.gs`，並註明資訊清單為選用項目（需於「專案設定 → 一般」
  勾選顯示），以及本專案不需要它的原因。
- 修正 `README.md`、`gas/Code.gs`、`web/.env.example` 中誤植的簡體字「谁」
  為繁體「誰」，並讓部署選項對齊 Apps Script 介面的實際標籤。

## [0.3.1] - 2026-09-26

### Fixed

- 修正 `deploy_github_pages.yml` 定位前端目錄的步驟：原本用 `xargs dirname` 處理
  `find` 結果，但活動資料夾名稱含空格與 emoji，`xargs` 會依空白把路徑切成多個參數，
  導致寫入 `$GITHUB_OUTPUT` 的內容變成多行，workflow 直接失敗
  （`Invalid format '.'`）。改用 shell 參數展開 `dir=${path%/*}`。
- `setup-node` 的 `cache-dependency-path` 改用 glob `**/package-lock.json`，
  避免把含空格的路徑展開成 glob 模式。

## [0.3.0] - 2026-09-26

### Added

- 前端 `web/`：React 19 + Vite 7 + Tailwind CSS v4，手機優先的 RWD 版面。
  頂部為活動說明區（主辦／地點／名額／收費／備註／各課程介紹），底部為動態報名表單。
- 報名表單由 `web/src/data/formSchema.js` 驅動，支援條件式欄位（「所屬類別」選項各帶不同子欄位）與兒童區逐場次填寫多位子女姓名／年齡。
- 互動回饋：送出時全屏 loading 動畫、成功後切換至報名成功確認畫面（含資料摘要、收費截止提醒與「再填一張」按鈕）；欄位級前端驗證並自動聚焦第一個錯誤欄位。
- 前端設定檔 `web/src/config.js` 與 `.env.example`：GAS Web App 網址改由 `VITE_GAS_API_URL` 注入，未設定時畫面會提示而非送出後才失敗。
- GAS 後端 `gas/Code.gs` 與 `gas/appsscript.json`：`doPost` 接收資料、無標題列時自動建立、已存在時逐欄比對順序不符即拒絕寫入；`doGet` 可用於確認部署狀態。
- `.gitignore`：忽略 `node_modules/`、`dist/` 與 `.env.local`。
- `README.md` 補上 GAS 部署、本機開發與 GitHub Pages 啟用步驟。

### Changed

- `deploy_github_pages.yml` 改為自動搜尋前端目錄（`find` + `working-directory`），並把 `cache-dependency-path` 指到實際的 `package-lock.json`。原設定假設前端在 repo 根目錄，實際上前端位於活動資料夾內的 `web/`，會導致建置失敗。

## [0.2.0] - 2026-09-26

### Added

- GitHub Pages 自動部署流程 `.github/workflows/deploy_github_pages.yml`：`main` 分支 push 時執行 `npm ci` → `npm run build` → 上傳 `dist` 並部署。

### Docs

- `AGENTS.md` 補上部署流程的前置條件與設定注意事項（lockfile、`build` 指令、Pages 來源設定、CI Node 版本）。

## [0.1.0] - 2026-09-26

### Added

- 建立專案 scaffold：需求規格 `PROMPT.md`、最小 `README.md`、`AGENTS.md` 與本變更紀錄。
- 活動內容來源資料夾 `2026-09-26 - 📄 NEW PAGE - Me Time 充充電報名表/`：
  `feed_prompt/Description.md`（活動說明）、`feed_prompt/Questions.md`（報名欄位）、`web/`（前端預定放置處）。
- 自動合併流程 `.github/workflows/auto_merge.yml`（`dev-001` → `dev` → `main`）。
