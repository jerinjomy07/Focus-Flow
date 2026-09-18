import { defineConfig } from 'vitest/config';
import path from 'path';

process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ||
  'postgresql://postgres:password@localhost:5433/focusflow_test?schema=public';
process.env.DIRECT_URL =
  process.env.TEST_DATABASE_URL ||
  'postgresql://postgres:password@localhost:5433/focusflow_test?schema=public';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    fileParallelism: false,
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
