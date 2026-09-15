import { createPoolConfig } from './database-connection.js';

describe('createPoolConfig', () => {
  const baseEnv = {
    DATABASE_URL: 'mysql://notely:secret@db.internal:3307/notely_dev',
    DATABASE_POOL_SIZE: 15,
    NODE_ENV: 'development' as const,
  };

  it('maps the connection URL and pool size to driver settings', () => {
    expect(createPoolConfig(baseEnv)).toEqual({
      host: 'db.internal',
      port: 3307,
      user: 'notely',
      password: 'secret',
      database: 'notely_dev',
      connectionLimit: 15,
      allowPublicKeyRetrieval: true,
    });
  });

  it('defaults to port 3306 when the URL has no port', () => {
    const config = createPoolConfig({
      ...baseEnv,
      DATABASE_URL: 'mysql://notely:secret@localhost/notely_dev',
    });

    expect(config.port).toBe(3306);
  });

  it('decodes URL-encoded credentials', () => {
    const config = createPoolConfig({
      ...baseEnv,
      DATABASE_URL: 'mysql://notely:p%40ss%23word@localhost:3306/notely_dev',
    });

    expect(config.password).toBe('p@ss#word');
  });

  it('disables public key retrieval in production', () => {
    const config = createPoolConfig({ ...baseEnv, NODE_ENV: 'production' });

    expect(config.allowPublicKeyRetrieval).toBe(false);
  });
});
