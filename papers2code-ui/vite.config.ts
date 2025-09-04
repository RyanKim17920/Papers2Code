import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from "@tailwindcss/vite";
import path from "path"
// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('recharts')) return 'recharts';
            if (id.includes('react-datepicker') || id.includes('react-day-picker')) return 'date';
            if (id.includes('lucide-react')) return 'icons';
            if (id.includes('@mui') || id.includes('@emotion')) return 'mui';
            if (id.includes('reactflow')) return 'reactflow';
            if (id.includes('@tanstack')) return 'react-query';
            if (id.includes('react-router')) return 'router';
            return 'vendor';
          }
        },
      },
    },
  },
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
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
