import { existsSync } from 'node:fs';
import { defineConfig } from 'prisma/config';

// Prisma 7 no longer loads .env automatically. Locally, Node's built-in loader reads it;
// in CI the variables come from the environment and no .env file exists.
if (existsSync('.env')) {
  process.loadEnvFile('.env');
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    // Read with process.env (not Prisma's env() helper, which throws when a variable is missing)
    // so `prisma generate` also works on a fresh clone before .env exists.
    url: process.env['DATABASE_URL'],
    // Only needed by `prisma migrate dev`; never used by the running app.
    shadowDatabaseUrl: process.env['SHADOW_DATABASE_URL'],
  },
});
