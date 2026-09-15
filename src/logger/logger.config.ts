import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Params } from 'nestjs-pino';
import type { Env } from '../config/env.schema.js';
import {
  REQUEST_ID_HEADER,
  resolveRequestId,
} from '../common/http/request-id.js';

type LoggerEnv = Pick<Env, 'LOG_LEVEL' | 'NODE_ENV'>;

/** Fields that must never reach the logs. */
export const REDACTED_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
  '*.password',
  '*.passwordHash',
  '*.refreshToken',
  '*.accessToken',
];

/** Health probes run every few seconds; logging them would drown real traffic. */
const HEALTH_ROUTE = /^\/api\/v\d+\/health(?:[/?]|$)/;

/** Express rewrites `req.url` while routing; `originalUrl` keeps the full path, including /api. */
function fullUrl(req: IncomingMessage): string {
  const originalUrl: unknown = Reflect.get(req, 'originalUrl');
  return typeof originalUrl === 'string' ? originalUrl : (req.url ?? '');
}

export function createLoggerParams(env: LoggerEnv): Params {
  return {
    pinoHttp: {
      level: env.LOG_LEVEL,

      // Readable, colored output while developing; one JSON object per line everywhere else
      transport:
        env.NODE_ENV === 'development'
          ? {
              target: 'pino-pretty',
              options: {
                singleLine: true,
                translateTime: 'SYS:HH:MM:ss.l',
                ignore: 'pid,hostname',
              },
            }
          : undefined,

      redact: { paths: REDACTED_PATHS, censor: '[Redacted]' },

      serializers: {
        // Response headers are mostly static security headers: ~1 KB of noise per request
        res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
      },

      genReqId: (req: IncomingMessage, res: ServerResponse) => {
        const requestId = resolveRequestId(req.headers['x-request-id']);
        res.setHeader(REQUEST_ID_HEADER, requestId);
        return requestId;
      },

      // Client mistakes (4xx) are warnings, server failures (5xx) are errors
      customLogLevel: (_req, res, error) => {
        if (error || res.statusCode >= 500) {
          return 'error';
        }
        return res.statusCode >= 400 ? 'warn' : 'info';
      },

      customSuccessMessage: (req, res, responseTime) =>
        `${req.method} ${fullUrl(req)} ${res.statusCode} ${Math.round(responseTime)}ms`,

      autoLogging: {
        ignore: (req) => HEALTH_ROUTE.test(fullUrl(req)),
      },

      // Logs written during a request carry only its reqId, not the whole request object again
      quietReqLogger: true,
    },
  };
}
