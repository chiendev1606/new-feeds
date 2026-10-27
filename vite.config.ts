import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const BACKEND_URL = 'http://localhost:3001';

export default defineConfig({
  plugins: [react()],
  // Thư viện của tab "Bài học" chỉ được import động. Khai báo trước để Vite tối ưu ngay lúc khởi động;
  // nếu không, lần đầu mở tab Vite mới phát hiện dependency → tối ưu → TỰ TẢI LẠI TRANG (mất state của demo).
  optimizeDeps: {
    include: ['marked', 'mermaid', 'highlight.js/lib/core', 'highlight.js/lib/languages/typescript', 'highlight.js/lib/languages/javascript', 'highlight.js/lib/languages/sql', 'highlight.js/lib/languages/css'],
  },
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
