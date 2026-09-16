import type { Type } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';

/**
 * Boots the real application for e2e tests, configured exactly like production.
 * Extra controllers can be mounted to exercise the shared request pipeline.
 */
export async function createTestApp(
  controllers: Type[] = [],
): Promise<NestExpressApplication> {
  // Imported lazily so a test can adjust process.env before ConfigModule reads it
  const { AppModule } = await import('../../src/app.module.js');
  const { configureApp } = await import('../../src/app.setup.js');

  const moduleFixture = await Test.createTestingModule({
    imports: [AppModule],
    controllers,
  }).compile();

  // Same options as main.ts
  const app = moduleFixture.createNestApplication<NestExpressApplication>({
    bufferLogs: true,
    bodyParser: false,
  });
  configureApp(app);
  await app.init();

  return app;
}
