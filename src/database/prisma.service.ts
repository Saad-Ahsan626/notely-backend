import {
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { createConnection, type PoolConfig } from 'mariadb';
import type { Env } from '../config/env.schema.js';
import { PrismaClient } from '../generated/prisma/client.js';
import { createPoolConfig } from './database-connection.js';

/**
 * The single Prisma client for the app. Each PrismaClient owns a connection pool,
 * so exactly one instance must exist per process (Nest providers are singletons).
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);
  private readonly poolConfig: PoolConfig;

  constructor(config: ConfigService<Env, true>) {
    const poolConfig = createPoolConfig({
      DATABASE_URL: config.get('DATABASE_URL', { infer: true }),
      DATABASE_POOL_SIZE: config.get('DATABASE_POOL_SIZE', { infer: true }),
      NODE_ENV: config.get('NODE_ENV', { infer: true }),
    });
    super({ adapter: new PrismaMariaDb(poolConfig) });
    this.poolConfig = poolConfig;
  }

  async onModuleInit(): Promise<void> {
    await this.verifyConnection();
    this.logger.log('Database connection established');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
    this.logger.log('Database connection closed');
  }

  /** Readiness probe: true when the database answers a trivial query. */
  async isHealthy(): Promise<boolean> {
    try {
      await this.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Fails fast at startup with MySQL's real error (e.g. "Access denied").
   * A direct connection is used because the pool retries failed connections until its
   * acquire timeout and then reports only a generic "pool timeout".
   */
  private async verifyConnection(): Promise<void> {
    try {
      const connection = await createConnection(this.poolConfig);
      await connection.end();
    } catch (error) {
      throw new Error(
        `Cannot connect to the database: ${describeError(error)}`,
        { cause: error },
      );
    }
  }
}

/**
 * Some network errors carry no message of their own: when "localhost" resolves to both
 * IPv6 and IPv4 and both are refused, Node reports an AggregateError holding the details.
 */
function describeError(error: unknown): string {
  if (error instanceof AggregateError && error.errors.length > 0) {
    return error.errors.map(describeError).join('; ');
  }
  if (error instanceof Error) {
    if (error.message) {
      return error.message;
    }
    if (error.cause) {
      return describeError(error.cause);
    }
    const code: unknown = Reflect.get(error, 'code');
    return typeof code === 'string' ? code : error.name;
  }
  return String(error);
}
