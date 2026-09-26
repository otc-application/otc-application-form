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
        G-->>F: 200 { ok:true, headerCreated, row }
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
  "row": 12
}
```

| 欄位 | 意義 |
| --- | --- |
| `ok` | 前端唯一判斷成功與否的依據 |
| `service` | 服務名稱，用於確認打到正確的部署 |
| `headerCreated` | 本次是否建立了標題列（`true` 表示這是第一筆報名） |
| `row` | 寫入後的資料列數，可用於人工抽查 |

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
  "sheet": { "name": "Sheet1", "lastRow": 12, "lastColumn": 14 }
}
```

用來確認三件事：部署是否上線、是否正確附加在試算表上、欄位數是否為 14。若 `sheet` 變成 `{"error": "…"}`，代表綁定有問題。`lastColumn` 應等於 [schema.md](./schema.md#試算表欄位) 的欄位總數。

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
- 若需要保護，唯一可靠的作法是在前端加一個共用提交碼、並在 `doPost` 內比對（`Code.gs` 的檔頭註解有說明）。
