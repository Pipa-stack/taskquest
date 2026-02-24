import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    // Pure domain tests — no DOM needed
    environment: 'node',
    include: ['src/**/*.test.js', 'src/**/*.test.jsx'],
  },
})
