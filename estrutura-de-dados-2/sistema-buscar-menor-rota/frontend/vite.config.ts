import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// O scripts/dev.mjs define API_PORT quando a 8000 está ocupada.
const portaApi = process.env.API_PORT ?? '8000'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': `http://127.0.0.1:${portaApi}`,
    },
  },
})
