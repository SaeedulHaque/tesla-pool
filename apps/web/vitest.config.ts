import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@tesla-pool/shared': path.resolve(__dirname, '../../packages/shared/src/index.ts'),
    },
  },
  test: { environment: 'node', include: ['test/**/*.test.ts'] },
});
