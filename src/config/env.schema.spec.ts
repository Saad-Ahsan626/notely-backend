import { validateEnv } from './env.schema.js';

describe('validateEnv', () => {
  const validEnv = {
    NODE_ENV: 'development',
    PORT: '3000',
    DATABASE_URL: 'mysql://notely:secret@localhost:3306/notely_dev',
  };

  it('returns typed values for a valid environment', () => {
    const env = validateEnv(validEnv);

    expect(env.PORT).toBe(3000);
    expect(env.NODE_ENV).toBe('development');
  });

  it('applies defaults for optional variables', () => {
    const env = validateEnv({ DATABASE_URL: validEnv.DATABASE_URL });

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
    expect(() => validateEnv({ PORT: '3000' })).toThrow(/DATABASE_URL/);
  });

  it('throws when DATABASE_URL is not a mysql URL', () => {
    expect(() =>
      validateEnv({ DATABASE_URL: 'postgres://user@localhost/db' }),
    ).toThrow(/mysql:\/\//);
  });

  it('throws when PORT is out of range', () => {
    expect(() => validateEnv({ ...validEnv, PORT: '70000' })).toThrow(/PORT/);
  });

  describe('logging, CORS and proxy settings', () => {
    it('defaults to info logs, no CORS origins and no trusted proxy', () => {
      const env = validateEnv(validEnv);

      expect(env.LOG_LEVEL).toBe('info');
      expect(env.CORS_ORIGINS).toEqual([]);
      expect(env.TRUST_PROXY).toBe(false);
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

    it.each([
      ['true', true],
      ['false', false],
      ['1', true],
      ['0', false],
    ])('parses TRUST_PROXY=%s as %s', (value, expected) => {
      expect(validateEnv({ ...validEnv, TRUST_PROXY: value }).TRUST_PROXY).toBe(
        expected,
      );
    });

    it('rejects a TRUST_PROXY value that is not a boolean', () => {
      expect(() => validateEnv({ ...validEnv, TRUST_PROXY: 'maybe' })).toThrow(
        /TRUST_PROXY/,
      );
    });
  });
});
