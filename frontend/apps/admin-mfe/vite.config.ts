import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// 관리자 화면 (FR-03, D-34). 백엔드 주소는 BACKEND_URL로 바꿀 수 있다 (기본 http://localhost:8080)
const backendUrl = process.env.BACKEND_URL ?? 'http://localhost:8080';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3002,
    strictPort: true,
    // /api 요청을 로컬 백엔드로 넘겨 CORS 설정 없이 개발한다
    proxy: {
      '/api': backendUrl,
    },
  },
});
