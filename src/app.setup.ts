import { VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { REQUEST_ID_HEADER } from './common/http/request-id.js';
import { requireJsonBody } from './common/http/require-json-body.middleware.js';
import type { Env } from './config/env.schema.js';

/**
 * Largest accepted request body. A note is at most 50,000 characters. Clients that escape
 * non-ASCII text in JSON (a backslash-u sequence) send 6 bytes per character, about 300 KB,
 * so 512 KB fits the API contract with headroom.
 */
export const BODY_SIZE_LIMIT = '512kb';

/**
 * App-wide HTTP configuration shared by main.ts and the e2e tests,
 * so tests always run the app exactly as it runs in production.
 * (Validation, errors and response envelopes are registered in CommonModule.)
 */
export function configureApp(app: NestExpressApplication): void {
  const config = app.get<ConfigService<Env, true>>(ConfigService);

  // Structured pino logs for everything, including Nest's own messages
  app.useLogger(app.get(Logger));

  // Real client IPs from X-Forwarded-For, only when a trusted proxy sits in front
  app.set('trust proxy', config.get('TRUST_PROXY', { infer: true }));

  // Security headers; also removes X-Powered-By
  app.use(helmet());

  // CORS only affects browsers. Mobile apps and server-to-server calls ignore it.
  const corsOrigins = config.get('CORS_ORIGINS', { infer: true });
  app.enableCors({
    origin: corsOrigins.length > 0 ? corsOrigins : false,
    exposedHeaders: [REQUEST_ID_HEADER],
  });

  // JSON only: other formats get 415. The app is created with `bodyParser: false`, so Nest's
  // default form (urlencoded) parser is never registered.
  app.use(requireJsonBody);
  app.useBodyParser('json', { limit: BODY_SIZE_LIMIT });

  // All routes live under /api/v{version}/...
  app.setGlobalPrefix('api');
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  // Run onModuleDestroy / onApplicationShutdown hooks on SIGTERM / SIGINT
  app.enableShutdownHooks();
}
