import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// GitHub Pages 會把站台掛在 /<repo-name>/ 子路徑下，base 必須包含 repo 名稱，
// 否則打包後的資源路徑（/assets/...）會 404。
export default defineConfig({
  base: '/otc-application-form/',
  plugins: [react(), tailwindcss()],
})
