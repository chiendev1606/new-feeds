import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const BACKEND_URL = 'http://localhost:3001';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    // Frontend gọi /api cùng origin → không cần CORS; Vite chuyển tiếp sang backend Express.
    proxy: {
      '/api': BACKEND_URL,
      '/media': BACKEND_URL,
      '/__mock': BACKEND_URL,
    },
  },
});
