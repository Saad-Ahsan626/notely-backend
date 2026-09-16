import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { createTestApp } from './utils/create-test-app.js';

/**
 * Runs in its own file so it can boot the app with a low limit without affecting
 * the other e2e suites (Vitest isolates files in separate processes).
 */
describe('Auth rate limiting (e2e)', () => {
  let app: NestExpressApplication;
  const api = () => request(app.getHttpServer());

  beforeAll(async () => {
    process.env['AUTH_RATE_LIMIT_PER_MINUTE'] = '3';
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('blocks brute-force login attempts with 429 and Retry-After', async () => {
    const attempt = () =>
      api()
        .post('/api/v1/auth/login')
        .send({ email: 'nobody@notely.test', password: 'WrongPassword123' });

    // Wrong credentials still count towards the limit
    await attempt().expect(401);
    await attempt().expect(401);
    await attempt().expect(401);

    const blocked = await attempt().expect(429);

    expect(blocked.body).toMatchObject({
      statusCode: 429,
      message: 'Too many requests, please try again later',
    });
    expect(blocked.headers['retry-after']).toBeDefined();
  });

  it('does not rate-limit ordinary endpoints', async () => {
    for (let call = 0; call < 10; call += 1) {
      await api().get('/api/v1/health').expect(200);
    }
  });
});
