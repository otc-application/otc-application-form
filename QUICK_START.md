# 重要連結

連結（已更新）

1. 一般用家

- 報名網頁：https://otc-application.github.io/otc-application-form/#registration
- 網頁 QRCode：https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=https%3A%2F%2Fotc-application.github.io%2Fotc-application-form%2F%23registration

2. 系統管理員

- 報名網頁：https://otc-application.github.io/otc-application-form/#registration
- Google 試算表（Excel）：https://docs.google.com/spreadsheets/d/1wVaSHBLfI3dPY1_R23lrZj3mi8EPhkO17YBbRzpaIus/edit?gid=0#gid=0
- README 文件：https://github.com/otc-application/otc-application-form/blob/main/README.md#快速開始

3. 程式開發員

- GitHub 庫：https://github.com/otc-application/otc-application-form/
- README 文件：https://github.com/otc-application/otc-application-form/blob/main/README.md
- 技術文件（架構 / API / Schema）：https://github.com/otc-application/otc-application-form/blob/main/2026-09-26%20-%20📄%20NEW%20PAGE%20-%20Me%20Time%20充充電報名表/doc/README.md

---

## 維護說明

- 本檔案是**純連結清單**，用途是直接複製轉傳（貼群組、傳給同工），不含任何操作步驟。
- 任何影響連結的變更（換活動資料夾、換 GitHub repo 或網域、換試算表、改活動名稱）都必須**同時更新本檔與 `README.md` 的 `## 快速開始`**。兩者不一致時，以本檔為轉傳用的可信版本。
- QR Code 網址的 `data=` 參數是**百分比編碼**後的報名網址（`#` 寫成 `%23`）。未編碼的 `#` 會被當成 URL 的 fragment 截斷，QR 內就沒有錨點，掃描只會開到頁面頂端；而且圖片照常顯示，肉眼看不出來。改動後請實際解碼驗一次。
- 試算表連結含報名者姓名與電話（PII），而 repo 為公開，該連結等同公開可被搜尋。真正的保護只能靠試算表權限（指定 Google 帳號可編輯），不要依賴「文件沒放連結」。
