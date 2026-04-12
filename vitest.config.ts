import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // コンポーネントテスト用にjsdom環境を個別指定可能
    environmentMatchGlobs: [
      ['components/**/__tests__/*.test.tsx', 'jsdom'],
    ],
    setupFiles: ['./components/ui/__tests__/setup.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
});
