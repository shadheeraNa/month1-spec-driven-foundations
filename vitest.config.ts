import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    // Default is node; component tests need a DOM. See research.md R1.
    environment: 'node',
    environmentMatchGlobs: [['tests/component/**', 'jsdom']],
    // Each suite provisions its own SQLite file, so suites must not share a process.
    fileParallelism: false,
  },
});
