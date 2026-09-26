/**
 * 全站唯一的後端設定來源。
 *
 * GAS Web App 網址請透過環境變數注入，不要硬編碼到元件內：
 *   1. 複製 .env.example 為 .env.local
 *   2. 填上 GAS Web App 的 /exec 網址
 *   3. 重新啟動 dev server（Vite 不會熱更新 .env）
 *
 * 未設定時前端不會發出請求，會在畫面上提示，避免使用者送出後才失敗。
 */
// 用 ?. 是為了讓這個檔案在純 Node（如驗腳本）下也能被 import，
// Vite 會在 build 時把 import.meta.env 靜態取代掉。
const rawUrl = (import.meta.env?.VITE_GAS_API_URL ?? '').trim()

export const GAS_API_URL = rawUrl

export const isGasConfigured = /^https:\/\/.+\/exec$/.test(rawUrl)

/** 送出失敗時給使用者的提示文案。 */
export const SUBMIT_ERROR_MESSAGE =
  '報名資料傳送失敗，請稍後再試，或直接致電查詢電話協助報名。'
