import { resolve } from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { mymvpDevApiPlugin } from './scripts/vite-plugin-mymvp-api'

/** Browser build for Netlify (playable link like Mind-and-Venture). */
export default defineConfig({
  root: resolve('src/renderer'),
  base: '/',
  resolve: {
    alias: {
      '@renderer': resolve('src/renderer/src')
    }
  },
  define: {
    'import.meta.env.VITE_WEB_APP': JSON.stringify('true')
  },
  build: {
    outDir: resolve('dist/web'),
    emptyOutDir: true,
    rollupOptions: {
      input: resolve('src/renderer/index.html')
    }
  },
  plugins: [react(), mymvpDevApiPlugin()]
})
