import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // During development the page runs on port 5173 and the API on 8080.
    // Forwarding /api here means the browser only ever talks to one
    // address, so there is nothing to block and no CORS to configure.
    proxy: {
      '/api': 'http://localhost:8080',
    },
  },
  test: {
    // Component and helper tests run in a simulated browser, no real one needed.
    environment: 'jsdom',
    globals: true,
  },
})
