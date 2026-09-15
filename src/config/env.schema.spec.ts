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
});
