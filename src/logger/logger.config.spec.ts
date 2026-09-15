import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Options } from 'pino-http';
import { createLoggerParams, REDACTED_PATHS } from './logger.config.js';

function pinoHttpOptions(
  env: Parameters<typeof createLoggerParams>[0],
): Options {
  return createLoggerParams(env).pinoHttp as Options;
}

const res = (statusCode: number) => ({ statusCode }) as ServerResponse;
const req = (url: string) => ({ url }) as IncomingMessage;

describe('createLoggerParams', () => {
  it('uses the configured log level', () => {
    expect(
      pinoHttpOptions({ LOG_LEVEL: 'debug', NODE_ENV: 'production' }).level,
    ).toBe('debug');
  });

  it('pretty-prints in development only', () => {
    expect(
      pinoHttpOptions({ LOG_LEVEL: 'info', NODE_ENV: 'development' }).transport,
    ).toMatchObject({ target: 'pino-pretty' });
    expect(
      pinoHttpOptions({ LOG_LEVEL: 'info', NODE_ENV: 'production' }).transport,
    ).toBeUndefined();
  });

  it('redacts credentials and tokens', () => {
    expect(REDACTED_PATHS).toEqual(
      expect.arrayContaining([
        'req.headers.authorization',
        'req.headers.cookie',
        '*.password',
        '*.refreshToken',
      ]),
    );
  });

  describe('customLogLevel', () => {
    const { customLogLevel } = pinoHttpOptions({
      LOG_LEVEL: 'info',
      NODE_ENV: 'test',
    });

    it.each([
      [200, 'info'],
      [201, 'info'],
      [404, 'warn'],
      [409, 'warn'],
      [500, 'error'],
      [503, 'error'],
    ])('logs status %s at %s', (status, level) => {
      expect(customLogLevel?.(req('/'), res(status))).toBe(level);
    });

    it('logs at error when the request errored', () => {
      expect(customLogLevel?.(req('/'), res(200), new Error('boom'))).toBe(
        'error',
      );
    });
  });

  describe('automatic request logs', () => {
    const autoLogging = pinoHttpOptions({ LOG_LEVEL: 'info', NODE_ENV: 'test' })
      .autoLogging as { ignore: (req: IncomingMessage) => boolean };

    it.each(['/api/v1/health', '/api/v1/health/ready', '/api/v2/health?x=1'])(
      'skips health probe %s',
      (url) => {
        expect(autoLogging.ignore(req(url))).toBe(true);
      },
    );

    it.each(['/api/v1/notes', '/api/v1/healthy-recipes'])('logs %s', (url) => {
      expect(autoLogging.ignore(req(url))).toBe(false);
    });
  });

  describe('log content', () => {
    const options = pinoHttpOptions({ LOG_LEVEL: 'info', NODE_ENV: 'test' });

    it('uses the full original URL in the completion message', () => {
      // Express rewrites req.url during routing; originalUrl keeps the /api prefix
      const routedRequest = {
        method: 'GET',
        url: '/v1/notes',
        originalUrl: '/api/v1/notes',
      } as unknown as IncomingMessage;

      expect(
        options.customSuccessMessage?.(routedRequest, res(200), 12.4),
      ).toBe('GET /api/v1/notes 200 12ms');
    });

    it('logs only the status code of responses, not every header', () => {
      const serializeResponse = options.serializers?.['res'];

      expect(
        serializeResponse?.({
          statusCode: 201,
          headers: { 'content-security-policy': '...' },
        }),
      ).toEqual({ statusCode: 201 });
    });
  });
});
