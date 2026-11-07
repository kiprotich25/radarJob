import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
    testTimeout: 20000,
  },
  // SWC emits decorator metadata, which Nest's dependency injection needs.
  plugins: [swc.vite({ module: { type: 'es6' } })],
});
