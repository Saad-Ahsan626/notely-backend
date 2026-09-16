import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Env } from '../../config/env.schema.js';
import { JWT_AUDIENCE, JWT_ISSUER, TokenService } from './token.service.js';

const SECRET = 'unit-test-secret-that-is-long-enough-32';

function createService(): TokenService {
  const jwtService = new JwtService({
    secret: SECRET,
    signOptions: { algorithm: 'HS256' },
  });
  const values = { ACCESS_TOKEN_TTL_MINUTES: 15, REFRESH_TOKEN_TTL_DAYS: 7 };
  const config = {
    get: (key: keyof typeof values) => values[key],
  } as unknown as ConfigService<Env, true>;

  return new TokenService(jwtService, config);
}

describe('TokenService', () => {
  const service = createService();
  const identity = { userId: 'user-1', sessionId: 'session-1' };

  describe('access tokens', () => {
    it('signs and verifies a token carrying the user and session', async () => {
      const token = await service.signAccessToken(identity);

      await expect(service.verifyAccessToken(token)).resolves.toEqual(identity);
    });

    it('exposes the lifetime in seconds for the API response', () => {
      expect(service.accessTokenTtlSeconds).toBe(900);
    });

    it('rejects a tampered payload', async () => {
      const token = await service.signAccessToken(identity);
      const [header, , signature] = token.split('.');
      const forged = Buffer.from(
        JSON.stringify({ sub: 'attacker', sid: 'session-1' }),
      ).toString('base64url');

      await expect(
        service.verifyAccessToken([header, forged, signature].join('.')),
      ).rejects.toThrow(Error);
    });

    it('rejects an unsigned token (alg: none attack)', async () => {
      const header = Buffer.from(
        JSON.stringify({ alg: 'none', typ: 'JWT' }),
      ).toString('base64url');
      const payload = Buffer.from(
        JSON.stringify({
          sub: 'attacker',
          sid: 'session-1',
          iss: JWT_ISSUER,
          aud: JWT_AUDIENCE,
          exp: Math.floor(Date.now() / 1000) + 600,
        }),
      ).toString('base64url');

      await expect(
        service.verifyAccessToken([header, payload, ''].join('.')),
      ).rejects.toThrow(Error);
    });

    it('rejects a token signed with another secret', async () => {
      const other = new JwtService({
        secret: 'a-completely-different-secret-value',
      });
      const token = await other.signAsync(
        { sid: 'session-1' },
        {
          subject: 'user-1',
          issuer: JWT_ISSUER,
          audience: JWT_AUDIENCE,
          expiresIn: 60,
        },
      );

      await expect(service.verifyAccessToken(token)).rejects.toThrow(Error);
    });

    it('rejects a token meant for another audience or issuer', async () => {
      const jwtService = new JwtService({ secret: SECRET });
      const wrongAudience = await jwtService.signAsync(
        { sid: 'session-1' },
        {
          subject: 'user-1',
          issuer: JWT_ISSUER,
          audience: 'other-app',
          expiresIn: 60,
        },
      );
      const wrongIssuer = await jwtService.signAsync(
        { sid: 'session-1' },
        {
          subject: 'user-1',
          issuer: 'other-api',
          audience: JWT_AUDIENCE,
          expiresIn: 60,
        },
      );

      await expect(service.verifyAccessToken(wrongAudience)).rejects.toThrow(
        Error,
      );
      await expect(service.verifyAccessToken(wrongIssuer)).rejects.toThrow(
        Error,
      );
    });

    it('rejects an expired token', async () => {
      const jwtService = new JwtService({ secret: SECRET });
      const expired = await jwtService.signAsync(
        { sid: 'session-1' },
        {
          subject: 'user-1',
          issuer: JWT_ISSUER,
          audience: JWT_AUDIENCE,
          expiresIn: '-10s',
        },
      );

      await expect(service.verifyAccessToken(expired)).rejects.toThrow(Error);
    });
  });

  describe('refresh tokens', () => {
    it('generates a high-entropy secret and stores only its hash', () => {
      const { secret, hash } = service.generateRefreshSecret();

      expect(secret.length).toBeGreaterThanOrEqual(43);
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
      expect(hash).not.toContain(secret);
    });

    it('produces a different secret every time', () => {
      expect(service.generateRefreshSecret().secret).not.toBe(
        service.generateRefreshSecret().secret,
      );
    });

    it('composes and parses the token, splitting on the first dot only', () => {
      const token = service.composeRefreshToken('session-1', 'abc.def');

      expect(token).toBe('session-1.abc.def');
      expect(service.parseRefreshToken(token)).toEqual({
        sessionId: 'session-1',
        secret: 'abc.def',
      });
    });

    it.each(['', 'no-separator', '.secret-only', 'session-only.'])(
      'returns undefined for a malformed token: %s',
      (token) => {
        expect(service.parseRefreshToken(token)).toBeUndefined();
      },
    );

    it('matches a secret against its stored hash', () => {
      const { secret, hash } = service.generateRefreshSecret();

      expect(service.matchesStoredHash(secret, hash)).toBe(true);
      expect(service.matchesStoredHash('another-secret', hash)).toBe(false);
    });

    it('returns false for a stored hash of the wrong length instead of throwing', () => {
      const { secret } = service.generateRefreshSecret();

      expect(service.matchesStoredHash(secret, 'abcd')).toBe(false);
    });
  });
});
