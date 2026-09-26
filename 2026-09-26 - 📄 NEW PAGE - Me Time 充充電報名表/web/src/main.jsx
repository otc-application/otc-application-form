import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import { isGasConfigured } from './config.js'
import './index.css'

// 缺少後端網址時，畫面上只會對訪客說明「請致電報名」（見 RegistrationForm），
// 技術細節改在 console 輸出，避免要求來報名的會眾去改設定檔。
if (!isGasConfigured) {
  console.warn(
    '[報名表] 尚未設定 VITE_GAS_API_URL，報名功能停用。請檢查 web/.env.production（正式建置）或 web/.env.local（本機開發）。',
  )
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
