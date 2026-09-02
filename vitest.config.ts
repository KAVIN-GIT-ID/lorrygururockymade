import { defineConfig } from 'vitest/config';
import solid from 'vite-plugin-solid';
import path from 'path';

export default defineConfig({
  plugins: [solid({ hot: false })],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: './src/test/setup.ts',
    exclude: ['**/node_modules/**', '**/dist/**', 'e2e/**'],
    css: false,
  },
});
