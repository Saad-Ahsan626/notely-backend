import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    env: {
      // Keep test output readable; failures are reported by Vitest itself
      LOG_LEVEL: 'silent',
      JWT_ACCESS_SECRET: 'test-only-access-token-secret-at-least-32-chars',
      // High enough that ordinary tests never hit it; the rate-limit test lowers it itself
      AUTH_RATE_LIMIT_PER_MINUTE: '500',
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
