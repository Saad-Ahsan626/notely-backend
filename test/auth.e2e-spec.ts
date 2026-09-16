import { randomUUID } from 'node:crypto';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { PrismaService } from '../src/database/prisma.service.js';
import { createTestApp } from './utils/create-test-app.js';

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
}

describe('Authentication (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  const createdEmails: string[] = [];
  const api = () => request(app.getHttpServer());
  const password = 'CorrectHorseBattery1';

  /** Unique per test, so runs never collide and cleanup is precise. */
  function uniqueEmail(): string {
    const email = `e2e-${randomUUID()}@notely.test`;
    createdEmails.push(email);
    return email;
  }

  async function registerUser(
    email = uniqueEmail(),
  ): Promise<{ email: string; tokens: AuthTokens }> {
    const response = await api()
      .post('/api/v1/auth/register')
      .send({ name: 'E2E User', email, password })
      .expect(201);

    return { email, tokens: response.body.data.tokens };
  }

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    if (createdEmails.length > 0) {
      await prisma.user.deleteMany({ where: { email: { in: createdEmails } } });
    }
    await app.close();
  });

  describe('registration', () => {
    it('creates an account and returns tokens, never the password hash', async () => {
      const email = uniqueEmail();

      const response = await api()
        .post('/api/v1/auth/register')
        .send({ name: 'E2E User', email, password })
        .expect(201);

      expect(response.body.data.user).toEqual({
        id: expect.any(String),
        name: 'E2E User',
        email,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      });
      expect(response.body.data.tokens).toEqual({
        accessToken: expect.any(String),
        refreshToken: expect.any(String),
        tokenType: 'Bearer',
        expiresIn: 900,
      });
      expect(JSON.stringify(response.body)).not.toMatch(/argon2|passwordHash/);
    });

    it('normalizes the email to lowercase', async () => {
      const email = uniqueEmail();

      const response = await api()
        .post('/api/v1/auth/register')
        .send({ name: 'E2E User', email: email.toUpperCase(), password })
        .expect(201);

      expect(response.body.data.user.email).toBe(email);
    });

    it('rejects a duplicate email with 409', async () => {
      const { email } = await registerUser();

      const response = await api()
        .post('/api/v1/auth/register')
        .send({ name: 'Someone Else', email, password })
        .expect(409);

      expect(response.body.message).toBe('Email is already registered');
    });

    it('rejects weak or malformed input with field details', async () => {
      const response = await api()
        .post('/api/v1/auth/register')
        .send({ name: 'A', email: 'not-an-email', password: 'short' })
        .expect(400);

      expect(
        response.body.details.map((d: { field: string }) => d.field),
      ).toEqual(expect.arrayContaining(['name', 'email', 'password']));
    });
  });

  describe('login', () => {
    it('returns tokens for correct credentials', async () => {
      const { email } = await registerUser();

      const response = await api()
        .post('/api/v1/auth/login')
        .send({ email, password })
        .expect(200);

      expect(response.body.data.tokens.accessToken).toEqual(expect.any(String));
    });

    it('gives the same answer for a wrong password and an unknown email', async () => {
      const { email } = await registerUser();

      const wrongPassword = await api()
        .post('/api/v1/auth/login')
        .send({ email, password: 'WrongPassword123' })
        .expect(401);
      const unknownEmail = await api()
        .post('/api/v1/auth/login')
        .send({ email: uniqueEmail(), password })
        .expect(401);

      expect(wrongPassword.body.message).toBe('Invalid credentials');
      expect(unknownEmail.body.message).toBe(wrongPassword.body.message);
    });
  });

  describe('protected routes', () => {
    it('returns the profile with a valid access token', async () => {
      const { email, tokens } = await registerUser();

      const response = await api()
        .get('/api/v1/users/me')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .expect(200);

      expect(response.body.data.email).toBe(email);
    });

    it.each([
      ['no token', undefined],
      ['a malformed token', 'Bearer not-a-jwt'],
      ['the wrong scheme', 'Basic dXNlcjpwYXNz'],
    ])('rejects a request with %s', async (_case, authorization) => {
      const call = api().get('/api/v1/users/me');
      if (authorization) {
        call.set('Authorization', authorization);
      }

      const response = await call.expect(401);
      expect(response.body.statusCode).toBe(401);
    });

    it('keeps health endpoints public', async () => {
      await api().get('/api/v1/health').expect(200);
    });
  });

  describe('refresh token rotation', () => {
    it('issues a new pair and invalidates the old refresh token', async () => {
      const { tokens } = await registerUser();

      const refreshed = await api()
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: tokens.refreshToken })
        .expect(200);

      expect(refreshed.body.data.refreshToken).not.toBe(tokens.refreshToken);
      expect(refreshed.body.data.accessToken).toEqual(expect.any(String));
    });

    it('revokes every session when an old refresh token is replayed', async () => {
      const { email, tokens } = await registerUser();
      // A second device, so revocation of *other* sessions is proven too
      const otherDevice = await api()
        .post('/api/v1/auth/login')
        .send({ email, password })
        .expect(200);
      const otherTokens: AuthTokens = otherDevice.body.data.tokens;
      const rotated = await api()
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: tokens.refreshToken })
        .expect(200);
      const newTokens: AuthTokens = rotated.body.data;

      // Replaying the spent token means someone else holds a copy
      await api()
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: tokens.refreshToken })
        .expect(401);

      // ... so the whole session family dies, including the newest tokens
      await api()
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: newTokens.refreshToken })
        .expect(401);
      await api()
        .get('/api/v1/users/me')
        .set('Authorization', `Bearer ${newTokens.accessToken}`)
        .expect(401);
      await api()
        .get('/api/v1/users/me')
        .set('Authorization', `Bearer ${otherTokens.accessToken}`)
        .expect(401);
    });

    it('does not log anyone out when a session ID is paired with a guessed secret', async () => {
      const { tokens } = await registerUser();
      // The session ID is readable by anyone who has seen an access token
      const payload: unknown = JSON.parse(
        Buffer.from(
          tokens.accessToken.split('.')[1] ?? '',
          'base64url',
        ).toString(),
      );
      const sessionId = (payload as { sid: string }).sid;

      await api()
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: `${sessionId}.a-guessed-secret-value` })
        .expect(401);

      // The real user is still signed in and can still refresh
      await api()
        .get('/api/v1/users/me')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .expect(200);
      await api()
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: tokens.refreshToken })
        .expect(200);
    });

    it('rejects a refresh token for an unknown session', async () => {
      await api()
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: `${randomUUID()}.some-secret-value` })
        .expect(401);
    });
  });

  describe('logout', () => {
    it('makes the access token unusable immediately', async () => {
      const { tokens } = await registerUser();

      await api()
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .expect(204);

      await api()
        .get('/api/v1/users/me')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .expect(401);
      await api()
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: tokens.refreshToken })
        .expect(401);
    });

    it('logs out every device at once', async () => {
      const { email, tokens: first } = await registerUser();
      const secondLogin = await api()
        .post('/api/v1/auth/login')
        .send({ email, password })
        .expect(200);
      const second: AuthTokens = secondLogin.body.data.tokens;

      await api()
        .post('/api/v1/auth/logout-all')
        .set('Authorization', `Bearer ${first.accessToken}`)
        .expect(204);

      await api()
        .get('/api/v1/users/me')
        .set('Authorization', `Bearer ${first.accessToken}`)
        .expect(401);
      await api()
        .get('/api/v1/users/me')
        .set('Authorization', `Bearer ${second.accessToken}`)
        .expect(401);
    });
  });

  describe('session records', () => {
    it('stores a hashed refresh token with the device details', async () => {
      const { email, tokens } = await registerUser();
      const user = await prisma.user.findUniqueOrThrow({ where: { email } });
      const session = await prisma.session.findFirstOrThrow({
        where: { userId: user.id },
      });

      expect(session.refreshTokenHash).toMatch(/^[0-9a-f]{64}$/);
      expect(tokens.refreshToken).toContain(session.id);
      expect(tokens.refreshToken).not.toContain(session.refreshTokenHash);
      expect(session.revokedAt).toBeNull();
      expect(session.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });
  });
});
