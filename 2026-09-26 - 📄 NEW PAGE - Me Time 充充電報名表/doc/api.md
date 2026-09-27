# API

後端是**一個** Google Apps Script Web App，只提供兩個端點。沒有 REST 風格的路徑，兩者都是同一個 `/exec` 網址、以 HTTP method 區分。

| Method | 用途 | 呼叫者 |
| --- | --- | --- |
| `POST` | 寫入一列報名資料 | 報名表單（正式流程） |
| `GET` | 診斷，回報試算表綁定與筆數 | 人工（開瀏覽器確認部署成功） |

## 請求格式

`POST` 的 body **是 JSON 內容，但不是 `application/json`**。這是本專案最容易踩雷的地方。

```mermaid
flowchart LR
    A["Content-Type: text/plain，charset=utf-8"] --> B["瀏覽器判定為<br/>CORS 簡單請求"]
    B --> C["不送 OPTIONS 預檢<br/>直接送出 POST"]
    C --> D["GAS 收到 POST<br/>派發到 doPost"]
    D --> E["parseBody_ 仍能 JSON.parse"]
```

| 項目 | 值 |
| --- | --- |
| URL | GAS Web App 的 `/exec` 網址（由 `VITE_GAS_API_URL` 注入） |
| Method | `POST` |
| `Content-Type` | `text/plain;charset=utf-8` ← **不可改成 `application/json`** |
| Body | JSON 字串，見下 |

```json
{
  "headers": ["參加者姓名", "聯絡電話", "所屬類別", "…"],
  "row":     ["陳小明", "91234567", "本堂會友", "…"]
}
```

