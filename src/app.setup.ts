import { type INestApplication, VersioningType } from '@nestjs/common';

/**
 * App-wide configuration shared by main.ts and the e2e tests,
 * so tests always run the app exactly as it runs in production.
 */
export function configureApp(app: INestApplication): void {
  // All routes live under /api/v{version}/...
  app.setGlobalPrefix('api');
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  // Run onModuleDestroy / onApplicationShutdown hooks on SIGTERM / SIGINT
  app.enableShutdownHooks();
}
