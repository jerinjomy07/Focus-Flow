// mobile/vitest.config.ts
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
  },
  resolve: {
    alias: {
      'react-native': path.resolve(__dirname, './src/__tests__/mocks/react-native.ts'),
      'expo-secure-store': path.resolve(__dirname, './src/__tests__/mocks/expo-secure-store.ts'),
    },
  },
});