- `headers` 是試算表的標題列，`row` 是資料列，**兩者長度必須相同**。
- 兩者的元素一律是字串（前端已把陣列與物件序列化完畢，見 [schema.md](./schema.md#值的序列化規則)）。
- `headers` 每次都完整送出，因此後端不需要在前端與後端各維護一份欄位定義。

## 為什麼 Content-Type 必須是 text/plain

這是 Google Apps Script 的**硬性限制**，不是 Coding Style 選擇。

```mermaid
flowchart TB
    START["開發者送出 POST"] --> Q{"Content-Type？"}

    Q -->|"application/json"| J1["瀏覽器：非簡單請求<br/>必須先送 OPTIONS 預檢"]
    J1 --> J2["GAS 收到 OPTIONS"]
    J2 --> J3["GAS 只把 GET / POST 派發給<br/>doGet / doPost<br/>（寫了 doOptions 也不會被呼叫）"]
    J3 --> J4["回應 405 Method Not Allowed"]
    J4 --> J5["瀏覽器丟出 CORS 錯誤<br/>POST 根本沒有送出"]
    J5 --> J6["報名完全失敗<br/>且畫面上可能沒有明確錯誤"]

    Q -->|"text/plain"| T1["瀏覽器：簡單請求<br/>略過預檢"]
    T1 --> T2["POST 直接送達 doPost"]
    T2 --> T3["✅ 成功"]
```

結論：**body 內容是 JSON，但宣告的 MIME 類型是純文字。** 後端 `JSON.parse` 一樣解析得動。

## 成功路徑

```mermaid
sequenceDiagram
    autonumber
    actor U as 使用者
    participant F as 瀏覽器<br/>App.jsx + submission.js
    participant G as GAS doPost
    participant S as Google 試算表
    participant M as MailApp

    U->>F: 按「送出報名資料」
    F->>F: validateForm(values)<br/>欄位級驗證
    alt 驗證失敗
        F-->>U: 標紅欄位、聚焦第一個錯誤欄位<br/>（不發請求）
    else 驗證通過
        F->>F: status = submitting<br/>渲染 LoadingOverlay
        F->>F: buildColumns() / buildRow()
        F->>G: POST /exec<br/>Content-Type: text/plain
        G->>G: parseBody_(e) → JSON.parse
        G->>G: requireStringArray_() × 2<br/>檢查長度一致
        G->>S: getActiveSpreadsheet()
        G->>S: ensureHeader_()
        alt 試算表為空
            S-->>G: 寫入標題列<br/>headerCreated = true
        else 標題列已存在
            G->>S: 逐欄比對
            alt 順序一致
                S-->>G: 通過
            else 順序不一致
                G-->>F: 200 { ok:false, error:"…第 N 欄…" }
            end
        end
        G->>S: appendRow(row)
        S-->>G: 寫入成功
        Note over G,M: 資料已落表，寄信是附加動作
        G->>G: sendConfirmationEmail_(headers, row)
        alt 電郵通知欄 = 需要 且有地址
            G->>M: MailApp.sendEmail()
            alt 寄信成功
                M-->>G: 已寄出
                G->>G: email = { status:"sent", to }
            else MailApp 擲出例外
                G->>G: email = { status:"failed", error }<br/>console.error 記錄
            end
        else 未勾選 / 沒地址 / 欄位不存在
            G->>G: email = { status:"skipped", reason }
        end
        G-->>F: 200 { ok:true, headerCreated, row, email }
        F->>F: status = success<br/>values 存入 submitted
        F-->>U: 捲動至頂、渲染 SuccessScreen
    end
```

成功回應：

```json
{
  "ok": true,
  "service": "otc-application-form",
  "headerCreated": false,
  "row": 12,
  "email": { "status": "sent", "to": "chan@example.com" }
}
```

| 欄位 | 意義 |
| --- | --- |
| `ok` | 前端唯一判斷成功與否的依據 |
| `service` | 服務名稱，用於確認打到正確的部署 |
| `headerCreated` | 本次是否建立了標題列（`true` 表示這是第一筆報名） |
| `row` | 寫入後的資料列數，可用於人工抽查 |
| `email.status` | `sent` 已寄出 / `skipped` 未寄（附 `reason`）/ `failed` 失敗（附 `error`） |

## 電郵確認信

`emailNotify`（電郵通知）勾「需要」且 `email` 有值時，`sendConfirmationEmail_()` 會用 `MailApp` 寄一封報名確認信給報名者本人。

內文與畫面上的「報名成功」一致，包含：成功圖示、報名成功訊息、**報名資料
逐欄明細**、收費截止提示、查詢電話。

- 明細由 `buildEmailDetails_()` **走訪標題列**產生，不是逐一 hardcode 欄位，
  所以 `formSchema.js` 加欄位時確認信會自動跟著多一列。要略過的欄位寫在
  `EMAIL_DETAIL_EXCLUDE`：目前是 `提交時間`（與收信當下重複）、`電郵通知`
  與 `電郵地址`（收件人就是那個地址，寫在信上只會多一份副本）。
- 成功圖示是 **CID 內嵌**的 base64 PNG（`SUCCESS_ICON_BASE64`）。不要改成
  外部圖片網址 —— 郵件客戶端預設擋遠端圖片，會變成破圖。GAS 沒有檔案系統，
  所以圖片只能放在 `Code.gs` 裡。
- 同時提供 `body`（純文字）與 `htmlBody`（HTML）。多數客戶端顯示 `htmlBody`，
  純文字是給不支援 HTML 的客戶端降級用。
- 所有使用者輸入都經過 `escapeHtml_()` 才插進 HTML。姓名欄若不逸出，
  一個叫 `<img src=x onerror=...>` 的姓名就會變成寄給自己的惡意郵件。
- 收費提示是 `Code.gs` 裡的 `PAYMENT_NOTICE`，**與
  `web/src/data/event.js` 的 `paymentNotice` 是兩份獨立副本**（Apps Script
  讀不到前端檔案）。改收費日期時兩個都要改。

```mermaid
flowchart TD
    A["sendConfirmationEmail_(headers, row)"] --> B{"電郵通知欄 = 需要？"}
    B -->|"否"| S1["skipped: not-requested"]
    B -->|"是"| C{"headers 含「電郵地址」欄？"}
    C -->|"否"| S2["skipped: missing-column<br/>⚠️ 欄名不同步"]
    C -->|"是"| D{"地址非空？"}
    D -->|"否"| S3["skipped: no-address"]
    D -->|"是"| E["MailApp.sendEmail()"]
    E -->|"成功"| OK1["sent"]
    E -->|"例外"| F1["failed（呼叫端捕捉）"]
```

設計上的三個決定：

1. **寄信在 `appendRow` 之後。** 報名資料絕不能因為寄信問題而遺失，所以順序是「先落表、再寄信」，寄信失敗仍回 `ok: true`。
2. **寄信失敗不通知前端使用者。** `submitApplication()` 只 `console.warn`，畫面照常顯示報名成功。理由是使用者看到「失敗」很可能會重填一張表單，造成重複報名。實際收信情況要看 Apps Script 執行紀錄。
3. **信件內容寫死在後端。** `EVENT_TITLE` / `ORGANIZER_NAME` / `CONTACT_PHONE` / `CONTACT_PERSON` 是 `Code.gs` 內的常數，不從 payload 取得 —— 否則任何能打到 `/exec` 的人都能改寫寄給報名者的信件內容。

需要留意的限制：

- 寄件人就是這個 Apps Script 專案的執行身分（教堂的 Google 帳號），**無法自訂寄件網域**，報名者會看到該帳號地址。
- 每日寄信額度：一般 Gmail 帳號 100 封、Gmail Workspace 1,500 封。以本活動規模綽綽有餘。
- 欄名不同步是**靜默失敗**：`ensureHeader_()` 不會報錯（標題列本來就一致），只會導致 `skipped: missing-column`。改欄名時務必同步 `Code.gs` 的常數。

### 授權（最常見的失敗原因）

`MailApp.sendEmail()` 需要 `script.send_mail` 權限，**必須由專案擁有者親自同意一次**，無法用程式碼繞過。未授權時的症狀：

```
你沒有呼叫「MailApp.sendEmail」的權限。必要權限：
https://www.googleapis.com/auth/script.send_mail
```

```mermaid
flowchart TD
    A["doPost 寫入試算表成功"] --> B["sendConfirmationEmail_()"]
    B --> C{"MailApp.sendEmail()"}
    C -->|"未授權"| D["status: failed<br/>報名仍回 ok:true"]
    D --> D1["前端 console.warn<br/>報名者看到成功畫面"]
    D1 --> D2["❌ 報名者收不到信<br/>且沒有任何人察覺"]
    C -->|"已授權"| E["status: sent ✅"]
```

**這個失敗模式特別危險**，因為寄信失敗被刻意降級成不影響報名（見上方第 2 點），所以報名完全正常、畫面顯示成功，只有收不到信。務必主動測試一次。

授權步驟（`Code.gs` 的 `testEmail()` 註解有完整版）：

1. 把 `Code.gs` 的 `TEST_RECIPIENT` 改成自己的電郵地址並儲存。
2. 編輯器「執行」→ 選 `testEmail` →「執行」。
3. 權限視窗 → 選擇自己的帳號 →「允許」。若出現「Google 尚未驗證此應用程式」→ 進階 →「前往（不安全）」。**這是 Google 對所有自訂腳本的標準警告，不是異常。**
4. 執行紀錄出現「測試信已寄出：…」即授權成功。
5. **重新部署**（部署 → 管理部署 → 編輯 → 版本：新增版本 → 部署）。只授權不重新部署，Web App 仍會以舊的權限身分執行 `doPost`。

`testEmail()` **不會**被 `/exec` 呼叫到：GAS 部署為網頁應用程式時只會把 GET / POST 派發給 `doGet` / `doPost`，所以它不會變成公開的寄信入口。

### 宣告的權限

`gas/appsscript.json` 的 `oauthScopes` 明確宣告兩個最小權限：

| Scope | 用途 |
| --- | --- |
| `https://www.googleapis.com/auth/spreadsheets.currentonly` | 讀寫**本專案附加的**試算表（容器綁定腳本的最窄範圍） |
| `https://www.googleapis.com/auth/script.send_mail` | `MailApp.sendEmail()` 寄信 |

- 必須**全部列出**：一旦宣告 `oauthScopes`，Apps Script 就停止自動推斷，漏寫的權限會在執行時才報錯。
- 刻意**不用** `gmail.send`（可寄信但同時涵蓋草稿、標籤等更廣範圍），也**不用** `GmailApp`（它需要 `gmail.send`）。`MailApp` + `script.send_mail` 是最小權限組合。

## 失敗語意

`Code.gs` **永遠回傳 HTTP 200**，失敗以 body 的 `ok: false` 表示。

```mermaid
flowchart LR
    E["後端發生錯誤"] --> E1["回 200 + {ok:false,error}"]
    E2["若回非 2xx"] --> E3["Google 轉成 HTML 錯誤頁"]
    E3 --> E4["前端 response.json() 解析失敗<br/>拿不到錯誤訊息"]
```

這是刻意的：Google 會把非 2xx 轉成 HTML 錯誤頁，前端就讀不到具體原因。使用者只會看到「傳送失敗」而無從排查。

常見 `error` 訊息：

| `error` 內容 | 原因 | 處理方式 |
| --- | --- | --- |
| `請求內容為空，請確認前端已正確送出表單資料。` | body 缺漏 | 檢查前端是否真的呼叫 |
| `請求內容不是合法的 JSON。` | body 不是合法 JSON | 檢查是否被中間層改寫 |
| `headers 不可為空` | 送出空標題列 | `formSchema` 的 `column` 被清空 |
| `欄位數量與資料列不符（headers N 欄，row M 欄）` | 前後端不一致 | 通常代表 `buildColumns` 與 `buildRow` 被改動其一 |
| `找不到綁定的試算表，請確認本專案已附加在目標試算表上。` | 不是以容器 bound 建立 | 重新用「擴充功能 → Apps Script」建立 |
| `試算表標題列與表單欄位順序不一致：第 N 欄應為「X」但目前是「Y」` | 改過 schema 但沒重建標題列 | 清空試算表或修正標題列 |

前端 `submitApplication()` 的四層防護：

```mermaid
flowchart TB
    S["fetch(...)"] --> C1{"fetch 本身拋錯？<br/>（網路／CORS）"}
    C1 -->|"是"| M1["SUBMIT_ERROR_MESSAGE"]
    C1 -->|"否"| C2{"response.ok？"}
    C2 -->|"否"| M1
    C2 -->|"是"| C3{"response.json()<br/>可解析？"}
    C3 -->|"否"| M1
    C3 -->|"是"| C4{"payload.ok 為真？"}
    C4 -->|"否"| M2["拋出 payload.error<br/>或 SUBMIT_ERROR_MESSAGE"]
    C4 -->|"是"| OK["回傳 payload"]
```

`SUBMIT_ERROR_MESSAGE` 是一般化訊息（`config.js`）；只有後端明確回傳 `error` 時才顯示具體原因。

## 診斷端點

直接用瀏覽器開啟 `/exec`（會走 `GET` → `doGet`）：

```json
{
  "ok": true,
  "service": "otc-application-form",
  "sheet": { "name": "Sheet1", "lastRow": 12, "lastColumn": 16 }
}
```

用來確認三件事：部署是否上線、是否正確附加在試算表上、欄位數是否為 16。若 `sheet` 變成 `{"error": "…"}`，代表綁定有問題。`lastColumn` 應等於 [schema.md](./schema.md#試算表欄位) 的欄位總數。

## 安全限制

```mermaid
flowchart TB
    A["/exec 網址"] --> B["任何持有此網址的人<br/>都能寫入任意資料列"]
    B --> C["GAS 無法限制呼叫來源"]
    C --> C1["ContentService 不允許自訂<br/>Access-Control-Allow-Origin"]
    C --> C2["GAS 也讀不到 Origin 標頭<br/>無法做 allowlist"]
    B --> D["試算表可能收到<br/>非本人填寫的資料"]
```

- 這對公開活動報名表通常可接受，但 **`/exec` 網址應視為公開資訊**，試算表不要存放敏感資料。
- 前端在送出前不做身分驗證，因此 `Code.gs` 也無法分辨「真的有人填表」與「有人用 curl 直接打」。
- 電郵欄位是新的曝露面：任何人都能寫入**任意電郵地址**。實務影響有限（只有勾「需要」時該地址才會收到一封確認信，收件者可以略過），但濫用者可以拿這個端點寄垃圾郵件給第三方。`MailApp` 的每日額度也會被消耗。
- 若需要保護，唯一可靠的作法是在前端加一個共用提交碼、並在 `doPost` 內比對（`Code.gs` 的檔頭註解有說明）。
