import { Injectable } from '@nestjs/common';
import type { HealthStatus } from './interfaces/health-status.interface.js';

@Injectable()
export class HealthService {
  check(): HealthStatus {
    return {
      status: 'ok',
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }
}
