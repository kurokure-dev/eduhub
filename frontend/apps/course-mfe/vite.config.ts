import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3001,
    strictPort: true,
    // /api 요청을 로컬 백엔드로 넘겨 CORS 설정 없이 개발한다
    proxy: {
      '/api': 'http://localhost:8080',
    },
  },
});
