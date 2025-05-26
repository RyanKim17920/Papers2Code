import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Proxy API requests to the FastAPI backend
      // Adjust the target if your FastAPI server runs on a different port
      '/api': {
        target: 'http://localhost:5000', // Your FastAPI backend URL
        changeOrigin: true, // Needed for virtual hosted sites
        rewrite: (path) => path.replace(/^\/api/, ''), // Rewrite the path: remove /api prefix
      },
    },
  },
})
