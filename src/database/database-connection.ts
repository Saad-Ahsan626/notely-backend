import type { PoolConfig } from 'mariadb';
import type { Env } from '../config/env.schema.js';

type ConnectionEnv = Pick<
  Env,
  'DATABASE_URL' | 'DATABASE_POOL_SIZE' | 'NODE_ENV'
>;

/**
 * Converts the validated environment into MariaDB driver pool settings.
 * Shared by the Nest app (PrismaService) and standalone scripts (prisma/seed.ts).
 */
export function createPoolConfig(env: ConnectionEnv): PoolConfig {
  const url = new URL(env.DATABASE_URL);

  return {
    host: url.hostname,
    port: url.port ? Number(url.port) : 3306,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, ''),
    connectionLimit: env.DATABASE_POOL_SIZE,
    // MySQL 8 authenticates with caching_sha2_password. Without TLS the driver must fetch the
    // server's RSA public key. Acceptable for local and CI databases; production must use TLS.
    allowPublicKeyRetrieval: env.NODE_ENV !== 'production',
  };
}
