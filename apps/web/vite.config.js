import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { fileURLToPath, URL } from 'node:url'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    // The `@` alias used to come from @base44/vite-plugin; it is declared here
    // now, matching the paths already in jsconfig.json.
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    // In development the API runs separately on :3000. In production the API
    // service serves this build itself, so requests are already same-origin.
    proxy: {
      '/api': {
        target: process.env.VITE_DEV_API_URL || 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
})
