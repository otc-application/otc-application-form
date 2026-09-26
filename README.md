# OTC - 報名表格

活動報名網頁。React + Vite + Tailwind CSS 前端，Google Apps Script (GAS) 作為後端 API 將報名資料寫入 Google 試算表，前端部署於 GitHub Pages。

## 快速開始

> 依角色分組，請直接跳到對應的小節：會眾看 👥、管理報名資料看 🔧、要改程式看 💻。

### 👥 一般用家

- 📋 [**報名網頁**](https://otc-application.github.io/otc-application-form/#registration)
- 📱 **報名網頁 QR Code**（可列印貼在告示，或轉貼到群組宣傳）：

  ![Me Time 充充電報名表 QR Code](https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=https%3A%2F%2Fotc-application.github.io%2Fotc-application-form%2F%23registration)

### 🔧 系統管理員

- 📋 [**報名網頁**](https://otc-application.github.io/otc-application-form/#registration)
- 📊 [**Google 試算表（報名資料）**](https://docs.google.com/spreadsheets/d/1wVaSHBLfI3dPY1_R23lrZj3mi8EPhkO17YBbRzpaIus/edit?gid=0#gid=0)

### 💻 程式開發員

- 💻 [**GitHub 專案**](https://github.com/otc-application/otc-application-form/)
- 📖 [**Documentation（設定與部署）**](https://github.com/otc-application/otc-application-form/blob/main/README.md)

## 專案結構

```
2026-09-26 - 📄 NEW PAGE - Me Time 充充電報名表/
├── feed_prompt/          # 活動內容來源（Description.md / Questions.md）
├── gas/                  # Google Apps Script 後端（Code.gs）
├── web/                  # React + Vite 前端
└── doc/                  # 技術文件（架構 / API / schema，含 Mermaid 圖）
```

## 設定

### 1. 部署 GAS 後端

1. 開啟目標 Google 試算表 → 擴充功能 → Apps Script。
2. 把 `gas/Code.gs` 的內容貼到編輯器的 `Code.gs`（取代預設內容）並儲存。
   - `gas/appsscript.json` 是**選用**的專案設定檔。Apps Script 編輯器的檔案
     樹**預設不會顯示它**，必須到「專案設定 ⚙ → 一般」勾選「在編輯器中顯示
     appsscript.json 資訊清單檔」才看得到。
   - 本專案不需要它：提交時間是在瀏覽器端產生的，試算表存取也因為是
     「附加在試算表上」而無需額外授權，因此時區與執行環境設定都不影響結果。
3. 部署 → 新增部署 → 類型「網頁應用程式」：
   - 執行身分：**我**
   - 誰可以存取：**任何人**
4. 複製「網頁應用程式 URL」（結尾是 `/exec`，不是 `/dev`）。
5. 第一次使用請把試算表清空，標題列會由後端自動建立。

### 2. 設定前端 API 網址

後端網址在**建置時**由 Vite 內嵌進 JS bundle。這個專案用兩層設定：

| 檔案 | 是否 commit | 用途 |
| --- | --- | --- |
| `web/.env.production` | ✅ 是 | 正式建置（GitHub Actions）使用的後端網址 |
| `web/.env.local` | ❌ 否（已 gitignore） | 本機開發時覆寫用，優先順序較高 |

`.env.production` **已經包含目前活動的 `/exec` 網址並已提交**，因此一般情況下不需要任何設定，部署後即可報名。換活動時才需要修改它。

> `.env.production` 可以安全提交：GAS 的 `/exec` 網址不是密碼。瀏覽器必須知道它才能呼叫，因此它必然會出現在公開的 bundle 中，額外提交不會增加實質曝露。**但請勿在此放置任何真正的憑證、金鑰或個人資料。**

本機開發若要測試另一個後端（例如自己的試算表）：

```bash
cd "2026-09-26 - 📄 NEW PAGE - Me Time 充充電報名表/web"
cp .env.example .env.local
```

在 `.env.local` 填上 GAS 的 `/exec` 網址：

```
VITE_GAS_API_URL=https://script.google.com/macros/s/AKfycb.../exec
```

`.env.local` 已被 `.gitignore` 忽略。Vite 不會熱更新 `.env`，修改後需重啟 dev server。

### 3. 本機開發

```bash
cd "2026-09-26 - 📄 NEW PAGE - Me Time 充充電報名表/web"
npm install
npm run dev      # http://localhost:5173
npm run build    # 產出 dist/
```

### 4. 啟用 GitHub Pages 部署

`.github/workflows/deploy_github_pages.yml` 會在 **push 到 `main`** 時自動建置並發布，因此：

1. 前往 repo **Settings → Pages**，把 **Source** 設為 **GitHub Actions**（不是 Deploy from a branch）。
2. 之後每次自動合併到 `main` 就會重新部署。

## 注意事項

- **表單欄位順序不可任意更動**：`web/src/data/formSchema.js` 的欄位順序同時決定畫面順序與 Google 試算表的欄位順序，後端會逐欄比對標題列，順序不符會直接拒絕寫入。
- **後端 `Content-Type` 必須維持 `text/plain`**：GAS 無法處理 CORS 預檢（OPTIONS），改用 `application/json` 會讓瀏覽器先送預檢並收到 405，報名將完全送不出去。詳見 `gas/Code.gs` 開頭說明。
- 任何拿到 `/exec` 網址的人都能寫入資料，試算表請勿存放敏感資訊。

## 文件

- [PROMPT.md](./PROMPT.md) — 專案需求規格（權威來源）
- [AGENTS.md](./AGENTS.md) — 開發與 Git 流程規範
- [CHANGELOG.md](./CHANGELOG.md) — 變更紀錄
- [QUICK_START.md](./QUICK_START.md) — 純連結清單（可直接複製轉傳用）

活動內部技術文件（含 Mermaid 圖）：

- [doc/README.md](./2026-09-26%20-%20📄%20NEW%20PAGE%20-%20Me%20Time%20充充電報名表/doc/README.md) — 文件索引
- [architecture.md](./2026-09-26%20-%20📄%20NEW%20PAGE%20-%20Me%20Time%20充充電報名表/doc/architecture.md) — 高層次視圖、模組地圖、建置與部署流程
- [api.md](./2026-09-26%20-%20📄%20NEW%20PAGE%20-%20Me%20Time%20充充電報名表/doc/api.md) — GAS API 契約、請求／回應、錯誤語意
- [schema.md](./2026-09-26%20-%20📄%20NEW%20PAGE%20-%20Me%20Time%20充充電報名表/doc/schema.md) — 表單 schema 結構、試算表欄位對應
