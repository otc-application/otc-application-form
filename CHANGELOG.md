# Changelog

本檔案記錄本專案所有重要變更。

格式參考 [Keep a Changelog](https://keepachangelog.com/zh-TW/1.1.0/)，
版本號遵循 [Semantic Versioning](https://semver.org/lang/zh-TW/)（X.Y.Z）。

## [Unreleased]

## [0.9.0] - 2026-09-27

### Changed

- **落表鎖的等待時限由 10 秒縮短至 5 秒。** 這個數字是 UX 取捨，不是正確性需求：
  鎖只包覆幾百毫秒的操作，前端最多嘗試兩次，因此最壞等候是
  `2 × LOCK_TIMEOUT_MS + 1000ms` —— 沿用 10 秒時是 21 秒，使用者要盯著無法取消的
  全屏遮罩一分鐘且換不到任何好處；改為 5 秒後是最壞 11 秒。縮短可能帶來「假
  BUSY」，但 BUSY 是零寫入、可安全重試的狀態，頂多令使用者多等一次，兩邊的
  風險不對稱。
- **標題列「補上保護」的步驟由鎖內移到鎖外**（`ensureHeader_()` 的標題列吻合
  路徑改為由 `writeRow_()` 在釋放鎖之後呼叫）。保護與 `appendRow` 的目標位置
  無關，不需要序列化，而 `protectHeader_()` 會多呼叫一次 `getProtections()`，
  留在鎖內只會吃掉鎖的時間預算 —— 這正是能把時限壓到 5 秒的前提。唯一例外是
  「試算表為空、剛建立標題列」那條路徑，其寫入必須與 `appendRow` 序列化，仍
  留在鎖內。**若日後把保護移回鎖內，務必重新評估鎖的時限。**

### Added

- **重試期間顯示進度提示。** `submitApplication()` 新增選用參數
  `options.onRetry`，在即將重試前呼叫一次；`App.jsx` 以 `submitNotice` 承接並傳給
  `LoadingOverlay` 的 `notice` prop，畫面會由「正在送出報名資料…」改為
  「系統繁忙，正在重試…」。沒有它，使用者只會對著全屏遮罩等待最壞 11 秒，無法
  分辨是在運作還是卡死。
- **記錄並公開取不到落表鎖的次數。** `recordBusy_()` 把 `busyCount` 與
  `busyLastAt` 寫入 script properties，`doGet` 的診斷回應新增兄弟欄位
  `busy: { count, lastAt }`。此前 `BUSY` 只在 Apps Script 執行紀錄留一行
  `console.warn`，若演變成常見現象（例如鎖真的被懸住）不會有任何指標發現，而
  症狀很容易被誤判為網路問題。
  `PropertiesService.getScriptProperties()` 不需要 OAuth scope，
  `appsscript.json` 未更動。

### Fixed

- **BUSY 的使用者訊息不再套用「報名失敗：」前綴。** `submission.js` 新增
  `BUSY_USER_MESSAGE`。BUSY 情境下**沒有任何失敗、沒有任何資料遺失**（後端確定
  在 `appendRow` 之前中止），說「失敗」會令使用者誤以為要重填，反而提高重複報名
  的風險 —— 兒童區與電話欄重打最為麻煩。新訊息說明「內容已保留、請勿重複填寫」
  並指向查詢電話（取自 `eventInfo.contact.phone`，與頁尾同一來源）。
  判斷是否為 BUSY 仍照舊以 `code` 為主（`isBusy_()` 的 OR 條件不變）。

### Notes

- `doc/api.md` 的時序圖、落表互斥鎖段落與診斷端點範例已同步更新；`AGENTS.md`
  的 GAS 踩雷點由「三個位置」更正為「四個位置」並補上鎖時限的取捨理由。
- 尚未解決（非本次範圍）：診斷計數只有累計值，沒有分時段或平均等待時間；若
  日後需要判斷「鎖是否真的被懸住」，應改為記錄各次耗時。

## [0.8.1] - 2026-09-27

### Documentation

- **文件改用書面語，並在 `AGENTS.md` 加入明文規則。** 先前的 `0.7.2` 與 `0.8.0`
  條目、以及 `AGENTS.md` 的 GAS 踩雷點段落使用了口語（粵語），例如「報咗名」
  「喺 `finally`」「唔會」「冇」。這些文件是後續維護的唯一線索 —— Apps Script
  沒有版控，`Code.gs` 沒有 git 歷史可查，部署 description 更是日後唯一的回溯
  依據 —— 口語會令不熟悉粵語的維護者或 AI agent 難以判斷字詞是否為誤植。
- 規則同時列出禁用字與對應的書面語詞，並附上提交前的掃描指令。
  面向參加者的活動文案由活動方提供，維持原文不變，規則只約束技術寫作。

## [0.8.0] - 2026-09-27

### Fixed

- **落表加入互斥鎖，兩人同時報名不會使其中一筆靜默消失。** `doPost` 原本
  是 read-then-write（`ensureHeader_` 讀 `getLastRow()`，`appendRow` 再依位置
  寫入），Apps Script **不保證**兩次呼叫之間沒有另一個執行插入。兩個並行執行都
  讀到同一個 `lastRow` 就會寫進同一橫，其中一筆報名消失，**而回應仍是
  `ok:true`**：報名者以為已報名，名單上卻沒有其姓名。沒有任何錯誤、沒有告警，
  畫面照常顯示成功。「寧可失敗也不要靜默寫錯」的理由，同樣適用於 `appendRow`。
  - 落表整段移入 `writeRow_()`，以 `LockService.getScriptLock()` 序列化。
  - **寄信保留在鎖外。** `MailApp.sendEmail()` 可能執行數秒，若從頭鎖到尾
    （看似自然的寫法）會使所有提交排隊、`tryLock` 大量逾時，等於為防止碰撞而
    製造新故障。
  - **採用 `tryLock(10000)` 而非 `waitLock()`。** 鎖住的只有數百毫秒的操作，
    10 秒已極寬鬆；`waitLock` 會無限等待，一個卡住的執行會拖垮之後**所有**
    報名。
  - `releaseLock()` 置於 `finally`，例外路徑同樣會釋放。
  - 未新增 OAuth scope，`appsscript.json` 不變。

### Added

- **取不到鎖時回覆 `200 + {ok:false, code:"BUSY"}`，前端自動重試一次。**
  重試之所以**安全**，是因為 `BUSY` 必定發生在 `appendRow` 之前 —— 完全沒有
  寫入任何資料，因此重試不會產生重複列。這是前後端之間的隱含約定：
  `Code.gs` 的 `BUSY_CODE` 與 `submission.js` 的 `BUSY_CODE` 是兩份獨立副本，
  修改其中一邊時必須同步另一邊。
  - **網路層失敗一律不重試**（fetch 拋錯、非 2xx、非 JSON）：該情況下後端可能
    已經寫入，重試只會多出一列。重複報名比要求使用者再點一次更難收拾。
  - payload 只組裝一次並重送同一份，因此「提交時間」欄位不會因重試而改變。
  - 判斷條件刻意寫成 `code==='BUSY' || 訊息含「忙碌」` 兩者取 OR：任一邊被改
    壞時仍有另一邊把關。重試若靜默失效**不會回報錯誤**，只是使用者平白看到
    一次紅字。

- **標題列（第 1 橫）由 `ensureHeader_()` 自動保護。** 保護的對象是「人為改壞」
  而非「併發」：插入一欄、重新排序、刪除標題列或改錯欄名，都會令之後**每一次**
  報名被 `ensureHeader_` 拒絕，畫面僅顯示「標題列與表單欄位順序不一致」，需要
  人手搶修。這類結構性意外必然觸及第 1 橫，因此保護第 1 橫即已足夠。
  - **只保護第 1 橫，不保護整張工作表。** `appendRow` 不會觸及第 1 橫，資料照樣
    寫得進去，因此無須依賴「擁有者可繞過保護」這個未記載於文件的行為。
  - **保護失敗不應使報名失敗**（吞掉所有例外，僅記錄）。保護用以防止手誤，並非
    報名的前置條件。
  - 已存在的標題列也會補上保護（自我修復），因此建立於本機制之前的試算表，
    或曾被手動解除保護的情況，都會在下次報名時補回。
  - ⚠️ 「選取全部 → 清除內容」**不會**移除第 1 橫的保護，因此變更 schema 後
    重建標題列會遇到「你無法編輯這個範圍」。`unprotectHeader_()` 故會在寫入前
    先解除任何涵蓋第 1 橫的保護（範圍型與整張工作表型皆包含在內），寫完再補上。
  - **切勿在介面設定「編輯前先要求我核准」**：該設定會使 GAS 的寫入變成待批准
    變更，等於資料根本沒有入表。

## [0.7.2] - 2026-09-27

### Added

- **「活動資訊 → 主辦單位」的名稱連到教會官方網站。** 資訊格第一行就是主辦
  名稱，參加者要查堂會消息時不必再自行搜尋。連結指向教會網站的消息頁
  （`cmaotc.org/news.html`），比首頁更貼近「有哪些新消息」的需求。
  - URL 放在 `web/src/data/event.js` 的 `eventInfo.organizerUrl`，**不硬編碼
    進 JSX**，換活動時只改 `data/`。留空則該行退回純文字。
  - 網址**不進 `gas/Code.gs`**：確認信維持主辦名稱純文字，所以這個網址在
    repo 內只有一份，沒有副本漂移的問題，也因此本次**不需要部署 GAS**。

### Changed

- **`DescriptionSection.jsx` 抽出 `ExternalLink` 共用元件。** 「主辦單位」與
  「地點」兩個外部連結原本會各自重複同一組 `target` / `rel` / className /
  `sr-only` 提示。漏寫 `rel="noopener noreferrer"` 屬於靜默的安全退化，沒有
  任何編譯或測試會提示，因此集中到單一出口。`查詢電話`（`tel:`）刻意不
  參與 —— 撥電話不該開新分頁。
  - ⚠️ `ExternalLink` **必須用 function 宣告**：`infoItems` 是模組層級
    `const`，在 import 階段就求值並呼叫該元件；若寫成 `const` 箭嘴會撞 TDZ
    → 整頁白屏，而且 **Vite build 照樣通過**，只有執行時才爆。已在元件上方
    註解標明。

## [0.7.1] - 2026-09-27

### Added

- **「活動資訊 → 地點」的地址連到 OpenStreetMap 地圖。** 參加者最常見的
  疑問就是「點去」，而舊版只有文字地址，要自己複製去地圖 App 搜尋。
  地址在活動說明區的資訊卡中間偏上位置，是找路徑的入口。
  - URL 放在 `web/src/data/event.js` 的 `eventInfo.mapUrl`，**不硬編碼進
    JSX**：換活動時複製資料夾只改 `data/`，版面元件不用動。
  - 樣式沿用同一個 `infoItems` 裡既有的查詢電話連結，因此兩者視覺一致。
  - `target="_blank"` 配 `rel="noopener noreferrer"`，並在連結內加
    `sr-only` 的「（在地圖中開啟）」—— 讀屏軟件與鍵盤用戶才知道會開新分頁。
  - `mapUrl` 留空時該行退回純文字。若無這個判斷，`href={undefined}` 會
    render 成有底線、但撳不到也非 focusable 的假連結。
  - 選 OpenStreetMap 而非 Google Maps：不經任何轉址服務，網址可直接
    分享給參加者。`feed_prompt/Description.md` 保持純地址，所以這個網址
    在 repo 內**只有一份**，沒有副本漂移的問題。

## [0.7.0] - 2026-09-27

### Added

- **名額安排加入「報 4 堂或以上優先考慮」，並寫進報名確認信。**
  原本優先安排只寫在網頁的「名額」卡、「備註」與拉筋班「特點」三處，
  收信者看不到確認信就無從得知，會誤以為報名成功即坐實名額。`Code.gs`
  新增 `QUOTA_NOTICE`，在純文字與 HTML 兩種確認信內文各加一段「名額安排」，
  與既有的收費提示（`PAYMENT_NOTICE`）同一個位置與樣式。
  兩類優先（新朋友、報 4 堂或以上）**並列**而非排先後，措辭用「優先考慮」
  而非「優先」：實際排序由人手按提交先後處理，沒有任何程式會依它排序或
  拒收報名，硬性字眼會變成收信者眼中的承諾。
  純文字與 HTML 兩邊都要涵蓋同一組提示，改文案時兩個 builder 都要改。

### Fixed

- **`gas/deploy.ps1` 的部署版本驗證改成輪詢，修掉成功部署被誤判為失敗。**
  `clasp redeploy` 已回報成功、`clasp list-versions` 也出現新版本之後，
  `clasp list-deployments` 仍會有一小段時間回報**舊的** `versionNumber` 與
  **舊的** `description`（API 傳播延遲）。實測過：redeploy 回報 `@14`、
  versions 有 `@14`，緊接著查詢仍拿到 `@13` 與上一次部署的 description，
  腳本因此誤報 `New code is not live` 並 `exit 1` —— 部署其實完全成功。
  症狀與「部署壞掉」一模一樣，容易讓人白做一次重建。現在改為 90 秒時限內
  每 5 秒重查，等 `versionNumber` 追上**且** `description` 相符才回 OK，
  超時才當失敗（真的沒寫上 description 時仍會報錯）。

### Changed

- **`doc/api.md` 修正確認信內容的過時描述。** 該節仍宣稱確認信含
  `SUCCESS_ICON_BASE64` CID 內嵌成功圖示，但 0.6.0 已連同 base64 常數
  移除（`MailApp.sendEmail` 不支援 `inlineImages`，用了會令每封信寄不出去）。
  改為記錄「確認信不含任何圖片」這個約束與原因，避免日後有人加回來。
- **`doc/api.md` 與 `AGENTS.md` 記錄名額安排的副本關係。** 名額那句話與收費
  提示一樣是跨前後端的**多份副本**（前端三處 + `Code.gs` 一處），只能人工
  同步，不一致不會讓任何程式報錯。

### Removed

- **移除 `doc/` 內 3 個報名成功畫面示意檔（`(Email).png`、`(Popup).png`、
  `(PDF).pdf`，合共約 300 KB）。** 這是二進位檔，GitHub 只能顯示不能 diff，
  改了版面也不會有人看出差異，等於每次都在 repo 裡存一份很快過期的副本。
  實際畫面用 `npm run dev` 看、實際匯出用瀏覽器的「另存為 PDF」重做即可。
  `doc/README.md` 從來沒有列過這三個檔，刪除不會留下失效連結。

## [0.6.0] - 2026-09-27

### Added

- **`gas/deploy.ps1` 新增必填的 `-Message`，作為 GAS 側的 commit 訊息。**
  會透過 `clasp redeploy -d` 寫成該次 deployment 的 `description`，格式比照
  git 的 Conventional Commits，但只描述**後端**改動（純前端改動不需要部署）。
  Apps Script 的 HTML 編輯畫面沒有版控，`Code.gs` 也沒有 git 歷史可查，這則
  description 是日後唯一能回溯「這次部署改了什麼、為什麼」的線索，所以腳本
  會在部署後把 description 讀回來比對，寫不上去就 `exit 1`。
  順帶一提，Clasp 網頁版在中文介面下完全不顯示 description，只有
  `clasp list-deployments` 看得到。

### Fixed

- **⚠️ 修正確認信完全寄不出去（後端）。** 移除 `MailApp.sendEmail()` 的
  `inlineImages` 參數與 `htmlBody` 裡的 `<img src="cid:...">`，並刪掉 2.5 KB
  的 base64 圖示常數。`inlineImages` **不是 `MailApp` 的參數** —— 那是 Gmail API
  `users.messages.send` 的欄位，傳入不會被忽略而是直接拋錯
  （`下列引數無效：inlineImages`），導致**每一封確認信都寄不出去**。
  症狀極具欺騙性：寄信失敗被刻意降級成不影響報名，所以報名照樣成功、畫面照樣
  跳彈窗，只有當事人的信箱裡什麼都沒有。`Code.gs` 原處留下說明「為什麼不要加
  回來」的註解。
- **`deploy.ps1` 的部署版本驗證不再可能假通過。** 改以
  `clasp list-deployments --json` 讀 `versionNumber`，不再解析表格輸出裡的
  `@N`。舊寫法在抓不到數字時會直接回 OK，等於把「無法驗證」當成「驗證通過」——
  那正是本專案出事時的形狀。現在讀不到版本號會明確報錯。
- **修掉兩個會讓 `deploy.ps1` 誤判的 PowerShell 5.1 坑**：
  - 含中文的 `.ps1` 必須存成 **UTF-8 with BOM**。沒有 BOM 時 5.1 用 ANSI 解讀
    整個檔案，中文的位元組被解成亂碼；落在 here-string 裡會直接變成語法錯誤
    （`相鄰字串沒有終止字元`），整支腳本跑不起來。
  - 必須設 `[Console]::OutputEncoding = [Text.Encoding]::UTF8`。`clasp` 是
    Node CLI，stdout 一律 UTF-8，5.1 預設用主控台碼頁（Big5）解讀它，中文變成
    替代字元，`ConvertFrom-Json` 隨即因字串損壞而失敗。症狀極具欺騙性：
    **部署其實成功了，卻在驗證步驟報錯**，看起來像部署壞掉。
- **移除報名成功彈窗的「完成」鈕。** 彈窗現在只能由右上角的關閉鈕關閉：
  `showCancelButton: false` 並擋掉點背景（`allowOutsideClick: false`）與
  按 Esc（`allowEscapeKey: false`）。報名資料是使用者剛填完的，誤觸關掉等同
  資料從畫面消失、只能重新填一次。
- **按「匯出報名資料（PDF）」不再關閉彈窗。** 改用 `preConfirm` 回傳 `false`
  攔下關閉（SweetAlert2 v11 在沒有 `input` 時仍會走 `preConfirm` 分支，回傳
  `false` 就是不關閉）。列印視窗是同步阻塞的，使用者取消列印回到原頁時還要能
  看到報名資料。
- `匯出報名資料（PDF）` 按鈕加上 `p-2`。

### Changed

- 日常部署改為執行 `gas/deploy.ps1 -Message "<說明>"`（`-Message` 必填）。
  `deploy.ps1` 與 `doc/api.md` 同步更新，並記錄 `-Message`、`-d` 與兩個
  PowerShell 5.1 坑的原因。

## [0.5.0] - 2026-09-27

### Added

- **`gas/deploy.ps1`：一鍵部署後端。** 依序做前置檢查（`gas/` 只能有
  `Code.gs` 一個程式檔、`.clasp.json` 的 `scriptId` 相符、部署仍存在於
  `clasp list-deployments`、`web/.env.production` 網址與部署相符）→
  `clasp push -f` → `clasp redeploy <固定部署ID>` → 驗證部署版本是最新且
  `curl` 回 `ok:true`、`sheet.name` 非空、`lastColumn` 等於 `buildColumns()`
  的欄數。任何一步不符即 `exit 1`，不會繼續往下部署。
- **本專案的 GAS 部署 ID 固定**，不再建立新部署：
  `AKfycbxeTyNNKooo3xmG3CsdpBhULnMiduMz8ozAdwQ1glai7XnBGGlN82DPwBDwbv-i1PmX`。
  `deploy.ps1` 把它寫成常數且永不自行建立部署；`@4 - Good`
  （`AKfycbwLzq…`）保留為不更動的備援部署。
- `gas/.claspignore`：以白名單鎖定只推送 `Code.gs` 與 `appsscript.json`。
- `.clasp.json` 加入 `.gitignore`（`.clasp.json.example` 仍進版控）。
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
- **修復後端離線：報名全部寫不進試算表。** `clasp push` 把兩個內容完全相同
  的檔案一起送上去 —— `Code.gs` 與 Apps Script 中文介面自動產生的
  `程式碼.js`（預設檔名「程式碼」＝ Code）。兩者都在頂端宣告
  `const SERVICE_NAME`，整個專案編譯失敗：
  `SyntaxError: Identifier 'SERVICE_NAME' has already been declared`。
  `doGet` 與 `doPost` 一起死掉，**前端照常顯示報名成功，但後端什麼都沒寫入**
  —— 這是最糟的失敗型態：使用者以為報名成功，資料其實不存在。
  修法為在本機刪掉重複檔再 `clasp push -f`（讓本機與遠端一致），
  不在 Apps Script 編輯器手動刪檔。預防措施見 `deploy.ps1` 與
  `gas/.claspignore`。

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
- 日常部署改為執行 `gas/deploy.ps1`，**不再**直接呼叫 `clasp deploy`。
  特別記錄兩個會整個弄壞線上部署的坑：
  - **`clasp deploy -V <版本> -i <部署ID>` 會永久刪掉該部署。**
    `clasp deploy` 是 `create-deployment` 的別名，帶 `-i` 去更新既有部署是
    未經文件支援的組合。實測之後 `clasp redeploy` 回
    `Requested entity was not found`、`/exec` 回 404、該 ID 從
    `clasp list-deployments` 消失。要更新既有部署只能用
    `clasp redeploy <部署ID>`。
  - **`-V` 會把部署釘死在該版本**，之後 push 的新碼永遠不會上線且沒有錯誤。
    實測：部署在 `@6`、最新版本 `@10`，下 `-V 6` 就永久停在舊碼。
    `redeploy` **不帶 `-V`** 才是部署最新版本。
- **`clasp show-file-status` 的輸出必須在 push 之前讀。** 本次事故中它事前
  就列出了第三個檔案 `程式碼.js`，事後才看已經來不及。

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
