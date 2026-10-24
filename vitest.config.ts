import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
      'server-only': path.resolve(import.meta.dirname, 'tests/unit/helpers/empty.ts'),
    },
  },
  test: {
    include: ['tests/unit/**/*.test.ts', 'tests/unit/**/*.test.tsx'],
    environment: 'node',
    testTimeout: 30000,
    // Each database test file migrates its own in-memory Postgres; under a full parallel run that can take a while.
    hookTimeout: 60000,
  },
});
