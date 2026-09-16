import { EXAMPLE_JWT_SECRET, validateEnv } from './env.schema.js';

describe('validateEnv', () => {
  const validEnv = {
    NODE_ENV: 'development',
    PORT: '3000',
    DATABASE_URL: 'mysql://notely:secret@localhost:3306/notely_dev',
    JWT_ACCESS_SECRET: 'a-test-secret-that-is-long-enough-32',
  };

  it('returns typed values for a valid environment', () => {
    const env = validateEnv(validEnv);

    expect(env.PORT).toBe(3000);
    expect(env.NODE_ENV).toBe('development');
  });

  it('applies defaults for optional variables', () => {
    const env = validateEnv({
      DATABASE_URL: validEnv.DATABASE_URL,
      JWT_ACCESS_SECRET: validEnv.JWT_ACCESS_SECRET,
    });

    expect(env.NODE_ENV).toBe('development');
    expect(env.PORT).toBe(3000);
    expect(env.DATABASE_POOL_SIZE).toBe(10);
  });

  it('throws when DATABASE_POOL_SIZE is out of range', () => {
    expect(() => validateEnv({ ...validEnv, DATABASE_POOL_SIZE: '0' })).toThrow(
      /DATABASE_POOL_SIZE/,
    );
  });

  it('throws when DATABASE_URL is missing', () => {
    expect(() =>
      validateEnv({
        PORT: '3000',
        JWT_ACCESS_SECRET: validEnv.JWT_ACCESS_SECRET,
      }),
    ).toThrow(/DATABASE_URL/);
  });

  it('throws when DATABASE_URL is not a mysql URL', () => {
    expect(() =>
      validateEnv({ DATABASE_URL: 'postgres://user@localhost/db' }),
    ).toThrow(/mysql:\/\//);
  });

  it('throws when PORT is out of range', () => {
    expect(() => validateEnv({ ...validEnv, PORT: '70000' })).toThrow(/PORT/);
  });

  describe('authentication settings', () => {
    it('applies token and rate-limit defaults', () => {
      const env = validateEnv(validEnv);

      expect(env.ACCESS_TOKEN_TTL_MINUTES).toBe(15);
      expect(env.REFRESH_TOKEN_TTL_DAYS).toBe(7);
      expect(env.AUTH_RATE_LIMIT_PER_MINUTE).toBe(5);
    });

    it('requires a JWT secret', () => {
      const { JWT_ACCESS_SECRET: _omitted, ...withoutSecret } = validEnv;

      expect(() => validateEnv(withoutSecret)).toThrow(/JWT_ACCESS_SECRET/);
    });

    it('rejects a JWT secret shorter than 32 characters', () => {
      expect(() =>
        validateEnv({ ...validEnv, JWT_ACCESS_SECRET: 'too-short' }),
      ).toThrow(/at least 32 characters/);
    });

    it('accepts the example secret outside production', () => {
      expect(
        validateEnv({ ...validEnv, JWT_ACCESS_SECRET: EXAMPLE_JWT_SECRET })
          .JWT_ACCESS_SECRET,
      ).toBe(EXAMPLE_JWT_SECRET);
    });

    it('rejects the example secret in production', () => {
      expect(() =>
        validateEnv({
          ...validEnv,
          NODE_ENV: 'production',
          JWT_ACCESS_SECRET: EXAMPLE_JWT_SECRET,
        }),
      ).toThrow(/placeholder/);
    });

    it('rejects token lifetimes outside the allowed range', () => {
      expect(() =>
        validateEnv({ ...validEnv, ACCESS_TOKEN_TTL_MINUTES: '120' }),
      ).toThrow(/ACCESS_TOKEN_TTL_MINUTES/);
      expect(() =>
        validateEnv({ ...validEnv, REFRESH_TOKEN_TTL_DAYS: '0' }),
      ).toThrow(/REFRESH_TOKEN_TTL_DAYS/);
    });
  });

  describe('logging, CORS and proxy settings', () => {
    it('defaults to info logs, no CORS origins and no trusted proxy', () => {
      const env = validateEnv(validEnv);

      expect(env.LOG_LEVEL).toBe('info');
      expect(env.CORS_ORIGINS).toEqual([]);
      expect(env.TRUST_PROXY).toBe(0);
    });

    it('rejects an unknown log level', () => {
      expect(() => validateEnv({ ...validEnv, LOG_LEVEL: 'verbose' })).toThrow(
        /LOG_LEVEL/,
      );
    });

    it('parses a comma-separated CORS origin list, ignoring spaces and empty entries', () => {
      const env = validateEnv({
        ...validEnv,
        CORS_ORIGINS: ' http://localhost:5173, https://app.notely.dev ,',
      });

      expect(env.CORS_ORIGINS).toEqual([
        'http://localhost:5173',
        'https://app.notely.dev',
      ]);
    });

    it('rejects CORS origins that are not http(s) URLs', () => {
      expect(() =>
        validateEnv({ ...validEnv, CORS_ORIGINS: 'localhost:5173' }),
      ).toThrow(/CORS_ORIGINS/);
    });

    it('normalises CORS origins and rejects entries with a path', () => {
      const env = validateEnv({
        ...validEnv,
        CORS_ORIGINS: 'http://localhost:5173/,https://App.Notely.dev',
      });

      expect(env.CORS_ORIGINS).toEqual([
        'http://localhost:5173',
        'https://app.notely.dev',
      ]);
      expect(() =>
        validateEnv({
          ...validEnv,
          CORS_ORIGINS: 'https://app.notely.dev/login',
        }),
      ).toThrow(/origins only/);
    });

    it.each([
      ['0', 0],
      ['1', 1],
      ['2', 2],
      ['false', 0],
    ])('parses TRUST_PROXY=%s as %s trusted hops', (value, expected) => {
      expect(validateEnv({ ...validEnv, TRUST_PROXY: value }).TRUST_PROXY).toBe(
        expected,
      );
    });

    it.each(['true', 'maybe', '-1', '1.5', '11'])(
      'rejects TRUST_PROXY=%s (trusting every hop lets clients pick their IP)',
      (value) => {
        expect(() => validateEnv({ ...validEnv, TRUST_PROXY: value })).toThrow(
          /TRUST_PROXY/,
        );
      },
    );
  });
});
