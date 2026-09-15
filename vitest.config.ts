import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    env: {
      // Keep test output readable; failures are reported by Vitest itself
      LOG_LEVEL: 'silent',
    },
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          include: ['src/**/*.spec.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'e2e',
          include: ['test/**/*.e2e-spec.ts'],
          // Booting the app (and loading its dependencies on a cold CI runner) can exceed 10s
          hookTimeout: 30_000,
          env: {
            // A known browser origin so CORS behaviour can be tested
            CORS_ORIGINS: 'http://allowed.test',
          },
        },
      },
    ],
  },
});
