import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config.ts';

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/setupTests.ts'],
      // 병렬 실행에서 파일 첫 테스트는 MUI·jsdom 초기 로딩이 느려 기본 5초를 넘기기도 한다
      testTimeout: 15000,
    },
  }),
);
