import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { fileURLToPath, URL } from 'node:url'

// https://vite.dev/config/
/**
 * Which build this is, baked in so the running app can say so.
 *
 * Railway sets RAILWAY_GIT_COMMIT_SHA during the build, and the API reports the
 * same value from /api/health — the two ship together out of one deploy, so
 * comparing them answers "is this tab running the current release" exactly.
 * Outside Railway it is 'local', and the update check stays quiet.
 */
const BUILD_ID = process.env.RAILWAY_GIT_COMMIT_SHA || 'local';

export default defineConfig({
  define: {
    __BUILD_ID__: JSON.stringify(BUILD_ID),
  },
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
