import { randomUUID } from 'node:crypto';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { PrismaService } from '../src/database/prisma.service.js';
import { createTestApp } from './utils/create-test-app.js';

/**
 * Runs in its own file so it can boot the app with a low limit and one trusted proxy hop
 * without affecting the other e2e suites (Vitest isolates files).
 */
describe('Auth rate limiting (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  const createdEmails: string[] = [];
  const api = () => request(app.getHttpServer());

  beforeAll(async () => {
    process.env['AUTH_RATE_LIMIT_PER_MINUTE'] = '3';
    // The test client plays the role of one reverse proxy
    process.env['TRUST_PROXY'] = '1';
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    if (createdEmails.length > 0) {
      await prisma.user.deleteMany({ where: { email: { in: createdEmails } } });
    }
    await app.close();
  });

  const failedLogin = (forwardedFor?: string) => {
    const call = api()
      .post('/api/v1/auth/login')
      .send({ email: 'nobody@notely.test', password: 'WrongPassword123' });
    return forwardedFor ? call.set('X-Forwarded-For', forwardedFor) : call;
  };

  it('blocks brute-force login attempts with 429 and Retry-After', async () => {
    // Wrong credentials still count towards the limit
    await failedLogin().expect(401);
    await failedLogin().expect(401);
    await failedLogin().expect(401);

    const blocked = await failedLogin().expect(429);

    expect(blocked.body).toMatchObject({
      statusCode: 429,
      message: 'Too many requests, please try again later',
    });
    expect(blocked.headers['retry-after']).toBeDefined();
  });

  it('cannot be bypassed by inventing X-Forwarded-For entries', async () => {
    // The trusted proxy appends the real client IP on the right; the client controls the rest
    const realClient = '203.0.113.7';
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      await failedLogin(`10.0.0.${attempt}, ${realClient}`).expect(401);
    }

    await failedLogin(`10.0.0.99, ${realClient}`).expect(429);
  });

  it('also limits token refresh attempts', async () => {
    const attempt = () =>
      api()
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: `${randomUUID()}.guessed-secret-value` });

    await attempt().expect(401);
    await attempt().expect(401);
    await attempt().expect(401);
    await attempt().expect(429);
  });

  it('stores no IP address when the forwarded value is not an IP', async () => {
    const email = `e2e-ip-${randomUUID()}@notely.test`;
    createdEmails.push(email);

    // Previously a 60-character value overflowed the column and returned 500
    await api()
      .post('/api/v1/auth/register')
      .set('X-Forwarded-For', 'a'.repeat(60))
      .send({ name: 'Proxy Test', email, password: 'CorrectHorseBattery1' })
      .expect(201);

    const user = await prisma.user.findUniqueOrThrow({
      where: { email },
      include: { sessions: true },
    });
    expect(user.sessions[0]?.ipAddress).toBeNull();
  });

  it('does not rate-limit ordinary endpoints', async () => {
    for (let call = 0; call < 10; call += 1) {
      await api().get('/api/v1/health').expect(200);
    }
  });
});
