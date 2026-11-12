import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config.ts';

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/setupTests.ts'],
      // 대화상자에 userEvent로 입력하는 테스트는 PC 부하가 크면 기본값 5초를 넘길 수 있다
      testTimeout: 15000,
    },
  }),
);
