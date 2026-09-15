import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import type { HealthStatus } from './interfaces/health-status.interface.js';
import type { ReadinessStatus } from './interfaces/readiness-status.interface.js';

@Injectable()
export class HealthService {
  constructor(private readonly prisma: PrismaService) {}

  /** Liveness: the process is running. Deliberately independent of the database. */
  check(): HealthStatus {
    return {
      status: 'ok',
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }

  /** Readiness: the app can serve requests because its dependencies respond. */
  async checkReadiness(): Promise<ReadinessStatus> {
    const databaseUp = await this.prisma.isHealthy();

    return databaseUp
      ? { status: 'ok', database: 'up' }
      : { status: 'error', database: 'down' };
  }
}
