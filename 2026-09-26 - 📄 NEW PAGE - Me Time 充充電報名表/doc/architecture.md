# 架構

## 高層次視圖

一句話話說：**這是一個純前端的靜態網站，把表單以跨網域 POST 送到一個 Google Apps Script Web App，由後端寫入 Google 試算表。** 網站本身沒有後端，也沒有資料庫。

```mermaid
flowchart TB
    subgraph 瀏覽器["使用者端（瀏覽器，無後端）"]
        direction TB
        UI["React SPA<br/>靜態 HTML + JS/CSS"]
        ENV["VITE_GAS_API_URL<br/>建置時內嵌的後端網址"]
    end

    subgraph 部署["GitHub Pages"]
        direction TB
        PAGES["https://otc-application.github.io/otc-application-form/<br/>由 dist/ 靜態提供"]
    end

    subgraph GAS["Google Apps Script（Web App）"]
        direction TB
        POST["doPost(e)<br/>解析 JSON、驗證標題列、append"]
        GET["doGet()<br/>診斷：回報試算表狀態"]
    end

    subgraph GSUITE["Google 試算表"]
        direction TB
        SHEET["目標工作表<br/>標題列 + 每列一位報名者"]
    end

    UI --> PAGES
    ENV -. "建置時注入" .-> UI
    UI -->|"HTTPS POST<br/>text/plain（簡單請求）"| POST
    GET -. "開啟 /exec 自我檢查" .-> UI
    POST --> SHEET
```

### 三個關鍵特性

1. **沒有自訂後端。** 網站是純靜態檔案，GitHub Pages 就能服務；所有後端邏輯只有一個 GAS 專案。
2. **資料不經過任何自架伺服器。** 報名資料從瀏覽器直接進到 Google 試算表。
3. **後端網址在建置時決定。** `VITE_GAS_API_URL` 由 `web/src/config.js` 在 build 時內嵌成字串，因此換後端不需要改任何元件。

## 前端模組地圖

```mermaid
flowchart TB
    MAIN["main.jsx<br/>掛載 React 根節點"]
    APP["App.jsx<br/>狀態機 + 事件協調"]
    CFG["config.js<br/>GAS_API_URL / isGasConfigured<br/>SUBMIT_ERROR_MESSAGE"]
    SCHEMA["data/formSchema.js<br/>表單單一資料來源"]
    EVENT["data/event.js<br/>活動說明文案"]
    SUB["lib/submission.js<br/>validateForm / buildColumns<br/>buildRow / submitApplication"]
    DESC["components/DescriptionSection.jsx"]
    FORM["components/RegistrationForm.jsx"]
    FIELD["components/Field.jsx<br/>依 type 分派"]
    LOAD["components/LoadingOverlay.jsx"]
    SUCC["components/SuccessScreen.jsx"]

    MAIN --> APP
    APP --> DESC
    APP --> FORM
    APP --> LOAD
    APP --> SUCC
    APP --> SUB
    DESC --> EVENT
    FORM --> SCHEMA
    FORM --> FIELD
    FIELD --> SCHEMA
    FIELD --> CFG
    FORM --> CFG
    SUB --> SCHEMA
    SUB --> CFG
    SUCC --> EVENT
    SUCC --> SCHEMA
```

`Field.jsx` 內部以 `switch (field.type)` 分派到五個渲染器（`TextField` / `RadioField` / `CheckboxGroupField` / `ChildrenField`）。版面元件是**泛用**的：不認識「愛荃堂」或「拉筋班」，只認得 `type`。

## 資料流：一份 schema，兩個用途

這是整個專案最重要的設計：**同一份 `formSchema` 同時產生畫面欄位與試算表欄位**，兩邊不可能不同步。

```mermaid
flowchart LR
    SRC["feed_prompt/Questions.md<br/>（人工改寫來源）"]
    SCHEMA["data/formSchema.js"]

    SCHEMA -->|"createInitialValues()"| STATE["FormState<br/>values 狀態樹"]
    SCHEMA -->|"formSchema.map()"| UI["RegistrationForm<br/>畫面欄位與順序"]
    SCHEMA -->|"buildColumns()"| COLS["headers 陣列"]
    SCHEMA -->|"buildRow()"| ROW["row 陣列"]

    STATE --> UI
    STATE --> ROW
    UI --> PAYLOAD["payload<br/>{ headers, row }"]
    COLS --> PAYLOAD
    ROW --> PAYLOAD
    PAYLOAD --> GAS["Code.gs appendRow()"]
```

- **畫面**：`RegistrationForm` 直接迭代 `formSchema`，並用 `index + 1` 當題號，所以畫面題號與 `Questions.md` 的編號一致。
- **資料**：`buildColumns()` 產生標題列，`buildRow()` 產生同長度的資料列，兩者由同一個 schema 推導，長度必然一致。

細節見 [schema.md](./schema.md)。

## App 狀態機

`App.jsx` 只有三個狀態，畫面行為完全由 `status` 決定。

```mermaid
stateDiagram-v2
    [*] --> idle : 初始

    idle --> submitting : handleSubmit<br/>驗證通過
    idle --> idle : 驗證失敗<br/>（顯示欄位錯誤、聚焦第一個錯誤欄位）

    submitting --> success : submitApplication() 成功<br/>（values 存入 submitted）
    submitting --> idle : 拋錯<br/>（顯示 submitError 訊息）

    success --> idle : 成功畫面按「再填一張報名表」<br/>handleReset 重設 values

    success --> [*]
```

