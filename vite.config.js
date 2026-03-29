import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
// import { VitePWA } from 'vite-plugin-pwa'  // ← comenta isso

export default defineConfig({
  plugins: [
    react(),
    // VitePWA({ ... })  // ← e isso
  ],
})