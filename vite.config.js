import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // For GitHub Pages: set to your repo name
  // e.g. https://lukaluxo.github.io/ebm-explorer/
  base: '/ebm-explorer/',
  server: {
    port: 3000,
  },
})