兩種失敗的處理方式刻意不同：

- **驗證失敗**（前端，欄位級）：不發請求，標紅欄位並把焦點移到第一個錯誤欄位，方便手機使用者直接修正。
- **送出失敗**（網路／後端，訊息級）：回到 `idle`，在表單上方顯示紅色 alert，保留使用者已填的內容。

`status === 'success'` 時，`DescriptionSection` 仍會渲染（保留活動資訊供對照），只有表單區被換成 `SuccessScreen`。

## GAS 後端結構

```mermaid
flowchart TB
    ENTRY["doPost(e)"] --> PARSE["parseBody_(e)<br/>JSON.parse"]
    PARSE --> ARRAY["requireStringArray_(payload.headers)<br/>requireStringArray_(payload.row)"]
    ARRAY --> LEN{"headers.length<br/>=== row.length ?"}
    LEN -->|"否"| ERR["jsonResponse_ ok:false"]
    LEN -->|"是"| SHEET["getSheet_()<br/>getActiveSpreadsheet"]
    SHEET --> HEADER["ensureHeader_(sheet, headers)"]
    HEADER --> APPEND["sheet.appendRow(row)"]
    APPEND --> OK["jsonResponse_ ok:true<br/>{ headerCreated, row }"]
    ERR --> RESP["ContentService<br/>TextOutput JSON"]
    OK --> RESP

    GET["doGet()"] --> DESC["describeSheet_()"]
    DESC --> RESP
```

`Code.gs` 使用 ES5 語法（`var` / `function`）而非 `const` / arrow，這是 Apps Script V8 環境下的保守寫法，可避免編輯器與執行環境的解析差異。

## 建置與部署流程

```mermaid
flowchart TB
    DEV["開發者本機<br/>npm run dev / build"]
    COMMIT["git push → dev-001"]
    AM1["auto_merge.yml<br/>job: dev-001 → dev"]
    AM2["auto_merge.yml<br/>job: dev → main"]
    MAIN["main 分支"]
    DEPLOY["deploy_github_pages.yml<br/>在 push to main 時觸發"]
    LOCATE["Locate web app<br/>find -name package.json"]
    NODE["setup-node<br/>cache-dependency-path: **/package-lock.json"]
    CI["npm ci"]
    BUILD["npm run build<br/>→ dist/"]
    ART["upload-pages-artifact<br/>path: web/dist"]
    DEPL["deploy-pages"]
    SITE["GitHub Pages 站台"]

    DEV --> COMMIT --> AM1 --> AM2 --> MAIN --> DEPLOY
    DEPLOY --> LOCATE --> NODE --> CI --> BUILD --> ART --> DEPL --> SITE
```

需要注意的幾件事：

- **本專案不在 repo 根目錄**，在活動資料夾內的 `web/`。`Locate web app` 步驟用 `find` 動態搜尋，所以換活動資料夾不需要改 workflow。
- **定位腳本不可用 `xargs`**：活動資料夾名含空格與 emoji，`xargs` 會依空白切斷路徑，導致寫入 `$GITHUB_OUTPUT` 的內容變成多行而失敗。改用 `dir=${path%/*}`。
- **後端網址在建置時決定**：`npm run build` 會把 `VITE_GAS_API_URL` 內嵌進 bundle，來源是 repo 內已提交的 `web/.env.production`。workflow 沒有注入任何環境變數，**完全依賴這個檔案**。若它缺失，線上表單會顯示「網上報名暫未開放」且送出鈕停用 —— 而本機因為有 `.env.local` 不會發現。
- **Vite 載入優先順序**：`web/.env.production`（已提交）→ `web/.env.local`（gitignored，本機覆寫）。`npm run dev` 不讀 `.env.production`，只讀 `.env` / `.env.local`。
- Agent 永遠不直接推 `dev` / `main`；`main` 由 auto-merge 推進，因此**每次 auto-merge 都會觸發一次部署**。
- 需要 repo secret `GIT_PUSH_TOKEN`（fine-grained PAT，Contents: Read and write）。用 `GITHUB_TOKEN` 無法觸發後續 workflow，串接就會斷掉。

## 技術選型

| 項目 | 選擇 | 理由 |
| --- | --- | --- |
| 建置工具 | Vite 7 | 啟動快、`base` 可設子路徑以支援 GitHub Pages |
| UI | React 19 | `PROMPT.md` 指定 |
| 樣式 | Tailwind CSS v4 | `PROMPT.md` 指定；v4 以 `@tailwindcss/vite` 外掛整合，不需 postcss 設定 |
| 狀態管理 | React `useState` | 表單只有一份扁平狀態樹，不需要 Redux 等額外依賴 |
| 狀態樹來源 | `createInitialValues(schema)` | 初始值由 schema 推導，新增欄位不需手動補初始值 |
| 後端 | Google Apps Script | `PROMPT.md` 指定；免費、無需維護伺服器 |
| 部署 | GitHub Pages + Actions | `PROMPT.md` 指定 |

`package.json` 沒有任何表單或 UI 函式庫：表單渲染、驗證、序列化全部是這個專案自己寫的，因為需求（條件式欄位、逐場次多名子女、欄位順序等同試算表欄位）相當特定，通用函式庫反而要額外遷就。
